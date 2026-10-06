/**
 * Story 0.48 (FIND-052) PERMANENT REGRESSION SUITE — wired into this package's own `vitest` run,
 * not a throwaway investigation. Promoted from `grid-container.find052.investigation.test.tsx`
 * (bmad-quick-dev, 2026-10-05, 5/5 green), which first MEASURED the real-DOM magnitude of the
 * "masonry reflow remount churn + focus loss" bug deferred during Story 0.45's code review
 * (`deferred-work.md`, "Deferred from: code review of story 0.45") under the OLD per-column-
 * parent design: `GridContainer`'s masonry render path used to key each item wrapper
 * `key={itemIndex}` under a PER-COLUMN parent `<div>`, so a column reassignment always unmounted
 * + remounted the item (a React key is only stable *within one parent*). Story 0.48 rebuilt the
 * masonry render path on one flat, mount-stable parent (AC1/AC2) specifically to fix this —
 * this file now PROVES the fix holds, for each of the 5 scenarios below (the original 4 plus the
 * new AC7 phase-transition scenario), as hard pass/fail assertions, not documented churn:
 *   (a) a container/window resize that stays within the same breakpoint (column count unchanged)
 *   (b) a column-count-changing breakpoint resize
 *   (c) an image-load-style height change of an EARLIER item (ResizeObserver-driven remeasure)
 *   (d) appending a new page of items (infinite-scroll growth of itemCount)
 *   (e) the Phase 1 -> Phase 2 transition itself (AC7): the moment `hasMeasured` flips
 *       `false -> true` on the very first item's measurement landing, which is a pure
 *       style/attribute update on already-mounted nodes under the new engine, never a remount.
 * Every scenario now asserts `remountedAmongChanged === 0` and `focusSurvived === true`,
 * regardless of whether items changed column (AC6/AC7) — matching the strictness scenarios
 * (a)/(d) already used even before this promotion.
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
      // Deliberately `undefined` (not a `0` fallback) for any index `setHeight` hasn't been
      // called for yet: `useMasonryLayout`'s `measureNode` no-ops when a ref-attach measurement
      // reads a value `===` the already-stored one, and an absent key's `prev[index]` is also
      // `undefined` -- so an item that hasn't had its height set here never actually enters the
      // hook's `heights` record, genuinely reproducing the real `hasMeasured === false` state
      // (AC7's scenario (e) needs exactly this: items mounted, but none measured yet).
      return heightByIndex.get(Number(attr));
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
// Story 0.48 (AC1/AC8): there is no longer a separate per-column wrapper element to `.closest()`
// up to — `data-grid-container-column-index` now lives directly on the item wrapper itself, so
// this reads it straight off the item element.
function snapshotColumns(container: HTMLElement, itemCount: number): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < itemCount; i += 1) {
    const itemEl = container.querySelector(`[data-grid-container-item-index="${i}"]`);
    const colIndex = itemEl?.getAttribute('data-grid-container-column-index');
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

describe('FIND-052 permanent regression suite — mount-stable masonry engine (Story 0.48)', () => {
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

    const remountedAmongChanged = changed.filter((i) => log[i].mounts > 1).length;
    const focusSurvived = document.activeElement === focusTarget;

    results.push({
      name: '(b) column-count change (2 -> 3 cols)',
      itemsChangedColumn: changed.length,
      itemsChangedColumnOutOf: itemCount,
      remountedAmongChanged,
      focusedItemChangedColumn: changed.includes(4),
      focusedItemRemounted: log[4].mounts > mountsBefore,
      focusSurvived,
    });

    // AC6(b): items still change column where expected (the placement algorithm itself is
    // unchanged -- the breakpoint-crossing resize still reassigns columns), but under the new
    // mount-stable engine ZERO of those reassigned items remount, and keyboard focus survives.
    // Previously (OLD per-column-parent engine): 4/6 remounted + focus lost.
    expect(changed.length).toBeGreaterThan(0);
    expect(remountedAmongChanged).toBe(0);
    expect(focusSurvived).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
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

    const remountedAmongChanged = changed.filter((i) => log[i].mounts > 1).length;
    const focusSurvived = document.activeElement === focusTarget;

    results.push({
      name: '(c) earlier item height change (image load)',
      itemsChangedColumn: changed.length,
      itemsChangedColumnOutOf: itemCount,
      remountedAmongChanged,
      focusedItemChangedColumn: changed.includes(5),
      focusedItemRemounted: log[5].mounts > mountsBefore,
      focusSurvived,
    });

    // The whole point of this scenario: item 0's OWN height growing can still move OTHER items
    // (indices > 0) to different columns, even though their own height never changed.
    // AC6(c): under the new mount-stable engine, NONE of those reassigned items remount, and
    // keyboard focus survives. Previously (OLD per-column-parent engine): 3/6 remounted +
    // focus lost.
    expect(changed.some((i) => i !== 0)).toBe(true);
    expect(remountedAmongChanged).toBe(0);
    expect(focusSurvived).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
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

  it('(e) AC7 — the Phase 1 -> Phase 2 transition itself (first measurement landing) causes zero remounts', () => {
    // No `setHeight(...)` calls before the initial render -- every item's `offsetHeight` reads
    // back `undefined` (see the beforeEach override's own comment), so `useMasonryLayout`'s
    // `heights` record stays empty and `hasMeasured` stays `false`: this is the genuine Phase 1
    // (SSR/first-paint, pre-measurement) state, not yet observed by any scenario above.
    const log: LifecycleLog = {};
    const itemCount = 6;

    setInnerWidth(900); // md breakpoint, baseCols=2 colsStep=1 => 3 columns
    const { container } = render(
      <GridContainer baseCols={2} colsStep={1} layout="masonry">
        {Array.from({ length: itemCount }, (_, i) => (
          <TrackedItem key={i} index={i} log={log} />
        ))}
      </GridContainer>
    );

    // Confirm we are genuinely observing Phase 1 before asserting the transition: every item
    // still carries Phase 1's `gridRow: 'auto'` (AC2), never Phase 2's `position: absolute`.
    for (let i = 0; i < itemCount; i += 1) {
      const itemEl = container.querySelector(`[data-grid-container-item-index="${i}"]`) as HTMLElement;
      expect(itemEl.style.gridRow).toBe('auto');
      expect(itemEl.style.position).not.toBe('absolute');
    }

    const mountsBefore: Record<number, number> = {};
    for (let i = 0; i < itemCount; i += 1) mountsBefore[i] = log[i].mounts;

    const focusTarget = container.querySelector('[data-testid="focusable-3"]') as HTMLInputElement;
    act(() => focusTarget.focus());
    expect(document.activeElement).toBe(focusTarget);

    // The first real measurement landing: item 0's height becomes known, flipping
    // `hasMeasured` `false -> true` for the whole list (Phase 1 -> Phase 2).
    const item0El = container.querySelector('[data-grid-container-item-index="0"]') as HTMLElement;
    act(() => {
      setHeight(0, 40);
      MockResizeObserver.instances[0].trigger(item0El);
    });

    // Confirm the transition actually happened (now genuinely in Phase 2).
    expect(item0El.style.position).toBe('absolute');

    // AC7's actual proof: the phase switch is a pure style/attribute update on already-mounted
    // nodes -- zero remounts of ANY item, and keyboard focus survives.
    for (let i = 0; i < itemCount; i += 1) {
      expect(log[i].mounts).toBe(mountsBefore[i]);
      expect(log[i].unmounts).toBe(0);
    }
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
