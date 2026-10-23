import test from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { registerScraperAdapter } from '@festgrid/domain';
import {
  APIFY_CALL_TIMEOUT_MS,
  callApifyActor,
  clearApifyAuditContext,
  getApifyCallTimeoutMs,
  getApifyClient,
  setApifyAuditContext,
  setGetApifyClient,
  instagramScraperAdapter,
} from './instagram-adapter.js';
import { processScrapeJob } from './process-scrape-job.js';
import { VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';
import { clearApifyProviderUsage } from './usage-store-test-helpers.js';

// The synchronous Apify call behind the scraper Lambda's queue fallback (2026-10-23: 11 profiles hit the
// API Lambda's 26s bound inside a 300s Lambda, left no audit row, were stamped as scraped, and the Apify
// run kept going with its output thrown away).
test('callApifyActor: the queue path\'s budget, abort and audit trail', async (t) => {
  const savedClient = getApifyClient;
  const savedQueueTimeout = process.env.SCRAPE_QUEUE_APIFY_CALL_TIMEOUT_MS;
  let profileId: string;

  t.before(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'call-apify-actor-test-' + Date.now(),
        platform: 'instagram',
        username: 'call_apify_actor_test',
        displayName: 'Call Apify Actor Test',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;
  });

  t.afterEach(async () => {
    clearApifyAuditContext();
    setGetApifyClient(savedClient);
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
    await clearApifyProviderUsage();
  });

  t.after(async () => {
    if (savedQueueTimeout === undefined) delete process.env.SCRAPE_QUEUE_APIFY_CALL_TIMEOUT_MS;
    else process.env.SCRAPE_QUEUE_APIFY_CALL_TIMEOUT_MS = savedQueueTimeout;
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  function fakeClient(opts: {
    start?: () => Promise<{ id: string }>;
    waitForFinish?: () => Promise<{ id: string; status: string; defaultDatasetId?: string }>;
    items?: unknown[];
    aborted?: string[];
  }) {
    return (() => ({
      actor: () => ({ start: opts.start ?? (async () => ({ id: 'run-1' })) }),
      run: (id: string) => ({
        abort: async () => { opts.aborted?.push(id); },
        waitForFinish: opts.waitForFinish ?? (async () => ({ id, status: 'SUCCEEDED', defaultDatasetId: 'ds-1' })),
      }),
      dataset: () => ({ listItems: async () => ({ items: opts.items ?? [] }) }),
    })) as unknown as typeof savedClient;
  }

  const runs = () => db.select().from(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));

  await t.test('without a queue budget the API Lambda\'s 26s bound applies; the queue worker\'s own budget replaces it', () => {
    assert.strictEqual(APIFY_CALL_TIMEOUT_MS, 26_000);
    assert.strictEqual(getApifyCallTimeoutMs(), 26_000);
    setApifyAuditContext(profileId, 'SYNC');
    assert.strictEqual(getApifyCallTimeoutMs(), 26_000, 'a context with no budget keeps the default');
    setApifyAuditContext(profileId, 'SYNC', 120_000);
    assert.strictEqual(getApifyCallTimeoutMs(), 120_000);
    clearApifyAuditContext();
    assert.strictEqual(getApifyCallTimeoutMs(), 26_000, 'clearing the context restores it');
  });

  await t.test('a timeout aborts the Apify run and records a TIMED_OUT audit row against that run', async () => {
    const aborted: string[] = [];
    setGetApifyClient(fakeClient({ aborted, waitForFinish: () => new Promise(() => {}) }));
    setApifyAuditContext(profileId, 'SYNC', 1_000);

    await assert.rejects(() => callApifyActor('apify/instagram-post-scraper', { username: ['x'] } as never), VendorCallTimeoutError);

    assert.deepStrictEqual(aborted, ['run-1']);
    const [row, ...others] = await runs();
    assert.strictEqual(others.length, 0);
    assert.strictEqual(row.status, 'TIMED_OUT');
    assert.strictEqual(row.vendor, 'APIFY');
    assert.strictEqual(row.triggerMode, 'SYNC');
    assert.strictEqual(row.runId, 'run-1');
    assert.match(row.errorMessage ?? '', /timed out after 1000ms/);
  });

  await t.test('a call that fails before a run exists still leaves a FAILED audit row', async () => {
    setGetApifyClient(fakeClient({ start: async () => { throw new Error('402 memory limit'); } }));
    setApifyAuditContext(profileId, 'SYNC', 1_000);

    await assert.rejects(() => callApifyActor('apify/instagram-post-scraper', { username: ['x'] } as never), /402 memory limit/);

    const [row] = await runs();
    assert.strictEqual(row.status, 'FAILED');
    assert.match(row.runId, /^sync-unstarted-/);
  });

  await t.test('a run Apify ended as failed is recorded FAILED and surfaces as an error to the queue worker', async () => {
    setGetApifyClient(fakeClient({ waitForFinish: async () => ({ id: 'run-2', status: 'TIMED-OUT', defaultDatasetId: 'ds-1' }) }));
    setApifyAuditContext(profileId, 'SYNC', 1_000);

    await assert.rejects(() => callApifyActor('apify/instagram-post-scraper', { username: ['x'] } as never), /ended with status TIMED-OUT/);

    const [row] = await runs();
    assert.strictEqual(row.status, 'FAILED');
    assert.strictEqual(row.runId, 'run-2');
  });

  await t.test('success is unchanged: items returned, a SUCCEEDED row, no abort', async () => {
    const aborted: string[] = [];
    setGetApifyClient(fakeClient({ aborted, items: [{ id: 'a' }, { id: 'b' }] }));
    setApifyAuditContext(profileId, 'SYNC', 1_000);

    const items = await callApifyActor('apify/instagram-post-scraper', { username: ['x'] } as never);

    assert.strictEqual(items.length, 2);
    assert.deepStrictEqual(aborted, []);
    const [row] = await runs();
    assert.strictEqual(row.status, 'SUCCEEDED');
    assert.strictEqual(row.itemCount, 2);
  });

  await t.test('without an audit context (API Lambda callers) nothing is recorded, success or failure', async () => {
    setGetApifyClient(fakeClient({ items: [{ id: 'a' }] }));
    await callApifyActor('apify/instagram-post-scraper', { username: ['x'] } as never);
    setGetApifyClient(fakeClient({ start: async () => { throw new Error('boom'); } }));
    await assert.rejects(() => callApifyActor('apify/instagram-post-scraper', { username: ['x'] } as never), /boom/);
    assert.strictEqual((await runs()).length, 0);
  });

  await t.test('processScrapeJob on the queue path: the budget comes from SCRAPE_QUEUE_APIFY_CALL_TIMEOUT_MS, a timeout leaves a TIMED_OUT row and no lastScrapedAt stamp, and rethrow lets SQS redeliver', async () => {
    registerScraperAdapter('instagram', instagramScraperAdapter);
    process.env.SCRAPE_QUEUE_APIFY_CALL_TIMEOUT_MS = '1000';
    const aborted: string[] = [];
    setGetApifyClient(fakeClient({ aborted, waitForFinish: () => new Promise(() => {}) }));
    const consoleError = console.error;
    console.error = () => {};
    const started = Date.now();
    try {
      await assert.rejects(
        () => processScrapeJob(
          { profileId, platform: 'instagram', accountId: 'call-apify-actor-test', username: 'call_apify_actor_test' },
          { rethrowOnFailure: true }
        ),
        VendorCallTimeoutError
      );
    } finally {
      console.error = consoleError;
    }
    assert.ok(Date.now() - started < 10_000, 'bounded by the 1s queue budget, not the 26s API budget');
    assert.deepStrictEqual(aborted, ['run-1']);

    const [row] = await runs();
    assert.strictEqual(row.status, 'TIMED_OUT');
    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
    assert.strictEqual(profile.lastScrapedAt, null, 'a timed-out scrape is not a completed one');
  });
});
