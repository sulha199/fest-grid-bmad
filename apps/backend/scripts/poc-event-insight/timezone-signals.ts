/**
 * POC (pure, no I/O): infer an account's DEFAULT TIME ZONE — the IANA zone its events usually happen in —
 * without a default location. It matters because the schedule-timezone resolver (resolve-schedule-timezones.ts)
 * falls back, for a schedule whose venue did not geocode, to "the source account's own timezone", which today
 * exists only as the timezone of the account's default location. Take the default location away from curators
 * (BUG-065) and that tier disappears: their location-less events drop to "exactly one subscriber" or to
 * NEEDS_CLARIFICATION, a moderator-only queue.
 *
 * THE COUNTRY DOES NOT DETERMINE THE ZONE. Indonesia has three (WIB Asia/Jakarta +7, WITA Asia/Makassar +8,
 * WIT Asia/Jayapura +9), Australia several; a wrong zone silently shifts every displayed time by 1-2 hours. So:
 *
 *   evidence   a time-zone abbreviation in the text (WIB, WITA, WIT, MYT, SGT, AWST — unambiguous) or a place
 *              that lies in exactly one zone (Yogyakarta -> WIB, Canggu -> WITA, Jayapura -> WIT, ...);
 *              an ambiguous abbreviation (AEST, IST) only narrows a set and must be settled by a place;
 *              a country counts only when ALL its zones share one UTC offset (Singapore, India, Malaysia);
 *              the zones of the account's past, resolved events (history), when there are enough of them.
 *   decision   the zone most texts point to, and only if (nearly) all of them do: at least 90% of the texts that
 *              mention any zone, backed by a strong signal or at least two texts. A curator that writes
 *              "WIB" for Java and "WITA" for Bali, or a national organizer, has NO default — "multi-zone" is the
 *              correct answer, and its events keep resolving one by one (venue, then subscriber, then a person).
 *   reach      a national / international account never gets a default, whatever the text says.
 */
import type { ProfileText } from './country-signals.js';

export interface ZoneAbbreviation { re: RegExp; zones: string[] }
// Case-sensitive on purpose (WIT, IST are ordinary words in lower case).
const ABBREVIATIONS: ZoneAbbreviation[] = [
  { re: /\bWIB\b/, zones: ['Asia/Jakarta'] },
  { re: /\bWITA\b/, zones: ['Asia/Makassar'] },
  { re: /\bWIT\b/, zones: ['Asia/Jayapura'] },
  { re: /\bMYT\b/, zones: ['Asia/Kuala_Lumpur'] },
  { re: /\bSGT\b/, zones: ['Asia/Singapore'] },
  { re: /\bAWST\b/, zones: ['Australia/Perth'] },
  // ambiguous: several zones share the abbreviation, a place has to choose
  { re: /\b(?:AEST|AEDT)\b/, zones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Hobart'] },
  { re: /\bIST\b/, zones: ['Asia/Kolkata', 'Europe/Dublin', 'Asia/Jerusalem'] },
];

// A place that lies in exactly one zone. Indonesian places are listed per zone because the country alone is not enough.
const PLACES: Array<{ re: RegExp; zone: string }> = [
  // WIB (UTC+7): Sumatra, Java, West & Central Kalimantan
  { re: /\b(?:yogyakarta|jogja|sleman|bantul|kulon progo|gunungkidul|jakarta|jabodetabek|bandung|surabaya|sidoarjo|semarang|surakarta|solo|malang|kartasura|medan|palembang|pontianak|depok|bogor|bekasi|tangerang)\b/i, zone: 'Asia/Jakarta' },
  // WITA (UTC+8): Bali, Nusa Tenggara, South/East/North Kalimantan, Sulawesi
  { re: /\b(?:bali|denpasar|canggu|ubud|seminyak|kuta|lombok|mataram|makassar|manado|balikpapan|samarinda|banjarmasin|kupang|flores|labuan bajo)\b/i, zone: 'Asia/Makassar' },
  // WIT (UTC+9): Maluku, Papua
  { re: /\b(?:jayapura|papua|ambon|maluku|sorong|merauke)\b/i, zone: 'Asia/Jayapura' },
  { re: /\b(?:kuala lumpur|selangor|penang|johor|petaling jaya|putrajaya)\b/i, zone: 'Asia/Kuala_Lumpur' },
  { re: /\b(?:singapore|singapura)\b/i, zone: 'Asia/Singapore' },
  { re: /\b(?:delhi|mumbai|bengaluru|bangalore|chennai|kolkata|hyderabad)\b/i, zone: 'Asia/Kolkata' },
  { re: /\bmelbourne\b/i, zone: 'Australia/Melbourne' },
  { re: /\bsydney\b/i, zone: 'Australia/Sydney' },
  { re: /\bbrisbane\b/i, zone: 'Australia/Brisbane' },
  { re: /\bperth\b/i, zone: 'Australia/Perth' },
];

// Countries whose zones all share one UTC offset: the country IS enough. Indonesia and Australia are absent on purpose.
export const COUNTRY_SINGLE_ZONE: Record<string, string> = { SG: 'Asia/Singapore', IN: 'Asia/Kolkata', MY: 'Asia/Kuala_Lumpur' };
export const MULTI_ZONE_COUNTRIES = ['ID', 'AU', 'US', 'CA', 'BR', 'RU', 'MX'];

// Zones that are the same clock for event purposes (same offset and rules): any of a group is an acceptable answer.
export const EQUIVALENT_ZONES: string[][] = [
  ['Asia/Jakarta', 'Asia/Pontianak'], ['Asia/Kuala_Lumpur', 'Asia/Kuching'], ['Asia/Kolkata', 'Asia/Calcutta'],
  ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Canberra'],
];
export function equivalentZones(zone: string): string[] {
  return EQUIVALENT_ZONES.find((g) => g.includes(zone)) ?? [zone];
}
export function sameClock(a: string, b: string): boolean { return a === b || equivalentZones(a).includes(b); }

export function isValidZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return /^[A-Za-z_]+\/[A-Za-z_+\-0-9/]+$/.test(zone); } catch { return false; }
}

