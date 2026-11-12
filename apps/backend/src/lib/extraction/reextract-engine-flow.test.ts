import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { eventPosts, jobAttempts, jobs, posts } from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import type { ReextractionPreviewResult } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { invokeJobEngineWorker, setInvokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';
import { resolveLocationSeam, setResolveLocationSeam } from '../ai-processor/resolve-account-and-locations.js';
import { callGeminiForManualExtractionSeam, setCallGeminiForManualExtractionSeam } from '../ai-processor/process-manual-extraction-job.js';
import { runJobEngineJob } from '../job-engine/run-job.js';
import { registerAiProcessorJobHandlers } from '../job-engine/register-ai-processor-job-handlers.js';
import { registerScraperJobHandlers } from '../job-engine/register-scraper-job-handlers.js';
import { applyPostReextraction } from './apply-post-reextraction.js';
import { getReextractPreviewJobStatus } from './reextract-preview-job.js';
import { createReextractFixtures } from './reextract-test-support.js';
import { startPostReextractionPreview } from './start-post-reextraction-preview.js';

// Story 10.6 (AC1, AC6, AC8, AC9; the end-to-end proof) -- a moderator's Re-extract through the ENGINE with fake vendors, a fake Gemini
// and a fake image fetch: start, the refresh in the "Scraper Lambda", the hand-off, the preview in the "AI-processor Lambda", the
// existing status read, and Apply. The two Lambdas are the two halves of the job's handlers, run one after the other from the queue of
// invokes the engine makes. No vendor call, no AWS call.

const fx = createReextractFixtures('flow');
const SCRAPER_FN = 'test-scraper-fn';
const AI_FN = 'test-ai-processor-fn';
const saved = {
  scraper: process.env.SCRAPER_FUNCTION_NAME,
  ai: process.env.AI_PROCESSOR_FUNCTION_NAME,
  blur: process.env.BLUR_FACES_BEFORE_AI,
  invoke: invokeJobEngineWorker,
  gemini: callGeminiForManualExtractionSeam,
  resolve: resolveLocationSeam,
  fetch: globalThis.fetch,
};
const invokes: Array<{ fn: string; jobId: string }> = [];
let moderatorId: string;
let otherModeratorId: string;
let accountId: string;
const geminiRequests: any[] = [];

/** Runs every queued invoke on the half of the job's handlers that Lambda holds, until the queue is empty. */
async function drain(): Promise<void> {
  while (invokes.length > 0) {
    const { fn, jobId } = invokes.shift()!;
    if (fn === SCRAPER_FN) registerScraperJobHandlers();
    else registerAiProcessorJobHandlers();
    await runJobEngineJob(jobId, { getRemainingTimeInMillis: () => 150_000 });
  }
}

test.before(async () => {
  process.env.SCRAPER_FUNCTION_NAME = SCRAPER_FN;
  process.env.AI_PROCESSOR_FUNCTION_NAME = AI_FN;
  process.env.BLUR_FACES_BEFORE_AI = 'false';
  setInvokeJobEngineWorker(async (fn, payload) => {
    invokes.push({ fn, jobId: (payload as { jobId: string }).jobId });
  });
  setResolveLocationSeam(async () => {
    throw new Error('geocoder disabled in test');
  });
  moderatorId = await fx.makeUser('moderator');
  otherModeratorId = await fx.makeUser('moderator');
  accountId = (await fx.makeAccount()).id;
});
test.beforeEach(() => {
  fx.reset();
  invokes.length = 0;
  geminiRequests.length = 0;
});
test.afterEach(() => {
  globalThis.fetch = saved.fetch;
});
test.after(async () => {
  setInvokeJobEngineWorker(saved.invoke);
  setCallGeminiForManualExtractionSeam(saved.gemini);
  setResolveLocationSeam(saved.resolve);
  globalThis.fetch = saved.fetch;
  for (const [key, value] of [['SCRAPER_FUNCTION_NAME', saved.scraper], ['AI_PROCESSOR_FUNCTION_NAME', saved.ai], ['BLUR_FACES_BEFORE_AI', saved.blur]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await fx.cleanup();
});

const rawEvent = (name: string, date: string) => ({
  eventName: name,
  types: ['COMPETITION'],
  categories: ['SPORTS_AND_FITNESS'],
  location: 'Flow Hall',
  schedules: [{ isMainSchedule: true, eventStartDate: date, title: 'Race day', location: 'Flow Hall' }],
  confidenceScore: 0.9,
});

function fakeGemini(events: unknown[]) {
  setCallGeminiForManualExtractionSeam(async (req: any) => {
    geminiRequests.push(req);
    return { text: JSON.stringify({ isEvent: true, groupingReason: 'roundup', postTitle: 'A roundup', events }) } as any;
  });
}
function fakeImages(failing: string[] = []) {
  const fetched: string[] = [];
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    if (failing.includes(String(url))) return { ok: false, status: 403 } as any;
    return { ok: true, headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'image/jpeg' : null) }, arrayBuffer: async () => Buffer.from(`img-${fetched.length}`) } as any;
  }) as typeof fetch;
  return fetched;
}

