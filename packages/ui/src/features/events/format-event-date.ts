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
 * `formatEventStatus`'s return shape (Story 1.i1i AC4): the already-labeled display string
 * plus the one state discriminant its single consumer (`EventCardStatusBadge`) needs.
 */
export interface EventStatusResult {
  /** The already-labeled display string for the active state (unchanged from AC15). */
  text: string;
  /**
   * True only for the `happeningNow` state (event already started and not ending today) —
   * the one state `DESIGN.md` § event_card_status_badge gives a distinct visual treatment
   * (`happening_now`'s solid emerald fill) instead of the shared neutral `base`.
   */
  isHappeningNow: boolean;
}

/**
 * Computes the masonry variant's status badge text (Story 1.3b AC15): one of 8 states
 * — ended / happeningNow / endsToday / inHours(n) / tomorrow / a weekday name /
 * inDays(n) / upcoming — returning the already-labeled display string (matching
 * `formatRelativeDayOrDate`'s existing return-a-ready-string convention) together with
 * the `happeningNow` discriminant (Story 1.i1i AC4), so `EventCardStatusBadge` can apply
 * `DESIGN.md`'s one sanctioned per-state treatment without re-deriving
 * `started && endDayDiff > 0` at the call site.
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
): EventStatusResult {
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
    return { text: labels?.statusEnded ?? 'Ended', isHappeningNow: false };
  }

  if (started) {
    if (endDayDiff > 0) {
      // The one state with its own DESIGN.md color treatment (AC4) — surfaced from this
      // same branch, never re-derived by the caller.
      return { text: labels?.statusHappeningNow ?? 'Now', isHappeningNow: true };
    }
    // endDayDiff === 0 here: ended-check above already handled endDayDiff < 0.
    return { text: labels?.statusEndsToday ?? 'Ends Today', isHappeningNow: false };
  }

  // Not started.
  if (startDayDiff === 0) {
    let n = 0;
    if (startTime) {
      const diffMs = startDateTime.getTime() - now.getTime();
      n = Math.ceil(diffMs / (1000 * 60 * 60));
    }
    return {
      text: (labels?.statusInHours ?? 'In {n} hour(s)').replace('{n}', String(n)),
      isHappeningNow: false,
    };
  }
  if (startDayDiff === 1) {
    return { text: labels?.tomorrow ?? 'Tomorrow', isHappeningNow: false };
  }
  if (startDayDiff >= 2 && startDayDiff <= 6) {
    return { text: formatWeekday(locale, timezone, startDateTime), isHappeningNow: false };
  }
  if (startDayDiff >= 7 && startDayDiff <= 13) {
    return {
      text: (labels?.statusInDays ?? 'In {n} days').replace('{n}', String(startDayDiff)),
      isHappeningNow: false,
    };
  }
  return { text: labels?.statusUpcoming ?? 'Upcoming', isHappeningNow: false };
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

/** Mirrors `formatEventDate`/`formatWeekday`/`formatEventTime`'s own locale+timezone -> locale-only -> 'en-US' fallback pattern. */
export function formatMonthAbbrev(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { month: 'short' }).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dateObj);
    }
  }
}

/** Mirrors `formatEventDate`/`formatWeekday`/`formatEventTime`'s own locale+timezone -> locale-only -> 'en-US' fallback pattern. */
export function formatDayNumber(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(dateObj);
    }
  }
}

/**
 * Structured sibling of `formatShortEventDateTime` (which stays unchanged and is still used
 * as-is by `EventDetailView.tsx`, out of this story's scope). Branches identically on
 * `dayDiff`, but returns `{ month, day }` parts instead of one flat string — the two-tier
 * `EventCardDateBox` chrome (Story 1.i1k) needs the month/day split, not a single node.
 * Deliberately omits the 2-digit year `formatShortEventDateTime`'s own non-sameYear branch
 * appends, matching DESIGN.md's own month/day-only example (an accepted minor simplification,
 * not a bug — see Story 1.i1k Dev Notes Task 1.2).
 *
 * `dayVariant` (Story 1.i1n AC1/AC4) is assigned from the `DAY_VARIANT_WORD`/`_NUMBER` constants
 * below rather than inline `'word'`/`'number'` string literals: `packages/visual-audit`'s
 * `ts-morph`-based `enumerateContentVariants` (Task 4/AC6) derives each branch's overflow-check
 * sample text from the *longest quoted string literal anywhere in that branch's return
 * expression* — an inline `dayVariant: 'number'` literal on the real-date fallback branch (which
 * otherwise has no string literal of its own; both `month`/`day` come from function calls) would
 * itself become that branch's picked sample text ("number", 6 chars) instead of the engine's own
 * intended representative-length placeholder, silently corrupting `event-card-date-box-
 * overflow.ts`'s fallback-branch fixture. A bare identifier reference isn't a quoted literal, so
 * it's invisible to that extraction — confirmed against `event-card-date-box-overflow.ts`'s own
 * proof spec before landing.
 */
