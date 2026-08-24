"use client";

import React, { useMemo, useEffect } from 'react';
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useGetEventsForMyCalendarQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { buildMyCalendarQueryCondition } from '@festgrid/domain/events';
import { WeeklyCalendarView, Checkbox, useWeeklyCalendarController, getWeekStart, getWeekEnd, PageContainer } from '@festgrid/ui';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePostHog } from '@festgrid/analytics';
import { useAuthSession } from '@/components/providers/auth-session-provider';

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

  const weekStart = useMemo(() => getWeekStart(week), [week]);
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

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

  const { data, status: queryStatus, error: queryError } = useGetEventsForMyCalendarQuery(
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

  const {
    schedules: rawSchedules,
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

  // Apply customized post-flattening client-side filters
  const schedules = useMemo(() => {
    return rawSchedules.filter((schedule) => {
      const passesFavorited = schedule.isFavorited && showFavorited;
      const passesAdded = schedule.isAddedToCalendar && showAdded;
      return passesFavorited || passesAdded;
    });
  }, [rawSchedules, showFavorited, showAdded]);

  // Analytics: my_calendar_page_viewed
  useEffect(() => {
    if (status === 'success' && !!session) {
      posthog.capture('my_calendar_page_viewed', {
        visibleScheduleCount: schedules.length,
      });
    }
  }, [status, schedules.length, session, weekStart, posthog]); // trigger on week changes too

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
    selectWeekLabel: t('calendarSelectWeekLabel'),
    chooseWeekLabel: t('calendarChooseWeekLabel'),
    moreLabel: (count: number) => t('calendarMoreLabel', { count }),
    closePopoverLabel: t('calendarClosePopoverLabel'),
    favoritedBadgeLabel: t('favoritedBadgeLabel'),
    addedToCalendarBadgeLabel: t('addedToCalendarBadgeLabel'),
  };

  const getWeekRange = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    const start = new Date(`${getWeekStart(iso)}T12:00:00Z`);
    const end = new Date(`${getWeekEnd(getWeekStart(iso))}T12:00:00Z`);
    return { start, end };
  };

  if (!session) {
    return null;
  }

  return (
    <PageContainer>
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
        getWeekRange={getWeekRange}
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
    </PageContainer>
  );
}
