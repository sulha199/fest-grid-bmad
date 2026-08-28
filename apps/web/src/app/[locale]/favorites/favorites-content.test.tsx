import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SoftDeleteToaster } from '@festgrid/ui';
import enMessages from '../../../../locales/en.json';
import { FavoritesContent } from './favorites-content';
import { graphqlClient } from '@/lib/graphql-client';

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
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
    parseAsArrayOf: () => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
    parseAsStringLiteral: (allowed: any) => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
  };
});

vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
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

const snapshotCalls: any[] = [];
const eventsCalls: any[] = [];
let toggleFavoriteCalls = 0;

const FAVORITE_IDS = Array.from({ length: 11 }).map((_, i) => `evt-${i + 1}`);
const mockFavoritesSet = new Set<string>(FAVORITE_IDS);

const server = setupServer(
  graphql.query('getFavoritedEventIds', ({ variables }) => {
    snapshotCalls.push(variables);
    return HttpResponse.json({
      data: {
        events: {
          items: FAVORITE_IDS.map((id) => ({ id })),
          totalCount: FAVORITE_IDS.length,
        },
      },
    });
  }),
  graphql.query('getEvents', ({ variables }) => {
    eventsCalls.push(variables);
    const conditions = (variables as any)?.query?.conditions ?? [];
    const idCondition = conditions.find((c: any) => c?.field === 'id');
    const batchIds = (idCondition?.value ?? []) as string[];
    const items = [...batchIds].reverse().map((id) => ({
      id,
      eventName: `Event ${id}`,
      slug: `slug-${id}`,
      isFavorited: true,
      imageUrl: null,
      location: `Location ${id}`,
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      schedules: [
        {
          id: `${id}-schedule`,
          isMainSchedule: true,
          eventStartDate: new Date('2026-08-12T12:00:00Z').toISOString(),
          ticketPrice: '100',
        },
      ],
    }));

    return HttpResponse.json({
      data: {
        events: {
          items,
          hasMore: false,
          totalCount: items.length,
        },
      },
    });
  }),
  graphql.mutation('toggleFavorite', ({ variables }) => {
    toggleFavoriteCalls += 1;
    const eventId = String((variables as any).eventId);
    let isFavorited = false;
    if (mockFavoritesSet.has(eventId)) {
      mockFavoritesSet.delete(eventId);
      isFavorited = false;
    } else {
      mockFavoritesSet.add(eventId);
      isFavorited = true;
    }
    return HttpResponse.json({
      data: {
        toggleFavorite: {
          eventId,
          isFavorited,
        },
      },
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  server.resetHandlers();
  snapshotCalls.length = 0;
  eventsCalls.length = 0;
  toggleFavoriteCalls = 0;
  mockRouterPush.mockReset();
  mockPosthogCapture.mockReset();
  mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
  mockAuthLoading = false;
  mockFavoritesSet.clear();
  FAVORITE_IDS.forEach(id => mockFavoritesSet.add(id));
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
        <FavoritesContent />
        <SoftDeleteToaster />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('FavoritesContent', () => {
  it('redirects unauthenticated users to /login and does not fetch data', async () => {
    mockSession = null;

    renderWithProviders();

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

    expect(snapshotCalls).toHaveLength(0);
    expect(eventsCalls).toHaveLength(0);
  });

  it('fetches snapshot ids and paginates locally while preserving frozen id order', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event evt-1')).toBeInTheDocument();
    });

    expect(snapshotCalls.length).toBeGreaterThan(0);
    expect(eventsCalls.length).toBeGreaterThan(0);

    const firstBatchTitleNodes = screen.getAllByRole('heading', { level: 3 });
    expect(firstBatchTitleNodes[0]).toHaveTextContent('Event evt-1');

    (window as any).triggerScroll();

    await waitFor(() => {
      expect(screen.getByText('Event evt-11')).toBeInTheDocument();
    });

    expect(eventsCalls.length).toBeGreaterThan(1);
  });

  it('refetches a fresh snapshot when filters change', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(snapshotCalls.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Type' }));

    const festivalOption = await screen.findByRole('button', { name: 'Festival' });
    fireEvent.click(festivalOption);

    await waitFor(() => {
      expect(snapshotCalls.length).toBeGreaterThan(1);
    });

    const lastSnapshotQuery = snapshotCalls[snapshotCalls.length - 1]?.query;
    const hasTypesFilter = JSON.stringify(lastSnapshotQuery).includes('"field":"types"');
    expect(hasTypesFilter).toBe(true);
  });

  it('marks item pending, supports undo, and fires mutations immediately', async () => {
    const requestSpy = vi.spyOn(graphqlClient, 'request');
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event evt-1')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByRole('button', { name: 'Remove from Favorites' })[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
      const article = screen.getAllByRole('article').find((el) => el.getAttribute('aria-disabled') === 'true');
      expect(article).toBeTruthy();
    });

    // Under immediate mutation, clicking unfavorite fires mutation immediately (await async execution)
    await waitFor(() => {
      const toggleCalls = requestSpy.mock.calls.filter(([doc]) => 
        JSON.stringify(doc).includes('toggleFavorite')
      );
      expect(toggleCalls.length).toBe(1);
    });

    const undoButton = await screen.findByRole('button', { name: 'Undo' });
    fireEvent.click(undoButton);

    await waitFor(() => {
      const pendingArticles = screen.getAllByRole('article').filter((el) => el.getAttribute('aria-disabled') === 'true');
      expect(pendingArticles).toHaveLength(0);
    });

    // Clicking Undo fires another mutation to re-favorite immediately
    await waitFor(() => {
      const toggleCalls = requestSpy.mock.calls.filter(([doc]) => 
        JSON.stringify(doc).includes('toggleFavorite')
      );
      expect(toggleCalls.length).toBe(2);
    });
  });

  it('supports re-favoriting by clicking the heart button again, firing mutation immediately', async () => {
    const requestSpy = vi.spyOn(graphqlClient, 'request');
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event evt-1')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByRole('button', { name: 'Remove from Favorites' })[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
      const article = screen.getAllByRole('article').find((el) => el.getAttribute('aria-disabled') === 'true');
      expect(article).toBeTruthy();
    });

    await waitFor(() => {
      const toggleCalls = requestSpy.mock.calls.filter(([doc]) => 
        JSON.stringify(doc).includes('toggleFavorite')
      );
      expect(toggleCalls.length).toBe(1);
    });

    // Clicking the same toggle button (heart) again should trigger Undo/re-favorite
    fireEvent.click(removeButton);

    await waitFor(() => {
      const pendingArticles = screen.getAllByRole('article').filter((el) => el.getAttribute('aria-disabled') === 'true');
      expect(pendingArticles).toHaveLength(0);
    });

    await waitFor(() => {
      const toggleCalls = requestSpy.mock.calls.filter(([doc]) => 
        JSON.stringify(doc).includes('toggleFavorite')
      );
      expect(toggleCalls.length).toBe(2);
    });
  });

  it('does not fire additional mutations on unmount', async () => {
    const requestSpy = vi.spyOn(graphqlClient, 'request');
    const rendered = renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Event evt-1')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByRole('button', { name: 'Remove from Favorites' })[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
      const toggleCalls = requestSpy.mock.calls.filter(([doc]) => 
        JSON.stringify(doc).includes('toggleFavorite')
      );
      expect(toggleCalls.length).toBe(1);
    });

    rendered.unmount();

    // Ensure no additional unmount mutation calls were fired (since it was already committed)
    await new Promise((resolve) => setTimeout(resolve, 50));
    const toggleCalls = requestSpy.mock.calls.filter(([doc]) => 
      JSON.stringify(doc).includes('toggleFavorite')
    );
    expect(toggleCalls.length).toBe(1);
  });
});