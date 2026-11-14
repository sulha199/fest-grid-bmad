import { count, eq, inArray, and, sql } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { eventMatchCandidates, eventMerges, events, users } from '@festgrid/database';
import {
  DEDUP_REVIEW_APPLY_SCHEMA_VERSION,
  DEDUP_REVIEW_CAP_DEFAULTS,
  assertDedupReviewCapsWithinCeilings,
  assertDedupReviewFloorOverrideAllowed,
  assertDedupReviewRejectsAllowed,
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
import {
  DedupReviewFloorOverrideDisabledError,
  DedupReviewInvokerError,
  DedupReviewRejectsDisabledError,
  FLOOR_OVERRIDE_DISABLED_MESSAGE,
  REJECTS_DISABLED_MESSAGE,
} from './dedup-review-errors.js';
import { assertRoleBypassesRls, buildDedupReviewPair, runInReadOnlyTransaction, runInWriteTransaction } from './dedup-review-export.js';
import { evaluateBacklogRow } from './drain-match-backlog.js';
import { EventMergeInvalidStateError } from './merge-events.js';
import { resolveSuggestedMatch, SuggestedMatchNotFoundError, SuggestedMatchNotPendingError } from './resolve-suggested-match.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AI-assisted dedup review, apply side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B2b-1).
 *
 * Takes the reviewer's decisions and applies the ones that still hold: an ACCEPT merges, an `accept-override`
 * merges with no floor (off unless `allowFloorOverride` and, in `apply`, `floorOverrideEnabled`, FIND-124), a
 * REJECT (off unless `allowRejects` and, in `apply`, `rejectsEnabled`, FIND-120) records a dismissal. All go through
 * `resolveSuggestedMatch()` with `via: 'ai_skill'`, the function the moderator's own accept and reject
 * use, so the checks, the row lock and the journal are the same. This module takes an executor and
 * never imports the database client.
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
    .where(and(activeOnly(users), sql`encode(sha256(convert_to(lower(btrim(${users.email}, chr(9) || chr(10) || chr(13) || ' ')), 'UTF8')), 'hex') = ${invokerHash}`));
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
 * writes no journal row, and an undo clears the suggestion's flag, so the two sets rarely overlap: a pair merged,
 * undone and then rejected has a journal row and a rejected row, and counts twice, which errs on the side of the cap).
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

/**
 * How many suggestions the reviewer rejected in the last 24 hours (the database's clock). A reject writes no
 * journal row, so this is the suggestion rows' own count; the owner reopening one takes it out of the count.
 */
