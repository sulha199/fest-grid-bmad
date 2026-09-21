"use client"

/**
 * EventCardMediaPrimitives.tsx
 *
 * The shared `event_card_*` media primitives (Epic 1.i1 / Story 1.i1a):
 *  - `EventCardMediaSlot`  — the image/fallback slot that owns its dimensions and the
 *    reserved-blank fallback, switching between a small corner favorite pill (image
 *    present+ok) and the large centered favorite control (image absent/errored).
 *  - `EventCardFavoriteBadge` — the favorite heart+count control at either `default`
 *    (small corner pill) or `large` (borderless, centered in an empty slot) scale.
 *  - `EventCardDateBox` — thin styled wrapper for the date box; the concrete `text-xs`
 *    font-size source the icon-scale token (AD-15) is calibrated against.
 *  - `EventCardStatusBadge` / `EventCardNearbyBadge` — the status (`formatEventStatus`'s 8
 *    states, with `DESIGN.md`'s one `happeningNow` emerald exception) and `<8km`-gated
 *    nearby-distance badges (Story 1.i1i / AD-24). Unlike the primitives above, these two
 *    ARE consumed by `EventCard.tsx`'s masonry branch as of Story 1.i1i; adoption by
 *    `WeeklyCalendarView.tsx`'s compact row and `EventCardCalendarGridItem` is deferred to
 *    Stories 1.i1j / 1.i1f.
 *
 * Story 1.i1a built the media primitives standalone; Stories 1.i1b–1.i1e adopted them.
 *
 * @see event-card-media-tokens.ts        — the icon-scale CSS-custom-property token family
 * @see EventCardMediaPrimitives.types.ts — exported prop interfaces
 */
import React, { useState, useEffect } from 'react';
import { Heart, Navigation } from 'lucide-react';
import {
  EVENT_CARD_BADGE_FONT_SIZE,
  EVENT_CARD_BADGE_FONT_SIZE_VAR,
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
  eventCardBadgeIconSizeStyle,
} from './event-card-media-tokens';
import type {
  EventCardMediaSlotProps,
  EventCardFavoriteBadgeProps,
  EventCardDateBoxProps,
  EventCardStatusBadgeProps,
  EventCardNearbyBadgeProps,
} from './EventCardMediaPrimitives.types';

/** Inline style declaring the shared badge-font-size custom property on a primitive root. */
const badgeFontSizeStyle = {
  [EVENT_CARD_BADGE_FONT_SIZE_VAR]: EVENT_CARD_BADGE_FONT_SIZE,
} as React.CSSProperties & Record<string, string>;

/**
 * The image/fallback slot. Owns image-slot dimensions (from the surrounding chrome,
 * never the image's natural size) and the reserved-blank fallback.
 */
export function EventCardMediaSlot({
  imageUrl,
  imageAlt,
  layout,
  isFavorited = false,
  favoriteCount,
  onFavoriteToggle,
  labels,
  className = '',
  hideFavoriteBadge = false,
  onImagePresenceChange,
}: EventCardMediaSlotProps) {
  // Same onError detection EventCard.tsx's existing `imgError` state uses (AC3).
  const [imgError, setImgError] = useState(false);
  const imagePresent = !!imageUrl && !imgError;

  // Notify an external caller (only when one is supplied) of the local
  // image-presence state, including the initial mount value — Story 1.i1e uses
  // this so a RootTag-external favorite badge knows the active scale.
  useEffect(() => {
    onImagePresenceChange?.(imagePresent);
  }, [imagePresent, onImagePresenceChange]);

  const layoutClasses =
    layout === 'flex-fill' ? 'flex-1 h-full min-w-0' : 'w-16 h-16 shrink-0';

  return (
    <div
      data-event-card-media-slot=""
      style={badgeFontSizeStyle}
      className={`relative overflow-hidden rounded-md ${layoutClasses} ${className}`}
    >
      {imagePresent ? (
        <>
          <img
            src={imageUrl}
            alt={imageAlt ?? ''}
            onError={() => setImgError(true)}
            className="object-cover w-full h-full"
          />
          {!hideFavoriteBadge && onFavoriteToggle && (
            <EventCardFavoriteBadge
              scale="default"
              isFavorited={isFavorited}
              favoriteCount={favoriteCount}
              onFavoriteToggle={onFavoriteToggle}
              labels={labels}
              className="absolute top-1 right-1 z-10"
            />
          )}
        </>
      ) : (
        // Reserved-blank fallback (AC3): no image, no placeholder icon, no placeholder
        // text — the slot keeps its exact AC1 footprint and only the large, centered
        // favorite badge renders (AC2/AC4).
        !hideFavoriteBadge &&
        onFavoriteToggle && (
          // min-height guards this the same way EventCard.tsx's own sibling-badge
          // wrapper does: a `layout="flex-fill"` slot inherits a short height from
          // whatever row it's stretched to match (e.g. a short date box), which is
          // shorter than the `large` badge's own min-h-11 touch target below --
          // without this, the badge overflows and gets clipped by this slot's own
          // `overflow-hidden` (see event-card-media-tokens.ts EVENT_CARD_BADGE_MIN_TOUCH_REM).
          <div
            className="flex items-center justify-center w-full h-full"
            style={{ minHeight: `${EVENT_CARD_BADGE_MIN_TOUCH_REM}rem` }}
          >
            <EventCardFavoriteBadge
              scale="large"
              isFavorited={isFavorited}
              favoriteCount={favoriteCount}
              onFavoriteToggle={onFavoriteToggle}
              labels={labels}
            />
          </div>
        )
      )}
    </div>
  );
}

