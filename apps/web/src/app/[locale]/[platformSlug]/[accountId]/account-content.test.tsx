import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import AccountContent from './account-content';

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
  };
});

let mockEventsItems: any[] = [
  {
    id: 'evt-1',
    eventName: 'Account Event 1',
    slug: 'account-event-1',
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

let mockRequestSpy = vi.fn().mockImplementation(async (document: any, variables: any) => {
  return {
    events: {
      items: mockEventsItems,
      hasMore: false,
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
  cleanup();
  mockRouterPush.mockClear();
  mockPosthogCapture.mockClear();
  mockRequestSpy.mockClear();
  if ((global as any).__resetNuqsStore) {
    (global as any).__resetNuqsStore();
  }
});

const defaultProfile = {
  id: 'profile-1',
  accountId: '17841400000',
  platform: 'instagram',
  displayName: 'Test Account Profile',
  username: 'test_username',
  profileImageUrl: 'http://test.com/avatar.png',
  description: 'Welcome to our festival account profile!',
};

describe('AccountContent', () => {
  const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <QueryClientProvider client={queryClient}>
          {ui}
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  };

  it('renders account profile header information correctly', async () => {
    renderWithProviders(
      <AccountContent platformSlug="ig" accountId="17841400000" profile={defaultProfile} />
    );

    // Header displayName and description
    expect(screen.getByRole('heading', { level: 1, name: 'Test Account Profile' })).toBeInTheDocument();
    expect(screen.getByText('Welcome to our festival account profile!')).toBeInTheDocument();
    
    // Avatar image is rendered
    const img = screen.getByAltText('Test Account Profile');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://test.com/avatar.png');
  });

  it('displays the list of events sourced from the account', async () => {
    renderWithProviders(
      <AccountContent platformSlug="ig" accountId="17841400000" profile={defaultProfile} />
    );

    // Wait for infinite query to resolve and render the event card
    await waitFor(() => {
      expect(screen.getByText('Account Event 1')).toBeInTheDocument();
    });
  });
});
