import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OnboardingApiKeyStep } from './onboarding-api-key-step';

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
let mockMyApiKeys: any[] = [];
let mockIsLoading = false;
const mockMutateAsync = vi.fn();
let mockIsPending = false;

vi.mock('@/generated/graphql', () => ({
  useGetMyApiKeysQuery: () => ({
    data: { myApiKeys: mockMyApiKeys },
    isLoading: mockIsLoading,
  }),
  useCreateApiKeyMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
}));

describe('OnboardingApiKeyStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMyApiKeys = [];
    mockIsLoading = false;
    mockIsPending = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state', () => {
    mockIsLoading = true;
    render(<OnboardingApiKeyStep />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('marks step completed on mount if user already has an API key', () => {
    mockMyApiKeys = [{ id: 'key-1' }];
    render(<OnboardingApiKeyStep />);
    expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
    expect(screen.getByText('apiKeyAlreadyHaveOne')).toBeInTheDocument();
  });

  it('submits form successfully and marks step complete', async () => {
    mockMutateAsync.mockResolvedValueOnce({ createApiKey: { id: 'new-key' } });
    render(<OnboardingApiKeyStep />);

    const input = screen.getByPlaceholderOfId ? screen.getByPlaceholderOfId('apiKeyPlaceholder') : screen.getByPlaceholderText('apiKeyPlaceholder');
    fireEvent.change(input, { target: { value: 'GEMINI-TEST-KEY' } });

    const submitBtn = screen.getByText('apiKeySubmitLabel');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        input: {
          provider: 'gemini',
          key: 'GEMINI-TEST-KEY',
        },
      });
      expect(mockCapture).toHaveBeenCalledWith('wizard_api_key_step_completed');
      expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
    });
  });
});
