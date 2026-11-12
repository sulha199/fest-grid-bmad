import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobAttempts, jobVendorSnapshots, jobs, posts } from '@festgrid/database';
import { ApifyRequestTimeoutError, ScraperCapacityExceededError, type PostAdapterAttempt, type ScrapedPost } from '@festgrid/domain';
import { REEXTRACT_PHASE_PREVIEW, REEXTRACT_PHASE_REFRESH } from '@festgrid/domain/jobs';
import type { ReextractRefreshReport } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { BrightDataSnapshotPendingError } from '../scraper/brightdata-client.js';
import { getPostScraperAdapters } from '../scraper/post-scraper-registry.js';
import { claimPostUrlScrape } from '../scraper/post-url-scrape-lease.js';
import { classifyChainFailure, reextractRefreshHandler } from './reextract-refresh-handler.js';
import { createReextractFixtures } from './reextract-test-support.js';

// Story 10.6 (AC2 to AC7) -- phase 1 of the moderator re-extract job, with fake vendors: no vendor call, no Lambda invoke.

const fx = createReextractFixtures('refresh');
const AI_FN = 'test-ai-processor-fn';
const savedAiFn = process.env.AI_PROCESSOR_FUNCTION_NAME;
let ownerId: string;
let accountId: string;

test.before(async () => {
  ownerId = await fx.makeUser();
  accountId = (await fx.makeAccount()).id;
});
test.beforeEach(() => {
  fx.reset();
  process.env.AI_PROCESSOR_FUNCTION_NAME = AI_FN;
});
test.after(async () => {
  if (savedAiFn === undefined) delete process.env.AI_PROCESSOR_FUNCTION_NAME;
  else process.env.AI_PROCESSOR_FUNCTION_NAME = savedAiFn;
  await fx.cleanup();
});

const fresh = (post: { postUrl: string }, over: Partial<ScrapedPost> = {}): ScrapedPost => ({
  content: 'A vendor caption that must never be stored',
  postUrl: post.postUrl,
  publishedAt: '2026-10-01T00:00:00.000Z',
  imageUrl: fx.freshUrl('cover-new'),
  additionalImageUrls: [fx.freshUrl('s1-new'), fx.freshUrl('s2-new')],
  ...over,
});

async function run(post: Awaited<ReturnType<typeof fx.makePost>>, jobOverrides: Partial<typeof jobs.$inferInsert> = {}, remainingMs?: number) {
  const job = await fx.makeJob(post.id, ownerId, jobOverrides);
  const { ctx, record } = fx.handlerContext(job, remainingMs);
  const result = await reextractRefreshHandler.run(ctx);
  const row = await fx.readJob(job.id);
  const report = (row.resultData as { refresh?: ReextractRefreshReport } | null)?.refresh;
  // Close it, so the next run for the same post is not blocked by the one-open-job-per-input index (the engine would have ended it).
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, job.id));
  return { job, result, record, report, row };
}

const stalePost = () =>
  fx.makePost(accountId, { imageUrl: fx.expiredUrl('cover-old'), additionalImageUrls: [fx.expiredUrl('s1-old'), fx.expiredUrl('s2-old')] });

test('no refresh is needed: no vendor is touched, the report says so and the job is handed to the AI-processor in phase preview', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [fx.freshUrl('s')] });
  fx.fakeAdapter('apify', async () => assert.fail('apify must not be called'));
  fx.fakeAdapter('brightdata', async () => assert.fail('brightdata must not be called'));
  const { result, record, report } = await run(post);
  assert.deepEqual(result, { outcome: 'HANDED_OFF' });
  assert.deepEqual(fx.calls, []);
  assert.deepEqual(record.phases, [REEXTRACT_PHASE_REFRESH, REEXTRACT_PHASE_PREVIEW]);
  assert.deepEqual(record.handedOffTo, [AI_FN]);
  assert.deepEqual(report, { outcome: 'NOT_NEEDED', reasons: [], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 0 });
});

test('expired links: Apify is tried FIRST (this type\'s own order), fresh links are saved to posts, the caption is never touched', async () => {
  const post = await stalePost();
  fx.fakeAdapter('apify', async (url) => fresh({ postUrl: url }));
  fx.fakeAdapter('brightdata', async () => assert.fail('brightdata is not needed when Apify answers'));
  const { result, report, job } = await run(post);
  assert.deepEqual(result, { outcome: 'HANDED_OFF' });
  assert.deepEqual(fx.calls, ['apify']);
  assert.equal(report?.outcome, 'REFRESHED');
  assert.deepEqual(report?.reasons, ['COVER_EXPIRED', 'SLIDES_EXPIRED']);
  assert.equal(report?.saved, true);
  assert.equal(report?.expiredLinks, 0);

  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('cover-new'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('s1-new'), fx.freshUrl('s2-new')]);
  assert.ok(stored.imageUrlExpiresAt && stored.imageUrlExpiresAt.getTime() > Date.now(), 'the cover expiry moved with the link');
  assert.equal(stored.content, post.content, 'a vendor caption is never written');

  const attempts = await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, job.id));
  assert.deepEqual(attempts.map((a) => [a.provider, a.outcome]), [['APIFY', 'SUCCEEDED']]);
  assert.doesNotMatch(JSON.stringify(await fx.readJob(job.id)), /must never be stored/);
});

