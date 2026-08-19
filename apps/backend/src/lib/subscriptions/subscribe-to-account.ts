import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { and, eq } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { ScraperCapacityExceededError, SupportedPlatform } from '@festgrid/domain';
import { isProviderCapacityAvailable } from '../scraper/usage-store.js';
import { triggerScrapeForAccount } from '../scraper/trigger-scrape-for-account.js';

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
    // Check capacity: Apify first, then Bright Data fallback
    const apifyAvailable = await isProviderCapacityAvailable('apify');
    const brightDataAvailable = await isProviderCapacityAvailable('brightdata');

    if (!apifyAvailable && !brightDataAvailable) {
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

      const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await triggerScrapeForAccount(scrapeTarget, newerThan);
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
