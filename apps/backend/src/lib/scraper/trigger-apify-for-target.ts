import { db } from '../../db/client.js';
import { scraperActorRuns } from '@festgrid/database';
import { eq, desc } from 'drizzle-orm';
import { callApifyClient } from './instagram-adapter.js';
import { createPendingJob } from './apify-pending-jobs-store.js';
import { recordProviderUsage, isProviderCapacityAvailable } from './usage-store.js';
import { loadBackendEnv } from '../../env.js';
import { recordActorRunStart } from './record-actor-run.js';
import { generateWebhookToken } from './generate-webhook-token.js';
import { VendorDpaNotConfirmedError } from '../vendor-gateway/guarded-call.js';
import type { ScrapeTarget as FullScrapeTarget } from './get-scrape-targets.js';
import type { ScraperTriggerResult } from './scraper-trigger-result.js';

export type ScrapeTarget = Pick<FullScrapeTarget, 'profileId' | 'username'>;

export let attemptApifyAsyncTrigger = async (
  target: ScrapeTarget,
  newerThan: string
): Promise<ScraperTriggerResult> => {
  const env = loadBackendEnv();

  // Check capacity availability. NOTE: isProviderCapacityAvailable returns a plain
  // boolean and never throws, so we must inspect its return value directly (the old
  // try/catch here was dead code that never actually skipped on capacity exhaustion --
  // Story 3.4r Task 1).
  const hasCapacity = await isProviderCapacityAvailable('apify');
  if (!hasCapacity) {
    // Capacity exhausted, fall back to sync path
    return { success: false, failureReason: 'CAPACITY_EXHAUSTED' };
  }

  try {
    // Generate token BEFORE making the trigger call
    const webhookToken = generateWebhookToken();

    // Build webhook URL
    const webhookUrl = `${env.apifyWebhookBaseUrl}?jobToken=${webhookToken}`;

    // Use the last successful scraper run timestamp as the cursor, falling back to newerThan
    // This ensures we don't re-scrape posts already captured, regardless of vendor
    const lastSuccessfulRun = await db.query.scraperActorRuns.findFirst({
      where: eq(scraperActorRuns.profileId, target.profileId),
      orderBy: desc(scraperActorRuns.completedAt),
    });

    const scrapeCursorTimestamp = lastSuccessfulRun?.completedAt?.toISOString() ?? newerThan;

    // Trigger async run with webhooks, routed through the shared guarded wrapper (AD-32).
    // maxAttempts: 1 -- `.start()` is not idempotent: retrying after a lost response (5xx /
    // ECONNRESET) could start a second paid run that no pending-job row tracks. The fallback
    // chain in trigger-scrape-for-account / lambdas/scraper already handles a failed trigger.
    const run = await callApifyClient(
      { timeoutMs: 30_000, maxAttempts: 1 },
      (client) =>
        client.actor('apify/instagram-api-scraper').start(
          {
            directUrls: [`https://www.instagram.com/${target.username}/`],
            resultsType: 'posts',
            resultsLimit: env.scrapeResultsLimit,
            onlyPostsNewerThan: scrapeCursorTimestamp,
          },
          {
            webhooks: [
              {
                eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
                requestUrl: webhookUrl,
              },
            ],
          }
        )
    );

    // Record audit trail at trigger time (without pendingJobId initially)
    const auditRunId = await recordActorRunStart({
      vendor: 'APIFY',
      triggerMode: 'ASYNC',
      profileId: target.profileId,
      runId: run.id,
      rawInput: {
        directUrls: [`https://www.instagram.com/${target.username}/`],
        resultsType: 'posts',
        resultsLimit: env.scrapeResultsLimit,
        onlyPostsNewerThan: scrapeCursorTimestamp,
      },
      status: 'PENDING',
    });

    // Create pending job row (with the audit run ID so it can be threaded through the webhook)
    const pendingJob = await createPendingJob({
      profileId: target.profileId,
      runId: run.id,
      webhookToken,
      scraperActorRunId: auditRunId || undefined,
    });

    // Record usage (nominal trigger-time accounting)
    await recordProviderUsage('apify', 1);

    return { success: true };
  } catch (error) {
    // Story 0.i2d (AC6) — a deliberate, self-imposed DPA-gate closure is not a real vendor
    // outage; map it to its own failure reason so the daily batch tally doesn't misreport it.
    if (error instanceof VendorDpaNotConfirmedError) {
      return { success: false, failureReason: 'DPA_NOT_CONFIRMED' };
    }
    console.error(`Failed to trigger Apify async job for ${target.username}:`, error);
    return { success: false, failureReason: 'TRIGGER_ERROR' };
  }
};

export function setAttemptApifyAsyncTrigger(fn: typeof attemptApifyAsyncTrigger) {
  attemptApifyAsyncTrigger = fn;
}
