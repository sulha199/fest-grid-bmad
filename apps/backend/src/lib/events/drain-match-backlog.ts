import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { events, eventMatchCandidates, posts, schedules } from '@festgrid/database';
import { decideMatchTier, hasSharedEventLink, minScheduleDayDifference, type MatchDecision } from '@festgrid/domain/events';
import { DATE_WINDOW_DAYS, resolveOrganizerMatch } from './match-event-to-existing.js';
import { EventMergeInvalidStateError, mergeEvents } from './merge-events.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AD-30 Rule 7 (amended 2026-10-25) -- drains the `event_match_candidates` backlog that built up
 * before the mid-to-high promotion rule existed. Every pending suggestion is re-evaluated with the
 * exact decision ingestion uses today (`decideMatchTier`, fed by the stored events), and the pairs
 * ingestion would now auto-link are accepted through `mergeEvents()` -- the same call the
 * moderator's accept button makes (existing event wins, the suggested event is the loser), so every
 * merge is journaled in `event_merges` and reversible with `undoEventMerge`.
 *
 * Runs on stored data, so it is idempotent: an accepted row is no longer pending, and a pair whose
 * events were merged or deleted since is skipped as stale.
 */

export interface BacklogEventSummary {
  id: string;
  slug: string;
  eventName: string;
}

export interface BacklogEvaluation {
  suggestionId: string;
  storedScore: number;
  newEvent: BacklogEventSummary;
  candidate: BacklogEventSummary;
  decision: MatchDecision;
  nameSimilarity: number;
  /** `Infinity` when there is no usable date pair. */
  minDayDiff: number;
  organizerMatch: boolean;
  sharedLink: boolean;
}

export type BacklogRowResult = { kind: 'stale'; suggestionId: string; reason: string } | ({ kind: 'evaluated' } & BacklogEvaluation);

type PendingRow = Pick<typeof eventMatchCandidates.$inferSelect, 'id' | 'eventId' | 'candidateEventId' | 'postId' | 'score'>;

/** Re-scores one pending suggestion from the stored events. Performs no writes. */
export async function evaluateBacklogRow(executor: DbExecutor, row: PendingRow): Promise<BacklogRowResult> {
  const [newEvent] = await executor.select().from(events).where(eq(events.id, row.eventId)).limit(1);
  const [candidate] = await executor.select().from(events).where(eq(events.id, row.candidateEventId)).limit(1);

  if (!newEvent || !candidate) {
    return { kind: 'stale', suggestionId: row.id, reason: 'an event no longer exists' };
  }
  for (const [label, event] of [['suggested event', newEvent], ['existing event', candidate]] as const) {
    if (event.deletedAt !== null || event.mergedIntoEventId !== null) {
      return { kind: 'stale', suggestionId: row.id, reason: `the ${label} is already deleted or merged` };
    }
  }

  const newSchedules = await executor.select().from(schedules).where(eq(schedules.eventId, newEvent.id)).orderBy(asc(schedules.eventStartDate));
  const candidateSchedules = await executor.select().from(schedules).where(eq(schedules.eventId, candidate.id)).orderBy(asc(schedules.eventStartDate));

  // The same pg_trgm similarity() findMatchingEvent reads, so the name signal is identical.
  const [similarityRow] = (await executor.execute(
    sql`SELECT similarity(${newEvent.eventName}, ${candidate.eventName}) AS name_similarity`
  )) as unknown as Array<{ name_similarity: number | string }>;

  // Ingestion counts the posting account as the organizer unless the new item was a roundup or
  // curator post (a stub event). The tagged-handle leg is not stored, so a pair that only matched
  // through it is evaluated without it: the drain can miss a pair, never over-reach.
  let organizerMatch = false;
  if (newEvent.detailLevel !== 'stub') {
    const [sourcePost] = await executor.select({ accountId: posts.accountId }).from(posts).where(eq(posts.id, row.postId)).limit(1);
    if (sourcePost) {
      organizerMatch = await resolveOrganizerMatch(executor, candidate.id, sourcePost.accountId, null);
    }
  }

  const sharedLink = hasSharedEventLink(newEvent.links, candidate.links);
  const minDayDiff = minScheduleDayDifference(newSchedules, candidateSchedules);
  const similarity = Number(similarityRow.name_similarity);

  const decision = decideMatchTier({
    organizerMatch,
    sharedLink,
    nameSimilarity: similarity,
    minDayDiff,
    newEventName: newEvent.eventName,
    candidateEventName: candidate.eventName,
    newVenues: newSchedules,
    candidateVenues: candidateSchedules,
    windowDays: DATE_WINDOW_DAYS,
  });

  return {
    kind: 'evaluated',
    suggestionId: row.id,
    storedScore: row.score,
    newEvent: { id: newEvent.id, slug: newEvent.slug, eventName: newEvent.eventName },
    candidate: { id: candidate.id, slug: candidate.slug, eventName: candidate.eventName },
    decision,
    nameSimilarity: similarity,
    minDayDiff,
    organizerMatch,
    sharedLink,
  };
}

