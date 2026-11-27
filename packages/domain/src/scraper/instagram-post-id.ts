const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MAX_MEDIA_ID = 2n ** 64n;

/**
 * The numeric media id of an Instagram post, from its URL shortcode (`/p/Cx9uWttkSN/`).
 *
 * The shortcode is the id written in base 64 with the alphabet `A-Za-z0-9-_` (verified on 400 real
 * shortcode and id pairs, 2026-10-31). Ids exceed 2^53, so the result is a `BigInt`: a `number` would
 * silently lose its low digits. Returns `null` for anything that is not a shortcode (empty, a character
 * outside the alphabet, or a value that does not fit in 64 bits) so a bad stored value never reaches a
 * vendor request.
 */
export function instagramShortcodeToMediaId(shortcode: string | null | undefined): bigint | null {
  if (!shortcode) {
    return null;
  }
  let id = 0n;
  for (const char of shortcode) {
    const digit = SHORTCODE_ALPHABET.indexOf(char);
    if (digit < 0) {
      return null;
    }
    id = id * 64n + BigInt(digit);
    if (id >= MAX_MEDIA_ID) {
      return null;
    }
  }
  return id;
}

/**
 * How many ids one request excludes at most. A profile asked from yesterday holds a handful of posts
 * in the window, so the cap is never reached in practice; it only bounds the request size for an
 * unusual account. The list is built newest first, so the cap keeps the posts most likely to come back.
 */
export const BRIGHT_DATA_MAX_EXCLUDED_POSTS = 200;

/**
 * The `posts_to_not_include` list for a Bright Data request (Instagram Posts dataset, discover by URL).
 *
 * Bright Data honours only NUMERIC post ids (a shortcode is ignored, live test 2026-10-31) and counts
 * `num_of_posts` after the exclusion. Ids are sent as decimal strings, never as JSON numbers, which a
 * JavaScript `JSON.stringify` cannot write above 2^53 without losing precision. Verified live
 * 2026-11-26: decimal strings are honoured (the excluded post is not returned), JSON number ids are
 * ignored. This one function is the only place that decides the wire shape.
 *
 * Input shortcodes are given newest first. Invalid shortcodes and repeats are dropped.
 */
export function buildBrightDataPostsToNotInclude(
  shortcodesNewestFirst: ReadonlyArray<string | null | undefined>,
  max: number = BRIGHT_DATA_MAX_EXCLUDED_POSTS
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const shortcode of shortcodesNewestFirst) {
    const id = instagramShortcodeToMediaId(shortcode);
    if (id === null) {
      continue;
    }
    const text = id.toString();
    if (seen.has(text)) {
      continue;
    }
    seen.add(text);
    ids.push(text);
    if (ids.length >= max) {
      break;
    }
  }
  return ids;
}
