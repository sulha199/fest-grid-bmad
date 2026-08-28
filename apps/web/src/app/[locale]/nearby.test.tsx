import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { expect, describe, it, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { HomeContent as Home } from './home-content';
import enMessages from '../../../locales/en.json';

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: any) => {
    const messages = await import(`../../../locales/${locale}.json`);
    return (key: string) => messages.default[namespace][key];
  },
  getMessages: vi.fn(),
  setRequestLocale: vi.fn()
}));

// Mock next/navigation
vi.mock('next/navigation', () => {
  let searchParams = new URLSearchParams();
  return {
    useSearchParams: () => searchParams,
    __setSearchParams: (newParams: URLSearchParams) => {
      searchParams = newParams;
    }
  };
});

// Mock navigation
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock Auth
let mockSession: any = { user: { email: 'test@example.com' } };
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
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
    parseAsStringLiteral: (allowed: any) => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
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

// Mock infinite scroll
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/ui')>();
  return {
    ...actual,
    useInfiniteScroll: () => ({ sentinelRef: vi.fn() }),
  };
});

// Mock getMyLocations react-query hook to avoid MSW/network issues
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetMyLocationsQuery: () => ({
      data: {
        myLocations: [
          {
            id: 'loc-1',
            name: 'Home Base',
            radius: 10000,
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
            locationDetails: {
              formattedAddress: 'Jakarta, Indonesia',
              placeName: 'Jakarta',
              coordinates: { lat: -6.2, lng: 106.8 }
            }
          }
        ]
      },
      isLoading: false,
      isError: false,
    }),
  };
});

// Mock data
const mockEventsData = {
  events: {
    hasMore: false,
    totalCount: 1,
    items: [
      {
        id: '1',
        eventName: 'Nearby Event 1',
        imageUrl: null,
        location: 'Jakarta',
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

const mockLocations = [
  {
    id: 'loc-1',
    name: 'Home Base',
    radius: 10000, // 10km
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    locationDetails: {
      formattedAddress: 'Jakarta, Indonesia',
      placeName: 'Jakarta',
      coordinates: { lat: -6.2, lng: 106.8 }
    }
  }
];

export let lastQueryVariables: any = null;

const mswServer = setupServer(
  graphql.query('getEvents', ({ variables }) => {
    console.log("mswServer getEvents variables intercepted:", variables);
    lastQueryVariables = variables;
    return HttpResponse.json({ data: mockEventsData });
  }),
  graphql.query('getMyLocations', () => {
    return HttpResponse.json({ data: { myLocations: mockLocations } });
  })
);

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));

afterEach(() => {
  cleanup();
  mswServer.resetHandlers();
  lastQueryVariables = null;
  mockSession = { user: { email: 'test@example.com' } };
  sessionStorage.clear();
  if ((global as any).__resetNuqsStore) {
    (global as any).__resetNuqsStore();
  }
});

afterAll(() => mswServer.close());

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('Nearby Filter Integration', () => {
  it('automatically defaults to earliest created location preference and radius when authenticated (AC4)', async () => {
    renderWithProviders(<Home />);

    // Story 2.5 AC13 collapsed the filter behind a Popover trigger — open it first.
    // Match either the idle "Nearby" label or the already-auto-resolved "{location} · {radius}"
    // summary text, since the auto-default (AC4) may resolve before this query runs.
    const triggers = await screen.findAllByRole('button', { name: /Nearby|km$/ });
    const trigger = triggers.find((btn) => btn.getAttribute('aria-haspopup') === 'dialog');
    expect(trigger).toBeDefined();
    fireEvent.click(trigger!);

    // Verify it loads locations and defaults selection
    await waitFor(() => {
      expect(screen.getByLabelText('Nearby')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Nearby') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.value).toBe('loc-1');
    });

    // Slider should pre-fill with 10 km (10000m)
    const slider = screen.getByLabelText('Radius') as HTMLInputElement;
    expect(slider.value).toBe('10');

    // Query variables should contain nearby filter condition with correct shape
    await waitFor(() => {
      expect(lastQueryVariables?.query?.conditions).toBeDefined();
    });
    const nearbyCondition = lastQueryVariables.query.conditions.find(
      (c: any) => c.field === 'scheduleCoordinates'
    );
    expect(nearbyCondition).toBeDefined();
    expect(nearbyCondition.value).toEqual({
      locationPreferenceId: 'loc-1',
      radiusKm: 10,
    });
  });

  it('behaves exactly as today without rendering or querying geolocation for anonymous users (AC7)', async () => {
    mockSession = null; // simulate anonymous

    renderWithProviders(<Home />);

    // Nearby filter should not be offered or rendered
    await waitFor(() => {
      expect(screen.queryByLabelText('Nearby')).not.toBeInTheDocument();
    });

    // Query should not contain scheduleCoordinates condition
    const nearbyCondition = lastQueryVariables?.query?.conditions?.find(
      (c: any) => c.field === 'scheduleCoordinates'
    );
    expect(nearbyCondition).toBeUndefined();
  });
});
