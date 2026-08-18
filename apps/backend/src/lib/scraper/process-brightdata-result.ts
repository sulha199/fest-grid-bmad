import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from './persist-scraped-post.js';
import { markPendingJobCompleted } from './brightdata-pending-jobs-store.js';
import type { BrightdataPendingJob } from './brightdata-pending-jobs-store.js';

export async function processBrightDataResult(
  pendingJob: BrightdataPendingJob,
  records: unknown[]
): Promise<void> {
  // Map Bright Data records to ScrapedPost format and persist each
  for (const record of records) {
    const brightDataRecord = record as Record<string, unknown>;
    
    // Map Bright Data field names to our post structure
    const postUrl = brightDataRecord.url as string;
    const imageUrl = brightDataRecord.image_url as string;
    const caption = brightDataRecord.caption as string;
    const datePosted = brightDataRecord.date_posted as string;
    
    if (!postUrl) {
      console.warn('Bright Data record missing URL, skipping');
      continue;
    }

    try {
      await persistScrapedPost({
        accountId: pendingJob.profileId,
        postUrl,
        imageUrl: imageUrl || null,
        content: caption || '',
        publishedAt: datePosted ? new Date(datePosted) : new Date(),
      });
    } catch (error) {
      console.error(`Failed to persist post from Bright Data: ${postUrl}`, error);
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
