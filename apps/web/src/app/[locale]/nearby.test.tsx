import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, fireEvent, cleanup, renderHook, act, within } from '@testing-library/react';
import { expect, describe, it, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { HomeContent as Home } from './home-content';
import { useNearbyFilter } from './use-nearby-filter';
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

// Mock infinite scroll (real geolocation is unavailable in jsdom)
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/ui')>();
  return {
    ...actual,
    useInfiniteScroll: () => ({ sentinelRef: vi.fn() }),
  };
});

// Story 0.39 — use-nearby-filter.ts now reads the shared useViewerLocation()
// hook (coordinate + captureExplicit) instead of a local capture instance.
// Whether `coordinate` got there via an explicit click (AC10) or the ambient
// silent-capture-when-granted path (AC3) is useViewerLocation's own internal
// concern (see its own useViewerLocation.test.ts) — from this hook's
// perspective there's just one shared coordinate value to read.
let mockCoordinate: { latitude: number; longitude: number } | null = null;
const mockCaptureExplicit = vi.fn(async () => {
  if (!mockCoordinate) throw new Error('no coordinate configured for this test');
  return mockCoordinate;
});
vi.mock('@/lib/hooks/useViewerLocation', () => ({
  useViewerLocation: () => ({
    coordinate: mockCoordinate,
    isCapturing: false,
    error: null,
    captureExplicit: mockCaptureExplicit,
  }),
}));

// Mock getMyLocations react-query hook to avoid MSW/network issues.
// Story 1.i1f review finding FIND-045 — `mockLocationsQueryResult` lets an individual test model
// the query's in-flight window (`isLoading: true`, no data), which is exactly the state
// `isActiveFilterCoordPending` exists to describe. `null` means "the default resolved fixture".
//
// Typed against the exact slice `useNearbyFilter` consumes (finding FIND-045 second-review
// patch: this was `{ data?: any; isLoading: boolean }`) — a renamed or forgotten fixture field is
// now a compile error instead of a silent `undefined` the hook would treat as "no coordinate".
// `coordinates: null` is deliberately modelled even though `Coordinates!` makes it unreachable
// through the typed GraphQL contract (dismissed as harmless defensive coverage in the first
// review) — with the narrower type, forgetting to model it would be the compile error.
type MockSavedLocation = {
  id: string;
  name: string;
  radius: number;
  createdAt: string;
  locationDetails: { coordinates: { lat: number; lng: number } | null } | null;
};
let mockLocationsQueryResult:
  | { data?: { myLocations: MockSavedLocation[] } | undefined; isLoading: boolean }
  | null = null;

vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetMyLocationsQuery: () =>
      mockLocationsQueryResult ?? {
        // Reuses the same fixture the `getMyLocations` MSW handler below returns.
        data: { myLocations: mockLocations },
        isLoading: false,
        isError: false,
      },
  };
});

