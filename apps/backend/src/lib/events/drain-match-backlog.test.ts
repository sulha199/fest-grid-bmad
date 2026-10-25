import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  socialMediaAccountProfiles,
  posts,
  events,
  schedules,
  eventPosts,
  eventSlugAliases,
  eventMatchCandidates,
  eventMerges,
  postAccountAssociations,
  users,
} from '@festgrid/database';
import { drainMatchBacklog, evaluateBacklogRow, formatBacklogEvaluation } from './drain-match-backlog.js';

test('drainMatchBacklog integration tests', async (t) => {
  const suffix = Date.now() + '-drain';

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-drain-' + suffix, platform: 'instagram', displayName: 'Drain Test', username: 'drain_test_' + suffix })
    .returning();
  const [otherAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-drain-other-' + suffix, platform: 'instagram', displayName: 'Drain Other', username: 'drain_other_' + suffix })
    .returning();
  const [moderator] = await db
    .insert(users)
    .values({ email: 'drain-mod-' + suffix + '@example.com', name: 'Drain Moderator', role: 'moderator' })
    .returning();

  const eventIds: string[] = [];
  const postIds: string[] = [];
  const suggestionIds: string[] = [];

  t.after(async () => {
    if (eventIds.length > 0) {
      await db.delete(eventMerges).where(inArray(eventMerges.winnerEventId, eventIds));
      await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, eventIds));
      await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, eventIds));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    await db.delete(users).where(eq(users.id, moderator.id));
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [account.id, otherAccount.id]));
  });

  let counter = 0;
  async function makeEvent(opts: {
    accountId: string;
    name: string;
    date: string;
    location?: string | null;
    links?: { url: string }[];
    detailLevel?: 'full' | 'stub';
  }) {
    const n = ++counter;
    const [post] = await db
      .insert(posts)
      .values({ accountId: opts.accountId, platform: 'instagram', postUrl: `https://instagram.com/p/drain-${n}-${suffix}`, publishedAt: new Date('2026-01-01T00:00:00Z') })
      .returning();
    postIds.push(post.id);
    await db.insert(postAccountAssociations).values({ postId: post.id, accountId: opts.accountId, role: 'PUBLISHER' });
    const [event] = await db
      .insert(events)
      .values({
        eventName: opts.name,
        location: 'Somewhere',
        postId: post.id,
        extractionOrdinal: 0,
        links: opts.links ?? null,
        detailLevel: opts.detailLevel ?? 'full',
      })
      .returning();
    eventIds.push(event.id);
    await db.insert(eventPosts).values({ eventId: event.id, postId: post.id, extractionOrdinal: 0 });
    await db.insert(schedules).values({ eventId: event.id, eventStartDate: opts.date, isMainSchedule: true, location: opts.location ?? null });
    return { event, post };
  }

  async function suggest(newSide: { event: { id: string }; post: { id: string } }, candidateSide: { event: { id: string } }, score = 0.65) {
    const [row] = await db
      .insert(eventMatchCandidates)
      .values({ eventId: newSide.event.id, candidateEventId: candidateSide.event.id, score, postId: newSide.post.id })
      .returning();
    suggestionIds.push(row.id);
    return row;
  }

  async function statusOf(id: string) {
    const [row] = await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, id));
    return row.status;
  }

  // The same event posted twice by one account on one day, one side without a venue: the shape
  // that sat at 0.65 in the moderator queue.
  const dupCandidate = await makeEvent({ accountId: account.id, name: 'Mall Anniversary Sale ' + suffix, date: '2026-12-05' });
  const dupNew = await makeEvent({ accountId: account.id, name: 'Mall Anniversary Sale ' + suffix, date: '2026-12-05', location: 'Grand Mall' });
  const dupSuggestion = await suggest(dupNew, dupCandidate);

  // Known negatives (a) touring event, (b) daily series, (c) different store promos.
  const tourCandidate = await makeEvent({ accountId: account.id, name: 'Lomba Mewarnai Keliling ' + suffix, date: '2026-12-06', location: 'Tenth Avenue Bandung' });
  const tourNew = await makeEvent({ accountId: account.id, name: 'Lomba Mewarnai Keliling ' + suffix, date: '2026-12-06', location: 'BG Junction Surabaya' });
  const tourSuggestion = await suggest(tourNew, tourCandidate);

  const seriesName = 'Mid Year Grand Anniversary Biggest Sale Festival ' + suffix;
  const seriesCandidate = await makeEvent({ accountId: account.id, name: seriesName, date: '2026-12-07' });
  const seriesNew = await makeEvent({ accountId: account.id, name: seriesName + ' - Day 12', date: '2026-12-08' });
  const seriesSuggestion = await suggest(seriesNew, seriesCandidate);

  const storeCandidate = await makeEvent({ accountId: account.id, name: 'Zara Mid Year Sale Grand Mall ' + suffix, date: '2026-12-09' });
  const storeNew = await makeEvent({ accountId: account.id, name: 'Uniqlo Mid Year Sale Grand Mall ' + suffix, date: '2026-12-09', location: 'Grand Mall' });
  const storeSuggestion = await suggest(storeNew, storeCandidate);

  // Shared link only, race day three weeks after the deadline post: the cap holds.
  const link = { url: 'https://register.example.com/drain-' + suffix };
  const farCandidate = await makeEvent({ accountId: account.id, name: 'Borobudur Marathon ' + suffix, date: '2026-12-10', links: [link] });
  const farNew = await makeEvent({ accountId: account.id, name: 'Borobudur Marathon ' + suffix, date: '2026-12-31', links: [link] });
  const farSuggestion = await suggest(farNew, farCandidate, 0.88);

  // A roundup/curator item (stub) earns no organizer weight, so it is not promoted.
  const stubCandidate = await makeEvent({ accountId: account.id, name: 'Night Market Weekend ' + suffix, date: '2026-12-11' });
  const stubNew = await makeEvent({ accountId: account.id, name: 'Night Market Weekend ' + suffix, date: '2026-12-11', detailLevel: 'stub' });
  const stubSuggestion = await suggest(stubNew, stubCandidate, 0.45);

  // A different account with no shared link scores low, never reaches mid.
  const strangerCandidate = await makeEvent({ accountId: account.id, name: 'Craft Fair ' + suffix, date: '2026-12-12' });
  const strangerNew = await makeEvent({ accountId: otherAccount.id, name: 'Craft Fair ' + suffix, date: '2026-12-12' });
  const strangerSuggestion = await suggest(strangerNew, strangerCandidate, 0.5);

  const all = [dupSuggestion, tourSuggestion, seriesSuggestion, storeSuggestion, farSuggestion, stubSuggestion, strangerSuggestion];
  const only = all.map((s) => s.id);

  await t.test('evaluateBacklogRow: the duplicate is promoted, with the signals that explain why', async () => {
    const result = await evaluateBacklogRow(db, dupSuggestion);
    assert.strictEqual(result.kind, 'evaluated');
    if (result.kind !== 'evaluated') return;
    assert.strictEqual(result.organizerMatch, true);
    assert.strictEqual(result.decision.scoredTier, 'mid');
    assert.strictEqual(result.decision.tier, 'high');
    assert.strictEqual(result.decision.promotedByRule, true);
    assert.match(formatBacklogEvaluation(result), /promoted/);
  });

  await t.test('evaluate-only reports the qualifying pair and merges nothing', async () => {
    const report = await drainMatchBacklog(db, { moderatorId: moderator.id, merge: false, onlySuggestionIds: only });
    assert.strictEqual(report.pending, all.length);
    assert.deepStrictEqual(report.qualifying.map((q) => q.suggestionId), [dupSuggestion.id]);
    assert.strictEqual(report.merged, 0);
    assert.strictEqual(report.remaining, all.length - 1);
    assert.strictEqual(await statusOf(dupSuggestion.id), 'pending');
  });

  await t.test('an excluded suggestion stays in the queue', async () => {
    const report = await drainMatchBacklog(db, {
      moderatorId: moderator.id,
      merge: true,
      excludeSuggestionIds: [dupSuggestion.id],
      onlySuggestionIds: only,
    });
    assert.deepStrictEqual(report.excluded, [dupSuggestion.id]);
    assert.strictEqual(report.merged, 0);
    assert.strictEqual(await statusOf(dupSuggestion.id), 'pending');
  });

  await t.test('a dry run (rolled-back transaction) leaves the data untouched', async () => {
    class Rollback extends Error {}
    await assert.rejects(
      db.transaction(async (tx) => {
        const report = await drainMatchBacklog(tx, { moderatorId: moderator.id, merge: true, onlySuggestionIds: only });
        assert.strictEqual(report.merged, 1);
        throw new Rollback();
      }),
      Rollback
    );
    assert.strictEqual(await statusOf(dupSuggestion.id), 'pending');
    const [loser] = await db.select().from(events).where(eq(events.id, dupNew.event.id));
    assert.strictEqual(loser.mergedIntoEventId, null);
  });

  await t.test('apply: merges only the qualifying pair, journals it, and leaves every negative pending', async () => {
    const report = await db.transaction((tx) => drainMatchBacklog(tx, { moderatorId: moderator.id, merge: true, onlySuggestionIds: only }));

    assert.strictEqual(report.merged, 1);
    assert.strictEqual(report.mergeIds.length, 1);
    assert.strictEqual(await statusOf(dupSuggestion.id), 'accepted');
    for (const s of [tourSuggestion, seriesSuggestion, storeSuggestion, farSuggestion, stubSuggestion, strangerSuggestion]) {
      assert.strictEqual(await statusOf(s.id), 'pending', 'a negative must stay for a moderator');
    }

    // Existing event wins, the suggested event is the loser, and the journal row can undo it.
    const [loser] = await db.select().from(events).where(eq(events.id, dupNew.event.id));
    assert.strictEqual(loser.mergedIntoEventId, dupCandidate.event.id);
    const [journal] = await db.select().from(eventMerges).where(eq(eventMerges.id, report.mergeIds[0]));
    assert.strictEqual(journal.performedByModeratorId, moderator.id);
    assert.strictEqual(journal.suggestionId, dupSuggestion.id);
  });

  await t.test('idempotent: a second run finds the accepted row no longer pending and merges nothing more', async () => {
    const before = await db.select().from(eventMerges).where(inArray(eventMerges.winnerEventId, eventIds));
    const report = await db.transaction((tx) => drainMatchBacklog(tx, { moderatorId: moderator.id, merge: true, onlySuggestionIds: only }));

    assert.strictEqual(report.pending, all.length - 1);
    assert.strictEqual(report.qualifying.length, 0);
    assert.strictEqual(report.merged, 0);
    const after = await db.select().from(eventMerges).where(inArray(eventMerges.winnerEventId, eventIds));
    assert.strictEqual(after.length, before.length);
  });

  await t.test('a pair whose event was merged away since is stale, not an error', async () => {
    await db.update(events).set({ deletedAt: new Date(), mergedIntoEventId: tourCandidate.event.id }).where(eq(events.id, strangerNew.event.id));
    const report = await drainMatchBacklog(db, { moderatorId: moderator.id, merge: true, onlySuggestionIds: [strangerSuggestion.id] });
    assert.strictEqual(report.stale.length, 1);
    assert.match(report.stale[0].reason, /already deleted or merged/);
    assert.strictEqual(report.merged, 0);
  });

  await t.test('a pair with a missing event is stale', async () => {
    const result = await evaluateBacklogRow(db, { ...storeSuggestion, eventId: '00000000-0000-4000-8000-000000000000' });
    assert.strictEqual(result.kind, 'stale');
  });
});
