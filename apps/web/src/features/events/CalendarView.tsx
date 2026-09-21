"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
import {
  useGetEventsForCalendarQuery,
  GetEventsForCalendarDocument,
  GetEventsForCalendarQuery,
  EventQueryConditionInput,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildWeeklyCalendarQueryCondition } from '@festgrid/domain/events';
import {
  WeeklyCalendarView,
  useWeeklyCalendarController,
  getWeekStart,
  getWeekEnd,
  mapCalendarSchedules,
  type WeeklyCalendarViewOverflowSurface,
} from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';
import { NearbyFilterInput } from '@festgrid/domain/events';

/**
 * Story 1.i1h AC2 — EXPERIENCE.md's decided practical fallback, sent as `Query.events`'s new
 * optional `perDayLimit` argument so the resolver gives every day of the visible week its own fair
 * slice instead of letting one popular day consume the whole flat row budget (AC1/BUG-036).
 */
const CALENDAR_PER_DAY_LIMIT = 20;
/**
 * Story 1.i1h AC5/AD-2 — the overflow dialog's own "load more for this day" page size. It reuses
 * `Query.events` **without** `perDayLimit` (the already-single-day call must take the existing flat
 * path, not re-window), continuing from the windowed week-fetch's per-day `N` — hence
 * `initialPageParam: CALENDAR_PER_DAY_LIMIT` below.
 */
const CALENDAR_OVERFLOW_PAGE_SIZE = CALENDAR_PER_DAY_LIMIT;

interface CalendarViewProps {
  q: string;
  types: string[];
  categories: string[];
  nearby?: NearbyFilterInput;
  /** Story 1.i1f AC13-14: the active nearby-filter's resolved coordinate, threaded into `useWeeklyCalendarController` for per-schedule `distanceKm`. `FeedCalendarView`/`AccountCalendarView`/`my-calendar-content` have no nearby-filter plumbing today and do not pass this. */
  viewerCoord?: { latitude: number; longitude: number };
  /**
   * Distance threshold (km) for the spanning card's nearby badge, forwarded to
   * `WeeklyCalendarView` → `EventCardCalendarGridItem`. Derived from
   * `NEXT_PUBLIC_NEARBY_BADGE_DISTANCE_KM` by the caller so the configured override reaches the
   * calendar surface the same way it reaches the masonry `EventCard` (Story 1.i1f review
   * finding, `FIND-045`). Omit to keep the card's own `8` default.
   */
  nearbyBadgeThreshold?: number;
  onFavoriteToggle?: (eventId: string) => void;
}

