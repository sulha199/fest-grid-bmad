/**
 * Demo: ordering by the TARGET AUDIENCE's area, on the audience areas Gemini actually extracted
 * (a results file from run-audience-areas.ts), with the account-type policy applied.
 *
 *   npx tsx scripts/poc-event-insight/area-demo.ts --results <audience-areas-*.json> [--md <out.md>]
 *
 * For each event it also computes the tier the OLD rule (area = audience ∪ venue, fallback to the account
 * for every account type) would have given, so the change the discussion asked for is visible event by
 * event. `daysUntilNext` is illustrative. Rows marked (hand-made) are not Gemini output on those posts: they
 * exist to show the account-type and account-reach policy on area-less and online posts (the reach comes from
 * the profile-insight experiment).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCases } from './corpus.js';
import { effectiveAudienceAreas, type AccountReach, type AccountType, type AccountTypeStatus } from './location-policy.js';
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
// Hand-made rows (NOT Gemini output on these posts). The account reach is the one Gemini returned for the
// matching synthetic profile (results/profile-insight-v1.json, run 1); falls back to the label when absent.
function reachOf(profileId: string, fallback: AccountReach): AccountReach {
  try {
    const f = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results/profile-insight-v1.json');
    const rec = (JSON.parse(readFileSync(f, 'utf8')) as { records: Array<{ id: string; run: number; guarded?: { reach: string } }> }).records.find((r) => r.id === profileId && r.run === 1);
    const r = rec?.guarded?.reach;
    return r === 'local' || r === 'regional' || r === 'national' || r === 'international' ? r : fallback;
  } catch { return fallback; }
}
const HAND: Array<{ id: string; geoScope: AudienceAreas['geoScope']; type: AccountType; status: AccountTypeStatus; areas: string[]; reach: AccountReach; note: string }> = [
  { id: 'x-organizer-arealess (hand-made)', geoScope: 'unspecified', type: 'ORGANIZER_VENUE_EVENT', status: 'CONFIRMED', areas: ['sleman'], reach: 'local', note: 'area-less post, local organizer in Sleman' },
  { id: 'x-curator-arealess (hand-made)', geoScope: 'unspecified', type: 'CURATOR_GUIDE', status: 'CONFIRMED', areas: ['sleman'], reach: 'local', note: 'the same post from a curator with a stored Sleman location' },
  { id: 'x-unclassified-arealess (hand-made)', geoScope: 'unspecified', type: null, status: null, areas: ['sleman'], reach: 'unknown', note: 'the same post from a never-classified account that already has a location (decision 2026-10-18: unchanged, it still lends it)' },
  { id: 'x-localgov-zoom (hand-made)', geoScope: 'online', type: 'ORGANIZER_VENUE_EVENT', status: 'CONFIRMED', areas: ['sleman'], reach: reachOf('syn-dinas-sleman', 'local'), note: 'Zoom briefing from a Sleman agency, no stated audience' },
  { id: 'x-national-co-zoom (hand-made)', geoScope: 'online', type: 'ORGANIZER_VENUE_EVENT', status: 'CONFIRMED', areas: ['jakarta'], reach: reachOf('syn-telco-nasional', 'national'), note: 'Zoom webinar from a national company with a Jakarta head office, no stated audience' },
  { id: 'x-localgov-zoom-for-sleman (hand-made)', geoScope: 'city', type: 'ORGANIZER_VENUE_EVENT', status: 'CONFIRMED', areas: ['sleman'], reach: 'local', note: 'Zoom briefing that STATES "untuk warga Sleman"' },
];
for (const h of HAND) {
  const stated = h.id.includes('for-sleman') ? ['sleman'] : [];
  const audience = effectiveAudienceAreas({ geoScope: h.geoScope, statedAreaKeys: stated, venueAreaKeys: [], accountAreaKeys: h.areas, accountType: h.type, accountTypeStatus: h.status, accountReach: h.reach });
  rows.push({ id: h.id, daysUntilNext: 3 + (n++ * 2) % 41, audience, geoScope: h.geoScope, note: `hand-made; ${h.note}; reach ${h.reach}`, oldKeys: h.areas, source: audience.source });
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
