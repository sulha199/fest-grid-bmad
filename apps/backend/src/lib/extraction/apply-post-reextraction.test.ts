import test from 'node:test';
import * as assert from 'node:assert';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  eventMatchCandidates,
  eventPosts,
  eventSlugAliases,
  events,
  favorites,
  manualExtractionJobs,
  postAccountAssociations,
  posts,
  schedules,
  socialMediaAccountProfiles,
  users,
} from '@festgrid/database';
import type { ManualExtractionRequestPayload, ReextractionPreviewResult } from '@festgrid/domain/posts';
import { applyPostReextraction } from './apply-post-reextraction.js';
import { findEventsInconsistentWithEventPosts, insertEventWithPrimaryPost } from '../events/set-event-primary-post.js';
import { resolveLocationSeam, setResolveLocationSeam } from '../ai-processor/resolve-account-and-locations.js';

// AD-40 (Apply) -- real-DB tests. The extraction is handed to Apply the way a finished preview job
// stores it, so nothing here calls Gemini; geocoding is stubbed to a failure (best-effort, ignored).

test('applyPostReextraction (AD-40 Apply)', async (t) => {
  const suffix = Date.now();
  const originalResolve = resolveLocationSeam;
  setResolveLocationSeam(async () => {
    throw new Error('geocoder disabled in test');
  });

  const [moderator] = await db.select().from(users).limit(1);
  assert.ok(moderator, 'Must have at least one seeded user');
  const [otherUser] = await db
    .insert(users)
    .values({ email: `apply-other-${suffix}@example.com`, role: 'user' })
    .returning();

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-apply-' + suffix, platform: 'instagram', displayName: 'Apply', username: 'apply_' + suffix })
    .returning();

  const postIds: string[] = [];
  const jobIds: string[] = [];
  const eventIds = new Set<string>();

  t.after(async () => {
    setResolveLocationSeam(originalResolve);
    // Events created by Apply are found through their links to the fixture posts.
    if (postIds.length) {
      for (const row of await db.select({ eventId: eventPosts.eventId }).from(eventPosts).where(inArray(eventPosts.postId, postIds))) {
        eventIds.add(row.eventId);
      }
    }
    const ids = [...eventIds];
    if (jobIds.length) await db.delete(manualExtractionJobs).where(inArray(manualExtractionJobs.id, jobIds));
    if (ids.length) {
      await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, ids));
      await db.delete(favorites).where(inArray(favorites.eventId, ids));
      await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, ids));
      await db.delete(schedules).where(inArray(schedules.eventId, ids));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, ids));
      await db.delete(events).where(inArray(events.id, ids));
    }
    if (postIds.length) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, account.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
  });

  async function makePost(publishedAt = '2026-10-01T00:00:00Z') {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: account.id,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/apply${postIds.length}x${suffix}/`,
        platformPostId: `apply${postIds.length}x${suffix}`,
        platformPostType: 'p',
        publishedAt: new Date(publishedAt),
        content: null,
        groupingReason: 'single-event',
      })
      .returning();
    postIds.push(post.id);
    await db.insert(postAccountAssociations).values({ postId: post.id, accountId: account.id, role: 'PUBLISHER' });
    return post;
  }

  async function makeEvent(post: { id: string }, ordinal: number, name: string, date: string, slug?: string) {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: name,
      location: 'Apply Hall',
      hasPrivateContact: false,
      postId: post.id,
      extractionOrdinal: ordinal,
      sourceSocialMediaAccountId: account.accountId,
      ...(slug ? { slug } : {}),
    });
    assert.ok(inserted);
    eventIds.add(inserted.id);
    await db.insert(schedules).values({ eventId: inserted.id, eventStartDate: date, isMainSchedule: true, location: 'Apply Hall' });
    return inserted;
  }

  const rawEvent = (name: string, date: string) => ({
    eventName: name,
    types: ['COMPETITION'],
    categories: ['SPORTS_AND_FITNESS'],
    location: 'Apply Hall',
    schedules: [{ isMainSchedule: true, eventStartDate: date, title: 'Day', location: 'Apply Hall' }],
    confidenceScore: 0.9,
  });

  async function makeJob(
    post: { id: string; postUrl: string },
    extractedEvents: unknown[],
    overrides: { userId?: string; status?: 'SUCCEEDED' | 'FAILED'; completedAt?: Date; postStored?: boolean; withExtracted?: boolean } = {}
  ) {
    const result: ReextractionPreviewResult = {
      groupingReason: 'roundup',
      postStored: overrides.postStored ?? true,
      rescraped: false,
      imagesAvailable: 1,
      imagesSent: 1,
      events: [],
      extracted:
        overrides.withExtracted === false
          ? null
          : { events: extractedEvents as never, groupingReason: 'roundup', postTitle: 'Weekend roundup', childrensDataMatch: false },
    };
    const payload: ManualExtractionRequestPayload = {
      message: { postId: post.id, accountId: account.id, content: '', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00Z' },
      mode: 'REEXTRACT_PREVIEW',
      postStored: result.postStored,
      rescraped: false,
    };
    const [job] = await db
      .insert(manualExtractionJobs)
      .values({
        requestedByUserId: overrides.userId ?? moderator.id,
        sourceUrl: post.postUrl,
        requestPayload: payload,
        status: overrides.status ?? 'SUCCEEDED',
        resultData: result,
        completedAt: overrides.completedAt ?? new Date(),
      })
      .returning();
    jobIds.push(job.id);
    return job;
  }

  const linkRows = (postId: string) =>
    db
      .select({ eventId: eventPosts.eventId, ordinal: eventPosts.extractionOrdinal, slug: events.slug, name: events.eventName, detail: events.detailLevel, deletedAt: events.deletedAt })
      .from(eventPosts)
      .innerJoin(events, eq(events.id, eventPosts.eventId))
      .where(eq(eventPosts.postId, postId));

  await t.test('a post stored as one event becomes a roundup: the old event keeps its id and slug, favorites survive, new items link as stubs', async () => {
    const post = await makePost();
    const kulon = `Kulon Progo Half Marathon ${suffix}`;
    const existing = await makeEvent(post, 0, kulon, '2026-09-01', `ig_p_apply_${suffix}`);
    await db.insert(favorites).values({ userId: moderator.id, eventId: existing.id });

    const job = await makeJob(post, [rawEvent(`Merapi Performance Trail Run ${suffix}`, '2026-09-01'), rawEvent(kulon, '2026-09-01'), rawEvent(`PLN Mobile Electric Series ${suffix}`, '2026-09-02')]);
    const result = await applyPostReextraction(moderator.id, job.id);
    assert.ok('summary' in result, JSON.stringify(result));
    const { summary } = result;

    assert.strictEqual(summary.reused.length, 1);
    assert.strictEqual(summary.reused[0].slug, existing.slug, 'the slug survives');
    assert.strictEqual(summary.created.length, 2);
    assert.strictEqual(summary.groupingReason, 'roundup');
    assert.deepStrictEqual(summary.orphans, []);

    const rows = await linkRows(post.id);
    assert.strictEqual(rows.length, 3, 'the post is linked to three events');
    assert.strictEqual(new Set(rows.map((r) => r.ordinal)).size, 3, 'with distinct ordinals');
    assert.ok(rows.every((r) => r.detail === 'stub'), 'every event of a roundup post is a stub');
    const reused = rows.find((r) => r.eventId === existing.id);
    assert.ok(reused, 'the original event is still linked');
    assert.strictEqual(reused.slug, existing.slug);
    assert.strictEqual(reused.deletedAt, null);

    const [fav] = await db.select().from(favorites).where(and(eq(favorites.eventId, existing.id), eq(favorites.userId, moderator.id)));
    assert.ok(fav && fav.deletedAt === null, 'the favorite is intact');

    const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.groupingReason, 'roundup');
    assert.strictEqual(stored.title, 'Weekend roundup');
    assert.strictEqual(stored.extractedEventCount, 3);

    assert.deepStrictEqual(
      (await findEventsInconsistentWithEventPosts(db)).filter((id) => rows.some((r) => r.eventId === id)),
      [],
      'events.post_id and event_posts agree on every ordinal (AD-30 Rule 2)'
    );

    // The new items took the lowest free ordinals in ingestion order, around the reused event's slug.
    const created = rows.filter((r) => r.eventId !== existing.id);
    assert.ok(created.every((r) => r.slug !== existing.slug), 'no slug collision with the reused event');
    const [job2] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, job.id));
    const stored2 = job2.resultData as ReextractionPreviewResult;
    assert.strictEqual(stored2.extracted, null, 'the kept extraction is dropped once applied');
    assert.ok(stored2.appliedAt && stored2.applied);

    // A second apply of the same job is a no-op returning the first result.
    const again = await applyPostReextraction(moderator.id, job.id);
    assert.ok('summary' in again);
    assert.deepStrictEqual(again.summary, summary);
    assert.strictEqual((await linkRows(post.id)).length, 3, 'nothing was created twice');
  });

  await t.test('an item matching an event a moderator soft-deleted is skipped, never recreated (PRD 3.7), and its slot stays reserved', async () => {
    const post = await makePost();
    const gone = `Deleted Fest ${suffix}`;
    const deleted = await makeEvent(post, 0, gone, '2026-09-10');
    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, deleted.id));
    const job = await makeJob(post, [rawEvent(gone, '2026-09-10'), rawEvent(`Fresh Event ${suffix}`, '2026-09-11')]);

    const result = await applyPostReextraction(moderator.id, job.id);
    assert.ok('summary' in result, JSON.stringify(result));
    assert.strictEqual(result.summary.skippedDeleted, 1);
    assert.strictEqual(result.summary.created.length, 1);
    const rows = await linkRows(post.id);
    assert.strictEqual(rows.filter((r) => r.name === gone).length, 1, 'no second "Deleted Fest" was created');
    assert.strictEqual(rows.find((r) => r.eventId === deleted.id)?.ordinal, 0, 'the deleted event keeps its ordinal');
    assert.strictEqual(rows.find((r) => r.name === `Fresh Event ${suffix}`)?.ordinal, 1, 'the new item steps around it');
  });

  await t.test('a live event of the post that no item matches is left untouched and reported', async () => {
    const post = await makePost();
    const orphan = await makeEvent(post, 0, `Totally Unrelated Gala ${suffix}`, '2027-05-05');
    const job = await makeJob(post, [rawEvent(`Another Show ${suffix}`, '2026-09-20')]);
    const result = await applyPostReextraction(moderator.id, job.id);
    assert.ok('summary' in result, JSON.stringify(result));
    assert.deepStrictEqual(result.summary.orphans, [{ slug: orphan.slug, eventName: orphan.eventName }]);
    const rows = await linkRows(post.id);
    assert.strictEqual(rows.find((r) => r.eventId === orphan.id)?.ordinal, 0, 'the orphan keeps its slot');
    assert.strictEqual(rows.find((r) => r.eventId === orphan.id)?.detail, 'full', 'and its detail level');
    assert.strictEqual(rows.find((r) => r.name === `Another Show ${suffix}`)?.ordinal, 1);
  });

  await t.test('an event whose primary post is another post is not demoted to a stub, but gains this post\'s link', async () => {
    const earlier = await makePost('2026-09-01T00:00:00Z');
    const post = await makePost('2026-10-01T00:00:00Z');
    const shared = `Shared Marathon ${suffix}`;
    const sharedEvent = await makeEvent(earlier, 0, shared, '2026-09-15');
    await db.insert(eventPosts).values({ eventId: sharedEvent.id, postId: post.id, extractionOrdinal: 0 });
    const job = await makeJob(post, [rawEvent(shared, '2026-09-15')]);
    const result = await applyPostReextraction(moderator.id, job.id);
    assert.ok('summary' in result, JSON.stringify(result));
    assert.strictEqual(result.summary.reused.length, 1);
    const [after] = await db.select().from(events).where(eq(events.id, sharedEvent.id));
    assert.strictEqual(after.detailLevel, 'full', 'the earlier organizer post stays primary, so the event keeps its detail');
    assert.strictEqual(after.postId, earlier.id);
  });

  await t.test('refusals write nothing: foreign job, unfinished job, expired, no kept extraction, post not stored', async () => {
    const post = await makePost();
    const base = [rawEvent(`Never Applied ${suffix}`, '2026-09-25')];
    const foreign = await makeJob(post, base, { userId: otherUser.id });
    const failed = await makeJob(post, base, { status: 'FAILED' });
    const old = await makeJob(post, base, { completedAt: new Date(Date.now() - 31 * 60 * 1000) });
    const noExtraction = await makeJob(post, base, { withExtracted: false });
    const notStored = await makeJob(post, base, { postStored: false });

    const outcomes = await Promise.all([foreign, failed, old, noExtraction, notStored].map((job) => applyPostReextraction(moderator.id, job.id)));
    assert.deepStrictEqual(
      outcomes.map((o) => ('errorCode' in o ? o.errorCode : 'APPLIED')),
      ['NOT_FOUND', 'NOT_FOUND', 'EXPIRED', 'EXPIRED', 'NOT_STORED']
    );
    assert.strictEqual((await linkRows(post.id)).length, 0, 'no event was created');
    const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.groupingReason, 'single-event', 'the post is untouched');
    assert.strictEqual((await applyPostReextraction(moderator.id, '00000000-0000-4000-8000-0000000000cc')).hasOwnProperty('errorCode'), true, 'an unknown job id is NOT_FOUND too');
  });

  await t.test('a failure part-way rolls the whole apply back: grouping, ordinals, events and the job are as they were', async () => {
    const post = await makePost();
    const keep = `Rollback Keeper ${suffix}`;
    const existing = await makeEvent(post, 0, keep, '2026-09-30');
    // The second new item has a date Postgres rejects, so the failure comes after the post update,
    // the ordinal parking and the reuse of the existing event.
    const job = await makeJob(post, [rawEvent(`Rollback New ${suffix}`, '2026-10-01'), rawEvent(keep, '2026-09-30'), rawEvent(`Rollback Bad ${suffix}`, 'not-a-date')]);

    const result = await applyPostReextraction(moderator.id, job.id);
    assert.ok('errorCode' in result && result.errorCode === 'APPLY_FAILED', JSON.stringify(result));

    const rows = await linkRows(post.id);
    assert.deepStrictEqual(rows.map((r) => ({ id: r.eventId, ordinal: r.ordinal, detail: r.detail })), [{ id: existing.id, ordinal: 0, detail: 'full' }]);
    assert.strictEqual((await db.select().from(events).where(inArray(events.eventName, [`Rollback New ${suffix}`, `Rollback Bad ${suffix}`]))).length, 0, 'no new event survived');
    const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(stored.groupingReason, 'single-event');
    const [after] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, job.id));
    const afterResult = after.resultData as ReextractionPreviewResult;
    assert.ok(afterResult.extracted && !afterResult.applied, 'the job can still be applied after fixing the cause');
  });

  await t.test('two simultaneous applies of one job apply once and both get the same summary', async () => {
    const post = await makePost();
    const job = await makeJob(post, [rawEvent(`Race Alpha ${suffix}`, '2026-09-05'), rawEvent(`Race Beta ${suffix}`, '2026-09-06')]);
    const [a, b] = await Promise.all([applyPostReextraction(moderator.id, job.id), applyPostReextraction(moderator.id, job.id)]);
    assert.ok('summary' in a && 'summary' in b, JSON.stringify([a, b]));
    assert.deepStrictEqual(a.summary, b.summary);
    assert.strictEqual((await linkRows(post.id)).length, 2, 'two events, not four');
  });
});
