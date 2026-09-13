---
title: 'Fix EventCard favorite-badge clipping and dead icon-size class'
type: 'bugfix'
created: '2026-09-13'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: a60515cbd7c9bd09db9a18c139b341d7fbb65bfa
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On a masonry-default card with no thumbnail image, the large centered favorite (heart) control is vertically clipped by the card's `overflow-hidden` — only the bottom point of the heart is visible, looking like a red chevron (confirmed live via Playwright against the seeded dev DB). Separately, `eventCardBadgeIconSizeClass()` builds a Tailwind arbitrary-value class via runtime string interpolation, so Tailwind's static scanner never generates CSS for it — the icon always falls back to lucide's default 24px regardless of the intended `default`/`large` calibration (confirmed via live `document.styleSheets` inspection: no matching rule exists).

**Approach:** (1) Stop pinning the favorite-badge wrapper's height to `dateBoxSize.h` when that height is smaller than the badge's own `min-h-11` (44px) touch target, so the badge never has to overflow its box to be usable. (2) Replace the dynamically-built `w-[...]`/`h-[...]` Tailwind classes with an inline `style` (computed from the same `EVENT_CARD_BADGE_FONT_SIZE_VAR`/ratio constants) on the `Heart` icon in both consumers, so the calibrated size is actually applied instead of silently no-op'ing.

## Boundaries & Constraints

**Always:**
- Keep `EVENT_CARD_BADGE_FONT_SIZE_VAR`, `EVENT_CARD_BADGE_ICON_SCALE_LARGE` (2), and `EVENT_CARD_BADGE_ICON_SCALE_DEFAULT` (5/3) as the calibration source of truth — only change how the computed size reaches the DOM.
- Both `EventCard.tsx:227-230` (non-masonry corner heart) and `EventCardMediaPrimitives.tsx`'s `EventCardFavoriteBadge` (masonry corner + large fallback) must consume the fixed sizing mechanism identically — do not fork the two.
- The favorite badge in the no-thumbnail masonry-default state must remain visually centered over the reserved blank thumbnail area (per `DESIGN.md` `event_card_favorite_count_badge_large` / `EXPERIENCE.md:184`), just no longer clipped.

