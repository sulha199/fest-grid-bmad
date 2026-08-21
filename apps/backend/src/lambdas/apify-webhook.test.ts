import test from 'node:test';
import assert from 'node:assert';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './apify-webhook.js';
import { db } from '../db/client.js';
import { apifyPendingJobs, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { createPendingJob } from '../lib/scraper/apify-pending-jobs-store.js';

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
