import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { JOB_TERMINAL_STATUSES, isTerminalJobStatus } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';

// Story 10.3 (AC2; PRD FR120) -- a follower joined another user's job (the leader) instead of doing the work, so when the
// leader ends the follower ends the same way. Idempotent and guarded: only followers that are still open are written.

/** Copies the leader's ending onto every open follower. Returns how many followers were settled (0 when the leader is not terminal). */
export async function settleFollowers(leaderJobId: string): Promise<number> {
  const [leader] = await db.select().from(jobs).where(eq(jobs.id, leaderJobId));
  if (!leader || !isTerminalJobStatus(leader.status)) {
    return 0;
  }
  const now = new Date();
  const settled = await db
    .update(jobs)
    .set({
      status: leader.status,
      reasonCode: leader.reasonCode,
      errorMessage: leader.errorMessage,
      resultData: leader.resultData,
      completedAfterDeadline: leader.completedAfterDeadline,
      workerClaimedAt: null,
      resumeAt: null,
      finishedAt: leader.finishedAt ?? now,
      updatedAt: now,
    })
    .where(and(eq(jobs.leaderJobId, leaderJobId), notInArray(jobs.status, [...JOB_TERMINAL_STATUSES])))
    .returning({ id: jobs.id });
  return settled.length;
}

/**
 * A follower whose leader row was deleted (`leader_job_id` set null, `phase` still the follower marker) has no work to
 * wait for: it ends FAILED / LEADER_LOST. Called by the sweep.
 */
export async function failOrphanedFollowers(followerPhase: string): Promise<number> {
  const now = new Date();
  const failed = await db
    .update(jobs)
    .set({
      status: 'FAILED',
      reasonCode: 'LEADER_LOST',
      errorMessage: 'The job this one was waiting on is gone.',
      finishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobs.status, 'WAITING'),
        eq(jobs.phase, followerPhase),
        isNull(jobs.leaderJobId)
      )
    )
    .returning({ id: jobs.id });
  return failed.length;
}
