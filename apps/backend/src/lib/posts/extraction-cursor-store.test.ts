import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray, sql } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { EXTRACTION_CURSOR_VERSION, PostAlreadyQueuedError, type ExtractionCursor } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';
import { enqueuePostForProcessing } from './enqueue-post-for-processing.js';
import { markPostExtracted } from './mark-post-extracted.js';
import { withExtractionStatus } from './post-extraction-status.js';
import {
  advanceExtractionCursor,
  finishExtractionChain,
  readExtractionCursor,
  startExtractionCursor,
  takeExtractionLease,
} from './extraction-cursor-store.js';

const suffix = Date.now().toString();

const cursorFor = (postId: string, overrides: Partial<ExtractionCursor> = {}): ExtractionCursor => ({
  version: EXTRACTION_CURSOR_VERSION,
  postId,
  stepCount: 0,
  leaseNonce: 'nonce-0',
  nextSlide: 6,
  totalImages: 14,
  unreadAtStart: 8,
  unreadImageUrls: ['https://cdn.example/6.jpg'],
  nextOrdinal: 26,
  foundKeys: ['jazz night|2027-01-05'],
  groupingReason: 'roundup',
  followUpMade: false,
  emptySteps: 0,
  windowSize: 2,
  requestsMade: 0,
  resumeAttempts: 0,
  rescrapeCount: 0,
  lastRescrapeAt: null,
  itemsPerSlide: 5,
  claimedItemCount: 203,
  ...overrides,
});

