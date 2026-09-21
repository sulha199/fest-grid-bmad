import { Coordinates } from '@festgrid/shared-types';

/**
 * Client-side mirror of the spherical-law-of-cosines expression used server-side
 * by `withinRadius` (`packages/graphql-select/drizzle-where.ts`):
 * `6371 * acos(clamp(cos(rad(lat1))*cos(rad(lat2))*cos(rad(lng2-lng1)) + sin(rad(lat1))*sin(rad(lat2)), -1, 1))`.
 *
 * Story 1.i1f review finding 10 — this is the **spherical law of cosines**, not
 * the haversine formula: haversine uses `asin(sqrt(...))` on half-angle deltas,
 * and the two are not interchangeable (haversine is numerically better
 * conditioned for very short distances, whereas this formula is the one the
 * server's SQL already uses). The previous comment's "spherical-law-of-cosines
 * haversine" phrasing was inherited from the AC's own imprecise wording and
 * mislabeled the shipped algorithm.
 *
 * Must stay byte-for-byte equivalent to the SQL formula above so client-displayed
 * "N km away" text can never silently disagree with the server's own radius-filter
 * definition of distance — see the cross-reference comment at that SQL case.
 */
export function computeDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const lngDelta = toRadians(b.longitude - a.longitude);

  const cosValue =
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lngDelta) + Math.sin(lat1) * Math.sin(lat2);
  const clamped = Math.min(1, Math.max(-1, cosValue));

  return 6371 * Math.acos(clamped);
}
