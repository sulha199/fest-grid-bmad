import { and, isNotNull, lt, notInArray } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { JOB_TERMINAL_STATUSES } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';

/**
 * Story 10.1a (AC4) -- ends every ADMITTED, non-terminal job past its whole-job deadline: a RUNNING job whose worker
 * died, a WAITING job that was never resumed, an admitted job whose start invoke was lost. Status EXPIRED with the
 * reason TIMED_OUT, and its worker claim cleared (the one lock this engine introduces).
 *
 * Database only: it makes no vendor or AWS call, which is why it runs every 5 minutes on its own rule. It does NOT
 * touch `vendor_call_locks`: that table's own TTL (AD-32) already releases a lease a dead worker held, and a second
 * release here would be a drifting copy of the same cleanup. A job that is not admitted yet (Story 10.3's queue) is
 * bounded by the queue-wait rule of that story, never by `deadline_at`.
 */
export async function sweepExpiredEngineJobs(now: Date = new Date()): Promise<number> {
  const expired = await db
    .update(jobs)
    .set({
      status: 'EXPIRED',
      reasonCode: 'TIMED_OUT',
      errorMessage: 'The job ran past its time bound.',
      workerClaimedAt: null,
      finishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        notInArray(jobs.status, [...JOB_TERMINAL_STATUSES]),
        isNotNull(jobs.admittedAt),
        lt(jobs.deadlineAt, now)
      )
    )
    .returning({ id: jobs.id });
  return expired.length;
}
