/**
 * Minimum `confidence` required for a resolved location to be treated as
 * trustworthy enough to surface the raw coordinate pin to a user. Sourced from
 * the recorded design note against IDEA-023/BUG-027 ("Suggested starting bar:
 * confidence >= 0.5 AND match_type === 'full_match'"), tuned from real data
 * once shipped rather than fixed in advance.
 */
export const MIN_TRUSTWORTHY_CONFIDENCE = 0.5;

/**
 * The only Geoapify `match_type` value treated as trustworthy for the
 * coordinate-pin gate. `full_match` is the most specific documented value.
 */
export const TRUSTWORTHY_MATCH_TYPE = 'full_match';

/**
 * The minimal shape `isLocationTrustworthy` reads off a resolved location.
 *
 * Deliberately defined as a local structural type rather than reusing
 * `@festgrid/shared-types`'s `LocationDetails`: the GraphQL-codegen-generated
 * type this function is actually called with (e.g. `GetEventBySlugQuery`'s
 * nested `locationDetails`) types nullable fields as `T | null` (key always
 * present), not `T | undefined` (key optional) the way `LocationDetails` does.
 * This local type accepts both, so the predicate is callable from either.
 */
export interface LocationConfidenceSignal {
  confidence?: number | null;
  matchType?: string | null;
}

/**
 * Returns `true` only when a resolved location carries a confidence signal that
 * is both present (not `null`/`undefined`) and at/above `MIN_TRUSTWORTHY_CONFIDENCE`,
 * and a `matchType` exactly equal to `TRUSTWORTHY_MATCH_TYPE` (AND, not OR).
 *
 * Absence of either signal (pre-epic-0.i7 data, or any cached row not yet
 * re-resolved) is treated as untrusted, per the graceful-degradation posture
 * already documented on `LocationDetails.confidence` (Architecture Spine
 * AD-14 Rule 2).
 */
export function isLocationTrustworthy(details: LocationConfidenceSignal): boolean {
  return (
    details.confidence != null &&
    details.confidence >= MIN_TRUSTWORTHY_CONFIDENCE &&
    details.matchType === TRUSTWORTHY_MATCH_TYPE
  );
}
