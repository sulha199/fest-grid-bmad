import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, act, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../locales/en.json';
import idMessages from '../../../locales/id.json';
import { HomeContent, parseNearbyBadgeThreshold } from './home-content';

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  Link: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

let mockSession: any = null;
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: false,
  }),
}));

// FIND-059: supports the nearby-badge i18n assertion below. Mirrors nearby.test.tsx's own
// `mockCoordinate` pattern (the ambient-fallback path -- no `nearby` query param is ever set in
// this file, so `useNearbyFilter`'s `activeFilterCoord` resolves straight to this coordinate).
// Defaults to `null` so every other test in this file (no coordinate, no event location) is
// unaffected -- `home-content.tsx`'s `getCardProps` only computes a non-null `distanceKm` when
// both this coordinate AND the event's own schedule coordinates are present.
let mockCoordinate: { latitude: number; longitude: number } | null = null;
vi.mock('@/lib/hooks/useViewerLocation', () => ({
  useViewerLocation: () => ({
    coordinate: mockCoordinate,
    isCapturing: false,
    error: null,
    captureExplicit: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Shared in-memory nuqs store keyed by query param, matching feed-content.test.tsx's pattern
// exactly so q/types/categories changes propagate like real URL state.
vi.mock('nuqs', () => {
  const React = require('react');
  const store: Record<string, any> = {};
  const listeners: Record<string, Set<Function>> = {};

  (global as any).__resetNuqsStore = () => {
    for (const key in store) delete store[key];
    for (const key in listeners) listeners[key].clear();
  };

  (global as any).__setNuqsValue = (key: string, value: any) => {
    store[key] = value;
    if (listeners[key]) {
      listeners[key].forEach((listener: any) => listener(value));
    }
  };

  return {
    useQueryState: (key: string, options?: any) => {
      const defaultValue = options?.defaultValue ?? null;
      if (!(key in store)) {
        store[key] = defaultValue;
      }
      const [state, setState] = React.useState(store[key]);

      React.useEffect(() => {
        if (!listeners[key]) listeners[key] = new Set();
        listeners[key].add(setState);
        return () => {
          listeners[key].delete(setState);
        };
      }, [key]);

      const setSharedState = React.useCallback(
        (val: any) => {
          const newValue = typeof val === 'function' ? val(store[key]) : val;
          const resolvedValue = newValue === null ? defaultValue : newValue;
          store[key] = resolvedValue;
          if (listeners[key]) {
            listeners[key].forEach((listener: any) => listener(resolvedValue));
          }
        },
        [key, defaultValue]
      );

      return [state, setSharedState];
    },
    parseAsString: { withDefault: (val: any) => ({ defaultValue: val }) },
    parseAsInteger: { withDefault: (val: any) => ({ defaultValue: val }) },
    parseAsArrayOf: () => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
    // No `.withDefault(...)` call in home-content.tsx (AC7: absent/null means "All"), so this
    // mock never needs to supply one -- the shared store's own `defaultValue ?? null` fallback
    // already gives `temporal` a starting value of `null`.
    parseAsStringEnum: () => ({}),
  };
});

let mockEventsItems: any[] = [
  {
    id: 'evt-1',
    eventName: 'Event Home 1',
    slug: 'event-home-1',
    isFavorited: false,
    imageUrl: null,
    location: 'Location 1',
    types: ['FESTIVAL'],
    categories: ['MUSIC'],
    schedules: [
      {
        id: 'evt-1-schedule',
        isMainSchedule: true,
        eventStartDate: new Date('2026-08-12T12:00:00Z').toISOString(),
        ticketPrice: '100',
      },
    ],
  },
];

let mockHasMore = false;

let mockRequestSpy = vi.fn().mockImplementation(async () => {
  return {
    events: {
      items: mockEventsItems,
      hasMore: mockHasMore,
      totalCount: mockEventsItems.length,
    },
  };
});

vi.mock('@/lib/graphql-client', () => {
  return {
    graphqlClient: {
      request: (...args: any[]) => mockRequestSpy(...args),
    },
  };
});

vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/ui')>();
  return {
    ...actual,
    useInfiniteScroll: ({ fetchNextPage, hasNextPage, isFetchingNextPage }: any) => {
      (window as any).triggerScroll = () => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      };
      return { sentinelRef: vi.fn() };
    },
  };
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  mockRouterPush.mockReset();
  mockPosthogCapture.mockReset();
  mockSession = null;
  mockEventsItems = [
    {
      id: 'evt-1',
      eventName: 'Event Home 1',
      slug: 'event-home-1',
      isFavorited: false,
      imageUrl: null,
      location: 'Location 1',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      schedules: [
        {
          id: 'evt-1-schedule',
          isMainSchedule: true,
          eventStartDate: new Date('2026-08-12T12:00:00Z').toISOString(),
          ticketPrice: '100',
        },
      ],
    },
  ];
  mockHasMore = false;
  mockCoordinate = null;
  mockRequestSpy.mockClear();
  if ((global as any).__resetNuqsStore) {
    (global as any).__resetNuqsStore();
  }
});

function renderWithProviders(locale: 'en' | 'id' = 'en') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });

  const messages = locale === 'id' ? idMessages : enMessages;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <HomeContent />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('HomeContent', () => {
  it('renders populated event list on initial mount with offset 0', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    expect(mockRequestSpy).toHaveBeenCalled();
    const firstCall = mockRequestSpy.mock.calls[0];
    expect(firstCall[1].offset).toBe(0);
  });

  it('does not call window.scrollTo on initial mount', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('fetches page 2 at offset 10 when scrolling with hasMore true', async () => {
    mockHasMore = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    mockRequestSpy.mockClear();
    mockHasMore = false;

    await act(async () => {
      (window as any).triggerScroll();
    });

    await waitFor(() => {
      expect(mockRequestSpy).toHaveBeenCalled();
    });

    const secondCall = mockRequestSpy.mock.calls[0];
    expect(secondCall[1].offset).toBe(10);
  });

  it('resets to offset 0 (not 20) and scrolls to top when a filter changes after a page-2 fetch', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mockHasMore = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    // Trigger a page-2 fetch (offset 10)
    await act(async () => {
      (window as any).triggerScroll();
    });

    await waitFor(() => {
      const calls = mockRequestSpy.mock.calls;
      expect(calls.some((c: any) => c[1].offset === 10)).toBe(true);
    });

    mockRequestSpy.mockClear();
    mockHasMore = false;
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Simulate a filter change (search submit) via the shared nuqs store
    await act(async () => {
      (global as any).__setNuqsValue('q', 'jazz');
    });

    await waitFor(() => {
      expect(mockRequestSpy).toHaveBeenCalled();
    });

    const resetCall = mockRequestSpy.mock.calls[0];
    expect(resetCall[1].offset).toBe(0);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: expect.stringMatching(/auto|smooth/) });
  });
});

