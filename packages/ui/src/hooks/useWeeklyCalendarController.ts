import { useMemo } from 'react';
import { WeeklyCalendarControllerOptions, WeeklyCalendarControllerResult } from './useWeeklyCalendarController.types';

const parseDateOnly = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDate = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
};

export const getWeekStart = (dateStr: string) => {
  const d = parseDateOnly(dateStr);
  const day = d.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const monday = shiftDate(d, -mondayOffset);
  return formatIsoDate(monday);
};

export const getWeekEnd = (weekStartStr: string) => {
  const d = parseDateOnly(weekStartStr);
  const sunday = shiftDate(d, 6);
  return formatIsoDate(sunday);
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

  const weekStart = useMemo(() => getWeekStart(week), [week]);
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

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
    const current = parseDateOnly(weekStart);
    const newWeek = formatIsoDate(shiftDate(current, -7));
    setWeek(newWeek);
    if (onNavigate) {
      onNavigate('previous', newWeek);
    }
  };

  const handleNextWeek = () => {
    const current = parseDateOnly(weekStart);
    const newWeek = formatIsoDate(shiftDate(current, 7));
    setWeek(newWeek);
    if (onNavigate) {
      onNavigate('next', newWeek);
    }
  };

  const handleSelectWeek = (dateStr: string) => {
    const newWeek = getWeekStart(dateStr);
    setWeek(newWeek);
    if (onNavigate) {
      onNavigate('select', newWeek);
    }
  };

  const handleToday = () => {
    const normalizedToday = getWeekStart(todayStr);
    setWeek(normalizedToday);
    if (onNavigate) {
      onNavigate('today', normalizedToday);
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
    handleSelectWeek,
    handleToday,
  };
}
