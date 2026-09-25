---
title: 'Fix EventCard masonry-default TILL badge clipping (BUG-041)'
type: 'bugfix'
created: '2026-09-25'
status: 'in-review'
review_loop_iteration: 0
context: []
baseline_commit: e79caaaacc330a1b359e6b8f857f2794cf93de9d
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `EventCard`'s masonry-default composition (`isMasonryDefault` branch,
`EventCard.tsx:325`) wraps its date-box+thumbnail row in a `<div className="relative flex
items-stretch gap-2">` with no padding, unlike the validated prototype
(`design-artifacts/UX-festgrid-run-1/prototypes/event-card-masonry/default-with-thumbnail.html:62`,
which wraps the same row in `p-2`). Because the row sits flush against the `<article>`'s own
`overflow-hidden` edges (`EventCard.tsx:240`), `EventCardDateBox`'s TILL corner tag
(`-top-1.5 -left-1.5`, `eventCardTillLabelClass('default')` in
`EventCardMediaPrimitives.tsx`) pokes outside the card and gets clipped instead of merely
overlapping the card's own padding as the prototype shows.

**Approach:** Add the missing `p-2` padding wrapper around that row to match the prototype.
Because the sibling favorite-badge overlay (no-thumbnail fallback, `EventCard.tsx:286-318`)
positions itself with `left: calc(dateBoxSize.w + 0.5rem)` / `top: 0` / `right: 0` measured
from the `<article>`'s edge — not from the row's new padded edge — adjust that inline-style
math to account for the newly-introduced `0.5rem` inset on all four sides so the overlay
still lines up with the date box and the reserved blank thumbnail area.

## Boundaries & Constraints

**Always:**
- Match the prototype's `p-2` exactly (0.5rem/8px on all sides) — do not invent a different
  padding value.
- Keep `dateBoxSize` measurement (`dateBoxRef` on the `shrink-0` inner div,
  `EventCard.tsx:125-132`) unchanged — it measures the date box element's own box, which is
  unaffected by its parent's padding, and stays correct as-is.
- The no-thumbnail favorite-badge overlay (`EventCard.tsx:286-318`) must still visually
  align with the date box's right edge + gap and the row's new padded top/right edges after
  the change — this is the one place the padding change has a side effect.

**Ask First:** None — fix is fully scoped and the one side-effect (overlay positioning) is
already identified above.

**Never:** Touch the `!isMasonryDefault` (standard/masonry-with-prominent-poster) branches,
`EventCardDateBox`/`EventCardMediaPrimitives.tsx` internals, or `WeeklyCalendarView.tsx` —
unrelated, separately tracked surfaces.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Masonry-default, thumbnail present, TILL label present | `isMasonryDefault=true`, `imageUrl` set, `tillBadgeText` truthy | TILL badge renders fully visible, not clipped by the article's `overflow-hidden` | N/A |
| Masonry-default, no thumbnail, favorite overlay shown | `isMasonryDefault=true`, `defaultThumbnailImagePresent=false`, `onFavoriteToggle` set | Favorite overlay still visually centers over the reserved blank thumbnail area (right after the date box + gap, inset by the row's new padding) | N/A |
| Masonry-default, no TILL label | `tillBadgeText` falsy | No visual regression — row simply gains 8px padding on all sides, unchanged otherwise | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventCard.tsx:325` -- the `isMasonryDefault` row `<div>` needs a `p-2` class added to match the prototype.
- `packages/ui/src/features/events/EventCard.tsx:293-308` -- the no-thumbnail favorite-badge overlay's inline `style` (`left`/`top`/`right`) must account for the new `0.5rem` padding on the row it no longer shares a coordinate origin with.
- `packages/ui/src/features/events/EventCard.test.tsx` -- check for existing dimension/snapshot assertions on the row's className or the overlay's inline style that this change affects; update if intentional.

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/features/events/EventCard.tsx` -- add `p-2` to the `isMasonryDefault` row's className (line 325) -- matches the validated prototype, gives the TILL badge's negative corner offset room inside the article's `overflow-hidden` bounds.
- [x] `packages/ui/src/features/events/EventCard.tsx` -- update the no-thumbnail favorite-badge overlay's `left`/`top`/`right` inline-style values (lines 293-308) to add the row's new `0.5rem` padding inset (`left: calc(dateBoxSize.w + 1rem)`, `top: '0.5rem'`, `right: '0.5rem'`) -- keeps the overlay aligned with the date box and blank thumbnail area now that the row has padding the overlay itself sits outside of.
- [x] `packages/ui/src/features/events/EventCard.test.tsx` -- added a test asserting the row wrapping the date box (and thus the TILL badge) carries `p-2` (jsdom has no real layout engine, so a bounding-box clip assertion isn't available -- this structural assertion is the deterministic proxy). No existing test depended on the old unpadded row/overlay geometry, so nothing else needed adjusting.

**Acceptance Criteria:**
- Given a masonry-default card with a thumbnail and a TILL label, when rendered, then the TILL badge's rendered classes/position keep it within the card's bounding box (not clipped by `overflow-hidden`).
- Given a masonry-default card with no thumbnail and a favorite toggle, when rendered, then the favorite overlay's computed inline-style position still corresponds to "right after the date box + gap, inset by the row's padding" rather than the pre-padding coordinates.
- Given a masonry-default card with no TILL label, when rendered, then no other visual regression is introduced (row simply carries the new padding).

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test` -- expected: all `EventCard`/`EventCardMediaPrimitives` tests pass, including new/updated TILL-clipping and overlay-position assertions.
- `pnpm --filter @festgrid/ui lint` -- expected: clean.

**Manual checks (if no CLI):**
- If `packages/visual-audit` has an existing manifest fixture that mounts `EventCard` in the masonry-default + thumbnail + TILL state, extend it (or note why not) to assert the TILL badge's bounding box stays within the card's own bounds. Not required if no matching manifest exists — a component-test assertion is the acceptable minimum bar for this scope.
