import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { subscribeToAccount } from './subscribe-to-account.js';
import { setAttemptApifyAsyncTrigger } from '../scraper/trigger-apify-for-target.js';
import '../scraper/register-adapters.js';

test('subscribe-to-account tests', async (t) => {
  let testUserId: string;
  const testPlatform = 'instagram';

  t.before(async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/dummy-queue';
    
    const [user] = await db.insert(users).values({
      email: 'test-subscribe-' + Date.now() + '@example.com',
    }).returning({ id: users.id });
    testUserId = user.id;
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
  });

  t.afterEach(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUserId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.platform, testPlatform));
  });

  await t.test('triggers Apify async and skips SQS when async succeeds', async () => {
    let apifyAsyncCalled = false;

    // Mock Apify async trigger to succeed
    setAttemptApifyAsyncTrigger(async () => {
      apifyAsyncCalled = true;
      return true;
    });

    const result = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: 'account-123',
      profile: {
        displayName: 'Test Account',
        username: 'testaccount',
      },
    });

    assert.ok(result.profile);
    assert.strictEqual(result.alreadySubscribed, false);
    assert.ok(apifyAsyncCalled, 'Apify async trigger should have been called');
  });

  await t.test('falls back to Bright Data when Apify async fails', async () => {
    // Mock Apify async to fail
    setAttemptApifyAsyncTrigger(async () => false);

    const result = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: 'account-456',
      profile: {
        displayName: 'Test Account 2',
        username: 'testaccount2',
      },
    });

    assert.ok(result.profile);
    assert.strictEqual(result.alreadySubscribed, false);
  });

  await t.test('returns existing subscription if already subscribed', async () => {
    const testAccountId = 'account-789';

    // Mock Apify async to succeed
    setAttemptApifyAsyncTrigger(async () => true);

    // First subscription
    const firstResult = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: testAccountId,
      profile: {
        displayName: 'Test Account 3',
        username: 'testaccount3',
      },
    });

    assert.strictEqual(firstResult.alreadySubscribed, false);

    // Second subscription to same account
    const secondResult = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: testAccountId,
      profile: {
        displayName: 'Test Account 3',
        username: 'testaccount3',
      },
    });

    assert.strictEqual(secondResult.alreadySubscribed, true);
    assert.strictEqual(firstResult.profile.id, secondResult.profile.id);
    assert.strictEqual(firstResult.subscription.id, secondResult.subscription.id);
  });
});
