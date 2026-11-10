// One-off POC pass 2, local only (never committed). Strategies, all through the real Geoapify client (no cache, no DB):
//   A0  production today: text + bias/filter from the PRIMARY account's default location (when it has one)
//   T0  text only, no bias at all
//   T1  text + soft country bias "id"
//   TB  Gemini keywords (from pass 1) ladder + soft country bias "id"
//   TC  code-cleaned text ladder (no AI): step 1 cleaned text, step 2 its last two comma segments; soft country bias "id"
//   TG  TB + the account default location as bias/filter, but ONLY when that default is in Indonesia (a sanity gate)
// Usage: npx tsx scripts/poc-location-keywords-oneoff2.ts <pass1-out.json> <out.json> <items.json>
import * as fs from 'fs';
import { filterPlausibleCandidates, selectBestCandidate } from '@festgrid/domain/geolocation';
import { GeolocationNotFoundError, geocodeAddress } from '../src/lib/geolocation/geoapify-client.js';

type Region = { city: string | null; province: string | null; countryCode: string | null; lat: number; lng: number };
type Hit = { city?: string; province?: string; country?: string; lat: number; lng: number; matchType?: string } | null;

const memo = new Map<string, Promise<Hit>>();
let calls = 0;

async function resolve(query: string, countryBias: string | undefined, near: Region | null): Promise<Hit> {
  const key = `${query}|${countryBias ?? ''}|${near ? near.lat.toFixed(1) + ',' + near.lng.toFixed(1) : ''}`;
  let p = memo.get(key);
  if (!p) {
    p = (async () => {
      calls++;
      const proximity = near ? { latitude: near.lat, longitude: near.lng } : undefined;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const candidates = await geocodeAddress(query, { countryBias, proximity });
          const plausible = filterPlausibleCandidates(candidates, proximity);
          if (plausible.length === 0) return null;
          const best = selectBestCandidate(plausible);
          return { city: best.city, province: best.province, country: best.countryCode, lat: best.coordinates.latitude, lng: best.coordinates.longitude, matchType: best.matchType };
        } catch (error) {
          if (error instanceof GeolocationNotFoundError) return null;
          if (attempt === 3) throw error;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      return null;
    })();
    memo.set(key, p);
  }
  return p;
}

async function ladder(queries: string[], countryBias: string | undefined, near: Region | null): Promise<{ hit: Hit; step: number }> {
  for (let i = 0; i < queries.length; i++) {
    const hit = await resolve(queries[i], countryBias, near);
    if (hit) return { hit, step: i + 1 };
  }
  return { hit: null, step: 0 };
}

/** Code-only cleaning: drop parentheticals, floor/level/unit noise and street numbers; keep the comma segments. */
function cleanSegments(text: string): string[] {
  const noParens = text.replace(/\([^)]*\)/g, ' ');
  const segments = noParens
    .split(/[,;|]/)
    .map((s) =>
      s
        .replace(/\b(lantai|lt\.?|floor|ground floor|lt\s*\d+|level|ug|lg|blok [a-z0-9]+|rt\.?\s*\d+|rw\.?\s*\d+|no\.?\s*\d+[a-z]?)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.length > 1 && !/^\d+[\s\d-]*$/.test(s) && !/^(indonesia|id)$/i.test(s));
  return segments.slice(0, 5);
}

async function main() {
  const [pass1, outFile] = process.argv.slice(2);
  const { rows } = JSON.parse(fs.readFileSync(pass1, 'utf8')) as { rows: any[] };
  const items = JSON.parse(fs.readFileSync(process.argv[4], 'utf8')) as any[];
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: any[] = [];
  for (const w of rows) {
    const item = byId.get(w.item.id);
    const primary: Region | null = item.primaryDefault;
    const text: string = item.text;
    const kw: string[] = w.kw ?? [];
    const a0 = await resolve(text, primary?.countryCode ?? undefined, primary);
    const t0 = await resolve(text, undefined, null);
    const t1 = await resolve(text, 'id', null);
    const tbQueries = kw.length ? [kw.join(', ')].concat(kw.length >= 2 ? [kw.slice(1).join(', ')] : []) : [text];
    const tb = await ladder(tbQueries, 'id', null);
    const seg = cleanSegments(text);
    const tcQueries = seg.length ? [seg.join(', ')].concat(seg.length >= 3 ? [seg.slice(-2).join(', ')] : []) : [text];
    const tc = await ladder(tcQueries, 'id', null);
    const trusted = primary && primary.countryCode?.toLowerCase() === 'id' ? primary : null;
    const tg = await ladder(tbQueries, 'id', trusted);
    result.push({ idx: result.length, text, stratum: item.stratum, kw, tbQueries, tcQueries, a0, t0, t1, tb, tc, tg });
  }
  fs.writeFileSync(outFile, JSON.stringify({ calls, result }, null, 1));
  console.log(`done ${result.length} rows, ${calls} distinct Geoapify calls`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