export interface ZoneHistory { zone: string; events: number }
export interface TimezoneContext {
  country?: string;                // already resolved by the country step
  history?: ZoneHistory[];         // zones of the account's past resolved events, with counts
}

export type ZoneDecision =
  | { status: 'resolved'; zone: string; source: 'text' | 'country' | 'history'; support: number; of: number; evidence: string[] }
  | { status: 'unresolved'; reason: 'no-signal' | 'multi-zone' | 'ambiguous' | 'weak' | 'country-mismatch' | 'conflict'; support: Record<string, number>; of: number };

export const HISTORY_MIN_EVENTS = 5;
export const HISTORY_MIN_SHARE = 0.9;
export const DOMINANCE = 0.9;

function textsOf(p: ProfileText): string[] {
  return [p.username, p.displayName, p.biography, p.businessCategoryName ?? '', ...p.locationNames, ...p.captions].filter((t) => t.trim() !== '');
}

// The zones ONE text points to.
//   single         exactly one zone (an unambiguous abbreviation, or a place, or both agreeing)
//   ambiguous      an abbreviation shared by several zones (AEST, IST) that no place in the same text narrows:
//                  compatible with each of its zones, a vote for none
//   contradiction  an abbreviation and a place that name DIFFERENT zones in one text ("Makassar 19.00 WIB"):
//                  counts against both
type TextKind = 'single' | 'ambiguous' | 'contradiction';
function zonesOfText(raw: string): { kind: TextKind; zones: string[]; strong: boolean; evidence: string } | undefined {
  const text = raw.normalize('NFKC');
  let abbr: string[] | undefined; let evidence = '';
  for (const a of ABBREVIATIONS) {
    const m = a.re.exec(text);
    if (m) { abbr = abbr ? abbr.filter((z) => a.zones.includes(z)) : a.zones; evidence = m[0]; }
  }
  const placeZones = new Set<string>();
  for (const pl of PLACES) { const m = pl.re.exec(text); if (m) { placeZones.add(pl.zone); evidence ||= m[0]; } }
  if (abbr && abbr.length === 0) return undefined; // contradictory abbreviations in one text: no information
  if (abbr && placeZones.size) {
    const both = abbr.filter((z) => placeZones.has(z));
    if (both.length === 1) return { kind: 'single', zones: both, strong: true, evidence };
    if (both.length === 0) return { kind: 'contradiction', zones: [...new Set([...abbr, ...placeZones])], strong: false, evidence };
    return { kind: 'ambiguous', zones: both, strong: false, evidence };
  }
  if (abbr) return abbr.length === 1 ? { kind: 'single', zones: abbr, strong: true, evidence } : { kind: 'ambiguous', zones: abbr, strong: false, evidence };
  if (placeZones.size === 1) return { kind: 'single', zones: [...placeZones], strong: false, evidence };
  if (placeZones.size > 1) return { kind: 'contradiction', zones: [...placeZones], strong: false, evidence }; // places in different zones in one text
  return undefined;
}

