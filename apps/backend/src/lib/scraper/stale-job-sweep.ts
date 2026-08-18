import { findExpiredPendingJobs, markPendingJobExpired } from './brightdata-pending-jobs-store.js';
import { findExpiredPendingJobs as findExpiredApifyJobs, markPendingJobExpired as markApifyJobExpired } from './apify-pending-jobs-store.js';
import { getBrightDataProgress, getBrightDataSnapshot } from './brightdata-client.js';
import { processBrightDataResult } from './process-brightdata-result.js';
import { processApifyAsyncResult } from './process-apify-async-result.js';
import { getApifyClient } from './instagram-adapter.js';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { getScraperAdapter } from './register-adapters.js';
import { enqueueScrapeJob } from './enqueue-scrape-job.js';

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
    const progress = await getBrightDataProgress(job.snapshotId);

    if (progress.status === 'ready') {
      // Job is ready, fetch and process results
      const snapshot = await getBrightDataSnapshot(job.snapshotId);
      await processBrightDataResult(job, snapshot);
    } else {
      // Job failed or still not ready - mark as expired and fall back to SQS
      await markPendingJobExpired(job.id);

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
            username: profile.username,
            platform: profile.platform,
          });
        } catch (error) {
          console.error(`Fallback SQS enqueue failed for ${profile.username}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing expired Bright Data job ${job.id}:`, error);
    throw error;
  }
}

async function processSingleExpiredApifyJob(job: any): Promise<void> {
  try {
    const client = getApifyClient();
    const run = await client.run(job.runId).get();

    if (run.status === 'SUCCEEDED') {
      // Job succeeded, fetch dataset and process
      const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true, limit: 1000 });
      await processApifyAsyncResult(job, items as any[]);
    } else {
      // Job failed/timed out/aborted - mark as expired and fall back to SQS
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
