import { and, eq, inArray, sql } from 'drizzle-orm';
import { eventMatchCandidates } from '@festgrid/database';
import { getSuggestionExpiryReason, type SuggestionExpiryReason } from '@festgrid/domain/events';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * IDEA-107 -- closes the pending `event_match_candidates` rows nobody can act on any more, so the
 * moderator queue holds only pairs worth a decision. The drain and ingestion already skip such a
 * row as stale; this is what finally takes it out of the queue. The rule is the pure
 * `getSuggestionExpiryReason` in `packages/domain` (an event of the pair deleted or merged, or both
 * events over); this file only reads each pair's state and writes the status.
 *
 * `expired` is not `rejected`: it records no "not a duplicate" judgement, only that the pair is moot.
 * A moderator who resolves a row while this runs wins: the UPDATE only touches rows still pending.
 * Idempotent: a closed row is no longer pending.
 */
export interface ExpireSuggestionsOptions {
  /** `YYYY-MM-DD`, the run's UTC date; "over" means the last schedule day is strictly before it. */
  today: string;
  /** false = evaluate only: no UPDATE, so it also works on a SELECT-only role. */
  apply: boolean;
}

export interface ExpiredSuggestion {
  suggestionId: string;
  reason: SuggestionExpiryReason;
}

export interface ExpireSuggestionsReport {
  /** Pending rows read. */
  pending: number;
  /** Rows the rule would close (or closed, when `apply`), oldest first. */
  expired: ExpiredSuggestion[];
  byReason: Record<SuggestionExpiryReason, number>;
  /** Pending rows a moderator may still need. */
  kept: number;
  /** Rows actually updated; always 0 when `apply` is false. */
  closed: number;
}

interface PendingPairRow {
  id: string;
  a_deleted: boolean;
  a_merged: boolean;
  a_last_day: string | null;
  b_deleted: boolean;
  b_merged: boolean;
  b_last_day: string | null;
}

// Closed in slices so the parameter list of one UPDATE stays small however long the queue grew.
const UPDATE_SLICE = 500;

export async function expireStaleMatchSuggestions(executor: DbExecutor, options: ExpireSuggestionsOptions): Promise<ExpireSuggestionsReport> {
  // The two events and the last day each one covers, read in one pass. `to_char` keeps the date a
  // plain string, so the comparison in the domain function never meets a Date or a timezone.
  const rows = (await executor.execute(sql`
    SELECT c.id AS id,
      (ea.deleted_at IS NOT NULL) AS a_deleted,
      (ea.merged_into_event_id IS NOT NULL) AS a_merged,
      (SELECT to_char(max(coalesce(s.event_end_date, s.event_start_date)), 'YYYY-MM-DD') FROM schedules s WHERE s.event_id = ea.id) AS a_last_day,
      (eb.deleted_at IS NOT NULL) AS b_deleted,
      (eb.merged_into_event_id IS NOT NULL) AS b_merged,
      (SELECT to_char(max(coalesce(s.event_end_date, s.event_start_date)), 'YYYY-MM-DD') FROM schedules s WHERE s.event_id = eb.id) AS b_last_day
    FROM event_match_candidates c
    JOIN events ea ON ea.id = c.event_id
    JOIN events eb ON eb.id = c.candidate_event_id
    WHERE c.status = 'pending'
    ORDER BY c.created_at, c.id
  `)) as unknown as PendingPairRow[];

  const report: ExpireSuggestionsReport = {
    pending: rows.length,
    expired: [],
    byReason: { 'event-deleted': 0, 'event-merged': 0, 'both-over': 0 },
    kept: 0,
    closed: 0,
  };

  for (const row of rows) {
    const reason = getSuggestionExpiryReason(
      { deleted: row.a_deleted, merged: row.a_merged, lastScheduleDay: row.a_last_day },
      { deleted: row.b_deleted, merged: row.b_merged, lastScheduleDay: row.b_last_day },
      options.today
    );
    if (reason === null) {
      report.kept++;
      continue;
    }
    report.expired.push({ suggestionId: row.id, reason });
    report.byReason[reason]++;
  }

  if (!options.apply) return report;

  const ids = report.expired.map((e) => e.suggestionId);
  for (let i = 0; i < ids.length; i += UPDATE_SLICE) {
    const closed = await executor
      .update(eventMatchCandidates)
      .set({ status: 'expired', resolvedAt: new Date() })
      .where(and(inArray(eventMatchCandidates.id, ids.slice(i, i + UPDATE_SLICE)), eq(eventMatchCandidates.status, 'pending')))
      .returning({ id: eventMatchCandidates.id });
    report.closed += closed.length;
  }
  return report;
}
