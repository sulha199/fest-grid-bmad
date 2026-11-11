import { aliasedTable, and, eq, inArray, isNotNull, isNull, lte, notInArray } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { FOLLOWER_PHASE, JOB_TERMINAL_STATUSES } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { promoteQueuedJobs } from './promote-queued-jobs.js';
import { readmitWaitingJob } from './readmit-waiting-job.js';
import { failOrphanedFollowers, settleFollowers } from './settle-followers.js';

// Story 10.3 (AC2, AC4, AC5) -- the admission steps of the 5-minute job sweep. Database only (the promotion's host invoke
// is an AWS call, but it is a single async Lambda invoke, not a vendor call). They repair whatever a lost wake-up left:
// a queued job nobody promoted, a WAITING job nobody re-admitted, a follower whose leader ended or vanished.

const BATCH = 200;

/** A job that waited for a place longer than JOB_QUEUE_MAX_WAIT_MINUTES (counted from queued_since) ends EXPIRED / WAITED_TOO_LONG. */
export async function expireQueuedJobsWaitedTooLong(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - loadBackendEnv().jobQueueMaxWaitMinutes * 60_000);
  const expired = await db
    .update(jobs)
    .set({
      status: 'EXPIRED',
      reasonCode: 'WAITED_TOO_LONG',
      errorMessage: 'The job waited too long for a free place.',
      finishedAt: now,
      updatedAt: now,
    })
    .where(and(eq(jobs.status, 'QUEUED'), isNull(jobs.admittedAt), isNotNull(jobs.queuedSince), lte(jobs.queuedSince, cutoff)))
    .returning({ id: jobs.id, ownerUserId: jobs.ownerUserId });
  // Ending a queued job frees no place, but a follower could point at it only if it had been admitted; nothing to do.
  return expired.length;
}

/** Re-admits every non-follower WAITING job whose resume time is due (a scheduled retry). Returns how many were re-admitted. */
export async function readmitDueWaitingJobs(now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.status, 'WAITING'), isNull(jobs.leaderJobId), isNotNull(jobs.resumeAt), lte(jobs.resumeAt, now)))
    .limit(BATCH);
  let readmitted = 0;
  for (const { id } of due) {
    try {
      if ((await readmitWaitingJob(id)) === 'READMITTED') {
        readmitted += 1;
      }
    } catch (error) {
      console.error(`[job-engine-sweep] re-admitting job ${id} failed; continuing:`, error);
    }
  }
  return readmitted;
}

/** Settles followers whose leader has ended (a wake-up was missed or the sweep itself expired the leader) and fails orphans. */
export async function settleOrphanedAndFinishedFollowers(): Promise<number> {
  const leader = aliasedTable(jobs, 'leader');
  const stuck = await db
    .selectDistinct({ leaderId: leader.id })
    .from(jobs)
    .innerJoin(leader, eq(jobs.leaderJobId, leader.id))
    .where(and(notInArray(jobs.status, [...JOB_TERMINAL_STATUSES]), inArray(leader.status, [...JOB_TERMINAL_STATUSES])))
    .limit(BATCH);
  let settled = 0;
  for (const { leaderId } of stuck) {
    try {
      settled += await settleFollowers(leaderId);
    } catch (error) {
      console.error(`[job-engine-sweep] settling followers of ${leaderId} failed; continuing:`, error);
    }
  }
  settled += await failOrphanedFollowers(FOLLOWER_PHASE);
  return settled;
}

/** Gives free places to every owner that still has queued jobs (promotion checks the free places itself). */
export async function promoteOwnersWithQueuedJobs(): Promise<number> {
  const owners = await db
    .selectDistinct({ ownerUserId: jobs.ownerUserId })
    .from(jobs)
    .where(and(eq(jobs.status, 'QUEUED'), isNull(jobs.admittedAt), isNotNull(jobs.ownerUserId)))
    .limit(BATCH);
  let promoted = 0;
  for (const { ownerUserId } of owners) {
    if (!ownerUserId) continue;
    try {
      promoted += await promoteQueuedJobs(ownerUserId);
    } catch (error) {
      console.error(`[job-engine-sweep] promoting queued jobs of user ${ownerUserId} failed; continuing:`, error);
    }
  }
  return promoted;
}

