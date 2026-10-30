// Story 3.6v (AD-30 Rule 7) -- pure, dependency-free event-matching scorer. Every input here is
// an already-fetched plain value (a boolean, a number, a string, or a plain array of them) --
// no DB/ORM type, no Node-runtime dependency. The DB-coupled caller
// (apps/backend/src/lib/events/match-event-to-existing.ts) is responsible for fetching the
// candidate row(s) and resolving the organizer-match boolean before calling in here; this file
// never queries anything itself.

import { venueTextsSamePlace } from './venue-text-match.js';

export type MatchTier = 'high' | 'mid' | 'low';

// Story 3.6v Dev Notes "Design decision 3" -- these are initial, documented *defaults*, not an
// architectural mandate (AD-30 Rule 7 explicitly defers exact tuning to this story). Exported so
// a future tuning pass (or a test asserting the documented values) has one place to read/compare
// against, instead of a magic number buried in computeMatchScore.
export const MATCH_SCORE_WEIGHTS = {
  organizerMatch: 0.4,
  sharedLink: 0.2,
  dateNameSimilarity: 0.25,
  venueMatch: 0.15,
} as const;

export const MATCH_SCORE_THRESHOLDS = {
  high: 0.75,
  mid: 0.45,
} as const;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Normalizes a URL for shared-link comparison: lowercase, trimmed, with any trailing slash and
 * query string stripped (matching AC1's "any URL in common ... normalized" instruction). Not a
 * full URL parser -- deliberately simple string normalization, since event links are free-form
 * strings extracted by Gemini, not guaranteed to be well-formed URLs a `URL` constructor would
 * accept without throwing.
 */
export function normalizeEventLinkUrl(url: string): string {
  let normalized = url.trim().toLowerCase();
  const queryIndex = normalized.indexOf('?');
  if (queryIndex !== -1) {
    normalized = normalized.slice(0, queryIndex);
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export interface MatchLinkLike {
  url?: string | null;
}

/**
 * AC1's "sharedLink" signal: true when any (normalized) URL appears in both link lists. Either
 * list may be null/undefined/empty (an event with no `links` at all) -- always false in that
 * case, never a throw.
 */
export function hasSharedEventLink(
  a: MatchLinkLike[] | null | undefined,
  b: MatchLinkLike[] | null | undefined
): boolean {
  const normalizedA = new Set(
    (a ?? [])
      .map((link) => link.url)
      .filter((url): url is string => Boolean(url))
      .map(normalizeEventLinkUrl)
  );
  if (normalizedA.size === 0) return false;

  for (const link of b ?? []) {
    if (link.url && normalizedA.has(normalizeEventLinkUrl(link.url))) {
      return true;
    }
  }
  return false;
}

/**
 * Great-circle distance in meters between two lat/lng points (haversine formula). Used for AC1's
 * "coordinates are within ~150m" venue signal -- unlike `computeDistanceKm.ts`'s spherical-
 * law-of-cosines formula (chosen there for radius-filter precision at larger distances), the
 * haversine formula is the more numerically stable choice at this story's much smaller (~150m)
 * scale, where law-of-cosines can lose precision from floating-point cancellation.
 */
export function haversineDistanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

const VENUE_PROXIMITY_METERS = 150;

export interface MatchVenueLike {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * AC1's "venueMatch" signal: true when any new/candidate schedule pair shares a (case-
 * insensitive, trimmed) `location` string, or has coordinates within ~150m of each other.
 */
export function hasVenueMatch(newVenues: MatchVenueLike[], candidateVenues: MatchVenueLike[]): boolean {
  for (const a of newVenues) {
    const aLocation = a.location?.trim().toLowerCase();
    for (const b of candidateVenues) {
      if (aLocation && b.location && aLocation === b.location.trim().toLowerCase()) {
        return true;
      }
      if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
        if (haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude) <= VENUE_PROXIMITY_METERS) {
          return true;
        }
      }
    }
  }
  return false;
}

export interface MatchScheduleLike {
  eventStartDate?: string | null;
}

/**
 * AC1's "date-proximity" input: the smallest day difference between any new/candidate schedule
 * pair. Returns `Infinity` when neither list has a usable date pair (e.g. one side is empty, or
 * every date is null) -- `computeDateProximityScore` below treats `Infinity` as "no signal",
 * never `NaN`.
 */
export function minScheduleDayDifference(newSchedules: MatchScheduleLike[], candidateSchedules: MatchScheduleLike[]): number {
  let min = Infinity;
  for (const a of newSchedules) {
    if (!a.eventStartDate) continue;
    const aTime = Date.parse(`${a.eventStartDate}T00:00:00Z`);
    if (Number.isNaN(aTime)) continue;
    for (const b of candidateSchedules) {
      if (!b.eventStartDate) continue;
      const bTime = Date.parse(`${b.eventStartDate}T00:00:00Z`);
      if (Number.isNaN(bTime)) continue;
      const diffDays = Math.abs(aTime - bTime) / 86_400_000;
      if (diffDays < min) {
        min = diffDays;
      }
    }
  }
  return min;
}

/**
 * AC1's date-proximity score: `1 - minDayDiff/2`, clamped to [0,1]. A 0-day difference scores 1;
 * a 2+ day difference (or no date pair at all, `Infinity`) scores 0.
 */
export function computeDateProximityScore(minDayDiff: number): number {
  if (!Number.isFinite(minDayDiff)) return 0;
  return clamp01(1 - minDayDiff / 2);
}

export function classifyMatchTier(score: number): MatchTier {
  if (score >= MATCH_SCORE_THRESHOLDS.high) return 'high';
  if (score >= MATCH_SCORE_THRESHOLDS.mid) return 'mid';
  return 'low';
}

/**
 * A candidate admitted only through the shared-link path (no schedule inside the ±`windowDays`
 * date window -- e.g. the registration-deadline post of an event whose race day is weeks later)
 * must never auto-link: the same link and name can also belong to another edition of the event,
 * so a `high` tier is demoted to `mid` and goes to the moderator queue. `mid`/`low` and any
 * in-window candidate pass through unchanged. `Infinity` (no date pair) counts as outside.
 */
export function capTierWhenOutsideDateWindow(tier: MatchTier, minDayDiff: number, windowDays: number): MatchTier {
  return tier === 'high' && !(minDayDiff <= windowDays) ? 'mid' : tier;
}

// --- Mid -> high promotion (AD-30 Rule 7, amended 2026-10-25) -------------------------------------
// The score caps at about 0.65 (organizer 0.40 + date/name 0.25) whenever the venue (0.15) or the
// shared link (0.20) signal is missing -- usually because one side has no `location`. A pair that
// is plainly the same event (same account, same day, same name, no venue evidence against it) then
// sat in the moderator queue. These helpers decide when such a `mid` is promoted to `high`.
// Weights and thresholds are untouched; the promotion is a separate, stricter gate on top.

/** Trigram similarity at or above which two names count as "the same name" for promotion. */
export const MID_PROMOTION_NAME_SIMILARITY = 0.85;

/**
 * Largest day gap between the nearest schedules of two events for the promotion: 0, so the two must
 * share a start date. A pair a day or two apart is far more often the next instance of a recurring
 * event (a weekly show, a numbered league night, consecutive pop-up days) than a repost, and an
 * auto-link there is not undoable and prunes the schedule the new post omits. Such a pair stays
 * `mid` for a moderator (found on prod 2026-10-28: 22 of the 66 pairs the rule would have linked).
 */
export const MID_PROMOTION_MAX_DAY_DIFF = 0;

/**
 * Two known venues closer than this are one place for promotion purposes. Wide on purpose: it only
 * has to separate "same venue, different geocode" from "different city" (Bandung vs Surabaya).
 */
export const VENUE_COMPATIBLE_METERS = 5000;

// A bracketed group: "(Day 1)", "[SOLD OUT]", "{Jakarta}".
const BRACKETED_GROUP = /[([{][^)\]}]*[)\]}]/g;
const YEAR_TOKEN = /\b(?:19|20)\d{2}\b/g;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/**
 * Normalizes an event name for the promotion comparison: lowercase, bracketed groups and year
 * tokens removed, punctuation collapsed to single spaces. "Jazz Night 2026 (SOLD OUT)!" and
 * "jazz  night" normalize alike. Returns '' for a name with nothing left (only a year, symbols).
 */
