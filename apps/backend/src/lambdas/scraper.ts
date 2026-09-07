import type { SQSEvent, EventBridgeEvent, Context } from 'aws-lambda';
import '../lib/scraper/register-adapters.js';
import { getBatchScrapeTargets } from '../lib/scraper/get-scrape-targets.js';
import { enqueueScrapeJob } from '../lib/scraper/enqueue-scrape-job.js';
import { processScrapeJob } from '../lib/scraper/process-scrape-job.js';
import { attemptBrightDataTrigger } from '../lib/scraper/trigger-brightdata-for-target.js';
import { attemptApifyAsyncTrigger } from '../lib/scraper/trigger-apify-for-target.js';
import { runStaleJobSweep } from '../lib/scraper/stale-job-sweep.js';
import { recordProviderHealthCheck } from '../lib/scraper/scraper-provider-health-store.js';

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
          const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          // Try Bright Data first for Instagram
          if (target.platform === 'instagram') {
            const brightDataTriggered = await attemptBrightDataTrigger(target, newerThan);
            if (brightDataTriggered) {
              console.log(`Triggered Bright Data job for ${target.username}`);
              return { brightDataAttempted: true, brightDataSucceeded: true };
            }

            // Fall back to Apify async trigger for all platforms
            const apifyAsyncTriggered = await attemptApifyAsyncTrigger(target, newerThan);
            if (apifyAsyncTriggered) {
              console.log(`Triggered Apify async job for ${target.username}`);
              return { brightDataAttempted: true, brightDataSucceeded: false };
            }

            // Fall back to SQS queue if both async tiers fail
            await enqueueScrapeJob(target);
            return { brightDataAttempted: true, brightDataSucceeded: false };
          }

          // Fall back to Apify async trigger for all platforms
          const apifyAsyncTriggered = await attemptApifyAsyncTrigger(target, newerThan);
          if (apifyAsyncTriggered) {
            console.log(`Triggered Apify async job for ${target.username}`);
            return { brightDataAttempted: false };
          }

          // Fall back to SQS queue if both async tiers fail
          await enqueueScrapeJob(target);
          return { brightDataAttempted: false };
        })
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.error(`Failed to dispatch ${failedCount} out of ${targets.length} scrape jobs`);
      } else {
        console.log(`Successfully dispatched all ${targets.length} scrape jobs`);
      }

      // Tally Bright Data attempts/successes across the batch and record a health
      // check, so a persistently-failing provider can be surfaced to moderators
      // (Story 3.4q) -- purely additive observability, no change to the fallback
      // control flow above.
      let brightDataAttempted = 0;
      let brightDataSucceeded = 0;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.brightDataAttempted) {
          brightDataAttempted += 1;
          if (result.value.brightDataSucceeded) {
            brightDataSucceeded += 1;
          }
        }
      }
      if (brightDataAttempted > 0) {
        try {
          await recordProviderHealthCheck('brightdata', {
            attempted: brightDataAttempted,
            succeeded: brightDataSucceeded,
          });
        } catch (healthCheckErr) {
          console.error('Failed to record Bright Data provider health check:', healthCheckErr);
        }
      }
    } catch (err) {
      console.error('Failed to retrieve or dispatch batch scrape targets:', err);
      throw err;
    }
  }
};
