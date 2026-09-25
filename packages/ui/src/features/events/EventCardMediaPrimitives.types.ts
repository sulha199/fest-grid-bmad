import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { EventCardDateBoxSize } from './event-card-media-tokens';

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
  /**
   * Which badge-font-size custom-property value (AD-15, Story 1.i1k AC5) to declare on this
   * slot's root — must match the sibling `EventCardDateBox`'s own `size` in the same
   * composition, since the two communicate icon scale only via that one shared custom
   * property. Defaults to `'default'` if omitted (least-surprise back-compat); both real call
   * sites pass it explicitly.
   */
  size?: EventCardDateBoxSize;
  /**
   * When true, suppress the slot's own internal favorite badge in BOTH branches
   * (the image-present corner pill and the reserved-blank large fallback), so a
   * caller can compose an external favorite control instead (e.g. a
   * `RootTag`-external sibling, per Story 1.i1e's nested-button-avoidance design).
   * Defaults to `false` — omitted callers keep today's exact behavior.
   */
  hideFavoriteBadge?: boolean;
  /**
   * Optional callback fired with the current image-presence state
   * (`true` = a valid image is present and not errored, `false` = absent or
   * errored) whenever it changes — including on the initial mount value — so an
   * external caller composing its own favorite badge knows which the slot's
   * badge scale (`'default'` vs `'large'`) would apply. Safe to omit.
   */
  onImagePresenceChange?: (imagePresent: boolean) => void;
  /**
   * Story 1.i1m AC1/AC3: when `true`, the slot renders `null` (removed from the DOM
   * entirely, not left as an empty reserved element) whenever the image is absent or
   * errored, instead of this primitive's default reserved-blank fallback. Defaults to
   * `false` — every existing consumer (masonry's two call sites) omits this prop and
   * keeps today's exact reserved-blank behavior. Only the calendar compact row
   * (`WeeklyCalendarView.tsx`) passes `true`; masonry's own reserved-space convention is
   * explicitly and permanently unaffected by this prop's existence.
   */
  collapseOnFallback?: boolean;
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
  /**
   * Story 1.i1m AC5: overrides this badge's own icon size, replacing the ratio-derived
   * `eventCardBadgeIconSizeStyle(scale)` this component computes internally. The two fixed
   * ratios that function expresses (`EVENT_CARD_BADGE_ICON_SCALE_LARGE`/`_DEFAULT`) cannot
   * express continuous, container-width-driven growth — the calendar compact row's own
   * `eventCardRowFavoriteIconGrowingStyle()` is the one real caller. Omitted by every other
   * call site, which keeps today's exact ratio-derived sizing unchanged.
   */
  iconSizeStyle?: CSSProperties;
  /**
   * Story 1.i1m AC5: overrides the `large`-scale badge's own fixed `text-sm` count-text
   * class (which also styles the button's overall text size/weight context). The one real
   * caller is the calendar compact row's `EVENT_CARD_ROW_FAVORITE_COUNT_TEXT_SIZE_CLASS`
   * (a `text-sm`/`text-base` container-query step); every other call site omits this and
   * keeps the fixed `text-sm`. Ignored when `scale !== 'large'`.
   */
  largeTextSizeClassName?: string;
}

/**
 * Two-tier stacked month/day chrome for the event-card date box (Story 1.i1k, DESIGN.md
 * `event_card_date_box.base_default` / `event_card_compact.date_box`). Takes structured,
 * caller-already-formatted `month`/`day` slots (no date/locale formatting is reimplemented
 * here — that stays in `format-event-date.ts`) plus an optional `tillLabel` slot rendered
 * internally as the amber corner tag, so no caller hand-wraps a `<span>` with a duplicated
 * literal class string.
 */
