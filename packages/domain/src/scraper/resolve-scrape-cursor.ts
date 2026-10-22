export type ScrapeCursorVendor = 'APIFY' | 'BRIGHTDATA';

/**
 * Bright Data's `start_date` is a calendar day (`MM-DD-YYYY`) in a time zone its documentation does
 * not state, so the cursor is pulled back by a day to make sure a post published near midnight in
 * that unknown zone is still requested. The day is inclusive, so the cost of the margin is only a
 * re-fetch of posts already stored (the persist step de-duplicates by post URL).
 */
export const BRIGHT_DATA_CURSOR_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * The point in time a vendor scrape should start from, as an ISO timestamp (BUG-074, BUG-075).
 *
 * The cursor is where the stored posts end, never when a previous run finished: a run that fetched
 * nothing (an outage, a failure, a timeout) must not move it, or every post published in between is
 * silently never requested again.
 *
 * - the profile has stored posts: the newest `publishedAt` (Bright Data: minus a one-day margin);
 * - it has none: `fallbackNewerThan`, the caller's initial-lookback window, unchanged.
 */
export function resolveScrapeCursor(input: {
  vendor: ScrapeCursorVendor;
  newestPostPublishedAt: Date | null | undefined;
  fallbackNewerThan: string;
}): string {
  const { vendor, newestPostPublishedAt, fallbackNewerThan } = input;
  if (!newestPostPublishedAt) {
    return fallbackNewerThan;
  }
  const margin = vendor === 'BRIGHTDATA' ? BRIGHT_DATA_CURSOR_MARGIN_MS : 0;
  return new Date(newestPostPublishedAt.getTime() - margin).toISOString();
}
