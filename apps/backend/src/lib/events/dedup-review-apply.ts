import { count, eq, inArray, and, isNull, sql } from 'drizzle-orm';
import { eventMatchCandidates, eventMerges, events, users } from '@festgrid/database';
import {
  DEDUP_REVIEW_APPLY_SCHEMA_VERSION,
  DEDUP_REVIEW_PER_DAY_CAP,
  DEDUP_REVIEW_PER_RUN_CAP,
  countDedupReviewResults,
  judgeDedupReviewDecision,
  type DedupReviewApplyReport,
  type DedupReviewApplyResult,
  type DedupReviewCaps,
  type DedupReviewDecision,
  type DedupReviewFreshLookup,
  type DedupReviewRunState,
  type DedupReviewSkipReason,
} from '@festgrid/domain/events';
import type { db as appDb } from '../../db/client.js';
import { DedupReviewInvokerError } from './dedup-review-errors.js';
import { assertRoleBypassesRls, buildDedupReviewPair, runInReadOnlyTransaction, runInWriteTransaction } from './dedup-review-export.js';
import { evaluateBacklogRow } from './drain-match-backlog.js';
import { EventMergeInvalidStateError } from './merge-events.js';
import { resolveSuggestedMatch, SuggestedMatchNotFoundError, SuggestedMatchNotPendingError } from './resolve-suggested-match.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AI-assisted dedup review, apply side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B2b-1).
 *
 * Takes the reviewer's ACCEPT decisions and applies the ones that still hold. Every merge goes
 * through `resolveSuggestedMatch()` with `via: 'ai_skill'`, the function the moderator's own
 * accept uses, so the checks, the row lock and the journal are the same. This module takes an
 * executor and never imports the database client.
 *
 * Three modes, one decision order (the domain's `judgeDedupReviewDecision`):
 * - `validate`: one `REPEATABLE READ, READ ONLY` snapshot, no merge. `eligible` is a verdict before
 *   the merge step (a read-only transaction cannot take the row lock the merge needs).
 * - `apply` without `live`: the real merges, run inside the transaction and then rolled back, so
 *   nothing persists. The rollback is structural: it is the only way out unless `live` is set.
 * - `apply` with `live`: the merges commit.
 */

/** One constant key for the run-wide advisory lock, so two live runs cannot both count the day's total before either merges. */
export const DEDUP_REVIEW_APPLY_LOCK_KEY = 8_051_001;

const INVOKER_REFUSAL = 'No single active moderator matches the invoker. Check the account the skill runs under, and that it is a moderator of the app.';

/**
 * The moderator who invoked the run: exactly one non-deleted user whose email hashes to `invokerHash`
 * (SHA-256 of the address with spaces, tabs and line breaks trimmed and lower-cased), who is a moderator.
 * Non-ASCII letters are lower-cased by the database's locale and by JavaScript differently, so such an
 * address may never match: that fails closed, with the same refusal. Zero matches, two (emails differing
 * only in case can coexist, the unique index is case-sensitive) and a non-moderator all give the one
 * same refusal, so a public log cannot be used to probe who is a moderator. Neither the hash nor an
 * address is ever in the message.
 */
export async function resolveInvokerUserId(executor: DbExecutor, invokerHash: string): Promise<string> {
  const rows = await executor
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(isNull(users.deletedAt), sql`encode(sha256(convert_to(lower(btrim(${users.email}, chr(9) || chr(10) || chr(13) || ' ')), 'UTF8')), 'hex') = ${invokerHash}`));
  const [only] = rows;
  if (rows.length !== 1 || only.role !== 'moderator') {
    throw new DedupReviewInvokerError(INVOKER_REFUSAL);
  }
  return only.id;
}

/**
 * How many AI decisions the last 24 hours (the database's clock) already hold: merges the reviewer
 * made, undone ones included (the journal keeps the flag after an undo, so counting only live merges
 * would let a re-merge after an undo bypass the cap), plus the suggestions it rejected (a reject
 * writes no journal row, and an undo clears the suggestion's flag, so the two sets do not overlap).
 */
export async function countAiActionsLast24h(executor: DbExecutor): Promise<number> {
  const since = sql`now() - interval '24 hours'`;
  const [{ merges }] = await executor
    .select({ merges: count() })
    .from(eventMerges)
    .where(and(eq(eventMerges.performedVia, 'ai_skill'), sql`${eventMerges.createdAt} >= ${since}`));
  const [{ rejections }] = await executor
    .select({ rejections: count() })
    .from(eventMatchCandidates)
    .where(and(eq(eventMatchCandidates.status, 'rejected'), eq(eventMatchCandidates.resolvedVia, 'ai_skill'), sql`${eventMatchCandidates.resolvedAt} >= ${since}`));
  return Number(merges) + Number(rejections);
}

