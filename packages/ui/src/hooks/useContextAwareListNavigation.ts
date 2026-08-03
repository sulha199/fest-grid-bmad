"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  UseContextAwareListNavigationOptions,
  UseContextAwareListNavigationResult,
  ListNavigationTarget,
  ListNavigationDirectionState
} from './useContextAwareListNavigation.types';

/**
 * A headless hook that resolves "Next"/"Previous" targets from a list's currently-loaded items
 * and triggers background pagination when the boundary of the currently loaded page is reached.
 *
 * @param options - Configuration options for the hook.
 * @returns An object containing the navigation state and methods.
 *
 * @example
 * ```tsx
 * const { fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(...);
 * const { previous, next, requestNext, error } = useContextAwareListNavigation({
 *   items,
 *   currentId,
 *   hasNextPage,
 *   isFetchingNextPage,
 *   fetchNextPage,
 * });
 * 
 * return (
 *   <div>
 *     <button disabled={previous.disabled} onClick={() => navigateTo(previous.target?.id)}>
 *       Previous
 *     </button>
 *     <button disabled={next.disabled} onClick={() => requestNext().then(target => navigateTo(target?.id))}>
 *       {next.loading ? "Loading..." : "Next"}
 *     </button>
 *     {error && <div>Failed to load next page.</div>}
 *   </div>
 * );
 * ```
 */
export function useContextAwareListNavigation<TItem extends { id: string }>({
  items,
  currentId,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: UseContextAwareListNavigationOptions<TItem>): UseContextAwareListNavigationResult<TItem> {
  const [error, setError] = useState<unknown | null>(null);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  // Keep references to avoid stale closures
  const itemsRef = useRef(items);
  const fetchNextPageRef = useRef(fetchNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  const isRequestingRef = useRef(isRequesting);

  useEffect(() => {
    itemsRef.current = items;
    fetchNextPageRef.current = fetchNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
    isRequestingRef.current = isRequesting;
  }, [items, fetchNextPage, isFetchingNextPage, isRequesting]);

  const currentIndex = currentId == null ? -1 : items.findIndex(item => item.id === currentId);

  // Pending request tracking
  const pendingResolverRef = useRef<((target: ListNavigationTarget<TItem> | null) => void) | null>(null);
  const expectedNextIndexRef = useRef<number | null>(null);

  // Cleanup pending promise if component unmounts
  useEffect(() => {
    return () => {
      if (pendingResolverRef.current) {
        pendingResolverRef.current(null);
        pendingResolverRef.current = null;
      }
    };
  }, []);

  // Watch for items or state changes to resolve pending request
  useEffect(() => {
    if (pendingResolverRef.current && expectedNextIndexRef.current !== null) {
      // Ensure the list is contiguous and our current ID is still where we expect it
      if (items[expectedNextIndexRef.current - 1]?.id !== currentId) {
        const resolve = pendingResolverRef.current;
        pendingResolverRef.current = null;
        expectedNextIndexRef.current = null;
        setIsRequesting(false);
        resolve(null);
        return;
      }

      if (items.length > expectedNextIndexRef.current) {
        const nextItem = items[expectedNextIndexRef.current];
        const resolve = pendingResolverRef.current;
        pendingResolverRef.current = null;
        expectedNextIndexRef.current = null;
        setIsRequesting(false);
        resolve({ id: nextItem.id, item: nextItem });
      } else if (!isFetchingNextPage) {
        // If fetch completed but list didn't grow enough, resolve null
        const resolve = pendingResolverRef.current;
        pendingResolverRef.current = null;
        expectedNextIndexRef.current = null;
        setIsRequesting(false);
        resolve(null);
      }
    }
  }, [items, hasNextPage, isFetchingNextPage, currentId]);

  const requestNext = useCallback(async (): Promise<ListNavigationTarget<TItem> | null> => {
    const currentItems = itemsRef.current;
    const currentIdx = currentId == null ? -1 : currentItems.findIndex(item => item.id === currentId);

    // AC9: No list context
    if (currentIdx === -1) {
      return null;
    }

    // AC4: Next when already loaded
    if (currentIdx < currentItems.length - 1) {
      const nextItem = currentItems[currentIdx + 1];
      return { id: nextItem.id, item: nextItem };
    }

    // AC7: Boundary with nothing more to fetch
    if (!hasNextPage) {
      return null;
    }

    // AC5, AC6: Boundary with more available, guard against concurrent calls
    if (isRequestingRef.current || isFetchingNextPageRef.current) {
      return new Promise<ListNavigationTarget<TItem> | null>((resolve) => {
        if (pendingResolverRef.current) {
          const prevResolver = pendingResolverRef.current;
          pendingResolverRef.current = (target) => {
            prevResolver(target);
            resolve(target);
          };
        } else {
          // If a background fetch is running but no pending resolver exists,
          // create one so we don't drop the imperative request silently.
          expectedNextIndexRef.current = currentIdx + 1;
          pendingResolverRef.current = resolve;
          isRequestingRef.current = true;
          setIsRequesting(true);
        }
      });
    }

    isRequestingRef.current = true;
    setIsRequesting(true);
    setError(null);
    expectedNextIndexRef.current = currentIdx + 1;

    let fetchPromise: Promise<unknown> | void;
    try {
      fetchPromise = fetchNextPageRef.current();
    } catch (err) {
      setError(err);
      setIsRequesting(false);
      expectedNextIndexRef.current = null;
      return null;
    }

    if (fetchPromise instanceof Promise) {
      fetchPromise.catch(err => {
        setError(err);
        setIsRequesting(false);
        expectedNextIndexRef.current = null;
        if (pendingResolverRef.current) {
          pendingResolverRef.current(null);
          pendingResolverRef.current = null;
        }
      });
    }

    return new Promise<ListNavigationTarget<TItem> | null>((resolve) => {
      pendingResolverRef.current = resolve;
    });
  }, [currentId, hasNextPage]);

  const noContext = currentIndex === -1;
  const isBoundary = !noContext && currentIndex === items.length - 1;
  const loading = isRequesting || isFetchingNextPage;

  let previous: ListNavigationDirectionState<TItem>;
  if (noContext || currentIndex === 0) {
    previous = { target: null, disabled: true, loading: false };
  } else {
    const prevItem = items[currentIndex - 1];
    previous = { target: { id: prevItem.id, item: prevItem }, disabled: false, loading: false };
  }

  let next: ListNavigationDirectionState<TItem>;
  if (noContext) {
    next = { target: null, disabled: true, loading: false };
  } else if (!isBoundary) {
    const nextItem = items[currentIndex + 1];
    next = { target: { id: nextItem.id, item: nextItem }, disabled: false, loading: false };
  } else {
    if (!hasNextPage) {
      next = { target: null, disabled: true, loading: false };
    } else {
      next = { target: null, disabled: loading, loading };
    }
  }

  return {
    previous,
    next,
    requestNext,
    error,
    hasContext: !noContext,
  };
}
