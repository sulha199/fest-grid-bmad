import type { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';
import type { EventStatusLabels } from './format-event-date';

/**
 * Story 3.6ua — flattened, non-generic props for the standalone `EventCardCompact` primitive,
 * extracted verbatim from `WeeklyCalendarView.tsx`'s `CalendarCard` `variant === 'list'` branch
 * (AC1/AC2). Deliberately drops every calendar-internal plumbing piece that branch never
 * actually used (`Segment<TSchedule>`, `dayIdx`/`cardIdx`/`isRovingActive` roving-tabindex state,
 * the grid-only time-range tooltip, `onKeyDown`/`onFocus` grid forwarding) — see the story's Dev
 * Notes § Props Contract / Design Decisions for the full rationale.
 */
export interface EventCardCompactProps {
  // Core content
  /** The event's display name. */
  eventName: string;
  /** Drives bold vs. normal title weight (unchanged from `CalendarCard`'s own `weightClass`). */
  isMainSchedule: boolean;
  /** Optional location name, rendered as a single clamped line below the title. */
  locationName?: string;

  // Date box — pre-computed by the caller (Design Decision #1, story Dev Notes). No
  // `runStartDate`/`runEndDate`/`currentDayStr` here; the caller resolves these via the
  // existing, unchanged `computeCalendarSegmentDateBoxContent` before rendering this component.
  /** Already-formatted month line for the date box (e.g. "AUG"). */
  dateBoxMonth: string;
  /** Already-formatted day line for the date box (e.g. "15"). */
  dateBoxDay: string;
  /** Already-formatted "till" corner-tag label for the date box (e.g. "till"). */
  dateBoxTillLabel: string;

  /** Multi-day chrome — flattened boolean, no `Segment<TSchedule>`. Default `false`. */
  isMultiDayRun?: boolean;

  // Status badge — computed internally via `formatEventStatus` (Design Decision #2).
  /** The schedule's start date, forwarded to `formatEventStatus`. */
  eventStartDate: string;
  /** The schedule's optional start time, forwarded to `formatEventStatus`. */
  eventStartTime?: string | null;
  /** The schedule's optional end date, forwarded to `formatEventStatus`. */
  eventEndDate?: string | null;
  /** The schedule's optional end time, forwarded to `formatEventStatus`. */
  eventEndTime?: string | null;
  /** Status badge label overrides, forwarded verbatim to `formatEventStatus`. */
  statusLabels?: EventStatusLabels;

  // Media
  /** Optional URL for the event image. Absent/errored renders the no-reserved-space fallback. */
  imageUrl?: string;
  /** Optional fallback URL tried once after `imageUrl` is missing or errors. */
  imageFallbackUrl?: string | null;

  // Favorite
  /** Reserved favorite state. */
  isFavorited?: boolean;
  /** Optional count of favorites rendered next to the heart. */
  favoriteCount?: number;
  /** Zero-arg favorite-toggle callback — the caller closes over its own event identity. */
  onFavoriteToggle?: () => void;
  /** Accessible label for the favorite-toggle control. */
  favoriteToggleLabel?: string;

  // Added-to-calendar
  /** Whether this schedule has already been added to the viewer's calendar. */
  isAddedToCalendar?: boolean;
  /** Accessible label for the added-to-calendar icon. */
  addedToCalendarBadgeLabel?: string;

  // Nearby badge
  /** Caller-computed distance in kilometers from the viewer to this event. */
  distanceKm?: number;
  /** Resolver function for the nearby badge's display text. */
  nearbyBadgeLabel?: (distanceKm: number) => string;
  /** Distance threshold (km) below which the nearby badge renders. */
  nearbyBadgeThreshold?: number;

  // Repeat badge
  /** The weekdays this schedule actually occurs on. */
  applicableDaysOfWeek?: DomainDayOfWeek[] | null;
  /** Translated weekday display labels keyed by `DayOfWeek` enum member name. */
  dayOfWeekLabels?: Record<string, string>;
  /** aria-label/tooltip text resolver for the repeat badge. */
  repeatBadgeAriaLabel?: (dayLabels: string[]) => string;

  // Locale/timezone — needed for the internal `formatEventStatus` call (Design Decision #2).
  /** Explicit locale for formatting the status badge. */
  locale: string;
  /** Explicit IANA timezone for formatting the status badge. */
  timezone: string | undefined;

  // Interaction
  /** Zero-arg schedule-click callback, mirrors `onFavoriteToggle`'s shape. */
  onClick: () => void;

  /**
   * AC3 — when `true`, renders a skeleton placeholder matching this card's real layout
   * (date-box block, title/location/badge-row block, thumbnail block) with `aria-busy="true"`,
   * and never attempts to render partial/undefined content underneath. Default `false`.
   */
  loading?: boolean;

  /** Extra classes appended to the card root. */
  className?: string;
}