/** The pair behind one suggestion as the export would print it now, or why there is none. */
export async function lookupFreshPair(executor: DbExecutor, suggestionId: string): Promise<DedupReviewFreshLookup> {
  const [row] = await executor
    .select({
      id: eventMatchCandidates.id,
      eventId: eventMatchCandidates.eventId,
      candidateEventId: eventMatchCandidates.candidateEventId,
      postId: eventMatchCandidates.postId,
      score: eventMatchCandidates.score,
      status: eventMatchCandidates.status,
    })
    .from(eventMatchCandidates)
    .where(eq(eventMatchCandidates.id, suggestionId))
    .limit(1);
  if (!row) return { kind: 'unknown-suggestion' };
  if (row.status !== 'pending') return { kind: 'not-pending' };
  const evaluated = await evaluateBacklogRow(executor, row);
  if (evaluated.kind === 'stale') return { kind: 'stale-pair' };
  return { kind: 'pair', ...(await buildDedupReviewPair(executor, evaluated)) };
}

export interface DedupReviewApplyInput {
  decisions: DedupReviewDecision[];
  /** SHA-256 hex of the invoker's lowercased, trimmed account email. */
  invokerHash: string;
  runTag: string | null;
  mode: 'validate' | 'apply';
  live: boolean;
  /** Tests only: the caps default to the domain constants. */
  caps?: Partial<DedupReviewCaps>;
  now?: Date;
}

type WriteTx = Parameters<Parameters<typeof appDb.transaction>[0]>[0];

/** Thrown inside a decision's savepoint to undo it with a fixed reason. */
class DecisionAborted extends Error {
  constructor(readonly reason: DedupReviewSkipReason) {
    super(reason);
  }
}

/** Thrown at the end of a run that must not persist (a dry run); carries the report out of the transaction. */
class DryRunRollback extends Error {
  constructor(readonly results: DedupReviewApplyResult[]) {
    super('dry run rolled back');
  }
}

/**
 * Database errors that mean the whole run is broken, not this one decision: a write refused (25xxx, a
 * read-only credential), a privilege or function missing (42xxx), a connection or resource failure
 * (08, 53, 57), a deadlock, serialization failure or lock timeout (40, 55), an authentication failure (28).
 * They propagate, so the run fails loudly with a fixed hint and rolls back, instead of every decision
 * quietly turning into `merge-failed` in a report that looks like a normal run. Anything else (a unique
 * violation in the merge, say) is that decision's own failure.
 */
const RUN_FATAL_SQLSTATE_CLASSES = ['08', '25', '28', '40', '42', '53', '55', '57'];

export function isRunFatalDatabaseError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && RUN_FATAL_SQLSTATE_CLASSES.includes(code.slice(0, 2));
}

/**
 * One eligible decision, merged under locks. Inside a savepoint (so a failure undoes only this
 * decision): lock the suggestion row, then both events in id order; re-read the pair under those
 * locks and judge it again; only then merge. A pair that changed between the plan and the locks is
 * `concurrent-change`.
 *
 * What the locks cover, honestly: the suggestion row and the two event rows, which keeps another
 * writer from resolving or merging this pair while it is judged. The moderator's own accept locks only
 * the suggestion row, and `mergeEvents` itself reads schedules, posts, favorites and links with plain
 * statements, so a row another writer adds to those tables in the few milliseconds between the
 * re-read and the merge is not seen, exactly as it is not on the moderator's path. The locks of one
 * decision are held to the end of the run (a savepoint does not release them), so a moderator who
 * takes two of the same rows in the opposite order can deadlock with a run; Postgres ends one of them,
 * and `lock_timeout` bounds the wait.
 */
async function mergeUnderLocks(
  tx: WriteTx,
  decision: DedupReviewDecision,
  state: DedupReviewRunState,
  caps: DedupReviewCaps,
  moderatorId: string
): Promise<{ mergeId: string } | { reason: DedupReviewSkipReason }> {
  try {
    return await tx.transaction(async (sp) => {
      const [locked] = await sp
        .select({ eventId: eventMatchCandidates.eventId, candidateEventId: eventMatchCandidates.candidateEventId })
        .from(eventMatchCandidates)
        .where(eq(eventMatchCandidates.id, decision.suggestionId))
        .for('update');
      if (!locked) throw new DecisionAborted('concurrent-change');
      await sp
        .select({ id: events.id })
        .from(events)
        .where(inArray(events.id, [locked.eventId, locked.candidateEventId]))
        .orderBy(events.id)
        .for('update');

      const fresh = await lookupFreshPair(sp, decision.suggestionId);
      if (judgeDedupReviewDecision({ decision, fresh, state, caps }).outcome !== 'eligible') {
        throw new DecisionAborted('concurrent-change');
      }
      const { mergeId } = await resolveSuggestedMatch(sp, { id: decision.suggestionId, action: 'ACCEPT', moderatorId, via: 'ai_skill' });
      return { mergeId: mergeId as string };
    });
  } catch (err) {
    if (err instanceof DecisionAborted) return { reason: err.reason };
    if (isRunFatalDatabaseError(err)) throw err;
    if (err instanceof EventMergeInvalidStateError || err instanceof SuggestedMatchNotPendingError || err instanceof SuggestedMatchNotFoundError) {
      return { reason: 'concurrent-change' };
    }
    return { reason: 'merge-failed' };
  }
}

