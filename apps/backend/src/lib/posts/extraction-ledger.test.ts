import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { EXTRACTION_MAX_ATTEMPTS, EXTRACTION_RETRY_BACKOFF_MINUTES } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';
import { enqueuePostForProcessing } from './enqueue-post-for-processing.js';
import { markPostExtracted } from './mark-post-extracted.js';
import { recordExtractionFailure } from './extraction-ledger.js';

const suffix = Date.now().toString();

test('extraction ledger (AD-52 Rule 4)', async (t) => {
  const originalSend = sendSqsMessage;
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'ledger-' + suffix, platform: 'instagram', username: 'ledger_' + suffix, displayName: 'Ledger' })
    .returning();
  const postIds: string[] = [];
  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert> = {}) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: tag,
        postUrl: `https://instagram.com/p/ledger_${tag}_${suffix}`,
        publishedAt: new Date(),
        ...values,
      })
      .returning();
    postIds.push(post.id);
    return post;
  };
  const read = async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0];

  t.after(async () => {
    setSendSqsMessage(originalSend);
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('the first failure records attempts, reason, first failure and a next attempt, and releases the claim', async (st) => {
    st.mock.method(console, 'info', () => {});
    const now = new Date('2026-11-10T10:00:00.000Z');
    const post = await makePost('first', { queuedForExtractionAt: now, extractionStartedAt: now });

    const plan = await recordExtractionFailure({ postId: post.id, situation: 'unavailable', hint: { random: () => 0.5 }, now });

    assert.ok(plan);
    const row = await read(post.id);
    assert.strictEqual(row.extractionAttempts, 1);
    assert.strictEqual(row.extractionFailureReason, 'unavailable');
    assert.strictEqual(row.extractionFirstFailureAt?.getTime(), now.getTime());
    assert.strictEqual(row.extractionNextAttemptAt?.getTime(), now.getTime() + EXTRACTION_RETRY_BACKOFF_MINUTES[0] * 60_000);
    assert.strictEqual(row.queuedForExtractionAt, null, 'the claim is released so the status reads as failed at once');
    assert.strictEqual(row.isExtracted, false);
  });

  await t.test('a second failure increments the attempts and keeps the first failure time', async (st) => {
    st.mock.method(console, 'info', () => {});
    const first = new Date('2026-11-10T10:00:00.000Z');
    const later = new Date('2026-11-10T10:30:00.000Z');
    const post = await makePost('second');
    await recordExtractionFailure({ postId: post.id, situation: 'unavailable', hint: { random: () => 0.5 }, now: first });
    await recordExtractionFailure({ postId: post.id, situation: 'unavailable', hint: { random: () => 0.5 }, now: later });

    const row = await read(post.id);
    assert.strictEqual(row.extractionAttempts, 2);
    assert.strictEqual(row.extractionFirstFailureAt?.getTime(), first.getTime());
    assert.strictEqual(row.extractionNextAttemptAt?.getTime(), later.getTime() + EXTRACTION_RETRY_BACKOFF_MINUTES[1] * 60_000);
  });

  await t.test('a deterministic failure gives up at once: reason kept, no next attempt', async (st) => {
    st.mock.method(console, 'info', () => {});
    const post = await makePost('blocked');
    await recordExtractionFailure({ postId: post.id, situation: 'blocked' });
    const row = await read(post.id);
    assert.strictEqual(row.extractionFailureReason, 'blocked');
    assert.strictEqual(row.extractionNextAttemptAt, null);
  });

  await t.test('the attempts stop at the maximum: the last failure schedules nothing', async (st) => {
    st.mock.method(console, 'info', () => {});
    const post = await makePost('spent', { extractionAttempts: EXTRACTION_MAX_ATTEMPTS - 1, extractionFirstFailureAt: new Date() });
    await recordExtractionFailure({ postId: post.id, situation: 'unavailable' });
    const row = await read(post.id);
    assert.strictEqual(row.extractionAttempts, EXTRACTION_MAX_ATTEMPTS);
    assert.strictEqual(row.extractionNextAttemptAt, null);
  });

  await t.test('nothing is recorded for an unknown post or an already extracted one', async () => {
    assert.strictEqual(await recordExtractionFailure({ postId: '00000000-0000-4000-8000-00000000abcd', situation: 'unavailable' }), undefined);
    const done = await makePost('done', { isExtracted: true });
    assert.strictEqual(await recordExtractionFailure({ postId: done.id, situation: 'unavailable' }), undefined);
    assert.strictEqual((await read(done.id)).extractionFailureReason, null);
  });

  await t.test('a successful extraction clears the ledger', async (st) => {
    st.mock.method(console, 'info', () => {});
    const post = await makePost('success');
    await recordExtractionFailure({ postId: post.id, situation: 'unavailable' });
    await markPostExtracted(post.id);
    const row = await read(post.id);
    assert.strictEqual(row.isExtracted, true);
    assert.deepStrictEqual(
      [row.extractionAttempts, row.extractionFailureReason, row.extractionNextAttemptAt, row.extractionFirstFailureAt],
      [0, null, null, null]
    );
  });

  await t.test('every claim arms a watchdog past the claim TTL; a failed send takes it back unless a failure is on record', async (st) => {
    st.mock.method(console, 'info', () => {});
    st.mock.method(console, 'error', () => {});
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';
    setSendSqsMessage(async () => {});
    const claimed = await makePost('watchdog');
    const before = Date.now();
    await enqueuePostForProcessing(claimed.id);
    const armed = (await read(claimed.id)).extractionNextAttemptAt;
    assert.ok(armed && armed.getTime() > before + 30 * 60_000, 'past the 30 minute claim TTL');

    setSendSqsMessage(async () => {
      throw new Error('SQS is down');
    });
    const clean = await makePost('watchdog-send-fails');
    await assert.rejects(() => enqueuePostForProcessing(clean.id));
    const cleanRow = await read(clean.id);
    assert.deepStrictEqual([cleanRow.queuedForExtractionAt, cleanRow.extractionNextAttemptAt], [null, null], 'no job will run, so no watchdog');

    const failedBefore = await makePost('watchdog-ledger', {
      extractionAttempts: 1,
      extractionFailureReason: 'unavailable',
      extractionFirstFailureAt: new Date(),
      extractionNextAttemptAt: new Date(Date.now() - 60_000),
    });
    await assert.rejects(() => enqueuePostForProcessing(failedBefore.id));
    const ledgerRow = await read(failedBefore.id);
    assert.strictEqual(ledgerRow.queuedForExtractionAt, null);
    assert.ok(ledgerRow.extractionNextAttemptAt, 'its retry stays scheduled');
  });

  await t.test('a moderator selection resets the attempts; the automatic enqueue keeps them', async (st) => {
    st.mock.method(console, 'info', () => {});
    setSendSqsMessage(async () => {});
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';

    const kept = await makePost('kept', { extractionAttempts: 3, extractionFailureReason: 'unavailable', extractionFirstFailureAt: new Date() });
    await enqueuePostForProcessing(kept.id);
    assert.strictEqual((await read(kept.id)).extractionAttempts, 3, 'the resume pass and auto-enqueue keep the count');

    const reset = await makePost('reset', { extractionAttempts: 3, extractionFailureReason: 'unavailable', extractionFirstFailureAt: new Date() });
    await enqueuePostForProcessing(reset.id, { resetLedger: true });
    const row = await read(reset.id);
    assert.deepStrictEqual([row.extractionAttempts, row.extractionFailureReason, row.extractionFirstFailureAt], [0, null, null]);
    assert.ok(row.extractionNextAttemptAt, 'the claim arms a fresh watchdog, not the old retry time');
    assert.ok(row.queuedForExtractionAt, 'and the claim is taken');
  });
});
