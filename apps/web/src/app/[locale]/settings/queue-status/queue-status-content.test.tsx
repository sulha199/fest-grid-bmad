import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { QueueStatusContent } from './queue-status-content';
import { graphqlClient } from '@/lib/graphql-client';

const mockRouterPush = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  Link: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

let mockSession: any = { user: { id: 'user-1', email: 'user@test.dev' } };
let mockAuthLoading = false;
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: mockAuthLoading,
  }),
}));

vi.mock('@/lib/graphql-client', () => {
  return {
    graphqlClient: {
      request: vi.fn(),
    },
  };
});

// Mocked query results variables
let mockApiKeys: any[] = [];
let mockSubscriptions: any[] = [];
let forceError = false;

beforeEach(() => {
  mockApiKeys = [
    {
      id: 'key-1',
      provider: 'gemini',
      maskedKey: '••••5678',
      isValid: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ];
  mockSubscriptions = [
    {
      id: 'sub-1',
      accountId: 'acc-1',
      isNewlyAdded: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      pendingExtractionCount: 3,
      account: {
        id: 'acc-1',
        platform: 'instagram',
        displayName: 'Jakarta Festival Info',
        username: 'jkt_fest_info',
      },
    },
    {
      id: 'sub-2',
      accountId: 'acc-2',
      isNewlyAdded: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      pendingExtractionCount: 0,
      account: {
        id: 'acc-2',
        platform: 'instagram',
        displayName: 'Empty Queue Sub',
        username: 'empty_queue_sub',
      },
    },
  ];
  forceError = false;

  vi.mocked(graphqlClient.request).mockImplementation(async (arg1: any, arg2: any) => {
    if (forceError) {
      throw new Error('GraphQL Network Error');
    }
    let docStr = '';
    if (arg1 && typeof arg1 === 'object' && 'document' in arg1) {
      docStr = arg1.document.toString();
    } else {
      docStr = arg1 ? arg1.toString() : '';
    }

    if (docStr.includes('getMySubscriptions')) {
      return {
        mySubscriptions: mockSubscriptions,
      };
    }
    if (docStr.includes('GetMyApiKeys')) {
      return {
        myApiKeys: mockApiKeys,
      };
    }
    return {};
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
  mockAuthLoading = false;
});

function renderComponent() {
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
        <QueueStatusContent />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('QueueStatusContent integration', () => {
  it('redirects to login if unauthenticated', async () => {
    mockSession = null;
    renderComponent();
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders queue status details correctly on happy path', async () => {
    renderComponent();

    // Verify Title and Description
    await waitFor(() => {
      expect(screen.getByText('Queue Status')).toBeInTheDocument();
    });
    
    // Subscriptions Section
    expect(screen.getByText('Jakarta Festival Info')).toBeInTheDocument();
    expect(screen.getByText('@jkt_fest_info')).toBeInTheDocument();
    expect(screen.getByText('3 posts pending')).toBeInTheDocument();

    // Subscriptions with 0 count should also render (AC5)
    expect(screen.getByText('Empty Queue Sub')).toBeInTheDocument();
    expect(screen.getByText('0 posts pending')).toBeInTheDocument();

    // Keys Section
    expect(screen.getByText('gemini')).toBeInTheDocument();
    expect(screen.getByText('••••5678')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // No warning banner
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });

  it('renders warning banner with working link if an API key is Invalid (unhappy path)', async () => {
    // Set API key as invalid
    mockApiKeys[0].isValid = false;

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Invalid')).toBeInTheDocument();
      expect(
        screen.getByText('One or more of your API keys are invalid. Active subscriptions may not scrape correctly.')
      ).toBeInTheDocument();
    });

    const link = screen.getByText('Configure API Keys');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/settings/api-keys');
  });

  it('renders error state and handles retry button click', async () => {
    forceError = true;
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to load queue status. Please try again later.')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    expect(retryBtn).toBeInTheDocument();

    // Reset error and click retry
    forceError = false;
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Jakarta Festival Info')).toBeInTheDocument();
    });
  });
});
