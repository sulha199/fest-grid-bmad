import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { handler } from './scraper.js';
import {
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
} from '../lib/aws/poll-and-drain-queue.js';
import {
  attemptBrightDataTrigger,
  setAttemptBrightDataTrigger,
} from '../lib/scraper/trigger-brightdata-for-target.js';
import {
  attemptApifyAsyncTrigger,
  setAttemptApifyAsyncTrigger,
} from '../lib/scraper/trigger-apify-for-target.js';
import { loadBackendEnv } from '../env.js';
import { db } from '../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions, posts, scraperActorRuns, scraperBatchRuns, scraperProviderHealth } from '@festgrid/database';
import { eq, inArray, gte } from 'drizzle-orm';
import { sendSqsMessage, setSendSqsMessage } from '../lib/aws/send-sqs-message.js';
import '../lib/scraper/register-adapters.js';
import { registerScraperAdapter } from '@festgrid/domain';

// The handler records per-provider health (`scraper_provider_health`, one row per provider) as a side
// effect of a run. Snapshot the existing row ids before a test and delete only rows that run created,
// so the backend row-count ratchet stays flat and a dev DB's real rows are never touched.
async function snapshotProviderHealthIds(): Promise<Set<string>> {
  const rows = await db.select({ id: scraperProviderHealth.id }).from(scraperProviderHealth);
  return new Set(rows.map((r) => r.id));
}
async function deleteProviderHealthCreatedSince(before: Set<string>): Promise<void> {
  const rows = await db.select({ id: scraperProviderHealth.id }).from(scraperProviderHealth);
  const created = rows.map((r) => r.id).filter((id) => !before.has(id));
  if (created.length > 0) await db.delete(scraperProviderHealth).where(inArray(scraperProviderHealth.id, created));
}

// Covers AC13: proves scraper.ts's new `{ jobType: 'poll-and-drain' }` branch (AC5) calls
// pollAndDrainQueue with the queue URL sourced from SCRAPING_QUEUE_URL (AC7 for the other two
// handlers; scraper.ts already had this env var) and a per-message callback that parses the
// SQS body and forwards it to processScrapeJob -- using AC10's receiveSqsMessages/
// deleteSqsMessage test seams rather than making real AWS calls. This does NOT re-test the
// pre-existing SQS-Records/stale-job-sweep/daily-batch branches, which are unchanged.
test('scraper lambda poll-and-drain branch', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  const originalQueueUrl = process.env.SCRAPING_QUEUE_URL;
  const providerHealthBefore = await snapshotProviderHealthIds();

  t.after(async () => {
    await deleteProviderHealthCreatedSince(providerHealthBefore);
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
    process.env.SCRAPING_QUEUE_URL = originalQueueUrl;
  });

  await t.test('polls SCRAPING_QUEUE_URL and forwards each message to processScrapeJob', async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';

    const receivedQueueUrls: string[] = [];
    let call = 0;
    setReceiveSqsMessages(async (queueUrl) => {
      receivedQueueUrls.push(queueUrl);
      call += 1;
      if (call === 1) {
        return [
          {
            // A platform with no registered scraper adapter makes processScrapeJob take
            // its defensive catch path (getScraperAdapter throws synchronously, caught by
            // processScrapeJob's own try/catch) instead of reaching out to a real
            // scraping provider -- proving the callback correctly parses-and-forwards
            // without this test depending on live external services. profileId is a
            // syntactically-valid but non-existent UUID so the surrounding DB lookups
            // degrade to "no rows found"/no-op instead of a Postgres uuid-parse error.
            Body: JSON.stringify({
              profileId: randomUUID(),
              platform: 'poll-and-drain-test-platform',
              accountId: 'acc-1',
              username: 'test_user',
            }),
            ReceiptHandle: 'rh-1',
          },
        ];
      }
      return [];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (queueUrl, receiptHandle) => {
      assert.strictEqual(queueUrl, 'https://sqs.mock-scraping-queue');
      deletedHandles.push(receiptHandle);
    });

    await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.deepStrictEqual(receivedQueueUrls, [
      'https://sqs.mock-scraping-queue',
      'https://sqs.mock-scraping-queue',
    ]);
    // The job failed (no adapter for the platform), and a failed scrape is rethrown so the message stays
    // on the queue for SQS to redeliver instead of being deleted and lost until the next daily batch.
    assert.deepStrictEqual(deletedHandles, []);
  });

  await t.test('deletes the message of a scrape that completed', async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';
    registerScraperAdapter('poll-and-drain-ok-platform' as any, {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts() { return []; },
      async lookupAccountProfile() { return null; },
      async getAccountClassificationProfile() { return null; },
      async getPostByUrl() { return null; },
    });
    let call = 0;
    setReceiveSqsMessages(async () => {
      call += 1;
      return call === 1
        ? [{
            Body: JSON.stringify({ profileId: randomUUID(), platform: 'poll-and-drain-ok-platform', accountId: 'acc-2', username: 'ok_user' }),
            ReceiptHandle: 'rh-ok',
          }]
        : [];
    });
    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (_queueUrl, receiptHandle) => {
      deletedHandles.push(receiptHandle);
    });

    await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.deepStrictEqual(deletedHandles, ['rh-ok']);
  });

  await t.test('does not fall through to the SQS-Records/stale-job-sweep/daily-batch branches', async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';
    setReceiveSqsMessages(async () => []);
    setDeleteSqsMessage(async () => {});

    // If this fell through to the 'Records' branch, `event.Records` would be undefined and
    // iterating it would throw synchronously.
    await assert.doesNotReject(handler({ jobType: 'poll-and-drain' } as any, {} as any));
  });
});