test('Re-extract of a carousel whose links expired: start, refresh (Apify), hand-off, preview reads every slide, the screen\'s read, Apply, all through the engine', async () => {
  const post = await fx.makePost(accountId, {
    content: 'Roundup of the weekend: schedules are on the later slides',
    imageUrl: fx.expiredUrl('e2e-cover'),
    additionalImageUrls: [fx.expiredUrl('e2e-s1'), fx.expiredUrl('e2e-s2')],
    groupingReason: 'single-event',
  });
  const apifyCalls: string[] = [];
  fx.fakeAdapter('apify', async (url) => {
    apifyCalls.push(url);
    return {
      content: 'Vendor caption, never stored',
      postUrl: url,
      publishedAt: '2026-10-01T00:00:00.000Z',
      imageUrl: fx.freshUrl('e2e-cover-new'),
      additionalImageUrls: [fx.freshUrl('e2e-n1'), fx.freshUrl('e2e-n2'), fx.freshUrl('e2e-n3')],
    };
  });
  fx.fakeAdapter('brightdata', async () => assert.fail('Bright Data is the second choice for this type'));
  fakeGemini([rawEvent(`Flow Run ${fx.suffix}`, '2026-12-05'), rawEvent(`Flow Gala ${fx.suffix}`, '2026-12-19')]);
  const fetched = fakeImages();

  // 1. Start: returns the engine job's id at once and invokes the Scraper Lambda only.
  const started = await startPostReextractionPreview(moderatorId, { postId: post.id });
  assert.ok('jobId' in started, JSON.stringify(started));
  const jobId = started.jobId;
  const [startedRow] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  assert.equal(startedRow.type, REEXTRACT_POST_JOB_TYPE);
  assert.deepEqual(startedRow.input, { postId: post.id });
  assert.equal(startedRow.ownerUserId, moderatorId);
  assert.deepEqual(invokes, [{ fn: SCRAPER_FN, jobId }]);
  assert.equal((await getReextractPreviewJobStatus(jobId, moderatorId))?.status, 'PENDING');

  // A second click while it is open joins the same job (FR120): no second job, no second invoke.
  const again = await startPostReextractionPreview(moderatorId, { postId: post.id });
  assert.deepEqual(again, { jobId });
  assert.equal(invokes.length, 1);

  // 2. Both Lambdas' halves run.
  await drain();
  assert.deepEqual(apifyCalls, [post.postUrl], 'one refresh, through the chain');
  assert.equal(fx.calls.includes('brightdata'), false);
  const [done] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  assert.equal(done.status, 'SUCCEEDED');
  assert.equal(done.phase, 'preview');
  assert.ok(done.finishedAt);
  assert.equal(done.workerClaimedAt, null);

  // 3. The preview read by the moderator screen's existing query.
  const status = await getReextractPreviewJobStatus(jobId, moderatorId);
  assert.equal(status?.mode, 'REEXTRACT_PREVIEW');
  assert.equal(status?.status, 'SUCCEEDED');
  const preview = status!.data as ReextractionPreviewResult;
  assert.equal(preview.postStored, true);
  assert.equal(preview.rescraped, true);
  assert.equal(preview.imagesAvailable, 4, 'the refreshed cover and three slides');
  assert.equal(preview.imagesSent, 4, 'BUG-099: every slide is read');
  assert.equal(fetched.length, 4);
  assert.equal(preview.refresh?.outcome, 'REFRESHED');
  assert.deepEqual(preview.events.map((e) => e.eventName).sort(), [`Flow Gala ${fx.suffix}`, `Flow Run ${fx.suffix}`]);
  assert.equal(preview.events.length, 2);

  // 4. posts got the fresh links, never the caption; the job holds no caption anywhere.
  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('e2e-cover-new'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('e2e-n1'), fx.freshUrl('e2e-n2'), fx.freshUrl('e2e-n3')]);
  assert.equal(stored.content, post.content);
  const everything = JSON.stringify([done, await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, jobId))]);
  assert.doesNotMatch(everything, /Roundup of the weekend|Vendor caption/, 'no caption on the job, its result or its attempts');

  // 5. Another moderator cannot read or apply it (owner-scoped, like every manual job).
  assert.equal(await getReextractPreviewJobStatus(jobId, otherModeratorId), null);
  assert.deepEqual(await applyPostReextraction(otherModeratorId, jobId), { errorCode: 'NOT_FOUND', errorMessage: 'Preview not found, or it has not finished.' });

  // 6. Apply from the engine job's result: once, in one transaction; a second call returns the first result.
  const applied = await applyPostReextraction(moderatorId, jobId);
  assert.ok('summary' in applied, JSON.stringify(applied));
  assert.equal(applied.summary.created.length + applied.summary.reused.length, 2);
  assert.equal((await db.select().from(eventPosts).where(eq(eventPosts.postId, post.id))).length >= 2, true, 'the events are linked to the post');
  const [afterApply] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const result = afterApply.resultData as ReextractionPreviewResult;
  assert.ok(result.applied && result.appliedAt);
  assert.equal(result.extracted, null, 'the kept extraction is cleared once applied');
  assert.equal(result.refresh?.outcome, 'REFRESHED', 'the report survives Apply');
  const second = await applyPostReextraction(moderatorId, jobId);
  assert.deepEqual(second, applied, 'a second Apply returns the first result and writes nothing');
});

