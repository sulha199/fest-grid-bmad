import test from 'node:test';
import * as assert from 'node:assert';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  socialMediaAccountProfiles,
  posts,
  events,
  schedules,
  favorites,
  calendarAdditions,
  reports,
  eventPosts,
  eventSlugAliases,
  eventMatchCandidates,
  eventMerges,
  users,
} from '@festgrid/database';
import {
  mergeEvents,
  undoEventMerge,
  EventMergeInvalidStateError,
  EventMergeNotFoundError,
  EventMergeAlreadyUndoneError,
} from './merge-events.js';

test('mergeEvents / undoEventMerge integration tests', async (t) => {
  const suffix = Date.now() + '-merge';

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-merge-' + suffix,
      platform: 'instagram',
      displayName: 'Merge Test Account',
      username: 'merge_test_' + suffix,
    })
    .returning();

  const [postShared] = await db
    .insert(posts)
    .values({ accountId: profile.id, platform: 'instagram', postUrl: 'https://instagram.com/p/merge-shared-' + suffix, publishedAt: new Date('2026-01-01T00:00:00Z') })
    .returning();
  const [postB] = await db
    .insert(posts)
    .values({ accountId: profile.id, platform: 'instagram', postUrl: 'https://instagram.com/p/merge-b-' + suffix, publishedAt: new Date('2026-01-02T00:00:00Z') })
    .returning();

  const [moderator] = await db
    .insert(users)
    .values({ email: 'merge-mod-' + suffix + '@example.com', name: 'Merge Moderator', role: 'moderator' })
    .returning();
  const [userX] = await db.insert(users).values({ email: 'merge-x-' + suffix + '@example.com', name: 'User X' }).returning();
  const [userY] = await db.insert(users).values({ email: 'merge-y-' + suffix + '@example.com', name: 'User Y' }).returning();
  const [userZ] = await db.insert(users).values({ email: 'merge-z-' + suffix + '@example.com', name: 'User Z' }).returning();

  const createdEventIds: string[] = [];
  const createdUserIds = [userX.id, userY.id, userZ.id, moderator.id];

  t.after(async () => {
    await db.delete(reports).where(inArray(reports.eventId, createdEventIds));
    await db.delete(calendarAdditions).where(inArray(calendarAdditions.userId, createdUserIds));
    await db.delete(favorites).where(inArray(favorites.userId, createdUserIds));
    await db.delete(eventPosts).where(inArray(eventPosts.eventId, createdEventIds));
    await db.delete(eventMerges).where(inArray(eventMerges.winnerEventId, createdEventIds));
    await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, createdEventIds));
    await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, createdEventIds));
    await db.delete(schedules).where(inArray(schedules.eventId, createdEventIds));
    await db.delete(events).where(inArray(events.id, createdEventIds));
    await db.delete(posts).where(inArray(posts.id, [postShared.id, postB.id]));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  // --- Winner (A) fixture ---
  const [winner] = await db.insert(events).values({ eventName: 'Merge Winner ' + suffix, location: 'Nowhere' }).returning();
  createdEventIds.push(winner.id);
  const [scheduleA1] = await db.insert(schedules).values({ eventId: winner.id, eventStartDate: '2026-06-01' }).returning();
  await db.insert(eventPosts).values({ eventId: winner.id, postId: postShared.id, extractionOrdinal: 0 });
  await db.insert(favorites).values({ userId: userY.id, eventId: winner.id });
  await db.insert(calendarAdditions).values({ userId: userY.id, eventId: winner.id, scheduleId: scheduleA1.id });
  const [preExistingAliasForWinner] = await db
    .insert(eventSlugAliases)
    .values({ slug: 'old-slug-of-loser-' + suffix, eventId: winner.id })
    .returning();
  // ^ deliberately wrong target to start -- repointed below; see its reuse once the loser exists.

  // --- Loser (B) fixture ---
  const loserNotifiedAt = new Date('2026-01-05T00:00:00Z');
  const [loser] = await db
    .insert(events)
    .values({ eventName: 'Merge Loser ' + suffix, location: 'Nowhere', notifiedAt: loserNotifiedAt })
    .returning();
  createdEventIds.push(loser.id);
  const [scheduleB1] = await db.insert(schedules).values({ eventId: loser.id, eventStartDate: '2026-06-01' }).returning(); // matches scheduleA1's date
  const [scheduleB2] = await db
    .insert(schedules)
    .values({ eventId: loser.id, eventStartDate: '2026-07-01', isMainSchedule: false })
    .returning(); // no match on winner
  await db.insert(eventPosts).values({ eventId: loser.id, postId: postB.id, extractionOrdinal: 0 });
  await db.insert(eventPosts).values({ eventId: loser.id, postId: postShared.id, extractionOrdinal: 1 }); // already linked to winner too

  const [favUnique] = await db.insert(favorites).values({ userId: userX.id, eventId: loser.id }).returning();
  const [favDup] = await db.insert(favorites).values({ userId: userY.id, eventId: loser.id }).returning(); // userY already favorites winner

  const [caRepoint] = await db.insert(calendarAdditions).values({ userId: userX.id, eventId: loser.id, scheduleId: scheduleB1.id }).returning();
  const [caDedup] = await db.insert(calendarAdditions).values({ userId: userY.id, eventId: loser.id, scheduleId: scheduleB1.id }).returning(); // userY already has winner/scheduleA1
  const [caCopy] = await db.insert(calendarAdditions).values({ userId: userZ.id, eventId: loser.id, scheduleId: scheduleB2.id }).returning();

  const [report1] = await db.insert(reports).values({ eventId: loser.id, reporterUserId: userX.id, reason: 'cancelled' }).returning();

  // Fix up the pre-existing alias to actually target the loser (needed the loser's id to exist first).
  await db.update(eventSlugAliases).set({ eventId: loser.id }).where(eq(eventSlugAliases.id, preExistingAliasForWinner.id));

  let mergeId = '';

  await t.test('mergeEvents: full happy-path repoint/dedupe/copy across every table', async () => {
    const result = await mergeEvents(db, winner.id, loser.id, moderator.id, null);
    mergeId = result.merge.id;

    assert.strictEqual(result.merge.winnerEventId, winner.id);
    assert.strictEqual(result.merge.loserEventId, loser.id);
    assert.strictEqual(result.merge.suggestionId, null);
    assert.strictEqual(result.merge.performedByModeratorId, moderator.id);
    assert.strictEqual(result.merge.loserPriorSlug, loser.slug);
    assert.strictEqual(result.merge.winnerNotifiedAtChanged, true);
    assert.strictEqual(result.merge.winnerPriorNotifiedAt, null);
    assert.strictEqual(result.merge.loserPriorNotifiedAt?.toISOString(), loserNotifiedAt.toISOString());
    assert.strictEqual(result.winner.notifiedAt?.toISOString(), loserNotifiedAt.toISOString());

    // Favorites
    assert.deepStrictEqual(new Set(result.merge.repointedFavoriteIds), new Set([favUnique.id]));
    assert.deepStrictEqual(new Set(result.merge.dedupedFavoriteIds), new Set([favDup.id]));
    const [favUniqueRow] = await db.select().from(favorites).where(eq(favorites.id, favUnique.id));
    assert.strictEqual(favUniqueRow.eventId, winner.id);
    const [favDupRow] = await db.select().from(favorites).where(eq(favorites.id, favDup.id));
    assert.ok(favDupRow.deletedAt !== null);

    // Calendar additions
    assert.strictEqual(result.merge.repointedCalendarAdditionIds.length, 2); // caRepoint + caCopy
    const repointedCaIds = result.merge.repointedCalendarAdditionIds.map((r) => r.id);
    assert.ok(repointedCaIds.includes(caRepoint.id));
    assert.ok(repointedCaIds.includes(caCopy.id));
    assert.deepStrictEqual(result.merge.dedupedCalendarAdditionIds, [caDedup.id]);

    const [caRepointRow] = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, caRepoint.id));
    assert.strictEqual(caRepointRow.eventId, winner.id);
    assert.strictEqual(caRepointRow.scheduleId, scheduleA1.id); // date-matched onto the winner's existing schedule

    const [caDedupRow] = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, caDedup.id));
    assert.ok(caDedupRow.deletedAt !== null);

    const [caCopyRow] = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, caCopy.id));
    assert.strictEqual(caCopyRow.eventId, winner.id);
    assert.notStrictEqual(caCopyRow.scheduleId, scheduleB2.id); // moved onto a NEW copy, not the loser's own schedule
    const [copiedSchedule] = await db.select().from(schedules).where(eq(schedules.id, caCopyRow.scheduleId));
    assert.strictEqual(copiedSchedule.eventId, winner.id);
    assert.strictEqual(copiedSchedule.eventStartDate, scheduleB2.eventStartDate);
    assert.strictEqual(copiedSchedule.isMainSchedule, false);

    // Reports
    assert.deepStrictEqual(result.merge.repointedReportIds, [report1.id]);
    const [report1Row] = await db.select().from(reports).where(eq(reports.id, report1.id));
    assert.strictEqual(report1Row.eventId, winner.id);

    // event_posts: only postB (loser-only) repoints; the shared post's loser-side row is untouched
    assert.deepStrictEqual(result.merge.repointedEventPostIds, [postB.id]);
    const [postBLink] = await db.select().from(eventPosts).where(and(eq(eventPosts.postId, postB.id), eq(eventPosts.eventId, winner.id)));
    assert.ok(postBLink);
    const [sharedLoserLink] = await db
      .select()
      .from(eventPosts)
      .where(and(eq(eventPosts.postId, postShared.id), eq(eventPosts.eventId, loser.id)));
    assert.ok(sharedLoserLink); // still exists, untouched, on the (now soft-deleted) loser

    // Slug aliases: the loser's own slug becomes an alias of the winner, and the pre-existing
    // alias that targeted the loser is repointed too.
    const [newAliasForLoserSlug] = await db
      .select()
      .from(eventSlugAliases)
      .where(and(eq(eventSlugAliases.slug, loser.slug), eq(eventSlugAliases.eventId, winner.id)));
    assert.ok(newAliasForLoserSlug);
    assert.deepStrictEqual(result.merge.repointedAliasIds, [preExistingAliasForWinner.id]);
    const [repointedAliasRow] = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.id, preExistingAliasForWinner.id));
    assert.strictEqual(repointedAliasRow.eventId, winner.id);

    // The loser itself
    const [loserRow] = await db.select().from(events).where(eq(events.id, loser.id));
    assert.ok(loserRow.deletedAt !== null);
    assert.strictEqual(loserRow.mergedIntoEventId, winner.id);
  });

  await t.test('undoEventMerge: reverses every repoint/dedupe/copy exactly', async () => {
    const restored = await undoEventMerge(db, mergeId, moderator.id);
    assert.strictEqual(restored.id, loser.id);
    assert.strictEqual(restored.deletedAt, null);
    assert.strictEqual(restored.mergedIntoEventId, null);
    assert.strictEqual(restored.slug, loser.slug);
    assert.strictEqual(restored.notifiedAt?.toISOString(), loserNotifiedAt.toISOString());

    const [winnerRow] = await db.select().from(events).where(eq(events.id, winner.id));
    assert.strictEqual(winnerRow.notifiedAt, null);

    const [favUniqueRow] = await db.select().from(favorites).where(eq(favorites.id, favUnique.id));
    assert.strictEqual(favUniqueRow.eventId, loser.id);
    const [favDupRow] = await db.select().from(favorites).where(eq(favorites.id, favDup.id));
    assert.strictEqual(favDupRow.deletedAt, null);

    const [caRepointRow] = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, caRepoint.id));
    assert.strictEqual(caRepointRow.eventId, loser.id);
    assert.strictEqual(caRepointRow.scheduleId, scheduleB1.id);
    const [caDedupRow] = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, caDedup.id));
    assert.strictEqual(caDedupRow.deletedAt, null);
    const [caCopyRow] = await db.select().from(calendarAdditions).where(eq(calendarAdditions.id, caCopy.id));
    assert.strictEqual(caCopyRow.eventId, loser.id);
    assert.strictEqual(caCopyRow.scheduleId, scheduleB2.id);

    const [report1Row] = await db.select().from(reports).where(eq(reports.id, report1.id));
    assert.strictEqual(report1Row.eventId, loser.id);

    const [postBLinkAfterUndo] = await db.select().from(eventPosts).where(and(eq(eventPosts.postId, postB.id), eq(eventPosts.eventId, loser.id)));
    assert.ok(postBLinkAfterUndo);

    const aliasRowsForLoserSlug = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.slug, loser.slug));
    assert.strictEqual(aliasRowsForLoserSlug.filter((r) => r.eventId === winner.id).length, 0); // the merge-created alias is gone
    const [repointedAliasAfterUndo] = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.id, preExistingAliasForWinner.id));
    assert.strictEqual(repointedAliasAfterUndo.eventId, loser.id);

    const [mergeRow] = await db.select().from(eventMerges).where(eq(eventMerges.id, mergeId));
    assert.ok(mergeRow.undoneAt !== null);
  });

  await t.test('undoEventMerge: undo-after-undo is rejected', async () => {
    await assert.rejects(() => undoEventMerge(db, mergeId, moderator.id), EventMergeAlreadyUndoneError);
  });

  await t.test('undoEventMerge: unknown mergeId is rejected', async () => {
    await assert.rejects(() => undoEventMerge(db, '00000000-0000-0000-0000-000000000000', moderator.id), EventMergeNotFoundError);
  });

  await t.test('mergeEvents: rejects winnerId === loserId', async () => {
    await assert.rejects(() => mergeEvents(db, winner.id, winner.id, moderator.id, null), EventMergeInvalidStateError);
  });

  await t.test('mergeEvents: rejects an already soft-deleted loser', async () => {
    const [deletedEvent] = await db
      .insert(events)
      .values({ eventName: 'Already Deleted ' + suffix, location: 'Nowhere', deletedAt: new Date() })
      .returning();
    createdEventIds.push(deletedEvent.id);
    await assert.rejects(() => mergeEvents(db, winner.id, deletedEvent.id, moderator.id, null), EventMergeInvalidStateError);
  });

  await t.test('mergeEvents: rejects a winner that is itself already merged', async () => {
    const [alreadyMergedWinner] = await db
      .insert(events)
      .values({ eventName: 'Already Merged Winner ' + suffix, location: 'Nowhere', deletedAt: new Date(), mergedIntoEventId: winner.id })
      .returning();
    const [freshLoser] = await db.insert(events).values({ eventName: 'Fresh Loser ' + suffix, location: 'Nowhere' }).returning();
    createdEventIds.push(alreadyMergedWinner.id, freshLoser.id);
    await assert.rejects(() => mergeEvents(db, alreadyMergedWinner.id, freshLoser.id, moderator.id, null), EventMergeInvalidStateError);
  });

  await t.test('mergeEvents: notified_at -- winner is later, so it takes the loser\'s earlier value', async () => {
    const [laterWinner] = await db
      .insert(events)
      .values({ eventName: 'NotifiedAt Winner ' + suffix, location: 'Nowhere', notifiedAt: new Date('2026-09-01T00:00:00Z') })
      .returning();
    const [earlierLoser] = await db
      .insert(events)
      .values({ eventName: 'NotifiedAt Loser ' + suffix, location: 'Nowhere', notifiedAt: new Date('2026-08-01T00:00:00Z') })
      .returning();
    createdEventIds.push(laterWinner.id, earlierLoser.id);

    const result = await mergeEvents(db, laterWinner.id, earlierLoser.id, moderator.id, null);
    assert.strictEqual(result.merge.winnerNotifiedAtChanged, true);
    assert.strictEqual(result.merge.winnerPriorNotifiedAt?.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.strictEqual(result.winner.notifiedAt?.toISOString(), '2026-08-01T00:00:00.000Z');
  });

  await t.test('mergeEvents: notified_at -- winner is already earlier, no change recorded', async () => {
    const [earlierWinner] = await db
      .insert(events)
      .values({ eventName: 'NotifiedAt Winner2 ' + suffix, location: 'Nowhere', notifiedAt: new Date('2026-08-01T00:00:00Z') })
      .returning();
    const [laterLoser] = await db
      .insert(events)
      .values({ eventName: 'NotifiedAt Loser2 ' + suffix, location: 'Nowhere', notifiedAt: new Date('2026-09-01T00:00:00Z') })
      .returning();
    createdEventIds.push(earlierWinner.id, laterLoser.id);

    const result = await mergeEvents(db, earlierWinner.id, laterLoser.id, moderator.id, null);
    assert.strictEqual(result.merge.winnerNotifiedAtChanged, false);
    assert.strictEqual(result.winner.notifiedAt?.toISOString(), '2026-08-01T00:00:00.000Z');
  });

  await t.test('mergeEvents: notified_at -- both null, no change recorded', async () => {
    const [winnerNoNotify] = await db.insert(events).values({ eventName: 'No Notify Winner ' + suffix, location: 'Nowhere' }).returning();
    const [loserNoNotify] = await db.insert(events).values({ eventName: 'No Notify Loser ' + suffix, location: 'Nowhere' }).returning();
    createdEventIds.push(winnerNoNotify.id, loserNoNotify.id);

    const result = await mergeEvents(db, winnerNoNotify.id, loserNoNotify.id, moderator.id, null);
    assert.strictEqual(result.merge.winnerNotifiedAtChanged, false);
    assert.strictEqual(result.winner.notifiedAt, null);
  });

  await t.test('mergeEvents: suggestionId flow -- accepts the suggestion, undo returns it to pending', async () => {
    const [suggestionWinner] = await db.insert(events).values({ eventName: 'Suggestion Winner ' + suffix, location: 'Nowhere' }).returning();
    const [suggestionLoser] = await db.insert(events).values({ eventName: 'Suggestion Loser ' + suffix, location: 'Nowhere' }).returning();
    createdEventIds.push(suggestionWinner.id, suggestionLoser.id);

    const [suggestion] = await db
      .insert(eventMatchCandidates)
      .values({ eventId: suggestionLoser.id, candidateEventId: suggestionWinner.id, score: 0.6, postId: postShared.id })
      .returning();

    const result = await mergeEvents(db, suggestionWinner.id, suggestionLoser.id, moderator.id, suggestion.id);
    assert.strictEqual(result.merge.suggestionId, suggestion.id);

    const [acceptedSuggestion] = await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, suggestion.id));
    assert.strictEqual(acceptedSuggestion.status, 'accepted');
    assert.ok(acceptedSuggestion.resolvedAt !== null);
    assert.strictEqual(acceptedSuggestion.resolvedByModeratorId, moderator.id);

    await undoEventMerge(db, result.merge.id, moderator.id);
    const [pendingAgain] = await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, suggestion.id));
    assert.strictEqual(pendingAgain.status, 'pending');
    assert.strictEqual(pendingAgain.resolvedAt, null);
    assert.strictEqual(pendingAgain.resolvedByModeratorId, null);
  });
});
