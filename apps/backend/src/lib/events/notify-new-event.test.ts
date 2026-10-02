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
