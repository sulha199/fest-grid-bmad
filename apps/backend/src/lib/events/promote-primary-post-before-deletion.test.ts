import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, eventPosts, postAccountAssociations } from '@festgrid/database';
import { promotePrimaryPostBeforePostDeletion } from './promote-primary-post-before-deletion.js';

test('promotePrimaryPostBeforePostDeletion integration tests', async (t) => {
  const suffix = Date.now();
  const profileIds: string[] = [];
  const postIds: string[] = [];
  const eventIds: string[] = [];

  async function makeProfile(accountType: 'ORGANIZER_VENUE_EVENT' | 'CURATOR_GUIDE' | null = 'ORGANIZER_VENUE_EVENT') {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'acc-promo-' + Math.random().toString(36).slice(2) + '-' + suffix,
        platform: 'instagram',
        displayName: 'Promotion Test Account',
        username: 'promo_' + Math.random().toString(36).slice(2) + '_' + suffix,
        accountType: accountType ?? undefined,
        accountTypeStatus: accountType ? 'CONFIRMED' : undefined,
      })
      .returning();
    profileIds.push(profile.id);
    return profile;
  }

  async function makePost(accountId: string, publishedAt: string) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId,
        platform: 'instagram',
        postUrl: 'https://instagram.com/p/promo-' + Math.random().toString(36).slice(2) + '-' + suffix,
        publishedAt: new Date(publishedAt),
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  async function makeEvent(primaryPostId: string | null, ordinal: number | null) {
    const [event] = await db
      .insert(events)
      .values({
        eventName: 'Promotion Fixture ' + Math.random().toString(36).slice(2),
        location: 'Nowhere',
        hasPrivateContact: false,
        postId: primaryPostId,
        extractionOrdinal: ordinal,
      })
      .returning();
    eventIds.push(event.id);
    return event;
  }

  async function link(eventId: string, postId: string, ordinal: number | null) {
    await db.insert(eventPosts).values({ eventId, postId, extractionOrdinal: ordinal });
  }

  t.after(async () => {
    if (eventIds.length > 0) {
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    if (profileIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
    }
  });

  await t.test('no other linked post -> postId/extractionOrdinal both become null', async () => {
    const profile = await makeProfile();
    const postToDelete = await makePost(profile.id, '2026-01-01T00:00:00Z');
    const event = await makeEvent(postToDelete.id, 0);
    await link(event.id, postToDelete.id, 0);

    await db.transaction(async (tx) => {
      await promotePrimaryPostBeforePostDeletion(tx, postToDelete.id);
    });

    const [updated] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(updated.postId, null);
    assert.strictEqual(updated.extractionOrdinal, null);
  });

  await t.test('leg 1: one other linked post, organizer-authored, wins regardless of publishedAt/id ordering', async () => {
    const curatorProfile = await makeProfile('CURATOR_GUIDE');
    const organizerProfile = await makeProfile('ORGANIZER_VENUE_EVENT');
    const postToDelete = await makePost(curatorProfile.id, '2026-01-01T00:00:00Z');
    // The organizer-authored candidate is published LATER and would lose legs 3/4 -- leg 1 must
    // still win it.
    const organizerPost = await makePost(organizerProfile.id, '2026-06-01T00:00:00Z');
    await postAssociate(organizerPost.id, organizerProfile.id, 'PUBLISHER');

    const event = await makeEvent(postToDelete.id, 0);
    await link(event.id, postToDelete.id, 0);
    await link(event.id, organizerPost.id, 1);

    await db.transaction(async (tx) => {
      await promotePrimaryPostBeforePostDeletion(tx, postToDelete.id);
    });

    const [updated] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(updated.postId, organizerPost.id);
    assert.strictEqual(updated.extractionOrdinal, 1);
  });

  await t.test('leg 3: two other linked posts, neither organizer-authored, earlier publishedAt wins', async () => {
    const curatorProfile = await makeProfile('CURATOR_GUIDE');
    const postToDelete = await makePost(curatorProfile.id, '2026-01-01T00:00:00Z');
    const earlierPost = await makePost(curatorProfile.id, '2026-02-01T00:00:00Z');
    const laterPost = await makePost(curatorProfile.id, '2026-03-01T00:00:00Z');

    const event = await makeEvent(postToDelete.id, 0);
    await link(event.id, postToDelete.id, 0);
    await link(event.id, earlierPost.id, 1);
    await link(event.id, laterPost.id, 2);

    await db.transaction(async (tx) => {
      await promotePrimaryPostBeforePostDeletion(tx, postToDelete.id);
    });

    const [updated] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(updated.postId, earlierPost.id);
    assert.strictEqual(updated.extractionOrdinal, 1);
  });

  await t.test('leg 4: two other linked posts, identical publishedAt, lower id wins', async () => {
    const curatorProfile = await makeProfile('CURATOR_GUIDE');
    const postToDelete = await makePost(curatorProfile.id, '2026-01-01T00:00:00Z');
    const candidateA = await makePost(curatorProfile.id, '2026-05-01T00:00:00Z');
    const candidateB = await makePost(curatorProfile.id, '2026-05-01T00:00:00Z');
    const [lower, higher] = [candidateA, candidateB].sort((a, b) => (a.id < b.id ? -1 : 1));

    const event = await makeEvent(postToDelete.id, 0);
    await link(event.id, postToDelete.id, 0);
    await link(event.id, lower.id, 1);
    await link(event.id, higher.id, 2);

    await db.transaction(async (tx) => {
      await promotePrimaryPostBeforePostDeletion(tx, postToDelete.id);
    });

    const [updated] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(updated.postId, lower.id);
  });

  await t.test("winning candidate's existing link has a non-null ordinal -> reused as-is", async () => {
    const curatorProfile = await makeProfile('CURATOR_GUIDE');
    const postToDelete = await makePost(curatorProfile.id, '2026-01-01T00:00:00Z');
    const winner = await makePost(curatorProfile.id, '2026-02-01T00:00:00Z');

    const event = await makeEvent(postToDelete.id, 0);
    await link(event.id, postToDelete.id, 0);
    await link(event.id, winner.id, 7);

    await db.transaction(async (tx) => {
      await promotePrimaryPostBeforePostDeletion(tx, postToDelete.id);
    });

    const [updated] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(updated.postId, winner.id);
    assert.strictEqual(updated.extractionOrdinal, 7);
  });

  await t.test(
    "winning candidate's link has a null ordinal (manual link) and that post already has ordinals 0/1 used elsewhere -> assigns 2",
    async () => {
      const curatorProfile = await makeProfile('CURATOR_GUIDE');
      const postToDelete = await makePost(curatorProfile.id, '2026-01-01T00:00:00Z');
      const winner = await makePost(curatorProfile.id, '2026-02-01T00:00:00Z');

      // Simulates a future manual-linking feature's output -- no such feature exists yet. The
      // winner is already linked to two OTHER events at ordinals 0 and 1.
      const otherEvent1 = await makeEvent(winner.id, 0);
      await link(otherEvent1.id, winner.id, 0);
      const otherEvent2 = await makeEvent(winner.id, 1);
      await link(otherEvent2.id, winner.id, 1);

      const event = await makeEvent(postToDelete.id, 0);
      await link(event.id, postToDelete.id, 0);
      // Manual link to the winner on THIS event, with a null ordinal.
      await link(event.id, winner.id, null);

      await db.transaction(async (tx) => {
        await promotePrimaryPostBeforePostDeletion(tx, postToDelete.id);
      });

      const [updated] = await db.select().from(events).where(eq(events.id, event.id));
      assert.strictEqual(updated.postId, winner.id);
      assert.strictEqual(updated.extractionOrdinal, 2);
    }
  );

  async function postAssociate(postId: string, accountId: string, role: 'PUBLISHER' | 'COAUTHOR') {
    await db.insert(postAccountAssociations).values({ postId, accountId, role });
  }
});
