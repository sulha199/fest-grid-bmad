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
}

export interface EventCardProps {
  /** The name of the event (required) */
  eventName: string;
  
  /** The primary schedule's start date/time (required) */
  startDate: Date | string;

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

  isGreyedOut?: boolean;

  /** Callback when the favorite button is toggled. Must be provided to render the favorite control */
  onFavoriteToggle?: MouseEventHandler<HTMLButtonElement>;

  /** Optional href to make the entire card a link */
  href?: string;

  /** Optional onClick handler for the card root */
  onClick?: MouseEventHandler<HTMLElement>;

  /** Optional label overrides for internally-rendered microcopy (i18n-readiness) */
  labels?: EventCardLabels;
}
