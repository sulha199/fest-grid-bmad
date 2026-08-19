#!/usr/bin/env tsx
import { loadBackendEnv } from './env.js';
import { triggerBrightDataJob, getBrightDataProgress, getBrightDataSnapshot, mapBrightDataDateToStartDate } from './lib/scraper/brightdata-client.js';

/**
 * One‑off script to trigger a BrightData scrape for a specific social media account.
 *
 * Usage:
 *   tsx src/trigger-brightdata-onetime.ts <accountId> [numPosts] [filterDateISO]
 *
 *   <accountId>      – Identifier of the social media account to scrape.
 *   [numPosts]       – Number of posts to request (default 10).
 *   [filterDateISO]  – Optional ISO date string; only results with `date_posted` > this value are shown.
 */
(async () => {
  const env = loadBackendEnv();
  const [, , accountId, numPostsArg, filterDate] = process.argv;

  if (!accountId) {
    console.error('Missing accountId argument.\nUsage: tsx src/trigger-brightdata-onetime.ts <accountId> [numPosts] [filterDateISO]');
    process.exit(1);
  }

  const numPosts = numPostsArg ? parseInt(numPostsArg, 10) : 10;
  if (isNaN(numPosts) || numPosts <= 0) {
    console.error('numPosts must be a positive integer');
    process.exit(1);
  }

  // Build a simple start date (today) in MM-DD-YYYY format as required by BrightData.
  const today = new Date();
  const startDate = `${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}-${today.getUTCFullYear()}`;

  console.log('Triggering BrightData job...');
  const triggerResult = await triggerBrightDataJob(
    {
      url: `https://www.instagram.com/${accountId}/`,
      numOfPosts: numPosts,
      startDate,
    },
    env.brightdataWebhookBaseUrl ?? ''
  );
  console.log('Job triggered, snapshotId:', triggerResult.snapshotId);

  // Simple polling until the job reports COMPLETED (or FAILED)
  const pollIntervalMs = 5000;
  let status = '';
  while (true) {
    const progress = await getBrightDataProgress(triggerResult.snapshotId);
    status = progress.status as string;
    console.log(`Job status: ${status}`);
    if (status === 'COMPLETED' || status === 'FAILED') break;
    await new Promise(res => setTimeout(res, pollIntervalMs));
  }

  if (status !== 'COMPLETED') {
    console.error('Job did not complete successfully:', status);
    process.exit(1);
  }

  console.log('Fetching snapshot data...');
  const records = await getBrightDataSnapshot(triggerResult.snapshotId);
  let output = records;
  if (filterDate) {
    const cutoff = new Date(filterDate);
    output = records.filter((rec: any) => new Date(rec.date_posted) > cutoff);
    console.log(`Applied date filter > ${filterDate}, ${output.length} records remain.`);
  }

  console.log('Result records:', JSON.stringify(output, null, 2));
})();
