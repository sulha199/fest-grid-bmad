"use client"

import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronLeft, ChevronRight, Heart, CalendarPlus, CalendarRange, ChevronDown } from 'lucide-react';
import { WeekPicker } from '../../core/WeekPicker';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
import type {
  WeeklyCalendarViewProps,
  WeeklyCalendarViewScheduleShape,
  WeeklyCalendarViewOverflowSurface,
} from './WeeklyCalendarView.types';
import { getWeekStart, getWeekEnd } from '../../hooks';
import {
  EventCardMediaSlot,
  EventCardDateBox,
  EventCardStatusBadge,
  EventCardNearbyBadge,
  EventCardFavoriteBadge,
  EVENT_CARD_CONTAINER_CLASS,
  formatNearbyBadgeDistance,
} from './EventCardMediaPrimitives';
import { EventCardCalendarGridItem } from './EventCardCalendarGridItem';
import { CalendarOverflowDialog } from './CalendarOverflowDialog';
import { computeCalendarSegmentDateBoxContent, formatEventStatus, type EventStatusLabels } from './format-event-date';
import {
  badgeFontSizeStyleFor,
  eventCardRowFavoriteIconGrowingStyle,
  EVENT_CARD_ROW_FAVORITE_COUNT_TEXT_SIZE_CLASS,
} from './event-card-media-tokens';

// Design system styles from DESIGN.md
const CALENDAR_BASE_CLASS = "border border-gray-200 rounded-lg";
const HEADER_CLASS = "flex items-center justify-between p-4 border-b border-gray-200";
const DATE_RANGE_CLASS = "text-lg font-semibold";
const NAV_BUTTON_CLASS = "py-1 px-3 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors";
const GRID_WEEKLY_CLASS = "grid grid-cols-7 divide-x divide-gray-200";
const DAY_CELL_CLASS = "p-2 h-32 flex flex-col gap-1 overflow-hidden relative";
const DAY_HEADER_CLASS = "text-sm text-center font-medium py-2 bg-gray-50 border-b border-gray-200";
const MORE_LINK_CLASS = "text-xs text-center text-violet-600 hover:underline cursor-pointer bg-transparent border-none p-0 w-full mt-auto block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 rounded";
const MULTI_DAY_EVENT_CLASS = "w-full bg-violet-50 border border-violet-200 p-1 relative text-left text-xs transition-colors hover:bg-violet-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10";
const HOVER_TOOLTIP_CLASS = "absolute z-30 p-2 text-sm bg-gray-800 text-white rounded-md shadow-lg pointer-events-auto max-w-xs break-words";
const EVENT_CARD_COMPACT_CLASS = "rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200 text-left text-xs transition-all hover:bg-violet-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10";
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
const SPANNING_BAR_VISUAL_CLASS = "relative z-20 pointer-events-none [&_button]:pointer-events-auto";
/**
 * Story 1.i1h Task 7.2 / AC4 — mobile's new flat inline bound on single-day/isolated occurrences
 * per day (EXPERIENCE.md's sanctioned practical fallback, replacing the previous
 * uncapped-always-render rule). Deliberately a flat constant and NOT a `ResizeObserver`-measured
 * dynamic size: the precise per-render measurement technique is explicitly deferred by AC7.
 * Multi-day segments are exempt from this count entirely and always render inline
 * (`isMultiDaySchedule` below).
 */
const MOBILE_INLINE_CAP = 20;
/** Stable no-op for the not-yet-supplied `overflowDialogData` case (keeps `useInfiniteScroll`'s effect graph stable when omitted). */
const NOOP = () => {};
/**
 * Default accessible name for the shared overflow dialog — the exact `Schedules for ${day}` string
 * the superseded desktop popover already used as its `aria-label`, now day-scoped per open day.
 */
const DEFAULT_OVERFLOW_DIALOG_TITLE_LABEL = (dayLabel: string) => `Schedules for ${dayLabel}`;


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
 * Whether a schedule spans more than one day (`eventEndDate !== eventStartDate`).
 * Story 1.i1g — the single predicate behind both "this schedule belongs in the spanning
 * banner, not in a desktop day cell" (AC5/AC6) and the primitive's `isMultiDay` prop (AC8).
 */
const isMultiDaySchedule = (schedule: WeeklyCalendarViewScheduleShape) =>
  !!schedule.eventEndDate && schedule.eventEndDate !== schedule.eventStartDate;

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
}

/**
 * One multi-day schedule as it appears in the spanning banner row (Story 1.i1g Task 2):
 * the schedule itself plus its already-clipped column range within the visible week.
 */
