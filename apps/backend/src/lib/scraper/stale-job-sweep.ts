import { decideSnapshotWait } from '@festgrid/domain/jobs';
import { loadBackendEnv } from '../../env.js';
import { extendPendingJobExpiry, findExpiredPendingJobs } from './brightdata-pending-jobs-store.js';
import { findExpiredPendingJobs as findExpiredApifyJobs, markPendingJobExpired as markApifyJobExpired } from './apify-pending-jobs-store.js';
import { getBrightDataProgress, getBrightDataSnapshot } from './brightdata-client.js';
import { processBrightDataResult } from './process-brightdata-result.js';
import { processApifyAsyncResult } from './process-apify-async-result.js';
import { fetchApifyRunOutput, fetchBrightDataRunOutput } from './fetch-vendor-run-output.js';
import { enqueueFallbackScrape } from './enqueue-fallback-scrape.js';
import { recordActorRunResult } from './record-actor-run.js';
import { classifyBrightDataRun, describeBrightDataVendorFailure } from './classify-brightdata-run.js';
import { handleBrightDataFailedRun } from './handle-brightdata-failed-run.js';
import { reportBrightDataYield } from './run-yield-store.js';

// Story 10.5 (IDEA-102): how long a snapshot the vendor still reports as running keeps its job PENDING between two sweeps. The
// sweep runs hourly, so it looks again at the next one.
export const BRIGHTDATA_STILL_RUNNING_RECHECK_MS = 60 * 60_000;

export async function runStaleJobSweep(): Promise<void> {
  // Process Bright Data jobs
  const brightDataExpiredJobs = await findExpiredPendingJobs();
  const brightDataResults = await Promise.allSettled(
    brightDataExpiredJobs.map((job) => processSingleExpiredBrightDataJob(job))
  );

  // Process Apify jobs
  const apifyExpiredJobs = await findExpiredApifyJobs();
  const apifyResults = await Promise.allSettled(
    apifyExpiredJobs.map((job) => processSingleExpiredApifyJob(job))
  );

  // Log any failures
  [...brightDataResults, ...apifyResults].forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to process expired job ${index}:`, result.reason);
    }
  });
}

async function processSingleExpiredBrightDataJob(job: any): Promise<void> {
  try {
    const output = await fetchBrightDataRunOutput(job.snapshotId);

    if (output.status === 'SUCCEEDED') {
      // A "ready" snapshot with no items is not necessarily a good run (BUG-074): a vendor that
      // returned nothing for everyone is a failure, handled like any other failed run below.
      const { resultClass, progress } = await classifyBrightDataRun(job.snapshotId, output.items.length, { progress: output.progress });
      if (resultClass === 'vendor_failure') {
        await handleBrightDataFailedRun(job, {
          status: 'FAILED',
          rawOutput: output.items,
          itemCount: 0,
          errorMessage: describeBrightDataVendorFailure(progress),
        });
        return;
      }

      // Job succeeded, process results
      await recordActorRunResult({
        vendor: 'BRIGHTDATA',
        runId: job.snapshotId,
        status: 'SUCCEEDED',
        rawOutput: output.items,
        itemCount: output.items.length,
      });
      await processBrightDataResult(job, output.items, job.scraperActorRunId);
      await reportBrightDataYield(job.snapshotId, output.items.length, output.progress);
    } else {
      // Story 10.5 (IDEA-102): a snapshot Bright Data still reports as running is WAITED for, up to
      // BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES after it started, instead of being sent to the paid Apify fallback while its result
      // arrives anyway (2026-10-29: 21 of 38 snapshots took 5 to 6 hours). Nothing is recorded as failed and nothing is
      // re-queued; the job stays PENDING and the next sweep looks again. A `ready` or `failed` snapshot is never delayed.
      if (output.status === 'PENDING' && output.progress) {
        const decision = decideSnapshotWait({
          progressStatus: output.progress.status,
          ageMs: Date.now() - job.createdAt.getTime(),
          maxWaitMs: loadBackendEnv().brightdataSnapshotMaxWaitMinutes * 60_000,
        });
        if (decision === 'WAIT') {
          await extendPendingJobExpiry(job.id, new Date(Date.now() + BRIGHTDATA_STILL_RUNNING_RECHECK_MS));
          return;
        }
      }
      // Job failed or still not ready past the bound - record, mark as expired and fall back to the SQS queue
      // A snapshot that is still in flight when its job expires never delivered: TIMED_OUT, so
      // provider health sees it (it ignores PENDING). A status this code does not know is FAILED.
      const failedStatus = output.status === 'PENDING' ? 'TIMED_OUT' : output.status === 'unknown' ? 'FAILED' : output.status;
      await handleBrightDataFailedRun(job, {
        status: failedStatus,
        errorMessage: `Run status from stale-job-sweep: ${output.status}`,
      });
    }
  } catch (error) {
    console.error(`Error processing expired Bright Data job ${job.id}:`, error);
    throw error;
  }
}

async function processSingleExpiredApifyJob(job: any): Promise<void> {
  try {
    const output = await fetchApifyRunOutput(job.runId);

    if (output.status === 'SUCCEEDED') {
      // Job succeeded, process results
      await recordActorRunResult({
        vendor: 'APIFY',
        runId: job.runId,
        status: 'SUCCEEDED',
        rawOutput: output.items,
        itemCount: output.items.length,
      });
      await processApifyAsyncResult(job, output.items as any[], job.scraperActorRunId);
    } else {
      // Job failed/timed out/aborted - record and mark as expired
      await recordActorRunResult({
        vendor: 'APIFY',
        runId: job.runId,
        status: output.status as any,
        errorMessage: `Run status from stale-job-sweep: ${output.status}`,
      });
      await markApifyJobExpired(job.id);

      // Fall back to the SQS queue (a scrape start: behind the AD-34 gate and an active subscription)
      await enqueueFallbackScrape(job.profileId);
    }
  } catch (error) {
    console.error(`Error processing expired Apify job ${job.id}:`, error);
    throw error;
  }
}
