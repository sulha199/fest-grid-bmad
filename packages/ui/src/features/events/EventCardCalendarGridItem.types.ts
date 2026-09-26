import type { MouseEventHandler } from 'react';
import type { EventCardFavoriteBadgeLabels } from './EventCardMediaPrimitives.types';

/**
 * Story 1.i1f (Task 7) — standalone props for the desktop Calendar Grid Item Card
 * primitive (`DESIGN.md` § `event_card_calendar_grid_item`). This is a fresh prop
 * shape, not `WeeklyCalendarViewScheduleShape` — this component is built and tested
 * standalone in this story and is not yet wired into `WeeklyCalendarView.tsx`'s
 * `variant='grid'` render branch (adoption is Stories 1.i1g/1.i1h).
 */
export interface EventCardCalendarGridItemProps {
  eventName: string;
  /** Venue/location display text. Omitted entirely when absent — no reserved space. */
  location?: string | null;
  imageUrl?: string | null;
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
  labels?: EventCardFavoriteBadgeLabels & {
    /**
     * Accessible/visible text for the nearby badge. Resolver FUNCTION, not a static string
     * (BUG-049, AC-NEARBY-1/2/3). Defaults to `formatNearbyBadgeDistance` (`>=2km` → no
     * decimal, e.g. "5 km"; `<2km` → 1 decimal, e.g. "1.2 km").
     */
    nearbyBadge?: (distanceKm: number) => string;
  };
}
