import { isProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { getScrapeCursor } from './get-scrape-cursor.js';
import { shouldSkipDegradedProvider } from './provider-run-health-store.js';
import { triggerBrightDataJob, mapBrightDataDateToStartDate } from './brightdata-client.js';
import { createPendingJob } from './brightdata-pending-jobs-store.js';
import { loadBackendEnv } from '../../env.js';
import { recordActorRunStart } from './record-actor-run.js';
import { generateWebhookToken } from './generate-webhook-token.js';
import { VendorDpaNotConfirmedError } from '../vendor-gateway/guarded-call.js';
import type { ScraperTriggerResult } from './scraper-trigger-result.js';

export let attemptBrightDataTrigger = async (
  target: { profileId: string; username: string },
  newerThan: string
): Promise<ScraperTriggerResult> => {
  try {
    const hasCapacity = await isProviderCapacityAvailable('brightdata');
    if (!hasCapacity) {
      console.log(`Bright Data capacity exhausted for ${target.username}`);
      return { success: false, failureReason: 'CAPACITY_EXHAUSTED' };
    }

    // IDEA-095: a provider whose recent runs returned nothing or failed is skipped (bar one probe) so
    // the next provider in the chain takes the target.
    if (await shouldSkipDegradedProvider('BRIGHTDATA')) {
      console.log(`Bright Data is degraded; skipping ${target.username} in favour of another provider`);
      return { success: false, failureReason: 'PROVIDER_DEGRADED' };
    }

    const env = loadBackendEnv();
    const webhookToken = generateWebhookToken();
    const webhookUrl = `${env.brightdataWebhookBaseUrl}?jobToken=${webhookToken}`;

    // The cursor is where this profile's stored posts end, never when a run finished (BUG-074):
    // a run that returned nothing must not move it. `newerThan` only matters for a profile with
    // no stored post yet.
    const scrapeCursorTimestamp = await getScrapeCursor('BRIGHTDATA', target.profileId, newerThan);
    const startDate = mapBrightDataDateToStartDate(scrapeCursorTimestamp);
    const profileUrl = `https://www.instagram.com/${target.username}/`;

    const triggerResult = await triggerBrightDataJob(
      {
        url: profileUrl,
        numOfPosts: env.scrapeResultsLimit || 10,
        startDate,
      },
      webhookUrl
    );

    // Record audit trail at trigger time (without pendingJobId initially)
    const auditRunId = await recordActorRunStart({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId: target.profileId,
      runId: triggerResult.snapshotId,
      rawInput: {
        url: profileUrl,
        numOfPosts: env.scrapeResultsLimit || 10,
        startDate,
      },
      status: 'PENDING',
    });

    // Create pending job row (with the audit run ID so it can be threaded through the webhook)
    await createPendingJob({
      profileId: target.profileId,
      snapshotId: triggerResult.snapshotId,
      webhookToken,
      scraperActorRunId: auditRunId || undefined,
    });

    // Record usage
    await recordProviderUsage('brightdata', 1);

    return { success: true };
  } catch (error) {
    // Story 0.i2d (AC6) — a deliberate, self-imposed DPA-gate closure is not a real vendor
    // outage; map it to its own failure reason so the daily batch tally doesn't misreport it.
    if (error instanceof VendorDpaNotConfirmedError) {
      return { success: false, failureReason: 'DPA_NOT_CONFIRMED' };
    }
    console.error(`Failed to trigger Bright Data job for ${target.username}:`, error);
    return { success: false, failureReason: 'TRIGGER_ERROR' };
  }
};

export function setAttemptBrightDataTrigger(fn: typeof attemptBrightDataTrigger) {
  attemptBrightDataTrigger = fn;
}
