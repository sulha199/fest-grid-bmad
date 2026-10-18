/**
 * POC (not production code): how an event's audience insight and a user's profile could be
 * combined into a Discovery ordering.
 *
 * Design choice being prototyped — relevance as a DATE DISCOUNT, not a replacement sort key:
 *
 *   sortKey = daysUntilNext − MAX_BOOST_DAYS × max(R, 0) + MAX_DEMOTE_DAYS × max(−R, 0)
 *
 * Discovery stays broadly chronological (today's contract: ordered by next-upcoming schedule
 * date), a strongly relevant event surfaces up to MAX_BOOST_DAYS earlier than its date alone
 * would place it, and a clear mismatch sinks up to MAX_DEMOTE_DAYS later. It is a single ORDER BY
 * expression, which is what Query.events needs (AD-17 forbids a new per-row resolver or an extra
 * unconditional secondary query there). Real SQL is a later story; this proves the shape.
 *
 * Everything here is pure and has no DB/ORM/React dependency, so it could move to
 * packages/domain unchanged when it graduates.
 */
import type { EventInsight, Segment } from './insight-schema.js';
import { AREA_ALIASES } from './score.js';

export const MAX_BOOST_DAYS = 21;
export const MAX_DEMOTE_DAYS = 21;

// Geo is deliberately the smallest-leverage *positive* signal: in a regional product most events are
// "near" most users, so a big geo bonus is a near-constant offset that reorders nothing and only
// drowns interest/audience (the first prototype did exactly this — a runner and a parent in the same
// district got an identical page). Geo's real job is the NEGATIVE side: demoting events meant for
// somewhere else. Interest carries the most positive weight.
export const WEIGHTS = { geo: 0.35, interest: 0.45, audience: 0.15, language: 0.05 } as const;

// Tiny gazetteer for the POC. In production the user's side comes from the geocoded
// LocationDetails already stored on user_locations (city / adminArea / province, PRD §4.3) and the
// event's side from geocoding the AI-extracted area NAMES through the existing geolocation
// adapter + cache — the model names places, the geocoder canonicalises them.
const AREA_PARENT: Record<string, string | undefined> = {
  sleman: 'yogyakarta', bantul: 'yogyakarta', yogyakarta: 'indonesia',
  semarang: 'central_java', central_java: 'indonesia',
  jakarta: 'indonesia', bandung: 'indonesia', surabaya: 'indonesia',
  canggu: 'bali', bali: 'indonesia', indonesia: undefined, asia: undefined,
};

export function canonicalAreaKey(name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, aliases] of Object.entries(AREA_ALIASES)) {
    if (aliases.some((a) => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(lower))) return key;
  }
  return lower.includes('indonesia') ? 'indonesia' : undefined;
}

const ancestors = (key: string): string[] => {
  const out: string[] = [];
  for (let k: string | undefined = AREA_PARENT[key]; k; k = AREA_PARENT[k]) out.push(k);
  return out;
};

export interface UserProfile {
  id: string;
  locale: 'id' | 'en';
  // Canonical area keys of the user's saved/ambient locations, most specific first.
  areas: string[];
  // Interest tag → weight 0..1, derived from favorites/calendar adds/followed accounts or chosen
  // in onboarding. NOT inferred from demographics.
  interests: Record<string, number>;
  // Opt-in only. The app holds no age/gender/occupation today; absent means "no signal", never
  // "assume".
  declaredSegments?: Segment[];
}

export interface RelevanceResult {
  score: number; // −1..1
  parts: { geo: number; interest: number; audience: number; language: number };
  reasons: string[];
}

