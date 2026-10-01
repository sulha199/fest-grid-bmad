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
}
