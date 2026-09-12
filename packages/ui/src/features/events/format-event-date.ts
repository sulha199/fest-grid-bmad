export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatEventDate(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...DATE_FORMAT_OPTIONS,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(dateObj);
    }
  }
}

export const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

export function formatEventTime(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...TIME_FORMAT_OPTIONS,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, TIME_FORMAT_OPTIONS).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', TIME_FORMAT_OPTIONS).format(dateObj);
    }
  }
}

export function getLocalDateInTimezone(date: Date, timeZone: string | undefined): { year: number; month: number; day: number } {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    });
    const parts = dtf.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    return { year, month, day };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

export function getCalendarDayDifference(nowParts: { year: number; month: number; day: number }, eventParts: { year: number; month: number; day: number }): number {
  const utcNow = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const utcEvent = Date.UTC(eventParts.year, eventParts.month - 1, eventParts.day);
  const diffMs = utcEvent - utcNow;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function formatWeekday(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
    }
  }
}

export function getEventDayDiff(dateObj: Date, timezone: string | undefined): number {
  const now = new Date();
  const nowParts = getLocalDateInTimezone(now, timezone);
  const eventParts = getLocalDateInTimezone(dateObj, timezone);
  return getCalendarDayDifference(nowParts, eventParts);
}

/**
 * Combines a date (Date object or ISO-ish string) with an optional time-of-day string
 * (e.g. "18:00:00") into a single Date instance. Mirrors the date+time combining logic
 * `EventCard.tsx` already used inline for `startDate`/`startTime` — extracted here so
 * `formatEventStatus` and the masonry TILL badge can reuse it rather than duplicating it.
 */
export function combineDateTime(dateInput: Date | string, timeStr?: string | null): Date {
  const base = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (timeStr && !isNaN(base.getTime())) {
    const [h = 0, m = 0, s = 0] = timeStr.split(':').map((n) => parseInt(n, 10));
    // Build from local date components rather than the UTC ISO date part: for a Date
    // carrying a local wall-clock time after UTC midnight (e.g. 03:00 WIB == 20:00 UTC
    // the previous day), `toISOString()` would yield the wrong calendar date and shift
    // event times a day back. Event start/end times are local wall-clock values, so the
    // combination must stay in local time.
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, s, 0);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(base.getTime());
}

export interface EventStatusLabels {
  tomorrow?: string;
  statusEnded?: string;
  statusHappeningNow?: string;
  statusEndsToday?: string;
  statusInHours?: string;
  statusInDays?: string;
  statusUpcoming?: string;
}

/**
 * Computes the masonry variant's status badge text (Story 1.3b AC15): one of 8 states
 * — ended / happeningNow / endsToday / inHours(n) / tomorrow / a weekday name /
 * inDays(n) / upcoming — always returning an already-labeled display string (matching
 * `formatRelativeDayOrDate`'s existing return-a-ready-string convention).
 *
 * `now` is an explicit parameter (unlike `getEventDayDiff`, which calls a bare `new Date()`
 * internally) so every state boundary is unit-testable without mocking global time.
 *
 * Absent `endDate` is treated as "ends same day as start" (falls back to `startDate`),
 * matching the masonry TILL badge's identical fallback (AC14), for consistency.
 */
export function formatEventStatus(
  locale: string,
  timezone: string | undefined,
  now: Date,
  startDate: Date | string,
  startTime: string | null | undefined,
  endDate: Date | string | null | undefined,
  endTime: string | null | undefined,
  labels?: EventStatusLabels
): string {
  const startDateTime = combineDateTime(startDate, startTime);
  const nowParts = getLocalDateInTimezone(now, timezone);
  const startParts = getLocalDateInTimezone(startDateTime, timezone);
  const startDayDiff = getCalendarDayDifference(nowParts, startParts);
  const started = now.getTime() >= startDateTime.getTime();

  const effectiveEndDate = endDate ?? startDate;
  const endDateTime = combineDateTime(effectiveEndDate, endTime);
  const endParts = getLocalDateInTimezone(endDateTime, timezone);
  const endDayDiff = getCalendarDayDifference(nowParts, endParts);

  const ended =
    endDayDiff < 0 || (endDayDiff === 0 && !!endTime && now.getTime() >= endDateTime.getTime());

  if (ended) {
    return labels?.statusEnded ?? 'Ended';
  }

  if (started) {
    if (endDayDiff > 0) {
      return labels?.statusHappeningNow ?? 'Happening Now';
    }
    // endDayDiff === 0 here: ended-check above already handled endDayDiff < 0.
    return labels?.statusEndsToday ?? 'Ends Today';
  }

  // Not started.
  if (startDayDiff === 0) {
    let n = 0;
    if (startTime) {
      const diffMs = startDateTime.getTime() - now.getTime();
      n = Math.ceil(diffMs / (1000 * 60 * 60));
    }
    return (labels?.statusInHours ?? 'In {n} hour(s)').replace('{n}', String(n));
  }
  if (startDayDiff === 1) {
    return labels?.tomorrow ?? 'Tomorrow';
  }
  if (startDayDiff >= 2 && startDayDiff <= 6) {
    return formatWeekday(locale, timezone, startDateTime);
  }
  if (startDayDiff >= 7 && startDayDiff <= 13) {
    return (labels?.statusInDays ?? 'In {n} days').replace('{n}', String(startDayDiff));
  }
  return labels?.statusUpcoming ?? 'Upcoming';
}

export function formatRelativeDayOrDate(
  locale: string,
  timezone: string | undefined,
  dateObj: Date,
  labels?: { today?: string; tomorrow?: string },
  precomputedDayDiff?: number
): string {
  const dayDiff = precomputedDayDiff ?? getEventDayDiff(dateObj, timezone);

  if (dayDiff >= 0 && dayDiff <= 6) {
    if (dayDiff === 0) {
      return labels?.today || 'Today';
    }
    if (dayDiff === 1) {
      return labels?.tomorrow || 'Tomorrow';
    }
    return formatWeekday(locale, timezone, dateObj);
  }

  return formatEventDate(locale, timezone, dateObj);
}

export function formatShortEventDateTime(
  locale: string,
  timezone: string | undefined,
  dateObj: Date,
  hasTime: boolean,
  labels?: { today?: string; tomorrow?: string; yesterday?: string }
): string {
  const dayDiff = getEventDayDiff(dateObj, timezone);

  if (dayDiff === 0) {
    if (hasTime) {
      return formatEventTime(locale, timezone, dateObj);
    }
    return labels?.today ?? 'Today';
  } else if (dayDiff === 1) {
    return labels?.tomorrow ?? 'Tomorrow';
  } else if (dayDiff === -1) {
    return labels?.yesterday ?? 'Yesterday';
  } else {
    const now = new Date();
    const nowLocal = getLocalDateInTimezone(now, timezone);
    const dateLocal = getLocalDateInTimezone(dateObj, timezone);
    const sameYear = nowLocal.year === dateLocal.year;

    if (sameYear) {
      try {
        return new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          ...(timezone ? { timeZone: timezone } : {}),
        }).format(dateObj);
      } catch {
        try {
          return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
          }).format(dateObj);
        } catch {
          return new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
          }).format(dateObj);
        }
      }
    } else {
      try {
        return new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: '2-digit',
          ...(timezone ? { timeZone: timezone } : {}),
        }).format(dateObj);
      } catch {
        try {
          return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
          }).format(dateObj);
        } catch {
          return new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
          }).format(dateObj);
        }
      }
    }
  }
}
