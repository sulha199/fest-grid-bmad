import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, posts } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { sendQuotaWarningEmails } from './send-quota-warning-emails.js';

test('sendQuotaWarningEmails orchestration integration and mock tests', async (t) => {
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

  const createUser = async (email: string, name: string) => {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        lastQuotaWarningEmailSentAt: null,
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

  const createPostForProfile = async (profileId: string, suffix: string, createdAt: Date) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profileId,
        content: `Post content ${suffix}`,
        postUrl: `https://instagram.com/p/${testRunId}_${suffix}`,
        isExtracted: false,
        publishedAt: createdAt,
        createdAt,
      })
      .returning();
    createdPosts.push(post);
    return post;
  };

  const staleDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days ago (stale)

  // User 1: Successful send scenario
  const user1 = await createUser(`u1-${testRunId}@example.com`, 'User One');
  const profile1 = await createProfile('u1');
  await subscribeUserToProfile(user1.id, profile1.id);
  await createPostForProfile(profile1.id, 'u1-p1', staleDate);
  await createPostForProfile(profile1.id, 'u1-p2', staleDate);
  await createPostForProfile(profile1.id, 'u1-p3', staleDate);

  // User 2: Failed send scenario
  const user2 = await createUser(`u2-${testRunId}@example.com`, 'User Two');
  const profile2 = await createProfile('u2');
  await subscribeUserToProfile(user2.id, profile2.id);
  await createPostForProfile(profile2.id, 'u2-p1', staleDate);
  await createPostForProfile(profile2.id, 'u2-p2', staleDate);
  await createPostForProfile(profile2.id, 'u2-p3', staleDate);

  await t.test('Successfully sends quota warning emails and updates timestamps or handles failures cleanly', async () => {
    const sentEmails: { to: string; variables: any }[] = [];

    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      if (to === user2.email) {
        throw new Error('SES simulated delivery failure');
      }
      sentEmails.push({ to, variables });
      return 'stub-msg-id';
    };

    // Run orchestration with injected mock dependency
    await sendQuotaWarningEmails({
      sendTemplatedEmail: mockSendTemplatedEmail as any,
    });

    // Verify User 1 (Successful send)
    const [dbUser1] = await db.select().from(users).where(eq(users.id, user1.id));
    assert.ok(dbUser1.lastQuotaWarningEmailSentAt, 'User 1 timestamp should be updated on successful send');
    assert.ok(
      Math.abs(dbUser1.lastQuotaWarningEmailSentAt.getTime() - Date.now()) < 10000,
      'User 1 timestamp should be close to now'
    );

    // Verify User 2 (Failed send)
    const [dbUser2] = await db.select().from(users).where(eq(users.id, user2.id));
    assert.strictEqual(
      dbUser2.lastQuotaWarningEmailSentAt,
      null,
      'User 2 timestamp should NOT be updated on failed send'
    );

    // Verify email details
    assert.strictEqual(sentEmails.length, 1, 'Only one email should have been sent successfully');
    assert.strictEqual(sentEmails[0].to, user1.email);
    assert.strictEqual(sentEmails[0].variables.userName, 'User One');
    assert.strictEqual(sentEmails[0].variables.queuedPostCount, 3);
    assert.strictEqual(sentEmails[0].variables.queuedDays, 3);
    assert.ok(sentEmails[0].variables.apiKeyManagementUrl.endsWith('/settings/api-keys'));
  });
});
