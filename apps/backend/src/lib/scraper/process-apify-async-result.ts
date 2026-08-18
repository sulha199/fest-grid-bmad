import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { markPendingJobCompleted } from './apify-pending-jobs-store.js';
import { mapApifyItemToScrapedPost } from './instagram-adapter.js';
import type { ApifyPendingJob } from './apify-pending-jobs-store.js';

export async function processApifyAsyncResult(
  pendingJob: ApifyPendingJob,
  items: any[]
): Promise<void> {
  // Map Apify items to ScrapedPost format and persist each
  for (const item of items) {
    try {
      const post = mapApifyItemToScrapedPost(item);
      if (!post) {
        console.warn(`Skipped invalid Apify item: failed AJV schema validation`);
        continue;
      }

      await persistScrapedPost({
        accountId: pendingJob.profileId,
        postUrl: post.postUrl,
        imageUrl: post.imageUrl || null,
        content: post.content,
        publishedAt: post.publishedAt,
      });
    } catch (error) {
      console.error(`Failed to persist post from Apify item: ${item?.postUrl || item?.url}`, error);
      // Continue processing other items
    }
  }

  // Stamp lastScrapedAt
  await db
    .update(socialMediaAccountProfiles)
    .set({ lastScrapedAt: new Date() })
    .where(eq(socialMediaAccountProfiles.id, pendingJob.profileId));

  // Mark job completed
  await markPendingJobCompleted(pendingJob.id);
}
