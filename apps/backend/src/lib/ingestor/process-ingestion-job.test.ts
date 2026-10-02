import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, schedules } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { processIngestionJob } from './process-ingestion-job.js';
import { ExtractedEventMessage } from '@festgrid/domain';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { sendEventNotifications, setSendEventNotificationsSeam } from '../notifications/send-event-notifications.js';

test('processIngestionJob integration tests', async (t) => {
  const originalSendEventNotificationsSeam = sendEventNotifications;
  const accountId = 'acc-ingest-' + Date.now();
  const postId1 = 'post-ingest-1-' + Date.now();
  const postId2 = 'post-ingest-2-' + Date.now();
  const postId3 = 'post-ingest-3-' + Date.now();
  const postId4 = 'post-ingest-4-' + Date.now();

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

  // Cleanup: delete schedules, events, posts, profiles
  t.after(async () => {
    // delete all schedules linked to events we might have inserted
    const createdEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(inArray(events.postId, [seededPost1.id, seededPost2.id, seededPost3.id, seededPost4.id]));

    const eventIds = createdEvents.map((e) => e.id);
    if (eventIds.length > 0) {
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }

    await db.delete(posts).where(inArray(posts.id, [seededPost1.id, seededPost2.id, seededPost3.id, seededPost4.id]));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
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
    // Story 3.7g AC2 — seededPost1 has no platformPostId/platformPostType, so the legacy hex
    // fallback ($defaultFn) must have fired: unambiguous by shape, unchanged.
    assert.match(insertedEvent.slug, /^[0-9a-f]{12}$/);

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
    // Story 3.7g AC2 — seededPost2 also has no platformPostId/platformPostType.
    assert.match(insertedEvent.slug, /^[0-9a-f]{12}$/);

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
});
