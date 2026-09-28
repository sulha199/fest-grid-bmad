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
 *
 * BUG (2026-09-28, production, mobile-only, `timeStr` present only): `eventStartDate`/
 * `eventEndDate` arrive from the GraphQL `Date` scalar as a bare `"YYYY-MM-DD"` string with no
 * time/timezone of its own — it's a calendar date, not an instant. `new Date("2026-10-02")`
 * parses that as UTC midnight per the ECMAScript spec; the old code then read
 * `.getFullYear()/.getMonth()/.getDate()` off THAT to combine with `timeStr` — local getters,
 * which apply the VIEWER's own device timezone offset to a string that never had one. For any
 * device west of UTC, that silently rolled the date back a day (reported: an event's detail page
 * correctly showed "Oct 2", its masonry card showed "Oct 1", reproducing only on the reporter's
 * own phone — device-timezone-dependent, invisible on a UTC-timezone'd CI/dev machine). Fixed by
 * extracting a BARE date-only string's Y/M/D digits directly instead, never round-tripping them
 * through a UTC-parsed Date object's local getters — scoped narrowly to strings matching exactly
 * `YYYY-MM-DD` (see the inline regex's own `$` anchor note): a fuller ISO timestamp string with
 * its own real instant/timezone (e.g. some test fixtures pass `"2026-01-01T18:00:00Z"`) is left
 * on the pre-existing local-getter path, which is the correct way to resolve a real instant into
 * the viewer's own local calendar day. The no-`timeStr` passthrough below
 * (`return new Date(base.getTime())`) was NEVER affected by this bug — it returns the UTC-parsed
 * instant unchanged, which every caller then reformats via `Intl.DateTimeFormat` with an explicit
 * IANA `timeZone`, correctly recovering the calendar date regardless of device timezone; changing
 * that passthrough to build a new LOCAL-midnight instant would reintroduce the same class of bug
 * one level up, just for callers that never look at `timeStr` at all.
 */
export function combineDateTime(dateInput: Date | string, timeStr?: string | null): Date {
  const base = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (timeStr && !isNaN(base.getTime())) {
    const [h = 0, m = 0, s = 0] = timeStr.split(':').map((n) => parseInt(n, 10));
    // Extract the calendar Y/M/D straight from the source STRING when `dateInput` is a BARE
    // date-only string ("YYYY-MM-DD", nothing else -- the `$` anchor matters: a fuller ISO
    // timestamp string like "2026-01-01T18:00:00Z" must NOT match here, since that string
    // already carries its own real instant/timezone info, and the local-getter path below
    // (parse as an instant, then read the VIEWER's local calendar date off it) is the correct,
    // deliberate way to resolve which local day that instant falls on -- only a bare date has no
    // timezone of its own for `new Date(string)`'s UTC-midnight assumption to get wrong.
    const dateOnlyMatch = typeof dateInput === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput) : null;
    const year = dateOnlyMatch ? parseInt(dateOnlyMatch[1], 10) : base.getFullYear();
    const month = dateOnlyMatch ? parseInt(dateOnlyMatch[2], 10) - 1 : base.getMonth();
    const day = dateOnlyMatch ? parseInt(dateOnlyMatch[3], 10) : base.getDate();
    // Build from local date components rather than the UTC ISO date part: for a Date carrying a
    // local wall-clock time after UTC midnight (e.g. 03:00 WIB == 20:00 UTC the previous day),
    // `toISOString()` would yield the wrong calendar date and shift event times a day back.
    // Event start/end times are local wall-clock values, so the combination must stay in local
    // time.
    const d = new Date(year, month, day, h, m, s, 0);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(base.getTime());
}

export interface EventStatusLabels {
  tomorrow?: string;
  statusEnded?: string;
  statusHappeningNow?: string;
  statusEndsToday?: string;
  /** `{time}`-templated, e.g. 'Ends {time}' -- used instead of `statusEndsToday` once the end time is known (see `formatEventStatus`'s `endDayDiff === 0` branch). */
  statusEndsAt?: string;
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
   * The color discriminant `EventCardStatusBadge` uses: `'happeningNow'` (event already
   * started, not ending today) gets the solid emerald treatment; `'endingSoon'`
   * (`statusEndsAt`/`statusEndsToday`) gets amber, matching the masonry TILL tag's own
   * end-time color; `'startingSoon'` (`statusInHours`) gets sky; every other state (`ended`,
   * `tomorrow`, a weekday name, `inDays`, `upcoming`) stays `'default'` (shared neutral `base`).
   */
  variant: 'default' | 'happeningNow' | 'endingSoon' | 'startingSoon';
  /**
   * The exact one of the 8 states (finer-grained than `variant`, which merges `endsAt` and
   * `endsToday` into one `'endingSoon'` color) — lets a caller distinguish, e.g., `endsAt` from
   * `endsToday` when it only wants to react to one of the two (`EventCardCalendarGridItem`'s
   * desktop calendar card shows a badge for `inHours`/`endsAt` only, not `endsToday`).
   */
  state: 'ended' | 'happeningNow' | 'endsAt' | 'endsToday' | 'inHours' | 'tomorrow' | 'weekday' | 'inDays' | 'upcoming';
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
    return { text: labels?.statusEnded ?? 'Ended', variant: 'default', state: 'ended' };
  }

  if (started) {
    if (endDayDiff > 0) {
      // The one state with its own DESIGN.md color treatment (AC4) — surfaced from this
      // same branch, never re-derived by the caller.
      return { text: labels?.statusHappeningNow ?? 'Now', variant: 'happeningNow', state: 'happeningNow' };
    }
    // endDayDiff === 0 here: ended-check above already handled endDayDiff < 0.
    // User feedback (2026-09-27): once the end time is known, show the precise "Ends hh:mm"
    // instead of the generic "Ends Today" -- more useful than a state the viewer can already
    // infer from the card just having reached this branch.
    if (endTime) {
      return {
        text: (labels?.statusEndsAt ?? 'Ends {time}').replace(
          '{time}',
          formatEventTime(locale, timezone, endDateTime)
        ),
        variant: 'endingSoon',
        state: 'endsAt',
      };
    }
    return { text: labels?.statusEndsToday ?? 'Ends Today', variant: 'endingSoon', state: 'endsToday' };
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
      variant: 'startingSoon',
      state: 'inHours',
    };
  }
  if (startDayDiff === 1) {
    return { text: labels?.tomorrow ?? 'Tomorrow', variant: 'default', state: 'tomorrow' };
  }
  if (startDayDiff >= 2 && startDayDiff <= 6) {
    return { text: formatWeekday(locale, timezone, startDateTime), variant: 'default', state: 'weekday' };
  }
  if (startDayDiff >= 7 && startDayDiff <= 13) {
    return {
      text: (labels?.statusInDays ?? 'In {n} days').replace('{n}', String(startDayDiff)),
      variant: 'default',
      state: 'inDays',
    };
  }
  return { text: labels?.statusUpcoming ?? 'Upcoming', variant: 'default', state: 'upcoming' };
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
 * BUG-047 (Event-Card family consolidation, `event-card-family-consolidated-acs.md` §2.2
 * AC-DATE-3): the masonry variant's shared context-date computation. Given the real "now" as the
 * context date, an event whose start has passed but whose effective end hasn't yet shows the END
 * date; every other case shows the START date. `startDateTime`/`endDateTime` are caller-computed
 * (`EventCard.tsx`'s own TILL-badge derivation, hoisted and reused — never re-derived here) so
 * this function does no date-combining of its own, only the comparison + formatting.
 *
 * **CORRECTED (review loop 1, Spec Change Log):** `notYetEnded` is day-difference based, mirroring
 * `formatEventStatus`'s own already-tested `ended` computation in this same file (reusing its two
 * building blocks, `getLocalDateInTimezone`/`getCalendarDayDifference`, independently — this
 * function never calls `formatEventStatus` itself or duplicates its full 8-state return shape,
 * only the same `ended` boundary logic). A strict raw-timestamp `now < endDateTime` compare (the
 * originally-specified rule) re-broke BUG-022 for any multi-day event with no precise `endTime`:
 * `combineDateTime` collapses an absent `endTime` to midnight of the effective end date, so the
 * date-box would revert to the start date for nearly the entire still-ongoing last day. The
 * corrected rule: an end day with no known `endTime` is never "ended" for its whole calendar day;
 * a precise timestamp compare only applies once an `endTime` is actually known.
 */
function resolveEventCardDateBoxTarget(
  timezone: string | undefined,
  now: Date,
  startDateTime: Date,
  endDateTime: Date,
  endTime: string | null | undefined
): Date {
  const started = now.getTime() >= startDateTime.getTime();
  const nowParts = getLocalDateInTimezone(now, timezone);
  const endParts = getLocalDateInTimezone(endDateTime, timezone);
  const endDayDiff = getCalendarDayDifference(nowParts, endParts);
  const ended = endDayDiff < 0 || (endDayDiff === 0 && !!endTime && now.getTime() >= endDateTime.getTime());
  const notYetEnded = !ended;
  return started && notYetEnded ? endDateTime : startDateTime;
}

export function computeEventCardDateBoxParts(
  locale: string,
  timezone: string | undefined,
  now: Date,
  startDateTime: Date,
  endDateTime: Date,
  endTime: string | null | undefined
): { month: string; day: string } {
  const targetDateTime = resolveEventCardDateBoxTarget(timezone, now, startDateTime, endDateTime, endTime);
  return {
    month: formatMonthAbbrev(locale, timezone, targetDateTime),
    day: formatDayNumber(locale, timezone, targetDateTime),
  };
}

/**
 * BUG-047 (VM1, masonry `prominentPoster=true`): the single-line date-box's text. Same shared
 * `resolveEventCardDateBoxTarget` resolution as `computeEventCardDateBoxParts` above (never a
 * second, divergent started/notYetEnded computation) — the two-tier box (VM2) needs `month`/`day`
 * as separate slots, but VM1's one-line chip needs one locale-correct "month day" phrase (the
 * part ORDER is locale-determined, e.g. day-before-month in some locales, which naively gluing
 * `computeEventCardDateBoxParts`'s two already-formatted strings together in a fixed order would
 * lose). No year, no time — mirrors `formatMonthAbbrev`/`formatDayNumber`'s own locale+timezone ->
 * locale-only -> 'en-US' fallback pattern.
 */
export function formatEventCardDateBoxLine(
  locale: string,
  timezone: string | undefined,
  now: Date,
  startDateTime: Date,
  endDateTime: Date,
  endTime: string | null | undefined
): string {
  const targetDateTime = resolveEventCardDateBoxTarget(timezone, now, startDateTime, endDateTime, endTime);
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(targetDateTime);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(targetDateTime);
    } catch {
      return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(targetDateTime);
    }
  }
}