export function CalendarView({ q, types, categories, nearby, viewerCoord, nearbyBadgeThreshold, onFavoriteToggle }: CalendarViewProps) {
  const t = useTranslations('DiscoveryPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [week, setWeek] = useQueryState(
    'week',
    parseAsString.withDefault(todayStr)
  );

  const weekStart = useMemo(() => getWeekStart(week), [week]);
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

  const queryCondition = useMemo(() => {
    return buildWeeklyCalendarQueryCondition({
      search: q,
      types,
      categories,
      weekStart,
      weekEnd,
      nearby,
    });
  }, [q, types, categories, weekStart, weekEnd, nearby]);

  const { data, status: queryStatus, error: queryError } = useGetEventsForCalendarQuery(
    graphqlClient,
    {
      // Story 1.i1h Task 5.2 / AC1/AC3 — `perDayLimit` opts the resolver into its new schedule-first
      // windowed path, which makes `limit` meaningless (the per-day window *is* the budget), so the
      // old `limit: 1000` is deliberately dropped rather than kept as a no-op.
      perDayLimit: CALENDAR_PER_DAY_LIMIT,
      query: queryCondition,
    },
    {
      // Refetch when the query condition changes
      queryKey: ['events', 'calendar', queryCondition],
    }
  );

  const {
    schedules,
    status,
    errorMessage,
    errorDetail,
    handlePrevWeek,
    handleNextWeek,
    handleSelectWeek,
    handleToday,
    isPrevWeekDisabled,
  } = useWeeklyCalendarController({
    week,
    setWeek: (newWeek: string) => {
      setWeek(newWeek);
    },
    todayStr,
    rawEvents: data?.events?.items,
    queryStatus,
    queryError,
    errorStateLabel: t('calendarErrorState'),
    viewerCoord,
    onNavigate: (direction, newWeek) => {
      posthog.capture('calendar_week_navigated', { direction, weekStart: newWeek });
    },
  });

  // ---------------------------------------------------------------------------------------------
  // Story 1.i1h Task 8 — the day-scoped "load more for this day" fetch behind `CalendarOverflowDialog`
  // ---------------------------------------------------------------------------------------------
  // React Query lives here (never in `packages/ui`) per project-context.md's State Management
  // Architecture rule; `WeeklyCalendarView` owns only the open/closed UI state and receives this
  // result as plain props (`overflowDialogData`).
  const [openOverflowDate, setOpenOverflowDate] = useState<string | null>(null);

  /**
   * AC5/Task 8.3 — narrowed to the *exact* open day by feeding the day into the same
   * `buildWeeklyCalendarQueryCondition` helper with `weekStart === weekEnd`, which is precisely the
   * `{field: 'scheduleDateRange', operator: 'overlaps', value: {from, to}}` shape the resolver's
   * single-exact-date tie-break (Task 4) keys off — so this continuation call is guaranteed to share
   * the windowed fetch's ordering and never duplicate or skip a row (AC6). Every other filter
   * (search/types/categories/nearby) is preserved, so the dialog lists exactly what the calendar
   * fetch would have listed for that day had the cap not hidden it.
   */
  const overflowQueryCondition = useMemo(() => {
    if (openOverflowDate == null) return undefined;
    return buildWeeklyCalendarQueryCondition({
      search: q,
      types,
      categories,
      weekStart: openOverflowDate,
      weekEnd: openOverflowDate,
      nearby,
    });
  }, [openOverflowDate, q, types, categories, nearby]);

  const {
    data: overflowData,
    fetchNextPage: fetchOverflowNextPage,
    hasNextPage: hasOverflowNextPage,
    isFetchingNextPage: isFetchingOverflowNextPage,
  } = useInfiniteQuery<GetEventsForCalendarQuery, Error, InfiniteData<GetEventsForCalendarQuery>, any[], number>({
    queryKey: ['events', 'calendar-overflow', openOverflowDate, overflowQueryCondition],
    // The week-level `enabled: false` guard is what keeps this query completely dormant — and
    // therefore untouched/regression-free — until a "+N more" trigger actually opens the dialog.
    enabled: openOverflowDate != null,
    initialPageParam: CALENDAR_OVERFLOW_PAGE_SIZE,
    queryFn: async ({ pageParam }) => {
      // No `perDayLimit` here on purpose (AD-2): the condition is already a single-day window, so
      // re-windowing it would be redundant; this is the existing flat `offset`/`limit` path.
      return graphqlClient.request<GetEventsForCalendarQuery>(GetEventsForCalendarDocument, {
        offset: pageParam as number,
        limit: CALENDAR_OVERFLOW_PAGE_SIZE,
        query: overflowQueryCondition as EventQueryConditionInput | undefined,
      });
    },
    getNextPageParam: (lastPage, allPages) =>
      // Page 1 already starts at offset 20 (continuing the windowed fetch's own per-day `N`), so
      // page k starts at `k * PAGE_SIZE`: page 2 continues at offset 40, not 20.
      lastPage.events.hasMore ? (allPages.length + 1) * CALENDAR_OVERFLOW_PAGE_SIZE : undefined,
  });

  /**
   * AC9 — `calendar_overflow_more_loaded`, fired once per *additional* page that actually resolves.
   * React Query v5 removed query-level `onSuccess`, and firing from inside `getNextPageParam` would
   * put a side effect in a pure callback, so this effect is the sanctioned shape: a ref tracks the
   * highest page count already reported, which both suppresses duplicate reports for a refetch of
   * the same page and survives the day switching underneath (a new `queryKey` resets it).
   */
  const announcedPageCountRef = useRef(0);
  useEffect(() => {
    const pages = overflowData?.pages;
    if (!pages || openOverflowDate == null) {
      announcedPageCountRef.current = 0;
      return;
    }
    if (pages.length <= announcedPageCountRef.current) return;
    announcedPageCountRef.current = pages.length;
    // Page 1 is the windowed fetch's own first 20, already counted by the dialog-opened event — only
    // genuine "load more" resolutions are reported (Task 8.4).
    if (pages.length < 2) return;
    posthog.capture('calendar_overflow_more_loaded', {
      date: openOverflowDate,
      // Page k (1-indexed) starts at `k * PAGE_SIZE` — page 1 is offset 20, page 2 offset 40.
      offset: pages.length * CALENDAR_OVERFLOW_PAGE_SIZE,
      loadedCount: pages[pages.length - 1].events.items.length,
    });
  }, [overflowData, openOverflowDate, posthog]);

  /**
   * Task 8.3 — the dialog's item list is a *merge*, never a replacement: the week-level windowed
   * fetch already carries this day's first `perDayLimit` occurrences client-side (that is literally
   * what makes the "+N more" count meaningful), so the pages resolved here are appended and
   * schedule-id-deduped on top of the local day bucket.
   */
  const overflowDialogItems = useMemo(() => {
    if (openOverflowDate == null) return [];
    const localDaySchedules = schedules.filter(
      (schedule: { eventStartDate: string; eventEndDate?: string | null }) =>
        schedule.eventStartDate <= openOverflowDate &&
        (schedule.eventEndDate ?? schedule.eventStartDate) >= openOverflowDate
    );
    const additionalPageSchedules = mapCalendarSchedules(
      (overflowData?.pages ?? []).flatMap((page) => page.events.items),
      viewerCoord
    );

    const seenIds = new Set(localDaySchedules.map((schedule: { id: string }) => schedule.id));
    const merged = [...localDaySchedules];
    for (const schedule of additionalPageSchedules) {
      if (seenIds.has(schedule.id)) continue;
      seenIds.add(schedule.id);
      merged.push(schedule);
    }
    return merged;
  }, [openOverflowDate, schedules, overflowData, viewerCoord]);

  const handleOverflowRequested = (
    date: string,
    surface: WeeklyCalendarViewOverflowSurface,
    inlineHiddenCount: number
  ) => {
    setOpenOverflowDate(date);
    posthog.capture('calendar_overflow_dialog_opened', { date, surface, inlineHiddenCount });
  };

  const handleOverflowClose = () => setOpenOverflowDate(null);

  const handleScheduleClick = (schedule: { eventSlug: string }) => {
    const paramsStr = searchParams.toString();
    const url = `/events/${schedule.eventSlug}?fromList=true${paramsStr ? `&${paramsStr}` : ''}`;
    router.push(url);
  };

  const labels = {
    prevWeekLabel: t('calendarPrevWeekLabel'),
    nextWeekLabel: t('calendarNextWeekLabel'),
    todayLabel: t('calendarTodayLabel'),
    selectWeekLabel: t('calendarSelectWeekLabel'),
    chooseWeekLabel: t('calendarChooseWeekLabel'),
    moreLabel: (count: number) => t('calendarMoreLabel', { count }),
    multiDaySegmentLabel: (dayNumber: number, totalDays: number) => t('calendarMultiDaySegmentLabel', { dayNumber, totalDays }),
    closePopoverLabel: t('calendarClosePopoverLabel'),
    overflowDialogTitleLabel: (dayLabel: string) => t('calendarOverflowDialogTitleLabel', { day: dayLabel }),
  };

  const getWeekRange = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    const start = new Date(`${getWeekStart(iso)}T12:00:00Z`);
    const end = new Date(`${getWeekEnd(getWeekStart(iso))}T12:00:00Z`);
    return { start, end };
  };

  return (
    <WeeklyCalendarView
      weekStart={weekStart}
      schedules={schedules}
      maxEventsPerDay={5}
      getWeekRange={getWeekRange}
      onToday={handleToday}
      onPrevWeek={handlePrevWeek}
      isPrevWeekDisabled={isPrevWeekDisabled}
      onNextWeek={handleNextWeek}
      onSelectWeek={handleSelectWeek}
      onScheduleClick={handleScheduleClick}
      nearbyBadgeThreshold={nearbyBadgeThreshold}
      onOverflowRequested={handleOverflowRequested}
      onOverflowClosed={handleOverflowClose}
      // Task 8.3 — the day-scoped pagination result, threaded down as plain props so
      // `WeeklyCalendarView`/`CalendarOverflowDialog` stay free of React Query.
      overflowDialogData={{
        items: overflowDialogItems,
        fetchNextPage: fetchOverflowNextPage,
        hasNextPage: !!hasOverflowNextPage,
        isFetchingNextPage: isFetchingOverflowNextPage,
      }}
      onFavoriteToggle={
        onFavoriteToggle
          ? (schedule) => schedule.eventId && onFavoriteToggle(schedule.eventId)
          : undefined
      }
      status={status === 'pending' ? 'loading' : (status as any)}
      errorMessage={errorMessage}
      errorDetail={errorDetail}
      labels={labels}
    />
  );
}
