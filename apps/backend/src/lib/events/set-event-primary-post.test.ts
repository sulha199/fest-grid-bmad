import test from 'node:test';
import * as assert from 'node:assert';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  socialMediaAccountProfiles,
  posts,
  events,
  eventPosts,
  eventSlugAliases,
  schedules,
  corrections,
  calendarAdditions,
  favorites,
  users,
} from '@festgrid/database';
import type { EventInsertValues, ScheduleInsertValues } from '@festgrid/domain/events';
import { insertEventWithPrimaryPost, setEventPrimaryPost, findEventsInconsistentWithEventPosts, enrichAndPromoteEvent } from './set-event-primary-post.js';

test('set-event-primary-post integration tests', async (t) => {
  const suffix = Date.now();
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-sepp-' + suffix,
      platform: 'instagram',
      displayName: 'SEPP Test Account',
      username: 'sepp_test_' + suffix,
    })
    .returning();

  const [postA] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/sepp-a-' + suffix,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();

  const [postB] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/sepp-b-' + suffix,
      publishedAt: new Date('2026-01-02T00:00:00Z'),
    })
    .returning();

  const createdEventIds: string[] = [];

  t.after(async () => {
    if (createdEventIds.length > 0) {
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, createdEventIds));
      await db.delete(events).where(inArray(events.id, createdEventIds));
    }
    await db.delete(posts).where(inArray(posts.id, [postA.id, postB.id]));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('insert-path happy case: event + matching event_posts row both created', async () => {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: 'SEPP Happy ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: postA.id,
      sourceSocialMediaAccountId: profile.accountId,
    });

    assert.ok(inserted);
    createdEventIds.push(inserted!.id);
    assert.strictEqual(inserted!.postId, postA.id);
    assert.strictEqual(inserted!.extractionOrdinal, 0);

    const links = await db.select().from(eventPosts).where(eq(eventPosts.eventId, inserted!.id));
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].postId, postA.id);
    assert.strictEqual(links[0].extractionOrdinal, 0);
  });

  await t.test('insert-path idempotent duplicate: (postId, extractionOrdinal) conflict -> null, no duplicate rows', async () => {
    const before = await db.select().from(events).where(eq(events.postId, postA.id));
    assert.strictEqual(before.length, 1);

    const duplicate = await insertEventWithPrimaryPost(db, {
      eventName: 'SEPP Duplicate ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: postA.id,
      sourceSocialMediaAccountId: profile.accountId,
    });

    assert.strictEqual(duplicate, null);

    const after = await db.select().from(events).where(eq(events.postId, postA.id));
    assert.strictEqual(after.length, 1);

    const links = await db.select().from(eventPosts).where(eq(eventPosts.postId, postA.id));
    assert.strictEqual(links.length, 1);
  });

  await t.test('update-path promotion: existing event_posts row for the new primary already present (non-null ordinal)', async () => {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: 'SEPP Promotion Existing-Link ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: postB.id,
      sourceSocialMediaAccountId: profile.accountId,
    });
    assert.ok(inserted);
    createdEventIds.push(inserted!.id);

    // The event_posts(postB, 0) row already exists from the insert above; promoting the SAME
    // event back onto postB at ordinal 0 must upsert cleanly without violating the PK.
    await setEventPrimaryPost(db, { eventId: inserted!.id, postId: postB.id, extractionOrdinal: 0 });

    const links = await db
      .select()
      .from(eventPosts)
      .where(and(eq(eventPosts.eventId, inserted!.id), eq(eventPosts.postId, postB.id)));
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].extractionOrdinal, 0);
  });

  await t.test('update-path promotion: event_posts link absent entirely -> upserts a new row', async () => {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: 'SEPP Promotion New-Link ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: null,
      sourceSocialMediaAccountId: profile.accountId,
      // No postId -- simulates an event that starts with no primary post.
    });
    assert.ok(inserted);
    createdEventIds.push(inserted!.id);
    assert.strictEqual(inserted!.postId, null);

    const linksBefore = await db.select().from(eventPosts).where(eq(eventPosts.eventId, inserted!.id));
    assert.strictEqual(linksBefore.length, 0);

    await setEventPrimaryPost(db, { eventId: inserted!.id, postId: postA.id, extractionOrdinal: 5 });

    const linksAfter = await db
      .select()
      .from(eventPosts)
      .where(and(eq(eventPosts.eventId, inserted!.id), eq(eventPosts.postId, postA.id)));
    assert.strictEqual(linksAfter.length, 1);
    assert.strictEqual(linksAfter[0].extractionOrdinal, 5);

    const [updatedEvent] = await db.select().from(events).where(eq(events.id, inserted!.id));
    assert.strictEqual(updatedEvent.postId, postA.id);
    assert.strictEqual(updatedEvent.extractionOrdinal, 5);
  });

  await t.test('consistency invariant: every non-null events.postId has a matching event_posts row with an equal ordinal', async () => {
    // Once against freshly-backfilled/seeded data (every pre-existing row from migration 0065's
    // backfill plus this suite's own fixture data above).
    const inconsistentBefore = await findEventsInconsistentWithEventPosts(db);
    assert.deepStrictEqual(inconsistentBefore, []);

    // ...and once more after exercising both helper functions in this test file.
    const inconsistentAfter = await findEventsInconsistentWithEventPosts(db);
    assert.deepStrictEqual(inconsistentAfter, []);
  });
});