test('a job that ended with limits (the refresh was due but could not run) is still a finished, applicable preview', async () => {
  const account = await fx.makeAccount({ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' });
  const post = await fx.makePost(account.id, { imageUrl: fx.freshUrl('lim-c'), additionalImageUrls: [fx.expiredUrl('lim-s')], groupingReason: 'single-event' });
  fx.fakeAdapter('apify', async () => assert.fail('a personal account is never scraped'));
  fx.fakeAdapter('brightdata', async () => assert.fail('a personal account is never scraped'));
  fakeGemini([rawEvent(`Limits Run ${fx.suffix}`, '2026-12-06')]);
  fakeImages([fx.expiredUrl('lim-s')]); // an expired link cannot be fetched

  const started = await startPostReextractionPreview(moderatorId, { postId: post.id });
  assert.ok('jobId' in started);
  await drain();

  const [row] = await db.select().from(jobs).where(eq(jobs.id, started.jobId));
  assert.equal(row.status, 'SUCCEEDED_WITH_LIMITS');
  assert.equal(row.reasonCode, 'ACCOUNT_TYPE_NOT_SCRAPED');
  assert.match(row.errorMessage ?? '', /not scraped/);
  const status = await getReextractPreviewJobStatus(started.jobId, moderatorId);
  assert.equal(status?.status, 'SUCCEEDED', 'the screen reads a finished preview');
  assert.equal(status?.errorCode, null);
  assert.equal(status?.errorMessage, null, 'a note about the images is not an error for the screen');
  const preview = status!.data as ReextractionPreviewResult;
  assert.equal(preview.refresh?.outcome, 'NOT_SCRAPED');
  assert.equal(preview.imagesAvailable, 2);
  assert.equal(preview.imagesSent, 1, 'the expired slide could not be read: the shortfall is in the result');
  const applied = await applyPostReextraction(moderatorId, started.jobId);
  assert.ok('summary' in applied, 'a shortfall does not change Apply');
});

test('a failed extraction is a FAILED job the screen reads with the existing error code and message', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('f-c'), additionalImageUrls: [] });
  setCallGeminiForManualExtractionSeam(async () => ({ text: 'not json at all' }) as any);
  fakeImages();
  const started = await startPostReextractionPreview(moderatorId, { postId: post.id });
  assert.ok('jobId' in started);
  await drain();
  const status = await getReextractPreviewJobStatus(started.jobId, moderatorId);
  assert.deepEqual(
    { status: status?.status, data: status?.data, errorCode: status?.errorCode, errorMessage: status?.errorMessage },
    { status: 'FAILED', data: null, errorCode: 'EXTRACTION_FAILED', errorMessage: 'The extracted content could not be validated.' }
  );
  assert.deepEqual(await applyPostReextraction(moderatorId, started.jobId), { errorCode: 'NOT_FOUND', errorMessage: 'Preview not found, or it has not finished.' });
});

