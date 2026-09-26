"use client"

/** @jsxImportSource react */
// The pragma above is a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- it exists only so a *different* package's test tooling
// (packages/visual-audit's `react-component` RenderSpec, which mounts these components through
// Playwright's test transform) doesn't have this file's JSX default to Playwright's own internal
// `playwright/jsx-runtime` (used for its reporter/attachment UI, an unrelated coincidental reuse
// of the `jsx`/`jsxs` function names) instead of React's. Same fix as `count-badge.tsx`; see that
// file's header for the direct repro this is based on.
/**
 * EventCardMediaPrimitives.tsx
 *
 * The shared `event_card_*` media primitives (Epic 1.i1 / Story 1.i1a):
 *  - `EventCardMediaSlot`  — the image/fallback slot that owns its dimensions and the
 *    reserved-blank fallback, switching between a small corner favorite pill (image
 *    present+ok) and the large centered favorite control (image absent/errored).
 *  - `EventCardFavoriteBadge` — the favorite heart+count control at either `default`
 *    (small corner pill) or `large` (borderless, centered in an empty slot) scale.
 *  - `EventCardDateBox` — the two-tier stacked month/day date box (Story 1.i1k), sized
 *    `'default'`/`'compact'`; its own `month`-line font-size is the icon-scale token's
 *    (AD-15) recalibration source per size variant.
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
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
  eventCardBadgeIconSizeStyle,
  badgeFontSizeStyleFor,
} from './event-card-media-tokens';
import type {
  EventCardMediaSlotProps,
  EventCardFavoriteBadgeProps,
  EventCardDateBoxProps,
  EventCardStatusBadgeProps,
  EventCardNearbyBadgeProps,
} from './EventCardMediaPrimitives.types';

/**
 * Responsive badge font-size pair shared by the TILL tag and the favorite pill
 * (Story 1.i1l AC5/AC7, `DESIGN.md` § event_card_till_badge "FONT SIZE NO LONGER FIXED"
 * and EXPERIENCE.md § Masonry EventCard Badge Row round 8).
 *
 * `text-xs` (12px) at the narrow card width, `text-sm` (14px) at the wide one — stepped by
 * **the card's own width via a CSS container query**, never a viewport breakpoint. Once
 * `event_card_masonry.max_width` caps every masonry card at 230px (AC1), the viewport stops
 * predicting the card's rendered width: a 230px card on a wide desktop is the same width as
 * a near-230px card on a narrow one, so a `sm:`/`md:` variant would grow the type on a card
 * that did not actually get wider. 200px sits between the two real validated widths (the
 * mobile 2-col slot's 175px and the capped desktop 230px).
 *
 * Written as a Tailwind arbitrary variant rather than via `@tailwindcss/container-queries`
 * so this adds no dependency and no change to `apps/web/tailwind.config.ts` (the only
 * consumer of `packages/ui`). Verified end-to-end during Story 1.i1l Task 7.1 — Tailwind
 * 3.4 emits `@container(min-width:200px){…}` for this candidate, and Chromium applies it:
 * 12px inside a 175px container, 14px inside a 230px one.
 *
 * A consumer with **no** `container-type` ancestor (the calendar compact row, which declares
 * none) never matches the query and therefore renders a static `text-xs` — deliberately, and
 * comfortably above EXPERIENCE.md's 11px legibility floor. The responsive pair is scoped to
 * the three masonry states, which is exactly where round 8's harmonization applies.
 */
export const EVENT_CARD_BADGE_TEXT_SIZE_CLASS =
  'text-xs [@container(min-width:200px)]:text-sm';

/**
 * Story 0.45 (Architecture Spine AD-27, AC8): the masonry card's title font-size, now stepped by
 * the card's own rendered width via the SAME container-query mechanism as
 * `EVENT_CARD_BADGE_TEXT_SIZE_CLASS` above — never a viewport breakpoint. Once `GridContainer`'s
 * `layout="masonry"` engine replaces the old `max-w-[230px]` cap (AC7) with a card that fills its
 * actual, JS-computed column width, the card's rendered width genuinely varies across the real
 * masonry breakpoint range (as narrow as the mobile 2-col slot, as wide as the desktop 6-col
 * slot) — so, unlike the removed fixed cap, the title now has real headroom to grow at wider
 * columns instead of staying pinned at its narrowest-slot size.
 *
 * `text-sm` (14px, today's shipped value) below 200px, stepping to `text-base` (16px) at/above
 * it — the same 200px threshold `EVENT_CARD_BADGE_TEXT_SIZE_CLASS` already uses (there is no
 * DESIGN.md token for this pairing to derive a different threshold from; reusing the established
 * one keeps every masonry-card container-query step consistent rather than inventing a second
 * breakpoint).
 */
