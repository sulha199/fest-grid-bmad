"use client"

/** @jsxImportSource react */
// BUG-050 verification: a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- added only so packages/visual-audit's `react-component`
// RenderSpec (which mounts real components through Playwright's own test transform) resolves
// this file's JSX to React's runtime instead of Playwright's internal one. Same fix already
// applied to EventCardMediaPrimitives.tsx/count-badge.tsx/WeeklyCalendarView.tsx/
// EventCardCalendarGridItem.tsx for the identical reason -- see EventCardMediaPrimitives.tsx's
// header comment for the root-cause writeup.
/**
 * EventCardCompact — Story 3.6ua: the mobile calendar row card
 * (`DESIGN.md`/`EVENT-CARD-DESIGN.md` § `components.event_card_compact`), extracted verbatim
 * from `WeeklyCalendarView.tsx`'s `CalendarCard` `variant === 'list'` branch into its own
 * standalone, exported primitive so a non-calendar caller (Story 3.6u's event-detail Related
 * Events section) can reuse the exact same card without exporting a calendar-internal component
 * with dummy calendar props, or duplicating its markup/tokens a second time.
 *
 * Zero behavior change versus the branch it was extracted from (AC1) — `CalendarCard` now
 * delegates to this component internally, passing through the same data it already computed.
 * Takes a flattened, non-generic props contract (AC2, see `EventCardCompact.types.ts`): the
 * date-box content (`dateBoxMonth`/`dateBoxDay`/`dateBoxTillLabel`) is pre-computed by the
 * caller via the existing `computeCalendarSegmentDateBoxContent` helper, while the status badge
 * is computed internally via `formatEventStatus` (asymmetric by design — see the story's Dev
 * Notes § Design Decisions).
 */
import React, { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import {
  EventCardMediaSlot,
  EventCardDateBox,
  EventCardStatusBadge,
  EventCardNearbyBadge,
  EventCardFavoriteBadge,
  EventCardRepeatBadge,
  EVENT_CARD_CONTAINER_CLASS,
} from './EventCardMediaPrimitives';
import { useHoverFocusTooltip } from '../../hooks';
import { formatEventStatus } from './format-event-date';
import {
  badgeFontSizeStyleFor,
  eventCardRowFavoriteIconGrowingStyle,
  EVENT_CARD_ROW_FAVORITE_COUNT_TEXT_SIZE_CLASS,
} from './event-card-media-tokens';
import type { EventCardCompactProps } from './EventCardCompact.types';

/** Moved out of `WeeklyCalendarView.tsx` (Task 2a) — its only other usage there was this same list-variant branch. */
export const EVENT_CARD_COMPACT_CLASS = "rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200 text-left text-xs transition-all hover:bg-violet-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10";
/** Moved out of `WeeklyCalendarView.tsx` (Task 2a) — its only other usage there was this same list-variant branch. */
export const MULTI_DAY_EVENT_CLASS = "w-full bg-violet-50 border border-violet-200 p-1 relative text-left text-xs transition-colors hover:bg-violet-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10";

/**
 * AC3 — loading skeleton matching the real card's layout zones (date-box block, title/
 * location/badge-row block, thumbnail block), per `project-context.md`'s "Keep Skeletons in
 * Sync With Their Real Component" rule.
 */
function EventCardCompactSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className="relative w-full">
      <div
        className={`${EVENT_CARD_COMPACT_CLASS} relative w-full flex items-stretch gap-2 animate-pulse ${className}`}
        aria-busy="true"
        aria-label="Loading event"
      >
        {/* Date-box block */}
        <div className="w-12 shrink-0 rounded bg-gray-200" />
        {/* Title/location/badge-row block */}
        <div className="flex min-w-0 w-full flex-col gap-1.5 justify-center">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-1/3 rounded bg-gray-200" />
        </div>
        {/* Thumbnail block */}
        <div className="w-16 h-16 shrink-0 rounded bg-gray-200" />
      </div>
    </div>
  );
}

/**
 * Standalone, exported mobile calendar-row card (`components.event_card_compact`). See this
 * file's header comment and `EventCardCompact.types.ts` for the full contract.
 */