// Mock data
const mockEventsData = {
  events: {
    hasMore: false,
    totalCount: 2,
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
            ticketPrice: '10',
            // Same coordinates as loc-1 (0km away) — Story 1.i1f distance-badge wiring.
            locationDetails: { coordinates: { lat: -6.2, lng: 106.8 } }
          }
        ]
      },
      {
        id: '2',
        eventName: 'No Coordinates Event',
        imageUrl: null,
        location: 'Unknown',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          {
            id: 's2',
            isMainSchedule: true,
            eventStartDate: new Date().toISOString(),
            ticketPrice: '10',
            locationDetails: null
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
  },
  {
    id: 'loc-no-coords',
    name: 'No Coords',
    // `radius` is metres (the hook maps it as `Math.round(radius / 1000)`, and loc-1 above uses
    // 10000 for 10km) — finding FIND-045 second-review patch: this fixture used a bare `5`,
    // which would have silently meant a 0km radius.
    radius: 5000,
    createdAt: '2026-08-02T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
    locationDetails: {
      formattedAddress: 'Unknown',
      placeName: 'Unknown',
      coordinates: null
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
  mockCoordinate = null;
  mockLocationsQueryResult = null;
  mockCaptureExplicit.mockClear();
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

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
};


describe('Nearby Filter Integration', () => {
  it('does not auto-apply nearby filter on fresh Discovery visit with no nearby param', async () => {
    renderWithProviders(<Home />);

    // Query should not contain scheduleCoordinates condition
    await waitFor(() => {
      expect(lastQueryVariables).not.toBeNull();
    });
    const nearbyCondition = lastQueryVariables?.query?.conditions?.find(
      (c: any) => c.field === 'scheduleCoordinates'
    );
    expect(nearbyCondition).toBeUndefined();

    // Open the FilterHub popover
    const triggers = await screen.findAllByRole('button', { name: /Nearby|km$/ });
    const trigger = triggers.find((btn) => btn.getAttribute('aria-haspopup') === 'dialog');
    expect(trigger).toBeDefined();
    fireEvent.click(trigger!);

    // Verify select is 'off' by default
    await waitFor(() => {
      expect(screen.getByLabelText('Nearby')).toBeInTheDocument();
    });
    const select = screen.getByLabelText('Nearby') as HTMLSelectElement;
    expect(select.value).toBe('off');
  });

  it('applies nearby filter upon manual selection', async () => {
    renderWithProviders(<Home />);

    const triggers = await screen.findAllByRole('button', { name: /Nearby|km$/ });
    const trigger = triggers.find((btn) => btn.getAttribute('aria-haspopup') === 'dialog');
    expect(trigger).toBeDefined();
    fireEvent.click(trigger!);

    // Verify it loads locations
    await waitFor(() => {
      expect(screen.getByLabelText('Nearby')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Nearby') as HTMLSelectElement;
    // Manually select loc-1
    fireEvent.change(select, { target: { value: 'loc-1' } });

    // Slider should pre-fill with 10 km (10000m)
    const slider = screen.getByLabelText('Radius') as HTMLInputElement;
    await waitFor(() => {
      expect(slider.value).toBe('10');
    });

    // Query variables should contain nearby filter condition with correct shape
    await waitFor(() => {
      const nearbyCondition = lastQueryVariables?.query?.conditions?.find(
        (c: any) => c.field === 'scheduleCoordinates'
      );
      expect(nearbyCondition).toBeDefined();
      expect(nearbyCondition?.value).toEqual({
        locationPreferenceId: 'loc-1',
        radiusKm: 10,
      });
    });
  });

  it('does not offer the saved-location nearby filter UI/query to anonymous users (AC7)', async () => {
    mockSession = null; // simulate anonymous

    renderWithProviders(<Home />);

    // Nearby filter should not be offered or rendered
    await waitFor(() => {
      expect(screen.queryByLabelText('Nearby')).not.toBeInTheDocument();
    });

    // Query should not contain scheduleCoordinates condition — resolvedFilter
    // (the server-side query condition) stays session-gated regardless of
    // Story 0.39's shared, app-wide ambient-location architecture below.
    const nearbyCondition = lastQueryVariables?.query?.conditions?.find(
      (c: any) => c.field === 'scheduleCoordinates'
    );
    expect(nearbyCondition).toBeUndefined();

    // Story 0.39 note: useViewerLocation() (and its ambient ask banner) is
    // intentionally app-wide, not session-gated — an anonymous visitor who
    // already granted geolocation permission on a prior visit can still see
    // a nearby badge. Only the saved-location filter UI/query stay
    // auth-gated, asserted above and via `isAuthenticated`/`isModerator`-style
    // gating elsewhere.
  });
});

describe('Masonry distance-badge wiring (Story 1.i1f AC5-9, Task 5.4)', () => {
  async function selectSavedLocationFilter() {
    const triggers = await screen.findAllByRole('button', { name: /Nearby|km$/ });
    const trigger = triggers.find((btn) => btn.getAttribute('aria-haspopup') === 'dialog');
    fireEvent.click(trigger!);

    await waitFor(() => {
      expect(screen.getByLabelText('Nearby')).toBeInTheDocument();
    });
    const select = screen.getByLabelText('Nearby') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'loc-1' } });

    await waitFor(() => {
      const nearbyCondition = lastQueryVariables?.query?.conditions?.find(
        (c: any) => c.field === 'scheduleCoordinates'
      );
      expect(nearbyCondition).toBeDefined();
    });
  }

  it('renders the badge for an event within 8km once a nearby filter is active', async () => {
    renderWithProviders(<Home />);

    await screen.findByText('Nearby Event 1');
    await selectSavedLocationFilter();

    // Re-query fresh: the query-key change triggers a refetch, which replaces
    // the list's DOM nodes — a `card` reference captured before the filter was
    // applied would go stale, so the title/card lookup happens after settling.
    await waitFor(() => {
      const title = screen.getByText('Nearby Event 1');
      const card = title.closest('button') as HTMLElement;
      // BUG-049: badge shows the real distance (0km -- same coords as loc-1), not a static word.
      expect(within(card).getByText('0.0 km')).toBeInTheDocument();
    });
  });

  it('does not render the badge for the same event when the filter is off', async () => {
    renderWithProviders(<Home />);

    const title = await screen.findByText('Nearby Event 1');
    const card = title.closest('button') as HTMLElement;

    expect(within(card).queryByText('Nearby')).not.toBeInTheDocument();
  });

  it('does not render the badge (and does not crash) for an event whose display schedule has no coordinates', async () => {
    renderWithProviders(<Home />);

    await screen.findByText('No Coordinates Event');
    await selectSavedLocationFilter();

    await waitFor(() => {
      const title = screen.getByText('No Coordinates Event');
      const card = title.closest('button') as HTMLElement;
      expect(within(card).queryByText('Nearby')).not.toBeInTheDocument();
    });
  });
});

describe('useNearbyFilter (AC10-11)', () => {
  it('off mode returns undefined activeFilterCoord', async () => {
    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoadingLocations).toBe(false);
    });

    await act(async () => {
      await result.current.onSelectLocation('off');
    });

    expect(result.current.activeFilterCoord).toBeUndefined();
    // FIND-045 — `off` reads the shared viewer coordinate, never this query.
    expect(result.current.isActiveFilterCoordPending).toBe(false);
  });

  it('saved-location mode returns that location coordinate', async () => {
    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoadingLocations).toBe(false);
      expect(result.current.savedLocations).toHaveLength(2);
    });

    await act(async () => {
      await result.current.onSelectLocation('loc-1');
    });

    expect(result.current.activeFilterCoord).toEqual({ latitude: -6.2, longitude: 106.8 });
    expect(result.current.isActiveFilterCoordPending).toBe(false);
  });

  it('current-location mode reads the shared coordinate via captureExplicit', async () => {
    mockCoordinate = { latitude: 1.23, longitude: 4.56 };

    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.onSelectLocation('current');
    });

    expect(mockCaptureExplicit).toHaveBeenCalledTimes(1);
    expect(result.current.activeFilterCoord).toEqual({ latitude: 1.23, longitude: 4.56 });
    // FIND-045 — `current` reads the shared viewer coordinate, never this query.
    expect(result.current.isActiveFilterCoordPending).toBe(false);
  });

  it('saved location with no coordinate returns undefined gracefully', async () => {
    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingLocations).toBe(false);
    });

    await act(async () => {
      await result.current.onSelectLocation('loc-no-coords');
    });

    expect(result.current.activeFilterCoord).toBeUndefined();
    // FIND-045 — the query has settled and this location genuinely has no coordinate:
    // "confirmed absent", which must NOT be reported as pending.
    expect(result.current.isActiveFilterCoordPending).toBe(false);
  });

  it('distinguishes an in-flight saved location from a confirmed-absent one (FIND-045)', async () => {
    // The transient window: a deep link to `?nearby=loc-1` hard-loading before
    // `getMyLocations` has returned, so the coordinate is genuinely not known yet.
    mockLocationsQueryResult = { data: undefined, isLoading: true };

    const { result, rerender } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.onSelectLocation('loc-1');
    });

    expect(result.current.activeFilterCoord).toBeUndefined();
    expect(result.current.isActiveFilterCoordPending).toBe(true);

    // Same selection once the query settles — the coordinate resolves and the flag clears.
    mockLocationsQueryResult = null;
    await act(async () => {
      rerender();
    });

    expect(result.current.isActiveFilterCoordPending).toBe(false);
    expect(result.current.activeFilterCoord).toEqual({ latitude: -6.2, longitude: 106.8 });
  });

  it('stays pending for a deep-linked saved location that resolves to no coordinate (FIND-045)', async () => {
    // Still in flight, and this id is not even in the (empty) loading payload yet — the
    // hook must not claim "confirmed absent" before the query has answered.
    mockLocationsQueryResult = { data: undefined, isLoading: true };

    const { result, rerender } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.onSelectLocation('loc-no-coords');
    });
    expect(result.current.isActiveFilterCoordPending).toBe(true);

    mockLocationsQueryResult = null;
    await act(async () => {
      rerender();
    });

    expect(result.current.activeFilterCoord).toBeUndefined();
    expect(result.current.isActiveFilterCoordPending).toBe(false);
  });
});

