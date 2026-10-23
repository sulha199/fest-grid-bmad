import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIFilter } from './use-ai-filter';
import { renderHook, act } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { createElement, type ReactNode } from 'react';

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
    { field: 'type', value: ['PERFORMANCE'] },
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


// GraphQL serializes every declared `FilterNode` key on every node (absent ones as explicit
// `null`). The mocks above use clean trees, which is how the production crash
// (`Cannot read properties of null (reading 'map')`) shipped -- these mirror the REAL wire shape.
const paddedLeaf = (field: string, value: unknown) => ({ op: null, field, value, children: null, child: null });
const paddedGroup = (op: string, children: unknown[]) => ({ op, field: null, value: null, children, child: null });
const cleanBadmintonTree = {
  op: 'AND',
  children: [
    { field: 'type', value: ['COMPETITION'] },
    { field: 'keyword', value: 'badminton' },
  ],
};
const withSearchParams =
  (searchParams: Record<string, string>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(NuqsTestingAdapter, { searchParams, children });

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
        { field: 'type', value: ['PERFORMANCE'] },
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
    mockExpression = {
      op: 'AND',
      children: [
        { field: 'type', value: ['FESTIVAL'] },
        { field: 'keyword', value: 'jazz' },
      ],
    };
    const { result, rerender } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });
    expect(result.current.activeFilter).toEqual(mockResolvedFilter);

    act(() => {
      result.current.filterHubProps.onAIExpand?.();
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
        { field: 'type', value: ['PERFORMANCE'] },
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
    mockResolvedFilter = { types: ['FESTIVAL'], keyword: 'jazz' };
    mockExpression = {
      op: 'AND',
      children: [
        { field: 'type', value: ['FESTIVAL'] },
        { field: 'keyword', value: 'jazz' },
      ],
    };
    const { result, rerender } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('jazz festivals');
    });
    expect(result.current.activeExpression).toEqual(mockExpression);

    act(() => {
      result.current.filterHubProps.onAIExpand?.();
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

  // Story 9.6 (AC2): overlayProps.examplePrompts is a static 3-element array sourced via
  // tFilterHub (identity-return mock: t(key) => key), including the grouped-example key.
  it('exposes overlayProps.examplePrompts as a 3-element array including the grouped-example key', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    expect(result.current.overlayProps.examplePrompts).toEqual([
      'aiOverlayExamplePrompt1',
      'aiOverlayExamplePrompt2',
      'aiOverlayExamplePromptGrouped',
    ]);
  });

  // Story 9.6 (AC2): an over-limit-style resolve response's caveat text must reach
  // overlayProps.resolvedCaveats unchanged, end-to-end, through the existing summary pipeline.
  it('surfaces a resolved response caveat through overlayProps.resolvedCaveats unchanged', () => {
    mockCaveats = ['Your prompt described more conditions than the filter supports, so some were dropped.'];
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: NuqsTestingAdapter,
    });

    act(() => {
      result.current.overlayProps.onSubmit('an overly complex prompt');
    });

    expect(result.current.overlayProps.resolvedCaveats).toContain(
      'Your prompt described more conditions than the filter supports, so some were dropped.'
    );
  });
  it('strips GraphQL null padding from a resolved expression so the summary and query builders get the domain shape', () => {
    mockResolvedFilter = { types: ['COMPETITION'], keyword: 'badminton' };
    mockExpression = paddedGroup('AND', [paddedLeaf('type', ['COMPETITION']), paddedLeaf('keyword', 'badminton')]);
    const { result } = renderHook(() => useAIFilter(), { wrapper: NuqsTestingAdapter });

    act(() => {
      result.current.overlayProps.onSubmit('badminton competition');
    });

    expect(result.current.activeExpression).toEqual(cleanBadmintonTree);
    expect(typeof result.current.filterHubProps.aiFilterSummary).toBe('string');
    expect(result.current.overlayProps.resolvedSummary).toBeTruthy();

    act(() => {
      result.current.overlayProps.onSave();
    });
    expect(lastSaveVariables.expression).toEqual(cleanBadmintonTree);
  });

  it('reads a null-padded ai_expression from the URL (links shared before the fix) without crashing', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({
        ai_filter: JSON.stringify({ types: ['COMPETITION'], keyword: 'badminton' }),
        ai_caveats: '[]',
        ai_expression: JSON.stringify(
          paddedGroup('AND', [paddedLeaf('type', ['COMPETITION']), paddedLeaf('keyword', 'badminton')])
        ),
      }),
    });

    expect(result.current.activeExpression).toEqual(cleanBadmintonTree);
    expect(typeof result.current.filterHubProps.aiFilterSummary).toBe('string');
  });

  it.each([
    ['unparseable JSON', '{not json'],
    ['a non-node value', '"just a string"'],
    ['an out-of-vocabulary leaf', JSON.stringify({ field: 'price', value: 5 })],
  ])('treats an ai_expression URL param that is %s as no expression instead of throwing', (_label, raw) => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_filter: JSON.stringify({ keyword: 'jazz' }), ai_expression: raw }),
    });

    // Falls back to the flat ai_filter -- exposed as its equivalent expression so every page takes one
    // query path -- and the summary still renders.
    expect(result.current.activeExpression).toEqual({ op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] });
    expect(typeof result.current.filterHubProps.aiFilterSummary).toBe('string');
  });

  it('Epic 9 re-review: an empty root group is the valid "extracted nothing" state, not an invalid link', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_filter: '{}', ai_expression: JSON.stringify({ op: 'AND', children: [] }) }),
    });

    expect(result.current.activeExpression).toEqual({ op: 'AND', children: [] });
    expect(result.current.filterHubProps.aiCaveatsText ?? '').not.toContain('expressionInvalidCaveat');
  });

  it('Epic 9 re-review: shows the invalid-link caveat even when ai_filter is missing too', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_expression: JSON.stringify({ field: 'price', value: 5 }) }),
    });

    expect(result.current.filterHubProps.aiCaveatsText).toContain('expressionInvalidCaveat');
    expect(result.current.filterHubProps.onAIExpand).toBeUndefined();
  });

  it('Epic 9 re-review: ai_caveats that is valid JSON but not an array is ignored instead of crashing the render', () => {
    for (const raw of ['{}', '5', '"text"', 'null']) {
      const { result } = renderHook(() => useAIFilter(), {
        wrapper: withSearchParams({
          ai_filter: JSON.stringify({ keyword: 'jazz' }),
          ai_caveats: raw,
          ai_expression: JSON.stringify({ field: 'price', value: 5 }),
        }),
      });
      expect(result.current.filterHubProps.aiCaveatsText).toContain('expressionInvalidCaveat');
    }
  });

  it('Epic 9 re-review: only non-string entries are dropped from ai_caveats', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({
        ai_filter: JSON.stringify({ keyword: 'jazz' }),
        ai_caveats: JSON.stringify(['kept', 7, null]),
      }),
    });
    expect(result.current.filterHubProps.aiCaveatsText).toContain('kept');
  });

  // CAP-5: Expand only for what manual controls (keyword, types, categories) can represent.
  it('Epic 9 re-review: offers Expand for a keyword/types/categories filter but not once it also has a date, place or price', () => {
    const representable = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_filter: JSON.stringify({ keyword: 'jazz', types: ['FESTIVAL'] }) }),
    });
    expect(typeof representable.result.current.filterHubProps.onAIExpand).toBe('function');

    for (const extra of [
      { isFree: true },
      { location: { adminArea: 'Sleman' } },
      { dayOfWeek: ['SAT'] },
      { dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } },
      { accountId: 'acc-1' },
      { temporalFilter: 'TODAY' },
    ]) {
      const rich = renderHook(() => useAIFilter(), {
        wrapper: withSearchParams({ ai_filter: JSON.stringify({ keyword: 'jazz', ...extra }) }),
      });
      expect(rich.result.current.filterHubProps.onAIExpand, JSON.stringify(extra)).toBeUndefined();
    }
  });

  it('Epic 9 re-review: a flat filter is exposed as its equivalent expression, so search and the toggle AND onto it', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_filter: JSON.stringify({ isFree: true }) }),
    });

    expect(result.current.activeFilter).toEqual({ isFree: true });
    expect(result.current.activeExpression).toEqual({ op: 'AND', children: [{ field: 'isFree', value: true }] });
  });

  it('Epic 9 re-review: no AI params at all means no active expression', () => {
    const { result } = renderHook(() => useAIFilter(), { wrapper: NuqsTestingAdapter });
    expect(result.current.activeExpression).toBeNull();
  });

  // Epic 9 review D2: "Edit / Expand" only exists where manual controls can represent the filter.
  it('D2: offers no Expand for a compound (OR) filter, which manual controls cannot represent', () => {
    mockResolvedFilter = {};
    const { result } = renderHook(() => useAIFilter(), { wrapper: NuqsTestingAdapter });

    act(() => {
      result.current.overlayProps.onSubmit('festivals or concerts');
    });

    expect(result.current.activeExpression).toEqual(mockExpression);
    expect(result.current.filterHubProps.onAIExpand).toBeUndefined();
    // Clear still works.
    expect(typeof result.current.filterHubProps.onAIClear).toBe('function');
  });

  it('D2: derives Expand from a flat-representable ai_expression even when ai_filter is missing from the URL', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_expression: JSON.stringify(cleanBadmintonTree) }),
    });

    expect(typeof result.current.filterHubProps.onAIExpand).toBe('function');
    expect(typeof result.current.filterHubProps.aiFilterSummary).toBe('string');
  });

  it('D2: an ai_filter of "null" in the URL (older saved-filter links) does not break the summary or the expression', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({ ai_filter: 'null', ai_expression: JSON.stringify(cleanBadmintonTree) }),
    });

    expect(result.current.activeFilter).toBeNull();
    expect(result.current.activeExpression).toEqual(cleanBadmintonTree);
    expect(typeof result.current.filterHubProps.aiFilterSummary).toBe('string');
  });

  it('P20: says so when a shared ai_expression is invalid and the flat fallback is shown instead', () => {
    const { result } = renderHook(() => useAIFilter(), {
      wrapper: withSearchParams({
        ai_filter: JSON.stringify({ keyword: 'jazz' }),
        ai_expression: JSON.stringify({ field: 'price', value: 5 }),
      }),
    });

    expect(result.current.activeExpression).toEqual({ op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] });
    expect(result.current.filterHubProps.aiCaveatsText).toContain('expressionInvalidCaveat');
    // The fallback is only an approximation of the shared filter: Expand would wipe it.
    expect(result.current.filterHubProps.onAIExpand).toBeUndefined();
  });

  it('P6: a resolved filter with no flat form writes {} (not the string "null") as the ai_filter marker', () => {
    mockResolvedFilter = null;
    const { result } = renderHook(() => useAIFilter(), { wrapper: NuqsTestingAdapter });

    act(() => {
      result.current.overlayProps.onSubmit('festivals or concerts');
    });

    expect(result.current.activeFilter).toEqual({});
  });

  it('P16: cannot save a resolved filter that has no conditions', () => {
    mockResolvedFilter = {};
    mockExpression = { op: 'AND', children: [] };
    const { result } = renderHook(() => useAIFilter(), { wrapper: NuqsTestingAdapter });

    act(() => {
      result.current.overlayProps.onSubmit('something unmappable');
    });
    expect(result.current.overlayProps.canSave).toBe(false);

    mockExpression = { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] };
    act(() => {
      result.current.overlayProps.onSubmit('jazz');
    });
    expect(result.current.overlayProps.canSave).toBe(true);
  });
});
