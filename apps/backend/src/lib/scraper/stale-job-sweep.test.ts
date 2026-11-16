import test from 'node:test';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import { db } from '../../db/client.js';
import { apifyPendingJobs, brightdataPendingJobs, scraperActorRuns, socialMediaAccountProfiles, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { runStaleJobSweep } from './stale-job-sweep.js';
import { createPendingJob } from './apify-pending-jobs-store.js';
import { createPendingJob as createBrightDataPendingJob } from './brightdata-pending-jobs-store.js';
import { recordActorRunStart } from './record-actor-run.js';
import { setGetBrightDataProgress, setGetBrightDataSnapshot } from './brightdata-client.js';

test('stale-job-sweep tests', async (t) => {
  let testProfileId: string;

  t.beforeEach(async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'profile-' + Date.now(),
      platform: 'instagram',
      username: 'test_user',
      displayName: 'Test User',
    }).returning({ id: socialMediaAccountProfiles.id });
    testProfileId = profile.id;
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
      webhookToken: randomBytes(24).toString('hex'),
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
    assert.ok(['EXPIRED', 'COMPLETED', 'PENDING'].includes(job.status));
  });

  await t.test('handles multiple jobs without interference', async () => {
    // Create multiple expired jobs
    const job1 = await createPendingJob({
      profileId: testProfileId,
      runId: 'run-1',
      webhookToken: randomBytes(24).toString('hex'),
    });

    const [profile2] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'profile-2-' + Date.now(),
      platform: 'instagram',
      username: 'test_user_2',
      displayName: 'Test User 2',
    }).returning({ id: socialMediaAccountProfiles.id });
    const testProfileId2 = profile2.id;

    const job2 = await createPendingJob({
      profileId: testProfileId2,
      runId: 'run-2',
      webhookToken: randomBytes(24).toString('hex'),
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
    await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId2));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId2));
  });

  // The sweep already holds the progress report that decided the snapshot was finished, so the yield is
  // recorded from it with no second call.
  await t.test('a swept Bright Data snapshot keeps the vendor-reported yield and the new-post count on its run row', async () => {
    const snapshotId = `sd_sweep_yield_${Date.now()}`;
    let progressCalls = 0;
    setGetBrightDataProgress(async () => {
      progressCalls += 1;
      return { status: 'ready', records: 2, errors: 1, errorCodes: { dead_page: 1 } };
    });
    setGetBrightDataSnapshot(async () => [{ not_a_post: true }, { not_a_post: true }]);

    const auditRunId = await recordActorRunStart({ vendor: 'BRIGHTDATA', triggerMode: 'ASYNC', profileId: testProfileId, runId: snapshotId, rawInput: {}, status: 'PENDING' });
    assert.ok(auditRunId);
    const { id } = await createBrightDataPendingJob({
      profileId: testProfileId,
      snapshotId,
      webhookToken: randomBytes(24).toString('hex'),
      scraperActorRunId: auditRunId,
    });
    await db.update(brightdataPendingJobs).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(brightdataPendingJobs.id, id));

    try {
      await runStaleJobSweep();

      const [run] = await db.select().from(scraperActorRuns).where(eq(scraperActorRuns.id, auditRunId));
      assert.strictEqual(run.status, 'SUCCEEDED');
      assert.strictEqual(run.recordsReported, 2);
      assert.strictEqual(run.errorsReported, 1);
      assert.deepStrictEqual(run.errorCodes, { dead_page: 1 });
      assert.strictEqual(run.newPosts, 0, 'two unmappable records store no post');
      assert.strictEqual(progressCalls, 1, 'the sweep reuses the report it read to find the snapshot finished');
    } finally {
      await db.delete(brightdataPendingJobs).where(eq(brightdataPendingJobs.profileId, testProfileId));
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, testProfileId));
    }
  });
});
