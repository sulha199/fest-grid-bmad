import { PostUnavailableError, type PostScraperAdapter } from '@festgrid/domain';
import { scrapeBrightDataPost } from './brightdata-client.js';
import { mapBrightDataRecordToScrapedPost } from './brightdata-record-mapper.js';
import { assertProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';

/**
 * Bright Data's synchronous scrape answers within ~60 s or hands back a snapshot that is then polled, so the chain only
 * starts it for a caller with at least this much time (the API Lambda, 28 s, never does).
 *
 * AN ASSUMPTION (Story 10.2): the profile dataset was measured at ~80 s (2026-10-31); the POST dataset's duration has not
 * been measured, and no vendor call may be made from a build session. Read the first real run's `job_attempts.elapsed_ms`
 * and tune this number.
 */
export const BRIGHTDATA_POST_MIN_BUDGET_MS = 90_000;

/** Bright Data returned no usable post and did not say the page is gone, so another provider may still answer. */
export class BrightDataPostUnavailableError extends PostUnavailableError {
  constructor(detail: string) {
    super(`Bright Data returned no post: ${detail}`);
    this.name = 'BrightDataPostUnavailableError';
  }
}


export const brightDataPostAdapter: PostScraperAdapter = {
  name: 'brightdata',
  minBudgetMs: BRIGHTDATA_POST_MIN_BUDGET_MS,

  async fetchPost(url, { budgetMs }) {
    await assertProviderCapacityAvailable('brightdata', `post ${url}`);

    const scrape = await scrapeBrightDataPost(url, budgetMs);

    if (scrape.kind === 'no-records') {
      // `dead_page` is Bright Data saying the page does not exist: an answer. Anything else (an empty result, another
      // error code) is the vendor not delivering, which is how its 2026-10-21 outage looked.
      if (scrape.errorCode === 'dead_page') {
        return null;
      }
      throw new BrightDataPostUnavailableError(scrape.errorCode ?? 'an empty result');
    }

    await recordProviderUsage('brightdata', 1);
    const post = await mapBrightDataRecordToScrapedPost(scrape.records[0]);
    if (!post) {
      throw new BrightDataPostUnavailableError('the record could not be read as a post');
    }
    return post;
  },
};