// Story 0.i5d — the temporal filter's committed value (`temporal` nuqs query state, AC7).
describe('HomeContent - Story 0.i5d (temporal filter)', () => {
  it('resets offset to 0 (not 20) when the temporal filter changes after a page-2 fetch', async () => {
    mockHasMore = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    // Trigger a page-2 fetch (offset 10)
    await act(async () => {
      (window as any).triggerScroll();
    });

    await waitFor(() => {
      const calls = mockRequestSpy.mock.calls;
      expect(calls.some((c: any) => c[1].offset === 10)).toBe(true);
    });

    mockRequestSpy.mockClear();
    mockHasMore = false;

    await act(async () => {
      (global as any).__setNuqsValue('temporal', 'TODAY');
    });

    await waitFor(() => {
      expect(mockRequestSpy).toHaveBeenCalled();
    });

    const resetCall = mockRequestSpy.mock.calls[0];
    expect(resetCall[1].offset).toBe(0);
  });

  it('includes a scheduleEndedBoundary/notEnded condition in the request query when temporal=TODAY', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    mockRequestSpy.mockClear();

    await act(async () => {
      (global as any).__setNuqsValue('temporal', 'TODAY');
    });

    await waitFor(() => {
      expect(mockRequestSpy).toHaveBeenCalled();
    });

    const call = mockRequestSpy.mock.calls[0];
    const query = call[1].query;
    const serialized = JSON.stringify(query);
    expect(serialized).toContain('scheduleEndedBoundary');
    expect(serialized).toContain('notEnded');
  });

  it('omits any temporal narrowing from the request query when the filter is null (All)', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    const call = mockRequestSpy.mock.calls[0];
    const serialized = JSON.stringify(call[1].query ?? null);
    expect(serialized).not.toContain('scheduleEndedBoundary');
  });

  it('fires temporal_filter_changed with the correct payload when the filter changes, and "ALL" on reset to default', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    const toggleGroup = screen.getByRole('radiogroup', { name: 'Filter events by time' });
    const todayOption = within(toggleGroup).getByRole('radio', { name: 'Today' });

    await act(async () => {
      todayOption.click();
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith('temporal_filter_changed', { value: 'TODAY' });

    const allOption = within(toggleGroup).getByRole('radio', { name: 'All' });
    mockPosthogCapture.mockClear();

    await act(async () => {
      allOption.click();
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith('temporal_filter_changed', { value: 'ALL' });
  });
});

// Story 1.i1o AC1/AC3 — the EventCard `favoriteToggle` label (rendered as the favorite
// button's aria-label) must come from the new shared `EventCard` next-intl namespace, not
// EventCard.tsx's hardcoded English `defaultLabels`, on any live locale.
describe('HomeContent - Story 1.i1o (EventCard label i18n)', () => {
  it('renders the translated Indonesian favorite-toggle label under the id locale', async () => {
    renderWithProviders('id');

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Alihkan favorit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle favorite' })).not.toBeInTheDocument();
  });

  it('renders the English favorite-toggle label under the en locale (unchanged)', async () => {
    renderWithProviders('en');

    await waitFor(() => {
      expect(screen.getByText('Event Home 1')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
  });

  // FIND-059 (review finding on this story): the above only ever asserted `favoriteToggle`,
  // leaving the TILL tag, status badge, and nearby-distance badge -- three more of the four
  // label groups this story wires -- unverified on a card-list page. English's translated
  // content happens to equal EventCard's own hardcoded `defaultLabels` for every key below, so
  // only the `id` locale (real, distinct Indonesian content) can actually distinguish "wired
  // through next-intl" from "silently fell through to the English default".
  it('renders the translated TILL tag and "happening now" status badge under the id locale', async () => {
    const now = Date.now();
    mockEventsItems = [
      {
        id: 'evt-till',
        eventName: 'Till Event',
        slug: 'event-till',
        isFavorited: false,
        imageUrl: null,
        location: 'Location Till',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          {
            id: 'evt-till-schedule',
            isMainSchedule: true,
            // Started yesterday, ends 3 days from now -- `started && endDayDiff > 0`, the one
            // state that produces both a TILL tag (EventCard.tsx) and a "happening now" status
            // badge (formatEventStatus) from the same schedule.
            eventStartDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            eventEndDate: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
            ticketPrice: '100',
          },
        ],
      },
    ];

    renderWithProviders('id');

    await waitFor(() => {
      expect(screen.getByText('Till Event')).toBeInTheDocument();
    });

    // id.json EventCard.tillLabel / statusHappeningNow -- not the English "till"/"Now" default.
    expect(screen.getByText('s.d.')).toBeInTheDocument();
    expect(screen.getByText('Hari ini')).toBeInTheDocument();
  });

  it('renders the translated "upcoming" status badge under the id locale', async () => {
    const now = Date.now();
    mockEventsItems = [
      {
        id: 'evt-upcoming',
        eventName: 'Upcoming Event',
        slug: 'event-upcoming',
        isFavorited: false,
        imageUrl: null,
        location: 'Location Upcoming',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          {
            id: 'evt-upcoming-schedule',
            isMainSchedule: true,
            // Starts 20 days from now -- `startDayDiff >= 14`, the `statusUpcoming` branch.
            eventStartDate: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString(),
            ticketPrice: '100',
          },
        ],
      },
    ];

    renderWithProviders('id');

    await waitFor(() => {
      expect(screen.getByText('Upcoming Event')).toBeInTheDocument();
    });

    // id.json EventCard.statusUpcoming -- not the English "Upcoming" default.
    expect(screen.getByText('Akan Datang')).toBeInTheDocument();
  });

  it('renders the translated (locale-formatted) nearby-distance badge under the id locale', async () => {
    // Ambient-fallback coordinate (no `nearby` filter selected) -- same mechanism nearby.test.tsx
    // already exercises in English; here it also proves the id-locale comma-decimal formatting
    // (`formatLocalizedNearbyBadgeDistance`, AC4) flows through on a card-list page.
    mockCoordinate = { latitude: -6.2, longitude: 106.8 };
    mockEventsItems = [
      {
        id: 'evt-nearby',
        eventName: 'Nearby Event',
        slug: 'event-nearby',
        isFavorited: false,
        imageUrl: null,
        location: 'Location Nearby',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          {
            id: 'evt-nearby-schedule',
            isMainSchedule: true,
            eventStartDate: new Date('2026-08-12T12:00:00Z').toISOString(),
            ticketPrice: '100',
            // Same coordinates as the viewer's ambient location -- 0km away.
            locationDetails: { coordinates: { lat: -6.2, lng: 106.8 } },
          },
        ],
      },
    ];

    renderWithProviders('id');

    await waitFor(() => {
      expect(screen.getByText('Nearby Event')).toBeInTheDocument();
    });

    // Indonesian comma-decimal separator (vs English's "0.0 km", asserted in nearby.test.tsx).
    expect(screen.getByText('0,0 km')).toBeInTheDocument();
  });
});

// Story 1.i1f review finding 7 — the env-var threshold parser is a pure function,
// so it is asserted directly rather than through a full HomeContent render.
describe('parseNearbyBadgeThreshold (Story 1.i1f review finding 7)', () => {
  it('honours an intentionally-configured 0 instead of falling back to the default', () => {
    expect(parseNearbyBadgeThreshold('0')).toBe(0);
  });

  it('accepts positive and fractional overrides', () => {
    expect(parseNearbyBadgeThreshold('12')).toBe(12);
    expect(parseNearbyBadgeThreshold('2.5')).toBe(2.5);
  });

  it.each([undefined, '', '   ', 'abc', '-3', 'NaN', 'Infinity'])(
    'falls back to the built-in default of 8 for %s',
    (raw) => {
      expect(parseNearbyBadgeThreshold(raw as string | undefined)).toBe(8);
    }
  );
});
