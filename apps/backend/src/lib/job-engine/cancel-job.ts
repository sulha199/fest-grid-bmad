import { and, eq, notInArray } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { JOB_TERMINAL_STATUSES } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { afterJobEnded } from './after-job-ended.js';

// Story 10.3 (AC6; PRD FR122) -- the owner ends a job that has not ended: FAILED with the reason CANCELLED, its place and
// any subscription slot released (both are derived from non-terminal rows, so ending the row releases them), the next
// queued job promoted and followers settled. A running handler cannot be stopped from here; its late writes are refused by
// run-job's write guard (still RUNNING and still its claim).

export type CancelJobResult = 'CANCELLED' | 'NOT_CANCELLABLE';

/** `message`: plain words for the Jobs page when the cancel is not the owner's own (Story 10.6: a stuck job replaced by a new click). */
export async function cancelJob(jobId: string, ownerUserId: string, options: { message?: string } = {}): Promise<CancelJobResult> {
  const now = new Date();
  const [ended] = await db
    .update(jobs)
    .set({
      status: 'FAILED',
      reasonCode: 'CANCELLED',
      errorMessage: options.message ?? 'The job was cancelled.',
      workerClaimedAt: null,
      resumeAt: null,
      finishedAt: now,
      // Story 10.13: the owner just pressed Cancel, so they are watching; a cancel by replacement (with a message) is announced.
      ownerNotifiedAt: options.message === undefined ? now : null,
      updatedAt: now,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerUserId, ownerUserId), notInArray(jobs.status, [...JOB_TERMINAL_STATUSES])))
    .returning({ id: jobs.id, ownerUserId: jobs.ownerUserId });
  if (!ended) {
    return 'NOT_CANCELLABLE';
  }
  await afterJobEnded(ended, true);
  return 'CANCELLED';
}
