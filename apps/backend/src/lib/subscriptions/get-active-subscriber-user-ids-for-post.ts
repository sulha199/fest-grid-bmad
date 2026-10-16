import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';

/**
 * Users with an active subscription to ANY account a post is associated with: the account that
 * owns it (`posts.account_id`) and every account in `post_account_associations` (publisher,
 * co-author, the account whose scrape found it). PRD 3.7 (2026-10-16): a post's subscribers are the
 * subscribers of all those accounts, so a co-authored post can be extracted with a key from a
 * subscriber of either account, and a post a scrape stored under a different profile than the one
 * the user subscribed to still reaches its subscriber.
 *
 * `ownerAccountId` (the processing message's `accountId`, i.e. `posts.account_id`) is always included
 * so the owner's subscribers are found even before the post row is visible to this query.
 */
export async function getActiveSubscriberUserIdsForPost(postId: string, ownerAccountId?: string): Promise<string[]> {
  const rows = (await db.execute(sql`
    select distinct s.user_id as "userId"
    from subscriptions s
    where s.deleted_at is null
      and s.account_id in (
        select account_id from posts where id = ${postId}
        union
        select account_id from post_account_associations where post_id = ${postId}
        union
        select ${ownerAccountId ?? null}::uuid where ${ownerAccountId ?? null}::uuid is not null
      )
  `)) as unknown as { userId: string }[];

  return rows.map((r) => r.userId);
}
