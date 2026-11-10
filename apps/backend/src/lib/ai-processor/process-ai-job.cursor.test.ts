import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { EXTRACTION_CURSOR_VERSION, type ExtractionCursor, type ProcessingJobMessage } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';
import { readExtractionCursor, startExtractionCursor } from '../posts/extraction-cursor-store.js';
import { callGeminiSeam, markPostExtractedSeam, processAiJob, setCallGeminiSeam, setMarkPostExtractedSeam } from './process-ai-job.js';

// AD-46..AD-51 (slice 5): the first request starts a chain, and a step message runs one window of it.

process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';
process.env.BLUR_FACES_BEFORE_AI = 'false';
const INGESTION_QUEUE = 'https://sqs.mock/ingestion';
const AI_QUEUE = 'https://sqs.mock/ai';

const suffix = Date.now().toString();
const PNG_1X1 = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
);
const slideUrls = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `https://cdn.example/${suffix}/slide-${from + i}.jpg`);

const event = (name: string, date: string) => ({
  eventName: name,
  types: ['PERFORMANCE'],
  categories: ['MUSIC'],
  schedules: [{ isMainSchedule: true, eventStartDate: date }],
  confidenceScore: 0.9,
});
const roundup = (events: unknown[]) => JSON.stringify({ isEvent: true, events, groupingReason: 'roundup' });

const cursorFor = (postId: string, overrides: Partial<ExtractionCursor> = {}): ExtractionCursor => ({
  version: EXTRACTION_CURSOR_VERSION,
  postId,
  stepCount: 0,
  leaseNonce: 'nonce-0',
  nextSlide: 6,
  totalImages: 12,
  unreadAtStart: 6,
  unreadImageUrls: slideUrls(6, 6),
  nextOrdinal: 3,
  foundKeys: ['early|2027-01-01', 'mid|2027-01-02', 'late|2027-01-03'],
  groupingReason: 'roundup',
  followUpMade: false,
  emptySteps: 0,
  windowSize: 2,
  requestsMade: 0,
  resumeAttempts: 0,
  rescrapeCount: 0,
  lastRescrapeAt: null,
  itemsPerSlide: 1,
  claimedItemCount: null,
  ...overrides,
});

