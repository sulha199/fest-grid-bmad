---
title: 'FIND-053: Remove dead EventCard variant="standard" composition'
type: 'chore'
created: '2026-09-26'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# FIND-053: Remove dead EventCard variant="standard" composition

## Intent

**Problem:** `EventCard.tsx` carried a full second `variant='standard'` rendering composition (skeleton, sizing, favorite-pill position, and a categories/types/price caption) that no production call site ever exercised — `EventListView.tsx`, the only production mounter, always passed `variant="masonry"` explicitly.

**Approach:** Dropped `'standard'` from `EventCardProps.variant`'s union, collapsed every `isMasonry ?`-gated branch in `EventCard.tsx` to its masonry-only value, and deleted the standard-only caption block entirely. Updated/removed the test cases across `EventCard.test.tsx` and `EventListView.test.tsx` that exercised the removed variant, the removed categories/types/price caption, or relied on the (now-changed) default `variant` value, converting several to target the `prominentPoster` masonry state instead where that state is the only surviving consumer of the same underlying code (e.g. the raw `<img onError>` fallback, the corner favorite pill). Left `EventCardProps.categories`/`types`/`priceFrom` (and matching `EventCardLabels` fields) in place but unused — removing them is a further public-API change deferred for a separate decision (see Spec Change Log / deferred-work.md).

## Suggested Review Order

**Component logic (EventCard.tsx)**

- Entry point: every `isMasonry ?`-gated branch collapsed to its masonry value; `variant` prop no longer read.
  [`EventCard.tsx:106`](../../packages/ui/src/features/events/EventCard.tsx#L106)

- Loading skeleton, root `<article>` sizing, and favorite-pill positioning are now unconditional (masonry-only).
  [`EventCard.tsx:115`](../../packages/ui/src/features/events/EventCard.tsx#L115)

- The `variant === 'masonry' ? … : …` caption ternary is gone — the standard categories/types/price branch was deleted outright.
  [`EventCard.tsx:236`](../../packages/ui/src/features/events/EventCard.tsx#L236)

**Type surface (EventCard.types.ts)**

- `variant` narrowed from `'standard' | 'masonry'` to `'masonry'`; `categories`/`types`/`priceFrom` intentionally left in place but doc-commented as unused (deferred cleanup).
  [`EventCard.types.ts:35`](../../packages/ui/src/features/events/EventCard.types.ts#L35)

**Test fallout from the default `variant` changing (EventCard.test.tsx)**

- Locale/timezone-resolution tests moved off the deleted full-date-string caption onto the `prominentPoster` masonry overlay, with a new `expectedShortDate` helper matching its actual format.
  [`EventCard.test.tsx:14`](../../packages/ui/src/features/events/EventCard.test.tsx#L14)

- Image-error-fallback and favorite-pill-styling tests now explicitly pass `prominentPoster`, since that's the only remaining masonry state using the same raw-`<img>`/corner-pill code the removed default state used to.
  [`EventCard.test.tsx:190`](../../packages/ui/src/features/events/EventCard.test.tsx#L190)

- Deleted: the entire "priceFrom 'From' label pairing" describe block and the categories/types/translated-labels tests (dead render path); the standard-vs-masonry contrast tests in the "Story 1.i1l" describe block (no `standard` left to contrast against).

**EventListView.test.tsx**

- Deleted the `getCardProps` test asserting an override to `variant: 'standard'` — no longer a valid `EventCardProps` value.
  [`EventListView.test.tsx:168`](../../packages/ui/src/features/events/EventListView.test.tsx#L168)

## Spec Change Log

- Blind Hunter review flagged `categories`/`types`/`priceFrom` as newly-dead props left on the type, and `formatRelativeDayOrDate` as newly-dead now that its only caller (the deleted standard caption) is gone. Both deferred to `deferred-work.md` (separate public-API decisions, out of this fix's stated scope) rather than expanding this diff. The trivially-dead `defaultLabels.priceFrom`/`typeLabels`/`categoryLabels` computation inside `EventCard.tsx` (no longer read by anything) was patched immediately as an in-scope cleanup of the same function this fix already touched.