describe('Ambient current-location fallback (Story 0.39, wired into Story 1.i1f)', () => {
  it('off mode falls back to the shared viewer-location coordinate when one is already available', async () => {
    mockCoordinate = { latitude: 9.87, longitude: 6.54 };

    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.activeFilterCoord).toEqual({ latitude: 9.87, longitude: 6.54 });
    });
  });

  it('off mode stays undefined when no shared coordinate is available (the default)', async () => {
    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingLocations).toBe(false);
    });
    expect(result.current.activeFilterCoord).toBeUndefined();
  });

  it('an explicitly active filter (saved location) takes priority over the ambient fallback', async () => {
    mockCoordinate = { latitude: 9.87, longitude: 6.54 };

    const { result } = renderHook(() => useNearbyFilter(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isLoadingLocations).toBe(false);
    });

    await act(async () => {
      await result.current.onSelectLocation('loc-1');
    });

    expect(result.current.activeFilterCoord).toEqual({ latitude: -6.2, longitude: 106.8 });
  });

  it('renders the masonry badge from the ambient fallback with no filter selected', async () => {
    mockCoordinate = { latitude: -6.2, longitude: 106.8 };

    renderWithProviders(<Home />);

    await waitFor(() => {
      const title = screen.getByText('Nearby Event 1');
      const card = title.closest('button') as HTMLElement;
      // BUG-049: badge shows the real distance (0km -- same coords as loc-1), not a static word.
      expect(within(card).getByText('0.0 km')).toBeInTheDocument();
    });
  });
});
