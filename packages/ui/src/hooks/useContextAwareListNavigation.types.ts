export interface UseContextAwareListNavigationOptions<TItem extends { id: string }> {
  /**
   * The caller's currently-loaded items, in list order.
   */
  items: TItem[];

  /**
   * The ID of the item the detail view is currently showing.
   */
  currentId: string | null | undefined;

  /**
   * Whether there are more items to fetch.
   */
  hasNextPage: boolean;

  /**
   * Whether a fetch is currently in flight.
   */
  isFetchingNextPage: boolean;

  /**
   * Callback to invoke when requesting the next page.
   */
  fetchNextPage: () => Promise<unknown> | void;
}

export interface ListNavigationTarget<TItem extends { id: string }> {
  id: string;
  item: TItem;
}

export interface ListNavigationDirectionState<TItem extends { id: string }> {
  /**
   * The resolved target item and its ID, or null if there is no target.
   */
  target: ListNavigationTarget<TItem> | null;

  /**
   * Whether navigation in this direction is disabled (e.g. at the start/end of the list).
   */
  disabled: boolean;

  /**
   * Whether a background fetch is currently resolving the target for this direction.
   */
  loading: boolean;
}

export interface UseContextAwareListNavigationResult<TItem extends { id: string }> {
  /**
   * State and target for navigating to the previous item.
   */
  previous: ListNavigationDirectionState<TItem>;

  /**
   * State and target for navigating to the next item.
   */
  next: ListNavigationDirectionState<TItem>;

  /**
   * Imperative method to navigate to the next item.
   * Resolves immediately if the next item is already loaded.
   * If at the loaded boundary and hasNextPage is true, triggers a background fetch
   * and resolves once the items list grows to include the new target.
   */
  requestNext: () => Promise<ListNavigationTarget<TItem> | null>;

  /**
   * Any error that occurred during the last fetchNextPage invocation.
   * Cleared on the next successful trigger.
   */
  error: unknown | null;
}