/**
 * Judges every decision in file order and, in `apply` mode, merges the eligible ones. Only an eligible
 * decision claims its events and uses up a cap; a skipped one does neither.
 */
async function processDecisions(
  executor: DbExecutor,
  input: DedupReviewApplyInput,
  caps: DedupReviewCaps,
  usedLast24h: number,
  merge: ((decision: DedupReviewDecision, state: DedupReviewRunState) => Promise<{ mergeId: string } | { reason: DedupReviewSkipReason }>) | null
): Promise<DedupReviewApplyResult[]> {
  const claimedEventIds = new Set<string>();
  let eligibleInRun = 0;
  const results: DedupReviewApplyResult[] = [];

  for (const decision of input.decisions) {
    const state: DedupReviewRunState = { claimedEventIds, eligibleInRun, usedLast24h };
    const fresh = await lookupFreshPair(executor, decision.suggestionId);
    const verdict = judgeDedupReviewDecision({ decision, fresh, state, caps });
    if (verdict.outcome === 'skipped') {
      results.push({ suggestionId: decision.suggestionId, outcome: 'skipped', reason: verdict.reason });
      continue;
    }
    // `fresh` is a pair here: the judge only returns eligible for one.
    const pair = fresh as Extract<DedupReviewFreshLookup, { kind: 'pair' }>;

    if (merge === null) {
      results.push({ suggestionId: decision.suggestionId, outcome: 'eligible' });
    } else {
      const merged = await merge(decision, state);
      if ('reason' in merged) {
        results.push({ suggestionId: decision.suggestionId, outcome: 'skipped', reason: merged.reason });
        continue;
      }
      results.push(input.live ? { suggestionId: decision.suggestionId, outcome: 'merged', mergeId: merged.mergeId } : { suggestionId: decision.suggestionId, outcome: 'eligible' });
    }
    claimedEventIds.add(pair.candidateEventId);
    claimedEventIds.add(pair.newEventId);
    eligibleInRun += 1;
  }
  return results;
}

/** Runs one invocation of the apply script against `database`; see the module comment for the modes. */
export async function runDedupReviewApply(database: Pick<typeof appDb, 'transaction'>, input: DedupReviewApplyInput): Promise<DedupReviewApplyReport> {
  const caps: DedupReviewCaps = { perRun: input.caps?.perRun ?? DEDUP_REVIEW_PER_RUN_CAP, perDay: input.caps?.perDay ?? DEDUP_REVIEW_PER_DAY_CAP };
  const generatedAt = (input.now ?? new Date()).toISOString();
  const mode = input.mode === 'validate' ? 'validate' : input.live ? 'live' : 'dry-run';

  let usedLast24h = 0;
  let results: DedupReviewApplyResult[];

  if (input.mode === 'validate') {
    results = await runInReadOnlyTransaction(database, async (tx) => {
      await assertRoleBypassesRls(tx);
      await resolveInvokerUserId(tx, input.invokerHash);
      usedLast24h = await countAiActionsLast24h(tx);
      return processDecisions(tx, input, caps, usedLast24h, null);
    });
  } else {
    try {
      results = await runInWriteTransaction(database, async (tx) => {
        await assertRoleBypassesRls(tx);
        // One live run at a time, taken before the day's count is read, so two overlapping runs cannot both see room.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${DEDUP_REVIEW_APPLY_LOCK_KEY})`);
        const moderatorId = await resolveInvokerUserId(tx, input.invokerHash);
        usedLast24h = await countAiActionsLast24h(tx);
        const done = await processDecisions(tx, input, caps, usedLast24h, (decision, state) => mergeUnderLocks(tx, decision, state, caps, moderatorId));
        // The only way out of a run that is not live is this throw, which rolls the whole transaction back.
        if (!input.live) throw new DryRunRollback(done);
        return done;
      });
    } catch (err) {
      if (!(err instanceof DryRunRollback)) throw err;
      results = err.results;
    }
  }

  return {
    schemaVersion: DEDUP_REVIEW_APPLY_SCHEMA_VERSION,
    generatedAt,
    runTag: input.runTag,
    mode,
    killSwitch: false,
    usedLast24h,
    caps,
    counts: countDedupReviewResults(results),
    results,
  };
}