export function normalizeEventNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(BRACKETED_GROUP, ' ')
    .replace(YEAR_TOKEN, ' ')
    .replace(NON_ALPHANUMERIC, ' ')
    .trim();
}

function digitTokens(normalizedName: string): string[] {
  return normalizedName.match(/\d+/g) ?? [];
}

/**
 * The bracketed qualifiers of a name, lowercased, punctuation and years dropped: "Open (Morning) [2026]"
 * gives {"morning"}. A group with nothing left (a bare year) is not a qualifier.
 */
function bracketedQualifiers(name: string): Set<string> {
  const groups = name.toLowerCase().match(BRACKETED_GROUP) ?? [];
  return new Set(groups.map((group) => group.replace(YEAR_TOKEN, ' ').replace(NON_ALPHANUMERIC, ' ').trim()).filter((q) => q !== ''));
}

/**
 * True when BOTH names carry bracketed qualifiers and neither set contains the other: "(Morning)" vs
 * "(Evening)", "(Men)" vs "(Women)", "(Jakarta)" vs "(Bandung)" are sessions, categories or editions of
 * a series, not one event. A qualifier on one side only ("(SOLD OUT)", "(GEF)") or one that the other
 * side repeats ("(GEF)" vs "(GEF) (Early Bird)") is still noise.
 */
