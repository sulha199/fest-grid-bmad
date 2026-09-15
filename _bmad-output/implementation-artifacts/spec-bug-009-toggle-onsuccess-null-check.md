---
title: 'BUG-009: toggleFavorite/toggleCalendarAddition onSuccess read response fields without null-checking'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# BUG-009: toggleFavorite/toggleCalendarAddition onSuccess read response fields without null-checking

## Intent

**Problem:** In `EventDetailWrapper.tsx`, the `toggleFavorite` and `toggleCalendarAddition` mutations' `onSuccess` handlers read `data.toggleFavorite.isFavorited` / `data.toggleCalendarAddition.isAddedToCalendar` without checking that the parent object is non-null first, risking a `TypeError` if a resolver/codegen mismatch ever lets a 200 response through with a null payload.

**Approach:** Add an early guard in each `onSuccess` that, on a falsy `data.toggleFavorite` / `data.toggleCalendarAddition`, throws instead of reading further. TanStack Query v5's `execute()` awaits `onSuccess` inside its main try block (`@tanstack/query-core` `mutation.ts`), so a thrown error there is caught and routed through the mutation's own `onError` — reusing the existing optimistic-rollback + user-announcement logic instead of duplicating it, and (for `toggleCalendarAddition`, called via `mutateAsync`) correctly rejecting the promise so `handleAddToCalendar`'s `Promise.all`/try-catch treats it as a real failure rather than a false success. Added two unhappy-path integration tests (one per mutation) per the project's Testing Rules DoD.

## Suggested Review Order

**Defensive guards (the core fix)**

- Null-data guard throws to reuse the existing `onError` rollback/announcement path instead of silently returning.
  [`EventDetailWrapper.tsx:94`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L94)

- Same pattern for the calendar mutation; also fixes `handleAddToCalendar`'s `Promise.all` false-success risk since the thrown error now propagates through `mutateAsync`.
  [`EventDetailWrapper.tsx:203`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L203)

**Tests (peripherals)**

- Unhappy-path coverage: null-data favorite response rolls back and announces the error.
  [`EventDetailWrapper.test.tsx:482`](../../apps/web/src/features/events/EventDetailWrapper.test.tsx#L482)

- Unhappy-path coverage: null-data calendar response keeps the dialog open and announces the error.
  [`EventDetailWrapper.test.tsx:609`](../../apps/web/src/features/events/EventDetailWrapper.test.tsx#L609)

- MSW mock handlers for the new null-data response shape.
  [`EventDetailWrapper.test.tsx:173`](../../apps/web/src/features/events/EventDetailWrapper.test.tsx#L173)
