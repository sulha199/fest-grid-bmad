import { eq } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { buildPostImageUrls } from '@festgrid/domain';
import { parseReextractPostInput, type JobLateResultHandler } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { isStoredPostAccountScrapable } from '../scraper/post-scrape-gate.js';
import { saveRefreshedPostImages } from './save-refreshed-post-images.js';

// Story 10.6 (AC7; PRD FR119; AD-53 Rules 16 and 17) -- the moderator re-extract's handler for a Bright Data snapshot that finished
// after the refresh budget ran out (registered only in the Scraper Lambda, beside the job handler's registration). It saves the fresh
// links to `posts` through the SAME writer and rule as the refresh phase, so a late 640 px answer can never replace full-size links
// that are still valid. It answers `NO_CHANGE`: the preview already continued on the stored images and the job has ended (or expired)
// with its own result, which must not be replaced by a result-less success. Idempotent (the writer decides from what is stored).
// The records carry the caption; it is not read here and nothing of the record is logged. A URL re-extract (no stored post) has nothing to heal.
export const reextractLateResultHandler: JobLateResultHandler = async ({ jobId, input, records }) => {
  const parsed = parseReextractPostInput(input);
  if (!parsed || !('postId' in parsed)) {
    // A URL that is not stored has no post to save links to (and a bad input has none either): nothing to heal.
    return { outcome: 'NO_CHANGE' };
  }
  // AD-34 Rule 7: hours may have passed since the refresh was gated, and the account may have been reclassified in the meantime.
  const [post] = await db.select({ accountId: posts.accountId }).from(posts).where(eq(posts.id, parsed.postId)).limit(1);
  if (!post) {
    console.warn(`[reextract-late-result] job ${jobId}: the post is gone; the late result was ignored`);
    return { outcome: 'NO_CHANGE' };
  }
  if (!(await isStoredPostAccountScrapable(post.accountId))) {
    console.warn(`[reextract-late-result] job ${jobId}: the post's account is not scraped now; the late result was ignored`);
    return { outcome: 'NO_CHANGE' };
  }
  // Only the image list of the record is read, by hand: its caption (`description`) is never parsed, copied, logged or kept, and the
  // record never goes through the record mapper, whose validation failure would persist the raw payload (caption included) to the
  // unprocessed-payload table. The cover and slides are built by the same pure rule the mapper uses (no repeats, cover first).
  const photos = ((records[0] as { photos?: unknown } | undefined)?.photos ?? null);
  const urls = Array.isArray(photos) ? photos.filter((url): url is string => typeof url === 'string' && url !== '') : [];
  if (urls.length === 0) {
    console.warn(`[reextract-late-result] job ${jobId}: the late snapshot held no images; nothing was saved`);
    return { outcome: 'NO_CHANGE' };
  }
  const [cover, ...slides] = urls;
  const { imageUrl, additionalImageUrls } = buildPostImageUrls(cover, slides);
  await saveRefreshedPostImages({ postId: parsed.postId, scraped: { imageUrl, additionalImageUrls } });
  return { outcome: 'NO_CHANGE' };
};
