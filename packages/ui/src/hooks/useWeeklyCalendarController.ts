import { useMemo } from 'react';
import { WeeklyCalendarControllerOptions, WeeklyCalendarControllerResult } from './useWeeklyCalendarController.types';

export const getSunday = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return sunday.toISOString().split('T')[0];
};

export const getSaturday = (sundayStr: string) => {
  const d = new Date(sundayStr);
  const saturday = new Date(d);
  saturday.setDate(d.getDate() + 6);
  return saturday.toISOString().split('T')[0];
};

export function useWeeklyCalendarController<TEvent = any, TSchedule = any>(
  options: WeeklyCalendarControllerOptions<TEvent>
): WeeklyCalendarControllerResult<TSchedule> {
  const {
    week,
    setWeek,
    todayStr,
    rawEvents,
    queryStatus,
    queryError,
    onNavigate,
    errorStateLabel = 'An error occurred',
  } = options;

  const weekStart = useMemo(() => getSunday(week), [week]);
  const weekEnd = useMemo(() => getSaturday(weekStart), [weekStart]);

  const schedules = useMemo(() => {
    const events = rawEvents ?? [];
    return events.flatMap((event: any) => {
      return (event.schedules || []).map((schedule: any) => ({
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
  }, [rawEvents]);

  const handlePrevWeek = () => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() - 7);
    const newWeek = current.toISOString().split('T')[0];
    setWeek(newWeek);
    if (onNavigate) {
      onNavigate('previous', newWeek);
    }
  };

  const handleNextWeek = () => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() + 7);
    const newWeek = current.toISOString().split('T')[0];
    setWeek(newWeek);
    if (onNavigate) {
      onNavigate('next', newWeek);
    }
  };

  const handleToday = () => {
    setWeek(todayStr);
    if (onNavigate) {
      onNavigate('today', todayStr);
    }
  };

  const status = queryStatus === 'pending' ? 'loading' : queryStatus;
  const errorMessage = errorStateLabel;
  const errorDetail = queryError
    ? (queryError as Error).message || JSON.stringify(queryError)
    : undefined;

  return {
    weekStart,
    weekEnd,
    schedules: schedules as TSchedule[],
    status,
    errorMessage,
    errorDetail,
    handlePrevWeek,
    handleNextWeek,
    handleToday,
  };
}
