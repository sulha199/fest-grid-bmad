// One-off, local only (never committed): re-scores the code-cleaned FALLBACK ladder (no AI) with the fixed cleaner of slice 2a on the
// 60 POC rows, Geoapify only, ID filter first then everywhere (the platform-default plan). Usage:
//   npx tsx scripts/fb-remeasure-oneoff.ts <poc_out3.json> <out.json>
import * as fs from 'fs';
import { buildFallbackLocationQueries, planLocationLookups, resolveCountryHint } from '@festgrid/domain/geolocation';

const KEY = process.env.GEOAPIFY_API_KEY as string;
type Hit = { city?: string; province?: string; country?: string; lat: number; lng: number; confidence?: number; matchType?: string } | null;
const memo = new Map<string, Promise<Hit>>();
let calls = 0;

async function geo(query: string, filterCountry?: string): Promise<Hit> {
  const key = `${query}|${filterCountry ?? ''}`;
  let p = memo.get(key);
  if (!p) {
    p = (async () => {
      calls++;
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&format=json&limit=5&apiKey=${KEY}` + (filterCountry ? `&filter=countrycode:${filterCountry.toLowerCase()}` : '');
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

async function main() {
  const [out3, outFile] = process.argv.slice(2);
  const { result } = JSON.parse(fs.readFileSync(out3, 'utf8')) as { result: any[] };
  const hint = resolveCountryHint({ platformDefault: 'ID' });
  const rows: any[] = [];
  for (const r of result) {
    let steps = buildFallbackLocationQueries(r.text, hint.code);
    if (steps.length === 0) steps = [{ step: 'fb1', query: r.text }];
    let found: { hit: Hit; step: string } = { hit: null, step: 'none' };
    for (const attempt of planLocationLookups(steps, hint)) {
      const hit = await geo(attempt.query, attempt.countryFilter);
      if (hit) {
        found = { hit, step: `${attempt.countryFilter ?? 'any'}-${attempt.step}` };
        break;
      }
    }
    rows.push({ ...r, hc: found, hcQueries: steps.map((s) => s.query) });
  }
  fs.writeFileSync(outFile, JSON.stringify({ calls, result: rows }, null, 1));
  console.log(`done ${rows.length} rows, ${calls} Geoapify calls`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
