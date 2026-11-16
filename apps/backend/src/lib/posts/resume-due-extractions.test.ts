import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';
import { RESUME_PASS_LIMIT, resumeDueExtractions } from './resume-due-extractions.js';

const suffix = Date.now().toString();

test('resume pass for due extraction retries (AD-52 Rule 5)', async (t) => {
  const originalSend = sendSqsMessage;
  const originalQueue = process.env.AI_PROCESSING_QUEUE_URL;
  process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';
  const ttlMs = loadBackendEnv().postExtractionClaimTtlMinutes * 60_000;

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'resume-' + suffix, platform: 'instagram', username: 'resume_' + suffix, displayName: 'Resume' })
    .returning();
  const postIds: string[] = [];
  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert> = {}) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: tag,
        postUrl: `https://instagram.com/p/resume_${tag}_${suffix}`,
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
    if (originalQueue === undefined) delete process.env.AI_PROCESSING_QUEUE_URL;
    else process.env.AI_PROCESSING_QUEUE_URL = originalQueue;
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  // Every case below shares the table with other posts, so each asserts on its own post only.
  const now = new Date();
  const due = new Date(now.getTime() - 60_000);

  await t.test('a due post with no claim is re-enqueued, keeps its attempts, and gets a watchdog past the claim TTL', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const post = await makePost('due', {
      extractionAttempts: 2,
      extractionFailureReason: 'unavailable',
      extractionFirstFailureAt: new Date(now.getTime() - 3600_000),
      extractionNextAttemptAt: due,
    });

    await resumeDueExtractions(now);

    assert.ok(sent.includes(post.id), 'the post was sent to the AI queue');
    const row = await read(post.id);
    assert.strictEqual(row.extractionAttempts, 2, 'the pass itself does not count an attempt');
    assert.ok(row.queuedForExtractionAt, 'claimed');
    assert.ok(
      row.extractionNextAttemptAt!.getTime() > now.getTime() + ttlMs,
      'the watchdog is past the claim TTL, so a silently dead retry is found again'
    );
  });

  await t.test('a first attempt that died silently (watchdog due, claim expired, no failure on record) is counted and retried later', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const post = await makePost('silent-first', {
      queuedForExtractionAt: new Date(now.getTime() - ttlMs - 60_000),
      extractionNextAttemptAt: due,
    });

    const result = await resumeDueExtractions(now);

    assert.ok(result.watchdogFailures >= 1);
    assert.ok(!sent.includes(post.id), 'not enqueued in the same pass: it is rescheduled with a backoff');
    const row1 = await read(post.id);
    assert.strictEqual(row1.extractionAttempts, 1, 'the silent death was counted as an attempt');
    assert.strictEqual(row1.extractionFailureReason, 'timeout');
    assert.strictEqual(row1.queuedForExtractionAt, null);
    assert.ok(row1.extractionNextAttemptAt && row1.extractionNextAttemptAt.getTime() > now.getTime());
  });

  await t.test('a first attempt still inside its claim is left alone even though a watchdog is armed', async (st) => {
    st.mock.method(console, 'info', () => {});
    const post = await makePost('live-first', {
      queuedForExtractionAt: new Date(now.getTime() - 60_000),
      extractionNextAttemptAt: due,
    });
    await resumeDueExtractions(now);
    assert.strictEqual((await read(post.id)).extractionAttempts, 0);
  });

  await t.test('a post whose retry is not due yet is left alone', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const later = new Date(now.getTime() + 3600_000);
    const post = await makePost('not-due', { extractionFailureReason: 'unavailable', extractionNextAttemptAt: later });

    await resumeDueExtractions(now);

    assert.ok(!sent.includes(post.id));
    assert.strictEqual((await read(post.id)).extractionNextAttemptAt?.getTime(), later.getTime());
  });

  await t.test('a given-up post (no next attempt) is never picked up', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const post = await makePost('given-up', { extractionFailureReason: 'blocked', extractionNextAttemptAt: null });
    await resumeDueExtractions(now);
    assert.ok(!sent.includes(post.id));
  });

  await t.test('an extracted post with a stale due time is never picked up', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const post = await makePost('extracted', { isExtracted: true, extractionFailureReason: 'unavailable', extractionNextAttemptAt: due });
    await resumeDueExtractions(now);
    assert.ok(!sent.includes(post.id));
  });

  await t.test('a live claim is skipped: a job may still be running', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const post = await makePost('live-claim', {
      extractionFailureReason: 'unavailable',
      extractionNextAttemptAt: due,
      queuedForExtractionAt: new Date(now.getTime() - 60_000),
    });
    const result = await resumeDueExtractions(now);
    assert.ok(!sent.includes(post.id));
    assert.ok(result.skipped >= 1);
    assert.strictEqual((await read(post.id)).extractionAttempts, 0);
  });

  await t.test('an expired claim with a due watchdog counts as a failed attempt instead of looping forever', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const post = await makePost('dead-retry', {
      extractionAttempts: 2,
      extractionFailureReason: 'unavailable',
      extractionFirstFailureAt: new Date(now.getTime() - 3600_000),
      extractionNextAttemptAt: due,
      queuedForExtractionAt: new Date(now.getTime() - ttlMs - 60_000),
    });

    const result = await resumeDueExtractions(now);

    assert.ok(result.watchdogFailures >= 1);
    assert.ok(!sent.includes(post.id), 'not enqueued in the same pass: it is rescheduled with a backoff');
    const row = await read(post.id);
    assert.strictEqual(row.extractionAttempts, 3, 'the dead retry was counted');
    assert.strictEqual(row.extractionFailureReason, 'timeout');
    assert.strictEqual(row.queuedForExtractionAt, null);
    assert.ok(row.extractionNextAttemptAt && row.extractionNextAttemptAt.getTime() > now.getTime());
  });

  await t.test('one post failing to enqueue does not stop the others', async (st) => {
    st.mock.method(console, 'info', () => {});
    st.mock.method(console, 'warn', () => {});
    const sent: string[] = [];
    const first = await makePost('boom', { extractionFailureReason: 'unavailable', extractionNextAttemptAt: new Date(now.getTime() - 120_000) });
    const second = await makePost('fine', { extractionFailureReason: 'unavailable', extractionNextAttemptAt: new Date(now.getTime() - 110_000) });
    setSendSqsMessage(async (_url, body) => {
      const id = JSON.parse(body).postId;
      if (id === first.id) throw new Error('SQS down for this one');
      sent.push(id);
    });

    await resumeDueExtractions(now);

    assert.ok(sent.includes(second.id));
    const failed = await read(first.id);
    assert.strictEqual(failed.extractionAttempts, 1, 'the post that could not be enqueued is counted');
    assert.ok(failed.extractionNextAttemptAt!.getTime() > now.getTime(), 'and pushed back so it leaves the head of the queue');
  });

  await t.test('at most RESUME_PASS_LIMIT posts are resumed per pass, oldest first', async (st) => {
    st.mock.method(console, 'info', () => {});
    const sent: string[] = [];
    setSendSqsMessage(async (_url, body) => {
      sent.push(JSON.parse(body).postId);
    });
    const ids: string[] = [];
    for (let i = 0; i < RESUME_PASS_LIMIT + 3; i++) {
      const post = await makePost(`bulk-${i}`, {
        extractionFailureReason: 'unavailable',
        // Far older than anything else in this table, in increasing order.
        extractionNextAttemptAt: new Date(Date.UTC(2000, 0, 1, 0, 0, i)),
      });
      ids.push(post.id);
    }

    await resumeDueExtractions(now);

    const own = sent.filter((id) => ids.includes(id));
    assert.strictEqual(own.length, RESUME_PASS_LIMIT);
    assert.deepStrictEqual(own.sort(), ids.slice(0, RESUME_PASS_LIMIT).sort(), 'the oldest ones go first');
  });
});
