import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { PostsSelectContent } from './posts-select-content';
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
let mockPosts: any[] = [];
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
      isInactive: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      pendingExtractionCount: 0,
      account: {
        id: 'acc-1',
        platform: 'instagram',
        displayName: 'Jakarta Festival Info',
        username: 'jkt_fest_info',
        profileImageUrl: null,
        defaultLocation: null,
        hasPendingDefaultLocationReview: false,
      },
    },
    {
      id: 'sub-2',
      accountId: 'acc-2',
      isNewlyAdded: false,
      isInactive: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      pendingExtractionCount: 0,
      account: {
        id: 'acc-2',
        platform: 'instagram',
        displayName: 'Inactive Sub',
        username: 'inactive_sub',
        profileImageUrl: null,
        defaultLocation: null,
        hasPendingDefaultLocationReview: false,
      },
    },
  ];
  mockPosts = [
    {
      id: 'post-1',
      accountId: 'acc-1',
      content: 'This is a sample post about a music festival',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
      postUrl: 'https://instagram.com/p/post1',
      originalPostUrl: null,
      isExtracted: false,
      publishedAt: '2026-08-10T12:00:00.000Z',
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
    if (docStr.includes('getPostsByAccount')) {
      return {
        postsByAccount: {
          items: mockPosts,
          nextCursor: null,
          hasMore: false,
        },
      };
    }
    if (docStr.includes('markSubscriptionViewed')) {
      return {
        markSubscriptionViewed: {
          id: arg2?.subscriptionId || 'sub-1',
          isNewlyAdded: false,
        },
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
        <PostsSelectContent />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('PostsSelectContent integration', () => {
  it('redirects to login if unauthenticated', async () => {
    mockSession = null;
    renderComponent();
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to wizard onboarding api-key if keys are missing', async () => {
    mockApiKeys = [];
    renderComponent();
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(
        `/wizard/onboarding/api-key?redirect=${encodeURIComponent('/posts/select')}`
      );
    });
  });

  it('redirects to wizard onboarding subscribe if subscriptions are missing', async () => {
    mockSubscriptions = [];
    renderComponent();
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(
        `/wizard/onboarding/subscribe?redirect=${encodeURIComponent('/posts/select')}`
      );
    });
  });

  it('renders tabs list and active account posts correctly', async () => {
    renderComponent();

    // Verify page title
    const title = await screen.findByText('Extract Events');
    expect(title).toBeInTheDocument();

    // Verify tabs
    const tab1 = await screen.findByText('Jakarta Festival Info');
    const tab2 = screen.getByText('Inactive Sub');
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    // Verify active posts
    const postContent = await screen.findByText('This is a sample post about a music festival');
    expect(postContent).toBeInTheDocument();
  });

  it('handles tab click to switch active account', async () => {
    renderComponent();

    const tab2 = await screen.findByText('Inactive Sub');
    fireEvent.click(tab2);

    await waitFor(() => {
      expect(graphqlClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ accountId: 'acc-2' })
        })
      );
    });
  });

  it('automatically triggers markSubscriptionViewed mutation for newly added tabs', async () => {
    mockSubscriptions = [
      {
        ...mockSubscriptions[0],
        isNewlyAdded: true,
      },
    ];

    renderComponent();

    await waitFor(() => {
      // Find markSubscriptionViewed in mock request calls
      const calledMarkViewed = vi.mocked(graphqlClient.request).mock.calls.some((call: any) => {
        const query = call[0]?.document?.toString() || call[0]?.toString() || '';
        return query.includes('markSubscriptionViewed');
      });
      expect(calledMarkViewed).toBe(true);
    });
  });
});
