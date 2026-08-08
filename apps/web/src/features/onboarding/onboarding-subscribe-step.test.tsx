import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OnboardingSubscribeStep } from './onboarding-subscribe-step';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock @festgrid/ui
const mockSetStepCompleted = vi.fn();
vi.mock('@festgrid/ui', () => ({
  useWizardStep: () => ({
    setStepCompleted: mockSetStepCompleted,
  }),
  BlockingLoader: ({ active, label }: any) => active ? <div data-testid="blocking-loader">{label}</div> : null,
}));

// Mock @festgrid/analytics
const mockCapture = vi.fn();
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockCapture,
  }),
}));

// Mock graphql queries/mutations
const mockMutateAsync = vi.fn();
let mockIsPending = false;

vi.mock('@/generated/graphql', () => ({
  useSubscribeToAccountMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
}));

describe('OnboardingSubscribeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
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
      expect(mockCapture).toHaveBeenCalledWith('wizard_subscribe_step_completed', { platform: 'instagram' });
      expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
    });
  });
});
