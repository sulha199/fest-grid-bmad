import { and, eq, gt, isNull } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { FOLLOWER_PHASE, computeJobDeadline, getJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { admittedColumns } from './admit-job.js';
import { JobHostUnreachableError, invokeJobHost, markJobStartFailed } from './job-host.js';
import { promoteQueuedJobs } from './promote-queued-jobs.js';
import { afterJobEnded } from './after-job-ended.js';

// Story 10.3 (AC5; PRD FR121) -- a WAITING job holds no place, so when its time or its event comes it is admitted again
// like a new start: it joins the queue and takes the next free place (or waits its turn). The worker's claim no longer
// takes a WAITING row, so this is the ONLY way a WAITING job runs again. Event sources (Story 10.5's late result, Story
// 10.12a's finished post) call it; so does the 5-minute sweep for a due `resume_at`.

export type ReadmitResult = 'READMITTED' | 'NOT_WAITING' | 'UNKNOWN_JOB_TYPE';

export async function readmitWaitingJob(jobId: string): Promise<ReadmitResult> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  // A follower waits on its leader, not on time: it is settled, never re-admitted.
  if (!job || job.status !== 'WAITING' || job.leaderJobId !== null || job.phase === FOLLOWER_PHASE) {
    return 'NOT_WAITING';
  }
  const definition = getJobTypeDefinition(job.type);
  if (!definition) {
    console.warn(`[readmitWaitingJob] job ${job.id} has type ${job.type}, which has no definition in this Lambda; left waiting`);
    return 'UNKNOWN_JOB_TYPE';
  }
  const now = new Date();

  if (job.ownerUserId === null) {
    // A SYSTEM job (FR130) uses and waits for no user's places: admitted at once.
    const [admitted] = await db
      .update(jobs)
      .set({ ...admittedColumns(definition, now), resumeAt: null, updatedAt: now })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, 'WAITING'), isNull(jobs.leaderJobId)))
      .returning({ id: jobs.id });
    if (!admitted) {
      return 'NOT_WAITING';
    }
    try {
      await invokeJobHost(job.type, job.id);
    } catch (error) {
      if (error instanceof JobHostUnreachableError) {
        // Back to WAITING for a Lambda that can reach the host (the sweep re-admits it when due).
        console.warn(`[readmitWaitingJob] job ${job.id} (${job.type}): ${error.message}; left WAITING`);
        await db
          .update(jobs)
          .set({ status: 'WAITING', resumeAt: new Date(), updatedAt: new Date() })
          .where(and(eq(jobs.id, job.id), eq(jobs.status, 'QUEUED'), isNull(jobs.workerClaimedAt)));
        return 'READMITTED';
      }
      console.error(`[readmitWaitingJob] could not restart job ${job.id} (${job.type}):`, error);
      if (await markJobStartFailed(job.id)) {
        await afterJobEnded({ id: job.id, ownerUserId: null }, true);
      }
    }
    return 'READMITTED';
  }

  // A USER job: back to the queue (not admitted), oldest-first by now. Its phase and input stay for the resume.
  const [queued] = await db
    .update(jobs)
    .set({
      status: 'QUEUED',
      admittedAt: null,
      queuedSince: now,
      resumeAt: null,
      workerClaimedAt: null,
      deadlineAt: computeJobDeadline(now, definition),
      updatedAt: now,
    })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'WAITING'), isNull(jobs.leaderJobId), gt(jobs.deadlineAt, now)))
    .returning({ id: jobs.id });
  if (!queued) {
    return 'NOT_WAITING';
  }
  await promoteQueuedJobs(job.ownerUserId);
  return 'READMITTED';
}
