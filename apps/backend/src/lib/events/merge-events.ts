import { eq, and, inArray } from 'drizzle-orm';
import {
  events,
  schedules,
  favorites,
  calendarAdditions,
  reports,
  eventPosts,
  eventSlugAliases,
  eventMatchCandidates,
  eventMerges,
} from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import type { DbExecutor } from './set-event-primary-post.js';
import { findScheduleByStartDate } from './schedule-date-match.js';

type EventRow = typeof events.$inferSelect;
type ScheduleRow = typeof schedules.$inferSelect;
type EventMergeRow = typeof eventMerges.$inferSelect;

/** AD-30 Rule 9 -- thrown when a merge is requested against a winner/loser pair that cannot be
 * merged (same event on both sides, either side already soft-deleted, or either side already
 * itself the loser of a prior merge). */
export class EventMergeInvalidStateError extends Error {}

/** Thrown by `undoEventMerge` when the journal row named by `mergeId` does not exist. */
export class EventMergeNotFoundError extends Error {}

/** Thrown by `undoEventMerge` when the journal row named by `mergeId` was already undone once --
 * undo-after-undo is rejected (Task 2's own test list). */
export class EventMergeAlreadyUndoneError extends Error {}

async function assertMergeable(executor: DbExecutor, winnerId: string, loserId: string): Promise<{ winner: EventRow; loser: EventRow }> {
  if (winnerId === loserId) {
    throw new EventMergeInvalidStateError('An event cannot be merged into itself.');
  }

  const rows = await executor.select().from(events).where(inArray(events.id, [winnerId, loserId]));
  const winner = rows.find((r) => r.id === winnerId);
  const loser = rows.find((r) => r.id === loserId);

  if (!winner) {
    throw new EventMergeInvalidStateError(`Winner event ${winnerId} not found.`);
  }
  if (!loser) {
    throw new EventMergeInvalidStateError(`Loser event ${loserId} not found.`);
  }
  // A merged event is never itself a valid winner or loser again (AD-30 Rule 9) -- `
  // mergedIntoEventId` being non-null already implies `deletedAt` is also set (the only writer
  // of either field sets both together, both here and in the undo path), so checking either
  // column alone is sufficient, but both are checked for defense-in-depth against a row that
  // somehow drifted (e.g. a future direct restore bypassing this module).
  if (winner.deletedAt !== null || winner.mergedIntoEventId !== null) {
    throw new EventMergeInvalidStateError(`Winner event ${winnerId} is already deleted or merged.`);
  }
  if (loser.deletedAt !== null || loser.mergedIntoEventId !== null) {
    throw new EventMergeInvalidStateError(`Loser event ${loserId} is already deleted or merged.`);
  }

  return { winner, loser };
}

export interface MergeEventsResult {
  merge: EventMergeRow;
  winner: EventRow;
}

/**
 * AC1/AC2/AC9 -- merges `loserId` (B) into `winnerId` (A): repoints/dedupes every link table,
 * records every change in a new `event_merges` journal row (so `undoEventMerge` below can
 * reverse it), and soft-deletes B. Caller is responsible for running this inside its own
 * `db.transaction(...)` (same injected-`executor` composition pattern as
 * `enrichAndPromoteEvent`/`setEventPrimaryPost`) -- this function never opens its own
 * transaction.
 */
