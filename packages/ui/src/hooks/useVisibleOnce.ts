'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseVisibleOnceOptions {
  /** Passed straight through to the underlying `IntersectionObserver`. Defaults to `'200px'`, matching `useInfiniteScroll`'s own default so both of this codebase's `IntersectionObserver` consumers trigger at a visually consistent lead distance. */
  rootMargin?: string;
  /** Passed straight through to the underlying `IntersectionObserver`. Defaults to `0`, matching `useInfiniteScroll`'s own default. */
  threshold?: number;
}

export interface UseVisibleOnceResult {
  /** Callback ref to attach to the sentinel element whose visibility should be observed. */
  sentinelRef: (element: Element | null) => void;
  /** `true` once the sentinel has intersected the viewport at least once; stays `true` forever after (never flips back to `false`). */
  isVisible: boolean;
}

/**
 * Story 3.6u (Task 4, AC6) — a small, single-purpose `IntersectionObserver`-based hook that
 * reports a sentinel element's visibility exactly once, then disconnects. Deliberately NOT a
 * reuse of `useInfiniteScroll.ts` -- that hook's whole design is repeated firing (one fetch per
 * page as the sentinel keeps re-entering the viewport during pagination), a shape mismatch for
 * this one-shot "has this section ever been near the viewport" need. Lives alongside
 * `useInfiniteScroll.ts` as this codebase's second, intentionally distinct `IntersectionObserver`
 * primitive -- same default `rootMargin`/`threshold` for visual consistency, different firing
 * semantics.
 */
export function useVisibleOnce({
  rootMargin = '200px',
  threshold = 0,
}: UseVisibleOnceOptions = {}): UseVisibleOnceResult {
  const [node, setNode] = useState<Element | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasFiredRef = useRef(false);

  const sentinelRef = useCallback((element: Element | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node || hasFiredRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasFiredRef.current) {
          hasFiredRef.current = true;
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, rootMargin, threshold]);

  return { sentinelRef, isVisible };
}
