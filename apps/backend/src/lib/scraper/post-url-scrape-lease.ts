import { createHash } from 'node:crypto';
import { detectPlatformFromUrl, parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { tryClaimInFlight, type InFlightLease } from '../vendor-gateway/guarded-call.js';

// FIND-110 -- one lease per post around "fetch this one post". Two moderators (or a double click)
// previewing the same stale post used to pass the cooldown together and both scrape, because the
// cooldown row is written after the scrape. The holder of this lease is the one scrape in flight;
// everyone else reuses what it produced or is told to retry. Shared by the moderator re-extract and
// `extractEventDataFromUrl` so the two cannot scrape one post at once.

/** Longer than any scrape the API Lambda (28 s) can finish, short enough that a crash frees the URL quickly. */
export const POST_URL_SCRAPE_LEASE_TTL_MS = 60_000;

/**
 * Keyed on the post's platform identity when the URL has one (`/p/X`, `/p/X/`, `www.`, a tracking
 * query string and `/reel/` spellings all name one post), else on the trimmed URL itself.
 */
export function postUrlScrapeLockKey(url: string): string {
  const identity = parsePlatformPostIdentity({ postUrl: url, originalPostUrl: url });
  if (identity.platformPostId !== null) {
    return `post-url-scrape:${detectPlatformFromUrl(url) ?? 'unknown'}:${identity.platformPostId}`;
  }
  return `post-url-scrape:${createHash('sha256').update(url.trim()).digest('hex').slice(0, 32)}`;
}

const NO_LEASE: InFlightLease = { release: async () => undefined };

/**
 * `null` when a scrape of this post is already in flight. Always `release()` the result in a
 * `finally`. If the lock table itself cannot be reached the claim FAILS OPEN (a no-op lease, logged):
 * the worst case is the double scrape this lease exists to prevent, which is better than turning
 * every re-extract and URL extraction into an error because of a bookkeeping fault.
 */
export async function claimPostUrlScrape(url: string): Promise<InFlightLease | null> {
  try {
    return await tryClaimInFlight(postUrlScrapeLockKey(url), POST_URL_SCRAPE_LEASE_TTL_MS);
  } catch (error) {
    console.error(`[claimPostUrlScrape] lease unavailable for ${url}; continuing without single-flight:`, error);
    return NO_LEASE;
  }
}
