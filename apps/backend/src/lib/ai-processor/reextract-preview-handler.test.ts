import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { REEXTRACT_PHASE_PREVIEW, readHeldPost } from '@festgrid/domain/jobs';
import type { ReextractRefreshReport, ReextractionPreviewResult } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { AiGatewayExhaustedError } from '../ai-gateway/adapter.js';
import { createReextractFixtures } from '../extraction/reextract-test-support.js';
import { reextractPreviewHandler } from './reextract-preview-handler.js';
import { callGeminiForManualExtractionSeam, setCallGeminiForManualExtractionSeam } from './process-manual-extraction-job.js';

// Story 10.6 (AC6, AC9) -- phase 2 of the moderator re-extract job, run in the AI-processor Lambda. Gemini and the image fetch are fakes.

const fx = createReextractFixtures('preview');
const originalGemini = callGeminiForManualExtractionSeam;
const originalFetch = globalThis.fetch;
const originalBlur = process.env.BLUR_FACES_BEFORE_AI;
let ownerId: string;
let accountId: string;

test.before(async () => {
  process.env.BLUR_FACES_BEFORE_AI = 'false';
  ownerId = await fx.makeUser();
  accountId = (await fx.makeAccount()).id;
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  setCallGeminiForManualExtractionSeam(originalGemini);
});
test.after(async () => {
  if (originalBlur === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
  else process.env.BLUR_FACES_BEFORE_AI = originalBlur;
  await fx.cleanup();
});

const refreshed: ReextractRefreshReport = { outcome: 'REFRESHED', reasons: ['COVER_EXPIRED'], saved: true, lateResultPending: false, retryAfter: null, expiredLinks: 0 };
const noRefresh: ReextractRefreshReport = { outcome: 'NOT_NEEDED', reasons: [], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 0 };

const previewEvent = (name: string) => ({
  eventName: name,
  types: ['COMPETITION'],
  categories: ['SPORTS_AND_FITNESS'],
  location: 'Preview Hall',
  schedules: [{ isMainSchedule: true, eventStartDate: '2026-12-05', title: 'Race day', location: 'Preview Hall' }],
  confidenceScore: 0.9,
});

function gemini(events: unknown[], requests: any[] = []) {
  setCallGeminiForManualExtractionSeam(async (req: any) => {
    requests.push(req);
    return { text: JSON.stringify({ isEvent: true, groupingReason: 'roundup', events }) } as any;
  });
}

/** Every image fetch answers with image bytes, except the URLs in `failing`. Counts the fetches. */
function fakeImages(failing: string[] = []) {
  const fetched: string[] = [];
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    if (failing.includes(String(url))) return { ok: false, status: 403 } as any;
    return {
      ok: true,
      headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => Buffer.from(`image-${fetched.length}`),
    } as any;
  }) as typeof fetch;
  return fetched;
}

async function runPhase2(postId: string, report: ReextractRefreshReport | null, overrides: Partial<typeof jobs.$inferInsert> = {}) {
  const job = await fx.makeJob(postId, ownerId, { phase: REEXTRACT_PHASE_PREVIEW, resultData: report ? { refresh: report } : null, ...overrides });
  const { ctx } = fx.handlerContext(job);
  const result = await reextractPreviewHandler.run(ctx);
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, job.id)); // close it: one open job per post
  return result;
}

