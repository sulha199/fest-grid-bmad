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
 *
 * This file is build-only for Story 1.i1a: it is NOT wired into `EventCard.tsx` or
 * `WeeklyCalendarView.tsx`. Adoption is deliberately split into Stories 1.i1b–1.i1e.
 *
 * @see event-card-media-tokens.ts        — the icon-scale CSS-custom-property token family
 * @see EventCardMediaPrimitives.types.ts — exported prop interfaces
 */
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import {
  EVENT_CARD_BADGE_FONT_SIZE,
  EVENT_CARD_BADGE_FONT_SIZE_VAR,
  eventCardBadgeIconSizeClass,
} from './event-card-media-tokens';
import type {
  EventCardMediaSlotProps,
  EventCardFavoriteBadgeProps,
  EventCardDateBoxProps,
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
          <div className="flex items-center justify-center w-full h-full">
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

  const iconClass = eventCardBadgeIconSizeClass(scale);
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
        className={`${iconClass} ${
          isLarge
            ? 'text-rose-500'
            : isFavorited
              ? 'fill-red-600 text-red-600'
              : 'text-black'
        }`}
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
