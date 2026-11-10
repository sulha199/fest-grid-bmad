import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { EXTRACTION_CURSOR_VERSION, type ExtractionCursor } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';
import { readExtractionCursor, startExtractionCursor } from '../posts/extraction-cursor-store.js';
import { CHAIN_MAX_RESUME_ATTEMPTS, CHAIN_MAX_RESCRAPES, resumeStalledChains, type RescrapeOutcome } from './resume-stalled-chains.js';

const suffix = Date.now().toString();
const AI_QUEUE = 'https://sqs.mock/ai';
const hex = (secondsFromNow: number) => Math.floor(Date.now() / 1000 + secondsFromNow).toString(16);
const live = (n: number) => `https://cdn.example/${suffix}/slide-${n}.jpg?oe=${hex(3 * 24 * 3600)}`;
const expired = (n: number) => `https://cdn.example/${suffix}/slide-${n}.jpg?oe=${hex(-3600)}`;

const cursorFor = (postId: string, overrides: Partial<ExtractionCursor> = {}): ExtractionCursor => ({
  version: EXTRACTION_CURSOR_VERSION,
  postId,
  stepCount: 2,
  leaseNonce: 'nonce-0',
  nextSlide: 8,
  totalImages: 12,
  unreadAtStart: 6,
  unreadImageUrls: [8, 9, 10, 11].map(live),
  nextOrdinal: 9,
  foundKeys: ['a|2027-01-01'],
  groupingReason: 'roundup',
  followUpMade: false,
  emptySteps: 0,
  windowSize: 2,
  requestsMade: 2,
  resumeAttempts: 0,
  rescrapeCount: 0,
  lastRescrapeAt: null,
  itemsPerSlide: 3,
  claimedItemCount: null,
  ...overrides,
});

