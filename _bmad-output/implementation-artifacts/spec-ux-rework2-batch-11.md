---
title: 'Show favorite count on Event Detail'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'beb4529476db68d74e8b7dded9611344004a2812'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`'s general rule ("if we show the favorite icon, also show its count") is already followed on `EventCard` (`packages/ui/src/features/events/EventCard.tsx:149-153`, an optional `favoriteCount` prop rendered as a `<span>` beside the `Heart` icon) and `WeeklyCalendarView`, but Event Detail's favorite button (`EventDetailView.tsx:252-260`) renders only the toggle icon, no count — the `getEventBySlug` query (`apps/web/src/features/events/queries.graphql:35-59`) doesn't select `favoriteCount` at all, even though the field already exists on the GraphQL type and is already selected by 3 other event queries (`getEvents`, `getEventsForCalendar`, `getEventsForMyCalendar`).

**Approach:** Add `favoriteCount` to the `getEventBySlug` query, thread it through `mapper.ts` into `EventDetailView`'s props, and render it next to the Heart icon using the same inline-count pattern already established on `EventCard`.

## Boundaries & Constraints

**Always:** Match `EventCard`'s exact visual pattern for the count (a `<span>` beside the icon, only rendered when the count is defined) rather than inventing a new layout. Regenerate GraphQL codegen after the query change (`pnpm --filter web run codegen`) — required, not optional, or `mapper.ts`'s new `.favoriteCount` reference will be type-broken.

**Ask First:** None anticipated — additive query field, additive prop, additive render, no existing behavior changes.

**Never:** Do not touch `EventCard.tsx`/`WeeklyCalendarView.tsx` (already correct, out of scope). Do not add a new translation key for the count itself — `EventCard`'s existing pattern uses no separate accessible label for the number (the button's own `aria-label` already describes the toggle action); match that, don't invent one.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Event has favorites | `event.favoriteCount > 0` | Favorite button shows the Heart icon plus the count, e.g. "❤ 12" | N/A |
| Event has zero favorites | `event.favoriteCount === 0` | Favorite button still shows "0" beside the icon (matches `EventCard`'s `favoriteCount !== undefined` check -- it doesn't hide on zero, only when the prop itself is absent) | N/A |
| Loading/error states | `EventDetailView` rendered with `loading`/`error` props (no real event data) | No favorite button renders at all today (existing behavior, `onFavoriteToggle` is undefined in those states) -- unaffected by this change | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/features/events/queries.graphql:35-59` -- add `favoriteCount` to `getEventBySlug`'s field selection (alongside the existing `isFavorited`)
- `apps/web/src/generated/graphql.ts` -- regenerate via `pnpm --filter web run codegen` after the query change (not hand-edited)
- `apps/web/src/features/events/mapper.ts:100` -- add `favoriteCount: event.favoriteCount,` beside the existing `isFavorited: event.isFavorited,` in `mapGraphQLEventToDetailViewProps`
- `packages/ui/src/features/events/EventDetailView.types.ts:98` -- add `favoriteCount?: number;` beside the existing `isFavorited?: boolean;`
- `packages/ui/src/features/events/EventDetailView.tsx:252-260` -- render the count beside the `Heart` icon, matching `EventCard.tsx:149-153`'s pattern (`{favoriteCount !== undefined && <span>...</span>}`)

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/features/events/queries.graphql` -- added `favoriteCount` to `getEventBySlug`
- [x] Ran `pnpm --filter web run codegen` to regenerate `apps/web/src/generated/graphql.ts`
- [x] `apps/web/src/features/events/mapper.ts` -- maps `favoriteCount` through
- [x] `packages/ui/src/features/events/EventDetailView.types.ts` -- added `favoriteCount?: number`
- [x] `packages/ui/src/features/events/EventDetailView.tsx` -- renders the count beside the Heart icon
- [x] `packages/ui/src/features/events/EventDetailView.test.tsx` -- 3 new tests (count shown, zero-count shown not hidden, no count when prop absent)
- [x] `apps/web/src/features/events/EventDetailWrapper.tsx` (not in original Code Map -- see Spec Change Log) -- mirrored the existing list-cache `favoriteCount` increment logic into the `["getEventBySlug"]` cache patch in the toggle-favorite mutation's `onSuccess`
- [x] `apps/web/src/features/events/EventDetailWrapper.test.tsx` -- added `favoriteCount: 3` to both mock-event fixtures, extended the existing list-cache double-counting test to also assert the detail page's own cache count updates on toggle

**Acceptance Criteria:**
- Given an event with `favoriteCount: 12`, when Event Detail renders, then the favorite button shows both the Heart icon and "12".
- Given `favoriteCount` is `0`, when Event Detail renders, then the button still shows "0" (matching `EventCard`'s `!== undefined` check, not a truthiness check).

## Suggested Review Order

- Entry point -- the query + data flow: [`queries.graphql:52`](../../apps/web/src/features/events/queries.graphql#L52), [`mapper.ts:101`](../../apps/web/src/features/events/mapper.ts#L101)
- The render: [`EventDetailView.tsx:255-268`](../../packages/ui/src/features/events/EventDetailView.tsx#L255-L268)
- Review-driven fix -- the cache-sync gap found during review, not in the original approved spec: [`EventDetailWrapper.tsx:102-118`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L102-L118)
- Tests: [`EventDetailView.test.tsx:250-274`](../../packages/ui/src/features/events/EventDetailView.test.tsx#L250-L274), [`EventDetailWrapper.test.tsx:392-399`](../../apps/web/src/features/events/EventDetailWrapper.test.tsx#L392-L399)

## Spec Change Log

- During implementation, found a real gap not covered by the original spec: `EventDetailWrapper.tsx`'s `toggleFavorite` mutation already optimistically syncs `favoriteCount` on the feed/home/favorites list caches when a user toggles favorite (an existing, already-tested pattern -- `Math.max(0, count + (isFavorited ? 1 : -1))`), but never touched `getEventBySlug`'s own cache for that field, since the field didn't exist there before this batch. Once the count is displayed, leaving this unfixed would mean clicking favorite on Event Detail itself instantly flips the heart icon but leaves the count stale until the next full refetch -- a visible inconsistency, not a hypothetical one. Fixed by mirroring the exact same increment logic into the existing `onSuccess` cache patch for `["getEventBySlug"]`. Extended `EventDetailWrapper.tsx`'s Code Map/Tasks accordingly (not present in the original approved version).

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test EventDetailView` -- 33/33 passed (30 existing + 3 new)
- `pnpm --filter web test EventDetailWrapper` -- 28/28 passed (existing tests + the extended cache-sync assertion)
- `pnpm --filter web run codegen && pnpm --filter web build` -- codegen regenerated cleanly, build succeeded, no TypeScript errors
- `pnpm test` (full monorepo) -- 364/365 passed; the 1 failure is the same pre-existing, already-documented `WeeklyCalendarView.test.tsx` date-flakiness (`2026-08-10` vs the now-real `2026-09-10`), unrelated to this batch

**Adversarial review:** Performed directly (Blind Hunter + Edge Case Hunter prompts/rigor -- `cline-cli` hung a third time today, see Spec Change Log). No blocking issues found. One minor, pre-existing gap logged to `deferred-work.md`: the favorite-count decrement (unfavorite) direction is untested for all 4 caches the toggle mutation patches, not just the one added this batch.
