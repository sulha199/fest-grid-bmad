/**
 * Maintainer probe (needs a Geoapify key; NOT run in the session that wrote it). Question from the production check of 2026-10-19: the stored
 * location texts that ended up in the wrong country are COMPOUND ("Atrium & Plaza Rama, Sleman City Hall", "Watsons, Ground Floor Galeria Mall").
 * Does removing the sub-venue qualifier, keeping the venue segment, and adding the stated city before geocoding fix them? Country is the only ground
 * truth used (every labelled text is a venue in Indonesia); "usable" = right country AND stored-style confidence >= 0.5, the placeholder floor.
 *
 *   GEOAPIFY_API_KEY=... npx tsx scripts/poc-event-insight/probe-geocode-compound.ts [--dry] [--md <out.md>]
 *
 * `--dry` prints the number of requests and the URLs (key redacted) without calling anything. Venue and place names only; no user data.
 */
import { writeFileSync } from 'node:fs';
import { buildUrl, pickByConfidence, type Strategy } from './probe-geocode-country.js';

export interface CompoundCase { text: string; city?: string; expectCountry: 'id' | null }

/** The stored `schedules.location` texts that produced pins outside the country box (results/confidence-by-country-box-prod-2026-10-19.txt), plus controls. */
export const CASES: CompoundCase[] = [
  { text: 'Atrium & Plaza Rama, Sleman City Hall', city: 'Sleman', expectCountry: 'id' },
  { text: 'Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang', city: 'Sleman', expectCountry: 'id' },
  { text: 'Customer Service, Ground Floor, Sleman City Hall', city: 'Sleman', expectCountry: 'id' },
  { text: 'Sleman City Hall', city: 'Sleman', expectCountry: 'id' },
  { text: 'Atrium Lower Ground, Galeria Mall', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Atrium Lower Ground Galeria Mall', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Watsons, Ground Floor Galeria Mall', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'J.CO, Ground Floor, Galeria Mall', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Grand Atrium Pakuwon Mall Jogja', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'TKP JOGJA Lantai 2, Pakuwon Mall Jogja', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Sky Commons, Lantai 3A, Plaza Ambarrukmo', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Sushi Go – Plaza Ambarrukmo, Lantai 3', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Plaza Ambarrukmo Mall Jogja', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Spiral Deck Zona D, GIK UGM', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Institute France Indonesie, Lembaga Indonesia Prancis', city: 'Yogyakarta', expectCountry: 'id' },
  { text: 'Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta', city: 'Jakarta', expectCountry: 'id' },
  { text: 'Tennis Indoor Senayan, Jakarta', city: 'Jakarta', expectCountry: 'id' },
  { text: 'Kudus City Walk Mall', city: 'Kudus', expectCountry: 'id' },
  { text: 'LA Plaza Lamongan', city: 'Lamongan', expectCountry: 'id' },
  { text: 'Icon Mall Gresik', city: 'Gresik', expectCountry: 'id' },
  { text: 'JEC', city: 'Yogyakarta', expectCountry: 'id' },
  // no ground truth: reported, not scored
  { text: 'Convention Hall Lt.2', expectCountry: null },
  { text: 'Court 2', expectCountry: null },
  { text: 'Online', expectCountry: null },
];

const FLOOR_PATTERNS: RegExp[] = [
  /\b(?:lower ground|upper ground|ground floor|basement|mezzanine)\b/gi,
  /\blantai\s*\d+[a-z]?\b/gi,
  /\blt\.?\s*\d+[a-z]?\b/gi,
  /\b(?:level|floor)\s*\d+[a-z]?\b/gi,
  /\b\d+(?:st|nd|rd|th)\s*floor\b/gi,
  /\b(?:zona|zone)\s+[a-z]\b/gi,
  /\b(?:atrium|lobby|customer service)\b/gi,
];
const VENUE_WORDS = /\b(?:mall|plaza|city hall|hall|hotel|museum|expo|ugm|center|centre|walk|square|stadium|gor|stasiun|bandara|universitas|institute|lembaga|space|park|taman|gedung|senayan|jec|arena|lapangan)\b/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/(?:\s*,\s*){2,}/g, ', ').replace(/^[\s,&–-]+|[\s,&–-]+$/g, '').trim();

/** Floors, levels, rooms and counters removed; what is left still reads as a place. */
export function removeQualifiers(text: string): string {
  let t = text;
  for (const p of FLOOR_PATTERNS) t = t.replace(p, ' ');
  return clean(t.replace(/\s+,/g, ','));
}

