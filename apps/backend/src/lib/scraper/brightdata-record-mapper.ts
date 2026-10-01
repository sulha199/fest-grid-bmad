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
  // (field names confirmed against Bright Data's Instagram Posts dataset schema --
  // `description` is the caption field and `photos`/`videos` are URL arrays; there is
  // no `caption`/`image_url` field, which is why every record was mapping to an empty
  // `content` and getting rejected by AJV validation before this fix)
  const postUrl = brightDataRecord.url as string;
  const photos = brightDataRecord.photos as unknown[] | null | undefined;
  const imageUrl = Array.isArray(photos) && photos.length > 0 && typeof photos[0] === 'string' ? photos[0] : undefined;
  // FIND-024: Bright Data has no Apify childPosts-equivalent nested structure for carousel
  // slides. Instead, a `content_type: "Carousel"` record simply lists every slide's URL in
  // the same top-level `photos` array `imageUrl` already reads photos[0] from (confirmed
  // against real runs, 2026-09-18: counts of 2, 4, 5, 6, 9, 11, 18 photos observed across
  // carousel records). Every slide beyond the cover goes into additionalImageUrls, mirroring
  // Story 3.3e's Apify field of the same name/shape.
  const additionalImageUrls = Array.isArray(photos)
    ? photos.slice(1).filter((url): url is string => typeof url === 'string')
    : [];
  const caption = brightDataRecord.description as string;
  const datePosted = brightDataRecord.date_posted;
  const videos = brightDataRecord.videos as unknown[] | null | undefined;
  const videoUrl = Array.isArray(videos) && videos.length > 0 && typeof videos[0] === 'string' ? videos[0] : undefined;
  const hashtags = brightDataRecord.hashtags as unknown[] | null | undefined;

  // Extract location details and owner metadata (FIND-024: locationName/ownerUsername now have
  // confirming evidence from real Bright Data runs, 2026-09-17 onwards)
  const locationDetails = brightDataRecord.location_details as Record<string, unknown> | null | undefined;
  const locationName = locationDetails && typeof locationDetails.name === 'string' ? locationDetails.name : undefined;
  const ownerUsername = typeof brightDataRecord.user_posted === 'string' ? brightDataRecord.user_posted : undefined;

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
    // BUG-032/FIND-024 fix: Bright Data's raw record includes hashtags WITH a leading '#'
    // (confirmed against a real record, 2026-09-17 -- e.g. "#frcc2026"), unlike Apify's
    // already-bare tags -- strip it here so both scrape paths store the identical bare-tag
    // convention the keyword-search handler already assumes (buildEventsQueryCondition.ts
    // strips a user-typed leading '#' before matching against this column). Lowercased for
    // the same case-insensitive exact-match reason as the Apify mapper (instagram-adapter.ts).
    ...(Array.isArray(hashtags) && hashtags.length > 0 && {
      hashtags: hashtags.map((tag) => String(tag).replace(/^#/, '').toLowerCase()),
    }),
    // FIND-024: Extract locationName and ownerUsername when available. Mirror Apify's
    // conditional-spread pattern (instagram-adapter.ts:251-253). locationName sourced from
    // location_details.name when present and populated (may be absent on some posts, or
    // location_details may exist but have only profile_pic_url set -- confirmed via real
    // jogjacoffeeweek run, 2026-09-17). ownerUsername sourced from top-level user_posted field.
    // ownerDisplayName intentionally omitted -- no confirmed source field in Bright Data schema yet.
    ...(locationName && { locationName }),
    ...(ownerUsername && { ownerUsername }),
    // FIND-024: remaining `photos` entries beyond the cover, when present (see comment above).
    ...(additionalImageUrls.length > 0 && { additionalImageUrls }),
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