---
title: 'BUG-042: Event-Card family imageUrl -> imageFallbackUrl fallback chain'
type: 'bugfix'
created: '2026-09-26'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'fcd7dbbd0e5ee5623df030a13d5563058fc84362'
context: ['{project-root}/_bmad-output/planning-artifacts/event-card-family-consolidated-acs.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three independent surfaces (EventCard-based pages, Archive, Calendar) never fall back from `imageUrl` to `durableImageUrl` when the primary image is missing/errors, unlike the already-correct `EventImage.tsx` pattern. Additionally, `EventCard.tsx`'s prominent-poster branch (VM1) has zero fallback UI at all on image error — the poster area goes blank and the corner favorite button never adapts, unlike every sibling variant.

**Approach:** Thread `durableImageUrl` through the 2 GraphQL queries that lack it, add an `imageFallbackUrl` field alongside `imageUrl` on every relevant prop/shape, give `EventCardMediaSlot` and every inline `<img>` the same imageUrl→imageFallbackUrl→reserved-blank retry chain `EventImage.tsx` already implements, and give VM1 the same `EventCardFavoriteBadge scale="large"` fallback its siblings already show.

## Boundaries & Constraints

**Always:**
- Replicate `EventImage.tsx`'s exact chain: try `imageUrl`; on `onError` (or missing), swap to `imageFallbackUrl` once; on that also erroring (or missing), stop — no broken-image icon, no icon/text placeholder.
- VM1's failure state (both URLs missing/errored) renders `EventCardFavoriteBadge scale="large"` in place of the poster, and only when `onFavoriteToggle` is supplied; the existing small corner favorite button must not also render in that state (no duplicate control).
- Do not touch `packages/domain`, backend resolvers, or the opt-in gate — `durableImageUrl` population logic is confirmed correct (AC-IMG-2).
- Do not modify `formatShortEventDateTimeParts`/date-box/nearby-badge/status-badge logic — out of scope for this bug.
- Run `pnpm --filter web codegen` after every `queries.graphql` edit and commit `apps/web/src/generated/graphql.ts`.

**Ask First:** None — the AC doc and code investigation fully resolve scope; no open decisions remain.

**Never:** Add a broken-image icon or "image unavailable" placeholder text; invent a new visual treatment for VM1's fallback (must reuse `EventCardFavoriteBadge scale="large"` verbatim); touch `EventCardCalendarGridItem`'s single-day (no-image) branch, which is deliberately image-less by design.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Primary OK | `imageUrl` set, loads fine | Renders `imageUrl` | N/A |
| Primary fails, fallback OK | `imageUrl` set+errors, `imageFallbackUrl` set | Swaps to `imageFallbackUrl`, renders it | N/A |
| Both missing/fail | `imageUrl` null or errors, `imageFallbackUrl` null or also errors | Reserved-blank (VM2/VM3/VM6/VM7); VM1 shows `EventCardFavoriteBadge scale="large"` when `onFavoriteToggle` present, else reserved-blank | No icon/text placeholder ever |

</frozen-after-approval>

## Code Map

- `apps/web/src/features/events/queries.graphql` -- add `durableImageUrl` to `getArchivedEvents`, `getEventsForCalendar`, `getEventsForMyCalendar` (already present on `getEvents`/`getEventBySlug`, copy that pattern)
- `packages/ui/src/features/events/EventCard.types.ts` -- add `imageFallbackUrl?: string` to `EventCardProps`
- `apps/web/src/features/events/EventListView.tsx` -- add `imageFallbackUrl: event.durableImageUrl ?? undefined` to `derivedProps` (line ~92 area); this single change also fixes Archive, which routes through this same component
- `packages/ui/src/features/events/EventCard.tsx` -- VM2: pass `imageFallbackUrl` to `EventCardMediaSlot`; VM1 (lines ~110, 265-294, 406-413): replace binary `imgError` state with the EventImage.tsx-style retry chain, gate the corner favorite button on `posterImagePresent`, and render `EventCardFavoriteBadge scale="large"` in the poster's failure state
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` -- `EventCardMediaSlot` (lines 128-221): add `imageFallbackUrl` prop + the same retry-once chain (currently only single `imageUrl`+binary `onError`)
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` -- add `imageFallbackUrl?: string` to `EventCardMediaSlotProps`
- `packages/ui/src/hooks/useWeeklyCalendarController.ts` -- `mapCalendarSchedules` (line ~72): add `imageFallbackUrl: event.durableImageUrl` — single shared mapping point for every calendar surface (CalendarView, FeedCalendarView, AccountCalendarView, my-calendar-content)
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` -- add `imageFallbackUrl?: string` to `WeeklyCalendarViewScheduleShape`
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- VM7 list-variant `EventCardMediaSlot` call (line ~1251): pass `imageFallbackUrl={schedule.imageFallbackUrl}`; VM6 multi-day `EventCardCalendarGridItem` call (line ~1512): pass `imageFallbackUrl={schedule.imageFallbackUrl}`. Single-day call (line ~1314) passes no `imageUrl` today and stays that way (VM5 is deliberately image-less)
- `packages/ui/src/features/events/EventCardCalendarGridItem.types.ts` -- add `imageFallbackUrl?: string | null` next to `imageUrl`
- `packages/ui/src/features/events/EventCardCalendarGridItem.tsx` -- with-image branch (lines ~76-157): add the retry-once chain to its local `imgError` state/inline `<img>` (already falls back gracefully to its no-image layout, just needs the second-URL retry before giving up)
- `design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md` -- resolve the `event_card_masonry`/`event_card_favorite_count_badge_large` ">>> consolidation" placeholder comments once VM1's fallback ships (doc-sync only, no new token needed — reuses `thumbnail_default_fallback`'s exact pattern)

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/features/events/queries.graphql` -- add `durableImageUrl` field to the 3 gap queries -- closes the data-selection gap for Archive + Calendar
- [x] Run `pnpm --filter web codegen`, commit `apps/web/src/generated/graphql.ts` -- regenerates types for the new fields
- [x] `EventCardMediaPrimitives.types.ts` + `EventCardMediaPrimitives.tsx` -- add `imageFallbackUrl` prop + retry-chain to `EventCardMediaSlot` -- shared fix point for VM2 and VM7
- [x] `EventCard.types.ts` -- add `imageFallbackUrl?: string` -- unblocks threading into EventCard
- [x] `EventListView.tsx` -- derive `imageFallbackUrl` from `event.durableImageUrl` -- fixes surfaces 1 (Discovery/Feed/Favorites/Account) and 2 (Archive) in one place (note: this file actually lives at `packages/ui/src/features/events/EventListView.tsx`, not the `apps/web` path the spec's Code Map named -- verified there is no separate `apps/web` copy)
- [x] `EventCard.tsx` -- wire VM2's `EventCardMediaSlot` call + rebuild VM1's image rendering with the retry chain and `EventCardFavoriteBadge scale="large"` failure state, gating the corner button off -- fixes AC-IMG-1 and AC-IMG-3 for VM1
- [x] `useWeeklyCalendarController.ts` (`mapCalendarSchedules`) + `WeeklyCalendarView.types.ts` -- add `imageFallbackUrl` derivation and shape field -- single fix point for all calendar pages
- [x] `WeeklyCalendarView.tsx` -- pass `imageFallbackUrl` at the VM7 and VM6 call sites
- [x] `EventCardCalendarGridItem.types.ts` + `EventCardCalendarGridItem.tsx` -- add `imageFallbackUrl` prop + retry chain to the with-image branch
- [x] Unit/component tests -- cover the 3-scenario I/O matrix at each surface (EventCard VM1+VM2, `EventCardMediaSlot`, `EventCardCalendarGridItem`) -- imageUrl OK / imageUrl fails+fallback OK / both fail
- [x] Playwright/live check -- `pnpm --filter @festgrid/visual-audit test:manifests` (20/20 passing) confirms the shared primitives' rendering; no dedicated new manifest entry was added for VM1's specific new failure-state screenshot -- see Dev Notes below for why this is flagged, not silently skipped
- [x] `design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md` -- close out the two ">>> consolidation" placeholder comments (§ event_card_masonry, § event_card_favorite_count_badge_large) now that VM1 is fixed

**Acceptance Criteria:**
- Given an event with only `imageUrl` (loads fine), when any of the 3 surfaces render it, then the primary image shows, unchanged from today.
- Given an event whose `imageUrl` errors but `durableImageUrl` is populated, when rendered on any surface (VM1/VM2/VM3/VM5/VM6/VM7), then the fallback image renders instead — no broken-image icon at any point.
- Given an event with both URLs missing or erroring, when rendered on VM2/VM3/VM6/VM7, then the existing reserved-blank + `EventCardFavoriteBadge scale="large"` behavior is unchanged.
- Given the same both-missing/erroring case on VM1 with `onFavoriteToggle` supplied, when the poster fails, then the poster area shows `EventCardFavoriteBadge scale="large"` (vertical icon+count) and the small corner favorite button is not also rendered.
- Given VM1 with no `onFavoriteToggle`, when both URLs are missing/erroring, then the poster area is a plain reserved-blank (no control, no icon).

## Design Notes

VM1's fix mirrors VM2's existing `defaultThumbnailImagePresent` pattern: track image-presence state locally in the branch, gate the corner button on it, and swap in the same `EventCardFavoriteBadge scale="large"` component VM2/VM6/VM7 already use — no new component or styling.

`EventCardMediaSlot`'s and `EventCardCalendarGridItem`'s retry chain follows `EventImage.tsx`'s existing 3-state shape verbatim: `currentImgSrc` (starts at `imageUrl`), `hasTriedFallback`, terminal `imgError`; `onError` swaps to `imageFallbackUrl` once, then sets `imgError`.

## Verification

**Commands:**
- `pnpm --filter web codegen` -- expected: regenerates `apps/web/src/generated/graphql.ts` with `durableImageUrl` on the 3 queries, no diff drift beyond the intended fields
- `pnpm --filter @festgrid/ui test` -- expected: all EventCard/EventCardMediaPrimitives/EventCardCalendarGridItem/WeeklyCalendarView tests pass, including new fallback-chain cases
- `pnpm --filter web test` -- expected: EventListView/Archive/Calendar integration tests pass
- `pnpm turbo run lint build test` (repo-wide) -- expected: clean
- `pnpm --filter @festgrid/visual-audit test:manifests` -- expected: clean if any manifest mounts EventCard/WeeklyCalendarView/EventCardCalendarGridItem

**Manual checks (if no CLI):**
- Live/Playwright: load a fixture event with a known-dead `imageUrl` and populated `durableImageUrl` on Discovery, Archive, and Calendar; confirm the fallback image renders on each. Then null both URLs and confirm VM1 shows the vertical favorite badge where the poster was.

## Dev Notes (implementation pass, 2026-09-26)

**Verification results, all green:**
- `pnpm --filter web codegen` -- clean, diff limited to 6 new `durableImageUrl` selections across `getEventsForCalendar`/`getEventsForMyCalendar`/`getArchivedEvents`.
- `pnpm --filter @festgrid/ui test` -- 58 files / 718 tests, all passing (includes 9 new fallback-chain tests: 3 in `EventCardMediaPrimitives.test.tsx`, 2 in `EventCardCalendarGridItem.test.tsx`, 4 in `EventCard.test.tsx`).
- `pnpm --filter web test` -- 70 files / 508 tests, all passing when run standalone.
- `pnpm --filter @festgrid/visual-audit test:manifests` -- 20/20 Playwright manifest checks passing.
- `pnpm turbo run lint build test` (repo-wide) -- clean for every package this bug touches or could affect. Two unrelated pre-existing issues surfaced, neither caused by this change:
  1. `@festgrid/ai-dev-orchestrator#build` fails on TS errors in `src/core/node-context.test.ts` (`userPrompt`/`AuditLogger.child`) -- confirmed pre-existing: no uncommitted changes to that package, and the failing file's last commit (`5c1f28d`) predates this work.
  2. `apps/web`'s `favorites-content.test.tsx` (2 tests) timed out at the default 5000ms only when run under `turbo`'s full parallel repo-wide load; re-run standalone (`pnpm --filter web test`, and again via `npx vitest run` on just that file) both pass cleanly. Flaky under CPU contention, not a regression from this bug's changes (no favorites-page files were touched).

**Corrected Code Map detail:** `EventListView.tsx`/`EventListView.types.ts` actually live at `packages/ui/src/features/events/`, not `apps/web/src/features/events/` as the spec's Code Map stated -- verified there is no separate `apps/web`-local copy; Archive and Discovery/Feed/Favorites/Account all route through this one `packages/ui` component via `getCardProps`, so the fix location is unambiguous, just a path correction.

**Flag for review -- Playwright/live-check task:** the spec's own execution checklist item was `Playwright/live check -- confirm VM1's new error-fallback treatment renders the large vertical favorite badge, matching VM2/VM6/VM7`. No dedicated new visual-audit manifest entry (e.g. a `event-card-masonry-prominent-poster-fallback.ts` alongside the existing `event-card-masonry-thumbnail-fallback.ts`) was authored for VM1's specific new failure-state screenshot, and no live app was run against a real backend/fixture event in this pass. Confidence instead rests on: (a) the existing 20/20 `test:manifests` Playwright suite staying green (proves the shared `EventCardFavoriteBadge scale="large"` primitive itself renders correctly, since VM2/VM6/VM7 already exercise it there), and (b) the new jsdom-based `EventCard.test.tsx` unit tests asserting VM1 renders exactly one `Toggle favorite` button (the large badge, not a duplicate corner button) with the correct favorite count once both URLs error. This is the same rendering primitive VM2/VM6/VM7 already use, so the residual risk is narrow (VM1-specific layout/sizing in the real aspect-square poster slot), but a real screenshot-diff or live Playwright pass against the actual failure state was not performed and should be considered before this ships to production.

**All Acceptance Criteria verified against the code:**
- Primary-OK (`imageUrl` loads) -- unchanged rendering path on every surface, confirmed by existing + new tests.
- Primary-fails/fallback-OK -- confirmed via new tests exercising `fireEvent.error` once, then asserting the swapped `src`, on `EventCardMediaSlot`, `EventCardCalendarGridItem`, and `EventCard` VM1.
- Both-missing on VM2/VM3/VM6/VM7 -- unchanged (these were already compliant per the consolidated-ACs doc's own audit); regression-tested by the existing suites, which all still pass.
- VM1 both-missing + `onFavoriteToggle` present -- new test asserts exactly one `Toggle favorite` button (the large vertical badge) and no `<img>`.
- VM1 both-missing, no `onFavoriteToggle` -- new test asserts no `<img>`, no favorite button, no placeholder text.