function qualifiersContradict(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const aInB = [...a].every((q) => b.has(q));
  const bInA = [...b].every((q) => a.has(q));
  return !aInB && !bInA;
}

/**
 * Whether two names support auto-linking: the bracketed qualifiers do not contradict, the digit tokens
 * match, AND the normalized names are equal or the (SQL trigram) similarity is >= `MID_PROMOTION_NAME_SIMILARITY`.
 *
 * The digit rule applies on BOTH paths and reads the names with bracketed text KEPT (years still
 * dropped), because the normalizer used for equality deletes brackets: it is what keeps a daily series
 * apart ("32 Days of C&F Biggest Sale" vs "... - Day 12", "Part 1" vs "Part 2") and a race category
 * apart ("Erafone Run Series (10K)" vs "Erafone Run Series", "(5K)" vs "(10K)"), which trigram
 * similarity or bracket-stripping alone would call the same. Found by running the rule on prod.
 *
 * Digits are not the only thing a bracket can distinguish: the qualifier check keeps "(Morning)" and
 * "(Evening)" of one account and day apart too, which equality of the bracket-stripped names would
 * otherwise link whatever the trigram score (found in the 2026-10-27 review of this rule).
 */
export function areNamesAutoLinkable(newName: string, candidateName: string, nameSimilarity: number): boolean {
  const a = normalizeEventNameForMatch(newName);
  const b = normalizeEventNameForMatch(candidateName);
  if (a === '' || b === '') return false;
  if (qualifiersContradict(bracketedQualifiers(newName), bracketedQualifiers(candidateName))) return false;
  const digitsA = digitTokens(normalizeEventNameStrict(newName));
  const digitsB = digitTokens(normalizeEventNameStrict(candidateName));
  if (digitsA.length !== digitsB.length || !digitsA.every((token, i) => token === digitsB[i])) return false;
  if (a === b) return true;
  return nameSimilarity >= MID_PROMOTION_NAME_SIMILARITY;
}

function normalizeVenueText(location: string | null | undefined): string {
  return (location ?? '').toLowerCase().replace(NON_ALPHANUMERIC, ' ').trim();
}

// "tenth avenue" inside "tenth avenue bandung" is the same place; a 1-2 character string inside
// anything is not evidence of anything.
const MIN_CONTAINED_VENUE_LENGTH = 3;

function venueTextsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_CONTAINED_VENUE_LENGTH && longer.includes(shorter);
}

function hasCoordinates(v: MatchVenueLike): v is MatchVenueLike & { latitude: number; longitude: number } {
  return v.latitude != null && v.longitude != null;
}

/**
 * One schedule pair is compatible unless BOTH sides state a venue (text or coordinates) and the
 * statements disagree. Overlapping text or nearby coordinates make it compatible; so does a side
 * that states nothing, because absence of a venue is not evidence of a different one.
 */
function venuePairCompatible(a: MatchVenueLike, b: MatchVenueLike): boolean {
  const textA = normalizeVenueText(a.location);
  const textB = normalizeVenueText(b.location);
  const bothHaveText = textA !== '' && textB !== '';
  const bothHaveCoordinates = hasCoordinates(a) && hasCoordinates(b);
  if (!bothHaveText && !bothHaveCoordinates) return true;

  if (bothHaveText && venueTextsOverlap(textA, textB)) return true;
  // One place spelled two ways ("Ground Floor" / "Lantai GF", "Lap." / "Lapangan"): IDEA-110.
  if (bothHaveText && venueTextsSamePlace(a.location, b.location)) return true;
  if (
    bothHaveCoordinates &&
    haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude) <= VENUE_COMPATIBLE_METERS
  ) {
    return true;
  }
  return false;
}

