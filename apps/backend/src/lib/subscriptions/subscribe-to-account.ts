import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { ScraperCapacityExceededError, ScrapablePlatform } from '@festgrid/domain';
import { verifyAccountProfileForDiscovery } from '../accounts/verify-account-profile-for-discovery.js';
import { computeClaimCutoff } from '@festgrid/domain/shared';
import { loadBackendEnv } from '../../env.js';
import { isProviderCapacityAvailable } from '../scraper/usage-store.js';
import { triggerScrapeForAccount } from '../scraper/trigger-scrape-for-account.js';
import { classifyAccountType } from '../accounts/classify-account-type.js';

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

  // If absent, insert one and re-select safely (handling concurrent insertions). Story 3.16
  // (Task 3.1): this branch is now find-or-create ONLY -- the capacity check and the
  // classify-then-maybe-scrape cascade both moved out of here (see below), so they also cover a
  // pre-existing, never-classified profile (e.g. one created by Story 3.14's
  // getOrCreateDiscoveredAccountProfile), not just a profile this exact call just inserted.
  if (!accountProfile) {
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
  }

  // 1b. Classify-then-maybe-trigger-scrape cascade (AC2), gated by an atomic TTL-reclaimable
  // claim so it runs at most once per account even when two subscribe requests for the same
  // still-unclassified account race concurrently (Story 3.16, Task 3.2/3.3). Runs for ANY
  // profile that has never been classified (accountTypeStatus === null) -- both a just-inserted
  // row and a pre-existing row -- which is what closes the gap left by Story 3.14's
  // getOrCreateDiscoveredAccountProfile (by design, never classifies, never scrapes).
  if (accountProfile && accountProfile.accountTypeStatus === null) {
    const env = loadBackendEnv();
    const now = new Date();
    const cutoff = computeClaimCutoff(env.accountClassificationClaimTtlMinutes, now);

    const [claimed] = await db
      .update(socialMediaAccountProfiles)
      .set({ classificationClaimedAt: now })
      .where(
        and(
          eq(socialMediaAccountProfiles.id, accountProfile.id),
          isNull(socialMediaAccountProfiles.accountTypeStatus),
          // Unclaimed, or claimed but past its TTL (reclaimable) -- mirrors
          // enqueuePostForProcessing's identical idiom on posts.queuedForExtractionAt.
          or(
            isNull(socialMediaAccountProfiles.classificationClaimedAt),
            lt(socialMediaAccountProfiles.classificationClaimedAt, cutoff)
          )
        )
      )
      .returning();

    if (claimed) {
      // This caller won the claim: check capacity (Apify first, then Bright Data fallback)
      // before actually classifying/scraping.
      const apifyAvailable = await isProviderCapacityAvailable('apify');
      const brightDataAvailable = await isProviderCapacityAvailable('brightdata');

      if (!apifyAvailable && !brightDataAvailable) {
        // Release the claim before rethrowing -- a capacity failure is not a legitimate
        // in-flight classification attempt, so it shouldn't hold the claim for the full TTL for
        // nothing (mirrors enqueuePostForProcessing's send-time-failure release pattern).
        await db
          .update(socialMediaAccountProfiles)
          .set({ classificationClaimedAt: null })
          .where(eq(socialMediaAccountProfiles.id, accountProfile.id));
        throw new ScraperCapacityExceededError('Scraper capacity temporarily exceeded — new subscriptions are paused until next cycle.');
      }

      const classification = await classifyAccountType({
        accountId: accountProfile.id,
        username: accountProfile.username,
        userId,
      });

      // classifyAccountType() persists accountType/accountTypeStatus to the DB row directly;
      // merge its return value into our in-memory snapshot so callers (and the existing-subscription
      // check below) don't see the stale pre-classification values.
      accountProfile = {
        ...accountProfile,
        accountType: classification.accountType,
        accountTypeStatus: classification.accountTypeStatus,
      };

      if (classification.accountType === 'ORGANIZER_VENUE_EVENT' && classification.accountTypeStatus === 'CONFIRMED') {
        const scrapeTarget = {
          profileId: accountProfile.id,
          platform: accountProfile.platform as ScrapablePlatform,
          accountId: accountProfile.accountId,
          username: accountProfile.username,
          isInitialNewSubscription: true,
        };

        const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await triggerScrapeForAccount(scrapeTarget, newerThan);
      }
    }
    // When `claimed` is falsy: another request already claimed or already finished classifying
    // this exact profile. Do nothing -- no error, no retry. AC1 requires the subscription to
    // always succeed; AC2 only requires the cascade to run once per account, not once per
    // subscriber.
  }

  // 1c. Flip isVerifiedForDiscovery false -> true unconditionally on subscribe (AC4) -- the
  // signal Story 3.17's demand-gated discovery read-path consumes. Independent of the
  // accountTypeStatus === null branch above: it must also apply to an already-classified profile
  // subscribed to for the first time (e.g. a coauthor profile classified by a different path
  // before anyone subscribed). Placed before the existing-subscription check so the returned
  // accountProfile always reflects the final isVerifiedForDiscovery value. Shared with `castVote`
  // (Story 3.17) via verifyAccountProfileForDiscovery -- see that helper for the idempotent-no-op
  // behavior when the profile is already `true`.
  if (accountProfile) {
    const verified = await verifyAccountProfileForDiscovery(accountProfile.id);
    if (verified) {
      accountProfile = verified;
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
