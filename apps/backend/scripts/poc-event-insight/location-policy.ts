/**
 * POC (pure, no I/O): location policy that the discussion of 2026-10-18 asked for.
 *
 * Mirrors the shape of `isScrapableAccountType` (AD-34): one function decides, taking
 * `(accountType, accountTypeStatus)` exactly as the database stores them.
 *
 *   1. `mayUseAccountLocation`   which accounts' location may stand in for an event's missing area.
 *   2. `acceptGeocode`           a country-aware, floor-enforcing replacement for `selectBestCandidate`.
 *   3. `effectiveAudienceAreas`  which area an event is FOR: stated audience > venue named in the post >
 *                                account location (organizers only) > none.
 *   4. `consensusPlace`          infer an account's base only when several posts agree.
 */
import type { GeoScope } from './insight-schema.js';

export type AccountType = 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | null;
export type AccountTypeStatus = 'CONFIRMED' | 'AWAITING_APPROVAL' | null;

// How far an account's own audience reaches, as read from its profile (profile-insight.ts). A venue, a
// mall, a local government reach 'local'/'regional'; a national company, a national olympiad organizer
// reach 'national'. 'unknown' = not (yet) determined, e.g. the profile scrape has not succeeded.
export type AccountReach = 'local' | 'regional' | 'national' | 'international' | 'unknown';

// A venue/organizer account's location is its events' location ("an event at a mall posted on the
// mall's account", PRD §3.7) — when the organizer is LOCAL. Three accounts must not lend theirs:
//   * a curator publishes events from many places, so it has no single location to fall back to;
//   * a national company's or a national organizer's account location is a head office, not where an
//     area-less post's event happens (reach 'national' / 'international');
//   * an account that is not CONFIRMED an organizer — awaiting approval (might be a curator) or NEVER
//     CLASSIFIED (accountTypeStatus null). Revised 2026-10-18: "never classified" used to keep today's
//     behaviour, but null means *unknown*, not *organizer*: Story 3.4n grandfathered those accounts into
//     scraping on purpose, and any curator among them would otherwise lend a wrong location. The cost of
//     withholding is one missing fallback pin on an area-less post; the cost of lending is a wrong pin.
export function mayUseAccountLocation(accountType: AccountType, accountTypeStatus: AccountTypeStatus, reach: AccountReach = 'unknown'): boolean {
  if (accountTypeStatus !== 'CONFIRMED' || accountType !== 'ORGANIZER_VENUE_EVENT') return false;
  return reach !== 'national' && reach !== 'international';
}

// Inferring an account location from a post only makes sense for the accounts that may use one.
export const mayInferAccountLocation = mayUseAccountLocation;

// ---- 2. country-aware geocode acceptance ------------------------------------------------------
export interface GeocodeCandidate { countryCode?: string; confidence?: number; matchType?: string; label?: string }

export type GeocodeDecision<T extends GeocodeCandidate> =
  | { status: 'accepted'; candidate: T; skippedForeign: number }
  | { status: 'unresolved'; reason: 'no-candidates' | 'no-candidate-in-allowed-country' | 'below-confidence-floor'; skippedForeign: number };

// Today (`selectBestCandidate`): highest `confidence` wins wherever it is, and there is no floor, so
// something is always accepted. A bias (`bias=countrycode:`) only nudges the provider's ordering.
// Here: candidates outside the allowed countries are never eligible (this is the code-side equivalent
// of the provider's hard `filter=countrycode:`), and the best eligible candidate must clear a floor,
// otherwise the answer is "unresolved" — stored as text only, never as a wrong pin.
export function acceptGeocode<T extends GeocodeCandidate>(
  candidates: T[],
  opts: { allowedCountries: string[]; minConfidence: number },
): GeocodeDecision<T> {
  if (candidates.length === 0) return { status: 'unresolved', reason: 'no-candidates', skippedForeign: 0 };
  const allowed = new Set(opts.allowedCountries.map((c) => c.toLowerCase()));
  const eligible = candidates.filter((c) => c.countryCode !== undefined && allowed.has(c.countryCode.toLowerCase()));
  const skippedForeign = candidates.length - eligible.length;
  if (eligible.length === 0) return { status: 'unresolved', reason: 'no-candidate-in-allowed-country', skippedForeign };
  let best = eligible[0];
  for (const c of eligible.slice(1)) if ((c.confidence ?? -Infinity) > (best.confidence ?? -Infinity)) best = c;
  if ((best.confidence ?? -Infinity) < opts.minConfidence) return { status: 'unresolved', reason: 'below-confidence-floor', skippedForeign };
  return { status: 'accepted', candidate: best, skippedForeign };
}

