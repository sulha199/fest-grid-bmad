import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { autoEnqueueNewPostForExtraction } from '../posts/auto-enqueue-new-post.js';
import { markPendingJobCompleted } from './apify-pending-jobs-store.js';
import { mapApifyItemToScrapedPost } from './instagram-adapter.js';
import type { ApifyPendingJob } from './apify-pending-jobs-store.js';

export async function processApifyAsyncResult(
  pendingJob: ApifyPendingJob,
  items: any[],
  scraperActorRunId?: string
): Promise<void> {
  // Map Apify items to ScrapedPost format and persist each
  for (const item of items) {
    try {
      const post = await mapApifyItemToScrapedPost(item);
      if (!post) {
        console.warn(`Skipped invalid Apify item: failed AJV schema validation`);
        continue;
      }

      const persistResult = await persistScrapedPost({
        accountId: pendingJob.profileId,
        platform: 'instagram', // Apify adapter only handles Instagram today
        postUrl: post.postUrl,
        imageUrl: post.imageUrl || null,
        videoUrl: post.videoUrl || null,
        originalPostUrl: post.originalPostUrl || null,
        content: post.content,
        publishedAt: post.publishedAt,
        scraperActorRunId,
        locationName: post.locationName || null,
        ownerDisplayName: post.ownerDisplayName || null,
        ownerUsername: post.ownerUsername || null,
        hashtags: post.hashtags || null,
        ownerId: post.ownerId,
        coauthors: post.coauthors,
        discoverySourceVendor: 'apify',
      });

      // Story 3.6z (AC1) -- auto-enqueue a genuinely new post for extraction. This async path
      // was missed when 3.6z wired only processScrapeJob, so posts persisted via the Apify
      // webhook (and the stale-job sweep, which reuses this function) were never extracted.
      // The helper never throws, so it cannot disturb this loop or markPendingJobCompleted.
      await autoEnqueueNewPostForExtraction(persistResult, 'processApifyAsyncResult');
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