const DAY_VARIANT_WORD: 'word' = 'word';
const DAY_VARIANT_NUMBER: 'number' = 'number';

export function formatShortEventDateTimeParts(
  locale: string,
  timezone: string | undefined,
  dateObj: Date,
  hasTime: boolean,
  labels?: { today?: string; tomorrow?: string; yesterday?: string }
): { month: string; day: string; dayVariant: 'number' | 'word' } {
  const dayDiff = getEventDayDiff(dateObj, timezone);

  if (dayDiff === 0) {
    return {
      month: '',
      day: hasTime ? formatEventTime(locale, timezone, dateObj) : (labels?.today ?? 'Today'),
      dayVariant: DAY_VARIANT_WORD,
    };
  } else if (dayDiff === 1) {
    return { month: '', day: labels?.tomorrow ?? 'Tomorrow', dayVariant: DAY_VARIANT_WORD };
  } else if (dayDiff === -1) {
    return { month: '', day: labels?.yesterday ?? 'Yesterday', dayVariant: DAY_VARIANT_WORD };
  }

  return {
    month: formatMonthAbbrev(locale, timezone, dateObj),
    day: formatDayNumber(locale, timezone, dateObj),
    dayVariant: DAY_VARIANT_NUMBER,
  };
}

/**
 * Computes the WeeklyCalendarView list-variant date box's structured `month`/`day`/`tillLabel`
 * content (Story 1.i1k AC4 — resolves DESIGN.md's own "deferred to the amendment story" open
 * item). Unlike `computeCalendarSegmentTillText` (which stays unchanged/exported, still directly
 * unit-tested, still used nowhere else), this function's branch conditions and return shape
 * diverge from it — it must not call it internally:
 *  - **Continuing segment** (`currentDayStr < effectiveEnd`): `month`/`day` show the segment's
 *    real effective-end-date month/day (genuinely new information); `tillLabel` carries the bare
 *    till label text.
 *  - **Last/only day** (`currentDayStr >= effectiveEnd`): showing the effective end date here
 *    would exactly repeat the start date the day-row header already shows (the "never repeats
 *    the start date" regression guard) — instead `month` carries the till label text and `day`
 *    carries the known end time (or an empty string when no time is known); `tillLabel` is
 *    omitted (`undefined`) since it would duplicate the same text already shown via `month`/`day`.
 */
export function computeCalendarSegmentDateBoxContent(
  locale: string,
  timezone: string | undefined,
  currentDayStr: string,
  startDate: string,
  endDate: string | null | undefined,
  endTime: string | null | undefined,
  tillLabel: string
): { month: string; day: string; tillLabel: string | undefined; dayVariant: 'number' | 'word' } {
  const effectiveEnd = endDate ?? startDate;

  if (currentDayStr < effectiveEnd) {
    const endDateTime = combineDateTime(effectiveEnd);
    return {
      month: formatMonthAbbrev(locale, timezone, endDateTime),
      day: formatDayNumber(locale, timezone, endDateTime),
      tillLabel,
      dayVariant: 'number',
    };
  }

  // This is the segment's last/only day.
  const day = endTime && effectiveEnd ? formatEventTime(locale, timezone, combineDateTime(effectiveEnd, endTime)) : '';
  return { month: tillLabel, day, tillLabel: undefined, dayVariant: 'word' };
}

/**
 * Computes the till/end text for the WeeklyCalendarView list-variant's date box
 * (Story 1.i1d AC4). Unlike `EventCard`'s own TILL badge, this is keyed off the
 * segment's *own calendar day* (`currentDayStr`), never off "now", so it always
 * returns non-empty content:
 *  - segment continues past this calendar day (`currentDayStr < effectiveEnd`)
 *    → bare `tillLabel` ("till");
 *  - segment is this day's last/only day and a distinct end time is known
 *    → `"{tillLabel} {formatted end time}"` via `combineDateTime` + `formatEventTime`;
 *  - every other case (explicit end date with no end time, or no end info at all)
 *    → bare `tillLabel`.
 */
export function computeCalendarSegmentTillText(
  locale: string,
  timezone: string | undefined,
  currentDayStr: string,
  startDate: string,
  endDate: string | null | undefined,
  endTime: string | null | undefined,
  tillLabel: string
): string {
  // Absent end date falls back to start date ("ends same day as start", matching
  // EventCard AC14's shared convention).
  const effectiveEnd = endDate ?? startDate;

  // String comparison is safe here: both `currentDayStr` and `effectiveEnd` are
  // YYYY-MM-DD ISO date strings.
  if (currentDayStr < effectiveEnd) {
    return tillLabel;
  }

  // This is the segment's last/only day.
  if (endTime && effectiveEnd) {
    const endDateTime = combineDateTime(effectiveEnd, endTime);
    const formattedTime = formatEventTime(locale, timezone, endDateTime);
    return `${tillLabel} ${formattedTime}`;
  }

  return tillLabel;
}