test('extraction cursor store (AD-47)', async (t) => {
  const originalSend = sendSqsMessage;
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'cursor-' + suffix, platform: 'instagram', username: 'cursor_' + suffix, displayName: 'Cursor' })
    .returning();
  const postIds: string[] = [];
  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert> = {}) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: tag,
        postUrl: `https://instagram.com/p/cursor_${tag}_${suffix}`,
        publishedAt: new Date(),
        ...values,
      })
      .returning();
    postIds.push(post.id);
    return post;
  };
  const row = async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0];

  t.after(async () => {
    setSendSqsMessage(originalSend);
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('the cursor is stored as a real json object, not a json string (no double encoding)', async () => {
    const post = await makePost('encoding');
    assert.strictEqual(await startExtractionCursor(post.id, cursorFor(post.id)), true);

    const [typed] = await db.execute<{ t: string }>(sql`select jsonb_typeof(extraction_cursor) as t from posts where id = ${post.id}`);
    assert.strictEqual(typed.t, 'object');
    assert.deepStrictEqual(await readExtractionCursor(post.id), cursorFor(post.id));
  });

  await t.test('start refuses a post that already has a cursor or is already extracted', async () => {
    const post = await makePost('start-twice');
    assert.strictEqual(await startExtractionCursor(post.id, cursorFor(post.id)), true);
    assert.strictEqual(await startExtractionCursor(post.id, cursorFor(post.id, { stepCount: 5 })), false);
    assert.strictEqual((await readExtractionCursor(post.id))?.stepCount, 0);

    const done = await makePost('start-extracted', { isExtracted: true });
    assert.strictEqual(await startExtractionCursor(done.id, cursorFor(done.id)), false);
  });

  await t.test('advance is a compare-and-set on (step count, lease nonce): a stale writer changes nothing', async () => {
    const post = await makePost('advance');
    await startExtractionCursor(post.id, cursorFor(post.id));

    assert.strictEqual(await advanceExtractionCursor(post.id, { stepCount: 0, leaseNonce: 'nonce-0' }, cursorFor(post.id, { stepCount: 1, nextSlide: 8 })), true);
    // The same expected lease again (a redelivered duplicate): nothing changes.
    assert.strictEqual(await advanceExtractionCursor(post.id, { stepCount: 0, leaseNonce: 'nonce-0' }, cursorFor(post.id, { stepCount: 1, nextSlide: 99 })), false);
    // Right step count, wrong nonce.
    assert.strictEqual(await advanceExtractionCursor(post.id, { stepCount: 1, leaseNonce: 'other' }, cursorFor(post.id, { stepCount: 2 })), false);
    const stored = await readExtractionCursor(post.id);
    assert.strictEqual(stored?.stepCount, 1);
    assert.strictEqual(stored?.nextSlide, 8);
  });

  await t.test('advance does nothing for a post with no cursor or one already extracted', async () => {
    const post = await makePost('advance-none');
    assert.strictEqual(await advanceExtractionCursor(post.id, { stepCount: 0, leaseNonce: 'nonce-0' }, cursorFor(post.id)), false);
    assert.strictEqual((await row(post.id)).extractionCursor, null);
  });

  await t.test('the lease is taken by swapping the nonce, never the step count; a second taker with the old nonce loses', async () => {
    const post = await makePost('lease');
    await startExtractionCursor(post.id, cursorFor(post.id, { stepCount: 3 }));

    const taken = await takeExtractionLease(post.id, { stepCount: 3, leaseNonce: 'nonce-0' }, 'nonce-1');
    assert.strictEqual(taken?.leaseNonce, 'nonce-1');
    assert.strictEqual(taken?.stepCount, 3);

    assert.strictEqual(await takeExtractionLease(post.id, { stepCount: 3, leaseNonce: 'nonce-0' }, 'nonce-2'), null, 'the old nonce no longer matches');
    assert.strictEqual(await takeExtractionLease(post.id, { stepCount: 2, leaseNonce: 'nonce-1' }, 'nonce-2'), null, 'an older step count loses');
    assert.strictEqual((await readExtractionCursor(post.id))?.leaseNonce, 'nonce-1');
    assert.strictEqual(await takeExtractionLease('00000000-0000-4000-8000-00000000cccc', { stepCount: 0, leaseNonce: 'x' }, 'y'), null, 'no cursor, no lease');
  });

  await t.test('a stored value that is not a well-formed cursor reads as none', async (st) => {
    st.mock.method(console, 'error', () => {});
    const post = await makePost('garbage');
    await db.update(posts).set({ extractionCursor: sql`'{"version":1}'::jsonb` }).where(eq(posts.id, post.id));
    assert.strictEqual(await readExtractionCursor(post.id), null);
    assert.strictEqual(await readExtractionCursor('00000000-0000-4000-8000-00000000cccd'), null);
  });

  await t.test('finishing a chain is one atomic stop: cursor null, extracted, partial per outcome, ledger clean', async () => {
    const clean = await makePost('finish-clean', { extractionAttempts: 2, extractionFailureReason: 'unavailable' });
    await startExtractionCursor(clean.id, cursorFor(clean.id));
    assert.strictEqual(await finishExtractionChain(clean.id, { stepCount: 0, leaseNonce: 'nonce-0' }, { partial: false }), true);
    let r = await row(clean.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial, r.extractionAttempts, r.extractionFailureReason], [true, null, false, 0, null]);

    const partial = await makePost('finish-partial');
    await startExtractionCursor(partial.id, cursorFor(partial.id));
    assert.strictEqual(await finishExtractionChain(partial.id, { stepCount: 0, leaseNonce: 'nonce-0' }, { partial: true }), true);
    r = await row(partial.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);

    assert.strictEqual(await finishExtractionChain(partial.id, { stepCount: 0, leaseNonce: 'nonce-0' }, { partial: false }), false, 'already extracted: nothing to stop');
    assert.strictEqual((await row(partial.id)).extractionPartial, true, 'the second call changed nothing');
  });

  await t.test('a stale lease cannot end a chain', async () => {
    const post = await makePost('finish-stale');
    await startExtractionCursor(post.id, cursorFor(post.id, { stepCount: 4, leaseNonce: 'current' }));
    assert.strictEqual(await finishExtractionChain(post.id, { stepCount: 3, leaseNonce: 'current' }, { partial: true }), false);
    assert.strictEqual(await finishExtractionChain(post.id, { stepCount: 4, leaseNonce: 'old' }, { partial: true }), false);
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionPartial], [false, false]);
    assert.notStrictEqual(r.extractionCursor, null);
  });

  await t.test('advance refuses a cursor for another post or one that moves the step count backwards', async () => {
    const post = await makePost('advance-guard');
    await startExtractionCursor(post.id, cursorFor(post.id, { stepCount: 2 }));
    assert.strictEqual(await advanceExtractionCursor(post.id, { stepCount: 2, leaseNonce: 'nonce-0' }, cursorFor('another-post', { stepCount: 3 })), false);
    assert.strictEqual(await advanceExtractionCursor(post.id, { stepCount: 2, leaseNonce: 'nonce-0' }, cursorFor(post.id, { stepCount: 1 })), false);
    assert.strictEqual((await readExtractionCursor(post.id))?.stepCount, 2);
  });

  await t.test('taking the lease with the nonce it already has is refused', async () => {
    const post = await makePost('lease-same');
    await startExtractionCursor(post.id, cursorFor(post.id));
    assert.strictEqual(await takeExtractionLease(post.id, { stepCount: 0, leaseNonce: 'nonce-0' }, 'nonce-0'), null);
  });

  await t.test('a NUL character in a dedupe key (model output) is stripped instead of failing the commit', async () => {
    const post = await makePost('nul');
    assert.strictEqual(await startExtractionCursor(post.id, cursorFor(post.id, { foundKeys: ['bad\u0000name|2027-01-01'] })), true);
    assert.deepStrictEqual((await readExtractionCursor(post.id))?.foundKeys, ['badname|2027-01-01']);
  });

  await t.test('starting a chain clears a leftover partial flag from an earlier run', async () => {
    const post = await makePost('restart', { extractionPartial: true });
    await startExtractionCursor(post.id, cursorFor(post.id));
    assert.strictEqual((await row(post.id)).extractionPartial, false);
  });

  await t.test('a post holding a cursor is EXTRACTING whatever its claim age (the SQL and the domain rule agree)', async () => {
    const post = await makePost('status', { queuedForExtractionAt: new Date(Date.now() - 24 * 3600_000) });
    await startExtractionCursor(post.id, cursorFor(post.id));
    const [withStatus] = await withExtractionStatus([await row(post.id)], 30);
    assert.strictEqual(withStatus.extractionStatus, 'EXTRACTING');
  });

  await t.test('a cursor is a claim of any age: enqueueing refuses the post (AD-47 Rule 5a)', async () => {
    setSendSqsMessage(async () => {});
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';
    const post = await makePost('claimed', { queuedForExtractionAt: new Date(Date.now() - 24 * 3600_000) });
    await startExtractionCursor(post.id, cursorFor(post.id));
    await assert.rejects(() => enqueuePostForProcessing(post.id), PostAlreadyQueuedError);
    await assert.rejects(() => enqueuePostForProcessing(post.id, { resetLedger: true }), PostAlreadyQueuedError);
    assert.notStrictEqual((await row(post.id)).extractionCursor, null);
  });

  await t.test('marking a post extracted leaves a chain cursor alone (only the lease holder ends a chain)', async () => {
    const post = await makePost('mark');
    await startExtractionCursor(post.id, cursorFor(post.id));
    await markPostExtracted(post.id);
    assert.notStrictEqual((await row(post.id)).extractionCursor, null);
  });
});
