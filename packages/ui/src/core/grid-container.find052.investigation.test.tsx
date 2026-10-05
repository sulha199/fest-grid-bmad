/**
 * FIND-052 INVESTIGATION (bmad-quick-dev, 2026-10-05) — NOT a regression suite, NOT wired into
 * any CI gate. Measures the real-DOM magnitude of the "masonry reflow remount churn + focus
 * loss" issue deferred during Story 0.45's code review (`deferred-work.md`, "Deferred from: code
 * review of story 0.45"): `GridContainer`'s masonry render path keys each item wrapper
 * `key={itemIndex}` under a PER-COLUMN parent `<div>`. When `useMasonryLayout` reassigns an
 * item to a different column, React sees that key disappear from one parent and appear under a
 * different parent — which is always an unmount+remount (a given key is only stable *within one
 * parent*), never an in-place move. This file renders the REAL `GridContainer` + REAL
 * `useMasonryLayout` (same mocked `ResizeObserver` idiom as `useMasonryLayout.test.ts` and the
 * same `setInnerWidth` idiom as `grid-container.test.tsx`'s masonry describe block) and counts,
 * for each of the 4 triggers named in the investigation ask:
 *   (a) a container/window resize that stays within the same breakpoint (column count unchanged)
 *   (b) a column-count-changing breakpoint resize
 *   (c) an image-load-style height change of an EARLIER item (ResizeObserver-driven remeasure)
 *   (d) appending a new page of items (infinite-scroll growth of itemCount)
 * ...how many items changed column, how many of those remounted, and whether a focused item's
 * keyboard focus survived.
 *
 * jsdom reports `offsetHeight === 0` for every real DOM node (no layout engine) — the SAME
 * limitation `grid-container.test.tsx`'s own masonry tests already document ("assert the
 * mechanism, not jsdom pixels"). To get real, *differentiated* heights feeding the REAL
 * greedy-placement algorithm (not a synthetic re-implementation of it), this file installs one
 * test-local override of `HTMLElement.prototype.offsetHeight` that looks up each item wrapper's
 * own `data-grid-container-item-index` attribute (the real attribute `grid-container.tsx` already
 * renders) in a per-test height map — so the exact same ref-callback / ResizeObserver code paths
 * `useMasonryLayout.ts` ships run against controlled, deterministic heights.
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { GridContainer } from './grid-container';

// ── ResizeObserver mock (same idiom as useMasonryLayout.test.ts) ───────────────────────────────
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

// ── Controllable offsetHeight, keyed by the item's own data-grid-container-item-index attr ─────
const heightByIndex = new Map<number, number>();

function setHeight(index: number, height: number) {
  heightByIndex.set(index, height);
}

let originalOffsetHeight: PropertyDescriptor | undefined;
let originalResizeObserver: typeof ResizeObserver | undefined;

beforeEach(() => {
  heightByIndex.clear();
  originalResizeObserver = globalThis.ResizeObserver;
  MockResizeObserver.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = MockResizeObserver;

  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      const attr = (this as HTMLElement).getAttribute('data-grid-container-item-index');
      if (attr === null) return 0;
      return heightByIndex.get(Number(attr)) ?? 0;
    },
  });
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = originalResizeObserver;
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  }
  setInnerWidth(1024);
});

const setInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
};

// ── Mount/unmount + focus-survival instrumentation ──────────────────────────────────────────────
type LifecycleLog = Record<number, { mounts: number; unmounts: number }>;

function recordMount(log: LifecycleLog, index: number) {
  log[index] = log[index] ?? { mounts: 0, unmounts: 0 };
  log[index].mounts += 1;
}
function recordUnmount(log: LifecycleLog, index: number) {
  log[index] = log[index] ?? { mounts: 0, unmounts: 0 };
  log[index].unmounts += 1;
}

function TrackedItem({ index, log }: { index: number; log: LifecycleLog }) {
  // A real focusable element inside each item, matching the ask's "keyboard focus inside it".
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    recordMount(log, index);
    return () => recordUnmount(log, index);
    // Deliberately mount-once semantics (empty deps) -- we want to know whether a NEW instance
    // was created (remount), not whether props changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <input ref={inputRef} data-testid={`focusable-${index}`} aria-label={`item ${index}`} />;
}

// ── Column-assignment snapshot helper ───────────────────────────────────────────────────────────
function snapshotColumns(container: HTMLElement, itemCount: number): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < itemCount; i += 1) {
    const itemEl = container.querySelector(`[data-grid-container-item-index="${i}"]`);
    const colEl = itemEl?.closest('[data-grid-container-column]');
    const colIndex = colEl?.getAttribute('data-grid-container-column-index');
    if (colIndex !== null && colIndex !== undefined) {
      map.set(i, Number(colIndex));
    }
  }
  return map;
}

function diffColumns(before: Map<number, number>, after: Map<number, number>): number[] {
  const changed: number[] = [];
  for (const [index, beforeCol] of before.entries()) {
    const afterCol = after.get(index);
    if (afterCol !== undefined && afterCol !== beforeCol) {
      changed.push(index);
    }
  }
  return changed;
}

interface ScenarioResult {
  name: string;
  itemsChangedColumn: number;
  itemsChangedColumnOutOf: number;
  remountedAmongChanged: number;
  focusedItemChangedColumn: boolean;
  focusedItemRemounted: boolean;
  focusSurvived: boolean;
}

const results: ScenarioResult[] = [];

describe('FIND-052 investigation — masonry reflow remount churn + focus loss', () => {
  it('(a) container/window resize that keeps the column count: 0 reassignment expected (React bails on an unchanged state value)', () => {
    const log: LifecycleLog = {};
    const itemCount = 6;
    for (let i = 0; i < itemCount; i += 1) setHeight(i, 40 + i * 7);

    setInnerWidth(500); // base breakpoint (<768px) => baseCols=2 => 2 columns
    const { container } = render(
      <GridContainer baseCols={2} colsStep={1} layout="masonry">
        {Array.from({ length: itemCount }, (_, i) => (
          <TrackedItem key={i} index={i} log={log} />
        ))}
      </GridContainer>
    );

    const before = snapshotColumns(container, itemCount);
    const focusTarget = container.querySelector('[data-testid="focusable-2"]') as HTMLInputElement;
    act(() => focusTarget.focus());
    expect(document.activeElement).toBe(focusTarget);
    const mountsBefore = log[2].mounts;

    act(() => {
      setInnerWidth(700); // still base breakpoint, same 2-column count
      window.dispatchEvent(new Event('resize'));
    });

    const after = snapshotColumns(container, itemCount);
    const changed = diffColumns(before, after);
    const focusTargetAfter = container.querySelector('[data-testid="focusable-2"]');

    results.push({
      name: '(a) resize, same column count',
      itemsChangedColumn: changed.length,
      itemsChangedColumnOutOf: itemCount,
      remountedAmongChanged: changed.filter((i) => log[i].mounts > 1).length,
      focusedItemChangedColumn: changed.includes(2),
      focusedItemRemounted: log[2].mounts > mountsBefore,
      focusSurvived: document.activeElement === focusTarget && focusTargetAfter === focusTarget,
    });

    expect(changed.length).toBe(0);
    expect(log[2].mounts).toBe(mountsBefore);
    expect(document.activeElement).toBe(focusTarget);
  });

  it('(b) a column-count-changing breakpoint resize', () => {
    const log: LifecycleLog = {};
    const itemCount = 6;
    const heights = [50, 80, 30, 60, 90, 40];
    heights.forEach((h, i) => setHeight(i, h));

    setInnerWidth(700); // base breakpoint => baseCols=2 => 2 columns
    const { container } = render(
      <GridContainer baseCols={2} colsStep={1} layout="masonry">
        {Array.from({ length: itemCount }, (_, i) => (
          <TrackedItem key={i} index={i} log={log} />
        ))}
      </GridContainer>
    );

    const before = snapshotColumns(container, itemCount);
    const focusTarget = container.querySelector('[data-testid="focusable-4"]') as HTMLInputElement;
    act(() => focusTarget.focus());
    expect(document.activeElement).toBe(focusTarget);
    const mountsBefore = log[4].mounts;

    act(() => {
      setInnerWidth(900); // md breakpoint => baseCols+colsStep*1 = 3 columns
      window.dispatchEvent(new Event('resize'));
    });

    const after = snapshotColumns(container, itemCount);
    const changed = diffColumns(before, after);

    results.push({
      name: '(b) column-count change (2 -> 3 cols)',
      itemsChangedColumn: changed.length,
      itemsChangedColumnOutOf: itemCount,
      remountedAmongChanged: changed.filter((i) => log[i].mounts > 1).length,
      focusedItemChangedColumn: changed.includes(4),
      focusedItemRemounted: log[4].mounts > mountsBefore,
      focusSurvived: document.activeElement === focusTarget,
    });

    // Documented, not asserted as a hard pass/fail bound -- this IS the issue under
    // investigation. We still assert the mechanism fired at all (changed.length > 0) so this
    // test fails loudly if a future change makes breakpoint-crossing resizes column-stable.
    expect(changed.length).toBeGreaterThan(0);
  });

  it('(c) an image-load height change of an EARLIER item cascades into later items', () => {
    const log: LifecycleLog = {};
    const itemCount = 6;
    const heights = [50, 60, 55, 45, 65, 50];
    heights.forEach((h, i) => setHeight(i, h));

    setInnerWidth(900); // md breakpoint, baseCols=2 colsStep=1 => 3 columns
    const { container } = render(
      <GridContainer baseCols={2} colsStep={1} layout="masonry">
        {Array.from({ length: itemCount }, (_, i) => (
          <TrackedItem key={i} index={i} log={log} />
        ))}
      </GridContainer>
    );

    const before = snapshotColumns(container, itemCount);
    const focusTarget = container.querySelector('[data-testid="focusable-5"]') as HTMLInputElement;
    act(() => focusTarget.focus());
    expect(document.activeElement).toBe(focusTarget);
    const mountsBefore = log[5].mounts;

    const item0El = container.querySelector('[data-grid-container-item-index="0"]') as HTMLElement;
    act(() => {
      setHeight(0, 500); // async thumbnail growing the FIRST item dramatically
      MockResizeObserver.instances[0].trigger(item0El);
    });

    const after = snapshotColumns(container, itemCount);
    const changed = diffColumns(before, after);

    results.push({
      name: '(c) earlier item height change (image load)',
      itemsChangedColumn: changed.length,
      itemsChangedColumnOutOf: itemCount,
      remountedAmongChanged: changed.filter((i) => log[i].mounts > 1).length,
      focusedItemChangedColumn: changed.includes(5),
      focusedItemRemounted: log[5].mounts > mountsBefore,
      focusSurvived: document.activeElement === focusTarget,
    });

    // The whole point of this scenario: item 0's OWN height growing can still move OTHER items
    // (indices > 0) to different columns, even though their own height never changed.
    expect(changed.some((i) => i !== 0)).toBe(true);
  });

  it('(d) appending a new page of items (infinite scroll) does not reflow already-placed items', () => {
    const log: LifecycleLog = {};
    const initialCount = 6;
    const heights = [50, 80, 30, 60, 90, 40];
    heights.forEach((h, i) => setHeight(i, h));

    setInnerWidth(900); // md breakpoint, baseCols=2 colsStep=1 => 3 columns
    const { container, rerender } = render(
      <GridContainer baseCols={2} colsStep={1} layout="masonry">
        {Array.from({ length: initialCount }, (_, i) => (
          <TrackedItem key={i} index={i} log={log} />
        ))}
      </GridContainer>
    );

    const before = snapshotColumns(container, initialCount);
    const focusTarget = container.querySelector('[data-testid="focusable-1"]') as HTMLInputElement;
    act(() => focusTarget.focus());
    expect(document.activeElement).toBe(focusTarget);
    const mountsBefore = log[1].mounts;

    const appendedCount = 4;
    const totalCount = initialCount + appendedCount;
    // New page's heights deliberately left unconfigured (0 via the default getter) until after
    // mount, mirroring a just-appended, not-yet-measured page of results.
    act(() => {
      rerender(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          {Array.from({ length: totalCount }, (_, i) => (
            <TrackedItem key={i} index={i} log={log} />
          ))}
        </GridContainer>
      );
    });

    const after = snapshotColumns(container, initialCount); // only the ORIGINAL items
    const changed = diffColumns(before, after);

    results.push({
      name: '(d) append a new page (infinite scroll)',
      itemsChangedColumn: changed.length,
      itemsChangedColumnOutOf: initialCount,
      remountedAmongChanged: changed.filter((i) => log[i].mounts > 1).length,
      focusedItemChangedColumn: changed.includes(1),
      focusedItemRemounted: log[1].mounts > mountsBefore,
      focusSurvived: document.activeElement === focusTarget,
    });

    // The hook's own doc comments / Story 0.45 Dev Notes claim appending a page must NOT reflow
    // the already-placed list. Assert that claim holds at the real-component level too.
    expect(changed.length).toBe(0);
    expect(log[1].mounts).toBe(mountsBefore);
    expect(document.activeElement).toBe(focusTarget);
  });

  it('prints the FIND-052 measurement table', () => {
    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        scenario: r.name,
        'cols changed': `${r.itemsChangedColumn}/${r.itemsChangedColumnOutOf}`,
        'of those, remounted': r.remountedAmongChanged,
        'focused item moved col': r.focusedItemChangedColumn,
        'focused item remounted': r.focusedItemRemounted,
        'focus survived': r.focusSurvived,
      }))
    );
    expect(results.length).toBe(4);
  });
});
