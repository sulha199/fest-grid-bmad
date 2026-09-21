"use client";

import React, { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useGetEventsForCalendarQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildWeeklyCalendarQueryCondition } from '@festgrid/domain/events';
import { WeeklyCalendarView, useWeeklyCalendarController, getWeekStart, getWeekEnd } from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';
import { NearbyFilterInput } from '@festgrid/domain/events';

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
      limit: 1000, // Large limit for calendar entries
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
