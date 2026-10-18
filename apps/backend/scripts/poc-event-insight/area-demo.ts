/**
 * Demo: ordering by the TARGET AUDIENCE's area, on the audience areas Gemini actually extracted
 * (a results file from run-audience-areas.ts), with the account-type policy applied.
 *
 *   npx tsx scripts/poc-event-insight/area-demo.ts --results <audience-areas-*.json> [--md <out.md>]
 *
 * For each event it also computes the tier the OLD rule (area = audience ∪ venue, fallback to the account
 * for every account type) would have given, so the change the discussion asked for is visible event by
 * event. `daysUntilNext` is illustrative. Rows marked (hand-made) are not Gemini output: they exist to
 * show the account-type policy on an area-less post.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCases } from './corpus.js';
import { effectiveAudienceAreas, type AccountType, type AccountTypeStatus } from './location-policy.js';
import { canonicalAreaKey, rankAreaThenDate, type RankableWithAudience, type UserProfile } from './relevance.js';
import type { AudienceAreas } from './audience-areas.js';

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
const file = arg('results');
if (!file) throw new Error('--results <audience-areas-*.json> is required');
const data = JSON.parse(readFileSync(file, 'utf8')) as { prompt?: string; records: Array<{ id: string; run: number; out?: AudienceAreas }> };
const accountOf = new Map(loadCases('all').map((c) => [c.id, c.account]));

// What the platform knows about each account. A curator HAS a stored default location here on purpose:
// the point is that it is ignored.
const ACCOUNTS: Record<string, { type: AccountType; status: AccountTypeStatus; areas: string[] }> = {
  infoeventjogja: { type: 'CURATOR_GUIDE', status: 'CONFIRMED', areas: ['yogyakarta'] },
  plazaambarrukmo: { type: 'ORGANIZER_VENUE_EVENT', status: 'CONFIRMED', areas: ['yogyakarta'] },
  slemancityhall: { type: 'ORGANIZER_VENUE_EVENT', status: 'CONFIRMED', areas: ['sleman'] },
};
const DEFAULT_ACCOUNT = { type: 'ORGANIZER_VENUE_EVENT' as AccountType, status: 'CONFIRMED' as AccountTypeStatus, areas: [] as string[] };

// Where the post says the event is HELD, where that differs from who it is for (read by hand from the captions).
// Only the OLD rule uses this: it is exactly the information the audience-based rule is built not to order by.
const HELD_AT: Record<string, string[]> = {
  'ar-nasional-ugm': ['yogyakarta'], 'cald-conference': ['yogyakarta'], 'ar-bus-surabaya': ['jakarta'], 'ar-guru-bantul': ['yogyakarta'],
};

const keysOf = (out: AudienceAreas, basis: 'stated' | 'venue') =>
  out.areas.filter((a) => a.basis === basis).map((a) => canonicalAreaKey(a.name)).filter((k): k is string => !!k);

interface Row extends RankableWithAudience { note: string; oldKeys: string[]; source: string }
const rows: Row[] = [];
let n = 0;
for (const rec of data.records.filter((r) => r.run === 1 && r.out)) {
  const out = rec.out as AudienceAreas;
  const acc = ACCOUNTS[accountOf.get(rec.id) ?? ''] ?? DEFAULT_ACCOUNT;
  const stated = keysOf(out, 'stated'), venue = keysOf(out, 'venue');
  const audience = effectiveAudienceAreas({ geoScope: out.geoScope, statedAreaKeys: stated, venueAreaKeys: venue, accountAreaKeys: acc.areas, accountType: acc.type, accountTypeStatus: acc.status });
  // OLD rule: every area we know of (stated + venue + where it is held), whatever the scope, with the account fallback for ALL account types.
  const held = HELD_AT[rec.id] ?? [];
  const oldKeys = [...new Set([...stated, ...venue, ...held, ...(stated.length + venue.length + held.length === 0 ? acc.areas : [])])];
  rows.push({ id: rec.id, daysUntilNext: 3 + (n++ * 2) % 41, audience, geoScope: out.geoScope, note: `${out.geoScope}; stated [${stated.join(',')}] venue [${venue.join(',')}]`, oldKeys, source: audience.source });
}
// Hand-made: the same area-less post from an organizer and from a curator, both with a stored location in Sleman.
for (const [id, acc] of [['x-organizer-arealess (hand-made)', { type: 'ORGANIZER_VENUE_EVENT' as AccountType }], ['x-curator-arealess (hand-made)', { type: 'CURATOR_GUIDE' as AccountType }]] as const) {
  const audience = effectiveAudienceAreas({ geoScope: 'unspecified', statedAreaKeys: [], venueAreaKeys: [], accountAreaKeys: ['sleman'], accountType: acc.type, accountTypeStatus: 'CONFIRMED' });
  rows.push({ id, daysUntilNext: 3 + (n++ * 2) % 41, audience, geoScope: 'unspecified', note: `hand-made; account location sleman, type ${acc.type}`, oldKeys: ['sleman'], source: audience.source });
}

const PERSONAS: Array<UserProfile & { blurb: string }> = [
  { id: 'rina', blurb: 'Sleman', locale: 'id', areas: ['sleman', 'yogyakarta'], interests: {} },
  { id: 'surya', blurb: 'Surabaya', locale: 'id', areas: ['surabaya'], interests: {} },
  { id: 'dewi', blurb: 'Jakarta', locale: 'id', areas: ['jakarta'], interests: {} },
  { id: 'tom', blurb: 'Canggu, Bali', locale: 'en', areas: ['canggu', 'bali'], interests: {} },
];

const out: string[] = [`Pool: ${rows.length} events (prompt ${data.prompt ?? 'v1'}, run 1; days illustrative).`, ''];
const tierName = (t: number) => (t === 0 ? '0 local' : t === 1 ? '1 anywhere' : t === 2 ? '2 other local' : '3 last');
for (const p of PERSONAS) {
  const ranked = rankAreaThenDate(rows, p);
  const oldRanked = rankAreaThenDate(rows.map((r) => ({ ...r, audience: { keys: r.oldKeys, source: 'stated' as const }, geoScope: undefined })), p);
  const oldTier = new Map(oldRanked.map((r) => [r.id, r.tier]));
  out.push(`### ${p.id} — ${p.blurb}`, '', '| # | event | in (days) | tier (audience) | audience source | tier if ordered by venue (old) | |', '|--:|---|--:|:-:|---|:-:|---|');
  ranked.forEach((r, i) => {
    const ot = oldTier.get(r.id) as number;
    out.push(`| ${i + 1} | ${r.id} | ${r.daysUntilNext}${r.sortDays !== r.daysUntilNext ? ` (→${r.sortDays})` : ''} | ${tierName(r.tier)} | ${r.source} | ${tierName(ot)} | ${ot !== r.tier ? '← changed' : ''} |`);
  });
  const changed = ranked.filter((r) => oldTier.get(r.id) !== r.tier).length;
  out.push('', `Events whose tier differs from the venue-based rule: ${changed}/${ranked.length}`, '');
}
const text = out.join('\n');
console.log(text);
const md = arg('md');
if (md) writeFileSync(md, `# Audience-area ordering demo (generated)\n\n${text}\n`);
