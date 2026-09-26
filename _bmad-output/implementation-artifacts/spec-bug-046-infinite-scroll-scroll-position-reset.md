---
title: 'BUG-046: infinite scroll snaps to the new bottom on every page load'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: f214f4e4451e88f05032d2f3e355d3119a4083bc
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On production (`fest-grid.vercel.app/id`), every infinite-scroll page load snaps the
viewport to the new bottom of the list instead of preserving scroll position. This is the SAME
root mechanism BUG-038 (2026-09-19) already diagnosed and fixed — CSS scroll-anchoring picking an
anchor near the bottom of the visible viewport and compensating when content is inserted above it
— but BUG-038's fix has a gap: it scopes `overflow-anchor: none` only to `EventDiscoveryPanel`'s
own subtree (cards + sentinel). Live Playwright measurement against production (`/id`, real wheel
scroll input, frame-by-frame `scrollY`/`scrollHeight` sampling) proves the browser is still
anchoring — but to `<body>`/`<main>` themselves, which sit **outside** that excluded subtree and
were never covered by BUG-038's scoped fix. Confirmed: forcing `overflow-anchor: none` on `body`
alone (or `main` alone) via an injected stylesheet fully and reproducibly eliminates the jump
(verified 2x each); the app's existing scoped rule alone does not (reproduced 2x, identical
+706px single-frame jump both times). `html`-only was tested and insufficient — `body`/`main`
must be targeted directly. The original "confirm empirically before committing to a fix"
directive paid off: the leading theory (scoped sentinel-level `overflow-anchor: none`) was the
right *class* of fix but the wrong *scope*.

**Approach:** Add `overflow-anchor: none` to the `body` selector in `apps/web/src/app/globals.css`
(the app's single global element, alongside its existing `bg-background text-foreground` rule) —
a one-line, app-wide, single-place fix that supersedes chasing every possible anchor node
component-by-component. Leave BUG-038's existing `EventDiscoveryPanel`/`EventListView` rules in
place (harmless, now redundant but not wrong — no need to touch them).

## Boundaries & Constraints

**Always:** Touch only `apps/web/src/app/globals.css`'s existing `body { ... }` rule (add
`overflow-anchor: none` inside it). Do not touch `useInfiniteScroll.ts`, `useMasonryLayout.ts`,
`grid-container.tsx`, or `EventListView.tsx`/`EventDiscoveryPanel.tsx`'s existing scroll-anchoring
classes — confirmed not the gap (they already exclude their own subtree correctly; the gap is
outside them). Do not touch anything related to BUG-043 (the separate "fetch stops after one
page" bug) even though both live in the same infinite-scroll surface.

**Ask First:** none — single CSS-rule addition, mechanically verified live against production
before and after.

**Never:** Do not adopt a virtualization/infinite-scroll library (AD-27 — the masonry engine's
incremental item-count growth is unrelated to this fix and out of scope). Do not remove or
"clean up" BUG-038's existing scoped `[overflow-anchor:none]` classes as part of this fix — they
are redundant now, not incorrect, and removing them is unvalidated scope creep against a
previously-shipped, separately-reviewed fix.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Scroll near bottom, next page loads | User scrolls Discovery to trigger `fetchNextPage`; new cards render | `scrollY` changes only by the user's own scroll input for that frame (no jump beyond it) | N/A |
| Scroll up after a page load, then trigger another | User scrolls up (away from bottom), then back down to trigger the next page | `scrollY` does not snap to the new bottom; it tracks only the user's own wheel input | N/A |
| Legitimate anchor use elsewhere in the app | Any other page/component relying on default scroll-anchoring behavior | None found — BUG-031/BUG-038 already disabled it for this exact list surface; no other consumer intentionally relies on `body`-level anchoring | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/globals.css` -- add `overflow-anchor: none;` to the existing `body { @apply bg-background text-foreground; }` rule (`@layer base`, ~line 89). This is the actual anchor-eligible ancestor outside `EventDiscoveryPanel`'s excluded subtree; confirmed via live production measurement.
- `apps/web/src/app/[locale]/layout.tsx` -- read-only reference: renders the single `<body>` element this fix targets; no edit needed here (CSS-only fix).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/globals.css` -- add `overflow-anchor: none;` inside the existing `body { }` rule in the `@layer base` block -- this is the minimal, single-place fix that closes the gap BUG-038's component-scoped fix left open (verified live: `body`-only or `main`-only exclusion each independently eliminates the jump; the app's existing scoped rule alone does not).

