import { normalizeCountryCode } from '../events/normalize-location-keywords.js';

/** Where a country hint came from: the string's own code (trusted), the platform default (a guess), or nothing. */
export type CountryHintSource = 'string' | 'platform' | 'none';

export interface CountryHint {
  /** ISO 3166-1 alpha-2, upper-case; absent when `source` is `none`. */
  code?: string;
  source: CountryHintSource;
}

/**
 * The country to search a location text in, in order of trust:
 *  1. the text's own code (the model's code for it, or the code most of the post's other texts agree on) -> `string`
 *  2. the platform default (`DEFAULT_COUNTRY_CODE`) -> `platform`
 *  3. nothing -> `none` (an unfiltered search)
 * Nothing here names a country: the platform default is configuration. The account's own location and its past events are never
 * a source (the default location is wrong for many accounts; history is a separate, deferred idea).
 */
export function resolveCountryHint(input: { stringCountryCode?: string | null; platformDefault?: string | null }): CountryHint {
  const stringCode = normalizeCountryCode(input.stringCountryCode);
  if (stringCode) return { code: stringCode, source: 'string' };
  const platformCode = normalizeCountryCode(input.platformDefault);
  if (platformCode) return { code: platformCode, source: 'platform' };
  return { source: 'none' };
}
