import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { SubscriptionsContent } from './subscriptions-content';
import { graphqlClient } from '@/lib/graphql-client';
import { Toaster } from 'sonner';

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
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

let mockHasApiKey = true;
vi.mock('@/features/onboarding/use-has-api-key', () => ({
  useHasApiKey: () => mockHasApiKey,
}));

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

const mockSubscriptions = [
  {
    id: 'sub-1',
    accountId: 'acc-1',
    isNewlyAdded: true,
    createdAt: '2026-08-01',
    account: {
      platform: 'instagram',
      displayName: 'Jakarta Festivals',
      username: 'jkt_festivals',
      profileImageUrl: null,
    },
  },
  {
    id: 'sub-2',
    accountId: 'acc-2',
    isNewlyAdded: false,
    createdAt: '2026-08-02',
    account: {
      platform: 'twitter',
      displayName: 'Jakarta Culinary',
      username: 'jkt_culinary',
      profileImageUrl: 'http://example.com/profile.png',
    },
  },
];

let removeCalls: { id: string; action: string }[] = [];

const server = setupServer(
  graphql.query('getMySubscriptions', () => {
    return HttpResponse.json({
      data: {
        mySubscriptions: mockSubscriptions,
      },
    });
  }),
  graphql.mutation('removeSubscription', ({ variables }) => {
    removeCalls.push({ id: variables.id, action: variables.action });
    return HttpResponse.json({
      data: {
        removeSubscription: { id: variables.id },
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  removeCalls = [];
});
afterAll(() => server.close());

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
        <Toaster />
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('SubscriptionsContent', () => {
  it('redirects unauthenticated users to /login', async () => {
    mockSession = null;
    renderWithProviders(<SubscriptionsContent />);
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('renders loading states and then displays subscriptions', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = true;
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(screen.getByText('Jakarta Festivals')).toBeInTheDocument();
      expect(screen.getByText('Jakarta Culinary')).toBeInTheDocument();
    });

    expect(screen.getByText('@jkt_festivals')).toBeInTheDocument();
    expect(screen.getByText('@jkt_culinary')).toBeInTheDocument();
  });

  it('renders no-API-key prompt when user does not have an API key', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = false;
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(screen.getByText(/must first add a Gemini API Key/)).toBeInTheDocument();
      expect(screen.getByText('Configure API Keys')).toBeInTheDocument();
    });
  });

  it('triggers soft delete immediately when clicking Delete button and RESTORE on Undo', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = true;
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(screen.getByText('Jakarta Festivals')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(removeCalls).toContainEqual({ id: 'sub-1', action: 'DELETE' });
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith('subscription_removed', {
      subscriptionId: 'sub-1',
    });

    const undoButton = await screen.findByText('Undo');
    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(removeCalls).toContainEqual({ id: 'sub-1', action: 'RESTORE' });
    });
  });
});
