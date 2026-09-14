/**
 * A minimal, structural shape of a schedule row sufficient to pick the display
 * schedule. Both the UI's `EventListViewScheduleShape` and richer schedule
 * objects satisfy this structurally.
 */
export interface SelectableSchedule {
  id?: string | null;
  isMainSchedule: boolean;
  eventStartDate: string;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  ticketPrice?: string | number | null;
}

function toUtcDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Story 2.7 — pick the schedule used to display a single event (and, in the
 * backend, its default sort key).
 *
 * Rule (shared with the backend `Query.events` ORDER BY subquery in
 * `apps/backend/src/schema/resolvers.ts` — keep the two in sync):
 *   1. Prefer the next-upcoming schedule — among schedules that are still
 *      ongoing or upcoming (eventEndDate >= now, falling back to
 *      eventStartDate when no end date is known), take the one with the
 *      earliest eventStartDate, breaking same-date ties by the earliest
 *      eventStartTime (NULLs last).
 *   2. If no schedule is upcoming, fall back to the main schedule
 *      (isMainSchedule = true).
 *   3. If there is still no main schedule, fall back to the schedule with the
 *      earliest eventStartDate among all schedules (same time tie-break).
 *
 * Dates are compared as 'YYYY-MM-DD' strings (which order lexicographically
 * like dates) against a UTC "now", mirroring the UTC-day math used by
 * `buildDefaultEventVisibilityConditions`. `now` defaults to `new Date()` but
 * is injectable for deterministic tests.
 */
export function selectDisplaySchedule<T extends SelectableSchedule>(
  schedules: T[] | null | undefined,
  now: Date = new Date()
): T | null {
  if (!schedules || schedules.length === 0) {
    return null;
  }

  const today = toUtcDateOnly(now);

  const upcoming = schedules.filter((s) => {
    const end = s.eventEndDate ?? s.eventStartDate;
    return end >= today;
  });

  if (upcoming.length > 0) {
    return [...upcoming].sort(byEarliestStart)[0];
  }

  return (
    schedules.find((s) => s.isMainSchedule) ||
    [...schedules].sort(byEarliestStart)[0] ||
    null
  );
}

/**
 * Compare two schedules so the "earliest-start" wins: ascending by
 * eventStartDate, then ascending by eventStartTime with NULLs sorted last —
 * mirroring the SQL `ORDER BY event_start_date ASC, event_start_time ASC
 * NULLS LAST` used by the backend `Query.events` sort subquery.
 */
function byEarliestStart(a: SelectableSchedule, b: SelectableSchedule): number {
  const dateCmp = a.eventStartDate.localeCompare(b.eventStartDate);
  if (dateCmp !== 0) {
    return dateCmp;
  }

  const timeA = a.eventStartTime ?? null;
  const timeB = b.eventStartTime ?? null;
  if (timeA === timeB) {
    return 0;
  }
  if (timeA === null) {
    return 1; // NULLs last
  }
  if (timeB === null) {
    return -1; // NULLs last
  }
  return timeA.localeCompare(timeB);
}
