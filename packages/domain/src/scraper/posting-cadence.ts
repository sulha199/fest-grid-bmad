const DAY_MS = 24 * 60 * 60 * 1000;

/** The "last active month": posting days counted for a profile's rhythm are those within this many days of its last post. */
export const POSTING_CADENCE_WINDOW_DAYS = 30;

/** Fewer posting days than this in that window is too thin a sample to read a rhythm from. */
export const MIN_POSTING_DAYS_FOR_CADENCE = 5;

export interface PostingCadence {
  /** Posts the summary was made from (owned or associated, any age the caller loaded). */
  postCount: number;
  lastPostAt: Date | null;
  /** Whole days from the last post to `now`; null with no post. */
  silenceDays: number | null;
  /**
   * Median gap in days between consecutive distinct posting days within the last active month. Distinct days,
   * not posts: a profile that posts ten times on one day and then goes quiet for four is not a "posts every
   * 0.6 days" profile (prod 2026-10: aftereo.ofc). Null with fewer than two posting days.
   */
  typicalGapDays: number | null;
  postingDaysInWindow: number;
  /** `insufficient` until the profile's history is seeded and the window holds MIN_POSTING_DAYS_FOR_CADENCE posting days. */
  confidence: "ok" | "insufficient";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * A profile's posting rhythm, from the dates it posted on (UTC calendar days).
 *
 * A profile known only as a co-author, or whose own timeline has not been scraped yet (`historySeeded` false),
 * holds a thin, biased sample of posts, so its confidence is `insufficient` whatever the sample size.
 */
export function summarizePostingCadence(input: {
  publishedAts: readonly Date[];
  historySeeded: boolean;
  now: Date;
}): PostingCadence {
  const { publishedAts, historySeeded, now } = input;
  if (publishedAts.length === 0) {
    return { postCount: 0, lastPostAt: null, silenceDays: null, typicalGapDays: null, postingDaysInWindow: 0, confidence: "insufficient" };
  }

  const lastPostAt = new Date(Math.max(...publishedAts.map((date) => date.getTime())));
  const silenceDays = Math.max(0, Math.floor((now.getTime() - lastPostAt.getTime()) / DAY_MS));

  const dayNumber = (date: Date) => Math.floor(date.getTime() / DAY_MS);
  const lastDay = dayNumber(lastPostAt);
  const postingDays = [...new Set(publishedAts.map(dayNumber))]
    .filter((day) => day > lastDay - POSTING_CADENCE_WINDOW_DAYS)
    .sort((a, b) => a - b);

  const gaps = postingDays.slice(1).map((day, index) => day - postingDays[index]);
  const typicalGapDays = gaps.length > 0 ? median(gaps) : null;

  return {
    postCount: publishedAts.length,
    lastPostAt,
    silenceDays,
    typicalGapDays,
    postingDaysInWindow: postingDays.length,
    confidence: historySeeded && postingDays.length >= MIN_POSTING_DAYS_FOR_CADENCE ? "ok" : "insufficient",
  };
}

/**
 * How many days to wait before scraping a profile again (1 = the daily batch scrapes it).
 *
 * Only a profile whose last run found no new post is slowed, and only when its rhythm is known: the wait is its
 * typical gap between posting days (times `gapMultiplier`), rounded up and capped at `maxDays`. A profile that
 * posts daily keeps a gap of 1 and stays daily. It is never switched off: any run that finds a new post puts the
 * profile back to daily. Setting `maxDays` to 1 turns the backoff off.
 */
export function resolveScrapeBackoffDays(input: {
  cadence: PostingCadence;
  lastRunWasEmpty: boolean;
  gapMultiplier: number;
  maxDays: number;
}): number {
  const { cadence, lastRunWasEmpty, gapMultiplier, maxDays } = input;
  if (!lastRunWasEmpty || cadence.confidence !== "ok" || cadence.typicalGapDays === null) {
    return 1;
  }
  return Math.max(1, Math.min(Math.floor(maxDays), Math.ceil(cadence.typicalGapDays * gapMultiplier)));
}

/**
 * True when a profile due under the daily cutoff should wait: it was scraped, and less than `intervalDays` days
 * (counted like the daily rule: the cutoff is one day back) have passed since. A never-scraped profile is never deferred.
 */
export function isScrapeDeferredByBackoff(input: {
  lastScrapedAt: Date | null;
  cutoff: Date;
  intervalDays: number;
}): boolean {
  const { lastScrapedAt, cutoff, intervalDays } = input;
  if (lastScrapedAt === null || intervalDays <= 1) {
    return false;
  }
  return lastScrapedAt.getTime() >= cutoff.getTime() - (intervalDays - 1) * DAY_MS;
}
