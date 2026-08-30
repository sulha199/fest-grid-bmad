/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen as rtlScreen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('opens the week picker and calls onSelectWeek with the picked date', () => {
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
    const outOfBoundsSchedule = [
      {
        id: 'sched-boundary',
        eventSlug: 'long-fest',
        eventName: 'Boundary Festival',
        isMainSchedule: true,
        eventStartDate: '2026-07-31',
        eventEndDate: '2026-08-04',
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

    const segments = screen.getAllByText('Boundary Festival');
    expect(segments.length).toBe(3);
  });

  it('camps daily events if they exceed maxEventsPerDay and triggers popover', () => {
    // Sunday Aug 2 gets 3 events
    const lotsOfEvents = [
      { id: '1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
      { id: '3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
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

    it('never caps events or shows a popover trigger, rendering all schedules', () => {
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
            maxEventsPerDay={1} // Cap desktop but NOT mobile
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Event 1')).toBeInTheDocument();
      expect(within(mobileView).getByText('Event 2')).toBeInTheDocument();
      expect(within(mobileView).getByText('Event 3')).toBeInTheDocument();
      expect(within(mobileView).queryByText(/\+.*more/)).not.toBeInTheDocument();
    });

    it('renders always-visible time range inline text and favorite count inside list-variant', () => {
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

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={schedule}
          />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      
      // Inline time range text
      const inlineTime = within(mobileView).getByTestId('time-range-inline');
      expect(inlineTime).toBeInTheDocument();
      expect(inlineTime).toHaveTextContent(/18:00|6:00/);

      // Favorite count line
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
      const cards = within(mobileView).getAllByRole('button');

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
  });
});
