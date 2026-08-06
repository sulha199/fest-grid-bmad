import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { expect, test, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { HomeContent as Home } from './home-content';
import { generateMetadata } from './page';
import enMessages from '../../../locales/en.json';

// Mock next-intl/server for testing generateMetadata
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: any) => {
    const messages = await import(`../../../locales/${locale}.json`);
    return (key: string) => messages.default[namespace][key];
  },
  getMessages: vi.fn(),
  setRequestLocale: vi.fn()
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Mock navigation
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock Auth
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: { user: { email: 'test@example.com' } },
    signOut: vi.fn(),
  }),
}));

// Mock PostHog
const mockPostHog = { capture: vi.fn() };
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => mockPostHog
}));

// Mock nuqs to use React state for testing
vi.mock('nuqs', () => {
  const React = require('react');
  const store: Record<string, any> = {};
  const listeners: Record<string, Set<Function>> = {};
  
  (global as any).__resetNuqsStore = () => {
    for (const key in store) delete store[key];
    for (const key in listeners) listeners[key].clear();
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

      const setSharedState = React.useCallback((val: any) => {
        const newValue = typeof val === 'function' ? val(store[key]) : val;
        const resolvedValue = newValue === null ? defaultValue : newValue;
        store[key] = resolvedValue;
        if (listeners[key]) {
          listeners[key].forEach((listener: any) => listener(resolvedValue));
        }
      }, [key, defaultValue]);

      return [state, setSharedState];
    },
    parseAsString: { withDefault: (val: any) => ({ defaultValue: val }) },
    parseAsArrayOf: () => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
    parseAsInteger: { withDefault: (val: any) => ({ defaultValue: val }) },
  };
});

// Mock the graphql client to use absolute URL for testing
vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

// 1. Mock the useInfiniteScroll hook because IntersectionObserver is hard to mock in jsdom
// and we just want to test if fetchNextPage gets called when it should.
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/ui')>();
  return {
    ...actual,
    useInfiniteScroll: ({ fetchNextPage, hasNextPage, isFetchingNextPage }: any) => {
      // Expose a way to trigger scroll for testing
      (window as any).triggerScroll = () => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      };
      return { sentinelRef: vi.fn() };
    }
  };
});

// Mock getMyLocations react-query hook to avoid MSW/network issues
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetMyLocationsQuery: () => ({
      data: {
        myLocations: [],
      },
      isLoading: false,
      isError: false,
    }),
  };
});

const mockEventsDataPage1 = {
  events: {
    hasMore: true,
    totalCount: 15,
    items: [
      {
        id: '1',
        eventName: 'Test Event 1',
        imageUrl: null,
        location: 'Test Location 1',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          {
            id: 's1',
            isMainSchedule: true,
            eventStartDate: new Date().toISOString(),
            ticketPrice: '10'
          }
        ]
      }
    ]
  }
};

const mockEventsDataPage2 = {
  events: {
    hasMore: false,
    totalCount: 15,
    items: [
      {
        id: '2',
        eventName: 'Test Event 2',
        imageUrl: null,
        location: 'Test Location 2',
        types: [],
        categories: [],
        schedules: [
          {
            id: 's2',
            isMainSchedule: true,
            eventStartDate: new Date().toISOString(),
            ticketPrice: '20'
          }
        ]
      }
    ]
  }
};

export let lastQueryVariables: any = null;

const mswServer = setupServer(
  graphql.query('getEvents', ({ variables }) => {
    lastQueryVariables = variables;
    if ((variables as any).offset === 0) {
      return HttpResponse.json({ data: mockEventsDataPage1 });
    }
    return HttpResponse.json({ data: mockEventsDataPage2 });
  })
);

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));

afterEach(() => {
  cleanup();
  mswServer.resetHandlers();
  lastQueryVariables = null;
  if ((global as any).__resetNuqsStore) {
    (global as any).__resetNuqsStore();
  }
});
afterAll(() => mswServer.close());

// Reuse the real locale file rather than a hand-duplicated copy, so a key
// rename/removal in en.json breaks this test instead of drifting silently.
const messages = enMessages;

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

test('generateMetadata resolves Discovery page title distinct from root default', async () => {
  const metadataEN = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
  expect(metadataEN).toEqual({
    title: 'Discover Events | FestDaily',
    description: 'Browse and search for upcoming events on FestDaily.',
    openGraph: {
      title: 'Discover Events | FestDaily',
      description: 'Browse and search for upcoming events on FestDaily.',
    }
  });

  const metadataID = await generateMetadata({ params: Promise.resolve({ locale: 'id' }) });
  expect(metadataID).toEqual({
    title: 'Temukan Acara | FestDaily',
    description: 'Jelajahi dan cari acara mendatang di FestDaily.',
    openGraph: {
      title: 'Temukan Acara | FestDaily',
      description: 'Jelajahi dan cari acara mendatang di FestDaily.',
    }
  });
});

test('renders initial skeleton, then events, and supports infinite scroll append', async () => {
  renderWithProviders(<Home />);

  // Should render skeleton initially
  // EventCard has aria-busy="true" when loading
  expect(screen.getAllByRole('article', { busy: true }).length).toBeGreaterThan(0);

  // Wait for first page to load
  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });

  // Skeleton should be gone
  expect(screen.queryByRole('article', { busy: true })).not.toBeInTheDocument();

  // Enum values must render as translated labels, not raw enum members
  expect(screen.getAllByText('Music').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Festival').length).toBeGreaterThan(0);
  expect(screen.queryByText('MUSIC')).not.toBeInTheDocument();
  expect(screen.queryByText('FESTIVAL')).not.toBeInTheDocument();

  // Price label must be translated, not hardcoded
  expect(screen.getByText('From')).toBeInTheDocument();

  // Trigger scroll to fetch next page
  (window as any).triggerScroll();

  // Wait for second page to load and append
  await waitFor(() => {
    expect(screen.getByText('Test Event 2')).toBeInTheDocument();
  });

  // Verify first page is still there (append, not replace)
  expect(screen.getByText('Test Event 1')).toBeInTheDocument();
});

