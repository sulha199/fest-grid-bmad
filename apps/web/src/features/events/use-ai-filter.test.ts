import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIFilter } from './use-ai-filter';
import { renderHook, act } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

let mockHasApiKey = true;
let mockApiKeyLoading = false;
let mockMutationError: any = null;
let mockResolvedFilter: any = { types: ['FESTIVAL'], keyword: 'jazz' };
let mockCaveats: any = ['Some caveats'];
let lastSaveVariables: any = null;
let mockExpression: any = {
  op: 'OR',
  children: [
    { field: 'type', value: ['FESTIVAL'] },
    { field: 'type', value: ['CONCERT'] },
  ],
};

// Mock next-intl
const mockTranslate = Object.assign(
  (key: string) => key,
  { raw: (key: string) => key }
);

vi.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
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
            expression: mockExpression,
          },
        }, { prompt });
      }
    },
    isPending: false,
  }),
  useSaveAiEventFilterMutation: (client: any, options: any) => ({
    mutate: (variables: any) => {
      lastSaveVariables = variables;
      options?.onSuccess?.({
        saveAIEventFilter: {
          id: 'filter-saved-1',
          prompt: variables.prompt,
          resolvedFilter: variables.resolvedFilter,
        },
      });
    },
    isPending: false,
  }),
}));

describe('useAIFilter hook', () => {
  beforeEach(() => {
    mockHasApiKey = true;
    mockApiKeyLoading = false;
    mockMutationError = null;
    lastSaveVariables = null;
    mockResolvedFilter = { types: ['FESTIVAL'], keyword: 'jazz' };
    mockCaveats = ['Some caveats'];
    mockExpression = {
      op: 'OR',
      children: [
        { field: 'type', value: ['FESTIVAL'] },
        { field: 'type', value: ['CONCERT'] },
      ],
    };
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
    // Story 9.5: the summary now renders the resolved (possibly non-flat) expression -- assert
    // the locale "or" word actually appears, not just that some summary string exists.
    expect(result.current.filterHubProps.aiFilterSummary).toContain('or');
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

  // Story 9.4a (AC1) -- activeExpression stores the resolved `FilterNode` expression, not just
  // the lossy flat projection, and is cleared in lockstep with activeFilter at every clear site.
  it('stores the resolved expression as activeExpression after a non-flat mutation response', () => {
    mockResolvedFilter = {};
    mockExpression = {
      op: 'OR',
      children: [
        { field: 'type', value: ['FESTIVAL'] },
        { field: 'type', value: ['CONCERT'] },
      ],
    };
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz or blues');
    });

    expect(result.current.activeExpression).toEqual(mockExpression);
  });

  it('clears activeExpression (null) after onAIExpand()', () => {
    const { result, rerender } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });
    expect(result.current.activeExpression).toEqual(mockExpression);

    act(() => {
      result.current.filterHubProps.onAIExpand();
    });
    rerender();
    expect(result.current.activeExpression).toBeNull();
  });

  it('clears activeExpression (null) after onAIClear()', () => {
    const { result, rerender } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });
    expect(result.current.activeExpression).toEqual(mockExpression);

    act(() => {
      result.current.filterHubProps.onAIClear();
    });
    rerender();
    expect(result.current.activeExpression).toBeNull();
  });

  it('clears activeExpression (null) after a fresh onSubmit() following a prior one (re-prompt)', () => {
    const { result, rerender } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });
    expect(result.current.activeExpression).toEqual(mockExpression);

    act(() => {
      result.current.overlayProps.onRePrompt();
    });
    rerender();
    expect(result.current.activeExpression).toBeNull();
  });

  // Story 9.5 Task 8: handleSave must persist the expression, not the lossy flat projection --
  // saveAIEventFilter's resolver requires exactly one of resolvedFilter/expression.
  it('handleSave calls saveFilter with { prompt, expression } and not a resolvedFilter key', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz or blues');
    });

    act(() => {
      result.current.overlayProps.onSave();
    });

    expect(lastSaveVariables).not.toBeNull();
    expect(lastSaveVariables).toHaveProperty('prompt', 'jazz or blues');
    expect(lastSaveVariables).toHaveProperty('expression', mockExpression);
    expect(lastSaveVariables).not.toHaveProperty('resolvedFilter');
  });
});