function geoFit(user: UserProfile, insight: EventInsight, reasons: string[]): number {
  if (insight.geoScope === 'online') { reasons.push('online'); return 0; }
  const eventKeys = insight.targetAreas.map((a) => canonicalAreaKey(a.name)).filter((k): k is string => !!k);
  if (eventKeys.length === 0) return 0; // unspecified / unresolvable => neutral, never a penalty
  if (user.areas.length === 0) return 0; // no location signal => neutral
  let best = -1;
  for (const e of eventKeys) {
    const idx = user.areas.indexOf(e);
    if (idx === 0) best = Math.max(best, 0.6); // the user's own most specific area (e.g. Sleman for a Sleman user)
    else if (idx > 0) best = Math.max(best, 0.2); // a broader area the user belongs to (e.g. the province)
    else if (user.areas.some((u) => ancestors(e).includes(u))) best = Math.max(best, 0.3); // a sub-area of where the user is
    else if (user.areas.some((u) => ancestors(u).includes(e))) best = Math.max(best, e === 'indonesia' ? 0.05 : 0.2);
    else if (e === 'asia' && user.areas.some((u) => ancestors(u).includes('indonesia'))) best = Math.max(best, 0.05);
  }
  if (best >= 0.3) reasons.push('near you');
  if (best < 0) {
    // A national/international event is open to people anywhere, so a listed city that is not the
    // user's is not evidence it is "for someone else" — neutral, never a demotion.
    if (insight.geoScope === 'national' || insight.geoScope === 'international') return 0;
    reasons.push('elsewhere');
  }
  return best;
}

function interestFit(user: UserProfile, insight: EventInsight, reasons: string[]): number {
  let sum = 0;
  for (const tag of insight.interests.map((t) => t.toLowerCase())) {
    for (const [mine, weight] of Object.entries(user.interests)) {
      if (tag.includes(mine) || mine.includes(tag)) { sum += weight; reasons.push(`you like ${mine}`); break; }
    }
  }
  return Math.min(1, sum / 1.5);
}

function audienceFit(user: UserProfile, insight: EventInsight, reasons: string[]): number {
  const declared = user.declaredSegments ?? [];
  if (declared.length === 0) return 0; // we do not know who the user is => no claim either way
  const overlap = insight.segments.filter((s) => declared.includes(s));
  if (overlap.length) { reasons.push(`for ${overlap[0]}`); return 0.8; }
  // A narrow audience that the user declared they are not part of.
  const narrow: Segment[] = ['kids', 'seniors'];
  if (insight.segments.some((s) => narrow.includes(s)) && !insight.segments.some((s) => declared.includes(s))) return -0.8;
  return 0;
}

function languageFit(user: UserProfile, insight: EventInsight): number {
  if (insight.languages.length === 0) return 0;
  return insight.languages.map((l) => l.toLowerCase()).includes(user.locale) ? 0.5 : -0.5;
}

export function relevance(user: UserProfile, insight: EventInsight | undefined): RelevanceResult {
  const reasons: string[] = [];
  if (!insight) return { score: 0, parts: { geo: 0, interest: 0, audience: 0, language: 0 }, reasons };
  const parts = {
    geo: geoFit(user, insight, reasons),
    interest: interestFit(user, insight, reasons),
    audience: audienceFit(user, insight, reasons),
    language: languageFit(user, insight),
  };
  const raw = WEIGHTS.geo * parts.geo + WEIGHTS.interest * parts.interest + WEIGHTS.audience * parts.audience + WEIGHTS.language * parts.language;
  return { score: Math.max(-1, Math.min(1, raw)), parts, reasons: [...new Set(reasons)] };
}

export interface RankableEvent { id: string; daysUntilNext: number; insight?: EventInsight }

export function sortKey(daysUntilNext: number, score: number): number {
  return daysUntilNext - MAX_BOOST_DAYS * Math.max(score, 0) + MAX_DEMOTE_DAYS * Math.max(-score, 0);
}

// `user === undefined` (anonymous / no signal) must reproduce today's pure-chronological order.
export function rankDiscovery<T extends RankableEvent>(events: T[], user?: UserProfile): Array<T & RelevanceResult & { key: number }> {
  return events
    .map((e) => {
      const r = user ? relevance(user, e.insight) : { score: 0, parts: { geo: 0, interest: 0, audience: 0, language: 0 }, reasons: [] };
      return { ...e, ...r, key: sortKey(e.daysUntilNext, r.score) };
    })
    // Tie-break on id so offset pagination is deterministic when keys collide.
    .sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
}

