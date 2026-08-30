import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OnboardingApiKeyStep } from './onboarding-api-key-step';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => {},
    error: (msg: string) => mockToastError(msg),
  },
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

// Mock React Query cache updates
const mockSetQueriesData = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueriesData: mockSetQueriesData,
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

    const input = screen.getByPlaceholderText('apiKeyPlaceholder');
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
      expect(mockSetQueriesData).toHaveBeenCalledWith(
        { queryKey: ['GetMyApiKeys'] },
        expect.any(Function),
      );

      const [, updater] = mockSetQueriesData.mock.calls.at(-1)!;
      expect(updater(undefined)).toEqual({ myApiKeys: [{ id: 'new-key' }] });
      expect(updater({ myApiKeys: [{ id: 'existing-key' }] })).toEqual({
        myApiKeys: [{ id: 'new-key' }, { id: 'existing-key' }],
      });

      expect(mockCapture).toHaveBeenCalledWith('wizard_api_key_step_completed');
      expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
    });
  });

  it('shows real backend message on invalid-key rejection', async () => {
    const { ClientError } = await import('graphql-request');
    mockMutateAsync.mockRejectedValueOnce(
      new ClientError({ errors: [{ message: 'INVALID_API_KEY' }] } as any, { status: 400 } as any)
    );

    render(<OnboardingApiKeyStep />);

    const input = screen.getByPlaceholderText('apiKeyPlaceholder');
    fireEvent.change(input, { target: { value: 'GEMINI-TEST-KEY' } });
    const submitBtn = screen.getByText('apiKeySubmitLabel');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('INVALID_API_KEY');
    });
  });

  it('shows generic fallback toast for a non-GraphQL error', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network Error'));

    render(<OnboardingApiKeyStep />);

    const input = screen.getByPlaceholderText('apiKeyPlaceholder');
    fireEvent.change(input, { target: { value: 'GEMINI-TEST-KEY' } });
    const submitBtn = screen.getByText('apiKeySubmitLabel');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('apiKeyErrorToast');
    });
  });
});
