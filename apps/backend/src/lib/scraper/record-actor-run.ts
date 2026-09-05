import { db } from '../../db/client.js';
import { scraperActorRuns } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { sendScraperAuditAlert } from '../notifications/send-scraper-audit-alert.js';

export type RecordActorRunStartInput = {
  vendor: 'APIFY' | 'BRIGHTDATA';
  triggerMode: 'SYNC' | 'ASYNC';
  profileId: string;
  runId: string;
  rawInput: unknown;
  pendingJobId?: string;
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
};

export type RecordActorRunResultInput = {
  id?: string;
  vendor: 'APIFY' | 'BRIGHTDATA';
  runId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  rawOutput?: unknown;
  itemCount?: number;
  errorMessage?: string;
};

/**
 * Record a new actor run at trigger/start time (before outcome is known).
 * This function catches and logs any DB errors; it never throws or blocks the caller.
 */
export async function recordActorRunStart(input: RecordActorRunStartInput): Promise<string | null> {
  try {
    const [result] = await db
      .insert(scraperActorRuns)
      .values({
        vendor: input.vendor as 'APIFY' | 'BRIGHTDATA',
        triggerMode: input.triggerMode as 'SYNC' | 'ASYNC',
        profileId: input.profileId,
        runId: input.runId,
        rawInput: input.rawInput,
        pendingJobId: input.pendingJobId,
        status: (input.status || 'PENDING') as any,
      })
      .returning({ id: scraperActorRuns.id });

    return result.id;
  } catch (err) {
    console.error(
      `Failed to record actor run start for ${input.vendor} run ${input.runId}:`,
      err
    );
    await sendScraperAuditAlert({
      source: 'recordActorRunStart',
      message: err instanceof Error ? err.message : String(err),
      context: JSON.stringify({ vendor: input.vendor, runId: input.runId, profileId: input.profileId }),
    });
    return null;
  }
}

/**
 * Record or update an actor run result after completion.
 * Tries update-by-id first (if id provided), falls back to lookup by (vendor, runId).
 * This function catches and logs any DB errors; it never throws or blocks the caller.
 */
export async function recordActorRunResult(input: RecordActorRunResultInput): Promise<void> {
  try {
    if (input.id) {
      // Update by id
      await db
        .update(scraperActorRuns)
        .set({
          status: input.status as any,
          rawOutput: input.rawOutput,
          itemCount: input.itemCount,
          errorMessage: input.errorMessage,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scraperActorRuns.id, input.id));
    } else {
      // Update by (vendor, runId)
      await db
        .update(scraperActorRuns)
        .set({
          status: input.status as any,
          rawOutput: input.rawOutput,
          itemCount: input.itemCount,
          errorMessage: input.errorMessage,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(scraperActorRuns.vendor, input.vendor as 'APIFY' | 'BRIGHTDATA'),
            eq(scraperActorRuns.runId, input.runId)
          )
        );
    }
  } catch (err) {
    console.error(
      `Failed to record actor run result for ${input.vendor} run ${input.runId}:`,
      err
    );
    // The DB error itself is swallowed intentionally (audit recording never throws to the
    // caller) -- but the resulting moderator alert is awaited, since sendScraperAuditAlert
    // can never throw either and this guarantees the alert isn't dropped by a Lambda freeze.
    await sendScraperAuditAlert({
      source: 'recordActorRunResult',
      message: err instanceof Error ? err.message : String(err),
      context: JSON.stringify({ vendor: input.vendor, runId: input.runId, id: input.id }),
    });
  }
}

/**
 * Convenience wrapper for sync-path audit recording.
 * Combines the full run lifecycle (from input to output) into a single insert.
 * Returns the recorded run's ID if successful, null otherwise.
 * This function catches and logs any DB errors; it never throws or blocks the caller.
 */
export async function recordSyncActorRun(input: {
  vendor: 'APIFY' | 'BRIGHTDATA';
  profileId: string;
  runId: string;
  rawInput: unknown;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  rawOutput?: unknown;
  itemCount?: number;
  errorMessage?: string;
}): Promise<string | null> {
  try {
    const [result] = await db
      .insert(scraperActorRuns)
      .values({
        vendor: input.vendor as any,
        triggerMode: 'SYNC' as any,
        profileId: input.profileId,
        runId: input.runId,
        rawInput: input.rawInput,
        status: input.status as any,
        rawOutput: input.rawOutput,
        itemCount: input.itemCount,
        errorMessage: input.errorMessage,
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [scraperActorRuns.vendor, scraperActorRuns.runId],
      })
      .returning({ id: scraperActorRuns.id });

    return result?.id || null;
  } catch (err) {
    console.error(
      `Failed to record sync actor run for ${input.vendor} run ${input.runId}:`,
      err
    );
    await sendScraperAuditAlert({
      source: 'recordSyncActorRun',
      message: err instanceof Error ? err.message : String(err),
      context: JSON.stringify({ vendor: input.vendor, runId: input.runId, profileId: input.profileId }),
    });
    return null;
  }
}
