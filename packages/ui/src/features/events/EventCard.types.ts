import { MouseEventHandler } from 'react';

export interface EventCardLabels {
  imageFallbackAlt?: string;
  loading?: string;
  favoriteToggle?: string;
}

export interface EventCardProps {
  /** The name of the event (required) */
  eventName: string;
  
  /** The primary schedule's start date/time (required) */
  startDate: Date | string;

  /** Optional explicit locale for formatting the date. Defaults to 'en' or browser default if not provided */
  locale?: string;

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

  /** Reserved slot for favorite state. When onFavoriteToggle is provided, a heart icon/button is rendered */
  isFavorited?: boolean;

  /** Callback when the favorite button is toggled. Must be provided to render the favorite control */
  onFavoriteToggle?: MouseEventHandler<HTMLButtonElement>;

  /** Optional href to make the entire card a link */
  href?: string;

  /** Optional onClick handler for the card root */
  onClick?: MouseEventHandler<HTMLElement>;

  /** Optional label overrides for internally-rendered microcopy (i18n-readiness) */
  labels?: EventCardLabels;
}