/**
 * The favorite heart+count control. Exported standalone so Story 1.i1b can import it
 * directly to replace `EventCard`'s current inline corner-heart JSX.
 */
export function EventCardFavoriteBadge({
  scale,
  isFavorited = false,
  favoriteCount,
  onFavoriteToggle,
  labels = {},
  className = '',
}: EventCardFavoriteBadgeProps) {
  // AC5 — match EventCard's existing labels/defaultLabels merge pattern exactly
  // (same key `favoriteToggle`, same default string), never a second labels shape.
  const defaultLabels = { favoriteToggle: 'Toggle favorite', ...labels };

  // The favorite control renders only when the caller supplies a toggle handler
  // (mirrors EventCard's `{onFavoriteToggle && …}` behavior).
  if (!onFavoriteToggle) {
    return null;
  }

  const iconSizeStyle = eventCardBadgeIconSizeStyle(scale);
  const isLarge = scale === 'large';

  return (
    <button
      type="button"
      aria-label={defaultLabels.favoriteToggle}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFavoriteToggle(e);
      }}
      className={
        isLarge
          ? `flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 text-sm font-medium text-foreground ${className}`
          : `flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors ${
              favoriteCount !== undefined ? 'px-2.5 py-1.5 gap-1.5' : 'p-2'
            } ${className}`
      }
    >
      <Heart
        // lucide's own `size` prop would be silently overridden by this `style` --
        // don't add one here without removing/reconciling this instead.
        style={iconSizeStyle}
        className={
          isLarge
            ? 'text-rose-500'
            : isFavorited
              ? 'fill-red-600 text-red-600'
              : 'text-black'
        }
        fill={isFavorited ? 'currentColor' : 'none'}
      />
      {favoriteCount !== undefined && (
        <span className="text-xs font-semibold select-none">{favoriteCount}</span>
      )}
    </button>
  );
}

/**
 * Thin styled wrapper for the event-card date box. Takes already-formatted `children`
 * (no date/locale formatting is reimplemented here) and is the concrete `text-xs`
 * font-size source the icon-scale token keys off (`DESIGN.md` § event_card_date_box.base_default).
 */
export function EventCardDateBox({ children, className = '' }: EventCardDateBoxProps) {
  return (
    <span
      style={badgeFontSizeStyle}
      data-event-card-date-box=""
      className={`relative flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-white shadow-sm text-xs font-semibold shrink-0 ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * The event/schedule status badge (`DESIGN.md` § event_card_status_badge, Story 1.i1i AC1).
 * Takes the already-labeled `formatEventStatus` string (no date/locale logic is reimplemented
 * here) and applies exactly one of that token's two shapes: the shared neutral `base` for the
 * 7 non-`happeningNow` states, or `happening_now`'s solid emerald fill for `happeningNow` —
 * the single deliberate per-state exception, never a general per-state styling mechanism.
 *
 * Exported standalone (AC5) so the future `EventCardRepeatBadge` (Story 1.3k) can be inserted
 * between it and `EventCardNearbyBadge` inside the consumer's badge-row `<div>` without either
 * component — or the row itself — being modified.
 */
export function EventCardStatusBadge({
  text,
  isHappeningNow = false,
  className = '',
}: EventCardStatusBadgeProps) {
  return (
    <span
      data-event-card-status-badge=""
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
        isHappeningNow ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
      } ${className}`}
    >
      {text}
    </span>
  );
}

/**
 * The nearby-distance badge (`DESIGN.md` § event_card_nearby_badge, Story 1.i1i AC1/AC2).
 * Self-gating (AC1, mirroring `EventCardFavoriteBadge`'s early-return convention): renders
 * nothing unless the caller passes a known `distanceKm` below `thresholdKm` (default `8`), so
 * no consumer needs to precompute a `showNearbyBadge` boolean or re-derive the threshold
 * (Architecture Spine AD-24 Rule 2). Omitted entirely — never a disabled/placeholder state.
 *
 * Exported standalone (AC5) rather than as part of a combined badge-row primitive.
 */
export function EventCardNearbyBadge({
  distanceKm,
  thresholdKm = 8,
  labels = {},
  className = '',
}: EventCardNearbyBadgeProps) {
  // AC3 — match EventCard's existing labels/defaultLabels merge pattern exactly (same key
  // `nearbyBadge`, same default string), never a second labels shape.
  const defaultLabels = { nearbyBadge: 'Nearby', ...labels };

  if (distanceKm == null || distanceKm >= thresholdKm) {
    return null;
  }

  return (
    <span
      data-event-card-nearby-badge=""
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground ${className}`}
    >
      <Navigation className="w-3 h-3" />
      {defaultLabels.nearbyBadge}
    </span>
  );
}
