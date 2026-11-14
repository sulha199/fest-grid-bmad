import { and, asc, eq, inArray, lt, or } from 'drizzle-orm';
import { jobVendorSnapshots, jobs } from '@festgrid/database';
import { decideSnapshotWait, isCompletedAfterDeadline, type LateResultOutcome } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { getBrightDataProgress, getBrightDataSnapshot } from '../scraper/brightdata-client.js';
import { afterJobEnded } from './after-job-ended.js';
import { getLateResultHandler } from './job-registry.js';

// Story 10.5 (AC2 to AC6; PRD FR119; AD-53 Rule 16) -- collects a vendor result that arrives after its job's run ended. The 5-minute
// job sweep calls `collectLateVendorResults`: for each PENDING snapshot link it asks Bright Data for the snapshot's progress.
//
// A link's life: PENDING -> COLLECTING (the claim: one conditional UPDATE, the only door, so a duplicate delivery or a second sweep
// runs the handler at most once) -> COLLECTED (written only AFTER the handler ran and the job was settled). A link left COLLECTING
// by a Lambda that died mid-way is put back to PENDING by the next sweep (`reapStuckLinks`), so handlers must be idempotent.
// Plain words only in rows and logs: no caption, URL or raw vendor error (errors are logged by NAME only).

const BATCH = 100;
const VENDOR_FAILED_MESSAGE = 'The vendor run did not complete.';
const WAITED_TOO_LONG_MESSAGE = 'The job waited too long for the vendor.';
/** A link claimed this long ago and still COLLECTING lost its Lambda: it goes back to PENDING. A sweep takes at most 5 minutes. */
const COLLECTING_STUCK_AFTER_MS = 10 * 60_000;
/** Past the wait bound only a READY snapshot is still collected; if it still cannot be (a download or a handler that always fails) the link is given up after this long. */
const HARD_STOP_AFTER_BOUND_MS = 24 * 60 * 60_000;

type Link = typeof jobVendorSnapshots.$inferSelect;
type Job = typeof jobs.$inferSelect;

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'non-error');

/** The one door: PENDING to COLLECTING (or GAVE_UP) in one conditional UPDATE. False when another sweep already took it. */
async function claimLink(linkId: string, next: 'COLLECTING' | 'GAVE_UP', now: Date): Promise<boolean> {
  const claimed = await db
    .update(jobVendorSnapshots)
    .set({ status: next, updatedAt: now })
    .where(and(eq(jobVendorSnapshots.id, linkId), eq(jobVendorSnapshots.status, 'PENDING')))
    .returning({ id: jobVendorSnapshots.id });
  return claimed.length > 0;
}

async function finishLink(linkId: string, now: Date): Promise<void> {
  await db
    .update(jobVendorSnapshots)
    .set({ status: 'COLLECTED', collectedAt: now, updatedAt: now })
    .where(and(eq(jobVendorSnapshots.id, linkId), eq(jobVendorSnapshots.status, 'COLLECTING')));
}

/** Back to PENDING for the next sweep. Never throws (the stuck-link reaper catches what this cannot). */
async function releaseLink(linkId: string): Promise<void> {
  try {
    await db
      .update(jobVendorSnapshots)
      .set({ status: 'PENDING', updatedAt: new Date() })
      .where(and(eq(jobVendorSnapshots.id, linkId), eq(jobVendorSnapshots.status, 'COLLECTING')));
  } catch (error) {
    console.error(`[job-engine-sweep] could not release snapshot link ${linkId} (${errorName(error)}); the stuck-link reaper will`);
  }
}

/** A link left COLLECTING by a Lambda that died after the claim goes back to PENDING (the Lambda limit is 300 s, a sweep takes minutes). */
async function reapStuckLinks(now: Date): Promise<void> {
  await db
    .update(jobVendorSnapshots)
    .set({ status: 'PENDING', updatedAt: now })
    .where(and(eq(jobVendorSnapshots.status, 'COLLECTING'), lt(jobVendorSnapshots.updatedAt, new Date(now.getTime() - COLLECTING_STUCK_AFTER_MS))));
}

/**
 * Finishes a job from a late result: one guarded update. Only a job still WAITING, RUNNING or QUEUED, or EXPIRED for running out of
 * time (`TIMED_OUT`), is settled (the SQL below is the domain's `canSettleFromLateResult`); any other ending is never revised. The
 * job becomes the handler's SUCCEEDED or SUCCEEDED_WITH_LIMITS (a SUCCEEDED_WITH_LIMITS without a reason is recorded UNSPECIFIED,
 * FR117), marked "completed after deadline" when the finish is past `deadline_at` (FR119). Returns whether the job was settled.
 */
export async function settleJobFromLateResult(job: Pick<Job, 'id' | 'ownerUserId' | 'deadlineAt'>, outcome: LateResultOutcome, now: Date = new Date()): Promise<boolean> {
  if (outcome.outcome === 'NO_CHANGE') {
    return false; // Story 10.6: the result was saved elsewhere and the job's own ending stands
  }
  if (outcome.outcome !== 'SUCCEEDED' && outcome.outcome !== 'SUCCEEDED_WITH_LIMITS') {
    throw new Error('A late-result handler may only end a job SUCCEEDED or SUCCEEDED_WITH_LIMITS, or leave it as it is (NO_CHANGE)');
  }
  const settled = await db
    .update(jobs)
    .set({
      status: outcome.outcome,
      reasonCode: outcome.reasonCode ?? (outcome.outcome === 'SUCCEEDED_WITH_LIMITS' ? 'UNSPECIFIED' : null),
      errorMessage: null,
      resultData: outcome.resultData ?? null,
      completedAfterDeadline: isCompletedAfterDeadline(job.deadlineAt, now),
      workerClaimedAt: null,
      resumeAt: null,
      finishedAt: now,
      // Story 10.13: a late result that revives an EXPIRED job is announced again, once ("completed after deadline").
      ownerNotifiedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobs.id, job.id),
        or(inArray(jobs.status, ['WAITING', 'RUNNING', 'QUEUED']), and(eq(jobs.status, 'EXPIRED'), eq(jobs.reasonCode, 'TIMED_OUT')))
      )
    )
    .returning({ id: jobs.id });
  if (settled.length === 0) {
    return false;
  }
  await afterJobEnded({ id: job.id, ownerUserId: job.ownerUserId }, true);
  return true;
}

