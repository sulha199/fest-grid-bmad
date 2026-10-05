import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { setSendSqsMessage } from '../aws/send-sqs-message.js';
import { autoEnqueueNewPostForExtraction } from './auto-enqueue-new-post.js';
import { seedSubscriberWithGeminiKey, captureAiQueueSends } from './auto-enqueue-test-helpers.js';

test('autoEnqueueNewPostForExtraction', async (t) => {
  let profileId: string;
  let postId: string;
  let accountId: string;
  let cleanups: Array<() => Promise<void> | void> = [];

  t.beforeEach(async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'auto-enqueue-helper-' + Date.now() + '-' + Math.random().toString(16).slice(2),
      platform: 'instagram',
      displayName: 'Auto-Enqueue Helper Account',
      username: 'auto_enqueue_helper',
    }).returning();
    profileId = profile.id;

    const [post] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: `https://www.instagram.com/p/${Date.now()}-${Math.random().toString(16).slice(2)}/`,
      content: 'Helper test post',
      publishedAt: new Date('2026-08-08T12:00:00Z'),
    }).returning();
    postId = post.id;
    accountId = post.accountId;
    cleanups = [];
  });

  t.afterEach(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await db.delete(posts).where(eq(posts.accountId, profileId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  await t.test('a new post with an available key is enqueued exactly once', async () => {
    cleanups.push(await seedSubscriberWithGeminiKey(profileId));
    const sends = captureAiQueueSends();
    cleanups.push(sends.restore);

    await autoEnqueueNewPostForExtraction({ post: { id: postId, accountId }, alreadyExisted: false }, 'test');

    assert.strictEqual(sends.bodies.length, 1);
    assert.strictEqual(JSON.parse(sends.bodies[0]).postId, postId);
  });

  await t.test('a new post with no available key is not enqueued and does not throw', async () => {
    const sends = captureAiQueueSends();
    cleanups.push(sends.restore);

    await autoEnqueueNewPostForExtraction({ post: { id: postId, accountId }, alreadyExisted: false }, 'test');

    assert.strictEqual(sends.bodies.length, 0);
    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(row.isExtracted, false);
    assert.strictEqual(row.queuedForExtractionAt, null);
  });

  await t.test('an already-existing post is never enqueued, even when a key is available', async () => {
    cleanups.push(await seedSubscriberWithGeminiKey(profileId));
    const sends = captureAiQueueSends();
    cleanups.push(sends.restore);

    await autoEnqueueNewPostForExtraction({ post: { id: postId, accountId }, alreadyExisted: true }, 'test');

    assert.strictEqual(sends.bodies.length, 0);
  });

  await t.test('an enqueue failure is logged with the source prefix and swallowed', async (st) => {
    cleanups.push(await seedSubscriberWithGeminiKey(profileId));
    const sends = captureAiQueueSends();
    cleanups.push(sends.restore);
    setSendSqsMessage(async () => {
      throw new Error('SQS AccessDenied');
    });
    const errorLog = st.mock.method(console, 'error', () => {});

    await autoEnqueueNewPostForExtraction({ post: { id: postId, accountId }, alreadyExisted: false }, 'someSource');

    assert.strictEqual(errorLog.mock.callCount(), 1);
    const [message] = errorLog.mock.calls[0].arguments as [string];
    assert.ok(message.startsWith(`[someSource] auto-enqueue failed for post ${postId}`), message);

    // The send-time failure releases the claim, so the post is not stuck for the full TTL.
    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(row.queuedForExtractionAt, null);
  });
});
