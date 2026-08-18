import { isProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { triggerBrightDataJob, mapBrightDataDateToStartDate } from './brightdata-client.js';
import { createPendingJob } from './brightdata-pending-jobs-store.js';
import { loadBackendEnv } from '../../env.js';

export async function attemptBrightDataTrigger(
  target: { profileId: string; username: string },
  newerThan: string
): Promise<boolean> {
  try {
    const hasCapacity = await isProviderCapacityAvailable('brightdata');
    if (!hasCapacity) {
      console.log(`Bright Data capacity exhausted for ${target.username}`);
      return false;
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

    // Create pending job row
    const pendingJob = await createPendingJob({
      profileId: target.profileId,
      snapshotId: triggerResult.snapshotId,
    });

    // Verify the webhook token matches what we created
    if (pendingJob.webhookToken !== webhookToken) {
      console.error('Webhook token mismatch - this should not happen');
    }

    // Record usage
    await recordProviderUsage('brightdata', 1);

    return true;
  } catch (error) {
    console.error(`Failed to trigger Bright Data job for ${target.username}:`, error);
    return false;
  }
}

async function generateWebhookToken(): Promise<string> {
  const crypto = await import('crypto');
  return crypto.randomBytes(24).toString('hex');
}
