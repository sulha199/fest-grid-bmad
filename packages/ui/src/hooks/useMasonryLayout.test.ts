import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMasonryLayout } from './useMasonryLayout';
import type { UseMasonryLayoutOptions } from './useMasonryLayout.types';

/** Minimal ResizeObserver mock — jsdom ships none. Tracks observed targets per instance and
 * exposes `trigger()` so a test can simulate a real resize-driven remeasure callback. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve(target: Element) {
    this.observed = this.observed.filter((t) => t !== target);
  }

  disconnect() {
    this.observed = [];
  }

  trigger(target: Element) {
    this.callback([{ target } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

/** A fake item node exposing only what the hook reads (`offsetHeight`) — no real DOM needed. */
function makeNode(height: number): HTMLElement {
  return { offsetHeight: height } as unknown as HTMLElement;
}

describe('useMasonryLayout', () => {
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    MockResizeObserver.instances = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = MockResizeObserver;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  const setup = (initialProps: UseMasonryLayoutOptions) =>
    renderHook((props: UseMasonryLayoutOptions) => useMasonryLayout(props), { initialProps });

  it('AC5 — SSR/first-paint estimate: round-robin by index, no measurement dependency', () => {
    const { result } = setup({ itemCount: 6, columnCount: 3 });

    expect(result.current.hasMeasured).toBe(false);
    expect(result.current.columnAssignments).toEqual([0, 1, 2, 0, 1, 2]);
    expect(result.current.columns).toEqual([[0, 3], [1, 4], [2, 5]]);
  });

  it('AC2 — shortest-column selection with unequal heights, not round-robin', () => {
    const { result } = setup({ itemCount: 4, columnCount: 2 });

    act(() => {
      // Heights: 100, 50, 30, 20 — greedy shortest-column placement (not index parity).
      result.current.registerItemRef(0)(makeNode(100));
      result.current.registerItemRef(1)(makeNode(50));
      result.current.registerItemRef(2)(makeNode(30));
      result.current.registerItemRef(3)(makeNode(20));
    });

    expect(result.current.hasMeasured).toBe(true);
    // col0 gets item0 (100); col1 gets items 1,2,3 (50+30+20=100), staying the shortest at
    // every step — this diverges from round-robin's [0,1,0,1], proving real shortest-column
    // logic ran, not just index parity.
    expect(result.current.columnAssignments).toEqual([0, 1, 1, 1]);
    expect(result.current.columns).toEqual([[0], [1, 2, 3]]);
  });

  it('AC5 — reflow-on-remeasure: an already-placed item changing height re-runs placement', () => {
    const { result, rerender } = setup({ itemCount: 3, columnCount: 2 });
    const node1 = makeNode(10);

    act(() => {
      result.current.registerItemRef(0)(makeNode(10));
      result.current.registerItemRef(1)(node1);
      result.current.registerItemRef(2)(makeNode(5));
    });
    // col0 (items 0,2) = 15; col1 (item1) = 10.
    expect(result.current.columnAssignments).toEqual([0, 1, 0]);

    act(() => {
      // Simulate an async-loading thumbnail growing item1's card, detected via the
      // ResizeObserver callback (not a ref reattachment) — mirrors a real image-load resize.
      (node1 as unknown as { offsetHeight: number }).offsetHeight = 500;
      MockResizeObserver.instances[0].trigger(node1);
    });

    // A newly-appended item should now clearly prefer col0 (15) over col1 (now 500) — proving
    // the ResizeObserver-driven remeasure actually changed the heights driving placement.
    rerender({ itemCount: 4, columnCount: 2 });
    act(() => {
      result.current.registerItemRef(3)(makeNode(1));
    });

    expect(result.current.columnAssignments[3]).toBe(0);
  });

  it('AC5 — reflow on a column-count-changing breakpoint resize', () => {
    const { result, rerender } = setup({ itemCount: 4, columnCount: 2 });

    act(() => {
      result.current.registerItemRef(0)(makeNode(40));
      result.current.registerItemRef(1)(makeNode(10));
      result.current.registerItemRef(2)(makeNode(10));
      result.current.registerItemRef(3)(makeNode(10));
    });
    const twoColumnAssignments = result.current.columnAssignments;
    expect(twoColumnAssignments).toEqual([0, 1, 1, 1]);

    // Breakpoint crossing: viewport widened, GridContainer recomputes columnCount 2 -> 4.
    rerender({ itemCount: 4, columnCount: 4 });

    expect(result.current.columns).toHaveLength(4);
    // With 4 columns and 4 items, the greedy algorithm places one item per column in order
    // (every column starts at 0, ties resolve to the lowest index).
    expect(result.current.columnAssignments).toEqual([0, 1, 2, 3]);
  });

  it('a newly-appended page of items does not revert the whole list to round-robin', () => {
    const { result, rerender } = setup({ itemCount: 2, columnCount: 2 });

    act(() => {
      result.current.registerItemRef(0)(makeNode(100));
      result.current.registerItemRef(1)(makeNode(10));
    });
    expect(result.current.hasMeasured).toBe(true);
    expect(result.current.columnAssignments).toEqual([0, 1]);

    // Simulate useInfiniteScroll appending a new, not-yet-measured page (item 2).
    rerender({ itemCount: 3, columnCount: 2 });

    // Still measured (item 0/1 heights persist) — item 2 (unmeasured) is placed by the review-fix
    // round-robin rule for unmeasured items (not reverted to a fresh round-robin pass of the WHOLE
    // list): the first unmeasured item takes column 0.
    expect(result.current.hasMeasured).toBe(true);
    expect(result.current.columnAssignments).toEqual([0, 1, 0]);
  });

  it('an unmeasured appended batch spreads round-robin across columns instead of piling into one (review fix 2026-09-26)', () => {
    const { result, rerender } = setup({ itemCount: 2, columnCount: 2 });

    act(() => {
      result.current.registerItemRef(0)(makeNode(100));
      result.current.registerItemRef(1)(makeNode(10));
    });
    expect(result.current.hasMeasured).toBe(true);

    // Page 1 of results, none of its items yet measured: without the fix, all three would take
    // the single currently-shortest column (col1, height 10) since every 0 estimate fails to move
    // the shortest pointer. With the fix they spread round-robin.
    rerender({ itemCount: 5, columnCount: 2 });

    expect(result.current.columnAssignments).toEqual([0, 1, 0, 1, 0]);
    expect(result.current.columns).toEqual([[0, 2, 4], [1, 3]]);
  });

  it('unregistering an item ref removes its measured height', () => {
    const { result } = setup({ itemCount: 2, columnCount: 2 });

    act(() => {
      result.current.registerItemRef(0)(makeNode(50));
      result.current.registerItemRef(1)(makeNode(20));
    });
    expect(result.current.hasMeasured).toBe(true);

    act(() => {
      result.current.registerItemRef(0)(null);
      result.current.registerItemRef(1)(null);
    });

    expect(result.current.hasMeasured).toBe(false);
  });

  it('columnCount <= 0 returns empty columns without throwing', () => {
    const { result } = setup({ itemCount: 3, columnCount: 0 });

    expect(result.current.columns).toEqual([]);
    expect(result.current.columnAssignments).toEqual([0, 0, 0]);
  });
});
