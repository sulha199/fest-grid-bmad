import test from 'node:test';
import * as assert from 'node:assert';
import { count, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  socialMediaAccountProfiles,
  posts,
  events,
  schedules,
  eventPosts,
  eventMatchCandidates,
  eventMerges,
  postAccountAssociations,
  users,
} from '@festgrid/database';
import type { DedupReviewPairEvidence } from '@festgrid/domain/events';
import { DedupReviewReviewerError, DedupReviewRoleError } from './dedup-review-errors.js';
import {
  assertRoleBypassesRls,
  buildDedupReviewExport,
  hashDedupReviewEvidence,
  resolveReviewerUserId,
  runInReadOnlyTransaction,
} from './dedup-review-export.js';
import type { DbExecutor } from './set-event-primary-post.js';

test('buildDedupReviewExport (AI dedup review, piece B1)', async (t) => {
  const suffix = Date.now() + '-ddrx';
  const USERNAME = 'pii_username_' + suffix;
  const OTHER_USERNAME = 'pii_other_' + suffix;
  const CAPTION = 'SECRET CAPTION ' + suffix;
  const TOKEN = 'SECRET_TOKEN_' + suffix;
  const REVIEWER_EMAIL = `ddrx-reviewer-${suffix}@example.com`;
  const HUMAN_EMAIL = `ddrx-human-${suffix}@example.com`;

  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-ddrx-' + suffix, platform: 'instagram', displayName: 'Export Test', username: USERNAME, accountType: 'ORGANIZER_VENUE_EVENT' })
    .returning();
  const [otherAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-ddrx-other-' + suffix, platform: 'instagram', displayName: 'Export Other', username: OTHER_USERNAME, accountType: 'PERSONAL' })
    .returning();
  const [awaitingAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-ddrx-awaiting-' + suffix,
      platform: 'instagram',
      displayName: 'Export Awaiting',
      username: 'pii_awaiting_' + suffix,
      accountType: 'PERSONAL',
      accountTypeStatus: 'AWAITING_APPROVAL',
    })
    .returning();
  const [reviewer] = await db.insert(users).values({ email: REVIEWER_EMAIL, name: 'Reviewer', role: 'moderator' }).returning();
  const [human] = await db.insert(users).values({ email: HUMAN_EMAIL, name: 'Human', role: 'moderator' }).returning();
  const [plainUser] = await db.insert(users).values({ email: `ddrx-plain-${suffix}@example.com`, name: 'Plain', role: 'user' }).returning();

  const eventIds: string[] = [];
  const postIds: string[] = [];
  const suggestionIds: string[] = [];

  t.after(async () => {
    if (eventIds.length > 0) {
      await db.delete(eventMerges).where(inArray(eventMerges.winnerEventId, eventIds));
      await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, eventIds));
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
      await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    await db.delete(users).where(inArray(users.id, [reviewer.id, human.id, plainUser.id]));
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [account.id, otherAccount.id, awaitingAccount.id]));
  });

  let counter = 0;
  async function makeEvent(opts: { accountId: string; name: string; date: string; location?: string | null; links?: { url: string }[]; detailLevel?: 'full' | 'stub' }) {
    const n = ++counter;
    const [post] = await db
      .insert(posts)
      .values({
        accountId: opts.accountId,
        platform: 'instagram',
        postUrl: `https://instagram.com/p/ddrx-${n}-${suffix}`,
        content: CAPTION,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      })
      .returning();
    postIds.push(post.id);
    await db.insert(postAccountAssociations).values({ postId: post.id, accountId: opts.accountId, role: 'PUBLISHER' });
    const [event] = await db
      .insert(events)
      .values({ eventName: opts.name, location: 'Somewhere', postId: post.id, extractionOrdinal: 0, links: opts.links ?? null, detailLevel: opts.detailLevel ?? 'full' })
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

  async function makePair(label: string, date: string, opts: { newAccountId?: string; links?: { url: string }[]; newLocation?: string } = {}) {
    const candidate = await makeEvent({ accountId: account.id, name: `${label} ${suffix}`, date, links: opts.links });
    const newSide = await makeEvent({ accountId: opts.newAccountId ?? account.id, name: `${label} ${suffix}`, date, location: opts.newLocation ?? null, links: opts.links });
    return { candidate, newSide, suggestion: await suggest(newSide, candidate) };
  }

  const linkWithSecret = [{ url: `https://Register.Example.com/run/?token=${TOKEN}` }];

  // The shape that sits at mid in the queue yet scores high today (same account, same day, same name).
  const high = await makePair('Mall Anniversary Sale', '2026-12-05', { newLocation: 'Grand Mall', links: linkWithSecret });
  // Two different accounts, so it is not "same account".
  const stranger = await makePair('Craft Fair', '2026-12-12', { newAccountId: otherAccount.id });
  // A pair whose new event was deleted since it was queued.
  const stale = await makePair('Deleted Meetup', '2026-12-13');
  await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, stale.newSide.event.id));
  // A merge on this suggestion that a human later undid.
  const undone = await makePair('Undone Merge Run', '2026-12-14');
  await db.insert(eventMerges).values({
    winnerEventId: undone.candidate.event.id,
    loserEventId: undone.newSide.event.id,
    suggestionId: undone.suggestion.id,
    performedByModeratorId: reviewer.id,
    loserPriorSlug: 'ddrx-' + suffix,
    undoneAt: new Date(),
  });

  const pendingIds = [high.suggestion.id, stranger.suggestion.id, stale.suggestion.id, undone.suggestion.id];
  const base = { limit: 30, skipIds: [] as string[], runTag: 'test-run', reviewerUserId: reviewer.id, onlySuggestionIds: pendingIds };

  await t.test('exports evidence and a hash for each evaluable pair, oldest first, and counts the stale one', async () => {
    const report = await buildDedupReviewExport(db, base);

    assert.deepStrictEqual(
      report.pairs.map((p) => p.suggestionId),
      [high.suggestion.id, stranger.suggestion.id, undone.suggestion.id]
    );
    assert.strictEqual(report.staleCount, 1);
    assert.strictEqual(report.skippedCount, 0);
    assert.strictEqual(report.scanLimited, false);
    assert.strictEqual(report.runTag, 'test-run');
    assert.strictEqual(report.schemaVersion, 1);
    const [{ pending }] = await db.select({ pending: count() }).from(eventMatchCandidates).where(eq(eventMatchCandidates.status, 'pending'));
    assert.strictEqual(report.totalPending, Number(pending), 'totalPending is the whole pending queue, counted independently');
    assert.ok(report.totalPending >= pendingIds.length);

    const first = report.pairs[0];
    assert.strictEqual(first.status, 'pending');
    assert.strictEqual(first.candidate.name, `Mall Anniversary Sale ${suffix}`);
    assert.strictEqual(first.newEvent.location, 'Somewhere');
    assert.strictEqual(first.newEvent.schedules[0].location, 'Grand Mall');
    assert.strictEqual(first.newEvent.schedules[0].startDate, '2026-12-05');
    assert.deepStrictEqual(first.candidate.links, ['https://register.example.com/run']);
    assert.strictEqual(first.candidate.detailLevel, 'full');
    assert.deepStrictEqual(first.candidate.sourcePosts, [{ isPrimary: true, accountType: 'ORGANIZER_VENUE_EVENT', publishedAt: '2026-01-01T00:00:00.000Z' }]);
    assert.match(first.evidenceHash, /^[0-9a-f]{64}$/);
  });

  await t.test('a pair that already scores high is exported with that tier, so the reviewer can leave it to the drain', async () => {
    const [first] = (await buildDedupReviewExport(db, base)).pairs;
    assert.strictEqual(first.signals.tier, 'high');
    assert.strictEqual(first.signals.sharedLink, true);
    assert.strictEqual(first.signals.minDayDiff, 0);
  });

  await t.test('same account is a boolean over the posts of both events, and a different account is false', async () => {
    const report = await buildDedupReviewExport(db, base);
    const byId = new Map(report.pairs.map((p) => [p.suggestionId, p]));
    assert.strictEqual(byId.get(high.suggestion.id)?.sameAccount, true);
    assert.strictEqual(byId.get(stranger.suggestion.id)?.sameAccount, false);
    assert.strictEqual(byId.get(stranger.suggestion.id)?.newEvent.sourcePosts[0].accountType, 'PERSONAL');
  });

  await t.test('an undone merge is counted, and counting it changes the hash', async () => {
    const withUndo = (await buildDedupReviewExport(db, base)).pairs.find((p) => p.suggestionId === undone.suggestion.id)!;
    assert.strictEqual(withUndo.undoneMergeCount, 1);

    const { evidenceHash, ...evidence } = withUndo;
    const recomputed = (e: DedupReviewPairEvidence) => hashDedupReviewEvidence(e);
    assert.strictEqual(recomputed(evidence), evidenceHash, 'the apply side recomputes the same hash from the evidence');
    assert.notStrictEqual(recomputed({ ...evidence, undoneMergeCount: 0 }), evidenceHash);
  });

  await t.test('the hash is stable between runs and changes when an event changes', async () => {
    const first = (await buildDedupReviewExport(db, base)).pairs[0];
    const again = (await buildDedupReviewExport(db, base)).pairs[0];
    assert.strictEqual(again.evidenceHash, first.evidenceHash);

    await db.update(events).set({ location: 'Moved elsewhere' }).where(eq(events.id, high.candidate.event.id));
    const changed = (await buildDedupReviewExport(db, base)).pairs[0];
    assert.notStrictEqual(changed.evidenceHash, first.evidenceHash);
    await db.update(events).set({ location: 'Somewhere' }).where(eq(events.id, high.candidate.event.id));
  });

  await t.test('skipped ids are left out and counted, and the next pairs fill the limit', async () => {
    const report = await buildDedupReviewExport(db, { ...base, skipIds: [high.suggestion.id, stale.suggestion.id] });
    assert.deepStrictEqual(
      report.pairs.map((p) => p.suggestionId),
      [stranger.suggestion.id, undone.suggestion.id]
    );
    assert.strictEqual(report.skippedCount, 2);
    assert.strictEqual(report.staleCount, 0);
  });

  await t.test('a skipped id is counted queue-wide even when the limit fills before the scan reaches it', async () => {
    const report = await buildDedupReviewExport(db, { ...base, limit: 1, skipIds: [undone.suggestion.id] });
    assert.deepStrictEqual(
      report.pairs.map((p) => p.suggestionId),
      [high.suggestion.id]
    );
    assert.strictEqual(report.skippedCount, 1, 'counted although it sits after the pair that filled the limit');
  });

  await t.test('skipped ids never use up the scan cap', async () => {
    const report = await buildDedupReviewExport(db, { ...base, skipIds: [high.suggestion.id, stranger.suggestion.id], scanCap: 2 });
    assert.deepStrictEqual(
      report.pairs.map((p) => p.suggestionId),
      [undone.suggestion.id],
      'the cap of 2 went to the stale row and the one pair, not to the two skipped ids'
    );
    assert.strictEqual(report.staleCount, 1);
    assert.strictEqual(report.scanLimited, false);
  });

  await t.test('the limit holds, and the scan cap is reported when it stops the scan short', async () => {
    const limited = await buildDedupReviewExport(db, { ...base, limit: 2 });
    assert.deepStrictEqual(
      limited.pairs.map((p) => p.suggestionId),
      [high.suggestion.id, stranger.suggestion.id]
    );
    assert.strictEqual(limited.scanLimited, false, 'the limit was filled, so nothing was cut short');

    const capped = await buildDedupReviewExport(db, { ...base, scanCap: 1 });
    assert.strictEqual(capped.pairs.length, 1);
    assert.strictEqual(capped.scanLimited, true);

    const [{ pending }] = await db.select({ pending: count() }).from(eventMatchCandidates).where(eq(eventMatchCandidates.status, 'pending'));
    assert.strictEqual(limited.totalPending, Number(pending), 'totalPending stays the whole queue when the limit cuts the list short');

    const exactCap = await buildDedupReviewExport(db, { ...base, scanCap: pendingIds.length });
    assert.strictEqual(exactCap.pairs.length, 3);
    assert.strictEqual(exactCap.staleCount, 1);
    assert.strictEqual(exactCap.scanLimited, false, 'the cap equals the number of rows, so nothing was left unscanned');
  });

  await t.test('a pair whose new event was merged away is stale too, not only a deleted one', async () => {
    const mergedAway = await makePair('Merged Away Meetup', '2026-12-15');
    await db.update(events).set({ mergedIntoEventId: mergedAway.candidate.event.id }).where(eq(events.id, mergedAway.newSide.event.id));

    const report = await buildDedupReviewExport(db, { ...base, onlySuggestionIds: [mergedAway.suggestion.id] });
    assert.deepStrictEqual(report.pairs, []);
    assert.strictEqual(report.staleCount, 1);
  });

  await t.test('an event link without a usable url does not stop the export', async () => {
    const odd = await makePair('Odd Link Fair', '2026-12-16');
    await db.update(events).set({ links: [{ label: 'no url here' }, { url: '' }, { url: null }] as never }).where(eq(events.id, odd.candidate.event.id));

    const report = await buildDedupReviewExport(db, { ...base, onlySuggestionIds: [odd.suggestion.id] });
    assert.strictEqual(report.pairs.length, 1);
    assert.deepStrictEqual(report.pairs[0].candidate.links, []);
  });

  await t.test('an account type still awaiting approval is exported as UNCLASSIFIED, a confirmed one as itself', async () => {
    const awaiting = await makePair('Awaiting Type Fair', '2026-12-17', { newAccountId: awaitingAccount.id });

    const report = await buildDedupReviewExport(db, { ...base, onlySuggestionIds: [awaiting.suggestion.id, stranger.suggestion.id] });
    const byId = new Map(report.pairs.map((p) => [p.suggestionId, p]));
    assert.strictEqual(byId.get(awaiting.suggestion.id)?.newEvent.sourcePosts[0].accountType, 'UNCLASSIFIED');
    assert.strictEqual(byId.get(stranger.suggestion.id)?.newEvent.sourcePosts[0].accountType, 'PERSONAL');
  });

  await t.test('an empty queue still gives a valid report', async () => {
    const report = await buildDedupReviewExport(db, { ...base, onlySuggestionIds: ['00000000-0000-4000-8000-000000000000'] });
    assert.deepStrictEqual(report.pairs, []);
    assert.strictEqual(report.staleCount, 0);
    assert.strictEqual(report.skippedCount, 0);
    assert.strictEqual(report.scanLimited, false);
  });

  await t.test('recentlyResolved tells the reviewer, a human and the system apart, and leaves out old resolutions', async () => {
    const reviewerPair = await makePair('Resolved By Reviewer', '2026-12-20');
    const humanPair = await makePair('Resolved By Human', '2026-12-21');
    const expiredPair = await makePair('Expired Pair', '2026-12-22');
    const oldPair = await makePair('Resolved Long Ago', '2026-12-23');
    const set = (id: string, values: Partial<typeof eventMatchCandidates.$inferInsert>) => db.update(eventMatchCandidates).set(values).where(eq(eventMatchCandidates.id, id));
    await set(reviewerPair.suggestion.id, { status: 'accepted', resolvedAt: new Date(), resolvedByModeratorId: reviewer.id });
    await set(humanPair.suggestion.id, { status: 'rejected', resolvedAt: new Date(), resolvedByModeratorId: human.id });
    await set(expiredPair.suggestion.id, { status: 'expired', resolvedAt: new Date() });
    await set(oldPair.suggestion.id, { status: 'rejected', resolvedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), resolvedByModeratorId: human.id });

    const report = await buildDedupReviewExport(db, base);
    const resolved = new Map(report.recentlyResolved.map((r) => [r.suggestionId, r]));
    assert.strictEqual(resolved.get(reviewerPair.suggestion.id)?.resolvedBy, 'reviewer');
    assert.strictEqual(resolved.get(reviewerPair.suggestion.id)?.status, 'accepted');
    assert.strictEqual(resolved.get(humanPair.suggestion.id)?.resolvedBy, 'human');
    assert.strictEqual(resolved.get(expiredPair.suggestion.id)?.resolvedBy, 'system');
    assert.strictEqual(resolved.has(oldPair.suggestion.id), false, 'older than 14 days');
    assert.ok(report.pairs.every((p) => p.status === 'pending'));

    assert.strictEqual(report.recentlyResolvedTruncated, false);
    const truncated = await buildDedupReviewExport(db, { ...base, recentLimit: 2 });
    assert.strictEqual(truncated.recentlyResolved.length, 2);
    assert.strictEqual(truncated.recentlyResolvedTruncated, true, 'more were resolved than the list holds, and the report says so');

    const withoutReviewer = await buildDedupReviewExport(db, { ...base, reviewerUserId: null });
    assert.strictEqual(withoutReviewer.recentlyResolved.find((r) => r.suggestionId === reviewerPair.suggestion.id)?.resolvedBy, 'unknown');
  });

  await t.test('the output holds no account username or id, caption, link query token or email; event text is passed through as stored', async () => {
    const report = await buildDedupReviewExport(db, base);
    const text = JSON.stringify(report);
    assert.ok(text.includes(`Mall Anniversary Sale ${suffix}`), 'event names are public event text and go out verbatim');
    for (const secret of [USERNAME, OTHER_USERNAME, CAPTION, TOKEN, REVIEWER_EMAIL, HUMAN_EMAIL, account.accountId, account.id]) {
      assert.ok(!text.includes(secret), `the output must not contain ${secret.slice(0, 12)}...`);
    }
  });

  await t.test('the export transaction is read only: reads work and a write is refused', async () => {
    const mode = await runInReadOnlyTransaction(db, async (tx) => {
      const [row] = (await tx.execute(sql`SHOW transaction_read_only`)) as unknown as Array<{ transaction_read_only: string }>;
      const [iso] = (await tx.execute(sql`SHOW transaction_isolation`)) as unknown as Array<{ transaction_isolation: string }>;
      await buildDedupReviewExport(tx, { ...base, limit: 1 });
      return `${row.transaction_read_only}/${iso.transaction_isolation}`;
    });
    assert.strictEqual(mode, 'on/repeatable read', 'read only, and one snapshot for the whole export');

    await assert.rejects(
      runInReadOnlyTransaction(db, async (tx) => {
        await tx.update(events).set({ location: 'should not stick' }).where(eq(events.id, high.candidate.event.id));
      }),
      /read-only transaction/i
    );
    const [row] = await db.select().from(events).where(eq(events.id, high.candidate.event.id));
    assert.strictEqual(row.location, 'Somewhere');
  });

  await t.test('assertRoleBypassesRls passes for a role that bypasses it and refuses one that cannot, so an empty queue is never faked', async () => {
    await assertRoleBypassesRls(db); // the local test role is a superuser

    const stub = (rows: unknown[]) => ({ execute: async () => rows }) as unknown as DbExecutor;
    await assertRoleBypassesRls(stub([{ bypass: true }]));
    for (const rows of [[{ bypass: false }], [], [{}]]) {
      await assert.rejects(assertRoleBypassesRls(stub(rows)), (err: unknown) => {
        assert.ok(err instanceof DedupReviewRoleError);
        assert.match((err as Error).message, /cannot bypass row level security/);
        return true;
      });
    }
  });

  await t.test('resolveReviewerUserId matches case-insensitively, wants an active moderator, and never prints the email', async () => {
    assert.strictEqual(await resolveReviewerUserId(db, REVIEWER_EMAIL), reviewer.id);
    assert.strictEqual(await resolveReviewerUserId(db, REVIEWER_EMAIL.toUpperCase()), reviewer.id, 'a differently cased variable still finds it');

    for (const email of [`ddrx-plain-${suffix}@example.com`, `ddrx-nobody-${suffix}@example.com`]) {
      await assert.rejects(resolveReviewerUserId(db, email), (err: unknown) => {
        assert.ok(err instanceof DedupReviewReviewerError);
        assert.ok(!(err as Error).message.includes(email));
        assert.match((err as Error).message, /reviewer account was not found among active moderators/);
        return true;
      });
    }

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, human.id));
    await assert.rejects(resolveReviewerUserId(db, HUMAN_EMAIL), DedupReviewReviewerError);
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, human.id));
  });
});
