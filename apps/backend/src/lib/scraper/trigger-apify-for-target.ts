import { getApifyClient } from './instagram-adapter.js';
import { createPendingJob } from './apify-pending-jobs-store.js';
import { recordProviderUsage, isProviderCapacityAvailable } from './usage-store.js';
import { loadBackendEnv } from '../../env.js';
import { recordActorRunStart } from './record-actor-run.js';

export interface ScrapeTarget {
  profileId: string;
  username: string;
}

export let attemptApifyAsyncTrigger = async (
  target: ScrapeTarget,
  newerThan: string
): Promise<boolean> => {
  const env = loadBackendEnv();

  // Check capacity availability
  try {
    await isProviderCapacityAvailable('apify', `account ${target.username}`);
  } catch {
    // Capacity exhausted, fall back to sync path
    return false;
  }

  try {
    // Generate token BEFORE making the trigger call
    const webhookToken = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');

    // Build webhook URL
    const webhookUrl = `${env.apifyWebhookBaseUrl}?jobToken=${webhookToken}`;

    // Get Apify client
    const client = getApifyClient();

    // Trigger async run with webhooks
    const run = await client.actor('apify/instagram-api-scraper').start(
      {
        directUrls: [`https://www.instagram.com/${target.username}/`],
        resultsType: 'posts',
        resultsLimit: env.scrapeResultsLimit,
        onlyPostsNewerThan: newerThan,
      },
      {
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
            requestUrl: webhookUrl,
          },
        ],
      }
    );

    // Create pending job row (with the pre-generated token and now-known runId)
    const pendingJob = await createPendingJob({
      profileId: target.profileId,
      runId: run.id,
    });

    // Record audit trail at trigger time
    await recordActorRunStart({
      vendor: 'apify',
      triggerMode: 'async',
      profileId: target.profileId,
      runId: run.id,
      rawInput: {
        directUrls: [`https://www.instagram.com/${target.username}/`],
        resultsType: 'posts',
        resultsLimit: env.scrapeResultsLimit,
        onlyPostsNewerThan: newerThan,
      },
      pendingJobId: pendingJob.id,
      status: 'PENDING',
    });

    // Record usage (nominal trigger-time accounting)
    await recordProviderUsage('apify', 1);

    return true;
  } catch (error) {
    console.error(`Failed to trigger Apify async job for ${target.username}:`, error);
    return false;
  }
};

export function setAttemptApifyAsyncTrigger(fn: typeof attemptApifyAsyncTrigger) {
  attemptApifyAsyncTrigger = fn;
}
