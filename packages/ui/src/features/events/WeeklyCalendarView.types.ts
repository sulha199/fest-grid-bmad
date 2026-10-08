import type { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';

export interface WeeklyCalendarViewScheduleShape {
  id: string;
  eventSlug: string;
  eventName: string;
  isMainSchedule: boolean;
  eventStartDate: string;   // ISO date
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  isFavorited?: boolean;
  isAddedToCalendar?: boolean;
  favoriteCount?: number;
  /** Parent event's id, mapped from the already-fetched `event.id` (Story 1.i1d AC3/AC7). */
  eventId?: string;
  /** Parent event's poster image URL, mapped from the already-fetched `event.imageUrl` (Story 1.i1d AC1/AC2). */
  imageUrl?: string;
  /**
   * BUG-042 (AC-IMG-1): the imageUrl -> imageFallbackUrl retry chain's second URL, mapped from
   * the already-fetched `event.durableImageUrl` (`mapCalendarSchedules`, the single shared
   * mapping point for every calendar surface: CalendarView, FeedCalendarView, AccountCalendarView,
   * my-calendar-content).
   */
  imageFallbackUrl?: string | null;
  /**
   * Venue/location display text for the spanning calendar grid item card, mapped from the
   * already-fetched `event.location` (Story 1.i1g AC10). Optional: every existing consumer
   * that never sets it continues to compile/render, and the spanning card omits the venue
   * line entirely when it is absent (matching `EventCardCalendarGridItem`'s own convention).
   */
  locationName?: string;
  /** Caller-computed distance in kilometers from the viewer to this schedule's location (Story 1.i1f AC13-14). Undefined when no viewer coordinate is resolvable. */
  distanceKm?: number;
  /**
   * Story 1.3k (AC4/AC6-8) — the weekdays this schedule actually occurs on within its
   * `[eventStartDate, eventEndDate]` span. Already mapped to `packages/domain`'s own
   * `DayOfWeek` enum by the caller (`apps/web/src/lib/day-of-week-mapping.ts`) — `packages/ui`
   * never imports the GraphQL-generated enum directly (AD-19 Rule 2/3). Unset/empty means the
   * schedule occurs on every day of its span (today's default/legacy behavior, zero change).
   */
  applicableDaysOfWeek?: DomainDayOfWeek[] | null;
}

export interface WeeklyCalendarViewLabels {
  /** aria-label for the previous-week navigation button */
  prevWeekLabel?: string;
  /** aria-label for the next-week navigation button */
  nextWeekLabel?: string;
  /** "Today" button label */
  todayLabel?: string;
  /** aria-label for the week selection trigger */
  selectWeekLabel?: string;
  /** aria-label for the date input or popover calendar */
  chooseWeekLabel?: string;
  /** aria-label for the favorited badge */
  favoritedBadgeLabel?: string;
  /** aria-label for the added to calendar badge */
  addedToCalendarBadgeLabel?: string;
  /** aria-label for the mobile day-tab strip (`role="tablist"`) */
  dayTabsLabel?: string;
  /** Message shown in the mobile panel when the selected day has no schedules */
  noSchedulesLabel?: string;
  /**
   * Desktop multi-day banner "show more" button text, invoked with the count still hidden. A
   * resolver FUNCTION (ICU plural in the caller). Falls back to an English default if omitted.
   */
  moreMultiDayLabel?: (count: number) => string;
  /** Mobile selected-day list "load more" button text */
  loadMoreLabel?: string;
  /** Mobile selected-day list text while the next page is being fetched */
  loadingMoreLabel?: string;
  /**
   * "+N more" affordance text, invoked once per over-capacity day cell with
   * that day's own hidden-schedule count. A resolver FUNCTION, not a static
   * string, because the count is only known after this component's own
   * per-day capping logic runs — the caller (Story 1.3f's `CalendarView`)
   * wraps its next-intl ICU-plural message: `(count) => t('calendarMoreLabel', { count })`.
   * Falls back to a plain `+${count} more` if omitted.
   */
  moreLabel?: (count: number) => string;
  /**
   * Mobile list-view segment text for multi-day schedules, showing the day number and total days.
   * A resolver FUNCTION, not a static string, because the day offset and total days are only known
   * after this component's own day-segment logic runs — the caller (Story 1.3f's `CalendarView`)
   * wraps its next-intl translation message: `(dayNumber, totalDays) => t('calendarMultiDaySegmentLabel', { dayNumber, totalDays })`.
   * Falls back to `Day ${dayNumber} of ${totalDays}` if omitted.
   */
  multiDaySegmentLabel?: (dayNumber: number, totalDays: number) => string;
  /** aria-label for the "+N more" overflow dialog's dismiss control (Story 1.i1h Task 7 — the shared `CalendarOverflowDialog` replaced the superseded desktop popover) */
  closePopoverLabel?: string;
  /**
   * Accessible name for the shared overflow dialog, invoked once at open time with that day's
   * already-formatted header text (e.g. `Tue, Aug 5`). A resolver FUNCTION, not a static string,
   * for the same reason `moreLabel`/`multiDaySegmentLabel` are: the open day is only known after
   * this component's own day computation runs. Falls back to `` (dayLabel) => `Schedules for
   * ${dayLabel}` `` — the exact string the superseded desktop popover already used as its
   * `aria-label`.
   */
  overflowDialogTitleLabel?: (dayLabel: string) => string;
  /** Shown while `status === 'loading'` (aria-label on the skeleton grid) */
  loadingText?: string;
  /** Prefix text for the list-variant date box's till/end content (default "till", AC4/AC9). */
  tillLabel?: string;
  /** Accessible name for the list-variant thumbnail's favorite-toggle badge (default "Toggle favorite", AC3/AC9). */
  favoriteToggleLabel?: string;
  /** Status badge (list variant) — event has already ended. Matches `EventCardLabels.statusEnded`. Default: "Ended". */
  statusEnded?: string;
  /** Status badge (list variant) — event has started and does not end today. Matches `EventCardLabels.statusHappeningNow`. Default: "Now" (shortened from "Happening Now" by Story 1.i1l, per DESIGN.md § event_card_status_badge). */
  statusHappeningNow?: string;
  /** Status badge (list variant) — event has started, ends today, and no end time is known. Matches `EventCardLabels.statusEndsToday`. Default: "Ends Today". */
  statusEndsToday?: string;
  /** Status badge (list variant) — event has started, ends today, AND the end time is known. `{time}` is replaced with the formatted end time. Matches `EventCardLabels.statusEndsAt`. Default: "Ends {time}". */
  statusEndsAt?: string;
  /** Status badge (list variant) — event starts later today. `{n}` is replaced with the hour count. Matches `EventCardLabels.statusInHours`. Default: "In {n} hour(s)". */
  statusInHours?: string;
  /** Status badge (list variant) — event starts 7-13 days out. `{n}` is replaced with the day count. Matches `EventCardLabels.statusInDays`. Default: "In {n} days". */
  statusInDays?: string;
  /** Status badge (list variant) — event starts 14+ days out. Matches `EventCardLabels.statusUpcoming`. Default: "Upcoming". */
  statusUpcoming?: string;
  /** Status badge (list variant) — event starts tomorrow. Matches `EventCardLabels.tomorrow`. Default: "Tomorrow". */
  tomorrow?: string;
  /**
   * Nearby badge (list variant) text, rendered only when `schedule.distanceKm` is below
   * `nearbyBadgeThreshold`. Matches `EventCardLabels.nearbyBadge`. Resolver FUNCTION, not a
   * static string (BUG-049, AC-NEARBY-1/2/3), for the same reason `moreLabel`/
   * `multiDaySegmentLabel` are: the distance is only known once `schedule.distanceKm` resolves.
   * Defaults to `formatNearbyBadgeDistance` (`>=2km` → no decimal, e.g. "5 km"; `<2km` → 1
   * decimal, e.g. "1.2 km").
   */
  nearbyBadge?: (distanceKm: number) => string;
  /**
   * Story 1.3k (AC9) — translated weekday labels keyed by the exact `DayOfWeek` enum member
   * name (`MON`/`TUE`/…), consumed by `EventCardRepeatBadge`'s tooltip/aria-label. Mirrors the
   * `typeLabels`/`categoryLabels` pattern already established elsewhere in this codebase.
   */
  dayOfWeekLabels?: Record<string, string>;
  /**
   * Repeat badge aria-label/tooltip text resolver (Story 1.3k AC6), invoked with the schedule's
   * translated matching weekday labels in order. Falls back to `EventCardRepeatBadge`'s own
   * `Repeats on ${dayLabels.join(', ')}` default when omitted.
   */
  repeatBadgeAriaLabel?: (dayLabels: string[]) => string;
}

export interface WeeklyCalendarViewOverflowDialogData<
  TSchedule extends WeeklyCalendarViewScheduleShape = WeeklyCalendarViewScheduleShape,
> {
  /**
   * Rows to render, already merged by the caller: the week-fetch's own client-side bucket for the
   * open day plus every page resolved by the day-scoped `useInfiniteQuery`. `CalendarOverflowDialog`
   * keys rows by `id` and renders in array order, so a caller merging pages must dedupe by id.
   */
  items: TSchedule[];
  /** Day-scoped "load more" — typically React Query's `fetchNextPage`. */
  fetchNextPage: () => Promise<unknown> | void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

/**
 * Which affordance opened the shared overflow dialog — AC9's `calendar_overflow_dialog_opened`
 * `surface` field. Exported (rather than inlined) so `apps/web`'s `CalendarView.tsx` can type its
 * PostHog payload without re-declaring the union.
 */
export type WeeklyCalendarViewOverflowSurface = 'desktop' | 'mobile';

export interface WeeklyCalendarViewProps<TSchedule extends WeeklyCalendarViewScheduleShape = WeeklyCalendarViewScheduleShape> {
  weekStart: Date | string;
  schedules: TSchedule[];
  /** Positive integer, or -1 for unlimited (matching DESIGN.md's discovery_view/personal_view split) */
  maxEventsPerDay: number;
  getWeekRange?: (date: Date) => { start: Date; end: Date };
  onToday: () => void;
  onPrevWeek: () => void;
  /** Disables the "Previous week" control — the calendar never navigates further into the past than today's week. */
  isPrevWeekDisabled?: boolean;
  onNextWeek: () => void;
  onSelectWeek?: (date: string) => void;
  onScheduleClick: (schedule: TSchedule) => void;
  /** Optional: fired with the exact schedule when its thumbnail favorite badge is toggled (AC3/AC7). */
  onFavoriteToggle?: (schedule: TSchedule) => void;
  status: 'loading' | 'error' | 'success';
  errorMessage?: string;
  errorDetail?: string;
  /** Optional explicit locale/timezone override — falls back to ScopedLocaleProvider context, matching EventCard */
  locale?: string;
  timezone?: string;
  labels?: WeeklyCalendarViewLabels;
  /**
   * Distance threshold (km) below which the multi-day spanning card's nearby badge renders,
   * forwarded verbatim to `EventCardCalendarGridItem` → `EventCardNearbyBadge` (Story 1.i1f
   * AC15 / Story 1.i1i AC2, Architecture Spine AD-24 Rule 2). Optional: when omitted, the
   * card's own `8` default applies, so every existing consumer
   * (`AccountCalendarView`/`FeedCalendarView`/`my-calendar-content`) is unaffected. Discovery's
   * `CalendarView` forwards the `NEXT_PUBLIC_NEARBY_BADGE_DISTANCE_KM`-derived override here so
   * the configured threshold reaches the calendar surface exactly as it already reaches the
   * masonry `EventCard` (Story 1.i1f review finding, `FIND-045`).
   */
  nearbyBadgeThreshold?: number;
  /**
   * Fired when a day's "+N more" affordance opens the shared overflow dialog (Story 1.i1h Task
   * 7.1/7.2), so the caller knows *which* day's data to start fetching (`date`) and can fire AC9's
   * `calendar_overflow_dialog_opened` (`surface` + `inlineHiddenCount`). A caller that omits it
   * still gets a working open/close dialog, just one that lists only whatever it passes via
   * `overflowDialogData`.
   */
  onOverflowRequested?: (
    date: string,
    surface: WeeklyCalendarViewOverflowSurface,
    inlineHiddenCount: number
  ) => void;
  /**
   * Fired when the overflow dialog closes (Escape, the dismiss control, an outside pointerdown, or
   * activating a card), so the caller can clear the day it opened a fetch for (Story 1.i1h Task
   * 8.1) — this component only owns the open/closed UI state, never the query's lifetime.
   */
  onOverflowClosed?: () => void;
  /**
   * Caller-owned, day-scoped pagination result for the currently-open overflow dialog (Story
   * 1.i1h Task 8.3). Optional because this component owns no fetch of its own — React Query is
   * isolated to `apps/web` per `project-context.md`'s State Management Architecture rule — so a
   * consumer with no such query simply never supplies it. When omitted, `CalendarOverflowDialog`
   * opens with an empty list and no "load more", and the other three `WeeklyCalendarView`
   * consumers (explicitly not switched to windowed fetching in this story, AC10) are otherwise
   * unaffected.
   */
  overflowDialogData?: WeeklyCalendarViewOverflowDialogData<TSchedule>;
  /**
   * The per-day budget the caller's week fetch used (`perDayLimit`). On mobile, once every
   * already-fetched schedule of the selected day is shown and that day had at least this many, the
   * day may have more on the server, so the list continues through `onDayContinuationRequested` +
   * `overflowDialogData` (the same day-scoped query the desktop dialog uses). Omit when the week
   * fetch is not windowed: the mobile list then only pages through what it already has.
   */
  dayFetchLimit?: number;
  /**
   * Mobile only: fired when the selected day's list needs the caller's day-scoped query (so the
   * caller sets its `openOverflowDate`) — without opening the overflow dialog or its analytics.
   * Subsequent pages come from `overflowDialogData.fetchNextPage`.
   */
  onDayContinuationRequested?: (date: string) => void;
  className?: string;
}
