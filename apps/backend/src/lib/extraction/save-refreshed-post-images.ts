import { and, eq, isNull } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { decideFreshImagesToSave } from '@festgrid/domain/posts';
import { parsePlatformPostIdentity, type ScrapedPost } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';

// Story 10.6 (AC4; design decision 6; AD-12 and AD-40 amended) -- the ONE writer of a moderator re-extract's fresh image links to
// `posts`, shared by the refresh phase of the engine job and the late-result handler of a Bright Data snapshot, so both apply the
// same rule: the cover link, the slide list and the cover's expiry (`decideFreshImagesToSave`, pure, in `packages/domain`); never
// the caption (a vendor's `content` is not read here), never an empty slide list over a non-empty one, never a 640 px image over a
// full-size one that is still valid. The post type is filled only when it is null: it is part of the event slug identity (AD-16
// Rule 2, insert-only), so a stored value is never replaced.

export interface SaveRefreshedPostImagesResult {
  /** The cover link, slide list or expiry of the post changed. */
  saved: boolean;
  /** A null post type was filled from the post URL. */
  postTypeFilled: boolean;
}

/**
 * Applies a vendor's answer for ONE stored post. Idempotent: the same answer applied twice writes once (the second read finds the
 * links already stored). The media columns are decided under a row lock so two writers (the job and a late result) cannot
 * interleave a read and a write.
 */
export async function saveRefreshedPostImages(input: {
  postId: string;
  scraped: Pick<ScrapedPost, 'imageUrl' | 'additionalImageUrls'>;
  now?: Date;
}): Promise<SaveRefreshedPostImagesResult> {
  const now = input.now ?? new Date();

  const saved = await db.transaction(async (tx) => {
    const [stored] = await tx
      .select({ imageUrl: posts.imageUrl, imageUrlExpiresAt: posts.imageUrlExpiresAt, additionalImageUrls: posts.additionalImageUrls })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .for('update');
    if (!stored) return false;
    const toSave = decideFreshImagesToSave({
      stored,
      fresh: { imageUrl: input.scraped.imageUrl, additionalImageUrls: input.scraped.additionalImageUrls },
      now,
    });
    if (!toSave) return false;
    await tx
      .update(posts)
      .set({
        ...(toSave.imageUrl !== undefined ? { imageUrl: toSave.imageUrl, imageUrlExpiresAt: toSave.imageUrlExpiresAt ?? null } : {}),
        ...(toSave.additionalImageUrls !== undefined ? { additionalImageUrls: toSave.additionalImageUrls } : {}),
        updatedAt: now,
      })
      .where(eq(posts.id, input.postId));
    return true;
  });

  return { saved, postTypeFilled: await fillMissingPostType(input.postId) };
}

/**
 * Fills a null `platform_post_type` (and a null `platform_post_id` with it) from the post's own URL. Never replaces a value, never
 * runs when the URL does not say both. A unique-index clash with another post (the AD-30 Rule 11 index covers the triple) is
 * logged and ignored: the refresh must not fail because a legacy row could not be healed.
 */
async function fillMissingPostType(postId: string): Promise<boolean> {
  const [row] = await db
    .select({ postUrl: posts.postUrl, originalPostUrl: posts.originalPostUrl, platformPostId: posts.platformPostId, platformPostType: posts.platformPostType })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!row || row.platformPostType !== null) return false;
  const derived = parsePlatformPostIdentity({ postUrl: row.postUrl, originalPostUrl: row.originalPostUrl });
  if (derived.platformPostId === null || derived.platformPostType === null) return false;
  if (row.platformPostId !== null && row.platformPostId !== derived.platformPostId) return false;
  try {
    const filled = await db
      .update(posts)
      .set({ platformPostId: derived.platformPostId, platformPostType: derived.platformPostType, updatedAt: new Date() })
      .where(and(eq(posts.id, postId), isNull(posts.platformPostType)))
      .returning({ id: posts.id });
    return filled.length > 0;
  } catch (error) {
    console.warn(`[saveRefreshedPostImages] could not fill the post type of post ${postId} (${error instanceof Error ? error.name : 'error'}); left null`);
    return false;
  }
}
