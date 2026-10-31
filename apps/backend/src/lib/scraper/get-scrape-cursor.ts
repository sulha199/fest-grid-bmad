import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { resolveScrapeCursor, type ScrapeCursorVendor } from '@festgrid/domain';
import { desc } from 'drizzle-orm';
import { postsAssociatedWithAccount } from '../posts/posts-associated-with-account.js';
import { isHistorySeeded } from './history-seeded-store.js';

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
 * A profile whose history is not seeded yet (`history_seeded_at` null) starts `HISTORY_SEED_LOOKBACK_DAYS`
 * back whatever posts it holds: it may be known only as a co-author, and those posts say nothing about its own
 * timeline. `fallbackNewerThan` is the caller's window for a seeded profile with no stored post.
 */
export async function getScrapeCursor(
  vendor: ScrapeCursorVendor,
  profileId: string,
  fallbackNewerThan: string
): Promise<string> {
  const historySeeded = await isHistorySeeded(profileId);
  return resolveScrapeCursor({
    vendor,
    historySeeded,
    // An unseeded profile's stored posts are ignored, so there is no reason to look them up.
    newestPostPublishedAt: historySeeded ? await getNewestAssociatedPostPublishedAt(profileId) : undefined,
    fallbackNewerThan,
  });
}
