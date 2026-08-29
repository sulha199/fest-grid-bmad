import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, userSettings, fcmTokens } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { getSubscribersForNotification } from './get-subscribers-for-notification.js';
import crypto from 'node:crypto';

test('getSubscribersForNotification integration tests', async (t) => {
  const runId = crypto.randomUUID();
  // Retrieve seeded users to use across the tests
  const [user1, user2, user3] = await db.insert(users).values([
    { email: `notif-test-1-${runId}@example.com`, name: 'User 1', role: 'user' },
    { email: `notif-test-2-${runId}@example.com`, name: 'User 2', role: 'user' },
    { email: `notif-test-3-${runId}@example.com`, name: 'User 3', role: 'user' }
  ]).returning();

  const sourceAccountId = 'platform-acc-id-' + runId;

  // Create a socialMediaAccountProfile for testing
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: sourceAccountId,
      platform: 'instagram',
      displayName: 'Test Notification Profile',
      username: 'test_notif_profile_' + runId
    })
    .returning();

  t.after(async () => {
    // Cleanup
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, user1.id));
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, user2.id));
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, user3.id));
    await db.delete(userSettings).where(eq(userSettings.userId, user1.id));
    await db.delete(userSettings).where(eq(userSettings.userId, user2.id));
    await db.delete(userSettings).where(eq(userSettings.userId, user3.id));
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    await db.delete(users).where(inArray(users.id, [user1.id, user2.id, user3.id]));
  });

  await t.test('Initial state: no subscriptions or settings should return empty list', async () => {
    const tokens = await getSubscribersForNotification(sourceAccountId);
    assert.deepStrictEqual(tokens, []);
  });

  await t.test('Subscribe and configure user settings and tokens', async () => {
    // Setup user1 (subscribed, notification enabled, single token)
    await db.insert(subscriptions).values({
      userId: user1.id,
      accountId: profile.id,
      isNewlyAdded: false
    });
    await db.insert(userSettings).values({
      userId: user1.id,
      pushNotificationsEnabled: true
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { pushNotificationsEnabled: true }
    });
    await db.insert(fcmTokens).values({
      token: 'token-user1-active',
      userId: user1.id
    });

    // Setup user2 (subscribed, notification disabled, single token)
    await db.insert(subscriptions).values({
      userId: user2.id,
      accountId: profile.id,
      isNewlyAdded: false
    });
    await db.insert(userSettings).values({
      userId: user2.id,
      pushNotificationsEnabled: false
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { pushNotificationsEnabled: false }
    });
    await db.insert(fcmTokens).values({
      token: 'token-user2-disabled',
      userId: user2.id
    });

    // Setup user3 (NOT subscribed, notification enabled, single token)
    await db.insert(userSettings).values({
      userId: user3.id,
      pushNotificationsEnabled: true
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { pushNotificationsEnabled: true }
    });
    await db.insert(fcmTokens).values({
      token: 'token-user3-unsubbed',
      userId: user3.id
    });

    // Query tokens
    const tokens = await getSubscribersForNotification(sourceAccountId);
    assert.strictEqual(tokens.length, 1);
    assert.ok(tokens.includes('token-user1-active'));
    assert.ok(!tokens.includes('token-user2-disabled'));
    assert.ok(!tokens.includes('token-user3-unsubbed'));
  });

  await t.test('Multiple tokens for a single subscriber should return all of them', async () => {
    // Add another token for user1
    await db.insert(fcmTokens).values({
      token: 'token-user1-second',
      userId: user1.id
    });

    const tokens = await getSubscribersForNotification(sourceAccountId);
    assert.strictEqual(tokens.length, 2);
    assert.ok(tokens.includes('token-user1-active'));
    assert.ok(tokens.includes('token-user1-second'));
  });
});
