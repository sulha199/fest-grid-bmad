"use client";

import React, { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations, useLocale } from 'next-intl';
import { useGetEventsForCalendarQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildFeedCalendarQueryCondition } from '@festgrid/domain/events';
import { WeeklyCalendarView, useWeeklyCalendarController, getWeekStart, getWeekEnd, formatLocalizedNearbyBadgeDistance } from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';
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

interface FeedCalendarViewProps {
  q: string;
  types: string[];
  categories: string[];
  subscriptions: string[];
  onFavoriteToggle?: (eventId: string) => void;
}

export function FeedCalendarView({ q, types, categories, subscriptions, onFavoriteToggle }: FeedCalendarViewProps) {
  const t = useTranslations('FeedPage');
  const tCalendar = useTranslations('WeeklyCalendarView');
  const tDayOfWeek = useTranslations('DayOfWeek');
  const locale = useLocale();

  // Story 1.3k Task 8 (AC9) — DayOfWeek i18n namespace, passed through to WeeklyCalendarView as
  // `dayOfWeekLabels`.
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
    return buildFeedCalendarQueryCondition({
      search: q,
      types,
      categories,
      weekStart,
      weekEnd,
      subscriptions,
    });
  }, [q, types, categories, weekStart, weekEnd, subscriptions]);

  const { data, status: queryStatus, error: queryError } = useGetEventsForCalendarQuery(
    graphqlClient,
    {
      limit: 1000,
      query: queryCondition,
    },
    {
      queryKey: ['events', 'feed-calendar', queryCondition],
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
    onNavigate: (direction, newWeek) => {
      posthog.capture('calendar_week_navigated', { direction, weekStart: newWeek });
    },
  });

  const handleScheduleClick = (schedule: { eventSlug: string }) => {
    const paramsStr = searchParams.toString();
    const url = `/events/${schedule.eventSlug}?fromList=feed${paramsStr ? `&${paramsStr}` : ''}`;
    router.push(url);
  };

  const labels = {
    prevWeekLabel: t('calendarPrevWeekLabel'),
    nextWeekLabel: t('calendarNextWeekLabel'),
    todayLabel: t('calendarTodayLabel'),
    selectWeekLabel: t('calendarSelectWeekLabel'),
    chooseWeekLabel: t('calendarChooseWeekLabel'),
    moreLabel: (count: number) => t('calendarMoreLabel', { count }),
    loadMoreLabel: t('calendarLoadMoreLabel'),
    loadingMoreLabel: t('calendarLoadingMoreLabel'),
    multiDaySegmentLabel: (dayNumber: number, totalDays: number) => t('calendarMultiDaySegmentLabel', { dayNumber, totalDays }),
    closePopoverLabel: t('calendarClosePopoverLabel'),
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

  return (
    <WeeklyCalendarView
      weekStart={weekStart}
      schedules={schedules}
      maxEventsPerDay={5}
      onToday={handleToday}
      onPrevWeek={handlePrevWeek}
      isPrevWeekDisabled={isPrevWeekDisabled}
      onNextWeek={handleNextWeek}
      onSelectWeek={handleSelectWeek}
      onScheduleClick={handleScheduleClick}
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
