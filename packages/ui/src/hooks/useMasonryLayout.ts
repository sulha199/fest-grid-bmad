"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseMasonryLayoutOptions, UseMasonryLayoutResult } from './useMasonryLayout.types';

/**
 * Story 0.45 / Architecture Spine AD-27 Rule 1: hand-rolled JS shortest-column placement — the
 * standard Pinterest/`react-masonry-css` algorithm, reimplemented locally (see that story's Dev
 * Notes "Library vs. hand-rolled decision" for why no third-party masonry library is used).
 *
 * Owns ONLY column-assignment logic + per-item height measurement. It knows nothing about
 * breakpoints/viewport width — the caller (`GridContainer`'s masonry render path) computes the
 * current `columnCount` from its own `baseCols`/`colsStep` breakpoint table and passes it in;
 * this hook just re-runs placement whenever that number changes (AC3/AC5's "recompute on a
 * breakpoint-crossing resize", split so the hook itself stays a pure function of its inputs).
 *
 * Hydration/layout-shift strategy (AD-27 Rule 2, Dev Notes "Hydration / layout-shift strategy
 * decision"): items render round-robin by index on first paint (SSR-safe — no measurement
 * dependency, so server and pre-hydration client markup match). Measurement mirrors
 * `swipe-to-reveal.tsx`'s `measure()` + `ResizeObserver` idiom, generalized to N items: each
 * item's ref callback measures its `offsetHeight` the moment it attaches (ref callbacks fire
 * during commit, so this happens essentially synchronously with mount — no extra deferred
 * render pass is needed for the very first measurement), and a `ResizeObserver` is attached to
 * every item so a later height change (e.g. an async-loading `EventCard` thumbnail) re-triggers
 * placement too.
 *
 * `hasMeasured` flips true the moment AT LEAST ONE item has a known height — not only once every
 * item does. This is deliberate: with `useInfiniteScroll`/`useListPaginationController` growing
 * `itemCount` over time, gating on "every item measured" would revert the WHOLE already-placed
 * list back to round-robin on every newly-loaded page (each page briefly adds unmeasured items).
 * Once real placement has started, an unmeasured item just contributes a `0` height estimate
 * until it measures in (see `columnAssignments` below) — its column reflows once it does, but the
 * rest of the list doesn't visibly reshuffle.
 */
export function useMasonryLayout({ itemCount, columnCount }: UseMasonryLayoutOptions): UseMasonryLayoutResult {
  const nodesRef = useRef<Map<number, HTMLElement>>(new Map());
  const observerRef = useRef<ResizeObserver | null>(null);
  const [heights, setHeights] = useState<Record<number, number>>({});

  const measureNode = useCallback((index: number, node: HTMLElement) => {
    const nextHeight = node.offsetHeight;
    setHeights((prev) => (prev[index] === nextHeight ? prev : { ...prev, [index]: nextHeight }));
  }, []);

  const getObserver = useCallback((): ResizeObserver | null => {
    if (typeof ResizeObserver === 'undefined') {
      return null;
    }
    if (!observerRef.current) {
      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          for (const [index, node] of nodesRef.current.entries()) {
            if (node === target) {
              measureNode(index, node);
              break;
            }
          }
        }
      });
    }
    return observerRef.current;
  }, [measureNode]);

  // Cache one ref-callback function per item index (rather than a fresh closure on every call),
  // so `ref={registerItemRef(index)}` gets the SAME function reference across re-renders. React
  // detaches (calls with `null`) then reattaches any ref callback whose reference changes between
  // renders — without this cache, a freshly-created closure every render would detach+reattach
  // (and therefore re-measure/setState) every single render, looping forever.
  const refCallbacksRef = useRef<Map<number, (node: HTMLElement | null) => void>>(new Map());

  const registerItemRef = useCallback(
    (index: number): ((node: HTMLElement | null) => void) => {
      const cached = refCallbacksRef.current.get(index);
      if (cached) {
        return cached;
      }
      const callback = (node: HTMLElement | null) => {
        const prevNode = nodesRef.current.get(index);
        if (prevNode && prevNode !== node) {
          observerRef.current?.unobserve(prevNode);
        }
        if (node) {
          nodesRef.current.set(index, node);
          // Measure immediately on attach — no separate deferred effect needed for the first
          // measurement (see file header).
          measureNode(index, node);
          getObserver()?.observe(node);
        } else {
          nodesRef.current.delete(index);
          setHeights((prev) => {
            if (!(index in prev)) {
              return prev;
            }
            const next = { ...prev };
            delete next[index];
            return next;
          });
        }
      };
      refCallbacksRef.current.set(index, callback);
      return callback;
    },
    [measureNode, getObserver]
  );

  // Cleanup only — measurement itself happens at ref-attach time (registerItemRef) and via the
  // ResizeObserver's own callback, not here.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const hasMeasured = useMemo(() => Object.keys(heights).length > 0, [heights]);

  const columnAssignments = useMemo<number[]>(() => {
    const assignments = new Array(itemCount).fill(0);
    if (columnCount <= 0) {
      return assignments;
    }

    if (!hasMeasured) {
      // SSR / first-paint estimate (AC5): round-robin by index, no measurement dependency.
      for (let i = 0; i < itemCount; i += 1) {
        assignments[i] = i % columnCount;
      }
      return assignments;
    }

    // True shortest-column placement (AC2/AC4): each item goes into whichever column currently
    // has the smallest accumulated height. An item not yet measured (e.g. a just-appended page
    // of results still mid-mount) contributes 0 until its own height lands, then reflows.
    const colHeights = new Array(columnCount).fill(0);
    for (let i = 0; i < itemCount; i += 1) {
      let shortest = 0;
      for (let c = 1; c < columnCount; c += 1) {
        if (colHeights[c] < colHeights[shortest]) {
          shortest = c;
        }
      }
      assignments[i] = shortest;
      colHeights[shortest] += heights[i] ?? 0;
    }
    return assignments;
  }, [itemCount, columnCount, heights, hasMeasured]);

  const columns = useMemo<number[][]>(() => {
    const cols: number[][] = Array.from({ length: Math.max(columnCount, 0) }, () => []);
    columnAssignments.forEach((colIndex, itemIndex) => {
      cols[colIndex]?.push(itemIndex);
    });
    return cols;
  }, [columnAssignments, columnCount]);

  return { columnAssignments, columns, registerItemRef, hasMeasured };
}
