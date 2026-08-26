import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { SubscribeAccountDialog } from './subscribe-account-dialog';
import { Toaster } from 'sonner';

const mockPosthogCapture = vi.fn();

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

let mutationVariables: any = null;
let mockResponseData = {
  subscribeToAccount: {
    subscription: {
      id: 'sub-new',
      accountId: 'test_account',
      isNewlyAdded: true,
      createdAt: '2026-08-01',
    },
    alreadySubscribed: false,
  },
};

const server = setupServer(
  graphql.mutation('SubscribeToAccount', ({ variables }) => {
    mutationVariables = variables;
    return HttpResponse.json({
      data: mockResponseData,
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  mutationVariables = null;
  mockResponseData = {
    subscribeToAccount: {
      subscription: {
        id: 'sub-new',
        accountId: 'test_account',
        isNewlyAdded: true,
        createdAt: '2026-08-01',
      },
      alreadySubscribed: false,
    },
  };
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

describe('SubscribeAccountDialog', () => {
  it('submits form successfully and calls close on success', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={handleClose} />);

    // Check modal title is rendered
    expect(screen.getByText('Subscribe to a Social Media Account')).toBeInTheDocument();

    // Fill in account handle
    const accountInput = screen.getByPlaceholderText('e.g., jkt_festivals');
    fireEvent.change(accountInput, { target: { value: 'jkt_festivals' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mutationVariables).toEqual({
        input: {
          platform: 'instagram',
          accountId: 'jkt_festivals',
          username: 'jkt_festivals',
          displayName: 'jkt_festivals',
        },
      });
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith('subscription_added', {
      platform: 'instagram',
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it('shows softer message when already subscribed', async () => {
    mockResponseData = {
      subscribeToAccount: {
        subscription: {
          id: 'sub-exist',
          accountId: 'test_account',
          isNewlyAdded: false,
          createdAt: '2026-08-01',
        },
        alreadySubscribed: true,
      },
    };

    const handleClose = vi.fn();
    renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={handleClose} />);

    const accountInput = screen.getByPlaceholderText('e.g., jkt_festivals');
    fireEvent.change(accountInput, { target: { value: 'jkt_festivals' } });

    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('You are already subscribed to this account.')).toBeInTheDocument();
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it('shows an explicit capacity message when the scraper quota is exhausted', async () => {
    server.use(
      graphql.mutation('SubscribeToAccount', () => HttpResponse.json({
        errors: [{
          message: 'Apify capacity exceeded',
          extensions: { code: 'SCRAPER_CAPACITY_EXCEEDED' },
        }],
      }))
    );

    const handleClose = vi.fn();
    renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={handleClose} />);

    const accountInput = screen.getByPlaceholderText('e.g., jkt_festivals');
    fireEvent.change(accountInput, { target: { value: 'jkt_festivals' } });

    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Apify usage is temporarily at capacity. New subscriptions are paused until the next cycle reset.')).toBeInTheDocument();
    });

    expect(handleClose).not.toHaveBeenCalled();
  });
});
