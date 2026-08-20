import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, posts } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { getUsersWithStaleQueuedPosts } from './get-users-with-stale-queued-posts.js';

test('getUsersWithStaleQueuedPosts integration tests', async (t) => {
  const testRunId = Date.now();
  const createdUsers: any[] = [];
  const createdProfiles: any[] = [];
  const createdSubs: any[] = [];
  const createdPosts: any[] = [];

  // Helper to clean up created entities
  t.after(async () => {
    if (createdPosts.length > 0) {
      await db.delete(posts).where(inArray(posts.id, createdPosts.map(p => p.id)));
    }
    if (createdSubs.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs.map(s => s.id)));
    }
    if (createdProfiles.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles.map(p => p.id)));
    }
    if (createdUsers.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUsers.map(u => u.id)));
    }
  });

  // Create unique profiles for each user subscription
  const createProfile = async (suffix: string) => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: `platform-acc-${testRunId}-${suffix}`,
        platform: 'instagram',
        displayName: `Test Profile ${suffix}`,
        username: `test_username_${testRunId}_${suffix}`,
      })
      .returning();
    createdProfiles.push(profile);
    return profile;
  };

  const createUser = async (email: string, name: string, lastQuotaWarningEmailSentAt: Date | null) => {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        lastQuotaWarningEmailSentAt,
      })
      .returning();
    createdUsers.push(user);
    return user;
  };

  const subscribeUserToProfile = async (userId: string, profileId: string) => {
    const [sub] = await db
      .insert(subscriptions)
      .values({
        userId,
        accountId: profileId,
        isNewlyAdded: false,
      })
      .returning();
    createdSubs.push(sub);
    return sub;
  };

  const createPostForProfile = async (profileId: string, suffix: string, createdAt: Date, isExtracted = false) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profileId,
        platform: 'instagram',
        content: `Post content ${suffix}`,
        postUrl: `https://instagram.com/p/${testRunId}_${suffix}`,
        isExtracted,
        publishedAt: createdAt,
        createdAt,
      })
      .returning();
    createdPosts.push(post);
    return post;
  };

  // Thresholds used for testing:
  const thresholdDays = 3;
  const thresholdCount = 3;
  const cooldownDays = 7;

  const now = new Date();
  const staleDate = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago (stale)
  const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago (recent)
  const insideCooldownDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago (inside cooldown of 7 days)
  const outsideCooldownDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000); // 8 days ago (outside cooldown)

  // User 1: Qualifying user (stale posts >= count, not warned)
  const user1 = await createUser(`u1-${testRunId}@example.com`, 'User One', null);
  const profile1 = await createProfile('u1');
  await subscribeUserToProfile(user1.id, profile1.id);
  await createPostForProfile(profile1.id, 'u1-p1', staleDate);
  await createPostForProfile(profile1.id, 'u1-p2', staleDate);
  await createPostForProfile(profile1.id, 'u1-p3', staleDate);

  // User 2: Below count threshold (only 2 stale posts)
  const user2 = await createUser(`u2-${testRunId}@example.com`, 'User Two', null);
  const profile2 = await createProfile('u2');
  await subscribeUserToProfile(user2.id, profile2.id);
  await createPostForProfile(profile2.id, 'u2-p1', staleDate);
  await createPostForProfile(profile2.id, 'u2-p2', staleDate);

  // User 3: Recent posts (3 posts, but recent/not stale)
  const user3 = await createUser(`u3-${testRunId}@example.com`, 'User Three', null);
  const profile3 = await createProfile('u3');
  await subscribeUserToProfile(user3.id, profile3.id);
  await createPostForProfile(profile3.id, 'u3-p1', recentDate);
  await createPostForProfile(profile3.id, 'u3-p2', recentDate);
  await createPostForProfile(profile3.id, 'u3-p3', recentDate);

  // User 4: Within cooldown window (qualifying posts but last warning was 2 days ago)
  const user4 = await createUser(`u4-${testRunId}@example.com`, 'User Four', insideCooldownDate);
  const profile4 = await createProfile('u4');
  await subscribeUserToProfile(user4.id, profile4.id);
  await createPostForProfile(profile4.id, 'u4-p1', staleDate);
  await createPostForProfile(profile4.id, 'u4-p2', staleDate);
  await createPostForProfile(profile4.id, 'u4-p3', staleDate);

  // User 5: Past cooldown window (qualifying posts, last warning 8 days ago)
  const user5 = await createUser(`u5-${testRunId}@example.com`, 'User Five', outsideCooldownDate);
  const profile5 = await createProfile('u5');
  await subscribeUserToProfile(user5.id, profile5.id);
  await createPostForProfile(profile5.id, 'u5-p1', staleDate);
  await createPostForProfile(profile5.id, 'u5-p2', staleDate);
  await createPostForProfile(profile5.id, 'u5-p3', staleDate);

  // User 6: No subscriptions (has stale posts on some profile but not subscribed)
  const user6 = await createUser(`u6-${testRunId}@example.com`, 'User Six', null);

  await t.test('getUsersWithStaleQueuedPosts returns correct qualifying users and excludes others', async () => {
    const result = await getUsersWithStaleQueuedPosts(thresholdDays, thresholdCount, cooldownDays);

    // Filter results to only look at our created users in this test run to prevent interference
    const runResult = result.filter(r => r.email.endsWith(`-${testRunId}@example.com`));

    assert.strictEqual(runResult.length, 2, 'Should only return 2 qualifying users (user1 and user5)');

    const user1Match = runResult.find(r => r.userId === user1.id);
    assert.ok(user1Match, 'User 1 must be included');
    assert.strictEqual(user1Match.email, user1.email);
    assert.strictEqual(user1Match.name, user1.name);
    assert.strictEqual(user1Match.queuedPostCount, 3);

    const user5Match = runResult.find(r => r.userId === user5.id);
    assert.ok(user5Match, 'User 5 must be included');
    assert.strictEqual(user5Match.email, user5.email);
    assert.strictEqual(user5Match.name, user5.name);
    assert.strictEqual(user5Match.queuedPostCount, 3);

    const user2Match = runResult.find(r => r.userId === user2.id);
    assert.ok(!user2Match, 'User 2 (below count) must be excluded');

    const user3Match = runResult.find(r => r.userId === user3.id);
    assert.ok(!user3Match, 'User 3 (recent posts) must be excluded');

    const user4Match = runResult.find(r => r.userId === user4.id);
    assert.ok(!user4Match, 'User 4 (within cooldown) must be excluded');

    const user6Match = runResult.find(r => r.userId === user6.id);
    assert.ok(!user6Match, 'User 6 (no subscriptions) must be excluded');
  });
});