test('a refreshed post previews: every image is read, the result carries the preview and the refresh report, the job ends SUCCEEDED', async () => {
  const post = await fx.makePost(accountId, {
    content: 'Roundup caption: dates are on the later slides',
    imageUrl: fx.freshUrl('cover'),
    additionalImageUrls: [fx.freshUrl('s1'), fx.freshUrl('s2'), fx.freshUrl('s3')],
  });
  const requests: any[] = [];
  gemini([previewEvent(`Preview Run ${fx.suffix}`)], requests);
  const fetched = fakeImages();

  const result = await runPhase2(post.id, refreshed);

  assert.equal(result.outcome, 'SUCCEEDED');
  assert.equal((result as any).reasonCode, undefined);
  const data = (result as any).resultData as ReextractionPreviewResult;
  assert.equal(data.postStored, true);
  assert.equal(data.rescraped, true, 'a refresh that delivered counts as rescraped');
  assert.equal(data.imagesAvailable, 4);
  assert.equal(data.imagesSent, 4, 'BUG-099: a carousel reads all its slides');
  assert.equal(fetched.length, 4);
  // Story 10.6a: the per-image list and the cap travel with the preview, beside the refresh report
  assert.deepEqual(data.images, [
    { position: 0, role: 'COVER', state: 'READ' },
    { position: 1, role: 'SLIDE', state: 'READ' },
    { position: 2, role: 'SLIDE', state: 'READ' },
    { position: 3, role: 'SLIDE', state: 'READ' },
  ]);
  assert.equal(data.imageCap, 10, 'the cap the request used');
  assert.equal(data.images!.length, data.imagesAvailable);
  assert.equal(data.images!.filter((image) => image.state === 'READ').length, data.imagesSent);
  assert.equal(JSON.stringify(data.images).includes('cdn.example.com'), false, 'no image link in the list');
  assert.equal(data.events.length, 1);
  assert.deepEqual(data.refresh, refreshed);
  assert.ok(data.extracted && data.extracted.events.length === 1, 'the extraction is kept for Apply');
  assert.equal(requests[0].contents.length, 5, 'caption plus the four images');
  assert.ok(JSON.stringify(requests[0].contents[0]).includes('Roundup caption'), 'the caption reached the model, in memory only');
  assert.equal(JSON.stringify(result).includes('Roundup caption'), false, 'and is not in the job result');
});

test('BUG-099: a cover that cannot be fetched still reads the slides', async () => {
  const post = await fx.makePost(accountId, {
    imageUrl: fx.freshUrl('dead-cover'),
    additionalImageUrls: [fx.freshUrl('ok1'), fx.freshUrl('ok2')],
  });
  gemini([previewEvent(`Cover Failure ${fx.suffix}`)]);
  fakeImages([fx.freshUrl('dead-cover')]);
  const result = await runPhase2(post.id, noRefresh);
  assert.equal(result.outcome, 'SUCCEEDED');
  const data = (result as any).resultData as ReextractionPreviewResult;
  assert.equal(data.imagesAvailable, 3);
  assert.equal(data.imagesSent, 2, 'the two slides were read, the cover was lost');
  assert.deepEqual(data.images, [
    { position: 0, role: 'COVER', state: 'NOT_READ_UNAVAILABLE' },
    { position: 1, role: 'SLIDE', state: 'READ' },
    { position: 2, role: 'SLIDE', state: 'READ' },
  ], 'a cover whose link has not expired but that answered an error is unavailable, not expired');
});

test('a refresh that was due but did not happen ends SUCCEEDED_WITH_LIMITS with its reason and a plain message; the preview still ran', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c'), additionalImageUrls: [] });
  gemini([previewEvent(`Limits ${fx.suffix}`)]);
  fakeImages([fx.expiredUrl('c')]);
  const cooldown: ReextractRefreshReport = { outcome: 'COOLDOWN', reasons: ['COVER_EXPIRED'], saved: false, lateResultPending: false, retryAfter: new Date(Date.now() + 300_000).toISOString(), expiredLinks: 1 };
  const result = await runPhase2(post.id, cooldown);
  assert.equal(result.outcome, 'SUCCEEDED_WITH_LIMITS');
  assert.equal((result as any).reasonCode, 'COOLDOWN');
  assert.match((result as any).errorMessage, /less than 10 minutes/);
  const data = (result as any).resultData as ReextractionPreviewResult;
  assert.equal(data.rescraped, false);
  assert.equal(data.imagesAvailable, 1);
  assert.equal(data.imagesSent, 0, 'the expired cover could not be read: the shortfall is reported, not hidden');
  assert.deepEqual(data.images, [{ position: 0, role: 'COVER', state: 'NOT_READ_EXPIRED' }], 'its own link has expired');
  assert.deepEqual(data.refresh, cooldown);
  assert.equal(data.events.length, 1);
});

