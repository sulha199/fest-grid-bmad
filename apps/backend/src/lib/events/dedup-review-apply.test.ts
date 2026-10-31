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
import { DedupReviewInvokerError } from './dedup-review-errors.js';
import { countAiActionsLast24h, lookupFreshPair, resolveInvokerUserId, runDedupReviewApply, type DedupReviewApplyInput } from './dedup-review-apply.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

test('dedup review apply (AI dedup review, piece B2b-1)', async (t) => {
  const suffix = Date.now() + '-ddap';
  const eventIds: string[] = [];
  const postIds: string[] = [];
  const userIds: string[] = [];
  const suggestionIds: string[] = [];

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
    suggestionIds.push(suggestion.id);
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

    assert.strictEqual((await countAiActionsLast24h(db)) - before, 3, 'a live merge, an undone merge and a rejection; not the old merge, not the human one');
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
    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id) }], { mode: 'validate' }));

    assert.strictEqual(report.mode, 'validate');
    assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, outcome: 'eligible' }]);
    assert.deepStrictEqual(report.counts, { eligible: 1, merged: 0, skipped: 0 });
    assert.strictEqual(report.runTag, 'test-run');
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, p.suggestion.id))).length, 0);
  });

  await t.test('a dry run really merges inside the transaction and then rolls everything back', async () => {
    const p = await makePair('Dry', '2027-03-02');
    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id) }]));

    assert.strictEqual(report.mode, 'dry-run');
    assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, outcome: 'eligible' }], 'no mergeId in a dry run');
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
    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id) }], { live: true }));

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

    const report = await runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: reviewedHash }], { live: true }));

    assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, outcome: 'skipped', reason: 'stale-evidence' }]);
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
  });

  await t.test('the floor refuses a pair from another account (it scores low) and one a day apart', async () => {
    const stranger = await makePair('Stranger', '2027-03-05', { newAccountId: otherAccount.id });
    const drift = await makePair('Drift', '2027-03-06', { newDate: '2027-03-07' });
    const report = await runDedupReviewApply(
      db,
      baseInput(
        [
          { suggestionId: stranger.suggestion.id, evidenceHash: await hashOf(stranger.suggestion.id) },
          { suggestionId: drift.suggestion.id, evidenceHash: await hashOf(drift.suggestion.id) },
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
          { suggestionId: '00000000-0000-4000-8000-0000000000aa', evidenceHash: 'a'.repeat(64) },
          { suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id) },
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

  await t.test('caps: the per-run cap and the per-day cap stop later decisions; a skipped decision uses up nothing', async () => {
    const a = await makePair('Cap A', '2027-04-01');
    const b = await makePair('Cap B', '2027-04-02');
    const c = await makePair('Cap C', '2027-04-03');
    const decisions = [
      { suggestionId: a.suggestion.id, evidenceHash: await hashOf(a.suggestion.id) },
      { suggestionId: b.suggestion.id, evidenceHash: await hashOf(b.suggestion.id) },
      { suggestionId: c.suggestion.id, evidenceHash: await hashOf(c.suggestion.id) },
    ];

    const perRun = await runDedupReviewApply(db, baseInput(decisions, { caps: { perRun: 2 } }));
    assert.deepStrictEqual(perRun.results.map((r) => r.reason ?? r.outcome), ['eligible', 'eligible', 'per-run-cap']);

    const used = await countAiActionsLast24h(db);
    const perDay = await runDedupReviewApply(db, baseInput(decisions, { caps: { perDay: used + 1 } }));
    assert.strictEqual(perDay.usedLast24h, used);
    assert.deepStrictEqual(perDay.results.map((r) => r.reason ?? r.outcome), ['eligible', 'per-day-cap', 'per-day-cap']);
  });

  await t.test('two decisions that touch one event: the first wins, the second is skipped', async () => {
    const first = await makePair('Shared', '2027-04-05');
    const secondNew = await makeEvent({ accountId: account.id, name: 'Nusantara Culinary Festival Again', date: '2027-04-05' });
    const [second] = await db
      .insert(eventMatchCandidates)
      .values({ eventId: secondNew.event.id, candidateEventId: first.candidate.event.id, score: 0.6, postId: secondNew.post.id })
      .returning();
    suggestionIds.push(second.id);

    const decisions = [
      { suggestionId: first.suggestion.id, evidenceHash: await hashOf(first.suggestion.id) },
      { suggestionId: second.id, evidenceHash: await hashOf(second.id) },
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
        runDedupReviewApply(db, baseInput([{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id) }], { mode, live: mode === 'apply', invokerHash: sha256('nobody-' + suffix) })),
        DedupReviewInvokerError
      );
    }
    assert.strictEqual((await suggestionRow(p.suggestion.id)).status, 'pending');
  });

  await t.test('a moderator who resolves the suggestion while apply waits for its lock turns the decision into concurrent-change', async () => {
    const p = await makePair('Race', '2027-04-07');
    const decisions = [{ suggestionId: p.suggestion.id, evidenceHash: await hashOf(p.suggestion.id) }];
    const holder = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
    try {
      let applied: ReturnType<typeof runDedupReviewApply> | undefined;
      await holder.begin(async (tx) => {
        await tx`SELECT id FROM event_match_candidates WHERE id = ${p.suggestion.id} FOR UPDATE`;
        // Apply plans the pair as pending, then blocks on this row's lock.
        applied = runDedupReviewApply(db, baseInput(decisions, { live: true }));
        await new Promise((resolve) => setTimeout(resolve, 500));
        await tx`UPDATE event_match_candidates SET status = 'rejected', resolved_at = now() WHERE id = ${p.suggestion.id}`;
      });
      const report = await (applied as ReturnType<typeof runDedupReviewApply>);
      assert.deepStrictEqual(report.results, [{ suggestionId: p.suggestion.id, outcome: 'skipped', reason: 'concurrent-change' }]);
      assert.strictEqual((await suggestionRow(p.suggestion.id)).resolvedVia, null, 'the reviewer wrote nothing');
    } finally {
      await holder.end();
    }
  });
});
