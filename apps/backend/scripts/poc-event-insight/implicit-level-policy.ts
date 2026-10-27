/**
 * POC (pure, no I/O): the LEVEL at which an area that was NOT stated in the post (the venue's area, see target-area-spec-2026-10-27.md section 4)
 * becomes a target area. The model never decides this: it cannot know the province or the venue type.
 *
 * Owner decisions (2026-10-27):
 *   - a mall, stadium, convention centre or university normally draws from its city or regency;
 *   - in a SMALL province (DIY and DKI Jakarta) those venues draw from the whole province, because the province is small and the venues sit in
 *     its centre;
 *   - Batam is a city (Kota Batam) inside the Kepulauan Riau province, not a small province: it keeps the default (city) level;
 *   - any other venue resolves to its city or regency;
 *   - a neighbourhood is NEVER produced here: it comes only from explicit wording in the post.
 */
import type { GazetteerIndex } from './area-resolver.js';

export type VenueClass = 'mall' | 'stadium' | 'convention_centre' | 'university' | 'other';

export const LARGE_VENUE_CLASSES: readonly VenueClass[] = ['mall', 'stadium', 'convention_centre', 'university'];

/** Provinces small enough that a large venue draws from all of them. Configuration, not logic: extend with the owner's agreement. */
export const SMALL_PROVINCE_KEYS: readonly string[] = ['id-yo', 'id-jk'];

/**
 * Maps the venue category stored on the pin (`LocationDetails.venueType`, a Geoapify category such as `commercial.shopping_mall`) or a venue
 * name to a class. A missing or unknown category is `other`, which keeps the default level.
 */
export function classifyVenueType(raw?: string | null): VenueClass {
  const t = (raw ?? '').toLowerCase();
  if (/shopping_mall|shopping_centre|shopping_center|\bmall\b|\bplaza\b/.test(t)) return 'mall';
  if (/stadium|stadion|\barena\b/.test(t)) return 'stadium';
  if (/convention|exhibition|conference|expo/.test(t)) return 'convention_centre';
  if (/universit|college|campus|kampus/.test(t)) return 'university';
  return 'other';
}

/**
 * The area key an implicit venue area resolves to. `venueAreaKey` is a gazetteer key at any level (a kecamatan, a regency, a province).
 *   large venue in a small province -> the province
 *   anything else                    -> the regency (city) it lies in; a venue known only to the province stays at the province
 */
export function implicitAreaKey(venueAreaKey: string, venueClass: VenueClass, ix: GazetteerIndex): string {
  const path = ix.pathOf(venueAreaKey);
  if (path.length === 0) return venueAreaKey;
  const lowest = (level: string): string | undefined => [...path].reverse().find((k) => ix.byKey.get(k)?.level === level);
  const province = lowest('province');
  const regency = lowest('regency');
  if (LARGE_VENUE_CLASSES.includes(venueClass) && province && SMALL_PROVINCE_KEYS.includes(province)) return province;
  return regency ?? province ?? venueAreaKey;
}
