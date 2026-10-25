---
title: 'Page-level horizontal overflow: ambient banners, tabbed shell, moderator pages, PWA hydration'
type: 'bugfix'
created: '2026-10-23'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-responsive-overflow-e2e-matrix.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The responsive matrix found pages wider than a phone: every route at <=412px (the ambient banner's no-wrap action row, also the PWA install banner), all five moderator-tools tabs at <=768px (a 707px non-wrapping tab list inside a fit-content container), and `/moderator/items` at <=360px (a page-local `max-w-5xl mx-auto` wrapper sizing to its widest content). Its iOS PWA test also surfaced a hydration mismatch.

**Approach:** One root-cause fix each, in the shared piece: banner tokens, `TabbedShell`, the two moderator wrappers, and `usePwaInstallPrompt`.

## Boundaries & Constraints

**Always:** Keep DESIGN.md's `ambient_capability_banner` tokens byte-identical to the component constants. Make the matrix pass without skipping any route.

**Never:** Hide the overflow with `overflow-x: hidden` on html/body (it would mask, not fix).

</frozen-after-approval>

## Code Map

- `packages/ui/src/core/ambient-capability-banner-tokens.ts` (+ test, `design-artifacts/UX-festgrid-run-1/DESIGN.md`) -- `base` stacks and wraps below `sm`; new `actions` token; used by `AmbientLocationBanner.tsx` and `PwaInstallBanner.tsx`
- `packages/ui/src/core/tabbed-shell/TabbedShell.tsx` -- tab bar scrolls inside its own `overflow-x-auto` box
- `apps/web/src/app/[locale]/moderator/tools/moderator-tools-content.tsx` -- container gets `w-full`
- `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx` -- wrapper becomes `PageContainer fullWidth={false}` (project rule; same classes plus `w-full`); error-state wrapper gets `w-full`
- `apps/web/src/lib/hooks/usePwaInstallPrompt.ts` -- `canShow` only after mount

## Tasks & Acceptance

**Execution:**
- [x] Banner tokens, both banners, DESIGN.md, drift-guard test
- [x] TabbedShell scroll box; moderator tools + items containers
- [x] `usePwaInstallPrompt` mount gate

**Acceptance Criteria:**
- Given any matrix route at 320-1440px, when measured, then `scrollWidth <= clientWidth`.
- Given a returning iOS visitor, when the page hydrates, then no hydration error is thrown.

## Design Notes

Root cause is the same in three places: an element sized by its content, with no `w-full`/shrink path, inside a column flex `main`. With `mx-auto` the container is fit-content (cross-axis auto margins disable stretch), so any unbreakable child sets the page width. Verified with `E2E_FAKE_AUTH=1 playwright test e2e/responsive-overflow.spec.ts`: 20/20 pass (previously 0/20).

## Verification

- `E2E_FAKE_AUTH=1 npx playwright test e2e/responsive-overflow.spec.ts` -- 20 passed
- lint (8 tasks), build (8 tasks), tests for ui + web + visual-audit -- pass
