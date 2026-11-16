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
 * How far back a profile's first ("seeding") scrape reaches. A post older than this is assumed to announce
 * an event that has already ended, so it is never requested. The seeding scrape is also capped at
 * `SCRAPE_RESULTS_LIMIT` posts (default 30): the newest 30 posts, none older than 30 days.
 */
export const HISTORY_SEED_LOOKBACK_DAYS = 30;

/**
 * The point in time a vendor scrape should start from, as an ISO timestamp (BUG-074, BUG-075).
 *
 * The cursor is where the stored posts end, never when a previous run finished: a run that fetched
 * nothing (an outage, a failure, a timeout) must not move it, or every post published in between is
 * silently never requested again.
 *
 * - the profile's history is not seeded yet (no scrape of its own has delivered a post): the seeding
 *   window, `HISTORY_SEED_LOOKBACK_DAYS` back from now. Stored posts are ignored here, because a profile
 *   known only as a co-author (or from another account's scrape) holds a few posts that say nothing about
 *   its own timeline, and starting after the newest of them would skip the rest of it;
 * - it is seeded and has stored posts: the newest `publishedAt` (Apify: plus one second; Bright Data:
 *   minus a one-day margin);
 * - it is seeded and has none: `fallbackNewerThan`, the caller's lookback window, unchanged.
 *
 * A stored `publishedAt` later than `now` (a parse or time-zone slip on one row) is treated as `now`:
 * left alone it would push the cursor into the future and the vendor would return nothing for the
 * profile until that day arrived.
 */
export function resolveScrapeCursor(input: {
  vendor: ScrapeCursorVendor;
  historySeeded: boolean;
  newestPostPublishedAt: Date | null | undefined;
  fallbackNewerThan: string;
  now?: Date;
}): string {
  const { vendor, historySeeded, newestPostPublishedAt, fallbackNewerThan, now = new Date() } = input;
  if (!historySeeded) {
    return new Date(now.getTime() - HISTORY_SEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  }
  if (!newestPostPublishedAt) {
    return fallbackNewerThan;
  }
  const newest = Math.min(newestPostPublishedAt.getTime(), now.getTime());
  if (vendor === 'APIFY') {
    return new Date(Math.min(newest + APIFY_CURSOR_ADVANCE_MS, now.getTime())).toISOString();
  }
  return new Date(newest - BRIGHT_DATA_CURSOR_MARGIN_MS).toISOString();
}
