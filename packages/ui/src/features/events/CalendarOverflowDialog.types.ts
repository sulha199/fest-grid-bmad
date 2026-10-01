import type { RefObject } from 'react';

/**
 * Story 1.i1h (Task 6.2) — the minimum shape one overflow-dialog row needs.
 *
 * Structurally a subset of `WeeklyCalendarViewScheduleShape`, so `WeeklyCalendarView` can
 * forward its own `schedules` array straight through. Kept deliberately narrow (id + display
 * fields + the two optional interaction inputs) rather than depending on the calendar's shape,
 * so a future non-calendar consumer of this dialog would not force a rework — the dialog's
 * props boundary is generic-shaped even though today's only callers are the two calendar
 * surfaces (Gate 3 note in this story's Dev Notes).
 */
export interface CalendarOverflowDialogItemShape {
  /** Stable identity, used for React keys. Also the key the caller merges paginated pages on. */
  id: string;
  eventName: string;
  /** Venue/location display text (mapped from `WeeklyCalendarViewScheduleShape.locationName`). */
  locationName?: string | null;
  isFavorited?: boolean;
  favoriteCount?: number;
  /** Caller-computed distance in km; forwarded verbatim to the card's self-gating nearby badge. */
  distanceKm?: number | null;
}

/** Label overrides for internally-rendered microcopy (i18n-readiness — same convention as the rest of `features/events`). */
export interface CalendarOverflowDialogLabels {
  /** Accessible name for the dialog itself. Defaults to `All schedules` (`WeeklyCalendarView` passes the localized day-scoped string). */
  titleLabel?: string;
  /** Accessible name for the dialog's dismiss control. Defaults to "Close". */
  closeLabel?: string;
  /** Visible + accessible text while a further page is in flight. Defaults to "Loading more…". */
  loadingMoreLabel?: string;
  /** Text shown when a "load more" page fails. Defaults to "Could not load more events." */
  loadMoreErrorLabel?: string;
  /**
   * Resolver FUNCTION, not a static string — the delta is only known after a page resolves,
   * exactly like `WeeklyCalendarViewLabels.moreLabel`. Defaults to
   * `` (count) => `${count} more event(s) loaded` ``.
   */
  loadedAnnouncement?: (count: number) => string;
  /** Forwarded to every row's favorite-toggle button. Defaults to "Toggle favorite". */
  favoriteToggleLabel?: string;
  /**
   * Forwarded to every row's nearby badge. Resolver FUNCTION, not a static string (BUG-049,
   * AC-NEARBY-1/2/3). Defaults to `formatNearbyBadgeDistance` (`>=2km` → no decimal, e.g.
   * "5 km"; `<2km` → 1 decimal, e.g. "1.2 km").
   */
  nearbyBadgeLabel?: (distanceKm: number) => string;
}

/**
 * Props for the shared `calendar_overflow_dialog` (DESIGN.md token block).
 *
 * Controlled by the caller: this component owns no fetch of its own. `apps/web`'s
 * `CalendarView.tsx` owns the day-scoped `useInfiniteQuery` (React Query is isolated to
 * `apps/web` per `project-context.md`'s State Management Architecture rule) and threads the
 * live query result down as plain props, while `WeeklyCalendarView` owns the open/closed UI
 * state locally — the same ownership split the superseded desktop popover already used.
 */
export interface CalendarOverflowDialogProps<
  TSchedule extends CalendarOverflowDialogItemShape = CalendarOverflowDialogItemShape,
> {
  open: boolean;
  /** ISO `YYYY-MM-DD` of the day this dialog lists, or `null` while closed. */
  date: string | null;
  /** Already-fetched rows for this day (the caller's merged, schedule-id-deduped page list). */
  items: TSchedule[];
  /** Feeds `useInfiniteScroll`'s sentinel; typically React Query's `fetchNextPage`. */
  fetchNextPage: () => Promise<unknown> | void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Close request from Escape, the dismiss control, or an outside pointerdown. */
  onClose: () => void;
  /** Fired with the exact row on schedule-card activation. Omit to render rows as non-navigating. */
  onScheduleClick?: (schedule: TSchedule) => void;
  /** Fired with the exact row when its favorite badge is toggled. Omit to render no favorite control. */
  onFavoriteToggle?: (schedule: TSchedule) => void;
  /** Distance threshold (km) forwarded verbatim to each row's `EventCardCalendarGridItem` (its own `8` default applies when omitted). */
  nearbyBadgeThreshold?: number;
  /**
   * The element that should regain focus when the dialog closes — the "+N more" trigger the
   * user activated. The caller owns this ref because the trigger lives outside this component
   * (`WeeklyCalendarView` — Task 7.4). Focus return is skipped entirely when omitted.
   */
  triggerRef?: RefObject<HTMLElement | null>;
  labels?: CalendarOverflowDialogLabels;
  className?: string;
}
