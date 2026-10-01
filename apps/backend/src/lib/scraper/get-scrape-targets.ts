import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, brightdataPendingJobs, posts } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { ScrapablePlatform, isAdapterRegistered } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { and, eq, isNull, lt, or, inArray, sql } from 'drizzle-orm';

export interface ScrapeTarget {
  profileId: string;
  platform: ScrapablePlatform;
  accountId: string;
  username: string;
  isInitialNewSubscription?: boolean;
  // Newest known `posts.publishedAt` for this account (FIND-035), used by the daily batch
  // cron to scrape incrementally instead of re-requesting an overlapping fixed window every
  // run. Undefined when the account has no posts yet (first-ever scrape).
  newestPostPublishedAt?: Date;
}

export async function getBatchScrapeTargets(): Promise<ScrapeTarget[]> {
  const env = loadBackendEnv();
  const skipHours = env.scrapeSkipRecentHours;
  const cutoffDate = new Date(Date.now() - skipHours * 60 * 60 * 1000);

  const rows = await db.select({
    profileId: socialMediaAccountProfiles.id,
    platform: socialMediaAccountProfiles.platform,
    accountId: socialMediaAccountProfiles.accountId,
    username: socialMediaAccountProfiles.username,
  })
    .from(socialMediaAccountProfiles)
    .innerJoin(subscriptions, eq(subscriptions.accountId, socialMediaAccountProfiles.id))
    .where(
      and(
        activeOnly(subscriptions),
        or(
          isNull(socialMediaAccountProfiles.lastScrapedAt),
          lt(socialMediaAccountProfiles.lastScrapedAt, cutoffDate)
        ),
        or(
          isNull(socialMediaAccountProfiles.accountTypeStatus),
          and(
            eq(socialMediaAccountProfiles.accountType, 'ORGANIZER_VENUE_EVENT'),
            eq(socialMediaAccountProfiles.accountTypeStatus, 'CONFIRMED')
          ),
          and(
            eq(socialMediaAccountProfiles.accountType, 'CURATOR_GUIDE'),
            eq(socialMediaAccountProfiles.accountTypeStatus, 'CONFIRMED')
          )
        )
      )
    );

  // Exclude profiles that already have a Bright Data job still in flight (not completed/failed)
  const pendingRows = await db.select({ profileId: brightdataPendingJobs.profileId })
    .from(brightdataPendingJobs)
    .where(eq(brightdataPendingJobs.status, 'PENDING'));
  const pendingSet = new Set(pendingRows.map(p => p.profileId));

  // TypeScript deduplication by profileId and filter pending
  const distinctRows = Array.from(new Map(rows.map(r => [r.profileId, r])).values()).filter(r => !pendingSet.has(r.profileId));

  // Batch-fetch each target's newest post date in one grouped query (FIND-035) -- never
  // per-target inside the loop below -- so the daily batch cron can scrape incrementally
  // from where it left off, mirroring the already-proven pattern in process-scrape-job.ts's
  // SQS-fallback path (newestPost.publishedAt, falling back to scrapeInitialLookbackDays
  // only when the account has zero posts yet).
  const profileIds = distinctRows.map(r => r.profileId);
  const newestPostRows = profileIds.length > 0
    ? await db.select({
        accountId: posts.accountId,
        newestPublishedAt: sql<Date>`max(${posts.publishedAt})`.mapWith((v: string | Date) => new Date(v)),
      })
        .from(posts)
        .where(inArray(posts.accountId, profileIds))
        .groupBy(posts.accountId)
    : [];
  const newestPostByProfileId = new Map(newestPostRows.map(r => [r.accountId, r.newestPublishedAt]));

  const targets: ScrapeTarget[] = [];
  for (const row of distinctRows) {
    // Only scrape platforms that have a registered scraper adapter (e.g., both 'instagram' and legacy 'twitter').
    // Existing Twitter subscriptions keep scraping even though new subscriptions/votes for Twitter are disabled.
    if (!isAdapterRegistered(row.platform)) {
      console.warn(`Skipping scrape target with unregistered platform: ${row.platform} (profile: ${row.profileId})`);
      continue;
    }
    targets.push({
      profileId: row.profileId,
      platform: row.platform as ScrapablePlatform,
      accountId: row.accountId,
      username: row.username,
      newestPostPublishedAt: newestPostByProfileId.get(row.profileId),
    });
  }

  return targets;
}
