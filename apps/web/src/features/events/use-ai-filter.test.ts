import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIFilter } from './use-ai-filter';
import { renderHook, act } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

let mockHasApiKey = true;
let mockApiKeyLoading = false;
let mockMutationError: any = null;
let mockResolvedFilter: any = { types: ['FESTIVAL'], keyword: 'jazz' };
let mockCaveats: any = ['Some caveats'];

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock auth-session
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'user-1' } },
  }),
}));

// Mock hook dependencies
vi.mock('@/features/onboarding/use-has-api-key', () => ({
  useApiKeyStatus: () => ({
    hasApiKey: mockHasApiKey,
    isLoading: mockApiKeyLoading,
  }),
}));

// Mock generated hooks
vi.mock('@/generated/graphql', () => ({
  useResolvePromptToEventFilterMutation: (client: any, options: any) => ({
    mutate: ({ prompt }: { prompt: string }) => {
      if (mockMutationError) {
        options?.onError?.(mockMutationError);
      } else {
        options?.onSuccess?.({
          resolvePromptToEventFilter: {
            resolvedFilter: mockResolvedFilter,
            caveats: mockCaveats,
          },
        });
      }
    },
    isPending: false,
  }),
}));

describe('useAIFilter hook', () => {
  beforeEach(() => {
    mockHasApiKey = true;
    mockApiKeyLoading = false;
    mockMutationError = null;
    mockResolvedFilter = { types: ['FESTIVAL'], keyword: 'jazz' };
    mockCaveats = ['Some caveats'];
  });

  it('correctly resolves key presence', () => {
    mockHasApiKey = true;
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });
    expect(result.current.hasApiKey).toBe(true);
  });

  it('keeps the AI filter active as a collapsed summary after resolving a prompt whose keyword differs from the (untouched, empty) manual search box', () => {
    mockResolvedFilter = { types: ['FESTIVAL'], keyword: 'jazz' };
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });

    expect(result.current.activeFilter).toEqual(mockResolvedFilter);
    expect(result.current.filterHubProps.aiFilterSummary).toBeDefined();
  });

  it('expands back to manual controls when the user edits the search box while an AI filter is active', () => {
    mockResolvedFilter = { types: ['FESTIVAL'], keyword: 'jazz' };
    const { result, rerender } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });
    expect(result.current.activeFilter).toEqual(mockResolvedFilter);

    act(() => {
      result.current.filterHubProps.onAIExpand();
    });
    rerender();
    expect(result.current.activeFilter).toBeNull();
  });
});

