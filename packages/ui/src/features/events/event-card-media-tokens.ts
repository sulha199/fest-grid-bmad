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