export function EventCardCompact({
  eventName,
  isMainSchedule,
  locationName,
  dateBoxMonth,
  dateBoxDay,
  dateBoxTillLabel,
  isMultiDayRun = false,
  eventStartDate,
  eventStartTime,
  eventEndDate,
  eventEndTime,
  statusLabels,
  imageUrl,
  imageFallbackUrl,
  isFavorited,
  favoriteCount,
  onFavoriteToggle,
  favoriteToggleLabel,
  isAddedToCalendar,
  addedToCalendarBadgeLabel,
  distanceKm,
  nearbyBadgeLabel,
  nearbyBadgeThreshold,
  applicableDaysOfWeek,
  dayOfWeekLabels,
  repeatBadgeAriaLabel,
  locale,
  timezone,
  onClick,
  loading = false,
  className = '',
}: EventCardCompactProps) {
  // Story 1.3k Task 4 (AC11), kept from the extraction source — needed even though the
  // grid-only time-range tooltip itself is dropped (AC2): the same hover/focus state also
  // drives the repeat badge's own tooltip.
  const { isVisible: interactionVisible, handlers: tooltipHandlers } = useHoverFocusTooltip({
    enabled: true,
  });

  // Story 1.i1m AC1/AC4 — seeded from the caller-supplied `imageUrl`, kept current via
  // `EventCardMediaSlot`'s `onImagePresenceChange`, mirroring `EventCard.tsx`'s identical
  // masonry-side pattern. Local component state only.
  const [imagePresent, setImagePresent] = useState(!!imageUrl);

  if (loading) {
    return <EventCardCompactSkeleton className={className} />;
  }

  const weightClass = isMainSchedule ? "font-bold" : "font-normal";
  const multiDayRoundingClass = isMultiDayRun ? "rounded-md" : "";
  const baseButtonClass = isMultiDayRun ? MULTI_DAY_EVENT_CLASS : EVENT_CARD_COMPACT_CLASS;

  // AC2, Design Decision #2 — computed internally, not pre-computed by the caller: this helper
  // isn't calendar-bucket-specific (masonry `EventCard.tsx` already calls it the same way).
  const { text: statusText, variant: statusVariant } = formatEventStatus(
    locale,
    timezone,
    new Date(),
    eventStartDate,
    eventStartTime,
    eventEndDate,
    eventEndTime,
    statusLabels
  );

  const repeatBadge = (
    <EventCardRepeatBadge
      daysOfWeek={applicableDaysOfWeek}
      dayOfWeekLabels={dayOfWeekLabels}
      repeatBadgeAriaLabel={repeatBadgeAriaLabel}
      tooltipVisible={interactionVisible}
    />
  );

  return (
    <div className={`relative w-full ${className}`}>
      {/* Story 1.i1m AC6/AC7/Task 3.2/4.1: this row is the CSS container-query root
          (`EVENT_CARD_CONTAINER_CLASS`, reused from Story 1.i1l's masonry mechanism, not
          redefined) for the favorite badge's continuous growth and stepped count text
          (Task 4), and the AD-15 icon-scale custom property's declaration point
          (`badgeFontSizeStyleFor('compact')`). Declaring it here — not on the media slot,
          which may not exist in the DOM once the image is absent/errored (AC1) — is what
          lets the externally-composed favorite badge below inherit both mechanisms via
          ordinary CSS whether or not the slot is mounted. */}
      <div
        data-testid="event-card-compact"
        className={`${baseButtonClass} ${multiDayRoundingClass} relative w-full flex items-stretch gap-2 ${EVENT_CARD_CONTAINER_CLASS}`}
        style={badgeFontSizeStyleFor('compact')}
      >
        <button
          type="button"
          tabIndex={0}
          className="min-w-0 flex-1 flex items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:z-10 rounded-md"
          onClick={onClick}
          onKeyDown={tooltipHandlers.onKeyDown}
          onFocus={tooltipHandlers.onFocus}
          onBlur={tooltipHandlers.onBlur}
          onPointerEnter={tooltipHandlers.onPointerEnter}
          onPointerLeave={tooltipHandlers.onPointerLeave}
        >
          <EventCardDateBox
            size="compact"
            month={dateBoxMonth}
            day={dateBoxDay}
            tillLabel={dateBoxTillLabel}
          />
          <span className="flex min-w-0 w-full flex-col text-left">
            {/* Rule 6 (Story 1.i1l, DESIGN.md § event_card_compact.title): the title wraps
                to 2 lines. The parent's own `truncate` is removed deliberately — leaving it
                clips the row to one line and makes the child's `line-clamp-2` a no-op — and
                `items-center` becomes `items-start` so the inline favorited /
                added-to-calendar icons pin to the first line rather than centring against a
                2-line block. */}
            <span className="flex items-start gap-1 w-full text-left">
              {/* User feedback (2026-09-27): "should not have favorite icon+count on the
                  event-title area" -- the isFavorited Heart icon that used to sit inline here
                  is removed; favorite state is only shown via the real interactive favorite
                  control (the thumbnail's own corner pill / large fallback icon below). */}
              {isAddedToCalendar && (
                <CalendarPlus className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0 inline" aria-label={addedToCalendarBadgeLabel || 'Added to calendar'} data-testid="calendar-plus-icon" />
              )}
              {/* Story 1.3k (AC7) — outside the title's own `line-clamp-2` span so it is never
                  clipped; before the title text, beside the added-to-calendar icon. */}
              {repeatBadge}
              <span className={`${weightClass} line-clamp-2 block`}>{eventName}</span>
            </span>
            {/* User feedback (2026-09-27): "should show location-name in one line, break-word:
                all" -- single line (`line-clamp-1`) with mid-word breaking (`break-all`) if a
                single long word overflows, matching masonry's own locationName treatment
                (minus the centering, which wasn't asked for here). */}
            {locationName && (
              <span className="text-xs text-muted-foreground line-clamp-1 break-all mt-0.5">
                {locationName}
              </span>
            )}
            {/* AC2/AC3/AC4 (Story 1.i1j) — status + nearby badges, appended as the content
                column's last child. Mirrors EventCard.tsx's masonry `badge_row` classes for
                visual family consistency. */}
            <span className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <EventCardStatusBadge text={statusText} variant={statusVariant} />
              <EventCardNearbyBadge
                distanceKm={distanceKm}
                thresholdKm={nearbyBadgeThreshold}
                labels={{ nearbyBadge: nearbyBadgeLabel }}
              />
            </span>
          </span>
        </button>
        <EventCardMediaSlot
          layout="fixed-square"
          size="compact"
          imageUrl={imageUrl}
          imageFallbackUrl={imageFallbackUrl}
          imageAlt={eventName}
          collapseOnFallback
          // The with-image favorite pill is composed externally below (card-corner position,
          // like the TILL tag) -- the slot itself renders no favorite control at all (Story
          // 1.i1p removed that capability once every real caller was found to suppress it).
          onImagePresenceChange={setImagePresent}
        />
        {imagePresent && (
          <EventCardFavoriteBadge
            scale="default"
            isFavorited={isFavorited}
            favoriteCount={favoriteCount}
            onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle() : undefined}
            labels={{ favoriteToggle: favoriteToggleLabel }}
            // Mirrors the TILL tag's own `-top-1.5 -left-1.5` corner offset on the opposite
            // (top-right) corner of the card container, which is `relative` (above) and not
            // `overflow-hidden`.
            className="absolute -top-1.5 -right-1.5 z-30"
            iconSizeStyle={{ width: '12px', height: '12px' }}
          />
        )}
        {/* Story 1.i1m AC1/AC4: the favorite control, externally composed as a plain flex
            sibling (not absolutely positioned — unlike masonry's `EventCard.tsx` overlay,
            this row has no image to overlay when collapsed, so the badge is simply the
            row's last flex child) whenever the media slot above has collapsed to `null`.
            With an image present, the externally composed corner pill above renders
            instead (the slot itself never renders a favorite control of its own — Story
            1.i1p removed that capability from `EventCardMediaSlot` entirely), so this and
            that pill are mutually exclusive, never both. */}
        {!imagePresent && (
          <EventCardFavoriteBadge
            scale="large"
            isFavorited={isFavorited}
            favoriteCount={favoriteCount}
            onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle() : undefined}
            labels={{ favoriteToggle: favoriteToggleLabel }}
            iconSizeStyle={eventCardRowFavoriteIconGrowingStyle()}
            largeTextSizeClassName={EVENT_CARD_ROW_FAVORITE_COUNT_TEXT_SIZE_CLASS}
          />
        )}
      </div>
    </div>
  );
}
