"use client";

import React, { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useGetEventsForCalendarQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildWeeklyCalendarQueryCondition } from '@festgrid/domain/events';
import { WeeklyCalendarView } from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';

const getSunday = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return sunday.toISOString().split('T')[0];
};

const getSaturday = (sundayStr: string) => {
  const d = new Date(sundayStr);
  const saturday = new Date(d);
  saturday.setDate(d.getDate() + 6);
  return saturday.toISOString().split('T')[0];
};

import { NearbyFilterInput } from '@festgrid/domain/events';

interface CalendarViewProps {
  q: string;
  types: string[];
  categories: string[];
  nearby?: NearbyFilterInput;
}

export function CalendarView({ q, types, categories, nearby }: CalendarViewProps) {
  const t = useTranslations('DiscoveryPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [week, setWeek] = useQueryState(
    'week',
    parseAsString.withDefault(todayStr)
  );

  const weekStart = useMemo(() => getSunday(week), [week]);
  const weekEnd = useMemo(() => getSaturday(weekStart), [weekStart]);

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

  const { data, status, error } = useGetEventsForCalendarQuery(
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

  const schedules = useMemo(() => {
    const rawEvents = data?.events?.items ?? [];
    return rawEvents.flatMap((event) => {
      return (event.schedules || []).map((schedule) => ({
        id: schedule.id,
        eventSlug: event.slug,
        eventName: event.eventName,
        isMainSchedule: schedule.isMainSchedule,
        eventStartDate: schedule.eventStartDate,
        eventEndDate: schedule.eventEndDate,
        eventStartTime: schedule.eventStartTime,
        eventEndTime: schedule.eventEndTime,
      }));
    });
  }, [data]);

  const handlePrevWeek = () => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() - 7);
    const newWeek = current.toISOString().split('T')[0];
    setWeek(newWeek);
    posthog.capture('calendar_week_navigated', { direction: 'previous', weekStart: newWeek });
  };

  const handleNextWeek = () => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() + 7);
    const newWeek = current.toISOString().split('T')[0];
    setWeek(newWeek);
    posthog.capture('calendar_week_navigated', { direction: 'next', weekStart: newWeek });
  };

  const handleToday = () => {
    setWeek(todayStr);
    posthog.capture('calendar_week_navigated', { direction: 'today', weekStart: todayStr });
  };

  const handleScheduleClick = (schedule: { eventSlug: string }) => {
    const paramsStr = searchParams.toString();
    const url = `/events/${schedule.eventSlug}?fromList=true${paramsStr ? `&${paramsStr}` : ''}`;
    router.push(url);
  };

  const labels = {
    prevWeekLabel: t('calendarPrevWeekLabel'),
    nextWeekLabel: t('calendarNextWeekLabel'),
    todayLabel: t('calendarTodayLabel'),
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
      onScheduleClick={handleScheduleClick}
      status={status === 'pending' ? 'loading' : status}
      errorMessage={t('calendarErrorState')}
      errorDetail={error ? (error as Error).message || JSON.stringify(error) : undefined}
      labels={labels}
    />
  );
}