**Acceptance Criteria:**
- Given the Discovery page with more than one page of results, when the user scrolls to trigger a second page load, then `scrollY` after the load settles differs from `scrollY` immediately after the triggering scroll input by no more than a few px of layout noise (not a multi-hundred-px jump to the new bottom).
- Given the user has scrolled up (away from the bottom) after a page load, when they scroll back down and trigger another page load, then the viewport does not snap past their own scroll input to the new bottom of the list.
- Given any other page in the app using default document scrolling, when content anywhere on that page changes size, then no functional regression is expected — no other page/component in this codebase intentionally relies on browser scroll-anchoring (BUG-031/BUG-038 already disable it for the one list surface that used to need it).

## Design Notes

CSS Scroll Anchoring exclusion (`overflow-anchor: none`) does not propagate from an ancestor
(`html`) down through the whole document subtree the way normal CSS inheritance does — verified
live: excluding `html` alone left the jump fully reproducible, while excluding `body` alone (or
`main` alone) eliminated it. Each element that could plausibly be selected as an anchor candidate
needs its own `overflow-anchor: none`, not just the subtree containing the content that visibly
grows. This is why BUG-038's fix (scoped to `EventDiscoveryPanel`'s own subtree) was incomplete:
it correctly excluded the cards/sentinel from being *picked as* an anchor, but never excluded the
outer `<body>`/`<main>` boxes that wrap them, which the browser was still willing to anchor to.

## Verification

**Commands:**
- Live Playwright check against production, ad hoc (not preserved as a repo test — matches
  BUG-038's own verification method): navigate to `https://fest-grid.vercel.app/id`, real wheel
  scroll input, frame-by-frame `scrollY`/`scrollHeight` sampling. Pre-fix: reproduced 2x,
  consistent +706px single-frame jump landing exactly at the new bottom. Confirmed via controlled
  stylesheet injection (not the actual code fix, but the identical CSS rule) that excluding `body`
  alone (or `main` alone) eliminates the jump, reproduced 2x each; `html`-only does not, reproduced
  2x. This isolates the fix with the same rigor as running it pre/post-deploy would, without
  needing a deploy to prove it.
- **Local repro attempted and explicitly did not transfer**, worth recording: seeded ~40 extra
  local events with real, variable-height (`picsum.photos`, 300-900px), async-loading images
  (matching production's real Instagram-image variance) and drove the same scroll sequence against
  both `pnpm dev` and a real `pnpm build && pnpm start` production build, locally. Neither
  reproduced the jump — not even the pre-fix baseline (CSS fix temporarily stashed, confirmed via
  `getComputedStyle(document.body).overflowAnchor === 'auto'`). This means local `picsum.photos`
  images likely resolve too fast/uniformly (fast CDN, tiny files, no per-image latency spread) to
  reproduce the specific "many async height changes while the sentinel region is mid-viewport"
  race that real Instagram-CDN image latency on production creates — an environmental gap, not a
  sign the fix is wrong (same class of jsdom/real-browser gap BUG-031/038 already hit; see
  `deferred-work.md`'s ux-rework2-batch-10 entry). Local synthetic data and scripts were cleaned up
  after this attempt (DB rows deleted, ad hoc scripts removed) — nothing from this attempt is
  committed. Verification therefore rests on the production-based isolation above, which is the
  live-equivalent surface the bug was actually reported against.
- `pnpm --filter web lint` -- expected: clean, no new violations.
- `pnpm build` (repo root) -- expected: clean, no regressions (already re-run once locally as part
  of the production-build local-repro attempt above; passed clean pre-fix).
- `pnpm test` (repo root) -- expected: no new failures (this is a CSS-only change with no
  unit-testable logic; jsdom cannot exercise real CSS scroll anchoring, matching the precedent
  already documented for BUG-031/038 in `deferred-work.md`).

**Manual checks (if no CLI):** After deploy, scroll the Discovery page (`/id` or `/en`) down to
trigger a second page load, then scroll up partway and trigger a third; confirm the viewport never
jumps past the user's own scroll input toward the new bottom.

## Suggested Review Order

- The fix: excludes `<body>` from CSS scroll-anchoring, closing the gap BUG-038's component-scoped rule left open (see the comment for why, and the Design Notes above for the empirical proof).
  [`globals.css:89`](../../apps/web/src/app/globals.css#L89)

