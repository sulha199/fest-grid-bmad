import { and, eq, isNotNull } from 'drizzle-orm';
import { subscriptions } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { db } from '../../db/client.js';
import { assertSubscriptionCap, lockUserRow } from './subscription-cap.js';

/**
 * Story 10.3 (AC8; PRD FR122) -- `removeSubscription` with RESTORE makes a soft-deleted subscription active again, so it
 * is a place a subscription becomes active and the cap applies exactly as in `subscribeToAccount`: lock the user, count,
 * refuse with `SubscriptionCapReachedError` or restore, in one transaction. Returns the restored row, or undefined when the
 * row is no longer a soft-deleted subscription of this user.
 */
export async function restoreSubscription(userId: string, subscriptionId: string) {
  return db.transaction(async (tx) => {
    const user = await lockUserRow(tx, userId);
    if (!user) {
      throw new Error(`Cannot restore a subscription: user ${userId} does not exist`);
    }
    const [row] = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId), isNotNull(subscriptions.deletedAt)))
      .limit(1);
    if (!row) {
      return undefined; // not (or no longer) a soft-deleted subscription of this user: the caller reports the state
    }
    // An account the user re-subscribed to after deleting this row is already held: restoring adds no account.
    const [alreadyActive] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.accountId, row.accountId), activeOnly(subscriptions)))
      .limit(1);
    await assertSubscriptionCap(tx, { userId, isModerator: user.role === 'moderator', alreadyHeld: Boolean(alreadyActive) });
    const [restored] = await tx
      .update(subscriptions)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId), isNotNull(subscriptions.deletedAt)))
      .returning();
    return restored;
  });
}