export interface DrainOptions {
  /** `users.id` recorded on every `event_merges` journal row. Required even when not merging. */
  moderatorId: string;
  /** false = evaluate only: no `mergeEvents()` call, so it also runs on a read-only role. */
  merge: boolean;
  /** Suggestion ids a reviewer wants left in the queue. */
  excludeSuggestionIds?: string[];
  /** Restricts the run to these suggestions (tests; the CLI always drains everything pending). */
  onlySuggestionIds?: string[];
}

export interface DrainReport {
  pending: number;
  stale: Array<{ suggestionId: string; reason: string }>;
  /** Suggestion ids left for a moderator because the reviewer excluded them. */
  excluded: string[];
  /** Pairs ingestion would auto-link now (tier `high`), oldest first. */
  qualifying: BacklogEvaluation[];
  /** Pairs that stay in the moderator queue. */
  remaining: number;
  /** Suggestions accepted through `mergeEvents()`; always 0 when `merge` is false. */
  merged: number;
  /** `event_merges` journal ids of the merges above, for `undoEventMerge`. */
  mergeIds: string[];
}

/**
 * Evaluates every pending suggestion (oldest first) and, when `merge` is true, accepts the
 * qualifying ones. Each row is evaluated right before it is merged, so a chain (B into A, then C
 * against B) sees the state the earlier merge left. The caller owns the transaction.
 */
export async function drainMatchBacklog(executor: DbExecutor, options: DrainOptions): Promise<DrainReport> {
  const excluded = new Set(options.excludeSuggestionIds ?? []);
  const pendingRows = await executor
    .select({
      id: eventMatchCandidates.id,
      eventId: eventMatchCandidates.eventId,
      candidateEventId: eventMatchCandidates.candidateEventId,
      postId: eventMatchCandidates.postId,
      score: eventMatchCandidates.score,
    })
    .from(eventMatchCandidates)
    .where(
      and(
        eq(eventMatchCandidates.status, 'pending'),
        options.onlySuggestionIds ? inArray(eventMatchCandidates.id, options.onlySuggestionIds) : undefined
      )
    )
    .orderBy(asc(eventMatchCandidates.createdAt), asc(eventMatchCandidates.id));

  const report: DrainReport = { pending: pendingRows.length, stale: [], excluded: [], qualifying: [], remaining: 0, merged: 0, mergeIds: [] };

  for (const row of pendingRows) {
    const result = await evaluateBacklogRow(executor, row);
    if (result.kind === 'stale') {
      report.stale.push({ suggestionId: result.suggestionId, reason: result.reason });
      continue;
    }
    if (result.decision.tier !== 'high') {
      report.remaining++;
      continue;
    }
    if (excluded.has(row.id)) {
      report.excluded.push(row.id);
      report.remaining++;
      continue;
    }

    report.qualifying.push(result);
    if (!options.merge) continue;

    try {
      const { merge } = await mergeEvents(executor, result.candidate.id, result.newEvent.id, options.moderatorId, row.id);
      report.merged++;
      report.mergeIds.push(merge.id);
    } catch (err) {
      // assertMergeable runs before any write, so this leaves the transaction untouched.
      if (!(err instanceof EventMergeInvalidStateError)) throw err;
      report.qualifying.pop();
      report.stale.push({ suggestionId: row.id, reason: err.message });
    }
  }

  return report;
}

export function formatBacklogEvaluation(e: BacklogEvaluation): string {
  const d = e.decision;
  const days = Number.isFinite(e.minDayDiff) ? `${e.minDayDiff}d` : 'n/a';
  const how = d.promotedByRule ? 'promoted' : 'scored-high';
  return [
    `${e.suggestionId} [${how}] score ${d.score.toFixed(2)} (stored ${e.storedScore.toFixed(2)}) name ${e.nameSimilarity.toFixed(2)} days ${days}`,
    `organizer=${e.organizerMatch} link=${e.sharedLink} venue=${d.venueMatch}`,
    `"${e.newEvent.eventName}" (${e.newEvent.slug}) -> "${e.candidate.eventName}" (${e.candidate.slug})`,
  ].join(' | ');
}
