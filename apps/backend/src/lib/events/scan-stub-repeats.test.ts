import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { events, schedules, eventPosts, eventSlugAliases, eventMerges, eventMatchCandidates, socialMediaAccountProfiles, posts, users } from '@festgrid/database';
import { scanStubRepeats } from './scan-stub-repeats.js';

test('scanStubRepeats integration tests', async (t) => {
  const suffix = Date.now() + '-scan';

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-scan-' + suffix, platform: 'instagram', displayName: 'Scan Curator', username: 'scan_curator_' + suffix, accountType: 'CURATOR_GUIDE', accountTypeStatus: 'CONFIRMED' })
    .returning();
  const [moderator] = await db
    .insert(users)
    .values({ email: 'scan-mod-' + suffix + '@example.com', name: 'Scan Moderator', role: 'moderator' })
    .returning();

  const eventIds: string[] = [];
  const postIds: string[] = [];

  t.after(async () => {
    if (eventIds.length > 0) {
      await db.delete(eventMerges).where(inArray(eventMerges.winnerEventId, eventIds));
      await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, eventIds));
      await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, eventIds));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(users).where(eq(users.id, moderator.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, account.id));
  });

  let counter = 0;
  async function makeStub(opts: {
    name: string;
    date: string;
    location?: string | null;
    latitude?: number;
    longitude?: number;
    time?: string;
    detailLevel?: 'stub' | 'full';
  }) {
    const n = ++counter;
    const [post] = await db
      .insert(posts)
      .values({ accountId: account.id, platform: 'instagram', postUrl: `https://instagram.com/p/scan-${n}-${suffix}`, publishedAt: new Date('2026-01-01T00:00:00Z') })
      .returning();
    postIds.push(post.id);
    const [event] = await db
      .insert(events)
      .values({ eventName: opts.name, location: 'Somewhere', postId: post.id, extractionOrdinal: 0, detailLevel: opts.detailLevel ?? 'stub' })
      .returning();
    eventIds.push(event.id);
    await db.insert(eventPosts).values({ eventId: event.id, postId: post.id, extractionOrdinal: 0 });
    await db.insert(schedules).values({
      eventId: event.id,
      eventStartDate: opts.date,
      isMainSchedule: true,
      location: opts.location ?? null,
      latitude: opts.latitude ?? null,
      longitude: opts.longitude ?? null,
      eventStartTime: opts.time ?? null,
    });
    return event;
  }

  const ARENA = { location: 'Arena Grand Paris', latitude: 48.9764032, longitude: 2.5300418 };
  const yonex = 'Yonex French Open ' + suffix;

  // Three repeats of one event (the oldest is created first), one with the venue given by coordinates only.
  const y1 = await makeStub({ name: yonex, date: '2026-10-20', ...ARENA });
  const y2 = await makeStub({ name: yonex, date: '2026-10-20', ...ARENA });
  const y3 = await makeStub({ name: yonex, date: '2026-10-20', latitude: ARENA.latitude, longitude: ARENA.longitude });
  // Same name and date at different venues, a one-word name, two sessions with different times.
  const xmasA = await makeStub({ name: 'Christmas Market ' + suffix, date: '2026-12-24', location: 'Grand Mall Jakarta' });
  const xmasB = await makeStub({ name: 'Christmas Market ' + suffix, date: '2026-12-24', location: 'Tunjungan Plaza Surabaya' });
  // Digits only: a hyphen in the suffix would split the name into two tokens.
  const oneWord = 'Natalan' + Date.now();
  const wordA = await makeStub({ name: oneWord, date: '2026-12-27', ...ARENA });
  const wordB = await makeStub({ name: oneWord, date: '2026-12-27', ...ARENA });
  const matinee = await makeStub({ name: 'Cirque Show ' + suffix, date: '2026-11-01', location: 'Big Top', time: '14:00:00' });
  const evening = await makeStub({ name: 'Cirque Show ' + suffix, date: '2026-11-01', location: 'Big Top', time: '19:00:00' });
  // A full event that shares everything with a stub is out of scope.
  const fullTwin = await makeStub({ name: yonex, date: '2026-10-20', ...ARENA, detailLevel: 'full' });
  // A different date (a weekly recurrence) and a different name.
  const nextWeek = await makeStub({ name: yonex, date: '2026-10-27', ...ARENA });
  const quarter = await makeStub({ name: yonex + ' - Quarterfinals', date: '2026-10-20', ...ARENA });

  const only = eventIds.slice();
  const ids = (list: Array<{ id: string }>) => list.map((e) => e.id);

  await t.test('evaluate-only: one cluster, the oldest wins, and the lookalikes are listed as near-misses with their reason', async () => {
    const report = await scanStubRepeats(db, { moderatorId: moderator.id, merge: false, onlyEventIds: only });

    assert.strictEqual(report.clusters.length, 1);
    const [cluster] = report.clusters;
    assert.strictEqual(cluster.winner.id, y1.id, 'the oldest event absorbs the rest');
    assert.deepStrictEqual(ids(cluster.losers).sort(), [y2.id, y3.id].sort());
    assert.strictEqual(report.merged, 0);

    const reasonFor = (a: { id: string }, b: { id: string }) =>
      report.nearMisses.find((m) => [m.a.id, m.b.id].sort().join() === [a.id, b.id].sort().join())?.reason;
    assert.strictEqual(reasonFor(xmasA, xmasB), 'venue-differs');
    assert.strictEqual(reasonFor(wordA, wordB), 'name-too-short');
    assert.strictEqual(reasonFor(matinee, evening), 'times-differ');

    // Not near-misses: a full event, a different date, a different name, and pairs inside the cluster.
    const listed = new Set(report.nearMisses.flatMap((m) => [m.a.id, m.b.id]));
    for (const e of [fullTwin, nextWeek, quarter]) assert.ok(!listed.has(e.id), `${e.eventName} is not a near-miss`);
    assert.strictEqual(report.nearMisses.length, 3);

    for (const e of [y1, y2, y3, xmasA, xmasB]) {
      const [row] = await db.select().from(events).where(eq(events.id, e.id));
      assert.strictEqual(row.mergedIntoEventId, null, 'evaluate-only changes nothing');
    }
  });

  await t.test('--exclude keeps an event out of every cluster', async () => {
    const report = await scanStubRepeats(db, { moderatorId: moderator.id, merge: false, onlyEventIds: only, excludeEventIds: [y3.id] });
    assert.deepStrictEqual(ids(report.clusters[0].losers), [y2.id]);
    assert.deepStrictEqual(report.excluded, [y3.id]);
  });

  await t.test('a rolled-back dry run merges for real inside the transaction and leaves nothing behind', async () => {
    class Rollback extends Error {}
    await assert.rejects(
      db.transaction(async (tx) => {
        const report = await scanStubRepeats(tx, { moderatorId: moderator.id, merge: true, onlyEventIds: only });
        assert.strictEqual(report.merged, 2);
        throw new Rollback();
      }),
      Rollback
    );
    const [row] = await db.select().from(events).where(eq(events.id, y2.id));
    assert.strictEqual(row.mergedIntoEventId, null);
  });

  await t.test('apply: losers merge into the oldest event through the journaled mergeEvents; everything else is untouched', async () => {
    const report = await db.transaction((tx) => scanStubRepeats(tx, { moderatorId: moderator.id, merge: true, onlyEventIds: only }));
    assert.strictEqual(report.merged, 2);
    assert.strictEqual(report.mergeIds.length, 2);

    for (const loser of [y2, y3]) {
      const [row] = await db.select().from(events).where(eq(events.id, loser.id));
      assert.strictEqual(row.mergedIntoEventId, y1.id);
      assert.ok(row.deletedAt);
    }
    const journal = await db.select().from(eventMerges).where(inArray(eventMerges.id, report.mergeIds));
    assert.strictEqual(journal.length, 2, 'every merge is journaled, so undoEventMerge can reverse it');
    assert.ok(journal.every((j) => j.winnerEventId === y1.id && j.performedByModeratorId === moderator.id && j.suggestionId === null));

    for (const keep of [xmasA, xmasB, wordA, wordB, matinee, evening, fullTwin, nextWeek, quarter]) {
      const [row] = await db.select().from(events).where(eq(events.id, keep.id));
      assert.strictEqual(row.mergedIntoEventId, null, `${row.eventName} must not merge`);
    }
  });

  await t.test('idempotent: a second run finds no cluster, and the near-misses are still listed', async () => {
    const report = await db.transaction((tx) => scanStubRepeats(tx, { moderatorId: moderator.id, merge: true, onlyEventIds: only }));
    assert.strictEqual(report.clusters.length, 0);
    assert.strictEqual(report.merged, 0);
    assert.strictEqual(report.nearMisses.length, 3);
  });

  await t.test('an empty restriction scans nothing', async () => {
    const report = await scanStubRepeats(db, { moderatorId: moderator.id, merge: false, onlyEventIds: [] });
    assert.strictEqual(report.candidatePairs, 0);
    assert.deepStrictEqual(report.clusters, []);
  });
});
