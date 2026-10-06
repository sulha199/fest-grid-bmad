import { and, eq, inArray, sql } from 'drizzle-orm';
import { events, eventPosts, eventSlugAliases, schedules, posts, corrections, calendarAdditions } from '@festgrid/database';
import { db } from '../../db/client.js';
import type { EventInsertValues, ScheduleInsertValues, ProposedEventCorrection } from '@festgrid/domain/events';
import { isOrganizerAuthoredPost } from '../posts/is-organizer-authored-post.js';
import { activeOnly } from '@festgrid/graphql-select';
import { findScheduleByStartDate } from './schedule-date-match.js';

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
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

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
 * Re-slugging and alias recording (AD-16 Rules 10-11) are deliberately NOT wired in here -- this
 * bare primitive is used by the deletion-triggered promotion path (Task 7, Story 3.6r), which
 * has no re-slug need. `enrichAndPromoteEvent` below (Story 3.6v) is the full promotion +
 * enrichment + re-slug write that this function's own prior doc comment deferred to.
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

type ScheduleRow = typeof schedules.$inferSelect;

export interface EnrichAndPromoteResult {
  event: EventRow;
  /** True only when primary selection just flipped the event from not-organizer-authored to
   * organizer-authored (AC7) -- drives whether `processIngestionJob` calls `notifyNewEvent`. */
  becameOrganizerAuthored: boolean;
}

/** Fields of `events` this story's enrichment pass may overwrite from a new extraction -- a
 * fixed, known list (never `proposedData`'s own `schedules` key, which the schedule-merge step
 * below handles separately, scoped per-schedule). */
const ENRICHABLE_EVENT_FIELDS = [
  'eventName',
  'types',
  'categories',
  'location',
  'organizerName',
  'contactInfo',
  'description',
  'links',
] as const satisfies readonly (keyof EventInsertValues)[];

function hasCompleteDateAndLocation(s: { eventStartDate?: string | null; location?: string | null }): boolean {
  return Boolean(s.eventStartDate) && Boolean(s.location);
}

/**
 * AC2/AD-30 Rule 7's primary-post selection order, evaluated in this exact order: (1) organizer-
 * authored beats roundup/aggregator/curator-sourced; (2) more schedules with a complete date AND
 * location; (3) earlier post (`publishedAt` ascending); (4) lower post id (deterministic
 * tie-break). Returns `true` when the NEW post wins (should become primary).
 */
async function shouldNewPostBecomePrimary(
  executor: DbExecutor,
  currentPrimaryPostId: string | null,
  currentSchedules: ScheduleRow[],
  newPostId: string,
  newSchedules: ScheduleInsertValues[]
): Promise<boolean> {
  if (currentPrimaryPostId === null) {
    return true; // no current primary at all -- the new post trivially wins
  }

  const [currentIsOrganizerAuthored, newIsOrganizerAuthored] = await Promise.all([
    isOrganizerAuthoredPost(currentPrimaryPostId, executor),
    isOrganizerAuthoredPost(newPostId, executor),
  ]);
  if (currentIsOrganizerAuthored !== newIsOrganizerAuthored) {
    return newIsOrganizerAuthored;
  }

  const currentCompleteness = currentSchedules.filter(hasCompleteDateAndLocation).length;
  const newCompleteness = newSchedules.filter(hasCompleteDateAndLocation).length;
  if (currentCompleteness !== newCompleteness) {
    return newCompleteness > currentCompleteness;
  }

  const [currentPostRow] = await executor.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, currentPrimaryPostId)).limit(1);
  const [newPostRow] = await executor.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, newPostId)).limit(1);
  if (currentPostRow && newPostRow) {
    const currentTime = currentPostRow.publishedAt.getTime();
    const newTime = newPostRow.publishedAt.getTime();
    if (currentTime !== newTime) {
      return newTime < currentTime; // earlier wins
    }
  }

  return newPostId < currentPrimaryPostId; // deterministic tie-break
}

interface ProtectedFields {
  /** Top-level `events` column names (never `'schedules'`) protected by an applied correction. */
  event: Set<string>;
  /** Per-schedule protected field names, keyed by the schedule row id a correction named. */
  byScheduleId: Map<string, Set<string>>;
}

/**
 * AC4's field-protection sets, computed from a single `corrections` read: every top-level
 * `events` column name named as a key in any `applied` correction's `proposedData` for this
 * event (enrichment must never overwrite these -- they are left for moderation exactly as an
 * unmatched correction would be), plus the equivalent per-schedule map for
 * `proposedData.schedules` entries. A schedule-correction entry with no `id` cannot be
 * confidently scoped to one row and is skipped (a documented scope limit -- `id` is already
 * optional on `ProposedScheduleCorrection` precisely because not every correction names one).
 */
