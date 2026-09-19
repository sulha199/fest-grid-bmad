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
  /** Caller-computed distance in kilometers from the viewer to this schedule's location. A "Nearby" badge renders only when this is non-null and < 8. */
  distanceKm?: number | null;
  labels?: EventCardFavoriteBadgeLabels & {
    /** Accessible/visible text for the nearby badge. Defaults to "Nearby". */
    nearbyBadge?: string;
  };
}
