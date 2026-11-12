import { parseReextractPostInput, type JobLateResultHandler } from '@festgrid/domain/jobs';
import { mapBrightDataRecordToScrapedPost } from '../scraper/brightdata-record-mapper.js';
import { saveRefreshedPostImages } from './save-refreshed-post-images.js';

// Story 10.6 (AC7; PRD FR119; AD-53 Rules 16 and 17) -- the moderator re-extract's handler for a Bright Data snapshot that finished
// after the refresh budget ran out (registered only in the Scraper Lambda, beside the job handler's registration). It saves the fresh
// links to `posts` through the SAME writer and rule as the refresh phase, so a late 640 px answer can never replace full-size links
// that are still valid. It answers `NO_CHANGE`: the preview already continued on the stored images and the job has ended (or expired)
// with its own result, which must not be replaced by a result-less success. Idempotent (the writer decides from what is stored).
// The records carry the caption; it is not read here and nothing of the record is logged.
export const reextractLateResultHandler: JobLateResultHandler = async ({ jobId, input, records }) => {
  const parsed = parseReextractPostInput(input);
  if (!parsed) {
    console.warn(`[reextract-late-result] job ${jobId}: its input is not a post id; the late result was ignored`);
    return { outcome: 'NO_CHANGE' };
  }
  const scraped = records.length > 0 ? await mapBrightDataRecordToScrapedPost(records[0]) : null;
  if (!scraped) {
    console.warn(`[reextract-late-result] job ${jobId}: the late snapshot held no readable post; nothing was saved`);
    return { outcome: 'NO_CHANGE' };
  }
  await saveRefreshedPostImages({ postId: parsed.postId, scraped });
  return { outcome: 'NO_CHANGE' };
};
