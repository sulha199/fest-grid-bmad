import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { eventPosts, events, posts, socialMediaAccountProfiles } from '@festgrid/database';
import { and, eq, inArray } from 'drizzle-orm';
import { POST_EXTRACTION_STATUSES, type PostExtractionStatus } from '@festgrid/domain/posts';
import { postExtractionStatusCondition, withExtractionStatus } from './post-extraction-status.js';

const suffix = Date.now().toString();
const TTL = 30;
const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

test('post-extraction-status: the SQL filter and the derived status agree for every state', async (t) => {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'status-' + suffix, platform: 'instagram', username: 'status_' + suffix, displayName: 'Status' })
    .returning();
  const postIds: string[] = [];
  const eventIds: string[] = [];

  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert>) => {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: tag,
        postUrl: `https://instagram.com/p/status_${tag}_${suffix}`,
        publishedAt: new Date(),
        ...values,
      })
      .returning();
    postIds.push(post.id);
    return post;
  };

  t.after(async () => {
    if (eventIds.length) {
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  const pending = await makePost('pending', {});
  const expiredClaim = await makePost('expired', { queuedForExtractionAt: minutesAgo(31), extractionStartedAt: minutesAgo(30) });
  const queued = await makePost('queued', { queuedForExtractionAt: minutesAgo(5) });
  const extracting = await makePost('extracting', { queuedForExtractionAt: minutesAgo(5), extractionStartedAt: minutesAgo(4) });
  const requeued = await makePost('requeued', { queuedForExtractionAt: minutesAgo(2), extractionStartedAt: minutesAgo(20) });
  const promotedByCount = await makePost('count', { isExtracted: true, extractedEventCount: 2 });
  const promotedByEventPostId = await makePost('eventpost', { isExtracted: true });
  const [primaryEvent] = await db.insert(events).values({ eventName: 'Linked', location: 'Somewhere', postId: promotedByEventPostId.id, extractionOrdinal: 0 }).returning();
  eventIds.push(primaryEvent.id);
  const promotedByLink = await makePost('link', { isExtracted: true });
  const [linkedEvent] = await db.insert(events).values({ eventName: 'Linked 2', location: 'Somewhere' }).returning();
  eventIds.push(linkedEvent.id);
  await db.insert(eventPosts).values({ eventId: linkedEvent.id, postId: promotedByLink.id });
  const notEvent = await makePost('notevent', { isExtracted: true });
  const notEventZero = await makePost('zero', { isExtracted: true, extractedEventCount: 0 });

  const expected = new Map<string, PostExtractionStatus>([
    [pending.id, 'PENDING'],
    [expiredClaim.id, 'PENDING'],
    [queued.id, 'QUEUED'],
    [requeued.id, 'QUEUED'],
    [extracting.id, 'EXTRACTING'],
    [promotedByCount.id, 'PROMOTED'],
    [promotedByEventPostId.id, 'PROMOTED'],
    [promotedByLink.id, 'PROMOTED'],
    [notEvent.id, 'NOT_EVENT'],
    [notEventZero.id, 'NOT_EVENT'],
  ]);

  await t.test('withExtractionStatus derives the expected status for every state', async () => {
    const rows = await db.select().from(posts).where(inArray(posts.id, postIds));
    const withStatus = await withExtractionStatus(rows, TTL, now);
    for (const row of withStatus) {
      assert.strictEqual(row.extractionStatus, expected.get(row.id), `post ${row.content}`);
    }
  });

  for (const status of POST_EXTRACTION_STATUSES) {
    await t.test(`the SQL filter for ${status} matches exactly the posts derived as ${status}`, async () => {
      const matched = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(inArray(posts.id, postIds), postExtractionStatusCondition([status], TTL, now)));
      const want = [...expected.entries()].filter(([, s]) => s === status).map(([id]) => id).sort();
      assert.deepStrictEqual(matched.map((r) => r.id).sort(), want);
    });
  }

  await t.test('a multi-status filter is the union of its statuses', async () => {
    const matched = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(inArray(posts.id, postIds), postExtractionStatusCondition(['QUEUED', 'EXTRACTING'], TTL, now)));
    assert.deepStrictEqual(
      matched.map((r) => r.id).sort(),
      [queued.id, requeued.id, extracting.id].sort()
    );
  });

  await t.test('every post is matched by exactly one status', async () => {
    for (const id of postIds) {
      let hits = 0;
      for (const status of POST_EXTRACTION_STATUSES) {
        const [row] = await db
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.id, id), postExtractionStatusCondition([status], TTL, now)));
        if (row) hits++;
      }
      assert.strictEqual(hits, 1, `post ${id} must be in exactly one status`);
    }
  });
});
