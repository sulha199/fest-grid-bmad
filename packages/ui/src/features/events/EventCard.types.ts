import { MouseEventHandler } from 'react';

export interface EventCardLabels {
  imageFallbackAlt?: string;
  loading?: string;
  favoriteToggle?: string;
  /** Label shown before the starting price (e.g. "From"). Defaults to "From" if not provided. */
  priceFrom?: string;
  /** Translated display label per event type enum member, keyed by the raw enum value (e.g. { FESTIVAL: 'Festival' }). Falls back to the raw value if a key is missing. */
  typeLabels?: Record<string, string>;
  /** Translated display label per event category enum member, keyed by the raw enum value (e.g. { MUSIC: 'Music' }). Falls back to the raw value if a key is missing. */
  categoryLabels?: Record<string, string>;
  today?: string;
  tomorrow?: string;
  yesterday?: string;
  /** Status badge (masonry variant) — event has already ended. Default: "Ended". */
  statusEnded?: string;
  /** Status badge (masonry variant) — event has started and does not end today. Default: "Happening Now". */
  statusHappeningNow?: string;
  /** Status badge (masonry variant) — event has started and ends today. Default: "Ends Today". */
  statusEndsToday?: string;
  /** Status badge (masonry variant) — event starts later today. `{n}` is replaced with the hour count. Default: "In {n} hour(s)". */
  statusInHours?: string;
  /** Status badge (masonry variant) — event starts 7-13 days out. `{n}` is replaced with the day count. Default: "In {n} days". */
  statusInDays?: string;
  /** Status badge (masonry variant) — event starts 14+ days out. Default: "Upcoming". */
  statusUpcoming?: string;
  /** TILL sub-badge (masonry variant) prefix, e.g. "till 6:00 PM" or bare "till". Default: "till". */
  tillLabel?: string;
  /** Nearby badge (masonry variant) text, shown when `distanceKm <= 5`. Default: "Nearby". */
  nearbyBadge?: string;
}

export interface EventCardProps {
  /** Optional layout variant */
  variant?: 'standard' | 'masonry';

  /** The name of the event (required) */
  eventName: string;
  
  /** The primary schedule's start date/time (required) */
  startDate: Date | string;

  /** Optional starting time of day */
  startTime?: string | null;

  /** Optional explicit locale for formatting the date. If omitted, falls back to the nearest ancestor ScopedLocaleProvider's locale (see useScopedLocale/ScopedLocaleProvider in packages/ui/src/hooks), or that hook's default if none is present. */
  locale?: string;

  /** Optional explicit IANA timezone (e.g. 'Asia/Jakarta') for formatting the date. If omitted, falls back to the nearest ancestor ScopedLocaleProvider's timezone (see useScopedTimezone/ScopedLocaleProvider), or the runtime's default timezone if none is present/set. */
  timezone?: string;

  /** Optional URL for the event image */
  imageUrl?: string;

  /** Optional explicit alt text for the image. If not provided, it will be auto-derived from eventName */
  imageAlt?: string;

  /** Boolean to indicate if the component is in a loading skeleton state */
  loading?: boolean;

  /** Optional location name to display */
  locationName?: string;

  /** Optional list of categories to display as badges */
  categories?: string[];

  /** Optional list of event types to display as badges */
  types?: string[];

  /** Optional starting price to display */
  priceFrom?: string | number;

  /** Optional visual state for deferred unfavorite flows where removal is pending confirmation */
  pendingRemoval?: boolean;

  /** Reserved slot for favorite state. When onFavoriteToggle is provided, a heart icon/button is rendered */
  isFavorited?: boolean;

  /** Optional count of favorites for the event */
  favoriteCount?: number;

  isGreyedOut?: boolean;

  /** Callback when the favorite button is toggled. Must be provided to render the favorite control */
  onFavoriteToggle?: MouseEventHandler<HTMLButtonElement>;

  /** Optional href to make the entire card a link */
  href?: string;

  /** Optional onClick handler for the card root */
  onClick?: MouseEventHandler<HTMLElement>;

  /** Optional label overrides for internally-rendered microcopy (i18n-readiness) */
  labels?: EventCardLabels;

  /** Optional absolutely-positioned status badge slot */
  statusBadge?: React.ReactNode;

  /** Optional end date of the primary schedule. Absent `endDate` is treated as "ends same day as start" for the masonry TILL badge (AC14) and status badge (AC15) computations. */
  endDate?: Date | string | null;

  /** Optional end time of the primary schedule */
  endTime?: string | null;

  /** When true (masonry variant only), renders the enlarged/prominent poster treatment per PRD §3.16. Caller derives this from `durableImageUrl != null` — EventCard does not know about the opt-in concept itself. */
  prominentPoster?: boolean;

  /** Caller-computed distance in kilometers from the viewer to this event (client-side geolocation math — EventCard performs no location/distance logic itself). A "Nearby" badge renders only when this is non-null and <= 5. Omit/null when the viewer has not granted location permission. */
  distanceKm?: number | null;
}
