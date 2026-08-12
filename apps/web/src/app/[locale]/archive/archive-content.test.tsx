import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { server } from '@festgrid/testing-config/vitest.setup';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../locales/en.json';
import { ArchiveContent } from './archive-content';
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

const archivedEventsCalls: any[] = [];

let mockForceEmpty = false;
let mockForceError = false;

beforeEach(() => {
  server.use(
    graphql.query('getArchivedEvents', ({ variables }) => {
      if (mockForceError) {
        return HttpResponse.json({
          errors: [{ message: 'GraphQL Query Failed' }],
        });
      }

      if (mockForceEmpty) {
        return HttpResponse.json({
          data: {
            events: {
              items: [],
              hasMore: false,
              totalCount: 0,
            },
          },
        });
      }

      archivedEventsCalls.push(variables);
      const limit = (variables as any)?.limit ?? 10;
      const offset = (variables as any)?.offset ?? 0;

      const allMockEvents = [
        {
          id: 'evt-1',
          slug: 'moderated-event',
          eventName: 'Moderated Event',
          imageUrl: null,
          location: 'Jakarta',
          categories: ['MUSIC'],
          types: ['FESTIVAL'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-30',
              ticketPrice: '100',
            },
          ],
          deletedAt: '2026-08-12T10:00:00Z',
          isHiddenForCurrentUser: false,
          isExpiredForCurrentUser: false,
        },
        {
          id: 'evt-2',
          slug: 'hidden-by-me-event',
          eventName: 'Hidden By Me Event',
          imageUrl: null,
          location: 'Bandung',
          categories: ['MUSIC'],
          types: ['FESTIVAL'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-30',
              ticketPrice: '100',
            },
          ],
          deletedAt: null,
          isHiddenForCurrentUser: true,
          isExpiredForCurrentUser: false,
        },
        {
          id: 'evt-3',
          slug: 'expired-event',
          eventName: 'Expired Event',
          imageUrl: null,
          location: 'Surabaya',
          categories: ['MUSIC'],
          types: ['FESTIVAL'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '1970-01-01',
              ticketPrice: '100',
            },
          ],
          deletedAt: null,
          isHiddenForCurrentUser: false,
          isExpiredForCurrentUser: true,
        },
      ];

      const sliced = allMockEvents.slice(offset, offset + limit);

      return HttpResponse.json({
        data: {
          events: {
            items: sliced,
            hasMore: offset + limit < allMockEvents.length,
            totalCount: allMockEvents.length,
          },
        },
      });
    })
  );
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  archivedEventsCalls.length = 0;
  mockRouterPush.mockReset();
  mockPosthogCapture.mockReset();
  mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
  mockAuthLoading = false;
  mockForceEmpty = false;
  mockForceError = false;
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
        <ArchiveContent />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('ArchiveContent', () => {
  it('redirects unauthenticated users to /login and does not fetch data', async () => {
    mockSession = null;

    renderWithProviders();

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

    expect(archivedEventsCalls).toHaveLength(0);
  });

  it('renders loading, error, empty, and success states correctly', async () => {
    // 1. Success state
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Moderated Event')).toBeInTheDocument();
    });

    expect(screen.getByText('Hidden By Me Event')).toBeInTheDocument();
    expect(screen.getByText('Expired Event')).toBeInTheDocument();

    // 2. Click navigates to the event's detail route
    const moderatedCard = screen.getByText('Moderated Event').closest('article');
    expect(moderatedCard).toBeInTheDocument();
    
    // Clicking card
    fireEvent.click(screen.getByText('Moderated Event'));
    expect(mockRouterPush).toHaveBeenCalledWith('/events/moderated-event');

    // 3. Status badges check
    expect(screen.getByText('Removed by Moderation')).toBeInTheDocument();
    expect(screen.getByText('Hidden by Me')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();

    // 4. Capture event on PostHog
    expect(mockPosthogCapture).toHaveBeenCalledWith('archive_page_viewed', {
      archivedCount: 3,
    });
  });

  it('renders empty state when there are no archived events', async () => {
    mockForceEmpty = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('You have no archived events.')).toBeInTheDocument();
    });
  });

  it('renders error state when graphql query fails', async () => {
    mockForceError = true;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Failed to load archived events. Please try again later.')).toBeInTheDocument();
    });
  });
});