export interface EventCardDateBoxProps {
  /** Which token-specified size to render — `'default'` (masonry) or `'compact'` (compact row). Required: both real consumers must choose explicitly. */
  size: EventCardDateBoxSize;
  /** The caller's already-formatted month/weekday content (small uppercase line). */
  month: ReactNode;
  /** The caller's already-formatted day content (large bold line). */
  day: ReactNode;
  /**
   * Story 1.i1n AC1: which font-size treatment the day slot renders at. `'number'` (default,
   * omitted callers keep today's exact byte-for-byte output, AC3) is sized for a 1-2 digit
   * numeric day-of-month (`text-5xl`/`text-3xl`). `'word'` renders a smaller, word-safe size
   * that fits every real word/time content variant ("Today", "Tomorrow", "Yesterday", a
   * locale-formatted time string) without overflow at the real mobile masonry (175px) and
   * compact-row widths (AC2, enforced by `event-card-date-box-overflow.ts`'s automated check).
   * `EventCardDateBox` does not infer this from `day`'s rendered content — the caller already
   * knows which branch of its own formatter (`formatShortEventDateTimeParts` /
   * `computeCalendarSegmentDateBoxContent`) fired.
   */
  dayVariant?: 'number' | 'word';
  /** Optional amber corner tag content (e.g. "till"). Omitted entirely when not provided. */
  tillLabel?: ReactNode;
  /** Extra classes appended to the date box root. */
  className?: string;
}

/**
 * The event/schedule status badge (`DESIGN.md` § event_card_status_badge, Story 1.i1i AC1).
 * Two shapes only: the shared neutral `base` for 7 of `formatEventStatus`'s 8 states, and
 * the `happening_now` emerald variant for the `happeningNow` state alone — deliberately NOT
 * a general per-state styling mechanism.
 *
 * Non-interactive by design (AC6, `EXPERIENCE.md` Accessibility Floor): no `aria-label`,
 * no tooltip, no independent focus stop. The consumer (`EventCard.tsx`) owns the surrounding
 * badge-row `<div>` and renders this as a sibling child alongside the other badges.
 */
export interface EventCardStatusBadgeProps {
  /** The already-labeled status string — i.e. `formatEventStatus(...).text`. Never re-formatted here. */
  text: string;
  /**
   * `formatEventStatus(...).isHappeningNow` — the surfaced `started && endDayDiff > 0`
   * discriminant (AC4). When true, renders `DESIGN.md`'s `happening_now` emerald variant
   * instead of the default neutral `base`. Defaults to `false`.
   */
  isHappeningNow?: boolean;
  /** Extra classes appended to the badge root. */
  className?: string;
}

/** Label overrides for `EventCardNearbyBadge` (AC3 — matches `EventCardLabels.nearbyBadge`). */
export interface EventCardNearbyBadgeLabels {
  /** Nearby-badge text. Defaults to "Nearby". */
  nearbyBadge?: string;
}

/**
 * The nearby-distance badge (`DESIGN.md` § event_card_nearby_badge, Story 1.i1i AC1/AC2).
 * Self-gating: it renders nothing unless `distanceKm != null && distanceKm < thresholdKm`,
 * so callers never precompute a `showNearbyBadge` boolean locally (Architecture Spine AD-24
 * Rule 2). `<8km` is the one sanctioned threshold (the DESIGN.md 2026-09-14 correction of the
 * shipped `<=5km` bug).
 *
 * Non-interactive by design (AC6, `EXPERIENCE.md` Accessibility Floor): no `aria-label`,
 * no tooltip, no independent focus stop.
 */
export interface EventCardNearbyBadgeProps {
  /**
   * Caller-computed distance in kilometers from the viewer to this event (client-side
   * geolocation math — this primitive performs no location/distance logic itself). Omit/null
   * when the viewer's location is unknown — the badge then renders nothing.
   */
  distanceKm?: number | null;
  /**
   * Distance threshold (km) below which the badge renders. Defaults to `8`
   * (`DESIGN.md` § event_card_nearby_badge); exposed only so an existing caller-level override
   * (`EventCardProps.nearbyBadgeThreshold`) can still be forwarded rather than re-derived.
   */
  thresholdKm?: number;
  /** Optional label overrides for internally-rendered microcopy (i18n-readiness). */
  labels?: EventCardNearbyBadgeLabels;
  /** Extra classes appended to the badge root. */
  className?: string;
}