test('renders empty state when no events', async () => {
  mswServer.use(
    graphql.query('getEvents', () => {
      return HttpResponse.json({
        data: {
          events: { hasMore: false, totalCount: 0, items: [] }
        }
      });
    })
  );

  renderWithProviders(<Home />);

  await waitFor(() => {
    expect(screen.getByText('No events found.')).toBeInTheDocument();
  });
});

test('renders error state when query fails', async () => {
  mswServer.use(
    graphql.query('getEvents', () => {
      return HttpResponse.json({ errors: [{ message: 'Network Error' }] });
    })
  );

  renderWithProviders(<Home />);

  await waitFor(() => {
    expect(screen.getByText('Failed to load events. Please try again later.')).toBeInTheDocument();
  });
});

test('search integration: submits DSL payload and renders search empty state', async () => {
  renderWithProviders(<Home />);

  // Wait for initial load
  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });

  // Type in search bar and press Enter
  const searchInput = screen.getByPlaceholderText('Search by name, performer, or location...');
  fireEvent.change(searchInput, { target: { value: 'Rock' } });
  fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

  // Assert the DSL shape sent to the server
  await waitFor(() => {
    expect(lastQueryVariables.query).toEqual({
      operator: 'and',
      conditions: [
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'Rock' },
            { field: 'performers', operator: 'contains', value: 'Rock' },
            { field: 'location', operator: 'contains', value: 'Rock' },
          ]
        }
      ]
    });
  });

  // Mock an empty result for the search
  mswServer.use(
    graphql.query('getEvents', () => {
      return HttpResponse.json({
        data: {
          events: { hasMore: false, totalCount: 0, items: [] }
        }
      });
    })
  );

  // Type something else to trigger new fetch with empty results
  fireEvent.change(searchInput, { target: { value: 'Nothing' } });
  fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

  await waitFor(() => {
    // Assert search-specific empty state is rendered
    expect(screen.getByText('No events match your search.')).toBeInTheDocument();
  });

  // Clear search using the "clear" button and expect base query without filters
  // We expect the UI to immediately revert to the default list (Test Event 1) 
  // because react-query has it cached under q=""
  const clearButton = screen.getByRole('button', { name: 'Clear search' });
  fireEvent.click(clearButton);

  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });
});

test('filter integration: single-facet, single-value selection produces correct in condition', async () => {
  renderWithProviders(<Home />);

  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });

  // Select 'Festival' type
  const festivalButton = screen.getAllByRole('button', { name: 'Festival' })[0];
  fireEvent.click(festivalButton);

  await waitFor(() => {
    expect(lastQueryVariables.query).toEqual({
      operator: 'and',
      conditions: [
        { field: 'types', operator: 'in', value: ['FESTIVAL'] }
      ]
    });
  });
});

test('filter integration: single-facet, multi-value selection produces one in condition', async () => {
  renderWithProviders(<Home />);

  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });

  const festivalButton = screen.getAllByRole('button', { name: 'Festival' })[0];
  fireEvent.click(festivalButton);
  
  const performanceButton = screen.getAllByRole('button', { name: 'Performance' })[0];
  fireEvent.click(performanceButton);

  await waitFor(() => {
    expect(lastQueryVariables.query).toEqual({
      operator: 'and',
      conditions: [
        { field: 'types', operator: 'in', value: ['FESTIVAL', 'PERFORMANCE'] }
      ]
    });
  });
});

test('filter integration: selections across both facets plus active search combine via one flat and group', async () => {
  renderWithProviders(<Home />);

  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText('Search by name, performer, or location...');
  fireEvent.change(searchInput, { target: { value: 'Rock' } });
  fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

  const festivalButton = screen.getAllByRole('button', { name: 'Festival' })[0];
  fireEvent.click(festivalButton);

  const musicButton = screen.getAllByRole('button', { name: 'Music' })[0];
  fireEvent.click(musicButton);

  await waitFor(() => {
    expect(lastQueryVariables.query).toEqual({
      operator: 'and',
      conditions: [
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'Rock' },
            { field: 'performers', operator: 'contains', value: 'Rock' },
            { field: 'location', operator: 'contains', value: 'Rock' },
          ]
        },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] }
      ]
    });
  });
});

test('filter integration: clearing filters restores default query', async () => {
  renderWithProviders(<Home />);

  await waitFor(() => {
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
  });

  const festivalButton = screen.getAllByRole('button', { name: 'Festival' })[0];
  fireEvent.click(festivalButton);

  await waitFor(() => {
    expect(lastQueryVariables.query).toEqual({
      operator: 'and',
      conditions: [
        { field: 'types', operator: 'in', value: ['FESTIVAL'] }
      ]
    });
  });

  const clearButton = screen.getByRole('button', { name: 'Clear filters' });
  fireEvent.click(clearButton);

  await waitFor(() => {
    // Should be undefined because no conditions exist.
    expect(lastQueryVariables.query).toBeUndefined();
  });
});
