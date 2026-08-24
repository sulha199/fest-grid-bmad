import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { ModeratorItemsContent } from './moderator-items-content';
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

vi.mock('../../settings/subscriptions/set-default-location-dialog', () => ({
  SetDefaultLocationDialog: ({ accountId, isOpen, onClose, mode, initialLocation }: any) => (
    isOpen ? (
      <div data-testid="mock-set-default-location-dialog">
        <span>Edit Default Location</span>
        <span>Account: {accountId}</span>
        <span>Mode: {mode}</span>
        <span>Initial: {initialLocation?.placeName}</span>
        <button onClick={onClose}>Close Dialog</button>
      </div>
    ) : null
  ),
}));

let mockAuthStatus: 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized' = 'authorized';

vi.mock('@/features/auth/use-require-moderator', () => ({
  useRequireModerator: () => ({
    status: mockAuthStatus,
  }),
}));

const mockPosthogCapture = vi.fn();
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

vi.mock('@/lib/graphql-client', () => {
  return {
    graphqlClient: {
      request: vi.fn(),
    },
  };
});

let mockReportedEvents: any[] = [];
let mockPendingChanges: any[] = [];
let forceError = false;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  mockReportedEvents = [
    {
      id: 'report-1',
      eventId: 'event-1',
      reporterUserId: 'reporter-1',
      reason: 'cancelled',
      details: 'This event was cancelled',
      status: 'pending',
      createdAt: '2026-08-11T12:00:00.000Z',
      moderatorIgnored: false,
      event: {
        id: 'event-1',
        slug: 'test-event-1',
        eventName: 'Test Event 1',
        imageUrl: null,
        deletedAt: null,
      },
    },
  ];

  mockPendingChanges = [
    {
      id: 'change-1',
      accountId: 'account-1',
      status: 'PENDING_REVIEW',
      createdAt: '2026-08-11T13:00:00.000Z',
      account: {
        id: 'account-1',
        displayName: 'Test Account',
        platform: 'instagram',
        username: 'test_user',
        profileImageUrl: null,
      },
      previousLocation: {
        placeName: 'Jakarta, ID',
        formattedAddress: 'Jakarta, Indonesia',
        coordinates: { lat: -6.2, lng: 106.8 },
      },
      newLocation: {
        placeName: 'Monas, ID',
        formattedAddress: 'Monumen Nasional, Jakarta, Indonesia',
        coordinates: { lat: -6.17, lng: 106.82 },
      },
    },
  ];

  forceError = false;

  vi.mocked(graphqlClient.request).mockImplementation(async (...args: any[]): Promise<any> => {
    if (forceError) {
      throw new Error('GraphQL Error');
    }
    const arg1 = args[0];
    let docStr = '';
    if (arg1 && typeof arg1 === 'object' && 'document' in arg1) {
      docStr = arg1.document.toString();
    } else {
      docStr = arg1 ? arg1.toString() : '';
    }

    if (docStr.includes('getReportedEvents')) {
      return {
        reportedEvents: mockReportedEvents,
      };
    }
    if (docStr.includes('getPendingDefaultLocationChanges')) {
      return {
        pendingDefaultLocationChanges: mockPendingChanges,
      };
    }
    if (docStr.includes('resolveReportsForEvent')) {
      return {
        resolveReportsForEvent: [
          { id: 'report-1', status: 'dismissed' },
        ],
      };
    }
    if (docStr.includes('resolveDefaultLocationChange')) {
      return {
        resolveDefaultLocationChange: { id: 'change-1', status: 'ACCEPTED' },
      };
    }
    if (docStr.includes('deleteEventPermanently')) {
      return {
        deleteEventPermanently: true,
      };
    }
    if (docStr.includes('ignoreSubsequentReports')) {
      return {
        ignoreSubsequentReports: { id: 'report-1', moderatorIgnored: true },
      };
    }
    return {};
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockAuthStatus = 'authorized';
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
        <ModeratorItemsContent />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('ModeratorItemsContent integration', () => {
  it('renders loading RouteLoader when auth is loading', () => {
    mockAuthStatus = 'loading';
    renderComponent();
    // Verify fallback RouteLoader mock/markup
    expect(screen.queryByText('Moderator Items')).not.toBeInTheDocument();
  });

  it('renders moderator items correctly on happy path', async () => {
    renderComponent();

    // Verify Title
    await waitFor(() => {
      expect(screen.getByText('Moderator Items')).toBeInTheDocument();
    });

    // Verify sections
    expect(screen.getByText('Reported Events')).toBeInTheDocument();
    expect(screen.getByText('Pending Location Changes')).toBeInTheDocument();

    // Verify event details inside Reported Events
    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
    expect(screen.getByText(/This event was cancelled/)).toBeInTheDocument();
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);

    // Verify pending location changes details
    expect(screen.getByText('Test Account')).toBeInTheDocument();
    expect(screen.getByText('Jakarta, Indonesia')).toBeInTheDocument();
    expect(screen.getByText('Monumen Nasional, Jakarta, Indonesia')).toBeInTheDocument();

    // Verify analytics was triggered
    expect(mockPosthogCapture).toHaveBeenCalledWith('moderator_items_page_viewed', {
      pendingReportGroupCount: 1,
      pendingLocationChangeCount: 1,
    });
  });

  it('can resolve reports for an event (Mark Safe)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Mark Safe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mark Safe'));

    await waitFor(() => {
      const calls = vi.mocked(graphqlClient.request).mock.calls;
      const resolveCall = calls.find(call => {
        const obj = call[0] as any;
        return obj && obj.variables && obj.variables.eventId === 'event-1';
      });
      expect(resolveCall).toBeDefined();
    });
  });

  it('can accept location change', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Accept'));

    await waitFor(() => {
      const calls = vi.mocked(graphqlClient.request).mock.calls;
      const acceptCall = calls.find(call => {
        const obj = call[0] as any;
        return obj && obj.variables && obj.variables.id === 'change-1' && obj.variables.action === 'ACCEPT';
      });
      expect(acceptCall).toBeDefined();
    });
  });

  it('renders error state and retry works', async () => {
    forceError = true;
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to load moderator items. Please try again.')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    expect(retryBtn).toBeInTheDocument();

    forceError = false;
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Test Event 1')).toBeInTheDocument();
    });
  });

  it('renders AccountLocationField in place of static location and allows triggering edit', async () => {
    renderComponent();

    // Verify the edit button from AccountLocationField is rendered
    await waitFor(() => {
      expect(screen.getByLabelText(/Correct Test Account's location directly/i)).toBeInTheDocument();
    });

    // Clicking the edit button should set editingChangeId, which opens SetDefaultLocationDialog
    fireEvent.click(screen.getByLabelText(/Correct Test Account's location directly/i));

    // Verify that SetDefaultLocationDialog is rendered
    await waitFor(() => {
      expect(screen.getByText('Edit Default Location')).toBeInTheDocument();
      expect(screen.getByText('Account: account-1')).toBeInTheDocument();
      expect(screen.getByText('Mode: edit')).toBeInTheDocument();
    });
  });

  it('closes edit dialog if the pending change being edited is resolved', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/Correct Test Account's location directly/i)).toBeInTheDocument();
    });

    // Open edit dialog
    fireEvent.click(screen.getByLabelText(/Correct Test Account's location directly/i));
    await waitFor(() => {
      expect(screen.getByText('Edit Default Location')).toBeInTheDocument();
    });

    // Accept/resolve the location change
    fireEvent.click(screen.getByText('Accept'));

    // Mutual-exclusion guard should close the edit dialog
    await waitFor(() => {
      expect(screen.queryByText('Edit Default Location')).not.toBeInTheDocument();
    });
  });
});
