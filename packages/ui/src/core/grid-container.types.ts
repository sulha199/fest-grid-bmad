import type { ReactNode } from 'react';

/**
 * Props for the GridContainer component.
 */
export interface GridContainerProps {
  /**
   * Children components to render in the grid (e.g. Card items).
   */
  children: ReactNode;
  /**
   * The base number of columns (mobile breakpoint). Defaults to 1.
   */
  baseCols?: number;
  /**
   * The step increments for columns at each subsequent breakpoint (md/lg/xl/2xl). Defaults to 1.
   */
  colsStep?: number;
  /**
   * Tailwind CSS gap class (e.g., 'gap-4', 'gap-6'). Defaults to 'gap-4'.
   */
  gap?: string;
  /**
   * Optional additional class name to merge into the base grid classes.
   */
  className?: string;

  /**
   * Layout engine (Story 0.45 / Architecture Spine AD-27).
   * - `'css-grid'` (default, unchanged): plain CSS Grid — every row's height is shared across
   *   all columns (CSS Grid's row-locked height), fine for uniform-height content.
   * - `'masonry'`: JS shortest-column placement (measure each item's rendered height, place
   *   each next item into whichever column currently has the smallest accumulated height) —
   *   true Pinterest-style independent per-column height flow, for variable-height cards.
   */
  layout?: 'css-grid' | 'masonry';
}