function pairDayDifference(a: MatchScheduleLike, b: MatchScheduleLike): number {
  return minScheduleDayDifference([a], [b]);
}

/**
 * True when the two events state clearly different venues, e.g. a touring event ("Tenth Avenue
 * Bandung" vs "BG Junction Surabaya") that shares name, date and account. Only schedule pairs
 * inside the date window are compared (a tour has one venue per date); when no pair is inside the
 * window all pairs are. A pair with an unknown side never conflicts, and a single compatible pair
 * clears the whole comparison.
 */
export function hasVenueConflict(
  newVenues: Array<MatchVenueLike & MatchScheduleLike>,
  candidateVenues: Array<MatchVenueLike & MatchScheduleLike>,
  windowDays: number
): boolean {
  const pairs = newVenues.flatMap((a) => candidateVenues.map((b) => ({ a, b, dayDiff: pairDayDifference(a, b) })));
  if (pairs.length === 0) return false;
  const inWindow = pairs.filter((pair) => pair.dayDiff <= windowDays);
  const compared = inWindow.length > 0 ? inWindow : pairs;
  return compared.every((pair) => !venuePairCompatible(pair.a, pair.b));
}

// --- Stub repeat (AD-30 Rule 7, amended 2026-10-25) ------------------------------------------------
// A curator or roundup account that posts about one event again produces a stub event each time.
// The organizer weight is discounted for stubs (BUG-058), and such posts carry no links, so the pair
// scores at most 0.40 (date/name 0.25 + venue 0.15) -- `low`, never even queued. This predicate lets
// the same event, seen again as a stub, link on name + start date + venue alone. The posting account,
// organizer, links and score are NOT inputs.

/**
 * The strict name for the stub-repeat rule: lowercase, year tokens and punctuation removed, bracketed
 * text KEPT ("Open (Morning)" is not "Open (Evening)"). A sibling of `normalizeEventNameForMatch`,
 * which deletes brackets and stays for the mid-to-high promotion.
 */
export function normalizeEventNameStrict(name: string): string {
  return name.toLowerCase().replace(YEAR_TOKEN, ' ').replace(NON_ALPHANUMERIC, ' ').trim();
}

// A one-word name ("Christmas", "Bazaar") is too generic to link on name + date + venue alone.
const STUB_REPEAT_MIN_NAME_TOKENS = 2;

export interface StubRepeatSchedule extends MatchVenueLike {
  eventStartDate?: string | null;
  eventStartTime?: string | null;
}

export type StubRepeatReason =
  | 'match'
  | 'not-stub'
  | 'name-differs'
  | 'name-too-short'
  | 'no-same-date'
  | 'times-differ'
  | 'venue-differs'
  | 'venue-unknown-one-side'
  | 'venue-unknown-both';

export interface StubRepeatInput {
  newIsStub: boolean;
  candidateIsStub: boolean;
  newEventName: string;
  candidateEventName: string;
  newSchedules: StubRepeatSchedule[];
  candidateSchedules: StubRepeatSchedule[];
}

type PairVenueState = 'match' | 'differs' | 'unknown-one-side' | 'unknown-both';

function hasAnyVenueInfo(v: MatchVenueLike): boolean {
  return normalizeVenueText(v.location) !== '' || hasCoordinates(v);
}

// "match" is the score's venue signal (equal trimmed, lowercased text, or coordinates within 150 m)
// or the same place spelled two ways (`venueTextsSamePlace`, IDEA-110). "differs" needs both sides to
// state a comparable venue (text against text, or coordinates against coordinates) and disagree;
// anything else cannot be compared.
function pairVenueState(a: MatchVenueLike, b: MatchVenueLike): PairVenueState {
  if (hasVenueMatch([a], [b]) || venueTextsSamePlace(a.location, b.location)) return 'match';
  const bothHaveText = normalizeVenueText(a.location) !== '' && normalizeVenueText(b.location) !== '';
  if (bothHaveText || (hasCoordinates(a) && hasCoordinates(b))) return 'differs';
  return hasAnyVenueInfo(a) || hasAnyVenueInfo(b) ? 'unknown-one-side' : 'unknown-both';
}

