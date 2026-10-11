import React from 'react';
import { render, screen as rtlScreen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { CalendarView } from './CalendarView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { ScopedLocaleProvider } from '@festgrid/ui';

/**
 * Story 1.i1h Task 9.3 — every `getEventsForCalendar` request this test file makes, in order, so the
 * windowed week-fetch's and the dialog's day-scoped continuation call's variables can both be
 * asserted. jsdom ships no `IntersectionObserver`, so the shared hand-rolled stub below is what lets
 * the dialog's sentinel actually trigger its second page (same approach as
 * `packages/ui/src/features/events/CalendarOverflowDialog.test.tsx`).
 */
const capturedCalendarVariables: any[] = [];
let mockObserverInstance: MockIntersectionObserver | null = null;

/**
 * Registers through a parameter rather than assigning `this` to a module-level binding directly,
 * which `@typescript-eslint/no-this-alias` flags even outside a class body.
 */
function registerMockObserver(instance: MockIntersectionObserver) {
  mockObserverInstance = instance;
}

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(public callback: IntersectionObserverCallback) {
    registerMockObserver(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

const screen = {
  ...rtlScreen,
  getByText: (text: string | RegExp, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      try {
        return within(desktop).getByText(text, options);
      } catch {}
    }
    const all = rtlScreen.queryAllByText(text, options);
    if (all.length > 0) return all[0];
    return rtlScreen.getByText(text, options);
  },
  getAllByText: (text: string | RegExp, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      try {
        return within(desktop).getAllByText(text, options);
      } catch {}
    }
    return rtlScreen.getAllByText(text, options);
  },
  queryByText: (text: string | RegExp, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      return within(desktop).queryByText(text, options);
    }
    return rtlScreen.queryByText(text, options);
  },
  findByText: async (text: string | RegExp, options?: any, waitForOptions?: any) => {
    const elements = await rtlScreen.findAllByText(text, options, waitForOptions);
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      const match = elements.find(el => desktop.contains(el));
      if (match) return match;
    }
    return elements[0];
  },
  getByRole: (role: string, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      try {
        return within(desktop).getByRole(role, options);
      } catch {}
    }
    const all = rtlScreen.queryAllByRole(role, options);
    if (all.length > 0) return all[0];
    return rtlScreen.getByRole(role, options);
  },
  queryByRole: (role: string, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      return within(desktop).queryByRole(role, options);
    }
    return rtlScreen.queryByRole(role, options);
  },
  getAllByRole: (role: string, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      try {
        return within(desktop).getAllByRole(role, options);
      } catch {}
    }
    return rtlScreen.getAllByRole(role, options);
  },
  getByLabelText: (text: string | RegExp, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      try {
        return within(desktop).getByLabelText(text, options);
      } catch {}
    }
    const all = rtlScreen.queryAllByLabelText(text, options);
    if (all.length > 0) return all[0];
    return rtlScreen.getByLabelText(text, options);
  },
  queryByLabelText: (text: string | RegExp, options?: any) => {
    const desktops = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktop = desktops[desktops.length - 1];
    if (desktop) {
      return within(desktop).queryByLabelText(text, options);
    }
    return rtlScreen.queryByLabelText(text, options);
  },
};

const mockRouterPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const mockSearchParams = new URLSearchParams('q=jazz&types=MUSIC');
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockPosthogCapture = vi.fn();
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string, options?: { count?: number }) => {
      if (options && options.count !== undefined) {
        return `${namespace}.${key}(count:${options.count})`;
      }
      return `${namespace}.${key}`;
    };
    // `t.raw` bypasses ICU processing for `{time}`/`{n}`-templated keys (`formatEventStatus`
    // does its own `.replace()` afterward) -- the mock's plain lookup is a fine stand-in since
    // no test here asserts the exact templated string.
    t.raw = (key: string) => `${namespace}.${key}`;
    return t;
  },
  useLocale: () => 'en',
}));

