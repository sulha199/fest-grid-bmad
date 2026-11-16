/**
 * BUG-101: a scraper vendor's signed image URL carries a query string (signature, cache key,
 * expiry) that differs between two requests for the exact same underlying image file -- Apify's
 * carousel `childPosts[0]` is the cover re-served under a different signed query. Comparing
 * whole URLs never catches that repeat; comparing the last path segment (the file name, with its
 * query string stripped) does, while two genuinely different images that merely share a host or
 * path prefix keep their own distinct file names and are never merged.
 *
 * Pure string/URL logic only -- zero DB/Node-runtime-only/React dependencies, same
 * frontend-safety precedent as `parseImageUrlExpiry`.
 */

/**
 * Extracts the file name (the last `/`-separated path segment, query string stripped) from an
 * image URL. Returns `null` when `url` is missing, unparseable, or has no path segment to use
 * (e.g. a bare origin) -- callers should then fall back to comparing the full URL.
 */
export function getImageUrlFileName(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * De-duplicates a list of image URLs by file name (see `getImageUrlFileName`), keeping the
 * first occurrence of each file name and preserving overall order. Falsy entries are dropped. A
 * URL whose file name can't be determined is compared by its own full value instead, so two
 * unrelated unparseable URLs are never collapsed into one just because neither has a readable
 * file name.
 */
export function dedupeImageUrlsByFileName(urls: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const key = getImageUrlFileName(url) ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result;
}
