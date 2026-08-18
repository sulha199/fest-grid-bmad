import type { SQSEvent, EventBridgeEvent, Context } from 'aws-lambda';
import '../lib/scraper/register-adapters.js';
import { getBatchScrapeTargets } from '../lib/scraper/get-scrape-targets.js';
import { enqueueScrapeJob } from '../lib/scraper/enqueue-scrape-job.js';
import { processScrapeJob } from '../lib/scraper/process-scrape-job.js';
import { attemptBrightDataTrigger } from '../lib/scraper/trigger-brightdata-for-target.js';
import { runStaleJobSweep } from '../lib/scraper/stale-job-sweep.js';

export const handler = async (
  event: SQSEvent | EventBridgeEvent<string, unknown>,
  context: Context
): Promise<void> => {
  console.log('Scraper lambda invoked', JSON.stringify({ event }));

  // Check for stale job sweep EventBridge trigger
  if ('jobType' in event && event.jobType === 'stale-job-sweep') {
    console.log('Running stale job sweep');
    await runStaleJobSweep();
    return;
  }

  if ('Records' in event) {
    // SQS Event: Process enqueued scrape jobs
    console.log(`Processing SQS batch of ${event.Records.length} records`);
    for (const record of event.Records) {
      try {
        const target = JSON.parse(record.body);
        await processScrapeJob(target);
      } catch (err) {
        console.error('Failed to parse or process SQS message body:', record.body, err);
      }
    }
  } else {
    // EventBridge Event: Trigger batch targeting and dispatch to Bright Data (Instagram) or Apify (fallback)
    console.log('Triggering daily batch scrape targets extraction');
    try {
      const targets = await getBatchScrapeTargets();
      console.log(`Found ${targets.length} distinct targets to scrape`);

      const results = await Promise.allSettled(
        targets.map(async (target) => {
          // Try Bright Data first for Instagram, then fall back to Apify
          if (target.platform === 'instagram') {
            const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const brightDataTriggered = await attemptBrightDataTrigger(target, newerThan);
            if (brightDataTriggered) {
              console.log(`Triggered Bright Data job for ${target.username}`);
              return;
            }
          }
          // Fall back to Apify for non-Instagram targets or if Bright Data fails
          await enqueueScrapeJob(target);
        })
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.error(`Failed to dispatch ${failedCount} out of ${targets.length} scrape jobs`);
      } else {
        console.log(`Successfully dispatched all ${targets.length} scrape jobs`);
      }
    } catch (err) {
      console.error('Failed to retrieve or dispatch batch scrape targets:', err);
      throw err;
    }
  }
};
