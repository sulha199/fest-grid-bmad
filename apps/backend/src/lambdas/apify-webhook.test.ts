import test from 'node:test';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './apify-webhook.js';
import { db } from '../db/client.js';
import { apifyPendingJobs, socialMediaAccountProfiles, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { createPendingJob } from '../lib/scraper/apify-pending-jobs-store.js';
import { setGetApifyClient, getApifyClient } from '../lib/scraper/instagram-adapter.js';

test('apify-webhook tests', async (t) => {
  const testAccountId = 'profile-' + Date.now();
  let testProfileId: string;

  t.beforeEach(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: testAccountId,
        platform: 'instagram',
        username: 'test_user',
        displayName: 'Test User',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    testProfileId = profile.id;
  });

  t.afterEach(async () => {
    await db.delete(posts).where(eq(posts.accountId, testProfileId));
    await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
  });

  await t.test('returns 400 when jobToken is missing', async () => {
    const event: APIGatewayProxyEvent = {
      queryStringParameters: {},
    } as any;

    const result = await handler(event);

    assert.strictEqual(result.statusCode, 400);
    assert.ok(result.body.includes('Missing jobToken'));
  });

  await t.test('returns 200 when job not found', async () => {
    const event: APIGatewayProxyEvent = {
      queryStringParameters: { jobToken: 'unknown-token' },
    } as any;

    const result = await handler(event);

    assert.strictEqual(result.statusCode, 200);
    assert.ok(result.body.includes('not found'));
  });

  await t.test('returns 200 when job already completed', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-completed',
      webhookToken: randomBytes(24).toString('hex'),
    });

    // Mark as completed
    await db
      .update(apifyPendingJobs)
      .set({ status: 'COMPLETED' })
      .where(eq(apifyPendingJobs.id, id));

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { jobToken: webhookToken },
    } as any;

    const result = await handler(event);

    assert.strictEqual(result.statusCode, 200);
    assert.ok(result.body.includes('already processed'));
  });

  await t.test('returns 200 when job expired', async () => {
    const { id, webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-expired',
      webhookToken: randomBytes(24).toString('hex'),
    });

    // Set expiration to past
    await db
      .update(apifyPendingJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apifyPendingJobs.id, id));

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { jobToken: webhookToken },
    } as any;

    const result = await handler(event);

    assert.strictEqual(result.statusCode, 200);
    assert.ok(result.body.includes('expired'));

    // Verify job marked as EXPIRED
    const [job] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.strictEqual(job.status, 'EXPIRED');
  });

  await t.test('SUCCEEDED run with a dataset: restructured { run, items } from callApifyClient still drives processApifyAsyncResult (first real coverage of this handler\'s success path)', async () => {
    const originalGetApifyClient = getApifyClient;
    const postUrl = `https://www.instagram.com/p/C_webhook_success_${Date.now()}/`;

    setGetApifyClient((() => ({
      run: () => ({
        get: async () => ({ id: 'run-success-1', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' }),
      }),
      dataset: () => ({
        listItems: async () => ({
          items: [
            {
              url: postUrl,
              caption: 'Webhook success path caption',
              timestamp: '2026-10-09T00:00:00Z',
            },
          ],
        }),
      }),
    })) as unknown as typeof originalGetApifyClient);

    const { webhookToken } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-success-1',
      webhookToken: randomBytes(24).toString('hex'),
    });

    try {
      const event: APIGatewayProxyEvent = {
        queryStringParameters: { jobToken: webhookToken },
      } as any;

      const result = await handler(event);

      assert.strictEqual(result.statusCode, 200);
      assert.ok(result.body.includes('Success'));

      // The restructured { run, items } shape from callApifyClient's thunk reached
      // processApifyAsyncResult and the pending job was marked completed.
      const [job] = await db
        .select()
        .from(apifyPendingJobs)
        .where(eq(apifyPendingJobs.profileId, testProfileId));
      assert.strictEqual(job.status, 'COMPLETED');

      const persistedPosts = await db.select().from(posts).where(eq(posts.postUrl, postUrl));
      assert.strictEqual(persistedPosts.length, 1);
      assert.strictEqual(persistedPosts[0].content, 'Webhook success path caption');
    } finally {
      setGetApifyClient(originalGetApifyClient);
    }
  });

  await t.test('returns 200 on any error', async () => {
    // This test verifies error handling returns 200 (no retry)
    const event: APIGatewayProxyEvent = {
      queryStringParameters: { jobToken: 'valid-but-will-fail' },
    } as any;

    const result = await handler(event);

    // Should always return 200 for non-retryable scenarios
    assert.strictEqual(result.statusCode, 200);
  });
});
