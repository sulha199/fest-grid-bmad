"use client"

/** @jsxImportSource react */
// BUG-050 verification: a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- added only so packages/visual-audit's `react-component`
// RenderSpec (which mounts real components through Playwright's own test transform) resolves
// this file's JSX to React's runtime instead of Playwright's internal one. Same fix already
// applied to EventCardMediaPrimitives.tsx/count-badge.tsx/WeeklyCalendarView.tsx for the
// identical reason -- see EventCardMediaPrimitives.tsx's header comment for the root-cause writeup.
/**
 * EventCardCalendarGridItem — the desktop Calendar Grid Item Card primitive
 * (`DESIGN.md` § `event_card_calendar_grid_item`, Story 1.i1f Task 7).
 *
 * Wired into `WeeklyCalendarView.tsx`'s multi-day spanning bar (`MultiDaySpanningBar`, Story
 * 1.i1g) and, as of BUG-048, its single-day desktop grid cell (`CalendarCard`, `variant='grid'`)
 * too — both compose it inside a `pointer-events-none` visual layer sitting on top of a real
 * click-target `<button>`, per that pattern's own doc comment. `CalendarOverflowDialog` (Story
 * 1.i1h) also renders it directly for its no-image composition.
 *
 * A multi-day schedule (`isMultiDay`) always uses the with-image 3-column row layout, whether or
 * not it actually has a usable image (2026-09-27, user feedback: "replace the grid layout to use
 * the grid from multiday span with thumbnail, with the thumbnail not displayed") -- the `<img>`
 * element itself is simply omitted when absent/errored. Only a single-day schedule
 * (`!isMultiDay`) uses the separate two-row stacked composition, since VM5 never attempts an
 * image at all.
 *
 * No status badge in either composition (BUG-048/AC-STATUS-1 briefly added one, 2026-09-26;
 * reversed 2026-09-27, user feedback: "don't show the now/ending_at badge").
 *
 * @see EventCardMediaPrimitives.tsx — reused `EventCardFavoriteBadge` (large scale) and
 *   `EventCardNearbyBadge` (the shared, self-gating `< thresholdKm` badge)
 */
import React, { useState, useEffect } from 'react';
import {
  EventCardFavoriteBadge,
  EventCardNearbyBadge,
  formatNearbyBadgeDistance,
} from './EventCardMediaPrimitives';
import type { EventCardCalendarGridItemProps } from './EventCardCalendarGridItem.types';

