"use client"

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Heart, CalendarPlus } from 'lucide-react';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
import type {
  WeeklyCalendarViewProps,
  WeeklyCalendarViewScheduleShape,
} from './WeeklyCalendarView.types';

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
 * WeeklyCalendarView is a reusable, presentational calendar component.
 * It displays a weekly calendar grid, handles pagination events, displays schedule cards,
 * supports overflow "+N more" popovers, roving-tabindex accessibility, custom hover tooltips,
 * and handles skeleton loading/error status displays.
 */
export function WeeklyCalendarView<TSchedule extends WeeklyCalendarViewScheduleShape = WeeklyCalendarViewScheduleShape>({
  weekStart,
  schedules,
  maxEventsPerDay,
  onToday,
  onPrevWeek,
  onNextWeek,
  onScheduleClick,
  status,
  errorMessage,
  errorDetail,
  locale,
  timezone,
  labels = {},
  className = '',
}: WeeklyCalendarViewProps<TSchedule>) {
  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();

  const activeLocale = locale || contextLocale;
  const activeTimezone = timezone || contextTimezone;

  const defaultLabels = {
    prevWeekLabel: 'Previous week',
    nextWeekLabel: 'Next week',
    todayLabel: 'Today',
    closePopoverLabel: 'Close details',
    loadingText: 'Loading calendar view...',
    favoritedBadgeLabel: 'Favorited',
    addedToCalendarBadgeLabel: 'Added to calendar',
    ...labels,
  };

  // 1. Compute the 7 visible days of the week starting from weekStart
  const visibleDays = useMemo(() => {
    const baseDate = typeof weekStart === 'string' ? new Date(weekStart) : new Date(weekStart);
    // Force set to noon to avoid daylight saving hour boundary issues shifting days
    baseDate.setHours(12, 0, 0, 0);
    
    // Find the day of the week (0-6).
    const dayOfWeek = baseDate.getDay();
    // Calculate start of week (Sunday as first day)
    const sundayOffset = dayOfWeek;
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - sundayOffset);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(startOfWeek);
      nextDay.setDate(startOfWeek.getDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [weekStart]);

  const weekEnd = visibleDays[6];

  // Helper to normalize a date object to YYYY-MM-DD for reliable string comparisons
  const toISODateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  // 3. Roving Tabindex State & Arrow-key Nav implementation
  const [activeCardCoords, setActiveCardCoords] = useState<{ dayIdx: number; cardIdx: number } | null>(null);

  // Flattened grid of accessible cards (excluding popover-only elements) for Arrow movements
  const gridCards = useMemo(() => {
    const cards: { dayIdx: number; cardIdx: number; key: string }[] = [];
    dayBuckets.forEach((bucket, dayIdx) => {
      const displayCount = maxEventsPerDay === -1 ? bucket.length : Math.min(maxEventsPerDay, bucket.length);
      for (let cardIdx = 0; cardIdx < displayCount; cardIdx++) {
        cards.push({ dayIdx, cardIdx, key: `${dayIdx}-${cardIdx}` });
      }
    });
    return cards;
  }, [dayBuckets, maxEventsPerDay]);

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
        const targetBucket = dayBuckets[targetDayIdx];
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

  // 4. Popover state & focus trap implementation
  const [openPopoverDayIdx, setOpenPopoverDayIdx] = useState<number | null>(null);
  const popoverTriggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const popoverContainerRef = useRef<HTMLDivElement>(null);

  const handleOpenPopover = (dayIdx: number) => {
    setOpenPopoverDayIdx(dayIdx);
  };

  const handleClosePopover = () => {
    const prevTrigger = openPopoverDayIdx !== null ? popoverTriggerRefs.current[openPopoverDayIdx] : null;
    setOpenPopoverDayIdx(null);
    if (prevTrigger) {
      setTimeout(() => prevTrigger.focus(), 0);
    }
  };

  // Focus trap inside Popover
  useEffect(() => {
    if (openPopoverDayIdx === null) return;

    const container = popoverContainerRef.current;
    if (container) {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClosePopover();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
      );

      const focusableElements = Array.from(focusable).filter((el) => el.tabIndex !== -1);

      if (focusableElements.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === container) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Close on outside click
    const handleOutsideClick = (e: PointerEvent) => {
      if (container && !container.contains(e.target as Node)) {
        // Verify we aren't clicking the popover trigger itself
        const trigger = popoverTriggerRefs.current[openPopoverDayIdx];
        if (trigger && trigger.contains(e.target as Node)) {
          return;
        }
        handleClosePopover();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [openPopoverDayIdx]);

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
        <div className={GRID_WEEKLY_CLASS}>
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
            className={NAV_BUTTON_CLASS}
            onClick={onPrevWeek}
            aria-label={defaultLabels.prevWeekLabel}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
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

      {/* Day cells grid */}
      <div className={GRID_WEEKLY_CLASS}>
        {dayBuckets.map((bucket, dayIdx) => {
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
                  onKeyDown={(e) => handleGridKeyDown(e, dayIdx, cardIdx)}
                  onFocus={() => setActiveCardCoords({ dayIdx, cardIdx })}
                  favoritedBadgeLabel={defaultLabels.favoritedBadgeLabel}
                  addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                />
              ))}

              {/* "+N more" affordance (AC5) */}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  ref={(el) => {
                    popoverTriggerRefs.current[dayIdx] = el;
                  }}
                  className={MORE_LINK_CLASS}
                  onClick={() => handleOpenPopover(dayIdx)}
                  aria-expanded={openPopoverDayIdx === dayIdx}
                  aria-haspopup="dialog"
                >
                  {labels.moreLabel ? labels.moreLabel(hiddenCount) : `+${hiddenCount} more`}
                </button>
              )}

              {/* Floating popover disclosure (AC5) */}
              {openPopoverDayIdx === dayIdx && (
                <div
                  ref={popoverContainerRef}
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Schedules for ${formatDayHeader(activeLocale, activeTimezone, visibleDays[dayIdx])}`}
                  className="absolute left-1/2 -translate-x-1/2 bottom-1 z-40 bg-white border border-gray-300 rounded-lg shadow-xl p-3 w-56 max-h-56 overflow-y-auto flex flex-col gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-700">All Schedules</span>
                    <button
                      type="button"
                      onClick={handleClosePopover}
                      aria-label={defaultLabels.closePopoverLabel}
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-500 focus-visible:ring-1 focus-visible:ring-violet-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {bucket.map((seg) => (
                      <CalendarCard
                        key={`popover-${seg.schedule.id}`}
                        segment={seg}
                        dayIdx={dayIdx}
                        cardIdx={-1} // Non-grid/no roving tabindex within popover
                        isRovingActive={false}
                        locale={activeLocale}
                        timezone={activeTimezone}
                        onScheduleClick={(s) => {
                          handleClosePopover();
                          onScheduleClick(s);
                        }}
                        favoritedBadgeLabel={defaultLabels.favoritedBadgeLabel}
                        addedToCalendarBadgeLabel={defaultLabels.addedToCalendarBadgeLabel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  favoritedBadgeLabel?: string;
  addedToCalendarBadgeLabel?: string;
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
  onKeyDown,
  onFocus,
  favoritedBadgeLabel,
  addedToCalendarBadgeLabel,
}: CalendarCardProps<TSchedule>) {
  const { schedule, isFirstSegment, isLastSegment } = segment;

  // Tooltip visibility states
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
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDismissed(true);
    }
    onKeyDown?.(e);
  };

  const isMultiDay = schedule.eventEndDate && schedule.eventEndDate !== schedule.eventStartDate;

  // Formatting styling class names
  const weightClass = schedule.isMainSchedule
    ? "font-bold"
    : "font-normal";

  // Rounded corners styling for multi day clamping segments
  let multiDayRoundingClass = "";
  if (isMultiDay) {
    if (isFirstSegment && isLastSegment) {
      multiDayRoundingClass = "rounded-md";
    } else if (isFirstSegment) {
      multiDayRoundingClass = "rounded-l-md border-r-0";
    } else if (isLastSegment) {
      multiDayRoundingClass = "rounded-r-md border-l-0";
    } else {
      multiDayRoundingClass = "rounded-none border-x-0";
    }
  }

  const baseButtonClass = isMultiDay ? MULTI_DAY_EVENT_CLASS : EVENT_CARD_COMPACT_CLASS;
  const elementId = cardIdx >= 0 ? `calendar-card-${dayIdx}-${cardIdx}` : undefined;

  return (
    <div className="relative w-full">
      <button
        id={elementId}
        type="button"
        tabIndex={cardIdx >= 0 ? (isRovingActive ? 0 : -1) : 0}
        className={`${baseButtonClass} ${multiDayRoundingClass} w-full truncate block`}
        onClick={() => onScheduleClick(schedule)}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDownLocal}
        aria-describedby={tooltipVisible ? `tooltip-${dayIdx}-${schedule.id}` : undefined}
      >
        <span className="flex items-center gap-1 w-full truncate text-left">
          {schedule.isFavorited && (
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 shrink-0 inline" aria-label={favoritedBadgeLabel || 'Favorited'} data-testid="heart-icon" />
          )}
          {schedule.isAddedToCalendar && (
            <CalendarPlus className="w-3 h-3 text-emerald-600 shrink-0 inline" aria-label={addedToCalendarBadgeLabel || 'Added to calendar'} data-testid="calendar-plus-icon" />
          )}
          <span className={`${weightClass} truncate block`}>{schedule.eventName}</span>
        </span>
      </button>

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
