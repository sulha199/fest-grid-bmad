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
import { users, socialMediaAccountProfiles, subscriptions, posts, scraperBatchRuns } from '@festgrid/database';
import { inArray, gte } from 'drizzle-orm';
import '../lib/scraper/register-adapters.js';

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

  t.after(() => {
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
    assert.deepStrictEqual(deletedHandles, ['rh-1']);
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

  t.after(() => {
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
