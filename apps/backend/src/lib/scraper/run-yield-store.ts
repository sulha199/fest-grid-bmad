import { db } from '../../db/client.js';
import { scraperActorRuns } from '@festgrid/database';
import { classifyBrightDataYield } from '@festgrid/domain';
import { and, eq } from 'drizzle-orm';
import { PROGRESS_LOOKUP_TIMEOUT_MS, lookUpBrightDataProgress } from './classify-brightdata-run.js';
import type { BrightDataProgressResponse } from './brightdata-client.js';

/**
 * Records how many posts an async run delivered that did not exist before, on its audit row. A run that
 * delivered posts but no new one is as empty as one that delivered none, which is what a scrape backoff needs
 * to know. Best effort and never throws: the posts are already stored, the count is bookkeeping.
 */
export async function recordRunNewPosts(scraperActorRunId: string | undefined, newPosts: number): Promise<void> {
  if (!scraperActorRunId) return;
  try {
    await db
      .update(scraperActorRuns)
      .set({ newPosts, updatedAt: new Date() })
      .where(eq(scraperActorRuns.id, scraperActorRunId));
  } catch (error) {
    console.error(`Failed to record the new-post count of run ${scraperActorRunId}:`, error);
  }
}

/**
 * Stores what Bright Data reported for a finished snapshot (records, errors, error codes) on its audit row, and
 * logs a snapshot that delivered posts yet also reported errors, so a code we have not seen is noticed.
 * Never throws and never changes the scrape's result.
 *
 * `knownProgress` is a report the caller already read (a zero-record classification or the stale-job sweep);
 * without one a snapshot that delivered records is looked up here, a free call with the webhook-safe timeout.
 * Call it after the posts are stored: a lookup that fails or times out only leaves the columns null.
 */
export async function reportBrightDataYield(
  snapshotId: string,
  recordCount: number,
  knownProgress?: BrightDataProgressResponse | null
): Promise<void> {
  try {
    const progress =
      knownProgress ?? (recordCount > 0 ? await lookUpBrightDataProgress(snapshotId, PROGRESS_LOOKUP_TIMEOUT_MS) : null);
    if (!progress) return;

    await db
      .update(scraperActorRuns)
      .set({
        recordsReported: progress.records ?? null,
        errorsReported: progress.errors ?? null,
        errorCodes: progress.errorCodes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(scraperActorRuns.vendor, 'BRIGHTDATA'), eq(scraperActorRuns.runId, snapshotId)));

    const yieldResult = classifyBrightDataYield(progress);
    if (yieldResult.level === 'partial-unknown' || yieldResult.level === 'partial-retryable') {
      console.warn(
        `Bright Data snapshot ${snapshotId} delivered ${progress.records} records and ${progress.errors} errors ` +
          `(${yieldResult.level}, rate ${yieldResult.rate?.toFixed(2)}) error_codes=${JSON.stringify(progress.errorCodes ?? {})}`
      );
    }
  } catch (error) {
    console.error(`Failed to record the yield of Bright Data snapshot ${snapshotId}:`, error);
  }
}
