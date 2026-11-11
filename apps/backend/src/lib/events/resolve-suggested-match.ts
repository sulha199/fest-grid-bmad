import { and, eq } from 'drizzle-orm';
import { eventMatchCandidates } from '@festgrid/database';
import { parseDedupDecisionClues, parseDedupDecisionNote, type DedupDecisionClue } from '@festgrid/domain/events';
import { assertResolutionSource, mergeEvents, type ResolutionSource } from './merge-events.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AD-30 Rule 9 -- the one place a pending `event_match_candidates` suggestion is accepted or
 * rejected. `Mutation.resolveSuggestedEventMatch` calls it (and so will any operator or automated
 * reviewer), so every path applies the same checks and writes the same rows.
 *
 * ACCEPT merges the suggestion's `eventId` (the newly ingested event, the loser) into its
 * `candidateEventId` (the existing event, the winner) through `mergeEvents()`, which also flips the
 * suggestion to `accepted` and journals the merge. REJECT records a dismissal and nothing else.
 *
 * The caller owns the transaction (as `drainMatchBacklog` does): this function never opens one, so
 * a caller can roll the whole thing back (a dry run) or wrap several decisions. The suggestion row
 * is locked (`FOR UPDATE`) before its status is read, so two moderators, or a moderator and a
 * script, cannot both act on one pending row: the second waits, then sees it is no longer pending.
 *
 * Why it was resolved (spec-dedup-decision-clues): optional `clues` (codes of the closed list in `packages/domain`)
 * and `note` (free text, at most 200 characters) are validated first, before any database access, and written
 * with the resolution: `resolution_clues` and `resolution_note`. The note is stored and never printed anywhere;
 * only the in-app resolution passes one (the apply bridge's input is public). An invalid value throws
 * `DedupDecisionClueError` (the resolver maps it to BAD_REQUEST) and writes nothing.
 *
 * Thrown errors are typed so each caller maps them to its own surface (the resolver maps them to
 * GraphQL codes). An `EventMergeInvalidStateError` from `mergeEvents()` passes through unchanged.
 */

export type SuggestedMatchAction = 'ACCEPT' | 'REJECT';

export interface ResolveSuggestedMatchInput {
  id: string;
  action: SuggestedMatchAction;
  /** `users.id` recorded as the resolver on the suggestion and on the `event_merges` journal row. */
  moderatorId: string;
  /**
   * Who decided: `moderator` (default) or `ai_skill`. Recorded as `resolved_via` on the suggestion and
   * `performed_via` on the journal row. Only server code passes it: the GraphQL resolver never does.
   */
  via?: ResolutionSource;
  /** Clue codes behind the decision; omitted, null or empty records none. Validated by `parseDedupDecisionClues`. */
  clues?: readonly string[] | null;
  /** The moderator's own words (in-app only); never printed. Validated by `parseDedupDecisionNote`. */
  note?: string | null;
}

export interface ResolveSuggestedMatchResult {
  /** The `event_merges` journal id for ACCEPT (for `undoEventMerge`); null for REJECT. */
  mergeId: string | null;
}

/** No suggestion has this id. */
export class SuggestedMatchNotFoundError extends Error {}

/** The suggestion is already accepted or rejected. */
export class SuggestedMatchNotPendingError extends Error {}

/** The action is neither ACCEPT nor REJECT. Checked after the pending check, as the resolver always did. */
export class SuggestedMatchInvalidActionError extends Error {}

export async function resolveSuggestedMatch(tx: DbExecutor, input: ResolveSuggestedMatchInput): Promise<ResolveSuggestedMatchResult> {
  const { id, action, moderatorId, via = 'moderator' } = input;
  assertResolutionSource(via);
  const clues: DedupDecisionClue[] | null = parseDedupDecisionClues(input.clues);
  const note = parseDedupDecisionNote(input.note);

  const [suggestion] = await tx.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, id)).for('update');
  if (!suggestion) {
    throw new SuggestedMatchNotFoundError('Suggested event match not found');
  }
  if (suggestion.status !== 'pending') {
    throw new SuggestedMatchNotPendingError('This suggestion has already been resolved');
  }

  if (action === 'ACCEPT') {
    const { merge } = await mergeEvents(tx, suggestion.candidateEventId, suggestion.eventId, moderatorId, suggestion.id, via);
    // `mergeEvents` flips the suggestion to accepted; the reason is written right after, in the same transaction.
    // Always written, null included: a row the owner reopened by SQL must not keep a stale reason into its new resolution.
    await tx.update(eventMatchCandidates).set({ resolutionClues: clues, resolutionNote: note }).where(and(eq(eventMatchCandidates.id, id), eq(eventMatchCandidates.status, 'accepted')));
    return { mergeId: merge.id };
  }

  if (action === 'REJECT') {
    await tx
      .update(eventMatchCandidates)
      .set({ status: 'rejected', resolvedAt: new Date(), resolvedByModeratorId: moderatorId, resolvedVia: via, resolutionClues: clues, resolutionNote: note })
      .where(and(eq(eventMatchCandidates.id, id), eq(eventMatchCandidates.status, 'pending')));
    return { mergeId: null };
  }

  throw new SuggestedMatchInvalidActionError('Invalid action');
}
