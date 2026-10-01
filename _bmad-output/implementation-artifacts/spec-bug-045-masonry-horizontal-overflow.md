---
title: 'BUG-045: page-level horizontal scrollbar at/above md/lg/xl breakpoint edges'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: f214f4e4451e88f05032d2f3e355d3119a4083bc
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every `PageContainer fullWidth` page (Discovery's masonry grid included) shows a
page-level horizontal scrollbar at/just above the `md`/`lg`/`xl` breakpoint edges (confirmed live
via Playwright at 768/769px = 64px overflow, 1024/1025px = 64px, 1280/1281px = 224px; no overflow
at 767/1023/1279). Root cause is **not** `GridContainer`'s masonry column-count logic — measured
`masonryScrollWidth === masonryClientWidth` at every width, i.e. the masonry engine always fits
its own container exactly. The real cause: `PageContainer`'s `fullWidth` breakpoint `min-w-[Npx]`
floors (`page-container.tsx`) are sized against the raw viewport breakpoint, but `PageContainer`
renders inside `<main>`, which reserves `md:ps-16 xl:ps-56` for `AppShell`'s fixed nav rail
(`w-16 xl:w-56`). At/above each breakpoint edge, the floor (e.g. 768px) exceeds `<main>`'s actual
available width (viewport minus the 64/224px inset), forcing `PageContainer` wider than its parent
by exactly that inset — matching the measured 64/64/224px overflow precisely.

**Approach:** Cap each `fullWidth` breakpoint floor in `page-container.tsx` (and its mirrored
`DESIGN.md` token) so it never exceeds the space actually available to its parent, via CSS
`min(Npx,100%)` inside the existing Tailwind arbitrary-value classes — preserving the floor's
original narrow-host/embed defense (still applies whenever there IS enough room) while eliminating
the sidebar-inset overflow.

## Boundaries & Constraints

**Always:** Touch only `packages/ui/src/core/page-container.tsx`, its test, and the
`page_container.full_width` token string in `design-artifacts/UX-festgrid-run-1/DESIGN.md` (must
stay byte-identical to the component's className per Story 0.30's own convention). Do not touch
`grid-container.tsx`, `useMasonryLayout.ts`, or `useActiveColumnCount` — confirmed not the source.
Preserve the `fullWidth={false}` (`contained`) variant's className exactly as-is — it cannot
overflow under the current sidebar geometry (its floor is 768px starting at `lg`, where available
width is always >= 960px) and touching it is unvalidated scope creep.

**Ask First:** none — single-file fix, mechanically verifiable against the live-measured overflow.

**Never:** Do not adopt a third-party masonry library (AD-27, Story 0.45 Dev Notes — out of scope
here anyway since masonry isn't the defect). Do not fix the separate, unrelated mobile (375/425px)
filter-chip-row overflow found during investigation — different component, different mechanism,
not part of BUG-045's backlog scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Breakpoint edge, in-app (sidebar present) | viewport 768/1024/1280px, `AppShell` nav rail visible | `document.documentElement.scrollWidth === clientWidth` (no page scrollbar) | N/A |
| Just below breakpoint edge | viewport 767/1023/1279px | unchanged: no overflow (already passes today) | N/A |
| Narrow embed host (no sidebar) | `PageContainer` rendered with a parent exactly viewport-width, e.g. `<300px` | `min-w-[320px]` floor still applies (100% >= 320px triggers the px branch) | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/core/page-container.tsx` -- `fullWidth` className's `md`/`lg`/`xl` `min-w-[Npx]` breakpoint floors only; wrap each in `min(Npx,100%)`. Leave the unprefixed base (320px) and `sm:` (640px) floors as bare pixel values.
- `packages/ui/src/core/page-container.test.tsx` -- update only the `md`/`lg`/`xl` `fullWidth` assertions to the new `min(...)` class strings; base/`sm:` assertions stay unchanged.
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` -- `components.page_container.full_width` token string, must mirror the component exactly (Story 0.30 convention).
- `apps/web/e2e/discovery.spec.ts` -- add the breakpoint-edge overflow regression case (reuses this file's existing `/en` Discovery nav + seeded-card wait); import `GRID_CONTAINER_BREAKPOINTS_PX` from `@festgrid/ui` instead of hardcoding 768/1024/1280.
- `apps/web/src/components/layout/AppShellWrapper.tsx`, `packages/ui/src/core/app-shell/AppShell.tsx` -- read-only reference: source of the `md:ps-16 xl:ps-56` inset that motivates the fix, and confirmation the nav rail is `hidden md:flex` (never renders below `md`, which is why base/`sm:` floors are out of scope).

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/core/page-container.tsx` -- change only `md:min-w-[768px] lg:min-w-[1024px] xl:min-w-[1280px]` to `md:min-w-[min(768px,100%)] lg:min-w-[min(1024px,100%)] xl:min-w-[min(1280px,100%)]` -- caps each floor at the parent's real available width at the breakpoints where `AppShell`'s nav rail actually exists, eliminating the sidebar-inset overflow. The base (`min-w-[320px]`) and `sm:min-w-[640px]` floors are left untouched -- the nav rail is `hidden md:flex` (never rendered below `md`), so those two floors were never implicated in the overflow, and wrapping them would have weakened the genuine narrow-host/embed defense for any host under 320/640px wide for no benefit (review loop 1 correction -- see Spec Change Log).
- [x] `packages/ui/src/core/page-container.test.tsx` -- update only the `md`/`lg`/`xl` entries in the `fullWidth` test's `baseClasses` array to the new `min(...)` strings; base/`sm:`/contained assertions stay unchanged.
- [x] `design-artifacts/UX-festgrid-run-1/DESIGN.md` -- update `page_container.full_width`'s token string to match, byte-for-byte (only `md`/`lg`/`xl` wrapped).
- [x] `apps/web/e2e/discovery.spec.ts` -- add a test that loads `/en`, waits for the first event card, then for each of `GRID_CONTAINER_BREAKPOINTS_PX.md/lg/xl` calls `page.setViewportSize`, waits two animation frames for layout to settle (not a fixed timeout), and asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth` via `page.evaluate`. Comment explains base/`sm:` are excluded because the nav rail doesn't exist below `md`.

**Acceptance Criteria:**
- Given the Discovery page rendered at viewport width 768, 1024, or 1280px with `AppShell`'s nav rail visible, when the page finishes rendering, then `document.documentElement.scrollWidth` does not exceed `clientWidth`.
- Given viewport width 767, 1023, or 1279px (already passing), when the page renders, then behavior is unchanged (no regression).
- Given `PageContainer` rendered with `fullWidth` (default) inside a parent at least as wide as a given breakpoint, when no sidebar/inset squeezes it, then the `min-w` floor still applies exactly as before (narrow-host/embed defense preserved).

## Spec Change Log

- **2026-09-26, review loop 1 (bad_spec):** Blind Hunter review found that wrapping ALL 5 breakpoint
  floors (including the unprefixed base `320px` and `sm:640px`) in `min(Npx,100%)` silently defeated
  Story 0.30's narrow-host/embed defense for any host narrower than those two floors — a real
  regression, since `100%` of a <320px/<640px parent collapses the floor to a no-op. Root cause:
  `AppShell`'s nav rail is `hidden md:flex` (confirmed in `AppShell.tsx:162`) — it never renders
  below `md`, so the sidebar-inset bug this spec targets can only ever occur at `md`/`lg`/`xl`
  (768/1024/1280). Amended Code Map/Tasks to scope the `min(Npx,100%)` wrap to `md`/`lg`/`xl` only;
  base/`sm:` floors reverted to their original bare-px form. **KEEP:** the `md:min-w-[min(768px,100%)]`
  /`lg:.../xl:...` wraps themselves, the DESIGN.md mirroring convention, and the e2e regression test's
  overall shape (setViewportSize + scrollWidth/clientWidth assertion) — all independently re-verified
  live and correct; only the floor-selection scope was wrong.
- **2026-09-26, review loop 1 (patch, applied without loopback):** Edge Case Hunter + Blind Hunter
  both flagged the e2e test's `waitForTimeout(300)` as a flaky fixed sleep and the hardcoded
  768/1024/1280 literals as breakpoint-config drift risk. Patched: poll two animation frames instead
  of a fixed sleep, and import `GRID_CONTAINER_BREAKPOINTS_PX` from `@festgrid/ui/grid-container`
  (the package's dedicated subpath export, not `@festgrid/ui`'s root barrel -- importing the root
  barrel from a Playwright spec pulled in `map.tsx`'s `maplibre-gl` import, which fails under
  Playwright's Node resolution with "No exports main defined"; caught during post-fix re-verification).

## Design Notes

`min(Npx,100%)` resolves `100%` against `PageContainer`'s containing block — `<main>`'s content-box
width, which already excludes `<main>`'s own `ps-16`/`ps-56` padding. This is why the cap works
without needing to know the sidebar's width explicitly inside `page-container.tsx`: whatever space
`<main>` actually has left is exactly what `100%` resolves to, keeping `PageContainer` decoupled
from `AppShell`'s specific inset values. No Tailwind config change needed — Tailwind 3.4's
arbitrary-value syntax passes `min(...)` through as raw CSS unchanged.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test -- page-container` -- expected: updated assertions pass.
- `pnpm --filter web exec playwright test discovery` -- expected: new breakpoint-edge case passes (run once pre-fix to confirm it fails/reproduces, per the investigation already done live; then post-fix to confirm green).
- `pnpm lint && pnpm build && pnpm test` (repo root) -- expected: clean, no regressions in any other `PageContainer`/`GridContainer` consumer.

**Manual checks (if no CLI):** none needed beyond the above.

## Suggested Review Order

**The fix**

- Entry point: the `md`/`lg`/`xl` floors are capped `min(Npx,100%)`; base/`sm:` deliberately left as bare px (nav rail is `hidden md:flex`, never coincides with them).
  [`page-container.tsx:27`](../../packages/ui/src/core/page-container.tsx#L27)

**Docs kept in sync with the code**

- `page_container.full_width` token mirrors the component's className byte-for-byte, per Story 0.30's own convention.
  [`DESIGN.md:39`](../../design-artifacts/UX-festgrid-run-1/DESIGN.md#L39)

**Regression coverage**

- Real-browser proof: BUG-045's actual failure mode (a page-level scrollbar) can only be observed post-layout, not in jsdom.
  [`discovery.spec.ts:29`](../../apps/web/e2e/discovery.spec.ts#L29)
- Deterministic settle (two animation frames, not a fixed sleep) plus the shared breakpoint constant instead of hardcoded literals — both patched after adversarial review.
  [`discovery.spec.ts:42`](../../apps/web/e2e/discovery.spec.ts#L42)

**Peripherals**

- Unit assertions updated to the new `min(...)` class strings for `md`/`lg`/`xl` only.
  [`page-container.test.tsx:33`](../../packages/ui/src/core/page-container.test.tsx#L33)