export const EVENT_CARD_TITLE_TEXT_SIZE_CLASS =
  'text-sm [@container(min-width:200px)]:text-base';

/**
 * Marks an element as the query container the badge font-size steps against.
 * Applied to `EventCard`'s own root (Story 1.i1l), so the card's width — not the
 * viewport's — drives `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`.
 */
export const EVENT_CARD_CONTAINER_CLASS = '[container-type:inline-size]';

/**
 * The TILL tag's chrome, keyed by the date-box context it anchors to (Story 1.i1l AC4).
 *
 * `DESIGN.md` § event_card_till_badge, "OFFSET DIFFERS BY CONTEXT": `-top-1.5` is the
 * default, used by the two-tier pills (`event_card_date_box.base_default` on masonry and
 * `event_card_compact.date_box` on the calendar row), which carry enough vertical padding
 * that the tag's overlap never reaches their text. `event_card_date_box.base`
 * (`prominentPoster=true`) is the ONE exception: a short single-line chip with much less
 * vertical room, so the tag needs `-top-3` there to clear the pill's text. Position-only —
 * the padding is identical in both, per the same token's explicit note that an asymmetric-
 * padding fix was tried and rejected.
 *
 * Replaces the single frozen `EVENT_CARD_TILL_LABEL_CLASS` constant (Story 1.i1k Task 2.7),
 * which could not express a per-context offset. Every call site goes through this helper so
 * the two contexts can never drift into hand-copied literals again.
 */
export function eventCardTillLabelClass(context: 'default' | 'prominent'): string {
  const offset = context === 'prominent' ? '-top-3' : '-top-1.5';
  return `absolute ${offset} -left-1.5 z-20 px-1.5 py-0.5 rounded-full bg-amber-700 text-white ${EVENT_CARD_BADGE_TEXT_SIZE_CLASS} font-semibold leading-none shadow-sm whitespace-nowrap`;
}

/**
 * The image/fallback slot. Owns image-slot dimensions (from the surrounding chrome,
 * never the image's natural size) and the reserved-blank fallback.
 */
