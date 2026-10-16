import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { posts, postAccountAssociations } from '@festgrid/database';

/**
 * A subscribed profile and the profile a scrape stores its posts under can be two rows for one
 * platform account: subscribing keys the profile by username, while publisher resolution
 * (Story 3.14/3.15) keys it by the vendor's numeric owner ID, and `posts.accountId` is the
 * publisher. The post's `SCRAPING_SOURCE` association (exactly one per post) is always the profile
 * the scrape ran under -- the one the subscriber actually subscribed to.
 *
 * These two helpers define "this subscriber's posts" for manual extraction as: owned by the
 * account (`posts.accountId`) OR scraped under it (`SCRAPING_SOURCE`).
 */

/** A `where` condition matching every post owned by, or scraped under, `accountId`. */
export function postsScrapedUnderAccount(accountId: string): SQL {
  return or(
    eq(posts.accountId, accountId),
    inArray(
      posts.id,
      db
        .select({ id: postAccountAssociations.postId })
        .from(postAccountAssociations)
        .where(
          and(
            eq(postAccountAssociations.accountId, accountId),
            eq(postAccountAssociations.role, 'SCRAPING_SOURCE')
          )
        )
    )
  )!;
}

/**
 * For each given post, the account ids that grant access to it: its own `accountId` and the
 * account its scrape ran under. A subscriber with an active subscription to any of them may act
 * on the post.
 */
export async function getPostAccessAccountIds(
  postRows: { id: string; accountId: string }[]
): Promise<Map<string, Set<string>>> {
  const access = new Map<string, Set<string>>(
    postRows.map((p) => [p.id, new Set([p.accountId])])
  );
  if (postRows.length === 0) {
    return access;
  }

  const sources = await db
    .select({ postId: postAccountAssociations.postId, accountId: postAccountAssociations.accountId })
    .from(postAccountAssociations)
    .where(
      and(
        inArray(postAccountAssociations.postId, postRows.map((p) => p.id)),
        eq(postAccountAssociations.role, 'SCRAPING_SOURCE')
      )
    );
  for (const source of sources) {
    access.get(source.postId)?.add(source.accountId);
  }
  return access;
}
