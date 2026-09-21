/**
 * event-card-media-tokens.ts — Icon-Scale Token (AD-15).
 *
 * The date box, media slot and favorite badge are DOM **siblings** in every real
 * layout this primitive is adopted into (masonry's `top_row_default`, the
 * calendar-compact row), so plain CSS `em`-based inheritance cannot propagate a
 * font-size from the date box to the badge — `em` only flows downward through a
 * subtree, never sideways between siblings. We therefore use a **CSS custom
 * property** declared on the primitive's roots and consumed by the badge's icon
 * via `calc(var(--event-card-badge-font-size) * <ratio>)`. This keeps the whole
 * family calibrated off a single declared value with **no JS-side pixel math**
 * per consumer, and guarantees Story 1.i1b's later re-point of `EventCard`'s
 * existing corner icon at this same token cannot silently diverge from the
 * large badge's calibration.
 *
 * The token is calibrated against the date box's own `text-xs` (0.75rem / 12px).
 * See `DESIGN.md` § event_card_favorite_count_badge / § event_card_favorite_count_badge_large.
 */
import type { CSSProperties } from 'react';

/** CSS custom property name shared by the primitive's roots (slot / date box). */
export const EVENT_CARD_BADGE_FONT_SIZE_VAR = '--event-card-badge-font-size';

/**
 * The literal font-size the token is calibrated against — Tailwind's `text-xs`
 * (0.75rem / 12px), the date box's own font-size. Declared (with a matching
 * fallback) on each root so the badge works both inside a slot and standalone
 * (Story 1.i1b imports `EventCardFavoriteBadge` directly to replace
 * `EventCard`'s inline corner-heart JSX).
 */
export const EVENT_CARD_BADGE_FONT_SIZE = '0.75rem';

/**
 * `large` ratio: **2×** → 12px × 2 = **24px**, matching `DESIGN.md`'s explicit
 * `w-6 h-6` target for `event_card_favorite_count_badge_large`.
 */
export const EVENT_CARD_BADGE_ICON_SCALE_LARGE = 2;

/**
 * `default` ratio: **5/3 (≈1.6667)** → 12px × 5/3 = **20px**, matching
 * `EventCard.tsx`'s current `w-5 h-5` (20px) corner heart. Chosen deliberately
 * (Task 2.3) so Story 1.i1b's later swap reads as a proportion fix (BUG-023),
 * not a jarring resize. Deliberately not hardcoded as 20px — derived from
 * ratio × `text-xs`.
 */
export const EVENT_CARD_BADGE_ICON_SCALE_DEFAULT = 5 / 3;

/**
 * Returns the icon width/height as an inline-style object, sized via
 * `calc(var(--event-card-badge-font-size, 0.75rem) * ratio)`. The inline `0.75rem`
 * fallback keeps the badge correct even when rendered outside any slot/date-box root
 * that would otherwise declare the custom property (i.e. the standalone 1.i1b
 * adoption path).
 *
 * A `style` object is used deliberately instead of a Tailwind arbitrary-value class
 * (`w-[calc(...)]`) — Tailwind's build-time content scanner only picks up class-name
 * candidates that appear as complete literal strings in source files, so a class
 * assembled via runtime template-literal interpolation (as this used to be) is
 * invisible to it and generates no CSS at all. `style` applies unconditionally.
 */
export function eventCardBadgeIconSizeStyle(scale: 'default' | 'large'): CSSProperties {
  const ratio =
    scale === 'large' ? EVENT_CARD_BADGE_ICON_SCALE_LARGE : EVENT_CARD_BADGE_ICON_SCALE_DEFAULT;
  const size = `calc(var(${EVENT_CARD_BADGE_FONT_SIZE_VAR},${EVENT_CARD_BADGE_FONT_SIZE})*${ratio})`;
  return { width: size, height: size };
}

/**
 * The `large`-scale favorite badge's own minimum touch-target size (matches
 * `EventCardFavoriteBadge`'s `min-h-11 min-w-11` button classes, 2.75rem). Any
 * container that reserves space for a `large` badge must apply this as a
 * `minHeight`/`minWidth` `rem` value (never a hardcoded px number) — `rem`
 * resolves against the actual root font-size, so it stays correct under
 * browser zoom / OS text-size settings without any JS-side px computation.
 * Exported so every such container sizes against this one constant instead of
 * a duplicated literal that can silently drift from the button's own class.
 */
export const EVENT_CARD_BADGE_MIN_TOUCH_REM = 2.75;

