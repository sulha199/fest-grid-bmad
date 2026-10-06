# Story 0.49c: Migrate the events-feature overlay/menu/tooltip sites and the post-selection summary bar

## Story Details

- Epic: 0
- Story ID: 0.49c
- Status: backlog

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `CalendarOverflowDialog.tsx`, `AIFilterOverlay.tsx`, and `EventDetailView.tsx`'s two hand-rolled overlay sites, plus `UserMenu.tsx`'s menu panel and `NavRailItem.tsx`'s hover tooltip, to all source their class from the shared `OVERLAY_MODAL_Z` constant, and `apps/web`'s post-selection `summary-bar.tsx` to move onto the named `z-overlay-sticky` tier,
so that every hand-rolled "competes with arbitrary page content" overlay in the app is on the same provably-correct tier as the Radix wrappers, and the one sticky action bar that must clear chrome but never contest a true overlay stops tying with dialogs at a shared `z-50`.

## Acceptance Criteria

1. **Given** `packages/ui/src/features/events/CalendarOverflowDialog.tsx`'s `OVERLAY_CLASS` constant (line 45, `"fixed inset-0 z-40 bg-black bg-opacity-50"`) — AD-33 Rule 2 explicitly names this the sweep's one misclassification ("`CalendarOverflowDialog`'s backdrop sits at `z-40` (Chrome) despite being a modal overlay — it migrates to `z-overlay-modal`, not `z-chrome`") — **when** this story ships, **then** `OVERLAY_CLASS` imports `OVERLAY_MODAL_Z` and uses it in place of the literal `z-40`, a real **value change** (40→50), not just a rename.
2. **Given** the same file's `DIALOG_SURFACE_CLASS` constant (line 46-48, already `z-50`), **when** this story ships, **then** it too imports and uses `OVERLAY_MODAL_Z` (a token-name substitution, value unchanged at 50) — both constants now reference the same named tier, which is the point: the backdrop and the surface are meant to tie and rely on DOM order (overlay renders before surface — unchanged), not sit on two different tiers by accident.
3. **Given** `packages/ui/src/features/events/AIFilterOverlay.tsx`'s one overlay `<div>` (line 121, `"fixed inset-0 z-50 flex flex-col bg-background ..."`), named explicitly in AD-33's Binds clause ("the AI filter overlay"), **when** this story ships, **then** it imports and uses `OVERLAY_MODAL_Z` in place of the literal `z-50`.
4. **Given** `packages/ui/src/features/events/EventDetailView.tsx`'s two sites — the "more actions" kebab dropdown (line 344, `"absolute right-0 mt-1 w-48 ... z-50 focus:outline-none"`) and the "Add to Calendar" schedule picker (line 1056, `"fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"`) — both explicitly resolved as Overlay-modal in AD-33's own open-questions record (the kebab dropdown despite having no `isolate` ancestor, the calendar picker as an unambiguous `fixed inset-0`/`aria-modal` dialog), **when** this story ships, **then** both import and use `OVERLAY_MODAL_Z` in place of their literal `z-50`.
5. **Given** `packages/ui/src/core/app-shell/UserMenu.tsx`'s "Main Menu Container" (line 109, `"fixed inset-x-0 bottom-0 ... z-50 flex flex-col ..."`) and `packages/ui/src/core/app-shell/NavRailItem.tsx`'s hover tooltip (line 52, `` `absolute start-16 z-50 rounded bg-popover ...` ``) — both reclassified from Chrome to Overlay-modal by Gate 2 during this story set's creation, since each is a hand-rolled, no-`isolate` overlay that must outrank arbitrary page content (the same reasoning AD-33 applies to the `EventDetailView` kebab dropdown) — **when** this story ships, **then** both import and use `OVERLAY_MODAL_Z` in place of their literal `z-50`, with no value change (both stay resolved at 50).
6. **Given** `apps/web/src/features/post-selection/components/summary-bar.tsx`'s one container `<div>` (line 14, currently `z-50`), which AD-33 names by example as the canonical Overlay-sticky-tier element ("sticky action/summary bars that must clear chrome but never contest a true overlay (e.g. the post-selection `summary-bar.tsx`)"), **when** this story ships, **then** it replaces the literal `z-50` with the named Tailwind token `z-overlay-sticky` — a real **value change** (50→45), since this is a sticky bar, not a true overlay, and should no longer tie with dialogs/sheets/the AI filter overlay.
7. **Given** AC1's and AC6's value changes are real behavior changes (not pure renames), **when** this story ships, **then** a manual visual/interaction smoke check confirms: (a) opening a `CalendarOverflowDialog` while *also* having any Overlay-modal-tier element open (e.g. a `Select`) still shows the dialog correctly above/below as intended (both now tie at 50, same as before relative to each other, just correctly named); (b) the post-selection `summary-bar` (now at 45) still renders above `AppShell`'s chrome (40) and below any true overlay (a `Dialog`/`Sheet`/`Select`/`Popover`/the AI filter overlay/`CalendarOverflowDialog`, all now at 50) — specifically, opening a `Dialog` while the summary bar is visible must show the dialog's backdrop covering the summary bar, which did **not** reliably hold before this story (both were tied at `z-50`, with DOM/portal order silently deciding).
8. **Given** this story's six files span `packages/ui/src/features/events`, `packages/ui/src/core/app-shell`, and `apps/web/src/features/post-selection`, **when** this story ships, **then** every existing test exercising `CalendarOverflowDialog`, `AIFilterOverlay`, `EventDetailView`, `UserMenu`, `NavRailItem`, or `SummaryBar` continues to pass unmodified (confirmed by grep during this story's creation — no test asserts on any of these six components' literal z-index className string).

