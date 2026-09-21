/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen as rtlScreen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { WeeklyCalendarView } from './WeeklyCalendarView';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';

// Custom screen wrapper to automatically scope existing desktop-grid assertions
const screen = {
  ...rtlScreen,
  getByText: (text: string | RegExp, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      try {
        return within(desktop).getByText(text, options);
      } catch {}
    }
    return rtlScreen.getByText(text, options);
  },
  getAllByText: (text: string | RegExp, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      try {
        return within(desktop).getAllByText(text, options);
      } catch {}
    }
    return rtlScreen.getAllByText(text, options);
  },
  queryByText: (text: string | RegExp, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      return within(desktop).queryByText(text, options);
    }
    return rtlScreen.queryByText(text, options);
  },
  getByRole: (role: string, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      try {
        return within(desktop).getByRole(role, options);
      } catch {}
    }
    return rtlScreen.getByRole(role, options);
  },
  queryByRole: (role: string, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      return within(desktop).queryByRole(role, options);
    }
    return rtlScreen.queryByRole(role, options);
  },
  getByLabelText: (text: string | RegExp, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      try {
        return within(desktop).getByLabelText(text, options);
      } catch {}
    }
    return rtlScreen.getByLabelText(text, options);
  },
  queryByLabelText: (text: string | RegExp, options?: any) => {
    const desktop = rtlScreen.queryByTestId('desktop-calendar-view');
    if (desktop) {
      return within(desktop).queryByLabelText(text, options);
    }
    return rtlScreen.queryByLabelText(text, options);
  },
};

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

  const getWeekRange = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  };

  const defaultProps = {
    weekStart: '2026-08-05', // August 5, 2026 (Wednesday)
    schedules: sampleSchedules,
    maxEventsPerDay: 5,
    getWeekRange,
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

    expect(screen.getByText(/Aug 5.*11, 2026/)).toBeInTheDocument();
    expect(screen.getByText('5 Wed')).toBeInTheDocument();
    expect(screen.getByText('11 Tue')).toBeInTheDocument();
  });

  it('renders the exact supplied weekStart as the first visible day without Sunday correction', () => {
    render(
      <ScopedLocaleProvider locale="en-US">
        <WeeklyCalendarView {...defaultProps} weekStart="2026-08-10" />
      </ScopedLocaleProvider>
    );

    expect(screen.getByText(/Aug 10.*16, 2026/)).toBeInTheDocument();
    expect(screen.getByText('10 Mon')).toBeInTheDocument();
    expect(screen.getByText('16 Sun')).toBeInTheDocument();
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

  it('disables the Previous week control and ignores clicks when isPrevWeekDisabled is true', () => {
    const onPrevWeek = vi.fn();

    render(
      <WeeklyCalendarView {...defaultProps} onPrevWeek={onPrevWeek} isPrevWeekDisabled />
    );

    const prevButton = screen.getByLabelText('Previous week');
    expect(prevButton).toBeDisabled();

    fireEvent.click(prevButton);
    expect(onPrevWeek).not.toHaveBeenCalled();
  });

  it('opens the week picker and calls onSelectWeek with the picked date', () => {
    // FIND-009: freeze the clock to a date inside August 2026 so the popover
    // date-picker opens on August and clicking day "10" resolves to the fixture's
    // 2026-08-10 — with the real wall clock this drifted to the current month/year
    // (e.g. 2026-09-10) and failed on date rollover.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T12:00:00Z'));
    try {
      const onSelectWeek = vi.fn();

      render(
        <WeeklyCalendarView
          {...defaultProps}
          onSelectWeek={onSelectWeek}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select week' }));
      fireEvent.click(screen.getAllByText('10')[0]);

      expect(onSelectWeek).toHaveBeenCalledWith('2026-08-10');
    } finally {
      vi.useRealTimers();
    }
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

  it('renders a multi-day schedule as one spanning card across its day columns (AC1/AC2/AC13)', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // Tech Workshop is multi-day: Aug 5 (Wed) -> Aug 7 (Fri). The visible week starts on the
    // supplied weekStart (Aug 5), so those are columns 1-3 of the 7-column grid.
    const banner = rtlScreen.getByTestId('multi-day-spanning-banner');
    const bars = within(banner).getAllByTestId('multi-day-spanning-bar');

    // Exactly ONE rendered instance — not N per-day segments (AC1).
    expect(bars).toHaveLength(1);
    expect(within(bars[0]).getByText('Tech Workshop')).toBeInTheDocument();
    expect(screen.getAllByText('Tech Workshop')).toHaveLength(1);

    // AC1 — the bar is a direct child of the banner's own CSS grid, not nested in a day cell.
    expect(bars[0].parentElement).toBe(banner);
    expect(banner).toHaveClass('grid-cols-7');

    // AC5 — and no multi-day segment is left behind inside any of the 7 day cells.
    const dayCells = rtlScreen
      .getByTestId('desktop-calendar-view')
      .querySelectorAll('.h-32');
    expect(dayCells).toHaveLength(7);
    dayCells.forEach((cell) => {
      expect(cell).not.toHaveTextContent('Tech Workshop');
    });

    // AC1/AC3 — spans its clipped day-column range via an explicit grid-column.
    expect(bars[0]).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '1' });
  });

  it('stacks overlapping multi-day schedules one row each, in ascending start order (AC4)', () => {
    // Deliberately declared out of order (later start first) to prove the sort.
    const overlapping = [
      {
        id: 'md-late',
        eventSlug: 'late-fest',
        eventName: 'Late Fest',
        isMainSchedule: false,
        eventStartDate: '2026-08-06',
        eventEndDate: '2026-08-08',
        eventStartTime: '10:00:00',
      },
      {
        id: 'md-early',
        eventSlug: 'early-fest',
        eventName: 'Early Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
        eventStartTime: '09:00:00',
      },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={overlapping}
        locale="en-US"
      />
    );

    const banner = rtlScreen.getByTestId('multi-day-spanning-banner');
    const bars = within(banner).getAllByTestId('multi-day-spanning-bar');

    // Uncapped: both multi-day schedules get their own full-width row.
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.getAttribute('data-schedule-id'))).toEqual([
      'md-early',
      'md-late',
    ]);

    // Each row is explicit, so overlapping spans stack instead of colliding.
    expect(bars[0]).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '1' });
    expect(bars[1]).toHaveStyle({ gridColumn: '2 / span 3', gridRow: '2' });
  });

  it('clips multi-day schedules at week boundaries correctly (AC3)', () => {
    // Runs Jul 31 -> Aug 4; the visible week (weekStart Aug 2) only shows Aug 2, 3, 4.
    const outOfBoundsSchedule = [
      {
        id: 'sched-boundary',
        eventSlug: 'long-fest',
        eventName: 'Boundary Festival',
        isMainSchedule: true,
        eventStartDate: '2026-07-31',
        eventEndDate: '2026-08-04',
      },
      // Runs Aug 6 -> Aug 20; the visible week only shows Aug 6, 7, 8.
      {
        id: 'sched-trailing',
        eventSlug: 'trailing-fest',
        eventName: 'Trailing Festival',
        isMainSchedule: true,
        eventStartDate: '2026-08-06',
        eventEndDate: '2026-08-20',
      },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        weekStart="2026-08-02"
        schedules={outOfBoundsSchedule}
        locale="en-US"
      />
    );

    const bars = within(rtlScreen.getByTestId('multi-day-spanning-banner')).getAllByTestId(
      'multi-day-spanning-bar'
    );
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.getAttribute('data-schedule-id'))).toEqual([
      'sched-boundary',
      'sched-trailing',
    ]);

    // Clipped to the on-screen columns, never off-grid: leading edge -> columns 1-3,
    // trailing edge -> columns 5-7.
    expect(bars[0]).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '1' });
    expect(bars[1]).toHaveStyle({ gridColumn: '5 / span 3', gridRow: '2' });

    // Still exactly one instance each (never repeated per day of the week).
    expect(screen.getAllByText('Boundary Festival')).toHaveLength(1);
    expect(screen.getAllByText('Trailing Festival')).toHaveLength(1);
  });

  it('camps daily events if they exceed maxEventsPerDay and opens the shared overflow dialog', () => {
    // Sunday Aug 2 gets 3 events
    const lotsOfEvents = [
      { id: '1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
    ];

    const moreLabel = vi.fn((count: number) => `+${count} items remaining`);
    const onOverflowRequested = vi.fn();

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={lotsOfEvents}
        maxEventsPerDay={2}
        labels={{ moreLabel }}
        onOverflowRequested={onOverflowRequested}
        // Story 1.i1h Task 8.3 — the day-scoped query result is caller-owned (React Query never
        // reaches `packages/ui`), so a test that wants to see the dialog's contents supplies it.
        overflowDialogData={{
          items: lotsOfEvents,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        }}
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

    // Task 7.1 — the trigger asks the caller for that day's data (all three AC9 payload fields)
    // and opens the ONE shared dialog instead of the deleted inline popover.
    fireEvent.click(trigger);
    expect(onOverflowRequested).toHaveBeenCalledWith('2026-08-05', 'desktop', 1);

    const dialog = screen.getByRole('dialog', { name: /Schedules for/i });
    expect(dialog).toHaveAttribute('data-date', '2026-08-05');
    // Event 3 now renders inside the dialog (via EventCardCalendarGridItem's no-image
    // composition), and exactly once overall — never duplicated next to the capped day cell.
    // Asserted via the visible heading, not by text (the row's click layer also carries an
    // `sr-only` copy of the name as its accessible name).
    expect(within(dialog).getByRole('heading', { name: 'Event 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Event 3' })).toHaveLength(1);

    // Escape closes the dialog — its own document-level keydown handler owns this now.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('calendar-overflow-dialog')).not.toBeInTheDocument();
  });

  it('returns focus to the exact "+N more" trigger that opened the dialog (Task 7.4)', async () => {
    const lotsOfEvents = [
      { id: '1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={lotsOfEvents}
        maxEventsPerDay={2}
        locale="en-US"
      />
    );

    const trigger = screen.getByText('+1 more');
    fireEvent.click(trigger);
    expect(screen.getByTestId('calendar-overflow-dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(trigger);
  });

  it('triggers onScheduleClick with full schedule object on grid card or dialog card click', () => {
    const onScheduleClick = vi.fn();
    const lotsOfEvents = [
      { id: '1', eventSlug: 'e1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '2', eventSlug: 'e2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '3', eventSlug: 'e3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={lotsOfEvents}
        maxEventsPerDay={2}
        onScheduleClick={onScheduleClick}
        overflowDialogData={{
          items: lotsOfEvents,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        }}
        locale="en-US"
      />
    );

    // Click grid card
    fireEvent.click(screen.getByText('Event 1'));
    expect(onScheduleClick).toHaveBeenLastCalledWith(lotsOfEvents[0]);

    // Open the shared dialog and activate the overflowing card. The dialog renders each row with
    // the Story 1.i1g AC12 shape (a real click-target <button> sitting under a purely visual card
    // layer), so the interactive element — not the visible <h3> text — is the click target.
    fireEvent.click(screen.getByText('+1 more'));
    fireEvent.click(rtlScreen.getByRole('button', { name: 'Event 3' }));

    expect(onScheduleClick).toHaveBeenLastCalledWith(lotsOfEvents[2]);
    // Activating a card closes the dialog, matching the superseded popover's behaviour.
    expect(rtlScreen.queryByTestId('calendar-overflow-dialog')).not.toBeInTheDocument();
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

  it('keeps multi-day schedules out of the capped day cells and the shared overflow dialog (AC4)', () => {
    const mixedSchedules = [
      { id: '1', eventSlug: 'e1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '2', eventSlug: 'e2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '3', eventSlug: 'e3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
      {
        id: 'md-expo',
        eventSlug: 'expo',
        eventName: 'All Week Expo',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
      },
    ];

    const moreLabel = vi.fn((count: number) => `+${count} items remaining`);

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={mixedSchedules}
        maxEventsPerDay={2}
        labels={{ moreLabel }}
        // Desktop's day cell — and therefore the day-scoped overflow list it opens — is
        // single-day-only, so the caller's merged bucket for this day excludes the expo.
        overflowDialogData={{
          items: mixedSchedules.filter((schedule) => !schedule.eventEndDate),
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        }}
        locale="en-US"
      />
    );

    // The multi-day schedule has its own spanning bar…
    const banner = rtlScreen.getByTestId('multi-day-spanning-banner');
    expect(within(banner).getAllByTestId('multi-day-spanning-bar')).toHaveLength(1);
    expect(within(banner).getByText('All Week Expo')).toBeInTheDocument();

    // …and is never duplicated inside a day cell.
    // The visible week starts at the supplied weekStart (Aug 5 = Wed), so that day is cell 0.
    const wedCell = rtlScreen.getByTestId('desktop-calendar-view').querySelectorAll('.h-32')[0];
    expect(wedCell).not.toHaveTextContent('All Week Expo');
    expect(within(wedCell as HTMLElement).getByText('Event 1')).toBeInTheDocument();
    expect(within(wedCell as HTMLElement).getByText('Event 2')).toBeInTheDocument();
    expect(within(wedCell as HTMLElement).queryByText('Event 3')).not.toBeInTheDocument();

    // The cap/count is computed over single-day schedules only (3 single-day, limit 2 -> +1).
    expect(moreLabel).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('+1 items remaining'));

    // The dialog lists the remaining single-day schedule the caller supplied, never the multi-day one.
    const dialog = rtlScreen.getByRole('dialog', { name: /Schedules for/i });
    expect(within(dialog).getByRole('heading', { name: 'Event 3' })).toBeInTheDocument();
    expect(within(dialog).queryByText('All Week Expo')).not.toBeInTheDocument();

    // The multi-day schedule still renders exactly once overall (no duplication).
    expect(screen.getAllByText('All Week Expo')).toHaveLength(1);
  });

  it('fires onScheduleClick from the spanning card and onFavoriteToggle without navigating (AC7/AC12)', () => {
    const onScheduleClick = vi.fn();
    const onFavoriteToggle = vi.fn();

    render(
      <WeeklyCalendarView
        {...defaultProps}
        locale="en-US"
        onScheduleClick={onScheduleClick}
        onFavoriteToggle={onFavoriteToggle}
      />
    );

    const bar = rtlScreen.getByTestId('multi-day-spanning-bar');
    const barButton = within(bar).getByRole('button', { name: 'Tech Workshop' });

    // AC12 — a plain linear Tab stop, deliberately outside the roving day-cell grid.
    expect(barButton).toHaveAttribute('tabIndex', '0');
    expect(barButton).not.toHaveAttribute('id');

    fireEvent.click(barButton);
    expect(onScheduleClick).toHaveBeenCalledTimes(1);
    expect(onScheduleClick).toHaveBeenCalledWith(sampleSchedules[2]);

    // AC7 — the primitive's favorite control is a sibling, never nested in the click target.
    const favoriteButton = within(bar).getByRole('button', { name: 'Toggle favorite' });
    expect(barButton.contains(favoriteButton)).toBe(false);

    fireEvent.click(favoriteButton);
    expect(onFavoriteToggle).toHaveBeenCalledWith(sampleSchedules[2]);
    // Toggling the favorite never navigates.
    expect(onScheduleClick).toHaveBeenCalledTimes(1);
  });

  it('exposes the multi-day date range through the hover/focus tooltip (AC11)', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    const bar = rtlScreen.getByTestId('multi-day-spanning-bar');
    const barButton = within(bar).getByRole('button', { name: 'Tech Workshop' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.pointerEnter(barButton, { pointerType: 'mouse' });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Tech Workshop');
    // Aug 5 -> Aug 7, 2026 (09:00 - 17:00) in en-US.
    expect(tooltip).toHaveTextContent(/Aug 5/);
    expect(tooltip).toHaveTextContent(/7, 2026/);
    expect(tooltip).toHaveTextContent(/9:00 AM/);
    expect(tooltip).toHaveTextContent(/5:00 PM/);
    expect(barButton).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.pointerLeave(barButton, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(barButton);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(barButton, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the spanning card venue from locationName and the <8km nearby badge (AC8/AC10)', () => {
    const withVenue = [
      {
        id: 'md-venue',
        eventSlug: 'venue-fest',
        eventName: 'Venue Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
        locationName: 'Hall 4',
        distanceKm: 3,
      },
    ];
    const withoutVenue = [
      {
        id: 'md-far',
        eventSlug: 'far-fest',
        eventName: 'Far Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
        distanceKm: 12,
      },
    ];

    render(<WeeklyCalendarView {...defaultProps} schedules={withVenue} locale="en-US" />);

    const bar = rtlScreen.getByTestId('multi-day-spanning-bar');
    expect(within(bar).getByText('Hall 4')).toBeInTheDocument();
    expect(within(bar).getByText('Nearby')).toBeInTheDocument();

    cleanup();

    render(<WeeklyCalendarView {...defaultProps} schedules={withoutVenue} locale="en-US" />);

    const barNoVenue = rtlScreen.getByTestId('multi-day-spanning-bar');
    // AC10 — degrades gracefully when the venue is absent: no venue line, no placeholder.
    expect(within(barNoVenue).queryByText('Hall 4')).not.toBeInTheDocument();
    expect(within(barNoVenue).queryByText('Nearby')).not.toBeInTheDocument();
  });

  it('roving-tabindex keyboard arrow navigation between schedule cards behaves correctly', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // Multi-day Tech Workshop is excluded from the day cells (AC5/AC6) — it has its own
    // spanning bar instead — so the roving grid is only:
    //   Cell 0 (Wed Aug 5): Main Stage Concert (card-0)
    //   Cell 1 (Thu Aug 6): Gallery Tour (card-0)
    //   Cell 2 (Fri Aug 7): nothing (Tech Workshop only)
    const wed0 = screen.getByText('Main Stage Concert').closest('button')!;
    const thu0 = screen.getByText('Gallery Tour').closest('button')!;

    // Initial roving tabIndex=0 is the first rendered card of the week
    expect(wed0).toHaveAttribute('tabIndex', '0');
    expect(thu0).toHaveAttribute('tabIndex', '-1');

    // ArrowRight moves to the next card in the flat list (Thu's Gallery Tour)
    fireEvent.keyDown(wed0, { key: 'ArrowRight' });
    expect(thu0).toHaveFocus();
    expect(thu0).toHaveAttribute('tabIndex', '0');
    expect(wed0).toHaveAttribute('tabIndex', '-1');

    // ArrowLeft moves back to the previous card
    fireEvent.keyDown(thu0, { key: 'ArrowLeft' });
    expect(wed0).toHaveFocus();

    // ArrowDown moves to the same card index on the next day (Wed -> Thu)
    fireEvent.keyDown(wed0, { key: 'ArrowDown' });
    expect(thu0).toHaveFocus();

    // Fri has no single-day card left, so ArrowDown must not strand focus on a card that is
    // not rendered (its only schedule is the multi-day span).
    fireEvent.keyDown(thu0, { key: 'ArrowDown' });
    expect(thu0).toHaveFocus();

    // AC12 — the spanning bar stays a plain linear Tab stop, outside arrow-key navigation.
    const spanningButton = within(rtlScreen.getByTestId('multi-day-spanning-banner')).getByRole(
      'button',
      { name: 'Tech Workshop' }
    );
    expect(spanningButton).toHaveAttribute('tabIndex', '0');
    expect(spanningButton).not.toHaveFocus();
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
    render(<WeeklyCalendarView {...defaultProps} status="loading" />);
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

  it('renders badges for favorited and added-to-calendar states when set', () => {
    const customizedSchedules = [
      {
        id: 'sched-fav',
        eventSlug: 'music-fest',
        eventName: 'Fav Event',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        isFavorited: true,
      },
      {
        id: 'sched-added',
        eventSlug: 'music-fest',
        eventName: 'Added Event',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        isAddedToCalendar: true,
      },
      {
        id: 'sched-both',
        eventSlug: 'music-fest',
        eventName: 'Both Event',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        isFavorited: true,
        isAddedToCalendar: true,
      },
      {
        id: 'sched-none',
        eventSlug: 'music-fest',
        eventName: 'None Event',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
      },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={customizedSchedules}
        locale="en-US"
      />
    );

    // Fav Event should have heart badge
    const favCard = screen.getByText('Fav Event').closest('button');
    expect(favCard?.querySelector('[data-testid="heart-icon"]')).toBeInTheDocument();
    expect(favCard?.querySelector('[data-testid="calendar-plus-icon"]')).not.toBeInTheDocument();

    // Added Event should have calendar plus badge
    const addedCard = screen.getByText('Added Event').closest('button');
    expect(addedCard?.querySelector('[data-testid="heart-icon"]')).not.toBeInTheDocument();
    expect(addedCard?.querySelector('[data-testid="calendar-plus-icon"]')).toBeInTheDocument();

    // Both Event should have both badges
    const bothCard = screen.getByText('Both Event').closest('button');
    expect(bothCard?.querySelector('[data-testid="heart-icon"]')).toBeInTheDocument();
    expect(bothCard?.querySelector('[data-testid="calendar-plus-icon"]')).toBeInTheDocument();

    // None Event should have neither badge
    const noneCard = screen.getByText('None Event').closest('button');
    expect(noneCard?.querySelector('[data-testid="heart-icon"]')).not.toBeInTheDocument();
    expect(noneCard?.querySelector('[data-testid="calendar-plus-icon"]')).not.toBeInTheDocument();
  });

  it('renders favoriteCount conditionally when greater than 0', () => {
    const customizedSchedules = [
      {
        id: 'sched-fav-5',
        eventSlug: 'music-fest',
        eventName: 'Event with 5 Favorites',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        favoriteCount: 5,
      },
      {
        id: 'sched-fav-0',
        eventSlug: 'music-fest',
        eventName: 'Event with 0 Favorites',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        favoriteCount: 0,
      },
      {
        id: 'sched-fav-undefined',
        eventSlug: 'music-fest',
        eventName: 'Event with Undefined Favorites',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        favoriteCount: undefined,
      },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={customizedSchedules}
        locale="en-US"
      />
    );

    // Event with 5 Favorites should have the favorite-count-line with text '5'
    const cardWith5 = screen.getByText('Event with 5 Favorites').closest('button');
    const favCountLine = cardWith5?.querySelector('[data-testid="favorite-count-line"]');
    expect(favCountLine).toBeInTheDocument();
    expect(favCountLine).toHaveTextContent('5');

    // Event with 0 Favorites should NOT have favorite-count-line
    const cardWith0 = screen.getByText('Event with 0 Favorites').closest('button');
    expect(cardWith0?.querySelector('[data-testid="favorite-count-line"]')).not.toBeInTheDocument();

    // Event with Undefined Favorites should NOT have favorite-count-line
    const cardWithUndefined = screen.getByText('Event with Undefined Favorites').closest('button');
    expect(cardWithUndefined?.querySelector('[data-testid="favorite-count-line"]')).not.toBeInTheDocument();
  });

  describe('Mobile Vertical List View (AC15)', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    });
    
    afterAll(() => {
      vi.useRealTimers();
    });

    it('renders one row per non-empty day and omits empty days entirely', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const rows = within(mobileView).getAllByTestId('mobile-day-row');
      expect(rows).toHaveLength(3);
      expect(within(mobileView).getByText('5 Wed')).toBeInTheDocument();
      expect(within(mobileView).getByText('6 Thu')).toBeInTheDocument();
      expect(within(mobileView).getByText('7 Fri')).toBeInTheDocument();
      expect(within(mobileView).queryByText('8 Sat')).not.toBeInTheDocument();
    });

    it('renders a multi-day schedule with cross-week Day X of N badges and single-day without badges', () => {
      const longSchedule = [
        {
          id: 'long-1',
          eventSlug: 'long-fest',
          eventName: 'Long Festival',
          isMainSchedule: true,
          eventStartDate: '2026-08-02', // Sun
          eventEndDate: '2026-08-11', // Tue (10 days total)
        },
        {
          id: 'single-1',
          eventSlug: 'music-fest',
          eventName: 'Single Day Event',
          isMainSchedule: false,
          eventStartDate: '2026-08-05', // Wed
        }
      ];

      const multiDaySegmentLabel = vi.fn((dayNumber: number, totalDays: number) => `Day ${dayNumber}/${totalDays} customized`);

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={longSchedule}
            labels={{ multiDaySegmentLabel }}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(multiDaySegmentLabel).toHaveBeenCalledWith(4, 10);
      expect(multiDaySegmentLabel).toHaveBeenCalledWith(5, 10);

      const customizedBadges = within(mobileView).getAllByText(/customized/);
      expect(customizedBadges[0]).toHaveTextContent('Day 4/10 customized');

      const singleDayCard = within(mobileView).getByText('Single Day Event').closest('button');
      expect(singleDayCard?.querySelector('[data-testid="multi-day-badge"]')).not.toBeInTheDocument();
    });

    it('falls back to default string when multiDaySegmentLabel is omitted', () => {
      const longSchedule = [
        {
          id: 'long-1',
          eventSlug: 'long-fest',
          eventName: 'Long Festival',
          isMainSchedule: true,
          eventStartDate: '2026-08-02',
          eventEndDate: '2026-08-11',
        }
      ];

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={longSchedule}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Day 4 of 10')).toBeInTheDocument();
    });

    it('caps desktop independently of the mobile list (mobile keeps its own flat-20 bound)', () => {
      const threeEvents = [
        { id: '1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
      ];

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={threeEvents}
            maxEventsPerDay={1} // Cap desktop but NOT the mobile list, which has its own flat 20
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Event 1')).toBeInTheDocument();
      expect(within(mobileView).getByText('Event 2')).toBeInTheDocument();
      expect(within(mobileView).getByText('Event 3')).toBeInTheDocument();
      // Well under the new flat-20 single-day bound, so mobile shows no overflow trigger at all.
      expect(within(mobileView).queryByTestId('calendar-overflow-trigger-mobile')).not.toBeInTheDocument();
    });

    it('caps at a flat 20 single-day occurrences and opens the shared dialog (Task 7.2)', () => {
      const twentyFive = Array.from({ length: 25 }, (_, i) => ({
        id: `m-${i + 1}`,
        eventName: `Mobile Event ${i + 1}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
      }));

      const onOverflowRequested = vi.fn();

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={twentyFive}
            onOverflowRequested={onOverflowRequested}
            overflowDialogData={{
              items: twentyFive.slice(20),
              fetchNextPage: vi.fn(),
              hasNextPage: false,
              isFetchingNextPage: false,
            }}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      // 20 render inline; the remaining 5 sit behind mobile's brand-new "+N more" affordance.
      expect(within(mobileView).getByText('Mobile Event 20')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Mobile Event 21')).not.toBeInTheDocument();

      const trigger = within(mobileView).getByTestId('calendar-overflow-trigger-mobile');
      expect(trigger).toHaveTextContent('+5 more');

      fireEvent.click(trigger);
      expect(onOverflowRequested).toHaveBeenCalledWith('2026-08-05', 'mobile', 5);

      const dialog = rtlScreen.getByRole('dialog', { name: /Schedules for/i });
      expect(within(dialog).getByRole('heading', { name: 'Mobile Event 21' })).toBeInTheDocument();
    });

    it('exempts multi-day segments from the mobile single-day cap (Task 7.2)', () => {
      // Exactly 20 single-day occurrences plus 2 multi-day ones: because multi-day segments are
      // never counted, all 22 render inline and no trigger appears — the same exemption principle
      // desktop's `day_cell` already applies.
      const schedules = [
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `single-${i + 1}`,
          eventName: `Single ${i + 1}`,
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
        })),
        { id: 'md-1', eventName: 'Expo One', isMainSchedule: true, eventStartDate: '2026-08-05', eventEndDate: '2026-08-07' },
        { id: 'md-2', eventName: 'Expo Two', isMainSchedule: true, eventStartDate: '2026-08-05', eventEndDate: '2026-08-06' },
      ];

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={schedules} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Single 1')).toBeInTheDocument();
      expect(within(mobileView).getByText('Single 20')).toBeInTheDocument();
      // Multi-day segments render day-by-day on mobile, so each appears once per covered day —
      // the assertion is simply that they are present inline and never counted toward the cap.
      expect(within(mobileView).getAllByText('Expo One').length).toBeGreaterThan(0);
      expect(within(mobileView).getAllByText('Expo Two').length).toBeGreaterThan(0);
      expect(within(mobileView).queryByTestId('calendar-overflow-trigger-mobile')).not.toBeInTheDocument();
    });

    it('renders the new date box (till text) and favorite count, with no redundant time-range-inline in list-variant', () => {
      const schedule = [
        {
          id: '1',
          eventSlug: 'test',
          eventName: 'Time and Fav Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          eventStartTime: '18:00:00',
          eventEndTime: '21:00:00',
          favoriteCount: 15,
        }
      ];

      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={schedule}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');

      // AC5 — the always-visible inline time range text is removed (redundant with the date box).
      expect(within(mobileView).queryByTestId('time-range-inline')).not.toBeInTheDocument();

      // AC4 — the new date box renders till/end timing content for this day's segment.
      const dateBox = container.querySelector('[data-event-card-date-box]');
      expect(dateBox).not.toBeNull();
      expect(dateBox).toHaveTextContent(/till/);
      expect(dateBox).toHaveTextContent(/9:00 PM/);

      // AC6 — the favorite count line is unchanged.
      const favLine = within(mobileView).getByTestId('favorite-count-line');
      expect(favLine).toBeInTheDocument();
      expect(favLine).toHaveTextContent('15');
    });

    it('uses plain linear Tab stops with tabIndex=0 and no roving attributes in list-variant', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      // filter out the day header toggle buttons (identified by their own data-testid)
      // and the thumbnail favorite-toggle buttons (identified by their accessible name)
      // before asserting tabIndex — neither is part of the plain-linear-tabstop set.
      const cards = within(mobileView).getAllByRole('button').filter(b =>
        b.getAttribute('data-testid') !== 'mobile-day-toggle' &&
        b.getAttribute('aria-label') !== 'Toggle favorite'
      );

      cards.forEach((card) => {
        expect(card).toHaveAttribute('tabIndex', '0');
      });
    });

    it('renders exactly one Heart icon when schedule isFavorited: true and favoriteCount > 0', () => {
      const schedule = [
        {
          id: '1',
          eventSlug: 'test',
          eventName: 'Fav Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          isFavorited: true,
          favoriteCount: 15,
        }
      ];
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={schedule} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');

      const badgeHeart = within(mobileView).queryByTestId('heart-icon');
      expect(badgeHeart).toBeInTheDocument();
      
      const favLine = within(mobileView).getByTestId('favorite-count-line');
      expect(favLine).toHaveTextContent('15');

      const countHeart = within(favLine).queryByLabelText('Favorites');
      expect(countHeart).not.toBeInTheDocument();

      // The count line still carries an accessible label even with its icon
      // suppressed, so screen-reader users aren't left with a bare number.
      expect(favLine).toHaveAttribute('aria-label', 'Favorites');
    });

    // Story 1.i1z CI ratchet — AC1 for the calendar compact-row surface: this test fails if
    // `CalendarCard`'s `variant='list'` branch reverts to local hardcoded sizing instead of the
    // `event_card_*` primitive. Part of Story 1.i1z.
    it('renders the thumbnail image and its favorite badge when imageUrl is present (AC1)', () => {
      const onFavoriteToggle = vi.fn();
      const schedule = [
        {
          id: 'thumb-1',
          eventSlug: 'test',
          eventName: 'Thumbnail Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          imageUrl: 'https://img.example/thumb.jpg',
          isFavorited: true,
          favoriteCount: 7,
        }
      ];
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={schedule}
            onFavoriteToggle={onFavoriteToggle}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const slot = container.querySelector('[data-event-card-media-slot]');
      expect(slot).not.toBeNull();

      const img = slot?.querySelector('img');
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute('src', 'https://img.example/thumb.jpg');

      // Favorite badge is always a live control when onFavoriteToggle is supplied (AD-15 Rule 4).
      expect(within(mobileView).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
    });

    // Story 1.i1z CI ratchet — AC2/AC3 for the calendar compact-row surface: this test proves the
    // reserved-blank footprint with no reflow and no placeholder when `imageUrl` is absent. Part of Story 1.i1z.
    it('renders the reserved-blank fallback with a large centered favorite badge when imageUrl is absent (AC2)', () => {
      const onFavoriteToggle = vi.fn();
      const schedule = [
        {
          id: 'noimg-1',
          eventSlug: 'test',
          eventName: 'No Image Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          isFavorited: false,
        }
      ];
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={schedule}
            onFavoriteToggle={onFavoriteToggle}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const slot = container.querySelector('[data-event-card-media-slot]');
      expect(slot).not.toBeNull();
      // Reserved-blank fallback: no <img> at all, and the large favorite control renders.
      expect(slot?.querySelector('img')).toBeNull();
      expect(within(mobileView).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
    });

    // Story 1.i1z CI ratchet — AC2/AC3 for the calendar compact-row surface: this test proves the
    // reserved-blank footprint with no reflow when the image `onError` fires. Part of Story 1.i1z.
    it('switches to the reserved-blank fallback when the image onError fires (AC2)', () => {
      const onFavoriteToggle = vi.fn();
      const schedule = [
        {
          id: 'err-1',
          eventSlug: 'test',
          eventName: 'Broken Image Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          imageUrl: 'https://img.example/broken.jpg',
          isFavorited: false,
        }
      ];
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={schedule}
            onFavoriteToggle={onFavoriteToggle}
          />
        </ScopedLocaleProvider>
      );

      const slot = container.querySelector('[data-event-card-media-slot]') as HTMLElement;
      expect(slot).not.toBeNull();
      const img = slot.querySelector('img');
      expect(img).not.toBeNull();

      fireEvent.error(img as Element);

      // After the error, the reserved 64x64 slot keeps its footprint (no reflow) but the image is gone.
      expect(slot.querySelector('img')).toBeNull();
      // The favorite badge (large, centered) still renders and remains interactive.
      expect(within(slot).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
    });

    it('fires onFavoriteToggle with the exact schedule and does not trigger onScheduleClick (AC3/AC7)', () => {
      const onFavoriteToggle = vi.fn();
      const onScheduleClick = vi.fn();
      const schedule = [
        {
          id: 'click-1',
          eventSlug: 'test',
          eventName: 'Clickable Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          imageUrl: 'https://img.example/click.jpg',
          isFavorited: true,
        }
      ];
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={schedule}
            onScheduleClick={onScheduleClick}
            onFavoriteToggle={onFavoriteToggle}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const favButton = within(mobileView).getByRole('button', { name: 'Toggle favorite' });
      fireEvent.click(favButton);

      expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
      expect(onFavoriteToggle).toHaveBeenCalledWith(schedule[0]);
      // Sibling-not-nested structure: toggling favorite must not navigate to the event.
      expect(onScheduleClick).not.toHaveBeenCalled();
    });

    it('renders no favorite badge at all when onFavoriteToggle is omitted', () => {
      const schedule = [
        {
          id: 'ro-1',
          eventSlug: 'test',
          eventName: 'Read Only Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          imageUrl: 'https://img.example/ro.jpg',
          isFavorited: true,
        }
      ];
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={schedule} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).queryByRole('button', { name: 'Toggle favorite' })).not.toBeInTheDocument();
    });

    it('shows a bare till on a continuing multi-day segment before its last day (AC4)', () => {
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[
              {
                id: 'md-1',
                eventSlug: 'test',
                eventName: 'Multi Day Event',
                isMainSchedule: true,
                eventStartDate: '2026-08-05',
                eventEndDate: '2026-08-07',
              }
            ]}
          />
        </ScopedLocaleProvider>
      );

      // Day 05 is the first expanded day, so its date box is the first in the list.
      const dateBox = container.querySelector('[data-event-card-date-box]');
      expect(dateBox).not.toBeNull();
      expect(dateBox).toHaveTextContent('till');
      expect((dateBox as HTMLElement).textContent).not.toMatch(/[0-9]:[0-9]{2}/);
    });

    it('shows the segment\'s real effective-end-date month/day on a continuing multi-day segment, with tillLabel as the amber tag (AC4)', () => {
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[
              {
                id: 'md-2',
                eventSlug: 'test',
                eventName: 'Multi Day Event Continuing',
                isMainSchedule: true,
                eventStartDate: '2026-08-05',
                eventEndDate: '2026-08-07',
              }
            ]}
          />
        </ScopedLocaleProvider>
      );

      // Day 05 (the segment's first, non-last day) is a "continuing" segment: month/day show
      // the real effective-end-date (Aug 7) since it's genuinely new information not already
      // shown by the day-row header.
      expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('Aug');
      expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('7');
      expect(container.querySelector('.bg-amber-700')).toHaveTextContent('till');
    });

    it('shows "till {time}" on the last day when an end time is known, and never the start date (AC4)', () => {
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[
              {
                id: 'lt-1',
                eventSlug: 'test',
                eventName: 'Last Day Event',
                isMainSchedule: true,
                eventStartDate: '2026-08-05',
                eventStartTime: '18:00:00',
                eventEndTime: '21:00:00',
              }
            ]}
          />
        </ScopedLocaleProvider>
      );

      const dateBox = container.querySelector('[data-event-card-date-box]') as HTMLElement;
      expect(dateBox).not.toBeNull();
      // Story 1.i1k: month/day are now separate elements (last/only-day branch: month carries
      // the till label text, day carries the formatted end time), not one flat text node.
      expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('till');
      expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('9:00 PM');
      // The date box never repeats the event's own start date text.
      expect(dateBox.textContent).not.toContain('Aug 5');
    });

    it('falls back to a bare till with an end date but no time, and with no end info at all (AC4)', () => {
      const { container: c1 } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[
              {
                id: 'nt-1',
                eventSlug: 'test',
                eventName: 'End Date No Time',
                isMainSchedule: true,
                eventStartDate: '2026-08-05',
                eventEndDate: '2026-08-05',
              }
            ]}
          />
        </ScopedLocaleProvider>
      );
      const dateBox1 = c1.querySelector('[data-event-card-date-box]') as HTMLElement;
      expect(dateBox1).not.toBeNull();
      expect(dateBox1.textContent).toBe('till');

      const { container: c2 } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[
              {
                id: 'ni-1',
                eventSlug: 'test',
                eventName: 'No End Info',
                isMainSchedule: true,
                eventStartDate: '2026-08-05',
              }
            ]}
          />
        </ScopedLocaleProvider>
      );
      const dateBox2 = c2.querySelector('[data-event-card-date-box]') as HTMLElement;
      expect(dateBox2).not.toBeNull();
      expect(dateBox2.textContent).toBe('till');
    });

    describe('Status and nearby badges (Story 1.i1j, AC1-AC6)', () => {
      it('renders the happeningNow status badge with the emerald treatment, identically on every day-segment of a multi-day schedule (AC1/AC2/AC5)', () => {
        // "now" pinned to the schedule's own first day so none of its 3 day-segment rows
        // (Aug 5/6/7) default-collapse as a past day (mobile collapses days before "today").
        vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));

        const schedule = [
          {
            id: 'hn-1',
            eventSlug: 'happening-now-fest',
            eventName: 'Happening Now Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-05',
            eventStartTime: '00:00:00',
            eventEndDate: '2026-08-07',
            eventEndTime: '23:00:00',
          },
        ];

        const { container } = render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} schedules={schedule} />
          </ScopedLocaleProvider>
        );

        const badges = container.querySelectorAll('[data-event-card-status-badge]');
        // AC5 — three day-segments (Aug 5/6/7), each independently computing status from the
        // same schedule-level start/end fields against the same real "now", so all three show
        // the identical happeningNow state.
        expect(badges).toHaveLength(3);
        badges.forEach((badge) => {
          expect(badge).toHaveTextContent('Now');
          expect(badge).toHaveClass('bg-emerald-600');
          expect(badge).toHaveClass('text-white');
        });
      });

      it('renders the Ended status badge with the shared neutral treatment, never emerald (AC1/AC2)', () => {
        vi.setSystemTime(new Date('2026-08-05T15:00:00Z'));

        const schedule = [
          {
            id: 'ended-1',
            eventSlug: 'ended-fest',
            eventName: 'Ended Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-05',
            eventStartTime: '09:00:00',
            eventEndDate: '2026-08-05',
            eventEndTime: '10:00:00',
          },
        ];

        const { container } = render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} schedules={schedule} />
          </ScopedLocaleProvider>
        );

        const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
        expect(badge).not.toBeNull();
        expect(badge).toHaveTextContent('Ended');
        expect(badge).toHaveClass('bg-muted');
        expect(badge).toHaveClass('text-muted-foreground');
        expect(badge).not.toHaveClass('bg-emerald-600');
      });

      it('renders the Upcoming status badge for a schedule starting 14+ days out (AC1/AC2)', () => {
        vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));

        const schedule = [
          {
            id: 'upcoming-1',
            eventSlug: 'upcoming-fest',
            eventName: 'Upcoming Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-10',
          },
        ];

        const { container } = render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} schedules={schedule} />
          </ScopedLocaleProvider>
        );

        const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
        expect(badge).not.toBeNull();
        expect(badge).toHaveTextContent('Upcoming');
      });

      it('renders the nearby badge only when distanceKm is below the 8km threshold, omitted at exactly 8 and at undefined (AC3)', () => {
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const schedules = [
          {
            id: 'near-1',
            eventSlug: 'near-fest',
            eventName: 'Near Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-05',
            distanceKm: 7.9,
          },
          {
            id: 'boundary-1',
            eventSlug: 'boundary-fest',
            eventName: 'Boundary Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-06',
            distanceKm: 8,
          },
          {
            id: 'unknown-1',
            eventSlug: 'unknown-fest',
            eventName: 'Unknown Distance Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-07',
          },
        ];

        const { container } = render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} schedules={schedules} />
          </ScopedLocaleProvider>
        );

        const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
        const nearCard = within(mobileView).getByText('Near Festival').closest('[data-testid="mobile-day-row"]') as HTMLElement;
        const boundaryCard = within(mobileView).getByText('Boundary Festival').closest('[data-testid="mobile-day-row"]') as HTMLElement;
        const unknownCard = within(mobileView).getByText('Unknown Distance Festival').closest('[data-testid="mobile-day-row"]') as HTMLElement;

        expect(nearCard.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
        expect(nearCard.querySelector('[data-event-card-nearby-badge]')).toHaveTextContent('Nearby');
        expect(boundaryCard.querySelector('[data-event-card-nearby-badge]')).toBeNull();
        expect(unknownCard.querySelector('[data-event-card-nearby-badge]')).toBeNull();
        // No placeholder/error markup takes its place when omitted.
        expect(container.querySelectorAll('[data-event-card-nearby-badge]')).toHaveLength(1);
      });

      it('appends the badge row as the content column\'s last child, after the multi-day-badge line (AC4)', () => {
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const schedule = [
          {
            id: 'md-order-1',
            eventSlug: 'order-fest',
            eventName: 'Order Festival',
            isMainSchedule: true,
            eventStartDate: '2026-08-05',
            eventEndDate: '2026-08-07',
            distanceKm: 1,
          },
        ];

        render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} schedules={schedule} />
          </ScopedLocaleProvider>
        );

        const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
        const card = within(mobileView).getAllByText('Order Festival')[0].closest('button') as HTMLElement;
        const contentColumn = card.querySelector('span.flex.min-w-0.w-full.flex-col') as HTMLElement;
        const lastChild = contentColumn.lastElementChild as HTMLElement;

        expect(lastChild.querySelector('[data-event-card-status-badge]')).not.toBeNull();
        expect(lastChild.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
        const multiDayBadgeIdx = Array.from(contentColumn.children).findIndex(
          (el) => el.getAttribute('data-testid') === 'multi-day-badge'
        );
        const badgeRowIdx = Array.from(contentColumn.children).indexOf(lastChild);
        expect(badgeRowIdx).toBeGreaterThan(multiDayBadgeIdx);
      });

      it('leaves variant="grid" completely unaffected — no status/nearby badge markup on desktop (AC7)', () => {
        vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));

        render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} />
          </ScopedLocaleProvider>
        );

        const desktopView = rtlScreen.getByTestId('desktop-calendar-view');
        expect(desktopView.querySelector('[data-event-card-status-badge]')).toBeNull();
        expect(desktopView.querySelector('[data-event-card-nearby-badge]')).toBeNull();
      });
    });
  });
  describe('Mobile Day Collapse State', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      // "Today" is 2026-08-06.
      // 2026-08-05 is past (default collapsed).
      // 2026-08-06 is today (default expanded).
      // 2026-08-07 is future (default expanded).
      vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
    });
    
    afterAll(() => {
      vi.useRealTimers();
    });

    it('defaults past days to collapsed and today/future to expanded, and allows toggling', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} timezone="UTC" />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      
      // 2026-08-05 (past) -> collapsed
      const pastHeader = within(mobileView).getByText('5 Wed').closest('button')!;
      expect(pastHeader).toHaveAttribute('aria-expanded', 'false');
      expect(within(mobileView).queryByText('Main Stage Concert')).not.toBeInTheDocument();

      // 2026-08-06 (today) -> expanded
      const todayHeader = within(mobileView).getByText('6 Thu').closest('button')!;
      expect(todayHeader).toHaveAttribute('aria-expanded', 'true');
      expect(within(mobileView).getByText('Gallery Tour')).toBeInTheDocument();

      // 2026-08-07 (future) -> expanded
      const futureHeader = within(mobileView).getByText('7 Fri').closest('button')!;
      expect(futureHeader).toHaveAttribute('aria-expanded', 'true');
      expect(within(mobileView).getAllByText('Tech Workshop').length).toBeGreaterThan(0);

      // Toggle past open
      fireEvent.click(pastHeader);
      expect(pastHeader).toHaveAttribute('aria-expanded', 'true');
      expect(within(mobileView).getByText('Main Stage Concert')).toBeInTheDocument();

      // Toggle today closed
      fireEvent.click(todayHeader);
      expect(todayHeader).toHaveAttribute('aria-expanded', 'false');
      expect(within(mobileView).queryByText('Gallery Tour')).not.toBeInTheDocument();
    });
  });
  describe('Story 1.i1l — compact-row title wrap and the 11px floor (rule 6, rule 5)', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      // 2026-08-04 makes every day of the 2026-08-05 week future-dated, so the
      // mobile list variant renders expanded and its rows are queryable.
      vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    const longNameSchedule = [
      {
        id: 'wrap-1',
        eventSlug: 'wrap-fest',
        eventName: 'A Deliberately Long Festival Name That Needs Two Lines',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07', // multi-day, so the badge renders too
      },
    ];

    it('wraps the compact-row title to two lines and drops the parent clip that would no-op it', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={longNameSchedule} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const title = within(mobileView).getAllByText(
        'A Deliberately Long Festival Name That Needs Two Lines'
      )[0];

      expect(title).toHaveClass('line-clamp-2');
      expect(title).not.toHaveClass('truncate');

      // The parent's own `truncate` is what silently defeats `line-clamp-2`, so
      // its removal is the load-bearing half of rule 6 and is asserted directly.
      const titleRow = title.parentElement as HTMLElement;
      expect(titleRow).not.toHaveClass('truncate');
      expect(titleRow).toHaveClass('items-start');
      expect(titleRow).not.toHaveClass('items-center');
    });

    it('nudges the inline row icons to the first line once the title can wrap', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[{ ...longNameSchedule[0], isFavorited: true, isAddedToCalendar: true }]}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const row = within(mobileView).getAllByText(
        'A Deliberately Long Festival Name That Needs Two Lines'
      )[0].parentElement as HTMLElement;

      expect(within(row).getByTestId('heart-icon')).toHaveClass('mt-0.5');
      expect(within(row).getByTestId('calendar-plus-icon')).toHaveClass('mt-0.5');
    });

    it('raises the multi-day badge to the 11px legibility floor', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={longNameSchedule} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const badge = within(mobileView).getAllByTestId('multi-day-badge')[0];

      expect(badge).toHaveClass('text-[11px]');
      expect(badge).not.toHaveClass('text-[10px]');
    });

    it('leaves the variant="grid" day-cell title clipped to one line (rule 6 is compact-row only)', () => {
      // Single-day on purpose: a multi-day schedule renders on desktop as a spanning
      // bar built from `EventCardCalendarGridItem`, which is a different component with
      // its own title styling. The day-cell title is only reachable via a single-day row.
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={[{ ...longNameSchedule[0], eventEndDate: '2026-08-05' }]}
          />
        </ScopedLocaleProvider>
      );

      const desktopView = rtlScreen.getByTestId('desktop-calendar-view');
      const gridTitle = within(desktopView).getAllByText(
        'A Deliberately Long Festival Name That Needs Two Lines'
      )[0];

      expect(gridTitle).toHaveClass('truncate');
      expect(gridTitle).not.toHaveClass('line-clamp-2');
      expect(gridTitle.parentElement as HTMLElement).toHaveClass('truncate', 'items-center');
    });
  });

});
