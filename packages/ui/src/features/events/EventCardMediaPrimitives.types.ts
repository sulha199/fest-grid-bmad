import type { MouseEventHandler, ReactNode } from 'react';

/**
 * Icon-scale variant for `EventCardFavoriteBadge`.
 * - `default`: the small corner-pill badge shown over a present image.
 * - `large`: the borderless, centered badge shown in an empty/fallback media slot.
 */
export type EventCardFavoriteBadgeScale = 'default' | 'large';

/**
 * The media/thumbnail slot of the shared event-card primitive. It owns image-slot
 * dimensions, the reserved-blank fallback, and the badge scale — it does NOT own
 * any date/locale formatting.
 *
 * `EventCardMediaSlot` internally tracks an `onError` state identical to
 * `EventCard`'s existing `imgError` detection and switches between:
 *  - image present + ok → `<img>` (object-cover filling the reserved footprint) with
 *    a small corner favorite badge overlaid
 *  - image absent/errored → nothing rendered in the slot except the large, centered
 *    favorite badge (per `DESIGN.md` § thumbnail_default_fallback / § event_card_compact_thumbnail_fallback)
 */
export interface EventCardMediaSlotProps {
  /** Optional URL for the event image. Absent (or an `onError` firing) renders the reserved-blank fallback. */
  imageUrl?: string;
  /** Optional explicit alt text for the image; defaults to an empty string when absent on an errored/present note. */
  imageAlt?: string;
  /**
   * Which layout configuration to render:
   * - `flex-fill` → masonry's `flex-1 h-full min-w-0` (height matches the sibling date
   *   box's own intrinsic height via the surrounding row's `items-stretch`)
   * - `fixed-square` → calendar-compact's `w-16 h-16 shrink-0`
   */
  layout: 'flex-fill' | 'fixed-square';
  /** Reserved favorite state, forwarded to the badge. */
  isFavorited?: boolean;
  /** Optional count of favorites rendered next to the heart. */
  favoriteCount?: number;
  /** Callback when the favorite button is toggled. Must be provided to render the favorite control. */
  onFavoriteToggle?: MouseEventHandler<HTMLButtonElement>;
  /** Optional label overrides for internally-rendered microcopy (i18n-readiness). */
  labels?: EventCardFavoriteBadgeLabels;
  /** Extra classes appended to the slot root (e.g. margin in a composed row). */
  className?: string;
}

/** Label overrides for the favorite-toggle control (AC5 — matches `EventCardLabels.favoriteToggle`). */
export interface EventCardFavoriteBadgeLabels {
  /** Accessible name for the favorite-toggle button. Defaults to "Toggle favorite". */
  favoriteToggle?: string;
}

/** The favorite heart+count control shared by both badge scales. */
export interface EventCardFavoriteBadgeProps {
  /** Which icon-scale token / layout to use (small corner pill vs. large centered bare control). */
  scale: EventCardFavoriteBadgeScale;
  /** Reserved favorite state. */
  isFavorited?: boolean;
  /** Optional count of favorites rendered next to the heart (omitted entirely when undefined). */
  favoriteCount?: number;
  /** Callback when the favorite button is toggled. Must be provided to render the control. */
  onFavoriteToggle?: MouseEventHandler<HTMLButtonElement>;
  /** Optional label overrides for internally-rendered microcopy (i18n-readiness). */
  labels?: EventCardFavoriteBadgeLabels;
  /**
   * Extra classes appended to the button root — used for positioning overlays
   * (e.g. `absolute top-1 right-1 z-10` for the corner-pill placement).
   */
  className?: string;
}

/**
 * Thin styled wrapper for the event-card date box. Intentionally takes `children`
 * (the caller's already-formatted date text/icon) — it does NOT reimplement any
 * date/locale formatting (that stays in `format-event-date.ts`). It is also the
 * concrete `text-xs` font-size source the icon-scale token (AC2) is calibrated against.
 */
export interface EventCardDateBoxProps {
  /** The caller's already-formatted date content (text and/or a small icon). */
  children: ReactNode;
  /** Extra classes appended to the date box root. */
  className?: string;
}
