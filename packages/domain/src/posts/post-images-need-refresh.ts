import { parseImageUrlExpiry } from '../scraper/parse-image-url-expiry.js';

/**
 * AD-40 amendment (BUG-097) -- a stored post's image URLs are hotlinks that expire (Instagram's
 * `oe` hex-timestamp parameter, mirrored for the cover in `posts.image_url_expires_at`). Decides
 * whether the moderator re-extract must rescrape to get fresh ones before it builds the Gemini
 * request: a request built from expired links reads no slide, and for an expired cover reads
 * nothing at all.
 *
 * The cover's own `oe` parameter is read first; `posts.image_url_expires_at` is only a fallback for a
 * cover URL that carries none (the column is written once, so it can outlive a replaced URL).
 * A URL with no readable expiry is trusted: the platform gave no signal to act on. A post with no
 * cover and no slides is a text-only post, which has nothing to refresh (rescraping it would spend
 * scraper credit for nothing).
 */

/** A link expiring within this window is treated as already expired: the job runs a moment later. */
export const IMAGE_URL_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export interface StoredPostImages {
  imageUrl?: string | null;
  imageUrlExpiresAt?: Date | null;
  additionalImageUrls?: readonly string[] | null;
}

function isExpired(expiresAt: Date | null, nowMs: number): boolean {
  return expiresAt !== null && expiresAt.getTime() <= nowMs + IMAGE_URL_EXPIRY_MARGIN_MS;
}

/** True when this one image link has expired (or expires within the safety margin); false when it carries no readable expiry. */
export function isImageUrlExpired(url: string | null | undefined, now: Date): boolean {
  return isExpired(parseImageUrlExpiry(url), now.getTime());
}

/** True when the cover or any stored slide link has expired, or slides are listed with no cover. */
export function postImagesNeedRefresh(post: StoredPostImages, now: Date): boolean {
  if (!post.imageUrl) return (post.additionalImageUrls?.length ?? 0) > 0;
  const nowMs = now.getTime();
  if (isExpired(parseImageUrlExpiry(post.imageUrl) ?? post.imageUrlExpiresAt ?? null, nowMs)) return true;
  return (post.additionalImageUrls ?? []).some((url) => isExpired(parseImageUrlExpiry(url), nowMs));
}
