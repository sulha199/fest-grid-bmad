import { and, eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { withHeldPost, withoutHeldPost, type ReextractHeldPost } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';

// Story 10.6 (owner decision 2026-11-12; PRD 5 Data Minimization; AD-40 Rule 9) -- the one place a fetched caption touches a job row.
// A re-extract whose caption is not stored (a curator post, a URL not in the database) fetches it in phase 1 and must give it to
// phase 2, which runs in another Lambda and is woken with only `{ jobId }`. The post is HELD on the job (`jobs.input.held`) for the
// minutes between the phases and blanked as soon as phase 2 ends (its `finally`), by `sweepHeldPostRetention` when anything keeps it
// longer (a run the engine expired, a cancelled job, a dead Lambda), and by the start path when it cancels a stuck job. It is never
// copied to `result_data`, `job_attempts`, an error message, a log line or the GraphQL output. Nothing here logs the content.

/** Holds the post on a RUNNING job. Guarded: a job that already ended keeps nothing. Returns whether it was held. */
export async function holdPostOnJob(jobId: string, held: ReextractHeldPost): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ input: jobs.input }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, 'RUNNING'))).for('update');
    if (!row) return false;
    await tx.update(jobs).set({ input: withHeldPost(row.input, held), updatedAt: new Date() }).where(eq(jobs.id, jobId));
    return true;
  });
}

/**
 * Removes the held post from a job, whatever its state. Best effort and never throws (it runs in `finally` paths): a failure is
 * logged by the error's name only, and the sweep is the backstop.
 */
export async function blankHeldPost(jobId: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.select({ input: jobs.input }).from(jobs).where(eq(jobs.id, jobId)).for('update');
      if (!row || typeof row.input !== 'object' || row.input === null || !('held' in row.input)) return;
      await tx.update(jobs).set({ input: withoutHeldPost(row.input) }).where(eq(jobs.id, jobId));
    });
  } catch (error) {
    console.error(`[reextract] could not blank the held post of job ${jobId} (${error instanceof Error ? error.name : 'error'}); the sweep will`);
  }
}