test('stepped extraction: first request and steps (AD-46..AD-51)', async (t) => {
  const originalSend = sendSqsMessage;
  const originalGemini = callGeminiSeam;
  const originalMark = markPostExtractedSeam;
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    flag: process.env.CURSOR_EXTRACTION_ENABLED,
    ingest: process.env.DATA_INGESTION_QUEUE_URL,
    ai: process.env.AI_PROCESSING_QUEUE_URL,
  };
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'chain-' + suffix, platform: 'instagram', username: 'chain_' + suffix, displayName: 'Chain' })
    .returning();
  const postIds: string[] = [];
  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert> = {}) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: `caption ${tag}`,
        postUrl: `https://instagram.com/p/chain_${tag}_${suffix}`,
        publishedAt: new Date('2026-11-01T00:00:00Z'),
        imageUrl: `https://cdn.example/${suffix}/cover-${tag}.jpg`,
        ...values,
      })
      .returning();
    postIds.push(post.id);
    return post;
  };
  const row = async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0];

  let ingested: any[] = [];
  let aiMessages: Array<{ body: any; delaySeconds?: number }> = [];
  let geminiCalls: Array<{ imageParts: number }> = [];

  t.beforeEach(() => {
    process.env.CURSOR_EXTRACTION_ENABLED = 'true';
    process.env.DATA_INGESTION_QUEUE_URL = INGESTION_QUEUE;
    process.env.AI_PROCESSING_QUEUE_URL = AI_QUEUE;
    ingested = [];
    aiMessages = [];
    geminiCalls = [];
    // Every slide and cover download answers with a tiny real image, so slides count as read.
    globalThis.fetch = (async () =>
      new Response(PNG_1X1, { status: 200, headers: { 'content-type': 'image/png' } })) as typeof fetch;
    setSendSqsMessage(async (queueUrl, body, options) => {
      if (queueUrl === INGESTION_QUEUE) ingested.push(JSON.parse(body));
      else if (queueUrl === AI_QUEUE) aiMessages.push({ body: JSON.parse(body), delaySeconds: options?.delaySeconds });
    });
    t.mock.method(console, 'info', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'error', () => {});
  });

  t.after(async () => {
    setSendSqsMessage(originalSend);
    setCallGeminiSeam(originalGemini);
    setMarkPostExtractedSeam(originalMark);
    globalThis.fetch = originalFetch;
    for (const [key, value] of [
      ['CURSOR_EXTRACTION_ENABLED', originalEnv.flag],
      ['DATA_INGESTION_QUEUE_URL', originalEnv.ingest],
      ['AI_PROCESSING_QUEUE_URL', originalEnv.ai],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  const stepMessage = (post: { id: string; postUrl: string }, cursor: ExtractionCursor): ProcessingJobMessage => ({
    postId: post.id,
    accountId: profile.id,
    content: '',
    postUrl: post.postUrl,
    publishedAt: '2026-11-01T00:00:00.000Z',
    cursor,
  });

  const gemini = (...answers: Array<{ text: string; finishReason?: string; outputTokens?: number }>) => {
    let i = 0;
    setCallGeminiSeam(async (request: any) => {
      geminiCalls.push({ imageParts: Array.isArray(request.contents) ? request.contents.length - 1 : 0 });
      const answer = answers[Math.min(i++, answers.length - 1)];
      return { text: answer.text, finishReason: answer.finishReason ?? 'STOP', usage: { promptTokens: 100, outputTokens: answer.outputTokens ?? 50 } };
    });
  };

  await t.test('the first request of a roundup with unread slides starts a chain instead of finishing the post', async () => {
    const post = await makePost('first');
    setMarkPostExtractedSeam(async () => {
      throw new Error('the post must not be marked extracted while a chain is running');
    });
    gemini({ text: roundup([event('Early', '2027-01-01'), event('Mid', '2027-01-02'), event('Late', '2027-01-03')]) });

    await processAiJob({
      postId: post.id,
      accountId: profile.id,
      content: 'caption first',
      imageUrl: post.imageUrl!,
      additionalImageUrls: slideUrls(11),
      postUrl: post.postUrl,
      publishedAt: '2026-11-01T00:00:00.000Z',
    });

    assert.strictEqual(ingested.length, 3, 'the first request still ingests its events');
    assert.deepStrictEqual(ingested.map((e) => e.extractionOrdinal).sort(), [0, 1, 2]);
    const stored = await readExtractionCursor(post.id);
    assert.ok(stored, 'a cursor is persisted');
    assert.strictEqual(stored.nextOrdinal, 3);
    assert.strictEqual(stored.foundKeys.length, 3);
    assert.strictEqual(stored.unreadImageUrls.length, 6, '12 images minus the cover and the first 5 slides');
    assert.strictEqual(stored.groupingReason, 'roundup');
    assert.strictEqual(aiMessages.length, 1, 'the first step is enqueued');
    assert.strictEqual(aiMessages[0].delaySeconds, 10);
    assert.strictEqual(aiMessages[0].body.content, '', 'a step message never carries the caption');
    assert.strictEqual(aiMessages[0].body.cursor.leaseNonce, stored.leaseNonce);
    const r = await row(post.id);
    assert.strictEqual(r.isExtracted, false);
    assert.strictEqual(r.extractionPartial, false);
  });

  await t.test('with the switch off, the same post takes the one-request path and finishes', async () => {
    process.env.CURSOR_EXTRACTION_ENABLED = 'false';
    const post = await makePost('off');
    let marked = false;
    setMarkPostExtractedSeam(async () => {
      marked = true;
      return {} as any;
    });
    gemini({ text: roundup([event('Early', '2027-01-01')]) });

    await processAiJob({
      postId: post.id,
      accountId: profile.id,
      content: 'caption off',
      imageUrl: post.imageUrl!,
      additionalImageUrls: slideUrls(11),
      postUrl: post.postUrl,
      publishedAt: '2026-11-01T00:00:00.000Z',
    });

    assert.ok(marked);
    assert.strictEqual(await readExtractionCursor(post.id), null);
    assert.strictEqual(aiMessages.length, 0);
  });

  await t.test('a step ingests only the new events with ordinals from the cursor, commits, and enqueues the next step', async () => {
    const post = await makePost('step');
    await startExtractionCursor(post.id, cursorFor(post.id));
    gemini({ text: roundup([event('Mid', '2027-01-02'), event('Fresh One', '2027-02-01'), event('Fresh Two', '2027-02-02')]) });

    await processAiJob(stepMessage(post, cursorFor(post.id)));

    assert.strictEqual(ingested.length, 2, 'the event an earlier step found is not ingested again');
    assert.deepStrictEqual(ingested.map((e) => [e.eventName, e.extractionOrdinal]).sort(), [['Fresh One', 3], ['Fresh Two', 4]]);
    const stored = await readExtractionCursor(post.id);
    assert.ok(stored);
    assert.strictEqual(stored.stepCount, 1);
    assert.strictEqual(stored.nextSlide, 8);
    assert.strictEqual(stored.unreadImageUrls.length, 4);
    assert.strictEqual(stored.nextOrdinal, 5);
    assert.strictEqual(stored.foundKeys.length, 5);
    assert.strictEqual(stored.requestsMade, 1);
    assert.notStrictEqual(stored.leaseNonce, 'nonce-0', 'the lease moved to this step');
    assert.strictEqual(aiMessages.length, 1);
    assert.strictEqual(aiMessages[0].body.cursor.stepCount, 1);
    assert.strictEqual(aiMessages[0].body.content, '');
    assert.strictEqual((await row(post.id)).extractedEventCount, 2);
  });

  await t.test('the last step ends the chain atomically: extracted, cursor cleared, not partial, curator caption kept readable until then', async () => {
    const post = await makePost('last');
    await startExtractionCursor(post.id, cursorFor(post.id, { unreadImageUrls: slideUrls(2, 10), nextSlide: 10, unreadAtStart: 2 }));
    gemini({ text: roundup([event('Last One', '2027-03-01')]) });

    await processAiJob(stepMessage(post, cursorFor(post.id, { unreadImageUrls: slideUrls(2, 10), nextSlide: 10, unreadAtStart: 2 })));

    assert.strictEqual(ingested.length, 1);
    assert.strictEqual(aiMessages.length, 0, 'no further step');
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, false]);
  });

  await t.test('a stale or duplicate step message changes nothing', async () => {
    const post = await makePost('stale');
    await startExtractionCursor(post.id, cursorFor(post.id));
    gemini({ text: roundup([event('X', '2027-05-01')]) });

    await processAiJob(stepMessage(post, cursorFor(post.id, { leaseNonce: 'someone-else' })));
    await processAiJob(stepMessage(post, cursorFor(post.id, { stepCount: 7 })));

    assert.strictEqual(ingested.length, 0);
    assert.strictEqual(geminiCalls.length, 0);
    assert.strictEqual((await readExtractionCursor(post.id))?.stepCount, 0);
  });

  await t.test('redelivering the same step after it committed is dropped (no duplicate events)', async () => {
    const post = await makePost('redelivered');
    await startExtractionCursor(post.id, cursorFor(post.id));
    gemini({ text: roundup([event('Fresh', '2027-02-01')]) });
    await processAiJob(stepMessage(post, cursorFor(post.id)));
    assert.strictEqual(ingested.length, 1);

    await processAiJob(stepMessage(post, cursorFor(post.id)));

    assert.strictEqual(ingested.length, 1, 'the second copy is stale');
  });

  await t.test('with the switch off a step ends the chain, flagged partial', async () => {
    process.env.CURSOR_EXTRACTION_ENABLED = 'false';
    const post = await makePost('killed');
    await startExtractionCursor(post.id, cursorFor(post.id));

    await processAiJob(stepMessage(post, cursorFor(post.id)));

    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    assert.strictEqual(geminiCalls.length, 0);
  });

  await t.test('a step stops at the request bound: the chain ends partial without calling Gemini', async () => {
    const post = await makePost('bound');
    const atBound = cursorFor(post.id, { unreadAtStart: 2, requestsMade: 4 });
    await startExtractionCursor(post.id, atBound);

    await processAiJob(stepMessage(post, atBound));

    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    assert.strictEqual(geminiCalls.length, 0);
  });

  await t.test('an answer cut off at the token limit is split in half and each half retried (AD-49), every request counted', async () => {
    const post = await makePost('split');
    await startExtractionCursor(post.id, cursorFor(post.id));
    gemini(
      { text: '{"isEvent": true, "events": [', finishReason: 'MAX_TOKENS', outputTokens: 8192 },
      { text: roundup([event('Half One', '2027-04-01')]) },
      { text: roundup([event('Half Two', '2027-04-02')]) }
    );

    await processAiJob(stepMessage(post, cursorFor(post.id)));

    assert.strictEqual(geminiCalls.length, 3, 'the whole window, then each half');
    assert.deepStrictEqual(ingested.map((e) => e.eventName).sort(), ['Half One', 'Half Two']);
    const stored = await readExtractionCursor(post.id);
    assert.strictEqual(stored?.requestsMade, 3);
    assert.strictEqual(stored?.nextSlide, 8, 'the window of two slides is read once, not twice');
  });

  await t.test('a lineup post gets one follow-up for the remaining slides and then ends (partial only when slides remain)', async () => {
    const post = await makePost('lineup');
    const lineup = cursorFor(post.id, { groupingReason: 'program-lineup', followUpMade: true, windowSize: 6 });
    await startExtractionCursor(post.id, lineup);
    gemini({ text: JSON.stringify({ isEvent: true, events: [event('Festival', '2027-06-01')], groupingReason: 'program-lineup' }) });

    await processAiJob(stepMessage(post, lineup));

    assert.strictEqual(geminiCalls.length, 1, 'one request for all the remaining slides');
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, false]);
    assert.strictEqual(aiMessages.length, 0);
  });

  await t.test('a first request that stops with slides unread flags the post partial after finishing it', async () => {
    const post = await makePost('first-partial');
    let marked = false;
    setMarkPostExtractedSeam(async (id) => {
      marked = true;
      return (await db.update(posts).set({ isExtracted: true }).where(eq(posts.id, id)).returning())[0] as any;
    });
    // No label from the model: the continue rules stop ("any other state"), partial because slides were left unread.
    gemini({ text: JSON.stringify({ isEvent: true, events: [event('Solo', '2027-01-01')] }) });

    await processAiJob({
      postId: post.id,
      accountId: profile.id,
      content: 'caption',
      imageUrl: post.imageUrl!,
      additionalImageUrls: slideUrls(11),
      postUrl: post.postUrl,
      publishedAt: '2026-11-01T00:00:00.000Z',
    });

    assert.ok(marked);
    assert.strictEqual((await row(post.id)).extractionPartial, true);
    assert.strictEqual(aiMessages.length, 0);
  });

  await t.test('a slide that cannot be downloaded counts as read but makes the chain partial', async () => {
    const post = await makePost('missing-slide');
    const last = cursorFor(post.id, { unreadImageUrls: slideUrls(2, 10), nextSlide: 10, unreadAtStart: 2 });
    await startExtractionCursor(post.id, last);
    globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
    gemini({ text: roundup([event('Only Text', '2027-03-01')]) });

    await processAiJob(stepMessage(post, last));

    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
  });

  await t.test('a half that cannot run after a split keeps the half that finished and ends the chain partial', async () => {
    const post = await makePost('half-bound');
    // Room for exactly two requests after the first: the whole window, then the first half; the second half hits the bound.
    const tight = cursorFor(post.id, { unreadAtStart: 1, requestsMade: 0 });
    await startExtractionCursor(post.id, tight);
    gemini(
      { text: '{"isEvent": true, "events": [', finishReason: 'MAX_TOKENS', outputTokens: 8192 },
      { text: roundup([event('Kept Half', '2027-04-01')]) },
      { text: roundup([event('Never Asked', '2027-04-02')]) }
    );

    await processAiJob(stepMessage(post, tight));

    assert.deepStrictEqual(ingested.map((e) => e.eventName), ['Kept Half'], 'the finished half is ingested, not discarded');
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionPartial], [true, true]);
  });

  await t.test('a redelivered first request whose chain already started re-enqueues the stored step instead of finishing the post', async () => {
    const post = await makePost('redelivered-first');
    await startExtractionCursor(post.id, cursorFor(post.id));
    setMarkPostExtractedSeam(async () => {
      throw new Error('the post must not be marked extracted while a chain exists');
    });
    gemini({ text: roundup([event('Early', '2027-01-01')]) });

    await processAiJob({
      postId: post.id,
      accountId: profile.id,
      content: 'caption',
      imageUrl: post.imageUrl!,
      additionalImageUrls: slideUrls(11),
      postUrl: post.postUrl,
      publishedAt: '2026-11-01T00:00:00.000Z',
    });

    assert.strictEqual(aiMessages.length, 1);
    assert.strictEqual(aiMessages[0].body.cursor.leaseNonce, 'nonce-0', 'the stored cursor, not a new chain');
    assert.strictEqual((await row(post.id)).isExtracted, false);
  });

  await t.test('a step for a post that finished elsewhere clears the cursor left on it', async () => {
    const post = await makePost('finished-elsewhere');
    await startExtractionCursor(post.id, cursorFor(post.id));
    await db.update(posts).set({ isExtracted: true }).where(eq(posts.id, post.id));

    await processAiJob(stepMessage(post, cursorFor(post.id)));

    assert.strictEqual((await row(post.id)).extractionCursor, null);
    assert.strictEqual(geminiCalls.length, 0);
  });

  await t.test('a first request that finds nothing (not an event, or no events) continues in steps while slides are unread', async () => {
    for (const [tag, answer] of [
      ['empty-not-event', JSON.stringify({ isEvent: false, events: [], groupingReason: 'single-event' })],
      ['empty-zero-events', JSON.stringify({ isEvent: true, events: [], groupingReason: 'roundup' })],
    ] as const) {
      aiMessages = [];
      const post = await makePost(tag);
      setMarkPostExtractedSeam(async () => {
        throw new Error('the post must not be marked extracted while its chain runs');
      });
      gemini({ text: answer });

      await processAiJob({
        postId: post.id,
        accountId: profile.id,
        content: 'caption',
        imageUrl: post.imageUrl!,
        additionalImageUrls: slideUrls(11),
        postUrl: post.postUrl,
        publishedAt: '2026-11-01T00:00:00.000Z',
      });

      const stored = await readExtractionCursor(post.id);
      assert.ok(stored, tag);
      assert.strictEqual(stored.groupingReason, null, `${tag}: a neutral label of an empty first window is not kept`);
      assert.strictEqual(stored.emptySteps, 1, `${tag}: the first window counts as one empty step`);
      assert.strictEqual(stored.foundKeys.length, 0);
      assert.strictEqual(stored.nextOrdinal, 0);
      assert.strictEqual(aiMessages.length, 1, tag);
      assert.strictEqual((await row(post.id)).isExtracted, false);
    }
  });

  await t.test('a post with nothing found and no slides unread still finishes at once as a non-event', async () => {
    const post = await makePost('empty-no-unread');
    let marked = false;
    setMarkPostExtractedSeam(async () => {
      marked = true;
      return {} as any;
    });
    gemini({ text: JSON.stringify({ isEvent: false, events: [], groupingReason: 'single-event' }) });

    await processAiJob({
      postId: post.id,
      accountId: profile.id,
      content: 'caption',
      imageUrl: post.imageUrl!,
      additionalImageUrls: slideUrls(3),
      postUrl: post.postUrl,
      publishedAt: '2026-11-01T00:00:00.000Z',
    });

    assert.ok(marked);
    assert.strictEqual(await readExtractionCursor(post.id), null);
    assert.strictEqual(aiMessages.length, 0);
  });

  await t.test('a step finding events after an empty first window adopts the label it gives, so a roundup goes on', async () => {
    const post = await makePost('adopts-label');
    const empty = cursorFor(post.id, { groupingReason: null, foundKeys: [], nextOrdinal: 0, emptySteps: 1 });
    await startExtractionCursor(post.id, empty);
    gemini({ text: roundup([event('One', '2027-01-01'), event('Two', '2027-01-02')]) });

    await processAiJob(stepMessage(post, empty));

    const stored = await readExtractionCursor(post.id);
    assert.strictEqual(stored?.groupingReason, 'roundup');
    assert.strictEqual(aiMessages.length, 1, 'the chain goes on instead of stopping at the first events');
    assert.deepStrictEqual(ingested.map((e) => e.extractionOrdinal).sort(), [0, 1]);
  });

  await t.test('two empty steps in a row end the chain without flagging it partial (nothing was there to find)', async () => {
    const post = await makePost('two-empty');
    const second = cursorFor(post.id, { groupingReason: null, foundKeys: [], nextOrdinal: 0, emptySteps: 1 });
    await startExtractionCursor(post.id, second);
    gemini({ text: JSON.stringify({ isEvent: false, events: [], groupingReason: 'single-event' }) });

    await processAiJob(stepMessage(post, second));

    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, false]);
    assert.strictEqual(aiMessages.length, 0);
  });
});