export async function countAiRejectsLast24h(executor: DbExecutor): Promise<number> {
  const [{ rejections }] = await executor
    .select({ rejections: count() })
    .from(eventMatchCandidates)
    .where(and(eq(eventMatchCandidates.status, 'rejected'), eq(eventMatchCandidates.resolvedVia, 'ai_skill'), sql`${eventMatchCandidates.resolvedAt} >= now() - interval '24 hours'`));
  return Number(rejections);
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
  /** The run may hold reject decisions (`--allow-rejects`). Off by default. */
  allowRejects?: boolean;
  /** The owner's reject switch is on (`DEDUP_REVIEW_REJECT_ENABLED`). Off by default; `apply` needs it for a reject. */
  rejectsEnabled?: boolean;
  /** The run may hold `accept-override` decisions (`--allow-floor-override`). Off by default. */
  allowFloorOverride?: boolean;
  /** The owner's override switch is on (`DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED`). Off by default; `apply` needs it when the run allows overrides. */
  floorOverrideEnabled?: boolean;
  /** The caps for this run (the CLI resolves the owner's variables); any left out default to the domain constants. */
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

/** What deciding one eligible decision under locks gives: the merge id of an accept, null for a reject, or why it did not happen. */
type Decided = { mergeId: string | null } | { reason: DedupReviewSkipReason };

/**
 * One eligible decision, decided under locks, inside a savepoint (so a failure undoes only this decision).
 *
 * An accept or an `accept-override`: lock the suggestion row, then both events in id order; re-read the pair
 * under those locks and judge it again (an override without the floor); only then merge. A pair that changed between the plan and the locks is `concurrent-change`.
 *
 * A reject: lock the suggestion row only (a reject changes nothing else, and event locks would be held to the
 * end of the run for no gain), re-read the pair under that lock, judge it again, then record the dismissal.
 *
 * What the locks cover, honestly: the suggestion row and, for a merge, the two event rows, which keeps another
 * writer from resolving or merging this pair while it is judged. The moderator's own accept locks only
 * the suggestion row, and `mergeEvents` itself reads schedules, posts, favorites and links with plain
 * statements, so a row another writer adds to those tables in the few milliseconds between the
 * re-read and the merge is not seen, exactly as it is not on the moderator's path. The locks of one
 * decision are held to the end of the run (a savepoint does not release them), so a moderator who
 * takes two of the same rows in the opposite order can deadlock with a run; Postgres ends one of them,
 * and `lock_timeout` bounds the wait.
 */
async function decideUnderLocks(
  tx: WriteTx,
  decision: DedupReviewDecision,
  state: DedupReviewRunState,
  caps: DedupReviewCaps,
  moderatorId: string
): Promise<Decided> {
  try {
    return await tx.transaction(async (sp) => {
      const [locked] = await sp
        .select({ eventId: eventMatchCandidates.eventId, candidateEventId: eventMatchCandidates.candidateEventId })
        .from(eventMatchCandidates)
        .where(eq(eventMatchCandidates.id, decision.suggestionId))
        .for('update');
      if (!locked) throw new DecisionAborted('concurrent-change');
      // Every action but a reject merges, so it locks the events: a future action locks by default.
      if (decision.action !== 'reject') {
        await sp
          .select({ id: events.id })
          .from(events)
          .where(inArray(events.id, [locked.eventId, locked.candidateEventId]))
          .orderBy(events.id)
          .for('update');
      }

      const fresh = await lookupFreshPair(sp, decision.suggestionId);
      if (judgeDedupReviewDecision({ decision, fresh, state, caps }).outcome !== 'eligible') {
        throw new DecisionAborted('concurrent-change');
      }
      if (decision.action === 'reject') {
        const { mergeId } = await resolveSuggestedMatch(sp, { id: decision.suggestionId, action: 'REJECT', moderatorId, via: 'ai_skill', clues: decision.clues });
        return { mergeId };
      }
      const { mergeId } = await resolveSuggestedMatch(sp, { id: decision.suggestionId, action: 'ACCEPT', moderatorId, via: 'ai_skill', clues: decision.clues });
      return { mergeId };
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
 * Judges every decision in file order and, in `apply` mode, decides the eligible ones. Only an eligible
 * decision uses up a cap, and only an eligible accept claims its events; a skipped one does neither.
 */
async function processDecisions(
  executor: DbExecutor,
  input: DedupReviewApplyInput,
  caps: DedupReviewCaps,
  used: { last24h: number; rejectsLast24h: number },
  decide: ((decision: DedupReviewDecision, state: DedupReviewRunState) => Promise<Decided>) | null
): Promise<DedupReviewApplyResult[]> {
  const claimedEventIds = new Set<string>();
  let eligibleInRun = 0;
  let overridesInRun = 0;
  let rejectsInRun = 0;
  const results: DedupReviewApplyResult[] = [];

  for (const decision of input.decisions) {
    const { suggestionId, action } = decision;
    const state: DedupReviewRunState = { claimedEventIds, eligibleInRun, overridesInRun, rejectsInRun, usedLast24h: used.last24h, usedRejectsLast24h: used.rejectsLast24h };
    const fresh = await lookupFreshPair(executor, suggestionId);
    const verdict = judgeDedupReviewDecision({ decision, fresh, state, caps });
    if (verdict.outcome === 'skipped') {
      results.push({ suggestionId, action, outcome: 'skipped', reason: verdict.reason });
      continue;
    }
    // `fresh` is a pair here: the judge only returns eligible for one.
    const pair = fresh as Extract<DedupReviewFreshLookup, { kind: 'pair' }>;

    if (decide === null) {
      results.push({ suggestionId, action, outcome: 'eligible' });
    } else {
      const decided = await decide(decision, state);
      if ('reason' in decided) {
        results.push({ suggestionId, action, outcome: 'skipped', reason: decided.reason });
        continue;
      }
      if (!input.live) results.push({ suggestionId, action, outcome: 'eligible' });
      else if (action === 'reject') results.push({ suggestionId, action, outcome: 'rejected' });
      else results.push({ suggestionId, action, outcome: 'merged', mergeId: decided.mergeId as string });
    }
    if (action === 'reject') {
      rejectsInRun += 1;
    } else {
      claimedEventIds.add(pair.candidateEventId);
      claimedEventIds.add(pair.newEventId);
      eligibleInRun += 1;
      if (action === 'accept-override') overridesInRun += 1;
    }
  }
  return results;
}

/** Runs one invocation of the apply script against `database`; see the module comment for the modes. */
export async function runDedupReviewApply(database: Pick<typeof appDb, 'transaction'>, input: DedupReviewApplyInput): Promise<DedupReviewApplyReport> {
  assertDedupReviewRejectsAllowed(input.decisions, input.allowRejects ?? false);
  assertDedupReviewFloorOverrideAllowed(input.decisions, input.allowFloorOverride ?? false);
  // The owner's switch is checked before anything is read: an `apply` run (dry or live) that allows rejects needs it,
  // whether or not a decision holds one (the workflow's own step reads it the same way).
  // Any mode but `validate` is a write run, so a mode outside the type (a cast caller) cannot skip the switches.
  if (input.mode !== 'validate' && input.allowRejects && !input.rejectsEnabled) {
    throw new DedupReviewRejectsDisabledError(REJECTS_DISABLED_MESSAGE);
  }
  // The same for the override switch, and after the reject one so the order of refusals is flag, variable (rejects, then override).
  if (input.mode !== 'validate' && input.allowFloorOverride && !input.floorOverrideEnabled) {
    throw new DedupReviewFloorOverrideDisabledError(FLOOR_OVERRIDE_DISABLED_MESSAGE);
  }
  const caps: DedupReviewCaps = { ...DEDUP_REVIEW_CAP_DEFAULTS, ...input.caps };
  // The ceilings are the code's, whoever built the caps (the CLI resolves the owner's variables, a test injects its own).
  assertDedupReviewCapsWithinCeilings(caps);
  const generatedAt = (input.now ?? new Date()).toISOString();
  const mode = input.mode === 'validate' ? 'validate' : input.live ? 'live' : 'dry-run';

  let usedLast24h = 0;
  let usedRejectsLast24h = 0;
  let results: DedupReviewApplyResult[];

  if (input.mode === 'validate') {
    results = await runInReadOnlyTransaction(database, async (tx) => {
      await assertRoleBypassesRls(tx);
      await resolveInvokerUserId(tx, input.invokerHash);
      usedLast24h = await countAiActionsLast24h(tx);
      usedRejectsLast24h = await countAiRejectsLast24h(tx);
      return processDecisions(tx, input, caps, { last24h: usedLast24h, rejectsLast24h: usedRejectsLast24h }, null);
    });
  } else {
    try {
      results = await runInWriteTransaction(database, async (tx) => {
        await assertRoleBypassesRls(tx);
        // One live run at a time, taken before the day's count is read, so two overlapping runs cannot both see room.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${DEDUP_REVIEW_APPLY_LOCK_KEY})`);
        const moderatorId = await resolveInvokerUserId(tx, input.invokerHash);
        usedLast24h = await countAiActionsLast24h(tx);
        usedRejectsLast24h = await countAiRejectsLast24h(tx);
        const done = await processDecisions(tx, input, caps, { last24h: usedLast24h, rejectsLast24h: usedRejectsLast24h }, (decision, state) =>
          decideUnderLocks(tx, decision, state, caps, moderatorId)
        );
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