function startTimesConflict(a: StubRepeatSchedule, b: StubRepeatSchedule): boolean {
  if (!a.eventStartTime || !b.eventStartTime) return false;
  return a.eventStartTime.slice(0, 5) !== b.eventStartTime.slice(0, 5);
}

// When no schedule pair qualifies, the most informative reason wins (a pair that matched on venue
// but not on time says more than one with no venue at all).
type StubRepeatNearMiss = 'times-differ' | 'venue-differs' | 'venue-unknown-one-side' | 'venue-unknown-both';

const STUB_REPEAT_REASON_RANK: Record<StubRepeatNearMiss, number> = {
  'times-differ': 4,
  'venue-differs': 3,
  'venue-unknown-one-side': 2,
  'venue-unknown-both': 1,
};

/**
 * Why a (new, candidate) pair is or is not a stub repeat. `'match'` means it is one. Every other value
 * names the first test that failed; the scan mode lists the venue/time/name-length ones as
 * "near-misses" (same strict name and start date, deliberately not merged).
 *
 * A repeat needs ALL of: both events are stubs; equal strict names of at least two words; a schedule
 * pair with the same `eventStartDate` on which the venue positively matches (two absent venues do
 * not) and, when both carry a start time, equal times. The same name and date at a different
 * venue are different events.
 */
export function evaluateStubRepeat(input: StubRepeatInput): StubRepeatReason {
  if (!input.newIsStub || !input.candidateIsStub) return 'not-stub';

  const newName = normalizeEventNameStrict(input.newEventName);
  const candidateName = normalizeEventNameStrict(input.candidateEventName);
  if (newName === '' || newName !== candidateName) return 'name-differs';
  if (newName.split(' ').length < STUB_REPEAT_MIN_NAME_TOKENS) return 'name-too-short';

  let reason: StubRepeatNearMiss | null = null;
  for (const a of input.newSchedules) {
    for (const b of input.candidateSchedules) {
      if (!a.eventStartDate || a.eventStartDate !== b.eventStartDate) continue;
      const venue = pairVenueState(a, b);
      let pairReason: StubRepeatNearMiss;
      if (venue === 'match') {
        if (!startTimesConflict(a, b)) return 'match';
        pairReason = 'times-differ';
      } else if (venue === 'differs') {
        pairReason = 'venue-differs';
      } else if (venue === 'unknown-one-side') {
        pairReason = 'venue-unknown-one-side';
      } else {
        pairReason = 'venue-unknown-both';
      }
      if (reason === null || STUB_REPEAT_REASON_RANK[pairReason] > STUB_REPEAT_REASON_RANK[reason]) reason = pairReason;
    }
  }
  return reason ?? 'no-same-date';
}

export function matchesStubRepeat(input: StubRepeatInput): boolean {
  return evaluateStubRepeat(input) === 'match';
}

export interface MatchDecisionInput {
  organizerMatch: boolean;
  sharedLink: boolean;
  /** 0..1, trigram similarity of the two event names. */
  nameSimilarity: number;
  /** See `minScheduleDayDifference` -- `Infinity` is a valid "no date pair" input. */
  minDayDiff: number;
  newEventName: string;
  candidateEventName: string;
  newVenues: Array<MatchVenueLike & MatchScheduleLike>;
  candidateVenues: Array<MatchVenueLike & MatchScheduleLike>;
  /** The candidate date window (`DATE_WINDOW_DAYS`); outside it a candidate is never promoted. */
  windowDays: number;
  /** Stub-repeat inputs (AD-30 Rule 7, 2026-10-25). Omitted means "not a stub": the rule is off. */
  newIsStub?: boolean;
  candidateIsStub?: boolean;
}

/** Which rule lifted a pair to `high`; `null` when none did (the score decided). */
export type PromotionRule = 'mid-to-high' | 'stub-repeat' | null;

export interface MatchDecision {
  score: number;
  /** The tier the unchanged weights and thresholds give, before promotion and the window cap. */
  scoredTier: MatchTier;
  /** The tier ingestion acts on. */
  tier: MatchTier;
  /** True when `tier` is `high` only because a promotion rule lifted a `low` or `mid`. */
  promotedByRule: boolean;
  /** Which rule did it; `null` when `promotedByRule` is false. */
  promotionRule: PromotionRule;
  /** True when the pair is a stub repeat, whether or not the score alone already reached `high`. The
   * link is then additive (never overwrites or deletes). */
  stubRepeat: boolean;
  venueMatch: boolean;
  venueConflict: boolean;
}

