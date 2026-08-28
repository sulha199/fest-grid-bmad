import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/client.js';
import { posts, unprocessedScraperPayloads, socialMediaAccountProfiles, scraperActorRuns } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { persistUnprocessedPayload } from '../posts/persist-unprocessed-payload.js';
import { recordActorRunStart } from './record-actor-run.js';
import { replayActorRun } from './replay-actor-run.js';

test('scraper actor run linking (Story 3-4l)', async (t) => {
  let testProfileId: string;
  const testRunId = 'run-' + Date.now();

  t.beforeEach(async () => {
    testProfileId = randomUUID();
    await db.insert(socialMediaAccountProfiles).values({
      id: testProfileId,
      accountId: 'acct-' + Date.now(),
      platform: 'instagram',
      username: 'test_user_' + Date.now(),
      displayName: 'Test User',
    });
  });

  t.afterEach(async () => {
    await db.delete(posts).where(eq(posts.accountId, testProfileId));
    await db.delete(unprocessedScraperPayloads);
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, testProfileId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
  });

  await t.test('persistScrapedPost accepts and writes scraperActorRunId', async () => {
    // Create an audit run
    const auditRunId = await recordActorRunStart({
      vendor: 'APIFY',
      triggerMode: 'SYNC',
      profileId: testProfileId,
      runId: testRunId,
      rawInput: { test: true },
    });

    const postUrl = `https://instagram.com/p/test-${Date.now()}`;

    // Persist post with run ID
    await persistScrapedPost({
      accountId: testProfileId,
      platform: 'instagram',
      content: 'Test post',
      postUrl,
      publishedAt: new Date().toISOString(),
      scraperActorRunId: auditRunId || undefined,
    });

    // Verify post was inserted with run ID
    const [persisted] = await db
      .select()
      .from(posts)
      .where(eq(posts.postUrl, postUrl))
      .limit(1);

    assert.ok(persisted, 'Post should be persisted');
    assert.strictEqual(persisted.scraperActorRunId, auditRunId, 'Post should link to audit run');
  });

  await t.test('persistScrapedPost works without scraperActorRunId', async () => {
    const postUrl = `https://instagram.com/p/test-no-run-${Date.now()}`;

    // Persist post without run ID
    await persistScrapedPost({
      accountId: testProfileId,
      platform: 'instagram',
      content: 'Test post',
      postUrl,
      publishedAt: new Date().toISOString(),
    });

    // Verify post was inserted with NULL run ID
    const [persisted] = await db
      .select()
      .from(posts)
      .where(eq(posts.postUrl, postUrl))
      .limit(1);

    assert.ok(persisted, 'Post should be persisted');
    assert.strictEqual(persisted.scraperActorRunId, null, 'Post run ID should be null');
  });

  await t.test('persistUnprocessedPayload accepts and writes scraperActorRunId', async () => {
    // Create an audit run
    const auditRunId = await recordActorRunStart({
      vendor: 'APIFY',
      triggerMode: 'SYNC',
      profileId: testProfileId,
      runId: testRunId,
      rawInput: { test: true },
    });

    const postUrl = `https://instagram.com/p/invalid-${Date.now()}`;

    // Persist unprocessed payload with run ID
    const payload = await persistUnprocessedPayload({
      rawPayload: { error: 'test' },
      validationError: { message: 'Invalid post' },
      context: {
        source: 'apify',
        scraperVendor: 'instagram',
        accountId: testProfileId,
        postUrl,
        timestamp: new Date().toISOString(),
        parserVersion: '3.4l',
      },
      scraperActorRunId: auditRunId || undefined,
    });

    assert.ok(payload, 'Payload should be persisted');
    assert.strictEqual(payload.scraperActorRunId, auditRunId, 'Payload should link to audit run');
  });

  await t.test('persistUnprocessedPayload works without scraperActorRunId', async () => {
    const postUrl = `https://instagram.com/p/invalid-no-run-${Date.now()}`;

    // Persist unprocessed payload without run ID
    const payload = await persistUnprocessedPayload({
      rawPayload: { error: 'test' },
      validationError: { message: 'Invalid post' },
      context: {
        source: 'apify',
        scraperVendor: 'instagram',
        accountId: testProfileId,
        postUrl,
        timestamp: new Date().toISOString(),
        parserVersion: '3.4l',
      },
    });

    assert.ok(payload, 'Payload should be persisted');
    assert.strictEqual(payload.scraperActorRunId, null, 'Payload run ID should be null');
  });

  await t.test('FK error handling: gracefully handles invalid run ID', async () => {
    const postUrl = `https://instagram.com/p/test-fk-${Date.now()}`;
    const invalidRunId = '00000000-0000-0000-0000-000000000000'; // Non-existent run ID

    // This should not throw even with invalid FK
    const result = await persistScrapedPost({
      accountId: testProfileId,
      platform: 'instagram',
      content: 'Test post',
      postUrl,
      publishedAt: new Date().toISOString(),
      scraperActorRunId: invalidRunId,
    });

    assert.ok(result.post, 'Post should still be persisted despite FK violation');
  });

  await t.test('recordActorRunStart returns run ID for async path', async () => {
    const asyncRunId = 'async-run-' + Date.now();

    // Record async run start
    const recordedId = await recordActorRunStart({
      vendor: 'APIFY',
      triggerMode: 'ASYNC',
      profileId: testProfileId,
      runId: asyncRunId,
      rawInput: { test: true },
      status: 'PENDING',
    });

    assert.ok(recordedId, 'recordActorRunStart should return the recorded run ID');

    // Verify the run was recorded
    const [recorded] = await db
      .select()
      .from(scraperActorRuns)
      .where(eq(scraperActorRuns.id, recordedId!))
      .limit(1);

    assert.ok(recorded, 'Run should exist in database');
    assert.strictEqual(recorded.vendor, 'APIFY');
    assert.strictEqual(recorded.triggerMode, 'ASYNC');
  });

  await t.test('Multiple posts from same run are linked correctly', async () => {
    // Create an audit run
    const auditRunId = await recordActorRunStart({
      vendor: 'APIFY',
      triggerMode: 'SYNC',
      profileId: testProfileId,
      runId: testRunId,
      rawInput: { test: true },
    });

    // Persist multiple posts from same run
    const postUrl1 = `https://instagram.com/p/test1-${Date.now()}`;
    const postUrl2 = `https://instagram.com/p/test2-${Date.now()}`;

    await persistScrapedPost({
      accountId: testProfileId,
      platform: 'instagram',
      content: 'Post 1',
      postUrl: postUrl1,
      publishedAt: new Date().toISOString(),
      scraperActorRunId: auditRunId || undefined,
    });

    await persistScrapedPost({
      accountId: testProfileId,
      platform: 'instagram',
      content: 'Post 2',
      postUrl: postUrl2,
      publishedAt: new Date().toISOString(),
      scraperActorRunId: auditRunId || undefined,
    });

    // Verify both posts are linked to the same run
    const postsFromRun = await db
      .select()
      .from(posts)
      .where(eq(posts.scraperActorRunId, auditRunId!));

    assert.strictEqual(postsFromRun.length, 2, 'Both posts should be linked to run');
    assert.ok(
      postsFromRun.every((p) => p.scraperActorRunId === auditRunId),
      'All posts should link to the same run ID'
    );
  });

  await t.test('replayActorRun Apify branch passes videoUrl and originalPostUrl', async () => {
    const auditRunId = await recordActorRunStart({
      vendor: 'APIFY',
      triggerMode: 'SYNC',
      profileId: testProfileId,
      runId: 'apify-run-replay-' + Date.now(),
      rawInput: { test: true },
    });

    assert.ok(auditRunId);

    // Set stored output to bypass vendor API call
    const rawOutput = [
      {
        url: 'https://instagram.com/p/apify-replay-url/',
        caption: 'Apify replayed post caption',
        timestamp: new Date().toISOString(),
        displayUrl: 'https://example.com/apify-img.jpg',
        videoUrl: 'https://example.com/apify-video.mp4',
      }
    ];

    await db
      .update(scraperActorRuns)
      .set({ rawOutput, status: 'SUCCEEDED', itemCount: 1 })
      .where(eq(scraperActorRuns.id, auditRunId));

    const result = await replayActorRun(auditRunId);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.postsPersisted, 1);

    // Verify post was inserted with videoUrl and originalPostUrl
    const [persisted] = await db
      .select()
      .from(posts)
      .where(eq(posts.postUrl, 'https://instagram.com/p/apify-replay-url/'))
      .limit(1);

    assert.ok(persisted);
    assert.strictEqual(persisted.videoUrl, 'https://example.com/apify-video.mp4');
    assert.strictEqual(persisted.originalPostUrl, 'https://instagram.com/p/apify-replay-url/');
  });

  await t.test('replayActorRun Bright Data branch passes videoUrl and originalPostUrl', async () => {
    const auditRunId = await recordActorRunStart({
      vendor: 'BRIGHTDATA',
      triggerMode: 'SYNC',
      profileId: testProfileId,
      runId: 'bd-run-replay-' + Date.now(),
      rawInput: { test: true },
    });

    assert.ok(auditRunId);

    // Set stored output to bypass vendor API call
    const rawOutput = [
      {
        url: 'https://instagram.com/p/bd-replay-url/',
        caption: 'Bright Data replayed post caption',
        date_posted: new Date().toISOString(),
        image_url: 'https://example.com/bd-img.jpg',
        videos: ['https://example.com/bd-video.mp4'],
      }
    ];

    await db
      .update(scraperActorRuns)
      .set({ rawOutput, status: 'SUCCEEDED', itemCount: 1 })
      .where(eq(scraperActorRuns.id, auditRunId));

    const result = await replayActorRun(auditRunId);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.postsPersisted, 1);

    // Verify post was inserted with videoUrl and originalPostUrl
    const [persisted] = await db
      .select()
      .from(posts)
      .where(eq(posts.postUrl, 'https://instagram.com/p/bd-replay-url/'))
      .limit(1);

    assert.ok(persisted);
    assert.strictEqual(persisted.videoUrl, 'https://example.com/bd-video.mp4');
    assert.strictEqual(persisted.originalPostUrl, 'https://instagram.com/p/bd-replay-url/');
  });
});
