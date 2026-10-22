import { findExpiredPendingJobs } from './brightdata-pending-jobs-store.js';
import { findExpiredPendingJobs as findExpiredApifyJobs, markPendingJobExpired as markApifyJobExpired } from './apify-pending-jobs-store.js';
import { getBrightDataProgress, getBrightDataSnapshot } from './brightdata-client.js';
import { processBrightDataResult } from './process-brightdata-result.js';
import { processApifyAsyncResult } from './process-apify-async-result.js';
import { fetchApifyRunOutput, fetchBrightDataRunOutput } from './fetch-vendor-run-output.js';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { enqueueScrapeJob } from './enqueue-scrape-job.js';
import { recordActorRunResult } from './record-actor-run.js';
import { classifyBrightDataRun, describeBrightDataVendorFailure } from './classify-brightdata-run.js';
import { handleBrightDataFailedRun } from './handle-brightdata-failed-run.js';

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
      const { resultClass, progress } = await classifyBrightDataRun(job.snapshotId, output.items.length);
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
    } else {
      // Job failed or still not ready - record, mark as expired and fall back to the SQS queue
      await handleBrightDataFailedRun(job, {
        status: output.status as any,
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

      // Fetch profile info for fallback
      const [profile] = await db
        .select()
        .from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, job.profileId));

      if (profile && profile.platform === 'instagram') {
        try {
          // Fall back to SQS queue
          await enqueueScrapeJob({
            profileId: profile.id,
            accountId: profile.accountId,
            username: profile.username,
            platform: profile.platform,
          });
        } catch (error) {
          console.error(`Fallback SQS enqueue failed for ${profile.username}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing expired Apify job ${job.id}:`, error);
    throw error;
  }
}
