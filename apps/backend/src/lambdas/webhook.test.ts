import test from 'node:test';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { db } from '../db/client.js';
import { brightdataPendingJobs, scraperActorRuns, socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { handler } from './webhook.js';
import { createPendingJob, markPendingJobExpired } from '../lib/scraper/brightdata-pending-jobs-store.js';
import { recordActorRunResult, recordActorRunStart } from '../lib/scraper/record-actor-run.js';
import { setGetBrightDataProgress, type BrightDataProgressResponse } from '../lib/scraper/brightdata-client.js';
import { setSendSqsMessage, sendSqsMessage } from '../lib/scraper/enqueue-scrape-job.js';

// BUG-074: a Bright Data snapshot with zero records is not a success. Told apart from an account
// with nothing new by Bright Data's own progress report (`error_codes.dead_page`).
test('Bright Data webhook: result classification (BUG-074)', async (t) => {
  const originalSendSqsMessage = sendSqsMessage;
  const originalQueueUrl = process.env.SCRAPING_QUEUE_URL;

  let profileId: string;
  let profileAccountId: string;
  let subscriptionId: string;
  let progressCalls: string[];
  let progressResult: BrightDataProgressResponse | Error;
  let sqsMessages: Array<{ queueUrl: string; body: string }>;

  // Fixtures observed on 2026-10-22 (BUG-074 section 4).
  const healthy: BrightDataProgressResponse = { status: 'ready', records: 3, errors: 0 };
  const legitimatelyEmpty: BrightDataProgressResponse = { status: 'ready', records: 0, errors: 1, errorCodes: { dead_page: 1 } };
  const outage: BrightDataProgressResponse = {
    status: 'ready',
    records: 0,
    errors: 0,
    errorMessage: 'No records found. The data may not be available or has changed...',
  };

  t.before(async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/ScrapingQueue';
    setSendSqsMessage(async (queueUrl, body) => {
      sqsMessages.push({ queueUrl, body });
    });
    setGetBrightDataProgress(async (snapshotId) => {
      progressCalls.push(snapshotId);
      if (progressResult instanceof Error) throw progressResult;
      return progressResult;
    });

    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'bd-webhook-test-' + Date.now(),
        platform: 'instagram',
        username: 'bd_webhook_test_user',
        displayName: 'BD Webhook Test User',
      })
      .returning({ id: socialMediaAccountProfiles.id, accountId: socialMediaAccountProfiles.accountId });
    profileId = profile.id;
    profileAccountId = profile.accountId;

    // The fallback re-queue is a scrape start (AD-34): it needs an active subscription.
    const [seededUser] = await db.select().from(users).limit(1);
    assert.ok(seededUser, 'Must have at least 1 seeded user for test');
    const [sub] = await db.insert(subscriptions).values({ userId: seededUser.id, accountId: profile.id }).returning();
    subscriptionId = sub.id;
  });

  t.beforeEach(() => {
    progressCalls = [];
    sqsMessages = [];
    progressResult = healthy;
  });

  t.afterEach(async () => {
    await db.delete(brightdataPendingJobs).where(eq(brightdataPendingJobs.profileId, profileId));
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
    await db
      .update(socialMediaAccountProfiles)
      .set({ lastScrapedAt: null, accountType: null, accountTypeStatus: null })
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

  async function deliver(body: string | null, options: { sweptAsExpired?: boolean } = {}) {
    const snapshotId = `sd_webhook_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const webhookToken = randomBytes(24).toString('hex');
    const auditRunId = await recordActorRunStart({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId,
      runId: snapshotId,
      rawInput: {},
      status: 'PENDING',
    });
    const { id: pendingJobId } = await createPendingJob({
      profileId,
      snapshotId,
      webhookToken,
      scraperActorRunId: auditRunId ?? undefined,
    });

    if (options.sweptAsExpired) {
      // What the stale-job sweep did before the delivery arrived (2026-10-29).
      await recordActorRunResult({
        vendor: 'BRIGHTDATA',
        runId: snapshotId,
        status: 'TIMED_OUT',
        errorMessage: 'Run status from stale-job-sweep: PENDING',
      });
      await markPendingJobExpired(pendingJobId);
    }

    const response = await handler(
      { queryStringParameters: { jobToken: webhookToken }, body } as unknown as APIGatewayProxyEvent,
      {} as Context
    );

    const [run] = await db.select().from(scraperActorRuns).where(eq(scraperActorRuns.runId, snapshotId));
    const [job] = await db.select().from(brightdataPendingJobs).where(eq(brightdataPendingJobs.id, pendingJobId));
    const [profile] = await db
      .select({ lastScrapedAt: socialMediaAccountProfiles.lastScrapedAt })
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, profileId));
    return { response, run, job, snapshotId, lastScrapedAt: profile.lastScrapedAt };
  }

  // 2026-10-29: Bright Data delivered 21 snapshots 5-6 hours after the 180-minute expiry; the sweep had
  // marked them TIMED_OUT/EXPIRED and the handler dropped their records.
  await t.test('records delivered after the sweep expired the job are still processed', async () => {
    const { run, job, response, lastScrapedAt } = await deliver(JSON.stringify([{ not_a_post: true }]), { sweptAsExpired: true });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'SUCCEEDED', 'the TIMED_OUT audit row becomes the success it was');
    assert.strictEqual(run.itemCount, 1);
    assert.strictEqual(job.status, 'COMPLETED');
    assert.ok(lastScrapedAt, 'the late scrape stamps lastScrapedAt like an on-time one');
  });

  await t.test('an expired job delivered with no records is left as the sweep recorded it', async () => {
    const { run, job, response } = await deliver(JSON.stringify([]), { sweptAsExpired: true });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'TIMED_OUT');
    assert.strictEqual(job.status, 'EXPIRED');
    assert.deepStrictEqual(progressCalls, []);
  });

  await t.test('records delivered: SUCCEEDED; the progress report is read once, after storing, only to record the yield', async () => {
    // Unmappable records still count as delivered; the point here is the classification path.
    const { run, job, response, snapshotId } = await deliver(JSON.stringify([{ not_a_post: true }]));

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(run.itemCount, 1);
    assert.strictEqual(job.status, 'COMPLETED');
    assert.deepStrictEqual(progressCalls, [snapshotId]);
    assert.strictEqual(run.recordsReported, 3);
    assert.strictEqual(run.errorsReported, 0);
    assert.strictEqual(run.errorCodes, null);
    assert.strictEqual(run.newPosts, 0, 'an unmappable record stores no post');
    assert.deepStrictEqual(sqsMessages, []);
  });

  await t.test('a partial delivery keeps what the vendor reported: records, errors and their codes', async () => {
    progressResult = { status: 'ready', records: 11, errors: 1, errorCodes: { dead_page: 1 } };

    const { run, job } = await deliver(JSON.stringify([{ not_a_post: true }]));

    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(job.status, 'COMPLETED');
    assert.strictEqual(run.recordsReported, 11);
    assert.strictEqual(run.errorsReported, 1);
    assert.deepStrictEqual(run.errorCodes, { dead_page: 1 });
  });

  await t.test('a progress report that cannot be read leaves the yield columns empty and the scrape untouched', async () => {
    progressResult = new Error('progress lookup failed');

    const { run, job, response } = await deliver(JSON.stringify([{ not_a_post: true }]));

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(job.status, 'COMPLETED');
    assert.strictEqual(run.recordsReported, null);
    assert.strictEqual(run.errorsReported, null);
    assert.strictEqual(run.newPosts, 0, 'the new-post count does not depend on the progress report');
  });

  await t.test('zero records with a dead_page error: an empty account, still SUCCEEDED and completed', async () => {
    progressResult = legitimatelyEmpty;

    const { run, job, snapshotId, lastScrapedAt } = await deliver('[]');

    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(run.itemCount, 0);
    assert.strictEqual(job.status, 'COMPLETED');
    assert.ok(lastScrapedAt, 'an empty account was scraped, so lastScrapedAt is stamped');
    assert.deepStrictEqual(progressCalls, [snapshotId], 'the report read to classify is reused for the yield');
    assert.strictEqual(run.recordsReported, 0);
    assert.strictEqual(run.errorsReported, 1);
    assert.deepStrictEqual(run.errorCodes, { dead_page: 1 });
    assert.strictEqual(run.newPosts, 0);
    assert.deepStrictEqual(sqsMessages, []);
  });

  await t.test('zero records with no dead_page error: a vendor failure, recorded FAILED (the 2026-10-21 outage)', async () => {
    progressResult = outage;

    const { run, job, lastScrapedAt, response } = await deliver('[]');

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'FAILED');
    assert.strictEqual(run.itemCount, 0);
    assert.match(run.errorMessage ?? '', /returned 0 records with no dead_page error/);
    assert.match(run.errorMessage ?? '', /No records found/);
    assert.strictEqual(job.status, 'EXPIRED', 'the job is not completed, so the batch scrapes the profile again');
    assert.strictEqual(lastScrapedAt, null, 'a failed run must not mark the profile as freshly scraped');
  });

  await t.test('a vendor failure hands the Instagram profile to the SQS scrape queue immediately', async () => {
    progressResult = outage;

    await deliver('[]');

    assert.strictEqual(sqsMessages.length, 1);
    assert.strictEqual(sqsMessages[0].queueUrl, 'https://sqs.us-east-1.amazonaws.com/12345/ScrapingQueue');
    const target = JSON.parse(sqsMessages[0].body);
    assert.strictEqual(target.profileId, profileId);
    // A handle-keyed profile is scraped by its account_id, not the mutable username (BUG-081).
    assert.strictEqual(target.username, profileAccountId);
    assert.strictEqual(target.platform, 'instagram');
  });

  await t.test('a vendor failure on a profile that is no longer scrapable is recorded but not re-queued (AD-34)', async () => {
    progressResult = outage;
    await db
      .update(socialMediaAccountProfiles)
      .set({ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' })
      .where(eq(socialMediaAccountProfiles.id, profileId));

    const { run, job } = await deliver('[]');

    assert.strictEqual(run.status, 'FAILED', 'the failure itself is still recorded');
    assert.strictEqual(job.status, 'EXPIRED');
    assert.deepStrictEqual(sqsMessages, [], 'a personal account is never scraped, not even as a fallback');
  });

  await t.test('a snapshot Bright Data reports as failed is a vendor failure even when it lists a dead page', async () => {
    progressResult = { status: 'failed', records: 0, errors: 1, errorCodes: { dead_page: 1 } };

    const { run, job } = await deliver('[]');

    assert.strictEqual(run.status, 'FAILED');
    assert.strictEqual(job.status, 'EXPIRED');
  });

  await t.test('an empty body is treated as zero records', async () => {
    progressResult = outage;

    const { run } = await deliver(null);

    assert.strictEqual(run.status, 'FAILED');
  });

  await t.test('a body that is not an array is treated as zero records, not as one', async () => {
    progressResult = legitimatelyEmpty;

    const { run } = await deliver(JSON.stringify({ error: 'something' }));

    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(run.itemCount, 0);
  });

  await t.test('records the vendor says it delivered but that never arrived are not a vendor failure (an unreadable body)', async () => {
    progressResult = { status: 'ready', records: 25, errors: 0 };

    const { run, job, response } = await deliver(JSON.stringify({ unexpected: 'envelope' }));

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'SUCCEEDED', 'the vendor delivered; the loss is not the vendor failing, so no FAILED run');
    assert.strictEqual(job.status, 'COMPLETED');
    assert.deepStrictEqual(sqsMessages, [], 'no fallback scrape for a vendor that did not fail');
  });

  await t.test('an unreadable progress report is inconclusive: kept as an empty success, never an outage', async () => {
    progressResult = new Error('progress endpoint down');

    const { run, job, response } = await deliver('[]');

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(run.status, 'SUCCEEDED');
    assert.strictEqual(run.itemCount, 0);
    assert.strictEqual(job.status, 'COMPLETED');
    assert.deepStrictEqual(sqsMessages, []);
  });

  await t.test('a failing SQS enqueue does not undo the recorded failure', async () => {
    progressResult = outage;
    setSendSqsMessage(async () => {
      throw new Error('SQS unavailable');
    });
    try {
      const { run, job, response } = await deliver('[]');

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(run.status, 'FAILED');
      assert.strictEqual(job.status, 'EXPIRED');
    } finally {
      setSendSqsMessage(async (queueUrl, body) => {
        sqsMessages.push({ queueUrl, body });
      });
    }
  });
});
