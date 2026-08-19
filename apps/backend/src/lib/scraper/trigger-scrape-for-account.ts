import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { attemptBrightDataTrigger } from './trigger-brightdata-for-target.js';
import { attemptApifyAsyncTrigger } from './trigger-apify-for-target.js';
import { enqueueScrapeJob } from './enqueue-scrape-job.js';
import { processScrapeJob } from './process-scrape-job.js';
import { loadBackendEnv } from '../../env.js';
import type { ScrapeTarget } from './get-scrape-targets.js';

export async function triggerScrapeForAccount(scrapeTarget: ScrapeTarget, newerThan: string): Promise<void> {
  // First, stamp scrapeTriggeredAt for this account to mark the in-progress state
  await db
    .update(socialMediaAccountProfiles)
    .set({ scrapeTriggeredAt: new Date() })
    .where(eq(socialMediaAccountProfiles.id, scrapeTarget.profileId));

  const env = loadBackendEnv();
  if (env.scrapingQueueUrl) {
    try {
      // Try Apify async trigger first
      const apifyAsyncTriggered = await attemptApifyAsyncTrigger(scrapeTarget, newerThan);
      if (apifyAsyncTriggered) {
        return;
      }

      // Fall back to Bright Data for Instagram
      if (scrapeTarget.platform === 'instagram') {
        const brightDataTriggered = await attemptBrightDataTrigger(scrapeTarget, newerThan);
        if (brightDataTriggered) {
          return;
        }
      }

      // Fall back to SQS queue if both async tiers fail
      await enqueueScrapeJob(scrapeTarget);
    } catch (err) {
      console.error(`Failed to enqueue on-demand scrape job for profile ${scrapeTarget.profileId}:`, err);
    }
  } else if (env.scrapeInlineFallbackEnabled) {
    // No queue configured and inline fallback explicitly opted into (local dev only,
    // via SCRAPE_INLINE_FALLBACK_ENABLED in a personal .env): process the scrape job
    // inline instead of enqueuing, since there's no Lambda locally to drain the queue.
    // Fire-and-forget, mirroring the async nature of the queue path so subscribing
    // doesn't block on the scrape. Left off by default so tests/CI never hit Apify.
    processScrapeJob(scrapeTarget).catch((err) => {
      console.error(`Failed to process on-demand scrape job inline for profile ${scrapeTarget.profileId}:`, err);
    });
  } else {
    console.error(`Failed to enqueue on-demand scrape job for profile ${scrapeTarget.profileId}: SCRAPING_QUEUE_URL is not configured`);
  }
}