test('Story 10.6a: a carousel longer than the cap lists the slides beyond it as not sent, and the entries add up to imagesAvailable', async () => {
  const slides = Array.from({ length: 12 }, (_, i) => fx.freshUrl(`long-${i}`));
  slides[2] = fx.expiredUrl('long-dead');
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('long-cover'), additionalImageUrls: slides });
  gemini([previewEvent(`Over Cap ${fx.suffix}`)]);
  const fetched = fakeImages([fx.expiredUrl('long-dead')]);
  const result = await runPhase2(post.id, noRefresh);
  const data = (result as any).resultData as ReextractionPreviewResult;
  assert.equal(data.imagesAvailable, 13);
  assert.equal(data.images!.length, 13);
  assert.equal(data.images!.filter((image) => image.state === 'READ').length, data.imagesSent);
  assert.equal(data.imagesSent, 10, 'the cover and nine slides');
  assert.deepEqual(data.images!.filter((image) => image.state !== 'READ'), [
    { position: 3, role: 'SLIDE', state: 'NOT_READ_EXPIRED' },
    { position: 11, role: 'SLIDE', state: 'NOT_SENT_OVER_CAP' },
    { position: 12, role: 'SLIDE', state: 'NOT_SENT_OVER_CAP' },
  ]);
  assert.equal(data.imageCap, 10);
  assert.equal(fetched.length, 11, 'the cover and the ten slides of the cap: the two beyond it are never fetched');
});

test('Story 10.6 review: a provider that answered but healed nothing while links stay expired ends SUCCEEDED_WITH_LIMITS with a reason (FR117)', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c'), additionalImageUrls: [] });
  gemini([previewEvent(`Not Healed ${fx.suffix}`)]);
  fakeImages([fx.expiredUrl('c')]);
  const unhealed: ReextractRefreshReport = { outcome: 'REFRESHED', reasons: ['COVER_EXPIRED'], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 1 };
  const result = await runPhase2(post.id, unhealed);
  assert.equal(result.outcome, 'SUCCEEDED_WITH_LIMITS');
  assert.equal((result as any).reasonCode, 'REFRESH_DID_NOT_HEAL_IMAGES');
  assert.match((result as any).errorMessage, /no usable fresh images/);
  assert.deepEqual(((result as any).resultData as ReextractionPreviewResult).refresh, unhealed, 'the report is kept in the result');
});

test('a job with no refresh report (never expected) is treated as "no refresh was needed"', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [] });
  gemini([previewEvent(`No Report ${fx.suffix}`)]);
  fakeImages();
  const result = await runPhase2(post.id, null);
  assert.equal(result.outcome, 'SUCCEEDED');
  assert.equal(((result as any).resultData as ReextractionPreviewResult).refresh?.outcome, 'NOT_NEEDED');
});

test('no Gemini key left (the moderator\'s and the account subscribers\') fails the job with the QUOTA_EXHAUSTED meaning and a plain message', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [] });
  setCallGeminiForManualExtractionSeam(async () => {
    throw new AiGatewayExhaustedError('no key');
  });
  fakeImages();
  const result = await runPhase2(post.id, noRefresh);
  assert.deepEqual(result, { outcome: 'FAILED', reasonCode: 'QUOTA_EXHAUSTED', errorMessage: 'No available Gemini API key to perform this extraction.', resultData: { refresh: noRefresh } });
});

test('a model answer that is not valid fails the job EXTRACTION_FAILED, in plain words', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [] });
  setCallGeminiForManualExtractionSeam(async () => ({ text: 'not json' }) as any);
  fakeImages();
  assert.deepEqual(await runPhase2(post.id, noRefresh), { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: 'The extracted content could not be validated.', resultData: { refresh: noRefresh } });
});

test('an unexpected error is rethrown with its NAME only (the raw error could carry the request), for the engine to end HANDLER_ERROR', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.freshUrl('c'), additionalImageUrls: [] });
  setCallGeminiForManualExtractionSeam(async () => {
    throw new Error('provider exploded with https://secret.example/key and the caption text');
  });
  fakeImages();
  await assert.rejects(
    () => runPhase2(post.id, noRefresh),
    (error: Error) => /failed unexpectedly \(Error\)/.test(error.message) && !/exploded|secret|caption/.test(error.message)
  );
});