test('a start the engine cannot make (the Lambda cannot be invoked) is EXTRACTION_FAILED with a plain message, and the post is untouched', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('x-c'), additionalImageUrls: [] });
  setInvokeJobEngineWorker(async () => {
    throw new Error('AccessDenied for arn:aws:lambda:secret');
  });
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  let result;
  try {
    result = await startPostReextractionPreview(moderatorId, { postId: post.id });
  } finally {
    console.error = original;
    setInvokeJobEngineWorker(async (fn, payload) => void invokes.push({ fn, jobId: (payload as { jobId: string }).jobId }));
  }
  assert.deepEqual(result, { errorCode: 'EXTRACTION_FAILED', errorMessage: 'The job could not be started. Please try again.' });
  const rows = await db.select().from(jobs).where(eq(jobs.inputKey, post.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'FAILED');
  assert.equal(rows[0].reasonCode, 'START_FAILED');
  assert.equal((await fx.readPost(post.id)).imageUrl, post.imageUrl);
});

test('a post whose stepped extraction is running is refused before any job exists; an unknown or malformed id is NOT_FOUND', async () => {
  const post = await fx.makePost(accountId);
  await db.update(posts).set({ extractionCursor: { version: 1, placeholder: 'presence only' } as never }).where(eq(posts.id, post.id));
  const refused = await startPostReextractionPreview(moderatorId, { postId: post.id });
  assert.ok('errorCode' in refused && refused.errorCode === 'CHAIN_IN_FLIGHT');
  assert.equal((await db.select().from(jobs).where(eq(jobs.inputKey, post.id))).length, 0);
  assert.equal(await getReextractPreviewJobStatus('not-a-uuid', moderatorId), null);
  assert.equal(await getReextractPreviewJobStatus('00000000-0000-4000-8000-0000000000dd', moderatorId), null);
});

test('a post with no stored caption (and an unknown URL) keeps the unchanged path: no engine job is created', async () => {
  const account = await fx.makeAccount({ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' });
  const post = await fx.makePost(account.id, { content: null, imageUrl: fx.expiredUrl('nc') });
  const result = await startPostReextractionPreview(moderatorId, { postId: post.id });
  assert.ok('errorCode' in result && result.errorCode === 'ACCOUNT_NOT_SCRAPABLE', 'the legacy gate answered, with no scrape');
  assert.equal((await db.select().from(jobs).where(eq(jobs.inputKey, post.id))).length, 0);
  const unsupported = await startPostReextractionPreview(moderatorId, { url: `https://example.com/not-a-post-${fx.suffix}` });
  assert.ok('errorCode' in unsupported && unsupported.errorCode === 'UNSUPPORTED_PLATFORM');
});
