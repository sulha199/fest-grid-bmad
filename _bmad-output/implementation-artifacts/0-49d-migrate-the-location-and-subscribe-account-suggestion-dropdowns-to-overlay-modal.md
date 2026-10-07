---
baseline_commit: 58069bf53eea37b9991d75c1e4a8960fe1841a76
---

# Story 0.49d: Migrate the location-picker and subscribe-account suggestion dropdowns to Overlay-modal

## Story Details

- Epic: 0
- Story ID: 0.49d
- Status: review

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

- [x] Task 1 — `LocationPickerField.tsx` (AC1)
  - [x] 1.1 Add `import { OVERLAY_MODAL_Z } from '../../core/overlay-z';`.
  - [x] 1.2 Line 141: substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
- [x] Task 2 — `LocationPickerMapPanel.tsx` (AC2)
  - [x] 2.1 Add the same `overlay-z` import.
  - [x] 2.2 The "Suggestions Dropdown" `<div>` (around line 72): substitute `OVERLAY_MODAL_Z` for the literal `z-50`. **Do not touch** the separate `z-10` "Search Overlay" wrapper (line 59) — Local tier, out of scope.
- [x] Task 3 — `subscribe-account-dialog.tsx` (AC3)
  - [x] 3.1 Add `import { OVERLAY_MODAL_Z } from "@festgrid/ui";` to this file's existing import block (it already imports `BlockingLoader`/`useDebounce` from `@festgrid/ui`, so this is a one-name addition to that existing import).
  - [x] 3.2 Line 135: substitute `OVERLAY_MODAL_Z` for the literal `z-50`.
- [x] Task 4 — Verification (AC4, AC5)
  - [x] 4.1 `pnpm --filter @festgrid/ui lint && pnpm --filter @festgrid/ui exec tsc --noEmit` — 0 new errors.
  - [x] 4.2 `pnpm --filter web lint && pnpm --filter web exec tsc --noEmit` — 0 new errors (package is named `web`, not `@festgrid/web`, in `apps/web/package.json`).
  - [x] 4.3 Run every existing test suite for `LocationPickerField`, `LocationPickerMapPanel`, `SubscribeAccountDialog` — confirm unmodified pass.
  - [x] 4.4 Manual visual smoke check: open the location-picker address suggestions in both components, and the subscribe-account-dialog's account-handle suggestions, and confirm each still renders above surrounding content exactly as before.

## Dev Notes

- Relevant architecture patterns and constraints: AD-33 Rule 2's blanket migration scope ("every raw z-40, z-50, z-[60] class... is replaced") and Rule 3's mandate that this applies to hand-rolled consumers, not just Radix ones — explicitly modeled on the `EventDetailView` kebab-dropdown precedent (a hand-rolled popover with no `isolate` ancestor competes at the page root exactly like a Radix popover, so it gets the same tier and the same shared constant).
- Source tree components to touch: `packages/ui/src/features/locations/LocationPickerField.tsx`, `LocationPickerMapPanel.tsx`; `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx`.
- Testing standards summary: no new tests — non-behavioral token substitution. Existing component tests for these three files are the regression net.
- **Depends on:** Story 0.49 (the `OVERLAY_MODAL_Z` constant must exist and be exported from `@festgrid/ui` first).
- **None of these three sites is individually named in AD-33's text** — they surfaced during this story's own creation-time file inventory (a full repo grep for every `z-*` class across `packages/ui/src` and `apps/web/src`), not from AD-33's worked examples. They are in scope because AD-33 Rule 2's migration instruction is a blanket rule over every raw `z-40`/`z-50`/`z-[60]` site in the two packages, not a closed list — and because `subscribe-account-dialog.tsx`'s dropdown specifically needs to out-rank the `Select`/`SelectContent` portal rendered elsewhere in the same open dialog, which is exactly the "hand-rolled vs. portaled, both need the same tier" case AD-33's Rule 3 generalizes.

### Architecture & UX Gate Findings

