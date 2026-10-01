/**
 * Content-versioned S3 key helpers for re-hosted post media (AD-28 Rule 9).
 *
 * Keys are versioned by a short content hash so that a changed or re-blurred
 * image gets a brand-new key/URL rather than overwriting an existing object
 * in place — this is what makes a 7-day `immutable` Cache-Control safe at a
 * much shorter TTL than the old fixed, write-once key scheme used.
 *
 * Pure string/regex logic only — zero DB/Node-runtime-only/React
 * dependencies, matching `parseImageUrlExpiry`'s existing frontend-safety
 * precedent (`packages/domain/src/scraper/parse-image-url-expiry.ts`) even
 * though every current caller is backend-only.
 */

export type PostMediaVariant = 'full' | 'thumb';

/**
 * Builds the content-versioned S3 key for a re-hosted post media object.
 *
 * Format: `posts/{postId}/{variant}-{hash8}.{ext}`. Thumbnails (Story 3.6n,
 * not yet built) are always re-encoded JPEG regardless of the `ext` input
 * (AD-28 Rule 5), so this helper forces `.jpg` for the `thumb` variant.
 *
 * @param postId The post the media belongs to.
 * @param variant `'full'` for the re-hosted original, `'thumb'` for Story 3.6n's future thumbnail.
 * @param hash8 The first 8 lowercase hex characters of the SHA-256 hash of the exact uploaded bytes.
 * @param ext The file extension to use for the `full` variant (ignored for `thumb`).
 */
export function buildPostMediaKey(
  postId: string,
  variant: PostMediaVariant,
  hash8: string,
  ext: string
): string {
  if (!/^[0-9a-f]{8}$/.test(hash8)) {
    throw new Error(`buildPostMediaKey: hash8 must be exactly 8 lowercase hex characters, got "${hash8}"`);
  }
  const resolvedExt = variant === 'thumb' ? 'jpg' : ext; // thumbnails are always re-encoded JPEG (Story 3.6n, AD-28 Rule 5)
  return `posts/${postId}/${variant}-${hash8}.${resolvedExt}`;
}

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Resolves a file extension from an upload's content type. Any unmapped or
 * missing content type defaults to `'jpg'`.
 */
export function resolvePostMediaExtension(contentType: string | undefined | null): string {
  return (contentType && CONTENT_TYPE_TO_EXT[contentType.toLowerCase()]) || 'jpg';
}

const VERSIONED_KEY_PATTERN = /^posts\/[^/]+\/(full|thumb)-[0-9a-f]{8}\.\w+$/;

/**
 * Returns true if `key` already matches the content-versioned key format
 * (`posts/{postId}/{variant}-{hash8}.{ext}`), as opposed to the legacy flat
 * `posts/{postId}` key with no extension or versioning.
 */
export function isVersionedPostMediaKey(key: string): boolean {
  return VERSIONED_KEY_PATTERN.test(key);
}

/**
 * Extracts the S3 key from a post-media CloudFront URL built against
 * `cdnDomain`. Returns `null` if `url` is missing or does not start with the
 * expected `https://{cdnDomain}/` prefix.
 */
export function extractPostMediaKeyFromUrl(cdnDomain: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `https://${cdnDomain}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}