## Tasks / Subtasks

- [ ] Task 1 — `CalendarOverflowDialog.tsx` (AC1, AC2)
  - [ ] 1.1 Add `import { OVERLAY_MODAL_Z } from '../../core/overlay-z';` (this file is `packages/ui/src/features/events/CalendarOverflowDialog.tsx`; `overlay-z.ts` is `packages/ui/src/core/overlay-z.ts` — two directories up, then into `core/`).
  - [ ] 1.2 `OVERLAY_CLASS`: change `const OVERLAY_CLASS = "fixed inset-0 z-40 bg-black bg-opacity-50";` to a template literal using `OVERLAY_MODAL_Z` in place of `z-40`. **This is the one real value change in this task** (40→50, per AD-33 Rule 2's explicit misclassification fix).
  - [ ] 1.3 `DIALOG_SURFACE_CLASS`: substitute `OVERLAY_MODAL_Z` for its existing `z-50`, value unchanged.
- [ ] Task 2 — `AIFilterOverlay.tsx` (AC3)
  - [ ] 2.1 Add `import { OVERLAY_MODAL_Z } from '../../core/overlay-z';`.
  - [ ] 2.2 Line 121: substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
- [ ] Task 3 — `EventDetailView.tsx` (AC4)
  - [ ] 3.1 Add the same `overlay-z` import (confirm this file's existing relative-import depth to `packages/ui/src/core/` and match it).
  - [ ] 3.2 Kebab dropdown (line 344): substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
  - [ ] 3.3 "Add to Calendar" dialog (line 1056): same substitution.
- [ ] Task 4 — `UserMenu.tsx` line 109 only (AC5)
  - [ ] 4.1 Add `import { OVERLAY_MODAL_Z } from '../overlay-z';` (`UserMenu.tsx` is `packages/ui/src/core/app-shell/UserMenu.tsx`, one directory up to `core/`). **Do not touch line 101** (the backdrop) — that site shipped in Story 0.49b.
  - [ ] 4.2 "Main Menu Container" (line 109): substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
- [ ] Task 5 — `NavRailItem.tsx` (AC5)
  - [ ] 5.1 Add the same `overlay-z` import, relative path `'../overlay-z'` (`NavRailItem.tsx` is also `packages/ui/src/core/app-shell/NavRailItem.tsx`).
  - [ ] 5.2 Line 52 (tooltip): substitute `OVERLAY_MODAL_Z` for the literal `z-50` inside the existing template literal.
- [ ] Task 6 — `summary-bar.tsx` (AC6)
  - [ ] 6.1 Line 14: replace the literal `z-50` with the Tailwind token `z-overlay-sticky` (plain class-name swap, no import needed — this is a Tailwind token, not a JS constant, since `summary-bar.tsx` is a one-off `apps/web` component, not a shared `packages/ui` wrapper that needs the cross-package `OVERLAY_MODAL_Z` indirection). **This is a real value change** (50→45).
- [ ] Task 7 — Verification (AC7, AC8)
  - [ ] 7.1 `pnpm --filter @festgrid/ui lint && pnpm --filter @festgrid/ui exec tsc --noEmit` — 0 new errors.
  - [ ] 7.2 `pnpm --filter @festgrid/web lint` (for `summary-bar.tsx`) — 0 new errors.
  - [ ] 7.3 Run every existing test suite for the six touched components — confirm unmodified pass.
  - [ ] 7.4 Manual smoke check per AC7(a) and AC7(b) — specifically verify the summary bar no longer wins a stacking tie against an open Dialog/Sheet/Select/Popover.

## Dev Notes

- Relevant architecture patterns and constraints: AD-33 Rule 1 (Overlay-modal=50 definition explicitly including "every ... menu ... hand-rolled"; Overlay-sticky=45 definition naming `summary-bar.tsx` by example), Rule 2 (migration, including the one explicit misclassification fix), Rule 3 (shared `OVERLAY_MODAL_Z` constant — mandatory for every Overlay-modal consumer, not just Radix ones).
- Source tree components to touch: `packages/ui/src/features/events/CalendarOverflowDialog.tsx`, `AIFilterOverlay.tsx`, `EventDetailView.tsx`; `packages/ui/src/core/app-shell/UserMenu.tsx` (one site), `NavRailItem.tsx` (its only site); `apps/web/src/features/post-selection/components/summary-bar.tsx`.
- Testing standards summary: no new tests. AC7's manual smoke check is the only non-automated verification step in this story set, because AC1/AC6 are genuine value changes (not pure renames) with a real, user-observable stacking-order consequence.
- **Depends on:** Story 0.49 (the `OVERLAY_MODAL_Z` constant and `z-overlay-sticky` token must exist first). Shares `UserMenu.tsx` with Story 0.49b (different line, see that story's Dev Notes) — sequence to avoid a merge conflict, not a logical dependency.
- **Why the two value changes (AC1, AC6) are safe:** `CalendarOverflowDialog`'s backdrop moving from 40→50 only ever needs to beat the page content behind it and tie correctly with its own `DIALOG_SURFACE_CLASS` sibling (DOM order already guarantees the surface paints after the backdrop) — it was never relied upon to lose to anything specifically at 40 (Chrome) that it now out-ranks, since a modal dialog opening above the app shell is exactly the intended behavior. `summary-bar.tsx` moving from 50→45 is the one change with a real, previously-wrong behavior to fix: today it ties with any Dialog/Sheet/Select/Popover/AI-overlay/CalendarOverflowDialog at 50, with DOM/portal order silently deciding the winner (AD-33's whole motivating problem, IDEA-060's capture finding #1) — after this story it correctly always loses to a true overlay and always beats chrome (40), matching its "sticky action bar, not a true overlay" role.

### Architecture & UX Gate Findings

- **Gate 1 — No gap found.** Fresh for this story. Pure className substitution (plus two intentional, AD-33-sanctioned value changes) across existing shared UI components; no backend/API/infra.
- **Gate 2 — This story's scope is itself the result of a Gate 2 finding.** Run during this story set's creation against the original draft grouping (which had bundled `UserMenu.tsx`/`NavRailItem.tsx` wholesale into the Chrome-tier adoption story), Gate 2 found that a file-level (not class-level) migration would wrongly collapse `UserMenu`'s menu panel and `NavRailItem`'s tooltip from 50 to 40 — a real stacking regression. This story's AC5 is that correction, applied directly rather than deferred further.
- **Gate 3 — No gap found** beyond Story 0.49's own finding (already recorded/accepted there as `FIND-074`). None of this story's six files is in `packages/visual-audit`'s current content globs (confirmed during Story 0.49's creation), so no additional mirror is needed here.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — className literals only, no data model.
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: Two of eight sites (AC1, AC6) are real value changes with an intended, documented behavior correction (see Dev Notes above); the other six are pure renames at unchanged resolved values. Both value changes are explicitly sanctioned by AD-33's own text (Rule 2's misclassification fix; the Overlay-sticky tier's own `summary-bar.tsx` example), not a new design decision made by this story.
- Verification checks: Task 7's lint/typecheck/existing-test pass, plus the manual stacking-order smoke check (AC7).

### Project Structure Notes

- All six files exist at their current paths; no new files.
- Import depth varies by file's nesting under `packages/ui/src/`: `features/events/*.tsx` → `../../core/overlay-z`; `core/app-shell/*.tsx` → `../overlay-z`. Confirm each exact relative path against the file's actual location before committing (do not assume by analogy alone).
- No conflicts detected, aside from the intentional, documented file-level split with Story 0.49b on `UserMenu.tsx`.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-33] (Rule 1's Overlay-modal/Overlay-sticky definitions, Rule 2's misclassification fix, Rule 3)
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-060-z-index-layering-tiers.md] (capture finding #1 — the 17-at-`z-50` tie, which this story's AC6/AC7(b) directly resolves for the summary bar)
- [Source: packages/ui/src/features/events/CalendarOverflowDialog.tsx] (read in full)
- [Source: packages/ui/src/features/events/AIFilterOverlay.tsx] (read in full)
- [Source: packages/ui/src/features/events/EventDetailView.tsx] (relevant sections around lines 320-360 and 1030-1065 read)
- [Source: packages/ui/src/core/app-shell/UserMenu.tsx] (read in full)
- [Source: packages/ui/src/core/app-shell/NavRailItem.tsx] (relevant section read)
- [Source: apps/web/src/features/post-selection/components/summary-bar.tsx] (read in full)
- [Source: _bmad-output/implementation-artifacts/0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant.md] (prerequisite mechanism story)
- [Source: _bmad-output/implementation-artifacts/0-49b-migrate-appshell-usermenus-backdrop-and-the-blocking-loader-to-their-tiers.md] (sibling story — owns `UserMenu.tsx`'s other site)

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Layering (z-index tiers)" rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md`
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-33.
- [x] `docs/infrastructure/index.md` — consulted; not applicable.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/ui/src/features/events/CalendarOverflowDialog.tsx` (2 sites, 1 value change)
  - Modified: `packages/ui/src/features/events/AIFilterOverlay.tsx` (1 site)
  - Modified: `packages/ui/src/features/events/EventDetailView.tsx` (2 sites)
  - Modified: `packages/ui/src/core/app-shell/UserMenu.tsx` (1 site only — line 109)
  - Modified: `packages/ui/src/core/app-shell/NavRailItem.tsx` (1 site)
  - Modified: `apps/web/src/features/post-selection/components/summary-bar.tsx` (1 site, 1 value change)
  - **Not touched:** `UserMenu.tsx` line 101 (Story 0.49b's); `AppShell.tsx`/`blocking-loader.tsx` (Story 0.49b's).
- **Rule Mapping:**
  - AD-33 Rule 1/2/3 → Tasks 1-6.
  - Gate 2 correction → this story's existence and AC5.
- **Verification Plan:**
  - Lint/typecheck for `packages/ui` and `apps/web` (Task 7.1/7.2).
  - Existing component tests, unmodified and green (Task 7.3).
  - Manual stacking-order smoke check, specifically proving the summary-bar/true-overlay tie is fixed (Task 7.4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — 8 class-string substitutions across 6 files; 2 are real value changes (CalendarOverflowDialog backdrop 40→50, summary-bar 50→45), both explicitly sanctioned by AD-33's own text.
- [ ] Architecture and boundary confirmation — `packages/ui`/`apps/web` only; depends on Story 0.49.
- [ ] Testing plan confirmation — existing tests unmodified + green; manual stacking-order smoke check for both value changes.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 2's finding is this story's own origin and is fully incorporated (AC5), not deferred further.

## Testing Requirements

- [ ] Integration tests — existing `CalendarOverflowDialog`/`AIFilterOverlay`/`EventDetailView`/`UserMenu`/`NavRailItem`/`SummaryBar` test suites, re-run unmodified to green.
- [ ] E2E tests — Not applicable; a manual smoke check substitutes for the two value changes' stacking-order verification (no existing E2E harness asserts computed z-index).

## Deliverables Checklist

- [ ] `CalendarOverflowDialog.tsx`'s both constants on `OVERLAY_MODAL_Z` (backdrop value-corrected 40→50).
- [ ] `AIFilterOverlay.tsx` on `OVERLAY_MODAL_Z`.
- [ ] `EventDetailView.tsx`'s both sites on `OVERLAY_MODAL_Z`.
- [ ] `UserMenu.tsx` line 109 on `OVERLAY_MODAL_Z`.
- [ ] `NavRailItem.tsx`'s tooltip on `OVERLAY_MODAL_Z`.
- [ ] `summary-bar.tsx` on `z-overlay-sticky` (value-corrected 50→45).
- [ ] Manual stacking-order smoke check performed and recorded.

## Out of Scope

- `UserMenu.tsx` line 101 and all of `AppShell.tsx`/`blocking-loader.tsx` — Story 0.49b.
- The four Radix UI wrappers — Story 0.49a.
- The location/subscribe-account dropdowns — Story 0.49d.

## Definition of Done

- [ ] AC1–AC8 satisfied.
- [ ] Lint and type checks passing for `packages/ui` and `apps/web`.
- [ ] Every existing test for the six touched components passes unmodified.
- [ ] Manual stacking-order smoke check confirms both value changes behave as intended.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
