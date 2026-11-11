// NOTE (slice 2a): `countryBias` was removed from geocodeAddress (the soft bias changed no result, which is what this POC measured), so the
// calls below pass the proximity point only; the numbers recorded in the spec were measured before that removal.
// One-off POC, local only (never committed): compares four ways of building the Geoapify query for a schedule/event location,
// on a sample of REAL locations pulled from the public prod API. No database access, no cache, no writes.
//   S0  today's production logic (text, bias from the PRIMARY account's default location only)
//   S1  S0 + the context of ANY author (primary, else a co-author's default location)
//   SC  S1 + code-derived keywords: the text, then the author's region appended when the text lacks it; 2-step ladder
//   SB  S1 + Gemini-derived keywords from a separate text-only call; 2-step ladder
// Usage: npx tsx scripts/poc-location-keywords-oneoff.ts <items.json> <out.json>
import * as fs from 'fs';
import { filterPlausibleCandidates, selectBestCandidate, computeDistanceKm } from '@festgrid/domain/geolocation';
import { GeolocationNotFoundError, geocodeAddress } from '../src/lib/geolocation/geoapify-client.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';

type Region = { city: string | null; province: string | null; countryCode: string | null; lat: number; lng: number };
type Item = {
  id: string;
  stratum: string;
  text: string;
  eventName: string;
  hashtags: string[];
  description: string;
  coauthored: boolean;
  primaryDefault: Region | null;
  coauthorDefaults: Region[];
  regionWordInText: boolean;
};
type Resolved = { city?: string; province?: string; formatted?: string; lat: number; lng: number; confidence?: number; matchType?: string };

let geoCalls = 0;
const memo = new Map<string, Promise<Resolved | null>>();

async function resolve(query: string, ctx: Region | null): Promise<Resolved | null> {
  const key = `${query}|${ctx ? ctx.countryCode + ctx.lat.toFixed(1) + ctx.lng.toFixed(1) : 'none'}`;
  let pending = memo.get(key);
  if (!pending) {
    pending = (async () => {
      const near = ctx ? { latitude: ctx.lat, longitude: ctx.lng } : undefined;
      geoCalls++;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const candidates = await geocodeAddress(query, { proximity: near });
          const plausible = filterPlausibleCandidates(candidates, near);
          if (plausible.length === 0) return null;
          const best = selectBestCandidate(plausible);
          return {
            city: best.city,
            province: best.province,
            formatted: best.formattedAddress,
            lat: best.coordinates.latitude,
            lng: best.coordinates.longitude,
            confidence: best.confidence,
            matchType: best.matchType,
          };
        } catch (error) {
          if (error instanceof GeolocationNotFoundError) return null;
          if (attempt === 3) throw error;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      return null;
    })();
    memo.set(key, pending);
  }
  return pending;
}

const contextOf = (item: Item): Region | null => item.primaryDefault ?? item.coauthorDefaults[0] ?? null;
const hasWord = (text: string, word: string | null | undefined) => !!word && text.toLowerCase().includes(word.toLowerCase());

async function ladder(queries: string[], ctx: Region | null): Promise<{ result: Resolved | null; step: number }> {
  for (let i = 0; i < queries.length; i++) {
    const result = await resolve(queries[i], ctx);
    if (result) return { result, step: i + 1 };
  }
  return { result: null, step: 0 };
}

async function geminiKeywords(items: Item[]): Promise<{ map: Map<string, string[]>; tokens: number }> {
  const apiKey = process.env.SYSTEM_GEMINI_API_KEY;
  if (!apiKey) throw new Error('SYSTEM_GEMINI_API_KEY is not set');
  const lines = items.map((item) => {
    const ctx = contextOf(item);
    return JSON.stringify({
      id: item.id,
      location: item.text,
      event: item.eventName,
      hashtags: item.hashtags,
      authorRegion: ctx ? [ctx.city, ctx.province].filter(Boolean).join(', ') : null,
    });
  });
  const systemInstruction =
    'For each item, give locationKeywords: 1 to 5 short place names that let someone find the location on a map, ordered from the MOST specific to the most general: ' +
    'first the place as named (venue, building, market, village), then its district, then its city or regency, then optionally the province. ' +
    'Use the location text first; when it does not state the wider area, take it from the event name, hashtags or authorRegion, but never invent a place those do not support. ' +
    'Each keyword is ONE place name, never a sentence, never a summary of several places. Return every id.';
  const responseSchema = {
    type: 'ARRAY',
    items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, locationKeywords: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['id', 'locationKeywords'] },
  };
  let result;
  for (let attempt = 1; attempt <= 6 && !result; attempt++) {
    try {
      result = await callGeminiGenerateContent(apiKey, {
        contents: lines.join('\n'),
        systemInstruction,
        responseSchema,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      });
    } catch (error) {
      console.error(`gemini attempt ${attempt} failed: ${String(error).slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, 15000 * attempt));
    }
  }
  if (!result) throw new Error('Gemini kept failing');
  const parsed = JSON.parse(result.text as string) as Array<{ id: string; locationKeywords: string[] }>;
  return {
    map: new Map(parsed.map((p) => [p.id, (p.locationKeywords ?? []).filter((k) => typeof k === 'string' && k.trim()).slice(0, 5)])),
    tokens: (result.usage?.promptTokens ?? 0) + (result.usage?.outputTokens ?? 0),
  };
}

async function main() {
  const [itemsFile, outFile] = process.argv.slice(2);
  const items: Item[] = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));

  const { map: kwMap, tokens } = await geminiKeywords(items);
  console.log(`gemini: ${kwMap.size}/${items.length} items answered, ${tokens} tokens`);

  const rows: any[] = [];
  for (const item of items) {
    const ctx = contextOf(item);
    const s0 = await resolve(item.text, item.primaryDefault);
    const s1 = await resolve(item.text, ctx);

    // SC: code-derived keywords: [text, city, province]; the region is appended only when the text does not already name it.
    const scQueries: string[] = [];
    if (ctx) {
      const missing = [ctx.city, ctx.province].filter((w) => w && !hasWord(item.text, w)) as string[];
      scQueries.push(missing.length && !hasWord(item.text, ctx.city) ? `${item.text}, ${missing.join(', ')}` : item.text);
      const regionOnly = [ctx.city, ctx.province].filter(Boolean).join(', ');
      if (regionOnly) scQueries.push(regionOnly);
    } else {
      scQueries.push(item.text);
    }
    const sc = await ladder(scQueries, ctx);

    const kw = kwMap.get(item.id) ?? [];
    const sbQueries = kw.length ? [kw.join(', ')] : [item.text];
    if (kw.length >= 2) sbQueries.push(kw.slice(1).join(', '));
    const sb = await ladder(sbQueries, ctx);

    rows.push({ item: { id: item.id, stratum: item.stratum, text: item.text, regionWordInText: item.regionWordInText, ctx: ctx ? [ctx.city, ctx.province].join(', ') : null, ctxSource: item.primaryDefault ? 'primary' : ctx ? 'coauthor' : 'none' }, kw, scQueries, sbQueries, s0, s1, sc, sb });
  }
  fs.writeFileSync(outFile, JSON.stringify({ rows, geoCalls, geminiTokens: tokens }, null, 1));
  console.log(`done: ${rows.length} rows, ${geoCalls} distinct Geoapify calls`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
void computeDistanceKm;
