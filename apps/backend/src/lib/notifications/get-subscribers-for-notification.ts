import { db } from '../../db/client.js';
import { subscriptions, userSettings, fcmTokens, socialMediaAccountProfiles } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { and, eq } from 'drizzle-orm';

export async function getSubscribersForNotification(sourceAccountId: string): Promise<string[]> {
  const rows = await db
    .select({ token: fcmTokens.token })
    .from(subscriptions)
    .innerJoin(
      socialMediaAccountProfiles,
      eq(subscriptions.accountId, socialMediaAccountProfiles.id)
    )
    .innerJoin(
      userSettings,
      eq(subscriptions.userId, userSettings.userId)
    )
    .innerJoin(
      fcmTokens,
      eq(subscriptions.userId, fcmTokens.userId)
    )
    .where(
      and(
        eq(socialMediaAccountProfiles.accountId, sourceAccountId),
        eq(userSettings.pushNotificationsEnabled, true),
        activeOnly(subscriptions)
      )
    );

  // Return a flat array of unique registration tokens
  const tokens = rows.map((r) => r.token);
  return Array.from(new Set(tokens));
}
