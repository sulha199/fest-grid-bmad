"use client"

/**
 * EventCardCalendarGridItem — the desktop Calendar Grid Item Card primitive
 * (`DESIGN.md` § `event_card_calendar_grid_item`, Story 1.i1f Task 7).
 *
 * Built and tested standalone. NOT wired into `WeeklyCalendarView.tsx`'s
 * `variant='grid'` render branch — that branch keeps rendering today's plain-text
 * `CalendarCard` unchanged. Adoption into the live multi-day spanning bar and the
 * single-day/overflow-dialog surface is deferred to Stories 1.i1g/1.i1h.
 *
 * @see EventCardMediaPrimitives.tsx — reused `EventCardFavoriteBadge` (large scale)
 *   and `EventCardNearbyBadge` (the shared, self-gating `< thresholdKm` badge)
 */
import React, { useState } from 'react';
import { EventCardFavoriteBadge, EventCardNearbyBadge } from './EventCardMediaPrimitives';
import type { EventCardCalendarGridItemProps } from './EventCardCalendarGridItem.types';

export function EventCardCalendarGridItem({
  eventName,
  location,
  imageUrl,
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
    nearbyBadge: 'Nearby',
    ...labels,
  };

  // Same onError detection EventCard.tsx's existing `imgError` state uses.
  const [imgError, setImgError] = useState(false);

  // AC15 — image is conditional, never a reserved slot (deliberate divergence from
  // the masonry/row cards' reserved-space-not-reflow convention): only a multi-day
  // schedule with a non-errored image attempts the with-image composition.
  const showImage = isMultiDay && !!imageUrl && !imgError;

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
      labels={defaultLabels}
    />
  );

  if (showImage) {
    return (
      <div className="flex items-center gap-2 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200">
        <img
          src={imageUrl!}
          alt={imageAlt ?? ''}
          onError={() => setImgError(true)}
          className="w-14 aspect-square object-cover rounded-md"
        />
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
    <div className="flex flex-col gap-1 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200">
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
