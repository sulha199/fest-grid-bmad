import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ClientError } from 'graphql-request';
import { OnboardingSubscribeStep } from './onboarding-subscribe-step';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock @festgrid/ui
const mockSetStepCompleted = vi.fn();
vi.mock('@festgrid/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@festgrid/ui')>()),
  useWizardStep: () => ({
    setStepCompleted: mockSetStepCompleted,
  }),
  BlockingLoader: ({ active, label }: any) => active ? <div data-testid="blocking-loader">{label}</div> : null,
}));

// Mock @festgrid/analytics
const mockCapture = vi.fn();
const mockCapturePostHogEvent = vi.fn();
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockCapture,
  }),
  capturePostHogEvent: (...args: unknown[]) => mockCapturePostHogEvent(...args),
}));
vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));

// Mock React Query cache invalidation
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// Mock graphql queries/mutations
const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockSubscriptions: any[] = [];

vi.mock('@/generated/graphql', () => ({
  useSubscribeToAccountMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
  useGetMySubscriptionsQuery: () => ({
    data: { mySubscriptions: mockSubscriptions },
    isLoading: false,
  }),
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => mockToastError(...a), success: vi.fn(), info: vi.fn() } }));

describe('OnboardingSubscribeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockSubscriptions = [];
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('submits form successfully and marks step complete for a new subscription', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      subscribeToAccount: {
        subscription: { id: 'sub-1', isNewlyAdded: true },
        alreadySubscribed: false,
      },
    });

    render(<OnboardingSubscribeStep />);

    const select = screen.getByLabelText('platformLabel');
    fireEvent.change(select, { target: { value: 'instagram' } });

    const handleInput = screen.getByLabelText('accountLabel');
    fireEvent.change(handleInput, { target: { value: 'https://instagram.com/my_handle' } });

    const submitBtn = screen.getByText('subscribeSubmitLabel');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        input: {
          platform: 'instagram',
          accountId: 'my_handle',
          username: 'my_handle',
          displayName: 'my_handle',
        },
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['getMySubscriptions'] });
      expect(mockCapture).toHaveBeenCalledWith('wizard_subscribe_step_completed', { platform: 'instagram' });
      expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
    });
  });

  it('submits form successfully and marks step complete when already subscribed', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      subscribeToAccount: {
        subscription: { id: 'sub-1', isNewlyAdded: false },
        alreadySubscribed: true,
      },
    });

    render(<OnboardingSubscribeStep />);

    const handleInput = screen.getByLabelText('accountLabel');
    fireEvent.change(handleInput, { target: { value: '@my_handle' } });

    const submitBtn = screen.getByText('subscribeSubmitLabel');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        input: {
          platform: 'instagram',
          accountId: 'my_handle',
          username: 'my_handle',
          displayName: 'my_handle',
        },
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['getMySubscriptions'] });
      expect(mockCapture).toHaveBeenCalledWith('wizard_subscribe_step_completed', { platform: 'instagram' });
      expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
    });
  });

  it('shows the current subscriptions list and clears the form after a successful subscription', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      subscribeToAccount: {
        subscription: { id: 'sub-1', isNewlyAdded: true },
        alreadySubscribed: false,
      },
    });

    mockSubscriptions = [
      {
        id: 'existing-sub',
        accountId: 'acc-1',
        account: {
          id: 'acc-1',
          username: 'existing_handle',
          displayName: 'Existing Handle',
          platform: 'instagram',
        },
      },
    ];

    render(<OnboardingSubscribeStep />);
    expect(screen.getByText('Existing Handle')).toBeInTheDocument();

    const handleInput = screen.getByLabelText('accountLabel');
    fireEvent.change(handleInput, { target: { value: '@new_handle' } });
    fireEvent.click(screen.getByText('subscribeSubmitLabel'));

    await waitFor(() => {
      expect(screen.getByLabelText('accountLabel')).toHaveValue('');
      expect(screen.getByLabelText('platformLabel')).toHaveValue('instagram');
    });
  });

  // Story 10.3a (show the subscription cap refusal and the upgrade call to action)
  describe('subscription cap refusal', () => {
    const capError = (extensions: Record<string, unknown> = { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 3, reservedCount: 2, cap: 5 }) =>
      new ClientError({ status: 200, errors: [{ message: 'server English text', extensions }] } as never, { query: 'm' });

    const submitHandle = () => {
      fireEvent.change(screen.getByLabelText('accountLabel'), { target: { value: 'sixth_account' } });
      fireEvent.click(screen.getByText('subscribeSubmitLabel'));
    };

    it('shows the notice inline in place of the add button, never completes the step, and fires shown without an accountId', async () => {
      mockMutateAsync.mockRejectedValueOnce(capError());
      render(<OnboardingSubscribeStep />);
      submitHandle();

      const notice = await screen.findByTestId('subscription-cap-notice');
      expect(notice).toHaveAttribute('data-variant', 'inline');
      expect(notice).toHaveAttribute('data-active-count', '3');
      expect(notice).toHaveAttribute('data-reserved-count', '2');
      expect(screen.queryByText('subscribeSubmitLabel')).toBeNull();
      expect(screen.getByLabelText('accountLabel')).toHaveValue('sixth_account');
      // The wizard never pushes the user away (FR127): no link to settings; the step is not completed; no generic toast.
      expect(screen.queryByRole('link')).toBeNull();
      expect(mockSetStepCompleted).not.toHaveBeenCalledWith(true);
      expect(mockCapture).not.toHaveBeenCalledWith('wizard_subscribe_step_completed', expect.anything());
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockCapturePostHogEvent.mock.calls).toEqual([['subscription_cap_upgrade_cta_shown', { currentSubscriptionCount: 3, reservedCount: 2, cap: 5, surface: 'onboarding_wizard' }]]);
    });

    it('editing the handle or the platform clears the refusal and brings the add button back; Enter while it stands moves focus to the notice', async () => {
      mockMutateAsync.mockRejectedValue(capError());
      render(<OnboardingSubscribeStep />);
      submitHandle();
      await screen.findByTestId('subscription-cap-notice');

      fireEvent.submit(screen.getByLabelText('accountLabel').closest('form')!);
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('subscription-cap-title')).toHaveFocus();

      fireEvent.change(screen.getByLabelText('accountLabel'), { target: { value: 'seventh_account' } });
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
      expect(screen.getByText('subscribeSubmitLabel')).toBeInTheDocument();

      fireEvent.click(screen.getByText('subscribeSubmitLabel'));
      await screen.findByTestId('subscription-cap-notice');
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);

      fireEvent.change(screen.getByLabelText('platformLabel'), { target: { value: 'instagram' } });
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
    });

    it('a non-cap error keeps the generic toast and fires no cap event; so does a network error', async () => {
      mockMutateAsync.mockRejectedValueOnce(capError({ code: 'INTERNAL_SERVER_ERROR' }));
      render(<OnboardingSubscribeStep />);
      submitHandle();
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('subscribeErrorToast'));
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
      mockToastError.mockClear();
      mockMutateAsync.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      fireEvent.click(screen.getByText('subscribeSubmitLabel'));
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('subscribeErrorToast'));
      expect(screen.queryByTestId('subscription-cap-notice')).toBeNull();
      expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
    });
  });
});
