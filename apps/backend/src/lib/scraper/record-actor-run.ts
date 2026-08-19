import { db } from '../../db/client.js';
import { scraperActorRuns } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';

export type RecordActorRunStartInput = {
  vendor: 'apify' | 'brightdata';
  triggerMode: 'sync' | 'async';
  profileId: string;
  runId: string;
  rawInput: unknown;
  pendingJobId?: string;
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
};

export type RecordActorRunResultInput = {
  id?: string;
  vendor: 'apify' | 'brightdata';
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
        vendor: input.vendor as 'apify' | 'brightdata',
        triggerMode: input.triggerMode as 'sync' | 'async',
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
            eq(scraperActorRuns.vendor, input.vendor as 'apify' | 'brightdata'),
            eq(scraperActorRuns.runId, input.runId)
          )
        );
    }
  } catch (err) {
    console.error(
      `Failed to record actor run result for ${input.vendor} run ${input.runId}:`,
      err
    );
    // Errors are swallowed intentionally - audit recording never blocks the caller
  }
}

/**
 * Convenience wrapper for sync-path audit recording.
 * Combines the full run lifecycle (from input to output) into a single insert.
 * This function catches and logs any DB errors; it never throws or blocks the caller.
 */
export async function recordSyncActorRun(input: {
  vendor: 'apify' | 'brightdata';
  profileId: string;
  runId: string;
  rawInput: unknown;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  rawOutput?: unknown;
  itemCount?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db
      .insert(scraperActorRuns)
      .values({
        vendor: input.vendor as any,
        triggerMode: 'sync' as any,
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
      });
  } catch (err) {
    console.error(
      `Failed to record sync actor run for ${input.vendor} run ${input.runId}:`,
      err
    );
    // Errors are swallowed intentionally - audit recording never blocks the caller
  }
}
