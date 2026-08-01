export interface UseInfiniteScrollOptions {
  /**
   * Callback to invoke when the sentinel element intersects the viewport.
   * Typically maps to React Query's useInfiniteQuery `fetchNextPage`.
   */
  fetchNextPage: () => Promise<unknown> | void;

  /**
   * Whether there are more pages to fetch.
   * If false, the IntersectionObserver will be disconnected.
   */
  hasNextPage: boolean;

  /**
   * Whether a fetch is currently in flight.
   * If true, fetchNextPage will not be invoked to avoid duplicate fetches.
   */
  isFetchingNextPage: boolean;

  /**
   * Margin around the root. Same as IntersectionObserver `rootMargin`.
   * Defaults to '200px' to fetch before the sentinel is fully visible.
   */
  rootMargin?: string;

  /**
   * Either a single number or an array of numbers which indicate at what percentage of the target's visibility the observer's callback should be executed.
   * Same as IntersectionObserver `threshold`. Defaults to 0.
   */
  threshold?: number | number[];
}

export interface UseInfiniteScrollResult {
  /**
   * Ref to attach to the sentinel element at the bottom of the list.
   * It is a callback ref to handle DOM node changes correctly.
   */
  sentinelRef: (node: Element | null) => void;

  /**
   * Any error that occurred during the last fetchNextPage invocation.
   * Cleared on the next successful trigger.
   */
  error: unknown | null;
}
