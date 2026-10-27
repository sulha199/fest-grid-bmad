import type { SQSEvent, EventBridgeEvent, Context } from 'aws-lambda';
import '../lib/scraper/register-adapters.js';
import { getBatchScrapeTargets } from '../lib/scraper/get-scrape-targets.js';
import { explainEmptyScrapeCycle } from '../lib/scraper/explain-empty-scrape-cycle.js';
import { getScheduledCycleTime } from '../lib/scraper/scheduled-cycle-time.js';
import { enqueueScrapeJob } from '../lib/scraper/enqueue-scrape-job.js';
import { processScrapeJob } from '../lib/scraper/process-scrape-job.js';
import { pollAndDrainQueue, hasJobType } from '../lib/aws/poll-and-drain-queue.js';
import { attemptBrightDataTrigger } from '../lib/scraper/trigger-brightdata-for-target.js';
import { attemptApifyAsyncTrigger } from '../lib/scraper/trigger-apify-for-target.js';
import { settleWithConcurrencyLimit } from '../lib/scraper/settle-with-concurrency-limit.js';
import { runStaleJobSweep } from '../lib/scraper/stale-job-sweep.js';
import {
  recordProviderHealthCheck,
  type ProviderHealthCheckPrevious,
} from '../lib/scraper/scraper-provider-health-store.js';
import { getDegradedProviders } from '../lib/scraper/provider-run-health-store.js';
import {
  recordScraperBatchRunStart,
  completeScraperBatchRun,
} from '../lib/scraper/record-scraper-batch-run.js';
import {
  applyProviderDegradation,
  countProviderDegradedSkips,
  tallyScraperProviderResults,
  type ScraperProviderTally,
  type ScraperTargetProviderMarker,
} from '../lib/scraper/tally-scraper-provider-results.js';
import { loadBackendEnv } from '../env.js';
import { emitOpsMetric, OpsMetric } from '../lib/metrics/emit-metric.js';

// FIND-035: fallback window for a target with no `newestPostPublishedAt` (i.e. no posts
// yet -- its first-ever scrape). Mirrors the fallback branch already proven correct in
// process-scrape-job.ts's SQS-fallback path.
function lookbackFallback(days: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString();
}

// IDEA-095: the one-line record, in CloudWatch, of a provider being switched away from or coming back.
// Only the day the state changes is logged; a provider that stays degraded is already visible in
// scraper_provider_health and, after the alert threshold, in the provider-down e-mail.
function logProviderTransition(provider: string, previous: ProviderHealthCheckPrevious, tally: ScraperProviderTally): void {
  const failingNow = tally.attempted > 0 && tally.succeeded === 0;
  if (failingNow && tally.failureReason === 'PROVIDER_DEGRADED' && previous.consecutiveFailureDays === 0) {
    console.error(
      `[Provider failover] ${provider} is degraded: its recent runs mostly failed or returned no posts. While it is, only a few probe triggers go to it per interval and the rest go to the next provider; a probe the vendor answers brings it back.`
    );
    emitOpsMetric(OpsMetric.ProviderDegraded, 1, { Provider: provider });
  } else if (!failingNow && previous.consecutiveFailureDays > 0 && previous.lastFailureReason === 'PROVIDER_DEGRADED') {
    console.warn(`[Provider failover] ${provider} has recovered: its newest run was a good result, so it is back in the chain.`);
    emitOpsMetric(OpsMetric.ProviderRecovered, 1, { Provider: provider });
  }
}

// Persisting a scrape's posts and enqueueing their extraction, on top of the vendor call itself.
const QUEUE_JOB_OVERHEAD_MS = 15_000;

// What one target's dispatch did: each provider's marker for the health tally, and whether the target
// ended up on the scraping queue because no async vendor took it.
interface DispatchOutcome {
  brightData: ScraperTargetProviderMarker;
  apify: ScraperTargetProviderMarker;
  queued: boolean;
}

type PollAndDrainEvent = { jobType: 'poll-and-drain' };
type StaleJobSweepEvent = { jobType: 'stale-job-sweep' };
type ScraperEvent = SQSEvent | EventBridgeEvent<string, unknown> | PollAndDrainEvent | StaleJobSweepEvent;

