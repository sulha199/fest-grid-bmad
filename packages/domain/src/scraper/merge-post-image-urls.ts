import { dedupeImageUrlsByFileName } from "../posts/image-url-file-name.js";

/**
 * The cover and the slide list of one scraped post (Story 10.2 AC5, the source fix for BUG-261102-4rm): the cover is the
 * first image, the slides are every OTHER image, and the slide list never repeats the cover, even when a vendor re-serves
 * the cover as the first slide under a different signed query (BUG-101: compared by file name, not by whole URL). Order is
 * kept; empty entries and repeats are dropped. With no cover, the first slide becomes the cover. Pure.
 */
export function buildPostImageUrls(
  cover: string | null | undefined,
  slides: readonly (string | null | undefined)[] | null | undefined
): { imageUrl: string | undefined; additionalImageUrls: string[] } {
  const [first, ...rest] = dedupeImageUrlsByFileName([cover, ...(slides ?? [])]);
  return { imageUrl: first, additionalImageUrls: rest };
}
