import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useWeeklyCalendarController } from './useWeeklyCalendarController';

describe('useWeeklyCalendarController', () => {
  const defaultEvents = [
    {
      id: 'event-1',
      slug: 'event-one',
      eventName: 'Event One',
      isFavorited: true,
      schedules: [
        {
          id: 'schedule-1',
          isMainSchedule: true,
          eventStartDate: '2026-08-10',
          eventEndDate: '2026-08-10',
          eventStartTime: '10:00:00',
          eventEndTime: '12:00:00',
          isAddedToCalendar: true,
        },
        {
          id: 'schedule-2',
          isMainSchedule: false,
          eventStartDate: '2026-08-11',
          eventEndDate: '2026-08-11',
          eventStartTime: '14:00:00',
          eventEndTime: '16:00:00',
          isAddedToCalendar: false,
        },
      ],
    },
  ];

  it('calculates correct Sunday and Saturday boundaries', () => {
    // 2026-08-10 is a Monday. The Sunday-start week is 2026-08-09 through 2026-08-15.
    const setWeekMock = vi.fn();
    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: setWeekMock,
        todayStr: '2026-08-10',
        rawEvents: [],
        queryStatus: 'success',
        queryError: null,
      })
    );

    expect(result.current.weekStart).toBe('2026-08-09');
    expect(result.current.weekEnd).toBe('2026-08-15');
  });

  it('flattens schedules correctly and maps types', () => {
    const setWeekMock = vi.fn();
    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: setWeekMock,
        todayStr: '2026-08-10',
        rawEvents: defaultEvents,
        queryStatus: 'success',
        queryError: null,
      })
    );

    expect(result.current.schedules).toHaveLength(2);
    expect(result.current.schedules[0]).toEqual({
      id: 'schedule-1',
      eventSlug: 'event-one',
      eventName: 'Event One',
      isMainSchedule: true,
      eventStartDate: '2026-08-10',
      eventEndDate: '2026-08-10',
      eventStartTime: '10:00:00',
      eventEndTime: '12:00:00',
      isFavorited: true,
      isAddedToCalendar: true,
    });
    expect(result.current.schedules[1]).toEqual({
      id: 'schedule-2',
      eventSlug: 'event-one',
      eventName: 'Event One',
      isMainSchedule: false,
      eventStartDate: '2026-08-11',
      eventEndDate: '2026-08-11',
      eventStartTime: '14:00:00',
      eventEndTime: '16:00:00',
      isFavorited: true,
      isAddedToCalendar: false,
    });
  });

  it('navigates previous week, next week, today, and an arbitrary picked date, and fires callbacks', () => {
    const setWeekMock = vi.fn();
    const onNavigateMock = vi.fn();
    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: setWeekMock,
        todayStr: '2026-08-10',
        rawEvents: [],
        queryStatus: 'success',
        queryError: null,
        onNavigate: onNavigateMock,
      })
    );

    act(() => {
      result.current.handlePrevWeek();
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-02');
    expect(onNavigateMock).toHaveBeenLastCalledWith('previous', '2026-08-02');

    act(() => {
      result.current.handleNextWeek();
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-16');
    expect(onNavigateMock).toHaveBeenLastCalledWith('next', '2026-08-16');

    act(() => {
      result.current.handleSelectWeek('2026-08-14');
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-09');
    expect(onNavigateMock).toHaveBeenLastCalledWith('select', '2026-08-09');

    act(() => {
      result.current.handleToday();
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-09');
    expect(onNavigateMock).toHaveBeenLastCalledWith('today', '2026-08-09');
  });

  it('maps queryStatus to UI loading/success/error status and formats errors', () => {
    const setWeekMock = vi.fn();
    const errorObj = new Error('Database down');
    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: setWeekMock,
        todayStr: '2026-08-10',
        rawEvents: [],
        queryStatus: 'pending',
        queryError: errorObj,
        errorStateLabel: 'Something went wrong',
      })
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.errorMessage).toBe('Something went wrong');
    expect(result.current.errorDetail).toBe('Database down');
  });
});
