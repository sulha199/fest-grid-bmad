import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Home from './page';
import enMessages from '../../../locales/en.json';

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

const mswServer = setupServer(
  graphql.query('getEvents', ({ variables }) => {
    if ((variables as any).offset === 0) {
      return HttpResponse.json({ data: mockEventsDataPage1 });
    }
    return HttpResponse.json({ data: mockEventsDataPage2 });
  })
);

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
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
  expect(screen.getByText('Music')).toBeInTheDocument();
  expect(screen.getByText('Festival')).toBeInTheDocument();
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
