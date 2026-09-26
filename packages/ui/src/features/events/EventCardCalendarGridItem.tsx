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
 * @see EventCardMediaPrimitives.tsx — reused `EventCardFavoriteBadge` (large scale),
 *   `EventCardNearbyBadge` (the shared, self-gating `< thresholdKm` badge), and
 *   `EventCardStatusBadge` (BUG-048, AC-STATUS-1 — rendered only when `eventStartDate` is passed)
 * @see format-event-date.ts — `formatEventStatus`, computed internally once `eventStartDate` is present
 */
import React, { useState } from 'react';
import {
  EventCardFavoriteBadge,
  EventCardNearbyBadge,
  EventCardStatusBadge,
  formatNearbyBadgeDistance,
} from './EventCardMediaPrimitives';
import { formatEventStatus } from './format-event-date';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
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
  eventStartDate,
  eventStartTime,
  eventEndDate,
  eventEndTime,
  statusLabels,
  locale: localeProp,
  timezone: timezoneProp,
}: EventCardCalendarGridItemProps) {
  // BUG-048 (AC-STATUS-1) — same "explicit prop overrides scoped context" convention EventCard.tsx
  // already uses (project-context.md's Scoped locale/timezone context rule); every VM5/VM6 caller
  // already has `locale`/`timezone` in scope and passes them explicitly.
  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();
  // `||`, not `??`, for both — matches `EventCard.tsx`/`WeeklyCalendarView.tsx`'s identical
  // `activeLocale`/`activeTimezone` resolution exactly (an explicit empty string falls through
  // to context the same way an omitted prop does, on both fields).
  const locale = localeProp || contextLocale;
  const timezone = timezoneProp || contextTimezone;
  const defaultLabels = {
    favoriteToggle: 'Toggle favorite',
    ...labels,
    // BUG-049 review finding: set after the spread with `??`, not spread-after-default, so an
    // explicit `labels={{ nearbyBadge: undefined }}` still falls back to the formatter instead
    // of crashing `EventCardNearbyBadge` when it calls `defaultLabels.nearbyBadge(distanceKm)`.
    nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance,
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
      // Only the badge's own key — `defaultLabels` also carries `favoriteToggle`, and passing
      // the widened object would hand `EventCardNearbyBadgeLabels` a key outside its contract
      // (TypeScript's excess-property check does not fire for a non-literal object). Matches
      // `EventCard.tsx`'s own call site, which narrows the same way.
      labels={{ nearbyBadge: defaultLabels.nearbyBadge }}
    />
  );

  // BUG-048 (AC-STATUS-1) — one shared computation for both VM5 (single-day grid cell) and VM6
  // (multi-day spanning bar), gated on `eventStartDate` being supplied at all: a caller with no
  // date info (e.g. `CalendarOverflowDialog`, not yet amended) renders no badge, same as before
  // this change, rather than crashing or showing a meaningless "Ended"/"Upcoming" guess.
  //
  // The rendered element is the same in both compositions below, but its *position* deliberately
  // follows each composition's own pre-existing layout rather than a single shared slot: stacked
  // vertically alongside `favoriteBadge`/`nearbyBadge` in the with-image row (matching that row's
  // existing `flex-col items-end` badge column), inline with `nearbyBadge` in a wrapping row in
  // the no-image layout (matching that layout's existing bottom row). Intentional, not an
  // oversight — each composition keeps its own established badge arrangement.
  const statusBadge = eventStartDate ? (
    <EventCardStatusBadge
      {...formatEventStatus(
        locale,
        timezone,
        new Date(),
        eventStartDate,
        eventStartTime,
        eventEndDate,
        eventEndTime,
        statusLabels
      )}
    />
  ) : null;

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
          {statusBadge}
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
        <span className="flex items-center gap-1.5 flex-wrap shrink-0">
          {statusBadge}
          {nearbyBadge}
        </span>
      </div>
    </div>
  );
}
