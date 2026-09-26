import React from 'react';
import { render, screen as rtlScreen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { CalendarView } from './CalendarView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

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
  useTranslations: (namespace: string) => (key: string, options?: { count?: number }) => {
    if (options && options.count !== undefined) {
      return `${namespace}.${key}(count:${options.count})`;
    }
    return `${namespace}.${key}`;
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
            eventStartTime: '19:00:00',
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
    expect(screen.getByLabelText('Loading calendar view...')).toBeInTheDocument();

    // Wait for the query to resolve and content to render
    const eventCard = await screen.findByText('Weekly Jazz Jam');
    expect(eventCard).toBeInTheDocument();
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
    const favButton = within(mobileView).getByRole('button', { name: 'Toggle favorite' });
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
        eventStartTime: `${String(9 + index).padStart(2, '0')}:00:00`,
        eventEndTime: `${String(10 + index).padStart(2, '0')}:00:00`,
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

  it('opens the day-scoped dialog, fires both AC9 events, and continues from offset 20 without perDayLimit', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    // 8 single-day occurrences on the same day, against `maxEventsPerDay={5}` => "+3 more".
    const busyDayEvents = Array.from({ length: 8 }, (_, i) => buildBusyDayEvent(i));
    const overflowContinuationEvent = buildBusyDayEvent(8);

    server.use(
      api.query('getEventsForCalendar', ({ variables }) => {
        capturedCalendarVariables.push(variables);
        if (variables.offset === 20) {
          return calendarQueryResponse(busyDayEvents, true, busyDayEvents.length);
        }
        if (variables.offset === 40) {
          return calendarQueryResponse([overflowContinuationEvent], false, 1);
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

    // Only the capped 5 render inline; the desktop "+N more" trigger is the entry point.
    const desktopViews = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktopView = desktopViews[desktopViews.length - 1];
    const trigger = within(desktopView).getByTestId('calendar-overflow-trigger-desktop');
    // The `moreLabel` resolver reaches the trigger unchanged (the spec'd ICU plural, as mocked).
    expect(trigger).toHaveTextContent('DiscoveryPage.calendarMoreLabel(count:3)');

    fireEvent.click(trigger);

    // AC9 (1/2) — the open event, with the full payload including the hidden count.
    expect(mockPosthogCapture).toHaveBeenCalledWith('calendar_overflow_dialog_opened', {
      date: busyDayIso,
      surface: 'desktop',
      inlineHiddenCount: 3,
    });

    const dialog = await rtlScreen.findByTestId('calendar-overflow-dialog');
    expect(dialog).toHaveAttribute('data-date', busyDayIso);

    // AC5/AD-2 — the continuation call is narrowed to the exact date, starts at offset 20 with
    // limit 20, and deliberately carries NO `perDayLimit` (it must take the existing flat path).
    await waitFor(() => expect(capturedCalendarVariables.some((v) => v.offset === 20)).toBe(true));
    const overflowCall = capturedCalendarVariables.find((v) => v.offset === 20)!;
    expect(overflowCall.limit).toBe(20);
    expect(overflowCall.perDayLimit).toBeUndefined();
    const serializedCondition = JSON.stringify(overflowCall.query);
    expect(serializedCondition).toContain('scheduleDateRange');
    expect(serializedCondition).toContain('overlaps');
    expect(serializedCondition).toContain(`"from":"${busyDayIso}"`);
    expect(serializedCondition).toContain(`"to":"${busyDayIso}"`);

    // The dialog's own list is the merge of the week-fetch's local day bucket (all 8) — deduped by
    // schedule id, so the continuation page's re-sent rows are not duplicated.
    const rowHeadings = Array.from(dialog.querySelectorAll('h3')).map((el) => el.textContent);
    expect(rowHeadings).toContain('Busy Day Event 0');
    expect(rowHeadings).toContain('Busy Day Event 7');
    expect(rowHeadings.filter((name) => name === 'Busy Day Event 0')).toHaveLength(1);

    // The sentinel resolving a genuine second page.
    act(() => {
      mockObserverInstance?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        mockObserverInstance as unknown as IntersectionObserver
      );
    });

    await waitFor(() => expect(capturedCalendarVariables.some((v) => v.offset === 40)).toBe(true));

    // AC9 (2/2) — reported once the *additional* page resolves, with its own offset/page size.
    await waitFor(() =>
      expect(mockPosthogCapture).toHaveBeenCalledWith('calendar_overflow_more_loaded', {
        date: busyDayIso,
        offset: 40,
        loadedCount: 1,
      })
    );

    // The newly loaded row is appended and announced through the dialog's own live region.
    await waitFor(() =>
      expect(within(dialog).getByRole('heading', { name: 'Busy Day Event 8' })).toBeInTheDocument()
    );
    expect(rtlScreen.getAllByTestId('calendar-overflow-live-region').pop()).toHaveTextContent(
      '1 more event loaded'
    );
  });

  it('closes the dialog back to a dormant state, clearing the day-scoped fetch (Task 8.1)', async () => {
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

    const desktopViews = rtlScreen.queryAllByTestId('desktop-calendar-view');
    const desktopView = desktopViews[desktopViews.length - 1];
    fireEvent.click(within(desktopView).getByTestId('calendar-overflow-trigger-desktop'));

    const dialog = rtlScreen.queryAllByTestId('calendar-overflow-dialog').pop()!;
    expect(dialog).toHaveAttribute('data-date', busyDayIso);
    await waitFor(() => expect(capturedCalendarVariables.some((v) => v.offset === 20)).toBe(true));
    const dialogsBeforeClose = rtlScreen.queryAllByTestId('calendar-overflow-dialog').length;

    // Escape closes it through the dialog's own handler, which is what clears `openOverflowDate`.
    // (Renders from earlier tests in this file are never cleaned up, so the count — not a bare
    // zero — is what proves this dialog went away.)
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(rtlScreen.queryAllByTestId('calendar-overflow-dialog')).toHaveLength(dialogsBeforeClose - 1)
    );

    // Nothing refetches while closed — the day-scoped query really did go dormant.
    const dayScopedCalls = capturedCalendarVariables.filter((v) => v.offset === 20).length;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(capturedCalendarVariables.filter((v) => v.offset === 20)).toHaveLength(dayScopedCalls);
  });
});
