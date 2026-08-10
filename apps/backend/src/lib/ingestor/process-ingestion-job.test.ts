import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, schedules } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { processIngestionJob } from './process-ingestion-job.js';
import { ExtractedEventMessage } from '@festgrid/domain';
import { EventType, EventCategory } from '@festgrid/shared-types';

test('processIngestionJob integration tests', async (t) => {
  const accountId = 'acc-ingest-' + Date.now();
  const postId1 = 'post-ingest-1-' + Date.now();
  const postId2 = 'post-ingest-2-' + Date.now();

  let profile: any;
  let seededPost1: any;
  let seededPost2: any;

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
      content: 'Another event without a location details',
      postUrl: 'https://instagram.com/p/' + postId2,
      publishedAt: new Date(),
    })
    .returning();

  seededPost2 = post2;

  // Cleanup: delete schedules, events, posts, profiles
  t.after(async () => {
    // delete all schedules linked to events we might have inserted
    const createdEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(inArray(events.postId, [seededPost1.id, seededPost2.id]));

    const eventIds = createdEvents.map((e) => e.id);
    if (eventIds.length > 0) {
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }

    await db.delete(posts).where(inArray(posts.id, [seededPost1.id, seededPost2.id]));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('Happy path: inserts event and schedules correctly', async () => {
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

    const insertedSchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.eventId, insertedEvent.id));

    assert.strictEqual(insertedSchedules.length, 0);
  });
});
