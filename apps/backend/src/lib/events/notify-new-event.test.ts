import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events } from '@festgrid/database';
import { insertEventWithPrimaryPost } from './set-event-primary-post.js';
import { notifyNewEvent } from './notify-new-event.js';
import { sendEventNotifications, setSendEventNotificationsSeam } from '../notifications/send-event-notifications.js';

test('notify-new-event integration tests', async (t) => {
  const originalSendEventNotificationsSeam = sendEventNotifications;
  const suffix = Date.now();

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-nne-' + suffix,
      platform: 'instagram',
      displayName: 'NNE Test Account',
      username: 'nne_test_' + suffix,
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/nne-' + suffix,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();

  const createdEventIds: string[] = [];

  t.after(async () => {
    if (createdEventIds.length > 0) {
      await db.delete(events).where(inArray(events.id, createdEventIds));
    }
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    setSendEventNotificationsSeam(originalSendEventNotificationsSeam);
  });

  t.afterEach(() => {
    setSendEventNotificationsSeam(originalSendEventNotificationsSeam);
  });

  await t.test('a fresh event with notifiedAt: null claims successfully, sends once, notifiedAt becomes non-null', async () => {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: 'NNE Fresh ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: post.id,
      sourceSocialMediaAccountId: profile.accountId,
    });
    assert.ok(inserted);
    createdEventIds.push(inserted!.id);
    assert.strictEqual(inserted!.notifiedAt, null);

    let sendCallCount = 0;
    let sentEvent: any = null;
    let sentAccountId: any = null;
    setSendEventNotificationsSeam(async (evt, accId) => {
      sendCallCount++;
      sentEvent = evt;
      sentAccountId = accId;
    });

    await notifyNewEvent(
      db,
      { id: inserted!.id, slug: inserted!.slug, name: inserted!.eventName, description: inserted!.description || '' },
      profile.accountId
    );

    assert.strictEqual(sendCallCount, 1, 'sendEventNotificationsSeam should be called exactly once');
    assert.strictEqual(sentAccountId, profile.accountId);
    assert.strictEqual(sentEvent.id, inserted!.id);

    const [row] = await db.select().from(events).where(eq(events.id, inserted!.id));
    assert.ok(row.notifiedAt, 'events.notifiedAt should be non-null afterward');
  });

  // BUG-073 / AD-30 Rule 10 (amended 2026-10-21): the claim stays before the send, with one exception --
  // when the send fails before any FCM request is made (Firebase could not be initialised), the claim is
  // released so a later drain or re-drive can notify. Every other outcome keeps the claim.
  async function newClaimableEvent(label: string) {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: `NNE ${label} ${suffix}`,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: null,
      sourceSocialMediaAccountId: profile.accountId,
    });
    assert.ok(inserted);
    createdEventIds.push(inserted!.id);
    return inserted!;
  }

  const eventArg = (e: { id: string; slug: string; eventName: string; description: string | null }) => ({
    id: e.id,
    slug: e.slug,
    name: e.eventName,
    description: e.description || '',
  });

  await t.test('Firebase initialisation fails: the claim is released, so a later re-drive can still notify', async () => {
    const inserted = await newClaimableEvent('InitFails');
    let sendCalls = 0;
    setSendEventNotificationsSeam(async () => {
      sendCalls += 1;
      return { firebaseInitFailed: true };
    });

    await notifyNewEvent(db, eventArg(inserted), profile.accountId);

    assert.strictEqual(sendCalls, 1, 'the send was attempted once');
    const [afterFailure] = await db.select().from(events).where(eq(events.id, inserted.id));
    assert.strictEqual(afterFailure.notifiedAt, null, 'the claim is released because nothing could be sent');

    // The re-drive: Firebase works now, so the event notifies exactly once and stays claimed.
    setSendEventNotificationsSeam(async () => {
      sendCalls += 1;
      return { firebaseInitFailed: false };
    });
    await notifyNewEvent(db, eventArg(inserted), profile.accountId);
    await notifyNewEvent(db, eventArg(inserted), profile.accountId);

    assert.strictEqual(sendCalls, 2, 'the re-drive sent once; the repeat did not send again');
    const [afterRedrive] = await db.select().from(events).where(eq(events.id, inserted.id));
    assert.ok(afterRedrive.notifiedAt, 'claimed again after the successful send');
  });

  await t.test('a failure after a request was made keeps the claim and is never retried (a double send stays impossible)', async () => {
    const inserted = await newClaimableEvent('RequestFails');
    let sendCalls = 0;
    // sendEventNotifications reports a failed request as firebaseInitFailed: false.
    setSendEventNotificationsSeam(async () => {
      sendCalls += 1;
      return { firebaseInitFailed: false };
    });

    await notifyNewEvent(db, eventArg(inserted), profile.accountId);
    await notifyNewEvent(db, eventArg(inserted), profile.accountId);

    assert.strictEqual(sendCalls, 1);
    const [row] = await db.select().from(events).where(eq(events.id, inserted.id));
    assert.ok(row.notifiedAt, 'the claim is kept');
  });

  await t.test('a send that reports nothing keeps the claim, as before', async () => {
    const inserted = await newClaimableEvent('ReportsNothing');
    setSendEventNotificationsSeam(async () => {});

    await notifyNewEvent(db, eventArg(inserted), profile.accountId);

    const [row] = await db.select().from(events).where(eq(events.id, inserted.id));
    assert.ok(row.notifiedAt);
  });

  await t.test('the release only undoes this call\'s own claim: a marker someone else set meanwhile is left alone', async () => {
    const inserted = await newClaimableEvent('OtherClaim');
    const othersMarker = new Date(Date.now() + 3_600_000);
    setSendEventNotificationsSeam(async () => {
      await db.update(events).set({ notifiedAt: othersMarker }).where(eq(events.id, inserted.id));
      return { firebaseInitFailed: true };
    });

    await notifyNewEvent(db, eventArg(inserted), profile.accountId);

    const [row] = await db.select().from(events).where(eq(events.id, inserted.id));
    assert.strictEqual(row.notifiedAt?.getTime(), othersMarker.getTime(), 'not nulled: it is not the claim this call made');
  });

  await t.test('a second call on the same (now-claimed) event does not send again and notifiedAt stays unchanged', async () => {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: 'NNE Second-Call ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: null,
      sourceSocialMediaAccountId: profile.accountId,
    });
    assert.ok(inserted);
    createdEventIds.push(inserted!.id);

    let sendCallCount = 0;
    setSendEventNotificationsSeam(async () => {
      sendCallCount++;
    });

    await notifyNewEvent(
      db,
      { id: inserted!.id, slug: inserted!.slug, name: inserted!.eventName, description: inserted!.description || '' },
      profile.accountId
    );
    assert.strictEqual(sendCallCount, 1);

    const [afterFirst] = await db.select().from(events).where(eq(events.id, inserted!.id));
    const notifiedAtAfterFirst = afterFirst.notifiedAt;
    assert.ok(notifiedAtAfterFirst);

    await notifyNewEvent(
      db,
      { id: inserted!.id, slug: inserted!.slug, name: inserted!.eventName, description: inserted!.description || '' },
      profile.accountId
    );

    assert.strictEqual(sendCallCount, 1, 'sendEventNotificationsSeam should not be called again');

    const [afterSecond] = await db.select().from(events).where(eq(events.id, inserted!.id));
    assert.strictEqual(
      afterSecond.notifiedAt?.getTime(),
      notifiedAtAfterFirst?.getTime(),
      'notifiedAt should be unchanged by the second call'
    );
  });

  await t.test('an event seeded with a pre-existing notifiedAt fails the claim immediately, no send', async () => {
    const inserted = await insertEventWithPrimaryPost(db, {
      eventName: 'NNE Pre-Notified ' + suffix,
      location: 'Nowhere',
      hasPrivateContact: false,
      postId: null,
      sourceSocialMediaAccountId: profile.accountId,
    });
    assert.ok(inserted);
    createdEventIds.push(inserted!.id);

    const preExistingNotifiedAt = new Date('2026-05-01T00:00:00Z');
    await db.update(events).set({ notifiedAt: preExistingNotifiedAt }).where(eq(events.id, inserted!.id));

    let sendCallCount = 0;
    setSendEventNotificationsSeam(async () => {
      sendCallCount++;
    });

    await notifyNewEvent(
      db,
      { id: inserted!.id, slug: inserted!.slug, name: inserted!.eventName, description: inserted!.description || '' },
      profile.accountId
    );

    assert.strictEqual(sendCallCount, 0, 'sendEventNotificationsSeam should not be called when already notified');

    const [row] = await db.select().from(events).where(eq(events.id, inserted!.id));
    assert.strictEqual(row.notifiedAt?.getTime(), preExistingNotifiedAt.getTime());
  });
});
