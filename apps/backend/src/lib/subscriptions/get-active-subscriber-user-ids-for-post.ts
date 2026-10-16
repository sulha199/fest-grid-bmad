import { and, eq, inArray } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { db } from '../../db/client.js';
import { postAccountAssociations, posts, subscriptions } from '@festgrid/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Users with an active subscription to ANY account a post is associated with: the account that
 * owns it (`posts.account_id`) and every account in `post_account_associations` (publisher,
 * co-author, the account whose scrape found it). PRD 3.7 (2026-10-16): a post's subscribers are the
 * subscribers of all those accounts, so a co-authored post can be extracted with a key from a
 * subscriber of either account, and a post a scrape stored under a different profile than the one
 * the user subscribed to still reaches its subscriber.
 *
 * `ownerAccountId` (the processing message's `accountId`, i.e. `posts.account_id`) is always included
 * so the owner's subscribers are found even before the post row is visible to this query. A `postId`
 * that is not a UUID cannot name a post row, so only the owner is used.
 *
 * Built with the query builder, not raw SQL: AD-31 Rule 4's ratchet allows raw SQL on
 * `post_account_associations` only in `lib/events/event-account-match.ts`.
 */
export async function getActiveSubscriberUserIdsForPost(postId: string, ownerAccountId?: string): Promise<string[]> {
  const accountIds = new Set<string>(ownerAccountId ? [ownerAccountId] : []);

  if (UUID_PATTERN.test(postId)) {
    const [post] = await db.select({ accountId: posts.accountId }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (post) {
      accountIds.add(post.accountId);
    }
    const associations = await db
      .select({ accountId: postAccountAssociations.accountId })
      .from(postAccountAssociations)
      .where(eq(postAccountAssociations.postId, postId));
    for (const association of associations) {
      accountIds.add(association.accountId);
    }
  }

  if (accountIds.size === 0) {
    return [];
  }

  const rows = await db
    .selectDistinct({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(and(inArray(subscriptions.accountId, [...accountIds]), activeOnly(subscriptions)));

  return rows.map((r) => r.userId);
}