export const handler = async (
  event: ScraperEvent,
  context: Context
): Promise<void> => {
  console.log('Scraper lambda invoked', JSON.stringify({ event }));

  // Check for stale job sweep EventBridge trigger
  if (hasJobType(event, 'stale-job-sweep')) {
    console.log('Running stale job sweep');
    await runStaleJobSweep();
    return;
  }

  // Prod-only (AC3): the EventBridge-scheduled poll-and-drain trigger, replacing the
  // continuous SqsEventSource poller. Mirrors the SQS-Records branch's per-message logic
  // exactly, just fed by pollAndDrainQueue's explicit receive/delete loop instead.
  if (hasJobType(event, 'poll-and-drain')) {
    console.log('Running poll-and-drain for scraping queue');
    const queueEnv = loadBackendEnv();
    await pollAndDrainQueue(
      process.env.SCRAPING_QUEUE_URL!,
      async (body) => {
        const target = JSON.parse(body);
        // Rethrow a failed scrape: the message is then left undeleted and SQS redelivers it after the
        // visibility timeout, up to maxReceiveCount (3) and then the DLQ. Swallowing it deleted the
        // message and lost the account until the next daily batch.
        await processScrapeJob(target, { rethrowOnFailure: true });
      },
      // One job is one Apify call (bounded by the queue budget) plus its persistence; size each receive so
      // the whole batch finishes inside the poll-and-drain budget and the queue's 300s visibility timeout.
      // Waiting for the account's memory cap to lift (BUG-083) happens inside that call budget, not on top.
      { perMessageBudgetMs: queueEnv.scrapeQueueApifyCallTimeoutMs + QUEUE_JOB_OVERHEAD_MS }
    );
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

      // A scheduled cycle is judged against its own fire time, not the rolling skip window, so a manual
      // or recovery rerun late the day before cannot starve it (2026-10-24). Anything else -- an empty
      // manual invoke -- keeps the rolling SCRAPE_SKIP_RECENT_HOURS window.
      const scheduledTime = getScheduledCycleTime(event);
      console.log(
        scheduledTime
          ? `Scheduled cycle fired at ${scheduledTime.toISOString()}`
          : 'Manual (non-scheduled) invocation: using the rolling skip-recent window'
      );

      const targets = await getBatchScrapeTargets({ scheduledTime });
      console.log(`Found ${targets.length} distinct targets to scrape`);

      // A 0-target cycle used to leave only that line, indistinguishable from "nobody subscribed".
      // Record why; diagnosing must never abort the run, so a failure here is only logged.
      let noTargetsReason: string | undefined;
      if (targets.length === 0) {
        try {
          const explanation = await explainEmptyScrapeCycle({ scheduledTime });
          noTargetsReason = explanation.reason;
          console.warn(`Scrape cycle found 0 targets: ${explanation.reason}`);
        } catch (explainErr) {
          console.error('Failed to explain the empty scrape cycle:', explainErr);
        }
      }

      // FIND-035: loaded once for the whole batch, not per-target inside the map below.
      const env = loadBackendEnv();

      // IDEA-095: which providers were already returning nothing or failing when this batch began.
      // Their triggers are skipped (bar one probe) inside the attempt functions; the same state is
      // used below to record the day as a failure for them. Never throws.
      const degradedProviders = await getDegradedProviders();

      // Bounded, not all at once: Apify caps the memory an account may run concurrently, and 35 triggers
      // fired together got 31 of them refused with 402 `actor-memory-limit-exceeded` (2026-10-23).
      const results = await settleWithConcurrencyLimit(
        targets,
        env.scrapeTriggerConcurrency,
        async (target): Promise<DispatchOutcome> => {
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
              return { brightData: { attempted: true, succeeded: true }, apify: { attempted: false }, queued: false };
            }

            // Fall back to Apify async trigger for all platforms
            const apifyResult = await attemptApifyAsyncTrigger(target, newerThan);
            if (apifyResult.success) {
              console.log(`Triggered Apify async job for ${target.username}`);
              return {
                brightData: { attempted: true, succeeded: false, failureReason: brightDataResult.failureReason },
                apify: { attempted: true, succeeded: true },
                queued: false,
              };
            }

            // Fall back to SQS queue if both async tiers fail
            await enqueueScrapeJob(target);
            return {
              brightData: { attempted: true, succeeded: false, failureReason: brightDataResult.failureReason },
              apify: { attempted: true, succeeded: false, failureReason: apifyResult.failureReason },
              queued: true,
            };
          }

          // Fall back to Apify async trigger for all platforms
          const apifyResult = await attemptApifyAsyncTrigger(target, newerThan);
          if (apifyResult.success) {
            console.log(`Triggered Apify async job for ${target.username}`);
            return { brightData: { attempted: false }, apify: { attempted: true, succeeded: true }, queued: false };
          }

          // Fall back to SQS queue if both async tiers fail
          await enqueueScrapeJob(target);
          return { brightData: { attempted: false }, apify: { attempted: true, succeeded: false, failureReason: apifyResult.failureReason }, queued: true };
        }
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

      // A provider that was degraded during the batch (at its start, or skipped by any target) has had
      // a failure day whatever its triggers did: the probes it was sent can only be judged by their
      // results, which arrive after this batch.
      const brightDataMarkers = fulfilledResults.map((r) => r.brightData);
      const brightDataTally = applyProviderDegradation(
        tallyScraperProviderResults(brightDataMarkers),
        degradedProviders.has('BRIGHTDATA') || countProviderDegradedSkips(brightDataMarkers) > 0
      );
      if (brightDataTally.attempted > 0) {
        try {
          const previous = await recordProviderHealthCheck('brightdata', brightDataTally);
          logProviderTransition('brightdata', previous, brightDataTally);
        } catch (healthCheckErr) {
          console.error('Failed to record Bright Data provider health check:', healthCheckErr);
        }
      }

      const apifyMarkers = fulfilledResults.map((r) => r.apify);
      const apifyTally = applyProviderDegradation(
        tallyScraperProviderResults(apifyMarkers),
        degradedProviders.has('APIFY') || countProviderDegradedSkips(apifyMarkers) > 0
      );
      if (apifyTally.attempted > 0) {
        try {
          const previous = await recordProviderHealthCheck('apify', apifyTally);
          logProviderTransition('apify', previous, apifyTally);
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
      // A target the async vendors declined but that reached the scraping queue is a working fallback
      // (the queue worker scrapes it), so it is its own number: counting it as failed made a healthy
      // fallback read as an outage (2026-10-23: 31 "failed", all 31 queued).
      const dispatchedQueued = fulfilledResults.filter(
        (r) => !r.brightData.succeeded && !r.apify.succeeded && r.queued
      ).length;
      const dispatchedFailed = targets.length - dispatchedSucceeded - dispatchedQueued;

      if (batchRunId) {
        try {
          await completeScraperBatchRun(batchRunId, {
            targetsFound: targets.length,
            dispatchedSucceeded,
            dispatchedFailed,
            dispatchedQueued,
            noTargetsReason,
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
