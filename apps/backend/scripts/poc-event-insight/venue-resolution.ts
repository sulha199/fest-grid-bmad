/**
 * POC (pure, no I/O): a post names a VENUE without a full address ("Taman Budaya", "Alun-alun Ambarrukmo"). Which geocoder candidate, if any, may
 * stand for it, and with what trust? Settled with the owner on 2026-10-27 (target-area-spec-2026-10-27.md section 10).
 *
 * Why: today the venue text goes to the geocoder with only a country bias and the highest-confidence candidate wins. In prod only 43% of the
 * geocoded schedules had confidence >= 0.5, and "Arena Grand Paris" landed in France, "Taman Budaya Embung Giwangan" in Sabah (confidence 0.24) and
 * "Alun-Alun Ambarrukmo" in Ciamis, West Java (confidence 0, in-country but wrong).
 *
 * The decision, first rule that answers:
 *   1. only candidates in the expected country with confidence >= the floor (0.5) are eligible;
 *   2. CONTEXT, strongest first: POST-level (an area the post states, a roundup heading, the event's other resolved places, a plain place hashtag),
 *      then ACCOUNT-level (an organizer's default area, a curator's audience area). The context area may be as wide as a province when no city
 *      is known; a missing city never means "take the top candidate";
 *   3. with context: the candidate must lie inside it. Exactly one -> accepted. Several: post-level context lets the top one stand; with
 *      account-level context only candidates in the same regency collapse to one, otherwise the venue is ambiguous;
 *   4. without context: a generic name is ambiguous; any other name is accepted only if it is unambiguous (one candidate >= 0.9, the rest <= 0.5);
 *   5. precision: EXACT only with post-level context or an unambiguous name; support from the account alone caps the pin at AREA.
 * An ambiguous or rejected venue gives NO venue signal: the target area then comes from hashtags or the account, else it is unknown.
 */
import { resolveArea, type GazetteerIndex } from './area-resolver.js';

export const VENUE_CONFIDENCE_FLOOR = 0.5;
export const UNAMBIGUOUS_TOP_CONFIDENCE = 0.9;

// ---- generic names -----------------------------------------------------------------------------------------------------
/**
 * Words that make a venue name generic when they are ALL there is: "Alun-alun", "Taman Budaya", "Masjid Agung", "Masjid Jami", "Pasar", "GOR",
 * "Balai Desa", "Balai Warga", "Lapangan", "Gedung Serbaguna", "Taman Kota" (the owner confirmed this list, 2026-10-27). A name with any other word
 * ("Taman Budaya Yogyakarta", "Alun-Alun Ambarrukmo") names a place and is not generic.
 */
export const GENERIC_VENUE_TOKENS: readonly string[] = [
  'alun', 'taman', 'budaya', 'masjid', 'agung', 'jami', 'pasar', 'gor', 'balai', 'desa', 'warga', 'lapangan', 'gedung', 'serbaguna', 'kota',
];

export const normalizeVenueName = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^(di|at|in)\s+/, '').trim();

export function isGenericVenueName(name: string): boolean {
  const tokens = normalizeVenueName(name).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => GENERIC_VENUE_TOKENS.includes(t));
}

/** Account-scoped venue memory key: the same account's later posts reuse a verified pin for the same normalized name. Never the bare name. */
export const venueMemoryKey = (accountId: string, venueName: string): string => `${accountId}::${normalizeVenueName(venueName)}`;

// ---- the geocoder's own area -------------------------------------------------------------------------------------------
export type GeocoderArea =
  | { status: 'resolved'; keys: string[]; level: string }
  | { status: 'province-only'; keys: string[] }
  | { status: 'foreign'; countryCode: string }
  | { status: 'unresolved' };

/**
 * Maps the geocoder's `city` and `province` strings to gazetteer keys. The geocoder's "city" is often a KECAMATAN, not a city (prod, DIY
 * schedules: Depok 352, Mlati 48, Banguntapan 26), and "Depok" is also Kota Depok in West Java, so the name is resolved WITHIN the province.
 * The geocoder gives a precise place, so the NARROWEST match wins ("Yogyakarta" inside DIY is Kota Yogyakarta, not the province).
 * Province spellings differ across time and providers ("Special Region of Yogyakarta", "Yogyakarta"); both resolve to one key.
 */