test('the default order of every other caller is not changed by this type\'s own order', () => {
  assert.deepEqual(getPostScraperAdapters().map((a) => a.name), ['brightdata', 'apify']);
});

test('Apify fails, Bright Data answers with 640 px images: a valid full-size cover is kept, the unknown slides are saved, the post type is filled', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('full-cover'), additionalImageUrls: null, platformPostType: null });
  fx.fakeAdapter('apify', async () => {
    throw new Error('apify down https://secret.example/token');
  });
  fx.fakeAdapter('brightdata', async (url) => fresh({ postUrl: url }, { imageUrl: fx.lowResUrl('low-cover'), additionalImageUrls: [fx.lowResUrl('low-1')] }));
  const { report } = await run(post);
  assert.deepEqual(fx.calls, ['apify', 'brightdata'], 'Apify first, then Bright Data');
  assert.deepEqual(report?.reasons, ['SLIDES_UNKNOWN']);
  assert.equal(report?.outcome, 'REFRESHED');
  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('full-cover'), 'never a 640 px cover over a full-size one');
  assert.deepEqual(stored.additionalImageUrls, [fx.lowResUrl('low-1')], 'slides that were unknown are now known');
  assert.equal(stored.platformPostType, 'p', 'a null post type is filled from the URL');
});

test('an empty slide list from the vendor never replaces a stored list; a stored post type is never replaced', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c'), additionalImageUrls: [fx.freshUrl('keep-1')], platformPostType: 'reel' });
  fx.fakeAdapter('apify', async (url) => fresh({ postUrl: url }, { additionalImageUrls: [] }));
  await run(post);
  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('cover-new'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('keep-1')]);
  assert.equal(stored.platformPostType, 'reel');
});

