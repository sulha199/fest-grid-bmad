import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
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

vi.mock('../../../../lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

import { SubscriptionsContent } from './subscriptions-content';

const mockSubscriptions = [
  {
    id: 'sub-1',
    accountId: 'acc-1',
    isNewlyAdded: true,
    createdAt: '2026-08-01',
    account: {
      id: 'acc-1',
      accountId: 'acc-1',
      platform: 'instagram',
      displayName: 'Jakarta Festivals',
      username: 'jkt_festivals',
      profileImageUrl: null,
      defaultLocation: null,
      hasPendingDefaultLocationReview: false,
    },
  },
  {
    id: 'sub-2',
    accountId: 'acc-2',
    isNewlyAdded: false,
    createdAt: '2026-08-02',
    account: {
      id: 'acc-2',
      accountId: 'acc-2',
      platform: 'twitter',
      displayName: 'Jakarta Culinary',
      username: 'jkt_culinary',
      profileImageUrl: 'http://example.com/profile.png',
      defaultLocation: {
        coordinates: { lat: -6.2, lng: 106.8 },
        formattedAddress: 'Jakarta, Indonesia',
        placeName: 'Jakarta Culinary Center',
      },
      hasPendingDefaultLocationReview: true,
    },
  },
];

let mockHasApiKey = true;
let mockApiKeyLoading = false;
let subscriptionsResponse: any[] = mockSubscriptions;
vi.mock('@/features/onboarding/use-has-api-key', () => ({
  useHasApiKey: () => mockHasApiKey,
  useApiKeyStatus: () => ({ hasApiKey: mockHasApiKey, isLoading: mockApiKeyLoading }),
}));

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

let removeCalls: { id: string; action: string }[] = [];

const handleRequest = async ({ request }: { request: any }) => {
  const { query, variables, operationName } = await request.json() as any;

  if (operationName === 'getMySubscriptions' || query?.includes('getMySubscriptions')) {
    return HttpResponse.json({
      data: {
        mySubscriptions: subscriptionsResponse,
      },
    });
  }

  if (operationName === 'removeSubscription' || query?.includes('removeSubscription')) {
    removeCalls.push({ id: variables.id, action: variables.action });
    return HttpResponse.json({
      data: {
        removeSubscription: { id: variables.id },
      },
    });
  }

  return new HttpResponse('Not found', { status: 404 });
};

const server = setupServer(
  http.post('http://localhost:4000/graphql', handleRequest),
  http.post('http://localhost:3000/api/graphql', handleRequest),
  http.post('/api/graphql', handleRequest)
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  mockApiKeyLoading = false;
  subscriptionsResponse = mockSubscriptions;
  removeCalls = [];
});
afterAll(() => {
  server.close();
});

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

  it('renders loading states and then displays subscriptions with default location states', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = true;
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(screen.getByText('Jakarta Festivals')).toBeInTheDocument();
      expect(screen.getByText('Jakarta Culinary')).toBeInTheDocument();
    });

    expect(screen.getByText('@jkt_festivals')).toBeInTheDocument();
    expect(screen.getByText('@jkt_culinary')).toBeInTheDocument();

    // Verify defaultLocation rendering states
    expect(screen.getByText('Set Default Location')).toBeInTheDocument(); // sub-1: absent
    expect(screen.getByText('Jakarta, Indonesia')).toBeInTheDocument(); // sub-2: present (read-only)
    
    // Verify edit Pencil action button is visible and Pending Review badge renders
    expect(screen.getByLabelText('Edit Default Location')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders no-API-key prompt when user does not have an API key', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = false;
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(screen.getByText(/must first add a Gemini API Key/)).toBeInTheDocument();
      expect(screen.getByText('Configure API Keys')).toBeInTheDocument();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  it('redirects to the onboarding wizard when there is no API key and no existing subscriptions', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = false;
    subscriptionsResponse = [];
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(
        `/wizard/onboarding/api-key?redirect=${encodeURIComponent('/settings/account')}`
      );
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

  it('navigates to the platform/accountId page when the subscription row is clicked, but not when buttons are clicked', async () => {
    mockSession = { user: { id: 'user-1' } };
    mockHasApiKey = true;
    renderWithProviders(<SubscriptionsContent />);

    await waitFor(() => {
      expect(screen.getByText('Jakarta Festivals')).toBeInTheDocument();
    });

    // Clicking the row text "Jakarta Festivals" should push to router
    const rowText = screen.getByText('Jakarta Festivals');
    fireEvent.click(rowText);
    expect(mockRouterPush).toHaveBeenCalledWith('/ig/acc-1');

    // Reset router push mock
    mockRouterPush.mockClear();

    // Clicking "Set Default Location" should open location modal and NOT trigger row navigation push
    const setLocationBtn = screen.getByText('Set Default Location');
    fireEvent.click(setLocationBtn);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
