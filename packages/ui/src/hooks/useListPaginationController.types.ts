export interface UseListPaginationControllerOptions<TFilterKey, TCursor> {
  /**
   * Serializable snapshot of the active filter/query state (e.g. `{ types: ['MUSIC'] }`).
   * Compared on every render (default: `JSON.stringify` equality) to detect a filter change.
   * Expected to be a small, plain, serializable object — not an arbitrary reference.
   */
  filterKey: TFilterKey;

  /**
   * Cursor value the controller resets to when `filterKey` changes.
   * E.g. `0` for offset pagination, `undefined` for a Connection-style `after` cursor.
   */
  initialCursor: TCursor;

  /**
   * Optional custom equality check for `filterKey`.
   * Defaults to `JSON.stringify(a) === JSON.stringify(b)`.
   */
  isEqual?: (a: TFilterKey, b: TFilterKey) => boolean;

  /**
   * Called whenever `filterKey` changes and the controller resets.
   * Optional — most consumers observe the reset via `resetToken`/`cursor` instead.
   * Fires from a `useEffect` keyed on `resetToken` (side effects belong in effects, not render),
   * exactly once per actual `filterKey` change.
   */
  onReset?: () => void;
}

export interface UseListPaginationControllerResult<TCursor> {
  /**
   * Current cursor/offset value.
   * Feed into the query (e.g. `GetEventsQuery`'s `offset`, or a Connection query's `after`).
   */
  cursor: TCursor;

  /**
   * Increments every time `filterKey` changes (or `resetToFirstPage()` is called).
   * Spread into a react-query `queryKey` so a filter change is always treated as a fresh query,
   * even by a consumer that forgets to spread `filterKey` into the key itself.
   */
  resetToken: number;

  /**
   * 1-based index of the current page, derived from cursor-history length.
   */
  pageIndex: number;

  /**
   * Advance to the next page: pushes the current cursor onto history, sets cursor to `nextCursor`.
   */
  goToNextPage: (nextCursor: TCursor) => void;

  /**
   * Go back to the previous page. No-ops if already on page 1 (history empty).
   */
  goToPrevPage: () => void;

  /**
   * True if `goToPrevPage()` would change anything.
   */
  hasPrevPage: boolean;

  /**
   * Consumer-reported: does the query report more results after the current cursor?
   * Not computed by the controller — it doesn't know the query's response shape.
   * Resets to `false` whenever the controller resets (it describes the old query's last-known
   * page, not the new one).
   */
  hasNextPage: boolean;

  /**
   * Consumer-reported total count, passed through for prev/next/total UI (BUG-020-style consumers).
   * Resets to `undefined` whenever the controller resets.
   */
  totalCount: number | undefined;

  /**
   * Call after each successful fetch to report this page's `hasNextPage`/`totalCount` back into
   * the controller.
   */
  reportPageMeta: (meta: { hasNextPage: boolean; totalCount?: number }) => void;

  /**
   * Force a reset to page 1 without a `filterKey` change (e.g. a standalone "reset filters" action).
   */
  resetToFirstPage: () => void;
}