test('a post that was deleted, or whose caption was cleared since the start, fails with a plain reason', async () => {
  const noCaption = await fx.makePost(accountId, { content: null });
  assert.deepEqual(await runPhase2(noCaption.id, noRefresh), { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: 'This post has no stored caption to extract from.', resultData: { refresh: noRefresh } });

  const post = await fx.makePost(accountId);
  const gone = await fx.makeJob(post.id, ownerId, { inputKey: `gone-${fx.suffix}`, phase: REEXTRACT_PHASE_PREVIEW, input: { postId: '00000000-0000-4000-8000-0000000000cc' } });
  assert.deepEqual(await reextractPreviewHandler.run(fx.handlerContext(gone).ctx), { outcome: 'FAILED', reasonCode: 'POST_NOT_FOUND', errorMessage: 'Post not found.', resultData: { refresh: noRefresh } });
});

test('a job that reaches the AI-processor in the wrong phase, or with no readable input, fails without calling the model', async () => {
  const post = await fx.makePost(accountId);
  gemini([previewEvent('never')], []);
  setCallGeminiForManualExtractionSeam(async () => assert.fail('the model must not be called'));
  const early = await fx.makeJob(post.id, ownerId, { inputKey: `early-${fx.suffix}`, phase: 'refresh' });
  const earlyResult = await reextractPreviewHandler.run(fx.handlerContext(early).ctx);
  assert.equal(earlyResult.outcome === 'FAILED' && earlyResult.reasonCode, 'HANDLER_ERROR');
  const bad = await fx.makeJob(post.id, ownerId, { inputKey: `badin-${fx.suffix}`, phase: REEXTRACT_PHASE_PREVIEW, input: { nope: 1 } });
  const badResult = await reextractPreviewHandler.run(fx.handlerContext(bad).ctx);
  assert.equal(badResult.outcome === 'FAILED' && badResult.reasonCode, 'HANDLER_ERROR');
});

// ── Owner decision 2026-11-12: the caption of a post that has none stored is HELD on the job between the phases and blanked when phase 2 ends ──

const HELD_CAPTION = 'Held caption: Fun Run on the later slides, held only for phase 2';
const heldInput = (postId: string | null, url = 'https://www.instagram.com/p/heldpost/') => ({
  ...(postId ? { postId } : { url }),
  held: { content: HELD_CAPTION, postUrl: url, publishedAt: '2026-10-01T00:00:00.000Z', imageUrl: fx.freshUrl('held-c'), additionalImageUrls: [fx.freshUrl('held-s')], ownerUsername: 'someone_else' },
});
const inputOf = async (jobId: string) => (await db.select({ input: jobs.input }).from(jobs).where(eq(jobs.id, jobId)))[0].input;

async function runHeld(input: unknown, report: ReextractRefreshReport = refreshed) {
  const job = await fx.makeJob('00000000-0000-4000-8000-0000000000f0', ownerId, { phase: REEXTRACT_PHASE_PREVIEW, input, resultData: { refresh: report }, inputKey: `held-${fx.suffix}-${Math.random()}` });
  const { ctx } = fx.handlerContext(job);
  let result; let thrown: unknown;
  try { result = await reextractPreviewHandler.run(ctx); } catch (error) { thrown = error; }
  return { job, result, thrown, input: await inputOf(job.id) };
}

test('a stored post with NO stored caption previews from the held caption, and the held post is blanked afterwards', async () => {
  const post = await fx.makePost(accountId, { content: null, imageUrl: fx.freshUrl('hc'), additionalImageUrls: [fx.freshUrl('hs')] });
  const requests: any[] = [];
  gemini([previewEvent(`Held Stored ${fx.suffix}`)], requests);
  fakeImages();
  const { result, input } = await runHeld(heldInput(post.id, post.postUrl));
  assert.equal((result as any).outcome, 'SUCCEEDED');
  const data = (result as any).resultData as ReextractionPreviewResult;
  assert.equal(data.postStored, true);
  assert.equal(data.imagesAvailable, 2);
  assert.ok(JSON.stringify(requests[0].contents[0]).includes('Held caption'), 'the held caption reached the model, in memory');
  assert.equal(JSON.stringify(result).includes('Held caption'), false, 'and is not in the job result');
  assert.equal(readHeldPost(input), null, 'blanked');
  assert.deepEqual(input, { postId: post.id }, 'what is left is the identity of the job');
  assert.equal((await fx.readPost(post.id)).content, null, 'never written to the post');
});

