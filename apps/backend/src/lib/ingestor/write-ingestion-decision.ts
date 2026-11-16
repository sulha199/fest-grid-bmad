import { eq, sql } from 'drizzle-orm';
import { schedules, eventMatchCandidates, events } from '@festgrid/database';
import type { ExtractedEventMessage } from '@festgrid/domain';
import { insertEventWithPrimaryPost, enrichAndPromoteEvent, type DbExecutor } from '../events/set-event-primary-post.js';
import type { IngestionMatchEvaluation } from './evaluate-ingestion-match.js';
import { buildDedupDecisionLog, type DedupDecisionLog } from './build-dedup-decision-log.js';
import { logIngestScheduleCounts } from '../events/schedule-count-log.js';

type EventRow = typeof events.$inferSelect;

export interface WriteIngestionDecisionResult {
  /** `false` when the `(post, ordinal)` slot already held an event (an idempotent skip). */
  inserted: boolean;
  /** The event that was created, or the existing one a `high` match enriched. */
  event: EventRow | null;
  /** Whether a new-event notification is owed (never for a stub). */
  shouldNotify: boolean;
  /** Logged by the caller only after its transaction commits. */
  dedupDecisionLog: DedupDecisionLog | null;
}

/**
 * Diagnostic only (see schedule-count-log.ts): the number of schedules an event has right now, or null if
 * it could not be read. Runs inside a SAVEPOINT because a failed statement aborts the whole Postgres
 * transaction, and a diagnostic must never be able to roll back the enrichment it is describing.
 */
async function countEventSchedulesSafely(tx: DbExecutor, eventId: string): Promise<number | null> {
  try {
    await tx.execute(sql`SAVEPOINT schedule_count_log`);
    try {
      const [row] = await tx
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(schedules)
        .where(eq(schedules.eventId, eventId));
      await tx.execute(sql`RELEASE SAVEPOINT schedule_count_log`);
      return row?.total ?? null;
    } catch {
      await tx.execute(sql`ROLLBACK TO SAVEPOINT schedule_count_log`);
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * The write half of ingestion: given the decision `evaluateIngestionMatch` made for one extracted
 * item, enrich the matched event (`high`), or insert a new event with its schedules and, for a `mid`
 * match, queue the suggestion for a moderator. Moved out of `processIngestionJob` unchanged so the
 * moderator re-extract Apply (AD-40) writes through exactly the same branches instead of copying them.
 * Runs inside the caller's transaction and performs no notification itself.
 */
export async function writeIngestionDecision(
  tx: DbExecutor,
  message: ExtractedEventMessage,
  extractionOrdinal: number,
  evaluation: IngestionMatchEvaluation
): Promise<WriteIngestionDecisionResult> {
  const { event, scheduleValues, isStub, match } = evaluation;

  if (match && match.tier === 'high') {
    // Story 3.6v (AC1, AC2, AC4, AC5, AC7) — enrich the matched event in place and promote the
    // new post to primary if it wins AD-30 Rule 7's ordering; no new `events` row.
    const { event: enrichedEvent, becameOrganizerAuthored } = await enrichAndPromoteEvent(
      tx,
      match.candidate,
      event,
      scheduleValues,
      message.postId,
      extractionOrdinal,
      // A stub repeat (AD-30 Rule 7, 2026-10-25) only adds to the existing event: a thin curator
      // repost must not overwrite its fields or delete its schedules.
      { additive: match.signals.stubRepeat }
    );

    // Diagnostic only: the message's schedules vs the enriched event's schedules afterwards (a merge, so
    // they may legitimately differ). The count runs inside a savepoint so a failed count can never abort
    // the caller's transaction.
    const finalCount = await countEventSchedulesSafely(tx, enrichedEvent.id);
    if (finalCount !== null) {
      logIngestScheduleCounts({
        path: 'enrich',
        postId: message.postId,
        ordinal: extractionOrdinal,
        received: message.schedules?.length ?? 0,
        incoming: scheduleValues.length,
        final: finalCount,
      });
    }

    return {
      inserted: true,
      event: enrichedEvent,
      shouldNotify: becameOrganizerAuthored,
      dedupDecisionLog: buildDedupDecisionLog(match, null, message.postId),
    };
  }

  // Story 3.6r / AD-30 Rule 2 — the only two call sites allowed to write `events.postId` are
  // insertEventWithPrimaryPost and setEventPrimaryPost (set-event-primary-post.ts), enforced by
  // events-postid-write-ratchet.test.ts. The conflict target is now the composite
  // (postId, extractionOrdinal) unique rather than postId alone (AD-30 Rule 1/3); extractionOrdinal
  // defaults to 0 at the helper's DB-write boundary when the message carries none (AC2).
  const insertedRow = await insertEventWithPrimaryPost(tx, event);

  if (!insertedRow) {
    console.log(`Skipped duplicate ingestion for postId: ${message.postId}, extractionOrdinal: ${extractionOrdinal}`);
    return { inserted: false, event: null, shouldNotify: false, dedupDecisionLog: null };
  }

  if (scheduleValues.length > 0) {
    const schedulesToInsert = scheduleValues.map((s) => ({
      ...s,
      eventId: insertedRow.id,
    }));

    // .returning only to count the rows actually written (diagnostic: see schedule-count-log.ts).
    const insertedRows = await tx.insert(schedules).values(schedulesToInsert).returning({ id: schedules.id });
    logIngestScheduleCounts({
      path: 'insert',
      postId: message.postId,
      ordinal: extractionOrdinal,
      received: message.schedules?.length ?? 0,
      sent: schedulesToInsert.length,
      inserted: insertedRows.length,
    });
  } else {
    logIngestScheduleCounts({
      path: 'insert',
      postId: message.postId,
      ordinal: extractionOrdinal,
      received: message.schedules?.length ?? 0,
      sent: 0,
      inserted: 0,
    });
  }

  if (match && match.tier === 'mid') {
    // Story 3.6v (AC1, AC8) — queue a suggested-match record for moderator review (Story
    // 3.6w's own scope to read it); idempotent on (eventId, candidateEventId) re-run.
    await tx
      .insert(eventMatchCandidates)
      .values({
        eventId: insertedRow.id,
        candidateEventId: match.candidate.id,
        score: match.score,
        postId: message.postId,
      })
      .onConflictDoNothing({ target: [eventMatchCandidates.eventId, eventMatchCandidates.candidateEventId] });
  }

  return {
    inserted: true,
    event: insertedRow,
    shouldNotify: !isStub,
    dedupDecisionLog: buildDedupDecisionLog(match, insertedRow.id, message.postId),
  };
}