// FIND-035: proves the EventBridge daily-batch branch (the 'else' branch of the handler --
// no 'Records', no jobType) computes a per-target incremental `newerThan` instead of the old
// hardcoded 7-day window for every account. Goes through the real getBatchScrapeTargets() /
// real DB (no seam exists for it, matching the convention in subscribe-to-account.test.ts),
// but seams both vendor trigger functions so no real Bright Data/Apify calls are made and
// every target's dispatch succeeds (keeping the SQS-fallback/enqueue path untouched).
test('scraper lambda daily-batch branch: per-target incremental newerThan (FIND-035)', async (t) => {
  const originalAttemptBrightDataTrigger = attemptBrightDataTrigger;
  const originalAttemptApifyAsyncTrigger = attemptApifyAsyncTrigger;
  const providerHealthBefore = await snapshotProviderHealthIds();
  // Reset per subtest (afterEach, not a single shared t.after) so each subtest's own
  // scraper_batch_runs window/profile/sub/post rows are cleaned up immediately after it
  // runs -- a shared outer testStart across both subtests previously left subtest 1's
  // scraper_batch_runs row (opened before subtest 2's later testStart) undeleted, and left
  // subtest 1's profile subscribed (and thus re-processed by handler()) during subtest 2.
  let createdProfiles: string[] = [];
  let createdSubs: string[] = [];
  let createdPosts: string[] = [];
  let testStart: Date | undefined;

  t.afterEach(async () => {
    if (createdPosts.length > 0) {
      await db.delete(posts).where(inArray(posts.id, createdPosts));
      createdPosts = [];
    }
    if (createdSubs.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs));
      createdSubs = [];
    }
    if (createdProfiles.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
      createdProfiles = [];
    }
    // scraper_batch_runs is an append-only per-cycle audit row (IDEA-013) with no id surfaced
    // back to this test -- clean up anything opened during this subtest's own window instead.
    if (testStart) {
      await db.delete(scraperBatchRuns).where(gte(scraperBatchRuns.startedAt, testStart));
      testStart = undefined;
    }
  });

  t.after(async () => {
    await deleteProviderHealthCreatedSince(providerHealthBefore);
    setAttemptBrightDataTrigger(originalAttemptBrightDataTrigger);
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
  });

  await t.test('uses newestPostPublishedAt when the account has prior posts', async () => {
    const [seededUser] = await db.select().from(users).limit(1);
    assert.ok(seededUser, 'Must have at least 1 seeded user for test');

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-find035-wiring-with-posts-' + Date.now(),
      platform: 'instagram',
      displayName: 'FIND-035 Wiring With Posts',
      username: 'find035_wiring_with_posts_' + Date.now(),
    }).returning();
    createdProfiles.push(profile.id);

    const [sub] = await db.insert(subscriptions).values({
      userId: seededUser.id,
      accountId: profile.id,
    }).returning();
    createdSubs.push(sub.id);

    const newestPublishedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const [post] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/find035-wiring-' + Date.now(),
      publishedAt: newestPublishedAt,
    }).returning();
    createdPosts.push(post.id);

    const capturedNewerThan: string[] = [];
    setAttemptBrightDataTrigger(async (target, newerThan) => {
      if (target.username === profile.username) capturedNewerThan.push(newerThan);
      return { success: true };
    });
    setAttemptApifyAsyncTrigger(async (target, newerThan) => {
      if (target.username === profile.username) capturedNewerThan.push(newerThan);
      return { success: true };
    });

    testStart = new Date();
    await handler({} as any, {} as any);

    assert.strictEqual(capturedNewerThan.length, 1, 'exactly one trigger attempt should have been made for this target');
    assert.strictEqual(
      capturedNewerThan[0],
      newestPublishedAt.toISOString(),
      'newerThan must equal the account\'s newest post publishedAt, not a hardcoded window'
    );
  });

  await t.test('falls back to env.scrapeInitialLookbackDays when the account has no posts', async () => {
    const [seededUser] = await db.select().from(users).limit(1);
    assert.ok(seededUser, 'Must have at least 1 seeded user for test');

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-find035-wiring-no-posts-' + Date.now(),
      platform: 'instagram',
      displayName: 'FIND-035 Wiring No Posts',
      username: 'find035_wiring_no_posts_' + Date.now(),
    }).returning();
    createdProfiles.push(profile.id);

    const [sub] = await db.insert(subscriptions).values({
      userId: seededUser.id,
      accountId: profile.id,
    }).returning();
    createdSubs.push(sub.id);

    const capturedNewerThan: string[] = [];
    setAttemptBrightDataTrigger(async (target, newerThan) => {
      if (target.username === profile.username) capturedNewerThan.push(newerThan);
      return { success: true };
    });
    setAttemptApifyAsyncTrigger(async (target, newerThan) => {
      if (target.username === profile.username) capturedNewerThan.push(newerThan);
      return { success: true };
    });

    const env = loadBackendEnv();
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - env.scrapeInitialLookbackDays);

    testStart = new Date();
    await handler({} as any, {} as any);

    assert.strictEqual(capturedNewerThan.length, 1, 'exactly one trigger attempt should have been made for this target');
    const actualMs = new Date(capturedNewerThan[0]).getTime();
    const expectedMs = expectedCutoff.getTime();
    assert.ok(
      Math.abs(actualMs - expectedMs) < 60_000,
      `newerThan should be ~${env.scrapeInitialLookbackDays} days ago (lookback fallback), got ${capturedNewerThan[0]}`
    );
  });
});