/**
 * The single tier decision for one (new item, candidate) pair, shared by ingestion
 * (`findMatchingEvent`) and the backlog drain script so they can never disagree.
 *
 * A stub repeat (`matchesStubRepeat`) is lifted to `high` whatever its score. Otherwise a `mid` is promoted to `high` only when ALL hold: the two events share a start date
 * (`MID_PROMOTION_MAX_DAY_DIFF`, which also keeps a shared-link-only candidate, admitted up to 90 days
 * away, out of the promotion); the
 * names are the same (`areNamesAutoLinkable`); no venue conflict; and the posting account matches
 * the candidate's (`organizerMatch`) OR a link is shared. Anything else keeps its scored tier, and
 * a `high` outside the window is still capped to `mid`.
 */
export function decideMatchTier(input: MatchDecisionInput): MatchDecision {
  const venueMatch = hasVenueMatch(input.newVenues, input.candidateVenues);
  const { score, tier: scoredTier } = computeMatchScore({
    organizerMatch: input.organizerMatch,
    sharedLink: input.sharedLink,
    nameSimilarity: input.nameSimilarity,
    minDayDiff: input.minDayDiff,
    venueMatch,
  });
  const venueConflict = hasVenueConflict(input.newVenues, input.candidateVenues, input.windowDays);

  // Two stubs of one event (same strict name, start date and venue): not score-based, so it lifts a
  // `low` as well as a `mid`. Its equal start date makes it in-window by construction, so the
  // window cap below never applies to it.
  const stubRepeat = matchesStubRepeat({
    newIsStub: input.newIsStub ?? false,
    candidateIsStub: input.candidateIsStub ?? false,
    newEventName: input.newEventName,
    candidateEventName: input.candidateEventName,
    newSchedules: input.newVenues,
    candidateSchedules: input.candidateVenues,
  });

  const midToHigh =
    scoredTier === 'mid' &&
    input.minDayDiff <= MID_PROMOTION_MAX_DAY_DIFF &&
    (input.organizerMatch || input.sharedLink) &&
    !venueConflict &&
    areNamesAutoLinkable(input.newEventName, input.candidateEventName, input.nameSimilarity);

  let promotionRule: PromotionRule = null;
  if (scoredTier !== 'high') {
    if (stubRepeat) promotionRule = 'stub-repeat';
    else if (midToHigh) promotionRule = 'mid-to-high';
  }

  const tier =
    promotionRule === 'stub-repeat'
      ? 'high'
      : capTierWhenOutsideDateWindow(promotionRule === 'mid-to-high' ? 'high' : scoredTier, input.minDayDiff, input.windowDays);
  return { score, scoredTier, tier, promotedByRule: promotionRule !== null, promotionRule, stubRepeat, venueMatch, venueConflict };
}

export interface MatchScoreInput {
  /** Resolved by the caller before calling in here -- see this file's header comment. */
  organizerMatch: boolean;
  sharedLink: boolean;
  /** 0..1, from the SQL `similarity()` call (`pg_trgm`) against `events.event_name`. */
  nameSimilarity: number;
  /** See `minScheduleDayDifference` -- `Infinity` is a valid "no date pair" input. */
  minDayDiff: number;
  venueMatch: boolean;
}

export interface MatchScoreResult {
  score: number;
  tier: MatchTier;
}

/**
 * AC1's composite scorer: a weighted sum of the four signals (organizer 0.40 / shared link 0.20
 * / date+name 0.25 / venue 0.15), classified into high/mid/low via `classifyMatchTier`. The
 * date+name component is itself an average of `nameSimilarity` and the date-proximity score
 * (`computeDateProximityScore`), per AC1's "dateNameSimilarity ... average of name_sim ... and a
 * date-proximity score".
 */
export function computeMatchScore(input: MatchScoreInput): MatchScoreResult {
  const dateProximity = computeDateProximityScore(input.minDayDiff);
  const dateNameSimilarity = (clamp01(input.nameSimilarity) + dateProximity) / 2;

  const score =
    (input.organizerMatch ? MATCH_SCORE_WEIGHTS.organizerMatch : 0) +
    (input.sharedLink ? MATCH_SCORE_WEIGHTS.sharedLink : 0) +
    dateNameSimilarity * MATCH_SCORE_WEIGHTS.dateNameSimilarity +
    (input.venueMatch ? MATCH_SCORE_WEIGHTS.venueMatch : 0);

  return { score, tier: classifyMatchTier(score) };
}