export function EventCardCalendarGridItem({
  eventName,
  location,
  imageUrl,
  imageFallbackUrl,
  imageAlt,
  isMultiDay,
  isFavorited = false,
  favoriteCount,
  onFavoriteToggle,
  distanceKm,
  nearbyBadgeThreshold = 8,
  labels = {},
}: EventCardCalendarGridItemProps) {
  const defaultLabels = {
    favoriteToggle: 'Toggle favorite',
    ...labels,
    // BUG-049 review finding: set after the spread with `??`, not spread-after-default, so an
    // explicit `labels={{ nearbyBadge: undefined }}` still falls back to the formatter instead
    // of crashing `EventCardNearbyBadge` when it calls `defaultLabels.nearbyBadge(distanceKm)`.
    nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance,
  };

  // BUG-042 (AC-IMG-1): the same imageUrl -> imageFallbackUrl -> reserved-blank retry-once chain
  // `EventImage.tsx`/`EventCardMediaSlot` already implement — `onError` swaps to
  // `imageFallbackUrl` once (`hasTriedFallback`), then sets the terminal `imgError` (no
  // broken-image icon/placeholder ever rendered). Only the with-image (multi-day) composition
  // below ever consults this chain — the single-day, image-less composition stays deliberately
  // image-less by design (VM5, `event-card-family-consolidated-acs.md` §1).
  //
  // Code-review fix (BUG-042 loopback): "on missing/onError, fall back" covers a `null`/
  // `undefined` `imageUrl` from the first render too, not just a later `onError` — the original
  // cut only wired the fallback into `onError`, so a multi-day schedule with no primary image at
  // all never attempted `imageFallbackUrl` and fell straight to the no-image composition.
  // `currentImgSrc` now starts at `imageUrl ?? imageFallbackUrl`, and `hasTriedFallback` starts
  // `true` whenever that initial pick was already the fallback — an error on that starting image
  // goes straight to the terminal state instead of re-"falling back" to the same URL. The
  // `imageFallbackUrl !== currentImgSrc` guard below covers the sibling case where both URLs are
  // identical: without it `setCurrentImgSrc` would be a no-op, `onError` would never refire, and
  // `showImage` would stay `true` on a permanently broken `<img>` instead of ever falling to the
  // no-image composition.
  const [imgError, setImgError] = useState(false);
  const [currentImgSrc, setCurrentImgSrc] = useState<string | null | undefined>(imageUrl ?? imageFallbackUrl ?? undefined);
  const [hasTriedFallback, setHasTriedFallback] = useState(!imageUrl && !!imageFallbackUrl);

  useEffect(() => {
    setCurrentImgSrc(imageUrl ?? imageFallbackUrl ?? undefined);
    setHasTriedFallback(!imageUrl && !!imageFallbackUrl);
    setImgError(false);
  }, [imageUrl, imageFallbackUrl]);

  const handleImageError = () => {
    if (imageFallbackUrl && imageFallbackUrl !== currentImgSrc && !hasTriedFallback) {
      setHasTriedFallback(true);
      setCurrentImgSrc(imageFallbackUrl);
    } else {
      setImgError(true);
    }
  };

  // AC15 — image is conditional, never a reserved slot (deliberate divergence from
  // the masonry/row cards' reserved-space-not-reflow convention): only a multi-day
  // schedule with a non-errored image attempts the with-image composition.
  const showImage = isMultiDay && !!currentImgSrc && !imgError;

  const favoriteBadge = (
    <EventCardFavoriteBadge
      scale="large"
      isFavorited={isFavorited}
      favoriteCount={favoriteCount}
      onFavoriteToggle={onFavoriteToggle}
      labels={defaultLabels}
    />
  );

  // AC15/DESIGN.md event_card_nearby_badge — the shared, self-gating `EventCardNearbyBadge`
  // (Story 1.i1i AC1/AC2) owns the `< thresholdKm` gate, the badge markup, and the
  // "omit entirely otherwise" behaviour, so this card only forwards the caller's distance and
  // threshold and never re-derives a `showNearbyBadge` boolean of its own (Architecture Spine
  // AD-24 Rule 2). Replaced 1.i1f's hand-rolled badge JSX — Story 1.i1f review finding
  // FIND-045, resolved once 1.i1i's shared primitive landed.
  const nearbyBadge = (
    <EventCardNearbyBadge
      distanceKm={distanceKm}
      thresholdKm={nearbyBadgeThreshold}
      // Only the badge's own key — `defaultLabels` also carries `favoriteToggle`, and passing
      // the widened object would hand `EventCardNearbyBadgeLabels` a key outside its contract
      // (TypeScript's excess-property check does not fire for a non-literal object). Matches
      // `EventCard.tsx`'s own call site, which narrows the same way.
      labels={{ nearbyBadge: defaultLabels.nearbyBadge }}
    />
  );

  // User feedback (2026-09-27): the status badge ("Now"/"Ends hh:mm"/etc, BUG-048/AC-STATUS-1)
  // is removed from this card entirely -- both compositions below now render only
  // `favoriteBadge`/`nearbyBadge`. This reverses BUG-048's adoption and restores the ORIGINAL
  // 2026-09-14 "no status badge on this composition" decision documented in
  // EVENT-CARD-DESIGN.md's event_card_calendar_grid_item token (which BUG-048 had explicitly
  // marked as "being revisited... do not treat as settled" -- now resolved back to "no badge").

  // User feedback (2026-09-27): a multi-day schedule with NO thumbnail (image missing/errored)
  // now uses this SAME with-image row layout instead of falling through to the single-day (VM5)
  // 2-row stacked composition below -- just without the `<img>` element ("replace the grid
  // layout to use the grid from multiday span with thumbnail, with the thumbnail not
  // displayed"). Single-day schedules (`!isMultiDay`) never reach this branch at all -- VM5
  // never attempts an image, per DESIGN.md, and keeps its own established 2-row layout.
  if (isMultiDay) {
    return (
      // User feedback (2026-09-27): "I should see the grid, make the card's bg color to have 50%
      // opacity" -- `bg-violet-50` (solid) -> `bg-violet-50/50`, so the underlying weekly grid
      // lines remain visible through the card.
      <div className="flex items-center gap-2 rounded-md shadow-sm p-2 bg-violet-50/50 border border-violet-200">
        {showImage && (
          <img
            src={currentImgSrc!}
            alt={imageAlt ?? ''}
            onError={handleImageError}
            className="w-14 aspect-square object-cover rounded-md"
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center">
          <h3 className="text-sm font-bold">{eventName}</h3>
          {location && <p className="text-xs text-muted-foreground line-clamp-2">{location}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {favoriteBadge}
          {nearbyBadge}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md shadow-sm p-2 bg-violet-50/50 border border-violet-200">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold flex-1">{eventName}</h3>
        {favoriteBadge}
      </div>
      <div className="flex items-center justify-between gap-2">
        {location && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{location}</p>}
        {nearbyBadge}
      </div>
    </div>
  );
}
