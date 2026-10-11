"use client"

/** @jsxImportSource react */
// BUG-050 verification: a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- added only so packages/visual-audit's `react-component`
// RenderSpec (which mounts real components through Playwright's own test transform) resolves
// this file's JSX to React's runtime instead of Playwright's internal one. Same fix already
// applied to EventCardMediaPrimitives.tsx/count-badge.tsx for the identical reason -- see that
// file's header comment for the full root-cause writeup.
import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronLeft, ChevronRight, Heart, CalendarPlus } from 'lucide-react';
import {
  getDays,
  compareCalendarSchedules,
  layoutCalendarBands,
  navigateCalendarGrid,
  type CalendarPlacement,
} from '@festgrid/domain/events';
import { WeekPicker } from '../../core/WeekPicker';
import { useScopedLocale, useScopedTimezone, useHoverFocusTooltip, useInfiniteScroll } from '../../hooks';
import type {
  WeeklyCalendarViewProps,
  WeeklyCalendarViewScheduleShape,
} from './WeeklyCalendarView.types';
import { getWeekStart, getWeekEnd } from '../../hooks';
import {
  EventCardStatusBadge,
  formatNearbyBadgeDistance,
} from './EventCardMediaPrimitives';
import { EventCardCalendarGridItem } from './EventCardCalendarGridItem';
import { EventCardCompact } from './EventCardCompact';
import { computeCalendarSegmentDateBoxContent, formatEventStatus, type EventStatusLabels } from './format-event-date';

// Design system styles from DESIGN.md
const CALENDAR_BASE_CLASS = "border border-gray-200 rounded-lg";
const HEADER_CLASS = "flex flex-col gap-3 p-4 border-b border-gray-200 md:flex-row md:items-center md:justify-between";
const DATE_RANGE_CLASS = "text-lg font-semibold";
const NAV_BUTTON_CLASS = "inline-flex items-center justify-center min-h-11 min-w-11 py-1 px-3 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors md:min-h-0 md:min-w-0";
/** Mobile nav row: prev / picker / Today / next share the width evenly on narrow screens. */
const NAV_ROW_CLASS = "flex items-center justify-between gap-2 md:justify-start";
/**
 * Sticky day-header row (desktop) / day-tab strip (mobile). AD-33 Local tier: bare `z-10`, legal only
 * because each of the two wrappers that own it (`desktop-calendar-view` / `mobile-calendar-view`)
 * carries `isolate`, so the numeral never escapes into the page's stacking context and stays below
 * `z-chrome` (the nav rail). `isolate` is deliberately NOT on the component root, so nothing in
 * here can trap a future `fixed` overlay below chrome. Each desktop band is its own `isolate` grid.
 */
const STICKY_HEADER_CLASS = "sticky top-0 z-10";
const DAY_TAB_CLASS = "flex flex-col items-center justify-center min-h-11 py-1 text-xs font-medium border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset";
/**
 * Single source of truth for "a week has 7 days" — shared by `visibleDays`' construction loop and
 * `GridColumnGuides`' marker count (BUG-050 review finding: these were two independent hardcoded
 * `7`s pre-fix, which could silently desync if either one ever changed without the other).
 */
const DAYS_PER_WEEK = 7;
const GRID_WEEKLY_CLASS = "grid grid-cols-7 divide-x divide-gray-200";
/**
 * BUG-050 (AC-GRID-1) — the multi-day spanning-banner row's own container class, deliberately
 * NOT `GRID_WEEKLY_CLASS`: it keeps the same `grid grid-cols-7` equal-width column basis (so its
 * column-boundary x-positions stay pixel-identical to the day-header/day-cell rows above/below,
 * which both keep `GRID_WEEKLY_CLASS`'s `divide-x` unchanged), but drops `divide-x` because that
 * mechanism is structurally wrong for this one row — see `GridColumnGuides` below for why. Also
 * needs `relative isolate`: `relative` so `GridColumnGuides`' `absolute inset-0` overlay anchors to
 * this row, not some further-out ancestor; `isolate` (BUG-050 review finding) so this row forms its
 * own stacking context, making `GridColumnGuides`' `-z-10` guaranteed to paint behind every sibling
 * `<MultiDaySpanningBar>` regardless of DOM order — not contingent on those siblings (or their own
 * internal `SPANNING_BAR_CLICK_CLASS`/`SPANNING_BAR_VISUAL_CLASS` z-10/z-20 layers) never gaining an
 * explicit z-index of their own in a future change.
 */
const GRID_WEEKLY_CLASS_NO_DIVIDE = "grid grid-cols-7 relative isolate";
const DAY_CELL_CLASS = "p-2 h-32 flex flex-col gap-1 overflow-hidden relative";
const DAY_HEADER_CLASS = "text-sm text-center font-medium py-2 bg-gray-50 border-b border-gray-200";
const MORE_LINK_CLASS = "text-xs text-center text-violet-600 hover:underline cursor-pointer bg-transparent border-none p-0 w-full mt-auto block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 rounded";
const HOVER_TOOLTIP_CLASS = "absolute z-30 p-2 text-sm bg-gray-800 text-white rounded-md shadow-lg pointer-events-auto max-w-xs break-words";
/**
 * Story 1.i1g (AC12) — the spanning bar's full-card schedule-click target. It is a real
 * `<button>` (Enter/Space activation, `focus-visible` ring, single linear Tab stop), hidden
 * *underneath* the visual card layer (`z-10` vs. the layer's `z-20`) so the card layer paints
 * on top of it while mouse/touch events fall through to it — see `MultiDaySpanningBar`.
 */
const SPANNING_BAR_CLICK_CLASS = "absolute inset-0 z-10 w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
/**
 * Story 1.i1g (AC7) — the primitive's own visible chrome, kept in the DOM as a purely visual
 * (non-interactive) layer: `pointer-events-none` lets every pointer event fall through to the
 * click target underneath, while `[&_button]:pointer-events-auto` restores interactivity for
 * the primitive's internal favorite-toggle `<button>`, which therefore is never nested inside
 * the schedule-click element (same "non-interactive chrome + sibling interactive elements"
 * shape as Story 1.i1d's `variant='list'` restructure).
 */
// User feedback (2026-09-27, "the favorite icon should be clickable to toggle favorite"):
// `[&_button]:pointer-events-auto` promoted to `!pointer-events-auto` (Tailwind's important
// modifier) -- a defensive hardening so this override always wins regardless of any other rule
// (e.g. a future utility class added directly on the button, or specificity drift) that might
// otherwise re-suppress pointer events on the primitive's own favorite-toggle button.
const SPANNING_BAR_VISUAL_CLASS = "relative z-20 pointer-events-none [&_button]:!pointer-events-auto";
/**
 * Mobile selected-day list page size: the list reveals this many single-day/isolated occurrences at
 * a time (infinite scroll + a "Load more" button), then continues through the caller's day-scoped
 * query once the already-fetched ones are exhausted. This replaces Story 1.i1h's flat inline cap of
 * 20 + "+N more" dialog, which was unreachable on mobile: the week fetch's `perDayLimit` is also 20,
 * so the hidden count was always 0. Multi-day segments are paged like any other (they used to be
 * exempt, which let ~90 long-running schedules render at once).
 */
const MOBILE_PAGE_SIZE = 10;
/**
 * Desktop band size `K`: how many rows each column gains per page. A multi-day bar costs one slot in
 * every column it covers. Small on purpose so each page appends a screenful, not the whole week.
 */
const DESKTOP_BAND_SIZE = 6;

/**
 * Format range helper with graceful degradation for invalid timezone/locale.
 */
function formatWeekRange(
  locale: string,
  timezone: string | undefined,
  start: Date,
  end: Date
): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    }).formatRange(start, end);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, options).formatRange(start, end);
    } catch {
      return new Intl.DateTimeFormat('en-US', options).formatRange(start, end);
    }
  }
}

/**
 * Helper to normalize a date object to YYYY-MM-DD for reliable string comparisons.
 */
const toISODateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * "Today" as YYYY-MM-DD in the given IANA timezone (falls back to local
 * system time if no timezone is given or it's invalid) -- avoids comparing
 * dates against the wrong day boundary when the viewer's local timezone
 * differs from the calendar's active one.
 */
const getTodayISOInTimezone = (tz?: string): string => {
  if (!tz) return toISODateString(new Date());
  try {
    // en-CA formats as YYYY-MM-DD directly, avoiding manual part-parsing.
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return toISODateString(new Date());
  }
};

/**
 * Helper to calculate absolute days difference between two ISO-8601 date strings.
 */
const diffInDays = (startStr: string, endStr: string) => {
  const start = new Date(`${startStr}T12:00:00Z`);
  const end = new Date(`${endStr}T12:00:00Z`);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * BUG-050 (AC-GRID-1) — a fixed, content-independent overlay of the 7 day-column boundary lines,
 * used ONLY by the multi-day spanning-banner row (`GRID_WEEKLY_CLASS_NO_DIVIDE` above).
 *
 * Root cause this exists to fix: the day-header and day-cell rows correctly render their vertical
 * gridlines via Tailwind's `divide-x` (`GRID_WEEKLY_CLASS`), which draws borders through the
 * `> * + *` DOM-sibling-adjacency selector — correct there because both rows always render exactly
 * 7 real DOM children, 1:1 with the 7 visual columns, in left-to-right order. The spanning-banner
 * row breaks that assumption: it renders 0–7 `<MultiDaySpanningBar>` children (one per multi-day
 * schedule in the visible week), each explicitly placed into an arbitrary column via inline
 * `gridColumn`/`gridRow` CSS. `divide-x`'s selector borders DOM-order siblings, not visual grid
 * position, so its border landed on schedule-index boundaries — wrong whenever a schedule's DOM
 * order didn't match its column position, and simply absent at any column boundary with no
 * adjacent schedule pair there at all.
 *
 * Fix: render exactly `DAYS_PER_WEEK` empty, always-present marker elements — decoupled from
 * schedule count — and let THEM carry `divide-x`, inside an `absolute inset-0 -z-10` overlay
 * painted as this row's own background layer. `-z-10` (BUG-050 review finding) makes "behind the
 * real `<MultiDaySpanningBar>` cards" an explicit stacking guarantee rather than an implicit one
 * that happened to hold only because those cards have no z-index of their own yet — paired with
 * `GRID_WEEKLY_CLASS_NO_DIVIDE`'s `isolate` on the row container, this overlay is guaranteed
 * behind every sibling regardless of DOM order or any z-index a future change gives them. Sharing
 * the same `grid-cols-7` equal-width template as `GRID_WEEKLY_CLASS` guarantees the resulting
 * lines land pixel-identical to the header/day-cell rows' own boundaries (live-measured 0px delta
 * — see the committed `weekly-calendar-gridlines.spec.ts` proof in `packages/visual-audit`).
 * Wherever a spanning card's own body visually covers part of this overlay, only the boundaries
 * *within* that card's own column span are hidden — correct, since that card is one continuous
 * multi-day item there — while every boundary outside any card remains visible, restoring
 * AC-GRID-1's "continuous line, cards or not" requirement.
 */
function GridColumnGuides() {
  return (
    <div
      className="absolute inset-0 -z-10 grid grid-cols-7 divide-x divide-gray-200 pointer-events-none"
      aria-hidden="true"
      data-testid="grid-column-guides"
    >
      {Array.from({ length: DAYS_PER_WEEK }).map((_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}

/**
 * Format day header helper with graceful degradation.
 */
function formatDayHeader(
  locale: string,
  timezone: string | undefined,
  date: Date
): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' };
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-US', options).format(date);
    }
  }
}

/**
 * Short weekday + day-of-month parts for a day-tab button, with the same graceful degradation as
 * `formatDayHeader`.
 */
function formatDayTabParts(
  locale: string,
  timezone: string | undefined,
  date: Date
): { weekday: string; day: string } {
  const format = (opts: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { ...opts, ...(timezone ? { timeZone: timezone } : {}) }).format(date);
    } catch {
      try {
        return new Intl.DateTimeFormat(locale, opts).format(date);
      } catch {
        return new Intl.DateTimeFormat('en-US', opts).format(date);
      }
    }
  };
  return { weekday: format({ weekday: 'short' }), day: format({ day: 'numeric' }) };
}

/**
 * Format schedule tooltip range with graceful degradation.
 */
function formatTooltipTimeRange(
  locale: string,
  timezone: string | undefined,
  startDateStr: string,
  endDateStr: string | null | undefined,
  startTimeStr: string | null | undefined,
  endTimeStr: string | null | undefined
): string {
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };

  const parseDateTime = (dStr: string, tStr?: string | null): Date => {
    if (tStr) {
      // e.g. "2026-08-01T12:00:00" or similar
      const combined = dStr.includes('T') ? dStr : `${dStr}T${tStr}`;
      const d = new Date(combined);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(dStr);
  };

  const start = parseDateTime(startDateStr, startTimeStr);
  const end = endDateStr ? parseDateTime(endDateStr, endTimeStr) : start;

  try {
    const formattedDate = new Intl.DateTimeFormat(locale, {
      ...dateOptions,
      ...(timezone ? { timeZone: timezone } : {}),
    }).formatRange(start, end);

    if (startTimeStr) {
      const formattedStartTime = new Intl.DateTimeFormat(locale, {
        ...timeOptions,
        ...(timezone ? { timeZone: timezone } : {}),
      }).format(start);

      const formattedEndTime = endTimeStr
        ? new Intl.DateTimeFormat(locale, {
            ...timeOptions,
            ...(timezone ? { timeZone: timezone } : {}),
          }).format(end)
        : null;

      return `${formattedDate} (${formattedStartTime}${formattedEndTime ? ` - ${formattedEndTime}` : ''})`;
    }

    return formattedDate;
  } catch {
    return `${startDateStr} ${startTimeStr || ''}`.trim();
  }
}

interface Segment<TSchedule> {
  schedule: TSchedule;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  /**
   * Story 1.3k (AC5) — the occurrence RUN this segment belongs to, not the schedule's overall
   * `eventStartDate`/`eventEndDate` span. For a schedule with no `applicableDaysOfWeek` (legacy/
   * default), the run is the whole span, so these are byte-identical to
   * `schedule.eventStartDate`/`eventEndDate` — zero behavior change. For a day-of-week-narrowed
   * schedule, these are the specific run's (possibly 1-day) first/last occurrence day, which may
   * fall outside the range that's actually visible this week (AC5's week-boundary-straddling case).
   */
  runStartDate: string;
  runEndDate: string;
}

/**
 * One occurrence run of a schedule as it appears in the desktop grid: already clipped to the visible
 * week's columns. `spanCount > 1` renders as a spanning bar, `1` as a card.
 */
interface WeekEntry<TSchedule> {
  /** `${scheduleId}-${runStartDate}` — unique per run, stable across renders (placement is keyed by it). */
  key: string;
  schedule: TSchedule;
  runStartDate: string;
  runEndDate: string;
  /** 0-based first visible day-column the run occupies. */
  startCol: number;
  /** Number of visible day-columns the (clipped) run spans. */
  spanCount: number;
}

/**
 * The single calendar ordering applied to a run (start date, end date, start time, id) — the same
 * `compareCalendarSchedules` key the backend continuation query mirrors. Uses the RUN's own bounds
 * so a weekday-narrowed schedule sorts by the occurrence it is actually drawn for.
 */
function compareSegments(
  a: { schedule: WeeklyCalendarViewScheduleShape; runStartDate: string; runEndDate: string },
  b: { schedule: WeeklyCalendarViewScheduleShape; runStartDate: string; runEndDate: string }
): number {
  const toSortable = (x: typeof a) => ({
    id: String(x.schedule.id),
    eventStartDate: x.runStartDate,
    eventEndDate: x.runEndDate,
    eventStartTime: x.schedule.eventStartTime,
  });
  return compareCalendarSchedules(toSortable(a), toSortable(b));
}

/**
 * Story 1.3k (AC4/AC5) — one maximal run of calendar-adjacent occurrence days for a schedule.
 */
interface OccurrenceRun {
  start: string;
  end: string;
}

/**
 * Story 1.3k (AC4) — computes a schedule's occurrence runs once (shared by `dayBuckets`,
 * `spanningSchedules` and the mobile list's multi-day exemption), reusing the shared domain
 * `getDays` utility (AC1) rather than a second reimplementation of weekday matching in
 * `packages/ui`.
 *
 * A schedule with `applicableDaysOfWeek` unset/empty gets exactly ONE run — its whole
 * `[eventStartDate, eventEndDate]` span — matching today's behavior byte-for-byte (AC4's "zero
 * behavior change for legacy/default schedules" requirement). A day-of-week-narrowed schedule's
 * runs are computed against its FULL span (never clipped to the visible week first), so a run
 * that starts/continues outside the currently-displayed week is still correctly detected as
 * non-isolated at its week-boundary-straddling edge (AC5's "Week-boundary adjacency" note) —
 * clipping to columns actually on screen happens only afterward, in `spanningSchedules`/`dayBuckets`.
 */
function computeScheduleRuns(schedule: WeeklyCalendarViewScheduleShape): OccurrenceRun[] {
  const start = schedule.eventStartDate;
  const end = schedule.eventEndDate || start;

  if (!schedule.applicableDaysOfWeek || schedule.applicableDaysOfWeek.length === 0) {
    return [{ start, end }];
  }

  const occurrenceDays = getDays(start, end, schedule.applicableDaysOfWeek);
  if (occurrenceDays.length === 0) return [];

  const runs: OccurrenceRun[] = [];
  let runStart = occurrenceDays[0];
  let prev = occurrenceDays[0];
  for (let i = 1; i < occurrenceDays.length; i++) {
    const day = occurrenceDays[i];
    if (diffInDays(prev, day) === 1) {
      prev = day;
    } else {
      runs.push({ start: runStart, end: prev });
      runStart = day;
      prev = day;
    }
  }
  runs.push({ start: runStart, end: prev });
  return runs;
}

