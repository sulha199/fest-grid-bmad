"use client"

/** @jsxImportSource react */
// The pragma above is a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- it exists only so packages/visual-audit's `react-component`
// RenderSpec (which mounts this component through Playwright's test transform) doesn't have this
// file's JSX default to Playwright's own internal `playwright/jsx-runtime` instead of React's.
// Same fix as `count-badge.tsx`/`EventCardMediaPrimitives.tsx`; see either file's header for the
// direct repro this is based on.
import React, { useState, useLayoutEffect, useRef } from 'react';
import { MapPin, Heart, Clock } from 'lucide-react';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
import type { EventCardProps } from './EventCard.types';
import {
  getEventDayDiff,
  computeEventCardDateBoxParts,
  formatEventCardDateBoxLine,
  formatEventTime,
  formatEventStatus,
  combineDateTime,
  getLocalDateInTimezone,
  getCalendarDayDifference,
} from './format-event-date';
import {
  eventCardBadgeIconSizeStyle,
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
} from './event-card-media-tokens';
import {
  EventCardDateBox,
  EventCardMediaSlot,
  EventCardFavoriteBadge,
  EventCardStatusBadge,
  EventCardNearbyBadge,
  eventCardTillLabelClass,
  EVENT_CARD_BADGE_TEXT_SIZE_CLASS,
  EVENT_CARD_CONTAINER_CLASS,
  EVENT_CARD_TITLE_TEXT_SIZE_CLASS,
} from './EventCardMediaPrimitives';

/**
 * EventCard is a reusable, framework-agnostic presentation component for displaying
 * an event's summary information, including its image, name, date, and optional
 * location. `categories`/`types`/`priceFrom` remain on `EventCardProps` for callers
 * but are currently accepted-and-ignored -- FIND-053 removed their only renderer
 * (the `variant='standard'` caption) without removing the props themselves; see
 * the deferred-work entry for that follow-up.
 * 
 * It supports a loading skeleton state (`loading={true}`) for non-blocking initial loads,
 * and graceful fallback states for missing or broken images.
 * 
 * It also reserves an interactive slot for a "Quick Favorite" toggle, which is rendered
 * only when `onFavoriteToggle` is provided.
 * 
 * @example
 * ```tsx
 * <EventCard 
 *   eventName="Summer Fest" 
 *   startDate={new Date()} 
 *   imageUrl="https://..." 
 *   href="/events/summer-fest" 
 * />
 * ```
 */
