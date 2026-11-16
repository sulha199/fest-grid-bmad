import test from 'node:test';
import * as assert from 'node:assert';
import { TransactionRollbackError, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, schedules, eventMatchCandidates } from '@festgrid/database';
import { expireStaleMatchSuggestions, type ExpireSuggestionsReport } from './expire-match-suggestions.js';

const TODAY = '2026-10-30';
const OVER = '2020-01-01';
const UPCOMING = '2036-01-10';

test('expireStaleMatchSuggestions integration tests', async (t) => {
  const suffix = Date.now() + '-expire';

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-expire-' + suffix, platform: 'instagram', displayName: 'Expire Test', username: 'expire_test_' + suffix })
    .returning();
  const [post] = await db
    .insert(posts)
    .values({ accountId: account.id, platform: 'instagram', postUrl: `https://instagram.com/p/expire-${suffix}`, publishedAt: new Date('2026-01-01T00:00:00Z') })
    .returning();

  const eventIds: string[] = [];
  const suggestionIds: string[] = [];

  t.after(async () => {
    if (suggestionIds.length > 0) await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.id, suggestionIds));
    if (eventIds.length > 0) {
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, account.id));
  });

  let counter = 0;
  /** An event with one schedule per entry of `days` (`[start, end?]`); no entries means no schedule. */
  async function makeEvent(days: Array<[string, string?]>, opts: { deleted?: boolean; mergedInto?: string } = {}) {
    const [event] = await db
      .insert(events)
      .values({
        eventName: `Expire Fixture ${++counter} ${suffix}`,
        location: 'Somewhere',
        deletedAt: opts.deleted ? new Date() : null,
        mergedIntoEventId: opts.mergedInto ?? null,
      })
      .returning();
    eventIds.push(event.id);
    for (const [index, [start, end]] of days.entries()) {
      await db.insert(schedules).values({ eventId: event.id, eventStartDate: start, eventEndDate: end ?? null, isMainSchedule: index === 0 });
    }
    return event;
  }

  async function suggest(a: { id: string }, b: { id: string }, status: 'pending' | 'accepted' | 'rejected' = 'pending') {
    const [row] = await db
      .insert(eventMatchCandidates)
      .values({ eventId: a.id, candidateEventId: b.id, score: 0.6, postId: post.id, status })
      .returning();
    suggestionIds.push(row.id);
    return row.id;
  }

  const live = await makeEvent([[UPCOMING]]);
  const liveToo = await makeEvent([[UPCOMING]]);
  const overA = await makeEvent([[OVER]]);
  const overB = await makeEvent([[OVER, '2020-01-03']]);
  const noSchedule = await makeEvent([]);
  const longRunning = await makeEvent([[OVER], [UPCOMING, '2036-02-01']]);
  const deleted = await makeEvent([[UPCOMING]], { deleted: true });
  const survivor = await makeEvent([[UPCOMING]]);
  const merged = await makeEvent([[UPCOMING]], { mergedInto: survivor.id });

  const ids = {
    bothLive: await suggest(live, liveToo),
    bothOver: await suggest(overA, overB),
    oneOver: await suggest(overA, live),
    noScheduleOneOver: await suggest(noSchedule, overA),
    laterScheduleKeeps: await suggest(longRunning, overB),
    deletedSide: await suggest(deleted, live),
    mergedSide: await suggest(live, merged),
    alreadyAccepted: await suggest(overB, noSchedule, 'accepted'),
    alreadyRejected: await suggest(longRunning, noSchedule, 'rejected'),
  };

  /**
   * Runs the function inside a transaction that is always rolled back, and returns its report plus
   * the statuses of this suite's suggestions as seen inside it. The database may hold other pending
   * rows (other suites, a seeded queue), so nothing here may be committed and every assertion
   * names this suite's own ids.
   */
  async function inRolledBackTransaction(apply: boolean): Promise<{ report: ExpireSuggestionsReport; status: Record<string, string> }> {
    const out: { report?: ExpireSuggestionsReport; status?: Record<string, string> } = {};
    try {
      await db.transaction(async (tx) => {
        out.report = await expireStaleMatchSuggestions(tx, { today: TODAY, apply });
        const rows = await tx.select().from(eventMatchCandidates).where(inArray(eventMatchCandidates.id, suggestionIds));
        out.status = Object.fromEntries(rows.map((r) => [r.id, r.status]));
        await tx.rollback();
      });
    } catch (err) {
      if (!(err instanceof TransactionRollbackError)) throw err;
    }
    return { report: out.report!, status: out.status! };
  }

  const reasonOf = (report: ExpireSuggestionsReport, id: string) => report.expired.find((e) => e.suggestionId === id)?.reason ?? null;

  await t.test('names the reason for each dead pair and keeps the ones a moderator may still need', async () => {
    const { report } = await inRolledBackTransaction(false);

    assert.strictEqual(reasonOf(report, ids.bothOver), 'both-over');
    assert.strictEqual(reasonOf(report, ids.deletedSide), 'event-deleted');
    assert.strictEqual(reasonOf(report, ids.mergedSide), 'event-merged');
    for (const keep of ['bothLive', 'oneOver', 'noScheduleOneOver', 'laterScheduleKeeps'] as const) {
      assert.strictEqual(reasonOf(report, ids[keep]), null, `${keep} must stay pending`);
    }
  });

  await t.test('rows that are not pending are never read, whatever the dates say', async () => {
    const { report } = await inRolledBackTransaction(true);

    assert.strictEqual(reasonOf(report, ids.alreadyAccepted), null);
    assert.strictEqual(reasonOf(report, ids.alreadyRejected), null);
  });

  await t.test('apply marks exactly the expired rows `expired` and leaves every other status alone', async () => {
    const { report, status } = await inRolledBackTransaction(true);

    for (const id of [ids.bothOver, ids.deletedSide, ids.mergedSide]) assert.strictEqual(status[id], 'expired');
    for (const id of [ids.bothLive, ids.oneOver, ids.noScheduleOneOver, ids.laterScheduleKeeps]) assert.strictEqual(status[id], 'pending');
    assert.strictEqual(status[ids.alreadyAccepted], 'accepted');
    assert.strictEqual(status[ids.alreadyRejected], 'rejected');
    assert.ok(report.closed >= 3, 'at least this suite\'s three rows were updated');
    assert.strictEqual(report.closed, report.expired.length, 'every expired row was still pending when updated');
    assert.strictEqual(report.pending, report.expired.length + report.kept);
    assert.strictEqual(
      report.byReason['event-deleted'] + report.byReason['event-merged'] + report.byReason['both-over'],
      report.expired.length
    );
  });

  await t.test('evaluate-only reports the same rows but updates nothing', async () => {
    const { report, status } = await inRolledBackTransaction(false);

    assert.strictEqual(reasonOf(report, ids.bothOver), 'both-over');
    assert.strictEqual(report.closed, 0);
    assert.strictEqual(status[ids.bothOver], 'pending');
  });

  await t.test('a rolled-back run changed nothing for the next one', async () => {
    const [row] = await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, ids.bothOver));
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.resolvedAt, null);
  });
});
