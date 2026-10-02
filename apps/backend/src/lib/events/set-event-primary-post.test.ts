import test from 'node:test';
import * as assert from 'node:assert';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, eventPosts } from '@festgrid/database';
import { insertEventWithPrimaryPost, setEventPrimaryPost, findEventsInconsistentWithEventPosts } from './set-event-primary-post.js';

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
