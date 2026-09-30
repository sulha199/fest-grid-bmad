import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../locales/en.json';
import { FeedContent } from './feed-content';
import { graphqlClient } from '@/lib/graphql-client';

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  Link: ({ children, href, className }: any) => <a href={href} className={className}>{children}</a>,
}));

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

let mockSession: any = { user: { id: 'user-1', email: 'user@test.dev' } };
let mockAuthLoading = false;
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: mockAuthLoading,
  }),
}));

// Feed wires useAIFilter (via EventDiscoveryPanel's showAITrigger). Mock the API-key
// gate so the AI trigger actually renders under the same conditions Discovery's does.
vi.mock('@/features/onboarding/use-has-api-key', () => ({
  useApiKeyStatus: () => ({ hasApiKey: true, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('nuqs', () => {
  const React = require('react');
  const store: Record<string, any> = {};
  const listeners: Record<string, Set<Function>> = {};

  (global as any).__resetNuqsStore = () => {
    for (const key in store) delete store[key];
    for (const key in listeners) listeners[key].clear();
  };

  // Story 0.i5e: lets tests simulate a filter change (e.g. `q`) without driving actual UI,
  // matching home-content.test.tsx's own helper.
  (global as any).__setNuqsValue = (key: string, value: any) => {
    store[key] = value;
    if (listeners[key]) {
      listeners[key].forEach((listener: any) => listener(value));
    }
  };

  return {
    useQueryState: (key: string, options?: any) => {
      const defaultValue = options?.defaultValue ?? '';
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
    parseAsStringLiteral: (allowed: any) => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
  };
});

let mockEventsItems: any[] = [
  {
    id: 'evt-1',
    eventName: 'Event Feed 1',
    slug: 'event-feed-1',
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

let mockSubscriptions: any[] = [];
let mockHasMore = false;
let shouldRejectToggle = false;

let mockRequestSpy = vi.fn().mockImplementation(async (document: any, variables: any) => {
  const queryStr = JSON.stringify(document);
  if (queryStr.includes('mySubscriptions') || queryStr.includes('GetMySubscriptions')) {
    return {
      mySubscriptions: mockSubscriptions,
    };
  }

  if (queryStr.includes('toggleFavorite')) {
    if (shouldRejectToggle) {
      throw new Error('toggleFavorite mutation failed');
    }
    const item = mockEventsItems.find((e) => e.id === variables.eventId);
    const nextFavorited = item ? !item.isFavorited : true;
    return {
      toggleFavorite: {
        eventId: variables.eventId,
        isFavorited: nextFavorited,
        favoriteCount: Math.max(0, (item?.favoriteCount ?? 0) + (nextFavorited ? 1 : -1)),
      },
    };
  }

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
  mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
  mockAuthLoading = false;
  mockEventsItems = [
    {
      id: 'evt-1',
      eventName: 'Event Feed 1',
      slug: 'event-feed-1',
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
  mockRequestSpy.mockClear();
  mockSubscriptions = [];
  mockHasMore = false;
  shouldRejectToggle = false;
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
        <FeedContent />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('FeedContent', () => {
  it('redirects unauthenticated users to /login and does not render content', async () => {
    mockSession = null;

    const { container } = renderWithProviders();

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

    expect(mockRequestSpy).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it('renders populated feed with event cards when authenticated', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Feed 1')).toBeInTheDocument();
    });

    expect(mockRequestSpy).toHaveBeenCalled();
    expect(screen.getByText('My Feed')).toBeInTheDocument();

    // AC#1/#2 wiring: the nearby-location popover trigger and the AI filter trigger now
    // render in the authenticated feed (no longer permanently absent as before 1.3l).
    expect(screen.getByText(/Nearby/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter with AI' })).toBeInTheDocument();
  });

  it('renders empty feed state with subscribe CTA when feed query returns no events', async () => {
    mockEventsItems = [];

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Your feed is empty! Subscribe to social media accounts to see their events here.')).toBeInTheDocument();
    });

    const ctaButton = screen.getByRole('link', { name: 'Manage Subscriptions' });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('href', '/settings/account');
  });

  it('renders SubscriptionPicker when there are multiple active subscriptions and filters feed on selection', async () => {
    mockSubscriptions = [
      {
        id: 'sub-1',
        accountId: 'acc-1',
        isNewlyAdded: false,
        createdAt: new Date().toISOString(),
        account: {
          id: 'acc-1',
          platform: 'instagram',
          displayName: 'Jakarta Festivals',
          username: 'jkt_festivals',
          profileImageUrl: null,
          hasPendingDefaultLocationReview: false,
          defaultLocation: null,
        },
      },
      {
        id: 'sub-2',
        accountId: 'acc-2',
        isNewlyAdded: false,
        createdAt: new Date().toISOString(),
        account: {
          id: 'acc-2',
          platform: 'instagram',
          displayName: 'Jakarta Exhibition',
          username: 'jkt_exhibitions',
          profileImageUrl: null,
          hasPendingDefaultLocationReview: false,
          defaultLocation: null,
        },
      },
    ];

    renderWithProviders();

    // Verify Subscription Picker renders
    await waitFor(() => {
      expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    });

    expect(screen.getByText('Jakarta Festivals')).toBeInTheDocument();
    expect(screen.getByText('Jakarta Exhibition')).toBeInTheDocument();

    // Clear previous calls to focus on interaction-triggered calls
    mockRequestSpy.mockClear();

    // Toggle Jakarta Festivals
    const filterBtn = screen.getByRole('button', { name: /Jakarta Festivals/ });
    filterBtn.click();

    // Verify events query is sent with socialMediaAccountProfileId in condition
    await waitFor(() => {
      mockRequestSpy.mock.calls.forEach((c: any) => {
        console.log('CALL QUERY COND:', JSON.stringify(c[1]?.query, null, 2));
      });
      const call = mockRequestSpy.mock.calls.find((args: any) => {
        return args[1]?.query?.conditions?.some((c: any) => c.field === 'socialMediaAccountProfileId');
      });
      expect(call).toBeDefined();
    });
  });
});

// Story 0.i5e — FeedContent adopts useListPaginationController: resetToken-into-queryKey
// integration, scroll-to-top-on-reset, and the AC6-extension favorite-toggle rollback fix.
describe('FeedContent - Story 0.i5e (pagination controller)', () => {
  it('does not call window.scrollTo on initial mount', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Feed 1')).toBeInTheDocument();
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('resets to offset 0 (not 10) and scrolls to top when a filter changes after a page-2 fetch', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mockHasMore = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Feed 1')).toBeInTheDocument();
    });

    // Trigger a page-2 fetch (offset 10)
    await act(async () => {
      (window as any).triggerScroll();
    });

    await waitFor(() => {
      const calls = mockRequestSpy.mock.calls;
      expect(calls.some((c: any) => c[1]?.offset === 10)).toBe(true);
    });

    mockRequestSpy.mockClear();
    mockHasMore = false;
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Simulate a filter change (search) via the shared nuqs store
    await act(async () => {
      (global as any).__setNuqsValue('q', 'jazz');
    });

    await waitFor(() => {
      const calls = mockRequestSpy.mock.calls;
      expect(calls.some((c: any) => c[1]?.offset === 0)).toBe(true);
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: expect.stringMatching(/auto|smooth/) });
  });

  it('rolls back an optimistic favorite toggle when the mutation fails, under the real nearby/aiFilter/resetToken-bearing key (AC6 extension)', async () => {
    mockEventsItems = [
      {
        id: 'evt-1',
        eventName: 'Event Feed 1',
        slug: 'event-feed-1',
        isFavorited: true,
        favoriteCount: 5,
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
    shouldRejectToggle = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event Feed 1')).toBeInTheDocument();
    });

    // Pre-toggle state: favorited, count 5
    expect(screen.getByText('5')).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: 'Remove from Favorites' });
    fireEvent.click(toggleButton);

    // Optimistic flip applied immediately: unfavorited, count decremented to 4
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    // Mutation rejects -- onError must restore the pre-toggle card state (count back to 5)
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
