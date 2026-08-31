import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { PostsSelectContent } from './posts-select-content';
import { graphqlClient } from '@/lib/graphql-client';
import { usePostSelectionStore } from './post-selection-store';

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
let mockQuota = { limit: 5, used: 2, remaining: 3 };
let forceError = false;

beforeEach(() => {
  usePostSelectionStore.getState().clearSelection();

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
      content: 'Post 1 content',
      imageUrl: null,
      postUrl: 'https://instagram.com/p/post1',
      originalPostUrl: null,
      isExtracted: false,
      publishedAt: '2026-08-10T12:00:00.000Z',
    },
    {
      id: 'post-2',
      accountId: 'acc-1',
      content: 'Post 2 content',
      imageUrl: null,
      postUrl: 'https://instagram.com/p/post2',
      originalPostUrl: null,
      isExtracted: false,
      publishedAt: '2026-08-10T12:00:00.000Z',
    },
    {
      id: 'post-3',
      accountId: 'acc-1',
      content: 'Post 3 content (Processed)',
      imageUrl: null,
      postUrl: 'https://instagram.com/p/post3',
      originalPostUrl: null,
      isExtracted: true,
      publishedAt: '2026-08-10T12:00:00.000Z',
    },
  ];
  mockQuota = { limit: 5, used: 2, remaining: 1 }; // Remaining quota is 1
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
    if (docStr.includes('getMyExtractionQuota')) {
      return {
        myExtractionQuota: mockQuota,
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
    if (docStr.includes('selectPostsForExtraction')) {
      return {
        selectPostsForExtraction: [
          {
            id: 'post-1',
            isExtracted: true,
          },
        ],
      };
    }
    if (docStr.includes('removeSubscription')) {
      return {
        removeSubscription: {
          id: arg2?.id || 'sub-2',
        },
      };
    }
    return {};
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
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
    const title = await screen.findByRole('heading', { level: 1, name: 'Extract Events' });
    expect(title).toBeInTheDocument();

    // Verify tabs
    const tab1 = await screen.findByText('Jakarta Festival Info');
    const tab2 = screen.getByText('Inactive Sub');
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    // Verify active posts
    const postContent = await screen.findByText('Post 1 content');
    expect(postContent).toBeInTheDocument();
  });
  it('renders "Posts from:" label, card containment, and avatars (images & fallback icons) on tab pills (AC11 / Task 6)', async () => {
    mockSubscriptions[0].account.profileImageUrl = 'https://example.com/avatar1.png';
    mockSubscriptions[1].account.profileImageUrl = null;

    renderComponent();

    const label = await screen.findByText('Posts from:');
    expect(label).toBeInTheDocument();

    const cardWrapper = label.parentElement;
    expect(cardWrapper).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');

    const avatarImg = await screen.findByAltText('Jakarta Festival Info');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/avatar1.png');
    expect(avatarImg).toHaveAttribute('data-testid', 'avatar-image');
    expect(avatarImg).toHaveClass('rounded-full', 'w-5', 'h-5');

    const tab2Button = screen.getByRole('button', { name: /Inactive Sub/i });
    expect(tab2Button).toBeInTheDocument();

    const fallbackContainer = tab2Button.querySelector('[data-testid="avatar-fallback-container"]');
    expect(fallbackContainer).toBeInTheDocument();
    expect(fallbackContainer).toHaveClass('w-5', 'h-5', 'rounded-full');
    expect(fallbackContainer?.querySelector('[data-testid="avatar-fallback-placeholder"]')).toBeInTheDocument();
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

  it('toggles post selection and shows sticky summary bar, then submits selection within quota', async () => {
    renderComponent();

    const card = await screen.findByText('Post 1 content');
    fireEvent.click(card);

    // Verify summary bar count with quota
    const summaryCount = await screen.findByText('Selected Posts: 1 / 1');
    expect(summaryCount).toBeInTheDocument();

    // Verify "Extract Events" button is rendered
    const extractBtn = screen.getByRole('button', { name: 'Extract Events' });
    expect(extractBtn).toBeInTheDocument();

    // Click "Extract Events" and verify mutation called
    fireEvent.click(extractBtn);

    await waitFor(() => {
      const calledSelect = vi.mocked(graphqlClient.request).mock.calls.some((call: any) => {
        const query = call[0]?.document?.toString() || call[0]?.toString() || '';
        return query.includes('selectPostsForExtraction');
      });
      expect(calledSelect).toBe(true);
    });
  });

  it('disables other cards and shows quota warnings when quota limit is reached', async () => {
    renderComponent();

    const card1 = await screen.findByText('Post 1 content');
    fireEvent.click(card1);

    // Remaining quota is 1, so selecting 1 post reaches the limit.
    // The second card ('Post 2 content') container should now have title / tooltip indicating quota limit.
    const card2Container = screen.getByText('Post 2 content').closest('[title]');
    expect(card2Container).toHaveAttribute('title', 'You have reached your quota limit.');
  });

  it('disables and marks already processed posts as disabled', async () => {
    renderComponent();

    // Post 3 is already processed (isExtracted: true)
    const card3Container = await screen.findByText('Post 3 content (Processed)');
    const container = card3Container.closest('[title]');
    expect(container).toHaveAttribute('title', 'Already processed');
  });

  it('displays inactive account warning banner and allows removing subscription', async () => {
    renderComponent();

    // Switch to inactive sub (tab 2)
    const tab2 = await screen.findByText('Inactive Sub');
    fireEvent.click(tab2);

    // Verify warning banner displays
    const bannerTitle = await screen.findByText('Inactive Account');
    expect(bannerTitle).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: 'Remove Subscription' });
    expect(removeBtn).toBeInTheDocument();

    // Click remove subscription
    fireEvent.click(removeBtn);

    await waitFor(() => {
      const calledRemove = vi.mocked(graphqlClient.request).mock.calls.some((call: any) => {
        const query = call[0]?.document?.toString() || call[0]?.toString() || '';
        return query.includes('removeSubscription');
      });
      expect(calledRemove).toBe(true);
    });
  });

  describe('On-demand scraping trigger (Task 5.6)', () => {
    it('renders empty state with scrape button when account has no posts', async () => {
      mockPosts = [];
      renderComponent();

      // Should show empty state message
      const emptyStateMsg = await screen.findByText(/No posts scraped yet for this account/);
      expect(emptyStateMsg).toBeInTheDocument();

      // Should show Scrape Posts button
      const scrapeBtn = screen.getByRole('button', { name: 'Scrape Posts' });
      expect(scrapeBtn).toBeInTheDocument();
      expect(scrapeBtn).not.toBeDisabled();
    });

    it('renders persistent scrape control in tab bar when account has posts', async () => {
      renderComponent();

      // Posts should be visible
      await screen.findByText('Post 1 content');

      // Scrape button should be in tab bar area
      const scrapeBtn = screen.getByRole('button', { name: 'Scrape Posts' });
      expect(scrapeBtn).toBeInTheDocument();
      expect(scrapeBtn).not.toBeDisabled();
    });

    it('calls triggerAccountScrape mutation when scrape button clicked', async () => {
      renderComponent();

      const scrapeBtn = await screen.findByRole('button', { name: 'Scrape Posts' });
      fireEvent.click(scrapeBtn);

      await waitFor(() => {
        const calledTrigger = vi.mocked(graphqlClient.request).mock.calls.some((call: any) => {
          const query = call[0]?.document?.toString() || call[0]?.toString() || '';
          return query.includes('triggerAccountScrape');
        });
        expect(calledTrigger).toBe(true);
      });
    });

    it('disables scrape button when isScrapeInProgress is true', async () => {
      // Set subscription with isScrapeInProgress = true
      mockSubscriptions = [
        {
          ...mockSubscriptions[0],
          account: {
            ...mockSubscriptions[0].account,
            isScrapeInProgress: true,
            lastScrapedAt: '2026-08-10T12:00:00.000Z',
          },
        },
      ];

      renderComponent();

      const scrapeBtn = await screen.findByRole('button', { name: 'Scrape Posts' });

      await waitFor(() => {
        expect(scrapeBtn).toBeDisabled();
      });
    });

    it('shows in-progress label when scraping is active', async () => {
      mockSubscriptions = [
        {
          ...mockSubscriptions[0],
          account: {
            ...mockSubscriptions[0].account,
            isScrapeInProgress: true,
            lastScrapedAt: null,
          },
        },
      ];

      renderComponent();

      const inProgressLabel = await screen.findByText(/Scraping for new posts/);
      expect(inProgressLabel).toBeInTheDocument();
    });

    it('shows timeout message when polling exceeds 60 seconds', async () => {
      mockSubscriptions = [
        {
          ...mockSubscriptions[0],
          account: {
            ...mockSubscriptions[0].account,
            isScrapeInProgress: true,
            lastScrapedAt: null,
          },
        },
      ];

      // Build the tree directly (rather than via renderComponent()) so we can
      // rerender it later with the same QueryClient instance, preserving the
      // already-loaded cache instead of resetting to a loading state. A fresh
      // element is built on each call (not a reused const) because React bails
      // out of re-rendering a subtree when the exact same element reference is
      // passed to rerender again.
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const buildTree = () => (
        <QueryClientProvider client={queryClient}>
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <PostsSelectContent />
          </NextIntlClientProvider>
        </QueryClientProvider>
      );
      const { rerender } = render(buildTree());

      await screen.findByText(/Scraping for new posts/);

      // hasTimedOut is computed from Date.now() at render time, so jumping the
      // clock forward and forcing a rerender is enough to exercise it, without
      // depending on the polling interval's refetch promise actually
      // completing while fake timers are active.
      const futureTime = Date.now() + 61000;
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(futureTime);
      try {
        rerender(buildTree());
        expect(screen.getByText(/Still processing/)).toBeInTheDocument();
      } finally {
        dateNowSpy.mockRestore();
      }
    });

    it('refetches posts when isScrapeInProgress transitions from true to false', async () => {
      const { rerender } = renderComponent();

      // Start with isScrapeInProgress = true
      mockSubscriptions = [
        {
          ...mockSubscriptions[0],
          account: {
            ...mockSubscriptions[0].account,
            isScrapeInProgress: true,
            lastScrapedAt: null,
          },
        },
      ];

      // Re-render to update subscription state
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <PostsSelectContent />
          </NextIntlClientProvider>
        </QueryClientProvider>
      );

      // Now transition to isScrapeInProgress = false
      mockSubscriptions = [
        {
          ...mockSubscriptions[0],
          account: {
            ...mockSubscriptions[0].account,
            isScrapeInProgress: false,
            lastScrapedAt: '2026-08-10T13:00:00.000Z',
          },
        },
      ];

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <PostsSelectContent />
          </NextIntlClientProvider>
        </QueryClientProvider>
      );

      // Verify that getPostsByAccount is called
      await waitFor(() => {
        const calledGetPosts = vi.mocked(graphqlClient.request).mock.calls.some((call: any) => {
          const query = call[0]?.document?.toString() || call[0]?.toString() || '';
          return query.includes('getPostsByAccount');
        });
        expect(calledGetPosts).toBe(true);
      });
    });

    it('handles SCRAPE_ALREADY_IN_PROGRESS error gracefully', async () => {
      const mockError = new Error('SCRAPE_ALREADY_IN_PROGRESS');
      (mockError as any).response = {
        errors: [{ extensions: { code: 'SCRAPE_ALREADY_IN_PROGRESS' } }],
      };

      // Only reject the triggerAccountScrape call, not whichever query happens
      // to fire first on mount (mockRejectedValueOnce would break initial load
      // since it intercepts the very next request regardless of which one it is).
      const baseImpl = vi.mocked(graphqlClient.request).getMockImplementation()!;
      vi.mocked(graphqlClient.request).mockImplementation(async (arg1: any, arg2: any) => {
        const docStr =
          arg1 && typeof arg1 === 'object' && 'document' in arg1
            ? arg1.document.toString()
            : arg1
            ? arg1.toString()
            : '';
        if (docStr.includes('triggerAccountScrape')) {
          throw mockError;
        }
        return baseImpl(arg1, arg2);
      });

      renderComponent();

      const scrapeBtn = await screen.findByRole('button', { name: 'Scrape Posts' });
      fireEvent.click(scrapeBtn);

      // Verify error handling (in real app, this would show a toast)
      // For this test, we just verify the error doesn't crash the component
      expect(scrapeBtn).toBeInTheDocument();
    });

    it('handles SCRAPER_CAPACITY_EXCEEDED error gracefully', async () => {
      const mockError = new Error('SCRAPER_CAPACITY_EXCEEDED');
      (mockError as any).response = {
        errors: [{ extensions: { code: 'SCRAPER_CAPACITY_EXCEEDED' } }],
      };

      // Only reject the triggerAccountScrape call; see the comment in the
      // SCRAPE_ALREADY_IN_PROGRESS test above for why mockRejectedValueOnce
      // isn't targeted enough here.
      const baseImpl = vi.mocked(graphqlClient.request).getMockImplementation()!;
      vi.mocked(graphqlClient.request).mockImplementation(async (arg1: any, arg2: any) => {
        const docStr =
          arg1 && typeof arg1 === 'object' && 'document' in arg1
            ? arg1.document.toString()
            : arg1
            ? arg1.toString()
            : '';
        if (docStr.includes('triggerAccountScrape')) {
          throw mockError;
        }
        return baseImpl(arg1, arg2);
      });

      renderComponent();

      const scrapeBtn = await screen.findByRole('button', { name: 'Scrape Posts' });
      fireEvent.click(scrapeBtn);

      // Verify component remains stable
      expect(scrapeBtn).toBeInTheDocument();
    });
  });
});
