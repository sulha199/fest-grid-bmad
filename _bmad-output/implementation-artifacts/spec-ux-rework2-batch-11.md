---
title: 'Show favorite count on Event Detail'
type: 'feature'
created: '2026-09-01'
status: 'in-progress'
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
- [ ] `apps/web/src/features/events/queries.graphql` -- add `favoriteCount` to `getEventBySlug`
- [ ] Run `pnpm --filter web run codegen` to regenerate `apps/web/src/generated/graphql.ts`
- [ ] `apps/web/src/features/events/mapper.ts` -- map `favoriteCount` through
- [ ] `packages/ui/src/features/events/EventDetailView.types.ts` -- add `favoriteCount?: number`
- [ ] `packages/ui/src/features/events/EventDetailView.tsx` -- render the count beside the Heart icon
- [ ] Add a test on `EventDetailView.test.tsx` asserting the count renders when `favoriteCount` is passed, and an integration assertion on `EventDetailWrapper.test.tsx` that the real query's mocked response flows the count through to the rendered button

**Acceptance Criteria:**
- Given an event with `favoriteCount: 12`, when Event Detail renders, then the favorite button shows both the Heart icon and "12".
- Given `favoriteCount` is `0`, when Event Detail renders, then the button still shows "0" (matching `EventCard`'s `!== undefined` check, not a truthiness check).

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test EventDetailView` -- expected: existing tests pass, new count test passes
- `pnpm --filter web test EventDetailWrapper` -- expected: existing tests pass, new integration assertion passes
- `pnpm --filter web run codegen && pnpm --filter web build` -- expected: codegen regenerates cleanly, no TypeScript errors
- `pnpm test` (full monorepo) -- expected: no new regressions (the pre-existing, already-documented `WeeklyCalendarView.test.tsx` date-flakiness failure is unrelated and may still appear)
