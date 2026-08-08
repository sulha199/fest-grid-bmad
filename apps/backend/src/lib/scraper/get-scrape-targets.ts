import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { SUPPORTED_PLATFORMS, SupportedPlatform } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { and, eq, isNull, lt, or } from 'drizzle-orm';

export interface ScrapeTarget {
  profileId: string;
  platform: SupportedPlatform;
  accountId: string;
  username: string;
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
      )
    )
  );

  // TypeScript deduplication by profileId
  const distinctRows = Array.from(new Map(rows.map(r => [r.profileId, r])).values());

  const targets: ScrapeTarget[] = [];
  for (const row of distinctRows) {
    if (!SUPPORTED_PLATFORMS.includes(row.platform as any)) {
      console.warn(`Skipping scrape target with unsupported platform: ${row.platform} (profile: ${row.profileId})`);
      continue;
    }
    targets.push({
      profileId: row.profileId,
      platform: row.platform as SupportedPlatform,
      accountId: row.accountId,
      username: row.username,
    });
  }

  return targets;
}
