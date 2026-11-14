import { and, desc, eq, gt, inArray, ne } from 'drizzle-orm';
import { jobAttempts, jobs } from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import { REEXTRACT_RESCRAPE_COOLDOWN_MS } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';

// Story 10.6 (AC5; PRD 3.9.3 "a post is refreshed at most once every 10 minutes, and the 10 minutes start only when a vendor call
// actually ran"; FIND-261102-4qm) -- the cooldown of the moderator re-extract refresh, read from `job_attempts` (the truth about
// vendor calls) instead of a second record.
//
// An attempt counts when its vendor call ran: SUCCEEDED (also "the post does not exist"), EMPTY, TIMED_OUT and FAILED. An attempt
// that never reached a vendor does not: SKIPPED (budget, degraded, DPA gate) and OVER_QUOTA (the capacity gate, a known used-up
// cap, Apify's memory or monthly cap). `toJobAttemptRow` maps those typed pre-call refusals to the two non-counting outcomes.
const VENDOR_CALL_RAN = ['SUCCEEDED', 'EMPTY', 'TIMED_OUT', 'FAILED'] as const;

/**
 * When a refresh of this post last ran a vendor call inside the cooldown window, by any moderator's job, or null when a refresh may
 * run now. `excludeJobId` is the asking job (a resumed run must not be blocked by its own earlier attempt).
 */
export async function findRecentRefreshVendorCall(inputKey: string, excludeJobId: string, now: Date): Promise<Date | null> {
  const since = new Date(now.getTime() - REEXTRACT_RESCRAPE_COOLDOWN_MS);
  const [row] = await db
    .select({ at: jobAttempts.createdAt })
    .from(jobAttempts)
    .innerJoin(jobs, eq(jobs.id, jobAttempts.jobId))
    .where(
      and(
        eq(jobs.type, REEXTRACT_POST_JOB_TYPE),
        eq(jobs.inputKey, inputKey),
        ne(jobs.id, excludeJobId),
        gt(jobAttempts.createdAt, since),
        inArray(jobAttempts.outcome, [...VENDOR_CALL_RAN])
      )
    )
    .orderBy(desc(jobAttempts.createdAt))
    .limit(1);
  return row?.at ?? null;
}

/** When the refresh can be tried again after a vendor call at `lastCallAt`. */
export function refreshRetryAfter(lastCallAt: Date): Date {
  return new Date(lastCallAt.getTime() + REEXTRACT_RESCRAPE_COOLDOWN_MS);
}

/**
 * True when THIS job already made a vendor call (a non-skipped attempt row: the outcomes of `VENDOR_CALL_RAN`). A phase-1 run that
 * starts again for the same job (the Lambda died after the call and before the hand-off) must not spend the call a second time.
 */
export async function jobHasVendorAttempt(jobId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: jobAttempts.id })
    .from(jobAttempts)
    .where(and(eq(jobAttempts.jobId, jobId), inArray(jobAttempts.outcome, [...VENDOR_CALL_RAN])))
    .limit(1);
  return row !== undefined;
}
