/**
 * Maintainer probe (NOT run in the session that wrote it: it needs a Geoapify key, which that session
 * did not have). Question: for the place descriptions the production default-location inference
 * actually produced for a curator account, which country does Geoapify answer with under
 *   (a) no bias            - what the first-time default-location bootstrap sends today
 *   (b) bias=countrycode   - what every later event geocode sends today (a preference, not a filter)
 *   (c) filter=countrycode - a hard restriction
 * and what `selectBestCandidate` (confidence only) picks versus a country-aware pick.
 *
 *   GEOAPIFY_API_KEY=... npx tsx scripts/poc-event-insight/probe-geocode-country.ts [--country id] [--md <out.md>] [--dry]
 *
 * `--dry` prints the request URLs (key redacted) without calling anything.
 */
import { writeFileSync } from 'node:fs';

// The `placeDescription` values the production prompt returned for @infoeventjogja's 12 posts
// (results/probe-default-location.generated.txt) plus the venue accounts' values, as controls.
export const DESCRIPTIONS = [
  'Plaza Ambarrukmo', 'Royal Ambarrukmo, Yogyakarta', 'Sport Academy Yogyakarta and Lapangan Funminton, Yogyakarta', 'omah noto plankton',
  'Jogja', 'DIY & Jawa Tengah', 'Montero Jogja, Jln. Purworejo, Tanen, Pakem, Sleman Yogyakarta',
  'Auditorium SGLC, Faculty of Engineering, Universitas Gadjah Mada', 'Yogyakarta', 'Museum Gunungapi Merapi, Yogyakarta', 'Hotel Kotta Go Yogyakarta',
  'DIY (Daerah Istimewa Yogyakarta) and Sleman, Indonesia',
  'Plaza Ambarrukmo, Yogyakarta', 'Sleman City Hall',
];

export type Strategy = 'no-bias' | 'bias' | 'filter';

export function buildUrl(text: string, strategy: Strategy, country: string, apiKey = '<key>'): string {
  let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&format=json&limit=5&apiKey=${apiKey}`;
  if (strategy === 'bias') url += `&bias=countrycode:${country}`;
  if (strategy === 'filter') url += `&filter=countrycode:${country}`;
  return url;
}

interface Hit { country_code?: string; formatted?: string; rank?: { confidence?: number; match_type?: string } }

// Today's rule (selectBestCandidate): highest confidence, wherever it is.
export function pickByConfidence(hits: Hit[]): Hit | undefined {
  let best: Hit | undefined;
  for (const h of hits) if (!best || (h.rank?.confidence ?? -Infinity) > (best.rank?.confidence ?? -Infinity)) best = h;
  return best;
}

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const country = (arg('country') ?? 'id').toLowerCase();
  const dry = process.argv.includes('--dry');
  const key = process.env.GEOAPIFY_API_KEY;
  if (!dry && !key) throw new Error('GEOAPIFY_API_KEY is not set (use --dry to print the requests only)');
  const strategies: Strategy[] = ['no-bias', 'bias', 'filter'];
  const out: string[] = ['| description | strategy | picked (today: confidence only) | country | confidence | match | other countries in the top 5 |', '|---|---|---|:-:|--:|---|---|'];
  let wrong = 0, total = 0;
  for (const d of DESCRIPTIONS) {
    for (const s of strategies) {
      if (dry) { console.log(buildUrl(d, s, country)); continue; }
      const res = await fetch(buildUrl(d, s, country, key));
      if (!res.ok) { out.push(`| ${d} | ${s} | HTTP ${res.status} | | | | |`); continue; }
      const hits = ((await res.json()) as { results?: Hit[] }).results ?? [];
      const best = pickByConfidence(hits);
      total++;
      if (best && best.country_code !== country) wrong++;
      const others = [...new Set(hits.map((h) => h.country_code).filter((c) => c && c !== best?.country_code))].join(',');
      out.push(`| ${d} | ${s} | ${best?.formatted ?? '(no result)'} | ${best?.country_code ?? ''} | ${best?.rank?.confidence?.toFixed(2) ?? ''} | ${best?.rank?.match_type ?? ''} | ${others || '—'} |`);
    }
  }
  if (dry) return;
  out.push('', `Picks outside "${country}": ${wrong}/${total}`);
  console.log(out.join('\n'));
  const md = arg('md');
  if (md) writeFileSync(md, `# Geocode country probe (generated)\n\n${out.join('\n')}\n`);
}
if (process.argv[1]?.endsWith('probe-geocode-country.ts')) main().catch((e) => { console.error(e); process.exitCode = 1; });