// 2026-10-23: the batch fired every Apify trigger at once; Apify's concurrent-memory cap refused 31 of 35
// (402), all 31 fell back to the scraping queue, and the batch row counted those 31 as "failed".
test('scraper lambda daily-batch branch: bounded trigger concurrency and honest queue accounting', async (t) => {
  const originalAttemptBrightDataTrigger = attemptBrightDataTrigger;
  const originalAttemptApifyAsyncTrigger = attemptApifyAsyncTrigger;
  const originalSendSqsMessage = sendSqsMessage;
  const originalConcurrency = process.env.SCRAPE_TRIGGER_CONCURRENCY;
  const originalQueueUrl = process.env.SCRAPING_QUEUE_URL;
  const providerHealthBefore = await snapshotProviderHealthIds();
  const createdProfiles: string[] = [];
  const createdSubs: string[] = [];
  const testStart = new Date();

  t.after(async () => {
    if (createdSubs.length > 0) await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs));
    if (createdProfiles.length > 0) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
    await db.delete(scraperBatchRuns).where(gte(scraperBatchRuns.startedAt, testStart));
    await deleteProviderHealthCreatedSince(providerHealthBefore);
    setAttemptBrightDataTrigger(originalAttemptBrightDataTrigger);
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
    setSendSqsMessage(originalSendSqsMessage);
    if (originalConcurrency === undefined) delete process.env.SCRAPE_TRIGGER_CONCURRENCY;
    else process.env.SCRAPE_TRIGGER_CONCURRENCY = originalConcurrency;
    if (originalQueueUrl === undefined) delete process.env.SCRAPING_QUEUE_URL;
    else process.env.SCRAPING_QUEUE_URL = originalQueueUrl;
  });

  const [seededUser] = await db.select().from(users).limit(1);
  assert.ok(seededUser, 'Must have at least 1 seeded user for test');
  for (let i = 0; i < 8; i += 1) {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `test-trigger-concurrency-${i}-${Date.now()}`,
      platform: 'instagram',
      displayName: `Trigger concurrency ${i}`,
      username: `trigger_concurrency_${i}_${Date.now()}`,
    }).returning();
    createdProfiles.push(profile.id);
    const [sub] = await db.insert(subscriptions).values({ userId: seededUser.id, accountId: profile.id }).returning();
    createdSubs.push(sub.id);
  }

  await t.test('never has more triggers in flight than SCRAPE_TRIGGER_CONCURRENCY; a refused Apify trigger is queued, counted as queued, not failed', async () => {
    process.env.SCRAPE_TRIGGER_CONCURRENCY = '2';
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';

    let inFlight = 0;
    let peak = 0;
    let apifyCalls = 0;
    setAttemptBrightDataTrigger(async () => ({ success: false, failureReason: 'PROVIDER_DEGRADED' }));
    setAttemptApifyAsyncTrigger(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      apifyCalls += 1;
      const accepted = apifyCalls <= 3;
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return accepted ? { success: true } : { success: false, failureReason: 'CAPACITY_EXHAUSTED' };
    });
    const queued: string[] = [];
    setSendSqsMessage(async (_queueUrl, body) => {
      queued.push(body);
    });

    await handler({} as any, {} as any);

    assert.ok(apifyCalls >= 8, 'every target reached the Apify tier');
    assert.strictEqual(peak, 2, 'concurrency is capped at SCRAPE_TRIGGER_CONCURRENCY');
    assert.strictEqual(queued.length, apifyCalls - 3, 'each refused target was enqueued');

    const [batch] = await db.select().from(scraperBatchRuns).where(gte(scraperBatchRuns.startedAt, testStart));
    assert.strictEqual(batch.targetsFound, apifyCalls);
    assert.strictEqual(batch.dispatchedSucceeded, 3);
    assert.strictEqual(batch.dispatchedQueued, apifyCalls - 3);
    assert.strictEqual(batch.dispatchedFailed, 0, 'a working queue fallback is not a failure');
  });

  await t.test('a target whose enqueue also fails is the only kind counted as failed', async () => {
    process.env.SCRAPE_TRIGGER_CONCURRENCY = '3';
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';
    await db.delete(scraperBatchRuns).where(gte(scraperBatchRuns.startedAt, testStart));

    setAttemptBrightDataTrigger(async () => ({ success: false, failureReason: 'PROVIDER_DEGRADED' }));
    setAttemptApifyAsyncTrigger(async () => ({ success: false, failureReason: 'CAPACITY_EXHAUSTED' }));
    setSendSqsMessage(async () => {
      throw new Error('SQS unavailable');
    });
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await handler({} as any, {} as any);
    } finally {
      console.error = originalConsoleError;
    }

    const [batch] = await db.select().from(scraperBatchRuns).where(gte(scraperBatchRuns.startedAt, testStart));
    assert.ok(batch.targetsFound >= 8);
    assert.strictEqual(batch.dispatchedFailed, batch.targetsFound);
    assert.strictEqual(batch.dispatchedQueued, 0);
    assert.strictEqual(batch.dispatchedSucceeded, 0);
  });
});

