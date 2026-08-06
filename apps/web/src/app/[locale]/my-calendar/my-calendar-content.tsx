"use client";

import React, { useMemo, useEffect } from 'react';
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useGetEventsForMyCalendarQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildMyCalendarQueryCondition } from '@festgrid/domain/events';
import { WeeklyCalendarView, Checkbox } from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';
import { useAuthSession } from '@/components/providers/auth-session-provider';

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

export function MyCalendarContent() {
  const t = useTranslations('MyCalendarPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const { session, isLoading } = useAuthSession();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [week, setWeek] = useQueryState(
    'week',
    parseAsString.withDefault(todayStr)
  );

  const [showFavorited, setShowFavorited] = useQueryState(
    'showFavorited',
    parseAsBoolean.withDefault(true)
  );

  const [showAdded, setShowAdded] = useQueryState(
    'showAdded',
    parseAsBoolean.withDefault(true)
  );

  const weekStart = useMemo(() => getSunday(week), [week]);
  const weekEnd = useMemo(() => getSaturday(weekStart), [weekStart]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/login');
    }
  }, [isLoading, session, router]);

  const queryCondition = useMemo(() => {
    return buildMyCalendarQueryCondition({
      weekStart,
      weekEnd,
    });
  }, [weekStart, weekEnd]);

  const { data, status, error } = useGetEventsForMyCalendarQuery(
    graphqlClient,
    {
      limit: 1000,
      query: queryCondition,
    },
    {
      queryKey: ['events', 'my-calendar', queryCondition],
      enabled: !!session && !isLoading,
    }
  );

  // Flatten and filter schedules client-side
  const schedules = useMemo(() => {
    const rawEvents = data?.events?.items ?? [];
    const flatSchedules = rawEvents.flatMap((event) => {
      return (event.schedules || []).map((schedule) => ({
        id: schedule.id,
        eventSlug: event.slug,
        eventName: event.eventName,
        isMainSchedule: schedule.isMainSchedule,
        eventStartDate: schedule.eventStartDate,
        eventEndDate: schedule.eventEndDate,
        eventStartTime: schedule.eventStartTime,
        eventEndTime: schedule.eventEndTime,
        isFavorited: !!event.isFavorited,
        isAddedToCalendar: !!schedule.isAddedToCalendar,
      }));
    });

    // Client-side filter: schedule.isFavorited && showFavorited OR schedule.isAddedToCalendar && showAdded
    // AC5: "A schedule matching both categories remains visible as long as at least one toggle is on."
    return flatSchedules.filter((schedule) => {
      const passesFavorited = schedule.isFavorited && showFavorited;
      const passesAdded = schedule.isAddedToCalendar && showAdded;
      return passesFavorited || passesAdded;
    });
  }, [data, showFavorited, showAdded]);

  // Analytics: my_calendar_page_viewed
  useEffect(() => {
    if (status === 'success' && !!session) {
      posthog.capture('my_calendar_page_viewed', {
        visibleScheduleCount: schedules.length,
      });
    }
  }, [status, schedules.length, session, weekStart, posthog]); // trigger on week changes too

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
    const params = new URLSearchParams(searchParams.toString());
    const url = `/events/${schedule.eventSlug}?fromList=true&${params.toString()}`;
    router.push(url);
  };

  const handleToggleFavorited = (val: boolean) => {
    setShowFavorited(val);
    posthog.capture('calendar_visibility_toggled', { filter: 'favorited', visible: val });
  };

  const handleToggleAdded = (val: boolean) => {
    setShowAdded(val);
    posthog.capture('calendar_visibility_toggled', { filter: 'addedToCalendar', visible: val });
  };

  const labels = {
    prevWeekLabel: t('calendarPrevWeekLabel'),
    nextWeekLabel: t('calendarNextWeekLabel'),
    todayLabel: t('calendarTodayLabel'),
    moreLabel: (count: number) => t('calendarMoreLabel', { count }),
    closePopoverLabel: t('calendarClosePopoverLabel'),
    favoritedBadgeLabel: t('favoritedBadgeLabel'),
    addedToCalendarBadgeLabel: t('addedToCalendarBadgeLabel'),
  };

  if (!session) {
    return null;
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        
        {/* Toggles */}
        <div className="flex items-center gap-4 flex-wrap bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-2 px-3 rounded-lg">
          <Checkbox
            id="toggle-favorited"
            label={t('showFavoritedLabel')}
            checked={showFavorited}
            onChange={handleToggleFavorited}
          />
          <Checkbox
            id="toggle-added"
            label={t('showAddedToCalendarLabel')}
            checked={showAdded}
            onChange={handleToggleAdded}
          />
        </div>
      </div>

      <WeeklyCalendarView
        weekStart={weekStart}
        schedules={schedules}
        maxEventsPerDay={-1} // unlimited per personal_view token
        onToday={handleToday}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onScheduleClick={handleScheduleClick}
        status={status === 'pending' ? 'loading' : status}
        errorMessage={t('calendarErrorState')}
        errorDetail={error ? (error as Error).message || JSON.stringify(error) : undefined}
        labels={labels}
      />
    </div>
  );
}
