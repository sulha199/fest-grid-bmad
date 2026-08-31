---
title: 'ux-rework2-p1-sticky-filterhub-header'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'ready-for-dev'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/ux-rework2.md`'s P1 item: "ensure the filterhub and calendar/card view sticks to the top. Probably if its scrolled down, there is small button to make it appears. If we scroll again, we show that small button again." Today the search bar, `FilterHub`, and the card/calendar view-switcher tabs scroll away with the page content on every consumer.

**Approach:** Implement once in `EventDiscoveryPanel` (the single shared component all 5 consumers already render through) rather than per-page: the search+filter+switcher block becomes one sticky unit at `top: 0`; past a scroll threshold it collapses to a small "Show filters" button; clicking it scrolls back to top, which naturally re-expands it.

## Boundaries & Constraints

**Always:** Implement in `EventDiscoveryPanel.tsx` only — do not touch the 5 individual consumer pages, since they all render through it. New scroll-collapse behavior lives in a new reusable hook under `packages/ui/src/hooks/`, matching the existing hooks-folder convention. Respect `usePrefersReducedMotion()` (already exists) for the scroll-to-top behavior.

**Ask First:** None — the collapse threshold (scroll position based, not scroll-direction based) and the click-to-scroll-to-top expand mechanism fully determine the design; no existing sticky/scroll pattern exists in this codebase to conform to instead.

**Never:** Do not add this to `archive-content.tsx` or `my-calendar-content.tsx` — neither renders `EventDiscoveryPanel`/`FilterHub` at all (confirmed by investigation), so they're out of scope by construction. Do not build a scroll-direction-tracking hook (hide-on-scroll-down/show-on-scroll-up) — a simple scroll-position threshold is sufficient and was explicitly not required by the intent.

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventDiscoveryPanel.tsx:49-107` -- the panel's outer `space-y-8` div; lines 50-82 are the search+FilterHub block (`space-y-6` wrapper), lines 84-107 are the `role="tablist"` card/calendar view-switcher (only rendered when `views.length > 1`). Both need to move inside the new sticky/collapsible wrapper; `activeContent` (line 109) stays outside it, unaffected.
- `packages/ui/src/hooks/usePrefersReducedMotion.ts` -- existing hook, reuse for the expand action's scroll behavior (`'auto'` vs `'smooth'`).
- `packages/ui/src/hooks/index.ts` -- barrel export file; add the new hook's export here, following the existing pattern for `useInfiniteScroll` etc.
- `packages/ui/src/features/events/EventDiscoveryPanel.types.ts:12-35` -- `EventDiscoveryPanelProps`; add an optional `showFiltersLabel?: string` for the collapsed-state button's accessible label, matching the existing optional-string-label convention (e.g. `searchClearLabel`).
- No existing `sticky`/scroll-direction pattern exists anywhere in this codebase (confirmed by investigation) — this is new territory, build from scratch using the design below.
- `AppShell.tsx` uses `fixed` positioning for its nav rail/mobile tab bar (not sticky), and the page scrolls at the window/document level with no ancestor `overflow`/`transform` trap — a plain `sticky top-0` on `EventDiscoveryPanel`'s header block will track window scroll correctly with no offset needed.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/ui/src/hooks/useCollapseHeaderOnScroll.ts` (new) -- `useCollapseHeaderOnScroll(thresholdPx = 80)`: tracks `window.scrollY` via a passive `scroll` listener, returns `{ isCollapsed: boolean, expand: () => void }` where `isCollapsed = scrollY > thresholdPx` and `expand()` calls `window.scrollTo({ top: 0, behavior: usePrefersReducedMotion() ? 'auto' : 'smooth' })`. SSR-safe (no-op until mounted, matching `usePrefersReducedMotion`'s `typeof window === 'undefined'` guard).
- [ ] `packages/ui/src/hooks/index.ts` -- export the new hook.
- [ ] `EventDiscoveryPanel.tsx` -- wrap the search+FilterHub block and the view-switcher tabs together in one `<div className="sticky top-0 z-10 bg-background ...">`; when `isCollapsed`, render a small `<button onClick={expand} aria-label={showFiltersLabel || 'Show filters'}>` (icon + label) in place of the full block instead.
- [ ] `EventDiscoveryPanel.types.ts` -- add `showFiltersLabel?: string`.
- [ ] Add tests in a new `EventDiscoveryPanel.test.tsx` (or extend if one exists) and `useCollapseHeaderOnScroll.test.ts`: below the threshold the full header renders; above it the collapsed button renders instead and the full content does not; clicking the collapsed button calls `window.scrollTo` with `top: 0`.

**Acceptance Criteria:**
- Given any page using `EventDiscoveryPanel` (Discovery/home, Feed, Favorites, Account, Widget), when the page is scrolled near the top, then the search bar, FilterHub, and view-switcher render normally and stick to the top of the viewport while scrolling.
- Given the page is scrolled down past the threshold, when rendered, then the full header is replaced by a small "Show filters" button, still stuck to the top.
- Given the collapsed button is showing, when the user clicks it, then the page scrolls back to top and the full header reappears.
- Given `archive-content.tsx` or `my-calendar-content.tsx`, when rendered, then neither is affected by this change (they don't use `EventDiscoveryPanel`).

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- ui package type-checks (excluding the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter @festgrid/ui test EventDiscoveryPanel useCollapseHeaderOnScroll` -- new/targeted tests pass.
- `pnpm test` -- full project test suite passes.

