import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../locales/en.json';
import { HomeContent } from './home-content';

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
  mockRequestSpy.mockClear();
  if ((global as any).__resetNuqsStore) {
    (global as any).__resetNuqsStore();
  }
});

function renderWithProviders() {
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

  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
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
