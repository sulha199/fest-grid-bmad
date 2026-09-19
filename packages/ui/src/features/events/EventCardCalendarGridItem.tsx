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
 */
import React, { useState } from 'react';
import { Navigation } from 'lucide-react';
import { EventCardFavoriteBadge } from './EventCardMediaPrimitives';
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

  // AC15/DESIGN.md event_card_nearby_badge — <8km gated, omitted entirely otherwise.
  const showNearbyBadge = distanceKm != null && distanceKm < 8;

  const favoriteBadge = (
    <EventCardFavoriteBadge
      scale="large"
      isFavorited={isFavorited}
      favoriteCount={favoriteCount}
      onFavoriteToggle={onFavoriteToggle}
      labels={defaultLabels}
    />
  );

  const nearbyBadge = showNearbyBadge && (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground">
      <Navigation className="w-3 h-3" />
      {defaultLabels.nearbyBadge}
    </span>
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