export function EventCard({
  isGreyedOut = false,
  eventName,
  startDate,
  startTime,
  locale,
  timezone,
  imageUrl,
  imageAlt,
  loading = false,
  locationName,
  pendingRemoval = false,
  isFavorited = false,
  favoriteCount,
  onFavoriteToggle,
  href,
  onClick,
  labels = {},
  statusBadge,
  endDate,
  endTime,
  prominentPoster = false,
  distanceKm,
  nearbyBadgeThreshold = 8,
}: EventCardProps) {
  const defaultLabels = {
    loading: 'Loading event details',
    favoriteToggle: 'Toggle favorite',
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    statusEnded: 'Ended',
    statusHappeningNow: 'Now',
    statusEndsToday: 'Ends Today',
    statusInHours: 'In {n} hour(s)',
    statusInDays: 'In {n} days',
    statusUpcoming: 'Upcoming',
    tillLabel: 'till',
    nearbyBadge: 'Nearby',
    ...labels,
  };

  const [imgError, setImgError] = useState(false);

  // FIND-053: `variant='standard'` was dead code (EventListView, the only production call
  // site, always passed `variant="masonry"`), so it was removed. `variant` itself stays on
  // EventCardProps for callers (now narrowed to `'masonry'`) but is no longer destructured/
  // read here -- masonry is the only remaining variant, so every branch that used to be
  // gated on `isMasonry` is now unconditional.

  // Story 1.i1e — masonry `prominentPoster=false` ("masonry default") composition.
  const isMasonryDefault = !prominentPoster;

  // Task 2.2 — whether the default-state thumbnail currently has a valid image, so
  // the RootTag-external favorite badge knows its scale ('default' vs 'large').
  // Seeded from the imageUrl prop and kept current via EventCardMediaSlot's
  // onImagePresenceChange. Local component state only — not Server/URL/Global.
  const [defaultThumbnailImagePresent, setDefaultThumbnailImagePresent] = useState<boolean>(() => !!imageUrl);

  // Task 2.3 — sibling favorite badge (large / image-absent case) centering: measured
  // once on layout from the date box's own box so the badge centers within just the
  // thumbnail, not the whole row (jsdom yields 0×0, so tests assert the mechanism,
  // not exact pixels — confirm the final visual against the reference screenshot).
  const dateBoxRef = useRef<HTMLDivElement | null>(null);
  const [dateBoxSize, setDateBoxSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = dateBoxRef.current;
    if (el) {
      setDateBoxSize({ w: el.offsetWidth, h: el.offsetHeight });
    }
  }, []);

  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();
  // `||` (not `??`) so an accidental empty-string prop also falls through to context/default
  // instead of being passed straight to Intl and throwing.
  const activeLocale = locale || contextLocale;
  const activeTimezone = timezone || contextTimezone;

  if (loading) {
    return (
      <article
        aria-busy="true"
        aria-label={defaultLabels.loading}
        className={`w-full rounded-xl overflow-hidden shadow-sm border border-border bg-card animate-pulse ${isGreyedOut ? 'opacity-50 grayscale' : ''}`}
      >
        <div className="aspect-[3/4] bg-gray-200 w-full" />
        <div className="p-3 flex flex-col gap-2">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </article>
    );
  }

  const hasTime = !!startTime;

  const dateObj = combineDateTime(startDate, startTime);

  // DW-070 (BUG-013): `combineDateTime`'s own isNaN guard only covers its internal
  // date+time-combining fallback — a genuinely unusable `startDate` can still produce
  // an Invalid Date (getTime() === NaN). NaN must never reach getEventDayDiff /
  // formatRelativeDayOrDate (or formatShortEventDateTime, which calls getEventDayDiff
  // internally) unguarded, or Intl formatting throws. Guard the downstream propagation
  // once here and degrade gracefully to a blank date instead.
  const dateIsValid = !isNaN(dateObj.getTime());

  const dayDiff = dateIsValid ? getEventDayDiff(dateObj, activeTimezone) : NaN;

  // Single "now" read for this whole render (code-review finding, both Blind Hunter and Edge
  // Case Hunter independently flagged separate `new Date()`/`Date.now()` reads for the date-box,
  // TILL badge, and status badge as a theoretical millisecond-boundary disagreement risk between
  // the three) — every "current instant" use below shares this one value instead.
  const now = new Date();

  // AC14's TILL badge and BUG-047's date-box content both need the same effective-end-date
  // computation — hoisted here and computed unconditionally (previously only derived inside the
  // `started` branch below, when only the TILL badge needed it) so
  // `computeEventCardDateBoxParts` reuses these exact values instead of re-deriving a second,
  // divergent computation. Absent endDate falls back to startDate ("ends same day as start",
  // AC14/AC15's shared convention).
  const effectiveEndDate = endDate ?? startDate;
  const endDateTime = combineDateTime(effectiveEndDate, endTime);

  // BUG-047 (Event-Card family consolidation, AC-DATE-1/2/3): the date-box's own numeric-only,
  // context-date-driven content — a NEW, dedicated computation, entirely separate from
  // `formatShortEventDateTime`/`formatShortEventDateTimeParts` (untouched, unaffected, still used
  // as-is by whatever else consumes them — e.g. `EventDetailView.tsx`). Shows the end date once
  // the event has started and not yet ended (resolves BUG-022's startDate-vs-TILL-badge
  // contradiction), otherwise the start date. `dateBoxParts` (month/day split) feeds VM2's
  // two-tier `EventCardDateBox`; `dateBoxLine` below (same resolution, one combined string)
  // feeds VM1's single-line inline overlay.
  const dateBoxParts = dateIsValid
    ? computeEventCardDateBoxParts(activeLocale, activeTimezone, now, dateObj, endDateTime, endTime)
    : { month: '', day: '' };
  // VM1 (prominentPoster=true) one-line text — same shared resolution, locale-correct combined
  // format instead of VM2's two separate month/day slots (see the function's own doc comment).
  const dateBoxLine = dateIsValid
    ? formatEventCardDateBoxLine(activeLocale, activeTimezone, now, dateObj, endDateTime, endTime)
    : '';

  const finalImageAlt = imageAlt || eventName;

  // AC14 — TILL sub-badge (masonry only): "till hh:mm" / bare "till" / no badge.
  const started = now.getTime() >= dateObj.getTime();
  let tillBadgeText: string | null = null;
  if (started) {
    const nowParts = getLocalDateInTimezone(now, activeTimezone);
    const endParts = getLocalDateInTimezone(endDateTime, activeTimezone);
    const endDayDiff = getCalendarDayDifference(nowParts, endParts);

    if (endDayDiff === 0) {
      if (endTime) {
        tillBadgeText = `${defaultLabels.tillLabel} ${formatEventTime(activeLocale, activeTimezone, endDateTime)}`;
      } else if (endDate != null) {
        // A real endDate of today with no known endTime: still show a bare "till" tag.
        tillBadgeText = defaultLabels.tillLabel;
      }
      // else: absent endDate (fallback to start day) with no known end time -> no TILL badge (AC14).
    } else if (endDayDiff > 0) {
      tillBadgeText = defaultLabels.tillLabel;
    }
    // endDayDiff < 0 (already ended): no TILL badge — not explicitly specified by AC14, safest default.
  }

  // AC15 — status badge (masonry only): always one of 8 states. Story 1.i1i AC4 — the same
  // single computation now also surfaces the `happeningNow` discriminant that
  // `EventCardStatusBadge` renders as DESIGN.md's one sanctioned emerald exception.
  const { text: statusText, isHappeningNow } = formatEventStatus(
    activeLocale,
    activeTimezone,
    now,
    startDate,
    startTime,
    endDate,
    endTime,
    defaultLabels
  );

  // AC5 (Story 1.i1f) / AC2 (Story 1.i1i) — the nearby badge's `< nearbyBadgeThreshold` gate
  // now lives inside `EventCardNearbyBadge` itself (Architecture Spine AD-24 Rule 2), so this
  // call site no longer precomputes a `showNearbyBadge` boolean.

  const RootTag = href ? 'a' : onClick ? 'button' : 'div';
  const interactiveProps = href 
    ? { href } 
    : onClick 
      ? { onClick, type: 'button' as const } 
      : {};

  return (
    <article
      className={`w-full ${EVENT_CARD_CONTAINER_CLASS} rounded-xl overflow-hidden shadow-sm border border-border bg-card transition-all hover:shadow-md relative group flex flex-col ${
        pendingRemoval ? 'opacity-50 grayscale' : ''
      }`}
      aria-disabled={pendingRemoval}
    >
      {onFavoriteToggle && !isMasonryDefault && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle(e);
          }}
          aria-label={defaultLabels.favoriteToggle}
          className={`absolute ${
            // Rule 4 (`DESIGN.md` § event_card_date_box.favorite_pill): this pill moves down
            // in lockstep with the date pill when a TILL tag is present, so the tag has room
            // to clear the poster's own `overflow-hidden` edge.
            tillBadgeText ? 'top-5' : 'top-2'
          } right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors flex items-center justify-center ${EVENT_CARD_BADGE_TEXT_SIZE_CLASS} ${favoriteCount !== undefined ? 'px-1.5 py-1 gap-1.5' : 'p-2'}`}
        >
          <Heart
            // lucide's own `size` prop would be silently overridden by this `style` --
            // don't add one here without removing/reconciling this instead.
            style={eventCardBadgeIconSizeStyle('default')}
            className={isFavorited ? 'fill-red-600 text-red-600' : 'text-black'}
            fill={isFavorited ? 'currentColor' : 'none'}
          />
          {favoriteCount !== undefined && (
            <span className="font-semibold text-black pr-0.5 select-none">
              {favoriteCount}
            </span>
          )}
        </button>
      )}

      {/* Story 1.i1e — masonry-default (prominentPoster=false) favorite control.
          The single live favorite control is an EventCardFavoriteBadge composed as a
          DOM sibling of RootTag (never nested inside its <a>/<button>), at the same
          position today's outer button occupies — which is what keeps AC5's tab order
          (favorite BEFORE the navigate root) with no new logic. Scale follows the
          thumbnail's image presence: 'default' corner pill over the image, or 'large'
          centered control in the reserved-blank fallback. */}
      {isMasonryDefault && onFavoriteToggle && (
        <div
          className={
            defaultThumbnailImagePresent
              // BUG-041: was `top-1 right-1` (0.25rem) measured from the <article>'s own
              // edge. The row below now carries `p-2` (0.5rem), so the thumbnail this pill
              // sits over is inset that much further in -- bumped to `top-3 right-3`
              // (0.25rem + 0.5rem = 0.75rem) to keep it over the image's corner instead of
              // floating in the new padding gutter.
              ? 'absolute top-3 right-3 z-10'
              : 'absolute z-10 flex items-center justify-center'
          }
          style={
            !defaultThumbnailImagePresent
              ? {
                  // BUG-041: the row below now carries a `p-2` (0.5rem) padding wrapper to
                  // match the validated prototype, so this overlay -- a sibling of RootTag
                  // positioned relative to the <article>'s own edge, not the row's -- must
                  // add that same 0.5rem inset on every side to stay aligned with the date
                  // box (left) and the reserved blank thumbnail area (top/right) it sits on.
                  left: `calc(${dateBoxSize.w}px + 1rem)`,
                  top: '0.5rem',
                  right: '0.5rem',
                  height: dateBoxSize.h ? `${dateBoxSize.h}px` : undefined,
                  // CSS min-height (not a JS Math.max on a px literal) so this never drops
                  // below the favorite badge's own min-h-11 touch target, and stays correct
                  // under browser zoom / root font-size changes -- a fixed box shorter than
                  // the badge's minimum forced it to overflow and get clipped by the
                  // article's overflow-hidden (only the heart's bottom point showed).
                  minHeight: `${EVENT_CARD_BADGE_MIN_TOUCH_REM}rem`,
                }
              : undefined
          }
        >
          <EventCardFavoriteBadge
            scale={defaultThumbnailImagePresent ? 'default' : 'large'}
            isFavorited={isFavorited}
            favoriteCount={favoriteCount}
            onFavoriteToggle={onFavoriteToggle}
            labels={{ favoriteToggle: defaultLabels.favoriteToggle }}
          />
        </div>
      )}

      <RootTag 
        {...interactiveProps} 
        className="flex-1 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isMasonryDefault ? (
          // BUG-041: p-2 matches the validated prototype (default-with-thumbnail.html:62) --
          // without it this row sat flush against the <article>'s own overflow-hidden edges,
          // clipping EventCardDateBox's TILL corner tag (-top-1.5/-left-1.5) instead of
          // letting it overlap the card's own padding as the prototype shows.
          <div className="relative flex items-stretch gap-2 p-2">
            <div ref={dateBoxRef} className="shrink-0">
              <EventCardDateBox
                size="default"
                month={
                  <>
                    {hasTime && dayDiff === 0 && <Clock className="w-3 h-3" />}
                    {dateBoxParts.month}
                  </>
                }
                day={dateBoxParts.day}
                tillLabel={tillBadgeText || undefined}
              />
            </div>
            <EventCardMediaSlot
              layout="flex-fill"
              size="default"
              imageUrl={imageUrl}
              imageAlt={finalImageAlt}
              hideFavoriteBadge
              onImagePresenceChange={setDefaultThumbnailImagePresent}
            />
            {statusBadge && (
              <div className="absolute top-2 right-2 z-10">{statusBadge}</div>
            )}
          </div>
        ) : (
          <div
            className="relative aspect-square w-full bg-muted overflow-hidden flex items-center justify-center"
          >
            {statusBadge && (
              <div className="absolute top-2 right-2 z-10">{statusBadge}</div>
            )}
            {
              // Rule 4 (`DESIGN.md` § event_card_date_box.base): `top-2` by default, `top-5`
              // when a TILL tag is present. Padding stays uniform `p-1` in both states — the
              // token's own note records that an asymmetric-padding fix was tried and
              // explicitly rejected by the user, position-only being the sanctioned mechanism.
            }
            <div
              className={`absolute ${
                tillBadgeText ? 'top-5' : 'top-2'
              } left-2 z-10 flex items-center gap-1 p-1 rounded-md bg-background/80 backdrop-blur-sm shadow-sm ${EVENT_CARD_BADGE_TEXT_SIZE_CLASS} font-semibold text-foreground`}
            >
              {hasTime && dayDiff === 0 && <Clock className="w-3 h-3" />}
              {dateBoxLine}
              {tillBadgeText && (
                <span className={eventCardTillLabelClass('prominent')}>{tillBadgeText}</span>
              )}
            </div>
            {!imgError && imageUrl ? (
              <img 
                src={imageUrl} 
                alt={finalImageAlt}
                onError={() => setImgError(true)}
                className="object-cover w-full h-full"
              />
            ) : null}
          </div>
        )}

        <div className="p-3 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <EventCardStatusBadge text={statusText} isHappeningNow={isHappeningNow} />
            {/* AC5 (Story 1.i1i) — kept as an independent sibling of the badge row's
                `<div>` so Story 1.3k's `EventCardRepeatBadge` can slot in between. */}
            <EventCardNearbyBadge
              distanceKm={distanceKm}
              thresholdKm={nearbyBadgeThreshold}
              labels={{ nearbyBadge: defaultLabels.nearbyBadge }}
            />
          </div>
          <h3 className={`${EVENT_CARD_TITLE_TEXT_SIZE_CLASS} font-semibold leading-tight tracking-tight text-card-foreground line-clamp-2`}>
            {eventName}
          </h3>
          {locationName && (
            <div className="flex items-center text-sm text-muted-foreground gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="line-clamp-1">{locationName}</span>
            </div>
          )}
        </div>
      </RootTag>
    </article>
  );
}