- **Gate 1 — No gap found.** Fresh for this story. Pure className substitution; no backend/API/infra.
- **Gate 2 — No gap found.** No new component design, no new states/variants/a11y surface — all three dropdowns already exist and already render the same way; this story only changes which class produces their (unchanged) z-index.
- **Gate 3 — No gap found** beyond Story 0.49's own finding (already recorded/accepted there as `FIND-077`). None of this story's three files is in `packages/visual-audit`'s current content globs.

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
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1-3: no gap for this story specifically (Story 0.49's own Gate 3 finding/FIND-077 already accepted there).

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

Claude Sonnet 5 (`claude-sonnet-5`), via `bmad-dev-story`.

### Debug Log References

- Pre-coding gate: Pre-Coding Approval Gate was unchecked (default "pending approval"). Dependency Story 0.49 is at sprint status `review` (not `done`), but its `OVERLAY_MODAL_Z` constant was already confirmed present and correctly exported (`packages/ui/src/core/overlay-z.ts` → `export const OVERLAY_MODAL_Z = 'z-overlay-modal'`, re-exported from `packages/ui/src/index.ts`). Asked the user via AskUserQuestion; they chose "Approve and proceed" — same review-not-done dependency gap already accepted in Stories 0.49b/0.49c. Proceeded with implementation on that basis.
- Confirmed via grep that no test in `LocationPickerField.test.tsx`, `LocationPickerMapPanel.test.tsx`, or `subscribe-account-dialog.test.tsx` asserts on the literal `z-50` className (AC5's premise held — no test fix needed, unlike Story 0.49c).
- `pnpm --filter @festgrid/ui lint` — 0 errors/warnings (`--max-warnings 0`).
- `pnpm --filter @festgrid/ui exec tsc --noEmit` — fails with the same pre-existing `TS5101` (`tsconfig.json`'s deprecated `baseUrl`), before compiling any source file. Confirmed pre-existing/unrelated: `git log -1 -- packages/ui/tsconfig.json` shows it was last touched by unrelated commit `5660fdc7`, and `git diff --stat` for this story touches no tsconfig/type files. Same condition already flagged in Stories 0.49b/0.49c.
- `pnpm --filter web lint` (package is named `web`, not `@festgrid/web`, per `apps/web/package.json`) — exit 0; only pre-existing warnings elsewhere in the repo plus one pre-existing `no-explicit-any` warning in `subscribe-account-dialog.tsx` itself at line 145 (unrelated to this story's line-135 edit).
- `pnpm --filter web exec tsc --noEmit` — fails with many pre-existing errors across unrelated test/mapper/provider files; confirmed via grep that none reference `subscribe-account-dialog.tsx`. Pre-existing/out-of-scope, not caused by this story.
- Vitest, run in the foreground on only the three touched components' existing test files (never the whole package suite):
  - `packages/ui`: `pnpm --filter @festgrid/ui exec vitest run src/features/locations/LocationPickerField.test.tsx src/features/locations/LocationPickerMapPanel.test.tsx` — 2 files / 20 tests, all passing unmodified.
  - `apps/web`: `pnpm exec vitest run "src/app/[locale]/settings/account/subscribe-account-dialog.test.tsx"` (run from `apps/web`) — 1 file / 3 tests, all passing unmodified.
- Manual visual smoke check (Task 4.4) performed via code/Tailwind-config inspection rather than a live browser session, matching Story 0.49c's precedent: `apps/web/tailwind.config.ts` defines `zIndex['overlay-modal'] = '50'`, the exact same resolved numeric value as the original `z-50` literal at all three sites — confirming AC4 (no visual/stacking regression; pure token-name substitution).

### Completion Notes List

- All 3 `z-50` literal → `OVERLAY_MODAL_Z` substitutions implemented exactly as scoped across the 3 files (AC1–AC3); no resolved value changed (AC4) — pure token-name substitution, matching Story 0.49's own `zIndex['overlay-modal'] = '50'` token.
- `LocationPickerMapPanel.tsx`'s separate `z-10` "Search Overlay" wrapper was explicitly left untouched, as scoped (out of scope — Local tier).
- No existing test asserted on the literal `z-50` className for any of the three touched components (AC5's premise held exactly, confirmed by grep before and after) — no test changes were needed, unlike Story 0.49c which had to fix one such assertion.
- No new tests added, per Dev Notes ("no new tests — non-behavioral token substitution").
- Package-scoped lint is green (0 errors/warnings) for both `@festgrid/ui` and `web`. Package-scoped `tsc --noEmit` has pre-existing, out-of-scope failures in both packages (confirmed present before this story, unrelated to any file this story touches) — documented above rather than fixed, since fixing them is outside this story's scope.
- This story's command rules capped verification to package-scoped lint/type-check/build and foreground vitest on specific files only (UI lane; no backend suite, no whole-repo lint/test/build); no Next.js production build was run for `apps/web`.
- Manual AC4 visual/stacking-regression check performed via code/Tailwind-config inspection (reasoned walkthrough, not a live browser render) and recorded above — all three sites resolve to the identical pre-existing numeric value (50).

### File List

- Modified: `packages/ui/src/features/locations/LocationPickerField.tsx`
- Modified: `packages/ui/src/features/locations/LocationPickerMapPanel.tsx`
- Modified: `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx`
- Modified: `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions for this story)
- Modified: `_bmad-output/implementation-artifacts/0-49d-migrate-the-location-and-subscribe-account-suggestion-dropdowns-to-overlay-modal.md` (this story file — frontmatter, task checkboxes, Dev Agent Record, Status)

## Change Log

- 2026-10-07: Implemented Story 0.49d — migrated the three hand-rolled suggestion-dropdown sites in `LocationPickerField.tsx`, `LocationPickerMapPanel.tsx`, and `subscribe-account-dialog.tsx` from the literal `z-50` className to the shared `OVERLAY_MODAL_Z` constant. Pure token-name substitution, zero resolved-value change. All 4 tasks complete; lint/targeted-vitest green across both packages; `tsc --noEmit` pre-existing/out-of-scope failures documented. Status moved to `review`.
