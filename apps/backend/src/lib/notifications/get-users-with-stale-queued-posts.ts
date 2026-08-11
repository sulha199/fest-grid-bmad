import { db } from '../../db/client.js';
import { users, subscriptions, posts } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { and, or, eq, lte, isNull, sql } from 'drizzle-orm';

export async function getUsersWithStaleQueuedPosts(
  thresholdDays: number,
  thresholdCount: number,
  cooldownDays: number
): Promise<{ userId: string; email: string; name: string | null; queuedPostCount: number }[]> {
  const postsCutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const query = db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      queuedPostCount: sql<number>`count(${posts.id})`.mapWith(Number),
    })
    .from(users)
    .innerJoin(subscriptions, eq(users.id, subscriptions.userId))
    .innerJoin(posts, eq(subscriptions.accountId, posts.accountId))
    .where(
      and(
        activeOnly(subscriptions),
        eq(posts.isExtracted, false),
        lte(posts.createdAt, postsCutoff),
        or(
          isNull(users.lastQuotaWarningEmailSentAt),
          lte(users.lastQuotaWarningEmailSentAt, cooldownCutoff)
        )
      )
    )
    .groupBy(users.id, users.email, users.name)
    .having(sql`count(${posts.id}) >= ${thresholdCount}`);

  const result = await query;
  return result;
}
