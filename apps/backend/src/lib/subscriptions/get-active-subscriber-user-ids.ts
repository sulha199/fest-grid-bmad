import { db } from '../../db/client.js';
import { subscriptions } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { and, eq } from 'drizzle-orm';

export async function getActiveSubscriberUserIds(accountId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, accountId),
        activeOnly(subscriptions)
      )
    );

  return rows.map((r) => r.userId);
}