/**
 * Computes the WeeklyCalendarView list-variant date box's structured `month`/`day`/`tillLabel`
 * content (Story 1.i1k AC4, rewritten by BUG-047/AC-DATE-3 to replace the till-repurposing "last/
 * only day" branch below). Same `started && notYetEnded` -> show-end-date rule as
 * `computeEventCardDateBoxParts` above, applied at day-string granularity:
 *  - `started` = `currentDayStr >= startDate`.
 *  - `notYetEnded` = `currentDayStr <= effectiveEnd` — **`<=`, not `<`** (user-confirmed
 *    2026-09-26): a multi-day event is still ongoing for its entire last calendar day, so the day
 *    the event ends must still resolve to "show the end date," unlike a continuous timestamp
 *    comparison (which has no meaningful equality case to widen for).
 * `month`/`day` are therefore ALWAYS real numeric digits now — no more till-label/time-string
 * overload. `tillLabel` is returned bare, unchanged, in every case -- it used to have the
 * formatted end time appended on a segment's last/only day (`computeCalendarSegmentTillText`,
 * removed 2026-09-27, user feedback): the status badge under the event name already shows that
 * exact information directly (`formatEventStatus`'s `"Ends {time}"` state, the calendar-row
 * mirror of the same masonry TILL-badge-vs-status-badge duplication fix), so appending it here
 * too was pure duplication ("don't show clock in the till box, we already have the endtime badge
 * under the event name").
 */
export function computeCalendarSegmentDateBoxContent(
  locale: string,
  timezone: string | undefined,
  currentDayStr: string,
  startDate: string,
  endDate: string | null | undefined,
  tillLabel: string
): { month: string; day: string; tillLabel: string } {
  const effectiveEnd = endDate ?? startDate;
  const started = currentDayStr >= startDate;
  const notYetEnded = currentDayStr <= effectiveEnd;
  const targetDate = started && notYetEnded ? effectiveEnd : startDate;
  const targetDateTime = combineDateTime(targetDate);

  return {
    month: formatMonthAbbrev(locale, timezone, targetDateTime),
    day: formatDayNumber(locale, timezone, targetDateTime),
    tillLabel,
  };
}