// ---- 3. which area is an event FOR -------------------------------------------------------------
export type AreaSource = 'stated' | 'venue' | 'account' | 'none';

export interface AudienceAreaInputs {
  geoScope: GeoScope;
  // area keys the post explicitly says the event is for / open to / aimed at
  statedAreaKeys: string[];
  // area keys of the venue(s) the post names — "where it happens", used only as a fallback
  venueAreaKeys: string[];
  // area keys of the account's own location, if it has one
  accountAreaKeys: string[];
  accountType: AccountType;
  accountTypeStatus: AccountTypeStatus;
  // the account's own reach, when its profile has been read; absent = 'unknown'
  accountReach?: AccountReach;
}

export interface EffectiveAudienceAreas { keys: string[]; source: AreaSource }

const NATIONWIDE: GeoScope[] = ['national', 'international'];

// The order is by what the post itself says about its audience, NOT by where the event happens:
//   1. a stated audience area wins outright;
//   2. a stated national/international scope stops the fallbacks — a national competition held at a
//      Yogyakarta campus is not "for Yogyakarta";
//   3. an online event has no venue, so it takes only its organizer's own area — and only when that
//      organizer is KNOWN to be local (a local government's Zoom briefing is for its residents; a
//      national company's webinar is for everyone, and an organizer of unknown reach is not guessed at);
//   4. otherwise a plain local event is for the locality of its venue;
//   5. otherwise a CONFIRMED, non-national organizer/venue account's own location (never a curator's);
//   6. otherwise nothing — the event is "for anyone".
export function effectiveAudienceAreas(i: AudienceAreaInputs): EffectiveAudienceAreas {
  const reach = i.accountReach ?? 'unknown';
  const mayUse = mayUseAccountLocation(i.accountType, i.accountTypeStatus, reach);
  if (i.statedAreaKeys.length > 0) return { keys: [...new Set(i.statedAreaKeys)], source: 'stated' };
  if (NATIONWIDE.includes(i.geoScope)) return { keys: [], source: 'none' };
  if (i.geoScope === 'online') {
    return mayUse && (reach === 'local' || reach === 'regional') && i.accountAreaKeys.length > 0
      ? { keys: [...new Set(i.accountAreaKeys)], source: 'account' }
      : { keys: [], source: 'none' };
  }
  if (i.venueAreaKeys.length > 0) return { keys: [...new Set(i.venueAreaKeys)], source: 'venue' };
  if (i.accountAreaKeys.length > 0 && mayUse) return { keys: [...new Set(i.accountAreaKeys)], source: 'account' };
  return { keys: [], source: 'none' };
}

// ---- 4. consensus before inferring an account's base -------------------------------------------
const FILLER = new Set([
  'lantai', 'floor', 'ground', 'hall', 'lt', 'jl', 'jalan', 'jln', 'and', 'dan', 'di', 'at', 'the',
  'indonesia', 'yogyakarta', 'jogja', 'diy', 'daerah', 'istimewa', 'sleman', 'bantul', 'jawa', 'tengah',
  'faculty', 'fakultas', 'of', 'universitas',
]);

function core(description: string): Set<string> {
  return new Set(
    description.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((t) => t.length > 2 && !FILLER.has(t)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

// An account's base place is whatever MOST of its posts keep pointing at. One post's venue is not it:
// the production prompt asks "where do THIS post's events take place", so a curator gets a different
// answer per post. Accept a place only if at least `minAgree` descriptions (and a majority) describe it.
export function consensusPlace(descriptions: string[], opts: { minAgree?: number; majority?: number } = {}): string | null {
  const minAgree = opts.minAgree ?? 2;
  const majority = opts.majority ?? 0.6;
  if (descriptions.length < minAgree) return null;
  const cores = descriptions.map(core);
  let bestIdx = -1, bestVotes = 0;
  for (let i = 0; i < descriptions.length; i++) {
    if (cores[i].size === 0) continue;
    const votes = cores.filter((c) => overlap(cores[i], c) >= 0.5).length;
    if (votes > bestVotes) { bestVotes = votes; bestIdx = i; }
  }
  if (bestIdx < 0 || bestVotes < minAgree || bestVotes / descriptions.length < majority) return null;
  return descriptions[bestIdx];
}
