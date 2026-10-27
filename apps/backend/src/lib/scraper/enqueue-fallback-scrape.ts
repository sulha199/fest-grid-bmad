import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { isScrapableAccountType, resolveScrapeHandle } from '@festgrid/domain';
import { and, eq } from 'drizzle-orm';
import { enqueueScrapeJob } from './enqueue-scrape-job.js';

export type FallbackScrapeOutcome = 'enqueued' | 'skipped' | 'failed';

/**
 * Hands a profile to the scrape queue after a vendor run for it failed (BUG-074, IDEA-095): the job
 * reads from the profile's own newest stored post and scrapes it on the other provider.
 *
 * This **starts a scrape**, so it goes through the scrape gate like every other entry point (AD-34
 * Rule 7): the account must be scrapable by `isScrapableAccountType` as it is *now* (it may have been
 * reclassified `PERSONAL`, or be awaiting approval, since the original scrape started) and must still
 * have an active subscription. Only Instagram profiles fall back to the queue.
 *
 * Never throws: a failed fallback must not undo the failure record its caller has just written, and
 * the next daily batch is the backstop.
 */
export async function enqueueFallbackScrape(profileId: string): Promise<FallbackScrapeOutcome> {
  const [profile] = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, profileId));

  if (!profile || profile.platform !== 'instagram') {
    return 'skipped';
  }

  if (!isScrapableAccountType(profile.accountType, profile.accountTypeStatus)) {
    console.warn(`Fallback scrape skipped for ${profile.username}: the account is not scrapable (AD-34).`);
    return 'skipped';
  }

  const [activeSubscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, profile.id), activeOnly(subscriptions)))
    .limit(1);

  if (!activeSubscription) {
    console.warn(`Fallback scrape skipped for ${profile.username}: no active subscription.`);
    return 'skipped';
  }

  try {
    await enqueueScrapeJob({
      profileId: profile.id,
      accountId: profile.accountId,
      username: resolveScrapeHandle(profile),
      platform: profile.platform,
    });
    return 'enqueued';
  } catch (error) {
    console.error(`Fallback SQS enqueue failed for ${profile.username}:`, error);
    return 'failed';
  }
}