interface SpanningSchedule<TSchedule> {
  schedule: TSchedule;
  /** 0-based index of the first visible day-column the schedule occupies (AC3). */
  startColIdx: number;
  /** Number of visible day-columns the (clipped) schedule spans (AC1/AC3). */
  spanCount: number;
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
  maxEventsPerDay,
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
  onOverflowRequested,
  onOverflowClosed,
  overflowDialogData,
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
    statusInHours: 'In {n} hour(s)',
    statusInDays: 'In {n} days',
    statusUpcoming: 'Upcoming',
    tomorrow: 'Tomorrow',
    ...labels,
    // BUG-049 review finding: set after the spread with `??`, not spread-after-default, so an
    // explicit `labels={{ nearbyBadge: undefined }}` still falls back to the formatter instead
    // of crashing `EventCardNearbyBadge` when it calls `defaultLabels.nearbyBadge(distanceKm)`.
    nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance,
  };
  const overflowDialogTitleLabel = labels.overflowDialogTitleLabel ?? DEFAULT_OVERFLOW_DIALOG_TITLE_LABEL;
  // BUG-048 review finding: computed once and reused at all three `statusLabels` call sites
  // (spanning bar, grid cell, mobile list row) instead of re-literalling the same 7-key object
  // three times — a future label-key change now only needs to happen here.
  const statusLabels: EventStatusLabels = {
    statusEnded: defaultLabels.statusEnded,
    statusHappeningNow: defaultLabels.statusHappeningNow,
    statusEndsToday: defaultLabels.statusEndsToday,
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
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(baseDate);
      nextDay.setUTCDate(baseDate.getUTCDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [weekStart]);

  // 2. Bucketing schedules/segments into visible days
  const dayBuckets = useMemo(() => {
    const buckets: Segment<TSchedule>[][] = Array.from({ length: 7 }, () => []);
    const startStr = toISODateString(visibleDays[0]);
    const endStr = toISODateString(visibleDays[6]);

    schedules.forEach((schedule) => {
      const start = schedule.eventStartDate;
      const end = schedule.eventEndDate || start;

      // Check overlap with visible week range [startStr, endStr]
      if (start <= endStr && end >= startStr) {
        // Find indices of days we overlap with
        visibleDays.forEach((day, idx) => {
          const dayISO = toISODateString(day);
          if (dayISO >= start && dayISO <= end) {
            buckets[idx].push({
              schedule,
              isFirstSegment: dayISO === start,
              isLastSegment: dayISO === end,
            });
          }
        });
      }
    });

    // Sort bucket segments by time ascending
    buckets.forEach((bucket) => {
      bucket.sort((a, b) => {
        const timeA = a.schedule.eventStartTime || '99:99';
        const timeB = b.schedule.eventStartTime || '99:99';
        return timeA.localeCompare(timeB);
      });
    });

    return buckets;
  }, [schedules, visibleDays]);

  // 2b. Story 1.i1g Task 2 — multi-day schedules as *one* spanning row entry each.
  //
  // Range intersection in date-string space (`YYYY-MM-DD` sorts lexicographically) mirrors
  // the dayBuckets overlap test above, but is computed once per schedule instead of once per
  // day-column. Column indices are always derived against the *visible week* (never the
  // schedule's true start/end), so a schedule running past either edge of the week is clipped
  // to the columns that are actually on screen (AC3) while still rendering exactly one bar.
  const spanningSchedules = useMemo(() => {
    const weekStartStr = toISODateString(visibleDays[0]);
    const weekEndStr = toISODateString(visibleDays[6]);
    const entries: SpanningSchedule<TSchedule>[] = [];

    schedules.forEach((schedule) => {
      if (!isMultiDaySchedule(schedule)) return;

      const start = schedule.eventStartDate;
      const end = schedule.eventEndDate || start;

      // No overlap with the visible week at all → no bar in this week's banner.
      if (start > weekEndStr || end < weekStartStr) return;

      const clippedStart = start < weekStartStr ? weekStartStr : start;
      const clippedEnd = end > weekEndStr ? weekEndStr : end;

      const startColIdx = Math.max(0, diffInDays(weekStartStr, clippedStart));
      const endColIdx = Math.min(6, diffInDays(weekStartStr, clippedEnd));

      entries.push({ schedule, startColIdx, spanCount: endColIdx - startColIdx + 1 });
    });

    // AC4 — deterministic row order: earliest start date, then earliest start time (untimed
    // schedules last, matching the day-bucket time sort's `'99:99'` sentinel), then id so the
    // order never depends on caller-supplied array order.
    entries.sort((a, b) => {
      const byStart = a.schedule.eventStartDate.localeCompare(b.schedule.eventStartDate);
      if (byStart !== 0) return byStart;

      const timeA = a.schedule.eventStartTime || '99:99';
      const timeB = b.schedule.eventStartTime || '99:99';
      const byTime = timeA.localeCompare(timeB);
      if (byTime !== 0) return byTime;

      return String(a.schedule.id).localeCompare(String(b.schedule.id));
    });

    return entries;
  }, [schedules, visibleDays]);

  // 2c. Story 1.i1g Task 3 (AC5/AC6) — the desktop day cells and their "+N more" popover list
  // single-day schedules only, because every multi-day schedule in a bucket already has its own
  // spanning bar above the day-cell row; keeping the per-day segments too would duplicate it.
  // `dayBuckets` itself is left untouched — the mobile list still renders multi-day segments
  // day-by-day (AC13) — and this filtered view is also what the roving tabindex grid is built
  // from, so spanning bars stay out of Arrow-key navigation (AC12).
  const singleDayDayBuckets = useMemo(
    () => dayBuckets.map((bucket) => bucket.filter((segment) => !isMultiDaySchedule(segment.schedule))),
    [dayBuckets]
  );

  // 3. Roving Tabindex State & Arrow-key Nav implementation
  const [activeCardCoords, setActiveCardCoords] = useState<{ dayIdx: number; cardIdx: number } | null>(null);

  // Flattened grid of accessible cards (excluding popover-only elements) for Arrow movements
  const gridCards = useMemo(() => {
    const cards: { dayIdx: number; cardIdx: number; key: string }[] = [];
    singleDayDayBuckets.forEach((bucket, dayIdx) => {
      const displayCount = maxEventsPerDay === -1 ? bucket.length : Math.min(maxEventsPerDay, bucket.length);
      for (let cardIdx = 0; cardIdx < displayCount; cardIdx++) {
        cards.push({ dayIdx, cardIdx, key: `${dayIdx}-${cardIdx}` });
      }
    });
    return cards;
  }, [singleDayDayBuckets, maxEventsPerDay]);

  // Sync active roving tabindex coordinate if previous coordinate gets removed / is invalid
  useEffect(() => {
    if (gridCards.length === 0) {
      setActiveCardCoords(null);
      return;
    }
    if (!activeCardCoords) {
      // Default to first card of the week
      setActiveCardCoords({ dayIdx: gridCards[0].dayIdx, cardIdx: gridCards[0].cardIdx });
      return;
    }
    const exists = gridCards.some(
      (c) => c.dayIdx === activeCardCoords.dayIdx && c.cardIdx === activeCardCoords.cardIdx
    );
    if (!exists) {
      setActiveCardCoords({ dayIdx: gridCards[0].dayIdx, cardIdx: gridCards[0].cardIdx });
    }
  }, [gridCards, activeCardCoords]);

  // Keyboard Navigation Arrow Handlers
  const handleGridKeyDown = (e: React.KeyboardEvent, dayIdx: number, cardIdx: number) => {
    if (!activeCardCoords) return;

    const findIndex = (coords: { dayIdx: number; cardIdx: number }) => {
      return gridCards.findIndex((c) => c.dayIdx === coords.dayIdx && c.cardIdx === coords.cardIdx);
    };

    const currentIndex = findIndex({ dayIdx, cardIdx });
    if (currentIndex === -1) return;

    let targetCoords: { dayIdx: number; cardIdx: number } | null = null;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      // Move within day list or to adjacent day cell
      const offset = e.key === 'ArrowLeft' ? -1 : 1;
      const targetIndex = currentIndex + offset;
      if (targetIndex >= 0 && targetIndex < gridCards.length) {
        const target = gridCards[targetIndex];
        targetCoords = { dayIdx: target.dayIdx, cardIdx: target.cardIdx };
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Move to adjacent column in the same row index (which is row/col conceptually)
      // Since col is dayIdx (0-6), we want targetDayIdx = dayIdx + (Up: -1, Down: +1)
      const colOffset = e.key === 'ArrowUp' ? -1 : 1;
      const targetDayIdx = dayIdx + colOffset;

      if (targetDayIdx >= 0 && targetDayIdx < 7) {
        // Story 1.i1g Task 3 (AC5/AC6): must read the *same* single-day buckets the day cells
        // actually render from — reading raw `dayBuckets` here would let ArrowDown "move" the
        // roving coordinate onto a day whose only entry is a multi-day schedule (rendered as a
        // spanning bar, not a card), stranding focus on a non-existent `calendar-card-*` id.
        const targetBucket = singleDayDayBuckets[targetDayIdx];
        const displayLimit = maxEventsPerDay === -1 ? targetBucket.length : Math.min(maxEventsPerDay, targetBucket.length);
        if (displayLimit > 0) {
          // fallback sensibly if that day has fewer cards
          const targetCardIdx = Math.min(cardIdx, displayLimit - 1);
          targetCoords = { dayIdx: targetDayIdx, cardIdx: targetCardIdx };
        }
      }
    }

    if (targetCoords) {
      setActiveCardCoords(targetCoords);
      // Imperative focus management
      const elementId = `calendar-card-${targetCoords.dayIdx}-${targetCoords.cardIdx}`;
      // Do synchronously so focus works immediately and reliably in tests/render
      const el = document.getElementById(elementId);
      el?.focus();
    }
  };

  // 4. Overflow-dialog state (Story 1.i1h Task 7)
  //
  // The UI open/closed state stays local to `WeeklyCalendarView` exactly as the superseded desktop
  // popover's `openPopoverDayIdx` did (Task 7.1's explicit instruction); only the *data* is lifted
  // to the caller (Task 8's `overflowDialogData`), because React Query must stay isolated to
  // `apps/web` per project-context.md's State Management Architecture rule. The whole focus-trap /
  // Escape / outside-pointerdown / focus-return mechanism that used to live here was deleted and
  // now lives inside `CalendarOverflowDialog` (Task 6.5) — the dialog is rendered exactly ONCE
  // (Task 7.3), so there is exactly one trap / live region / sentinel in the document (AC8).
  const [openOverflow, setOpenOverflow] = useState<{
    dayIdx: number;
    surface: WeeklyCalendarViewOverflowSurface;
  } | null>(null);
  const [dayOverrides, setDayOverrides] = useState<Record<string, boolean>>({});
  const todayISO = getTodayISOInTimezone(activeTimezone);
  const mobileDayContentIdPrefix = useId();
  /**
   * Trigger refs, kept in two per-surface arrays indexed by day because desktop and mobile live in
   * separate `hidden md:block` / `md:hidden` trees — only one is ever mounted. `openOverflowTriggerRef`
   * holds whichever trigger was actually activated, and is what the dialog receives as
   * `triggerRef` so focus returns to that exact "+N more" control on close (Task 7.4 / AC8).
   */
  const desktopOverflowTriggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mobileOverflowTriggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openOverflowTriggerRef = useRef<HTMLElement | null>(null);

  const handleOpenOverflow = (
    dayIdx: number,
    surface: WeeklyCalendarViewOverflowSurface,
    inlineHiddenCount: number
  ) => {
    const triggerRefs = surface === 'desktop' ? desktopOverflowTriggerRefs : mobileOverflowTriggerRefs;
    openOverflowTriggerRef.current = triggerRefs.current[dayIdx];
    setOpenOverflow({ dayIdx, surface });
    // Task 7.1 / 8.4 — the caller owns the day-scoped fetch *and* AC9's
    // `calendar_overflow_dialog_opened` event, so it needs all three payload fields: which date,
    // which surface the trigger came from, and how many inline items that surface hid.
    onOverflowRequested?.(toISODateString(visibleDays[dayIdx]), surface, inlineHiddenCount);
  };

  const handleCloseOverflow = () => {
    // Focus return is the dialog's own responsibility via `triggerRef` (Task 6.5) — there is no
    // local `setTimeout(() => trigger.focus())` here any more.
    setOpenOverflow(null);
    // Task 8.1 — the caller owns the day-scoped query's lifetime, so it needs to know the dialog
    // closed in order to clear its own `openOverflowDate` and let that query go dormant again.
    onOverflowClosed?.();
  };

  const overflowDayIdx = openOverflow?.dayIdx ?? null;
  const overflowDate = overflowDayIdx === null ? null : toISODateString(visibleDays[overflowDayIdx]);

  // (The superseded popover's focus-trap / Escape / outside-pointerdown effect lived here. It was
  // deleted in Story 1.i1h Task 7.1 and reimplemented, unchanged in behaviour, inside
  // `CalendarOverflowDialog` — one shared implementation for both the desktop and mobile surfaces
  // instead of a bespoke desktop-only one.)

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
        <div className="flex items-center gap-2">
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
      <div className="hidden md:block" data-testid="desktop-calendar-view">
        {/* Day Headers */}
        <div className={GRID_WEEKLY_CLASS}>
        {visibleDays.map((day, idx) => {
          const headerStr = formatDayHeader(activeLocale, activeTimezone, day);
          return (
            <div key={idx} className={DAY_HEADER_CLASS}>
              {headerStr}
            </div>
          );
        })}
      </div>

      {/* Multi-day spanning banner (Story 1.i1g Task 4).
          One row per multi-day schedule, spanning its day-columns so the schedule reads as a
          single continuous grid item (AC1/AC2). It reuses the exact same `GRID_WEEKLY_CLASS`
          column template as the day-header and day-cell grids above/below, so its column
          boundaries align pixel-for-pixel (AC2). Rendered only when the visible week actually
          has a multi-day schedule (Task 4.2 / AC4). */}
      {spanningSchedules.length > 0 && (
        <div className={`${GRID_WEEKLY_CLASS} bg-white`} data-testid="multi-day-spanning-banner">
          {spanningSchedules.map((entry, rowIdx) => (
            <MultiDaySpanningBar
              key={entry.schedule.id}
              schedule={entry.schedule}
              startColIdx={entry.startColIdx}
              spanCount={entry.spanCount}
              rowIdx={rowIdx}
              locale={activeLocale}
              timezone={activeTimezone}
              onScheduleClick={onScheduleClick}
              onFavoriteToggle={onFavoriteToggle}
              favoriteToggleLabel={defaultLabels.favoriteToggleLabel}
              nearbyBadgeThreshold={nearbyBadgeThreshold}
              statusLabels={statusLabels}
            />
          ))}
        </div>
      )}

      {/* Day cells grid */}
      <div className={GRID_WEEKLY_CLASS}>
        {singleDayDayBuckets.map((bucket, dayIdx) => {
          const totalSchedules = bucket.length;
          const displayLimit = maxEventsPerDay === -1 ? totalSchedules : Math.min(maxEventsPerDay, totalSchedules);
          const visibleSegments = bucket.slice(0, displayLimit);
          const hiddenCount = totalSchedules - displayLimit;

          return (
            <div key={dayIdx} className={`${DAY_CELL_CLASS} bg-white`}>
              {visibleSegments.map((seg, cardIdx) => (
                <CalendarCard
                  key={seg.schedule.id}
                  segment={seg}
                  dayIdx={dayIdx}
                  cardIdx={cardIdx}
                  isRovingActive={
                    activeCardCoords?.dayIdx === dayIdx && activeCardCoords?.cardIdx === cardIdx
                  }
                  locale={activeLocale}
                  timezone={activeTimezone}
                  onScheduleClick={onScheduleClick}
                  onFavoriteToggle={onFavoriteToggle}
                  favoriteToggleLabel={defaultLabels.favoriteToggleLabel}
                  tillLabel={defaultLabels.tillLabel}
                  onKeyDown={(e) => handleGridKeyDown(e, dayIdx, cardIdx)}
                  onFocus={() => setActiveCardCoords({ dayIdx, cardIdx })}
                  favoritedBadgeLabel={defaultLabels.favoritedBadgeLabel}
                  addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                  nearbyBadgeLabel={defaultLabels.nearbyBadge}
                  nearbyBadgeThreshold={nearbyBadgeThreshold}
                  statusLabels={statusLabels}
                />
              ))}

              {/* "+N more" affordance (AC4) — Story 1.i1h Task 7.1: same trigger, but it now opens
                  the shared `CalendarOverflowDialog` instead of the bespoke inline
                  `w-56 max-h-56 overflow-y-auto` popover, which is deleted. */}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  data-testid="calendar-overflow-trigger-desktop"
                  ref={(el) => {
                    desktopOverflowTriggerRefs.current[dayIdx] = el;
                  }}
                  className={MORE_LINK_CLASS}
                  onClick={() => handleOpenOverflow(dayIdx, 'desktop', hiddenCount)}
                  aria-expanded={openOverflow?.surface === 'desktop' && overflowDayIdx === dayIdx}
                  aria-haspopup="dialog"
                >
                  {labels.moreLabel ? labels.moreLabel(hiddenCount) : `+${hiddenCount} more`}
                </button>
              )}

              {/* (Story 1.i1h Task 7.1 — the floating `w-56 max-h-56 overflow-y-auto` popover
                  disclosure that lived here is deleted; its contents/mechanics are the shared
                  `CalendarOverflowDialog`, rendered once at this component's root.) */}
            </div>
          );
        })}
      </div>
    </div>

    {/* Mobile Vertical Day List (AC15) */}
    <div className="md:hidden flex flex-col divide-y divide-gray-200 p-4" data-testid="mobile-calendar-view">
      {dayBuckets
        .map((bucket, dayIdx) => ({ bucket, dayIdx, dayDate: visibleDays[dayIdx] }))
        .filter(({ bucket }) => bucket.length > 0)
        .map(({ bucket, dayIdx, dayDate }) => {
          const headerStr = formatDayHeader(activeLocale, activeTimezone, dayDate);
          const dateISO = toISODateString(dayDate);
          const isCollapsed = dayOverrides[dateISO] ?? (dateISO < todayISO);

          // Task 7.2 / AC4 — mobile's NEW flat inline bound. Only single-day/isolated occurrences
          // count toward it; multi-day segments are exempt and always render inline regardless of
          // how many there are (EXPERIENCE.md's exemption rule, the same principle desktop's
          // `day_cell` already applies by filtering multi-day schedules into the spanning banner).
          // Iterating the bucket itself (rather than concatenating two filtered arrays) preserves
          // the existing chronological order of the rendered list.
          let singleDaySeen = 0;
          const mobileVisibleSegments = bucket.filter((seg) => {
            if (isMultiDaySchedule(seg.schedule)) return true;
            singleDaySeen += 1;
            return singleDaySeen <= MOBILE_INLINE_CAP;
          });
          const mobileHiddenCount = bucket.length - mobileVisibleSegments.length;

          return (
            <div key={dayIdx} className="flex flex-col gap-1 py-3" data-testid="mobile-day-row">
              <button
                type="button"
                data-testid="mobile-day-toggle"
                aria-expanded={!isCollapsed}
                aria-controls={`${mobileDayContentIdPrefix}-mobile-day-content-${dayIdx}`}
                aria-label={`${headerStr} — ${isCollapsed ? (labels?.expandDayLabel || 'Expand day') : (labels?.collapseDayLabel || 'Collapse day')}`}
                className="flex items-center justify-between text-sm font-medium text-left px-1 mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                onClick={() => setDayOverrides(prev => ({ ...prev, [dateISO]: !isCollapsed }))}
              >
                {headerStr}
                <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${!isCollapsed ? 'rotate-180' : ''}`} />
              </button>
              {!isCollapsed && (
                <div id={`${mobileDayContentIdPrefix}-mobile-day-content-${dayIdx}`} className="flex flex-col gap-2 px-1">
                  {mobileVisibleSegments.map((seg) => (
                    <CalendarCard
                      key={seg.schedule.id}
                      segment={seg}
                      dayIdx={dayIdx}
                      cardIdx={-1} // Non-grid / plain Tab stop
                      isRovingActive={false}
                      locale={activeLocale}
                      timezone={activeTimezone}
                      onScheduleClick={onScheduleClick}
                      onFavoriteToggle={onFavoriteToggle}
                      favoriteToggleLabel={defaultLabels.favoriteToggleLabel}
                      tillLabel={defaultLabels.tillLabel}
                      variant="list"
                      currentDayStr={dateISO}
                      multiDaySegmentLabel={labels?.multiDaySegmentLabel}
                      favoritedBadgeLabel={defaultLabels.favoritedBadgeLabel}
                      addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                      statusLabels={statusLabels}
                      nearbyBadgeLabel={defaultLabels.nearbyBadge}
                      nearbyBadgeThreshold={nearbyBadgeThreshold}
                    />
                  ))}

                  {/* Task 7.2 — mobile's brand-new "+N more" affordance (mobile had none before),
                      opening the very same shared dialog as desktop's. */}
                  {mobileHiddenCount > 0 && (
                    <button
                      type="button"
                      data-testid="calendar-overflow-trigger-mobile"
                      ref={(el) => {
                        mobileOverflowTriggerRefs.current[dayIdx] = el;
                      }}
                      className={MORE_LINK_CLASS}
                      onClick={() => handleOpenOverflow(dayIdx, 'mobile', mobileHiddenCount)}
                      aria-expanded={openOverflow?.surface === 'mobile' && overflowDayIdx === dayIdx}
                      aria-haspopup="dialog"
                    >
                      {labels.moreLabel ? labels.moreLabel(mobileHiddenCount) : `+${mobileHiddenCount} more`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>

    {/* Shared overflow dialog (Story 1.i1h Task 7.3) — rendered exactly ONCE at the root, never
        once per day, so there is a single focus trap, a single `aria-live` region and a single
        infinite-scroll sentinel in the document no matter how many days overflowed (AC8). It is
        `fixed`-positioned, so its DOM placement here is layout-irrelevant. */}
    <CalendarOverflowDialog<TSchedule>
      open={overflowDayIdx !== null}
      date={overflowDate}
      items={overflowDialogData?.items ?? []}
      fetchNextPage={overflowDialogData?.fetchNextPage ?? NOOP}
      hasNextPage={overflowDialogData?.hasNextPage ?? false}
      isFetchingNextPage={overflowDialogData?.isFetchingNextPage ?? false}
      onClose={handleCloseOverflow}
      onScheduleClick={(schedule) => {
        // Matches the superseded popover's own behaviour: activating a card closes the surface so
        // the navigation it triggers is not left sitting behind an open modal.
        handleCloseOverflow();
        onScheduleClick(schedule);
      }}
      onFavoriteToggle={onFavoriteToggle}
      nearbyBadgeThreshold={nearbyBadgeThreshold}
      triggerRef={openOverflowTriggerRef}
      labels={{
        titleLabel:
          overflowDayIdx === null
            ? undefined
            : overflowDialogTitleLabel(
                formatDayHeader(activeLocale, activeTimezone, visibleDays[overflowDayIdx])
              ),
        closeLabel: defaultLabels.closePopoverLabel,
        favoriteToggleLabel: defaultLabels.favoriteToggleLabel,
      }}
    />
  </div>
  );
}

interface CalendarCardProps<TSchedule> {
  segment: Segment<TSchedule>;
  dayIdx: number;
  cardIdx: number;
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
  multiDaySegmentLabel?: (dayNumber: number, totalDays: number) => string;
  /**
   * Status badge labels (AC1/AC6), forwarded verbatim to `formatEventStatus`. Used by the
   * `list` variant directly and, as of BUG-048, threaded through to `EventCardCalendarGridItem`
   * for the `grid` variant's single-day cells too (both compute the same 8-state badge).
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
}

/**
 * Co-located subcomponent for rendering a compact calendar card, with its inline hover+focus tooltip.
 */
function CalendarCard<TSchedule extends WeeklyCalendarViewScheduleShape>({
  segment,
  dayIdx,
  cardIdx,
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
  multiDaySegmentLabel,
  statusLabels,
  nearbyBadgeLabel,
  nearbyBadgeThreshold,
}: CalendarCardProps<TSchedule>) {
  const { schedule } = segment;

  // Tooltip visibility states
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Story 1.i1m AC1/AC4 (`variant='list'` only) — seeded from the schedule's own `imageUrl`
  // and kept current via `EventCardMediaSlot`'s `onImagePresenceChange`, mirroring
  // `EventCard.tsx`'s identical masonry-side pattern. Local component state only, not
  // Server/URL/Global (per this story's own Dev Notes categorization) — it derives from a
  // prop already passed down and drives only this component's own render branch (whether
  // the favorite control is composed externally, per AC4).
  const [imagePresent, setImagePresent] = useState(!!schedule.imageUrl);

  const tooltipVisible = variant === 'grid' && (isHovered || isFocused) && !isDismissed;

  const tooltipText = useMemo(() => {
    return formatTooltipTimeRange(
      locale,
      timezone,
      schedule.eventStartDate,
      schedule.eventEndDate,
      schedule.eventStartTime,
      schedule.eventEndTime
    );
  }, [locale, timezone, schedule]);

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') {
      setIsDismissed(false);
      setIsHovered(true);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') {
      setIsHovered(false);
    }
  };

  const handleFocus = () => {
    setIsDismissed(false);
    setIsFocused(true);
    if (variant === 'grid') {
      onFocus?.();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDismissed(true);
    }
    if (variant === 'grid') {
      onKeyDown?.(e);
    }
  };

  const isMultiDay = schedule.eventEndDate && schedule.eventEndDate !== schedule.eventStartDate;

  // Formatting styling class names
  const weightClass = schedule.isMainSchedule
    ? "font-bold"
    : "font-normal";

  // Rounded corners styling for multi day clamping segments.
  //
  // Story 1.i1g Task 5 (AC7): the grid-variant branch this used to hold (per-segment
  // `rounded-l-md border-r-0` / `rounded-r-md border-l-0` / `rounded-none border-x-0` edge
  // suppression) is gone — a multi-day schedule is now a single spanning bar (Task 2/4) and
  // no longer renders as per-day grid-variant segments at all, so only the mobile list
  // variant's `rounded-md` case remains reachable.
  let multiDayRoundingClass = "";
  if (isMultiDay && variant === 'list') {
    multiDayRoundingClass = "rounded-md";
  }

  const baseButtonClass = isMultiDay ? MULTI_DAY_EVENT_CLASS : EVENT_CARD_COMPACT_CLASS;
  const elementId = cardIdx >= 0 ? `calendar-card-${dayIdx}-${cardIdx}` : undefined;

  const multiDayBadgeText = useMemo(() => {
    if (variant !== 'list' || !isMultiDay) return null;
    const dayNumber = currentDayStr ? diffInDays(schedule.eventStartDate, currentDayStr) + 1 : 1;
    const totalDays = schedule.eventEndDate ? diffInDays(schedule.eventStartDate, schedule.eventEndDate) + 1 : 1;
    return multiDaySegmentLabel
      ? multiDaySegmentLabel(dayNumber, totalDays)
      : `Day ${dayNumber} of ${totalDays}`;
  }, [variant, isMultiDay, currentDayStr, schedule.eventStartDate, schedule.eventEndDate, multiDaySegmentLabel]);

  // Task 3 (Story 1.i1d AC1/AC2/AC4/AC5/AC6/AC7): the `variant === 'list'` (Mobile
  // Vertical Day List) render path restructured into a non-interactive chrome div
  // containing a sibling (event-schedule-click button + EventCardMediaSlot), so the
  // primitive's internal favorite-toggle <button> is never nested inside the
  // schedule-click <button> (AC7, mirrors EventCard.tsx's article > button + RootTag).
  // The `variant === 'grid'` path below is deliberately untouched (AC8).
  if (variant === 'list') {
    const dateBoxContent = computeCalendarSegmentDateBoxContent(
      locale,
      timezone,
      currentDayStr || '',
      schedule.eventStartDate,
      schedule.eventEndDate,
      schedule.eventEndTime,
      tillLabel || 'till'
    );

    // AC1 (Story 1.i1j) — same computation EventCard's masonry variant already uses; no new
    // plumbing, computed per-card from fields WeeklyCalendarViewScheduleShape already carries
    // (Architecture Spine AD-22 Rule 1).
    const { text: statusText, isHappeningNow } = formatEventStatus(
      locale,
      timezone,
      new Date(),
      schedule.eventStartDate,
      schedule.eventStartTime,
      schedule.eventEndDate,
      schedule.eventEndTime,
      statusLabels
    );

    return (
      <div className="relative w-full">
        {/* Story 1.i1m AC6/AC7/Task 3.2/4.1: this row is the CSS container-query root
            (`EVENT_CARD_CONTAINER_CLASS`, reused from Story 1.i1l's masonry mechanism, not
            redefined) for the favorite badge's continuous growth and stepped count text
            (Task 4), and the AD-15 icon-scale custom property's declaration point
            (`badgeFontSizeStyleFor('compact')`). Declaring it here — not on the media slot,
            which may not exist in the DOM once the image is absent/errored (AC1) — is what
            lets the externally-composed favorite badge below inherit both mechanisms via
            ordinary CSS whether or not the slot is mounted. */}
        <div
          className={`${baseButtonClass} ${multiDayRoundingClass} w-full flex items-stretch gap-2 ${EVENT_CARD_CONTAINER_CLASS}`}
          style={badgeFontSizeStyleFor('compact')}
        >
          <button
            id={elementId}
            type="button"
            tabIndex={0}
            className="min-w-0 flex-1 flex items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10 rounded-md"
            onClick={() => onScheduleClick(schedule)}
            onKeyDown={handleKeyDownLocal}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            <EventCardDateBox
              size="compact"
              month={dateBoxContent.month}
              day={dateBoxContent.day}
              tillLabel={dateBoxContent.tillLabel}
            />
            <span className="flex min-w-0 w-full flex-col text-left">
              {/* Rule 6 (Story 1.i1l, DESIGN.md § event_card_compact.title): the title wraps
                  to 2 lines. The parent's own `truncate` is removed deliberately — leaving it
                  clips the row to one line and makes the child's `line-clamp-2` a no-op — and
                  `items-center` becomes `items-start` so the inline favorited /
                  added-to-calendar icons pin to the first line rather than centring against a
                  2-line block. The `variant='grid'` day-cell pill below keeps `truncate`. */}
              <span className="flex items-start gap-1 w-full text-left">
                {schedule.isFavorited && (
                  <Heart className="w-3 h-3 mt-0.5 text-rose-500 fill-rose-500 shrink-0 inline" aria-label={favoritedBadgeLabel || 'Favorited'} data-testid="heart-icon" />
                )}
                {schedule.isAddedToCalendar && (
                  <CalendarPlus className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0 inline" aria-label={addedToCalendarBadgeLabel || 'Added to calendar'} data-testid="calendar-plus-icon" />
                )}
                <span className={`${weightClass} line-clamp-2 block`}>{schedule.eventName}</span>
              </span>
              {schedule.favoriteCount !== undefined && schedule.favoriteCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5" data-testid="favorite-count-line" aria-label="Favorites">
                  {!schedule.isFavorited && <Heart className="w-2.5 h-2.5 text-rose-500 shrink-0 inline" aria-hidden="true" />}
                  <span>{schedule.favoriteCount}</span>
                </span>
              )}
              {isMultiDay && multiDayBadgeText && (
                <span className="text-[11px] text-violet-600 flex items-center gap-1 mt-0.5" data-testid="multi-day-badge">
                  <CalendarRange className="w-3 h-3 shrink-0 inline" aria-hidden="true" />
                  <span>{multiDayBadgeText}</span>
                </span>
              )}
              {/* AC2/AC3/AC4 (Story 1.i1j) — status + nearby badges, appended as the content
                  column's last child. Mirrors EventCard.tsx's masonry `badge_row` classes for
                  visual family consistency (DESIGN.md gives no explicit ordering/gap sub-token
                  of its own for this row — see Dev Notes). */}
              <span className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <EventCardStatusBadge text={statusText} isHappeningNow={isHappeningNow} />
                <EventCardNearbyBadge
                  distanceKm={schedule.distanceKm}
                  thresholdKm={nearbyBadgeThreshold}
                  labels={{ nearbyBadge: nearbyBadgeLabel }}
                />
              </span>
            </span>
          </button>
          <EventCardMediaSlot
            layout="fixed-square"
            size="compact"
            imageUrl={schedule.imageUrl}
            imageAlt={schedule.eventName}
            isFavorited={schedule.isFavorited}
            favoriteCount={schedule.favoriteCount}
            onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(schedule) : undefined}
            labels={{ favoriteToggle: favoriteToggleLabel }}
            collapseOnFallback
            onImagePresenceChange={setImagePresent}
          />
          {/* Story 1.i1m AC1/AC4: the favorite control, externally composed as a plain flex
              sibling (not absolutely positioned — unlike masonry's `EventCard.tsx` overlay,
              this row has no image to overlay when collapsed, so the badge is simply the
              row's last flex child) whenever the media slot above has collapsed to `null`.
              With an image present, the slot's own internal corner-pill badge renders
              instead (unchanged), so this and the slot's internal badge are mutually
              exclusive, never both. */}
          {!imagePresent && (
            <EventCardFavoriteBadge
              scale="large"
              isFavorited={schedule.isFavorited}
              favoriteCount={schedule.favoriteCount}
              onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(schedule) : undefined}
              labels={{ favoriteToggle: favoriteToggleLabel }}
              iconSizeStyle={eventCardRowFavoriteIconGrowingStyle()}
              largeTextSizeClassName={EVENT_CARD_ROW_FAVORITE_COUNT_TEXT_SIZE_CLASS}
            />
          )}
        </div>
      </div>
    );
  }

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
        id={elementId}
        type="button"
        tabIndex={cardIdx >= 0 ? (isRovingActive ? 0 : -1) : 0}
        className={SPANNING_BAR_CLICK_CLASS}
        aria-label={schedule.eventName}
        onClick={() => onScheduleClick(schedule)}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
          eventStartDate={schedule.eventStartDate}
          eventStartTime={schedule.eventStartTime}
          eventEndDate={schedule.eventEndDate}
          eventEndTime={schedule.eventEndTime}
          statusLabels={statusLabels}
          locale={locale}
          timezone={timezone}
          labels={{ favoriteToggle: favoriteToggleLabel, nearbyBadge: nearbyBadgeLabel }}
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
  /** 0-based index of the first visible day-column (AC3) — becomes the CSS grid column start. */
  startColIdx: number;
  /** Number of visible day-columns spanned (AC1/AC3) — becomes the CSS grid column span. */
  spanCount: number;
  /** 0-based banner row index, so overlapping spans stack instead of colliding (AC4). */
  rowIdx: number;
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
  /** BUG-048 (AC-STATUS-1) — forwarded to `EventCardCalendarGridItem`'s internal `formatEventStatus` call. */
  statusLabels?: EventStatusLabels;
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
 * element (AC7), and the click target itself stays a single plain linear Tab stop (AC12) that
 * never joins the day cells' roving tabindex grid.
 *
 * The card layer is purely visual, so the click target carries its own accessible name
 * (`aria-label`) and, while its tooltip is visible, the same `aria-describedby` →
 * `role="tooltip"` date/time range wiring as `CalendarCard`'s grid variant (AC11).
 */
function MultiDaySpanningBar<TSchedule extends WeeklyCalendarViewScheduleShape>({
  schedule,
  startColIdx,
  spanCount,
  rowIdx,
  locale,
  timezone,
  onScheduleClick,
  onFavoriteToggle,
  favoriteToggleLabel,
  nearbyBadgeThreshold,
  statusLabels,
}: MultiDaySpanningBarProps<TSchedule>) {
  // Tooltip visibility states — same hover/focus/Escape model as CalendarCard's grid variant.
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const tooltipVisible = (isHovered || isFocused) && !isDismissed;

  const tooltipText = useMemo(() => {
    return formatTooltipTimeRange(
      locale,
      timezone,
      schedule.eventStartDate,
      schedule.eventEndDate,
      schedule.eventStartTime,
      schedule.eventEndTime
    );
  }, [locale, timezone, schedule]);

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') {
      setIsDismissed(false);
      setIsHovered(true);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') {
      setIsHovered(false);
    }
  };

  const handleFocus = () => {
    setIsDismissed(false);
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDismissed(true);
    }
  };

  const tooltipId = `spanning-tooltip-${schedule.id}`;

  return (
    <div
      className="relative w-full"
      data-testid="multi-day-spanning-bar"
      data-schedule-id={schedule.id}
      // AC1/AC3 — explicit column start + span and an explicit row, so the bar physically
      // spans its day-columns within the shared `GRID_WEEKLY_CLASS` template and never
      // auto-places into a neighbouring row.
      style={{ gridColumn: `${startColIdx + 1} / span ${spanCount}`, gridRow: `${rowIdx + 1}` }}
    >
      {/* AC12 — the schedule-click target: a real button (Enter/Space, focus-visible ring,
          one linear Tab stop) sitting underneath the visual card layer. */}
      <button
        type="button"
        tabIndex={0}
        className={SPANNING_BAR_CLICK_CLASS}
        aria-label={schedule.eventName}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        onClick={() => onScheduleClick(schedule)}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDownLocal}
      />

      {/* AC7/AC8/AC9 — the visible card is `EventCardCalendarGridItem` (Story 1.i1f) in its
          multi-day composition, wrapped so its own internal favorite-toggle button is the only
          interactive element inside this layer. */}
      <div className={SPANNING_BAR_VISUAL_CLASS}>
        <EventCardCalendarGridItem
          eventName={schedule.eventName}
          location={schedule.locationName}
          imageUrl={schedule.imageUrl}
          imageAlt={schedule.eventName}
          isMultiDay
          isFavorited={schedule.isFavorited}
          favoriteCount={schedule.favoriteCount}
          onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(schedule) : undefined}
          distanceKm={schedule.distanceKm}
          nearbyBadgeThreshold={nearbyBadgeThreshold}
          eventStartDate={schedule.eventStartDate}
          eventStartTime={schedule.eventStartTime}
          eventEndDate={schedule.eventEndDate}
          eventEndTime={schedule.eventEndTime}
          statusLabels={statusLabels}
          locale={locale}
          timezone={timezone}
          labels={{ favoriteToggle: favoriteToggleLabel }}
        />
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

