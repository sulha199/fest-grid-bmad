import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { autoEnqueueNewPostForExtraction } from '../posts/auto-enqueue-new-post.js';
import { markPendingJobCompleted } from './brightdata-pending-jobs-store.js';
import type { BrightdataPendingJob } from './brightdata-pending-jobs-store.js';
import { mapBrightDataRecordToScrapedPost } from './brightdata-record-mapper.js';

export async function processBrightDataResult(
  pendingJob: BrightdataPendingJob,
  records: unknown[],
  scraperActorRunId?: string
): Promise<void> {
  // Map Bright Data records to ScrapedPost format and persist each
  for (const record of records) {
    const candidate = await mapBrightDataRecordToScrapedPost(record, scraperActorRunId);
    if (!candidate) continue;

    try {
      const persistResult = await persistScrapedPost({
        accountId: pendingJob.profileId,
        platform: 'instagram', // Bright Data adapter only handles Instagram today
        postUrl: candidate.postUrl,
        imageUrl: candidate.imageUrl || null,
        videoUrl: candidate.videoUrl || null,
        originalPostUrl: candidate.originalPostUrl || null,
        content: candidate.content,
        publishedAt: candidate.publishedAt,
        scraperActorRunId,
        locationName: candidate.locationName || null,
        ownerDisplayName: candidate.ownerDisplayName || null,
        ownerUsername: candidate.ownerUsername || null,
        hashtags: candidate.hashtags || null,
        additionalImageUrls: candidate.additionalImageUrls || null,
      });

      // Story 3.6z (AC1) -- auto-enqueue a genuinely new post for extraction. This async path
      // was missed when 3.6z wired only processScrapeJob, so posts persisted via the Bright Data
      // webhook (and the stale-job sweep, which reuses this function) were never extracted.
      // The helper never throws, so it cannot disturb this loop or markPendingJobCompleted.
      await autoEnqueueNewPostForExtraction(persistResult, 'processBrightDataResult');
    } catch (error) {
      console.error(`Failed to persist post from Bright Data: ${candidate.postUrl}`, error);
      // Continue processing other records
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
