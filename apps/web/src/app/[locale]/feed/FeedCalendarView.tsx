"use client";

import React, { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useGetEventsForCalendarQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildFeedCalendarQueryCondition } from '@festgrid/domain/events';
import { WeeklyCalendarView, useWeeklyCalendarController, getWeekStart, getWeekEnd } from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';

interface FeedCalendarViewProps {
  q: string;
  types: string[];
  categories: string[];
  subscriptions: string[];
}

export function FeedCalendarView({ q, types, categories, subscriptions }: FeedCalendarViewProps) {
  const t = useTranslations('FeedPage');
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

  const {
    schedules,
    status,
    errorMessage,
    errorDetail,
    handlePrevWeek,
    handleNextWeek,
    handleSelectWeek,
    handleToday,
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
    closePopoverLabel: t('calendarClosePopoverLabel'),
  };

  return (
    <WeeklyCalendarView
      weekStart={weekStart}
      schedules={schedules}
      maxEventsPerDay={5}
      onToday={handleToday}
      onPrevWeek={handlePrevWeek}
      onNextWeek={handleNextWeek}
      onSelectWeek={handleSelectWeek}
      onScheduleClick={handleScheduleClick}
      status={status === 'pending' ? 'loading' : (status as any)}
      errorMessage={errorMessage}
      errorDetail={errorDetail}
      labels={labels}
    />
  );
}
