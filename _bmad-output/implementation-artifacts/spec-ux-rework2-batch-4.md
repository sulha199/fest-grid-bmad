---
title: 'ux-rework2-p1-masonry-only'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'ready-for-dev'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`'s P1 item: "for card view, only use masonry view, remove the between-card-view-toggle." Card view currently offers a `list`/`masonry` layout toggle (`ViewModeToggle`); the user wants card view to always render as masonry, with the toggle removed.

**Approach:** Delete the `ViewModeToggle` component and its `layout` URL-state plumbing from all 5 consumer pages; make `EventListView`'s card-view rendering unconditionally masonry.

## Boundaries & Constraints

**Always:** Keep the separate `view` query param (`card` vs `calendar`, the calendar-vs-card-list switcher via `EventDiscoveryPanel`) completely untouched — only the `layout` (`list`/`masonry`) toggle within card view is in scope. Update all 5 call sites consistently.

**Ask First:** None — this is a mechanical removal with a clear, singular target state (always masonry).

**Never:** Do not touch the `view`/calendar-switcher logic. Do not touch any other already-`done` ux-rework2 item.

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/ViewModeToggle.tsx`, `ViewModeToggle.types.ts`, `ViewModeToggle.test.tsx` -- whole files, delete.
- `packages/ui/src/features/events/index.ts:18-19` -- remove `ViewModeToggle` exports.
- `packages/ui/src/features/events/EventListView.types.ts:35` -- `viewMode?: 'list' | 'masonry'` prop, remove.
- `packages/ui/src/features/events/EventListView.tsx:22,29,56,72` -- hardcode masonry rendering, drop the `viewMode` prop/branch.
- `packages/ui/src/features/events/EventListView.test.tsx:164-257` -- "viewMode and variant behaviors" describe block; keep only masonry-mode assertions (baseCols=2, variant="masonry"), remove the list-default case.
- 5 consumer pages, each with: a `layout` nuqs query-state (`useQueryState('layout', parseAsStringLiteral(['list','masonry']).withDefault('list'))`), a `<ViewModeToggle>` render block (~8 lines), a `layoutSwitcherAnnouncement`/`layout_switched` posthog-capture effect, and a `viewMode={layout}` prop passed to `EventListView` -- all four remnants removed per file:
  - `apps/web/src/app/[locale]/home-content.tsx` (state ~51-55, toggle+capture ~252-262)
  - `apps/web/src/app/[locale]/feed/feed-content.tsx` (state ~48-49, toggle+capture ~277-287)
  - `apps/web/src/app/[locale]/archive/archive-content.tsx` (state ~46-49, toggle+capture ~141-151)
  - `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (state ~84, toggle+capture ~344-354)
  - `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` (state ~61-62, toggle+capture ~268-278)

## Tasks & Acceptance

**Execution:**
- [ ] Delete `ViewModeToggle.tsx`, `ViewModeToggle.types.ts`, `ViewModeToggle.test.tsx`; remove their exports from `index.ts`.
- [ ] `EventListView.tsx`/`.types.ts` -- drop the `viewMode` prop entirely, hardcode the masonry `GridContainer` config (`baseCols={2} colsStep={1}`) as the only card-view rendering path.
- [ ] `EventListView.test.tsx` -- update the viewMode/variant describe block to only cover masonry; delete the list-default case.
- [ ] For each of the 5 consumer pages -- remove the `layout` nuqs state, the `ViewModeToggle` JSX, the layout-switch announcement/posthog-capture effect, and the `viewMode={layout}` prop; stop passing `viewMode` to `EventListView` (or pass nothing, relying on the new hardcoded default).
- [ ] Update/remove any test in each of the 5 pages' test files that asserts the toggle's presence or a layout-switch interaction.

**Acceptance Criteria:**
- Given a user on any of the 5 pages (Discovery/home, Feed, Archive, Favorites, Account) in card view, when the page renders, then events display in masonry layout and no list/masonry toggle control is present.
- Given a user switches between card view and calendar view via the existing `view` switcher, when the switch happens, then that behavior is unaffected by this change.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- ui package type-checks (excluding the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter web exec tsc --noEmit` -- web app type-checks.
- `pnpm --filter @festgrid/ui test EventListView` -- targeted test passes.
- `pnpm --filter web test home-content feed-content archive-content favorites-content account-content` -- targeted tests pass.
- `pnpm test` -- full project test suite passes (the pre-existing, unrelated `EventCard.test.tsx` masonry-badge failure, already logged in `deferred-work.md`, is expected to remain the only failure if still present).