test('enrichAndPromoteEvent integration tests', async (t) => {
  const suffix = Date.now() + '-eape';

  const [organizerAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eape-organizer-' + suffix,
      platform: 'instagram',
      displayName: 'EAPE Organizer',
      username: 'eape_organizer_' + suffix,
      accountType: 'ORGANIZER_VENUE_EVENT',
      accountTypeStatus: 'CONFIRMED',
    })
    .returning();

  const [curatorAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eape-curator-' + suffix,
      platform: 'instagram',
      displayName: 'EAPE Curator',
      username: 'eape_curator_' + suffix,
      accountType: 'CURATOR_GUIDE',
      accountTypeStatus: 'CONFIRMED',
    })
    .returning();

  const [testUser] = await db
    .insert(users)
    .values({ email: 'eape-' + suffix + '@example.com', name: 'EAPE Test User' })
    .returning();

  const postIds: string[] = [];
  const eventIds: string[] = [];
  const scheduleIds: string[] = [];
  const userIds = [testUser.id];

  t.after(async () => {
    if (eventIds.length > 0) {
      await db.delete(favorites).where(inArray(favorites.eventId, eventIds));
      await db.delete(calendarAdditions).where(inArray(calendarAdditions.eventId, eventIds));
      await db.delete(corrections).where(inArray(corrections.eventId, eventIds));
      await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, eventIds));
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [organizerAccount.id, curatorAccount.id]));
  });

  async function makePost(accountId: string, urlSuffix: string, publishedAt = new Date('2026-01-01T00:00:00Z')) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId,
        platform: 'instagram',
        postUrl: `https://instagram.com/p/eape-${urlSuffix}-${suffix}`,
        publishedAt,
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  async function makeCandidate(opts: {
    accountId: string;
    postIdSuffix: string;
    eventName?: string;
    location?: string;
    scheduleDate?: string;
  }) {
    const post = await makePost(opts.accountId, opts.postIdSuffix);
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: opts.eventName ?? 'EAPE Candidate ' + suffix,
      location: opts.location ?? 'Original Location',
      hasPrivateContact: false,
      postId: post.id,
      sourceSocialMediaAccountId: opts.accountId,
    });
    if (!inserted) throw new Error('expected insert to succeed');
    eventIds.push(inserted.id);

    const [schedule] = await db
      .insert(schedules)
      .values({
        eventId: inserted.id,
        eventStartDate: opts.scheduleDate ?? '2026-05-01',
        isMainSchedule: true,
        location: opts.location ?? 'Original Location',
      })
      .returning();
    scheduleIds.push(schedule.id);

    return { event: inserted, post, schedule };
  }

  function newEventValues(overrides: Partial<EventInsertValues> = {}): EventInsertValues {
    return {
      postId: 'unused',
      sourceSocialMediaAccountId: 'unused',
      eventName: 'EAPE New Extraction ' + suffix,
      types: [],
      categories: [],
      location: 'New Location',
      hasPrivateContact: false,
      ...overrides,
    };
  }

  await t.test('primary stays: new post is curator-sourced, candidate stays organizer-authored -- enrichment only, no re-slug', async () => {
    // The candidate's own primary post is on the organizer account (organizer-authored); the
    // new post below is on the curator account (not organizer-authored) -- so AC2's first
    // tie-break rule alone decides this, deterministically, before any schedule/date comparison.
    const { event: candidate, post: candidatePrimaryPost, schedule } = await makeCandidate({
      accountId: organizerAccount.id,
      postIdSuffix: 'stays-candidate',
    });
    const newPost = await makePost(curatorAccount.id, 'stays-new');

    const linksBefore = await db.select().from(eventPosts).where(eq(eventPosts.eventId, candidate.id));
    assert.strictEqual(linksBefore.length, 1);

    const result = await enrichAndPromoteEvent(
      db,
      candidate,
      newEventValues({ eventName: 'EAPE New Name Should Not Win ' + suffix, location: 'New Location Should Not Win' }),
      [{ isMainSchedule: true, eventStartDate: '2026-05-01', location: 'New Location Should Not Win' }],
      newPost.id,
      0
    );

    assert.strictEqual(result.event.postId, candidatePrimaryPost.id); // unchanged -- primary did not move
    assert.strictEqual(result.event.slug, candidate.slug); // no re-slug
    assert.strictEqual(result.becameOrganizerAuthored, false);

    // Enrichment still applied (non-protected fields take the new extraction's value).
    assert.strictEqual(result.event.eventName, 'EAPE New Name Should Not Win ' + suffix);

    // The event still gains the new post's link even though it did not become primary.
    const linksAfter = await db.select().from(eventPosts).where(eq(eventPosts.eventId, candidate.id));
    assert.strictEqual(linksAfter.length, 2);

    // No alias was written -- the primary never moved.
    const aliases = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, candidate.id));
    assert.strictEqual(aliases.length, 0);

    // The schedule's location was enriched (matched by eventStartDate, not protected).
    const [updatedSchedule] = await db.select().from(schedules).where(eq(schedules.id, schedule.id));
    assert.strictEqual(updatedSchedule.location, 'New Location Should Not Win');
  });

  await t.test('primary flips: new post is organizer-authored, candidate was curator-sourced -- re-slug + alias written, event_posts gains exactly one row', async () => {
    const { event: candidate } = await makeCandidate({
      accountId: curatorAccount.id,
      postIdSuffix: 'flips-candidate',
      eventName: 'EAPE Flip Candidate ' + suffix,
    });
    const newPost = await makePost(organizerAccount.id, 'flips-new', new Date('2026-02-01T00:00:00Z'));
    const newSlug = 'eape-flip-new-slug-' + suffix;

    const linksBefore = await db.select().from(eventPosts).where(eq(eventPosts.eventId, candidate.id));
    assert.strictEqual(linksBefore.length, 1);

    const result = await enrichAndPromoteEvent(
      db,
      candidate,
      newEventValues({ eventName: 'EAPE Flip Candidate ' + suffix, slug: newSlug }),
      [{ isMainSchedule: true, eventStartDate: '2026-05-01' }],
      newPost.id,
      0
    );

    assert.strictEqual(result.event.postId, newPost.id); // promoted
    assert.strictEqual(result.event.slug, newSlug);
    assert.strictEqual(result.becameOrganizerAuthored, true);

    const aliases = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, candidate.id));
    assert.strictEqual(aliases.length, 1);
    assert.strictEqual(aliases[0].slug, candidate.slug); // the event's OLD slug became the alias

    const linksAfter = await db.select().from(eventPosts).where(eq(eventPosts.eventId, candidate.id));
    assert.strictEqual(linksAfter.length, 2); // gained exactly one row
  });

  await t.test('field-level correction protection: a corrected field survives an enrichment attempt that would otherwise overwrite it', async () => {
    const { event: candidate } = await makeCandidate({
      accountId: organizerAccount.id,
      postIdSuffix: 'protected-candidate',
      location: 'Protected Original Location',
    });
    const newPost = await makePost(curatorAccount.id, 'protected-new'); // curator -- never wins primary

    await db.insert(corrections).values({
      eventId: candidate.id,
      submittedByUserId: testUser.id,
      status: 'applied',
      source: 'manual',
      proposedData: {
        eventName: candidate.eventName,
        types: [],
        categories: [],
        location: 'Protected Original Location', // the moderator-confirmed value
        schedules: [],
      },
    });

    const result = await enrichAndPromoteEvent(
      db,
      candidate,
      newEventValues({ location: 'Attempted Overwrite Location' }),
      [],
      newPost.id,
      0
    );

    assert.strictEqual(result.event.location, 'Protected Original Location'); // never overwritten
  });

  await t.test('a schedule referenced by calendar_additions is never deleted even when absent from the new extraction', async () => {
    const { event: candidate, schedule } = await makeCandidate({
      accountId: organizerAccount.id,
      postIdSuffix: 'referenced-candidate',
      scheduleDate: '2026-06-01',
    });
    const newPost = await makePost(curatorAccount.id, 'referenced-new');

    await db.insert(calendarAdditions).values({ userId: testUser.id, eventId: candidate.id, scheduleId: schedule.id });

    // New extraction has a DIFFERENT date -- the old schedule has no date match.
    const newScheduleValues: ScheduleInsertValues[] = [{ isMainSchedule: true, eventStartDate: '2026-07-01' }];

    await enrichAndPromoteEvent(db, candidate, newEventValues(), newScheduleValues, newPost.id, 0);

    const stillThere = await db.select().from(schedules).where(eq(schedules.id, schedule.id));
    assert.strictEqual(stillThere.length, 1); // never deleted -- still referenced

    const allSchedules = await db.select().from(schedules).where(eq(schedules.eventId, candidate.id));
    assert.strictEqual(allSchedules.length, 2); // old (orphaned) + new (inserted)

    const calendarRow = await db.select().from(calendarAdditions).where(eq(calendarAdditions.scheduleId, schedule.id));
    assert.strictEqual(calendarRow.length, 1); // still resolves
  });

  await t.test('R-O-R alias reclaim: promoting back onto a slug that already exists as this event\'s own alias deletes it instead of duplicating', async () => {
    const { event: candidate } = await makeCandidate({
      accountId: curatorAccount.id,
      postIdSuffix: 'ror-candidate',
    });
    const originalSlug = candidate.slug;
    const postB = await makePost(organizerAccount.id, 'ror-b', new Date('2026-01-01T00:00:00Z'));
    // Also organizer-authored (ties AC2 rule 1 against postB), but published earlier -- wins
    // outright on AC2 rule 3 regardless of rule 1/2, so this promotion is deterministic.
    const postC = await makePost(organizerAccount.id, 'ror-c', new Date('2025-12-01T00:00:00Z'));

    // First flip: curator -> organizer (postB). originalSlug becomes an alias.
    const afterFirstFlip = await enrichAndPromoteEvent(
      db,
      candidate,
      newEventValues({ slug: 'eape-ror-slug-b-' + suffix }),
      [],
      postB.id,
      0
    );
    assert.strictEqual(afterFirstFlip.event.slug, 'eape-ror-slug-b-' + suffix);

    let aliases = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, candidate.id));
    assert.strictEqual(aliases.length, 1);
    assert.strictEqual(aliases[0].slug, originalSlug);

    // Second flip: postB -> postC (postC wins deterministically via AC2 rule 3, see above),
    // reverting the slug back to originalSlug -- which already exists as an alias of this same
    // event from the first flip. This exercises the R-O-R alias-reclaim branch.
    const afterReclaim = await enrichAndPromoteEvent(
      db,
      { ...afterFirstFlip.event },
      newEventValues({ slug: originalSlug }),
      [],
      postC.id,
      0
    );

    assert.strictEqual(afterReclaim.event.slug, originalSlug);

    aliases = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, candidate.id));
    // The reclaimed slug's alias row was deleted (not duplicated); the slug the event moved
    // AWAY from (eape-ror-slug-b) is now the alias instead.
    assert.strictEqual(aliases.length, 1);
    assert.strictEqual(aliases[0].slug, 'eape-ror-slug-b-' + suffix);
  });

  await t.test('AC9: promotion/enrichment never drops a favorite or calendar entry', async () => {
    const { event: candidate, schedule } = await makeCandidate({
      accountId: curatorAccount.id,
      postIdSuffix: 'ac9-candidate',
    });
    const newPost = await makePost(organizerAccount.id, 'ac9-new');

    const [favoriteRow] = await db.insert(favorites).values({ userId: testUser.id, eventId: candidate.id }).returning();
    const [calendarRow] = await db
      .insert(calendarAdditions)
      .values({ userId: testUser.id, eventId: candidate.id, scheduleId: schedule.id })
      .returning();

    // A high-confidence match that both enriches fields AND flips the primary (re-slug).
    await enrichAndPromoteEvent(
      db,
      candidate,
      newEventValues({ eventName: 'EAPE AC9 Enriched Name ' + suffix, slug: 'eape-ac9-slug-' + suffix }),
      [{ isMainSchedule: true, eventStartDate: '2026-05-01' }], // same date -- schedule updated in place
      newPost.id,
      0
    );

    const favoriteAfter = await db.select().from(favorites).where(eq(favorites.id, favoriteRow.id));
    assert.strictEqual(favoriteAfter.length, 1);
    assert.strictEqual(favoriteAfter[0].eventId, candidate.id);

    const calendarAfter = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, calendarRow.id));
    assert.strictEqual(calendarAfter.length, 1);
    assert.strictEqual(calendarAfter[0].eventId, candidate.id);
    assert.strictEqual(calendarAfter[0].scheduleId, schedule.id);

    // Both still resolve through the normal event/schedule rows, not just "the FK didn't throw".
    const [eventRow] = await db.select().from(events).where(eq(events.id, candidate.id));
    assert.strictEqual(eventRow.id, candidate.id);
    const [scheduleRow] = await db.select().from(schedules).where(eq(schedules.id, schedule.id));
    assert.strictEqual(scheduleRow.id, schedule.id);
  });
});
