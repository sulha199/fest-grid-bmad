// Story 3.6v (AD-30 Rule 7) -- pure, dependency-free event-matching scorer. Every input here is
// an already-fetched plain value (a boolean, a number, a string, or a plain array of them) --
// no DB/ORM type, no Node-runtime dependency. The DB-coupled caller
// (apps/backend/src/lib/events/match-event-to-existing.ts) is responsible for fetching the
// candidate row(s) and resolving the organizer-match boolean before calling in here; this file
// never queries anything itself.

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
