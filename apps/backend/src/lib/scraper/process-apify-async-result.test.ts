import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, apifyPendingJobs, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { processApifyAsyncResult } from './process-apify-async-result.js';
import { createPendingJob } from './apify-pending-jobs-store.js';

test('process-apify-async-result tests', async (t) => {
  const testProfileId = 'profile-' + Date.now();

  t.beforeEach(async () => {
    // Create a test profile
    await db.insert(socialMediaAccountProfiles).values({
      accountId: testProfileId,
      platform: 'instagram',
      username: 'test_user',
      displayName: 'Test User',
    });
  });

  t.afterEach(async () => {
    await db.delete(posts).where(eq(posts.accountId, testProfileId));
    await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
  });

  await t.test('persists posts and marks job completed', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-123-' + Date.now(),
    });

    const pendingJob = {
      id,
      profileId: testProfileId,
      runId: 'run-123',
      webhookToken,
      status: 'PENDING' as const,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const items = [
      {
        url: 'https://www.instagram.com/p/abc123/',
        caption: 'First post',
        timestamp: '2026-08-08T00:00:00Z',
        displayUrl: 'https://example.com/img1.jpg',
      },
      {
        url: 'https://www.instagram.com/p/def456/',
        caption: 'Second post',
        timestamp: '2026-08-09T00:00:00Z',
        displayUrl: 'https://example.com/img2.jpg',
      },
    ];

    await processApifyAsyncResult(pendingJob, items);

    // Verify posts persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId));

    assert.strictEqual(persistedPosts.length, 2);
    assert.strictEqual(persistedPosts[0].content, 'First post');
    assert.strictEqual(persistedPosts[0].postUrl, 'https://www.instagram.com/p/abc123/');
    assert.strictEqual(persistedPosts[1].content, 'Second post');
    assert.strictEqual(persistedPosts[1].postUrl, 'https://www.instagram.com/p/def456/');

    // Verify lastScrapedAt stamped
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfileId));

    assert.ok(profile.lastScrapedAt);
    const timeDiff = Date.now() - (profile.lastScrapedAt as Date).getTime();
    assert.ok(timeDiff < 5000, 'lastScrapedAt should be recent');

    // Verify job marked completed
    const [job] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.strictEqual(job.status, 'COMPLETED');
  });

  await t.test('continues processing items on individual failures', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-456-' + Date.now(),
    });

    const pendingJob = {
      id,
      profileId: testProfileId,
      runId: 'run-456',
      webhookToken,
      status: 'PENDING' as const,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const items = [
      {
        url: 'https://www.instagram.com/p/good1/',
        caption: 'Good post',
        timestamp: '2026-08-08T00:00:00Z',
        displayUrl: 'https://example.com/img1.jpg',
      },
      // Missing required fields - will cause persist failure but should continue
      {
        url: 'https://www.instagram.com/p/bad/',
        caption: 'Bad post',
        // Missing timestamp - but persistScrapedPost should handle it
      },
      {
        url: 'https://www.instagram.com/p/good2/',
        caption: 'Another good post',
        timestamp: '2026-08-10T00:00:00Z',
        displayUrl: 'https://example.com/img3.jpg',
      },
    ];

    // Should not throw despite item failures
    await processApifyAsyncResult(pendingJob, items);

    // Verify at least the good posts persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId));

    assert.ok(persistedPosts.length >= 1, 'Should persist at least one post');

    // Verify job still marked completed
    const [job] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.strictEqual(job.status, 'COMPLETED');
  });
});