export function resolveGeocoderArea(geo: { city?: string | null; province?: string | null; countryCode?: string | null }, ix: GazetteerIndex): GeocoderArea {
  const country = (geo.countryCode ?? 'id').toLowerCase();
  if (country !== 'id') return { status: 'foreign', countryCode: country };
  const provinceRes = geo.province ? resolveArea(geo.province, ix, 'widest') : undefined;
  const provinceKey = provinceRes?.ok && provinceRes.area.level === 'province' ? provinceRes.area.keys[0] : undefined;
  if (!provinceKey) return { status: 'unresolved' };
  if (!geo.city) return { status: 'province-only', keys: [provinceKey] };
  const cityRes = resolveArea(geo.city, ix, 'narrowest', provinceKey);
  if (cityRes.ok) return { status: 'resolved', keys: cityRes.area.keys, level: cityRes.area.level };
  return { status: 'province-only', keys: [provinceKey] };
}

// ---- the decision ------------------------------------------------------------------------------------------------------
export interface VenueCandidate {
  name?: string;
  /** Gazetteer keys of the candidate's area, from `resolveGeocoderArea`. */
  areaKeys: string[];
  confidence: number;
  countryCode?: string;
}

export interface VenueContext {
  /** Area keys supported by the post itself. */
  post: string[];
  /** Area keys supported only by the posting account. */
  account: string[];
}

export type VenueDecision =
  | { status: 'accepted'; precision: 'EXACT' | 'AREA'; contextSource: 'post' | 'account' | 'none'; candidate: VenueCandidate }
  | { status: 'ambiguous'; reason: string }
  | { status: 'rejected'; reason: string };

const insideAny = (keys: string[], context: string[], ix: GazetteerIndex): boolean =>
  keys.some((k) => ix.pathOf(k).some((p) => context.includes(p)));

const regencyOf = (keys: string[], ix: GazetteerIndex): string =>
  keys.map((k) => ix.pathOf(k).find((p) => ix.byKey.get(p)?.level === 'regency') ?? k).sort().join('|');

export function decideVenue(
  venueName: string,
  candidates: readonly VenueCandidate[],
  context: VenueContext,
  ix: GazetteerIndex,
  opts: { expectedCountry?: string; floor?: number } = {}
): VenueDecision {
  const expected = (opts.expectedCountry ?? 'id').toLowerCase();
  const floor = opts.floor ?? VENUE_CONFIDENCE_FLOOR;
  const eligible = candidates.filter((c) => (c.countryCode ?? expected).toLowerCase() === expected && c.confidence >= floor);
  if (eligible.length === 0) return { status: 'rejected', reason: 'no candidate in the expected country at or above the confidence floor' };

  const contextKeys = context.post.length > 0 ? context.post : context.account;
  const contextSource: 'post' | 'account' | 'none' = context.post.length > 0 ? 'post' : context.account.length > 0 ? 'account' : 'none';
  const byConfidence = (a: VenueCandidate, b: VenueCandidate) => b.confidence - a.confidence;

  if (contextSource !== 'none') {
    const inside = eligible.filter((c) => insideAny(c.areaKeys, contextKeys, ix)).sort(byConfidence);
    if (inside.length === 0) return { status: 'rejected', reason: 'no candidate lies inside the context area' };
    const precision = contextSource === 'post' ? 'EXACT' : 'AREA';
    if (inside.length === 1) return { status: 'accepted', precision, contextSource, candidate: inside[0] };
    if (contextSource === 'post') return { status: 'accepted', precision, contextSource, candidate: inside[0] };
    const regencies = new Set(inside.map((c) => regencyOf(c.areaKeys, ix)));
    if (regencies.size === 1) return { status: 'accepted', precision, contextSource, candidate: inside[0] };
    return { status: 'ambiguous', reason: 'several candidates in different regencies lie inside the account-level context' };
  }

  if (isGenericVenueName(venueName)) return { status: 'ambiguous', reason: 'generic venue name without context' };
  const all = [...candidates].sort(byConfidence);
  const top = all[0];
  const rest = all[1]?.confidence ?? 0;
  if (top && eligible.includes(top) && top.confidence >= UNAMBIGUOUS_TOP_CONFIDENCE && rest <= 0.5) {
    return { status: 'accepted', precision: 'EXACT', contextSource: 'none', candidate: top };
  }
  return { status: 'ambiguous', reason: 'no context and the name is not unambiguous' };
}
