import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, schedules, eventPosts, eventMatchCandidates, eventSlugAliases } from '@festgrid/database';
import { and, eq, inArray } from 'drizzle-orm';
import { processIngestionJob } from './process-ingestion-job.js';
import { ExtractedEventMessage } from '@festgrid/domain';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { sendEventNotifications, setSendEventNotificationsSeam } from '../notifications/send-event-notifications.js';

function baseExtractedEventMessage(overrides: Partial<ExtractedEventMessage> & { postId: string; sourceSocialMediaAccountId: string }): ExtractedEventMessage {
  return {
    eventName: 'Story 3.6t Test Event ' + Date.now(),
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    confidenceScore: 0.9,
    schedules: [],
    ...overrides,
  };
}

test('processIngestionJob integration tests', async (t) => {
  const originalSendEventNotificationsSeam = sendEventNotifications;
  const accountId = 'acc-ingest-' + Date.now();
  const postId1 = 'post-ingest-1-' + Date.now();
  const postId2 = 'post-ingest-2-' + Date.now();
  const postId3 = 'post-ingest-3-' + Date.now();
  const postId4 = 'post-ingest-4-' + Date.now();

  const extraSeededPostIds: string[] = [];
  let profile: any;
  let seededPost1: any;
  let seededPost2: any;
  let seededPost3: any;
  let seededPost4: any;

  // Insert mock profile and posts to fulfill foreign key constraints
  const [insertedProfile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: accountId,
      platform: 'instagram',
      displayName: 'Ingest Test Account',
      username: 'ingest_test_' + Date.now(),
    })
    .returning();

  profile = insertedProfile;

  const [post1] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Check out this awesome music festival!',
      postUrl: 'https://instagram.com/p/' + postId1,
      publishedAt: new Date(),
    })
    .returning();

  seededPost1 = post1;

  const [post2] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Another event without a location details',
      postUrl: 'https://instagram.com/p/' + postId2,
      publishedAt: new Date(),
    })
    .returning();

  seededPost2 = post2;

  // Story 3.7g — a third seeded post that carries platformPostId/platformPostType, so its
  // ingested event resolves a platform-prefixed slug (AC1) instead of the legacy hex fallback.
  const [post3] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post with a resolvable platform identity',
      postUrl: 'https://instagram.com/p/' + postId3,
      publishedAt: new Date(),
      platformPostId: 'Cx9uWttkSN',
      platformPostType: 'p',
    })
    .returning();

  seededPost3 = post3;

  // FIND-061 — a fourth seeded post, used only by the "does not resolve before the notification
  // seam resolves" regression test below.
  const [post4] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post used to prove notification dispatch is awaited',
      postUrl: 'https://instagram.com/p/' + postId4,
      publishedAt: new Date(),
    })
    .returning();

  seededPost4 = post4;

  // Story 3.6t (Task 9.1) — a fifth seeded post carrying platformPostId/platformPostType, used
  // for the multi-ordinal slug-suffix coverage (distinct from seededPost3, which already has its
  // own single-ordinal event inserted by the 3.7g test above).
  const postId5 = 'post-ingest-5-' + Date.now();
  const [post5] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post ingested with two events at different ordinals',
      postUrl: 'https://instagram.com/p/' + postId5,
      publishedAt: new Date(),
      platformPostId: 'Dz7vXuulTOR',
      platformPostType: 'p',
    })
    .returning();
  const seededPost5 = post5;

  // Story 3.6t (Task 9.2) — a sixth seeded post, used for the pre-3.6t-deploy message
  // (extractionOrdinal entirely absent) default-to-0 regression test (AC2).
  const postId6 = 'post-ingest-6-' + Date.now();
  const [post6] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post used for the pre-deploy-message default-ordinal regression test',
      postUrl: 'https://instagram.com/p/' + postId6,
      publishedAt: new Date(),
    })
    .returning();
  const seededPost6 = post6;

  // Story 3.6t (Task 9.3) — a seventh seeded post, used for the re-sending-the-same-ordinal
  // idempotent-skip regression test (AC6).
  const postId7 = 'post-ingest-7-' + Date.now();
  const [post7] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post used for the same-ordinal idempotent-skip regression test',
      postUrl: 'https://instagram.com/p/' + postId7,
      publishedAt: new Date(),
    })
    .returning();
  const seededPost7 = post7;

  // Story 3.6t (Task 9.4) — an eighth seeded post with groupingReason 'roundup', used for the
  // roundup-stub/no-notification test (AC3/AC5).
  const postId8 = 'post-ingest-8-' + Date.now();
  const [post8] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A roundup-sourced post',
      postUrl: 'https://instagram.com/p/' + postId8,
      publishedAt: new Date(),
      groupingReason: 'roundup',
    })
    .returning();
  const seededPost8 = post8;

  // Story 3.6t (Task 9.5) — a CURATOR_GUIDE-typed account (no post_account_associations rows,
  // exercising isOrganizerAuthoredPost's legacy fallback path) and a ninth seeded post under it
  // with groupingReason left null/non-roundup, used for the curator-stub/no-notification test.
  const [curatorProfile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-ingest-curator-' + Date.now(),
      platform: 'instagram',
      displayName: 'Ingest Curator Guide Account',
      username: 'ingest_curator_' + Date.now(),
      accountType: 'CURATOR_GUIDE',
    })
    .returning();

  const postId9 = 'post-ingest-9-' + Date.now();
  const [post9] = await db
    .insert(posts)
    .values({
      accountId: curatorProfile.id,
      platform: 'instagram',
      content: 'A curator-sourced post',
      postUrl: 'https://instagram.com/p/' + postId9,
      publishedAt: new Date(),
    })
    .returning();
  const seededPost9 = post9;

  // Story 3.6t (Task 9.6) — a tenth seeded post, a normal (non-roundup, non-curator) post used
  // for the explicit full-and-notified regression test.
  const postId10 = 'post-ingest-10-' + Date.now();
  const [post10] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A normal post, full detail, notification expected',
      postUrl: 'https://instagram.com/p/' + postId10,
      publishedAt: new Date(),
    })
    .returning();
  const seededPost10 = post10;

  // Story 3.6v (AC1) — an eleventh/twelfth seeded post pair used for the high-score match test:
  // post11 seeds the event, post12's extraction should enrich it in place instead of inserting.
  const postId11 = 'post-ingest-11-' + Date.now();
  const [post11] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post used to seed the high-score match target',
      postUrl: 'https://instagram.com/p/' + postId11,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();
  const seededPost11 = post11;

  const postId12 = 'post-ingest-12-' + Date.now();
  const [post12] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post whose extraction should high-score-match post11\'s event',
      postUrl: 'https://instagram.com/p/' + postId12,
      publishedAt: new Date('2026-01-01T01:00:00Z'),
    })
    .returning();
  const seededPost12 = post12;

  // Story 3.6v (AC1) — a thirteenth/fourteenth seeded post pair used for the mid-score match
  // test: post14's extraction should insert its OWN new event, plus one event_match_candidates
  // suggestion row pointing at post13's event.
  const postId13 = 'post-ingest-13-' + Date.now();
  const [post13] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post used to seed the mid-score match target',
      postUrl: 'https://instagram.com/p/' + postId13,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();
  const seededPost13 = post13;

  const postId14 = 'post-ingest-14-' + Date.now();
  const [post14] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'A post whose extraction should mid-score-match post13\'s event',
      postUrl: 'https://instagram.com/p/' + postId14,
      publishedAt: new Date('2026-01-01T01:00:00Z'),
    })
    .returning();
  const seededPost14 = post14;

  // Cleanup: delete schedules, events, posts, profiles
  t.after(async () => {
    const allSeededPostIds = [
      seededPost1.id,
      seededPost2.id,
      seededPost3.id,
      seededPost4.id,
      seededPost5.id,
      seededPost6.id,
      seededPost7.id,
      seededPost8.id,
      seededPost9.id,
      seededPost10.id,
      seededPost11.id,
      seededPost12.id,
      seededPost13.id,
      seededPost14.id,
      ...extraSeededPostIds,
    ];

    // delete all schedules/event_posts linked to events we might have inserted
    const createdEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(inArray(events.postId, allSeededPostIds));

    const eventIds = createdEvents.map((e) => e.id);
    if (eventIds.length > 0) {
      await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, eventIds));
      await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.candidateEventId, eventIds));
      await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, eventIds));
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }

    await db.delete(posts).where(inArray(posts.id, allSeededPostIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, curatorProfile.id));
    setSendEventNotificationsSeam(originalSendEventNotificationsSeam);
  });

  await t.test('Happy path: inserts event and schedules correctly', async (t) => {
    let sentEvent: any = null;
    let sentAccountId: any = null;

    setSendEventNotificationsSeam(async (evt: any, accId: string) => {
      sentEvent = evt;
      sentAccountId = accId;
    });

    t.after(() => {
      setSendEventNotificationsSeam(originalSendEventNotificationsSeam);
    });

    const message: ExtractedEventMessage = {
      postId: seededPost1.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Summer Jam ' + Date.now(),
      types: [EventType.FESTIVAL],
      categories: [EventCategory.MUSIC],
      location: 'Chicago, IL',
      confidenceScore: 0.99,
      organizerName: 'Chitown Organizers',
      contactInfo: 'chicago@jam.com',
      description: 'An amazing summer jam',
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-15',
          eventEndDate: '2026-08-16',
          eventStartTime: '12:00:00',
          eventEndTime: '22:00:00',
          title: 'Main Day',
          performers: ['Local Artist', 'DJ Chitown'],
          location: 'Grant Park',
          ticketPrice: '$35',
          locationDetails: {
            coordinates: {
              latitude: 41.8758,
              longitude: -87.6246,
            },
            placeName: 'Grant Park Chicago',
          },
          timezone: 'America/Chicago',
          timezoneStatus: 'RESOLVED',
        },
      ],
    };

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    // Verify event row exists
    const [insertedEvent] = await db
      .select()
      .from(events)
      .where(eq(events.postId, seededPost1.id));

    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.eventName, message.eventName);
    assert.strictEqual(insertedEvent.location, 'Chicago, IL');
    assert.strictEqual(insertedEvent.confidenceScore, 0.99);
    // seededPost1 has null platformPostId/platformPostType but a parseable permalink postUrl, so
    // ingestion derives the identity from the URL (not the legacy hex fallback) and heals the row.
    assert.strictEqual(insertedEvent.slug, `ig_p_${postId1}`);
    const [healedPost1] = await db.select().from(posts).where(eq(posts.id, seededPost1.id));
    assert.strictEqual(healedPost1.platformPostId, postId1);
    assert.strictEqual(healedPost1.platformPostType, 'p');

    // Verify schedules rows exist
    const insertedSchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.eventId, insertedEvent.id));

    assert.strictEqual(insertedSchedules.length, 1);
    const sched = insertedSchedules[0];
    assert.strictEqual(sched.title, 'Main Day');
    assert.strictEqual(sched.latitude, 41.8758);
    assert.strictEqual(sched.longitude, -87.6246);
    assert.strictEqual(sched.timezone, 'America/Chicago');
    assert.strictEqual(sched.timezoneStatus, 'RESOLVED');

    // Story 3.6r (AC3/Task 6.2) — insertEventWithPrimaryPost must also create the matching
    // event_posts link row alongside the inserted event.
    const links = await db
      .select()
      .from(eventPosts)
      .where(eq(eventPosts.eventId, insertedEvent.id));
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].postId, seededPost1.id);
    assert.strictEqual(links[0].extractionOrdinal, 0);

    // FIND-061: processIngestionJob now awaits the notification seam internally before
    // resolving, so no artificial tick is needed here to let it run.
    // Verify notifications was called with correct arguments
    assert.ok(sentEvent, 'Notification seam should have been invoked');
    assert.strictEqual(sentAccountId, message.sourceSocialMediaAccountId);
    assert.strictEqual(sentEvent.slug, insertedEvent.slug);
    assert.strictEqual(sentEvent.name, message.eventName);
    assert.strictEqual(sentEvent.description, message.description);
  });

  await t.test('Idempotency check: duplicate postId results in false and logs duplicate', async () => {
    const message: ExtractedEventMessage = {
      postId: seededPost1.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Summer Jam (Duplicate) ' + Date.now(),
      types: [EventType.FESTIVAL],
      categories: [EventCategory.MUSIC],
      location: 'Chicago, IL',
      confidenceScore: 0.99,
      schedules: [],
    };

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, false);
  });

  await t.test('Absent location fallback and zero schedules', async () => {
    const message: ExtractedEventMessage = {
      postId: seededPost2.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Online Meetup ' + Date.now(),
      types: [EventType.GATHERING],
      categories: [EventCategory.OTHER],
      confidenceScore: 0.8,
      schedules: [],
    };

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db
      .select()
      .from(events)
      .where(eq(events.postId, seededPost2.id));

    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.location, 'Location not specified');
    // seededPost2 also has null identity columns but a parseable postUrl.
    assert.strictEqual(insertedEvent.slug, `ig_p_${postId2}`);

    const insertedSchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.eventId, insertedEvent.id));

    assert.strictEqual(insertedSchedules.length, 0);
  });

  await t.test('Story 3.7g: builds a platform-prefixed slug when the source post resolves', async () => {
    const message: ExtractedEventMessage = {
      postId: seededPost3.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Platform Slug Event ' + Date.now(),
      types: [EventType.OTHER],
      categories: [EventCategory.OTHER],
      confidenceScore: 0.85,
      schedules: [],
    };

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db
      .select()
      .from(events)
      .where(eq(events.postId, seededPost3.id));

    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.slug, 'ig_p_Cx9uWttkSN');
  });

  await t.test('Story 3.7g AC2: a post whose URLs carry no parseable permalink keeps the legacy hex slug and stays null', async () => {
    const [unparseablePost] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        content: 'A post with no permalink-shaped URL',
        postUrl: 'https://example.com/story/unparseable-' + Date.now(),
        publishedAt: new Date(),
      })
      .returning();
    extraSeededPostIds.push(unparseablePost.id);

    const res = await processIngestionJob(
      baseExtractedEventMessage({ postId: unparseablePost.id, sourceSocialMediaAccountId: accountId })
    );
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db.select().from(events).where(eq(events.postId, unparseablePost.id));
    assert.match(insertedEvent.slug, /^[0-9a-f]{12}$/);
    const [unchangedPost] = await db.select().from(posts).where(eq(posts.id, unparseablePost.id));
    assert.strictEqual(unchangedPost.platformPostId, null);
    assert.strictEqual(unchangedPost.platformPostType, null);
  });

  await t.test('FIND-061: does not resolve until the notification seam has resolved', async (t) => {
    let seamResolved = false;

    setSendEventNotificationsSeam(async () => {
      // Simulate real async work (the recipient DB query + FCM send) so that, if
      // processIngestionJob ever regresses back to fire-and-forget, this flag would still be
      // false by the time processIngestionJob's own await returns -- proving the ordering.
      await new Promise((resolve) => setTimeout(resolve, 20));
      seamResolved = true;
    });

    t.after(() => {
      setSendEventNotificationsSeam(originalSendEventNotificationsSeam);
    });

    const message: ExtractedEventMessage = {
      postId: seededPost4.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Await Regression Event ' + Date.now(),
      types: [EventType.OTHER],
      categories: [EventCategory.OTHER],
      confidenceScore: 0.9,
      schedules: [],
    };

    const res = await processIngestionJob(message);

    assert.strictEqual(res.inserted, true);
    assert.strictEqual(
      seamResolved,
      true,
      'processIngestionJob resolved before the notification seam finished -- notification dispatch is no longer awaited'
    );
  });

  await t.test('Story 3.6t (Task 9.1): two messages with extractionOrdinal 0 and 1 for the same postId both insert, slug suffix only on ordinal > 0', async () => {
    const messageOrdinal0 = baseExtractedEventMessage({
      postId: seededPost5.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Multi-Ordinal Event Zero ' + Date.now(),
      extractionOrdinal: 0,
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }],
    });
    const messageOrdinal1 = baseExtractedEventMessage({
      postId: seededPost5.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Multi-Ordinal Event One ' + Date.now(),
      extractionOrdinal: 1,
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-02' }],
    });

    const res0 = await processIngestionJob(messageOrdinal0);
    const res1 = await processIngestionJob(messageOrdinal1);

    assert.strictEqual(res0.inserted, true);
    assert.strictEqual(res1.inserted, true);

    const insertedEvents = await db.select().from(events).where(eq(events.postId, seededPost5.id));
    assert.strictEqual(insertedEvents.length, 2);

    const eventOrdinal0 = insertedEvents.find((e) => e.extractionOrdinal === 0);
    const eventOrdinal1 = insertedEvents.find((e) => e.extractionOrdinal === 1);
    assert.ok(eventOrdinal0);
    assert.ok(eventOrdinal1);
    assert.strictEqual(eventOrdinal0!.slug, 'ig_p_Dz7vXuulTOR');
    assert.strictEqual(eventOrdinal1!.slug, 'ig_p_Dz7vXuulTOR~1');

    const links = await db.select().from(eventPosts).where(eq(eventPosts.postId, seededPost5.id));
    assert.strictEqual(links.length, 2);
    assert.ok(links.some((l) => l.eventId === eventOrdinal0!.id && l.extractionOrdinal === 0));
    assert.ok(links.some((l) => l.eventId === eventOrdinal1!.id && l.extractionOrdinal === 1));

    const schedulesOrdinal0 = await db.select().from(schedules).where(eq(schedules.eventId, eventOrdinal0!.id));
    const schedulesOrdinal1 = await db.select().from(schedules).where(eq(schedules.eventId, eventOrdinal1!.id));
    assert.strictEqual(schedulesOrdinal0.length, 1);
    assert.strictEqual(schedulesOrdinal1.length, 1);
  });

  await t.test('Story 3.6t (Task 9.2, AC2): a message with extractionOrdinal entirely absent is treated as ordinal 0', async () => {
    const message = baseExtractedEventMessage({
      postId: seededPost6.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Pre-Deploy Message Event ' + Date.now(),
      // extractionOrdinal intentionally omitted -- simulates a message enqueued before this
      // story's deploy (no such field on the producer side at all).
    });
    assert.strictEqual('extractionOrdinal' in message, false);

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db.select().from(events).where(eq(events.postId, seededPost6.id));
    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.extractionOrdinal, 0);
    // seededPost6 has null identity columns but a parseable postUrl, so the slug is derived and
    // unsuffixed -- confirms the ordinal-0 default didn't throw a validation error.
    assert.strictEqual(insertedEvent.slug, `ig_p_${postId6}`);
  });

  await t.test('Story 3.6t (Task 9.3, AC6): re-sending the same (postId, extractionOrdinal) pair a second time is an idempotent skip', async () => {
    let notifyCallCount = 0;
    setSendEventNotificationsSeam(async () => {
      notifyCallCount++;
    });

    const message = baseExtractedEventMessage({
      postId: seededPost7.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Same-Ordinal Resend Event ' + Date.now(),
      extractionOrdinal: 0,
    });

    const firstRes = await processIngestionJob(message);
    assert.strictEqual(firstRes.inserted, true);
    assert.strictEqual(notifyCallCount, 1);

    const eventsAfterFirst = await db.select().from(events).where(eq(events.postId, seededPost7.id));
    assert.strictEqual(eventsAfterFirst.length, 1);
    const linksAfterFirst = await db.select().from(eventPosts).where(eq(eventPosts.postId, seededPost7.id));
    assert.strictEqual(linksAfterFirst.length, 1);

    const secondRes = await processIngestionJob(message);
    assert.strictEqual(secondRes.inserted, false, 'Resending the same (postId, extractionOrdinal) must be an idempotent skip (AC6)');
    assert.strictEqual(notifyCallCount, 1, 'The notify claim must not be invoked a second time for the skipped resend');

    const eventsAfterSecond = await db.select().from(events).where(eq(events.postId, seededPost7.id));
    assert.strictEqual(eventsAfterSecond.length, 1, 'No second event row should be created');
    const linksAfterSecond = await db.select().from(eventPosts).where(eq(eventPosts.postId, seededPost7.id));
    assert.strictEqual(linksAfterSecond.length, 1, 'No second event_posts row should be created');
  });

  await t.test('Story 3.6t (Task 9.4, AC3/AC5): a roundup-sourced post ingests as a stub event with no notification', async () => {
    let notifyCallCount = 0;
    setSendEventNotificationsSeam(async () => {
      notifyCallCount++;
    });

    const message = baseExtractedEventMessage({
      postId: seededPost8.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Roundup-Sourced Event ' + Date.now(),
    });

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db.select().from(events).where(eq(events.postId, seededPost8.id));
    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.detailLevel, 'stub');
    assert.strictEqual(insertedEvent.notifiedAt, null);
    assert.strictEqual(notifyCallCount, 0, 'No push notification should be sent for a roundup-sourced event');
  });

  await t.test('Story 3.6t (Task 9.5, AD-31 Rule 3): a CURATOR_GUIDE-authored post (legacy fallback) ingests as a stub event with no notification, even when non-roundup', async () => {
    let notifyCallCount = 0;
    setSendEventNotificationsSeam(async () => {
      notifyCallCount++;
    });

    const message = baseExtractedEventMessage({
      postId: seededPost9.id,
      sourceSocialMediaAccountId: curatorProfile.accountId,
      eventName: 'Curator-Sourced Event ' + Date.now(),
    });

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db.select().from(events).where(eq(events.postId, seededPost9.id));
    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.detailLevel, 'stub');
    assert.strictEqual(insertedEvent.notifiedAt, null);
    assert.strictEqual(notifyCallCount, 0, 'No push notification should be sent for a curator-sourced event, even though groupingReason is not roundup');
  });

  await t.test('Story 3.6t (Task 9.6): a normal (non-roundup, non-curator) post ingests full detail and sends a notification', async () => {
    let notifyCallCount = 0;
    setSendEventNotificationsSeam(async () => {
      notifyCallCount++;
    });

    const message = baseExtractedEventMessage({
      postId: seededPost10.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Normal Full-Detail Event ' + Date.now(),
    });

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db.select().from(events).where(eq(events.postId, seededPost10.id));
    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.detailLevel, 'full');
    assert.ok(insertedEvent.notifiedAt, 'notifiedAt should be non-null after a successful notify');
    assert.strictEqual(notifyCallCount, 1, 'A normal post should trigger exactly one notification send');
  });

  await t.test('Story 3.6v (AC1): a high-score match enriches the existing event in place instead of inserting a new row', async () => {
    const sharedSuffix = Date.now();
    const seedMessage = baseExtractedEventMessage({
      postId: seededPost11.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'High Score Match Event ' + sharedSuffix,
      location: 'Original Location',
      links: [{ url: 'https://tickets.example.com/high-' + sharedSuffix }],
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-01', location: 'Shared Venue' }],
    });

    const seedRes = await processIngestionJob(seedMessage);
    assert.strictEqual(seedRes.inserted, true);
    const [seedEvent] = await db.select().from(events).where(eq(events.postId, seededPost11.id));
    assert.ok(seedEvent);

    // Same name, same date, same shared link, same venue -- organizer (0.40) + sharedLink
    // (0.20) + dateNameSimilarity (~0.25) + venue (0.15) is at or near the maximum score, well
    // above the 0.75 high threshold regardless of exact trigram-similarity rounding.
    const matchMessage = baseExtractedEventMessage({
      postId: seededPost12.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'High Score Match Event ' + sharedSuffix,
      location: 'Enriched Location',
      links: [{ url: 'HTTPS://TICKETS.EXAMPLE.COM/high-' + sharedSuffix + '/' }],
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-01', location: 'shared venue' }],
    });

    const matchRes = await processIngestionJob(matchMessage);
    assert.strictEqual(matchRes.inserted, true);

    // No new event row for post12 -- only the one seeded event exists for this pair.
    const allEventsForPair = await db
      .select()
      .from(events)
      .where(inArray(events.postId, [seededPost11.id, seededPost12.id]));
    assert.strictEqual(allEventsForPair.length, 1);
    assert.strictEqual(allEventsForPair[0].id, seedEvent.id);

    // Enrichment applied in place.
    assert.strictEqual(allEventsForPair[0].location, 'Enriched Location');

    // event_posts gains the new post's link (2 rows total for the one event: post11 + post12).
    const links = await db.select().from(eventPosts).where(eq(eventPosts.eventId, seedEvent.id));
    assert.strictEqual(links.length, 2);
    assert.ok(links.some((l) => l.postId === seededPost11.id));
    assert.ok(links.some((l) => l.postId === seededPost12.id));

    // AC8: re-sending the exact same (postId, extractionOrdinal) a second time is an idempotent
    // skip -- no duplicate event, link, or suggestion row.
    const rerunRes = await processIngestionJob(matchMessage);
    assert.strictEqual(rerunRes.inserted, false);

    const linksAfterRerun = await db.select().from(eventPosts).where(eq(eventPosts.eventId, seedEvent.id));
    assert.strictEqual(linksAfterRerun.length, 2, 'Resending the matched message must not duplicate the event_posts link');

    const allEventsAfterRerun = await db
      .select()
      .from(events)
      .where(inArray(events.postId, [seededPost11.id, seededPost12.id]));
    assert.strictEqual(allEventsAfterRerun.length, 1, 'Resending the matched message must not create a duplicate event');
  });

  await t.test('Story 3.6v (AC1): a mid-score match inserts a new event AND writes exactly one event_match_candidates row', async () => {
    const midSuffix = Date.now();
    const seedMessage = baseExtractedEventMessage({
      postId: seededPost13.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Mid Score Seed Event ' + midSuffix,
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-10-01' }],
    });
    const seedRes = await processIngestionJob(seedMessage);
    assert.strictEqual(seedRes.inserted, true);
    const [seedEvent] = await db.select().from(events).where(eq(events.postId, seededPost13.id));
    assert.ok(seedEvent);

    // Same account (organizerMatch 0.40) and the IDENTICAL name (nameSim exactly 1.0, removing
    // any trigram-threshold flakiness) but a date 1 day apart (dateProximity 0.5) -- no shared
    // link, no venue match -- caps the composite score at 0.4 + 0.25*avg(1, 0.5) = 0.5875,
    // squarely inside the 0.45-0.75 mid band and well below the 0.75 high threshold.
    const midMessage = baseExtractedEventMessage({
      postId: seededPost14.id,
      sourceSocialMediaAccountId: accountId,
      eventName: 'Mid Score Seed Event ' + midSuffix,
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-10-02' }], // 1 day apart
    });

    const midRes = await processIngestionJob(midMessage);
    assert.strictEqual(midRes.inserted, true);

    // A NEW event row was inserted for post14 (not an enrichment of post13's event).
    const [midEvent] = await db.select().from(events).where(eq(events.postId, seededPost14.id));
    assert.ok(midEvent);
    assert.notStrictEqual(midEvent.id, seedEvent.id);

    // Exactly one suggestion row, pointing the new event at the seed candidate.
    const suggestions = await db
      .select()
      .from(eventMatchCandidates)
      .where(and(eq(eventMatchCandidates.eventId, midEvent.id), eq(eventMatchCandidates.candidateEventId, seedEvent.id)));
    assert.strictEqual(suggestions.length, 1);
    assert.ok(suggestions[0].score >= 0.45 && suggestions[0].score < 0.75, `expected a mid-tier score, got ${suggestions[0].score}`);

    // AC8: re-sending the same message a second time writes no duplicate suggestion row.
    await processIngestionJob(midMessage);
    const suggestionsAfterRerun = await db
      .select()
      .from(eventMatchCandidates)
      .where(and(eq(eventMatchCandidates.eventId, midEvent.id), eq(eventMatchCandidates.candidateEventId, seedEvent.id)));
    assert.strictEqual(suggestionsAfterRerun.length, 1, 'Resending the same message must not duplicate the suggestion row');
  });

  await t.test('Story 3.6v (AC1): a low-score/no-candidate case is unchanged from pre-story behavior', async () => {
    // A wholly unique name/date with nothing else in the suite sharing it -- no SQL candidate
    // passes the trigram pre-filter at all, so findMatchingEvent returns null and the plain
    // insert path (identical to pre-story behavior) is taken.
    const message = baseExtractedEventMessage({
      postId: seededPost10.id, // reuses an already-ingested post; extractionOrdinal defaults to 0
      sourceSocialMediaAccountId: accountId,
      eventName: 'Zzyx Qvwk No Candidate Event ' + Date.now(),
      extractionOrdinal: 7,
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-11-15' }],
    });

    const res = await processIngestionJob(message);
    assert.strictEqual(res.inserted, true);

    const [insertedEvent] = await db
      .select()
      .from(events)
      .where(and(eq(events.postId, seededPost10.id), eq(events.extractionOrdinal, 7)));
    assert.ok(insertedEvent);
    assert.strictEqual(insertedEvent.eventName, message.eventName);

    const matchCandidateRows = await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.eventId, insertedEvent.id));
    assert.strictEqual(matchCandidateRows.length, 0, 'No suggestion row should be written for a low/no-candidate insert');
  });
});
