import { Coordinates, LocationDetails } from '@festgrid/shared-types';
import { computeDistanceKm } from './computeDistanceKm.js';

/**
 * Geoapify's documented `rank.match_type` values, ordered from most-specific to
 * least-specific. A higher-priority (lower-index) tier reflects a more specific,
 * more trustworthy match. Values come from Geoapify's forward-geocoding docs.
 * Any `matchType` not present in this list (including `undefined`) is treated as
 * one tier past the last real tier (i.e. `PRIORITY.length`), so it is never
 * preferred over a recognized value but is still strictly ordered between peers.
 */
const MATCH_TYPE_PRIORITY: readonly string[] = [
  'full_match',
  'match_by_building',
  'match_by_street',
  'match_by_postcode',
  'match_by_city_or_district',
  'match_by_country_or_state',
  'inner_part',
];

/**
 * Returns the priority tier index for a matchType value. Lower is more specific
 * (higher priority). Unrecognized or missing values rank below every recognized
 * value — `PRIORITY.length` (one past the last real tier), **not** a special
 * match/no-match boolean, so an unrecognized value never accidentally ties with
 * `inner_part` in the comparator.
 */
function matchTypeTier(matchType: string | undefined): number {
  if (matchType === undefined) {
    return MATCH_TYPE_PRIORITY.length;
  }
  const index = MATCH_TYPE_PRIORITY.indexOf(matchType);
  return index === -1 ? MATCH_TYPE_PRIORITY.length : index;
}

/**
 * A candidate farther than this from the account's own default location is implausible unless the geocoder is confident about
 * it (see `HIGH_CONFIDENCE_ANYWHERE`): most posts are about places near their account, and Geoapify's `confidence` is 0 for
 * many correct local places and for wrong far ones alike, so it cannot be used as an absolute gate (on prod, 939 `full_match`
 * results score under 0.1, among them venues in New York, Denmark and Australia for Yogyakarta posts).
 */
export const PLAUSIBLE_RADIUS_KM = 300;
/**
 * A candidate at or above this confidence is kept wherever it is (an event genuinely in another city). Set at 0.9, not 0.5: a
 * generic name scores 0.5 for a wrong country ("Pasar" in India for "Pasar Porosjayan"), while real exact matches score 0.9 and up
 * (Marina Bay Sands, Lippo Plaza Jogja: 1.0).
 */
export const HIGH_CONFIDENCE_ANYWHERE = 0.9;

/**
 * Keeps the candidates that are plausible for an account located at `near`: within `PLAUSIBLE_RADIUS_KM`, or confident enough to
 * trust anywhere. Order is preserved. An empty result means every candidate is a far, low-confidence guess, which the caller
 * treats as "not found" rather than pinning the event on the wrong side of the world. Without `near` nothing is filtered.
 */
export function filterPlausibleCandidates(candidates: LocationDetails[], near: Coordinates | undefined): LocationDetails[] {
  if (!near) {
    return candidates;
  }
  return candidates.filter(
    (candidate) =>
      (candidate.confidence ?? -Infinity) >= HIGH_CONFIDENCE_ANYWHERE ||
      computeDistanceKm(near, candidate.coordinates) <= PLAUSIBLE_RADIUS_KM
  );
}

/**
 * Selects the "best" candidate from a Geoapify geocode results array (top 5, in
 * Geoapify's returned order). Selection is primarily by descending `confidence`
 * (a candidate whose `confidence` is `undefined` is treated as strictly lower
 * than any candidate that has a defined value, via `?? -Infinity`). An exact
 * `confidence` tie is broken by `matchType` specificity (see `MATCH_TYPE_PRIORITY`);
 * if still tied, the earliest candidate in the input array wins (deterministic
 * and stable). Implemented as a single best-so-far sweep rather than a full sort
 * so the position tie-break is explicit and does not depend on `Array.prototype.sort`
 * stability semantics.
 *
 * @throws {Error} if `candidates` is empty — `geocodeAddress` never returns an
 *   empty array successfully today (it throws `GeolocationNotFoundError` first),
 *   but a silent `undefined` return would mask that invariant being broken.
 */
export function selectBestCandidate(candidates: LocationDetails[]): LocationDetails {
  if (candidates.length === 0) {
    throw new Error('selectBestCandidate: candidates array must not be empty');
  }

  let best = candidates[0];
  let bestConfidence = candidates[0].confidence ?? -Infinity;
  let bestTier = matchTypeTier(candidates[0].matchType);

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    const confidence = candidate.confidence ?? -Infinity;
    const tier = matchTypeTier(candidate.matchType);

    if (confidence > bestConfidence) {
      best = candidate;
      bestConfidence = confidence;
      bestTier = tier;
    } else if (confidence === bestConfidence && tier < bestTier) {
      best = candidate;
      bestConfidence = confidence;
      bestTier = tier;
    }
    // Any remaining tie (equal confidence and equal-or-worse matchType tier) keeps
    // the earlier candidate — the position tie-break is implicit in the sweep.
  }

  return best;
}
