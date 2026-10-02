import { eq, sql } from 'drizzle-orm';
import { events, eventPosts } from '@festgrid/database';
import { db } from '../../db/client.js';

/**
 * AD-30 Rule 2's "drift guard" -- a single backend module owns every write to `events.postId`.
 * `insertEventWithPrimaryPost` and `setEventPrimaryPost` below are, together, the only two call
 * sites in the codebase allowed to write `postId` into an `events` insert or update, enforced by
 * `apps/backend/src/schema/events-postid-write-ratchet.test.ts` (AC3/Task 8).
 *
 * Both functions take an injected `executor` so a caller can compose either one inside its own
 * larger transaction (required by AC4/Task 7, where promotion must run in the same transaction as
 * the eventual post delete). There is no prior precedent in this codebase for a shared helper
 * accepting an injected transaction client -- `Pick<typeof db, ...>` is a pragmatic, minimal-
 * surface typing choice that works against both the module-level `db` and a real `tx` from
 * `db.transaction(async (tx) => ...)`.
 */
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'execute'>;

type EventInsertRow = typeof events.$inferInsert;
type EventRow = typeof events.$inferSelect;

/**
 * Inserts a new `events` row and, when it carries a non-null `postId`, the matching `event_posts`
 * link row -- in one call, so the two tables can never drift apart. The conflict target is the
 * composite `(postId, extractionOrdinal)` unique (not `postId` alone, AD-30 Rule 1/3) -- a hit
 * means "this item is already represented" and is treated as an idempotent skip, never a failure,
 * matching `processIngestionJob`'s existing observable contract.
 *
 * `extractionOrdinal` defaults to `0` at this DB-write boundary when `values.postId` is set and
 * no ordinal was supplied -- correct for every ingestion caller today, since real per-event
 * ordinal plumbing (`ExtractedEventMessage`/`EventInsertValues`) is Story 3.6t's scope, not this
 * one's (see this story's Dev Notes).
 *
 * Returns the inserted row, or `null` when `onConflictDoNothing` skipped the insert.
 */
export async function insertEventWithPrimaryPost(
  executor: DbExecutor,
  values: EventInsertRow
): Promise<EventRow | null> {
  const extractionOrdinal =
    values.postId != null ? (values.extractionOrdinal ?? 0) : (values.extractionOrdinal ?? null);

  const insertedRows = await executor
    .insert(events)
    .values({ ...values, extractionOrdinal })
    .onConflictDoNothing({ target: [events.postId, events.extractionOrdinal] })
    .returning();

  if (insertedRows.length === 0) {
    return null;
  }

  const insertedEvent = insertedRows[0];

  if (insertedEvent.postId != null) {
    await executor
      .insert(eventPosts)
      .values({
        eventId: insertedEvent.id,
        postId: insertedEvent.postId,
        extractionOrdinal: insertedEvent.extractionOrdinal ?? 0,
      })
      .onConflictDoNothing();
  }

  return insertedEvent;
}

export interface SetEventPrimaryPostParams {
  eventId: string;
  postId: string | null;
  extractionOrdinal: number | null;
}

/**
 * Updates an existing event's primary-post pointer (used by the deletion-triggered promotion
 * path -- Task 7 -- and, later, Story 3.6v's match-driven promotion) and upserts the matching
 * `event_posts` row. The `event_posts` upsert uses a bare `onConflictDoNothing()` scoped to the
 * `(event_id, post_id)` primary key, since a promotion target may already have a manually-created
 * link row (in which case the caller is expected to have already resolved the correct ordinal to
 * pass here -- this function does not re-derive it).
 *
 * Re-slugging and alias recording (AD-16 Rules 10-11) are deliberately NOT wired in here -- see
 * this story's Dev Notes for why neither of this story's own callers need it yet.
 */
export async function setEventPrimaryPost(executor: DbExecutor, params: SetEventPrimaryPostParams): Promise<void> {
  await executor
    .update(events)
    .set({ postId: params.postId, extractionOrdinal: params.extractionOrdinal })
    .where(eq(events.id, params.eventId));

  if (params.postId != null) {
    await executor
      .insert(eventPosts)
      .values({
        eventId: params.eventId,
        postId: params.postId,
        extractionOrdinal: params.extractionOrdinal,
      })
      .onConflictDoNothing();
  }
}

/**
 * AD-30 Rule 2's consistency check: every non-null `events.postId` must have a matching
 * `event_posts` row with an equal `extractionOrdinal`. Returns the list of offending event ids
 * (empty when consistent) -- a direct query, not a DB-level constraint, since Drizzle cannot
 * express a deferrable composite FK across the two tables.
 */
export async function findEventsInconsistentWithEventPosts(executor: DbExecutor): Promise<string[]> {
  const rows = await executor.execute(sql`
    SELECT e.id
    FROM events e
    WHERE e.post_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM event_posts ep
        WHERE ep.event_id = e.id
          AND ep.post_id = e.post_id
          AND ep.extraction_ordinal IS NOT DISTINCT FROM e.extraction_ordinal
      )
  `);
  return (rows as unknown as Array<{ id: string }>).map((r) => r.id);
}
