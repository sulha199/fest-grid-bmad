import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { resolveScrapeCursor, type ScrapeCursorVendor } from '@festgrid/domain';
import { desc, eq } from 'drizzle-orm';

/**
 * Where a vendor scrape for this profile should start (BUG-074, BUG-075): the newest post already
 * stored for it, never the finish time of an earlier run. A run that returned nothing -- a vendor
 * outage, a failure, a timeout, an empty result -- therefore cannot move the cursor, so no post
 * published in between is skipped. The rule itself is `resolveScrapeCursor` in @festgrid/domain;
 * `processScrapeJob`'s SQS-fallback path reads the same column the same way.
 *
 * `fallbackNewerThan` is the caller's window for a profile with no stored post yet.
 */
export async function getScrapeCursor(
  vendor: ScrapeCursorVendor,
  profileId: string,
  fallbackNewerThan: string
): Promise<string> {
  const [newestPost] = await db
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.accountId, profileId))
    .orderBy(desc(posts.publishedAt))
    .limit(1);

  return resolveScrapeCursor({
    vendor,
    newestPostPublishedAt: newestPost?.publishedAt,
    fallbackNewerThan,
  });
}
