import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, brightdataPendingJobs } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { ScrapablePlatform, isAdapterRegistered } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { and, eq, isNull, lt, or } from 'drizzle-orm';

export interface ScrapeTarget {
  profileId: string;
  platform: ScrapablePlatform;
  accountId: string;
  username: string;
  isInitialNewSubscription?: boolean;
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

  // Exclude profiles that already have a pending Bright Data job
  const pendingRows = await db.select({ profileId: brightdataPendingJobs.profileId }).from(brightdataPendingJobs);
  const pendingSet = new Set(pendingRows.map(p => p.profileId));

  // TypeScript deduplication by profileId and filter pending
  const distinctRows = Array.from(new Map(rows.map(r => [r.profileId, r])).values()).filter(r => !pendingSet.has(r.profileId));

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
    });
  }

  return targets;
}
