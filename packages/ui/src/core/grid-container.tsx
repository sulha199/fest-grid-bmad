"use client"

/** @jsxImportSource react */
// The pragma above is a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- it exists only so packages/visual-audit's `react-component`
// RenderSpec (which mounts this component through Playwright's test transform) doesn't have this
// file's JSX default to Playwright's own internal `playwright/jsx-runtime` instead of React's.
// Same fix as `count-badge.tsx`/`EventCardMediaPrimitives.tsx`; see either file's header for the
// direct repro this is based on.
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { GridContainerProps } from './grid-container.types';
import { useMasonryLayout } from '../hooks/useMasonryLayout';

const BASE_COL_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
};

const MD_COL_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
  7: 'md:grid-cols-7',
  8: 'md:grid-cols-8',
};

const LG_COL_CLASS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
  8: 'lg:grid-cols-8',
};

const XL_COL_CLASS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
  7: 'xl:grid-cols-7',
  8: 'xl:grid-cols-8',
};

const TWO_XL_COL_CLASS: Record<number, string> = {
  1: '2xl:grid-cols-1',
  2: '2xl:grid-cols-2',
  3: '2xl:grid-cols-3',
  4: '2xl:grid-cols-4',
  5: '2xl:grid-cols-5',
  6: '2xl:grid-cols-6',
  7: '2xl:grid-cols-7',
  8: '2xl:grid-cols-8',
};

/**
 * Tailwind's default `md`/`lg`/`xl`/`2xl` min-width breakpoints (px) — the same 5 thresholds
 * DESIGN.md's `components.grid.masonry` token documents (Story 0.45 AC3). The single source of
 * truth both the `css-grid` (Tailwind class lookup) and `masonry` (JS column count) paths derive
 * their per-breakpoint column count from.
 */
export const GRID_CONTAINER_BREAKPOINTS_PX = { md: 768, lg: 1024, xl: 1280, twoXl: 1536 } as const;

export interface GridContainerColumnCounts {
  base: number;
  md: number;
  lg: number;
  xl: number;
  twoXl: number;
}

/**
 * Task 1 (AC1/AC3): the shared `baseCols`/`colsStep` -> per-breakpoint column-count formula,
 * extracted so the `css-grid` (Tailwind class lookup) and `masonry` (JS column count, via
 * `useActiveColumnCount` below) render paths are both derived from one source instead of two
 * independently-maintained tables.
 */
export function computeGridContainerColumnCounts(baseCols: number, colsStep: number): GridContainerColumnCounts {
  return {
    base: baseCols,
    md: baseCols + colsStep * 1,
    lg: baseCols + colsStep * 2,
    xl: baseCols + colsStep * 3,
    twoXl: baseCols + colsStep * 4,
  };
}

function validateColumnCounts(counts: GridContainerColumnCounts, baseCols: number, colsStep: number): void {
  const entries: Array<[keyof GridContainerColumnCounts, string]> = [
    ['base', 'base'],
    ['md', 'md'],
    ['lg', 'lg'],
    ['xl', 'xl'],
    ['twoXl', '2xl'],
  ];
  for (const [key, label] of entries) {
    const val = counts[key];
    if (val < 1 || val > 8) {
      throw new Error(
        `GridContainer: Column count ${val} at breakpoint '${label}' is out of the supported range (1-8). baseCols: ${baseCols}, colsStep: ${colsStep}`
      );
    }
  }
}

/**
 * Task 2 (AC3/AC5): tracks which breakpoint is currently active (against the same
 * `GRID_CONTAINER_BREAKPOINTS_PX` thresholds the `css-grid` path's Tailwind classes use) and
 * returns that breakpoint's column count. SSR-safe (defaults to `counts.base`, matching the
 * `css-grid` path's own mobile-first default before any viewport-width JS can run) and recomputes
 * on window resize, which is what feeds `useMasonryLayout`'s "recompute column count on a
 * breakpoint-crossing resize" requirement — the hook itself just reacts to the number changing.
 * A no-op (returns `counts.base`, no listener attached) when `enabled` is false, so non-masonry
 * `GridContainer` consumers (AC1: "unaffected") never pay for a resize listener they don't use.
 */
function useActiveColumnCount(counts: GridContainerColumnCounts, enabled: boolean): number {
  const [columnCount, setColumnCount] = useState(counts.base);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const computeColumnCount = (): number => {
      const width = window.innerWidth;
      if (width >= GRID_CONTAINER_BREAKPOINTS_PX.twoXl) return counts.twoXl;
      if (width >= GRID_CONTAINER_BREAKPOINTS_PX.xl) return counts.xl;
      if (width >= GRID_CONTAINER_BREAKPOINTS_PX.lg) return counts.lg;
      if (width >= GRID_CONTAINER_BREAKPOINTS_PX.md) return counts.md;
      return counts.base;
    };

    const update = () => setColumnCount(computeColumnCount());
    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, counts.base, counts.md, counts.lg, counts.xl, counts.twoXl]);

  return enabled ? columnCount : counts.base;
}

/**
 * GridContainer is a shared, presentational card-grid container component.
 * It manages responsive column layout from numeric baseCols and colsStep props,
 * using a static lookup table so Tailwind can statically compile all utility classes
 * (the `css-grid` layout, default/unchanged), or a hand-rolled JS shortest-column masonry
 * engine (`layout="masonry"`, Story 0.45 / Architecture Spine AD-27).
 */
export function GridContainer({
  children,
  baseCols = 1,
  colsStep = 1,
  gap = 'gap-4',
  className,
  layout = 'css-grid',
}: GridContainerProps) {
  const counts = useMemo(() => computeGridContainerColumnCounts(baseCols, colsStep), [baseCols, colsStep]);
  validateColumnCounts(counts, baseCols, colsStep);

  const isMasonry = layout === 'masonry';

  // React.Children.toArray strips null/undefined/boolean children and assigns stable keys --
  // exactly the normalized, indexable item list the masonry engine needs (unused for css-grid).
  const items = useMemo(() => React.Children.toArray(children), [children]);

  const activeColumnCount = useActiveColumnCount(counts, isMasonry);
  const { columns, registerItemRef } = useMasonryLayout({
    itemCount: isMasonry ? items.length : 0,
    columnCount: activeColumnCount,
  });

  if (isMasonry) {
    return (
      <div
        className={cn('flex items-start', gap, className)}
        data-grid-container-layout="masonry"
      >
        {columns.map((itemIndices, colIndex) => (
          <div
            key={colIndex}
            className={cn('flex-1 min-w-0 flex flex-col', gap)}
            data-grid-container-column=""
            data-grid-container-column-index={colIndex}
          >
            {itemIndices.map((itemIndex) => (
              <div
                key={itemIndex}
                ref={registerItemRef(itemIndex)}
                data-grid-container-item=""
                data-grid-container-item-index={itemIndex}
              >
                {items[itemIndex]}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid",
        gap,
        BASE_COL_CLASS[counts.base],
        MD_COL_CLASS[counts.md],
        LG_COL_CLASS[counts.lg],
        XL_COL_CLASS[counts.xl],
        TWO_XL_COL_CLASS[counts.twoXl],
        className
      )}
    >
      {children}
    </div>
  );
}

export * from './grid-container.types';
