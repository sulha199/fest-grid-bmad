"use client";

import React, { useMemo, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations, useLocale } from 'next-intl';
import { useQueries } from '@tanstack/react-query';
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
  formatLocalizedNearbyBadgeDistance,
  type WeeklyCalendarViewDayContinuation,
} from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';
import { NearbyFilterInput } from '@festgrid/domain/events';
import { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';
import { mapDaysOfWeekToDomain } from '@/lib/day-of-week-mapping';

// Falls back to the raw enum value if a translation key is missing, matching the same
// pattern already established in home-content.tsx/feed-content.tsx/etc.
function buildEnumLabels(values: string[], translate: (key: string) => string) {
  return Object.fromEntries(values.map((value) => [value, translate(value)]));
}

/**
 * Story 1.3k Task 9 (AC2/AC3 end-to-end) — maps every schedule's GraphQL-typed
 * `applicableDaysOfWeek` to the domain enum before the events reach `useWeeklyCalendarController`
 * (whose shared `mapCalendarSchedules` lives in packages/ui and must not import apps/web's
 * generated types/mapping module — see the story's "Mapping boundary placement" Dev Note).
 */
function mapEventsDayOfWeek<T extends { schedules?: ({ applicableDaysOfWeek?: any } | null | undefined)[] | null }>(
  events: T[] | null | undefined
): T[] | undefined {
  return events?.map((event) => ({
    ...event,
    schedules: (event.schedules ?? []).map((schedule) => ({
      ...schedule,
      applicableDaysOfWeek: mapDaysOfWeekToDomain(schedule?.applicableDaysOfWeek),
    })),
  })) as T[] | undefined;
}

/**
 * Story 1.i1h AC2 — EXPERIENCE.md's decided practical fallback, sent as `Query.events`'s new
 * optional `perDayLimit` argument so the resolver gives every day of the visible week its own fair
 * slice instead of letting one popular day consume the whole flat row budget (AC1/BUG-036).
 */
const CALENDAR_PER_DAY_LIMIT = 20;
/** Rows per continuation page for a truncated day (same size as the per-day window). */
const CALENDAR_DAY_PAGE_SIZE = CALENDAR_PER_DAY_LIMIT;
const EMPTY_DAY_PAGES: Record<string, number> = {};

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
  const tCalendar = useTranslations('WeeklyCalendarView');
  const tDayOfWeek = useTranslations('DayOfWeek');
  const locale = useLocale();

  // Story 1.3k Task 8 (AC9) — DayOfWeek i18n namespace, resolved once per render and passed
  // through to WeeklyCalendarView/EventCardRepeatBadge as `dayOfWeekLabels`.
  const dayOfWeekLabels = useMemo(
    () => buildEnumLabels(Object.values(DomainDayOfWeek), tDayOfWeek),
    [tDayOfWeek]
  );
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

  // Story 1.3k Task 9 (AC2/AC3 end-to-end) — GQL-to-domain enum mapping applied before the raw
  // events reach `useWeeklyCalendarController`'s shared `mapCalendarSchedules` (packages/ui).
  const mappedRawEvents = useMemo(() => mapEventsDayOfWeek(data?.events?.items), [data?.events?.items]);

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
    rawEvents: mappedRawEvents,
    queryStatus,
    queryError,
    errorStateLabel: t('calendarErrorState'),
    viewerCoord,
    onNavigate: (direction, newWeek) => {
      posthog.capture('calendar_week_navigated', { direction, weekStart: newWeek });
    },
  });

  // ---------------------------------------------------------------------------------------------
  // Day-scoped continuation (spec-calendar-unified-banded-grid; Story 1.i1h's single-day query)
  // ---------------------------------------------------------------------------------------------
  // The week fetch returns at most `CALENDAR_PER_DAY_LIMIT` single-day rows per day. When
  // `WeeklyCalendarView` needs more of a truncated day (desktop bands, or the mobile day list) it
  // calls `onDayContinuationRequested(date)`, and further pages come from `fetchNextPage`. Several
  // days can be continued at once, so this is one plain query per requested (day, page) via
  // `useQueries` — React Query stays here, never in `packages/ui`.
  //
  // Each query is narrowed to the exact day with `weekStart === weekEnd`, the same
  // `scheduleDateRange` shape the resolver's single-exact-date ordering keys off, and uses the flat
  // `offset`/`limit` path (no `perDayLimit`): page `i` starts at `PER_DAY_LIMIT + i * PAGE_SIZE`,
  // continuing exactly where the windowed week fetch stopped for that day.
  const dayToken = useMemo(() => JSON.stringify(queryCondition), [queryCondition]);
  const [dayPageState, setDayPageState] = useState<{ token: string; pages: Record<string, number> }>({
    token: '',
    pages: {},
  });
  const dayPages = dayPageState.token === dayToken ? dayPageState.pages : EMPTY_DAY_PAGES;
  const requestedDates = Object.keys(dayPages);

  const dayQueries = useQueries({
    queries: requestedDates.flatMap((date) =>
      Array.from({ length: dayPages[date] }, (_, pageIdx) => {
        const condition = buildWeeklyCalendarQueryCondition({
          search: q,
          types,
          categories,
          weekStart: date,
          weekEnd: date,
          nearby,
        });
        return {
          queryKey: ['events', 'calendar-day', date, condition, pageIdx],
          queryFn: () =>
            graphqlClient.request<GetEventsForCalendarQuery>(GetEventsForCalendarDocument, {
              offset: CALENDAR_PER_DAY_LIMIT + pageIdx * CALENDAR_DAY_PAGE_SIZE,
              limit: CALENDAR_DAY_PAGE_SIZE,
              query: condition as EventQueryConditionInput | undefined,
            }),
        };
      })
    ),
  });

  const requestDayContinuation = (date: string) => {
    setDayPageState((prev) => {
      const pages = prev.token === dayToken ? prev.pages : {};
      if (pages[date]) return prev;
      return { token: dayToken, pages: { ...pages, [date]: 1 } };
    });
    posthog.capture('calendar_day_continuation_requested', { date });
  };

  const dayContinuations = useMemo(() => {
    const result: Record<string, WeeklyCalendarViewDayContinuation<(typeof schedules)[number]>> = {};
    let cursor = 0;
    requestedDates.forEach((date) => {
      const pageCount = dayPages[date];
      const results = dayQueries.slice(cursor, cursor + pageCount);
      cursor += pageCount;
      const loadedPages = results.filter((r) => r.data).map((r) => r.data as GetEventsForCalendarQuery);
      const hasPending = results.some((r) => r.isPending || r.isFetching);
      const failed = results.find((r) => r.isError);
      const lastPage = loadedPages[loadedPages.length - 1];
      result[date] = {
        items: mapCalendarSchedules(
          mapEventsDayOfWeek(loadedPages.flatMap((page) => page.events.items)),
          viewerCoord
        ),
        // Until every requested page has landed we cannot know the day is exhausted.
        hasNextPage: hasPending || !!failed || !!lastPage?.events.hasMore,
        isFetchingNextPage: hasPending,
        fetchNextPage: () => {
          if (hasPending) return;
          if (failed) {
            void failed.refetch();
            return;
          }
          setDayPageState((prev) => {
            const pages = prev.token === dayToken ? prev.pages : {};
            return { token: dayToken, pages: { ...pages, [date]: (pages[date] ?? 0) + 1 } };
          });
        },
      };
    });
    return result;
    // `dayQueries` is a fresh array each render; its contents drive this memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayQueries, dayPages, dayToken, viewerCoord]);

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
    belowLabel: (count: number, hasMore: boolean) =>
      t('calendarBelowLabel', { count: count === 0 ? '…' : hasMore ? `${count}+` : String(count) }),
    progressLabel: (shown: number, total: string) => t('calendarProgressLabel', { shown, total }),
    allShownLabel: (total: number) => t('calendarAllShownLabel', { total }),
    loadMoreLabel: t('calendarLoadMoreLabel'),
    loadingMoreLabel: t('calendarLoadingMoreLabel'),
    multiDaySegmentLabel: (dayNumber: number, totalDays: number) => t('calendarMultiDaySegmentLabel', { dayNumber, totalDays }),
    loadingText: tCalendar('loadingText'),
    favoriteToggleLabel: tCalendar('favoriteToggleLabel'),
    favoritedBadgeLabel: tCalendar('favoritedBadgeLabel'),
    addedToCalendarBadgeLabel: tCalendar('addedToCalendarBadgeLabel'),
    tillLabel: tCalendar('tillLabel'),
    statusEnded: tCalendar('statusEnded'),
    statusHappeningNow: tCalendar('statusHappeningNow'),
    statusEndsToday: tCalendar('statusEndsToday'),
    statusEndsAt: tCalendar.raw('statusEndsAt'),
    statusInHours: tCalendar.raw('statusInHours'),
    statusInDays: tCalendar.raw('statusInDays'),
    statusUpcoming: tCalendar('statusUpcoming'),
    tomorrow: tCalendar('tomorrow'),
    nearbyBadge: (distanceKm: number) => formatLocalizedNearbyBadgeDistance(locale, distanceKm),
    dayOfWeekLabels,
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
      getWeekRange={getWeekRange}
      onToday={handleToday}
      onPrevWeek={handlePrevWeek}
      isPrevWeekDisabled={isPrevWeekDisabled}
      onNextWeek={handleNextWeek}
      onSelectWeek={handleSelectWeek}
      onScheduleClick={handleScheduleClick}
      nearbyBadgeThreshold={nearbyBadgeThreshold}
      // Truncated days continue through the day-scoped queries above (desktop bands + mobile list).
      dayFetchLimit={CALENDAR_PER_DAY_LIMIT}
      dayContinuations={dayContinuations}
      onDayContinuationRequested={requestDayContinuation}
      resetKey={dayToken}
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
