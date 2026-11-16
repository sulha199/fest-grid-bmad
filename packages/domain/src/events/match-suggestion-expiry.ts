/**
 * IDEA-107 -- when a pending match suggestion (`event_match_candidates`) can never be acted on and
 * should leave the moderator queue. Pure: the caller reads each event's state and passes the run's
 * date, so nothing here touches a clock or a database.
 *
 * Two kinds of dead suggestion:
 *   - an event of the pair was soft-deleted or merged away since the suggestion was queued (the
 *     drain skips it as stale but never closed it);
 *   - both events are over: a duplicate that nobody can still attend is worth nobody's review.
 *
 * "Over" is deliberately the conservative, day-granular reading: the last day any schedule covers
 * lies strictly before the run's date. It never expires a pair that AD-20's `!ended` would still
 * show (that check also compares end times); a schedule that ended a few hours ago stays for a day.
 */
export type SuggestionExpiryReason = 'event-deleted' | 'event-merged' | 'both-over';

export interface SuggestionExpiryEvent {
  /** `events.deleted_at` is set. */
  deleted: boolean;
  /** `events.merged_into_event_id` is set. */
  merged: boolean;
  /**
   * The latest day any schedule of the event covers (`YYYY-MM-DD`): the end date, else the start
   * date, whichever is later across the schedules. `null` when the event has no schedule, which
   * never counts as over (nothing says when it ended).
   */
  lastScheduleDay: string | null;
}

function isOver(event: SuggestionExpiryEvent, today: string): boolean {
  return event.lastScheduleDay !== null && event.lastScheduleDay < today;
}

/**
 * Why a pending suggestion between `a` and `b` is expired, or `null` when a moderator may still
 * need it. `today` is `YYYY-MM-DD` (the run's UTC date). A dead event wins over "both over": it
 * names the cause that is true whatever the dates are.
 */
export function getSuggestionExpiryReason(
  a: SuggestionExpiryEvent,
  b: SuggestionExpiryEvent,
  today: string
): SuggestionExpiryReason | null {
  if (a.deleted || b.deleted) return 'event-deleted';
  if (a.merged || b.merged) return 'event-merged';
  if (isOver(a, today) && isOver(b, today)) return 'both-over';
  return null;
}
