// One-off, local only (never committed): replays the 60 POC location rows through the SHIPPED keywords generator (real Gemini,
// no authorRegion hint) and the slice 2 ladder design under a country hint (string code -> hard filter; platform default ID ->
// filter first, then one unfiltered pass; keywords missing -> code-cleaned fallback queries), then writes a poc_out3-shaped file so
// poc_score3.py can score it. No database writes. Usage:
//   npx tsx scripts/replay-keywords-oneoff2.ts <poc_items.json> <poc_out2.json> <poc_out3.json> <out.json>
import * as fs from 'fs';
import { generateLocationKeywords } from '../src/lib/ai-processor/generate-location-keywords.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';

type Hit = { city?: string; province?: string; country?: string; lat: number; lng: number; confidence?: number; matchType?: string } | null;
const GEO_KEY = process.env.GEOAPIFY_API_KEY as string;
const GEMINI_KEY = process.env.SYSTEM_GEMINI_API_KEY as string;
if (!GEO_KEY || !GEMINI_KEY) throw new Error('GEOAPIFY_API_KEY and SYSTEM_GEMINI_API_KEY are required');
const memo = new Map<string, Promise<Hit>>();
let geoCalls = 0;
const finishReasons: Record<string, number> = {};
let geminiCalls = 0;
let totalMs = 0;
const callLatencies: number[] = [];

async function geo(query: string, filterCountry?: string): Promise<Hit> {
  const key = `${query}|${filterCountry ?? ''}`;
  let p = memo.get(key);
  if (!p) {
    p = (async () => {
      geoCalls++;
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&format=json&limit=5&apiKey=${GEO_KEY}` + (filterCountry ? `&filter=countrycode:${filterCountry.toLowerCase()}` : '');
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(url);
        if (res.ok) {
          const results = ((await res.json()) as { results?: any[] }).results ?? [];
          if (results.length === 0) return null;
          const best = results.map((r, i) => ({ r, i })).sort((a, b) => (b.r.rank?.confidence ?? 0) - (a.r.rank?.confidence ?? 0) || a.i - b.i)[0].r;
          return { city: best.city, province: best.state, country: best.country_code, lat: best.lat, lng: best.lon, confidence: best.rank?.confidence, matchType: best.rank?.match_type };
        }
        if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 2000 * attempt));
        else return null;
      }
      return null;
    })();
    memo.set(key, p);
  }
  return p;
}

/** Keywords ladder: step 1 = all joined, step 2 = without the most specific (only with 2+). */
function keywordQueries(keywords: string[]): string[] {
  const queries = [keywords.join(', ')];
  if (keywords.length >= 2) queries.push(keywords.slice(1).join(', '));
  return queries;
}

async function runLadder(queries: string[], hint: { code?: string; source: 'string' | 'platform' | 'none' }): Promise<{ hit: Hit; step: string }> {
  const filtered = hint.code ? hint.code : undefined;
  for (let i = 0; i < queries.length; i++) {
    const hit = await geo(queries[i], filtered);
    if (hit) return { hit, step: `${filtered ?? 'any'}-${i + 1}` };
  }
  // A string/consensus code is trusted: no unfiltered pass. The platform default is a guess: one unfiltered pass.
  if (hint.source === 'platform' || hint.source === 'none') {
    if (filtered) {
      for (let i = 0; i < queries.length; i++) {
        const hit = await geo(queries[i]);
        if (hit) return { hit, step: `any-${i + 1}` };
      }
    }
  }
  return { hit: null, step: 'none' };
}

async function main() {
  const [itemsFile, out2File, out3File, outFile] = process.argv.slice(2);
  const items = JSON.parse(fs.readFileSync(itemsFile, 'utf8')) as any[];
  const out2 = (JSON.parse(fs.readFileSync(out2File, 'utf8')) as { result: any[] }).result;
  const out3 = (JSON.parse(fs.readFileSync(out3File, 'utf8')) as { result: any[] }).result;
  const platformDefault = 'id';

  const callGemini = async (req: any) => {
    geminiCalls++;
    const started = Date.now();
    const { provider: _provider, subscriberUserIds: _subs, ...request } = req;
    // Local replay only: pace the calls and ride out quota (429) and busy (503) answers, so the replay measures prompt quality
    // and not the key's rate limit. The shipped generator itself is one attempt and never waits.
    let result: Awaited<ReturnType<typeof callGeminiGenerateContent>> | undefined;
    let callStarted = Date.now();
    for (let attempt = 1; attempt <= 6 && !result; attempt++) {
      callStarted = Date.now();
      try {
        result = await callGeminiGenerateContent(GEMINI_KEY, request);
      } catch (error) {
        const text = String(error);
        if (!/429|503|RateLimited/.test(text) || attempt === 6) throw error;
        await new Promise((r) => setTimeout(r, 20000 * attempt));
      }
    }
    if (!result) throw new Error('no result');
    callLatencies.push(Date.now() - callStarted);
    await new Promise((r) => setTimeout(r, 5000));
    totalMs += Date.now() - started;
    finishReasons[String(result.finishReason)] = (finishReasons[String(result.finishReason)] ?? 0) + 1;
    return result;
  };

  const rows: any[] = [];
  const queue = out2.map((r) => r.idx as number);
  async function worker() {
    for (let idx = queue.shift(); idx !== undefined; idx = queue.shift()) {
      const item = items[idx];
      const schedule = { isMainSchedule: true, eventStartDate: '2027-01-01', ...(item.level === 'schedule' ? { location: item.text } : {}) };
      const event: any = { eventName: item.eventName, schedules: [schedule], ...(item.level === 'event' ? { location: item.text } : {}) };
      const caption = Array.isArray(item.hashtags) ? item.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '';
      await generateLocationKeywords([event], { callGemini, subscriberUserIds: [], sourceText: caption, defaultCountryCode: 'ID', postId: `poc-${idx}`, timeoutMs: 180000 });
      const holder = item.level === 'event' ? event : schedule;
      const keywords: string[] | undefined = holder.locationKeywords;
      const code: string | undefined = holder.locationCountryCode;
      const hint = code ? { code, source: 'string' as const } : { code: platformDefault, source: 'platform' as const };
      const prior = out2.find((r) => r.idx === idx);
      const queries = keywords && keywords.length > 0 ? keywordQueries(keywords) : (prior.tcQueries as string[]);
      const result = await runLadder(queries, hint);
      rows.push({ idx, text: item.text, stratum: item.stratum, kw: keywords ?? null, code: code ?? null, hintSource: hint.source, h0: out3.find((r) => r.idx === idx).h0, hc: out3.find((r) => r.idx === idx).hc, hb: result });
    }
  }
  await worker();
  rows.sort((a, b) => a.idx - b.idx);
  fs.writeFileSync(outFile, JSON.stringify({ geminiCalls, geoCalls, finishReasons, callLatenciesMs: callLatencies, result: rows }, null, 1));
  console.log(`done ${rows.length} rows, gemini calls ${geminiCalls} (successful-attempt latency max ${Math.max(0, ...callLatencies)} ms, over 10 s: ${callLatencies.filter((x) => x > 10000).length}), geoapify calls ${geoCalls}, finishReasons ${JSON.stringify(finishReasons)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
