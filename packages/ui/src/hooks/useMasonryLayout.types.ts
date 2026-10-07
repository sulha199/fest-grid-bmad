export interface UseMasonryLayoutOptions {
  /**
   * Number of items to place. Item indices run `0..itemCount-1`, in the same order the caller's
   * own list is rendered in (before any column reassignment).
   */
  itemCount: number;

  /**
   * Current column count. Recomputing this (e.g. a breakpoint-crossing container/window resize)
   * is the caller's responsibility (`GridContainer`'s masonry render path derives it from the
   * same `baseCols`/`colsStep` breakpoint table the `css-grid` path uses) — this hook only reacts
   * to the value changing, re-running placement (Story 0.45 AC3/AC5).
   */
  columnCount: number;

  /**
   * Vertical gap (px) between stacked items in a column. Phase 2 items are absolutely positioned,
   * so the grid's native `row-gap` never applies to them; the caller passes the container's
   * computed row gap and it is added after each item when accumulating offsets. Defaults to 0.
   */
  rowGap?: number;
}

export interface UseMasonryLayoutResult {
  /**
   * For each item index (`0..itemCount-1`), the column index (`0..columnCount-1`) it is
   * currently assigned to.
   */
  columnAssignments: number[];

  /**
   * `columnAssignments` regrouped by column: `columns[c]` is the ordered list of item indices
   * placed in column `c`, top-to-bottom. Convenience for rendering (`GridContainer` maps this
   * directly into one flex-column track per entry).
   */
  columns: number[][];

  /**
   * Ref callback factory: call `registerItemRef(index)` and pass the result as an item's `ref`
   * prop so the hook can measure (and, via `ResizeObserver`, keep re-measuring) that item's
   * rendered height — mirrors `swipe-to-reveal.tsx`'s `measure()` + `ResizeObserver` idiom,
   * generalized to N items instead of one.
   */
  registerItemRef: (index: number) => (node: HTMLElement | null) => void;

  /**
   * True once at least one item has a known measured height. While `false` (nothing measured
   * yet — the SSR/first-paint state), `columnAssignments` is the round-robin estimate (AC5);
   * once `true`, it is real shortest-column placement derived from measured heights (any item
   * not yet measured is placed round-robin among the columns and contributes a `0` height
   * estimate until it is).
   */
  hasMeasured: boolean;

  /**
   * Story 0.48 AC3: final accumulated height per column (`0..columnCount-1`), i.e. the same
   * `colHeights` the placement loop already tracks internally, exposed here as the source for
   * `GridContainer`'s Phase 2 (`hasMeasured === true`) container `height` (`Math.max(...columnHeights)`).
   * `[]` when `columnCount <= 0`; all-zero (length `columnCount`) while `!hasMeasured` (the
   * SSR/first-paint round-robin estimate carries no real heights yet).
   */
  columnHeights: number[];

  /**
   * Story 0.48 AC3: parallel-indexed to `columnAssignments` (`0..itemCount-1`) — each item's own
   * accumulated-height-so-far-in-its-column AT THE MOMENT it was placed (i.e.
   * `columnHeights[columnAssignments[i]]` immediately before this item's own height was added to
   * it). The source for `GridContainer`'s Phase 2 per-item `transform: translateY(itemOffsets[i])`.
   * `[]` when `columnCount <= 0`; all-zero (length `itemCount`) while `!hasMeasured`.
   */
  itemOffsets: number[];
}
