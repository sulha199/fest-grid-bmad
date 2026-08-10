import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { getActiveSubscriberUserIds } from './get-active-subscriber-user-ids.js';

test('getActiveSubscriberUserIds integration tests', async (t) => {
  // Retrieve seeded users to use across the tests
  const seededUsers = await db.select().from(users).limit(2);
  assert.ok(seededUsers.length >= 2, 'Must have at least two seeded users');
  const user1 = seededUsers[0];
  const user2 = seededUsers[1];

  // Create a socialMediaAccountProfile for testing
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'platform-acc-id-' + Date.now(),
      platform: 'instagram',
      displayName: 'Test Profile',
      username: 'test_profile_' + Date.now()
    })
    .returning();

  t.after(async () => {
    // Cleanup
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('Case A: should return empty list if there are zero subscribers', async () => {
    const userIds = await getActiveSubscriberUserIds(profile.id);
    assert.deepStrictEqual(userIds, []);
  });

  await t.test('Case B: should return active subscribers', async () => {
    // Subscribe user1
    const [sub1] = await db
      .insert(subscriptions)
      .values({
        userId: user1.id,
        accountId: profile.id,
        isNewlyAdded: true
      })
      .returning();

    // Subscribe user2
    const [sub2] = await db
      .insert(subscriptions)
      .values({
        userId: user2.id,
        accountId: profile.id,
        isNewlyAdded: true
      })
      .returning();

    const userIds = await getActiveSubscriberUserIds(profile.id);
    assert.strictEqual(userIds.length, 2);
    assert.ok(userIds.includes(user1.id));
    assert.ok(userIds.includes(user2.id));

    // Cleanup for next test
    await db.delete(subscriptions).where(eq(subscriptions.id, sub1.id));
    await db.delete(subscriptions).where(eq(subscriptions.id, sub2.id));
  });

  await t.test('Case C: should exclude soft-deleted subscriptions', async () => {
    // Insert user1 subscription (active)
    const [subActive] = await db
      .insert(subscriptions)
      .values({
        userId: user1.id,
        accountId: profile.id,
        isNewlyAdded: true
      })
      .returning();

    // Insert user2 subscription (soft deleted)
    const [subDeleted] = await db
      .insert(subscriptions)
      .values({
        userId: user2.id,
        accountId: profile.id,
        isNewlyAdded: true,
        deletedAt: new Date()
      })
      .returning();

    const userIds = await getActiveSubscriberUserIds(profile.id);
    assert.strictEqual(userIds.length, 1);
    assert.strictEqual(userIds[0], user1.id);

    // Cleanup
    await db.delete(subscriptions).where(eq(subscriptions.id, subActive.id));
    await db.delete(subscriptions).where(eq(subscriptions.id, subDeleted.id));
  });
});
