import test from 'node:test';
import * as assert from 'node:assert';
import { generateKeyPairSync } from 'crypto';

// Generate a valid dummy private key so firebase-admin initializes successfully in tests
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

process.env.FIREBASE_PRIVATE_KEY = privateKey;
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test-client@test-project.iam.gserviceaccount.com';

import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, userSettings, fcmTokens } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { Messaging } from 'firebase-admin/messaging';
import { getMessagingClient, sendEventNotifications, setGetMessagingClient } from './send-event-notifications.js';

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

    const result = await sendEventNotifications(event, sourceAccountId);

    assert.deepStrictEqual(result, { firebaseInitFailed: false });
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

    // A request that failed was attempted: it is not an initialisation failure, so the caller keeps its claim.
    const result = await sendEventNotifications(event, sourceAccountId);
    assert.deepStrictEqual(result, { firebaseInitFailed: false });
  });

  // BUG-073 / AD-30 Rule 10 (amended 2026-10-21): when Firebase cannot be initialised, no request was
  // made at all, and the caller is told so it can release its claim on the event.
  await t.test('Case 4: Firebase initialisation fails -> nothing is sent, the caller is told, and the failure is reported', async (t) => {
    const originalGetMessagingClient = getMessagingClient;
    let requests = 0;
    t.mock.method(Messaging.prototype, 'sendEachForMulticast', async () => {
      requests += 1;
      return { successCount: 0, failureCount: 0, responses: [] };
    });
    setGetMessagingClient(() => {
      throw new Error('Firebase Admin initialization failed: Missing required Firebase environment variables');
    });
    const errors: unknown[][] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => {
      errors.push(args);
    });

    try {
      const result = await sendEventNotifications(
        { id: 'event-init-fail', slug: 'init-fail', name: 'Init Fail', description: 'x' },
        sourceAccountId
      );

      assert.deepStrictEqual(result, { firebaseInitFailed: true });
      assert.strictEqual(requests, 0, 'no FCM request is made when Firebase cannot be initialised');
      assert.ok(
        errors.some((args) => String(args[0]).includes('Firebase initialisation failed')),
        'the failure is logged'
      );
    } finally {
      setGetMessagingClient(originalGetMessagingClient);
    }
  });

  await t.test('Case 5: no subscribers -> Firebase is never initialised, so it can never count as an initialisation failure', async () => {
    const originalGetMessagingClient = getMessagingClient;
    let initialisations = 0;
    setGetMessagingClient(() => {
      initialisations += 1;
      throw new Error('must not be called');
    });
    try {
      const result = await sendEventNotifications(
        { id: 'event-no-subs', slug: 'no-subs', name: 'No Subs', description: 'x' },
        'platform-acc-with-no-subscribers-' + Date.now()
      );

      assert.deepStrictEqual(result, { firebaseInitFailed: false });
      assert.strictEqual(initialisations, 0);
    } finally {
      setGetMessagingClient(originalGetMessagingClient);
    }
  });
});
