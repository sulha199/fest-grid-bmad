/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WeeklyCalendarView } from './WeeklyCalendarView';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';

describe('WeeklyCalendarView', () => {
  afterEach(() => {
    cleanup();
  });

  const sampleSchedules = [
    {
      id: 'sched-1',
      eventSlug: 'music-fest',
      eventName: 'Main Stage Concert',
      isMainSchedule: true,
      eventStartDate: '2026-08-05',
      eventEndDate: '2026-08-05',
      eventStartTime: '18:00:00',
      eventEndTime: '21:00:00',
    },
    {
      id: 'sched-2',
      eventSlug: 'art-exhibition',
      eventName: 'Gallery Tour',
      isMainSchedule: false,
      eventStartDate: '2026-08-06',
      eventEndDate: '2026-08-06',
      eventStartTime: '10:00:00',
      eventEndTime: '12:00:00',
    },
    {
      id: 'sched-3',
      eventSlug: 'workshop',
      eventName: 'Tech Workshop',
      isMainSchedule: true,
      eventStartDate: '2026-08-05',
      eventEndDate: '2026-08-07', // Multi-day!
      eventStartTime: '09:00:00',
      eventEndTime: '17:00:00',
    },
  ];

  const defaultProps = {
    weekStart: '2026-08-05', // August 5, 2026 (Wednesday)
    schedules: sampleSchedules,
    maxEventsPerDay: 5,
    onToday: vi.fn(),
    onPrevWeek: vi.fn(),
    onNextWeek: vi.fn(),
    onScheduleClick: vi.fn(),
    status: 'success' as const,
  };

  it('renders a 7-column weekly grid with day headers and week date-range label', () => {
    render(
      <ScopedLocaleProvider locale="en-US">
        <WeeklyCalendarView {...defaultProps} />
      </ScopedLocaleProvider>
    );

    // Wednesday, Aug 5 to Tuesday, Aug 11
    // The weekly view starts at Sunday, Aug 2, 2026 (Sunday is offset 0)
    // Sunday Aug 2 to Saturday Aug 8, 2026
    expect(screen.getByText(/Aug 2.*8, 2026/)).toBeInTheDocument();

    // Verify day headers
    expect(screen.getByText('2 Sun')).toBeInTheDocument();
    expect(screen.getByText('8 Sat')).toBeInTheDocument();
  });

  it('Today, prev week, and next week navigation clicks trigger respective callbacks', () => {
    const onToday = vi.fn();
    const onPrevWeek = vi.fn();
    const onNextWeek = vi.fn();

    render(
      <WeeklyCalendarView
        {...defaultProps}
        onToday={onToday}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
      />
    );

    fireEvent.click(screen.getByLabelText('Today'));
    expect(onToday).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Previous week'));
    expect(onPrevWeek).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Next week'));
    expect(onNextWeek).toHaveBeenCalledTimes(1);
  });

  it('renders compact schedule cards with correct title weights', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    const mainCard = screen.getByText('Main Stage Concert').closest('button');
    expect(mainCard).toBeInTheDocument();
    // Bold weight for main schedule
    expect(screen.getByText('Main Stage Concert')).toHaveClass('font-bold');

    const subCard = screen.getByText('Gallery Tour').closest('button');
    expect(subCard).toBeInTheDocument();
    // Normal weight for sub schedule
    expect(screen.getByText('Gallery Tour')).toHaveClass('font-normal');
  });

  it('renders a multi-day schedule as connected per-day segments', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // Tech Workshop is multi-day: Aug 5 (Wed), Aug 6 (Thu), Aug 7 (Fri)
    // Grid weekly has 7 columns (Sun 2 - Sat 8)
    // Tech Workshop segments should be rendered
    const segments = screen.getAllByText('Tech Workshop');
    expect(segments.length).toBe(3); // Wednesday, Thursday, Friday
  });

  it('clips multi-day schedules at week boundaries correctly', () => {
    // A schedule starting before Sunday Aug 2 (e.g., Aug 1) and ending Aug 4 (Tue)
    const outOfBoundsSchedule = [
      {
        id: 'sched-boundary',
        eventSlug: 'long-fest',
        eventName: 'Boundary Festival',
        isMainSchedule: true,
        eventStartDate: '2026-07-31',
        eventEndDate: '2026-08-04', // Overlaps Sun Aug 2, Mon Aug 3, Tue Aug 4
      },
    ];

    render(<WeeklyCalendarView {...defaultProps} schedules={outOfBoundsSchedule} locale="en-US" />);

    const segments = screen.getAllByText('Boundary Festival');
    // Only 3 segments (Aug 2, 3, 4) should be rendered on the visible week, others clipped
    expect(segments.length).toBe(3);
  });

  it('camps daily events if they exceed maxEventsPerDay and triggers popover', () => {
    // Sunday Aug 2 gets 3 events
    const lotsOfEvents = [
      { id: '1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-02' },
      { id: '2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-02' },
      { id: '3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-02' },
    ];

    const moreLabel = vi.fn((count: number) => `+${count} items remaining`);

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={lotsOfEvents}
        maxEventsPerDay={2}
        labels={{ moreLabel }}
        locale="en-US"
      />
    );

    // Should only render 2 events directly
    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
    expect(screen.queryByText('Event 3')).not.toBeInTheDocument();

    // Verify resolver moreLabel was called
    expect(moreLabel).toHaveBeenCalledWith(1);
    const trigger = screen.getByText('+1 items remaining');
    expect(trigger).toBeInTheDocument();

    // Trigger popover open
    fireEvent.click(trigger);

    // Event 3 should now be visible in popover
    expect(screen.getByLabelText(/Schedules for/i)).toBeInTheDocument();
    expect(screen.getByText('All Schedules')).toBeInTheDocument();
    expect(screen.getAllByText('Event 3').length).toBe(1);

    // Escape closing popover
    fireEvent.keyDown(screen.getByLabelText(/Schedules for/i), { key: 'Escape' });
    expect(screen.queryByLabelText(/Schedules for/i)).not.toBeInTheDocument();
  });

  it('triggers onScheduleClick with full schedule object on grid card or popover card click', () => {
    const onScheduleClick = vi.fn();
    const lotsOfEvents = [
      { id: '1', eventSlug: 'e1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-02' },
      { id: '2', eventSlug: 'e2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-02' },
      { id: '3', eventSlug: 'e3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-02' },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={lotsOfEvents}
        maxEventsPerDay={2}
        onScheduleClick={onScheduleClick}
        locale="en-US"
      />
    );

    // Click grid card
    fireEvent.click(screen.getByText('Event 1'));
    expect(onScheduleClick).toHaveBeenLastCalledWith(lotsOfEvents[0]);

    // Open popover and click popover card
    fireEvent.click(screen.getByText('+1 more'));
    fireEvent.click(screen.getByText('Event 3'));
    expect(onScheduleClick).toHaveBeenLastCalledWith(lotsOfEvents[2]);
  });

  it('hovering and keyboard focusing compact card displays custom tooltip', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    const cardButton = screen.getByText('Gallery Tour').closest('button');
    expect(cardButton).toBeInTheDocument();

    // Enter pointer
    fireEvent.pointerEnter(cardButton!, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Aug 6, 2026 (10:00 AM - 12:00 PM)')).toBeInTheDocument();

    // Leave pointer
    fireEvent.pointerLeave(cardButton!, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Focus
    fireEvent.focus(cardButton!);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Dismiss with Escape
    fireEvent.keyDown(cardButton!, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('roving-tabindex keyboard arrow navigation between schedule cards behaves correctly', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // Wed Aug 5: Main Stage Concert (card-0), Tech Workshop (card-1)
    // Thu Aug 6: Tech Workshop (card-0), Gallery Tour (card-1)
    // Fri Aug 7: Tech Workshop (card-0)
    
    // There are 5 display cards total across visible days
    // Wed: card-0 (Main Stage Concert), card-1 (Tech Workshop)
    // Thu: card-0 (Tech Workshop), card-1 (Gallery Tour)
    // Fri: card-0 (Tech Workshop)

    const wed0 = screen.getAllByText('Tech Workshop')[0].closest('button')!;
    const wed1 = screen.getByText('Main Stage Concert').closest('button')!;
    const thu0 = screen.getAllByText('Tech Workshop')[1].closest('button')!;
    const thu1 = screen.getByText('Gallery Tour').closest('button')!;

    // Initial roving tabIndex=0 is wed0 (Tech Workshop, since it sorts before Main Stage Concert as 09:00:00 vs 18:00:00)
    expect(wed0).toHaveAttribute('tabIndex', '0');
    expect(wed1).toHaveAttribute('tabIndex', '-1');
    expect(thu0).toHaveAttribute('tabIndex', '-1');

    // Focus wed0 and ArrowRight moves to wed1 (which is the next card in the flat list)
    fireEvent.keyDown(wed0, { key: 'ArrowRight' });
    expect(wed1).toHaveFocus();
    expect(wed1).toHaveAttribute('tabIndex', '0');
    expect(wed0).toHaveAttribute('tabIndex', '-1');

    // ArrowRight moves to next day's first card (thu0)
    fireEvent.keyDown(wed1, { key: 'ArrowRight' });
    expect(thu0).toHaveFocus();

    // ArrowDown moves down to same row or column equivalent on adjacent day (falling back sensibly)
    // From thu0 (day 4, card-0) we press ArrowDown (which does col index movement in calendar logic)
    // Actually, our ArrowUp/ArrowDown is defined to move to the corresponding card index in the adjacent day cell.
    // e.g. From thu0 (Thu, card-0) ArrowDown moves to Fri, card-0 (which is the Friday Tech Workshop)
    fireEvent.keyDown(thu0, { key: 'ArrowDown' });
    const fri0 = screen.getAllByText('Tech Workshop')[2].closest('button')!;
    expect(fri0).toHaveFocus();
  });

  it('graceful degradation for invalid/malformed locale or timezone instead of crashing', () => {
    // Should not throw and fallback nicely
    render(
      <WeeklyCalendarView
        {...defaultProps}
        locale="Not_Real"
        timezone="Fake/Zone"
      />
    );
    expect(screen.getByText('Main Stage Concert')).toBeInTheDocument();
  });

  it('loading and error state status rendering behaves correctly', () => {
    // Loading State
    const { rerender } = render(<WeeklyCalendarView {...defaultProps} status="loading" />);
    expect(screen.getByLabelText('Loading calendar view...')).toBeInTheDocument();
    expect(screen.queryByText('Main Stage Concert')).not.toBeInTheDocument();

    cleanup();

    // Error State
    render(
      <WeeklyCalendarView
        {...defaultProps}
        status="error"
        errorMessage="Database disconnected"
        errorDetail="TCP connection timeout at host Supabase..."
      />
    );
    expect(screen.getByText('Error loading calendar events')).toBeInTheDocument();
    expect(screen.getByText('Database disconnected')).toBeInTheDocument();
    expect(screen.getByText(/TCP connection timeout/)).toBeInTheDocument();
  });
});
