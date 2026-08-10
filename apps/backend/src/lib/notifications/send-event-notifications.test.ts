import test from 'node:test';
import * as assert from 'node:assert';
import { generateKeyPairSync } from 'crypto';

// Generate a valid dummy private key so firebase-admin initializes successfully in tests
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

process.env.FIREBASE_PRIVATE_KEY = privateKey;
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test-client@test-project.iam.gserviceaccount.com';

import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, userSettings, fcmTokens } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { Messaging } from 'firebase-admin/messaging';
import { sendEventNotifications } from './send-event-notifications.js';

test('sendEventNotifications integration and mock tests', async (t) => {
  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length >= 1, 'Must have at least one seeded user');
  const user = seededUsers[0];

  const sourceAccountId = 'platform-acc-id-' + Date.now();

  // Create socialMediaAccountProfile for testing
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: sourceAccountId,
      platform: 'instagram',
      displayName: 'Test Send Notif Profile',
      username: 'test_send_notif_profile_' + Date.now()
    })
    .returning();

  t.after(async () => {
    // Cleanup
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, user.id));
    await db.delete(userSettings).where(eq(userSettings.userId, user.id));
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('setup - Subscribe and configure user tokens', async () => {
    await db.insert(subscriptions).values({
      userId: user.id,
      accountId: profile.id,
      isNewlyAdded: false
    });
    await db.insert(userSettings).values({
      userId: user.id,
      pushNotificationsEnabled: true
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { pushNotificationsEnabled: true }
    });
    await db.insert(fcmTokens).values({
      token: 'test-token-valid-1',
      userId: user.id
    });
    await db.insert(fcmTokens).values({
      token: 'test-token-invalid-2',
      userId: user.id
    });
  });

  await t.test('Case 1: successful multicast dispatch', async (t) => {
    let sentPayload: any = null;

    t.mock.method(Messaging.prototype, 'sendEachForMulticast', async (payload: any) => {
      sentPayload = payload;
      return {
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'msg-1' },
          { success: true, messageId: 'msg-2' }
        ]
      };
    });

    const event = {
      id: 'event-123',
      slug: 'awesome-event',
      name: 'Awesome Event',
      description: 'Check out this awesome event!'
    };

    await sendEventNotifications(event, sourceAccountId);

    assert.ok(sentPayload, 'Should have dispatched multicast message');
    const sortedSent = [...sentPayload.tokens].sort();
    assert.deepStrictEqual(sortedSent, ['test-token-invalid-2', 'test-token-valid-1']);

    // Tokens should still exist in DB
    const tokensInDb = await db
      .select()
      .from(fcmTokens)
      .where(inArray(fcmTokens.token, ['test-token-valid-1', 'test-token-invalid-2']));
    assert.strictEqual(tokensInDb.length, 2);
  });

  await t.test('Case 2: handles and deletes invalid registration tokens', async (t) => {
    let batchTokens: string[] = [];

    t.mock.method(Messaging.prototype, 'sendEachForMulticast', async (payload: any) => {
      batchTokens = payload.tokens;
      return {
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true, messageId: 'msg-1' }, // batchTokens[0] succeeds
          {
            success: false,
            error: {
              code: 'messaging/registration-token-not-registered',
              message: 'The registration token is not registered'
            }
          } // batchTokens[1] fails (will be deleted)
        ]
      };
    });

    const event = {
      id: 'event-123',
      slug: 'awesome-event',
      name: 'Awesome Event',
      description: 'Check out this awesome event!'
    };

    await sendEventNotifications(event, sourceAccountId);

    // The token that failed should be deleted (batchTokens[1]), the token that succeeded should remain (batchTokens[0])
    assert.strictEqual(batchTokens.length, 2);
    const expectedRemainingToken = batchTokens[0];

    const remainingTokens = await db
      .select()
      .from(fcmTokens)
      .where(inArray(fcmTokens.token, ['test-token-valid-1', 'test-token-invalid-2']));

    assert.strictEqual(remainingTokens.length, 1);
    assert.strictEqual(remainingTokens[0].token, expectedRemainingToken);
  });

  await t.test('Case 3: full exception safety - does not throw error on failure', async (t) => {
    t.mock.method(Messaging.prototype, 'sendEachForMulticast', async () => {
      throw new Error('FCM completely down');
    });

    const event = {
      id: 'event-123',
      slug: 'awesome-event',
      name: 'Awesome Event',
      description: 'Check out this awesome event!'
    };

    // Should not throw or crash
    await assert.doesNotReject(async () => {
      await sendEventNotifications(event, sourceAccountId);
    });
  });
});
