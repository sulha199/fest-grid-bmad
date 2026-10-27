/**
 * How far before a scheduled cycle's fire time a stamp still counts as "this cycle already
 * scraped it". Absorbs a manual run launched just ahead of the cron (it has effectively done
 * the cron's job) and any skew between the EventBridge timestamp and the stamp's clock.
 */
export const SCHEDULED_SCRAPE_DUE_MARGIN_MS = 60 * 60 * 1000;

export type ScrapeDueCutoffMode = "scheduled" | "recent-window";

export interface ScrapeDueCutoff {
  /** A profile is due when it was never scraped, or its `lastScrapedAt` is strictly before this. */
  cutoff: Date;
  mode: ScrapeDueCutoffMode;
}

/**
 * The instant a profile's `lastScrapedAt` must precede for the daily batch to scrape it.
 *
 * - **Scheduled cycle** (`scheduledTime` = the EventBridge event's `time`): due means "not scraped
 *   since just before this cycle fired". Anything stamped on or after `scheduledTime - margin` was
 *   scraped by this cycle (a duplicate delivery or a Lambda retry of the same event) or by a run
 *   made right before it, so it is skipped. A recovery rerun late the day before (2026-10-23
 *   15:59 UTC, ~11h ahead of the 03:13 cron) is far outside the margin and does not starve the cycle.
 * - **Anything else** (a manual invoke with an empty event): the original rolling window,
 *   `now - skipRecentHours`, which exists to stop hand-run invocations re-scraping fresh profiles.
 */
export function resolveScrapeDueCutoff(input: {
  scheduledTime?: Date;
  skipRecentHours: number;
  now: Date;
  marginMs?: number;
}): ScrapeDueCutoff {
  if (input.scheduledTime !== undefined) {
    const marginMs = input.marginMs ?? SCHEDULED_SCRAPE_DUE_MARGIN_MS;
    return { cutoff: new Date(input.scheduledTime.getTime() - marginMs), mode: "scheduled" };
  }
  return {
    cutoff: new Date(input.now.getTime() - input.skipRecentHours * 60 * 60 * 1000),
    mode: "recent-window",
  };
}
