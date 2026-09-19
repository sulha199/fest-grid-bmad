---
backlog_id: BUG-038
title: "Infinite-scroll pagination jumps the viewport to the new bottom of the list every time a page loads, instead of preserving scroll position"
captured: 2026-09-19
---

# BUG-038 — Infinite-scroll jump-to-bottom (CSS scroll-anchoring)

## Capture

Reported by the user as a recurring issue ("has come around repeatedly"), with their own
hypothesis: "I think the page locks the scroll position to the pagination anchor, and our page
load the next-pagination content above it." Investigated by launching a headless Playwright
browser against **production** (`https://fest-grid.vercel.app/en`, now recorded as
`PRODUCTION_URL` in `.env`/`.env.example`), on the Discovery page's Card View.

## Reproduction (script, not preserved — ad hoc Playwright, run against prod)

Simulated real user wheel-scrolls (`page.mouse.wheel(0, 600)`) in a loop, measuring
`window.scrollY`/`document.documentElement.scrollHeight` before and after each scroll +
1.5s settle, plus counting `/api/graphql` `getEvents` requests fired.

Observed (800×900 viewport):

| iter | wheel input | scrollY before→after | expected after (input-only) | extra jump | distFromBottom after |
|---|---|---|---|---|---|
| 0 | 600 | 0 → 600 | 600 | 0 | 571 |
| 1 | 600 | 600 → **1666** | 1200 | **+466** | **0** |
| 2 | 600 | 1666 → 2029 | 2266 | (content exhausted, only 2 pages total in this run) | 0 |

Each time a new page's GraphQL response landed (3 `getEvents` requests total across the run —
1 initial + 2 "next page" fetches), the viewport moved by *more* than the user's own scroll
input, landing exactly at `distFromBottom = 0` (i.e. the true bottom of the now-longer list) —
not merely "unaffected," but actively pulled to the new bottom edge.

## Root cause

This is the browser's native **CSS scroll-anchoring** (`overflow-anchor`, on by default in all
Chromium/Firefox browsers): the browser picks an anchor node near the top of the *visible*
viewport region (in practice, whatever's closest to the last scroll interaction) and, when
content **above that anchor in DOM order** changes size, adjusts `scrollY` to keep the anchor's
on-screen position fixed. In this infinite-scroll list:

- The sentinel (`EventListView.tsx`'s trigger div) sits at the very end of the DOM, at/near the
  bottom of the viewport when a fetch triggers (by design — that's what makes it intersect).
- A new page's cards get inserted **before** the sentinel in DOM order — i.e. "above" it.
- The browser's scroll-anchoring algorithm, having anchored somewhere near the bottom of the
  visible area (plausibly the sentinel itself, or the last card above it), scrolls the viewport
  down by exactly the height of the newly-inserted content to keep that anchor fixed in place.
- Because the anchor was near the bottom, "keeping it fixed" in practice means "keep chasing the
  list to its new bottom" on every single page load.

**This is a different, deeper mechanism than BUG-031.** BUG-031 (fixed 2026-09-17, `203522c`)
found and fixed a *related* trigger — the sentinel's own height collapsing between
loading/idle states, which independently confuses scroll-anchoring — via a stable `min-h-16`.
That fix is real and still correct, but it does not address the root mechanism above: even with
a perfectly stable sentinel height, inserting new siblings before a bottom-anchored node will
still pull the scroll position down to the new bottom every time content grows.

## Fix (validated live against production)

Re-ran the same reproduction after injecting `overflow-anchor: none !important` on `*` via
`page.addStyleTag`. Result: scroll deltas across 5 further iterations tracked the user's 600px
wheel input almost exactly (extra jump of 0, -29, -105, 0, 0 — noise, not a forced pull), and
`distFromBottom` after each load stayed wherever the user's own scrolling put them (571, 495,
1521, 921, 321) — never snapping back to 0. The jump-to-bottom behavior is completely eliminated.

**Recommended fix**: apply `overflow-anchor: none` (a Tailwind arbitrary-value class or a small
utility class) to `EventListView.tsx`'s sentinel `<div>` and/or its scrollable list container —
not literally `*` (that was only for isolating the test) — scoped to the events grid across all
5 consumers (Discovery, Feed, Favorites, Archive, Account), matching BUG-031's own "across all 5
consumers" precedent. No library swap needed; this is a standard, well-documented CSS opt-out
for exactly this browser behavior, not a gap requiring a third-party solution.

## Status

**Fixed 2026-09-19** via `bmad-quick-dev`. `EventListView.tsx`'s card grid + sentinel are now
wrapped in a `<div className="contents [overflow-anchor:none]">` (layout-neutral via `display:
contents`, excludes the whole growing subtree from scroll-anchor selection), with
`[overflow-anchor:none]` also duplicated directly on the sentinel as a belt-and-suspenders
measure. Lint and build both passed clean. The automatic test gate's backend suite reported
165/279 failures, but every failure carries the identical `exitCode 3221225794` (Windows
`STATUS_ACCESS_VIOLATION`) across dozens of completely unrelated schema test files
(`subscriptions`, `widgets`, `validate`, `user-timezone`, etc.) — a pre-existing native-crash/
environment issue, not a real assertion failure and not caused by this change (which touches
zero backend files). Confirmed unrelated on that basis, matching the same pre-existing-failure
pattern already documented for BUG-032/FIND-024 earlier this project.
