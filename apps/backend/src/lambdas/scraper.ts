import type { SQSEvent, EventBridgeEvent, Context } from 'aws-lambda';
import '../lib/scraper/register-adapters.js';
import { getBatchScrapeTargets } from '../lib/scraper/get-scrape-targets.js';
import { enqueueScrapeJob } from '../lib/scraper/enqueue-scrape-job.js';
import { processScrapeJob } from '../lib/scraper/process-scrape-job.js';
import { pollAndDrainQueue } from '../lib/aws/poll-and-drain-queue.js';
import { attemptBrightDataTrigger } from '../lib/scraper/trigger-brightdata-for-target.js';
import { attemptApifyAsyncTrigger } from '../lib/scraper/trigger-apify-for-target.js';
import { runStaleJobSweep } from '../lib/scraper/stale-job-sweep.js';
import { recordProviderHealthCheck } from '../lib/scraper/scraper-provider-health-store.js';
import {
  recordScraperBatchRunStart,
  completeScraperBatchRun,
} from '../lib/scraper/record-scraper-batch-run.js';
import {
  tallyScraperProviderResults,
  type ScraperTargetProviderMarker,
} from '../lib/scraper/tally-scraper-provider-results.js';
import { loadBackendEnv } from '../env.js';

// FIND-035: fallback window for a target with no `newestPostPublishedAt` (i.e. no posts
// yet -- its first-ever scrape). Mirrors the fallback branch already proven correct in
// process-scrape-job.ts's SQS-fallback path.
function lookbackFallback(days: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString();
}

type PollAndDrainEvent = { jobType: 'poll-and-drain' };
type StaleJobSweepEvent = { jobType: 'stale-job-sweep' };
type ScraperEvent = SQSEvent | EventBridgeEvent<string, unknown> | PollAndDrainEvent | StaleJobSweepEvent;

// Dedicated type-guard functions (rather than inline `'jobType' in event && event.jobType ===
// '...'` checks) so TypeScript's control-flow analysis can fully narrow `event` back down to
// `SQSEvent | EventBridgeEvent<string, unknown>` in the code after these branches' `return`s --
// a compound `&&` expression combining an `in` check with a literal-value comparison doesn't
// get the same narrowing guarantee once more than one union member declares a `jobType` field.
function isStaleJobSweepEvent(event: ScraperEvent): event is StaleJobSweepEvent {
  return (event as { jobType?: unknown }).jobType === 'stale-job-sweep';
}
function isPollAndDrainEvent(event: ScraperEvent): event is PollAndDrainEvent {
  return (event as { jobType?: unknown }).jobType === 'poll-and-drain';
}