test('a URL that is not in the database previews from the held post alone: postStored false, nothing to apply to, held post blanked', async () => {
  gemini([previewEvent(`Held Url ${fx.suffix}`)]);
  const fetched = fakeImages();
  const { result, input } = await runHeld(heldInput(null, 'https://www.instagram.com/p/heldurl/'), { ...refreshed, reasons: ['CAPTION_MISSING'], saved: false });
  assert.equal((result as any).outcome, 'SUCCEEDED');
  const data = (result as any).resultData as ReextractionPreviewResult;
  assert.equal(data.postStored, false);
  assert.equal(data.imagesAvailable, 2, 'the held cover and slide');
  assert.equal(data.imagesSent, 2);
  assert.deepEqual(fetched.sort(), [fx.freshUrl('held-c'), fx.freshUrl('held-s')].sort());
  assert.equal(readHeldPost(input), null);
  assert.deepEqual(input, { url: 'https://www.instagram.com/p/heldurl/' });
});

test('the held post is blanked after a failed extraction, an unexpected throw, and a missing caption', async () => {
  const post = await fx.makePost(accountId, { content: null, imageUrl: fx.freshUrl('f1'), additionalImageUrls: [] });
  fakeImages();

  setCallGeminiForManualExtractionSeam(async () => ({ text: 'not json' }) as any);
  const failedRun = await runHeld(heldInput(post.id, post.postUrl));
  assert.equal((failedRun.result as any).outcome, 'FAILED');
  assert.equal(readHeldPost(failedRun.input), null, 'blanked after a failure');
  assert.equal(JSON.stringify(failedRun.result).includes('Held caption'), false);

  setCallGeminiForManualExtractionSeam(async () => {
    throw new Error(`provider echoed the prompt: ${HELD_CAPTION}`);
  });
  const thrownRun = await runHeld(heldInput(post.id, post.postUrl));
  assert.ok(thrownRun.thrown instanceof Error);
  assert.equal((thrownRun.thrown as Error).message.includes('Held caption'), false, 'the thrown error carries no caption');
  assert.equal(readHeldPost(thrownRun.input), null, 'blanked after a throw');

  const noCaption = await fx.makePost(accountId, { content: null });
  const missing = await runHeld({ postId: noCaption.id });
  assert.deepEqual(missing.result, { outcome: 'FAILED', reasonCode: 'EXTRACTION_FAILED', errorMessage: 'This post has no stored caption to extract from.', resultData: { refresh: refreshed } });
  const urlMissing = await runHeld({ url: 'https://www.instagram.com/p/nothing/' });
  assert.equal((urlMissing.result as any).reasonCode, 'EXTRACTION_FAILED');
});

test('an image-only post: a held EMPTY caption is a caption (the post is still extractable from its images)', async () => {
  gemini([previewEvent(`Held Empty ${fx.suffix}`)]);
  fakeImages();
  const input = heldInput(null, 'https://www.instagram.com/p/imageonly/');
  input.held.content = '';
  const { result } = await runHeld(input);
  assert.equal((result as any).outcome, 'SUCCEEDED');
});

test('no log line carries the held caption, in a run that succeeds and in one that fails', async () => {
  const post = await fx.makePost(accountId, { content: null, imageUrl: fx.freshUrl('lg'), additionalImageUrls: [] });
  const lines: string[] = [];
  const originals = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
  try {
    gemini([previewEvent(`Logged ${fx.suffix}`)]);
    fakeImages();
    await runHeld(heldInput(post.id, post.postUrl));
    setCallGeminiForManualExtractionSeam(async () => {
      throw new Error(`echo ${HELD_CAPTION}`);
    });
    await runHeld(heldInput(post.id, post.postUrl));
  } finally {
    [console.log, console.warn, console.error] = originals;
  }
  assert.equal(lines.some((line) => line.includes('Held caption')), false);
});
