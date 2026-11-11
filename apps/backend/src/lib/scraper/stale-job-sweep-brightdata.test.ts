import test from 'node:test';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import { db } from '../../db/client.js';
import { brightdataPendingJobs, scraperActorRuns, socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { runStaleJobSweep } from './stale-job-sweep.js';
import { createPendingJob } from './brightdata-pending-jobs-store.js';
import { recordActorRunStart } from './record-actor-run.js';
import {
  setGetBrightDataProgress,
  setGetBrightDataSnapshot,
  type BrightDataProgressResponse,
} from './brightdata-client.js';
import { setSendSqsMessage, sendSqsMessage } from './enqueue-scrape-job.js';

// The stale-job sweep is the second place a finished Bright Data snapshot is read (when the webhook
// never arrived), so it must classify a zero-item "ready" snapshot the same way the webhook does.
test('stale-job-sweep: Bright Data jobs', async (t) => {
  const originalSendSqsMessage = sendSqsMessage;
  const originalQueueUrl = process.env.SCRAPING_QUEUE_URL;

  let profileId: string;
  let subscriptionId: string;
  let progress: BrightDataProgressResponse;
  let progressCalls: number;
  let snapshotItems: unknown[];
  let sqsBodies: string[];

  t.before(async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/ScrapingQueue';
    setSendSqsMessage(async (_queueUrl, body) => {
      sqsBodies.push(body);
    });
    setGetBrightDataProgress(async () => {
      progressCalls += 1;
      return progress;
    });
    setGetBrightDataSnapshot(async () => snapshotItems);

    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'bd-sweep-test-' + Date.now(),
        platform: 'instagram',
        username: 'bd_sweep_test_user',
        displayName: 'BD Sweep Test User',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;

    // The fallback re-queue is a scrape start (AD-34): it needs an active subscription.
    const [seededUser] = await db.select().from(users).limit(1);
    assert.ok(seededUser, 'Must have at least 1 seeded user for test');
    const [sub] = await db.insert(subscriptions).values({ userId: seededUser.id, accountId: profile.id }).returning();
    subscriptionId = sub.id;
  });

  t.beforeEach(() => {
    progressCalls = 0;
    sqsBodies = [];
    snapshotItems = [];
  });

  t.afterEach(async () => {
    await db.delete(brightdataPendingJobs).where(eq(brightdataPendingJobs.profileId, profileId));
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
    await db
      .update(socialMediaAccountProfiles)
      .set({ lastScrapedAt: null })
      .where(eq(socialMediaAccountProfiles.id, profileId));
  });

  t.after(async () => {
    setSendSqsMessage(originalSendSqsMessage);
    if (originalQueueUrl === undefined) {
      delete process.env.SCRAPING_QUEUE_URL;
    } else {
      process.env.SCRAPING_QUEUE_URL = originalQueueUrl;
    }
    await db.delete(subscriptions).where(eq(subscriptions.id, subscriptionId));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  async function sweepOneExpiredJob(opts: { ageMs?: number } = {}) {
    const snapshotId = `sd_sweep_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const auditRunId = await recordActorRunStart({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId,
      runId: snapshotId,
      rawInput: {},
      status: 'PENDING',
    });
    const { id } = await createPendingJob({
      profileId,
      snapshotId,
      webhookToken: randomBytes(24).toString('hex'),
      scraperActorRunId: auditRunId ?? undefined,
    });
    await db
      .update(brightdataPendingJobs)
      .set({
        expiresAt: new Date(Date.now() - 1000),
        ...(opts.ageMs !== undefined && { createdAt: new Date(Date.now() - opts.ageMs) }),
      })
      .where(eq(brightdataPendingJobs.id, id));

    await runStaleJobSweep();

    const [run] = await db.select().from(scraperActorRuns).where(eq(scraperActorRuns.runId, snapshotId));
    const [job] = await db.select().from(brightdataPendingJobs).where(eq(brightdataPendingJobs.id, id));
    const [profile] = await db
      .select({ lastScrapedAt: socialMediaAccountProfiles.lastScrapedAt })
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, profileId));
    return { run, job, lastScrapedAt: profile.lastScrapedAt };
  }

  await t.test('a ready snapshot with records is a SUCCEEDED run', async () => {
    progress = { status: 'ready', records: 1, errors: 0 };
    snapshotItems = [{ not_a_post: true }];

    const { run, job } = await sweepOneExpiredJob();

    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(run.itemCount, 1);
    assert.strictEqual(job.status, 'COMPLETED');
    assert.deepStrictEqual(sqsBodies, []);
  });

  await t.test('a ready, empty snapshot with a dead_page error is an empty account: SUCCEEDED', async () => {
    progress = { status: 'ready', records: 0, errors: 1, errorCodes: { dead_page: 1 } };

    const { run, job, lastScrapedAt } = await sweepOneExpiredJob();

    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(run.itemCount, 0);
    assert.strictEqual(job.status, 'COMPLETED');
    assert.ok(lastScrapedAt);
    assert.deepStrictEqual(sqsBodies, []);
  });

  await t.test('a ready, empty snapshot with no dead_page error is a vendor failure: FAILED, expired, re-queued', async () => {
    progress = {
      status: 'ready',
      records: 0,
      errors: 0,
      errorMessage: 'No records found. The data may not be available or has changed...',
    };

    const { run, job, lastScrapedAt } = await sweepOneExpiredJob();

    assert.strictEqual(run.status, 'FAILED');
    assert.match(run.errorMessage ?? '', /returned 0 records with no dead_page error/);
    assert.strictEqual(job.status, 'EXPIRED');
    assert.strictEqual(lastScrapedAt, null);
    assert.strictEqual(sqsBodies.length, 1);
    assert.strictEqual(JSON.parse(sqsBodies[0]).profileId, profileId);
    assert.strictEqual(progressCalls, 1, 'the verdict is made on the report that said the snapshot was ready, not on a second lookup');
  });

  await t.test('a failed snapshot keeps its existing handling: FAILED, expired, re-queued', async () => {
    progress = { status: 'failed' };

    const { run, job } = await sweepOneExpiredJob();

    assert.strictEqual(run.status, 'FAILED');
    assert.strictEqual(run.errorMessage, 'Run status from stale-job-sweep: FAILED');
    assert.strictEqual(job.status, 'EXPIRED');
    assert.strictEqual(sqsBodies.length, 1);
  });

  await t.test('a failed snapshot on a profile that is not scrapable is recorded and expired but not re-queued (AD-34)', async () => {
    await db
      .update(socialMediaAccountProfiles)
      .set({ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .where(eq(socialMediaAccountProfiles.id, profileId));
    progress = { status: 'failed' };
    try {
      const { run, job } = await sweepOneExpiredJob();

      assert.strictEqual(run.status, 'FAILED');
      assert.strictEqual(job.status, 'EXPIRED');
      assert.deepStrictEqual(sqsBodies, []);
    } finally {
      await db
        .update(socialMediaAccountProfiles)
        .set({ accountType: null, accountTypeStatus: null })
        .where(eq(socialMediaAccountProfiles.id, profileId));
    }
  });

  const NINE_HOURS = 9 * 60 * 60_000; // past the default 480-minute bound

  await t.test('a snapshot still running PAST the wait bound is TIMED_OUT, expired and re-queued, as before', async () => {
    progress = { status: 'running' };

    const { run, job } = await sweepOneExpiredJob({ ageMs: NINE_HOURS });

    assert.strictEqual(run.status, 'TIMED_OUT', 'a snapshot still in flight at expiry never delivered: health must see it');
    assert.strictEqual(run.errorMessage, 'Run status from stale-job-sweep: PENDING');
    assert.strictEqual(job.status, 'EXPIRED');
    assert.strictEqual(sqsBodies.length, 1);
  });

  // Story 10.5 (IDEA-102): wait for a snapshot Bright Data still reports as running instead of falling back to paid Apify.
  for (const status of ['scheduled', 'building', 'running'] as const) {
    await t.test(`a snapshot still ${status} UNDER the wait bound is waited for: stays PENDING, no failed run, no fallback`, async () => {
      progress = { status };

      const before = Date.now();
      const { run, job } = await sweepOneExpiredJob({ ageMs: 3 * 60 * 60_000 }); // 3 h old: past the 180-minute expiry, under 8 h

      assert.strictEqual(job.status, 'PENDING', 'the job keeps waiting');
      assert.ok(job.expiresAt.getTime() > before + 59 * 60_000, 'its expiry moved to the next hourly sweep');
      assert.strictEqual(sqsBodies.length, 0, 'no paid Apify fallback while Bright Data is still working');
      assert.ok(run.status === 'PENDING', 'no failed run is recorded for a snapshot that is merely slow');
    });
  }

  await t.test('the bound follows BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES: a 60-minute bound gives up on a 3-hour-old running snapshot', async () => {
    progress = { status: 'running' };
    const saved = process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES;
    process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES = '60';
    try {
      const { run, job } = await sweepOneExpiredJob({ ageMs: 3 * 60 * 60_000 });
      assert.strictEqual(run.status, 'TIMED_OUT');
      assert.strictEqual(job.status, 'EXPIRED');
      assert.strictEqual(sqsBodies.length, 1);
    } finally {
      if (saved === undefined) delete process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES;
      else process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES = saved;
    }
  });

  await t.test('the bound never delays a ready or a failed snapshot, however young', async () => {
    progress = { status: 'failed', errorMessage: 'boom' };
    const failed = await sweepOneExpiredJob({ ageMs: 60_000 });
    assert.strictEqual(failed.run.status, 'FAILED');
    assert.strictEqual(failed.job.status, 'EXPIRED');

    progress = { status: 'ready', records: 1, errors: 0 };
    snapshotItems = [];
    const ready = await sweepOneExpiredJob({ ageMs: 60_000 });
    assert.notStrictEqual(ready.job.status, 'PENDING', 'a ready snapshot is processed, not waited for');
  });
});
