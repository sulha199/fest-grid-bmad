import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { resolveScrapeCursor, type ScrapeCursorVendor } from '@festgrid/domain';
import { desc } from 'drizzle-orm';
import { postsAssociatedWithAccount } from '../posts/posts-associated-with-account.js';

/**
 * The newest `publishedAt` among the posts this profile owns or is associated with in any role (publisher,
 * co-author, the account a scrape found it under). A co-authored post is stored once, under one owner, so
 * counting only owned posts left every other co-author's cursor where it was and its scrape re-fetched the
 * same posts on every run (2026-10-23..29: 303 repeat items on the Apify account alone).
 */
export async function getNewestAssociatedPostPublishedAt(profileId: string): Promise<Date | undefined> {
  const [newestPost] = await db
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(postsAssociatedWithAccount(profileId))
    .orderBy(desc(posts.publishedAt))
    .limit(1);
  return newestPost?.publishedAt;
}

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
  return resolveScrapeCursor({
    vendor,
    newestPostPublishedAt: await getNewestAssociatedPostPublishedAt(profileId),
    fallbackNewerThan,
  });
}
