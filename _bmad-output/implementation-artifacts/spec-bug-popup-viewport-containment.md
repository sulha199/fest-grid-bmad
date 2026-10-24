---
title: 'Popups, dropdowns, dialogs and sheets must fit and scroll within the viewport'
type: 'bugfix'
created: '2026-10-24'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-responsive-overflow-e2e-matrix.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On a phone, the discovery page's Category filter popover hides its bottom categories (it flips above its trigger and runs 233px off the top of the screen, with no way to scroll). The cause is the shared `PopoverContent`, which has no height cap; `DialogContent` and `SheetContent` have the same gap, so each tall dialog had to add its own `max-h-[..vh] overflow-y-auto`.

**Approach:** Cap and scroll the shared overlay primitives once, and add a generic containment check (opened overlay inside the viewport; last option reachable after scrolling) with scenarios for the real overlays, so a new overlay that regresses is caught.

## Boundaries & Constraints

**Always:** Consumers that already pass their own `max-h`/`overflow` keep working (merged by `cn`). Test short and landscape viewports, not only narrow ones.

**Never:** Fix individual call sites instead of the primitive; skip a scenario that fails.

</frozen-after-approval>

## Code Map

- `packages/ui/src/core/ui/popover.tsx` -- `max-h` / `max-w` from Radix `--radix-popover-content-available-*`, `overflow-y-auto`, default `collisionPadding={8}`
- `apps/web/src/components/ui/dialog.tsx` -- `max-h-[calc(100dvh-2rem)] overflow-y-auto`; `sheet.tsx` -- `overflow-y-auto`, `max-h-dvh` on top/bottom sheets
- `packages/visual-audit/src/rules/popup-containment.ts` (pure, unit-tested) + `src/compare/popup-containment.ts` (`measurePopup`)
- `apps/web/e2e/responsive-popups.spec.ts` -- 7 scenarios x 5 viewports (320x568, 360x640, 375x667, 412x915, 667x375): Type and Category popovers, Filter-with-AI overlay, week picker, Add API Key, Create Widget, moderator Re-extract
- `_bmad-output/project-context.md` -- "Responsive Containment" rule

## Tasks & Acceptance

**Execution:**
- [x] Reproduce red: Category popover failed at 5/5 viewports (up to 233px above the top edge; 140px below the bottom with its last option hidden at 412x915), Type popover failed in landscape
- [x] Fix the three primitives; popovers green
- [x] Rule + measurement + unit tests; scenarios for the other overlays; project-context rule

**Acceptance Criteria:**
- Given any scenario overlay opened at any listed viewport, when measured, then its box is inside the viewport and, scrolled to its end, its last interactive element is visible.
- Given a consumer that sets its own `max-h`, when it renders, then its value wins.

## Verification

- `E2E_FAKE_AUTH=1 npx playwright test e2e/responsive-popups.spec.ts`
- `cd packages/visual-audit && pnpm test` (checkPopupContainment cases)
