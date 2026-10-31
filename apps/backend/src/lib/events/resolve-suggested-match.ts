import { and, eq } from 'drizzle-orm';
import { eventMatchCandidates } from '@festgrid/database';
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

  const [suggestion] = await tx.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, id)).for('update');
  if (!suggestion) {
    throw new SuggestedMatchNotFoundError('Suggested event match not found');
  }
  if (suggestion.status !== 'pending') {
    throw new SuggestedMatchNotPendingError('This suggestion has already been resolved');
  }

  if (action === 'ACCEPT') {
    const { merge } = await mergeEvents(tx, suggestion.candidateEventId, suggestion.eventId, moderatorId, suggestion.id, via);
    return { mergeId: merge.id };
  }

  if (action === 'REJECT') {
    await tx
      .update(eventMatchCandidates)
      .set({ status: 'rejected', resolvedAt: new Date(), resolvedByModeratorId: moderatorId, resolvedVia: via })
      .where(and(eq(eventMatchCandidates.id, id), eq(eventMatchCandidates.status, 'pending')));
    return { mergeId: null };
  }

  throw new SuggestedMatchInvalidActionError('Invalid action');
}
