---
title: 'ux-rework2-p1-sticky-filterhub-header'
type: 'feature'
created: '2026-08-31T00:00:00Z'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '89e6bc3405e9570c91f4f045427513cbb0653056'
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
- [x] `packages/ui/src/hooks/useCollapseHeaderOnScroll.ts` (new) -- tracks `window.scrollY` via a passive `scroll` listener, returns `{ isCollapsed, expand }`. `expand()` calls `window.scrollTo(...)`, respecting `usePrefersReducedMotion()`. (Extended during review: accepts an optional `containerRef` used for two things -- (1) skip scroll-driven collapse while focus is inside the header, so an in-progress search/filter interaction isn't yanked away; (2) measure the header's own expanded-state height once on mount and use `Math.max(thresholdPx, measuredHeight)` as the real threshold, so collapsing doesn't visibly reflow content that's still on screen. `expand()` also now sets `isCollapsed` false eagerly instead of waiting for the scroll to physically cross the threshold.)
- [x] `packages/ui/src/hooks/index.ts` -- export the new hook.
- [x] `EventDiscoveryPanel.tsx` -- wrap the search+FilterHub block and the view-switcher tabs together in one sticky wrapper; collapsed state renders a small "Show filters" button in place of the full block. (Extended during review: both states now stay mounted, toggled via the `hidden` attribute rather than conditional rendering, so `aria-controls` always references a real element; the button carries `aria-expanded`/`aria-controls` instead of a redundant `aria-label` duplicating its own visible text; the sticky wrapper gained a bottom border + backdrop-blur so scrolling content doesn't visually bleed through it.)
- [x] `EventDiscoveryPanel.types.ts` -- add `showFiltersLabel?: string`.
- [x] Add tests in `EventDiscoveryPanel.test.tsx` and `useCollapseHeaderOnScroll.test.ts`: below the threshold the full header is visible; above it the collapsed button is visible instead and the full content is not; clicking the collapsed button calls `window.scrollTo` and immediately re-expands; the button's `aria-controls` resolves to a real element; scroll-driven collapse is skipped while focus is inside the header.

**Acceptance Criteria:**
- Given any page using `EventDiscoveryPanel` (Discovery/home, Feed, Favorites, Account, Widget), when the page is scrolled near the top, then the search bar, FilterHub, and view-switcher render normally and stick to the top of the viewport while scrolling.
- Given the page is scrolled down past the threshold, when rendered, then the full header is replaced by a small "Show filters" button, still stuck to the top.
- Given the collapsed button is showing, when the user clicks it, then the page scrolls back to top and the full header reappears.
- Given `archive-content.tsx` or `my-calendar-content.tsx`, when rendered, then neither is affected by this change (they don't use `EventDiscoveryPanel`).

## Spec Change Log

- 2026-08-31: Dispatched implementation to `cline-cli` (`--worktree`), spec pre-committed to `master` first. Independent verification found the initial implementation clean and structurally correct -- no defects (matching the prior calendar-collapse batch).
- 2026-08-31: Ran Blind Hunter + Edge Case Hunter adversarial review (`cline-cli`, `gemini-3.1-pro-preview`), independently verified every finding. Both surfaced real, substantive issues this time. Fixed: (1) scroll-driven collapse could unmount the search box or an open filter popover mid-interaction, dropping focus and closing the popover -- added a focus-containment guard that skips collapsing while focus is inside the header; (2) the header collapsing at a fixed 80px regardless of its own (much taller) rendered height would visibly reflow/jump content still on screen -- now measures the header's real expanded height once and uses that as the effective threshold; (3) `expand()` only triggered a scroll, so clicking "Show filters" gave no visible response until the (possibly interrupted, possibly reduced-motion-skipped) scroll physically crossed back under the threshold -- now sets state eagerly; (4) the collapsed button lacked `aria-expanded`/`aria-controls` (a disclosure widget with neither), and separately duplicated its own visible text into a redundant `aria-label`, causing double-announcement -- restructured to keep both states permanently mounted (toggled via `hidden`, not conditional rendering) so `aria-controls` always resolves to a real element, and removed the redundant label; (5) the sticky wrapper had no visual separation from scrolling content beneath it (flat `bg-background`, no border/blur) -- added a bottom border and backdrop-blur. One Blind Hunter claim (`-mt-4` "pushing content out of the viewport") was checked against the actual CSS and found false -- `-mt-4` paired with `pt-4` is a standard, intentional sticky-header technique that nets to zero visual offset, not a bug. Two low-severity findings (no explicit focus-restoration target after expand; a single-frame flash on first paint if the page loads already scrolled past the threshold) logged to `deferred-work.md`.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui exec tsc --noEmit` -- PASS (only the pre-existing, unrelated `baseUrl` deprecation warning).
- `pnpm --filter @festgrid/ui test EventDiscoveryPanel useCollapseHeaderOnScroll` -- PASS, 15/15.
- `pnpm --filter @festgrid/ui test` (full) -- PASS, 45 files / 351 tests.
- `web` package untouched by this batch (implementation is entirely within `packages/ui`); already verified green as of the prior batch.

## Suggested Review Order

**Sticky collapse, entry point**

- The hook: scroll-position state, expand action.
  [`useCollapseHeaderOnScroll.ts:48`](../../packages/ui/src/hooks/useCollapseHeaderOnScroll.ts#L48)

- Wired into the panel; both collapsed and expanded states stay mounted, toggled via `hidden`.
  [`EventDiscoveryPanel.tsx:51`](../../packages/ui/src/features/events/EventDiscoveryPanel.tsx#L51)
  [`EventDiscoveryPanel.tsx:64`](../../packages/ui/src/features/events/EventDiscoveryPanel.tsx#L64)

**Review-driven fixes**

- Focus-containment guard -- skips scroll-driven collapse while the user is mid-interaction inside the header.
  [`useCollapseHeaderOnScroll.ts:33`](../../packages/ui/src/hooks/useCollapseHeaderOnScroll.ts#L33)

- Measured-height threshold -- collapses only once the header's own real height has scrolled past, avoiding a visible content jump.
  [`useCollapseHeaderOnScroll.ts:28`](../../packages/ui/src/hooks/useCollapseHeaderOnScroll.ts#L28)

**Peripherals**

- New/updated tests, including the two review-driven regression cases (focus-containment, `aria-controls` linkage).
  [`EventDiscoveryPanel.test.tsx`](../../packages/ui/src/features/events/EventDiscoveryPanel.test.tsx)
  [`useCollapseHeaderOnScroll.test.ts`](../../packages/ui/src/hooks/useCollapseHeaderOnScroll.test.ts)