export function inferZone(p: ProfileText, ctx: TimezoneContext = {}): ZoneDecision {
  const votes: Record<string, number> = {}; const strong: Record<string, number> = {}; const evidence: Record<string, string[]> = {};
  const ambiguousSets: string[][] = [];
  let voting = 0; // texts that vote (single or contradiction)
  for (const t of textsOf(p)) {
    const z = zonesOfText(t);
    if (!z) continue;
    if (z.kind === 'ambiguous') { ambiguousSets.push(z.zones); continue; }
    voting++;
    for (const zone of z.zones) {
      votes[zone] = (votes[zone] ?? 0) + 1;
      if (z.strong && z.kind === 'single') strong[zone] = (strong[zone] ?? 0) + 1;
      (evidence[zone] ??= []).push(z.evidence);
    }
  }
  const support = votes;
  const of = voting + ambiguousSets.length;
  // the account's own history of resolved events counts as one decisive source when it is large and uniform
  const hist = ctx.history ?? [];
  const histTotal = hist.reduce((n, h) => n + h.events, 0);
  const histTop = [...hist].sort((a, b) => b.events - a.events)[0];
  const histUniform = histTotal >= HISTORY_MIN_EVENTS && !!histTop && histTop.events / histTotal >= HISTORY_MIN_SHARE;
  if (histUniform && of === 0) {
    return { status: 'resolved', zone: histTop.zone, source: 'history', support: histTop.events, of: histTotal, evidence: [`${histTop.events}/${histTotal} past events`] };
  }
  if (of === 0) {
    const single = ctx.country ? COUNTRY_SINGLE_ZONE[ctx.country] : undefined;
    if (single) return { status: 'resolved', zone: single, source: 'country', support: 1, of: 1, evidence: [`${ctx.country} has one UTC offset`] };
    return { status: 'unresolved', reason: ctx.country && MULTI_ZONE_COUNTRIES.includes(ctx.country) ? 'multi-zone' : 'no-signal', support, of };
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return { status: 'unresolved', reason: 'ambiguous', support, of }; // only ambiguous abbreviations, no place to settle them
  const [topZone, topN] = ranked[0];
  if (ranked[1] && ranked[1][1] === topN && !sameClock(ranked[1][0], topZone)) {
    return { status: 'unresolved', reason: Object.keys(strong).length ? 'multi-zone' : 'ambiguous', support, of };
  }
  // an ambiguous text that includes the top zone is compatible with it (neutral); one that excludes it is against it
  const excluding = ambiguousSets.filter((set) => !set.some((z) => sameClock(z, topZone))).length;
  const considered = voting + excluding;
  const otherClockVotes = ranked.filter(([z]) => !sameClock(z, topZone)).reduce((n, [, c]) => Math.max(n, c), 0) + excluding;
  const EPS = 1e-9; // 9 of 10 must pass a 0.9 bar exactly, floating point notwithstanding
  if (topN / considered < DOMINANCE - EPS || otherClockVotes / considered > 1 - DOMINANCE + EPS) return { status: 'unresolved', reason: 'multi-zone', support, of };
  if (!((strong[topZone] ?? 0) >= 1 || topN >= 2)) return { status: 'unresolved', reason: 'weak', support, of };
  if (ctx.country) {
    const zc = zoneCountryOf(topZone);
    if (zc && zc !== ctx.country) return { status: 'unresolved', reason: 'country-mismatch', support, of };
  }
  if (histUniform && !sameClock(histTop.zone, topZone)) {
    return { status: 'unresolved', reason: 'conflict', support, of }; // the text says one clock, the account's own past events another
  }
  return { status: 'resolved', zone: topZone, source: 'text', support: topN, of, evidence: [...new Set(evidence[topZone])].slice(0, 3) };
}

function zoneCountryOf(zone: string): string | undefined {
  if (zone.startsWith('Australia/')) return 'AU';
  const m: Record<string, string> = { 'Asia/Jakarta': 'ID', 'Asia/Pontianak': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY', 'Asia/Singapore': 'SG', 'Asia/Kolkata': 'IN', 'Europe/Dublin': 'IE', 'Asia/Jerusalem': 'IL' };
  return m[zone];
}

export type Reach = 'local' | 'regional' | 'national' | 'international' | 'unspecified';

/**
 * The account's default zone: text evidence first; a model answer only where the text is silent and only for a
 * single-region account; a national/international reach or disagreement means NO default.
 */
export type TimezoneResolution =
  | { status: 'resolved'; zone: string; source: 'text' | 'country' | 'history' | 'model' }
  | { status: 'unresolved'; reason: 'multi-zone' | 'no-evidence' | 'conflict' | 'ambiguous' | 'weak' | 'country-mismatch' | 'no-signal' };

export function resolveTimezone(signals: ZoneDecision, model: { zone: string | undefined; quoted: boolean } | undefined, reach: Reach, country?: string): TimezoneResolution {
  if (reach === 'national' || reach === 'international') return { status: 'unresolved', reason: 'multi-zone' };
  const modelZone = model?.zone && model.quoted && isValidZone(model.zone) ? model.zone : undefined;
  if (signals.status === 'resolved') {
    if (modelZone && !sameClock(modelZone, signals.zone)) return { status: 'unresolved', reason: 'conflict' };
    return { status: 'resolved', zone: signals.zone, source: signals.source };
  }
  if (signals.reason === 'multi-zone' || signals.reason === 'ambiguous' || signals.reason === 'country-mismatch' || signals.reason === 'conflict') return { status: 'unresolved', reason: signals.reason };
  if (modelZone) {
    if (country && zoneCountryOf(modelZone) && zoneCountryOf(modelZone) !== country) return { status: 'unresolved', reason: 'country-mismatch' };
    return { status: 'resolved', zone: modelZone, source: 'model' };
  }
  return { status: 'unresolved', reason: signals.reason === 'weak' ? 'weak' : 'no-evidence' };
}