/**
 * Story 1.3k (AC4) — whether a SEGMENT belongs to a multi-day run (>= 2 occurrence days), not
 * whether its schedule's raw date span is multi-day. Replaces the old `isMultiDaySchedule`
 * predicate at every call site that decides per-segment/per-run behavior (the mobile inline-cap
 * exemption, list-variant multi-day styling); `isMultiDaySchedule` itself is kept for the one
 * remaining call site that genuinely needs the raw schedule-level predicate (`MultiDaySpanningBar`
 * composition, which is already per-run since `spanningSchedules` entries are per run).
 */
function isMultiDayRunSegment<TSchedule>(seg: Segment<TSchedule>): boolean {
  return seg.runStartDate !== seg.runEndDate;
}

/**
 * WeeklyCalendarView is a reusable, presentational calendar component.
 * It displays a weekly calendar grid, handles pagination events, displays schedule cards,
 * supports overflow "+N more" popovers, roving-tabindex accessibility, custom hover tooltips,
 * and handles skeleton loading/error status displays.
 */
export function WeeklyCalendarView<TSchedule extends WeeklyCalendarViewScheduleShape = WeeklyCalendarViewScheduleShape>({
  weekStart,
  schedules,
  getWeekRange,
  onToday,
  onPrevWeek,
  isPrevWeekDisabled = false,
  onNextWeek,
  onSelectWeek,
  onScheduleClick,
  onFavoriteToggle,
  status,
  errorMessage,
  errorDetail,
  locale,
  timezone,
  labels = {},
  nearbyBadgeThreshold,
  dayFetchLimit,
  dayContinuations,
  onDayContinuationRequested,
  resetKey,
  className = '',
}: WeeklyCalendarViewProps<TSchedule>) {
  // Provide default getWeekRange if not supplied
  const defaultGetWeekRange = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    const startIso = getWeekStart(iso);
    const endIso = getWeekEnd(startIso);
    const start = new Date(`${startIso}T12:00:00Z`);
    const end = new Date(`${endIso}T12:00:00Z`);
    return { start, end };
  };
  const effectiveGetWeekRange = getWeekRange ?? defaultGetWeekRange;
  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();

  const activeLocale = locale || contextLocale;
  const activeTimezone = timezone || contextTimezone;

  const defaultLabels = {
    prevWeekLabel: 'Previous week',
    nextWeekLabel: 'Next week',
    todayLabel: 'Today',
    selectWeekLabel: 'Select week',
    chooseWeekLabel: 'Choose a week',
    closePopoverLabel: 'Close details',
    loadingText: 'Loading calendar view...',
    favoritedBadgeLabel: 'Favorited',
    addedToCalendarBadgeLabel: 'Added to calendar',
    tillLabel: 'till',
    favoriteToggleLabel: 'Toggle favorite',
    statusEnded: 'Ended',
    statusHappeningNow: 'Now',
    statusEndsToday: 'Ends Today',
    statusEndsAt: 'Ends {time}',
    statusInHours: 'In {n} hour(s)',
    statusInDays: 'In {n} days',
    statusUpcoming: 'Upcoming',
    tomorrow: 'Tomorrow',
    dayTabsLabel: 'Days of the week',
    noSchedulesLabel: 'No schedules on this day',
    loadMoreLabel: 'Load more',
    loadingMoreLabel: 'Loading more…',
    ...labels,
    // BUG-049 review finding: set after the spread with `??`, not spread-after-default, so an
    // explicit `labels={{ nearbyBadge: undefined }}` still falls back to the formatter instead
    // of crashing `EventCardNearbyBadge` when it calls `defaultLabels.nearbyBadge(distanceKm)`.
    nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance,
    // Resolver labels fall back to English after the spread, so an explicit `undefined` still works.
    dayTotalLabel:
      labels.dayTotalLabel ?? ((count: number, hasMore: boolean) => `${count}${hasMore ? '+' : ''}`),
    belowLabel:
      labels.belowLabel ??
      ((count: number, hasMore: boolean) => (count > 0 ? `+${count}${hasMore ? '+' : ''} below` : '+ below')),
    progressLabel:
      labels.progressLabel ??
      ((shown: number, total: string) => `Showing ${shown} of ${total} schedules this week`),
    allShownLabel: labels.allShownLabel ?? ((total: number) => `All ${total} shown`),
  };
  // BUG-048 review finding: computed once and reused at all three `statusLabels` call sites
  // (spanning bar, grid cell, mobile list row) instead of re-literalling the same 7-key object
  // three times — a future label-key change now only needs to happen here.
  const statusLabels: EventStatusLabels = {
    statusEnded: defaultLabels.statusEnded,
    statusHappeningNow: defaultLabels.statusHappeningNow,
    statusEndsToday: defaultLabels.statusEndsToday,
    statusEndsAt: defaultLabels.statusEndsAt,
    statusInHours: defaultLabels.statusInHours,
    statusInDays: defaultLabels.statusInDays,
    statusUpcoming: defaultLabels.statusUpcoming,
    tomorrow: defaultLabels.tomorrow,
  };

  // 1. Compute the 7 visible days of the week from the caller-supplied weekStart.
  const visibleDays = useMemo(() => {
    const baseDate = typeof weekStart === 'string'
      ? new Date(`${weekStart}T12:00:00Z`)
      : new Date(weekStart);

    const days: Date[] = [];
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const nextDay = new Date(baseDate);
      nextDay.setUTCDate(baseDate.getUTCDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [weekStart]);

  // Continuation pages the caller fetched for truncated days (spec-calendar-unified-banded-grid):
  // merged into the week's schedules, deduped by id. Everything below derives from `allSchedules`.
  const allSchedules = useMemo(() => {
    if (!dayContinuations) return schedules;
    const seen = new Set(schedules.map((schedule) => String(schedule.id)));
    const merged = [...schedules];
    Object.values(dayContinuations).forEach((continuation) => {
      continuation.items.forEach((schedule) => {
        if (seen.has(String(schedule.id))) return;
        seen.add(String(schedule.id));
        merged.push(schedule);
      });
    });
    return merged;
  }, [schedules, dayContinuations]);

  // Story 1.3k (AC4) — each schedule's occurrence runs, computed ONCE (shared by `dayBuckets` and
  // `weekEntries`) via the shared `getDays` utility. Keyed by schedule id, not recomputed per week.
  const scheduleRunsById = useMemo(() => {
    const map = new Map<string, OccurrenceRun[]>();
    allSchedules.forEach((schedule) => {
      map.set(String(schedule.id), computeScheduleRuns(schedule));
    });
    return map;
  }, [allSchedules]);

  const weekStartStr = toISODateString(visibleDays[0]);
  const weekEndStr = toISODateString(visibleDays[6]);
  const dayISOs = useMemo(() => visibleDays.map(toISODateString), [visibleDays]);

  // Per-day segments (mobile list + per-day totals). Story 1.3k (AC4/AC5): iterates each schedule's
  // occurrence RUNS, so a schedule with no `applicableDaysOfWeek` has exactly one run (its span).
  const dayBuckets = useMemo(() => {
    const buckets: Segment<TSchedule>[][] = Array.from({ length: DAYS_PER_WEEK }, () => []);

    allSchedules.forEach((schedule) => {
      const runs = scheduleRunsById.get(String(schedule.id)) ?? [];
      runs.forEach((run) => {
        if (run.start <= weekEndStr && run.end >= weekStartStr) {
          dayISOs.forEach((dayISO, idx) => {
            if (dayISO >= run.start && dayISO <= run.end) {
              buckets[idx].push({
                schedule,
                isFirstSegment: dayISO === run.start,
                isLastSegment: dayISO === run.end,
                runStartDate: run.start,
                runEndDate: run.end,
              });
            }
          });
        }
      });
    });

    buckets.forEach((bucket) => bucket.sort(compareSegments));
    return buckets;
  }, [allSchedules, dayISOs, scheduleRunsById, weekStartStr, weekEndStr]);

  // Desktop: every occurrence run visible this week as ONE entry covering `spanCount` columns
  // (clipped to the week). One entry per run, in the single calendar ordering. A run with a single
  // visible day renders as a card, with several as a spanning bar.
  const weekEntries = useMemo(() => {
    const entries: WeekEntry<TSchedule>[] = [];
    allSchedules.forEach((schedule) => {
      const runs = scheduleRunsById.get(String(schedule.id)) ?? [];
      runs.forEach((run) => {
        if (run.start > weekEndStr || run.end < weekStartStr) return;
        const clippedStart = run.start < weekStartStr ? weekStartStr : run.start;
        const clippedEnd = run.end > weekEndStr ? weekEndStr : run.end;
        const startCol = Math.max(0, diffInDays(weekStartStr, clippedStart));
        const endCol = Math.min(DAYS_PER_WEEK - 1, diffInDays(weekStartStr, clippedEnd));
        entries.push({
          key: `${schedule.id}-${run.start}`,
          schedule,
          runStartDate: run.start,
          runEndDate: run.end,
          startCol,
          spanCount: endCol - startCol + 1,
        });
      });
    });
    entries.sort((a, b) => compareSegments(a, b) || a.key.localeCompare(b.key));
    return entries;
  }, [allSchedules, scheduleRunsById, weekStartStr, weekEndStr]);

  // Reset token: a new week or a new filter set starts the layout (and paging) over.
  const resetToken = `${weekStartStr}|${resetKey ?? ''}`;

  // Append-only banded placement. Placements are remembered per resetToken so that rows arriving
  // later (continuation pages) can only ever land below what is already on screen.
  const placementsRef = useRef<{ token: string; map: Map<string, CalendarPlacement> }>({
    token: '',
    map: new Map(),
  });
  const placements = useMemo(() => {
    const previous = placementsRef.current.token === resetToken ? placementsRef.current.map : undefined;
    const next = layoutCalendarBands(
      weekEntries.map((entry) => ({ key: entry.key, startCol: entry.startCol, spanCount: entry.spanCount })),
      DESKTOP_BAND_SIZE,
      DAYS_PER_WEEK,
      previous
    );
    placementsRef.current = { token: resetToken, map: next };
    return next;
  }, [weekEntries, resetToken]);

  const bandNumbers = useMemo(
    () => Array.from(new Set(Array.from(placements.values(), (p) => p.band))).sort((a, b) => a - b),
    [placements]
  );
  const [bandPage, setBandPage] = useState<{ token: string; count: number } | null>(null);
  const revealedBandCount = bandPage?.token === resetToken ? bandPage.count : 1;
  const revealedBandSet = useMemo(
    () => new Set(bandNumbers.slice(0, revealedBandCount)),
    [bandNumbers, revealedBandCount]
  );
  const hasHiddenBands = bandNumbers.length > revealedBandCount;

  const visibleBands = useMemo(() => {
    const byBand = new Map<number, { entry: WeekEntry<TSchedule>; placement: CalendarPlacement }[]>();
    weekEntries.forEach((entry) => {
      const placement = placements.get(entry.key);
      if (!placement || !revealedBandSet.has(placement.band)) return;
      const list = byBand.get(placement.band) ?? [];
      list.push({ entry, placement });
      byBand.set(placement.band, list);
    });
    // DOM order follows the visual order (row, then column) so reading and focus order match the grid.
    return bandNumbers
      .filter((b) => revealedBandSet.has(b))
      .map((band) => ({
        band,
        items: (byBand.get(band) ?? []).sort(
          (x, y) => x.placement.row - y.placement.row || x.entry.startCol - y.entry.startCol
        ),
      }));
  }, [weekEntries, placements, revealedBandSet, bandNumbers]);

  // Per-column totals: everything loaded vs. what the revealed bands actually render.
  const totalPerDay = useMemo(() => {
    const counts: number[] = Array.from({ length: DAYS_PER_WEEK }, () => 0);
    weekEntries.forEach((entry) => {
      for (let c = entry.startCol; c < entry.startCol + entry.spanCount; c++) counts[c] += 1;
    });
    return counts;
  }, [weekEntries]);
  const countRendered = (revealCount: number) => {
    const allowed = new Set(bandNumbers.slice(0, revealCount));
    const counts: number[] = Array.from({ length: DAYS_PER_WEEK }, () => 0);
    weekEntries.forEach((entry) => {
      const placement = placements.get(entry.key);
      if (!placement || !allowed.has(placement.band)) return;
      for (let c = entry.startCol; c < entry.startCol + entry.spanCount; c++) counts[c] += 1;
    });
    return counts;
  };
  const renderedPerDay = countRendered(revealedBandCount);

  // Continuation bookkeeping: which truncated days the caller was already asked to continue.
  const [requested, setRequested] = useState<{ token: string; days: string[] }>({ token: '', days: [] });
  const requestedDays = requested.token === resetToken ? requested.days : [];
  const anyContinuationFetching = Object.values(dayContinuations ?? {}).some((c) => c.isFetchingNextPage);

  /** A day may have more rows on the server when it filled the week fetch's per-day window. */
  const dayMayHaveMore = (dayIdx: number): boolean => {
    if (dayFetchLimit === undefined) return false;
    const dayISO = dayISOs[dayIdx];
    if (requestedDays.includes(dayISO)) {
      const continuation = dayContinuations?.[dayISO];
      return continuation ? continuation.hasNextPage : true;
    }
    const startingToday = (dayBuckets[dayIdx] ?? []).filter(
      (seg) =>
        seg.schedule.eventStartDate === dayISO &&
        (!seg.schedule.eventEndDate || seg.schedule.eventEndDate === dayISO)
    ).length;
    return startingToday >= dayFetchLimit;
  };
  const fetchMoreForDay = (dayIdx: number) => {
    const dayISO = dayISOs[dayIdx];
    if (!requestedDays.includes(dayISO)) {
      // Functional update: several truncated days can be requested in one tick.
      setRequested((prev) => {
        const days = prev.token === resetToken ? prev.days : [];
        return days.includes(dayISO) ? prev : { token: resetToken, days: [...days, dayISO] };
      });
      onDayContinuationRequested?.(dayISO);
      return;
    }
    const continuation = dayContinuations?.[dayISO];
    if (continuation && continuation.hasNextPage && !continuation.isFetchingNextPage) {
      void continuation.fetchNextPage();
    }
  };
  const anyDayMayHaveMore = dayISOs.some((_, idx) => dayMayHaveMore(idx));
  const canLoadMoreBands = hasHiddenBands || anyDayMayHaveMore;

  const loadMoreBands = () => {
    const nextCount = hasHiddenBands ? revealedBandCount + 1 : revealedBandCount;
    if (hasHiddenBands) setBandPage({ token: resetToken, count: nextCount });
    // Prefetch a truncated day's next page once at most one band of its loaded rows is left unrendered.
    const rendered = countRendered(nextCount);
    dayISOs.forEach((_, idx) => {
      if (dayMayHaveMore(idx) && totalPerDay[idx] - rendered[idx] <= DESKTOP_BAND_SIZE) fetchMoreForDay(idx);
    });
  };
  const { sentinelRef: bandSentinelRef } = useInfiniteScroll({
    fetchNextPage: loadMoreBands,
    hasNextPage: canLoadMoreBands,
    isFetchingNextPage: anyContinuationFetching,
  });

  const shownScheduleCount = useMemo(
    () => new Set(visibleBands.flatMap((band) => band.items.map(({ entry }) => String(entry.schedule.id)))).size,
    [visibleBands]
  );
  const totalScheduleCount = useMemo(
    () => new Set(weekEntries.map((entry) => String(entry.schedule.id))).size,
    [weekEntries]
  );

  // Roving tabindex over the banded grid, keyed by entry key (not a day/card index).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const navItems = useMemo(
    () =>
      visibleBands.flatMap((band) =>
        band.items.map(({ entry, placement }) => ({
          key: entry.key,
          band: placement.band,
          row: placement.row,
          startCol: entry.startCol,
          spanCount: entry.spanCount,
        }))
      ),
    [visibleBands]
  );
  const firstNavKey = useMemo(() => {
    if (navItems.length === 0) return null;
    return [...navItems].sort((a, b) => a.band - b.band || a.row - b.row || a.startCol - b.startCol)[0].key;
  }, [navItems]);
  const effectiveActiveKey =
    activeKey !== null && navItems.some((item) => item.key === activeKey) ? activeKey : firstNavKey;

  const handleGridKeyDown = (e: React.KeyboardEvent, key: string) => {
    const direction =
      e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : null;
    if (!direction) return;
    e.preventDefault();
    const target = navigateCalendarGrid(navItems, key, direction);
    if (!target) return;
    setActiveKey(target);
    // Do synchronously so focus works immediately and reliably in tests/render
    document.getElementById(`calendar-card-${target}`)?.focus();
  };

  const todayISO = getTodayISOInTimezone(activeTimezone);
  const mobileDayContentIdPrefix = useId();

  // Mobile day-tab selection. Purely local: switching tabs only filters the already-fetched week
  // (`dayBuckets`), it never navigates or refetches. The selection is stored together with the week
  // it was made in, so a `weekStart` change (next/prev/Today/picker) falls back to the default —
  // today if it is in the visible week, else the first day — with no effect/extra render.
  const weekKey = weekStartStr;
  const defaultDayIdx = Math.max(
    0,
    dayISOs.findIndex((d) => d === todayISO)
  );
  const [daySelection, setDaySelection] = useState<{ weekKey: string; idx: number } | null>(null);
  const selectedDayIdx = daySelection?.weekKey === weekKey ? daySelection.idx : defaultDayIdx;
  const dayTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Mobile selected-day pagination. Local paging reveals `MOBILE_PAGE_SIZE` more of the schedules the
  // week fetch already returned; once those are exhausted and the day hit the fetch's per-day budget,
  // the caller's day-scoped continuation supplies the rest page by page (same sort key as desktop).
  const selectedDayISO = dayISOs[selectedDayIdx];
  const [pageState, setPageState] = useState<{ dayISO: string; count: number } | null>(null);
  const mobileVisibleCount = pageState?.dayISO === selectedDayISO ? pageState.count : MOBILE_PAGE_SIZE;
  const mobileDaySegments = dayBuckets[selectedDayIdx] ?? [];
  const hasMoreLocal = mobileDaySegments.length > mobileVisibleCount;
  const mobileDayMayHaveMore = dayMayHaveMore(selectedDayIdx);
  const mobileCanLoadMore = hasMoreLocal || mobileDayMayHaveMore;
  const mobileIsFetchingMore = dayContinuations?.[selectedDayISO]?.isFetchingNextPage ?? false;

  const loadMoreMobileDay = () => {
    // Reveal already-fetched rows first; only go to the server once none are left to show.
    if (hasMoreLocal) {
      setPageState({ dayISO: selectedDayISO, count: mobileVisibleCount + MOBILE_PAGE_SIZE });
      return;
    }
    if (!mobileDayMayHaveMore || mobileIsFetchingMore) return;
    fetchMoreForDay(selectedDayIdx);
    // Rows arriving from the server are revealed as soon as they land.
    setPageState({ dayISO: selectedDayISO, count: mobileVisibleCount + MOBILE_PAGE_SIZE });
  };
  const { sentinelRef: mobileSentinelRef } = useInfiniteScroll({
    fetchNextPage: loadMoreMobileDay,
    hasNextPage: mobileCanLoadMore,
    isFetchingNextPage: mobileIsFetchingMore,
  });

  const handleDayTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let target: number | null = null;
    if (e.key === 'ArrowRight') target = (idx + 1) % DAYS_PER_WEEK;
    else if (e.key === 'ArrowLeft') target = (idx + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = DAYS_PER_WEEK - 1;
    if (target === null) return;
    e.preventDefault();
    setDaySelection({ weekKey, idx: target });
    dayTabRefs.current[target]?.focus();
  };

  // Loading Skeleton State (AC11)
  if (status === 'loading') {
    return (
      <div className={`${CALENDAR_BASE_CLASS} ${className} animate-pulse`} aria-busy="true" aria-label={defaultLabels.loadingText}>
        <div className={HEADER_CLASS}>
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-10 bg-gray-200 rounded" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
            <div className="h-8 w-10 bg-gray-200 rounded" />
          </div>
        </div>
        {/* Desktop Skeleton */}
        <div className={`${GRID_WEEKLY_CLASS} hidden md:grid`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="h-10 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                <div className="h-4 w-12 bg-gray-200 rounded" />
              </div>
              <div className={`${DAY_CELL_CLASS} bg-white`}>
                <div className="h-6 w-full bg-gray-200 rounded mt-1" />
                <div className="h-6 w-full bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
        {/* Mobile Skeleton */}
        <div className="flex flex-col divide-y divide-gray-200 md:hidden p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 py-3">
              <div className="h-4 w-24 bg-gray-200 rounded px-1 mb-2" />
              <div className="flex flex-col gap-2 px-1">
                <div className="h-12 w-full bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State (AC11)
  if (status === 'error') {
    return (
      <div className={`${CALENDAR_BASE_CLASS} p-6 bg-destructive/5 text-destructive border-destructive/20 ${className}`}>
        <h3 className="text-lg font-bold mb-2">Error loading calendar events</h3>
        <p className="text-sm font-medium mb-1">{errorMessage || 'An unexpected error occurred.'}</p>
        {errorDetail && (
          <pre className="mt-2 p-3 text-xs bg-black/5 rounded overflow-x-auto whitespace-pre-wrap font-mono">
            {errorDetail}
          </pre>
        )}
      </div>
    );
  }

  // Format header range
  const dateRangeText = formatWeekRange(activeLocale, activeTimezone, visibleDays[0], visibleDays[6]);

  return (
    <div className={`${CALENDAR_BASE_CLASS} ${className}`}>
      {/* Header Controls */}
      <div className={HEADER_CLASS}>
        <span className={DATE_RANGE_CLASS}>{dateRangeText}</span>
        <div className={NAV_ROW_CLASS}>
          <button
            type="button"
            className={`${NAV_BUTTON_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100`}
            onClick={onPrevWeek}
            disabled={isPrevWeekDisabled}
            aria-label={defaultLabels.prevWeekLabel}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {onSelectWeek && (
            <WeekPicker
              selectedDate={typeof weekStart === 'string' ? weekStart : new Date(weekStart).toISOString().slice(0, 10)}
              onSelectWeek={onSelectWeek}
              getWeekRange={effectiveGetWeekRange}
              buttonLabel={defaultLabels.selectWeekLabel}
              ariaLabel={defaultLabels.selectWeekLabel}
            />
          )}
          <button
            type="button"
            className={NAV_BUTTON_CLASS}
            onClick={onToday}
            aria-label={defaultLabels.todayLabel}
          >
            {defaultLabels.todayLabel}
          </button>
          <button
            type="button"
            className={NAV_BUTTON_CLASS}
            onClick={onNextWeek}
            aria-label={defaultLabels.nextWeekLabel}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block isolate" data-testid="desktop-calendar-view">
        {/* Day Headers (sticky): per-day total + "+N below" while the day still has unrendered rows */}
        <div className={`${GRID_WEEKLY_CLASS} ${STICKY_HEADER_CLASS} bg-gray-50`} data-testid="desktop-day-headers">
          {visibleDays.map((day, idx) => {
            const headerStr = formatDayHeader(activeLocale, activeTimezone, day);
            const mayHaveMore = dayMayHaveMore(idx);
            const below = Math.max(0, totalPerDay[idx] - renderedPerDay[idx]);
            return (
              <div key={idx} className={DAY_HEADER_CLASS} data-testid="desktop-day-header">
                <span>{headerStr}</span>
                <span className="ml-1 text-xs text-gray-500" data-testid="desktop-day-total">
                  {defaultLabels.dayTotalLabel(totalPerDay[idx], mayHaveMore)}
                </span>
                {(below > 0 || mayHaveMore) && (
                  <span className="block text-xs font-normal text-violet-600" data-testid="desktop-day-below">
                    {defaultLabels.belowLabel(below, mayHaveMore)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Unified banded grid: multi-day bars span the columns they cover, single-day cards take
            one column. Each band is its own 7-column grid, so packing never reaches into an earlier
            band. `overflow-anchor: none` keeps appended bands from shifting the scroll position. */}
        <div className="[overflow-anchor:none] [&_*]:[overflow-anchor:none]" data-testid="calendar-bands">
          {weekEntries.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8" data-testid="calendar-empty">
              {defaultLabels.noSchedulesLabel}
            </p>
          )}
          {visibleBands.map(({ band, items }) => (
            <div
              key={band}
              className={`${GRID_WEEKLY_CLASS_NO_DIVIDE} bg-white border-b border-gray-100 items-start`}
              data-testid="calendar-band"
              data-band={band}
            >
              <GridColumnGuides />
              {items.map(({ entry, placement }) => (
                <div
                  key={entry.key}
                  className="relative min-w-0 p-1"
                  style={{
                    gridColumn: `${entry.startCol + 1} / span ${entry.spanCount}`,
                    gridRow: `${placement.row + 1}`,
                  }}
                >
                  {entry.spanCount > 1 ? (
                    <MultiDaySpanningBar
                      schedule={entry.schedule}
                      cardId={`calendar-card-${entry.key}`}
                      isRovingActive={effectiveActiveKey === entry.key}
                      onKeyDown={(e) => handleGridKeyDown(e, entry.key)}
                      onFocus={() => setActiveKey(entry.key)}
                      runStartDate={entry.runStartDate}
                      runEndDate={entry.runEndDate}
                      locale={activeLocale}
                      timezone={activeTimezone}
                      onScheduleClick={onScheduleClick}
                      onFavoriteToggle={onFavoriteToggle}
                      favoriteToggleLabel={defaultLabels.favoriteToggleLabel}
                      nearbyBadgeThreshold={nearbyBadgeThreshold}
                      statusLabels={statusLabels}
                      dayOfWeekLabels={labels.dayOfWeekLabels}
                      repeatBadgeAriaLabel={labels.repeatBadgeAriaLabel}
                      addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                    />
                  ) : (
                    <CalendarCard
                      segment={{
                        schedule: entry.schedule,
                        isFirstSegment: dayISOs[entry.startCol] === entry.runStartDate,
                        isLastSegment: dayISOs[entry.startCol] === entry.runEndDate,
                        runStartDate: entry.runStartDate,
                        runEndDate: entry.runEndDate,
                      }}
                      dayIdx={entry.startCol}
                      cardId={`calendar-card-${entry.key}`}
                      isRovingActive={effectiveActiveKey === entry.key}
                      locale={activeLocale}
                      timezone={activeTimezone}
                      onScheduleClick={onScheduleClick}
                      onFavoriteToggle={onFavoriteToggle}
                      favoriteToggleLabel={defaultLabels.favoriteToggleLabel}
                      tillLabel={defaultLabels.tillLabel}
                      onKeyDown={(e) => handleGridKeyDown(e, entry.key)}
                      onFocus={() => setActiveKey(entry.key)}
                      favoritedBadgeLabel={defaultLabels.favoritedBadgeLabel}
                      addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                      nearbyBadgeLabel={defaultLabels.nearbyBadge}
                      nearbyBadgeThreshold={nearbyBadgeThreshold}
                      statusLabels={statusLabels}
                      dayOfWeekLabels={labels.dayOfWeekLabels}
                      repeatBadgeAriaLabel={labels.repeatBadgeAriaLabel}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Progress line + infinite-scroll sentinel + explicit "Show more" fallback. Both controls
            disappear once everything (including every truncated day's server rows) is loaded. */}
        {weekEntries.length > 0 && (
          <div className="flex flex-col items-center gap-2 py-3 [overflow-anchor:none]" data-testid="calendar-bands-footer">
            <p className="text-xs text-gray-500" aria-live="polite" data-testid="calendar-progress">
              {canLoadMoreBands
                ? defaultLabels.progressLabel(shownScheduleCount, `${totalScheduleCount}${anyDayMayHaveMore ? '+' : ''}`)
                : defaultLabels.allShownLabel(totalScheduleCount)}
            </p>
            {canLoadMoreBands && (
              <div ref={bandSentinelRef} className="flex justify-center" data-testid="calendar-load-more-sentinel">
                <button
                  type="button"
                  data-testid="calendar-show-more"
                  className={MORE_LINK_CLASS}
                  onClick={loadMoreBands}
                  disabled={anyContinuationFetching}
                >
                  {anyContinuationFetching ? defaultLabels.loadingMoreLabel : defaultLabels.loadMoreLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile day tabs + selected-day list (AC15). The tab strip mirrors the desktop header's
          7 equal columns; selecting a tab only filters the already-fetched week. */}
      <div className="md:hidden isolate" data-testid="mobile-calendar-view">
        <div
          role="tablist"
          aria-label={defaultLabels.dayTabsLabel}
          data-testid="mobile-day-tabs"
          className={`${GRID_WEEKLY_CLASS} ${STICKY_HEADER_CLASS} bg-gray-50 border-b border-gray-200`}
        >
          {visibleDays.map((day, idx) => {
            const dateISO = dayISOs[idx];
            const isSelected = idx === selectedDayIdx;
            const isToday = dateISO === todayISO;
            const { weekday, day: dayNum } = formatDayTabParts(activeLocale, activeTimezone, day);
            const dayCountText = defaultLabels.dayTotalLabel(dayBuckets[idx].length, dayMayHaveMore(idx));
            return (
              <button
                key={dateISO}
                type="button"
                role="tab"
                id={`${mobileDayContentIdPrefix}-mobile-day-tab-${idx}`}
                data-testid="mobile-day-tab"
                data-today={isToday ? 'true' : undefined}
                aria-selected={isSelected}
                aria-controls={`${mobileDayContentIdPrefix}-mobile-day-content`}
                aria-label={`${formatDayHeader(activeLocale, activeTimezone, day)} (${dayCountText})`}
                tabIndex={isSelected ? 0 : -1}
                ref={(el) => {
                  dayTabRefs.current[idx] = el;
                }}
                onClick={() => setDaySelection({ weekKey, idx })}
                onKeyDown={(e) => handleDayTabKeyDown(e, idx)}
                className={`${DAY_TAB_CLASS} ${
                  isSelected
                    ? 'border-violet-600 text-violet-700 bg-white'
                    : 'border-transparent text-gray-600'
                }`}
              >
                <span aria-hidden="true">{weekday}</span>
                <span
                  aria-hidden="true"
                  className={`text-sm ${isToday ? 'font-bold underline underline-offset-2' : ''}`}
                >
                  {dayNum}
                </span>
                <span aria-hidden="true" className="text-[10px] font-normal text-gray-500" data-testid="mobile-day-count">
                  {dayCountText}
                </span>
              </button>
            );
          })}
        </div>
        {(() => {
          const dayIdx = selectedDayIdx;
          const dateISO = dayISOs[dayIdx];

          // Every segment (single- and multi-day) is paged: the day shows `mobileVisibleCount` rows.
          const mobileVisibleSegments = mobileDaySegments.slice(0, mobileVisibleCount);

          return (
            <div
              role="tabpanel"
              id={`${mobileDayContentIdPrefix}-mobile-day-content`}
              aria-labelledby={`${mobileDayContentIdPrefix}-mobile-day-tab-${dayIdx}`}
              className="flex flex-col gap-2 p-4"
              data-testid="mobile-day-row"
            >
              {mobileDaySegments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6" data-testid="mobile-day-empty">
                  {defaultLabels.noSchedulesLabel}
                </p>
              )}
              {mobileVisibleSegments.map((seg) => (
                <CalendarCard
                  key={`${seg.schedule.id}-${seg.runStartDate}`}
                  segment={seg}
                  dayIdx={dayIdx}
                  isRovingActive={false}
                  locale={activeLocale}
                  timezone={activeTimezone}
                  onScheduleClick={onScheduleClick}
                  onFavoriteToggle={onFavoriteToggle}
                  favoriteToggleLabel={defaultLabels.favoriteToggleLabel}
                  tillLabel={defaultLabels.tillLabel}
                  variant="list"
                  currentDayStr={dateISO}
                  favoritedBadgeLabel={defaultLabels.favoritedBadgeLabel}
                  addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                  statusLabels={statusLabels}
                  nearbyBadgeLabel={defaultLabels.nearbyBadge}
                  nearbyBadgeThreshold={nearbyBadgeThreshold}
                  dayOfWeekLabels={labels.dayOfWeekLabels}
                  repeatBadgeAriaLabel={labels.repeatBadgeAriaLabel}
                />
              ))}

              {/* Infinite-scroll sentinel + explicit fallback button for the selected day's list. */}
              {mobileCanLoadMore && (
                <div ref={mobileSentinelRef} className="flex justify-center py-2" data-testid="mobile-day-load-more">
                  <button
                    type="button"
                    className={MORE_LINK_CLASS}
                    onClick={loadMoreMobileDay}
                    disabled={mobileIsFetchingMore}
                  >
                    {mobileIsFetchingMore ? defaultLabels.loadingMoreLabel : defaultLabels.loadMoreLabel}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

interface CalendarCardProps<TSchedule> {
  segment: Segment<TSchedule>;
  dayIdx: number;
  /** DOM id of the grid card's click target (roving-tabindex focus target); omitted for the mobile list variant. */
  cardId?: string;
  isRovingActive: boolean;
  locale: string;
  timezone: string | undefined;
  onScheduleClick: (schedule: TSchedule) => void;
  onFavoriteToggle?: (schedule: TSchedule) => void;
  favoriteToggleLabel?: string;
  tillLabel?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  favoritedBadgeLabel?: string;
  addedToCalendarBadgeLabel?: string;
  variant?: 'grid' | 'list';
  currentDayStr?: string;
  /**
   * Status badge labels (AC1/AC6), forwarded verbatim to `formatEventStatus`. Used by the
   * `list` variant only -- BUG-048 briefly threaded this through to `EventCardCalendarGridItem`
   * for the `grid` variant's single-day cells too, but that status badge was removed again
   * (2026-09-27, user feedback: "don't show the now/ending_at badge"), so the `grid` variant no
   * longer consumes this at all.
   */
  statusLabels?: EventStatusLabels;
  /**
   * `list`-variant nearby badge text (AC3/AC6). Resolver FUNCTION, not a static string
   * (BUG-049, AC-NEARBY-1/2/3) — defaults to `formatNearbyBadgeDistance` inside
   * `EventCardNearbyBadge` when omitted.
   */
  nearbyBadgeLabel?: (distanceKm: number) => string;
  /** `list`-variant nearby badge distance threshold (km), forwarded to `EventCardNearbyBadge` (AC3). Defaults to `8`. */
  nearbyBadgeThreshold?: number;
  /** Story 1.3k (AC9) — translated weekday labels for the repeat badge, keyed by `DayOfWeek` enum member name. */
  dayOfWeekLabels?: Record<string, string>;
  /** Story 1.3k (AC6/AC7) — repeat badge aria-label/tooltip text resolver. */
  repeatBadgeAriaLabel?: (dayLabels: string[]) => string;
}

/**
 * Co-located subcomponent for rendering a compact calendar card, with its inline hover+focus tooltip.
 */
function CalendarCard<TSchedule extends WeeklyCalendarViewScheduleShape>({
  segment,
  dayIdx,
  cardId,
  isRovingActive,
  locale,
  timezone,
  onScheduleClick,
  onFavoriteToggle,
  favoriteToggleLabel,
  tillLabel,
  onKeyDown,
  onFocus,
  favoritedBadgeLabel,
  addedToCalendarBadgeLabel,
  variant = 'grid',
  currentDayStr,
  statusLabels,
  nearbyBadgeLabel,
  nearbyBadgeThreshold,
  dayOfWeekLabels,
  repeatBadgeAriaLabel,
}: CalendarCardProps<TSchedule>) {
  const { schedule } = segment;

  // Story 1.3k Task 4 (AC11) — the hover+focus+Escape-dismiss interaction state, now the shared
  // `useHoverFocusTooltip` hook instead of this component's own hand-rolled copy. `enabled: true`
  // unconditionally: the time-range tooltip stays gated to `variant === 'grid'` in the render
  // condition below (unchanged), but the SAME hover/focus state also drives the repeat badge's
  // tooltip in BOTH variants (AC6/AC7) — one physical interaction (hovering/focusing the card),
  // different pieces of UI shown depending on variant.
  const { isVisible: interactionVisible, handlers: tooltipHandlers } = useHoverFocusTooltip({
    enabled: true,
  });

  const tooltipVisible = variant === 'grid' && interactionVisible;

  const tooltipText = useMemo(() => {
    // Story 1.3k (AC5) — the run's own bounds, never the schedule's overall span.
    return formatTooltipTimeRange(
      locale,
      timezone,
      segment.runStartDate,
      segment.runEndDate,
      schedule.eventStartTime,
      schedule.eventEndTime
    );
  }, [locale, timezone, segment.runStartDate, segment.runEndDate, schedule]);

  // Grid variant additionally needs the roving-tabindex `onFocus` callback and the arrow-key
  // `onKeyDown` forwarding the hook itself knows nothing about — composed on top of the hook's
  // own handlers rather than duplicating the hover/focus/dismiss state a second time.
  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    tooltipHandlers.onFocus(e);
    if (variant === 'grid') {
      onFocus?.();
    }
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent<HTMLElement>) => {
    tooltipHandlers.onKeyDown(e);
    if (variant === 'grid') {
      onKeyDown?.(e);
    }
  };


  // Story 3.6ua (AC1) — the `variant === 'list'` (Mobile Vertical Day List) render path now
  // delegates to the standalone, exported `EventCardCompact` primitive (`packages/ui`'s own
  // `./EventCardCompact`), extracted verbatim from what used to be this branch's inline JSX.
  // `CalendarCard` still owns every calendar-specific computation `EventCardCompact` doesn't
  // know about (the date-box content via the existing, unchanged
  // `computeCalendarSegmentDateBoxContent`, and the multi-day-run flag via the existing,
  // unchanged `isMultiDayRunSegment`), then passes the already-resolved, flattened values
  // through. Zero behavior change versus the pre-extraction branch (AC1/AC5) — the delegation
  // passes through the exact same data this component already computed today. The
  // `variant === 'grid'` path below is deliberately untouched (AC1).
  if (variant === 'list') {
    // Story 1.3k (AC5) — the run's own first/last occurrence day, never the schedule's overall
    // span; byte-identical to the pre-1.3k call for a legacy schedule (one run = the whole span).
    const dateBoxContent = computeCalendarSegmentDateBoxContent(
      locale,
      timezone,
      currentDayStr || '',
      segment.runStartDate,
      segment.runEndDate,
      tillLabel || 'till'
    );

    // Story 1.3k (AC4) — per-RUN, not the schedule's raw date span (a day-of-week schedule's
    // overall span can be multi-day while this specific segment's run is 1-day, and vice versa).
    const isMultiDayRun = isMultiDayRunSegment(segment);

    return (
      <EventCardCompact
        eventName={schedule.eventName}
        isMainSchedule={schedule.isMainSchedule}
        locationName={schedule.locationName}
        dateBoxMonth={dateBoxContent.month}
        dateBoxDay={dateBoxContent.day}
        dateBoxTillLabel={dateBoxContent.tillLabel}
        isMultiDayRun={isMultiDayRun}
        eventStartDate={schedule.eventStartDate}
        eventStartTime={schedule.eventStartTime}
        eventEndDate={schedule.eventEndDate}
        eventEndTime={schedule.eventEndTime}
        statusLabels={statusLabels}
        imageUrl={schedule.imageUrl}
        imageFallbackUrl={schedule.imageFallbackUrl}
        isFavorited={schedule.isFavorited}
        favoriteCount={schedule.favoriteCount}
        onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(schedule) : undefined}
        favoriteToggleLabel={favoriteToggleLabel}
        isAddedToCalendar={schedule.isAddedToCalendar}
        addedToCalendarBadgeLabel={addedToCalendarBadgeLabel}
        distanceKm={schedule.distanceKm}
        nearbyBadgeLabel={nearbyBadgeLabel}
        nearbyBadgeThreshold={nearbyBadgeThreshold}
        applicableDaysOfWeek={schedule.applicableDaysOfWeek}
        dayOfWeekLabels={dayOfWeekLabels}
        repeatBadgeAriaLabel={repeatBadgeAriaLabel}
        locale={locale}
        timezone={timezone}
        onClick={() => onScheduleClick(schedule)}
      />
    );
  }

  // User feedback (2026-09-28): the desktop grid cell shows a status badge again, but only for
  // the `inHours`/`endsAt` states — every other state (including `endsToday`) stays badge-less,
  // per BUG-048's original revert (see `EventCardCalendarGridItem.tsx`'s own note).
  const { text: gridStatusText, variant: gridStatusVariant, state: gridStatusState } = formatEventStatus(
    locale,
    timezone,
    new Date(),
    schedule.eventStartDate,
    schedule.eventStartTime,
    schedule.eventEndDate,
    schedule.eventEndTime,
    statusLabels
  );
  const gridStatusBadge =
    gridStatusState === 'inHours' || gridStatusState === 'endsAt' ? (
      <EventCardStatusBadge text={gridStatusText} variant={gridStatusVariant} />
    ) : undefined;

  // BUG-048: single-day schedules now adopt `EventCardCalendarGridItem` (Story 1.i1f), the same
  // primitive the *spanning* banner (`MultiDaySpanningBar`, above) already uses — the exact
  // "non-interactive chrome + sibling interactive elements" shape that bar's own doc comment
  // describes (see `MultiDaySpanningBar` below): a real click-target `<button>` (keeps its
  // roving-tabindex `id`/`tabIndex`/`onKeyDown`/`onFocus`, unchanged from before this fix) sits
  // underneath a `pointer-events-none` visual layer painting the card on top, so the primitive's
  // own internal favorite-toggle button stays interactive while the schedule-click target stays
  // one linear roving-tabindex stop. `schedule.isAddedToCalendar` has no slot in the shared
  // primitive (unlike `isFavorited`, which the primitive's own favorite control absorbs whenever
  // an `onFavoriteToggle` handler is supplied) — it stays a small icon composed directly here.
  return (
    <div className="relative w-full" data-testid="calendar-grid-card">
      <button
        id={cardId}
        type="button"
        tabIndex={cardId ? (isRovingActive ? 0 : -1) : 0}
        className={SPANNING_BAR_CLICK_CLASS}
        aria-label={schedule.eventName}
        onClick={() => onScheduleClick(schedule)}
        onPointerEnter={tooltipHandlers.onPointerEnter}
        onPointerLeave={tooltipHandlers.onPointerLeave}
        onFocus={handleFocus}
        onBlur={tooltipHandlers.onBlur}
        onKeyDown={handleKeyDownLocal}
        aria-describedby={tooltipVisible ? `tooltip-${dayIdx}-${schedule.id}` : undefined}
      />

      <div className={SPANNING_BAR_VISUAL_CLASS}>
        <EventCardCalendarGridItem
          eventName={schedule.eventName}
          location={schedule.locationName}
          isMultiDay={false}
          isFavorited={schedule.isFavorited}
          favoriteCount={schedule.favoriteCount}
          onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(schedule) : undefined}
          distanceKm={schedule.distanceKm}
          nearbyBadgeThreshold={nearbyBadgeThreshold}
          statusBadge={gridStatusBadge}
          labels={{ favoriteToggle: favoriteToggleLabel, nearbyBadge: nearbyBadgeLabel }}
          applicableDaysOfWeek={schedule.applicableDaysOfWeek}
          dayOfWeekLabels={dayOfWeekLabels}
          repeatBadgeAriaLabel={repeatBadgeAriaLabel}
          repeatBadgeTooltipVisible={interactionVisible}
        />
        {/* `EventCardCalendarGridItem`'s own favorite control only renders when a toggle handler
            is supplied (mirrors `EventCard`'s convention, matches VM6's own already-shipped
            tradeoff). When no handler exists at all there is no interactive control to fall back
            to, so a purely decorative heart preserves the pre-BUG-048 behavior of showing
            `isFavorited` unconditionally. Positioned with a *negative* offset so it sits outside
            the card's own `p-2` padding box (a corner badge over the border, not the content) —
            EventCardCalendarGridItem's title/favorite row starts flush at that same corner, so a
            same-corner icon inside the padding box would overlap the title text. */}
        {schedule.isFavorited && !onFavoriteToggle && (
          <Heart
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-rose-500 fill-rose-500 bg-white/90 rounded-full p-0.5 shadow-sm"
            aria-label={favoritedBadgeLabel || 'Favorited'}
            data-testid="heart-icon"
          />
        )}
        {schedule.isAddedToCalendar && (
          <CalendarPlus
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 text-emerald-600 bg-white/90 rounded-full p-0.5 shadow-sm"
            aria-label={addedToCalendarBadgeLabel || 'Added to calendar'}
            data-testid="calendar-plus-icon"
          />
        )}
      </div>

      {/* Hover+Focus accessible tooltip (AC7) */}
      {tooltipVisible && (
        <div
          id={`tooltip-${dayIdx}-${schedule.id}`}
          role="tooltip"
          className={`${HOVER_TOOLTIP_CLASS} bottom-full left-1/2 -translate-x-1/2 mb-1`}
        >
          <p className="font-semibold text-xs mb-0.5">{schedule.eventName}</p>
          <p className="text-[10px] text-gray-300 leading-none">{tooltipText}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Story 1.i1g Task 4.1 — props for one row of the multi-day spanning banner.
 */
interface MultiDaySpanningBarProps<TSchedule extends WeeklyCalendarViewScheduleShape> {
  /** The multi-day schedule this single spanning card represents. */
  schedule: TSchedule;
  /** DOM id of the click target (roving-tabindex focus target, `calendar-card-${key}`). */
  cardId: string;
  isRovingActive: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  locale: string;
  timezone?: string;
  onScheduleClick: (schedule: TSchedule) => void;
  onFavoriteToggle?: (schedule: TSchedule) => void;
  /** aria-label for the primitive's favorite control (defaults inside the primitive). */
  favoriteToggleLabel?: string;
  /**
   * Distance threshold (km) for this card's nearby badge, passed straight through to
   * `EventCardCalendarGridItem`. Undefined keeps the card's own `8` default.
   */
  nearbyBadgeThreshold?: number;
  /** Forwarded to `formatEventStatus` for this bar's own `inHours`/`endsAt`-only status badge. */
  statusLabels?: EventStatusLabels;
  /** Story 1.3k (AC5) — this run's own (possibly week-external) first/last occurrence day. */
  runStartDate: string;
  runEndDate: string;
  /** Story 1.3k (AC9) — translated weekday labels for the repeat badge. */
  dayOfWeekLabels?: Record<string, string>;
  /** Story 1.3k (AC6/AC8) — repeat badge aria-label/tooltip text resolver. */
  repeatBadgeAriaLabel?: (dayLabels: string[]) => string;
  /**
   * FIND-058: aria-label for the decorative `isAddedToCalendar` corner icon, mirroring the
   * single-day grid card's own `addedToCalendarBadgeLabel` (`CalendarCard`, above).
   */
  addedToCalendarBadgeLabel?: string;
}

/**
 * Story 1.i1g Task 4.1 (AC1-AC4, AC7-AC12) — one multi-day schedule as a single spanning
 * calendar grid item card.
 *
 * Structural shape follows this epic's established "non-interactive chrome + sibling
 * interactive elements" pattern (Story 1.i1d's `variant='list'` chrome div, Story 1.i1e's
 * masonry card): this wrapper is a non-interactive positioned container holding two siblings —
 *
 *  1. the schedule-click `<button>` (the interactive/accessible element), and
 *  2. `EventCardCalendarGridItem` (Story 1.i1f), the visible card, inside a
 *     `pointer-events-none` layer (`SPANNING_BAR_VISUAL_CLASS`) that paints on top of the
 *     click target so the schedule reads as one card, while pointer events fall straight
 *     through to it — except for the primitive's own favorite-toggle button, re-enabled via
 *     `[&_button]:pointer-events-auto`.
 *
 * The primitive's favorite control is therefore never nested inside the schedule-click
 * element (AC7), and the click target itself is one roving-tabindex stop in the banded grid (it
 * joins the same arrow-key navigation as the single-day cards).
 *
 * The card layer is purely visual, so the click target carries its own accessible name
 * (`aria-label`) and, while its tooltip is visible, the same `aria-describedby` →
 * `role="tooltip"` date/time range wiring as `CalendarCard`'s grid variant (AC11).
 */
function MultiDaySpanningBar<TSchedule extends WeeklyCalendarViewScheduleShape>({
  schedule,
  cardId,
  isRovingActive,
  onKeyDown,
  onFocus,
  locale,
  timezone,
  onScheduleClick,
  onFavoriteToggle,
  favoriteToggleLabel,
  nearbyBadgeThreshold,
  statusLabels,
  runStartDate,
  runEndDate,
  dayOfWeekLabels,
  repeatBadgeAriaLabel,
  addedToCalendarBadgeLabel,
}: MultiDaySpanningBarProps<TSchedule>) {
  // Story 1.3k Task 4 (AC11) — same shared hook as `CalendarCard`'s grid variant, replacing this
  // component's own hand-rolled `isHovered`/`isFocused`/`isDismissed` state (the mandatory second
  // consumer per Gate 3's resolution — see the hook's own header comment). No mode gate here (this
  // bar's tooltip is always active), matching the pre-refactor unconditional `tooltipVisible`.
  const { isVisible: tooltipVisible, handlers: tooltipHandlers } = useHoverFocusTooltip({
    enabled: true,
  });

  const tooltipText = useMemo(() => {
    // Story 1.3k (AC5) — the run's own bounds, never the schedule's overall span.
    return formatTooltipTimeRange(
      locale,
      timezone,
      runStartDate,
      runEndDate,
      schedule.eventStartTime,
      schedule.eventEndTime
    );
  }, [locale, timezone, runStartDate, runEndDate, schedule]);

  // User feedback (2026-09-28): same `inHours`/`endsAt`-only status badge as the single-day grid
  // cell (`CalendarCard`'s own note above) — a multi-day schedule can be starting or ending soon
  // too, and this bar shares the same underlying primitive/badge slot.
  const { text: spanStatusText, variant: spanStatusVariant, state: spanStatusState } = formatEventStatus(
    locale,
    timezone,
    new Date(),
    schedule.eventStartDate,
    schedule.eventStartTime,
    schedule.eventEndDate,
    schedule.eventEndTime,
    statusLabels
  );
  const spanStatusBadge =
    spanStatusState === 'inHours' || spanStatusState === 'endsAt' ? (
      <EventCardStatusBadge text={spanStatusText} variant={spanStatusVariant} />
    ) : undefined;

  const tooltipId = `spanning-tooltip-${schedule.id}`;

  return (
    <div
      className="relative w-full"
      data-testid="multi-day-spanning-bar"
      data-schedule-id={schedule.id}
    >
      {/* AC12 — the schedule-click target: a real button (Enter/Space, focus-visible ring,
          one linear Tab stop) sitting underneath the visual card layer. */}
      <button
        id={cardId}
        type="button"
        tabIndex={isRovingActive ? 0 : -1}
        className={SPANNING_BAR_CLICK_CLASS}
        aria-label={schedule.eventName}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        onClick={() => onScheduleClick(schedule)}
        onPointerEnter={tooltipHandlers.onPointerEnter}
        onPointerLeave={tooltipHandlers.onPointerLeave}
        onFocus={(e) => {
          tooltipHandlers.onFocus(e);
          onFocus?.();
        }}
        onBlur={tooltipHandlers.onBlur}
        onKeyDown={(e) => {
          tooltipHandlers.onKeyDown(e);
          onKeyDown?.(e);
        }}
      />

      {/* AC7/AC8/AC9 — the visible card is `EventCardCalendarGridItem` (Story 1.i1f) in its
          multi-day composition, wrapped so its own internal favorite-toggle button is the only
          interactive element inside this layer. */}
      <div className={SPANNING_BAR_VISUAL_CLASS}>
        <EventCardCalendarGridItem
          eventName={schedule.eventName}
          location={schedule.locationName}
          imageUrl={schedule.imageUrl}
          imageFallbackUrl={schedule.imageFallbackUrl}
          imageAlt={schedule.eventName}
          isMultiDay
          isFavorited={schedule.isFavorited}
          favoriteCount={schedule.favoriteCount}
          onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(schedule) : undefined}
          distanceKm={schedule.distanceKm}
          nearbyBadgeThreshold={nearbyBadgeThreshold}
          statusBadge={spanStatusBadge}
          labels={{ favoriteToggle: favoriteToggleLabel }}
          applicableDaysOfWeek={schedule.applicableDaysOfWeek}
          dayOfWeekLabels={dayOfWeekLabels}
          repeatBadgeAriaLabel={repeatBadgeAriaLabel}
          repeatBadgeTooltipVisible={tooltipVisible}
        />
        {/* FIND-058: `isAddedToCalendar` has no slot in the shared `EventCardCalendarGridItem`
            primitive (same gap as the single-day grid cell's own note above), so it stays a
            small decorative icon composed directly here — copied verbatim from the single-day
            card's own top-left corner treatment. This bar always receives an `onFavoriteToggle`
            handler, so the primitive's internal favorite control renders instead of a decorative
            heart, leaving this corner free (no competing decorative-favorite icon to collide
            with, unlike the single-day cell). Positioned with a *negative* offset so it sits
            outside the card's own `p-2` padding box (a corner badge over the border, not the
            content) — same reasoning as the single-day card's comment above. */}
        {schedule.isAddedToCalendar && (
          <CalendarPlus
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 text-emerald-600 bg-white/90 rounded-full p-0.5 shadow-sm"
            aria-label={addedToCalendarBadgeLabel || 'Added to calendar'}
            data-testid="calendar-plus-icon"
          />
        )}
      </div>

      {/* Hover+Focus accessible tooltip (AC11) — same element/behavior as the day-cell cards. */}
      {tooltipVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`${HOVER_TOOLTIP_CLASS} bottom-full left-1/2 -translate-x-1/2 mb-1`}
        >
          <p className="font-semibold text-xs mb-0.5">{schedule.eventName}</p>
          <p className="text-[10px] text-gray-300 leading-none">{tooltipText}</p>
        </div>
      )}
    </div>
  );
}

