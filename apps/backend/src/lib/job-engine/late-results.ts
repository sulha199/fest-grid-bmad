import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { jobVendorSnapshots, jobs } from '@festgrid/database';
import {
  canSettleFromLateResult,
  decideSnapshotWait,
  isCompletedAfterDeadline,
  type LateResultOutcome,
} from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { getBrightDataProgress, getBrightDataSnapshot } from '../scraper/brightdata-client.js';
import { afterJobEnded } from './after-job-ended.js';
import { getLateResultHandler } from './job-registry.js';

// Story 10.5 (AC2 to AC6; PRD FR119; AD-53) -- collects a vendor result that arrives after its job's run ended. The 5-minute job
// sweep calls `collectLateVendorResults`: for each PENDING snapshot link it asks Bright Data for the snapshot's progress. Plain
// words only in rows and logs: no caption, URL or raw vendor error.

const BATCH = 100;
const VENDOR_FAILED_MESSAGE = 'The vendor run did not complete.';
const WAITED_TOO_LONG_MESSAGE = 'The job waited too long for the vendor.';

type Link = typeof jobVendorSnapshots.$inferSelect;
type Job = typeof jobs.$inferSelect;

/** The one door: PENDING to `next` in one conditional UPDATE. Null when another sweep (or a duplicate delivery) already took it. */
async function claimLink(linkId: string, next: 'COLLECTED' | 'GAVE_UP', now: Date): Promise<boolean> {
  const claimed = await db
    .update(jobVendorSnapshots)
    .set({ status: next, collectedAt: next === 'COLLECTED' ? now : null, updatedAt: now })
    .where(and(eq(jobVendorSnapshots.id, linkId), eq(jobVendorSnapshots.status, 'PENDING')))
    .returning({ id: jobVendorSnapshots.id });
  return claimed.length > 0;
}

/**
 * Finishes a job from a late result: one guarded update. Only a job still WAITING or RUNNING, or EXPIRED for running out of time
 * (`TIMED_OUT`), is settled (`canSettleFromLateResult`); any other ending is never revised. The job becomes the handler's SUCCEEDED
 * or SUCCEEDED_WITH_LIMITS, marked "completed after deadline" when the finish is past `deadline_at` (FR119). Returns whether the job
 * was settled.
 */
export async function settleJobFromLateResult(job: Pick<Job, 'id' | 'ownerUserId' | 'deadlineAt'>, outcome: LateResultOutcome, now: Date = new Date()): Promise<boolean> {
  const settled = await db
    .update(jobs)
    .set({
      status: outcome.outcome,
      reasonCode: outcome.reasonCode ?? null,
      errorMessage: null,
      resultData: outcome.resultData ?? null,
      completedAfterDeadline: isCompletedAfterDeadline(job.deadlineAt, now),
      workerClaimedAt: null,
      resumeAt: null,
      finishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobs.id, job.id),
        // the same rule as the domain's canSettleFromLateResult
        or(inArray(jobs.status, ['WAITING', 'RUNNING']), and(eq(jobs.status, 'EXPIRED'), eq(jobs.reasonCode, 'TIMED_OUT')))
      )
    )
    .returning({ id: jobs.id });
  if (settled.length === 0) {
    return false;
  }
  await afterJobEnded({ id: job.id, ownerUserId: job.ownerUserId }, true);
  return true;
}

/** Ends a job that is still WAITING for a snapshot that will never come (failed, or waited for too long). */
async function endWaitingJob(job: Pick<Job, 'id' | 'ownerUserId'>, ending: { status: 'FAILED' | 'EXPIRED'; reasonCode: string; message: string }, now: Date): Promise<void> {
  const ended = await db
    .update(jobs)
    .set({ status: ending.status, reasonCode: ending.reasonCode, errorMessage: ending.message, workerClaimedAt: null, resumeAt: null, finishedAt: now, updatedAt: now })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'WAITING')))
    .returning({ id: jobs.id });
  if (ended.length > 0) {
    await afterJobEnded({ id: job.id, ownerUserId: job.ownerUserId }, true);
  }
}

async function collectOne(link: Link, now: Date): Promise<boolean> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, link.jobId));
  if (!job) {
    await claimLink(link.id, 'GAVE_UP', now);
    return false;
  }
  if (link.provider !== 'BRIGHTDATA') {
    console.warn(`[job-engine-sweep] snapshot link ${link.id} has provider ${link.provider}, which has no late-result collector; given up`);
    await claimLink(link.id, 'GAVE_UP', now);
    return false;
  }

  const progress = await getBrightDataProgress(link.snapshotId);
  const decision = decideSnapshotWait({
    progressStatus: progress.status,
    ageMs: now.getTime() - link.createdAt.getTime(),
    maxWaitMs: link.waitUntil.getTime() - link.createdAt.getTime(),
  });

  switch (decision) {
    case 'WAIT':
      return false;
    case 'GIVE_UP_FAILED':
      if (await claimLink(link.id, 'GAVE_UP', now)) {
        await endWaitingJob(job, { status: 'FAILED', reasonCode: 'VENDOR_RUN_FAILED', message: VENDOR_FAILED_MESSAGE }, now);
      }
      return false;
    case 'GIVE_UP_TOO_LONG':
      if (await claimLink(link.id, 'GAVE_UP', now)) {
        await endWaitingJob(job, { status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG', message: WAITED_TOO_LONG_MESSAGE }, now);
      }
      return false;
    case 'COLLECT': {
      const handler = getLateResultHandler(job.type);
      if (!handler) {
        console.warn(`[job-engine-sweep] job type ${job.type} has no late-result handler in this Lambda; snapshot link ${link.id} given up`);
        await claimLink(link.id, 'GAVE_UP', now);
        return false;
      }
      // Download BEFORE the claim so a failed download leaves the link PENDING for the next sweep.
      const records = await getBrightDataSnapshot(link.snapshotId);
      if (!(await claimLink(link.id, 'COLLECTED', now))) {
        return false; // a duplicate delivery: another sweep already took it, and its handler run is the only one
      }
      let outcome: LateResultOutcome;
      try {
        outcome = await handler({ jobId: job.id, input: job.input, records });
      } catch (error) {
        console.error(`[job-engine-sweep] the late-result handler of job ${job.id} (${job.type}) failed; the link is retried:`, error);
        // Handlers are idempotent by contract, so the next sweep may run it again while the wait bound lasts.
        await db.update(jobVendorSnapshots).set({ status: 'PENDING', collectedAt: null, updatedAt: new Date() }).where(eq(jobVendorSnapshots.id, link.id));
        return false;
      }
      // A job that ended another way is not revived (canSettleFromLateResult); its records were still handled above.
      if (canSettleFromLateResult({ status: job.status, reasonCode: job.reasonCode })) {
        await settleJobFromLateResult(job, outcome, now);
      }
      return true;
    }
  }
}

/** The sweep step. Returns how many snapshots were collected; a failure for one link is logged and never stops the others. */
export async function collectLateVendorResults(now: Date = new Date()): Promise<number> {
  const pending = await db
    .select()
    .from(jobVendorSnapshots)
    .where(eq(jobVendorSnapshots.status, 'PENDING'))
    .orderBy(asc(jobVendorSnapshots.waitUntil))
    .limit(BATCH);
  let collected = 0;
  for (const link of pending) {
    try {
      if (await collectOne(link, now)) {
        collected += 1;
      }
    } catch (error) {
      console.error(`[job-engine-sweep] collecting snapshot link ${link.id} failed; continuing:`, error);
    }
  }
  return collected;
}