export const handler = async (
  event: ScraperEvent,
  context: Context
): Promise<void> => {
  console.log('Scraper lambda invoked', JSON.stringify({ event }));

  // Check for stale job sweep EventBridge trigger
  if (isStaleJobSweepEvent(event)) {
    console.log('Running stale job sweep');
    await runStaleJobSweep();
    return;
  }

  // Prod-only (AC3): the EventBridge-scheduled poll-and-drain trigger, replacing the
  // continuous SqsEventSource poller. Mirrors the SQS-Records branch's per-message logic
  // exactly, just fed by pollAndDrainQueue's explicit receive/delete loop instead.
  if (isPollAndDrainEvent(event)) {
    console.log('Running poll-and-drain for scraping queue');
    await pollAndDrainQueue(process.env.SCRAPING_QUEUE_URL!, async (body) => {
      const target = JSON.parse(body);
      await processScrapeJob(target);
    });
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
    let batchRunId: string | null = null;
    try {
      // Open the per-cycle audit row for THIS EventBridge invocation (IDEA-013). Purely
      // additive observability (sibling of the recordProviderHealthCheck calls below) -- a
      // failure to record must never abort the actual scrape, so we swallow it here.
      try {
        batchRunId = await recordScraperBatchRunStart();
      } catch (startErr) {
        console.error('Failed to record scraper batch run start:', startErr);
      }

      const targets = await getBatchScrapeTargets();
      console.log(`Found ${targets.length} distinct targets to scrape`);

      // FIND-035: loaded once for the whole batch, not per-target inside the map below.
      const env = loadBackendEnv();

      const results = await Promise.allSettled(
        targets.map(async (target): Promise<{ brightData: ScraperTargetProviderMarker; apify: ScraperTargetProviderMarker }> => {
          // FIND-035: incremental per-target window -- scrape from where we left off for
          // this account (newestPostPublishedAt) instead of a hardcoded window re-requested
          // by every account on every run. Only an account with no posts yet (first-ever
          // scrape) falls back to the configured initial lookback.
          const newerThan = target.newestPostPublishedAt?.toISOString()
            ?? lookbackFallback(env.scrapeInitialLookbackDays);
          // Observability for FIND-035: makes the actual per-account window visible in
          // CloudWatch, so a regression back to a wide/hardcoded window is visible without
          // needing to inspect vendor billing after the fact.
          console.log(`Scraping ${target.username} for posts newer than ${newerThan}`);

          // Try Bright Data first for Instagram
          if (target.platform === 'instagram') {
            const brightDataResult = await attemptBrightDataTrigger(target, newerThan);
            if (brightDataResult.success) {
              console.log(`Triggered Bright Data job for ${target.username}`);
              return { brightData: { attempted: true, succeeded: true }, apify: { attempted: false } };
            }

            // Fall back to Apify async trigger for all platforms
            const apifyResult = await attemptApifyAsyncTrigger(target, newerThan);
            if (apifyResult.success) {
              console.log(`Triggered Apify async job for ${target.username}`);
              return {
                brightData: { attempted: true, succeeded: false, failureReason: brightDataResult.failureReason },
                apify: { attempted: true, succeeded: true },
              };
            }

            // Fall back to SQS queue if both async tiers fail
            await enqueueScrapeJob(target);
            return {
              brightData: { attempted: true, succeeded: false, failureReason: brightDataResult.failureReason },
              apify: { attempted: true, succeeded: false, failureReason: apifyResult.failureReason },
            };
          }

          // Fall back to Apify async trigger for all platforms
          const apifyResult = await attemptApifyAsyncTrigger(target, newerThan);
          if (apifyResult.success) {
            console.log(`Triggered Apify async job for ${target.username}`);
            return { brightData: { attempted: false }, apify: { attempted: true, succeeded: true } };
          }

          // Fall back to SQS queue if both async tiers fail
          await enqueueScrapeJob(target);
          return { brightData: { attempted: false }, apify: { attempted: true, succeeded: false, failureReason: apifyResult.failureReason } };
        })
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.error(`Failed to dispatch ${failedCount} out of ${targets.length} scrape jobs`);
      } else {
        console.log(`Successfully dispatched all ${targets.length} scrape jobs`);
      }

      // Tally per-provider attempts/successes across the batch and record a health check
      // for each provider with any attempt, so a persistently-failing provider can be
      // surfaced to moderators (Story 3.4q / Story 3.4r) -- purely additive observability,
      // no change to the fallback control flow above.
      const fulfilledResults = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);

      const brightDataTally = tallyScraperProviderResults(
        fulfilledResults.map((r) => r.brightData)
      );
      if (brightDataTally.attempted > 0) {
        try {
          await recordProviderHealthCheck('brightdata', brightDataTally);
        } catch (healthCheckErr) {
          console.error('Failed to record Bright Data provider health check:', healthCheckErr);
        }
      }

      const apifyTally = tallyScraperProviderResults(
        fulfilledResults.map((r) => r.apify)
      );
      if (apifyTally.attempted > 0) {
        try {
          await recordProviderHealthCheck('apify', apifyTally);
        } catch (healthCheckErr) {
          console.error('Failed to record Apify provider health check:', healthCheckErr);
        }
      }
      // Close the per-cycle audit row for this invocation (IDEA-013): record how many
      // targets were found and how many dispatches ultimately succeeded/failed, so a
      // '0 targets found' cycle is distinguishable from a missed cron. A target counts as
      // dispatched-succeeded if EITHER provider tier succeeded for it.
      const dispatchedSucceeded = fulfilledResults.filter(
        (r) => r.brightData.succeeded || r.apify.succeeded
      ).length;
      const dispatchedFailed = targets.length - dispatchedSucceeded;

      if (batchRunId) {
        try {
          await completeScraperBatchRun(batchRunId, {
            targetsFound: targets.length,
            dispatchedSucceeded,
            dispatchedFailed,
          });
        } catch (completeErr) {
          console.error('Failed to record scraper batch run completion:', completeErr);
        }
      }
    } catch (err) {
      console.error('Failed to retrieve or dispatch batch scrape targets:', err);
      // Still record that the cron fired (leaving the row completed with zero tallies) even
      // when the batch itself failed, so a mid-batch crash isn't confused with a never-fired
      // cron in scraper_batch_runs (IDEA-013).
      if (batchRunId) {
        try {
          await completeScraperBatchRun(batchRunId, {
            targetsFound: 0,
            dispatchedSucceeded: 0,
            dispatchedFailed: 0,
          });
        } catch (completeErr) {
          console.error('Failed to record scraper batch run completion on error path:', completeErr);
        }
      }
      throw err;
    }
  }
};
