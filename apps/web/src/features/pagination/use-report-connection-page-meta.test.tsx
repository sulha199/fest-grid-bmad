import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListPaginationController } from '@festgrid/ui';
import { useReportConnectionPageMeta } from './use-report-connection-page-meta';

type Connection = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; totalCount?: number } | undefined;

function useHarness(props: { filter: string; connection: Connection }) {
  const pagination = useListPaginationController<{ filter: string }, string | undefined>({
    filterKey: { filter: props.filter },
    initialCursor: undefined,
  });
  useReportConnectionPageMeta(pagination, props.connection);
  return pagination;
}

const page = (hasNextPage: boolean, totalCount?: number): Connection => ({
  pageInfo: { hasNextPage, endCursor: hasNextPage ? 'c1' : null },
  totalCount,
});

describe('useReportConnectionPageMeta', () => {
  it('passes the fetched page\'s hasNextPage and totalCount to the controller', () => {
    const { result } = renderHook((props) => useHarness(props), { initialProps: { filter: 'a', connection: page(true, 93) } });
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalCount).toBe(93);
  });

  it('reports nothing while there is no page yet, so the controller keeps "unknown"', () => {
    const { result } = renderHook((props) => useHarness(props), { initialProps: { filter: 'a', connection: undefined as Connection } });
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.totalCount).toBeUndefined();
  });

  it('follows the page when it changes', () => {
    const { result, rerender } = renderHook((props) => useHarness(props), { initialProps: { filter: 'a', connection: page(true, 93) } });
    rerender({ filter: 'a', connection: page(false, 93) });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('re-reports after a filter change even when the new page reports the very same numbers', () => {
    const { result, rerender } = renderHook((props) => useHarness(props), { initialProps: { filter: 'a', connection: page(true, 93) } });
    expect(result.current.hasNextPage).toBe(true);

    // The filter changes while the new page is loading: the controller clears its meta.
    rerender({ filter: 'b', connection: undefined });
    expect(result.current.resetToken).toBe(1);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.totalCount).toBeUndefined();

    // The new page arrives and says exactly what the old one said. Without resetToken as a
    // dependency nothing would change and Next would stay disabled.
    rerender({ filter: 'b', connection: page(true, 93) });
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalCount).toBe(93);
  });

  it('re-reports when the filter changes and the new page is already cached', () => {
    const { result, rerender } = renderHook((props) => useHarness(props), { initialProps: { filter: 'a', connection: page(true, 93) } });
    rerender({ filter: 'b', connection: page(true, 93) });
    expect(result.current.resetToken).toBe(1);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalCount).toBe(93);
  });

  it('keeps working across next and previous', () => {
    const { result, rerender } = renderHook((props) => useHarness(props), { initialProps: { filter: 'a', connection: page(true, 93) } });
    act(() => result.current.goToNextPage('c1'));
    rerender({ filter: 'a', connection: page(false, 93) });
    expect(result.current.pageIndex).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPrevPage).toBe(true);
    act(() => result.current.goToPrevPage());
    rerender({ filter: 'a', connection: page(true, 93) });
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.hasNextPage).toBe(true);
  });
});
