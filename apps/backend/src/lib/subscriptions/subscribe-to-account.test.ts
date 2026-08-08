import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { subscribeToAccount } from './subscribe-to-account.js';
import { setSendSqsMessage } from '../scraper/enqueue-scrape-job.js';
import { db as usageDb } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { ScraperCapacityExceededError } from '@festgrid/domain';

test('subscribeToAccount integration tests', async (t) => {
  let testUser: any;

  // Retrieve a seeded user to use across the tests
  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  testUser = seededUsers[0];

  t.beforeEach(async () => {
    // Ensure clean capacity state before each test case
    await usageDb.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, 'apify'));
  });

  await t.test('Case A: subscribing when neither profile nor subscription exists creates both', async () => {
    const platform = 'instagram';
    const accountId = 'test_acc_case_a_' + Date.now();
    const profileInput = {
      displayName: 'Test Case A',
      username: 'test.case.a',
      description: 'A test account bio',
      profileImageUrl: 'http://test.com/img.png',
    };

    // Run subscribe
    const result = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId,
      profile: profileInput,
    });

    assert.strictEqual(result.alreadySubscribed, false);
    assert.ok(result.profile);
    assert.ok(result.subscription);
    assert.strictEqual(result.profile.accountId, accountId);
    assert.strictEqual(result.profile.displayName, profileInput.displayName);
    assert.strictEqual(result.subscription.isNewlyAdded, true);

    // Verify database entries
    const dbProfile = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, result.profile.id))
      .then((rows) => rows[0]);
    assert.ok(dbProfile);
    assert.strictEqual(dbProfile.username, profileInput.username);

    const dbSub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, result.subscription.id))
      .then((rows) => rows[0]);
    assert.ok(dbSub);
    assert.strictEqual(dbSub.accountId, dbProfile.id);
  });

  await t.test('Case B: subscribing to an already-profiled account reuses profile and creates subscription', async () => {
    const platform = 'instagram';
    const accountId = 'test_acc_case_b_' + Date.now();
    const profileInput = {
      displayName: 'Test Case B',
      username: 'test.case.b',
    };

    // 1. Pre-create the profile row directly
    const [preProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId,
        platform,
        displayName: profileInput.displayName,
        username: profileInput.username,
      })
      .returning();

    // 2. Call subscribeToAccount
    const result = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId,
      profile: profileInput,
    });

    assert.strictEqual(result.alreadySubscribed, false);
    assert.strictEqual(result.profile.id, preProfile.id, 'Should reuse the existing profile row');
    assert.ok(result.subscription);

    const dbSubCount = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.accountId, preProfile.id));
    assert.strictEqual(dbSubCount.length, 1);
  });

  await t.test('Case C: subscribing when user already has an active subscription returns alreadySubscribed: true', async () => {
    const platform = 'instagram';
    const accountId = 'test_acc_case_c_' + Date.now();
    const profileInput = {
      displayName: 'Test Case C',
      username: 'test.case.c',
    };

    // 1. Subscribe first time
    const res1 = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId,
      profile: profileInput,
    });
    assert.strictEqual(res1.alreadySubscribed, false);

    // 2. Subscribe second time
    const res2 = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId,
      profile: profileInput,
    });

    assert.strictEqual(res2.alreadySubscribed, true);
    assert.strictEqual(res2.profile.id, res1.profile.id);
    assert.strictEqual(res2.subscription.id, res1.subscription.id);
  });

  await t.test('Case D: soft-deleted subscription is excluded by activeOnly and treated as new subscription', async () => {
    const platform = 'instagram';
    const accountId = 'test_acc_case_d_' + Date.now();
    const profileInput = {
      displayName: 'Test Case D',
      username: 'test.case.d',
    };

    // 1. Subscribe first time
    const res1 = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId,
      profile: profileInput,
    });
    assert.strictEqual(res1.alreadySubscribed, false);

    // 2. Soft-delete the subscription
    await db
      .update(subscriptions)
      .set({ deletedAt: new Date() })
      .where(eq(subscriptions.id, res1.subscription.id));

    // 3. Subscribe again (should create a new subscription because of activeOnly filtering)
    const res2 = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId,
      profile: profileInput,
    });

    assert.strictEqual(res2.alreadySubscribed, false, 'Should treat as a brand new subscription');
    assert.notStrictEqual(res2.subscription.id, res1.subscription.id, 'Should have a new subscription row');
    assert.strictEqual(res2.profile.id, res1.profile.id, 'Should still reuse the same profile row');
  });

  await t.test('Case E: capacity-block and enqueue behaviors on subscribeToAccount', async (innerT) => {
    // Set SCRAPING_QUEUE_URL so enqueueScrapeJob doesn't throw
    const prevQueueUrl = process.env.SCRAPING_QUEUE_URL;
    process.env.SCRAPING_QUEUE_URL = 'http://mock-queue-url';

    // Stub SQS
    let enqueueCount = 0;
    let lastEnqueuedProfileId = '';
    setSendSqsMessage(async (queueUrl, body) => {
      enqueueCount++;
      const target = JSON.parse(body);
      lastEnqueuedProfileId = target.profileId;
    });

    // Make sure we clear any existing scraperProviderUsage rows
    await usageDb.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, 'apify'));

    // Subscribing to a brand-new account when capacity is available
    const platform = 'instagram';
    const accountIdNew = 'test_acc_case_e_new_' + Date.now();
    const profileInputNew = {
      displayName: 'Test Case E New',
      username: 'test.case.e.new',
    };

    const res1 = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId: accountIdNew,
      profile: profileInputNew,
    });

    assert.strictEqual(res1.alreadySubscribed, false);
    assert.strictEqual(enqueueCount, 1, 'Should enqueue scrape job exactly once for brand-new profile');
    assert.strictEqual(lastEnqueuedProfileId, res1.profile.id);

    // Subscribing to an already-known profile does not trigger another scrape job
    enqueueCount = 0;
    const res2 = await subscribeToAccount({
      userId: testUser.id,
      platform,
      accountId: accountIdNew,
      profile: profileInputNew,
    });
    assert.strictEqual(enqueueCount, 0, 'Should NOT enqueue scrape job for already-known profile subscribe');

    // Simulate exhausted capacity
    await usageDb.insert(scraperProviderUsage).values({
      provider: 'apify',
      itemsUsedThisCycle: 10000, // exceeds threshold
      usageCycleResetAt: new Date(Date.now() + 86400000),
    });

    // Subscribing to a brand-new account should throw ScraperCapacityExceededError
    const accountIdExceeded = 'test_acc_case_e_exceeded_' + Date.now();
    const profileInputExceeded = {
      displayName: 'Test Case E Exceeded',
      username: 'test.case.e.exceeded',
    };

    await assert.rejects(
      () => subscribeToAccount({
        userId: testUser.id,
        platform,
        accountId: accountIdExceeded,
        profile: profileInputExceeded,
      }),
      (err: any) => {
        assert.ok(err instanceof ScraperCapacityExceededError);
        assert.match(err.message, /Scraper capacity temporarily exceeded/);
        return true;
      }
    );

    // Verify profile was NOT created
    const profileExceeded = await usageDb
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, accountIdExceeded))
      .then((rows) => rows[0]);
    assert.strictEqual(profileExceeded, undefined, 'Profile should not be created if capacity exceeded');

    // Cleanup
    process.env.SCRAPING_QUEUE_URL = prevQueueUrl;
    await usageDb.delete(subscriptions).where(eq(subscriptions.accountId, res1.profile.id));
    await usageDb.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, 'apify'));
    await usageDb.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, accountIdNew));
  });
});