async function getProtectedFields(executor: DbExecutor, eventId: string): Promise<ProtectedFields> {
  const rows = await executor
    .select({ proposedData: corrections.proposedData })
    .from(corrections)
    .where(and(eq(corrections.eventId, eventId), eq(corrections.status, 'applied')));

  const event = new Set<string>();
  const byScheduleId = new Map<string, Set<string>>();

  for (const row of rows) {
    const proposed = row.proposedData as ProposedEventCorrection;
    for (const key of Object.keys(proposed)) {
      if (key !== 'schedules') {
        event.add(key);
      }
    }
    for (const scheduleCorrection of proposed.schedules ?? []) {
      if (!scheduleCorrection.id) continue;
      const existing = byScheduleId.get(scheduleCorrection.id) ?? new Set<string>();
      for (const key of Object.keys(scheduleCorrection)) {
        if (key !== 'id') existing.add(key);
      }
      byScheduleId.set(scheduleCorrection.id, existing);
    }
  }

  return { event, byScheduleId };
}

/**
 * AC4's schedule merge: an existing candidate schedule with the same `eventStartDate` as a new
 * schedule is updated in place (respecting per-field correction protection); a new schedule with
 * no date match is inserted. A candidate schedule absent from the new extraction is deleted --
 * UNLESS a `calendar_additions` row still references it (AD-30 Rule 9), in which case it is left
 * untouched (orphaned but never deleted).
 */
async function mergeSchedules(
  executor: DbExecutor,
  eventId: string,
  currentSchedules: ScheduleRow[],
  newSchedules: ScheduleInsertValues[],
  protectedFieldsByScheduleId: Map<string, Set<string>>
): Promise<void> {
  const matchedCurrentIds = new Set<string>();

  for (const newSchedule of newSchedules) {
    const match = findScheduleByStartDate(currentSchedules, newSchedule.eventStartDate, matchedCurrentIds);

    if (!match) {
      // A brand-new schedule inserted during enrichment is never auto-promoted to main --
      // `isMainSchedule` is a structural/application concern, not extracted data, and the
      // event's existing main schedule (if any) already satisfies the one-main-per-event
      // partial unique index (idx_schedules_one_main_per_event); blindly carrying over the new
      // extraction's own isMainSchedule flag here would violate it whenever the event already
      // has an (unmatched, orphaned-but-undeleted) main schedule.
      await executor.insert(schedules).values({ ...newSchedule, eventId, isMainSchedule: false });
      continue;
    }

    matchedCurrentIds.add(match.id);
    const protectedFields = protectedFieldsByScheduleId.get(match.id) ?? new Set<string>();
    const patch: Partial<ScheduleRow> = {};
    // isMainSchedule is deliberately excluded from the enrichable set for the same reason as
    // the insert-path above -- which schedule is "main" is never re-derived by a merge.
    const candidates: Array<[string, unknown]> = [
      ['eventEndDate', newSchedule.eventEndDate],
      ['eventStartTime', newSchedule.eventStartTime],
      ['eventEndTime', newSchedule.eventEndTime],
      ['title', newSchedule.title],
      ['performers', newSchedule.performers],
      ['location', newSchedule.location],
      ['ticketPrice', newSchedule.ticketPrice],
      ['locationDetails', newSchedule.locationDetails],
      ['latitude', newSchedule.latitude],
      ['longitude', newSchedule.longitude],
      ['timezone', newSchedule.timezone],
      ['timezoneStatus', newSchedule.timezoneStatus],
      ['applicableDaysOfWeek', newSchedule.applicableDaysOfWeek],
    ];
    for (const [field, value] of candidates) {
      if (protectedFields.has(field)) continue;
      if (value === null || value === undefined) continue;
      (patch as Record<string, unknown>)[field] = value;
    }
    if (Object.keys(patch).length > 0) {
      await executor.update(schedules).set(patch).where(eq(schedules.id, match.id));
    }
  }

  const unmatchedCurrent = currentSchedules.filter((s) => !matchedCurrentIds.has(s.id));
  if (unmatchedCurrent.length === 0) return;

  const unmatchedIds = unmatchedCurrent.map((s) => s.id);
  const referencedRows = await executor
    .select({ scheduleId: calendarAdditions.scheduleId })
    .from(calendarAdditions)
    .where(and(inArray(calendarAdditions.scheduleId, unmatchedIds), activeOnly(calendarAdditions)));
  const referencedIds = new Set(referencedRows.map((r) => r.scheduleId));

  const deletableIds = unmatchedIds.filter((id) => !referencedIds.has(id));
  if (deletableIds.length > 0) {
    await executor.delete(schedules).where(inArray(schedules.id, deletableIds));
  }
}

