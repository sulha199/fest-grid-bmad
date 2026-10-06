# Story 0.49d: Migrate the location-picker and subscribe-account suggestion dropdowns to Overlay-modal

## Story Details

- Epic: 0
- Story ID: 0.49d
- Status: backlog

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the three hand-rolled, no-`isolate`-ancestor suggestion dropdowns in `LocationPickerField.tsx`, `LocationPickerMapPanel.tsx`, and `subscribe-account-dialog.tsx` to source their class from the shared `OVERLAY_MODAL_Z` constant,
so that these address/account-suggestion popovers — none of which AD-33's text names individually, but all three of which fall under its Rule 2's blanket "every raw z-40/z-50/z-[60] class is replaced" — are on the same provably-correct tier as every other hand-rolled overlay, instead of an un-migrated literal that the ratchet (Story 0.49e) would otherwise have to special-case or miss.

## Acceptance Criteria

1. **Given** `packages/ui/src/features/locations/LocationPickerField.tsx`'s "Suggestions Dropdown" (line 141, `"absolute z-50 w-full mt-1 bg-popover ..."`), confirmed to have no `isolate` ancestor anywhere in the file, **when** this story ships, **then** it imports `OVERLAY_MODAL_Z` from the sibling `../../core/overlay-z` module and uses it in place of the literal `z-50`, value unchanged.
2. **Given** `packages/ui/src/features/locations/LocationPickerMapPanel.tsx`'s own "Suggestions Dropdown" (around line 72, `"absolute z-50 w-full mt-1 bg-popover ..."`), same no-`isolate` situation, **when** this story ships, **then** the same substitution applies. (This file's separate `z-10` "Search Overlay" wrapper at line 59 is Local-tier and stays untouched — it is not part of this migration.)
3. **Given** `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx`'s inline suggestions dropdown (line 135, `"absolute z-50 w-full rounded-md border ..."`) — itself nested inside a `Dialog`/`DialogContent` (already migrated in Story 0.49a) and alongside a `Select`/`SelectContent` in the same form — **when** this story ships, **then** it imports `OVERLAY_MODAL_Z` from `@festgrid/ui` (this file is in `apps/web`, so it uses the package barrel, not a relative path) and uses it in place of the literal `z-50`, value unchanged.
4. **Given** all three sites keep the same resolved numeric z-index value (50), **when** this story ships, **then** no visual/stacking regression occurs — this is a pure token-name substitution for all three.
5. **Given** this story touches `packages/ui/src/features/locations/*` and one `apps/web` settings page with zero behavioral change, **when** this story ships, **then** every existing test exercising `LocationPickerField`, `LocationPickerMapPanel`, or `SubscribeAccountDialog` continues to pass unmodified (confirmed by grep during this story's creation — no test asserts on the literal `z-50` className string in any of these three components).

## Tasks / Subtasks

- [ ] Task 1 — `LocationPickerField.tsx` (AC1)
  - [ ] 1.1 Add `import { OVERLAY_MODAL_Z } from '../../core/overlay-z';`.
  - [ ] 1.2 Line 141: substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
- [ ] Task 2 — `LocationPickerMapPanel.tsx` (AC2)
  - [ ] 2.1 Add the same `overlay-z` import.
  - [ ] 2.2 The "Suggestions Dropdown" `<div>` (around line 72): substitute `OVERLAY_MODAL_Z` for the literal `z-50`. **Do not touch** the separate `z-10` "Search Overlay" wrapper (line 59) — Local tier, out of scope.
- [ ] Task 3 — `subscribe-account-dialog.tsx` (AC3)
  - [ ] 3.1 Add `import { OVERLAY_MODAL_Z } from "@festgrid/ui";` to this file's existing import block (it already imports `BlockingLoader`/`useDebounce` from `@festgrid/ui`, so this is a one-name addition to that existing import).
  - [ ] 3.2 Line 135: substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
- [ ] Task 4 — Verification (AC4, AC5)
  - [ ] 4.1 `pnpm --filter @festgrid/ui lint && pnpm --filter @festgrid/ui exec tsc --noEmit` — 0 new errors.
  - [ ] 4.2 `pnpm --filter @festgrid/web lint && pnpm --filter @festgrid/web exec tsc --noEmit` — 0 new errors.
  - [ ] 4.3 Run every existing test suite for `LocationPickerField`, `LocationPickerMapPanel`, `SubscribeAccountDialog` — confirm unmodified pass.
  - [ ] 4.4 Manual visual smoke check: open the location-picker address suggestions in both components, and the subscribe-account-dialog's account-handle suggestions, and confirm each still renders above surrounding content exactly as before.

## Dev Notes

- Relevant architecture patterns and constraints: AD-33 Rule 2's blanket migration scope ("every raw z-40, z-50, z-[60] class... is replaced") and Rule 3's mandate that this applies to hand-rolled consumers, not just Radix ones — explicitly modeled on the `EventDetailView` kebab-dropdown precedent (a hand-rolled popover with no `isolate` ancestor competes at the page root exactly like a Radix popover, so it gets the same tier and the same shared constant).
- Source tree components to touch: `packages/ui/src/features/locations/LocationPickerField.tsx`, `LocationPickerMapPanel.tsx`; `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx`.
- Testing standards summary: no new tests — non-behavioral token substitution. Existing component tests for these three files are the regression net.
- **Depends on:** Story 0.49 (the `OVERLAY_MODAL_Z` constant must exist and be exported from `@festgrid/ui` first).
- **None of these three sites is individually named in AD-33's text** — they surfaced during this story's own creation-time file inventory (a full repo grep for every `z-*` class across `packages/ui/src` and `apps/web/src`), not from AD-33's worked examples. They are in scope because AD-33 Rule 2's migration instruction is a blanket rule over every raw `z-40`/`z-50`/`z-[60]` site in the two packages, not a closed list — and because `subscribe-account-dialog.tsx`'s dropdown specifically needs to out-rank the `Select`/`SelectContent` portal rendered elsewhere in the same open dialog, which is exactly the "hand-rolled vs. portaled, both need the same tier" case AD-33's Rule 3 generalizes.

### Architecture & UX Gate Findings

- **Gate 1 — No gap found.** Fresh for this story. Pure className substitution; no backend/API/infra.
- **Gate 2 — No gap found.** No new component design, no new states/variants/a11y surface — all three dropdowns already exist and already render the same way; this story only changes which class produces their (unchanged) z-index.
- **Gate 3 — No gap found** beyond Story 0.49's own finding (already recorded/accepted there as `FIND-074`). None of this story's three files is in `packages/visual-audit`'s current content globs.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — className literals only.
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: Zero value change (AC4) — pure class-name-source substitution at identical resolved values (50 for all three).
- Verification checks: Task 4's lint/typecheck/existing-test pass, plus manual visual smoke check.

### Project Structure Notes

- All three files exist at their current paths; no new files.
- `subscribe-account-dialog.tsx` is the only file in this story under `apps/web`, so it imports `OVERLAY_MODAL_Z` via the `@festgrid/ui` package barrel rather than a relative path (the other two are inside `packages/ui` itself, using relative imports — consistent with how `packages/ui`'s own internal files never import themselves via their own barrel, per Story 0.49a's `popover.tsx` precedent).
- No conflicts detected.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-33] (Rule 2's blanket migration scope, Rule 3's hand-rolled-consumer mandate, the `EventDetailView` kebab-dropdown precedent it generalizes from)
- [Source: packages/ui/src/features/locations/LocationPickerField.tsx] (read in full — confirmed no `isolate` ancestor)
- [Source: packages/ui/src/features/locations/LocationPickerMapPanel.tsx] (read in full — confirmed no `isolate` ancestor, and the separate untouched `z-10` site)
- [Source: apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx] (read in full — confirmed no `isolate` ancestor, and that it nests inside an already-migrated `Dialog`/alongside a `Select`)
- [Source: _bmad-output/implementation-artifacts/0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant.md] (prerequisite mechanism story)

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Layering (z-index tiers)" rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md`
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-33.
- [x] `docs/infrastructure/index.md` — consulted; not applicable.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/ui/src/features/locations/LocationPickerField.tsx` (1 site)
  - Modified: `packages/ui/src/features/locations/LocationPickerMapPanel.tsx` (1 site)
  - Modified: `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx` (1 site)
  - **Not touched:** `LocationPickerMapPanel.tsx`'s own `z-10` Search Overlay wrapper; any other location/subscription file.
- **Rule Mapping:**
  - AD-33 Rule 2/3 → Tasks 1-3.
- **Verification Plan:**
  - Lint/typecheck for `packages/ui` and `apps/web` (Task 4.1/4.2).
  - Existing component tests, unmodified and green (Task 4.3).
  - Manual visual smoke check (Task 4.4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — 3 class-string substitutions across 3 files; zero visual/behavioral change.
- [ ] Architecture and boundary confirmation — `packages/ui`/`apps/web` only; depends on Story 0.49.
- [ ] Testing plan confirmation — existing tests unmodified + green; manual visual smoke check.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1-3: no gap for this story specifically (Story 0.49's own Gate 3 finding/FIND-074 already accepted there).

## Testing Requirements

- [ ] Integration tests — existing `LocationPickerField`/`LocationPickerMapPanel`/`SubscribeAccountDialog` test suites, re-run unmodified to green.
- [ ] E2E tests — Not applicable; no new user-facing behavior.

## Deliverables Checklist

- [ ] `LocationPickerField.tsx`, `LocationPickerMapPanel.tsx`, `subscribe-account-dialog.tsx` all import and use `OVERLAY_MODAL_Z` instead of inlining `z-50`.

## Out of Scope

- `LocationPickerMapPanel.tsx`'s `z-10` Search Overlay wrapper (Local tier, untouched).
- The four Radix UI wrappers — Story 0.49a.
- `AppShell`/`UserMenu`/`NavRailItem`/`blocking-loader` — Stories 0.49b/0.49c.
- The events-feature overlay consumers and summary-bar — Story 0.49c.

## Definition of Done

- [ ] AC1–AC5 satisfied.
- [ ] Lint and type checks passing for `packages/ui` and `apps/web`.
- [ ] Every existing test for the three touched components passes unmodified.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
