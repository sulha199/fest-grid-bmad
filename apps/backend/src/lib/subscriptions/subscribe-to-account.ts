import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { and, eq } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { ScraperCapacityExceededError, SupportedPlatform } from '@festgrid/domain';
import { isProviderCapacityAvailable } from '../scraper/usage-store.js';
import { enqueueScrapeJob } from '../scraper/enqueue-scrape-job.js';
import { processScrapeJob } from '../scraper/process-scrape-job.js';
import { loadBackendEnv } from '../../env.js';

interface ProfileInput {
  displayName: string;
  username: string;
  profileImageUrl?: string | null;
  description?: string | null;
}

interface SubscribeToAccountParams {
  userId: string;
  platform: string;
  accountId: string;
  profile: ProfileInput;
}

export async function subscribeToAccount({
  userId,
  platform,
  accountId,
  profile,
}: SubscribeToAccountParams) {
  // 1. Try to find the existing social media account profile
  let accountProfile = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, platform),
        eq(socialMediaAccountProfiles.accountId, accountId)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  // If absent, insert one and re-select safely (handling concurrent insertions)
  if (!accountProfile) {
    const isAvailable = await isProviderCapacityAvailable('apify');
    if (!isAvailable) {
      throw new ScraperCapacityExceededError('Scraper capacity temporarily exceeded — new subscriptions are paused until next cycle.');
    }

    await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId,
        platform,
        displayName: profile.displayName,
        username: profile.username,
        profileImageUrl: profile.profileImageUrl,
        description: profile.description,
      })
      .onConflictDoNothing({
        target: [socialMediaAccountProfiles.platform, socialMediaAccountProfiles.accountId],
      });

    accountProfile = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(
        and(
          eq(socialMediaAccountProfiles.platform, platform),
          eq(socialMediaAccountProfiles.accountId, accountId)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (accountProfile) {
      const scrapeTarget = {
        profileId: accountProfile.id,
        platform: accountProfile.platform as SupportedPlatform,
        accountId: accountProfile.accountId,
        username: accountProfile.username,
        isInitialNewSubscription: true,
      };

      const env = loadBackendEnv();
      if (env.scrapingQueueUrl) {
        try {
          await enqueueScrapeJob(scrapeTarget);
        } catch (err) {
          console.error(`Failed to enqueue on-demand scrape job for brand-new profile ${accountProfile.id}:`, err);
        }
      } else if (env.scrapeInlineFallbackEnabled) {
        // No queue configured and inline fallback explicitly opted into (local dev only,
        // via SCRAPE_INLINE_FALLBACK_ENABLED in a personal .env): process the scrape job
        // inline instead of enqueuing, since there's no Lambda locally to drain the queue.
        // Fire-and-forget, mirroring the async nature of the queue path so subscribing
        // doesn't block on the scrape. Left off by default so tests/CI never hit Apify.
        processScrapeJob(scrapeTarget).catch((err) => {
          console.error(`Failed to process on-demand scrape job inline for brand-new profile ${accountProfile.id}:`, err);
        });
      } else {
        console.error(`Failed to enqueue on-demand scrape job for brand-new profile ${accountProfile.id}: SCRAPING_QUEUE_URL is not configured`);
      }
    }
  }

  // 2. Check for an existing subscription row for (userId, profile.id) filtered through activeOnly
  const existingSubscription = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.accountId, accountProfile.id),
        activeOnly(subscriptions)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (existingSubscription) {
    return {
      profile: accountProfile,
      subscription: existingSubscription,
      alreadySubscribed: true,
    };
  }

  // 3. Insert a new subscription row with isNewlyAdded: true
  const [newSubscription] = await db
    .insert(subscriptions)
    .values({
      userId,
      accountId: accountProfile.id,
      isNewlyAdded: true,
    })
    .returning();

  return {
    profile: accountProfile,
    subscription: newSubscription,
    alreadySubscribed: false,
  };
}
