---
title: 'ux-rework2-p1-masonry-only'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '178a61711cda1818a2425c0bad2f6abaaf85a36c'
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
- [x] Delete `ViewModeToggle.tsx`, `ViewModeToggle.types.ts`, `ViewModeToggle.test.tsx`; remove their exports from `index.ts`.
- [x] `EventListView.tsx`/`.types.ts` -- drop the `viewMode` prop entirely, hardcode the masonry `GridContainer` config (`baseCols={2} colsStep={1}`) as the only card-view rendering path.
- [x] `EventListView.test.tsx` -- update the viewMode/variant describe block to only cover masonry; delete the list-default case.
- [x] For each of the 5 consumer pages -- remove the `layout` nuqs state, the `ViewModeToggle` JSX, the layout-switch announcement/posthog-capture effect, and the `viewMode={layout}` prop; stop passing `viewMode` to `EventListView`. (Extended during review: for the 4 pages -- feed, archive, favorites, account -- where the layout-switch effect was the *only* producer of `setLiveMessage`, also removed the now-fully-dead `liveMessage` state and its `aria-live` region, which would otherwise have silently become a permanently-empty screen-reader announcement. `home-content.tsx`'s `liveMessage` stays -- its `view`-switch effect still uses it.)
- [x] Update/remove any test in each of the 5 pages' test files that asserts the toggle's presence or a layout-switch interaction. Also updated `page.test.tsx` (a route-level integration test not listed in the original Code Map, missed by the initial implementation pass) and two pre-existing `EventListView.test.tsx` tests whose price/category assertions depended on the now-unreachable 'standard' EventCard variant.

**Acceptance Criteria:**
- Given a user on any of the 5 pages (Discovery/home, Feed, Archive, Favorites, Account) in card view, when the page renders, then events display in masonry layout and no list/masonry toggle control is present.
- Given a user switches between card view and calendar view via the existing `view` switcher, when the switch happens, then that behavior is unaffected by this change.

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`), spec pre-committed to `master` first (this time correctly picked up). Independent verification (per standing practice -- both P0 batches had real defects behind a "success" report) found: (1) cline left two stray scratch codemod scripts (`remove-view-mode.js`, `remove-view-mode-tests.js`) committed at the repo root -- not pulled into the final merge; (2) a dead `parseAsStringLiteral` import left behind in all 5 consumer pages after removing the `layout` state that used it; (3) a route-level integration test (`page.test.tsx`) exercising the same toggle, not in the original Code Map and missed entirely by cline -- fixed by hand; (4) two pre-existing `EventListView.test.tsx` tests and one `page.test.tsx` assertion broke because they asserted on price/category-tag rendering that only the now-unreachable 'standard' EventCard variant ever produced (masonry's card body never rendered them -- a pre-existing, intentional EventCard design, not a regression) -- updated to drop those now-impossible assertions, preserving the enum-i18n safety net that's independently covered in `EventCard.test.tsx`.
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (`cline-cli`, `gemini-3.1-pro-preview`). Blind Hunter's most alarming-sounding claim ("mobile responsiveness destroyed" by hardcoding `baseCols=2`) was confirmed false -- `project-context.md`'s own documented masonry `GridContainer` config already specifies `baseCols=2 colsStep=1` including "2 cols mobile" as the intended design; 5 more of its 10 findings (orphaned `liveMessage`/dead `useState` import/orphaned `posthog`/weak test assertions/destructive test deletion) were also confirmed false by direct inspection. Edge Case Hunter's finding was different and real: removing the layout-switch effect left `liveMessage`/`setLiveMessage` with zero remaining producers in 4 of the 5 pages (feed, archive, favorites, account -- `home-content.tsx`'s `view`-switch effect still uses it), turning their `aria-live` regions into permanently-empty dead screen-reader announcements. Fixed by removing the now-fully-dead state and region in those 4 files (initially over-removed the `useState` import from `favorites-content.tsx`, which still needed it for an unrelated `unfavoritedIds` state -- caught by `tsc`, restored). Three low-severity findings (a now-single-child wrapper `<div>` in all 5 pages, unused i18n keys left in locale JSON, a stale `?layout=` URL param on old bookmarks) logged to `deferred-work.md` rather than risk further edits for negligible gain.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- PASS (only the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter web exec tsc --noEmit` -- PASS (only pre-existing, unrelated errors elsewhere).
- `pnpm --filter @festgrid/ui test EventListView` -- PASS, 9/9.
- `pnpm --filter web test home-content feed-content archive-content favorites-content account-content page.test` -- PASS, 5 files / 25 tests.
- `pnpm --filter @festgrid/ui test` (full) -- PASS, 44 files / 341 tests.
- `pnpm --filter web test` (full) -- PASS, 50 files / 293 tests.

## Suggested Review Order

**Masonry becomes the only card-view layout**

- Entry point -- both the loading-skeleton and success-state grids hardcode masonry's `GridContainer` config; the `viewMode` branch is gone.
  [`EventListView.tsx:21`](../../packages/ui/src/features/events/EventListView.tsx#L21)
  [`EventListView.tsx:55`](../../packages/ui/src/features/events/EventListView.tsx#L55)

- The toggle component itself, deleted outright.
  [`ViewModeToggle.tsx`](../../packages/ui/src/features/events/ViewModeToggle.tsx)

**Removing the toggle from all 5 consumer pages**

- Representative example -- `layout` URL-state, the toggle's JSX, and its announcement effect all removed together; the separate `view` (card/calendar) switcher is untouched.
  [`home-content.tsx`](../../apps/web/src/app/[locale]/home-content.tsx)
  [`feed-content.tsx`](../../apps/web/src/app/[locale]/feed/feed-content.tsx)
  [`archive-content.tsx`](../../apps/web/src/app/[locale]/archive/archive-content.tsx)
  [`favorites-content.tsx`](../../apps/web/src/app/[locale]/favorites/favorites-content.tsx)
  [`account-content.tsx`](../../apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx)

**Review-driven accessibility fix**

- `home-content.tsx` keeps its `liveMessage`/`aria-live` region -- still fed by the `view`-switch announcement.
  [`home-content.tsx:57`](../../apps/web/src/app/[locale]/home-content.tsx#L57)

- The other 4 pages had no other producer for that state once the layout-switch effect was removed; their now-fully-dead `liveMessage` state and `aria-live` region were removed too, rather than left as permanently-empty screen-reader announcements.

**Peripherals**

- Updated tests, including a route-level integration test cline's own pass missed entirely.
  [`EventListView.test.tsx`](../../packages/ui/src/features/events/EventListView.test.tsx)
  [`page.test.tsx`](../../apps/web/src/app/[locale]/page.test.tsx)

