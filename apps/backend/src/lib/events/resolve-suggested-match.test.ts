import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray, TransactionRollbackError } from 'drizzle-orm';
import postgres from 'postgres';
import { db, setSqlCaptureSink } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { users, events, eventMatchCandidates, eventMerges, posts, socialMediaAccountProfiles } from '@festgrid/database';
import { EventMergeInvalidStateError } from './merge-events.js';
import {
  resolveSuggestedMatch,
  SuggestedMatchInvalidActionError,
  SuggestedMatchNotFoundError,
  SuggestedMatchNotPendingError,
  type SuggestedMatchAction,
} from './resolve-suggested-match.js';

test('resolveSuggestedMatch (AD-30 Rule 9)', async (t) => {
  const suffix = Date.now() + '-rsm';
  const createdEventIds: string[] = [];

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-rsm-' + suffix, platform: 'instagram', displayName: 'RSM Account', username: 'rsm_' + suffix })
    .returning();
  const [post] = await db
    .insert(posts)
    .values({ accountId: profile.id, platform: 'instagram', postUrl: 'https://instagram.com/p/rsm-' + suffix, publishedAt: new Date('2026-01-01T00:00:00Z') })
    .returning();
  const [moderator] = await db.insert(users).values({ email: `rsm-mod-${suffix}@test.com`, name: 'RSM Moderator', role: 'moderator' }).returning();

  t.after(async () => {
    setSqlCaptureSink(null);
    await db.delete(eventMerges).where(inArray(eventMerges.winnerEventId, createdEventIds));
    await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, createdEventIds));
    await db.delete(events).where(inArray(events.id, createdEventIds));
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    await db.delete(users).where(eq(users.id, moderator.id));
  });

  async function makeEvent(name: string) {
    const [row] = await db.insert(events).values({ eventName: name, location: 'Nowhere' }).returning();
    createdEventIds.push(row.id);
    return row;
  }

  async function makePair(label: string) {
    const candidate = await makeEvent(`${label} Candidate ${suffix}`);
    const newEvent = await makeEvent(`${label} New ${suffix}`);
    const [suggestion] = await db.insert(eventMatchCandidates).values({ eventId: newEvent.id, candidateEventId: candidate.id, score: 0.6, postId: post.id }).returning();
    return { candidate, newEvent, suggestion };
  }

  const resolve = (id: string, action: SuggestedMatchAction) =>
    db.transaction((tx) => resolveSuggestedMatch(tx, { id, action, moderatorId: moderator.id }));

  const statusOf = async (id: string) => (await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, id)))[0];

  await t.test('ACCEPT merges the new event into the candidate, journals it and flips the suggestion', async () => {
    const { candidate, newEvent, suggestion } = await makePair('Accept');

    const { mergeId } = await resolve(suggestion.id, 'ACCEPT');

    assert.ok(mergeId);
    const [journal] = await db.select().from(eventMerges).where(eq(eventMerges.id, mergeId));
    assert.strictEqual(journal.winnerEventId, candidate.id);
    assert.strictEqual(journal.loserEventId, newEvent.id);
    assert.strictEqual(journal.suggestionId, suggestion.id);
    assert.strictEqual(journal.performedByModeratorId, moderator.id);
    const row = await statusOf(suggestion.id);
    assert.strictEqual(row.status, 'accepted');
    assert.strictEqual(row.resolvedByModeratorId, moderator.id);
    const [loser] = await db.select().from(events).where(eq(events.id, newEvent.id));
    assert.strictEqual(loser.mergedIntoEventId, candidate.id);
  });

  await t.test('REJECT records the dismissal, returns a null mergeId and merges nothing', async () => {
    const { newEvent, suggestion } = await makePair('Reject');

    const { mergeId } = await resolve(suggestion.id, 'REJECT');

    assert.strictEqual(mergeId, null);
    const row = await statusOf(suggestion.id);
    assert.strictEqual(row.status, 'rejected');
    assert.strictEqual(row.resolvedByModeratorId, moderator.id);
    assert.ok(row.resolvedAt instanceof Date);
    const [loser] = await db.select().from(events).where(eq(events.id, newEvent.id));
    assert.strictEqual(loser.deletedAt, null);
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, suggestion.id))).length, 0);
  });

  await t.test('an unknown id throws SuggestedMatchNotFoundError', async () => {
    await assert.rejects(resolve('00000000-0000-4000-8000-000000000000', 'ACCEPT'), SuggestedMatchNotFoundError);
  });

  await t.test('an already-resolved suggestion throws SuggestedMatchNotPendingError for either action and changes nothing', async () => {
    const { suggestion } = await makePair('Resolved');
    await resolve(suggestion.id, 'REJECT');
    const before = await statusOf(suggestion.id);

    await assert.rejects(resolve(suggestion.id, 'ACCEPT'), SuggestedMatchNotPendingError);
    await assert.rejects(resolve(suggestion.id, 'REJECT'), SuggestedMatchNotPendingError);

    const after = await statusOf(suggestion.id);
    assert.strictEqual(after.status, 'rejected');
    assert.strictEqual(after.resolvedAt?.getTime(), before.resolvedAt?.getTime());
  });

  await t.test('an expired suggestion (IDEA-107) is not pending: either action throws SuggestedMatchNotPendingError', async () => {
    const { suggestion } = await makePair('Expired');
    await db.update(eventMatchCandidates).set({ status: 'expired', resolvedAt: new Date() }).where(eq(eventMatchCandidates.id, suggestion.id));

    await assert.rejects(resolve(suggestion.id, 'ACCEPT'), SuggestedMatchNotPendingError);
    await assert.rejects(resolve(suggestion.id, 'REJECT'), SuggestedMatchNotPendingError);

    assert.strictEqual((await statusOf(suggestion.id)).status, 'expired');
  });

  await t.test('an invalid action throws SuggestedMatchInvalidActionError, but only after the pending check', async () => {
    const { suggestion } = await makePair('BadAction');
    const badAction = 'DISMISS' as SuggestedMatchAction;

    await assert.rejects(resolve(suggestion.id, badAction), SuggestedMatchInvalidActionError);
    assert.strictEqual((await statusOf(suggestion.id)).status, 'pending');

    await resolve(suggestion.id, 'REJECT');
    await assert.rejects(resolve(suggestion.id, badAction), SuggestedMatchNotPendingError);
  });

  await t.test('a pair that can no longer merge passes EventMergeInvalidStateError through and leaves the suggestion pending', async () => {
    const winnerOfFirst = await makeEvent('Stale Winner ' + suffix);
    const mergedAway = await makeEvent('Stale Merged Away ' + suffix);
    const later = await makeEvent('Stale Later ' + suffix);
    const [first] = await db.insert(eventMatchCandidates).values({ eventId: mergedAway.id, candidateEventId: winnerOfFirst.id, score: 0.6, postId: post.id }).returning();
    const [stale] = await db.insert(eventMatchCandidates).values({ eventId: later.id, candidateEventId: mergedAway.id, score: 0.6, postId: post.id }).returning();
    await resolve(first.id, 'ACCEPT');

    await assert.rejects(resolve(stale.id, 'ACCEPT'), EventMergeInvalidStateError);

    assert.strictEqual((await statusOf(stale.id)).status, 'pending');
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, stale.id))).length, 0);
  });

  await t.test('the suggestion row is read with FOR UPDATE, as the first statement that touches it (SQL shape)', async () => {
    const { suggestion } = await makePair('Lock');
    const statements: string[] = [];
    setSqlCaptureSink((query) => statements.push(query));
    try {
      await resolve(suggestion.id, 'REJECT');
    } finally {
      setSqlCaptureSink(null);
    }

    const lockingSelects = statements.filter((q) => /from "event_match_candidates"/i.test(q) && /for update/i.test(q));
    assert.strictEqual(lockingSelects.length, 1, 'exactly one locking select of the suggestion row');
    const firstSuggestionStatement = statements.findIndex((q) => /event_match_candidates/i.test(q));
    assert.ok(/for update/i.test(statements[firstSuggestionStatement]), 'the lock is the first statement that touches the suggestion');
  });

  // The shared `db` client has one connection, so the race needs a second, separate one: it holds the
  // suggestion row locked while `resolveSuggestedMatch` (on `db`) tries to accept it.
  for (const action of ['ACCEPT', 'REJECT'] as const) {
    await t.test(`a concurrent ${action} waits for the row lock, then sees the row is no longer pending (two connections)`, async () => {
      const { candidate, newEvent, suggestion } = await makePair('Race-' + action);
      const databaseUrl = loadBackendEnv().databaseUrl;
      assert.ok(databaseUrl, 'DATABASE_URL must be set for the race test');
      const holder = postgres(databaseUrl, { max: 1, prepare: false });
      let racing: Promise<unknown> = Promise.resolve();
      try {
        await holder.begin(async (sql) => {
          await sql`select id from event_match_candidates where id = ${suggestion.id} for update`;
          racing = resolve(suggestion.id, action).then(
            () => 'resolved' as const,
            (err: unknown) => err
          );
          const early = await Promise.race([racing, new Promise((done) => setTimeout(() => done('still waiting'), 400))]);
          assert.strictEqual(early, 'still waiting', 'the resolve must block while another transaction holds the row');
          await sql`update event_match_candidates set status = 'rejected', resolved_at = now(), resolved_by_moderator_id = ${moderator.id} where id = ${suggestion.id}`;
        });
        const outcome = await racing;
        assert.ok(outcome instanceof SuggestedMatchNotPendingError, `expected SuggestedMatchNotPendingError, got ${String(outcome)}`);
      } finally {
        await holder.end();
      }

      const row = await statusOf(suggestion.id);
      assert.strictEqual(row.status, 'rejected', "the other transaction's rejection must stand");
      const [loser] = await db.select().from(events).where(eq(events.id, newEvent.id));
      assert.strictEqual(loser.deletedAt, null, 'nothing was merged');
      const [winner] = await db.select().from(events).where(eq(events.id, candidate.id));
      assert.strictEqual(winner.deletedAt, null);
      assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, suggestion.id))).length, 0);
    });
  }

  await t.test('the caller owns the transaction: rolling it back undoes an ACCEPT completely (dry run)', async () => {
    const { candidate, newEvent, suggestion } = await makePair('DryRun');

    await assert.rejects(
      db.transaction(async (tx) => {
        const { mergeId } = await resolveSuggestedMatch(tx, { id: suggestion.id, action: 'ACCEPT', moderatorId: moderator.id });
        assert.ok(mergeId);
        await tx.rollback();
      }),
      TransactionRollbackError
    );

    assert.strictEqual((await statusOf(suggestion.id)).status, 'pending');
    const [loser] = await db.select().from(events).where(eq(events.id, newEvent.id));
    assert.strictEqual(loser.deletedAt, null);
    assert.strictEqual(loser.mergedIntoEventId, null);
    const [winner] = await db.select().from(events).where(eq(events.id, candidate.id));
    assert.strictEqual(winner.deletedAt, null);
    assert.strictEqual((await db.select().from(eventMerges).where(eq(eventMerges.suggestionId, suggestion.id))).length, 0);
  });
});
