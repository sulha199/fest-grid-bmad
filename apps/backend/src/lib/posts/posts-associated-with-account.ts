import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { posts, postAccountAssociations } from '@festgrid/database';

/**
 * Which posts belong to a subscribed account, for the manual extract screen (PRD 3.10, 2026-10-16).
 *
 * A post is associated with its owner (`posts.accountId`) and with every account in
 * `post_account_associations`, whatever the role: the publisher, any co-author, and the account whose
 * scrape found it (`SCRAPING_SOURCE`). The three can be different profiles for one real post:
 * a co-authored post belongs to each co-author's tab, and a scrape's posts may be stored under a
 * profile other than the one the user subscribed to (BUG-059). It is the same post wherever it
 * appears, so selection, quota and queueing are per post, never per tab.
 */

/** A `where` condition matching every post owned by, or associated in any role with, `accountId`. */
export function postsAssociatedWithAccount(accountId: string): SQL {
  return or(
    eq(posts.accountId, accountId),
    inArray(
      posts.id,
      db
        .select({ id: postAccountAssociations.postId })
        .from(postAccountAssociations)
        .where(eq(postAccountAssociations.accountId, accountId))
    )
  )!;
}

/**
 * For each given post, the account ids that grant access to it: its own `accountId` and every
 * account associated with it. A subscriber with an active subscription to any of them may act on the
 * post.
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

  const associations = await db
    .select({ postId: postAccountAssociations.postId, accountId: postAccountAssociations.accountId })
    .from(postAccountAssociations)
    .where(
      and(inArray(postAccountAssociations.postId, postRows.map((p) => p.id)))
    );
  for (const association of associations) {
    access.get(association.postId)?.add(association.accountId);
  }
  return access;
}
