import { isProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { triggerBrightDataJob, mapBrightDataDateToStartDate } from './brightdata-client.js';
import { createPendingJob } from './brightdata-pending-jobs-store.js';
import { loadBackendEnv } from '../../env.js';
import { recordActorRunStart } from './record-actor-run.js';
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

    const env = loadBackendEnv();
    const webhookToken = await generateWebhookToken();
    const webhookUrl = `${env.brightdataWebhookBaseUrl}?jobToken=${webhookToken}`;

    const startDate = mapBrightDataDateToStartDate(newerThan);
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
    console.error(`Failed to trigger Bright Data job for ${target.username}:`, error);
    return { success: false, failureReason: 'TRIGGER_ERROR' };
  }
};

export function setAttemptBrightDataTrigger(fn: typeof attemptBrightDataTrigger) {
  attemptBrightDataTrigger = fn;
}

async function generateWebhookToken(): Promise<string> {
  const crypto = await import('crypto');
  return crypto.randomBytes(24).toString('hex');
}
