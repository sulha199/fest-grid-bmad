import { computeIsScrapeInProgress } from "./compute-is-scrape-in-progress.js";

/**
 * What a subscribed account looks like on the manual extract screen (PRD 3.10, 2026-10-16;
 * Story 5.4a). An account is called INACTIVE only when we can be confident it really has stopped
 * posting: it has been scraped successfully and recently, and still has no recent post.
 */
export const ACCOUNT_ACTIVITY_STATES = [
  "ACTIVE",
  "NEVER_SCRAPED",
  "SCRAPE_IN_PROGRESS",
  "SCRAPE_STALE",
  "INACTIVE",
] as const;
export type AccountActivityState = (typeof ACCOUNT_ACTIVITY_STATES)[number];

export interface AccountActivityFacts {
  lastScrapedAt: Date | null;
  scrapeTriggeredAt: Date | null;
  /** `published_at` of the newest post owned by, or associated with, the account; null when it has none. */
  newestPostAt: Date | null;
}

export interface AccountActivityThresholds {
  /** A trigger older than this is an orphaned job, not an in-flight scrape. */
  scrapeInProgressTimeoutHours: number;
  /** A last successful scrape older than this is too old to call the account inactive. */
  scrapeStaleDays: number;
  /** No post newer than this makes an account inactive. */
  inactiveAfterDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Precedence, first match wins:
 * 1. SCRAPE_IN_PROGRESS: a scrape is under way, so whatever the counts say is about to change;
 * 2. NEVER_SCRAPED: no scrape has completed, so "no posts" means "not looked at yet";
 * 3. SCRAPE_STALE: the last successful scrape is too old to trust "no recent posts";
 * 4. INACTIVE: scraped recently and the newest post is older than `inactiveAfterDays` (or there is none);
 * 5. ACTIVE.
 */
export function computeAccountActivityState(
  facts: AccountActivityFacts,
  thresholds: AccountActivityThresholds,
  now: Date = new Date()
): AccountActivityState {
  if (
    computeIsScrapeInProgress(
      { scrapeTriggeredAt: facts.scrapeTriggeredAt, lastScrapedAt: facts.lastScrapedAt },
      thresholds.scrapeInProgressTimeoutHours,
      now
    )
  ) {
    return "SCRAPE_IN_PROGRESS";
  }

  if (facts.lastScrapedAt === null) {
    return "NEVER_SCRAPED";
  }

  if (facts.lastScrapedAt.getTime() < now.getTime() - thresholds.scrapeStaleDays * DAY_MS) {
    return "SCRAPE_STALE";
  }

  if (facts.newestPostAt === null || facts.newestPostAt.getTime() < now.getTime() - thresholds.inactiveAfterDays * DAY_MS) {
    return "INACTIVE";
  }

  return "ACTIVE";
}