export async function mergeEvents(
  executor: DbExecutor,
  winnerId: string,
  loserId: string,
  moderatorId: string,
  suggestionId: string | null
): Promise<MergeEventsResult> {
  const { winner, loser } = await assertMergeable(executor, winnerId, loserId);

  // Step 1: both events' current schedules (loser's never deleted by this function -- a merge
  // only repoints what references a schedule, it never removes the schedule rows themselves).
  const loserSchedules = await executor.select().from(schedules).where(eq(schedules.eventId, loserId));
  const winnerSchedules: ScheduleRow[] = await executor.select().from(schedules).where(eq(schedules.eventId, winnerId));

  // Step 2: favorites -- repoint, or dedupe-soft-delete when the winner already has an active
  // favorite for the same user (favorites.unique(userId, eventId)).
  const repointedFavoriteIds: string[] = [];
  const dedupedFavoriteIds: string[] = [];
  const loserFavorites = await executor.select().from(favorites).where(and(eq(favorites.eventId, loserId), activeOnly(favorites)));
  for (const fav of loserFavorites) {
    const [existingOnWinner] = await executor
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.eventId, winnerId), eq(favorites.userId, fav.userId), activeOnly(favorites)));
    if (existingOnWinner) {
      await executor.update(favorites).set({ deletedAt: new Date() }).where(eq(favorites.id, fav.id));
      dedupedFavoriteIds.push(fav.id);
    } else {
      await executor.update(favorites).set({ eventId: winnerId }).where(eq(favorites.id, fav.id));
      repointedFavoriteIds.push(fav.id);
    }
  }

  // Step 3: schedule mapping -- for each loser schedule, find a winner schedule sharing the same
  // eventStartDate (reusing the exact same date-match logic `mergeSchedules` already established,
  // via the shared `findScheduleByStartDate` helper), or insert a copy onto the winner when no
  // match exists. The winner's own schedule row is never mutated by this step (unlike
  // enrichment) -- both schedules remain independently readable until the loser is excluded by
  // `activeOnly`.
  const scheduleIdMap = new Map<string, string>();
  for (const loserSchedule of loserSchedules) {
    const match = findScheduleByStartDate(winnerSchedules, loserSchedule.eventStartDate);
    if (match) {
      scheduleIdMap.set(loserSchedule.id, match.id);
      continue;
    }
    const [copy] = await executor
      .insert(schedules)
      .values({
        eventId: winnerId,
        isMainSchedule: false,
        eventStartDate: loserSchedule.eventStartDate,
        eventEndDate: loserSchedule.eventEndDate,
        eventStartTime: loserSchedule.eventStartTime,
        eventEndTime: loserSchedule.eventEndTime,
        title: loserSchedule.title,
        performers: loserSchedule.performers,
        location: loserSchedule.location,
        ticketPrice: loserSchedule.ticketPrice,
        locationDetails: loserSchedule.locationDetails,
        latitude: loserSchedule.latitude,
        longitude: loserSchedule.longitude,
        timezone: loserSchedule.timezone,
        timezoneStatus: loserSchedule.timezoneStatus,
        applicableDaysOfWeek: loserSchedule.applicableDaysOfWeek,
      })
      .returning();
    winnerSchedules.push(copy);
    scheduleIdMap.set(loserSchedule.id, copy.id);
  }

  // Step 4: calendar additions -- repoint to the mapped winner schedule, or dedupe-soft-delete
  // when the winner already has an active row for the same (userId, targetScheduleId)
  // (calendar_additions.unique(userId, scheduleId)).
  const repointedCalendarAdditionIds: Array<{ id: string; previousScheduleId: string }> = [];
  const dedupedCalendarAdditionIds: string[] = [];
  const loserCalendarAdditions = await executor
    .select()
    .from(calendarAdditions)
    .where(and(eq(calendarAdditions.eventId, loserId), activeOnly(calendarAdditions)));
  for (const addition of loserCalendarAdditions) {
    const targetScheduleId = scheduleIdMap.get(addition.scheduleId) ?? addition.scheduleId;
    const [existingOnWinner] = await executor
      .select({ id: calendarAdditions.id })
      .from(calendarAdditions)
      .where(and(eq(calendarAdditions.userId, addition.userId), eq(calendarAdditions.scheduleId, targetScheduleId), activeOnly(calendarAdditions)));
    if (existingOnWinner) {
      await executor.update(calendarAdditions).set({ deletedAt: new Date() }).where(eq(calendarAdditions.id, addition.id));
      dedupedCalendarAdditionIds.push(addition.id);
    } else {
      await executor
        .update(calendarAdditions)
        .set({ eventId: winnerId, scheduleId: targetScheduleId })
        .where(eq(calendarAdditions.id, addition.id));
      repointedCalendarAdditionIds.push({ id: addition.id, previousScheduleId: addition.scheduleId });
    }
  }

  // Step 5: reports -- always repoint, no dedup (reports carries no per-reporter uniqueness
  // constraint; see Story 3.6w Dev Notes "Why reports need no dedup logic").
  const repointedReportRows = await executor
    .update(reports)
    .set({ eventId: winnerId })
    .where(eq(reports.eventId, loserId))
    .returning({ id: reports.id });
  const repointedReportIds = repointedReportRows.map((r) => r.id);

  // Step 6: event_posts -- repoint only the posts the winner does not already link; a post both
  // sides already link is left exactly as-is on the soft-deleted loser (AD-30 Rule 9) -- no
  // `event_posts` row is ever deleted by a merge.
  const repointedEventPostIds: string[] = [];
  const loserEventPosts = await executor.select().from(eventPosts).where(eq(eventPosts.eventId, loserId));
  for (const link of loserEventPosts) {
    const [existingOnWinner] = await executor
      .select({ postId: eventPosts.postId })
      .from(eventPosts)
      .where(and(eq(eventPosts.eventId, winnerId), eq(eventPosts.postId, link.postId)));
    if (!existingOnWinner) {
      await executor
        .update(eventPosts)
        .set({ eventId: winnerId })
        .where(and(eq(eventPosts.eventId, loserId), eq(eventPosts.postId, link.postId)));
      repointedEventPostIds.push(link.postId);
    }
  }

  // Step 7: slug aliases -- the loser's own slug becomes a permanent alias of the winner; every
  // existing alias that targeted the loser is repointed to the winner too (no alias chains).
  await executor.insert(eventSlugAliases).values({ slug: loser.slug, eventId: winnerId });
  const repointedAliasRows = await executor
    .update(eventSlugAliases)
    .set({ eventId: winnerId })
    .where(eq(eventSlugAliases.eventId, loserId))
    .returning({ id: eventSlugAliases.id });
  const repointedAliasIds = repointedAliasRows.map((r) => r.id);

  // Step 8: notified_at -- keep the earlier non-null value between winner and loser.
  let winnerNotifiedAtChanged = false;
  const winnerPriorNotifiedAt = winner.notifiedAt;
  if (loser.notifiedAt !== null && (winner.notifiedAt === null || winner.notifiedAt > loser.notifiedAt)) {
    winnerNotifiedAtChanged = true;
    await executor.update(events).set({ notifiedAt: loser.notifiedAt }).where(eq(events.id, winnerId));
  }

  // Step 9: soft-delete the loser.
  await executor.update(events).set({ deletedAt: new Date(), mergedIntoEventId: winnerId }).where(eq(events.id, loserId));

  // Step 10: the journal row -- the single source of truth `undoEventMerge` reads from.
  const [merge] = await executor
    .insert(eventMerges)
    .values({
      winnerEventId: winnerId,
      loserEventId: loserId,
      suggestionId,
      performedByModeratorId: moderatorId,
      loserPriorSlug: loser.slug,
      winnerNotifiedAtChanged,
      winnerPriorNotifiedAt,
      loserPriorNotifiedAt: loser.notifiedAt,
      repointedFavoriteIds,
      dedupedFavoriteIds,
      repointedCalendarAdditionIds,
      dedupedCalendarAdditionIds,
      repointedReportIds,
      repointedEventPostIds,
      repointedAliasIds,
    })
    .returning();

  // Step 11: flip the suggestion that drove this merge, when there is one.
  if (suggestionId !== null) {
    await executor
      .update(eventMatchCandidates)
      .set({ status: 'accepted', resolvedAt: new Date(), resolvedByModeratorId: moderatorId })
      .where(eq(eventMatchCandidates.id, suggestionId));
  }

  // Step 12: the re-selected winner row reflects the notified_at change above, if any.
  const [updatedWinner] = await executor.select().from(events).where(eq(events.id, winnerId));

  return { merge, winner: updatedWinner };
}

