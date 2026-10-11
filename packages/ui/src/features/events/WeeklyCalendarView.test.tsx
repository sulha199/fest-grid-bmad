/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen as rtlScreen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { WeeklyCalendarView } from './WeeklyCalendarView';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';
import { EVENT_CARD_BADGE_FONT_SIZE_VAR, EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE } from './event-card-media-tokens';

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

const observerCallbacks: IntersectionObserverCallback[] = [];

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
    getWeekRange,
    onToday: vi.fn(),
    onPrevWeek: vi.fn(),
    onNextWeek: vi.fn(),
    onScheduleClick: vi.fn(),
    status: 'success' as const,
  };

  /** Mobile tab accessible names carry the day's count, e.g. "5 Wed (2)" — match on the day prefix. */
  const dayTabName = (name: string) => new RegExp(`^${name}( \\(|$)`);

  /** The grid cell (positioned wrapper) and band an item was placed in on the desktop grid. */
  const cellOf = (el: HTMLElement) => {
    let node: HTMLElement = el;
    while (node.parentElement && node.parentElement.getAttribute('data-testid') !== 'calendar-band') {
      node = node.parentElement;
    }
    return { cell: node, band: Number(node.parentElement?.getAttribute('data-band')) };
  };
  const desktopTitles = () =>
    within(rtlScreen.getByTestId('calendar-bands'))
      .getAllByTestId('calendar-grid-card')
      .map((card) => card.querySelector('h3')?.textContent);

  const selectMobileDay = (name: string) => {
    const tab = within(rtlScreen.getByTestId('mobile-calendar-view')).getByRole('tab', { name: dayTabName(name) });
    fireEvent.click(tab);
    return tab;
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
      fireEvent.click(within(rtlScreen.getByRole('dialog')).getAllByText('10')[0]);

      expect(onSelectWeek).toHaveBeenCalledWith('2026-08-10');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders compact schedule cards, both main and sub schedules, on the desktop grid', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // BUG-048: the grid-variant title is now `EventCardCalendarGridItem`'s own `<h3>`, which
    // (like VM6's already-shipped multi-day spanning bar) always renders `font-bold` — the
    // main/sub `isMainSchedule` weight distinction the old plain-text pill drew is a property of
    // the pill this fix replaces, not something the shared primitive exposes; VM6 already ships
    // without it too. `variant='list'` (mobile) keeps its own separate weight distinction.
    const mainCard = screen.getByRole('button', { name: 'Main Stage Concert' });
    expect(mainCard).toBeInTheDocument();
    expect(screen.getByText('Main Stage Concert')).toHaveClass('font-bold');

    const subCard = screen.getByRole('button', { name: 'Gallery Tour' });
    expect(subCard).toBeInTheDocument();
    expect(screen.getByText('Gallery Tour')).toHaveClass('font-bold');
  });

  it('renders a multi-day schedule as one spanning card across its day columns (AC1/AC2/AC13)', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // Tech Workshop is multi-day: Aug 5 (Wed) -> Aug 7 (Fri). The visible week starts on the
    // supplied weekStart (Aug 5), so those are columns 1-3 of the 7-column grid.
    const grid = rtlScreen.getByTestId('calendar-bands');
    const bars = within(grid).getAllByTestId('multi-day-spanning-bar');

    // Exactly ONE rendered instance — not N per-day segments (AC1).
    expect(bars).toHaveLength(1);
    expect(within(bars[0]).getByText('Tech Workshop')).toBeInTheDocument();
    expect(screen.getAllByText('Tech Workshop')).toHaveLength(1);

    // The bar lives in the same band grid as the single-day cards (no separate banner above).
    expect(rtlScreen.queryByTestId('multi-day-spanning-banner')).not.toBeInTheDocument();
    const { cell, band } = cellOf(bars[0]);
    expect(band).toBe(0);
    expect(cell.parentElement).toHaveClass('grid-cols-7');

    // AC1/AC3 — spans its clipped day-column range via an explicit grid-column. Main Stage
    // Concert (Aug 5, ends earlier) takes row 1 of column 1, so the bar packs into row 2.
    expect(cell).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '2' });
    // Gallery Tour (Thu) first-fits into row 1 beside it, inside the same band.
    expect(cellOf(screen.getByRole('button', { name: 'Gallery Tour' })).cell).toHaveStyle({
      gridColumn: '2 / span 1',
      gridRow: '1',
    });
  });

  it('BUG-050 (AC-GRID-1): renders 7 fixed, content-independent gridline markers behind each band, not divide-x on the real schedule count', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    const band = rtlScreen.getAllByTestId('calendar-band')[0];

    // The old (broken) mechanism derived column separators from `divide-x`'s DOM-sibling-adjacency
    // selector directly on the real cards, which never map 1:1 to the 7 visual columns.
    expect(band).not.toHaveClass('divide-x');
    expect(band).toHaveClass('grid-cols-7');

    // A dedicated, always-7-children overlay, decoupled from schedule count, painted behind the
    // real cards (first in the DOM) and out of the a11y tree/pointer events.
    const guides = within(band).getByTestId('grid-column-guides');
    expect(guides).toHaveClass('grid-cols-7', 'divide-x', 'divide-gray-200', 'pointer-events-none');
    expect(guides).toHaveAttribute('aria-hidden', 'true');
    expect(guides.children).toHaveLength(7);
    expect(band.firstElementChild).toBe(guides);
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

    render(<WeeklyCalendarView {...defaultProps} schedules={overlapping} locale="en-US" />);

    const bars = within(rtlScreen.getByTestId('calendar-bands')).getAllByTestId('multi-day-spanning-bar');
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.getAttribute('data-schedule-id'))).toEqual(['md-early', 'md-late']);

    // Overlapping spans stack instead of colliding.
    expect(cellOf(bars[0]).cell).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '1' });
    expect(cellOf(bars[1]).cell).toHaveStyle({ gridColumn: '2 / span 3', gridRow: '2' });

    // One guide overlay per band, never one per sub-row.
    const band = rtlScreen.getAllByTestId('calendar-band')[0];
    expect(within(band).getAllByTestId('grid-column-guides')).toHaveLength(1);
    expect(within(band).getByTestId('grid-column-guides').children).toHaveLength(7);
  });

  it('renders no band (and so no guide overlay) when the week has no schedules at all', () => {
    render(<WeeklyCalendarView {...defaultProps} schedules={[]} locale="en-US" />);

    expect(rtlScreen.queryByTestId('calendar-band')).not.toBeInTheDocument();
    expect(rtlScreen.queryByTestId('grid-column-guides')).not.toBeInTheDocument();
    expect(rtlScreen.getByTestId('calendar-empty')).toBeInTheDocument();
    // Nothing to page: no progress line, no sentinel, no button.
    expect(rtlScreen.queryByTestId('calendar-show-more')).not.toBeInTheDocument();
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

    const bars = within(rtlScreen.getByTestId('calendar-bands')).getAllByTestId('multi-day-spanning-bar');
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.getAttribute('data-schedule-id'))).toEqual([
      'sched-boundary',
      'sched-trailing',
    ]);

    // Clipped to the on-screen columns, never off-grid: leading edge -> columns 1-3,
    // trailing edge -> columns 5-7. They do not overlap, so both first-fit into row 1.
    expect(cellOf(bars[0]).cell).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '1' });
    expect(cellOf(bars[1]).cell).toHaveStyle({ gridColumn: '5 / span 3', gridRow: '1' });

    // Still exactly one instance each (never repeated per day of the week).
    expect(screen.getAllByText('Boundary Festival')).toHaveLength(1);
    expect(screen.getAllByText('Trailing Festival')).toHaveLength(1);
  });

  describe('Banded grid paging (spec-calendar-unified-banded-grid)', () => {
    beforeAll(() => {
      // jsdom ships no IntersectionObserver; capture callbacks so tests can fire the sentinel.
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback) {
            observerCallbacks.push(cb);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
          takeRecords() { return []; }
        }
      );
    });

    afterAll(() => {
      vi.unstubAllGlobals();
    });

    const fourteen = Array.from({ length: 14 }, (_, i) => ({
      id: `e-${String(i + 1).padStart(2, '0')}`,
      eventSlug: `e${i + 1}`,
      eventName: `Wed Event ${String(i + 1).padStart(2, '0')}`,
      isMainSchedule: true,
      eventStartDate: '2026-08-05',
      eventStartTime: `${String(8 + i).padStart(2, '0')}:00:00`,
    }));

    it('pages one band (6 rows per column) at a time, appending below and never reordering what is shown', () => {
      render(<WeeklyCalendarView {...defaultProps} schedules={fourteen} locale="en-US" />);

      const titles = () => desktopTitles();
      expect(titles()).toHaveLength(6);
      expect(rtlScreen.getAllByTestId('calendar-band')).toHaveLength(1);
      // Header: day total + "+N below" while rows are still hidden.
      expect(rtlScreen.getAllByTestId('desktop-day-total')[0]).toHaveTextContent('14');
      expect(rtlScreen.getAllByTestId('desktop-day-below')[0]).toHaveTextContent('+8 below');
      expect(rtlScreen.getByTestId('calendar-progress')).toHaveTextContent('Showing 6 of 14 schedules this week');
      const first = titles();

      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      expect(rtlScreen.getAllByTestId('calendar-band')).toHaveLength(2);
      expect(titles()).toHaveLength(12);
      // Append-only: the first page is an unchanged prefix of the second.
      expect(titles().slice(0, 6)).toEqual(first);
      expect(rtlScreen.getAllByTestId('desktop-day-below')[0]).toHaveTextContent('+2 below');

      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      expect(titles()).toHaveLength(14);
      expect(rtlScreen.getAllByTestId('calendar-band')).toHaveLength(3);

      // Hard stop: everything shown, so the sentinel/button/below markers are gone.
      expect(rtlScreen.queryByTestId('calendar-show-more')).not.toBeInTheDocument();
      expect(rtlScreen.queryByTestId('calendar-load-more-sentinel')).not.toBeInTheDocument();
      expect(rtlScreen.queryByTestId('desktop-day-below')).not.toBeInTheDocument();
      expect(rtlScreen.getByTestId('calendar-progress')).toHaveTextContent('All 14 shown');
    });

    it('reveals the next band when the infinite-scroll sentinel intersects', () => {
      const before = observerCallbacks.length;
      render(<WeeklyCalendarView {...defaultProps} schedules={fourteen} locale="en-US" />);
      expect(desktopTitles()).toHaveLength(6);
      // The mobile list mounts its own sentinel too; fire every observer this render created.
      act(() => {
        observerCallbacks
          .slice(before)
          .forEach((cb) => cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
      });
      expect(desktopTitles()).toHaveLength(12);
    });

    it('orders by start date, then end date, then start time, then id — one ordering for singles and bars', () => {
      const mixed = [
        { id: 'z-single', eventName: 'Single Late', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '20:00:00' },
        { id: 'a-bar', eventName: 'Bar Ends Later', isMainSchedule: true, eventStartDate: '2026-08-05', eventEndDate: '2026-08-06', eventStartTime: '07:00:00' },
        { id: 'b-single', eventName: 'Single Early', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '09:00:00' },
        { id: 'c-prev', eventName: 'Started Earlier', isMainSchedule: true, eventStartDate: '2026-08-03', eventEndDate: '2026-08-09', eventStartTime: '23:00:00' },
      ];
      render(<WeeklyCalendarView {...defaultProps} schedules={mixed} locale="en-US" />);
      const rows = rtlScreen
        .getAllByTestId('calendar-band')[0]
        .querySelectorAll('[data-testid="calendar-grid-card"], [data-testid="multi-day-spanning-bar"]');
      const names = Array.from(rows).map((el) => el.querySelector('h3')?.textContent);
      // Reading order within the band follows packing; compare by the sort rank via row/col instead:
      const cells = Array.from(rows).map((el) => cellOf(el as HTMLElement).cell);
      const byName = Object.fromEntries(names.map((n, i) => [n, cells[i]]));
      // "Started Earlier" sorts first and takes row 1 (a full-width bar).
      expect(byName['Started Earlier']).toHaveStyle({ gridRow: '1' });
      // Same start date: ends earlier first — both singles (end Aug 5) before the bar ending Aug 6;
      // singles share column 1 so they stack; the bar then needs a free row across col 1-2.
      expect(byName['Single Early']).toHaveStyle({ gridRow: '2' });
      expect(byName['Single Late']).toHaveStyle({ gridRow: '3' });
      expect(byName['Bar Ends Later']).toHaveStyle({ gridRow: '4' });
    });

    it('counts a multi-day bar once in every column it covers (header totals)', () => {
      const mixed = [
        { id: '1', eventSlug: 'e1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '2', eventSlug: 'e2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '3', eventSlug: 'e3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: 'md-expo', eventSlug: 'expo', eventName: 'All Week Expo', isMainSchedule: true, eventStartDate: '2026-08-05', eventEndDate: '2026-08-07' },
      ];
      render(<WeeklyCalendarView {...defaultProps} schedules={mixed} locale="en-US" />);

      const totals = rtlScreen.getAllByTestId('desktop-day-total').map((el) => el.textContent);
      expect(totals).toEqual(['4', '1', '1', '0', '0', '0', '0']);
      // Rendered exactly once overall.
      expect(screen.getAllByText('All Week Expo')).toHaveLength(1);
    });

    it('appends a late-arriving row that sorts earlier BELOW what is already rendered (no row above)', () => {
      const base = [
        { id: 'a1', eventSlug: 'a1', eventName: 'A1', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '10:00:00' },
        { id: 'a2', eventSlug: 'a2', eventName: 'A2', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '11:00:00' },
        { id: 'a3', eventSlug: 'a3', eventName: 'A3', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '12:00:00' },
      ];
      const early = { id: 'a0', eventSlug: 'a0', eventName: 'A0 Early', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '08:00:00' };
      const ui = (continuation?: any) => (
        <WeeklyCalendarView
          {...defaultProps}
          schedules={base}
          locale="en-US"
          dayFetchLimit={3}
          dayContinuations={continuation ? { '2026-08-05': continuation } : undefined}
        />
      );
      const { rerender } = render(ui());
      expect(desktopTitles()).toEqual(['A1', 'A2', 'A3']);

      rerender(
        ui({ items: [early], fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false })
      );
      // Sorted order would put A0 first; append-only places it after the rows already on screen.
      expect(desktopTitles()).toEqual(['A1', 'A2', 'A3', 'A0 Early']);
    });

    it('asks the caller for a truncated day\'s continuation once everything loaded is shown, then pages it', () => {
      const window3 = Array.from({ length: 3 }, (_, i) => ({
        id: `w-${i + 1}`,
        eventSlug: `w${i + 1}`,
        eventName: `Windowed ${i + 1}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventStartTime: `${String(9 + i).padStart(2, '0')}:00:00`,
      }));
      const onDayContinuationRequested = vi.fn();
      const fetchNextPage = vi.fn();
      const ui = (continuation?: any) => (
        <WeeklyCalendarView
          {...defaultProps}
          schedules={window3}
          locale="en-US"
          dayFetchLimit={3}
          onDayContinuationRequested={onDayContinuationRequested}
          dayContinuations={continuation ? { '2026-08-05': continuation } : undefined}
        />
      );
      const { rerender } = render(ui());

      // The day filled its window, so the server may hold more: header says so, and the controls stay.
      expect(rtlScreen.getAllByTestId('desktop-day-total')[0]).toHaveTextContent('3+');
      expect(rtlScreen.getByTestId('calendar-progress')).toHaveTextContent('Showing 3 of 3+ schedules this week');

      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      expect(onDayContinuationRequested).toHaveBeenCalledWith('2026-08-05');

      // First continuation page lands; more pages remain.
      const extra = { id: 'w-4', eventSlug: 'w4', eventName: 'Windowed 4', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '15:00:00' };
      rerender(ui({ items: [extra], fetchNextPage, hasNextPage: true, isFetchingNextPage: false }));
      expect(desktopTitles()).toContain('Windowed 4');
      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      expect(fetchNextPage).toHaveBeenCalledTimes(1);

      // Server exhausted: hard stop.
      rerender(ui({ items: [extra], fetchNextPage, hasNextPage: false, isFetchingNextPage: false }));
      expect(rtlScreen.queryByTestId('calendar-show-more')).not.toBeInTheDocument();
      expect(rtlScreen.getByTestId('calendar-progress')).toHaveTextContent('All 4 shown');
      expect(rtlScreen.getAllByTestId('desktop-day-total')[0]).toHaveTextContent('4');
    });

    it('pages bars too, 6 per column per band, and starts over on week change', () => {
      const multiDay = Array.from({ length: 25 }, (_, i) => ({
        id: `bar-${i + 1}`,
        eventName: `Bar ${String(i + 1).padStart(2, '0')}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-09',
      }));
      const ui = (weekStart: string) => (
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} weekStart={weekStart} schedules={multiDay} />
        </ScopedLocaleProvider>
      );
      const { rerender } = render(ui('2026-08-05'));
      const bars = () => within(rtlScreen.getByTestId('desktop-calendar-view')).getAllByTestId('multi-day-spanning-bar');

      expect(bars()).toHaveLength(6);
      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      expect(bars()).toHaveLength(12);
      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      fireEvent.click(rtlScreen.getByTestId('calendar-show-more'));
      expect(bars()).toHaveLength(25);
      expect(rtlScreen.queryByTestId('calendar-show-more')).not.toBeInTheDocument();

      // Another week with the same schedules starts again at the first band.
      rerender(ui('2026-08-03'));
      expect(bars()).toHaveLength(6);
    });

    it('triggers onScheduleClick with the full schedule object on a grid card click', () => {
      const onScheduleClick = vi.fn();
      const three = [
        { id: '1', eventSlug: 'e1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '2', eventSlug: 'e2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
      ];
      render(<WeeklyCalendarView {...defaultProps} schedules={three} onScheduleClick={onScheduleClick} locale="en-US" />);

      // BUG-048: the click target is the sibling `<button>` (accessible name = `schedule.eventName`).
      fireEvent.click(rtlScreen.getByRole('button', { name: 'Event 2' }));
      expect(onScheduleClick).toHaveBeenLastCalledWith(three[1]);
    });
  });

  it('hovering and keyboard focusing compact card displays custom tooltip', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // BUG-048: the click target is a sibling of the visible card now, with no text content of
    // its own — its accessible name comes from `aria-label={schedule.eventName}` instead.
    const cardButton = screen.getByRole('button', { name: 'Gallery Tour' });
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

    // The bar is one roving-tabindex stop in the banded grid (not the first card, so not the tab stop).
    expect(barButton).toHaveAttribute('tabIndex', '-1');
    expect(barButton).toHaveAttribute('id');

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

  it('renders the spanning card venue from locationName and the <8km nearby badge with the real distance (BUG-049) (AC8/AC10)', () => {
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
    expect(within(bar).getByText('3 km')).toBeInTheDocument();

    cleanup();

    render(<WeeklyCalendarView {...defaultProps} schedules={withoutVenue} locale="en-US" />);

    const barNoVenue = rtlScreen.getByTestId('multi-day-spanning-bar');
    // AC10 — degrades gracefully when the venue is absent: no venue line, no placeholder.
    expect(within(barNoVenue).queryByText('Hall 4')).not.toBeInTheDocument();
    expect(barNoVenue.querySelector('[data-event-card-nearby-badge]')).toBeNull();
  });

  it('roving-tabindex keyboard arrow navigation between schedule cards and bars behaves correctly', () => {
    render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

    // Banded layout (band 0):
    //   row 1: Main Stage Concert (col 1), Gallery Tour (col 2)
    //   row 2: Tech Workshop bar (cols 1-3)
    const concert = screen.getByRole('button', { name: 'Main Stage Concert' });
    const gallery = screen.getByRole('button', { name: 'Gallery Tour' });
    const workshop = screen.getByRole('button', { name: 'Tech Workshop' });

    // Initial roving tabIndex=0 is the first rendered item in reading order
    expect(concert).toHaveAttribute('tabIndex', '0');
    expect(gallery).toHaveAttribute('tabIndex', '-1');
    expect(workshop).toHaveAttribute('tabIndex', '-1');

    // ArrowRight walks reading order
    fireEvent.keyDown(concert, { key: 'ArrowRight' });
    expect(gallery).toHaveFocus();
    expect(gallery).toHaveAttribute('tabIndex', '0');
    expect(concert).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(gallery, { key: 'ArrowLeft' });
    expect(concert).toHaveFocus();

    // ArrowDown stays in the column and lands on the bar covering it
    fireEvent.keyDown(concert, { key: 'ArrowDown' });
    expect(workshop).toHaveFocus();
    fireEvent.keyDown(workshop, { key: 'ArrowUp' });
    expect(concert).toHaveFocus();
    fireEvent.keyDown(gallery, { key: 'ArrowDown' });
    expect(workshop).toHaveFocus();

    // Nothing below the bar: focus must not be stranded on something that is not rendered.
    fireEvent.keyDown(workshop, { key: 'ArrowDown' });
    expect(workshop).toHaveFocus();
    fireEvent.keyDown(workshop, { key: 'ArrowRight' });
    expect(workshop).toHaveFocus();
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

    // BUG-048: the grid cell now composes `EventCardCalendarGridItem` inside a wrapper carrying
    // `data-testid="calendar-grid-card"` — the schedule name is no longer inside the click
    // `<button>` (that button now carries only an `aria-label`), so queries anchor on the wrapper.
    // No `onFavoriteToggle` is passed here, so `isFavorited` falls back to the decorative heart.

    // Fav Event should have heart badge
    const favCard = screen.getByText('Fav Event').closest('[data-testid="calendar-grid-card"]');
    expect(favCard?.querySelector('[data-testid="heart-icon"]')).toBeInTheDocument();
    expect(favCard?.querySelector('[data-testid="calendar-plus-icon"]')).not.toBeInTheDocument();

    // Added Event should have calendar plus badge
    const addedCard = screen.getByText('Added Event').closest('[data-testid="calendar-grid-card"]');
    expect(addedCard?.querySelector('[data-testid="heart-icon"]')).not.toBeInTheDocument();
    expect(addedCard?.querySelector('[data-testid="calendar-plus-icon"]')).toBeInTheDocument();

    // Both Event should have both badges
    const bothCard = screen.getByText('Both Event').closest('[data-testid="calendar-grid-card"]');
    expect(bothCard?.querySelector('[data-testid="heart-icon"]')).toBeInTheDocument();
    expect(bothCard?.querySelector('[data-testid="calendar-plus-icon"]')).toBeInTheDocument();

    // None Event should have neither badge
    const noneCard = screen.getByText('None Event').closest('[data-testid="calendar-grid-card"]');
    expect(noneCard?.querySelector('[data-testid="heart-icon"]')).not.toBeInTheDocument();
    expect(noneCard?.querySelector('[data-testid="calendar-plus-icon"]')).not.toBeInTheDocument();
  });

  it('FIND-058: renders the added-to-calendar badge on the multi-day spanning bar, matching the single-day grid card', () => {
    const multiDayAdded = [
      {
        id: 'md-added',
        eventSlug: 'multi-added-fest',
        eventName: 'Multi Added Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
        isAddedToCalendar: true,
      },
    ];
    const multiDayNotAdded = [
      {
        id: 'md-not-added',
        eventSlug: 'multi-plain-fest',
        eventName: 'Multi Plain Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
      },
    ];

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={multiDayAdded}
        locale="en-US"
        onFavoriteToggle={vi.fn()}
      />
    );

    const addedBar = rtlScreen.getByTestId('multi-day-spanning-bar');
    const addedIcon = addedBar.querySelector('[data-testid="calendar-plus-icon"]');
    expect(addedIcon).toBeInTheDocument();
    expect(addedIcon).toHaveAttribute('aria-label', 'Added to calendar');

    cleanup();

    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={multiDayNotAdded}
        locale="en-US"
        onFavoriteToggle={vi.fn()}
      />
    );

    const plainBar = rtlScreen.getByTestId('multi-day-spanning-bar');
    expect(plainBar.querySelector('[data-testid="calendar-plus-icon"]')).not.toBeInTheDocument();
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

    // BUG-048: the grid cell's favorite count is now shown inside
    // `EventCardCalendarGridItem`'s own favorite-toggle control (`EventCardFavoriteBadge`), which
    // only renders when `onFavoriteToggle` is supplied (same tradeoff VM6's spanning bar already
    // ships with) — so this scenario needs the handler passed to exercise the count at all. That
    // control also renders "0" (its own gate is `favoriteCount !== undefined`, not `> 0`), unlike
    // the superseded plain-text pill which hid the line entirely at 0.
    render(
      <WeeklyCalendarView
        {...defaultProps}
        schedules={customizedSchedules}
        locale="en-US"
        onFavoriteToggle={vi.fn()}
      />
    );

    const cardWith5 = screen.getByText('Event with 5 Favorites').closest('[data-testid="calendar-grid-card"]') as HTMLElement;
    expect(within(cardWith5).getByText('5')).toBeInTheDocument();

    const cardWith0 = screen.getByText('Event with 0 Favorites').closest('[data-testid="calendar-grid-card"]') as HTMLElement;
    expect(within(cardWith0).getByText('0')).toBeInTheDocument();

    const cardWithUndefined = screen.getByText('Event with Undefined Favorites').closest('[data-testid="calendar-grid-card"]') as HTMLElement;
    // No count span at all when `favoriteCount` is undefined — only the icon renders.
    expect(within(cardWithUndefined).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
    expect(within(cardWithUndefined).queryByText('0')).not.toBeInTheDocument();
  });

  describe('Mobile Vertical List View (AC15)', () => {
    beforeAll(() => {
      // jsdom ships no IntersectionObserver; capture callbacks so tests can fire the sentinel.
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback) {
            observerCallbacks.push(cb);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
          takeRecords() { return []; }
        }
      );
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    });
    
    afterAll(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('renders 7 day tabs and only the selected day\'s schedules, with an empty-day message when none', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getAllByRole('tab')).toHaveLength(7);
      // Single panel, not one row per day.
      expect(within(mobileView).getAllByTestId('mobile-day-row')).toHaveLength(1);

      // Saturday has no schedules: the tab is still selectable and shows the empty message.
      selectMobileDay('8 Sat');
      expect(within(mobileView).getByTestId('mobile-day-empty')).toBeInTheDocument();
      expect(within(mobileView).getByRole('tab', { name: dayTabName('8 Sat') })).toHaveAttribute('aria-selected', 'true');

      // A day with schedules shows them and no empty message.
      selectMobileDay('7 Fri');
      expect(within(mobileView).queryByTestId('mobile-day-empty')).not.toBeInTheDocument();
      expect(within(mobileView).getAllByRole('button').length).toBeGreaterThan(0);
    });

    // User feedback (2026-09-27): "don't show 'day 3 of 3'" -- the mobile list view's per-day
    // "Day X of N" badge is removed entirely for multi-day schedules (this was already the
    // established rule for the desktop grid variant, per EVENT-CARD-DESIGN.md's
    // event_card_calendar_grid_item "NO DAY X OF N BADGE" note -- the mobile list view is now
    // consistent with it). `multiDaySegmentLabel` stays a valid (if now unconsumed) field on
    // `WeeklyCalendarViewLabels` for API stability; `CalendarCard` itself no longer reads it.
    it('never renders a "Day X of N" badge for a multi-day schedule in the mobile list view', () => {
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

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={longSchedule} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).queryByTestId('multi-day-badge')).not.toBeInTheDocument();
      expect(within(mobileView).queryByText(/Day \d+ of \d+/)).not.toBeInTheDocument();

      const singleDayCard = within(mobileView).getByText('Single Day Event').closest('button');
      expect(singleDayCard?.querySelector('[data-testid="multi-day-badge"]')).not.toBeInTheDocument();
    });

    it('lists every single-day schedule of the selected day on mobile when under one page', () => {
      const threeEvents = [
        { id: '1', eventName: 'Event 1', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '2', eventName: 'Event 2', isMainSchedule: true, eventStartDate: '2026-08-05' },
        { id: '3', eventName: 'Event 3', isMainSchedule: true, eventStartDate: '2026-08-05' },
      ];

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={threeEvents} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Event 1')).toBeInTheDocument();
      expect(within(mobileView).getByText('Event 2')).toBeInTheDocument();
      expect(within(mobileView).getByText('Event 3')).toBeInTheDocument();
      // Under one page, so there is nothing to load.
      expect(within(mobileView).queryByTestId('mobile-day-load-more')).not.toBeInTheDocument();
      // Each tab shows its day's count (Wed has 3, the rest are empty).
      expect(within(mobileView).getAllByTestId('mobile-day-count').map((el) => el.textContent)).toEqual([
        '3', '0', '0', '0', '0', '0', '0',
      ]);
    });

    it('pages the selected day locally, 10 at a time, via the Load more button', () => {
      const twentyFive = Array.from({ length: 25 }, (_, i) => ({
        id: `m-${String(i + 1).padStart(2, '0')}`,
        eventName: `Mobile Event ${i + 1}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
      }));

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={twentyFive} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Mobile Event 10')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Mobile Event 11')).not.toBeInTheDocument();
      // The old unreachable "+N more" dialog trigger is gone from mobile.
      expect(within(mobileView).queryByTestId('calendar-overflow-trigger-mobile')).not.toBeInTheDocument();

      fireEvent.click(within(mobileView).getByRole('button', { name: 'Load more' }));
      expect(within(mobileView).getByText('Mobile Event 20')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Mobile Event 21')).not.toBeInTheDocument();

      fireEvent.click(within(mobileView).getByRole('button', { name: 'Load more' }));
      expect(within(mobileView).getByText('Mobile Event 25')).toBeInTheDocument();
      // Everything shown and no fetch budget supplied: nothing more to load.
      expect(within(mobileView).queryByTestId('mobile-day-load-more')).not.toBeInTheDocument();
    });

    it('loads more when the infinite-scroll sentinel intersects', () => {
      const twelve = Array.from({ length: 12 }, (_, i) => ({
        id: `s-${String(i + 1).padStart(2, '0')}`,
        eventName: `Scroll Event ${i + 1}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
      }));

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={twelve} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).queryByText('Scroll Event 11')).not.toBeInTheDocument();
      act(() => {
        observerCallbacks.at(-1)?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
      expect(within(mobileView).getByText('Scroll Event 12')).toBeInTheDocument();
    });

    it('continues past the week fetch window through the day-scoped query once local rows are exhausted', () => {
      const twenty = Array.from({ length: 20 }, (_, i) => ({
        id: `w-${String(i + 1).padStart(2, '0')}`,
        eventName: `Windowed ${i + 1}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventStartTime: `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`,
      }));
      const serverExtra = { id: 'w-21', eventName: 'Windowed 21', isMainSchedule: true, eventStartDate: '2026-08-05', eventStartTime: '20:00:00' };
      const onDayContinuationRequested = vi.fn();
      const fetchNextPage = vi.fn();

      const renderView = (hasNextPage: boolean, withExtra: boolean) => (
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView
            {...defaultProps}
            schedules={twenty}
            dayFetchLimit={20}
            onDayContinuationRequested={onDayContinuationRequested}
            dayContinuations={
              withExtra
                ? { '2026-08-05': { items: [serverExtra], fetchNextPage, hasNextPage, isFetchingNextPage: false } }
                : undefined
            }
          />
        </ScopedLocaleProvider>
      );
      const { rerender } = render(renderView(true, false));
      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');

      // The tab says the day may have more (20 hit the window).
      expect(within(mobileView).getAllByTestId('mobile-day-count')[0]).toHaveTextContent('20+');

      // 10 -> 20 are revealed locally with no server call.
      fireEvent.click(within(mobileView).getByRole('button', { name: 'Load more' }));
      expect(onDayContinuationRequested).not.toHaveBeenCalled();
      expect(within(mobileView).getByText('Windowed 20')).toBeInTheDocument();

      // Local rows exhausted and the day hit the 20-per-day window: ask the caller for the day query.
      fireEvent.click(within(mobileView).getByRole('button', { name: 'Load more' }));
      expect(onDayContinuationRequested).toHaveBeenCalledWith('2026-08-05');
      expect(rtlScreen.queryByRole('dialog')).not.toBeInTheDocument();

      // The caller's continuation arrives: the extra server row renders inline, and more pages remain.
      rerender(renderView(true, true));
      expect(within(mobileView).getByText('Windowed 21')).toBeInTheDocument();
      fireEvent.click(within(mobileView).getByRole('button', { name: 'Load more' }));
      expect(fetchNextPage).toHaveBeenCalledTimes(1);

      // Last page reached: the control and the "+" disappear.
      rerender(renderView(false, true));
      expect(within(mobileView).queryByTestId('mobile-day-load-more')).not.toBeInTheDocument();
      expect(within(mobileView).getAllByTestId('mobile-day-count')[0]).toHaveTextContent('21');
    });

    it('pages multi-day segments too: a day full of long-running schedules is not rendered at once', () => {
      const multiDay = Array.from({ length: 25 }, (_, i) => ({
        id: `md-${String(i + 1).padStart(2, '0')}`,
        eventName: `Long Run ${i + 1}`,
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-09',
      }));

      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={multiDay} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByText('Long Run 10')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Long Run 11')).not.toBeInTheDocument();
      fireEvent.click(within(mobileView).getByRole('button', { name: 'Load more' }));
      expect(within(mobileView).getByText('Long Run 20')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Long Run 21')).not.toBeInTheDocument();
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
      // User feedback (2026-09-27): the till badge no longer appends the formatted end time
      // (that duplicated the status badge's own "Ends {time}" state) -- stays bare "till".
      const dateBox = container.querySelector('[data-event-card-date-box]');
      expect(dateBox).not.toBeNull();
      expect(dateBox).toHaveTextContent(/till/);
      expect(dateBox).not.toHaveTextContent(/9:00 PM/);

      // User feedback (2026-09-27): "should not have favorite icon+count on the event-title
      // area" -- the favorite-count line under the title is removed entirely.
      expect(within(mobileView).queryByTestId('favorite-count-line')).not.toBeInTheDocument();
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

    // User feedback (2026-09-27): "should not have favorite icon+count on the event-title area"
    // -- both the inline isFavorited Heart icon and the favorite-count line under the title are
    // removed entirely; favorite state is only shown via the real interactive favorite control.
    it('never renders a Heart icon or a favorite-count line in the title area, regardless of isFavorited/favoriteCount', () => {
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
      const card = within(mobileView).getByText('Fav Event').closest('button') as HTMLElement;

      expect(within(card).queryByTestId('heart-icon')).not.toBeInTheDocument();
      expect(within(mobileView).queryByTestId('favorite-count-line')).not.toBeInTheDocument();
    });

    // User feedback (2026-09-27): "should show location-name in one line, break-word: all".
    it('renders locationName as a single line with mid-word breaking', () => {
      const schedule = [
        {
          id: '1',
          eventSlug: 'test',
          eventName: 'Location Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          locationName: 'ASupercalifragilisticexpialidociousVenueName',
        }
      ];
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={schedule} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const location = within(mobileView).getByText('ASupercalifragilisticexpialidociousVenueName');
      expect(location).toHaveClass('line-clamp-1');
      expect(location).toHaveClass('break-all');
    });

    it('omits the location line entirely when locationName is absent', () => {
      const schedule = [
        {
          id: '1',
          eventSlug: 'test',
          eventName: 'No Location Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
        }
      ];
      const { container } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={schedule} />
        </ScopedLocaleProvider>
      );
      expect(container.querySelector('.line-clamp-1.break-all')).not.toBeInTheDocument();
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

    // Story 1.i1m CI ratchet (inverts the Story 1.i1z ratchet of the same name that used to
    // assert the OPPOSITE — reserved-but-blank — behavior for this exact surface): the media
    // slot is omitted from the DOM entirely, not left as an empty reserved element, when
    // `imageUrl` is absent. Content expands into the freed width and the favorite control
    // still renders (composed externally, per AC4) and remains interactive. Masonry's own
    // reserved-blank convention is unchanged — see `EventCardMediaPrimitives.test.tsx`'s own
    // `collapseOnFallback defaults to false` regression guard.
    it('omits the media slot entirely (no reserved element) and still renders the favorite control when imageUrl is absent (Story 1.i1m AC1/AC4)', () => {
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
      // No reserved element at all — not merely an empty/blank one.
      expect(container.querySelector('[data-event-card-media-slot]')).toBeNull();
      // The favorite control still renders (externally composed) and remains interactive.
      expect(within(mobileView).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
    });

    // Story 1.i1m CI ratchet (inverts the Story 1.i1z ratchet of the same name). The slot is
    // present with an image on mount, then removed from the DOM entirely — not merely
    // emptied — once the image's `onError` fires.
    it('removes the media slot from the DOM entirely (not merely emptied) when the image onError fires (Story 1.i1m AC1)', () => {
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

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const slot = container.querySelector('[data-event-card-media-slot]') as HTMLElement;
      expect(slot).not.toBeNull();
      const img = slot.querySelector('img');
      expect(img).not.toBeNull();

      fireEvent.error(img as Element);

      // After the error, the slot element itself is gone from the DOM (not just its image).
      expect(container.querySelector('[data-event-card-media-slot]')).toBeNull();
      // The favorite badge (now externally composed) still renders and remains interactive.
      expect(within(mobileView).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
    });

    // Story 1.i1m AC2 — the content column expands to fill the width the media slot's
    // removal frees up (falls out of the flex row losing a child; asserted structurally by
    // confirming the content button has no sibling media-slot element, complementing the two
    // DOM-presence ratchets above rather than asserting a specific computed pixel width,
    // which JSDOM does not lay out).
    it('has no media-slot sibling for the content column to compete with when imageUrl is absent (Story 1.i1m AC2)', () => {
      const onFavoriteToggle = vi.fn();
      const schedule = [
        {
          id: 'noimg-reflow-1',
          eventSlug: 'test',
          eventName: 'No Image Reflow Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
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
      const contentButton = within(mobileView).getByText('No Image Reflow Event').closest('button');
      expect(contentButton).not.toBeNull();
      // The row wrapper (button's parent) has exactly two children: the content button (its
      // `flex-1` free to expand) and the externally-composed favorite badge — no third
      // (media-slot) sibling competing for width.
      const rowWrapper = contentButton?.parentElement;
      expect(rowWrapper?.children).toHaveLength(2);
    });

    // Story 1.i1m AC6/Task 6.3 — the AD-15 icon-scale custom property must reach the
    // favorite badge whether it's a descendant of the media slot (with-image case) or an
    // external sibling composed by the row itself (no-image case), since removing the slot
    // in the latter case also removes the element that used to declare it.
    it('declares the AD-15 icon-scale custom property on a shared ancestor of the favorite badge in both the with-image and no-image row states (Story 1.i1m AC6)', () => {
      const expectedValue = EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE.compact;

      const withImageSchedule = [
        {
          id: 'withimg-cssvar-1',
          eventSlug: 'test',
          eventName: 'With Image CSS Var Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
          imageUrl: 'https://img.example/thumb.jpg',
        }
      ];
      const { container: withImageContainer } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={withImageSchedule} onFavoriteToggle={vi.fn()} />
        </ScopedLocaleProvider>
      );
      const withImageSlot = withImageContainer.querySelector('[data-event-card-media-slot]');
      expect(withImageSlot).not.toBeNull();
      // User feedback (2026-10-03): the with-image favorite pill sits on the card container's
      // top-right corner (like the TILL tag), composed outside the slot's `overflow-hidden`.
      expect(within(withImageSlot as HTMLElement).queryByRole('button', { name: 'Toggle favorite' })).toBeNull();
      const withImageBadgeButton = within(
        rtlScreen.getByTestId('mobile-calendar-view')
      ).getByRole('button', { name: 'Toggle favorite' });
      expect(withImageBadgeButton).toHaveClass('absolute');
      expect(withImageBadgeButton).toHaveClass('-top-1.5');
      expect(withImageBadgeButton).toHaveClass('-right-1.5');
      // Nearest ancestor declaring the custom property — the row's own container.
      let withImageAncestor: HTMLElement | null = withImageBadgeButton.parentElement;
      while (withImageAncestor && !withImageAncestor.style.getPropertyValue(EVENT_CARD_BADGE_FONT_SIZE_VAR)) {
        withImageAncestor = withImageAncestor.parentElement;
      }
      expect(withImageAncestor?.style.getPropertyValue(EVENT_CARD_BADGE_FONT_SIZE_VAR)).toBe(expectedValue);
      cleanup();

      const noImageSchedule = [
        {
          id: 'noimg-cssvar-1',
          eventSlug: 'test',
          eventName: 'No Image CSS Var Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-05',
        }
      ];
      const { container: noImageContainer } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} schedules={noImageSchedule} onFavoriteToggle={vi.fn()} />
        </ScopedLocaleProvider>
      );
      expect(noImageContainer.querySelector('[data-event-card-media-slot]')).toBeNull();
      // BUG-048: scoped to the mobile view — the desktop grid cell now also renders a "Toggle
      // favorite" control (via `EventCardCalendarGridItem`), so an unscoped query would match
      // both.
      const noImageBadgeButton = within(
        rtlScreen.getByTestId('mobile-calendar-view')
      ).getByRole('button', { name: 'Toggle favorite' });
      // No slot exists in this state — the row's own outer wrapper is the ancestor that must
      // declare the property instead, per Task 3.2's relocation.
      let rowWrapperAncestor: HTMLElement | null = noImageBadgeButton.parentElement;
      while (rowWrapperAncestor && !rowWrapperAncestor.style.getPropertyValue(EVENT_CARD_BADGE_FONT_SIZE_VAR)) {
        rowWrapperAncestor = rowWrapperAncestor.parentElement;
      }
      expect(rowWrapperAncestor).not.toBeNull();
      expect(rowWrapperAncestor?.style.getPropertyValue(EVENT_CARD_BADGE_FONT_SIZE_VAR)).toBe(expectedValue);
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

    it('BUG-047 AC-DATE-3 (<= rule): on a single-day event\'s only day, month/day now show the real (start===end) date digits -- the old "never repeats the start date" avoidance is deliberately gone; the amber corner tag stays a bare "till" (2026-09-27: no longer appends the end time, which duplicated the status badge\'s "Ends {time}" state)', () => {
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
      expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('Aug');
      expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('5');
      expect(container.querySelector('.bg-amber-700')).toHaveTextContent('till');
      expect(container.querySelector('.bg-amber-700')).not.toHaveTextContent(/9:00 PM/);
      // Never a bare time string / word in the day slot itself (AC-DATE-1).
      expect(container.querySelector('[data-event-card-date-box-day]')?.textContent).toMatch(/^\d{1,2}$/);
    });

    it('falls back to a bare "till" corner tag (real date digits in month/day either way) with an end date but no time, and with no end info at all', () => {
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
      expect(c1.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('Aug');
      expect(c1.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('5');
      expect(c1.querySelector('.bg-amber-700')).toHaveTextContent('till');

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
      expect(c2.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('Aug');
      expect(c2.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('5');
      expect(c2.querySelector('.bg-amber-700')).toHaveTextContent('till');
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

        // Scoped to the mobile view — the desktop spanning bar (`EventCardCalendarGridItem`)
        // no longer renders a status badge at all (BUG-048's AC-STATUS-1 amendment was reversed,
        // 2026-09-27, user feedback: "don't show the now/ending_at badge"), so this scoping is
        // now belt-and-suspenders rather than load-bearing, but kept for clarity.
        // AC5 — three day-segments (Aug 5/6/7), one visible per selected tab, each independently
        // computing status from the same schedule-level start/end fields against the same real
        // "now", so all three show the identical happeningNow state.
        ['5 Wed', '6 Thu', '7 Fri'].forEach((dayName) => {
          selectMobileDay(dayName);
          const badges = rtlScreen
            .getByTestId('mobile-calendar-view')
            .querySelectorAll('[data-event-card-status-badge]');
          expect(badges).toHaveLength(1);
          badges.forEach((badge) => {
            expect(badge).toHaveTextContent('Now');
            expect(badge).toHaveClass('bg-emerald-600');
            expect(badge).toHaveClass('text-white');
          });
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

        selectMobileDay('10 Mon');
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
        const panelFor = (dayName: string, title: string) => {
          selectMobileDay(dayName);
          return within(mobileView).getByText(title).closest('[data-testid="mobile-day-row"]') as HTMLElement;
        };

        const nearCard = panelFor('5 Wed', 'Near Festival');
        expect(nearCard.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
        // BUG-049: badge shows the real distance, not a static word (7.9 rounds to "8 km").
        expect(nearCard.querySelector('[data-event-card-nearby-badge]')).toHaveTextContent('8 km');
        expect(panelFor('6 Thu', 'Boundary Festival').querySelector('[data-event-card-nearby-badge]')).toBeNull();
        expect(panelFor('7 Fri', 'Unknown Distance Festival').querySelector('[data-event-card-nearby-badge]')).toBeNull();

        // The same single-day schedules also render on the desktop grid (the grid variant renders
        // the nearby badge too). "Near Festival" renders the badge on desktop; "Boundary"/"Unknown"
        // render it nowhere. Mobile shows only the selected day (Fri), which has no badge.
        expect(
          within(rtlScreen.getByTestId('desktop-calendar-view')).getAllByText('Near Festival')
        ).not.toHaveLength(0);
        expect(container.querySelectorAll('[data-event-card-nearby-badge]')).toHaveLength(1);
      });

      it('appends the badge row as the content column\'s last child (AC4)', () => {
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
        // User feedback (2026-09-27): the "Day X of N" multi-day badge line this test used to
        // order against is removed entirely -- confirm it's genuinely gone, not just re-ordered.
        expect(contentColumn.querySelector('[data-testid="multi-day-badge"]')).toBeNull();
      });

      // User feedback (2026-09-27): "don't show the now/ending_at badge" -- reverses BUG-048's
      // AC-STATUS-1 adoption; `EventCardCalendarGridItem` no longer renders a status badge in
      // either composition, so desktop `variant="grid"` day cells never show one.
      it('never renders status badges on desktop variant="grid" day cells (status badge removed, 2026-09-27)', () => {
        vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));

        render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} />
          </ScopedLocaleProvider>
        );

        const desktopView = rtlScreen.getByTestId('desktop-calendar-view');
        expect(desktopView.querySelector('[data-event-card-status-badge]')).toBeNull();
        // No fixture schedule carries `distanceKm`, so the nearby badge is correctly still absent.
        expect(desktopView.querySelector('[data-event-card-nearby-badge]')).toBeNull();
      });

      it('renders the nearby badge on desktop variant="grid" day cells when distanceKm is under threshold (BUG-048)', () => {
        vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));

        render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView
              {...defaultProps}
              schedules={[{ ...sampleSchedules[0], distanceKm: 2 }]}
            />
          </ScopedLocaleProvider>
        );

        const desktopView = rtlScreen.getByTestId('desktop-calendar-view');
        expect(desktopView.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
        expect(desktopView.querySelector('[data-event-card-nearby-badge]')).toHaveTextContent('2 km');
      });

      // Story 1.i1m Task 6.5 — this story touches only `variant='list'`; the desktop
      // `variant='grid'` day-cell pill never rendered `EventCardMediaSlot` at all (it's a
      // different component, `EventCardCalendarGridItem`), so this guard confirms that stays
      // true rather than assuming it from the story's own Out of Scope note alone.
      it('leaves variant="grid" completely unaffected — no media-slot element on desktop (Story 1.i1m)', () => {
        vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));

        render(
          <ScopedLocaleProvider locale="en-US">
            <WeeklyCalendarView {...defaultProps} />
          </ScopedLocaleProvider>
        );

        const desktopView = rtlScreen.getByTestId('desktop-calendar-view');
        expect(desktopView.querySelector('[data-event-card-media-slot]')).toBeNull();
      });
    });
  });
  describe('Mobile day tabs', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      // "Today" is 2026-08-06 (Thu), inside the default 2026-08-05 week.
      vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('defaults to today, switches day on click without navigating or refetching', () => {
      const props = { ...defaultProps, timezone: 'UTC', onNextWeek: vi.fn(), onPrevWeek: vi.fn(), onSelectWeek: vi.fn(), onToday: vi.fn() };
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...props} />
        </ScopedLocaleProvider>
      );

      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getByRole('tab', { name: dayTabName('6 Thu') })).toHaveAttribute('aria-selected', 'true');
      expect(within(mobileView).getByRole('tab', { name: dayTabName('6 Thu') })).toHaveAttribute('data-today', 'true');
      expect(within(mobileView).getByText('Gallery Tour')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Main Stage Concert')).not.toBeInTheDocument();

      selectMobileDay('5 Wed');
      expect(within(mobileView).getByText('Main Stage Concert')).toBeInTheDocument();
      expect(within(mobileView).queryByText('Gallery Tour')).not.toBeInTheDocument();

      expect(props.onNextWeek).not.toHaveBeenCalled();
      expect(props.onPrevWeek).not.toHaveBeenCalled();
      expect(props.onSelectWeek).not.toHaveBeenCalled();
      expect(props.onToday).not.toHaveBeenCalled();
    });

    it('falls back to the first day when today is not in the visible week, and resets on week change', () => {
      const { rerender } = render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} weekStart="2026-08-12" schedules={[]} timezone="UTC" />
        </ScopedLocaleProvider>
      );
      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      expect(within(mobileView).getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
      selectMobileDay('15 Sat');
      expect(within(mobileView).getByRole('tab', { name: dayTabName('15 Sat') })).toHaveAttribute('aria-selected', 'true');

      // Back to the week containing today: selection resets to today (Thu Aug 6).
      rerender(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} weekStart="2026-08-05" schedules={[]} timezone="UTC" />
        </ScopedLocaleProvider>
      );
      expect(within(mobileView).getByRole('tab', { name: dayTabName('6 Thu') })).toHaveAttribute('aria-selected', 'true');
    });

    it('supports roving tabindex and arrow/Home/End keyboard navigation', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} timezone="UTC" />
        </ScopedLocaleProvider>
      );
      const mobileView = rtlScreen.getByTestId('mobile-calendar-view');
      const tabs = within(mobileView).getAllByRole('tab');
      expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);

      tabs[1].focus();
      fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[2]).toHaveFocus();
      fireEvent.keyDown(tabs[2], { key: 'End' });
      expect(tabs[6]).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(tabs[6], { key: 'ArrowRight' });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
      expect(tabs[6]).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps the day headers / tab strip sticky inside an isolate wrapper', () => {
      render(
        <ScopedLocaleProvider locale="en-US">
          <WeeklyCalendarView {...defaultProps} />
        </ScopedLocaleProvider>
      );
      const desktopHeaders = rtlScreen.getByTestId('desktop-day-headers');
      expect(desktopHeaders).toHaveClass('sticky', 'top-0');
      expect(rtlScreen.getByTestId('desktop-calendar-view')).toHaveClass('isolate');
      const tabs = rtlScreen.getByTestId('mobile-day-tabs');
      expect(tabs).toHaveClass('sticky', 'top-0');
      expect(rtlScreen.getByTestId('mobile-calendar-view')).toHaveClass('isolate');
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

      // User feedback (2026-09-27): the inline isFavorited Heart icon is removed from this row
      // entirely -- only the isAddedToCalendar icon remains here.
      expect(within(row).queryByTestId('heart-icon')).not.toBeInTheDocument();
      expect(within(row).getByTestId('calendar-plus-icon')).toHaveClass('mt-0.5');
    });

    it('lets the variant="grid" day-cell title wrap freely, matching EventCardCalendarGridItem\'s own composition (BUG-048)', () => {
      // Single-day on purpose: a multi-day schedule renders on desktop as a spanning
      // bar built from `EventCardCalendarGridItem` too (Story 1.i1g), so both surfaces now
      // share the exact same title styling — no more compact-row-only vs. grid-only split.
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

      expect(gridTitle).not.toHaveClass('truncate');
      expect(gridTitle).not.toHaveClass('line-clamp-2');
    });
  });

  // ── Story 1.3k Task 7 (AC4/AC5) — day-of-week recurring schedules ─────────
  // weekStart is '2026-08-05' (Wednesday) per defaultProps, so the 7 visible columns are:
  // idx0=Wed Aug5, idx1=Thu Aug6, idx2=Fri Aug7, idx3=Sat Aug8, idx4=Sun Aug9,
  // idx5=Mon Aug10, idx6=Tue Aug11.
  describe('Day-of-week recurring schedules (Story 1.3k AC4/AC5)', () => {
    it('(a) a Monday-only schedule spanning multiple weeks yields no week-wide bar -- only isolated single-day segments', () => {
      const schedules = [
        {
          id: 'mon-only',
          eventName: 'Monday Only Market',
          isMainSchedule: true,
          eventStartDate: '2026-07-06',
          eventEndDate: '2026-08-31',
          applicableDaysOfWeek: ['MON'],
        },
      ];

      render(<WeeklyCalendarView {...defaultProps} schedules={schedules as any} locale="en-US" />);

      // No bar at all -- the only occurrence visible this week (Monday Aug 10) is an isolated
      // one-day run, which never earns a bar (AC4).
      expect(within(rtlScreen.getByTestId('desktop-calendar-view')).queryByTestId('multi-day-spanning-bar')).not.toBeInTheDocument();

      // It renders as a normal single-day grid card in Monday's column (column 6 of the week
      // starting Wed Aug 5) -- exactly once.
      const cards = within(rtlScreen.getByTestId('desktop-calendar-view')).getAllByRole('button', { name: 'Monday Only Market' });
      expect(cards).toHaveLength(1);
      expect(cellOf(cards[0]).cell).toHaveStyle({ gridColumn: '6 / span 1' });
    });

    it('(b) a Mon+Tue run plus an isolated Friday in the same week renders one Mon-Tue bar AND keeps the Friday card (the AC4 regression case)', () => {
      const schedules = [
        {
          id: 'pop-up',
          eventName: 'Weekly Pop-up',
          isMainSchedule: true,
          eventStartDate: '2026-08-01',
          eventEndDate: '2026-08-31',
          applicableDaysOfWeek: ['MON', 'TUE', 'FRI'],
        },
      ];

      render(<WeeklyCalendarView {...defaultProps} schedules={schedules as any} locale="en-US" />);

      // Exactly one Mon-Tue spanning bar (columns 5-6, 0-based -> CSS grid-column "6 / span 2").
      const grid = rtlScreen.getByTestId('calendar-bands');
      const bars = within(grid).getAllByTestId('multi-day-spanning-bar');
      expect(bars).toHaveLength(1);
      expect(within(bars[0]).getByText('Weekly Pop-up')).toBeInTheDocument();
      expect(cellOf(bars[0]).cell).toHaveStyle({ gridColumn: '6 / span 2' });

      // The segment-level fix (AC4) keeps Friday's isolated occurrence of the SAME schedule as a card.
      const friday = within(grid)
        .getAllByRole('button', { name: 'Weekly Pop-up' })
        .map((el) => cellOf(el).cell)
        .find((cell) => cell.style.gridColumn === '3 / span 1');
      expect(friday).toBeTruthy();

      // Exactly 2 renders total (one bar, one Friday card) -- never 3+, Mon/Tue are not duplicated.
      expect(within(rtlScreen.getByTestId('desktop-calendar-view')).getAllByText('Weekly Pop-up')).toHaveLength(2);
    });

    it('(c) per-day totals count isolated occurrences once and a bar in every column it covers, never double-counting', () => {
      const schedules = [
        // Mon+Tue bar -- counted once in Monday and once in Tuesday.
        {
          id: 'run',
          eventName: 'Bar Event',
          isMainSchedule: true,
          eventStartDate: '2026-08-01',
          eventEndDate: '2026-08-31',
          applicableDaysOfWeek: ['MON', 'TUE'],
        },
        { id: 's1', eventName: 'Solo 1', isMainSchedule: true, eventStartDate: '2026-08-10' },
        { id: 's2', eventName: 'Solo 2', isMainSchedule: true, eventStartDate: '2026-08-10' },
        { id: 's3', eventName: 'Solo 3', isMainSchedule: true, eventStartDate: '2026-08-10' },
      ];

      render(<WeeklyCalendarView {...defaultProps} schedules={schedules as any} locale="en-US" />);

      // Week starts Wed Aug 5: Monday Aug 10 is column 6, Tuesday Aug 11 column 7.
      const totals = rtlScreen.getAllByTestId('desktop-day-total').map((el) => el.textContent);
      expect(totals).toEqual(['0', '0', '0', '0', '0', '4', '1']);

      // The bar renders once, alongside the three solos.
      const grid = rtlScreen.getByTestId('calendar-bands');
      expect(within(grid).getAllByTestId('multi-day-spanning-bar')).toHaveLength(1);
      ['Solo 1', 'Solo 2', 'Solo 3'].forEach((name) => expect(screen.getByText(name)).toBeInTheDocument());
    });

    it('(d) per-run adjacency is evaluated against the FULL occurrence set, including days outside the visible week -- a run straddling the week boundary is not misclassified as isolated', () => {
      // TUE+WED matches every week. Within the visible week (Aug5 Wed - Aug11 Tue), Tuesday
      // (Aug11, the LAST visible day) is the START of a run that continues into Wednesday Aug12,
      // which is NOT visible this week. Only one day of that run is on-screen, so it correctly
      // gets no bar (spanCount<=1) -- but its OWN run bounds (runStartDate/runEndDate) must still
      // reflect the full run (Aug11-Aug12), not be clipped/misread as a 1-day isolated occurrence,
      // which the tooltip's date range proves.
      const schedules = [
        {
          id: 'boundary',
          eventName: 'Boundary Event',
          isMainSchedule: true,
          eventStartDate: '2026-07-01',
          eventEndDate: '2026-09-30',
          applicableDaysOfWeek: ['TUE', 'WED'],
        },
      ];

      render(<WeeklyCalendarView {...defaultProps} schedules={schedules as any} locale="en-US" />);

      const desktopView = rtlScreen.getByTestId('desktop-calendar-view');
      // No bar (only Tuesday is visible from this run) -- renders as a normal single-day grid card.
      expect(within(desktopView).queryByTestId('multi-day-spanning-bar')).not.toBeInTheDocument();

      // The schedule's occurrences also land on Wednesday Aug5 (the visible week's FIRST day) --
      // the tail end of the PRIOR week's own Aug4-Aug5 run. Pick Tuesday's card (column 7, the
      // LAST visible day), whose run continues past the visible week's right edge into Aug12.
      const cardButton = within(desktopView)
        .getAllByRole('button', { name: 'Boundary Event' })
        .find((el) => cellOf(el).cell.style.gridColumn === '7 / span 1') as HTMLElement;
      expect(cardButton).toBeTruthy();

      fireEvent.pointerEnter(cardButton, { pointerType: 'mouse' });

      // Scope to the card's own describing tooltip via `aria-describedby` -- the card also
      // carries a separate always-on "Repeats on TUE, WED" recurrence-badge tooltip (role=
      // "tooltip" too), so an unscoped query would itself find multiple matches.
      const tooltipId = cardButton.getAttribute('aria-describedby');
      expect(tooltipId).toBeTruthy();
      const tooltip = document.getElementById(tooltipId as string) as HTMLElement;
      // The run's own end date (Aug 12, one day PAST the visible week's own last day Aug 11) is
      // present in the tooltip's date range -- proof the adjacency computation looked past the
      // visible week's right edge instead of treating Aug 11 as an isolated single day.
      expect(tooltip).toHaveTextContent(/12/);
    });

    it('(e) a legacy/default schedule with unset/empty applicableDaysOfWeek behaves identically to before -- one run spanning its whole date range, confirmed via the existing multi-day-spanning-bar assertions', () => {
      // Re-runs this suite's own pre-1.3k multi-day assertion (`sampleSchedules`'s "Tech
      // Workshop", Aug5-Aug7, no `applicableDaysOfWeek`) to confirm AC4's "zero behavior change
      // for legacy/default schedules" requirement -- a single run equal to the whole span, one bar.
      render(<WeeklyCalendarView {...defaultProps} locale="en-US" />);

      const bars = within(rtlScreen.getByTestId('calendar-bands')).getAllByTestId('multi-day-spanning-bar');
      expect(bars).toHaveLength(1);
      expect(within(bars[0]).getByText('Tech Workshop')).toBeInTheDocument();
      expect(cellOf(bars[0]).cell).toHaveStyle({ gridColumn: '1 / span 3' });
    });
  });

});
