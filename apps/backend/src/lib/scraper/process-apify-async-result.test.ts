import test from 'node:test';
import assert from 'node:assert';
import { randomUUID, randomBytes } from 'node:crypto';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, apifyPendingJobs, posts } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { processApifyAsyncResult } from './process-apify-async-result.js';
import { createPendingJob } from './apify-pending-jobs-store.js';
import { seedSubscriberWithGeminiKey, captureAiQueueSends } from '../posts/auto-enqueue-test-helpers.js';
import { setSendSqsMessage } from '../aws/send-sqs-message.js';

test('process-apify-async-result tests', async (t) => {
  let testProfileId: string;

  t.beforeEach(async () => {
    testProfileId = randomUUID();
    // Create a test profile
    await db.insert(socialMediaAccountProfiles).values({
      id: testProfileId,
      accountId: 'acct-' + Date.now(),
      platform: 'instagram',
      username: 'test_user',
      displayName: 'Test User',
    });
  });

  let extraDiscoveredAccountIds: string[] = [];
  // Story 3.15 added post_account_associations with an FK onto social_media_account_profiles,
  // and resolves a new post's accountId to the discovered publisher profile when ownerId is
  // present (AC3) -- so a post created by a Story 3.14 attribution test is NOT necessarily found
  // by `posts.accountId = testProfileId` below. Track such posts by URL so they (and, via the
  // postId cascade, their post_account_associations rows) are deleted before the discovered
  // profile deletes below, mirroring persist-scraped-post.test.ts's Story 3.15 cleanup fix.
  let extraPostUrls: string[] = [];

  t.afterEach(async () => {
    if (extraPostUrls.length > 0) {
      await db.delete(posts).where(inArray(posts.postUrl, extraPostUrls));
      extraPostUrls = [];
    }
    await db.delete(posts).where(eq(posts.accountId, testProfileId));
    await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
    for (const accountId of extraDiscoveredAccountIds) {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, accountId));
    }
    extraDiscoveredAccountIds = [];
  });

  await t.test('persists posts and marks job completed', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-123-' + Date.now(),
      webhookToken: randomBytes(24).toString('hex'),
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
        videoUrl: 'https://example.com/video2.mp4',
      },
    ];

    await processApifyAsyncResult(pendingJob, items);

    // Verify posts persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId))
      .orderBy(posts.postUrl);

    assert.strictEqual(persistedPosts.length, 2);
    assert.strictEqual(persistedPosts[0].content, 'First post');
    assert.strictEqual(persistedPosts[0].postUrl, 'https://www.instagram.com/p/abc123/');
    assert.strictEqual(persistedPosts[0].videoUrl, null);
    assert.strictEqual(persistedPosts[0].originalPostUrl, 'https://www.instagram.com/p/abc123/');
    assert.strictEqual(persistedPosts[1].content, 'Second post');
    assert.strictEqual(persistedPosts[1].postUrl, 'https://www.instagram.com/p/def456/');
    assert.strictEqual(persistedPosts[1].videoUrl, 'https://example.com/video2.mp4');
    assert.strictEqual(persistedPosts[1].originalPostUrl, 'https://www.instagram.com/p/def456/');

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
      webhookToken: randomBytes(24).toString('hex'),
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

  await t.test('skips AJV-invalid items and persists valid ones', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-validation-' + Date.now(),
      webhookToken: randomBytes(24).toString('hex'),
    });

    const pendingJob = {
      id,
      profileId: testProfileId,
      runId: 'run-validation',
      webhookToken,
      status: 'PENDING' as const,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const items = [
      {
        url: 'https://www.instagram.com/p/valid1/',
        caption: 'Valid post 1',
        timestamp: '2026-08-08T00:00:00Z',
        displayUrl: 'https://example.com/img1.jpg',
      },
      {
        // This item will fail AJV validation: missing 'content' (required)
        url: 'https://www.instagram.com/p/invalid_no_caption/',
        timestamp: '2026-08-09T00:00:00Z',
      },
      {
        url: 'https://www.instagram.com/p/valid2/',
        caption: 'Valid post 2',
        timestamp: '2026-08-10T00:00:00Z',
        displayUrl: 'https://example.com/img2.jpg',
      },
    ];

    // Should not throw despite AJV-invalid item
    await processApifyAsyncResult(pendingJob, items);

    // Verify only valid posts persisted
    const persistedPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.accountId, testProfileId))
      .orderBy(posts.postUrl);

    assert.strictEqual(persistedPosts.length, 2);
    assert.strictEqual(persistedPosts[0].content, 'Valid post 1');
    assert.strictEqual(persistedPosts[0].postUrl, 'https://www.instagram.com/p/valid1/');
    assert.strictEqual(persistedPosts[1].content, 'Valid post 2');
    assert.strictEqual(persistedPosts[1].postUrl, 'https://www.instagram.com/p/valid2/');

    // Verify job still marked completed
    const [job] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.strictEqual(job.status, 'COMPLETED');
  });

  await t.test('persists discovered social_media_account_profiles rows for a raw Apify item with ownerId+coauthorProducers populated (Story 3.14)', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-attribution-' + Date.now(),
      webhookToken: randomBytes(24).toString('hex'),
    });

    const pendingJob = {
      id,
      profileId: testProfileId,
      runId: 'run-attribution',
      webhookToken,
      status: 'PENDING' as const,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ownerId = 'discovered-owner-paar-' + Date.now();
    const coauthorId = 'discovered-coauthor-paar-' + Date.now();
    extraDiscoveredAccountIds.push(ownerId, coauthorId);
    extraPostUrls.push('https://www.instagram.com/p/attribution123/');

    const items = [
      {
        url: 'https://www.instagram.com/p/attribution123/',
        caption: 'Post with attribution',
        timestamp: '2026-08-08T00:00:00Z',
        displayUrl: 'https://example.com/img1.jpg',
        ownerId,
        ownerUsername: 'owner_paar_user',
        coauthorProducers: [{ id: coauthorId, username: 'coauthor_paar_user' }],
      },
    ];

    await processApifyAsyncResult(pendingJob, items);

    const discoveredOwnerProfile = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, ownerId))
      .then((rows) => rows[0]);
    assert.ok(discoveredOwnerProfile, 'publisher discovered profile row should exist');

    const discoveredCoauthorProfile = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, coauthorId))
      .then((rows) => rows[0]);
    assert.ok(discoveredCoauthorProfile, 'coauthor discovered profile row should exist');
  });

  // Story 3.6z follow-up: the Apify async webhook path (and the stale-job sweep reusing it)
  // persisted posts but never enqueued them.
  await t.test('auto-enqueues a new post when the account has a key, and not again on re-delivery', async () => {
    const cleanupSeed = await seedSubscriberWithGeminiKey(testProfileId);
    const sends = captureAiQueueSends();
    try {
      const { id, webhookToken } = await createPendingJob({
        profileId: testProfileId,
        runId: 'run-autoenqueue-' + Date.now(),
        webhookToken: randomBytes(24).toString('hex'),
      });
      const pendingJob = {
        id,
        profileId: testProfileId,
        runId: 'run-autoenqueue',
        webhookToken,
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const items = [
        {
          url: 'https://www.instagram.com/p/auto-enqueue-apify/',
          caption: 'Auto-enqueue Apify post',
          timestamp: '2026-08-08T00:00:00Z',
          displayUrl: 'https://example.com/img1.jpg',
        },
      ];

      await processApifyAsyncResult(pendingJob, items);

      const [post] = await db.select().from(posts).where(eq(posts.accountId, testProfileId));
      assert.strictEqual(sends.bodies.length, 1, 'a new post with an available key should be auto-enqueued once');
      assert.strictEqual(JSON.parse(sends.bodies[0]).postId, post.id);

      await processApifyAsyncResult(pendingJob, items);
      assert.strictEqual(sends.bodies.length, 1, 're-delivered post must not be enqueued again');
    } finally {
      sends.restore();
      await db.delete(posts).where(eq(posts.accountId, testProfileId));
      await cleanupSeed();
    }
  });

  await t.test('does not enqueue a new post when the account has no key', async () => {
    const sends = captureAiQueueSends();
    try {
      const { id, webhookToken } = await createPendingJob({
        profileId: testProfileId,
        runId: 'run-nokey-' + Date.now(),
        webhookToken: randomBytes(24).toString('hex'),
      });
      const pendingJob = {
        id,
        profileId: testProfileId,
        runId: 'run-nokey',
        webhookToken,
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await processApifyAsyncResult(pendingJob, [
        {
          url: 'https://www.instagram.com/p/no-key-apify/',
          caption: 'No-key Apify post',
          timestamp: '2026-08-08T00:00:00Z',
          displayUrl: 'https://example.com/img1.jpg',
        },
      ]);

      const persisted = await db.select().from(posts).where(eq(posts.accountId, testProfileId));
      assert.strictEqual(persisted.length, 1);
      assert.strictEqual(persisted[0].isExtracted, false);
      assert.strictEqual(sends.bodies.length, 0);
    } finally {
      sends.restore();
    }
  });

  await t.test('an enqueue failure on one post does not stop the rest of the batch or the job completing', async (st) => {
    const cleanupSeed = await seedSubscriberWithGeminiKey(testProfileId);
    const sends = captureAiQueueSends();
    st.mock.method(console, 'error', () => {});
    try {
      const { id, webhookToken } = await createPendingJob({
        profileId: testProfileId,
        runId: 'run-partial-failure-' + Date.now(),
        webhookToken: randomBytes(24).toString('hex'),
      });
      const pendingJob = {
        id,
        profileId: testProfileId,
        runId: 'run-partial-failure',
        webhookToken,
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let sendAttempts = 0;
      const delivered: string[] = [];
      setSendSqsMessage(async (_queueUrl, body) => {
        sendAttempts++;
        if (sendAttempts === 1) throw new Error('SQS throttled');
        delivered.push(body);
      });

      await processApifyAsyncResult(pendingJob, [
        {
          url: 'https://www.instagram.com/p/partial-failure-apify-1/',
          caption: 'First post, enqueue will fail',
          timestamp: '2026-08-08T00:00:00Z',
          displayUrl: 'https://example.com/img1.jpg',
        },
        {
          url: 'https://www.instagram.com/p/partial-failure-apify-2/',
          caption: 'Second post, enqueue should still be attempted',
          timestamp: '2026-08-09T00:00:00Z',
          displayUrl: 'https://example.com/img2.jpg',
        },
      ]);

      const persisted = await db.select().from(posts).where(eq(posts.accountId, testProfileId));
      assert.strictEqual(persisted.length, 2, 'both posts persist despite the first enqueue failing');
      assert.strictEqual(sendAttempts, 2, 'enqueue is still attempted for the second post');
      assert.strictEqual(delivered.length, 1);

      const [job] = await db.select().from(apifyPendingJobs).where(eq(apifyPendingJobs.id, id));
      assert.strictEqual(job.status, 'COMPLETED', 'job still completes');
    } finally {
      sends.restore();
      await db.delete(posts).where(eq(posts.accountId, testProfileId));
      await cleanupSeed();
    }
  });
});