/**
 * `EventCardDateBox`'s two size variants (Story 1.i1k AC1): `default` = masonry's
 * `base_default`, `compact` = the compact row's `date_box`.
 */
export type EventCardDateBoxSize = 'default' | 'compact';

/**
 * Size-keyed recalibration of the badge-font-size token (AD-15, Story 1.i1k AC5), one
 * value per `EventCardDateBoxSize` — each variant's own `month`-line font-size (the
 * closest analog to the old single-line box's own font-size role, decided directly per
 * this story's own Dev Notes "HIL decisions" #1). `EVENT_CARD_BADGE_FONT_SIZE` above
 * (`0.75rem`) is unchanged and keeps its distinct role as `eventCardBadgeIconSizeStyle`'s
 * own inline fallback for the untouched standalone/`prominentPoster=true` path.
 */
export const EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE: Record<EventCardDateBoxSize, string> = {
  default: '1.125rem',
  compact: '0.875rem',
};

/**
 * Returns the size-keyed badge-font-size custom property declaration, mirroring
 * `eventCardBadgeIconSizeStyle`'s existing placement/export pattern. Declared on both
 * `EventCardMediaSlot`'s and `EventCardDateBox`'s roots (DOM siblings that communicate
 * icon scale only via this one shared custom property).
 */
export function badgeFontSizeStyleFor(size: EventCardDateBoxSize): CSSProperties {
  return {
    [EVENT_CARD_BADGE_FONT_SIZE_VAR]: EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE[size],
  } as CSSProperties;
}

/**
 * Story 1.i1m AC5 — the calendar compact row's favorite icon grows CONTINUOUSLY with the
 * row's own rendered width, not the viewport (this surface is `md:hidden`, so viewport
 * width doesn't predict row width either) and not a third fixed discrete ratio. The two
 * ratios above (`EVENT_CARD_BADGE_ICON_SCALE_LARGE`/`_DEFAULT`) are fixed multiples of a
 * sibling-declared font-size and cannot express "keeps growing as more space frees up" —
 * this is a distinct, row-only mechanism, not a third ratio in that family.
 *
 * Calibrated against the two real widths the prototype validates (round 6, final state —
 * `design-artifacts/UX-festgrid-run-1/prototypes/event-card-calendar-row/thumbnail-fallback.html`):
 * 36px icon at a 326px row (narrow mobile) and 56px icon at a 655px row (widest mobile,
 * just below the `md:` breakpoint this surface stops existing at). Linear interpolation
 * between those two points: `icon_px = 16.2 + 6.08 * containerWidthPercent`, expressed as
 * `cqi` (1cqi = 1% of the nearest `container-type: inline-size` ancestor's inline size —
 * see `EVENT_CARD_CONTAINER_CLASS`, reused on the row's own wrapper, not redefined here).
 * `clamp()` floors/caps the result at the two validated points themselves, so a real device
 * narrower than 326px or (this surface's ceiling) wider than 655px never extrapolates past
 * what was actually validated.
 *
 * CSS-only (`clamp()` + `cqi`), no `ResizeObserver` or other JS-side pixel math, per this
 * file's own stated design principle above and the precedent Story 1.i1l's AC7 established
 * for "this surface's own width, not the viewport" via a CSS container query.
 */
export const EVENT_CARD_ROW_FAVORITE_ICON_MIN_PX = 36;
export const EVENT_CARD_ROW_FAVORITE_ICON_MAX_PX = 56;

export function eventCardRowFavoriteIconGrowingStyle(): CSSProperties {
  const size = `clamp(${EVENT_CARD_ROW_FAVORITE_ICON_MIN_PX}px, calc(16.2px + 6.08cqi), ${EVENT_CARD_ROW_FAVORITE_ICON_MAX_PX}px)`;
  return { width: size, height: size };
}

/**
 * Story 1.i1m AC5 — the calendar row's favorite count text steps `text-sm` (14px, narrow
 * row) → `text-base` (16px, wide row), per the same validated prototype (round 6). Unlike
 * the icon above, two discrete steps satisfy the prototype exactly, so this reuses the
 * `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`/`EVENT_CARD_CONTAINER_CLASS` container-query technique
 * Story 1.i1l already shipped for masonry's badges, at a threshold re-tuned for this row's
 * own two real widths (326px/655px) rather than masonry's (175px/230px) — 490px sits
 * between them, mirroring that token's own "sits between the two real validated widths"
 * placement rule.
 */
export const EVENT_CARD_ROW_FAVORITE_COUNT_TEXT_SIZE_CLASS =
  'text-sm [@container(min-width:490px)]:text-base';
