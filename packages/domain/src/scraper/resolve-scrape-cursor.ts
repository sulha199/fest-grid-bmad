export type ScrapeCursorVendor = 'APIFY' | 'BRIGHTDATA';

/**
 * Bright Data's `start_date` is a calendar day (`MM-DD-YYYY`) in a time zone its documentation does
 * not state, so the cursor is pulled back by a day to make sure a post published near midnight in
 * that unknown zone is still requested. The day is inclusive, so the cost of the margin is only a
 * re-fetch of posts already stored (the persist step de-duplicates by post URL).
 */
export const BRIGHT_DATA_CURSOR_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * Apify's `onlyPostsNewerThan` includes a post published exactly at the filter, so a cursor equal to the
 * newest stored post fetches (and bills) that post again on every run. Instagram timestamps have
 * one-second resolution, so stepping the cursor one second past it excludes exactly that post.
 */
export const APIFY_CURSOR_ADVANCE_MS = 1000;

/**
 * The point in time a vendor scrape should start from, as an ISO timestamp (BUG-074, BUG-075).
 *
 * The cursor is where the stored posts end, never when a previous run finished: a run that fetched
 * nothing (an outage, a failure, a timeout) must not move it, or every post published in between is
 * silently never requested again.
 *
 * - the profile has stored posts: the newest `publishedAt` (Apify: plus one second; Bright Data: minus a
 *   one-day margin);
 * - it has none: `fallbackNewerThan`, the caller's initial-lookback window, unchanged.
 *
 * A stored `publishedAt` later than `now` (a parse or time-zone slip on one row) is treated as `now`:
 * left alone it would push the cursor into the future and the vendor would return nothing for the
 * profile until that day arrived.
 */
export function resolveScrapeCursor(input: {
  vendor: ScrapeCursorVendor;
  newestPostPublishedAt: Date | null | undefined;
  fallbackNewerThan: string;
  now?: Date;
}): string {
  const { vendor, newestPostPublishedAt, fallbackNewerThan, now = new Date() } = input;
  if (!newestPostPublishedAt) {
    return fallbackNewerThan;
  }
  const newest = Math.min(newestPostPublishedAt.getTime(), now.getTime());
  if (vendor === 'APIFY') {
    return new Date(Math.min(newest + APIFY_CURSOR_ADVANCE_MS, now.getTime())).toISOString();
  }
  return new Date(newest - BRIGHT_DATA_CURSOR_MARGIN_MS).toISOString();
}
