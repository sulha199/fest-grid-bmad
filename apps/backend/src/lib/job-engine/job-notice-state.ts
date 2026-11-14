import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { jobs, userSettings, users } from '@festgrid/database';
import { JOB_TERMINAL_STATUSES } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { withinRetention } from './read-jobs.js';

// Story 10.13 (notify when a job finishes; PRD 3.18 FR124) -- the in-app half: a count of the caller's jobs that ended since the Jobs page was
// last opened (a query, never a hook on an ending write), the mutation that clears it, and the acknowledgement of a job the client saw end.
// Nothing here sends a push or a mail (that is `announce-ended-jobs.ts` only).

/** The badge shows "9+" past 9 but the server stops counting at 99. */
export const JOBS_FINISHED_COUNT_CAP = 99;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The caller's USER jobs with a terminal status that finished after `jobs_last_opened_at` and are inside the retention window (the hide
 * rule of the Jobs reads), capped at 99. A user with no settings row yet is measured from the account's creation. Never a system job,
 * never another user's job.
 */
export async function countJobsFinishedSinceLastOpened(userId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ watermark: sql<Date>`coalesce(${userSettings.jobsLastOpenedAt}, ${users.createdAt})` })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return 0;
  const found = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerUserId, userId),
        eq(jobs.trigger, 'USER'),
        inArray(jobs.status, [...JOB_TERMINAL_STATUSES]),
        gt(jobs.finishedAt, new Date(row.watermark)),
        withinRetention(now)
      )
    )
    .limit(JOBS_FINISHED_COUNT_CAP);
  return found.length;
}

/** Sets the caller's badge watermark to now (creating the settings row when there is none). */
export async function markJobsOpened(userId: string, now: Date = new Date()): Promise<boolean> {
  await db
    .insert(userSettings)
    .values({ userId, jobsLastOpenedAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set: { jobsLastOpenedAt: now } });
  return true;
}

/**
 * The client saw its own job end on a visible tab: the owner needs no push. Only the caller's own, ended, USER job, once; any other id
 * (someone else's, a system job, unknown, malformed, already acknowledged) is a plain `false`, so the answer never says whether it exists.
 */
export async function acknowledgeJobEnded(userId: string, jobId: string, now: Date = new Date()): Promise<boolean> {
  if (!UUID_PATTERN.test(jobId)) return false;
  const rows = await db
    .update(jobs)
    .set({ ownerNotifiedAt: now })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.ownerUserId, userId),
        eq(jobs.trigger, 'USER'),
        inArray(jobs.status, [...JOB_TERMINAL_STATUSES]),
        isNull(jobs.ownerNotifiedAt)
      )
    )
    .returning({ id: jobs.id });
  return rows.length > 0;
}
