import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { subscribeToAccount } from './subscribe-to-account.js';

test('subscribeToAccount integration tests', async (t) => {
  let testUser: any;

  // Retrieve a seeded user to use across the tests
  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  testUser = seededUsers[0];

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
});
