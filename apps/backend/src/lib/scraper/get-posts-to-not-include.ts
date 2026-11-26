import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { buildBrightDataPostsToNotInclude } from '@festgrid/domain';
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';
import { postsAssociatedWithAccount } from '../posts/posts-associated-with-account.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The oldest `publishedAt` a stored post can have and still be returned for a request starting at `cursor`:
 * Bright Data reads `start_date` as a calendar day in a time zone it does not state, so the window opens a
 * day before the start of the cursor's UTC day. Listing a few extra, older posts is harmless; leaving one out
 * would let it be bought again.
 */
export function exclusionWindowStart(cursor: string): Date {
  const date = new Date(cursor);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - DAY_MS);
}

/**
 * The `posts_to_not_include` ids for a Bright Data request (Fix of 2026-11-26): the posts already stored for
 * this profile (owned, or linked to it in any role) that were published inside the window the request asks for.
 * Without them the 24 h cursor margin and the inclusive start day bought the newest post and the day before it again
 * on every run (51% of November's deliveries).
 *
 * Only a profile whose history is seeded is given a list (the caller decides): an unseeded profile's stored posts say
 * nothing about its own timeline, and its first scrape must reach its own posts to mark it seeded.
 *
 * Returns decimal-string numeric ids, newest first (see `buildBrightDataPostsToNotInclude`).
 */
export async function getPostsToNotInclude(profileId: string, cursor: string): Promise<string[]> {
  const rows = await db
    .select({ platformPostId: posts.platformPostId })
    .from(posts)
    .where(
      and(
        eq(posts.platform, 'instagram'),
        isNotNull(posts.platformPostId),
        gte(posts.publishedAt, exclusionWindowStart(cursor)),
        postsAssociatedWithAccount(profileId)
      )
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id));
  return buildBrightDataPostsToNotInclude(rows.map((row) => row.platformPostId));
}
