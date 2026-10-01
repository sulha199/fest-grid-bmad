import type { MouseEventHandler, ReactNode } from 'react';
import type { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';
import type { EventCardFavoriteBadgeLabels } from './EventCardMediaPrimitives.types';

/**
 * Story 1.i1f (Task 7) — props for the desktop Calendar Grid Item Card primitive
 * (`DESIGN.md` § `event_card_calendar_grid_item`). A fresh prop shape, not
 * `WeeklyCalendarViewScheduleShape` — `WeeklyCalendarView.tsx` maps its own schedule fields onto
 * these at each of its three call sites (`MultiDaySpanningBar`, the single-day grid cell as of
 * BUG-048, and `CalendarOverflowDialog`).
 */
export interface EventCardCalendarGridItemProps {
  eventName: string;
  /** Venue/location display text. Omitted entirely when absent — no reserved space. */
  location?: string | null;
  imageUrl?: string | null;
  /**
   * BUG-042 (AC-IMG-1): optional fallback URL (`durableImageUrl`) tried once, in order, after
   * `imageUrl` is missing or errors — the same `imageUrl -> imageFallbackUrl -> reserved-blank`
   * chain `EventImage.tsx` already implements. Only ever consulted by the with-image (multi-day)
   * composition below; the single-day, image-less composition never receives an image at all.
   */
  imageFallbackUrl?: string | null;
  imageAlt?: string;
  /**
   * Whether this schedule spans multiple days. Gates the with-image composition
   * (`isMultiDay && !imgError`) per DESIGN.md — single-day events never attempt an
   * image at all.
   */
  isMultiDay: boolean;
  isFavorited?: boolean;
  favoriteCount?: number;
  /** Must be provided to render the favorite control (mirrors `EventCard`'s own convention). */
  onFavoriteToggle?: MouseEventHandler<HTMLButtonElement>;
  /** Caller-computed distance in kilometers from the viewer to this schedule's location. A "Nearby" badge renders only when this is non-null and below `nearbyBadgeThreshold` (default `8`). */
  distanceKm?: number | null;
  /**
   * Distance threshold (km) below which the nearby badge renders. Defaults to `8`
   * (`DESIGN.md` § `event_card_nearby_badge` — the corrected `< 8`km gate), forwarded verbatim
   * to the shared `EventCardNearbyBadge`; mirrors `EventCardProps.nearbyBadgeThreshold`.
   *
   * The caller-supplied override reaches every card surface the same way: Discovery's
   * `home-content.tsx` derives it from `NEXT_PUBLIC_NEARBY_BADGE_DISTANCE_KM` via
   * `parseNearbyBadgeThreshold` and passes it to both the masonry `EventCard` and, through
   * `CalendarView` → `WeeklyCalendarView` → this card, to the multi-day spanning bar (Story
   * 1.i1f review finding `FIND-045`). Undefined keeps the `8` default, so consumers with no
   * nearby-filter plumbing are unaffected.
   */
  nearbyBadgeThreshold?: number;
  /**
   * User feedback (2026-09-28): the desktop calendar grid card shows a status badge again, but
   * only for the `inHours`/`endsAt` states (`formatEventStatus(...).state`) — every other state
   * (including `endsToday`, deliberately excluded) stays badge-less, per BUG-048's original
   * revert. The caller (`WeeklyCalendarView.tsx`) owns that gating and passes the already-built
   * `<EventCardStatusBadge>` element (or `undefined`) rather than this primitive re-deriving
   * `formatEventStatus` itself. Rendered directly under `location`, in both compositions.
   */
  statusBadge?: ReactNode;
  labels?: EventCardFavoriteBadgeLabels & {
    /**
     * Accessible/visible text for the nearby badge. Resolver FUNCTION, not a static string
     * (BUG-049, AC-NEARBY-1/2/3). Defaults to `formatNearbyBadgeDistance` (`>=2km` → no
     * decimal, e.g. "5 km"; `<2km` → 1 decimal, e.g. "1.2 km").
     */
    nearbyBadge?: (distanceKm: number) => string;
  };
  /**
   * Story 1.3k (AC8) — the weekdays this schedule actually occurs on, forwarded verbatim to
   * `EventCardRepeatBadge`. Renders an absolutely-positioned corner icon (a different corner
   * than the caller's own `isAddedToCalendar` `CalendarPlus` corner badge, so the two never
   * overlap) when non-empty; omitted entirely when empty/undefined.
   */
  applicableDaysOfWeek?: DomainDayOfWeek[] | null;
  /** Story 1.3k (AC9) — translated weekday labels for the repeat badge. */
  dayOfWeekLabels?: Record<string, string>;
  /** Story 1.3k (AC6/AC8) — repeat badge aria-label/tooltip text resolver. */
  repeatBadgeAriaLabel?: (dayLabels: string[]) => string;
  /**
   * Whether the caller's own hover/focus tooltip state (from `useHoverFocusTooltip`, owned by
   * the card's already-interactive root) is currently active — shows the repeat badge's own
   * tooltip only then (AC6/AC8).
   */
  repeatBadgeTooltipVisible?: boolean;
}
