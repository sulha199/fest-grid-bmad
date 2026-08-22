import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { CalendarView } from './CalendarView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

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
  api.query('getEventsForCalendar', () => {
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
  });

  afterEach(() => {
    server.resetHandlers();
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

    const cards = screen.getAllByText('Weekly Jazz Jam');
    fireEvent.click(cards[0]);

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining('/events/weekly-jazz-jam?fromList=true&q=jazz&types=MUSIC')
    );
  });
});
