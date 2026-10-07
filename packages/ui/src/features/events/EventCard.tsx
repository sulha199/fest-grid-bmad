"use client"

/** @jsxImportSource react */
// The pragma above is a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- it exists only so packages/visual-audit's `react-component`
// RenderSpec (which mounts this component through Playwright's test transform) doesn't have this
// file's JSX default to Playwright's own internal `playwright/jsx-runtime` instead of React's.
// Same fix as `count-badge.tsx`/`EventCardMediaPrimitives.tsx`; see either file's header for the
// direct repro this is based on.
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { useScopedLocale, useScopedTimezone, useHoverFocusTooltip } from '../../hooks';
import type { EventCardProps } from './EventCard.types';
import {
  computeEventCardDateBoxParts,
  formatEventCardDateBoxLine,
  formatEventStatus,
  combineDateTime,
  getLocalDateInTimezone,
  getCalendarDayDifference,
} from './format-event-date';
import {
  eventCardBadgeIconSizeStyle,
  eventCardBadgeIconSizeStyleForRatio,
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
  EVENT_CARD_BADGE_ICON_SCALE_MASONRY_NO_IMAGE,
} from './event-card-media-tokens';
import {
  EventCardDateBox,
  EventCardMediaSlot,
  EventCardFavoriteBadge,
  EventCardStatusBadge,
  EventCardNearbyBadge,
  EventCardRepeatBadge,
  formatNearbyBadgeDistance,
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
  imageFallbackUrl,
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
  applicableDaysOfWeek,
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
    ...labels,
    // BUG-049 review finding: set after the spread with `??`, not spread-after-default, so an
    // explicit `labels={{ nearbyBadge: undefined }}` still falls back to the formatter instead
    // of crashing `EventCardNearbyBadge` when it calls `defaultLabels.nearbyBadge(distanceKm)`.
    nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance,
  };

  // BUG-042 (AC-IMG-1/AC-IMG-3): VM1's (prominentPoster=true) own retry-once fallback chain,
  // mirroring EventImage.tsx/EventCardMediaSlot's exact shape. `onError` swaps to
  // `imageFallbackUrl` once (`posterHasTriedFallback`), then sets the terminal `posterImgError`
  // (no broken-image icon/placeholder ever rendered). VM1 previously had zero fallback UI at all
  // on image error; the failure state (both URLs missing/erroring) now renders
  // `EventCardFavoriteBadge scale="large"` in place of the poster, same as every sibling variant,
  // and the small corner favorite button is gated off in that state (no duplicate control).
  //
  // Code-review fix (BUG-042 loopback): the AC's "on missing/onError, fall back" wording covers
  // BOTH a `null`/`undefined` `imageUrl` from the very first render AND a later `onError` — the
  // original cut only wired the fallback into `onError`, so a report with no primary image at all
  // (the exact case this bug targets — a rehosted-but-source-gone post) silently skipped the
  // fallback and never mounted an `<img>` to error in the first place. `posterImgSrc` now starts
  // at `imageUrl ?? imageFallbackUrl` and `posterHasTriedFallback` starts `true` whenever that
  // initial pick was already the fallback (imageUrl absent) — so an error on that starting image
  // goes straight to the terminal state instead of "falling back" to the same URL again. The
  // `imageFallbackUrl !== posterImgSrc` guard in the handler below covers the sibling edge case
  // where both URLs happen to be identical: without it, `setPosterImgSrc` would be a no-op (same
  // string), the `<img>` would never re-request, `onError` would never refire, and the slot would
  // be stuck showing the browser's native broken-image icon forever instead of ever reaching the
  // reserved-blank/favorite-badge fallback this whole feature exists to guarantee.
  const [posterImgSrc, setPosterImgSrc] = useState<string | undefined>(imageUrl ?? imageFallbackUrl ?? undefined);
  const [posterHasTriedFallback, setPosterHasTriedFallback] = useState(!imageUrl && !!imageFallbackUrl);
  const [posterImgError, setPosterImgError] = useState(false);

  useEffect(() => {
    setPosterImgSrc(imageUrl ?? imageFallbackUrl ?? undefined);
    setPosterHasTriedFallback(!imageUrl && !!imageFallbackUrl);
    setPosterImgError(false);
  }, [imageUrl, imageFallbackUrl]);

  const handlePosterImageError = () => {
    if (imageFallbackUrl && imageFallbackUrl !== posterImgSrc && !posterHasTriedFallback) {
      setPosterHasTriedFallback(true);
      setPosterImgSrc(imageFallbackUrl);
    } else {
      setPosterImgError(true);
    }
  };

  const posterImagePresent = !!posterImgSrc && !posterImgError;

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
  // from the date box's own box so the badge centers within just the thumbnail, not the
  // whole row (jsdom yields 0×0, so tests assert the mechanism, not exact pixels — confirm
  // the final visual against the reference screenshot). Kept live via ResizeObserver, not
  // just a one-shot mount measurement — see that effect's own comment for why.
  const dateBoxRef = useRef<HTMLDivElement | null>(null);
  const [dateBoxSize, setDateBoxSize] = useState({ w: 0, h: 0 });
  // User feedback (2026-09-27): at some viewport widths (e.g. 1381px), the no-image-mode
  // favorite badge floated outside/got clipped by the card edge on the first couple of cards in
  // a masonry grid. Root cause: this used to be a one-shot `useLayoutEffect` (`[]` deps) that
  // measured the date-box's width/height exactly once at mount -- but the grid's own column
  // count/card width can still be settling at that exact moment (many cards mounting
  // simultaneously, CSS Grid/responsive classes not fully resolved on the very first layout
  // pass), so the earliest-mounting cards could capture a size wider than the box's real,
  // final flex-1-resolved width. A stale, too-wide `dateBoxSize.w` pushes the badge's `left`
  // offset (below) past the thumbnail's actual right edge, where the card's `overflow-hidden`
  // clips it. A `ResizeObserver` re-measures whenever the box's real size actually changes
  // (grid reflow, window resize, font load, etc.), not just once at mount.
  useLayoutEffect(() => {
    const el = dateBoxRef.current;
    if (!el) return;
    setDateBoxSize({ w: el.offsetWidth, h: el.offsetHeight });
    if (typeof ResizeObserver === 'undefined') return;
    // Deliberately re-reads `offsetWidth`/`offsetHeight` from the element rather than using the
    // callback's own `entry.contentRect` -- `contentRect` excludes padding/border while
    // `offsetWidth`/`offsetHeight` (used for the initial measurement above) include them; mixing
    // the two would make the badge jump between the first paint and the first observed resize.
    const observer = new ResizeObserver(() => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      setDateBoxSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
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

  const dateObj = combineDateTime(startDate, startTime, activeTimezone);

  // DW-070 (BUG-013): `combineDateTime`'s own isNaN guard only covers its internal
  // date+time-combining fallback — a genuinely unusable `startDate` can still produce
  // an Invalid Date (getTime() === NaN). NaN must never reach getEventDayDiff /
  // formatRelativeDayOrDate (or formatShortEventDateTime, which calls getEventDayDiff
  // internally) unguarded, or Intl formatting throws. Guard the downstream propagation
  // once here and degrade gracefully to a blank date instead.
  const dateIsValid = !isNaN(dateObj.getTime());

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
  const endDateTime = combineDateTime(effectiveEndDate, endTime, activeTimezone);

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
      // User feedback (2026-09-27): no TILL badge at all once the end date is today --
      // the status badge already communicates this state directly ("Ends Today", or "Ends
      // hh:mm" once the end time is known — see formatEventStatus's own endDayDiff === 0
      // branch), so the TILL tag would be pure duplication rather than distinct information.
    } else if (endDayDiff > 0) {
      tillBadgeText = defaultLabels.tillLabel;
    }
    // endDayDiff < 0 (already ended): no TILL badge — not explicitly specified by AC14, safest default.
  }

  // AC15 — status badge (masonry only): always one of 8 states. Story 1.i1i AC4 — the same
  // single computation now also surfaces the `happeningNow` discriminant that
  // `EventCardStatusBadge` renders as DESIGN.md's one sanctioned emerald exception.
  const { text: statusText, variant: statusVariant } = formatEventStatus(
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

  // Story 1.3k Task 6 (AC6, "Tooltip trigger resolution" Dev Notes) — the repeat badge is never
  // an independently-focusable trigger of its own (it would nest a focusable element inside
  // RootTag, already an `<a>`/`<button>` when `href`/`onClick` is supplied — the same hazard
  // Story 1.i1d/1.i1e already solved for the favorite badge). Instead RootTag's own existing
  // hover/focus state, via the shared `useHoverFocusTooltip` hook, drives the badge's tooltip.
  const { isVisible: repeatBadgeTooltipVisible, handlers: repeatBadgeTooltipHandlers } =
    useHoverFocusTooltip({ enabled: true });

  return (
    <article
      className={`w-full ${EVENT_CARD_CONTAINER_CLASS} rounded-xl overflow-hidden shadow-sm border border-border bg-card transition-all hover:shadow-md relative group flex flex-col ${
        pendingRemoval ? 'opacity-50 grayscale' : ''
      }`}
      aria-disabled={pendingRemoval}
    >
      {onFavoriteToggle && !isMasonryDefault && posterImagePresent && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle(e);
          }}
          aria-label={defaultLabels.favoriteToggle}
          // Rule 4 (`DESIGN.md` § event_card_date_box.base): `top-2` by default, `top-5` when a
          // TILL tag is present -- gives the TILL tag (rendered as its own floating sibling
          // above the date pill, not nested inside it) clearance against the poster's own
          // `overflow-hidden` edge. User feedback (2026-09-28): a same-day attempt to remove
          // this shift (moving the pill/fav-icon UP to a flat `top-2`) is REVERTED -- that made
          // the TILL tag cover MORE of the date pill, not less ("rather than moving till-box
          // down, you moved the datebox and fav-icon up"). The fix belongs entirely on the TILL
          // tag's own position (see below), not here.
          className={`absolute top-2 right-2 z-30 rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors flex items-center justify-center ${EVENT_CARD_BADGE_TEXT_SIZE_CLASS} ${favoriteCount !== undefined ? 'px-1.5 py-1 gap-1.5' : 'p-2'}`}
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
              // Pixel-perfect pass (2026-09-27, masonry-default prototype round 4): the
              // <article> is back to `overflow-hidden` (anything outside the card must not be
              // visible), so this pill sits just INSIDE the thumbnail's corner (`top-1.5
              // right-1.5`, positive offset) mirroring EventCardDateBox's TILL tag on the
              // opposite corner (`top-1.5 left-1.5` via eventCardTillLabelClass), not floating
              // past the true edge.
              //
              // User feedback (2026-09-27, later same-day: "the favorite icon should be
              // clickable to toggle favorite"): z-index bumped to z-30 in both branches --
              // previously z-20/z-10, tied or losing against the row's own `statusBadge` overlay
              // (`top-2 right-2 z-10`, rendered from a DEEPER, later DOM position inside RootTag)
              // in the no-thumbnail case specifically, which spans the exact same top-right
              // region this control's large centered button occupies. z-30 unambiguously wins
              // regardless of DOM order in both branches.
              ? 'absolute top-1.5 right-1.5 z-30'
              : 'absolute z-30 flex items-center justify-center'
          }
          style={
            !defaultThumbnailImagePresent
              ? {
                  // Pixel-perfect pass (2026-09-27): the row below no longer carries any
                  // padding/gap, so this overlay -- a sibling of RootTag positioned relative to
                  // the <article>'s own edge, not the row's -- now aligns flush (no added inset)
                  // with the date box (left) and the reserved-blank thumbnail area (top/right)
                  // it sits on top of.
                  left: `${dateBoxSize.w}px`,
                  top: '0',
                  right: '0',
                  height: dateBoxSize.h ? `${dateBoxSize.h}px` : undefined,
                  // CSS min-height (not a JS Math.max on a px literal) so this never drops
                  // below the favorite badge's own min-h-11 touch target, and stays correct
                  // under browser zoom / root font-size changes -- a fixed box shorter than
                  // the badge's minimum forced it to overflow and get clipped by the
                  // article's overflow-hidden (only the heart's bottom point showed).
                  minHeight: `${EVENT_CARD_BADGE_MIN_TOUCH_REM}rem`,
                }
              : // Pixel-perfect pass (2026-09-27, user feedback): a same-dated earlier revision
                // of this pass tried inheriting masonry `size='default'`'s larger
                // `--event-card-badge-font-size` (1.125rem basis, a ~30px icon) here -- reverted
                // per follow-up user feedback ("fav-icon on small-thumbnail mode is too big, use
                // the previous size"), back to this badge's own standalone 0.75rem fallback
                // (`eventCardBadgeIconSizeStyle`'s default ratio, a 20px icon) by declaring no
                // override at all.
                undefined
          }
        >
          <EventCardFavoriteBadge
            scale={defaultThumbnailImagePresent ? 'default' : 'large'}
            isFavorited={isFavorited}
            favoriteCount={favoriteCount}
            onFavoriteToggle={onFavoriteToggle}
            labels={{ favoriteToggle: defaultLabels.favoriteToggle }}
            // Pixel-perfect pass (2026-09-27, user feedback): no-thumbnail mode's fallback icon
            // is bumped to a bespoke 4x ratio (EVENT_CARD_BADGE_ICON_SCALE_MASONRY_NO_IMAGE) via
            // this override, instead of the shared EVENT_CARD_BADGE_ICON_SCALE_LARGE (2x) every
            // other `scale="large"` consumer still uses -- see that constant's own comment for
            // why this stays masonry-only rather than a global bump.
            iconSizeStyle={
              defaultThumbnailImagePresent
                ? undefined
                : eventCardBadgeIconSizeStyleForRatio(EVENT_CARD_BADGE_ICON_SCALE_MASONRY_NO_IMAGE)
            }
          />
        </div>
      )}

      <RootTag
        {...interactiveProps}
        className="flex-1 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerEnter={repeatBadgeTooltipHandlers.onPointerEnter}
        onPointerLeave={repeatBadgeTooltipHandlers.onPointerLeave}
        onFocus={repeatBadgeTooltipHandlers.onFocus}
        onBlur={repeatBadgeTooltipHandlers.onBlur}
        onKeyDown={repeatBadgeTooltipHandlers.onKeyDown}
      >
        {isMasonryDefault ? (
          // Pixel-perfect pass (2026-09-27, masonry-default prototype round 2-4): no padding/gap
          // -- the date-box and thumbnail stick flush to the card's own edges and to each other
          // (BUG-041's `p-2`/`gap-2` are superseded). The TILL/favorite corner tags (round 4) now
          // sit just INSIDE the card's edge (positive offset) rather than floating past it, so the
          // <article>'s `overflow-hidden` (unchanged) clips nothing that should stay visible.
          <div className="relative flex items-stretch">
            <div ref={dateBoxRef} className="flex-1 min-w-0">
              <EventCardDateBox
                size="default"
                month={dateBoxParts.month}
                day={dateBoxParts.day}
                tillLabel={tillBadgeText || undefined}
              />
            </div>
            <EventCardMediaSlot
              layout="flex-fill"
              size="default"
              imageUrl={imageUrl}
              imageFallbackUrl={imageFallbackUrl}
              imageAlt={finalImageAlt}
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
            {/* User feedback (2026-10-03): the date and TILL tag are one two-coloured inline pill
                (TILL segment amber, date segment the existing translucent chip), replacing the
                former separately-floating date chip + TILL tag. No clock icon. */}
            <div
              className={`absolute top-2 left-2 z-10 inline-flex items-stretch overflow-hidden rounded-full shadow-sm ${EVENT_CARD_BADGE_TEXT_SIZE_CLASS} font-semibold leading-none`}
            >
              {tillBadgeText && (
                <span className="flex items-center px-1.5 py-1 bg-amber-700 text-white whitespace-nowrap">
                  {tillBadgeText}
                </span>
              )}
              <span className="flex items-center px-1.5 py-1 bg-background/80 backdrop-blur-sm text-foreground whitespace-nowrap">
                {dateBoxLine}
              </span>
            </div>
            {posterImagePresent ? (
              <img
                src={posterImgSrc}
                alt={finalImageAlt}
                onError={handlePosterImageError}
                className="object-cover w-full h-full"
              />
            ) : (
              // AC-IMG-3: both imageUrl and imageFallbackUrl missing/erroring — the poster area
              // is replaced by the same scale="large" (vertical icon+count) favorite control
              // every sibling variant (VM2/VM6/VM7) already shows in its own reserved-blank
              // fallback, only when a favorite toggle is supplied; otherwise a plain reserved-
              // blank area (no control, no icon — this div's own bg-muted background).
              onFavoriteToggle && (
                <div
                  className="flex items-center justify-center w-full h-full"
                  style={{ minHeight: `${EVENT_CARD_BADGE_MIN_TOUCH_REM}rem` }}
                >
                  <EventCardFavoriteBadge
                    scale="large"
                    isFavorited={isFavorited}
                    favoriteCount={favoriteCount}
                    onFavoriteToggle={onFavoriteToggle}
                    labels={{ favoriteToggle: defaultLabels.favoriteToggle }}
                  />
                </div>
              )
            )}
          </div>
        )}

        <div className="p-3 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <EventCardStatusBadge text={statusText} variant={statusVariant} />
            {/* Story 1.3k (AC6) — order: status → repeat → nearby. */}
            <EventCardRepeatBadge
              daysOfWeek={applicableDaysOfWeek}
              dayOfWeekLabels={labels.dayOfWeekLabels}
              repeatBadgeAriaLabel={labels.repeatBadgeAriaLabel}
              tooltipVisible={repeatBadgeTooltipVisible}
            />
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
            // Pixel-perfect pass (2026-09-27, masonry-default prototype, later extended to VM1
            // prominentPoster=true per user feedback): both masonry states drop the MapPin icon,
            // center the text, and stay a single line (`line-clamp-1`) while still breaking
            // mid-word if needed (`break-all`) instead of truncating with an ellipsis. VM1 and
            // VM2 were briefly divergent here (VM1 kept its icon + left-aligned treatment) --
            // unified to the same rule since the user asked for the identical fix on VM1 too.
            <div className="text-sm text-muted-foreground text-center break-all line-clamp-1">
              {locationName}
            </div>
          )}
        </div>
      </RootTag>
    </article>
  );
}
