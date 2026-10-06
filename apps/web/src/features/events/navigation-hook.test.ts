import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useListNavigationForEvent } from './navigation-hook';

// Story 3.6x (AC5) -- new `'post'` branch on `useListNavigationForEvent`, a structural sibling of
// the pre-existing `'favorites'` branch (frozenFavoriteIds/favoriteIds URL param). Covers: context
// detected only when `fromList=post` AND `postEventIds` is non-empty; Next/Previous paginates
// correctly over the frozen ids; no interference with the existing `'favorites'`/generic-filter
// branches.

let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockRequest = vi.fn();
vi.mock('@/lib/graphql-client', () => ({
  graphqlClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

function makeEvents(ids: string[]) {
  return ids.map((id) => ({ id, eventName: `Event ${id}`, slug: id }));
}

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      NuqsTestingAdapter,
      null,
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
  };
}

describe('useListNavigationForEvent', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockRequest.mockReset();
  });

  it('has no list context when fromList=post but postEventIds is empty', async () => {
    mockSearchParams = new URLSearchParams('fromList=post');

    const { result } = renderHook(() => useListNavigationForEvent('evt_1', false), {
      wrapper: buildWrapper(),
    });

    expect(result.current.hasListContext).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('has no list context when postEventIds is present but fromList is not post', async () => {
    mockSearchParams = new URLSearchParams('postEventIds=evt_1,evt_2,evt_3');

    const { result } = renderHook(() => useListNavigationForEvent('evt_1', false), {
      wrapper: buildWrapper(),
    });

    expect(result.current.hasListContext).toBe(false);
  });

  it('detects post list context and resolves Next/Previous over the frozen postEventIds, batch-fetched via events(id in [...])', async () => {
    mockSearchParams = new URLSearchParams('fromList=post&postEventIds=evt_1,evt_2,evt_3');
    mockRequest.mockResolvedValue({
      events: { items: makeEvents(['evt_1', 'evt_2', 'evt_3']), hasMore: false, totalCount: 3 },
    });

    const { result } = renderHook(() => useListNavigationForEvent('evt_2', false), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => expect(result.current.hasListContext).toBe(true));

    expect(mockRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          operator: 'and',
          conditions: [{ field: 'id', operator: 'in', value: ['evt_1', 'evt_2', 'evt_3'] }],
        },
      })
    );

    expect(result.current.previous.target?.id).toBe('evt_1');
    expect(result.current.next.target?.id).toBe('evt_3');
  });

  it('reports no context when the current event id is not found in the frozen postEventIds list', async () => {
    mockSearchParams = new URLSearchParams('fromList=post&postEventIds=evt_1,evt_2,evt_3');
    mockRequest.mockResolvedValue({
      events: { items: makeEvents(['evt_1', 'evt_2', 'evt_3']), hasMore: false, totalCount: 3 },
    });

    const { result } = renderHook(() => useListNavigationForEvent('evt_unrelated', false), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
    await waitFor(() => expect(result.current.hasListContext).toBe(false));
  });

  it('does not interfere with the existing favorites branch -- favoriteIds context resolves independently of postEventIds', async () => {
    mockSearchParams = new URLSearchParams('fromList=favorites&favoriteIds=fav_1,fav_2');
    mockRequest.mockResolvedValue({
      events: { items: makeEvents(['fav_1', 'fav_2']), hasMore: false, totalCount: 2 },
    });

    const { result } = renderHook(() => useListNavigationForEvent('fav_1', false), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => expect(result.current.hasListContext).toBe(true));
    expect(result.current.next.target?.id).toBe('fav_2');

    // Only one batched-IN request fired -- the generic/favorites branches don't also fire.
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          operator: 'and',
          conditions: [{ field: 'id', operator: 'in', value: ['fav_1', 'fav_2'] }],
        },
      })
    );
  });

  it('does not interfere with the generic/deep-link branch -- no list context and no fetch without fromList or filter params, on a full-page load', async () => {
    mockSearchParams = new URLSearchParams();

    const { result } = renderHook(() => useListNavigationForEvent('evt_1', false), {
      wrapper: buildWrapper(),
    });

    expect(result.current.hasListContext).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