for (const accountType of [{ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' }, { accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'AWAITING_APPROVAL' }] as const) {
  test(`AD-34: an account that is ${accountType.accountType} / ${accountType.accountTypeStatus} is not scraped: the refresh is refused with its reason, no vendor call`, async () => {
    const account = await fx.makeAccount(accountType);
    const post = await fx.makePost(account.id, { imageUrl: fx.expiredUrl('c') });
    fx.fakeAdapter('apify', async () => assert.fail('no scrape for this account'));
    fx.fakeAdapter('brightdata', async () => assert.fail('no scrape for this account'));
    const { result, report } = await run(post);
    assert.deepEqual(result, { outcome: 'HANDED_OFF' }, 'the preview still continues');
    assert.equal(report?.outcome, 'NOT_SCRAPED');
    assert.deepEqual(report?.reasons, ['COVER_EXPIRED']);
    assert.equal(report?.expiredLinks, 1);
    assert.deepEqual(fx.calls, []);
  });
}

test('a post that needs no refresh does not touch the account gate (a personal account\'s post still previews)', async () => {
  const account = await fx.makeAccount({ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' });
  const post = await fx.makePost(account.id, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [] });
  const { report } = await run(post);
  assert.equal(report?.outcome, 'NOT_NEEDED');
});

test('FIND-261102-4qm: the 10 minutes start only when a vendor call ran', async () => {
  const post = await stalePost();
  // Run 1: both providers are over their known cap, so nothing reached a vendor.
  fx.skipReasons.set('apify', 'quota');
  fx.skipReasons.set('brightdata', 'quota');
  const first = await run(post);
  assert.equal(first.report?.outcome, 'PROVIDER_OVER_QUOTA');
  assert.deepEqual(fx.calls, []);
  fx.skipReasons.clear();

  // Run 2 right after: no cooldown, because no vendor call ran. Apify's capacity gate refuses at the call site (still no call).
  fx.fakeAdapter('apify', async () => {
    throw new ScraperCapacityExceededError('capacity exceeded');
  });
  fx.fakeAdapter('brightdata', async () => {
    throw new ScraperCapacityExceededError('capacity exceeded');
  });
  const second = await run(post);
  assert.equal(second.report?.outcome, 'PROVIDER_OVER_QUOTA', 'not COOLDOWN');
  assert.deepEqual(fx.calls, ['apify', 'brightdata']);

  // Run 3: a real failure once the vendor call started.
  fx.calls.length = 0;
  fx.fakeAdapter('apify', async () => {
    throw new Error('vendor call failed mid-flight');
  });
  fx.fakeAdapter('brightdata', async () => null);
  const third = await run(post);
  assert.equal(third.report?.outcome, 'POST_UNAVAILABLE');

  // Run 4: now the cooldown applies, by any moderator's job for the post, and no vendor is called.
  fx.calls.length = 0;
  const fourth = await run(post);
  assert.equal(fourth.report?.outcome, 'COOLDOWN');
  assert.deepEqual(fx.calls, []);
  assert.ok(fourth.report?.retryAfter && new Date(fourth.report.retryAfter).getTime() > Date.now(), 'the report says when it can be tried again');
  assert.ok(new Date(fourth.report!.retryAfter!).getTime() <= Date.now() + 10 * 60_000);
});

test('an attempt older than 10 minutes no longer blocks a refresh', async () => {
  const post = await stalePost();
  const old = await fx.makeJob(post.id, ownerId, { status: 'SUCCEEDED' });
  await db.insert(jobAttempts).values({ jobId: old.id, provider: 'APIFY', outcome: 'SUCCEEDED', budgetMs: 1000, elapsedMs: 10, createdAt: new Date(Date.now() - 11 * 60_000) });
  fx.fakeAdapter('apify', async (url) => fresh({ postUrl: url }));
  const { report } = await run(post);
  assert.equal(report?.outcome, 'REFRESHED');
});

test('FIND-110: while another request holds the scrape lease, the refresh is skipped and the preview continues on the stored images', async () => {
  const post = await stalePost();
  const lease = await claimPostUrlScrape(post.postUrl);
  assert.ok(lease);
  fx.fakeAdapter('apify', async () => assert.fail('no second scrape of one post'));
  try {
    const { result, report } = await run(post);
    assert.deepEqual(result, { outcome: 'HANDED_OFF' });
    assert.equal(report?.outcome, 'IN_FLIGHT');
  } finally {
    await lease.release();
  }
});

test('the lease is released after a refresh that fails, so the post is not stuck', async () => {
  const post = await stalePost();
  fx.fakeAdapter('apify', async () => {
    throw new Error('boom');
  });
  fx.fakeAdapter('brightdata', async () => {
    throw new Error('boom');
  });
  const { report } = await run(post);
  assert.equal(report?.outcome, 'NO_PROVIDER_REACHABLE');
  const lease = await claimPostUrlScrape(post.postUrl);
  assert.ok(lease, 'claimable again');
  await lease.release();
});

test('the post is gone at the vendor: POST_UNAVAILABLE, stored images kept', async () => {
  const post = await stalePost();
  fx.fakeAdapter('apify', async () => null);
  const { report } = await run(post);
  assert.equal(report?.outcome, 'POST_UNAVAILABLE');
  assert.equal((await fx.readPost(post.id)).imageUrl, fx.expiredUrl('cover-old'));
});

test('Bright Data still running when the budget ends: TIMED_OUT with a late result pending, the snapshot is linked to the job, no wait', async () => {
  const post = await stalePost();
  fx.fakeAdapter('apify', async () => {
    throw new ApifyRequestTimeoutError('slow');
  });
  fx.fakeAdapter('brightdata', async () => {
    throw new BrightDataSnapshotPendingError(`s_${fx.suffix}`, 'running', 95_000, 100_000);
  });
  const { result, report, job, row } = await run(post);
  assert.deepEqual(result, { outcome: 'HANDED_OFF' }, 'the job does not wait');
  assert.equal(row.status, 'RUNNING', 'never WAITING');
  assert.equal(report?.outcome, 'TIMED_OUT');
  assert.equal(report?.lateResultPending, true);
  const links = await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.jobId, job.id));
  assert.deepEqual(links.map((l) => [l.snapshotId, l.status]), [[`s_${fx.suffix}`, 'PENDING']]);
});

test('a provider that timed out, or none with time to run, reads as TIMED_OUT', async () => {
  const post = await stalePost();
  fx.fakeAdapter('apify', async () => {
    throw new ApifyRequestTimeoutError('slow');
  });
  fx.fakeAdapter('brightdata', async () => {
    throw new Error('boom');
  }, 90_000);
  // 40 s of run left: the budget is 25 s, so Bright Data (needs 90 s) is skipped for lack of time after Apify timed out.
  const { report } = await run(post, {}, 40_000);
  assert.equal(report?.outcome, 'TIMED_OUT');
  assert.deepEqual(fx.calls, ['apify']);
});

test('classifyChainFailure reads each provider\'s attempt, never a message', () => {
  const failed = (error: unknown): PostAdapterAttempt => ({ adapter: 'apify', outcome: 'failed', error, elapsedMs: 1, budgetMs: 1 });
  const skipped = (reason: 'quota' | 'budget' | 'degraded'): PostAdapterAttempt => ({ adapter: 'brightdata', outcome: 'skipped', reason, detail: 'x', budgetMs: 1 });
  assert.deepEqual(classifyChainFailure([failed(new Error('x'))], new Error('x')), { outcome: 'NO_PROVIDER_REACHABLE', lateResultPending: false });
  assert.deepEqual(classifyChainFailure([skipped('quota'), failed(new ScraperCapacityExceededError('x'))], new Error('x')).outcome, 'PROVIDER_OVER_QUOTA');
  assert.deepEqual(classifyChainFailure([skipped('degraded')], new Error('x')).outcome, 'NO_PROVIDER_REACHABLE');
  assert.deepEqual(classifyChainFailure([skipped('budget')], new Error('x')).outcome, 'TIMED_OUT');
  assert.deepEqual(classifyChainFailure([], new Error('nothing considered')).outcome, 'NO_PROVIDER_REACHABLE');
  assert.deepEqual(classifyChainFailure([failed(new BrightDataSnapshotPendingError('s', 'running', 1, 1))], new Error('x')), { outcome: 'TIMED_OUT', lateResultPending: true });
});

test('a post with a platform no adapter knows is not refreshed, and the preview continues', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c'), postUrl: `https://example.com/not-a-post-${fx.suffix}`, platformPostId: null, platformPostType: null });
  const { result, report } = await run(post);
  assert.deepEqual(result, { outcome: 'HANDED_OFF' });
  assert.equal(report?.outcome, 'NO_PROVIDER_REACHABLE');
});

