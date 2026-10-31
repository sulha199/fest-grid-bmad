import { createHash } from 'node:crypto';
import { tryClaimInFlight, type InFlightLease } from '../vendor-gateway/guarded-call.js';

// FIND-110 -- one lease per post URL around "fetch this one post". Two moderators (or a double
// click) previewing the same stale post used to pass the cooldown together and both scrape,
// because the cooldown row is written after the scrape. The holder of this lease is the one
// scrape in flight; everyone else reuses what it produced or is told to retry. Shared by the
// moderator re-extract and `extractEventDataFromUrl` so the two cannot scrape one URL at once.

/** Longer than any scrape the API Lambda (28 s) can finish, short enough that a crash frees the URL quickly. */
export const POST_URL_SCRAPE_LEASE_TTL_MS = 60_000;

export function postUrlScrapeLockKey(url: string): string {
  return `post-url-scrape:${createHash('sha256').update(url.trim()).digest('hex').slice(0, 32)}`;
}

/** `null` when a scrape of this URL is already in flight. Always `release()` it in a `finally`. */
export function claimPostUrlScrape(url: string): Promise<InFlightLease | null> {
  return tryClaimInFlight(postUrlScrapeLockKey(url), POST_URL_SCRAPE_LEASE_TTL_MS);
}