// ---- Area-first ordering ----------------------------------------------------------------------
// Requested ordering: events TARGETED AT THE USER'S AREA first, then the sooner. A strict
// lexicographic key — (areaTier, daysUntilNext, id) — rather than a blended score. Simple to explain
// ("local first, then soonest"), a single integer CASE in SQL ahead of the existing date key, and it
// needs only area data (no interest/audience model) so it can ship before the rest.
//
// Tiers (what "targeted at" means):
//   0  the event's target areas include the user's area, a sub-area of it, an area that contains it, or a
//      sibling inside the same containing region (Bantul for a Sleman user) — "meant for people where I am".
//   1  no specific area: national / international / online / unspecified / no resolvable area, or the
//      user has no location signal at all (then every event lands here => pure date order).
//   2  targeted at some other area and not national/online => "meant for people elsewhere".
// With granularity 'most-local-first', tier 0 splits in two: the user's own area or a sub-area first,
// then a broader containing area (so a Sleman event outranks a DIY-wide one).
export type AreaGranularity = 'any-containing' | 'most-local-first';

export interface AreaTierResult { tier: number; reason: 'own-area' | 'containing-area' | 'same-region' | 'no-specific-area' | 'elsewhere' }

// `venueAreaKeys`: canonical keys from the venue's geocoded LocationDetails. Fallback/union with the
// AI-extracted target areas, so the ordering works for events whose post names no audience area.
export function areaTier(user: UserProfile | undefined, insight: EventInsight | undefined, venueAreaKeys: string[] = [], granularity: AreaGranularity = 'any-containing'): AreaTierResult {
  const none: AreaTierResult = { tier: granularity === 'any-containing' ? 1 : 2, reason: 'no-specific-area' };
  if (!user || user.areas.length === 0) return none;
  if (insight?.geoScope === 'online') return none;
  const eventKeys = [...new Set([
    ...(insight?.targetAreas ?? []).map((a) => canonicalAreaKey(a.name)).filter((k): k is string => !!k),
    ...venueAreaKeys,
  ])].filter((k) => k !== 'indonesia'); // a country-level target is "national", not "my area"
  if (eventKeys.length === 0) return none;

  // `user.areas[0]` is the user's most specific area (e.g. Sleman); the rest are the broader areas that
  // contain it (e.g. DIY). Note a SIBLING (Bantul, for a Sleman user) is a sub-area of DIY but is not
  // the user's own area — it is "same region", a distinct reason.
  const [mine, ...broader] = user.areas;
  const own = eventKeys.some((e) => e === mine || ancestors(e).includes(mine));
  const containing = eventKeys.some((e) => broader.includes(e));
  const sameRegion = eventKeys.some((e) => broader.some((b) => ancestors(e).includes(b)));
  if (own) return { tier: 0, reason: 'own-area' };
  if (containing) return { tier: granularity === 'any-containing' ? 0 : 1, reason: 'containing-area' };
  if (sameRegion) return { tier: granularity === 'any-containing' ? 0 : 1, reason: 'same-region' };
  if (insight?.geoScope === 'national' || insight?.geoScope === 'international') return none;
  return { tier: granularity === 'any-containing' ? 2 : 3, reason: 'elsewhere' };
}

export interface RankableWithVenue extends RankableEvent { venueAreaKeys?: string[] }

export function rankAreaThenDate<T extends RankableWithVenue>(events: T[], user?: UserProfile, granularity: AreaGranularity = 'any-containing'): Array<T & AreaTierResult> {
  return events
    .map((e) => ({ ...e, ...areaTier(user, e.insight, e.venueAreaKeys, granularity) }))
    .sort((a, b) => a.tier - b.tier || a.daysUntilNext - b.daysUntilNext || a.id.localeCompare(b.id));
}
