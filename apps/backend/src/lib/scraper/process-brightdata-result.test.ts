import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, brightdataPendingJobs, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { processBrightDataResult } from './process-brightdata-result.js';
import { createPendingJob } from './brightdata-pending-jobs-store.js';
import type { BrightdataPendingJob } from './brightdata-pending-jobs-store.js';

test('process-brightdata-result tests', async (t) => {
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
    await db.delete(brightdataPendingJobs).where(eq(brightdataPendingJobs.profileId, testProfileId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
  });

  await t.test('persists valid Bright Data record and marks job completed', async () => {
    const snapshotId = 'snapshot-123-' + Date.now();
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      snapshotId,
    });

    const pendingJob: BrightdataPendingJob = {
      id,
      profileId: testProfileId,
      snapshotId,
      webhookToken,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const records = [
      {
        url: 'https://www.instagram.com/p/abc123/',
        caption: 'Test post from Bright Data',
        date_posted: '2026-08-08T00:00:00Z',
        image_url: 'https://example.com/img.jpg',
      },
    ];

    await processBrightDataResult(pendingJob, records);

    // Verify post persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId));

    assert.strictEqual(persistedPosts.length, 1);
    assert.strictEqual(persistedPosts[0].content, 'Test post from Bright Data');
    assert.strictEqual(persistedPosts[0].postUrl, 'https://www.instagram.com/p/abc123/');
    assert.strictEqual(persistedPosts[0].imageUrl, 'https://example.com/img.jpg');

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
      .from(brightdataPendingJobs)
      .where(eq(brightdataPendingJobs.id, id));

    assert.strictEqual(job.status, 'COMPLETED');
  });

  await t.test('skips invalid Bright Data record without throwing', async () => {
    const snapshotId = 'snapshot-456-' + Date.now();
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      snapshotId,
    });

    const pendingJob: BrightdataPendingJob = {
      id,
      profileId: testProfileId,
      snapshotId,
      webhookToken,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const records = [
      {
        url: 'https://www.instagram.com/p/valid/',
        caption: 'Valid post',
        date_posted: '2026-08-08T00:00:00Z',
        image_url: 'https://example.com/valid.jpg',
      },
      {
        url: 'https://www.instagram.com/p/invalid/',
        caption: 'Invalid post',
        date_posted: 12345, // Wrong type: number instead of string
        image_url: 'https://example.com/invalid.jpg',
      },
    ];

    // Should not throw despite invalid record
    await processBrightDataResult(pendingJob, records);

    // Verify only valid post persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId));

    assert.strictEqual(persistedPosts.length, 1);
    assert.strictEqual(persistedPosts[0].content, 'Valid post');
    assert.strictEqual(persistedPosts[0].postUrl, 'https://www.instagram.com/p/valid/');

    // Verify job still marked completed
    const [job] = await db
      .select()
      .from(brightdataPendingJobs)
      .where(eq(brightdataPendingJobs.id, id));

    assert.strictEqual(job.status, 'COMPLETED');
  });

  await t.test('skips record with missing required URL field', async () => {
    const snapshotId = 'snapshot-789-' + Date.now();
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      snapshotId,
    });

    const pendingJob: BrightdataPendingJob = {
      id,
      profileId: testProfileId,
      snapshotId,
      webhookToken,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const records = [
      {
        // Missing url
        caption: 'Post without URL',
        date_posted: '2026-08-08T00:00:00Z',
        image_url: 'https://example.com/img.jpg',
      },
    ];

    // Should not throw
    await processBrightDataResult(pendingJob, records);

    // Verify no posts persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId));

    assert.strictEqual(persistedPosts.length, 0);

    // Verify job still marked completed
    const [job] = await db
      .select()
      .from(brightdataPendingJobs)
      .where(eq(brightdataPendingJobs.id, id));

    assert.strictEqual(job.status, 'COMPLETED');
  });
});