/**
 * AC2/AC4/AC5/AC7/AC9 -- the full promotion + enrichment-in-place write, extending
 * `setEventPrimaryPost` above into the work its own doc comment deferred to this story. Called
 * by `processIngestionJob` (Task 4) on a 'high'-confidence match instead of
 * `insertEventWithPrimaryPost`.
 *
 * `newEvent.slug` is reused as-is (never recomputed here): `buildEventInsertValues()` already
 * calls the platform-prefixed slug builder with the exact same inputs (the new post's identity +
 * extraction ordinal) before this function is ever reached, so recomputing it here would be the
 * exact duplicate work the domain layer's own "reuse, do not duplicate" rule warns against. When
 * `newEvent.slug` is absent (no resolvable platform post for the new post), no re-slug happens --
 * the candidate's existing slug is left unchanged, matching `buildEventInsertValues()`'s own
 * "omit the key, let the legacy default stand" convention for that same case.
 */
export async function enrichAndPromoteEvent(
  executor: DbExecutor,
  candidateEvent: EventRow,
  newEvent: EventInsertValues,
  newSchedules: ScheduleInsertValues[],
  newPostId: string,
  newExtractionOrdinal: number | null
): Promise<EnrichAndPromoteResult> {
  const previousOrganizerAuthored = candidateEvent.postId
    ? await isOrganizerAuthoredPost(candidateEvent.postId, executor)
    : false;

  const currentSchedules = await executor.select().from(schedules).where(eq(schedules.eventId, candidateEvent.id));

  const shouldPromote = await shouldNewPostBecomePrimary(
    executor,
    candidateEvent.postId,
    currentSchedules,
    newPostId,
    newSchedules
  );

  // Field-level enrichment (AC4) -- every other field takes the new extraction's value when
  // non-null; a field named by an applied correction is skipped (candidate's value wins).
  const protectedFields = await getProtectedFields(executor, candidateEvent.id);
  const eventPatch: Record<string, unknown> = {};
  for (const field of ENRICHABLE_EVENT_FIELDS) {
    if (protectedFields.event.has(field)) continue;
    const value = newEvent[field];
    if (value === null || value === undefined) continue;
    eventPatch[field] = value;
  }
  if (Object.keys(eventPatch).length > 0) {
    await executor.update(events).set(eventPatch).where(eq(events.id, candidateEvent.id));
  }

  if (shouldPromote) {
    // Re-slug + alias (AC5) -- only on an actual primary-post change, and only in the same
    // transaction as the pointer change below.
    if (newEvent.slug && newEvent.slug !== candidateEvent.slug) {
      // Normal step: record the event's current (pre-change) slug as a permanent alias -- skip
      // only if that exact row somehow already exists (a plain duplicate-insert guard, distinct
      // from the R-O-R exception below, which concerns the NEW slug, not this one).
      const [existingAliasForOldSlug] = await executor
        .select()
        .from(eventSlugAliases)
        .where(eq(eventSlugAliases.slug, candidateEvent.slug))
        .limit(1);
      if (!existingAliasForOldSlug) {
        await executor.insert(eventSlugAliases).values({ slug: candidateEvent.slug, eventId: candidateEvent.id });
      }

      // AD-16 Rule 10 R-O-R exception: the slug we're moving TO already exists as an alias
      // pointing at THIS same event (a primary reverting to a post it held before) -- that
      // alias row is now redundant (the slug is becoming canonical/primary again), so delete it
      // instead of leaving a stale alias that points an already-canonical slug at itself.
      const [existingAliasForNewSlug] = await executor
        .select()
        .from(eventSlugAliases)
        .where(eq(eventSlugAliases.slug, newEvent.slug))
        .limit(1);
      if (existingAliasForNewSlug && existingAliasForNewSlug.eventId === candidateEvent.id) {
        await executor.delete(eventSlugAliases).where(eq(eventSlugAliases.id, existingAliasForNewSlug.id));
      }

      await executor.update(events).set({ slug: newEvent.slug }).where(eq(events.id, candidateEvent.id));
    }

    // The same transaction as the pointer change (AD-30 Rule 2's single-writer primitive).
    await setEventPrimaryPost(executor, {
      eventId: candidateEvent.id,
      postId: newPostId,
      extractionOrdinal: newExtractionOrdinal,
    });
  } else {
    // Enrichment-only: the event still always gains the new post's link (no re-slug, no
    // pointer change) -- setEventPrimaryPost is not called in this branch, so insert directly.
    await executor
      .insert(eventPosts)
      .values({ eventId: candidateEvent.id, postId: newPostId, extractionOrdinal: newExtractionOrdinal })
      .onConflictDoNothing();
  }

  // Schedule merge (AC4), using the pre-enrichment snapshot fetched above.
  await mergeSchedules(executor, candidateEvent.id, currentSchedules, newSchedules, protectedFields.byScheduleId);

  const [updatedEvent] = await executor.select().from(events).where(eq(events.id, candidateEvent.id)).limit(1);

  const becameOrganizerAuthored =
    shouldPromote && !previousOrganizerAuthored && (await isOrganizerAuthoredPost(newPostId, executor));

  return { event: updatedEvent, becameOrganizerAuthored };
}