test('resume pass for stalled stepped extractions (AD-47 Rules 5-6, AD-51 Rule 4)', async (t) => {
  const originalSend = sendSqsMessage;
  const originalEnv = { flag: process.env.CURSOR_EXTRACTION_ENABLED, ai: process.env.AI_PROCESSING_QUEUE_URL };
  const ttlMs = loadBackendEnv().postExtractionClaimTtlMinutes * 60_000;
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'stall-' + suffix, platform: 'instagram', username: 'stall_' + suffix, displayName: 'Stall' })
    .returning();
  const postIds: string[] = [];
  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert> = {}) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: `caption ${tag}`,
        postUrl: `https://www.instagram.com/p/stall_${tag}_${suffix}/`,
        publishedAt: new Date('2026-11-01T00:00:00Z'),
        ...values,
      })
      .returning();
    postIds.push(post.id);
    return post;
  };
  /** A post with a persisted chain whose last commit was `ageMs` ago. */
  const stalledPost = async (tag: string, cursorOverrides: Partial<ExtractionCursor> = {}, ageMs = ttlMs + 60_000) => {
    const post = await makePost(tag);
    const cursor = cursorFor(post.id, cursorOverrides);
    await startExtractionCursor(post.id, cursor);
    await db.update(posts).set({ queuedForExtractionAt: new Date(Date.now() - ageMs) }).where(eq(posts.id, post.id));
    return { post, cursor };
  };
  const row = async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0];

  let sent: Array<{ body: any; delaySeconds?: number }> = [];
  const noRescrape = async (): Promise<RescrapeOutcome> => {
    throw new Error('this test must not re-scrape');
  };

  t.beforeEach(() => {
    process.env.CURSOR_EXTRACTION_ENABLED = 'true';
    process.env.AI_PROCESSING_QUEUE_URL = AI_QUEUE;
    sent = [];
    setSendSqsMessage(async (_url, body, options) => {
      sent.push({ body: JSON.parse(body), delaySeconds: options?.delaySeconds });
    });
    t.mock.method(console, 'info', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'error', () => {});
  });
  t.after(async () => {
    setSendSqsMessage(originalSend);
    for (const [key, value] of [['CURSOR_EXTRACTION_ENABLED', originalEnv.flag], ['AI_PROCESSING_QUEUE_URL', originalEnv.ai]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  const sentFor = (id: string) => sent.filter((m) => m.body.postId === id);

  await t.test('a stalled chain is re-enqueued from its persisted cursor: the nonce moves, the step count and progress do not', async () => {
    const { post, cursor } = await stalledPost('plain');

    const result = await resumeStalledChains(new Date(), { rescrape: noRescrape });

    assert.ok(result.resumed >= 1);
    const messages = sentFor(post.id);
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].body.content, '', 'never the caption');
    const stored = await readExtractionCursor(post.id);
    assert.ok(stored);
    assert.notStrictEqual(stored.leaseNonce, cursor.leaseNonce, 'the old copy of the step is now stale');
    assert.strictEqual(stored.stepCount, cursor.stepCount, 'the step count never changes here');
    assert.strictEqual(stored.nextSlide, cursor.nextSlide);
    assert.strictEqual(stored.nextOrdinal, cursor.nextOrdinal);
    assert.deepStrictEqual(stored.foundKeys, cursor.foundKeys);
    assert.strictEqual(stored.resumeAttempts, 1);
    assert.strictEqual(messages[0].body.cursor.leaseNonce, stored.leaseNonce);
  });

  await t.test('a chain that committed recently is left alone', async () => {
    const { post } = await stalledPost('fresh', {}, 60_000);
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    assert.strictEqual(sentFor(post.id).length, 0);
    assert.strictEqual((await readExtractionCursor(post.id))?.resumeAttempts, 0);
  });

  await t.test('each attempt waits longer: the claim TTL times (attempts so far + 1)', async () => {
    const { post } = await stalledPost('growing', { resumeAttempts: 2 }, 2 * ttlMs + 60_000);
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    assert.strictEqual(sentFor(post.id).length, 0, 'two attempts spent: it must wait three TTLs');

    const { post: waited } = await stalledPost('grown', { resumeAttempts: 2 }, 3 * ttlMs + 60_000);
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    assert.strictEqual(sentFor(waited.id).length, 1);
  });

  await t.test('after the maximum resume attempts the chain ends, flagged partial', async () => {
    const { post } = await stalledPost('spent', { resumeAttempts: CHAIN_MAX_RESUME_ATTEMPTS }, (CHAIN_MAX_RESUME_ATTEMPTS + 1) * ttlMs + 60_000);
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    assert.strictEqual(sentFor(post.id).length, 0);
  });

  await t.test('with the switch off a stalled chain ends partial instead of resuming', async () => {
    process.env.CURSOR_EXTRACTION_ENABLED = 'false';
    const { post } = await stalledPost('off');
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    assert.strictEqual(sentFor(post.id).length, 0);
  });

  await t.test('expired image links are re-scraped once and only the cursor\'s links change', async () => {
    const { post, cursor } = await stalledPost('expired', { unreadImageUrls: [8, 9, 10, 11].map(expired) });
    const calls: string[] = [];
    const fresh = Array.from({ length: 12 }, (_, i) => live(i));

    await resumeStalledChains(new Date(), {
      rescrape: async (p) => {
        calls.push(p.postUrl);
        return { ok: true, imageUrl: fresh[0], additionalImageUrls: fresh.slice(1) };
      },
    });

    assert.strictEqual(calls.length, 1);
    const stored = await readExtractionCursor(post.id);
    assert.ok(stored);
    assert.deepStrictEqual(stored.unreadImageUrls, fresh.slice(8), 'the unread links are the fresh ones from the cursor\'s slide on');
    assert.strictEqual(stored.rescrapeCount, 1);
    assert.ok(stored.lastRescrapeAt);
    assert.strictEqual(stored.nextSlide, cursor.nextSlide);
    assert.strictEqual(stored.nextOrdinal, cursor.nextOrdinal);
    assert.deepStrictEqual(stored.foundKeys, cursor.foundKeys);
    assert.strictEqual(stored.resumeAttempts, 1);
    assert.strictEqual(sentFor(post.id).length, 1, 'and the chain goes on');
    assert.strictEqual((await row(post.id)).content, 'caption expired', 'the post row and its caption are untouched');
  });

  await t.test('a re-scrape that changes the slide count ends the chain partial instead of resuming at a wrong slide', async () => {
    const { post } = await stalledPost('count', { unreadImageUrls: [8, 9, 10, 11].map(expired) });
    await resumeStalledChains(new Date(), {
      rescrape: async () => ({ ok: true, imageUrl: live(0), additionalImageUrls: [1, 2, 3].map(live) }),
    });
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    assert.strictEqual(sentFor(post.id).length, 0);
  });

  await t.test('a refused or failed re-scrape ends the chain partial, and is not retried in a loop', async () => {
    for (const reason of ['account_not_scrapable', 'scrape_failed', 'no_adapter'] as const) {
      const { post } = await stalledPost(`fail-${reason}`, { unreadImageUrls: [8, 9, 10, 11].map(expired) });
      let calls = 0;
      await resumeStalledChains(new Date(), {
        rescrape: async () => {
          calls++;
          return { ok: false, reason };
        },
      });
      const r = await row(post.id);
      assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true], reason);
      assert.strictEqual(calls, 1, reason);
    }
  });

  await t.test('a re-scrape that is already running for the post is skipped without counting anything', async () => {
    const { post, cursor } = await stalledPost('busy', { unreadImageUrls: [8, 9, 10, 11].map(expired) });
    await resumeStalledChains(new Date(), { rescrape: async () => ({ ok: false, reason: 'in_progress' }) });
    const r = await row(post.id);
    assert.strictEqual(r.isExtracted, false);
    const stored = await readExtractionCursor(post.id);
    assert.strictEqual(stored?.rescrapeCount, 0);
    assert.strictEqual(stored?.stepCount, cursor.stepCount);
    assert.strictEqual(sentFor(post.id).length, 0);
  });

  await t.test('the re-scrape limit and the 10 minute cooldown are enforced: at the limit the chain ends partial', async () => {
    const limited = await stalledPost('limit', { unreadImageUrls: [8, 9].map(expired), rescrapeCount: CHAIN_MAX_RESCRAPES });
    const cooling = await stalledPost('cooling', {
      unreadImageUrls: [8, 9].map(expired),
      rescrapeCount: 1,
      lastRescrapeAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    });
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    for (const { post } of [limited, cooling]) {
      const r = await row(post.id);
      assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    }
  });

  await t.test('an unreadable cursor is cleared and flagged, never continued', async () => {
    const post = await makePost('garbage');
    await db.update(posts).set({ extractionCursor: { version: 1 }, queuedForExtractionAt: new Date(Date.now() - ttlMs - 60_000) }).where(eq(posts.id, post.id));
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    const r = await row(post.id);
    assert.deepStrictEqual([r.extractionCursor, r.extractionPartial], [null, true]);
  });

  await t.test('a chain whose claim was released (no claim time) is still resumed', async () => {
    const { post } = await stalledPost('no-claim');
    await db.update(posts).set({ queuedForExtractionAt: null }).where(eq(posts.id, post.id));
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    assert.strictEqual(sentFor(post.id).length, 1);
  });

  await t.test('an enqueue failure gives the counted resume attempt back', async () => {
    const { post } = await stalledPost('enqueue-fails', { resumeAttempts: 1 }, 2 * ttlMs + 60_000);
    setSendSqsMessage(async () => {
      throw new Error('SQS is down');
    });
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    assert.strictEqual((await readExtractionCursor(post.id))?.resumeAttempts, 1, 'the attempt was not burnt');
  });

  await t.test('a re-scrape held up by another scrape counts as a resume attempt, so the chain cannot be refreshed forever', async () => {
    const { post } = await stalledPost('held-lease', { unreadImageUrls: [8, 9, 10, 11].map(expired), resumeAttempts: CHAIN_MAX_RESUME_ATTEMPTS - 1 });
    await db.update(posts).set({ queuedForExtractionAt: new Date(Date.now() - 10 * ttlMs) }).where(eq(posts.id, post.id));
    const busy = async (): Promise<RescrapeOutcome> => ({ ok: false, reason: 'in_progress' });
    await resumeStalledChains(new Date(), { rescrape: busy });
    assert.strictEqual((await readExtractionCursor(post.id))?.resumeAttempts, CHAIN_MAX_RESUME_ATTEMPTS, 'the visit was counted');
    await db.update(posts).set({ queuedForExtractionAt: new Date(Date.now() - 10 * ttlMs) }).where(eq(posts.id, post.id));
    await resumeStalledChains(new Date(), { rescrape: busy });
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true], 'and the chain ends once the attempts are spent');
  });

  await t.test('a fresh list with the same count but other slides ends the chain partial', async () => {
    const { post } = await stalledPost('reordered', { unreadImageUrls: [8, 9, 10, 11].map(expired) });
    const fresh = Array.from({ length: 12 }, (_, i) => live(i === 9 ? 99 : i));
    await resumeStalledChains(new Date(), { rescrape: async () => ({ ok: true, imageUrl: fresh[0], additionalImageUrls: fresh.slice(1) }) });
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
    assert.strictEqual(sentFor(post.id).length, 0);
  });

  await t.test('a re-scrape that returns links that are already expired ends the chain partial', async () => {
    const { post } = await stalledPost('still-expired', { unreadImageUrls: [8, 9, 10, 11].map(expired) });
    const dead = Array.from({ length: 12 }, (_, i) => expired(i));
    await resumeStalledChains(new Date(), { rescrape: async () => ({ ok: true, imageUrl: dead[0], additionalImageUrls: dead.slice(1) }) });
    const r = await row(post.id);
    assert.deepStrictEqual([r.isExtracted, r.extractionCursor, r.extractionPartial], [true, null, true]);
  });

  await t.test('one chain failing to enqueue does not stop the others', async () => {
    const bad = await stalledPost('bad');
    const good = await stalledPost('good');
    setSendSqsMessage(async (_url, body, options) => {
      const message = JSON.parse(body);
      if (message.postId === bad.post.id) throw new Error('SQS down for this one');
      sent.push({ body: message, delaySeconds: options?.delaySeconds });
    });
    await resumeStalledChains(new Date(), { rescrape: noRescrape });
    assert.strictEqual(sentFor(good.post.id).length, 1);
  });

  await t.test('every commit of a cursor refreshes the claim time the pass reads', async () => {
    const post = await makePost('refresh');
    await startExtractionCursor(post.id, cursorFor(post.id));
    const claimed = (await row(post.id)).queuedForExtractionAt;
    assert.ok(claimed && Date.now() - claimed.getTime() < 60_000);
  });
});
