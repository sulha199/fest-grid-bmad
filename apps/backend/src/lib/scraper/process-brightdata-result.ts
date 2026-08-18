import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { persistUnprocessedPayload } from '../posts/persist-unprocessed-payload.js';
import { markPendingJobCompleted } from './brightdata-pending-jobs-store.js';
import type { BrightdataPendingJob } from './brightdata-pending-jobs-store.js';
import { compileValidator } from '../../validation/validate.js';
import { scrapedPostSchema } from '../../validation/scraped-post.schema.js';
import type { ScrapedPost } from '@festgrid/domain';

// Compile validator once at module scope to avoid recompilation per record
const validateScrapedPost = compileValidator<ScrapedPost>(scrapedPostSchema);

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
      // Build candidate ScrapedPost object, omitting optional fields if falsy
      const publishedAtStr = datePosted ? new Date(datePosted).toISOString() : new Date().toISOString();
      const candidate: ScrapedPost = {
        content: caption || '',
        postUrl,
        publishedAt: publishedAtStr,
        // Only include optional fields if they have values
        ...(imageUrl && { imageUrl }),
      };

      // Validate against schema
      const isValid = validateScrapedPost(candidate);
      if (!isValid) {
        console.warn(`Bright Data record failed AJV schema validation:`, validateScrapedPost.errors);
        // Capture unprocessed payload before skipping
        try {
          await persistUnprocessedPayload({
            rawPayload: candidate,
            validationError: validateScrapedPost.errors,
            context: {
              source: 'brightdata',
              scraperVendor: null,
              accountId: null,
              postUrl,
              timestamp: new Date().toISOString(),
              parserVersion: '3.4g',
            },
          });
        } catch (err) {
          console.error('Failed to persist unprocessed Bright Data payload:', err);
        }
        continue;
      }

      await persistScrapedPost({
        accountId: pendingJob.profileId,
        postUrl: candidate.postUrl,
        imageUrl: candidate.imageUrl || null,
        content: candidate.content,
        publishedAt: candidate.publishedAt,
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
