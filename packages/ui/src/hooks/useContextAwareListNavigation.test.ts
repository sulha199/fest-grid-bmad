import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useContextAwareListNavigation } from './useContextAwareListNavigation';

interface TestItem {
  id: string;
}

describe('useContextAwareListNavigation', () => {
  const items: TestItem[] = [
    { id: '1' },
    { id: '2' },
    { id: '3' },
  ];

  it('handles the no-context case when currentId is null or not found', async () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() => useContextAwareListNavigation({
      items,
      currentId: null,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    expect(result.current.previous).toEqual({ target: null, disabled: true, loading: false });
    expect(result.current.next).toEqual({ target: null, disabled: true, loading: false });

    let nextTarget;
    await act(async () => {
      nextTarget = await result.current.requestNext();
    });
    expect(nextTarget).toBeNull();
    expect(fetchNextPage).not.toHaveBeenCalled();

    const { result: notFoundResult } = renderHook(() => useContextAwareListNavigation({
      items,
      currentId: 'not-exist',
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    expect(notFoundResult.current.next.disabled).toBe(true);
  });

  it('disables previous at index 0 and resolves next without fetch', async () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() => useContextAwareListNavigation({
      items,
      currentId: '1',
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    expect(result.current.previous).toEqual({ target: null, disabled: true, loading: false });
    expect(result.current.next).toEqual({ target: { id: '2', item: items[1] }, disabled: false, loading: false });

    let nextTarget;
    await act(async () => {
      nextTarget = await result.current.requestNext();
    });
    expect(nextTarget).toEqual({ id: '2', item: items[1] });
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('resolves mid-list previous and next without fetch', async () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() => useContextAwareListNavigation({
      items,
      currentId: '2',
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    expect(result.current.previous).toEqual({ target: { id: '1', item: items[0] }, disabled: false, loading: false });
    expect(result.current.next).toEqual({ target: { id: '3', item: items[2] }, disabled: false, loading: false });

    let nextTarget;
    await act(async () => {
      nextTarget = await result.current.requestNext();
    });
    expect(nextTarget).toEqual({ id: '3', item: items[2] });
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('short-circuits at boundary when hasNextPage is false', async () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() => useContextAwareListNavigation({
      items,
      currentId: '3',
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    expect(result.current.next).toEqual({ target: null, disabled: true, loading: false });

    let nextTarget;
    await act(async () => {
      nextTarget = await result.current.requestNext();
    });
    expect(nextTarget).toBeNull();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('triggers fetchNextPage exactly once at the boundary and resolves when items grow', async () => {
    let fetchResolver: () => void;
    const fetchPromise = new Promise<void>(resolve => { fetchResolver = resolve; });
    const fetchNextPage = vi.fn(() => fetchPromise);
    
    const { result, rerender } = renderHook(
      ({ currentItems }) => useContextAwareListNavigation({
        items: currentItems,
        currentId: '3',
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage,
      }),
      { initialProps: { currentItems: items } }
    );

    expect(result.current.next).toEqual({ target: null, disabled: false, loading: false });

    let requestPromise1: Promise<any>;
    let requestPromise2: Promise<any>;

    act(() => {
      requestPromise1 = result.current.requestNext();
      requestPromise2 = result.current.requestNext(); // Duplicate call
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.next.loading).toBe(true);
    expect(result.current.next.disabled).toBe(true);

    // Resolve the fetch promise
    await act(async () => {
      fetchResolver!();
    });

    // It should still be loading because items haven't grown yet
    expect(result.current.next.loading).toBe(true);

    // Now grow the items
    const newItems = [...items, { id: '4' }];
    rerender({ currentItems: newItems });

    const target1 = await requestPromise1!;
    const target2 = await requestPromise2!;

    expect(target1).toEqual({ id: '4', item: newItems[3] });
    expect(target2).toEqual({ id: '4', item: newItems[3] });
    
    // After resolution, next should point to 4 since we're still on currentId '3' but items have '4'
    expect(result.current.next).toEqual({ target: { id: '4', item: newItems[3] }, disabled: false, loading: false });
  });

  it('surfaces a rejected fetchNextPage via error and resolves null without retry', async () => {
    const errorObj = new Error('Network error');
    const fetchNextPage = vi.fn(() => Promise.reject(errorObj));

    const { result } = renderHook(() => useContextAwareListNavigation({
      items,
      currentId: '3',
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    let nextTarget;
    await act(async () => {
      nextTarget = await result.current.requestNext();
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(nextTarget).toBeNull();
    expect(result.current.error).toBe(errorObj);
    expect(result.current.next.loading).toBe(false);
  });

  it('resolves null if hasNextPage becomes false without items growing', async () => {
    let fetchResolver: () => void;
    const fetchPromise = new Promise<void>(resolve => { fetchResolver = resolve; });
    const fetchNextPage = vi.fn(() => fetchPromise);

    const { result, rerender } = renderHook(
      ({ currentItems, hasNext }) => useContextAwareListNavigation({
        items: currentItems,
        currentId: '3',
        hasNextPage: hasNext,
        isFetchingNextPage: false,
        fetchNextPage,
      }),
      { initialProps: { currentItems: items, hasNext: true } }
    );

    let requestPromise: Promise<any>;
    act(() => {
      requestPromise = result.current.requestNext();
    });

    // Resolve the fetch promise
    await act(async () => {
      fetchResolver!();
    });

    // Update hasNextPage to false, simulate no new items
    rerender({ currentItems: items, hasNext: false });

    const target = await requestPromise!;
    expect(target).toBeNull();
  });
});
