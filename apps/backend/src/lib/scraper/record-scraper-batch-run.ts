import { db } from '../../db/client.js';
import { scraperBatchRuns } from '@festgrid/database';
import { eq } from 'drizzle-orm';

// Per-cron-cycle audit record for the daily EventBridge batch-scrape invocation (IDEA-013).
// scraper_actor_runs only ever gets a row when a per-target trigger SUCCEEDS against a
// vendor (record-actor-run.ts), so before this module nothing but scraper.ts's ephemeral
// console.log lines (CloudWatch, not queryable from the app/DB) could tell 'the cron fired
// and found 0 targets' apart from 'the cron never fired'. This records the invocation
// itself -- a sibling of recordProviderHealthCheck's additive-observability shape:

// recordScraperBatchRunStart opens a row when the EventBridge branch begins and
// completeScraperBatchRun closes it with the batch's dispatch tallies once it finishes.

/**
 * Opens a new scraper_batch_runs row for one EventBridge daily invocation and returns its
 * id so the caller can complete it. Targets/counts are not yet known here, so the row starts
 * at defaults and is filled in by completeScraperBatchRun.
 */
export async function recordScraperBatchRunStart(): Promise<string> {
  const [row] = await db
    .insert(scraperBatchRuns)
    .values({})
    .returning({ id: scraperBatchRuns.id });
  return row.id;
}

export interface ScraperBatchRunCompletion {
  targetsFound: number;
  dispatchedSucceeded: number;
  dispatchedFailed: number;
}

/**
 * Closes an open scraper_batch_runs row with the invocation's final tallies (IDEA-013).
 * Safe to call on the error path too (counts default to 0) so a failed batch still leaves a
 * completed row proving the cron fired.
 */
export async function completeScraperBatchRun(
  id: string,
  completion: ScraperBatchRunCompletion
): Promise<void> {
  await db
    .update(scraperBatchRuns)
    .set({
      completedAt: new Date(),
      targetsFound: completion.targetsFound,
      dispatchedSucceeded: completion.dispatchedSucceeded,
      dispatchedFailed: completion.dispatchedFailed,
      updatedAt: new Date(),
    })
    .where(eq(scraperBatchRuns.id, id));
}
