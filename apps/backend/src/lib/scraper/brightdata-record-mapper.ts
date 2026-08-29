import { persistUnprocessedPayload } from '../posts/persist-unprocessed-payload.js';
import { compileValidator } from '../../validation/validate.js';
import { scrapedPostSchema } from '../../validation/scraped-post.schema.js';
import type { ScrapedPost } from '@festgrid/domain';

const validateScrapedPost = compileValidator<ScrapedPost>(scrapedPostSchema);

/**
 * Maps a raw Bright Data record to a validated ScrapedPost candidate, or null if the
 * record should be skipped. On skip, persists an unprocessed-payload audit row (except
 * for a missing postUrl, which has never had a URL to key the audit row on) so a
 * moderator can inspect why a record was dropped -- this applies uniformly whether the
 * record came from live processing or a replay.
 */
export async function mapBrightDataRecordToScrapedPost(
  record: unknown,
  scraperActorRunId?: string
): Promise<ScrapedPost | null> {
  const brightDataRecord = record as Record<string, unknown>;

  // Map Bright Data field names to our post structure
  const postUrl = brightDataRecord.url as string;
  const imageUrl = brightDataRecord.image_url as string;
  const caption = brightDataRecord.caption as string;
  const datePosted = brightDataRecord.date_posted;
  const videos = brightDataRecord.videos as unknown[] | null | undefined;
  const videoUrl = Array.isArray(videos) && videos.length > 0 && typeof videos[0] === 'string' ? videos[0] : undefined;

  if (datePosted !== undefined && datePosted !== null && typeof datePosted !== 'string') {
    console.warn('Bright Data record date_posted is not a string, skipping');
    try {
      await persistUnprocessedPayload({
        rawPayload: brightDataRecord,
        validationError: { message: 'date_posted is not a string or null/undefined', receivedType: typeof datePosted },
        context: {
          source: 'brightdata',
          scraperVendor: null,
          accountId: null,
          postUrl,
          timestamp: new Date().toISOString(),
          parserVersion: '3.4g',
        },
        scraperActorRunId,
      });
    } catch (err) {
      console.error('Failed to persist unprocessed Bright Data payload:', err);
    }
    return null;
  }

  if (!postUrl) {
    console.warn('Bright Data record missing URL, skipping');
    return null;
  }

  // Build candidate ScrapedPost object, omitting optional fields if falsy
  const publishedAtStr = datePosted ? new Date(datePosted).toISOString() : new Date().toISOString();
  const candidate: ScrapedPost = {
    content: caption || '',
    postUrl,
    publishedAt: publishedAtStr,
    // Only include optional fields if they have values
    ...(imageUrl && { imageUrl }),
    ...(videoUrl && { videoUrl }),
    // Always set: postUrl is guaranteed non-empty by the earlier guard above
    originalPostUrl: postUrl,
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
        scraperActorRunId,
      });
    } catch (err) {
      console.error('Failed to persist unprocessed Bright Data payload:', err);
    }
    return null;
  }

  return candidate;
}