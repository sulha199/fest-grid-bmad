// One-off POC pass 3, local only (never committed): what does a COUNTRY PRIOR do, with and without keywords?
// Geoapify's soft `bias=countrycode:id` changed nothing in pass 2, so here the prior is the HARD `filter=countrycode:id`, tried first,
// with an unfiltered fallback only when nothing Indonesian matched (so a venue in Raleigh, NC or Kumamoto can still resolve).
//   H0  text: filter id first, then unfiltered
//   HC  code-cleaned segments ladder (no AI): filter id first, then unfiltered
//   HB  Gemini keywords ladder: filter id first, then unfiltered
// Usage: npx tsx scripts/poc-location-keywords-oneoff3.ts <pass2-out.json> <out.json>
import * as fs from 'fs';

type Hit = { city?: string; province?: string; country?: string; lat: number; lng: number; confidence?: number; matchType?: string } | null;
const KEY = process.env.GEOAPIFY_API_KEY as string;
const memo = new Map<string, Promise<Hit>>();
let calls = 0;

async function geo(query: string, filterCountry?: string): Promise<Hit> {
  const key = `${query}|${filterCountry ?? ''}`;
  let p = memo.get(key);
  if (!p) {
    p = (async () => {
      calls++;
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&format=json&limit=5&apiKey=${KEY}` + (filterCountry ? `&filter=countrycode:${filterCountry}` : '');
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(url);
        if (res.ok) {
          const json = (await res.json()) as { results?: any[] };
          const results = json.results ?? [];
          if (results.length === 0) return null;
          // same re-ranking idea as selectBestCandidate: highest confidence first, Geoapify order breaks ties
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

/** Indonesia first (hard filter) through the whole ladder, then the same ladder unfiltered. */
async function priorLadder(queries: string[]): Promise<{ hit: Hit; step: string }> {
  for (let i = 0; i < queries.length; i++) {
    const hit = await geo(queries[i], 'id');
    if (hit) return { hit, step: `id-${i + 1}` };
  }
  for (let i = 0; i < queries.length; i++) {
    const hit = await geo(queries[i]);
    if (hit) return { hit, step: `any-${i + 1}` };
  }
  return { hit: null, step: 'none' };
}

async function main() {
  const [pass2, outFile] = process.argv.slice(2);
  const { result } = JSON.parse(fs.readFileSync(pass2, 'utf8')) as { result: any[] };
  const out: any[] = [];
  for (const r of result) {
    const h0 = await priorLadder([r.text]);
    const hc = await priorLadder(r.tcQueries);
    const hb = await priorLadder(r.tbQueries);
    out.push({ idx: r.idx, text: r.text, stratum: r.stratum, kw: r.kw, h0, hc, hb });
  }
  fs.writeFileSync(outFile, JSON.stringify({ calls, result: out }, null, 1));
  console.log(`done ${out.length} rows, ${calls} distinct Geoapify calls`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
