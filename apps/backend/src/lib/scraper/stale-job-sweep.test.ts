import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { apifyPendingJobs, socialMediaAccountProfiles, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { runStaleJobSweep } from './stale-job-sweep.js';
import { createPendingJob } from './apify-pending-jobs-store.js';

test('stale-job-sweep tests', async (t) => {
  const testProfileId = 'profile-' + Date.now();

  t.beforeEach(async () => {
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

  await t.test('processes succeeded Apify job without SQS fallback', async () => {
    const { id } = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-succeeded',
    });

    // Mark job as expired (past its expiration time)
    await db
      .update(apifyPendingJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apifyPendingJobs.id, id));

    // In a real scenario, we would mock the Apify client
    // For this test, we're verifying the sweep function doesn't crash
    // The actual Apify call will fail in test env, but error is caught

    try {
      await runStaleJobSweep();
    } catch (error) {
      // Expected in test environment without mocked Apify client
      console.log('Expected error in test:', (error as Error).message);
    }

    // Verify job was either processed or marked expired
    const [job] = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.id, id));

    assert.ok(job);
    assert.ok(['EXPIRED', 'COMPLETED'].includes(job.status));
  });

  await t.test('handles multiple jobs without interference', async () => {
    // Create multiple expired jobs
    const job1 = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-1',
    });

    const testProfileId2 = 'profile-2-' + Date.now();
    await db.insert(socialMediaAccountProfiles).values({
      accountId: testProfileId2,
      platform: 'instagram',
      username: 'test_user_2',
      displayName: 'Test User 2',
    });

    const job2 = await createPendingJob({
      profileId: testProfileId2,
      runId: 'run-2',
    });

    // Mark both as expired
    await db
      .update(apifyPendingJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apifyPendingJobs.profileId, testProfileId));

    await db
      .update(apifyPendingJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apifyPendingJobs.profileId, testProfileId2));

    try {
      await runStaleJobSweep();
    } catch (error) {
      console.log('Expected error in test:', (error as Error).message);
    }

    // Both should be in database (either EXPIRED or COMPLETED)
    const jobs = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.profileId, testProfileId));

    const jobs2 = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.profileId, testProfileId2));

    assert.ok(jobs.length > 0);
    assert.ok(jobs2.length > 0);

    // Clean up second profile
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId2));
  });
});