/**
 * AC7 -- reverses a merge's full repoint set exactly, using the journal row `mergeEvents` wrote.
 * Caller is responsible for running this inside its own transaction, same convention as
 * `mergeEvents` above.
 */
export async function undoEventMerge(executor: DbExecutor, mergeId: string, _moderatorId: string): Promise<EventRow> {
  const [merge] = await executor.select().from(eventMerges).where(eq(eventMerges.id, mergeId));
  if (!merge) {
    throw new EventMergeNotFoundError(`Event merge ${mergeId} not found.`);
  }
  if (merge.undoneAt !== null) {
    throw new EventMergeAlreadyUndoneError(`Event merge ${mergeId} has already been undone.`);
  }

  // Step 1: restore the loser -- un-delete, clear the merge pointer, restore its slug and
  // notified_at exactly as they were immediately before the merge.
  await executor
    .update(events)
    .set({
      deletedAt: null,
      mergedIntoEventId: null,
      slug: merge.loserPriorSlug,
      notifiedAt: merge.loserPriorNotifiedAt,
    })
    .where(eq(events.id, merge.loserEventId));

  // Step 2: restore the winner's notified_at, only if the merge actually changed it.
  if (merge.winnerNotifiedAtChanged) {
    await executor.update(events).set({ notifiedAt: merge.winnerPriorNotifiedAt }).where(eq(events.id, merge.winnerEventId));
  }

  // Step 3: remove the alias the merge created for the loser's own (now-live-again) slug.
  await executor
    .delete(eventSlugAliases)
    .where(and(eq(eventSlugAliases.slug, merge.loserPriorSlug), eq(eventSlugAliases.eventId, merge.winnerEventId)));

  // Step 4: every alias the merge repointed to the winner goes back to the loser.
  const repointedAliasIds = merge.repointedAliasIds ?? [];
  if (repointedAliasIds.length > 0) {
    await executor.update(eventSlugAliases).set({ eventId: merge.loserEventId }).where(inArray(eventSlugAliases.id, repointedAliasIds));
  }

  // Step 5: favorites -- repointed rows go back to the loser; deduped (soft-deleted) rows are
  // un-soft-deleted in place (they were never repointed, so their eventId is already correct).
  const repointedFavoriteIds = merge.repointedFavoriteIds ?? [];
  if (repointedFavoriteIds.length > 0) {
    await executor.update(favorites).set({ eventId: merge.loserEventId }).where(inArray(favorites.id, repointedFavoriteIds));
  }
  const dedupedFavoriteIds = merge.dedupedFavoriteIds ?? [];
  if (dedupedFavoriteIds.length > 0) {
    await executor.update(favorites).set({ deletedAt: null }).where(inArray(favorites.id, dedupedFavoriteIds));
  }

  // Step 6: calendar additions -- same repoint-vs-dedupe reversal, also restoring the original
  // (pre-merge) scheduleId for every repointed row.
  const repointedCalendarAdditionIds = merge.repointedCalendarAdditionIds ?? [];
  for (const { id, previousScheduleId } of repointedCalendarAdditionIds) {
    await executor
      .update(calendarAdditions)
      .set({ eventId: merge.loserEventId, scheduleId: previousScheduleId })
      .where(eq(calendarAdditions.id, id));
  }
  const dedupedCalendarAdditionIds = merge.dedupedCalendarAdditionIds ?? [];
  if (dedupedCalendarAdditionIds.length > 0) {
    await executor.update(calendarAdditions).set({ deletedAt: null }).where(inArray(calendarAdditions.id, dedupedCalendarAdditionIds));
  }

  // Step 7: reports -- always repoint back (no dedup branch existed on the way in).
  const repointedReportIds = merge.repointedReportIds ?? [];
  if (repointedReportIds.length > 0) {
    await executor.update(reports).set({ eventId: merge.loserEventId }).where(inArray(reports.id, repointedReportIds));
  }

  // Step 8: event_posts -- move each repointed link back to the loser.
  const repointedEventPostIds = merge.repointedEventPostIds ?? [];
  for (const postId of repointedEventPostIds) {
    await executor
      .update(eventPosts)
      .set({ eventId: merge.loserEventId })
      .where(and(eq(eventPosts.eventId, merge.winnerEventId), eq(eventPosts.postId, postId)));
  }

  // Step 9: the suggestion that drove this merge, if any, becomes reviewable again.
  if (merge.suggestionId !== null) {
    await executor
      .update(eventMatchCandidates)
      .set({ status: 'pending', resolvedAt: null, resolvedByModeratorId: null })
      .where(eq(eventMatchCandidates.id, merge.suggestionId));
  }

  // Step 10: mark the journal row itself as undone -- guards against undo-after-undo.
  await executor.update(eventMerges).set({ undoneAt: new Date() }).where(eq(eventMerges.id, mergeId));

  // Step 11: schedules copied onto the winner during the original merge are deliberately never
  // deleted here -- harmless, unreferenced leftovers once their calendar_additions repoint is
  // reversed (see Story 3.6w Dev Notes "Why copied schedules are never deleted on undo").

  const [restoredLoser] = await executor.select().from(events).where(eq(events.id, merge.loserEventId));
  return restoredLoser;
}
