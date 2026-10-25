// AD-30 Rule 7 (amended 2026-10-25) -- the one definition of "unfilled" used by the additive link of a
// stub repeat, which may fill an empty field but never overwrite a filled one.

/** What `buildEventInsertValues` stores in the NOT NULL `events.location` when the post names none. */
export const LOCATION_NOT_SPECIFIED = 'Location not specified';

/**
 * True for `null`, `undefined`, a blank string, an empty array, or (when listed) a placeholder
 * string. `events.location` is NOT NULL and holds `LOCATION_NOT_SPECIFIED` when unknown, `types` and
 * `categories` default to `[]`, and a description can be `''` -- a bare null test would miss all three.
 */
export function isUnfilledValue(value: unknown, placeholders: readonly string[] = []): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || placeholders.includes(trimmed);
  }
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