export function EventCardMediaSlot({
  imageUrl,
  imageFallbackUrl,
  imageAlt,
  layout,
  isFavorited = false,
  favoriteCount,
  onFavoriteToggle,
  labels,
  className = '',
  size = 'default',
  hideFavoriteBadge = false,
  onImagePresenceChange,
  collapseOnFallback = false,
}: EventCardMediaSlotProps) {
  // BUG-042 (AC-IMG-1): the same imageUrl -> imageFallbackUrl -> reserved-blank retry-once
  // chain `EventImage.tsx` already implements — `onError` swaps to `imageFallbackUrl` once
  // (`hasTriedFallback`), then sets the terminal `imgError` (no broken-image icon/placeholder
  // ever rendered).
  //
  // Code-review fix (BUG-042 loopback): "on missing/onError, fall back" covers a `null`/
  // `undefined` `imageUrl` from the first render too, not just a later `onError` — the original
  // cut only wired the fallback into `onError`, so a schedule with no primary image at all never
  // mounted an `<img>` to error and silently skipped `imageFallbackUrl`. `currentImgSrc` now
  // starts at `imageUrl ?? imageFallbackUrl`, and `hasTriedFallback` starts `true` whenever that
  // initial pick was already the fallback — an error on that starting image goes straight to the
  // terminal state instead of re-"falling back" to the same URL. The `imageFallbackUrl !==
  // currentImgSrc` guard below covers the sibling case where both URLs are identical: without it
  // `setCurrentImgSrc` would be a no-op, `onError` would never refire, and the slot would be stuck
  // on the browser's native broken-image icon instead of ever reaching the reserved-blank
  // fallback.
  const [imgError, setImgError] = useState(false);
  const [currentImgSrc, setCurrentImgSrc] = useState<string | undefined>(imageUrl ?? imageFallbackUrl ?? undefined);
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

  const imagePresent = !!currentImgSrc && !imgError;

  // Notify an external caller (only when one is supplied) of the local
  // image-presence state, including the initial mount value — Story 1.i1e uses
  // this so a RootTag-external favorite badge knows the active scale.
  useEffect(() => {
    onImagePresenceChange?.(imagePresent);
  }, [imagePresent, onImagePresenceChange]);

  // Story 1.i1m AC1/AC3: opt-in, additive fork of this primitive's contract. Every
  // existing consumer (masonry's two call sites) omits this prop and keeps today's exact
  // reserved-blank behavior below, byte-for-byte. Only the calendar compact row passes
  // `true`, per DESIGN.md `event_card_compact_thumbnail_fallback` ("no area for image at
  // all … the image element is omitted from the DOM entirely"). Returning `null` here --
  // rather than an empty reserved div -- is what removes the element from the DOM rather
  // than merely emptying it, both on initial render (no imageUrl) and after `onError`
  // fires post-mount (the `imagePresent` recompute above already covers both cases).
  if (collapseOnFallback && !imagePresent) {
    return null;
  }

  const layoutClasses =
    layout === 'flex-fill' ? 'flex-1 h-full min-w-0' : 'w-16 h-16 shrink-0';

  return (
    <div
      data-event-card-media-slot=""
      style={badgeFontSizeStyleFor(size)}
      className={`relative overflow-hidden rounded-md ${layoutClasses} ${className}`}
    >
      {imagePresent ? (
        <>
          <img
            src={currentImgSrc}
            alt={imageAlt ?? ''}
            onError={handleImageError}
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
  iconSizeStyle: iconSizeStyleOverride,
  largeTextSizeClassName = 'text-sm',
}: EventCardFavoriteBadgeProps) {
  // AC5 — match EventCard's existing labels/defaultLabels merge pattern exactly
  // (same key `favoriteToggle`, same default string), never a second labels shape.
  const defaultLabels = { favoriteToggle: 'Toggle favorite', ...labels };

  // The favorite control renders only when the caller supplies a toggle handler
  // (mirrors EventCard's `{onFavoriteToggle && …}` behavior).
  if (!onFavoriteToggle) {
    return null;
  }

  // Story 1.i1m AC5 — `iconSizeStyleOverride` lets the calendar compact row substitute its
  // own continuous, container-width-driven growth for the ratio-derived default. Every
  // other call site omits it and keeps today's exact sizing.
  const iconSizeStyle = iconSizeStyleOverride ?? eventCardBadgeIconSizeStyle(scale);
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
          ? `flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 ${largeTextSizeClassName} font-medium text-foreground ${className}`
          : `flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors ${EVENT_CARD_BADGE_TEXT_SIZE_CLASS} ${
              favoriteCount !== undefined ? 'px-1.5 py-1 gap-1.5' : 'p-2'
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
        <span className="font-semibold select-none">{favoriteCount}</span>
      )}
    </button>
  );
}

/**
 * Two-tier stacked month/day chrome for the event-card date box (Story 1.i1k). Takes
 * structured, already-formatted `month`/`day` slots (no date/locale formatting is
 * reimplemented here) plus an optional `tillLabel` slot rendered as the amber corner tag,
 * and is the size-keyed font-size source the icon-scale token (AD-15) keys off
 * (`DESIGN.md` § event_card_date_box.base_default / § event_card_compact.date_box).
 */
export function EventCardDateBox({ size, month, day, tillLabel, className = '' }: EventCardDateBoxProps) {
  const paddingClasses = size === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const monthClasses = size === 'compact' ? 'text-sm font-bold uppercase tracking-wide' : 'text-lg font-bold uppercase tracking-wide';
  // BUG-047 (Event-Card family consolidation, AC-DATE-1): the day slot is numeric-only by
  // construction now -- both content sources (`computeEventCardDateBoxParts`,
  // `computeCalendarSegmentDateBoxContent`) only ever produce a 1-2 digit day-of-month, so the
  // former `dayVariant='word'` sizing branch (Story 1.i1n/BUG-040, word-safe `text-sm`/`max-w-
  // [96px]`) has no remaining caller and is deleted, not kept "just in case" (superseded, per
  // backlog.yaml's BUG-040 note).
  //
  // AC-DATE-4 (masonry `size='default'` only): the day slot gets an explicit `tabular-nums` +
  // `min-w-[2ch]` floor so the box's rendered width is identical whether the day is 1-digit ("3")
  // or 2-digit ("23") -- previously nothing constrained this, so glyph width alone could shift the
  // box's total width. `size='compact'` (the calendar list row) is explicitly unaffected --
  // confirmed masonry-only, no cross-family invariant intended.
  const dayClasses =
    size === 'compact'
      ? 'text-3xl font-extrabold leading-none'
      : 'inline-block text-center tabular-nums min-w-[2ch] text-5xl font-extrabold leading-none';

  // AC-DATE-5 (masonry `size='default'` only): empirically confirmed (Playwright, real render)
  // that the *wrapper* div `EventCard.tsx`'s `top_row_default` gives this component already
  // stretches correctly to the sibling thumbnail's height (`flex items-stretch` + the media
  // slot's `h-full` do work) -- but this component's own root `<span>` has no height rule of its
  // own, so it only fills its NATURAL content height inside that taller wrapper, leaving the
  // visible navy box visually shorter than the thumbnail beside it. `h-full` on the span (masonry
  // `size='default'` only, never `'compact'` -- the calendar list row was not part of this AC and
  // keeps its established layout) closes that gap.
  const heightClass = size === 'default' ? 'h-full' : '';

  return (
    <span
      style={badgeFontSizeStyleFor(size)}
      data-event-card-date-box=""
      data-event-card-date-box-size={size}
      className={[
        'relative flex flex-col justify-center gap-0.5',
        paddingClasses,
        'rounded-md bg-slate-800 text-white shadow-sm shrink-0 leading-none',
        heightClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tillLabel ? <span className={eventCardTillLabelClass('default')}>{tillLabel}</span> : null}
      <span data-event-card-date-box-month="" className={monthClasses}>
        {month}
      </span>
      <span data-event-card-date-box-day="" className={dayClasses}>
        {day}
      </span>
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
 * BUG-049 (AC-NEARBY-1/2/3, `event-card-family-consolidated-acs.md` §2.4): shared default
 * formatter for the nearby-badge's distance text. `distanceKm >= 2` renders with no decimal
 * place ("5 km"); `distanceKm < 2` renders with one decimal place ("1.2 km"). Branch selection
 * always uses the raw (un-rounded) `distanceKm` — so `1.95` stays in the `<2` branch and
 * displays as `"2.0 km"` once `toFixed(1)` rounds the printed digit; the source value never
 * actually crossed the 2km line, only its rendered text did. Exported so every call site
 * (`EventCard.tsx`, `WeeklyCalendarView.tsx`, `EventCardCalendarGridItem.tsx`,
 * `CalendarOverflowDialog.tsx`) shares one implementation of this rule instead of four.
 */
export function formatNearbyBadgeDistance(distanceKm: number): string {
  return distanceKm >= 2 ? `${Math.round(distanceKm)} km` : `${distanceKm.toFixed(1)} km`;
}

/**
 * The nearby-distance badge (`DESIGN.md` § event_card_nearby_badge, Story 1.i1i AC1/AC2;
 * BUG-049 AC-NEARBY-1/2/3). Self-gating (AC1, mirroring `EventCardFavoriteBadge`'s early-return
 * convention): renders nothing unless the caller passes a known `distanceKm` below
 * `thresholdKm` (default `8`), so no consumer needs to precompute a `showNearbyBadge` boolean
 * or re-derive the threshold (Architecture Spine AD-24 Rule 2). Omitted entirely — never a
 * disabled/placeholder state. This gating is unchanged by BUG-049 — only the badge's rendered
 * CONTENT changed, from a static "Nearby" word to the actual computed distance.
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
  // `nearbyBadge`), now a function-shaped label (BUG-049) rather than a bare string default.
  // Nullish-coalescing, not spread-after-default: a caller-supplied `labels={{ nearbyBadge:
  // undefined }}` (key present, value undefined) must still fall back to the default function,
  // never silently resolve to `undefined` and crash `defaultLabels.nearbyBadge(distanceKm)`
  // below (review finding, BUG-049 — a plain object spread would have let that through).
  const defaultLabels = { nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance };

  // BUG-049 review finding: `distanceKm` reaching here as NaN/negative/non-finite (a caller-side
  // geolocation bug, not this primitive's concern) used to be masked by the old static "Nearby"
  // label -- rendering it through `formatNearbyBadgeDistance` would surface it as visible broken
  // text ("NaN km", "-3.0 km"). Treat it exactly like an unknown distance (`== null`) and omit
  // the badge, rather than widen what the `< thresholdKm` comparison itself means.
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm >= thresholdKm) {
    return null;
  }

  return (
    <span
      data-event-card-nearby-badge=""
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground ${className}`}
    >
      <Navigation className="w-3 h-3" />
      {defaultLabels.nearbyBadge(distanceKm)}
    </span>
  );
}