test('failures that are not a refresh problem: unknown post, a post whose chain is running, a bad input', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c') });
  const ghost = await fx.makeJob(post.id, ownerId, { inputKey: `ghost-${fx.suffix}`, input: { postId: '00000000-0000-4000-8000-0000000000aa' } });
  assert.deepEqual(await reextractRefreshHandler.run(fx.handlerContext(ghost).ctx), { outcome: 'FAILED', reasonCode: 'POST_NOT_FOUND', errorMessage: 'Post not found.' });

  await db.update(posts).set({ extractionCursor: { version: 1, placeholder: 'only its presence matters' } as never }).where(eq(posts.id, post.id));
  const busy = await fx.makeJob(post.id, ownerId, { inputKey: `busy-${fx.suffix}` });
  const busyResult = await reextractRefreshHandler.run(fx.handlerContext(busy).ctx);
  assert.equal(busyResult.outcome === 'FAILED' && busyResult.reasonCode, 'CHAIN_IN_FLIGHT');

  const bad = await fx.makeJob(post.id, ownerId, { inputKey: `bad-${fx.suffix}`, input: { nope: true } });
  const badResult = await reextractRefreshHandler.run(fx.handlerContext(bad).ctx);
  assert.equal(badResult.outcome === 'FAILED' && badResult.reasonCode, 'HANDLER_ERROR');
});

test('a job already in phase preview goes straight to the hand-off (a resumed run never refreshes twice)', async () => {
  const post = await stalePost();
  fx.fakeAdapter('apify', async () => assert.fail('no refresh on a resume'));
  const job = await fx.makeJob(post.id, ownerId, { phase: REEXTRACT_PHASE_PREVIEW });
  const { ctx, record } = fx.handlerContext(job);
  assert.deepEqual(await reextractRefreshHandler.run(ctx), { outcome: 'HANDED_OFF' });
  assert.deepEqual(record.handedOffTo, [AI_FN]);
});

test('without the AI-processor function name the job fails plainly instead of waiting for a hand-off that cannot happen', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [] });
  delete process.env.AI_PROCESSOR_FUNCTION_NAME;
  const { result } = await run(post);
  assert.equal(result.outcome === 'FAILED' && result.reasonCode, 'START_FAILED');
});

test('the budget is capped by the run\'s remaining time: a run with no room never calls Bright Data', async () => {
  const post = await stalePost();
  let received: number | undefined;
  fx.fakeAdapter('apify', async (_url, { budgetMs }) => {
    received = budgetMs;
    return fresh({ postUrl: post.postUrl });
  });
  await run(post, {}, 40_000);
  assert.ok(received !== undefined && received <= 25_000 && received > 0, `apify was given ${received} ms, the run's 40 s minus headroom`);
});
