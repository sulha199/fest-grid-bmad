"use client"

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  UseListPaginationControllerOptions,
  UseListPaginationControllerResult,
} from './useListPaginationController.types';

const defaultIsEqual = <T,>(a: T, b: T): boolean => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    // Non-serializable filterKey (e.g. contains a function/circular ref) — fall back to
    // reference equality rather than throwing.
    return a === b;
  }
};

interface ControllerState<TCursor> {
  cursor: TCursor;
  history: TCursor[];
  resetToken: number;
  hasNextPage: boolean;
  totalCount: number | undefined;
}

function makeResetState<TCursor>(initialCursor: TCursor, resetToken: number): ControllerState<TCursor> {
  return {
    cursor: initialCursor,
    history: [],
    resetToken,
    // hasNextPage/totalCount describe the OLD query's last-known page, not the new one, so they
    // are cleared back to their initial "unknown" state on every reset.
    hasNextPage: false,
    totalCount: undefined,
  };
}

/**
 * A reusable list-pagination/filter-reset controller: owns cursor state, a reset-on-filter-change
 * rule, and prev/next/total bookkeeping — so list views stop reinventing pagination and
 * filter-reset locally (see Architecture Spine AD-18).
 *
 * This hook deliberately does NOT compose `useInfiniteScroll` — its only job is cursor/history/
 * reset-token bookkeeping. A consumer opting into scroll-triggered fetching continues to call
 * `useInfiniteScroll` itself, passing it `fetchNextPage`/`hasNextPage`/`isFetchingNextPage` from
 * its own `useInfiniteQuery`.
 *
 * Required integration contract: feed `resetToken` (and/or `cursor`) into your react-query
 * `queryKey`. Because this hook never returns anything that would force you to change a list/
 * sentinel's React `key`, a correctly-integrated consumer's sentinel DOM node and its
 * `useInfiniteScroll` IntersectionObserver subscription stay mounted continuously across a
 * filter-driven reset — only the underlying `queryKey`/`cursor` value changes.
 *
 * @example
 * ```tsx
 * const pagination = useListPaginationController({
 *   filterKey: { types: filters.types, q: filters.q },
 *   initialCursor: 0,
 * });
 *
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
 *   queryKey: ['events', pagination.resetToken, pagination.cursor],
 *   queryFn: () => fetchEvents({ offset: pagination.cursor }),
 * });
 *
 * const { sentinelRef } = useInfiniteScroll({ fetchNextPage, hasNextPage, isFetchingNextPage });
 *
 * // DO NOT do this — forces a remount and defeats the no-DOM-churn guarantee above:
 * // <List key={pagination.resetToken}>...</List>
 * ```
 */
export function useListPaginationController<TFilterKey, TCursor>({
  filterKey,
  initialCursor,
  isEqual = defaultIsEqual,
  onReset,
}: UseListPaginationControllerOptions<TFilterKey, TCursor>): UseListPaginationControllerResult<TCursor> {
  const [state, setState] = useState<ControllerState<TCursor>>(() => makeResetState(initialCursor, 0));

  const prevFilterKeyRef = useRef(filterKey);
  const isFirstEffectRunRef = useRef(true);

  // Reset-on-filter-change, computed synchronously DURING render (not inside a useEffect), so a
  // re-render before any effect fires can never return a stale cursor paired with the new
  // filterKey. This is React's documented "adjusting state during render" pattern.
  let currentState = state;
  if (!isEqual(prevFilterKeyRef.current, filterKey)) {
    prevFilterKeyRef.current = filterKey;
    currentState = makeResetState(initialCursor, state.resetToken + 1);
    setState(currentState);
  }

  // Side effects (calling the consumer-supplied onReset callback) belong in an effect, not
  // render. Guarded against firing on initial mount — mounting isn't a "reset" event.
  useEffect(() => {
    if (isFirstEffectRunRef.current) {
      isFirstEffectRunRef.current = false;
      return;
    }
    onReset?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState.resetToken]);

  const goToNextPage = useCallback((nextCursor: TCursor) => {
    setState((prev) => ({
      ...prev,
      cursor: nextCursor,
      history: [...prev.history, prev.cursor],
    }));
  }, []);

  const goToPrevPage = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) {
        return prev;
      }
      const history = prev.history.slice(0, -1);
      const cursor = prev.history[prev.history.length - 1];
      return { ...prev, cursor, history };
    });
  }, []);

  const reportPageMeta = useCallback((meta: { hasNextPage: boolean; totalCount?: number }) => {
    setState((prev) => ({ ...prev, hasNextPage: meta.hasNextPage, totalCount: meta.totalCount }));
  }, []);

  const resetToFirstPage = useCallback(() => {
    setState((prev) => makeResetState(initialCursor, prev.resetToken + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCursor]);

  return {
    cursor: currentState.cursor,
    resetToken: currentState.resetToken,
    pageIndex: currentState.history.length + 1,
    goToNextPage,
    goToPrevPage,
    hasPrevPage: currentState.history.length > 0,
    hasNextPage: currentState.hasNextPage,
    totalCount: currentState.totalCount,
    reportPageMeta,
    resetToFirstPage,
  };
}