const mockCalendarEvents = {
  events: {
    items: [
      {
        id: 'evt-1',
        eventName: 'Weekly Jazz Jam',
        slug: 'weekly-jazz-jam',
        imageUrl: null,
        location: 'Blue Note',
        types: ['MUSIC'],
        categories: ['CONCERT'],
        schedules: [
          {
            id: 'sched-1',
            isMainSchedule: true,
            eventStartDate: '2026-08-12',
            eventEndDate: '2026-08-12',
            // 10:00-22:00 (not the original 19:00-22:00) -- see the "wires the WeeklyCalendarView
            // i18n namespace" test's own comment: this wide a window keeps the shared beforeEach's
            // 12:00Z clock inside the event's [start,end] interval whether combineDateTime's
            // local-wall-clock arithmetic runs on a UTC machine (CI) or one several hours ahead
            // (dev machines), instead of depending on which one happens to run the suite.
            eventStartTime: '10:00:00',
            eventEndTime: '22:00:00',
            ticketPrice: '20.00',
            locationDetails: { coordinates: { lat: -6.2, lng: 106.8 } },
          },
        ],
      },
    ],
    hasMore: false,
    totalCount: 1,
  },
};

const api = graphql.link('*/api/graphql');

const server = setupServer(
  api.query('getEventsForCalendar', ({ variables }) => {
    capturedCalendarVariables.push(variables);
    return HttpResponse.json({
      data: mockCalendarEvents,
    });
  })
);