/** Segments are separated by commas or by a dash with spaces around it. */
export function segments(text: string): string[] {
  return text.split(/\s*,\s*|\s+[–—-]\s+/).map((s) => clean(s)).filter(Boolean);
}

/** The last segment that looks like a venue (mall, plaza, hall, ...); else the last segment; else the whole text. */
export function venueSegment(text: string): string {
  const segs = segments(removeQualifiers(text));
  if (segs.length === 0) return clean(text);
  for (let i = segs.length - 1; i >= 0; i--) if (VENUE_WORDS.test(segs[i])) return segs[i];
  return segs[segs.length - 1];
}

export function withCity(text: string, city?: string): string {
  if (!city || text.toLowerCase().includes(city.toLowerCase())) return text;
  return `${text}, ${city}`;
}

export type VariantName = 'as stored' | 'qualifiers removed' | 'venue segment' | 'venue segment + city';
export function variantsOf(c: CompoundCase): Array<{ name: VariantName; query: string }> {
  return [
    { name: 'as stored', query: c.text },
    { name: 'qualifiers removed', query: removeQualifiers(c.text) },
    { name: 'venue segment', query: venueSegment(c.text) },
    { name: 'venue segment + city', query: withCity(venueSegment(c.text), c.city) },
  ];
}

export const STRATEGIES: Strategy[] = ['no-bias', 'bias'];

/** Unique (query, strategy) requests: variants that coincide are asked once. */
export function requestPlan(cases: CompoundCase[] = CASES): Array<{ query: string; strategy: Strategy }> {
  const seen = new Set<string>(); const out: Array<{ query: string; strategy: Strategy }> = [];
  for (const c of cases) for (const v of variantsOf(c)) for (const s of STRATEGIES) {
    const key = `${s}|${v.query}`;
    if (!seen.has(key)) { seen.add(key); out.push({ query: v.query, strategy: s }); }
  }
  return out;
}

interface Hit { country_code?: string; formatted?: string; rank?: { confidence?: number; match_type?: string } }
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const dry = process.argv.includes('--dry');
  const key = process.env.GEOAPIFY_API_KEY;
  const plan = requestPlan();
  if (dry) { console.log(`${plan.length} requests`); for (const r of plan) console.log(buildUrl(r.query, r.strategy, 'id')); return; }
  if (!key) throw new Error('GEOAPIFY_API_KEY is not set (use --dry to print the requests only)');
  const answers = new Map<string, Hit | null | 'error'>();
  for (const r of plan) {
    const res = await fetch(buildUrl(r.query, r.strategy, 'id', key));
    if (!res.ok) { answers.set(`${r.strategy}|${r.query}`, 'error'); continue; }
    const hits = ((await res.json()) as { results?: Hit[] }).results ?? [];
    answers.set(`${r.strategy}|${r.query}`, pickByConfidence(hits) ?? null);
  }
  const rows = ['| stored text | variant | query sent | strategy | picked | country | confidence |', '|---|---|---|---|---|:-:|--:|'];
  const tally = new Map<string, { n: number; right: number; usable: number }>();
  for (const c of CASES) for (const v of variantsOf(c)) for (const s of STRATEGIES) {
    const a = answers.get(`${s}|${v.query}`);
    const best = a && a !== 'error' ? a : undefined;
    rows.push(`| ${c.text} | ${v.name} | ${v.query} | ${s} | ${a === 'error' ? 'HTTP error' : best?.formatted ?? '(no result)'} | ${best?.country_code ?? ''} | ${best?.rank?.confidence?.toFixed(2) ?? ''} |`);
    if (c.expectCountry) {
      const t = tally.get(`${v.name} / ${s}`) ?? { n: 0, right: 0, usable: 0 };
      t.n++; if (best?.country_code === c.expectCountry) { t.right++; if ((best.rank?.confidence ?? 0) >= 0.5) t.usable++; }
      tally.set(`${v.name} / ${s}`, t);
    }
  }
  const summary = ['| variant / strategy | texts | right country | right country and confidence >= 0.5 |', '|---|--:|--:|--:|', ...[...tally].map(([k, t]) => `| ${k} | ${t.n} | ${t.right} | ${t.usable} |`)];
  const text = ['## Summary (labelled texts only: country is the ground truth)', '', ...summary, '', '## Every request', '', ...rows].join('\n');
  console.log(text);
  if (arg('md')) writeFileSync(arg('md') as string, `# Geocode compound-text probe (generated)\n\n${text}\n`);
}
if (process.argv[1]?.endsWith('probe-geocode-compound.ts')) main().catch((e) => { console.error(e); process.exitCode = 1; });
