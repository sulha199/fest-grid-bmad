import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { HISTORY_SEED_LOOKBACK_DAYS, ScraperCapacityExceededError, ScrapablePlatform, isScrapableAccountType, resolveScrapeHandle } from '@festgrid/domain';
import { verifyAccountProfileForDiscovery } from '../accounts/verify-account-profile-for-discovery.js';
import { computeClaimCutoff } from '@festgrid/domain/shared';
import { loadBackendEnv } from '../../env.js';
import { isProviderCapacityAvailable } from '../scraper/usage-store.js';
import { triggerScrapeForAccount } from '../scraper/trigger-scrape-for-account.js';
import { classifyAccountType } from '../accounts/classify-account-type.js';
import { findProfileByUsername } from '../accounts/find-profile-by-username.js';
import { assertSubscriptionCap, lockUserRow } from './subscription-cap.js';

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
  /** Story 10.3: the add-account job whose own handler is making this call; its reserved slot is not counted against it. */
  consumesReservationOfJobId?: string;
}

export async function subscribeToAccount({
  userId,
  platform,
  accountId,
  profile,
  consumesReservationOfJobId,
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

  // STOPGAP (BUG-059): a typed handle that matches the username of a row scrape ingestion already
  // created under the vendor's numeric ID is the same platform account -- reuse that row instead
  // of creating a handle-keyed twin whose posts would never be attached to the subscription.
  if (!accountProfile && profile.username) {
    const matchedByUsername = await findProfileByUsername(platform, profile.username);
    if (matchedByUsername) {
      accountProfile = matchedByUsername;
    }
  }

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

  // 1a. Story 10.3 (AC7, AC8; PRD FR122) -- the subscription cap, decided BEFORE the classification and scrape cascade
  // below, so a refused subscribe spends no vendor credit. The user row is locked (SELECT ... FOR NO KEY UPDATE), the cap is
  // counted (active subscriptions plus reserved slots) and the subscription is inserted in ONE transaction, so two
  // simultaneous subscribes at four subscriptions cannot both succeed. An account the user already holds uses no extra
  // slot and is returned as `alreadySubscribed` exactly as before. The cascade below still runs for it.
  const placed = await db.transaction(async (tx) => {
    const user = await lockUserRow(tx, userId);
    if (!user) {
      throw new Error(`Cannot subscribe: user ${userId} does not exist`);
    }
    const [held] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.accountId, accountProfile.id),
          activeOnly(subscriptions)
        )
      )
      .limit(1);
    if (held) {
      return { existing: held, created: undefined };
    }
    await assertSubscriptionCap(tx, {
      userId,
      isModerator: user.role === 'moderator',
      alreadyHeld: false,
      excludeReservedByJobId: consumesReservationOfJobId,
    });
    const [created] = await tx
      .insert(subscriptions)
      .values({
        userId,
        accountId: accountProfile.id,
        isNewlyAdded: true,
      })
      .returning();
    return { existing: undefined, created };
  });

  // Before Story 10.3 the subscription row was written LAST, so any failure below (capacity exceeded, a verify or scrape
  // trigger error) left no subscription and the user simply retried. Keep that: a subscription this call created is
  // removed again if anything below throws.
  try {
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

        // classify-account-type.ts's hard-failure/low-confidence writes are now atomic (Part 1,
        // 2026-10-20): a write failure propagates as ClassificationPersistenceFailedError instead
        // of returning a fake success. That must never block the subscription itself -- AC1
        // requires subscribing to always succeed. Log it, release the claim (so a later subscribe
        // request can retry classification instead of waiting out the full TTL), and skip the
        // scrape -- the rest of subscribeToAccount proceeds as if the cascade never ran.
        let classification: Awaited<ReturnType<typeof classifyAccountType>> | null = null;
        try {
          classification = await classifyAccountType({
            accountId: accountProfile.id,
            username: accountProfile.username,
            userId,
          });
        } catch (err) {
          console.error(`[subscribeToAccount] classifyAccountType failed for profile ${accountProfile.id}:`, err);
          await db
            .update(socialMediaAccountProfiles)
            .set({ classificationClaimedAt: null })
            .where(eq(socialMediaAccountProfiles.id, accountProfile.id));
        }

        if (classification) {
          // classifyAccountType() persists accountType/accountTypeStatus to the DB row directly;
          // merge its return value into our in-memory snapshot so callers (and the existing-subscription
          // check below) don't see the stale pre-classification values.
          accountProfile = {
            ...accountProfile,
            accountType: classification.accountType,
            accountTypeStatus: classification.accountTypeStatus,
          };

          if (isScrapableAccountType(classification.accountType, classification.accountTypeStatus)) {
            const scrapeTarget = {
              profileId: accountProfile.id,
              platform: accountProfile.platform as ScrapablePlatform,
              accountId: accountProfile.accountId,
              username: resolveScrapeHandle(accountProfile),
              isInitialNewSubscription: true,
            };

            const newerThan = new Date(Date.now() - HISTORY_SEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
            await triggerScrapeForAccount(scrapeTarget, newerThan);
          }
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
  } catch (error) {
    if (placed.created) {
      await db
        .delete(subscriptions)
        .where(eq(subscriptions.id, placed.created.id))
        .catch((cleanupError) =>
          console.error(`[subscribeToAccount] could not remove subscription ${placed.created?.id} after a failure:`, cleanupError)
        );
    }
    throw error;
  }

  if (placed.existing) {
    return {
      profile: accountProfile,
      subscription: placed.existing,
      alreadySubscribed: true,
    };
  }

  return {
    profile: accountProfile,
    subscription: placed.created,
    alreadySubscribed: false,
  };
}
