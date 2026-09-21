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
      imageUrl: 'https://img.example/event-one.jpg',
      location: 'Grand Arena, Hall 4',
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

  it('calculates correct Monday and Sunday boundaries', () => {
    // 2026-08-10 is a Monday. The Monday-start week is 2026-08-10 through 2026-08-16.
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

    expect(result.current.weekStart).toBe('2026-08-10');
    expect(result.current.weekEnd).toBe('2026-08-16');
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
      eventId: 'event-1',
      imageUrl: 'https://img.example/event-one.jpg',
      // Story 1.i1g AC10 — venue mapped from the Event-level `location`.
      locationName: 'Grand Arena, Hall 4',
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
      eventId: 'event-1',
      imageUrl: 'https://img.example/event-one.jpg',
      locationName: 'Grand Arena, Hall 4',
    });
  });

  it('degrades locationName to undefined when the event has no location (Story 1.i1g AC10)', () => {
    const eventsWithoutLocation = [
      {
        id: 'event-2',
        slug: 'event-two',
        eventName: 'Event Two',
        schedules: [
          {
            id: 'schedule-3',
            isMainSchedule: true,
            eventStartDate: '2026-08-12',
            eventEndDate: '2026-08-12',
          },
        ],
      },
    ];

    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: vi.fn(),
        todayStr: '2026-08-10',
        rawEvents: eventsWithoutLocation,
        queryStatus: 'success',
        queryError: null,
      })
    );

    // Never `null`, never an empty string — the spanning card omits the venue line entirely.
    expect(result.current.schedules[0].locationName).toBeUndefined();
  });

  it('computes distanceKm per schedule when viewerCoord and schedule coordinates are both present (Story 1.i1f AC13-14)', () => {
    const setWeekMock = vi.fn();
    const eventsWithCoords = [
      {
        id: 'event-1',
        slug: 'event-one',
        eventName: 'Event One',
        isFavorited: false,
        schedules: [
          {
            id: 'schedule-1',
            isMainSchedule: true,
            eventStartDate: '2026-08-10',
            // Identical to viewerCoord below — expect distanceKm === 0.
            locationDetails: { coordinates: { lat: -6.2, lng: 106.8 } },
          },
          {
            id: 'schedule-2',
            isMainSchedule: false,
            eventStartDate: '2026-08-11',
            locationDetails: null,
          },
        ],
      },
    ];

    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: setWeekMock,
        todayStr: '2026-08-10',
        rawEvents: eventsWithCoords,
        queryStatus: 'success',
        queryError: null,
        viewerCoord: { latitude: -6.2, longitude: 106.8 },
      })
    );

    expect(result.current.schedules[0]).toMatchObject({ id: 'schedule-1', distanceKm: 0 });
    expect((result.current.schedules[1] as any).distanceKm).toBeUndefined();
  });

  it('leaves distanceKm undefined for every schedule when no viewerCoord is provided', () => {
    const setWeekMock = vi.fn();
    const eventsWithCoords = [
      {
        id: 'event-1',
        slug: 'event-one',
        eventName: 'Event One',
        schedules: [
          {
            id: 'schedule-1',
            isMainSchedule: true,
            eventStartDate: '2026-08-10',
            locationDetails: { coordinates: { lat: -6.2, lng: 106.8 } },
          },
        ],
      },
    ];

    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-10',
        setWeek: setWeekMock,
        todayStr: '2026-08-10',
        rawEvents: eventsWithCoords,
        queryStatus: 'success',
        queryError: null,
      })
    );

    expect((result.current.schedules[0] as any).distanceKm).toBeUndefined();
  });

  it('navigates previous week, next week, today, and an arbitrary picked date, and fires callbacks', () => {
    const setWeekMock = vi.fn();
    const onNavigateMock = vi.fn();
    // Week is one week ahead of today so handlePrevWeek is not disabled (see the
    // dedicated isPrevWeekDisabled tests below for the at/before-today boundary).
    const { result } = renderHook(() =>
      useWeeklyCalendarController({
        week: '2026-08-17',
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
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-10');
    expect(onNavigateMock).toHaveBeenLastCalledWith('previous', '2026-08-10');

    act(() => {
      result.current.handleNextWeek();
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-24');
    expect(onNavigateMock).toHaveBeenLastCalledWith('next', '2026-08-24');

    act(() => {
      result.current.handleSelectWeek('2026-08-21');
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-17');
    expect(onNavigateMock).toHaveBeenLastCalledWith('select', '2026-08-17');

    act(() => {
      result.current.handleToday();
    });
    expect(setWeekMock).toHaveBeenLastCalledWith('2026-08-10');
    expect(onNavigateMock).toHaveBeenLastCalledWith('today', '2026-08-10');
  });

  it('disables and no-ops previous-week navigation once the displayed week is today\'s week or earlier', () => {
    const setWeekMock = vi.fn();
    const onNavigateMock = vi.fn();
    const { result, rerender } = renderHook(
      ({ week }) =>
        useWeeklyCalendarController({
          week,
          setWeek: setWeekMock,
          todayStr: '2026-08-10',
          rawEvents: [],
          queryStatus: 'success',
          queryError: null,
          onNavigate: onNavigateMock,
        }),
      { initialProps: { week: '2026-08-10' } }
    );

    // Displaying today's own week: prev is disabled and a no-op.
    expect(result.current.isPrevWeekDisabled).toBe(true);
    act(() => {
      result.current.handlePrevWeek();
    });
    expect(setWeekMock).not.toHaveBeenCalled();
    expect(onNavigateMock).not.toHaveBeenCalled();

    // A week further in the past (should not normally be reachable once the
    // control is disabled, but the handler itself still guards defensively).
    rerender({ week: '2026-08-03' });
    expect(result.current.isPrevWeekDisabled).toBe(true);
    act(() => {
      result.current.handlePrevWeek();
    });
    expect(setWeekMock).not.toHaveBeenCalled();

    // A week ahead of today: prev is enabled again.
    rerender({ week: '2026-08-17' });
    expect(result.current.isPrevWeekDisabled).toBe(false);
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
