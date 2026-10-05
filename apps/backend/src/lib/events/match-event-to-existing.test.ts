import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, eventPosts, schedules } from '@festgrid/database';
import type { EventInsertValues, ScheduleInsertValues } from '@festgrid/domain/events';
import { insertEventWithPrimaryPost } from './set-event-primary-post.js';
import { findMatchingEvent } from './match-event-to-existing.js';
import { randomUUID } from 'node:crypto';

// A syntactically valid uuid that no post row carries: findMatchingEvent only uses it to exclude
// candidates already linked to the new item's own post (the same-post sibling guard).
const UNRELATED_POST_ID = randomUUID();

test('findMatchingEvent integration tests', async (t) => {
  const suffix = Date.now();

  const [matchingAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-mete-matching-' + suffix,
      platform: 'instagram',
      displayName: 'METE Matching',
      username: 'mete_matching_' + suffix,
    })
    .returning();

  const [otherAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-mete-other-' + suffix,
      platform: 'instagram',
      displayName: 'METE Other',
      username: 'mete_other_' + suffix,
    })
    .returning();

  const postIds: string[] = [];
  const eventIds: string[] = [];
  const scheduleIds: string[] = [];

  t.after(async () => {
    if (scheduleIds.length > 0) await db.delete(schedules).where(inArray(schedules.id, scheduleIds));
    if (eventIds.length > 0) {
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [matchingAccount.id, otherAccount.id]));
  });

  async function makePost(accountId: string, urlSuffix: string) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId,
        platform: 'instagram',
        postUrl: `https://instagram.com/p/mete-${urlSuffix}-${suffix}`,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  async function makeCandidateEvent(opts: {
    accountId: string;
    postIdSuffix: string;
    eventName: string;
    eventStartDate: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    links?: { url: string }[] | null;
    deletedAt?: Date | null;
    mergedIntoEventId?: string | null;
  }) {
    const post = await makePost(opts.accountId, opts.postIdSuffix);
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: opts.eventName,
      location: 'Candidate Location',
      hasPrivateContact: false,
      postId: post.id,
      sourceSocialMediaAccountId: opts.accountId,
      links: opts.links ?? null,
    });
    if (!inserted) throw new Error('expected insert to succeed');
    eventIds.push(inserted.id);

    if (opts.deletedAt || opts.mergedIntoEventId) {
      const patch: { deletedAt?: Date; mergedIntoEventId?: string } = {};
      if (opts.deletedAt) patch.deletedAt = opts.deletedAt;
      if (opts.mergedIntoEventId) patch.mergedIntoEventId = opts.mergedIntoEventId;
      await db.update(events).set(patch).where(eq(events.id, inserted.id));
    }

    const [schedule] = await db
      .insert(schedules)
      .values({
        eventId: inserted.id,
        eventStartDate: opts.eventStartDate,
        isMainSchedule: true,
        location: opts.location ?? null,
        latitude: opts.latitude ?? null,
        longitude: opts.longitude ?? null,
      })
      .returning();
    scheduleIds.push(schedule.id);

    return { event: inserted, post, schedule };
  }

  function newEvent(overrides: Partial<EventInsertValues> = {}): EventInsertValues {
    return {
      postId: 'unused-in-this-call', // findMatchingEvent never reads newEvent.postId
      sourceSocialMediaAccountId: matchingAccount.accountId,
      eventName: 'Jakarta Jazz Night ' + suffix,
      types: [],
      categories: [],
      location: 'Jakarta',
      hasPrivateContact: false,
      ...overrides,
    };
  }

  function newSchedule(eventStartDate: string, overrides: Partial<ScheduleInsertValues> = {}): ScheduleInsertValues {
    return { isMainSchedule: true, eventStartDate, ...overrides };
  }

  await t.test('no usable date on the new item -> null, no query run', async () => {
    const result = await findMatchingEvent(db, newEvent(), [], { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null }, undefined);
    assert.strictEqual(result, null);
  });

  await t.test('trigram near-hit + organizer match + exact date + shared link -> high-scoring match found', async () => {
    const { event: candidate } = await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'hit',
      eventName: 'Jakarta Jazz Night ' + suffix,
      eventStartDate: '2026-06-15',
      links: [{ url: 'https://tickets.example.com/jjn' }],
    });

    const result = await findMatchingEvent(
      db,
      newEvent({ links: [{ url: 'https://tickets.example.com/jjn' }] }),
      [newSchedule('2026-06-15')],
      { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null },
      undefined
    );

    assert.ok(result);
    assert.strictEqual(result!.candidate.id, candidate.id);
    // organizer (0.40) + sharedLink (0.20) + dateNameSimilarity (1 * 0.25) = 0.85 -> high
    assert.strictEqual(result!.tier, 'high');
  });

  await t.test('trigram near-miss (dissimilar name) is excluded from candidates entirely', async () => {
    const newName = 'Bandung Food Festival Alpha ' + suffix;
    const { event: nearHit } = await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'nearhit',
      eventName: 'Bandung Food Festival Alpha Extra ' + suffix, // high trigram similarity
      eventStartDate: '2026-06-20',
    });
    await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'nearmiss',
      eventName: 'Zzyx Qvwk Plonk', // deliberately shares no trigrams with newName
      eventStartDate: '2026-06-20',
    });

    const result = await findMatchingEvent(
      db,
      newEvent({ eventName: newName }),
      [newSchedule('2026-06-20')],
      { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null },
      undefined
    );

    assert.ok(result);
    assert.strictEqual(result!.candidate.id, nearHit.id);
  });

  await t.test('date-overlap boundary: exactly 2 days away is included, 3 days away is excluded', async () => {
    const { event: withinBoundary } = await makeCandidateEvent({
      accountId: otherAccount.id,
      postIdSuffix: 'boundary-in',
      eventName: 'Jakarta Jazz Night Boundary ' + suffix,
      eventStartDate: '2026-07-17', // new date is 2026-07-15 -- exactly +2 days
    });
    await makeCandidateEvent({
      accountId: otherAccount.id,
      postIdSuffix: 'boundary-out',
      eventName: 'Jakarta Jazz Night Boundary Outside ' + suffix,
      eventStartDate: '2026-07-18', // +3 days -- must be excluded
    });

    const result = await findMatchingEvent(
      db,
      newEvent({ eventName: 'Jakarta Jazz Night Boundary ' + suffix }),
      [newSchedule('2026-07-15')],
      { postId: UNRELATED_POST_ID, accountId: otherAccount.id, groupingReason: null },
      undefined
    );

    assert.ok(result);
    assert.strictEqual(result!.candidate.id, withinBoundary.id);
  });

  await t.test('soft-deleted candidate is excluded', async () => {
    await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'deleted',
      eventName: 'Jakarta Jazz Night Deleted ' + suffix,
      eventStartDate: '2026-08-01',
      deletedAt: new Date(),
    });

    const result = await findMatchingEvent(
      db,
      newEvent({ eventName: 'Jakarta Jazz Night Deleted ' + suffix }),
      [newSchedule('2026-08-01')],
      { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null },
      undefined
    );

    assert.strictEqual(result, null);
  });

  await t.test('merged-away candidate (mergedIntoEventId set) is excluded', async () => {
    const { event: mergeTarget } = await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'merge-target',
      eventName: 'Jakarta Jazz Night Merged Target ' + suffix,
      eventStartDate: '2026-08-05',
    });
    await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'merge-source',
      eventName: 'Jakarta Jazz Night Merged Source ' + suffix,
      eventStartDate: '2026-08-05',
      mergedIntoEventId: mergeTarget.id,
    });

    const result = await findMatchingEvent(
      db,
      newEvent({ eventName: 'Jakarta Jazz Night Merged Source ' + suffix }),
      [newSchedule('2026-08-05')],
      { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null },
      undefined
    );

    // Only the non-merged target is a valid candidate.
    assert.ok(result);
    assert.strictEqual(result!.candidate.id, mergeTarget.id);
  });

  await t.test('organizerHandle resolves to an account and contributes to the match (mid tier)', async () => {
    const { event: candidate } = await makeCandidateEvent({
      accountId: otherAccount.id,
      postIdSuffix: 'handle',
      eventName: 'Jakarta Jazz Night Handle ' + suffix,
      eventStartDate: '2026-09-01',
    });

    // Source account differs from the candidate's account, but organizerHandle resolves to it.
    const result = await findMatchingEvent(
      db,
      newEvent({ eventName: 'Jakarta Jazz Night Handle ' + suffix }),
      [newSchedule('2026-09-01')],
      { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null },
      '@' + otherAccount.username.toUpperCase()
    );

    assert.ok(result);
    assert.strictEqual(result!.candidate.id, candidate.id);
    // organizer (0.40, via the resolved handle) + dateNameSimilarity (1 * 0.25) = 0.65 -> mid
    assert.strictEqual(result!.tier, 'mid');
  });

  await t.test('shared link and venue proximity both contribute without an organizer match', async () => {
    const { event: candidate } = await makeCandidateEvent({
      accountId: otherAccount.id,
      postIdSuffix: 'link-venue',
      eventName: 'Jakarta Jazz Night LinkVenue ' + suffix,
      eventStartDate: '2026-09-10',
      location: 'Senayan Hall',
      latitude: -6.2,
      longitude: 106.8,
      links: [{ url: 'https://tickets.example.com/jazz' }],
    });

    const result = await findMatchingEvent(
      db,
      newEvent({
        eventName: 'Jakarta Jazz Night LinkVenue ' + suffix,
        links: [{ url: 'HTTPS://TICKETS.EXAMPLE.COM/jazz/' }],
      }),
      [newSchedule('2026-09-10', { location: 'senayan hall' })],
      { postId: UNRELATED_POST_ID, accountId: matchingAccount.id, groupingReason: null }, // no organizer overlap
      undefined
    );

    assert.ok(result);
    assert.strictEqual(result!.candidate.id, candidate.id);
    // organizer (0.40) absent; shared link (0.20) + date/name (~0.25) + venue (0.15) = mid/high
    assert.notStrictEqual(result!.tier, 'low');
  });

  await t.test('a sibling event already linked to the SAME postId is never returned as a candidate, even when it would otherwise score high', async () => {
    // Story 3.6s's multi-event-per-post feature extracts several genuinely distinct events
    // from ONE post at different extractionOrdinals, all sharing the same postId. Without this
    // exclusion, ingesting the second item could "match" the first item's own
    // already-inserted sibling event purely because they share a post/account/date -- silently
    // undoing 3.6s's own deliberate split. This is NOT the (postId, extractionOrdinal)
    // idempotency case (that is a different ordinal from the SAME post, not a redelivery).
    const siblingPost = await makePost(matchingAccount.id, 'sibling-post');
    const { event: sibling } = await makeCandidateEvent({
      accountId: matchingAccount.id,
      postIdSuffix: 'sibling-ordinal-0',
      eventName: 'Sibling Event Shared Post ' + suffix,
      eventStartDate: '2026-12-01',
      links: [{ url: 'https://tickets.example.com/sibling' }],
    });
    // Re-point the sibling event's own event_posts link onto siblingPost (simulating ordinal 0
    // of siblingPost), so the "new item" below (ordinal 1 of the SAME siblingPost) is excluded.
    await db.insert(eventPosts).values({ eventId: sibling.id, postId: siblingPost.id, extractionOrdinal: 0 }).onConflictDoNothing();

    const result = await findMatchingEvent(
      db,
      // Identical name/date/link to `sibling` -- would score 'high' (organizer + sharedLink +
      // dateNameSimilarity) against any OTHER candidate, proving the exclusion is what's doing
      // the work here, not a coincidentally low score.
      newEvent({ eventName: 'Sibling Event Shared Post ' + suffix, links: [{ url: 'https://tickets.example.com/sibling' }] }),
      [newSchedule('2026-12-01')],
      { postId: siblingPost.id, accountId: matchingAccount.id, groupingReason: null },
      undefined
    );

    assert.strictEqual(result, null, 'the same-postId sibling must never be returned as a candidate');
  });
});
