import { useEffect, useState, useCallback, useRef } from 'react';
import type { UseInfiniteScrollOptions, UseInfiniteScrollResult } from './useInfiniteScroll.types';

/**
 * A reusable infinite scroll hook that attaches an IntersectionObserver to a sentinel element.
 * 
 * @param options - Configuration options for the hook.
 * @returns An object containing a callback ref to attach to the sentinel element, and any error from fetching.
 * 
 * @example
 * ```tsx
 * const { fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(...);
 * const { sentinelRef, error } = useInfiniteScroll({
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 * });
 * 
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} data={item} />)}
 *     <div ref={sentinelRef}>
 *       {isFetchingNextPage && <Spinner />}
 *     </div>
 *     {error && <div>Failed to load more.</div>}
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  rootMargin = '200px',
  threshold = 0,
}: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const [node, setNode] = useState<Element | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  const fetchNextPageRef = useRef(fetchNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);

  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
  }, [fetchNextPage, isFetchingNextPage]);

  // We use a callback ref so that we immediately know when the underlying DOM node changes.
  const sentinelRef = useCallback((element: Element | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isFetchingNextPageRef.current) {
          setError(null);
          try {
            const result = fetchNextPageRef.current();
            if (result instanceof Promise) {
              result.catch((err) => {
                setError(err);
              });
            }
          } catch (err) {
            setError(err);
          }
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, hasNextPage, rootMargin, threshold]);

  return { sentinelRef, error };
}