// BUG-074 / IDEA-095: a provider that was returning nothing when the batch began has had a failure day
// whatever its triggers did. Its one probe trigger "succeeds", and without this that single success
// would reset the provider's consecutive failure days every day, so the provider-down alert could
// never fire for an outage that returns zero records.
test('scraper lambda daily-batch branch: provider health after a degraded start (IDEA-095, BUG-074)', async (t) => {
  const originalAttemptBrightDataTrigger = attemptBrightDataTrigger;
  const originalAttemptApifyAsyncTrigger = attemptApifyAsyncTrigger;
  const providers = ['brightdata', 'apify'];
  let profileId: string;
  let subscriptionId: string;
  let secondProfileId: string;
  let secondSubscriptionId: string;
  // One start for the whole suite, not per batch: a subtest that runs the batch twice would otherwise
  // leave its first scraper_batch_runs row (opened before the second batch's start) behind.
  let suiteStart: Date;
  let preExistingHealth: Array<typeof scraperProviderHealth.$inferSelect> = [];

  async function brightDataHealth() {
    const [row] = await db.select().from(scraperProviderHealth).where(eq(scraperProviderHealth.provider, 'brightdata'));
    return row;
  }

  async function insertFailedBrightDataRuns(count: number) {
    const now = Date.now();
    await db.insert(scraperActorRuns).values(
      Array.from({ length: count }, (_, index) => ({
        vendor: 'BRIGHTDATA' as const,
        triggerMode: 'ASYNC' as const,
        profileId,
        runId: `batch-health-test-failed-${index}-${now}`,
        rawInput: {},
        status: 'FAILED' as const,
        itemCount: 0,
        completedAt: new Date(now - index * 1000),
      }))
    );
  }

  async function runBatch() {
    await handler({} as any, {} as any);
  }

  // The ops metrics (IDEA-096) are EMF lines on stdout, written only inside a Lambda.
  async function runBatchCapturingOpsMetrics(): Promise<Array<Record<string, unknown>>> {
    const originalLog = console.log;
    const originalFunctionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    const metricLines: Array<Record<string, unknown>> = [];
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'ScraperLambda-test';
    console.log = (...args: unknown[]) => {
      const text = args.map(String).join(' ');
      if (text.startsWith('{') && text.includes('"_aws"')) metricLines.push(JSON.parse(text));
    };
    try {
      await runBatch();
    } finally {
      console.log = originalLog;
      if (originalFunctionName === undefined) {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      } else {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalFunctionName;
      }
    }
    return metricLines;
  }

  t.before(async () => {
    suiteStart = new Date();
    const [seededUser] = await db.select().from(users).limit(1);
    assert.ok(seededUser, 'Must have at least 1 seeded user for test');

    // Provider health rows are global (one per provider): set any real ones aside and put them back.
    preExistingHealth = await db.select().from(scraperProviderHealth).where(inArray(scraperProviderHealth.provider, providers));
    await db.delete(scraperProviderHealth).where(inArray(scraperProviderHealth.provider, providers));

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-batch-health-' + Date.now(),
      platform: 'instagram',
      displayName: 'Batch Health',
      username: 'batch_health_' + Date.now(),
    }).returning();
    profileId = profile.id;

    const [sub] = await db.insert(subscriptions).values({ userId: seededUser.id, accountId: profile.id }).returning();
    subscriptionId = sub.id;

    // A second target of our own, so a batch always has at least two to tell a probe from a skip.
    const [secondProfile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-batch-health-2-' + Date.now(),
      platform: 'instagram',
      displayName: 'Batch Health Two',
      username: 'batch_health_two_' + Date.now(),
    }).returning();
    secondProfileId = secondProfile.id;
    const [secondSub] = await db.insert(subscriptions).values({ userId: seededUser.id, accountId: secondProfile.id }).returning();
    secondSubscriptionId = secondSub.id;

    // Every trigger "succeeds": this is the single probe a degraded provider is sent.
    setAttemptBrightDataTrigger(async () => ({ success: true }));
    setAttemptApifyAsyncTrigger(async () => ({ success: true }));
  });

  t.afterEach(async () => {
    setAttemptBrightDataTrigger(async () => ({ success: true }));
    setAttemptApifyAsyncTrigger(async () => ({ success: true }));
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
    await db.delete(scraperProviderHealth).where(inArray(scraperProviderHealth.provider, providers));
    await db.delete(scraperBatchRuns).where(gte(scraperBatchRuns.startedAt, suiteStart));
  });

  t.after(async () => {
    setAttemptBrightDataTrigger(originalAttemptBrightDataTrigger);
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
    await db.delete(subscriptions).where(inArray(subscriptions.id, [subscriptionId, secondSubscriptionId]));
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [profileId, secondProfileId]));
    if (preExistingHealth.length > 0) {
      await db.insert(scraperProviderHealth).values(preExistingHealth);
    }
  });

  await t.test('a provider that was degraded at the start has a failure day even though its probe trigger succeeded', async () => {
    await insertFailedBrightDataRuns(20);

    await runBatch();

    const row = await brightDataHealth();
    assert.ok(row, 'a Bright Data health row was recorded');
    assert.strictEqual(row.consecutiveFailureDays, 1);
    assert.strictEqual(row.lastFailureReason, 'PROVIDER_DEGRADED');
  });

  await t.test('each further batch on a still-degraded provider adds a failure day, so the alert threshold is reachable', async () => {
    await insertFailedBrightDataRuns(20);

    await runBatch();
    await runBatch();

    const row = await brightDataHealth();
    assert.strictEqual(row.consecutiveFailureDays, 2);
    assert.strictEqual(row.lastFailureReason, 'PROVIDER_DEGRADED');
  });

  await t.test('a healthy provider is recorded healthy', async () => {
    await runBatch();

    const row = await brightDataHealth();
    assert.strictEqual(row.consecutiveFailureDays, 0);
    assert.strictEqual(row.lastFailureReason, null);
  });

  await t.test('a provider whose triggers skipped targets as degraded is recorded as failing even when the start-of-batch read saw nothing', async () => {
    // The database holds no failed runs, so the read made before the batch finds Bright Data healthy;
    // only the triggers themselves report it degraded (as when that read fails). One probe goes
    // through, the rest are skipped -- the tally alone would call that a success and reset the days.
    let ourCalls = 0;
    const ours = new Set<string>();
    setAttemptBrightDataTrigger(async (target) => {
      if (!target.username.startsWith('batch_health')) return { success: true };
      ours.add(target.username);
      ourCalls += 1;
      return ourCalls === 1 ? { success: true } : { success: false, failureReason: 'PROVIDER_DEGRADED' };
    });
    setAttemptApifyAsyncTrigger(async () => ({ success: true }));

    await runBatch();

    assert.strictEqual(ours.size, 2, 'both of our targets were attempted on Bright Data');
    const row = await brightDataHealth();
    assert.strictEqual(row.consecutiveFailureDays, 1);
    assert.strictEqual(row.lastFailureReason, 'PROVIDER_DEGRADED');
  });

  await t.test('a more specific failure reason is not relabelled as an outage (a closed DPA switch is not a vendor failure)', async () => {
    await insertFailedBrightDataRuns(20);
    setAttemptBrightDataTrigger(async () => ({ success: false, failureReason: 'DPA_NOT_CONFIRMED' }));
    setAttemptApifyAsyncTrigger(async () => ({ success: true }));

    await runBatch();

    const row = await brightDataHealth();
    assert.strictEqual(row.consecutiveFailureDays, 1);
    assert.strictEqual(row.lastFailureReason, 'DPA_NOT_CONFIRMED');
  });

  await t.test('a provider that recovered (its newest run returned posts) is reset on the next batch', async () => {
    await db.insert(scraperProviderHealth).values({
      provider: 'brightdata',
      consecutiveFailureDays: 2,
      lastFailureReason: 'PROVIDER_DEGRADED',
      lastCheckedAt: new Date(),
    });
    // The probe's run came back with posts: it is now the newest finished run, older runs all failed.
    await insertFailedBrightDataRuns(20);
    await db.insert(scraperActorRuns).values({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId,
      runId: 'batch-health-test-probe-ok-' + Date.now(),
      rawInput: {},
      status: 'SUCCEEDED',
      itemCount: 4,
      completedAt: new Date(Date.now() + 60_000),
    });

    await runBatch();

    const row = await brightDataHealth();
    assert.strictEqual(row.consecutiveFailureDays, 0);
    assert.strictEqual(row.lastFailureReason, null);
  });

  // IDEA-096: the CloudWatch alarms watch these two counters, so they must fire on the transition only.
  await t.test('the day a provider turns degraded emits one ProviderDegraded metric, naming the provider', async () => {
    await insertFailedBrightDataRuns(20);

    const metrics = await runBatchCapturingOpsMetrics();

    const degraded = metrics.filter((line) => 'ProviderDegraded' in line);
    assert.strictEqual(degraded.length, 1);
    assert.strictEqual(degraded[0].Provider, 'brightdata');
    assert.deepStrictEqual(metrics.filter((line) => 'ProviderRecovered' in line), []);
  });

  await t.test('a provider that stays degraded emits no further ProviderDegraded metric', async () => {
    await insertFailedBrightDataRuns(20);
    await runBatch();

    const metrics = await runBatchCapturingOpsMetrics();

    assert.deepStrictEqual(metrics.filter((line) => 'ProviderDegraded' in line), []);
  });

  await t.test('a provider that comes back emits one ProviderRecovered metric', async () => {
    await db.insert(scraperProviderHealth).values({
      provider: 'brightdata',
      consecutiveFailureDays: 2,
      lastFailureReason: 'PROVIDER_DEGRADED',
      lastCheckedAt: new Date(),
    });
    await insertFailedBrightDataRuns(20);
    await db.insert(scraperActorRuns).values({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId,
      runId: 'batch-health-test-probe-ok-metric-' + Date.now(),
      rawInput: {},
      status: 'SUCCEEDED',
      itemCount: 4,
      completedAt: new Date(Date.now() + 60_000),
    });

    const metrics = await runBatchCapturingOpsMetrics();

    const recovered = metrics.filter((line) => 'ProviderRecovered' in line);
    assert.strictEqual(recovered.length, 1);
    assert.strictEqual(recovered[0].Provider, 'brightdata');
  });
});
