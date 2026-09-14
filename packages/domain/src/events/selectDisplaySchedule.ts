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
 * Rule: prefer the next-upcoming schedule — among schedules that are still
 * ongoing or upcoming (eventEndDate >= now, falling back to eventStartDate
 * when no end date is known), take the one with the earliest eventStartDate.
 * If no schedule is upcoming, fall back to the main schedule, then to the
 * first schedule in the list.
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
    return [...upcoming].sort((a, b) =>
      a.eventStartDate.localeCompare(b.eventStartDate)
    )[0];
  }

  return schedules.find((s) => s.isMainSchedule) ?? schedules[0] ?? null;
}
