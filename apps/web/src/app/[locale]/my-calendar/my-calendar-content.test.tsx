import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MyCalendarContent } from './my-calendar-content';
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

const mockSession = { user: { id: 'user-123' } };
let mockIsLoading = false;
let mockSessionValue: any = mockSession;

vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSessionValue,
    isLoading: mockIsLoading,
  }),
}));

const mockMyCalendarEvents = {
  events: {
    items: [
      {
        id: 'evt-fav',
        eventName: 'Fav Event',
        slug: 'fav-event',
        imageUrl: null,
        location: 'Space A',
        types: ['MUSIC'],
        categories: ['CONCERT'],
        isFavorited: true,
        schedules: [
          {
            id: 'sched-fav-1',
            isMainSchedule: true,
            eventStartDate: '2026-08-10',
            eventEndDate: '2026-08-10',
            eventStartTime: '19:00:00',
            eventEndTime: '22:00:00',
            ticketPrice: '20.00',
            isAddedToCalendar: false,
          },
        ],
      },
      {
        id: 'evt-added',
        eventName: 'Added Event',
        slug: 'added-event',
        imageUrl: null,
        location: 'Space B',
        types: ['MUSIC'],
        categories: ['CONCERT'],
        isFavorited: false,
        schedules: [
          {
            id: 'sched-added-1',
            isMainSchedule: true,
            eventStartDate: '2026-08-11',
            eventEndDate: '2026-08-11',
            eventStartTime: '19:00:00',
            eventEndTime: '22:00:00',
            ticketPrice: '20.00',
            isAddedToCalendar: true,
          },
        ],
      },
    ],
    hasMore: false,
    totalCount: 2,
  },
};

const api = graphql.link('*/api/graphql');

const server = setupServer(
  api.query('getEventsForMyCalendar', () => {
    return HttpResponse.json({
      data: mockMyCalendarEvents,
    });
  })
);

describe('MyCalendarContent', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // The component defaults its displayed week to "today". Freeze the clock
    // to a date inside the same Monday-Sunday week as the fixture events'
    // eventStartDate values (2026-08-10 and 2026-08-11, i.e. the week of
    // 2026-08-10 to 2026-08-16) so the fixtures actually fall within the
    // rendered week regardless of the real-world current date.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'));

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
    mockSessionValue = mockSession;
    mockIsLoading = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
  });

  it('redirects unauthenticated users to login', async () => {
    mockSessionValue = null;
    mockIsLoading = false;

    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <MyCalendarContent />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('renders loading, then renders checkboxed toggles and weekly calendar successfully', async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <MyCalendarContent />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    // Verify events render correctly on success
    await waitFor(() => {
      expect(screen.getAllByText('Fav Event')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Added Event')[0]).toBeInTheDocument();
    });

    // Checkboxes should exist
    const favToggle = container.querySelector('#toggle-favorited');
    const addedToggle = container.querySelector('#toggle-added');
    expect(favToggle).toBeInTheDocument();
    expect(addedToggle).toBeInTheDocument();
    expect(favToggle).toBeChecked();
    expect(addedToggle).toBeChecked();
  });

  it('filters out favorited or added-to-calendar schedules when toggles are checked off client-side', async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <MyCalendarContent />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Fav Event')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Added Event')[0]).toBeInTheDocument();
    });

    const favToggle = container.querySelector('#toggle-favorited')!;
    const addedToggle = container.querySelector('#toggle-added')!;

    // Toggle "Show favorited" off
    fireEvent.click(favToggle);
    expect(screen.queryByText('Fav Event')).not.toBeInTheDocument();
    expect(screen.getAllByText('Added Event')[0]).toBeInTheDocument();

    // Toggle "Show added to calendar" off
    fireEvent.click(addedToggle);
    expect(screen.queryByText('Fav Event')).not.toBeInTheDocument();
    expect(screen.queryByText('Added Event')).not.toBeInTheDocument();

    // Toggle "Show favorited" back on
    fireEvent.click(favToggle);
    expect(screen.getAllByText('Fav Event')[0]).toBeInTheDocument();
  });

  it('navigates weeks and captures analytics events', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <MyCalendarContent />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Fav Event')[0]).toBeInTheDocument();
    });

    // Navigation buttons
    const nextButton = screen.getAllByRole('button', { name: 'MyCalendarPage.calendarNextWeekLabel' })[0];
    fireEvent.click(nextButton);

    expect(mockPosthogCapture).toHaveBeenCalledWith('calendar_week_navigated', expect.objectContaining({
      direction: 'next',
    }));
  });

  it('navigates to event detail modal on schedule click preserving query string', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <MyCalendarContent />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Fav Event')[0]).toBeInTheDocument();
    });

    const cardButton = screen.getAllByText('Fav Event')[0].closest('button')!;
    fireEvent.click(cardButton);

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining('/events/fav-event?fromList=true&')
    );
  });
});
