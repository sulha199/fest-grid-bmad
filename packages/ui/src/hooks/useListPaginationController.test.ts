import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useListPaginationController } from './useListPaginationController';
import type { UseListPaginationControllerOptions } from './useListPaginationController.types';

type FilterKey = { types: string[] };

describe('useListPaginationController', () => {
  const setup = (initialProps: UseListPaginationControllerOptions<FilterKey, number>) =>
    renderHook(
      (props: UseListPaginationControllerOptions<FilterKey, number>) => useListPaginationController(props),
      { initialProps }
    );

  it('advances via goToNextPage and reflects page 2 state', () => {
    const { result } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });

    expect(result.current.cursor).toBe(0);
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.hasPrevPage).toBe(false);

    act(() => {
      result.current.goToNextPage(20);
    });

    expect(result.current.cursor).toBe(20);
    expect(result.current.pageIndex).toBe(2);
    expect(result.current.hasPrevPage).toBe(true);
  });

  it('resets cursor/history/pageIndex and increments resetToken in the same render pass as a filterKey change', () => {
    const { result, rerender } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });

    act(() => {
      result.current.goToNextPage(20);
    });
    const resetTokenBefore = result.current.resetToken;
    expect(result.current.cursor).toBe(20);

    // rerender with a different filterKey — assert the RETURNED value from this render pass
    // directly reflects the reset, with no extra act()/effect flush required.
    rerender({ filterKey: { types: ['FESTIVAL'] }, initialCursor: 0 });

    expect(result.current.cursor).toBe(0);
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.hasPrevPage).toBe(false);
    expect(result.current.resetToken).toBe(resetTokenBefore + 1);
  });

  it('does not reset when a custom isEqual reports the filterKey as equal despite a new reference', () => {
    const isEqual = (a: FilterKey, b: FilterKey) => a.types.join(',') === b.types.join(',');
    const { result, rerender } = setup({
      filterKey: { types: ['MUSIC'] },
      initialCursor: 0,
      isEqual,
    });

    act(() => {
      result.current.goToNextPage(20);
    });
    const resetTokenBefore = result.current.resetToken;

    // New object reference, but isEqual says it's the same logical filter.
    rerender({ filterKey: { types: ['MUSIC'] }, initialCursor: 0, isEqual });

    expect(result.current.cursor).toBe(20);
    expect(result.current.pageIndex).toBe(2);
    expect(result.current.resetToken).toBe(resetTokenBefore);
  });

  it('reflects the reset on the same hook instance without requiring a remount', () => {
    const { result, rerender } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });
    const firstResultRef = result;

    act(() => {
      result.current.goToNextPage(20);
    });

    rerender({ filterKey: { types: ['FESTIVAL'] }, initialCursor: 0 });

    // Same `result` object across the whole test — renderHook was never re-invoked, only
    // rerender()'d, proving no DOM/hook remount was needed to observe the reset.
    expect(result).toBe(firstResultRef);
    expect(result.current.cursor).toBe(0);
  });

  it('reportPageMeta stores hasNextPage/totalCount, and both are cleared on a filter-change reset', () => {
    const { result, rerender } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });

    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.totalCount).toBeUndefined();

    act(() => {
      result.current.reportPageMeta({ hasNextPage: true, totalCount: 42 });
    });

    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalCount).toBe(42);

    rerender({ filterKey: { types: ['FESTIVAL'] }, initialCursor: 0 });

    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.totalCount).toBeUndefined();
  });

  it('goToPrevPage no-ops when already on page 1', () => {
    const { result } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });

    act(() => {
      result.current.goToPrevPage();
    });

    expect(result.current.cursor).toBe(0);
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.hasPrevPage).toBe(false);
  });

  it('goToPrevPage pops the history stack back to the previous cursor', () => {
    const { result } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });

    act(() => {
      result.current.goToNextPage(20);
    });
    act(() => {
      result.current.goToNextPage(40);
    });
    expect(result.current.cursor).toBe(40);
    expect(result.current.pageIndex).toBe(3);

    act(() => {
      result.current.goToPrevPage();
    });

    expect(result.current.cursor).toBe(20);
    expect(result.current.pageIndex).toBe(2);
    expect(result.current.hasPrevPage).toBe(true);
  });

  it('resetToFirstPage resets without requiring a filterKey change', () => {
    const { result } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0 });

    act(() => {
      result.current.goToNextPage(20);
    });
    const resetTokenBefore = result.current.resetToken;

    act(() => {
      result.current.resetToFirstPage();
    });

    expect(result.current.cursor).toBe(0);
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.resetToken).toBe(resetTokenBefore + 1);
  });

  it('fires onReset exactly once per actual filterKey change — not on mount, not on every render, not when isEqual reports equality', () => {
    const onReset = vi.fn();
    const { rerender } = setup({ filterKey: { types: ['MUSIC'] }, initialCursor: 0, onReset });

    expect(onReset).not.toHaveBeenCalled();

    // Re-render with the SAME filterKey value (new object, but JSON-equal) — default isEqual
    // treats this as unchanged, so no reset/onReset.
    rerender({ filterKey: { types: ['MUSIC'] }, initialCursor: 0, onReset });
    expect(onReset).not.toHaveBeenCalled();

    // Actual filterKey change.
    rerender({ filterKey: { types: ['FESTIVAL'] }, initialCursor: 0, onReset });
    expect(onReset).toHaveBeenCalledTimes(1);

    // No further change — no additional call.
    rerender({ filterKey: { types: ['FESTIVAL'] }, initialCursor: 0, onReset });
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