/**
 * Ends a job that is still WAITING for a snapshot that will never come (failed, or waited for too long), unless the job has
 * another snapshot link still open (a retried fetch that produced a second snapshot): that one may still deliver.
 */
async function endWaitingJob(job: Pick<Job, 'id' | 'ownerUserId'>, ending: { status: 'FAILED' | 'EXPIRED'; reasonCode: string; message: string }, now: Date): Promise<void> {
  const open = await db
    .select({ id: jobVendorSnapshots.id })
    .from(jobVendorSnapshots)
    .where(and(eq(jobVendorSnapshots.jobId, job.id), inArray(jobVendorSnapshots.status, ['PENDING', 'COLLECTING'])))
    .limit(1);
  if (open.length > 0) {
    return;
  }
  const ended = await db
    .update(jobs)
    .set({ status: ending.status, reasonCode: ending.reasonCode, errorMessage: ending.message, workerClaimedAt: null, resumeAt: null, finishedAt: now, updatedAt: now })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'WAITING')))
    .returning({ id: jobs.id });
  if (ended.length > 0) {
    await afterJobEnded({ id: job.id, ownerUserId: job.ownerUserId }, true);
  }
}

async function giveUp(link: Link, job: Pick<Job, 'id' | 'ownerUserId'>, ending: { status: 'FAILED' | 'EXPIRED'; reasonCode: string; message: string }, now: Date): Promise<void> {
  if (await claimLink(link.id, 'GAVE_UP', now)) {
    await endWaitingJob(job, ending, now);
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
  // Another provider already gave the job its result (the usual case: Bright Data ran long, Apify answered): nothing to collect, and
  // a slower provider's lower-resolution images must not overwrite what the job saved. Stop polling. A job that ended
  // SUCCEEDED_WITH_LIMITS (Story 10.6: the refresh timed out and the preview used the stored images) is NOT in this case: nothing
  // answered, and the snapshot is exactly what its handler is waiting for; the handler's own rule protects what is stored.
  if (job.status === 'SUCCEEDED') {
    await claimLink(link.id, 'GAVE_UP', now);
    return false;
  }
  // The hard stop: well past the wait bound, whatever the snapshot or the handler keep doing.
  if (now.getTime() > link.waitUntil.getTime() + HARD_STOP_AFTER_BOUND_MS) {
    await giveUp(link, job, { status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG', message: WAITED_TOO_LONG_MESSAGE }, now);
    return false;
  }

  const waitedLongEnough = now.getTime() >= link.waitUntil.getTime();
  let progress;
  try {
    progress = await getBrightDataProgress(link.snapshotId);
  } catch (error) {
    // A progress call that keeps failing must not keep the link alive past the bound.
    if (waitedLongEnough) {
      await giveUp(link, job, { status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG', message: WAITED_TOO_LONG_MESSAGE }, now);
    }
    throw error;
  }
  const decision = decideSnapshotWait({
    progressStatus: progress.status,
    ageMs: now.getTime() - link.createdAt.getTime(),
    maxWaitMs: link.waitUntil.getTime() - link.createdAt.getTime(),
  });

  switch (decision) {
    case 'WAIT':
      return false;
    case 'GIVE_UP_FAILED':
      await giveUp(link, job, { status: 'FAILED', reasonCode: 'VENDOR_RUN_FAILED', message: VENDOR_FAILED_MESSAGE }, now);
      return false;
    case 'GIVE_UP_TOO_LONG':
      await giveUp(link, job, { status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG', message: WAITED_TOO_LONG_MESSAGE }, now);
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
      if (!(await claimLink(link.id, 'COLLECTING', now))) {
        return false; // a duplicate delivery: another sweep already took it, and its handler run is the only one
      }
      try {
        const outcome = await handler({ jobId: job.id, input: job.input, records });
        // The guarded update decides from the job's CURRENT state (a job re-admitted or ended while the snapshot was downloaded is
        // judged as it is now); a job that ended another way is not revived, but the records were still handled above.
        await settleJobFromLateResult(job, outcome, now);
      } catch (error) {
        console.error(`[job-engine-sweep] the late-result handler or the settle of job ${job.id} (${job.type}) failed (${errorName(error)}); the link is retried`);
        // Handlers are idempotent by contract, so the next sweep may run it again while the hard stop lasts.
        await releaseLink(link.id);
        return false;
      }
      await finishLink(link.id, now);
      return true;
    }
  }
}

/** The sweep step. Returns how many snapshots were collected; a failure for one link is logged and never stops the others. */
export async function collectLateVendorResults(now: Date = new Date()): Promise<number> {
  await reapStuckLinks(now);
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
      console.error(`[job-engine-sweep] collecting snapshot link ${link.id} failed (${errorName(error)}); continuing`);
    }
  }
  return collected;
}
