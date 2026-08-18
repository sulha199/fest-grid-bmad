import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { apifyPendingJobs } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  createPendingJob,
  findPendingJobByToken,
  markPendingJobCompleted,
  markPendingJobExpired,
  findExpiredPendingJobs,
} from './apify-pending-jobs-store.js';

test('apify-pending-jobs-store tests', async (t) => {
  const testProfileId = 'test-profile-id-' + Date.now();

  t.afterEach(async () => {
    await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
  });

  await t.test('creates pending job with webhook token', async () => {
    const runId = 'run-123-' + Date.now();
    const result = await createPendingJob({ profileId: testProfileId, runId });

    assert.ok(result.id);
    assert.ok(result.webhookToken);
    assert.strictEqual(result.webhookToken.length, 48); // randomBytes(24).toString('hex') = 48 chars

    const [row] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, result.id));

    assert.ok(row);
    assert.strictEqual(row.profileId, testProfileId);
    assert.strictEqual(row.runId, runId);
    assert.strictEqual(row.status, 'PENDING');
    assert.ok(row.expiresAt);
  });

  await t.test('finds pending job by webhook token', async () => {
    const runId = 'run-456-' + Date.now();
    const { webhookToken, id } = await createPendingJob({
      profileId: testProfileId,
      runId,
    });

    const found = await findPendingJobByToken(webhookToken);

    assert.ok(found);
    assert.strictEqual(found.id, id);
    assert.strictEqual(found.profileId, testProfileId);
    assert.strictEqual(found.runId, runId);
    assert.strictEqual(found.status, 'PENDING');
  });

  await t.test('marks pending job as completed', async () => {
    const runId = 'run-789-' + Date.now();
    const { id } = await createPendingJob({ profileId: testProfileId, runId });

    await markPendingJobCompleted(id);

    const [row] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.strictEqual(row.status, 'COMPLETED');
  });

  await t.test('marks pending job as expired', async () => {
    const runId = 'run-expired-' + Date.now();
    const { id } = await createPendingJob({ profileId: testProfileId, runId });

    await markPendingJobExpired(id);

    const [row] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.strictEqual(row.status, 'EXPIRED');
  });

  await t.test('finds only expired pending jobs', async () => {
    const pastRunId = 'run-past-' + Date.now();
    const futureRunId = 'run-future-' + Date.now();

    // Create past job (expired)
    const { id: pastId } = await createPendingJob({ profileId: testProfileId, runId: pastRunId });
    await db
      .update(apifyPendingJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) }) // 1 second in the past
      .where(eq(apifyPendingJobs.id, pastId));

    // Create future job (not expired)
    await createPendingJob({ profileId: testProfileId, runId: futureRunId });

    const expiredJobs = await findExpiredPendingJobs();

    // Filter to just our test jobs
    const ourExpiredJobs = expiredJobs.filter(j => j.profileId === testProfileId);

    assert.strictEqual(ourExpiredJobs.length, 1);
    assert.strictEqual(ourExpiredJobs[0].id, pastId);
    assert.strictEqual(ourExpiredJobs[0].runId, pastRunId);
  });

  await t.test('expired job query only returns PENDING status jobs', async () => {
    const completedRunId = 'run-completed-' + Date.now();
    const pendingRunId = 'run-pending-' + Date.now();

    // Create completed job with expired timestamp
    const { id: completedId } = await createPendingJob({
      profileId: testProfileId,
      runId: completedRunId,
    });
    await db
      .update(apifyPendingJobs)
      .set({
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() - 1000),
      })
      .where(eq(apifyPendingJobs.id, completedId));

    // Create pending job with expired timestamp
    const { id: pendingId } = await createPendingJob({
      profileId: testProfileId,
      runId: pendingRunId,
    });
    await db
      .update(apifyPendingJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apifyPendingJobs.id, pendingId));

    const expiredJobs = await findExpiredPendingJobs();
    const ourExpiredJobs = expiredJobs.filter(j => j.profileId === testProfileId);

    // Should only include pending job, not completed
    assert.strictEqual(ourExpiredJobs.length, 1);
    assert.strictEqual(ourExpiredJobs[0].id, pendingId);
    assert.strictEqual(ourExpiredJobs[0].status, 'PENDING');
  });
});