describe('CalendarView', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // The component defaults its displayed week to "today". Freeze the clock
    // to a date inside the same Monday-Sunday week as the fixture event's
    // eventStartDate (2026-08-12, a Wednesday => week of 2026-08-10 to
    // 2026-08-16) so the fixture event actually falls within the rendered
    // week regardless of the real-world current date.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-12T12:00:00Z'));

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
    vi.clearAllMocks();
    capturedCalendarVariables.length = 0;
    mockObserverInstance = null;
  });

  afterEach(() => {
    server.resetHandlers();
    // Story 1.i1h Task 9.3 — this file previously let renders accumulate across tests (and scoped
    // every query to "the last desktop/mobile view" as a workaround). The new overflow-dialog tests
    // need real isolation: a leftover mounted dialog keeps its own document-level Escape/pointerdown
    // listeners attached, which would close an unrelated test's dialog too.
    cleanup();
    capturedCalendarVariables.length = 0;
    mockObserverInstance = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders loading, error, and success states correctly', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    // Verify loading state is shown initially (via the skeleton grid aria-label)
    // Story 1.i1o AC2/AC4: loadingText now comes from the WeeklyCalendarView i18n namespace
    // (via `tCalendar('loadingText')`), not the component's hardcoded English default.
    expect(screen.getByLabelText('WeeklyCalendarView.loadingText')).toBeInTheDocument();

    // Wait for the query to resolve and content to render
    const eventCard = await screen.findByText('Weekly Jazz Jam');
    expect(eventCard).toBeInTheDocument();
  });

  it('wires the WeeklyCalendarView i18n namespace into the status badge (Story 1.i1o AC2/AC4)', async () => {
    // CI regression (2026-09-29): `combineDateTime`'s local-wall-clock arithmetic (packages/ui's
    // format-event-date.ts) always runs against the test RUNNER's own real process timezone --
    // `ScopedLocaleProvider`'s `timezone` prop only affects day-boundary/display formatting
    // downstream, it can't make that arithmetic deterministic on its own. This test's fixture
    // schedule was originally a narrow 19:00-22:00Z window, tuned against whichever machine
    // authored it (started-but-not-ended only held true interpreted several hours ahead of UTC)
    // -- passed on dev machines, failed in CI (UTC runners). The fixture is now a wide 10:00-22:00
    // window (see its own comment) so the shared `beforeEach`'s 12:00Z clock sits inside the
    // event's [start,end] interval whichever real timezone the arithmetic runs against, without
    // needing a per-test clock override. `ScopedLocaleProvider` is still wrapped here for
    // representativeness (every real page always has one, per `app/[locale]/layout.tsx`), even
    // though it isn't what makes this specific assertion deterministic.
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <ScopedLocaleProvider locale="en-US" timezone="UTC">
            <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
          </ScopedLocaleProvider>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findByText('Weekly Jazz Jam');

    // The shared beforeEach clock (2026-08-12T12:00Z) sits inside the fixture schedule's
    // 10:00-22:00Z window -- started, not yet ended, with a known endTime (22:00) -- per the
    // "ends today" rule (2026-09-27: once the end time is known, show the precise "Ends hh:mm"
    // instead of the generic "Ends Today"), it resolves to the "endsAt" status, rendered via the
    // mocked next-intl `t.raw` format (`${namespace}.${key}`), proving the label came from
    // `tCalendar.raw('statusEndsAt')` and not WeeklyCalendarView.tsx's own hardcoded default.
    expect(screen.getAllByText('WeeklyCalendarView.statusEndsAt').length).toBeGreaterThan(0);
  });

  it('navigates weeks and triggers posthog and state updates', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findByText('Weekly Jazz Jam');

    const nextButtons = screen.getAllByRole('button', { name: /calendarNextWeekLabel/ });
    expect(nextButtons.length).toBeGreaterThan(0);
    fireEvent.click(nextButtons[0]);

    expect(mockPosthogCapture).toHaveBeenCalledWith('calendar_week_navigated', expect.objectContaining({
      direction: 'next',
    }));
  });

  it('navigates to event slug on schedule click preserving full query params', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findAllByText('Weekly Jazz Jam');

    // BUG-048: the desktop grid cell's click target is now a sibling `<button>` carrying
    // `aria-label={schedule.eventName}` rather than the visible text itself (which lives in a
    // separate `pointer-events-none` visual layer built from `EventCardCalendarGridItem`).
    fireEvent.click(screen.getByRole('button', { name: 'Weekly Jazz Jam' }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining('/events/weekly-jazz-jam?fromList=true&q=jazz&types=MUSIC')
    );
  });

  it('threads onFavoriteToggle through to the thumbnail favorite badge with the schedule eventId', async () => {
    const onFavoriteToggle = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} onFavoriteToggle={onFavoriteToggle} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findByText('Weekly Jazz Jam');

    // No cleanup() runs between tests in this file, so multiple renders accumulate;
    // scope to the most recent mobile view (matching the file's queryAllByTestId pattern).
    const mobileViews = rtlScreen.queryAllByTestId('mobile-calendar-view');
    const mobileView = mobileViews[mobileViews.length - 1];
    // Story 1.i1o AC2/AC4: favoriteToggleLabel now comes from the WeeklyCalendarView i18n
    // namespace, not the component's hardcoded English default.
    const favButton = within(mobileView).getByRole('button', { name: 'WeeklyCalendarView.favoriteToggleLabel' });
    fireEvent.click(favButton);

    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
    expect(onFavoriteToggle).toHaveBeenCalledWith('evt-1');
  });

  it('accepts a viewerCoord prop (Story 1.i1f AC14) and still renders the fetched schedule', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView
            q="jazz"
            types={['MUSIC']}
            categories={[]}
            viewerCoord={{ latitude: -6.2, longitude: 106.8 }}
          />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    const eventCard = await screen.findByText('Weekly Jazz Jam');
    expect(eventCard).toBeInTheDocument();
  });

  it('renders the same content when viewerCoord is omitted (backward compatible)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    const eventCard = await screen.findByText('Weekly Jazz Jam');
    expect(eventCard).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------------------------
  // Story 1.i1h Task 8/9.3 — windowed week fetch, day-scoped overflow dialog, and its two AC9 events
  // ---------------------------------------------------------------------------------------------

  /** The frozen "today" (2026-08-12) the fixture event also falls on — the day that overflows. */
  const busyDayIso = '2026-08-12';

  const buildBusyDayEvent = (index: number) => ({
    id: `evt-busy-${index}`,
    eventName: `Busy Day Event ${index}`,
    slug: `busy-day-event-${index}`,
    imageUrl: null,
    location: `Venue ${index}`,
    types: ['MUSIC'],
    categories: ['CONCERT'],
    isFavorited: false,
    favoriteCount: 0,
    schedules: [
      {
        id: `sched-busy-${index}`,
        isMainSchedule: true,
        eventStartDate: busyDayIso,
        eventEndDate: busyDayIso,
        eventStartTime: `10:${String(index).padStart(2, '0')}:00`,
        eventEndTime: '11:00:00',
        ticketPrice: null,
        locationDetails: null,
      },
    ],
  });

  const calendarQueryResponse = (items: unknown[], hasMore: boolean, totalCount: number) =>
    HttpResponse.json({ data: { events: { items, hasMore, totalCount } } });

  it('sends perDayLimit: 20 and drops the old limit: 1000 from the week-level fetch (AC1/AC3)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findByText('Weekly Jazz Jam');

    const weekCall = capturedCalendarVariables[0];
    expect(weekCall.perDayLimit).toBe(20);
    // `limit: 1000` is meaningless once the per-day window *is* the budget (Task 5.2), so the call
    // no longer carries it at all rather than carrying a silently-ignored value.
    expect(weekCall.limit).toBeUndefined();
    expect(weekCall.offset).toBeUndefined();
  });

  it('continues a truncated day through a day-scoped query from offset 20 once its loaded rows are nearly shown (no perDayLimit)', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    // 20 single-day occurrences fill the week fetch's per-day window, so the day may have more.
    const busyDayEvents = Array.from({ length: 20 }, (_, i) => buildBusyDayEvent(i));
    const continuationEvent = buildBusyDayEvent(20);

    server.use(
      api.query('getEventsForCalendar', ({ variables }) => {
        capturedCalendarVariables.push(variables);
        if (variables.offset === 20) {
          return calendarQueryResponse([continuationEvent], false, 1);
        }
        return calendarQueryResponse(busyDayEvents, false, busyDayEvents.length);
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findByText('Busy Day Event 0');
    const desktopViews = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktopView = desktopViews[desktopViews.length - 1];

    // Dormant until needed: only the week call has been made, and the day says it may have more.
    expect(capturedCalendarVariables).toHaveLength(1);
    expect(within(desktopView).getAllByTestId('desktop-day-total').some((el) => el.textContent === '20+')).toBe(true);

    // Band 1 (6 rows) is showing; two more "Show more" clicks bring the loaded rows to within one
    // band of the end (18 of 20), which prefetches the day's continuation.
    fireEvent.click(within(desktopView).getByTestId('calendar-show-more'));
    expect(capturedCalendarVariables).toHaveLength(1);
    fireEvent.click(within(desktopView).getByTestId('calendar-show-more'));

    await waitFor(() => expect(capturedCalendarVariables.some((v) => v.offset === 20)).toBe(true));
    const dayCall = capturedCalendarVariables.find((v) => v.offset === 20)!;
    expect(dayCall.limit).toBe(20);
    expect(dayCall.perDayLimit).toBeUndefined();
    const serializedCondition = JSON.stringify(dayCall.query);
    expect(serializedCondition).toContain('scheduleDateRange');
    expect(serializedCondition).toContain('overlaps');
    expect(serializedCondition).toContain(`"from":"${busyDayIso}"`);
    expect(serializedCondition).toContain(`"to":"${busyDayIso}"`);
    expect(mockPosthogCapture).toHaveBeenCalledWith('calendar_day_continuation_requested', { date: busyDayIso });

    // The continuation row joins the day and the hard stop is reached once everything is shown.
    await waitFor(() => expect(within(desktopView).getAllByTestId('desktop-day-total').some((el) => el.textContent === '21')).toBe(true));
    for (let i = 0; i < 2; i++) {
      const more = within(desktopView).queryByTestId('calendar-show-more');
      if (more) fireEvent.click(more);
    }
    expect(within(desktopView).getByText('Busy Day Event 20')).toBeInTheDocument();
    expect(within(desktopView).queryByTestId('calendar-show-more')).not.toBeInTheDocument();
    expect(within(desktopView).getByTestId('calendar-progress')).toHaveTextContent('calendarAllShownLabel');
  });

  it('does not issue any day-scoped query for a week whose days all fit their window', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    const busyDayEvents = Array.from({ length: 6 }, (_, i) => buildBusyDayEvent(i));

    server.use(
      api.query('getEventsForCalendar', ({ variables }) => {
        capturedCalendarVariables.push(variables);
        return calendarQueryResponse(busyDayEvents, false, busyDayEvents.length);
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <CalendarView q="jazz" types={['MUSIC']} categories={[]} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await screen.findByText('Busy Day Event 0');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(capturedCalendarVariables).toHaveLength(1);
    expect(capturedCalendarVariables.filter((v) => v.offset === 20)).toHaveLength(0);
  });
});
