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

const mockCapturePostHogEvent = vi.fn();

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
  capturePostHogEvent: (...args: unknown[]) => mockCapturePostHogEvent(...args),
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

  // Story 10.3a (show the subscription cap refusal and the upgrade call to action)
  describe('subscription cap refusal', () => {
    const capRefusal = (extensions: Record<string, unknown> = { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 4, reservedCount: 1, cap: 5 }) =>
      graphql.mutation('SubscribeToAccount', () => HttpResponse.json({ errors: [{ message: 'Subscription limit reached (server English text)', extensions }] }));

    async function submit(handle = 'jkt_festivals') {
      fireEvent.change(screen.getByPlaceholderText('e.g., jkt_festivals'), { target: { value: handle } });
      fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    }

    it('shows the inline notice with the numbers instead of a toast, replaces Subscribe, keeps the field and Cancel, and stays open', async () => {
      server.use(capRefusal());
      const handleClose = vi.fn();
      renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={handleClose} />);
      await submit();

      const body = await screen.findByTestId('subscription-cap-body');
      expect(body).toHaveTextContent('You have 4 accounts added and 1 more being added. The limit is 5.');
      expect(screen.getByRole('button', { name: /Upgrade/ })).toBeEnabled();
      expect(screen.getByText('Coming soon')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
      expect(screen.getByPlaceholderText('e.g., jkt_festivals')).toHaveValue('jkt_festivals');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      // No generic failure toast, the server's own English text is never shown, and the dialog is not closed.
      expect(screen.queryByText('Failed to subscribe to the account. Please try again.')).toBeNull();
      expect(screen.queryByText(/server English text/)).toBeNull();
      expect(handleClose).not.toHaveBeenCalled();
      expect(mockPosthogCapture).not.toHaveBeenCalledWith('subscription_added', expect.anything());
      // No account id for a typed handle.
      expect(mockCapturePostHogEvent.mock.calls).toEqual([['subscription_cap_upgrade_cta_shown', { currentSubscriptionCount: 4, reservedCount: 1, cap: 5, surface: 'subscribe_dialog' }]]);
    });

    it('fires clicked on each Upgrade click and swaps the note, purchasing nothing', async () => {
      server.use(capRefusal());
      renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={vi.fn()} />);
      await submit();
      const upgrade = await screen.findByRole('button', { name: /Upgrade/ });
      fireEvent.click(upgrade);
      expect(await screen.findByText('Thanks for your interest. Paid plans are not available yet.')).toBeInTheDocument();
      fireEvent.click(upgrade);
      expect(mockCapturePostHogEvent.mock.calls.filter(([n]) => n === 'subscription_cap_upgrade_cta_clicked')).toHaveLength(2);
      expect(upgrade).toBeEnabled();
    });

    it('Enter in the handle field does not submit again while the refusal stands', async () => {
      let calls = 0;
      server.use(graphql.mutation('SubscribeToAccount', () => { calls += 1; return HttpResponse.json({ errors: [{ message: 'x', extensions: { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 5, reservedCount: 0, cap: 5 } }] }); }));
      renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={vi.fn()} />);
      await submit();
      await screen.findByTestId('subscription-cap-body');
      fireEvent.submit(screen.getByPlaceholderText('e.g., jkt_festivals').closest('form')!);
      expect(calls).toBe(1);
      // Enter is not silent: it takes the user to the notice.
      expect(screen.getByTestId('subscription-cap-title')).toHaveFocus();
    });

    it('editing the handle clears the refusal and brings the Subscribe button back, so the user can try again (the server re-checks)', async () => {
      server.use(capRefusal());
      renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={vi.fn()} />);
      await submit();
      await screen.findByTestId('subscription-cap-body');
      expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();

      fireEvent.change(screen.getByPlaceholderText('e.g., jkt_festivals'), { target: { value: 'another_account' } });
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();

      // The retry reaches the server again and is refused again: a new notice (a new showing).
      mockCapturePostHogEvent.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
      await screen.findByTestId('subscription-cap-body');
      expect(mockCapturePostHogEvent.mock.calls.filter(([n]) => n === 'subscription_cap_upgrade_cta_shown')).toHaveLength(1);
    });

    it('closing and reopening clears the notice and brings Subscribe back', async () => {
      server.use(capRefusal());
      const handleClose = vi.fn();
      const { rerender } = renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={handleClose} />);
      await submit();
      await screen.findByTestId('subscription-cap-body');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(handleClose).toHaveBeenCalled();
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <SubscribeAccountDialog isOpen={true} onClose={handleClose} />
          </NextIntlClientProvider>
        </QueryClientProvider>
      );
      expect(screen.queryByTestId('subscription-cap-body')).toBeNull();
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    });

    it('a refusal missing cap is a generic error: the toast, no notice, no event', async () => {
      server.use(capRefusal({ code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 5, reservedCount: 0 }));
      renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={vi.fn()} />);
      await submit();
      await waitFor(() => expect(screen.getByText('Failed to subscribe to the account. Please try again.')).toBeInTheDocument());
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
      expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
    });

    it('a network error shows the generic toast, no notice and no cap event', async () => {
      server.use(graphql.mutation('SubscribeToAccount', () => HttpResponse.error()));
      renderWithProviders(<SubscribeAccountDialog isOpen={true} onClose={vi.fn()} />);
      await submit();
      await waitFor(() => expect(screen.getByText('Failed to subscribe to the account. Please try again.')).toBeInTheDocument());
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
      expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
    });
  });
});