**Ask First:** Any change that would alter the *visible size* of an already-correctly-rendering favorite badge elsewhere in the app (i.e. if fixing the dead class changes today's accidental 24px `default`-scale corner heart down to its intended ~20px) — flag it, don't silently ship a size change beyond this card family without calling it out in the summary.

**Never:** Touch badge_row (status/nearby badge), category/type chips, or `WeeklyCalendarView.tsx` — those are unrelated, separately tracked gaps. Do not change `dateBoxSize` measurement logic itself.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No thumbnail, short date box | `defaultThumbnailImagePresent=false`, `dateBoxSize.h` < 44px | Favorite badge renders as a complete, unclipped heart, still centered over the blank thumbnail area | N/A |
| No thumbnail, tall date box | `defaultThumbnailImagePresent=false`, `dateBoxSize.h` >= 44px | Unchanged — badge already fit before | N/A |
| Thumbnail present | `defaultThumbnailImagePresent=true` | Small corner pill renders at its calibrated ~20px size (`default` scale), not lucide's default 24px | N/A |
| Standalone corner heart (`!isMasonryDefault`, `EventCard.tsx:227`) | Any standard/masonry-with-thumbnail card | Icon renders at intended ~20px via the fixed sizing mechanism | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventCard.tsx` -- lines 246-262 wrap `EventCardFavoriteBadge` with a height pinned to `dateBoxSize.h`; lines 227-230 are the other `eventCardBadgeIconSizeClass` consumer.
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` -- `EventCardFavoriteBadge` (~line 119-172), `isLarge` button classes (line 150-151), `Heart` icon (line 157-166); **also** `EventCardMediaSlot`'s own internal `scale="large"` fallback wrapper (~line 98-109) -- missed in the original Code Map, see Spec Change Log.
- `packages/ui/src/features/events/event-card-media-tokens.ts` -- `eventCardBadgeIconSizeClass()` (54-61), the dead-class source; calibration constants to preserve; **also** the new `EVENT_CARD_BADGE_MIN_TOUCH_REM` constant.
- `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` -- existing tests assert on the className *string content* (lines 52-67), which is why jsdom never caught the dead-CSS issue; needs a real computed-size assertion added/adjusted.
- `packages/ui/src/features/events/EventCard.test.tsx` -- check existing corner-heart coverage, extend if it only asserts className strings too.

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/features/events/event-card-media-tokens.ts` -- replaced `eventCardBadgeIconSizeClass` with `eventCardBadgeIconSizeStyle`, returning `{ width, height }` computed off the same calibration constants. Added `EVENT_CARD_BADGE_MIN_TOUCH_REM` (2.75rem, matches `min-h-11`/`min-w-11`) as the single source of truth for the badge's own minimum touch-target size.
- [x] `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` -- `EventCardFavoriteBadge`'s `Heart` now takes the computed style instead of the dead class. `EventCardMediaSlot`'s own internal large-fallback wrapper (~line 98-109) now also carries `minHeight: EVENT_CARD_BADGE_MIN_TOUCH_REM + 'rem'` (see Spec Change Log -- this was the primitive itself, missed in the first pass).
- [x] `packages/ui/src/features/events/EventCard.tsx` -- corner heart (line ~227) uses the new style function; wrapper height (line ~260) keeps its explicit `height: dateBoxSize.h`, now paired with `minHeight: '2.75rem'` (CSS, not a JS `Math.max` on a hardcoded px number) so it never squeezes the badge below its own touch target, and stays correct under browser zoom / root font-size changes.
- [x] `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` and `EventCard.test.tsx` -- updated to assert the actual inline `style.width`/`style.height` on the rendered `<svg>`, built independently from the raw exported constants rather than by calling the function under test; added regression tests asserting `minHeight` on both wrappers.

**Acceptance Criteria:**
- Given a masonry-default card with no thumbnail and a short date box, when rendered, then the favorite button's bounding box does not extend above the card's own bounding box (no clipping).
- Given the `default` icon scale, when rendered anywhere it's used, then the `Heart` SVG's computed width/height is the calibrated value (~20px), not lucide's default 24px.
- Given the `large` icon scale, when rendered, then the `Heart` SVG's computed size remains ~24px (no visible regression there, since it already happened to be correct).

## Spec Change Log

- **Finding (Blind Hunter adversarial review):** the Code Map/Tasks only named `EventCard.tsx`'s bespoke sibling-badge wrapper as needing a height fix. `EventCardMediaPrimitives.tsx`'s own `EventCardMediaSlot` -- the shared primitive itself, which `EventCard.tsx` currently bypasses via `hideFavoriteBadge` specifically because of composition needs, and which the file's own doc comment names "Story 1.i1b" as a future direct consumer of -- has an identical internal `scale="large"` fallback wrapper (~line 98-109) with no minimum-height guard at all. Any future direct consumer of the primitive reproduces the exact clipping bug this spec set out to eliminate.
  **Amended:** Code Map and Tasks now name this location explicitly. **Avoids:** shipping a fix that only patches the bug's one currently-visible manifestation while leaving the same defect live in the shared primitive underneath it.
  **KEEP:** the `eventCardBadgeIconSizeStyle` inline-style approach and the `EVENT_CARD_BADGE_MIN_TOUCH_REM`-based CSS `minHeight` approach (not a JS `Math.max` on a hardcoded px number) both worked well and should not be re-derived differently.
- **Finding (Blind/Edge Case Hunter, deduplicated):** the original fix's `Math.max(dateBoxSize.h, 44)` hardcoded `44` (a) duplicates `min-h-11`'s `2.75rem` as an untracked literal that can silently drift if the button's touch-target class ever changes, and (b) assumes a 16px root font-size, silently under-protecting at any other root font-size (browser zoom, OS text-size accessibility settings).
  **Amended:** replaced the JS-side `Math.max` px comparison with a plain CSS `minHeight: '2.75rem'` (sourced from the new `EVENT_CARD_BADGE_MIN_TOUCH_REM` constant) alongside the existing explicit `height`. CSS resolves `rem` against the actual root font-size natively, and `min-height` already wins over a shorter `height` per the CSS spec -- no JS px math needed at all. **Avoids:** both the duplication and the fixed-root-font-size assumption in one change.
- **Findings not addressed here (see `deferred-work.md`):** (1) the wrapper's height inflating downward could, in a not-yet-observed case with a very short date box, bleed into the caption/badge_row below rather than only avoiding the top clip -- tied to a separately-tracked, still-open decision about the date box's own intended size; (2) no lint rule guards against a future dynamically-interpolated Tailwind arbitrary-value class being reintroduced elsewhere in this file family.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test` -- expected: all `EventCard`/`EventCardMediaPrimitives` tests pass, including the updated computed-size assertions.
- `pnpm --filter @festgrid/ui lint` -- expected: clean.

**Manual checks:**
- Re-run the Playwright screenshot against the local dev server (already running, seeded DB) on a no-thumbnail masonry card and confirm the heart renders as a complete shape, not a clipped chevron, and that its bounding box top is >= the card's bounding box top.

## Suggested Review Order

**Shared sizing/touch-target tokens (the fix everything else builds on)**

- The icon-size fix: replaces a Tailwind class Tailwind's scanner could never see with an inline style that actually applies.
  [`event-card-media-tokens.ts:61`](../../packages/ui/src/features/events/event-card-media-tokens.ts#L61)

- The touch-target constant: single source of truth for "never shorter than the badge's own min-h-11", in rem so it stays correct under browser zoom.
  [`event-card-media-tokens.ts:78`](../../packages/ui/src/features/events/event-card-media-tokens.ts#L78)

**Clipping fix, shared primitive (the gap Blind Hunter found — fix this first to see why the EventCard.tsx fix alone wasn't enough)**

- `EventCardMediaSlot`'s own large-fallback wrapper now floors its height — this is the primitive a future consumer (Story 1.i1b) adopts directly.
  [`EventCardMediaPrimitives.tsx:109`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L109)

- The icon itself takes the computed size via inline style instead of the dead class.
  [`EventCardMediaPrimitives.tsx:170`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L170)

**Clipping fix, EventCard's bespoke wrapper (the originally-reported bug)**

- CSS `minHeight` (not a JS `Math.max` on a hardcoded px number) alongside the existing explicit `height` — lets CSS resolve the rem-vs-px correctness for free.
  [`EventCard.tsx:271`](../../packages/ui/src/features/events/EventCard.tsx#L271)

- The `!isMasonryDefault` corner heart's icon sizing, fixed the same way for consistency.
  [`EventCard.tsx:233`](../../packages/ui/src/features/events/EventCard.tsx#L233)

**Regression tests (peripherals)**

- Independently-built expected size strings replace self-referential assertions that called the function under test to build their own expectation.
  [`EventCardMediaPrimitives.test.tsx:11`](../../packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx#L11)

- New tests assert the `minHeight` floor on both wrappers directly — the actual mechanism the clipping fix depends on.
  [`EventCard.test.tsx:509`](../../packages/ui/src/features/events/EventCard.test.tsx#L509)
