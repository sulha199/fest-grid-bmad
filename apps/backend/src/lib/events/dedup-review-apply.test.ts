import test from 'node:test';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import {
  socialMediaAccountProfiles,
  posts,
  events,
  schedules,
  eventPosts,
  eventMatchCandidates,
  eventMerges,
  eventSlugAliases,
  postAccountAssociations,
  users,
} from '@festgrid/database';
import { DedupReviewApplyInputError } from '@festgrid/domain/events';
import { DedupReviewFloorOverrideDisabledError, DedupReviewInvokerError, DedupReviewRejectsDisabledError } from './dedup-review-errors.js';
import { countAiActionsLast24h, countAiRejectsLast24h, isRunFatalDatabaseError, lookupFreshPair, resolveInvokerUserId, runDedupReviewApply, type DedupReviewApplyInput } from './dedup-review-apply.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

test('dedup review apply (AI dedup review, piece B2b-1)', async (t) => {
  const suffix = Date.now() + '-ddap';
  const eventIds: string[] = [];
  const postIds: string[] = [];
  const userIds: string[] = [];

  const MOD_EMAIL = `ddap-mod-${suffix}@example.com`;
  const [account] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-ddap-' + suffix, platform: 'instagram', displayName: 'Apply Test', username: 'ddap_' + suffix, accountType: 'ORGANIZER_VENUE_EVENT' })
    .returning();
  const [otherAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-ddap-o-' + suffix, platform: 'instagram', displayName: 'Other', username: 'ddap_o_' + suffix, accountType: 'ORGANIZER_VENUE_EVENT' })
    .returning();
  const mkUser = async (email: string, role: 'moderator' | 'user', deleted = false) => {
    const [row] = await db.insert(users).values({ email, name: 'Apply Test', role, deletedAt: deleted ? new Date() : null }).returning();
    userIds.push(row.id);
    return row;
  };
  const moderator = await mkUser(MOD_EMAIL, 'moderator');

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
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [account.id, otherAccount.id]));
  });

  let counter = 0;
  async function makeEvent(opts: { accountId: string; name: string; date: string }) {
    const n = ++counter;
    const [post] = await db
      .insert(posts)
      .values({ accountId: opts.accountId, platform: 'instagram', postUrl: `https://instagram.com/p/ddap-${n}-${suffix}`, content: 'caption', publishedAt: new Date('2026-01-01T00:00:00Z') })
      .returning();
    postIds.push(post.id);
    await db.insert(postAccountAssociations).values({ postId: post.id, accountId: opts.accountId, role: 'PUBLISHER' });
    const [event] = await db.insert(events).values({ eventName: opts.name, location: 'Somewhere', postId: post.id, extractionOrdinal: 0, detailLevel: 'full' }).returning();
    eventIds.push(event.id);
    await db.insert(eventPosts).values({ eventId: event.id, postId: post.id, extractionOrdinal: 0 });
    await db.insert(schedules).values({ eventId: event.id, eventStartDate: opts.date, isMainSchedule: true });
    return { event, post };
  }

  /**
   * A same-account, same-day pair with a bilingual name: trigram similarity about 0.6, so the tier stays mid (not
   * promoted to high, which the drain owns) with the organizer anchor, and the floor passes. The label only tells
   * the tests apart; names carry no digits, which would make names contradict.
   */
  async function makePair(label: string, date: string, opts: { newAccountId?: string; newDate?: string; candidateName?: string; newName?: string } = {}) {
    const candidate = await makeEvent({ accountId: account.id, name: opts.candidateName ?? 'Festival Kuliner Nusantara', date });
    const newSide = await makeEvent({ accountId: opts.newAccountId ?? account.id, name: opts.newName ?? 'Nusantara Culinary Festival', date: opts.newDate ?? date });
    const [suggestion] = await db
      .insert(eventMatchCandidates)
      .values({ eventId: newSide.event.id, candidateEventId: candidate.event.id, score: 0.6, postId: newSide.post.id })
      .returning();
    return { candidate, newSide, suggestion };
  }

  const hashOf = async (suggestionId: string) => {
    const fresh = await lookupFreshPair(db, suggestionId);
    assert.strictEqual(fresh.kind, 'pair', 'the fixture pair must be evaluable');
    return (fresh as Extract<typeof fresh, { kind: 'pair' }>).pair.evidenceHash;
  };
  const suggestionRow = async (id: string) => (await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, id)))[0];
  const baseInput = (decisions: DedupReviewApplyInput['decisions'], overrides: Partial<DedupReviewApplyInput> = {}): DedupReviewApplyInput => ({
    decisions,
    invokerHash: sha256(MOD_EMAIL),
    runTag: 'test-run',
    mode: 'apply',
    live: false,
    ...overrides,
  });

  await t.test('resolveInvokerUserId: exactly one active moderator, one refusal for everything else, no hash or email in it', async () => {
    assert.strictEqual(await resolveInvokerUserId(db, sha256(MOD_EMAIL)), moderator.id);

    const spaced = await mkUser(`  Ddap-Spaced-${suffix}@Example.com `, 'moderator');
    assert.strictEqual(await resolveInvokerUserId(db, sha256(`ddap-spaced-${suffix}@example.com`)), spaced.id, 'the address is lower-cased and trimmed before it is hashed');

    await mkUser(`Ddap-Dup-${suffix}@example.com`, 'moderator');
    await mkUser(`ddap-dup-${suffix}@example.com`, 'moderator');
    await mkUser(`ddap-plain-${suffix}@example.com`, 'user');
    await mkUser(`ddap-gone-${suffix}@example.com`, 'moderator', true);
    const live = await mkUser(`ddap-twin-${suffix}@example.com`, 'moderator');
    await mkUser(`Ddap-Twin-${suffix}@example.com`, 'moderator', true);
    assert.strictEqual(await resolveInvokerUserId(db, sha256(`ddap-twin-${suffix}@example.com`)), live.id, 'a deleted account whose address differs only in case does not make the active moderator ambiguous');

    const messages = new Set<string>();
    for (const email of [`ddap-dup-${suffix}@example.com`, `ddap-plain-${suffix}@example.com`, `ddap-gone-${suffix}@example.com`, `ddap-nobody-${suffix}@example.com`]) {
      const hash = sha256(email);
      await assert.rejects(resolveInvokerUserId(db, hash), (err: unknown) => {
        assert.ok(err instanceof DedupReviewInvokerError, email);
        assert.ok(!(err as Error).message.includes(hash));
        assert.ok(!(err as Error).message.includes(email));
        messages.add((err as Error).message);
        return true;
      });
    }
    assert.strictEqual(messages.size, 1, 'two matches, a non-moderator, a deleted moderator and no match all read the same');
  });

  await t.test('countAiActionsLast24h counts ai_skill merges (undone included) and ai_skill rejections from the last day only', async () => {
    const before = await countAiActionsLast24h(db);
    const live = await makePair('Count Live', '2027-01-10');
    const undone = await makePair('Count Undone', '2027-01-11');
    const old = await makePair('Count Old', '2027-01-12');
    const rejected = await makePair('Count Rejected', '2027-01-13');
    const human = await makePair('Count Human', '2027-01-14');
    const merge = (p: typeof live, via: 'ai_skill' | 'moderator', extra: Partial<typeof eventMerges.$inferInsert> = {}) =>
      db.insert(eventMerges).values({ winnerEventId: p.candidate.event.id, loserEventId: p.newSide.event.id, suggestionId: p.suggestion.id, performedByModeratorId: moderator.id, performedVia: via, loserPriorSlug: 'x-' + suffix, ...extra });
    await merge(live, 'ai_skill');
    await merge(undone, 'ai_skill', { undoneAt: new Date() });
    await merge(old, 'ai_skill', { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    await merge(human, 'moderator');
    await db.update(eventMatchCandidates).set({ status: 'rejected', resolvedAt: new Date(), resolvedByModeratorId: moderator.id, resolvedVia: 'ai_skill' }).where(eq(eventMatchCandidates.id, rejected.suggestion.id));

    // At least these three: other test files that run beside this one may add their own ai_skill rows for a moment.
    assert.ok((await countAiActionsLast24h(db)) - before >= 3, 'a live merge, an undone merge and a rejection count');
    const withoutOldAndHuman = await countAiActionsLast24h(db);
    await merge(await makePair('Count Old Again', '2027-01-15'), 'ai_skill', { createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) });
    await merge(await makePair('Count Human Again', '2027-01-16'), 'moderator');
    assert.ok((await countAiActionsLast24h(db)) - withoutOldAndHuman <= 1, 'an old merge and a human merge add nothing (one unrelated writer may add a row)');
  });

  await t.test('lookupFreshPair names why there is no pair, and returns the pair, both event ids and the venue conflict otherwise', async () => {
    assert.deepStrictEqual(await lookupFreshPair(db, '00000000-0000-4000-8000-000000000000'), { kind: 'unknown-suggestion' });

    const resolved = await makePair('Lookup Resolved', '2027-02-01');
    await db.update(eventMatchCandidates).set({ status: 'rejected', resolvedAt: new Date() }).where(eq(eventMatchCandidates.id, resolved.suggestion.id));
    assert.deepStrictEqual(await lookupFreshPair(db, resolved.suggestion.id), { kind: 'not-pending' });

    const stale = await makePair('Lookup Stale', '2027-02-02');
    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, stale.newSide.event.id));
    assert.deepStrictEqual(await lookupFreshPair(db, stale.suggestion.id), { kind: 'stale-pair' });

    const ok = await makePair('Lookup Ok', '2027-02-03');
    const fresh = await lookupFreshPair(db, ok.suggestion.id);
    assert.strictEqual(fresh.kind, 'pair');
    const pair = fresh as Extract<typeof fresh, { kind: 'pair' }>;
    assert.strictEqual(pair.candidateEventId, ok.candidate.event.id);
    assert.strictEqual(pair.newEventId, ok.newSide.event.id);
    assert.strictEqual(pair.venueConflict, false);
    assert.strictEqual(pair.pair.signals.tier, 'mid', 'the fixture is a mid pair');
    assert.strictEqual(pair.pair.signals.organizerMatch, true, 'and has the organizer anchor');
  });

  await t.test('validate judges without changing anything and reports eligible; --live is a different mode', async () => {
    const p = await makePair('Validate', '2027-03-01');
    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id), action: 'accept' }], { mode: 'validate' }));

    assert.strictEqual(report.mode, 'validate');
    assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, action: 'accept', outcome: 'eligible' }]);
    assert.deepStrictEqual(report.counts, { eligible: 1, merged: 0, rejected: 0, skipped: 0 });
    assert.strictEqual(report.runTag, 'test-run');
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, p.suggestion.id))).length, 0);
  });

  await t.test('a dry run really merges inside the transaction and then rolls everything back', async () => {
    const p = await makePair('Dry', '2027-03-02');
    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id), action: 'accept' }]));

    assert.strictEqual(report.mode, 'dry-run');
    assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, action: 'accept', outcome: 'eligible' }], 'no mergeId in a dry run');
    const row = await suggestionRow(p.suggestion.id);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.resolvedVia, null);
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, p.suggestion.id))).length, 0);
    const [loser] = await db.select().from(events).where(eq(events.id, p.newSide.event.id));
    assert.strictEqual(loser.deletedAt, null);
    assert.strictEqual(loser.mergedIntoEventId, null);
  });

  await t.test('a live run merges through the shared path: ai_skill on both rows, under the invoker', async () => {
    const p = await makePair('Live', '2027-03-03');
    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id), action: 'accept' }], { live: true }));

    assert.strictEqual(report.mode, 'live');
    assert.strictEqual(report.results.length, 1);
    const [result] = report.results;
    assert.strictEqual(result.outcome, 'merged');
    assert.ok(result.mergeId);
    const row = await suggestionRow(p.suggestion.id);
    assert.strictEqual(row.status, 'accepted');
    assert.strictEqual(row.resolvedVia, 'ai_skill');
    assert.strictEqual(row.resolvedByModeratorId, moderator.id);
    const [journal] = await db.select().from(eventMerges).where(eq(eventMerges.id, result.mergeId as string));
    assert.strictEqual(journal.performedVia, 'ai_skill');
    assert.strictEqual(journal.performedByModeratorId, moderator.id);
    assert.strictEqual(journal.winnerEventId, p.candidate.event.id);
    const [loser] = await db.select().from(events).where(eq(events.id, p.newSide.event.id));
    assert.strictEqual(loser.mergedIntoEventId, p.candidate.event.id);
  });

  await t.test('a pair edited after it was reviewed is stale: nothing merges', async () => {
    const p = await makePair('Edited', '2027-03-04');
    const reviewedHash = await hashOf(p.suggestion.id);
    await db.update(events).set({ eventName: 'Festival Kuliner Nusantara Renamed' }).where(eq(events.id, p.candidate.event.id));

    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: reviewedHash, action: 'accept' }], { live: true }));

    assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, action: 'accept', outcome: 'skipped', reason: 'stale-evidence' }]);
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
  });

  await t.test('the floor refuses a pair from another account (it scores low) and one a day apart', async () => {
    const stranger = await makePair('Stranger', '2027-03-05', { newAccountId: otherAccount.id });
    const drift = await makePair('Drift', '2027-03-06', { newDate: '2027-03-07' });
    const report = await runDedupReviewApply(
      db,
      baseInput(
        [
          { suggestionId: stranger.suggestion.id, evidenceHash: await hashOf(stranger.suggestion.id), action: 'accept' },
          { suggestionId: drift.suggestion.id, evidenceHash: await hashOf(drift.suggestion.id), action: 'accept' },
        ],
        { live: true }
      )
    );
    assert.deepStrictEqual(
      report.results.map((r) => [r.outcome, r.reason]),
      [
        ['skipped', 'low-tier'],
        ['skipped', 'outside-window'],
      ]
    );
    assert.strictEqual((await suggestionRow(stranger.suggestion.id)).status, 'pending');
    assert.strictEqual((await suggestionRow(drift.suggestion.id)).status, 'pending');
  });

  await t.test('an unknown suggestion is reported, and the others in the run still apply', async () => {
    const p = await makePair('Mixed', '2027-03-08');
    const report = await runDedupReviewApply(
      db,
      baseInput(
        [
          { suggestionId: '00000000-0000-4000-8000-0000000000aa', evidenceHash: 'a'.repeat(64), action: 'accept' },
          { suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id), action: 'accept' },
        ],
        { live: true }
      )
    );
    assert.deepStrictEqual(
      report.results.map((r) => [r.outcome, r.reason ?? null]),
      [
        ['skipped', 'unknown-suggestion'],
        ['merged', null],
      ]
    );
  });

  await t.test('caps: the per-run cap and the per-day cap stop decisions; a skipped decision uses up nothing', async () => {
    const a = await makePair('Cap A', '2027-04-01');
    const b = await makePair('Cap B', '2027-04-02');
    const c = await makePair('Cap C', '2027-04-03');
    const decisions: DedupReviewApplyInput['decisions'] = [
      { suggestionId: a.suggestion.id, evidenceHash: await hashOf(a.suggestion.id), action: 'accept' },
      { suggestionId: b.suggestion.id, evidenceHash: await hashOf(b.suggestion.id), action: 'accept' },
      { suggestionId: c.suggestion.id, evidenceHash: await hashOf(c.suggestion.id), action: 'accept' },
    ];

    const perRun = await runDedupReviewApply(db, baseInput(decisions, { caps: { perRun: 2 } }));
    assert.deepStrictEqual(perRun.results.map((r) => r.reason ?? r.outcome), ['eligible', 'eligible', 'per-run-cap']);

    // A day cap of zero is full whatever else the shared database holds; the arithmetic of "this run counts
    // against the day" is pinned in the domain tests.
    const perDay = await runDedupReviewApply(db, baseInput(decisions, { caps: { perDay: 0 } }));
    assert.deepStrictEqual(perDay.results.map((r) => r.reason ?? r.outcome), ['per-day-cap', 'per-day-cap', 'per-day-cap']);
    assert.ok(typeof perDay.usedLast24h === 'number');
  });

  await t.test('two decisions that touch one event: the first wins, the second is skipped', async () => {
    const first = await makePair('Shared', '2027-04-05');
    const secondNew = await makeEvent({ accountId: account.id, name: 'Nusantara Culinary Festival Again', date: '2027-04-05' });
    const [second] = await db
      .insert(eventMatchCandidates)
      .values({ eventId: secondNew.event.id, candidateEventId: first.candidate.event.id, score: 0.6, postId: secondNew.post.id })
      .returning();

    const decisions: DedupReviewApplyInput['decisions'] = [
      { suggestionId: first.suggestion.id, evidenceHash: await hashOf(first.suggestion.id), action: 'accept' },
      { suggestionId: second.id, evidenceHash: await hashOf(second.id), action: 'accept' },
    ];

    // Nothing merges in validate, so the second pair is unchanged and is stopped by the claim on the shared winner.
    const validate = await runDedupReviewApply(db, baseInput(decisions, { mode: 'validate' }));
    assert.deepStrictEqual(validate.results.map((r) => r.reason ?? r.outcome), ['eligible', 'event-already-in-run']);

    // Live, the first merge changes the winner's evidence (it gains the loser's posts and schedules), so the second
    // decision no longer matches the evidence the reviewer saw: it is skipped as stale, which is just as safe.
    const live = await runDedupReviewApply(db, baseInput(decisions, { live: true }));
    assert.deepStrictEqual(live.results.map((r) => r.reason ?? r.outcome), ['merged', 'stale-evidence']);
  });

  await t.test('a run by someone who is not a single active moderator is refused before it reads a decision', async () => {
    const p = await makePair('Refused', '2027-04-06');
    for (const mode of ['validate', 'apply'] as const) {
      await assert.rejects(
        runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id), action: 'accept' }], { mode, live: mode === 'apply', invokerHash: sha256('nobody-' + suffix) })),
        DedupReviewInvokerError
      );
    }
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
  });

  await t.test('a moderator who resolves the suggestion while apply waits for its lock turns the decision into concurrent-change', async () => {
    const p = await makePair('Race', '2027-04-07');
    const decisions: DedupReviewApplyInput['decisions'] = [{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id), action: 'accept' }];
    const holder = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
    try {
      let applied: ReturnType<typeof runDedupReviewApply> | undefined;
      await holder.begin(async (tx) => {
        await tx`SELECT id FROM event_match_candidates WHERE id = ${p.suggestion.id} FOR UPDATE`;
        // Apply plans the pair as pending, then blocks on this row's lock.
        applied = runDedupReviewApply(db, baseInput(decisions, { live: true }));
        // Wait until some backend is actually blocked on that row's lock, instead of guessing a delay.
        const deadline = Date.now() + 15_000;
        for (;;) {
          // A row lock is waited on through the holder's transaction id, so a waiter on this transaction's id is apply.
          const waiting = await tx`SELECT 1 FROM pg_locks w WHERE w.locktype = 'transactionid' AND NOT w.granted AND w.transactionid IN (SELECT transactionid FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'transactionid' AND granted)`;
          if (waiting.length > 0) break;
          assert.ok(Date.now() < deadline, 'apply never reached the lock wait');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await tx`UPDATE event_match_candidates SET status = 'rejected', resolved_at = now() WHERE id = ${p.suggestion.id}`;
      });
      const report = await (applied as ReturnType<typeof runDedupReviewApply>);
      assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, action: 'accept', outcome: 'skipped', reason: 'concurrent-change' }]);
      assert.strictEqual((await suggestionRow(p.suggestion.id)).resolvedVia, null, 'the reviewer wrote nothing');
    } finally {
      await holder.end();
    }
  });


  // ---- rejects (FIND-120): off unless the run allows them and, in `apply`, the owner's switch is on ----
  const rejectOf = async (suggestionId: string) => ({ suggestionId, evidenceHash: await hashOf(suggestionId), action: 'reject' as const });
  const acceptOf = async (suggestionId: string) => ({ suggestionId, evidenceHash: await hashOf(suggestionId), action: 'accept' as const });
  const rejectInput = (decisions: DedupReviewApplyInput['decisions'], overrides: Partial<DedupReviewApplyInput> = {}) =>
    baseInput(decisions, { allowRejects: true, rejectsEnabled: true, ...overrides });
  const reasonsOf = (report: Awaited<ReturnType<typeof runDedupReviewApply>>) => report.results.map((r) => r.reason ?? r.outcome);

  await t.test('a reject: validate and a dry run are eligible and change nothing; live records rejected under the invoker, with no journal row, on a pair the floor refuses', async () => {
    const stranger = await makePair('Reject Stranger', '2027-05-01', { newAccountId: otherAccount.id }); // scores low: the floor would refuse an accept
    assert.strictEqual(((await lookupFreshPair(db, stranger.suggestion.id)) as { pair: { signals: { tier: string } } }).pair.signals.tier, 'low', 'the fixture is a floor-refused pair');
    const decisions = [await rejectOf(stranger.suggestion.id)];

    const validated = await runDedupReviewApply(db, rejectInput(decisions, { mode: 'validate', rejectsEnabled: false }));
    assert.deepStrictEqual(validated.results, [{ suggestionId: stranger.suggestion.id, action: 'reject', outcome: 'eligible' }], 'validate cannot see the owner variable and needs only the flag');
    assert.deepStrictEqual(validated.counts, { eligible: 1, merged: 0, rejected: 0, skipped: 0 });

    const dry = await runDedupReviewApply(db, rejectInput(decisions));
    assert.deepStrictEqual(dry.results, [{ suggestionId: stranger.suggestion.id, action: 'reject', outcome: 'eligible' }]);
    const pending = await suggestionRow(stranger.suggestion.id);
    assert.strictEqual(pending.status, 'pending', 'a dry run rolled the reject back');
    assert.strictEqual(pending.resolvedVia, null);

    const live = await runDedupReviewApply(db, rejectInput(decisions, { live: true }));
    assert.deepStrictEqual(live.results, [{ suggestionId: stranger.suggestion.id, action: 'reject', outcome: 'rejected' }]);
    assert.deepStrictEqual(live.counts, { eligible: 0, merged: 0, rejected: 1, skipped: 0 });
    const row = await suggestionRow(stranger.suggestion.id);
    assert.strictEqual(row.status, 'rejected');
    assert.strictEqual(row.resolvedVia, 'ai_skill');
    assert.strictEqual(row.resolvedByModeratorId, moderator.id);
    assert.ok(row.resolvedAt);
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, stranger.suggestion.id))).length, 0, 'a reject writes no journal row');
    for (const side of [stranger.candidate, stranger.newSide]) {
      const [event] = await db.select().from(events).where(eq(events.id, side.event.id));
      assert.strictEqual(event.deletedAt, null);
      assert.strictEqual(event.mergedIntoEventId, null);
    }
  });

  await t.test('rejects are off by default: without the flag any run refuses, and in apply without the owner switch the run stops before it reads', async () => {
    const p = await makePair('Reject Off', '2027-05-02');
    const decisions = [await rejectOf(p.suggestion.id)];

    for (const mode of ['validate', 'apply'] as const) {
      await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { mode, live: mode === 'apply', rejectsEnabled: true })), DedupReviewApplyInputError, `${mode} without allowRejects`);
    }
    for (const live of [false, true]) {
      await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { allowRejects: true, live })), DedupReviewRejectsDisabledError, `apply, live ${live}, without the switch`);
      // The switch is checked before the invoker is looked up: the wrong invoker gives the same refusal.
      await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { allowRejects: true, live, invokerHash: sha256('nobody-' + suffix) })), DedupReviewRejectsDisabledError);
    }
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
    // The switch is read from the run, not from the decisions: an accept-only run that allows rejects needs it too (as the workflow's step does).
    await assert.rejects(runDedupReviewApply(db, baseInput([await acceptOf(p.suggestion.id)], { allowRejects: true })), DedupReviewRejectsDisabledError);
    // An accept-only run needs neither.
    const accept = await runDedupReviewApply(db, baseInput([await acceptOf(p.suggestion.id)], { mode: 'validate' }));
    assert.deepStrictEqual(reasonsOf(accept), ['eligible']);
  });

  await t.test('a reject is skipped when the pair is gone, stale or already high, with the same reasons as an accept (and no floor for the rest)', async () => {
    const edited = await makePair('Reject Edited', '2027-05-03');
    const reviewedHash = await hashOf(edited.suggestion.id);
    await db.update(events).set({ eventName: 'Festival Kuliner Nusantara Renamed' }).where(eq(events.id, edited.candidate.event.id));
    const gone = await makePair('Reject Gone', '2027-05-04');
    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, gone.newSide.event.id));
    const decided = await makePair('Reject Decided', '2027-05-05');
    const decidedHash = await hashOf(decided.suggestion.id);
    await db.update(eventMatchCandidates).set({ status: 'accepted', resolvedAt: new Date() }).where(eq(eventMatchCandidates.id, decided.suggestion.id));
    // The same name, account and day: scores high, which the drain merges on its own.
    const high = await makePair('Reject High', '2027-05-06', { candidateName: 'Festival Kuliner Nusantara', newName: 'Festival Kuliner Nusantara' });
    assert.strictEqual(((await lookupFreshPair(db, high.suggestion.id)) as { pair: { signals: { tier: string } } }).pair.signals.tier, 'high', 'the fixture is a high pair');
    const goneHash = 'c'.repeat(64);

    const report = await runDedupReviewApply(
      db,
      rejectInput([
        { suggestionId: edited.suggestion.id, evidenceHash: reviewedHash, action: 'reject' },
        { suggestionId: gone.suggestion.id, evidenceHash: goneHash, action: 'reject' },
        { suggestionId: decided.suggestion.id, evidenceHash: decidedHash, action: 'reject' },
        { suggestionId: '00000000-0000-4000-8000-0000000000bb', evidenceHash: goneHash, action: 'reject' },
        await rejectOf(high.suggestion.id),
      ], { live: true })
    );
    assert.deepStrictEqual(reasonsOf(report), ['stale-evidence', 'stale-pair', 'not-pending', 'unknown-suggestion', 'already-high']);
    assert.ok(report.results.every((r) => r.action === 'reject'));
    assert.strictEqual((await suggestionRow(edited.suggestion.id)).status, 'pending');
    assert.strictEqual((await suggestionRow(high.suggestion.id)).status, 'pending', 'a high pair is left to the drain');
  });

  await t.test('rejects have a cap of their own, apart from the merges; both count in the shared day cap; the per-run cap never applies to a reject', async () => {
    const accepts = [await makePair('Mix A1', '2027-05-10'), await makePair('Mix A2', '2027-05-11')];
    const rejects = [await makePair('Mix R1', '2027-05-12'), await makePair('Mix R2', '2027-05-13')];
    const decisions = [await acceptOf(accepts[0].suggestion.id), await acceptOf(accepts[1].suggestion.id), await rejectOf(rejects[0].suggestion.id), await rejectOf(rejects[1].suggestion.id)];

    const apart = await runDedupReviewApply(db, rejectInput(decisions, { caps: { perRun: 1, perDayRejects: 25, perDay: 1000 } }));
    assert.deepStrictEqual(reasonsOf(apart), ['eligible', 'per-run-cap', 'eligible', 'eligible'], 'one merge fits, and both rejects fit beside it');
    // The shared database already holds rejects of the last day (this file made some), so the cap is set from the real count.
    const usedRejects = await countAiRejectsLast24h(db);
    const rejectCap = await runDedupReviewApply(db, rejectInput(decisions, { mode: 'validate', caps: { perRun: 10, perDayRejects: usedRejects + 1, perDay: 1000 } }));
    assert.deepStrictEqual(reasonsOf(rejectCap), ['eligible', 'eligible', 'eligible', 'per-day-cap'], 'the reject cap binds alone (one reject fits), the accepts do not feel it');
    const noRejects = await runDedupReviewApply(db, rejectInput(decisions, { caps: { perDayRejects: 0, perDay: 1000 } }));
    assert.deepStrictEqual(reasonsOf(noRejects), ['eligible', 'eligible', 'per-day-cap', 'per-day-cap']);
    const noDay = await runDedupReviewApply(db, rejectInput(decisions, { caps: { perDay: 0 } }));
    assert.deepStrictEqual(reasonsOf(noDay), ['per-day-cap', 'per-day-cap', 'per-day-cap', 'per-day-cap'], 'the shared day cap binds merges and rejects alike');
    const used = noDay.usedLast24h as number;
    const shared = await runDedupReviewApply(db, rejectInput(decisions, { mode: 'validate', caps: { perDay: used + 3, perDayRejects: 25 } }));
    assert.deepStrictEqual(reasonsOf(shared), ['eligible', 'eligible', 'eligible', 'per-day-cap'], 'two merges and one reject fill the room that was left');
    const both = await runDedupReviewApply(db, rejectInput(decisions, { mode: 'validate', caps: { perDay: 0, perDayRejects: 0 } }));
    assert.deepStrictEqual(reasonsOf(both), ['per-day-cap', 'per-day-cap', 'per-day-cap', 'per-day-cap'], 'both bind together');
    assert.deepStrictEqual(both.caps, { perRun: 10, perDay: 0, perDayRejects: 0 }, 'the report names the reject cap');
  });

  await t.test('a mixed live run merges and rejects; a reject does not claim an event, an accept does', async () => {
    const accept = await makePair('Live Mixed Accept', '2027-05-14');
    const reject = await makePair('Live Mixed Reject', '2027-05-15');
    const report = await runDedupReviewApply(db, rejectInput([await acceptOf(accept.suggestion.id), await rejectOf(reject.suggestion.id)], { live: true }));
    assert.deepStrictEqual(report.results.map((r) => [r.action, r.outcome]), [['accept', 'merged'], ['reject', 'rejected']]);
    assert.deepStrictEqual(report.counts, { eligible: 0, merged: 1, rejected: 1, skipped: 0 });
    assert.strictEqual((await suggestionRow(accept.suggestion.id)).status, 'accepted');
    assert.strictEqual((await suggestionRow(reject.suggestion.id)).status, 'rejected');

    // Two pairs on one winner: an accept first claims it, so validate skips the reject; the other way round both stand.
    const first = await makePair('Shared Reject', '2027-05-16');
    const secondNew = await makeEvent({ accountId: account.id, name: 'Nusantara Culinary Festival Again', date: '2027-05-16' });
    const [second] = await db.insert(eventMatchCandidates).values({ eventId: secondNew.event.id, candidateEventId: first.candidate.event.id, score: 0.6, postId: secondNew.post.id }).returning();
    const acceptFirst = [await acceptOf(first.suggestion.id), await rejectOf(second.id)];
    const rejectFirst = [await rejectOf(second.id), await acceptOf(first.suggestion.id)];

    const v1 = await runDedupReviewApply(db, rejectInput(acceptFirst, { mode: 'validate' }));
    assert.deepStrictEqual(reasonsOf(v1), ['eligible', 'event-already-in-run'], 'validate: the accept claims the winner');
    const v2 = await runDedupReviewApply(db, rejectInput(rejectFirst, { mode: 'validate' }));
    assert.deepStrictEqual(reasonsOf(v2), ['eligible', 'eligible'], 'a reject then an accept on a shared event is allowed');

    const live1 = await runDedupReviewApply(db, rejectInput(acceptFirst, { live: true }));
    assert.strictEqual(live1.results[0].outcome, 'merged');
    assert.ok(['stale-evidence', 'stale-pair'].includes(live1.results[1].reason as string), 'live: after the merge the other pair has changed, so it is stale, not event-already-in-run');
    assert.strictEqual((await suggestionRow(second.id)).status, 'pending');
  });

  await t.test('a reject whose row is resolved while apply waits for its lock turns into concurrent-change', async () => {
    const p = await makePair('Reject Race', '2027-05-17');
    const decisions = [await rejectOf(p.suggestion.id)];
    const holder = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
    try {
      let applied: ReturnType<typeof runDedupReviewApply> | undefined;
      await holder.begin(async (tx) => {
        await tx`SELECT id FROM event_match_candidates WHERE id = ${p.suggestion.id} FOR UPDATE`;
        applied = runDedupReviewApply(db, rejectInput(decisions, { live: true }));
        const deadline = Date.now() + 15_000;
        for (;;) {
          const waiting = await tx`SELECT 1 FROM pg_locks w WHERE w.locktype = 'transactionid' AND NOT w.granted AND w.transactionid IN (SELECT transactionid FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'transactionid' AND granted)`;
          if (waiting.length > 0) break;
          assert.ok(Date.now() < deadline, 'apply never reached the lock wait');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await tx`UPDATE event_match_candidates SET status = 'accepted', resolved_at = now() WHERE id = ${p.suggestion.id}`;
      });
      const report = await (applied as ReturnType<typeof runDedupReviewApply>);
      assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, action: 'reject', outcome: 'skipped', reason: 'concurrent-change' }]);
      assert.strictEqual((await suggestionRow(p.suggestion.id)).resolvedVia, null, 'the reviewer wrote nothing');
    } finally {
      await holder.end();
    }
  });

  await t.test('a reject is judged again under the lock: a pair edited while apply waits is concurrent-change, not rejected', async () => {
    const p = await makePair('Reject Edited Waiting', '2027-05-18');
    const decisions = [await rejectOf(p.suggestion.id)];
    const holder = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
    try {
      let applied: ReturnType<typeof runDedupReviewApply> | undefined;
      await holder.begin(async (tx) => {
        await tx`SELECT id FROM event_match_candidates WHERE id = ${p.suggestion.id} FOR UPDATE`;
        applied = runDedupReviewApply(db, rejectInput(decisions, { live: true }));
        const deadline = Date.now() + 15_000;
        for (;;) {
          const waiting = await tx`SELECT 1 FROM pg_locks w WHERE w.locktype = 'transactionid' AND NOT w.granted AND w.transactionid IN (SELECT transactionid FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'transactionid' AND granted)`;
          if (waiting.length > 0) break;
          assert.ok(Date.now() < deadline, 'apply never reached the lock wait');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        // The suggestion stays pending; an event of the pair changes, so the evidence the moderator saw no longer holds.
        await tx`UPDATE events SET event_name = 'Festival Kuliner Nusantara Edited While Waiting' WHERE id = ${p.candidate.event.id}`;
      });
      const report = await (applied as ReturnType<typeof runDedupReviewApply>);
      assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, action: 'reject', outcome: 'skipped', reason: 'concurrent-change' }]);
      assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending', 'nothing was rejected on stale evidence');
    } finally {
      await holder.end();
    }
  });

  await t.test('countAiRejectsLast24h counts only ai_skill rejects of the last day; countAiActionsLast24h still includes them', async () => {
    const before = await countAiRejectsLast24h(db);
    const beforeAll = await countAiActionsLast24h(db);
    const fresh = await makePair('Count Reject Fresh', '2027-05-20');
    const old = await makePair('Count Reject Old', '2027-05-21');
    const human = await makePair('Count Reject Human', '2027-05-22');
    const set = (id: string, values: Partial<typeof eventMatchCandidates.$inferInsert>) => db.update(eventMatchCandidates).set({ status: 'rejected', resolvedByModeratorId: moderator.id, ...values }).where(eq(eventMatchCandidates.id, id));
    await set(fresh.suggestion.id, { resolvedAt: new Date(), resolvedVia: 'ai_skill' });
    await set(old.suggestion.id, { resolvedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), resolvedVia: 'ai_skill' });
    await set(human.suggestion.id, { resolvedAt: new Date(), resolvedVia: 'moderator' });

    // Other test files run beside this one and may add their own rows for a moment: the difference is at least the fresh reject.
    assert.ok((await countAiRejectsLast24h(db)) - before >= 1, 'a fresh ai_skill reject counts');
    const afterOld = await countAiRejectsLast24h(db);
    await set((await makePair('Count Reject Old Again', '2027-05-23')).suggestion.id, { resolvedAt: new Date(Date.now() - 30 * 60 * 60 * 1000), resolvedVia: 'ai_skill' });
    for (const day of ['24', '25', '26']) {
      await set((await makePair('Count Reject Human ' + day, '2027-05-' + day)).suggestion.id, { resolvedAt: new Date(), resolvedVia: 'moderator' });
    }
    assert.ok((await countAiRejectsLast24h(db)) - afterOld <= 1, 'an old reject and three human rejects add nothing (one unrelated writer may add a row)');
    assert.ok((await countAiActionsLast24h(db)) - beforeAll >= 1, 'the shared count includes the reject');
  });

  // ---- floor override (FIND-124): `accept-override` merges with no floor; off unless the run allows it and, in `apply`, the owner's switch is on ----
  const overrideOf = async (suggestionId: string) => ({ suggestionId, evidenceHash: await hashOf(suggestionId), action: 'accept-override' as const });
  const overrideInput = (decisions: DedupReviewApplyInput['decisions'], overrides: Partial<DedupReviewApplyInput> = {}) =>
    baseInput(decisions, { allowFloorOverride: true, floorOverrideEnabled: true, ...overrides });
  /** One pair per floor code the DB fixtures can build, on dates no other test uses. */
  const floorRefused = async () => ({
    'low-tier': await makePair('Override Stranger', '2027-07-01', { newAccountId: otherAccount.id }),
    'outside-window': await makePair('Override Drift', '2027-07-03', { newDate: '2027-07-04' }),
    'name-mismatch': await makePair('Override Names', '2027-07-05', { candidateName: 'Festival Kuliner Nusantara Part 1', newName: 'Nusantara Culinary Festival Part 2' }),
  });

  await t.test('an override: validate and a dry run are eligible and change nothing; live merges a pair the floor refuses, under the invoker, as an undoable journal row', async () => {
    const refused = await floorRefused();
    for (const [code, p] of Object.entries(refused)) {
      const asAccept = await runDedupReviewApply(db, baseInput([await acceptOf(p.suggestion.id)], { mode: 'validate' }));
      assert.deepStrictEqual(reasonsOf(asAccept), [code], `${code}: the same pair is refused as an accept`);
    }
    const decisions = [await overrideOf(refused['low-tier'].suggestion.id), await overrideOf(refused['outside-window'].suggestion.id), await overrideOf(refused['name-mismatch'].suggestion.id)];

    const validated = await runDedupReviewApply(db, overrideInput(decisions, { mode: 'validate', floorOverrideEnabled: false }));
    assert.deepStrictEqual(reasonsOf(validated), ['eligible', 'eligible', 'eligible'], 'validate cannot see the owner variable and needs only the flag');
    assert.deepStrictEqual(validated.results.map((r) => r.action), ['accept-override', 'accept-override', 'accept-override']);

    const dry = await runDedupReviewApply(db, overrideInput(decisions));
    assert.deepStrictEqual(reasonsOf(dry), ['eligible', 'eligible', 'eligible']);
    for (const p of Object.values(refused)) assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending', 'a dry run rolled the merge back');

    const live = await runDedupReviewApply(db, overrideInput(decisions, { live: true }));
    assert.deepStrictEqual(live.results.map((r) => [r.action, r.outcome]), [['accept-override', 'merged'], ['accept-override', 'merged'], ['accept-override', 'merged']]);
    assert.deepStrictEqual(live.counts, { eligible: 0, merged: 3, rejected: 0, skipped: 0 }, 'an override counts as a merge');
    for (const [result, p] of live.results.map((r, i) => [r, Object.values(refused)[i]] as const)) {
      const row = await suggestionRow(p.suggestion.id);
      assert.strictEqual(row.status, 'accepted');
      assert.strictEqual(row.resolvedVia, 'ai_skill');
      assert.strictEqual(row.resolvedByModeratorId, moderator.id);
      const [journal] = await db.select().from(eventMerges).where(eq(eventMerges.id, result.mergeId as string));
      assert.strictEqual(journal.performedVia, 'ai_skill', 'nothing marks an override in the journal (known gap)');
      assert.strictEqual(journal.undoneAt, null, 'the merge is undoable');
      const [loser] = await db.select().from(events).where(eq(events.id, p.newSide.event.id));
      assert.strictEqual(loser.mergedIntoEventId, p.candidate.event.id);
    }
  });

  await t.test('overrides are off by default: without the flag any run refuses, and in apply without the owner switch the run stops before it reads; the reject switch does not stand in', async () => {
    const p = await makePair('Override Off', '2027-07-06');
    const decisions = [await overrideOf(p.suggestion.id)];

    for (const mode of ['validate', 'apply'] as const) {
      await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { mode, live: mode === 'apply', floorOverrideEnabled: true })), DedupReviewApplyInputError, `${mode} without allowFloorOverride`);
    }
    await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { allowRejects: true, rejectsEnabled: true })), DedupReviewApplyInputError, 'the reject flag and switch do not allow overrides');
    for (const live of [false, true]) {
      await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { allowFloorOverride: true, live, rejectsEnabled: true })), DedupReviewFloorOverrideDisabledError, `apply, live ${live}, without the switch`);
      // The switch is checked before the invoker is looked up: the wrong invoker gives the same refusal.
      await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { allowFloorOverride: true, live, invokerHash: sha256('nobody-' + suffix) })), DedupReviewFloorOverrideDisabledError);
    }
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
    // The switch is read from the run, not from the decisions: an accept-only run that allows overrides needs it too.
    await assert.rejects(runDedupReviewApply(db, baseInput([await acceptOf(p.suggestion.id)], { allowFloorOverride: true })), DedupReviewFloorOverrideDisabledError);
    // The order of refusals: the reject switch is checked first.
    await assert.rejects(runDedupReviewApply(db, baseInput(decisions, { allowRejects: true, allowFloorOverride: true })), DedupReviewRejectsDisabledError);
    // `validate` with the flag needs no switch, and an accept-only run needs neither.
    assert.deepStrictEqual(reasonsOf(await runDedupReviewApply(db, baseInput(decisions, { mode: 'validate', allowFloorOverride: true }))), ['eligible']);
    assert.deepStrictEqual(reasonsOf(await runDedupReviewApply(db, baseInput([await acceptOf(p.suggestion.id)], { mode: 'validate' }))), ['eligible']);
  });

  await t.test('an override is skipped when the pair is gone or stale, or an earlier merge claimed an event, like an accept', async () => {
    const stale = await makePair('Override Stale', '2027-07-07', { newAccountId: otherAccount.id });
    const reviewed = await hashOf(stale.suggestion.id);
    await db.update(events).set({ eventName: 'Festival Kuliner Nusantara Renamed' }).where(eq(events.id, stale.candidate.event.id));
    const gone = await makePair('Override Gone', '2027-07-08', { newAccountId: otherAccount.id });
    const goneDecision = await overrideOf(gone.suggestion.id);
    await db.update(eventMatchCandidates).set({ status: 'rejected', resolvedAt: new Date() }).where(eq(eventMatchCandidates.id, gone.suggestion.id));
    const report = await runDedupReviewApply(
      db,
      overrideInput([{ suggestionId: stale.suggestion.id, evidenceHash: reviewed, action: 'accept-override' }, goneDecision, { suggestionId: '00000000-0000-4000-8000-0000000000aa', evidenceHash: 'a'.repeat(64), action: 'accept-override' }], { live: true })
    );
    assert.deepStrictEqual(reasonsOf(report), ['stale-evidence', 'not-pending', 'unknown-suggestion']);

    // Two pairs on one winner: the first merge claims it. In validate the second is event-already-in-run; live, it is stale after the merge.
    const first = await makePair('Override Shared', '2027-07-09', { newAccountId: otherAccount.id });
    const secondNew = await makeEvent({ accountId: otherAccount.id, name: 'Nusantara Culinary Festival Again', date: '2027-07-09' });
    const [second] = await db.insert(eventMatchCandidates).values({ eventId: secondNew.event.id, candidateEventId: first.candidate.event.id, score: 0.6, postId: secondNew.post.id }).returning();
    const both = [await overrideOf(first.suggestion.id), await overrideOf(second.id)];
    assert.deepStrictEqual(reasonsOf(await runDedupReviewApply(db, overrideInput(both, { mode: 'validate' }))), ['eligible', 'event-already-in-run']);
    const live = await runDedupReviewApply(db, overrideInput(both, { live: true }));
    assert.strictEqual(live.results[0].outcome, 'merged');
    assert.ok(['stale-evidence', 'stale-pair'].includes(live.results[1].reason as string));
    assert.strictEqual((await suggestionRow(second.id)).status, 'pending');
  });

  await t.test('overrides share the caps with merges: the per-run cap counts accepts and overrides together, and the day cap counts rejects too', async () => {
    const a = await makePair('Cap Accept', '2027-07-10');
    const o1 = await makePair('Cap Override 1', '2027-07-11', { newAccountId: otherAccount.id });
    const o2 = await makePair('Cap Override 2', '2027-07-12', { newAccountId: otherAccount.id });
    const decisions = [await acceptOf(a.suggestion.id), await overrideOf(o1.suggestion.id), await overrideOf(o2.suggestion.id)];
    const perRun = await runDedupReviewApply(db, overrideInput(decisions, { mode: 'validate', caps: { perRun: 2 } }));
    assert.deepStrictEqual(reasonsOf(perRun), ['eligible', 'eligible', 'per-run-cap'], 'the accept and the first override use the per-run cap of merges');
    const used = await countAiActionsLast24h(db); // the database is shared with earlier tests: the day cap is measured from what is already used
    const perDay = await runDedupReviewApply(db, overrideInput(decisions, { mode: 'validate', caps: { perDay: used + 2 } }));
    assert.deepStrictEqual(reasonsOf(perDay), ['eligible', 'eligible', 'per-day-cap'], 'and the shared day cap');
    const rejectFirst = await runDedupReviewApply(
      db,
      overrideInput([await rejectOf(a.suggestion.id), await overrideOf(o1.suggestion.id), await overrideOf(o2.suggestion.id)], { mode: 'validate', allowRejects: true, rejectsEnabled: true, caps: { perDay: used + 2 } })
    );
    assert.deepStrictEqual(reasonsOf(rejectFirst), ['eligible', 'eligible', 'per-day-cap'], 'a reject in the run counts against the day cap an override uses');
  });

  await t.test('a mixed file judges each action by its own rule: the accept by the floor, the override without it, the reject without it either', async () => {
    const ok = await makePair('Mixed OK', '2027-07-13');
    const refused = await makePair('Mixed Refused', '2027-07-14', { newAccountId: otherAccount.id });
    const reject = await makePair('Mixed Reject', '2027-07-15', { newAccountId: otherAccount.id });
    const asAccept = await runDedupReviewApply(db, overrideInput([await acceptOf(ok.suggestion.id), await acceptOf(refused.suggestion.id)], { mode: 'validate' }));
    assert.deepStrictEqual(reasonsOf(asAccept), ['eligible', 'low-tier'], 'an accept of a floor-refused pair is still refused in a run that allows overrides');
    const mixed = await runDedupReviewApply(
      db,
      overrideInput([await acceptOf(ok.suggestion.id), await overrideOf(refused.suggestion.id), await rejectOf(reject.suggestion.id)], { live: true, allowRejects: true, rejectsEnabled: true })
    );
    assert.deepStrictEqual(mixed.results.map((r) => [r.action, r.outcome]), [['accept', 'merged'], ['accept-override', 'merged'], ['reject', 'rejected']]);
    assert.deepStrictEqual(mixed.counts, { eligible: 0, merged: 2, rejected: 1, skipped: 0 });
  });

  await t.test('an override locks the suggestion row and both event rows like an accept; a reject locks the suggestion row only', async () => {
    /** Wraps a database so every `.select().from(table)...for('update')` of the run is recorded, by table name. */
    const locked: string[] = [];
    const tableName = (table: unknown) => (table === events ? 'events' : table === eventMatchCandidates ? 'event_match_candidates' : 'other');
    const trace = <T extends object>(target: T, chain: { from?: string } = {}): T =>
      new Proxy(target, {
        get(obj, prop) {
          const value = Reflect.get(obj, prop, obj);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            if (prop === 'from') chain.from = tableName(args[0]);
            if (prop === 'for' && args[0] === 'update') locked.push(chain.from ?? 'unknown');
            const result = value.apply(obj, args);
            if (prop === 'select') return trace(result as object, {});
            if (prop === 'transaction' && typeof args[0] === 'function') return result;
            return result !== null && typeof result === 'object' && prop !== 'then' && !(result instanceof Promise) ? trace(result as object, chain) : result;
          };
        },
      });
    const withLockLog = (database: typeof db) =>
      ({
        transaction: (work: (tx: unknown) => unknown, config?: unknown) =>
          database.transaction((tx) => {
            const traced = new Proxy(tx as object, {
              get(obj, prop) {
                const value = Reflect.get(obj, prop, obj);
                if (prop === 'select') return trace(value.bind(obj) as object);
                if (prop === 'transaction') return (inner: (sp: unknown) => unknown) => (value as (cb: (sp: never) => unknown) => unknown).call(obj, (sp: never) => inner(trace(sp as object)));
                return typeof value === 'function' ? value.bind(obj) : value;
              },
            });
            return work(traced) as never;
          }, config as never),
      }) as unknown as typeof db;

    const lockedBy = async (decide: (id: string) => Promise<DedupReviewApplyInput['decisions'][number]>, input: Partial<DedupReviewApplyInput>) => {
      const p = await makePair('Lock ' + Math.random(), '2027-07-20', { newAccountId: otherAccount.id });
      locked.length = 0;
      await runDedupReviewApply(withLockLog(db), baseInput([await decide(p.suggestion.id)], { live: true, ...input }));
      return [...locked];
    };
    const accepting = await lockedBy(acceptOf, {});
    const overriding = await lockedBy(overrideOf, { allowFloorOverride: true, floorOverrideEnabled: true });
    const rejecting = await lockedBy(rejectOf, { allowRejects: true, rejectsEnabled: true });
    // An accept of this floor-refused pair never reaches the locks (it is skipped), so lock it with a pair the floor passes.
    const passing = await makePair('Lock Passing', '2027-07-21');
    locked.length = 0;
    await runDedupReviewApply(withLockLog(db), baseInput([await acceptOf(passing.suggestion.id)], { live: true }));
    const accepted = [...locked];
    assert.deepStrictEqual(accepting, [], 'a floor-refused accept is skipped before any lock');
    assert.ok(accepted.includes('event_match_candidates') && accepted.filter((n) => n === 'events').length === 1, `an accept locks the suggestion and the events: ${accepted.join(',')}`);
    assert.deepStrictEqual(overriding, accepted, 'an override locks exactly what an accept locks');
    assert.deepStrictEqual([...new Set(rejecting)], ['event_match_candidates'], 'a reject locks the suggestion row only (twice: the decision, then the shared resolve function)');
  });

  await t.test('isRunFatalDatabaseError: write refused, privilege, connection, deadlock and lock timeout stop the run; a unique violation is the decision\'s own', () => {
    for (const code of ['25006', '42501', '42883', '08006', '53300', '57P01', '40001', '40P01', '55P03', '28P01']) {
      assert.strictEqual(isRunFatalDatabaseError(Object.assign(new Error('x'), { code })), true, code);
    }
    for (const code of ['23505', '23503', '22P02', 'XX000']) {
      assert.strictEqual(isRunFatalDatabaseError(Object.assign(new Error('x'), { code })), false, code);
    }
    assert.strictEqual(isRunFatalDatabaseError(new Error('no code')), false);
    assert.strictEqual(isRunFatalDatabaseError(null), false);
    assert.strictEqual(isRunFatalDatabaseError('25006'), false);
  });
});
