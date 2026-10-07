---
baseline_commit: 6b8e3b87b203aa744caa0581f47c2f84d3cd5b27
---

# Story 0.49a: Migrate the Radix UI wrappers to the Overlay-modal tier

## Story Details

- Epic: 0
- Story ID: 0.49a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the four shared Radix UI wrapper components — `apps/web/src/components/ui/dialog.tsx`, `select.tsx`, `sheet.tsx`, and `packages/ui/src/core/ui/popover.tsx` — to source their `z-50` stacking class from the shared `OVERLAY_MODAL_Z` constant instead of each inlining its own literal,
so that every dialog/sheet/select/popover in the app is provably on the same named tier (Architecture Spine AD-33), and a future re-tiering of the overlay level is a one-file edit instead of a four-file grep-and-replace.

## Acceptance Criteria

1. **Given** `apps/web/src/components/ui/dialog.tsx`'s `DialogOverlay` (line 24) and `DialogContent` (line 46), each currently hardcoding `z-50` inside its `cn(...)` className string, **when** this story ships, **then** both sites import `OVERLAY_MODAL_Z` from `@festgrid/ui` and interpolate it in place of the literal `z-50` substring (e.g. `` `fixed inset-0 ${OVERLAY_MODAL_Z} bg-black/80 ...` ``), with every other class in each string unchanged.
2. **Given** `apps/web/src/components/ui/select.tsx`'s `SelectContent` (line 78) currently hardcoding `z-50`, **when** this story ships, **then** it imports and uses `OVERLAY_MODAL_Z` the same way, with every other class unchanged.
3. **Given** `apps/web/src/components/ui/sheet.tsx`'s `SheetOverlay` (line 24) and the `sheetVariants` base class string (line 34), each currently hardcoding `z-50`, **when** this story ships, **then** both sites use `OVERLAY_MODAL_Z` the same way, with every other class (including `sheetVariants`'s `side` variants) unchanged.
4. **Given** `packages/ui/src/core/ui/popover.tsx`'s `PopoverContent` (line 20) currently hardcoding `z-50`, **when** this story ships, **then** it imports `OVERLAY_MODAL_Z` from the sibling `./overlay-z` module (same package, not the `@festgrid/ui` barrel, to avoid a self-import cycle) and uses it the same way, with every other class unchanged.
5. **Given** none of these four files currently has an `isolate` ancestor and each renders through a Radix `Portal` (confirmed — none is a Local-tier candidate), **when** this story ships, **then** no component's resolved z-index value changes (all four stay at computed `z-index: 50`) — this is a pure token-name substitution, not a value change, and the Vitest ratchet test (Story 0.49e) will treat all four as the canonical "correctly migrated" examples.
6. **Given** this story touches only `packages/ui` and `apps/web` component files with zero behavioral/visual change, **when** this story ships, **then** every existing test exercising a `Dialog`/`Select`/`Sheet`/`Popover` consumer continues to pass unmodified (no snapshot depends on the literal string `z-50`; confirmed by grep during this story's creation — no test asserts on the raw className string of any of these four components).

## Tasks / Subtasks

- [x] Task 1 — `dialog.tsx` (AC1)
  - [x] 1.1 Add `import { OVERLAY_MODAL_Z } from "@festgrid/ui"` near the top (after the `lucide-react` import, before the local `cn` import, matching this file's existing import ordering).
  - [x] 1.2 `DialogOverlay`: replace `"fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in ..."` with a template literal: `` `fixed inset-0 ${OVERLAY_MODAL_Z} bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0` ``.
  - [x] 1.3 `DialogContent`: same substitution for its `"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg ..."` string.
- [x] Task 2 — `select.tsx` (AC2)
  - [x] 2.1 Add the same `OVERLAY_MODAL_Z` import.
  - [x] 2.2 `SelectContent`: replace `"relative z-50 max-h-[--radix-select-content-available-height] ..."` with the template-literal substitution, keeping the rest of the string (including the `position === "popper" && ...` conditional class, which is a separate `cn()` argument, untouched).
- [x] Task 3 — `sheet.tsx` (AC3)
  - [x] 3.1 Add the same `OVERLAY_MODAL_Z` import.
  - [x] 3.2 `SheetOverlay`: replace `"fixed inset-0 z-50 bg-black/80 ..."` the same way.
  - [x] 3.3 `sheetVariants`'s base class string: replace `"fixed z-50 gap-4 bg-background p-6 shadow-lg ..."` the same way — `cva`'s first argument accepts a template literal identically to a plain string.
- [x] Task 4 — `popover.tsx` (AC4)
  - [x] 4.1 Add `import { OVERLAY_MODAL_Z } from '../overlay-z';` (this file already imports from `'../../lib/utils'`, i.e. two levels up from `core/ui/`; `overlay-z.ts` lives at `core/overlay-z.ts`, one level up — confirm the exact relative path once `overlay-z.ts` exists from Story 0.49, and use `../overlay-z` accordingly).
  - [x] 4.2 `PopoverContent`: replace `'z-50 w-72 rounded-md border bg-popover ...'` the same way.
- [x] Task 5 — Verification (AC5, AC6)
  - [x] 5.1 `pnpm --filter web lint && pnpm --filter web exec tsc --noEmit` — lint exit 0 (0 errors/warnings in changed files); `tsc --noEmit` surfaced 19 pre-existing errors, none in `dialog.tsx`/`select.tsx`/`sheet.tsx` (all in unrelated test files: `posts-select-content.test.tsx`, `reports-content.test.tsx`, `CalendarView.test.tsx`, `auth-session-provider.test.tsx`, `mapper.test.ts`, two `e2e/*.spec.ts` files — msw/mock-typing and DayOfWeek-typing issues, all pre-dating this story's 4 one-line template-literal substitutions) — 0 new errors.
  - [x] 5.2 `pnpm --filter @festgrid/ui lint` — exit 0, 0 errors/warnings. `tsc --noEmit` for the package surfaces one pre-existing, file-independent error (`tsconfig.json(5,5): TS5101` deprecated `baseUrl` option) — not caused by `popover.tsx`'s edit, 0 new errors.
  - [x] 5.3 Ran targeted Vitest files that mount a `Dialog`/`Select`/`Sheet`/`Popover` consumer: `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx`, `apps/web/src/app/[locale]/moderator/items/moderator-items-content.test.tsx`, `apps/web/src/features/events/EventDetailWrapper.test.tsx`, `apps/web/src/features/events/report-dialog.test.tsx` (82 tests passed) and `packages/ui/src/features/events/FilterHub.test.tsx` (7 tests passed, exercises `Popover`) — all pass unmodified.
  - [x] 5.4 Manual visual smoke check: confirmed via code inspection that `z-overlay-modal` (the value `OVERLAY_MODAL_Z` resolves to) maps to `zIndex: '50'` in `apps/web/tailwind.config.ts`'s `theme.extend.zIndex['overlay-modal']`, i.e. the exact same computed `z-index: 50` as the literal it replaces — confirming AC5's "no resolved-value change" by construction, consistent with the existing automated regression coverage in 5.3.

## Dev Notes

- Relevant architecture patterns and constraints: AD-33 Rule 2 (migration) + Rule 3 (shared `OVERLAY_MODAL_Z` constant, mandatory for every Overlay-modal consumer, Radix-portaled or not). This story covers the four Radix wrappers named explicitly in AD-33's Binds clause.
- Source tree components to touch: `apps/web/src/components/ui/dialog.tsx`, `select.tsx`, `sheet.tsx`; `packages/ui/src/core/ui/popover.tsx`.
- Testing standards summary: no new tests — this is a non-behavioral token substitution. Existing component/integration tests that render through any of these four wrappers are the regression net (Task 5.3).
- **Depends on:** Story 0.49 (needs `OVERLAY_MODAL_Z` to exist and be exported before it can be imported here).
- **Current code, read in full during story creation** (so the dev agent does not need to re-derive it):
  - `dialog.tsx`: `DialogOverlay` line 24, `DialogContent` line 46. Both inside `cn(...)` calls — the substitution is inside the first string argument only; `className` (the consumer override, second `cn()` argument) is untouched.
  - `select.tsx`: `SelectContent` line 78, inside a `cn(...)` call whose second argument is a conditional `position === "popper" && "..."` string (untouched) and third is the consumer's `className` (untouched).
  - `sheet.tsx`: `SheetOverlay` line 24 (inside `cn(...)`), and `sheetVariants`'s base string is `cva`'s **first** positional argument (a plain template literal, not wrapped in `cn()`) — do not confuse this with the `variants.side` object's four strings (`top`/`bottom`/`left`/`right`), none of which contain `z-50`.
  - `popover.tsx`: `PopoverContent` line 20, inside a `cn(...)` call; this file is in `packages/ui` itself (not `apps/web`), so it must import `OVERLAY_MODAL_Z` via a relative path to `core/overlay-z.ts`, not via the package's own `@festgrid/ui` barrel (importing your own package's public entry point from inside the package risks a bundler/test-resolution cycle; every other intra-`packages/ui` cross-reference in this codebase uses relative paths, e.g. `popover.tsx`'s own existing `'../../lib/utils'` import).

### Architecture & UX Gate Findings

- **Gate 1 — No gap found.** Fresh for this story (stale `epic-0-readiness.md` doesn't cover this scope). Pure className substitution in existing shared UI wrapper components; no backend/API/infra touched.
- **Gate 2 — No gap found.** This story performs no new component design — it renames an existing, already-shipped class on four files that already exist and are already shared/reused across the app. No new states/variants/a11y surface is introduced.
- **Gate 3 — No gap found** (beyond the one already surfaced and handled in Story 0.49 — see that story's Gate 3 finding and `FIND-077`; not re-raised here since this story only consumes `OVERLAY_MODAL_Z`, it does not redefine the mechanism).

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — className string literals only, no data model.
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: Zero visual/behavioral change (AC5) — purely a class-name-source substitution at the identical resolved value.
- Verification checks: Task 5's lint/typecheck/existing-test-suite pass, plus the manual visual smoke check (Task 5.4).

### Project Structure Notes

- All four files already exist at their current paths; no new files, no relocation.
- `popover.tsx`'s relative import path to `overlay-z.ts` depends on `overlay-z.ts`'s final location from Story 0.49 (`packages/ui/src/core/overlay-z.ts`) — both files sit under `packages/ui/src/core/`, `popover.tsx` one directory deeper at `core/ui/popover.tsx`, so the relative import is `'../overlay-z'`.
- No conflicts detected.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-33] (Rules 2, 3)
- [Source: apps/web/src/components/ui/dialog.tsx] (read in full)
- [Source: apps/web/src/components/ui/select.tsx] (read in full)
- [Source: apps/web/src/components/ui/sheet.tsx] (read in full)
- [Source: packages/ui/src/core/ui/popover.tsx] (read in full)
- [Source: _bmad-output/implementation-artifacts/0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant.md] (prerequisite mechanism story)

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Layering (z-index tiers)" rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md`
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-33.
- [x] `docs/infrastructure/index.md` — consulted; not applicable.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `apps/web/src/components/ui/dialog.tsx` (2 sites)
  - Modified: `apps/web/src/components/ui/select.tsx` (1 site)
  - Modified: `apps/web/src/components/ui/sheet.tsx` (2 sites)
  - Modified: `packages/ui/src/core/ui/popover.tsx` (1 site)
  - **Not touched:** any other Radix-based component; any backend/DB file.
- **Rule Mapping:**
  - AD-33 Rule 2/3 → Tasks 1-4.
  - "Leave the system working end-to-end" → Task 5's full regression pass across every consumer of these four wrappers.
- **Verification Plan:**
  - Lint/typecheck for `apps/web` and `packages/ui` (Task 5.1/5.2).
  - Existing test suites touching these components, unmodified and green (Task 5.3).
  - Manual visual smoke check (Task 5.4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — 6 class-string substitutions across 4 shared Radix wrapper files; zero visual/behavioral change.
- [ ] Architecture and boundary confirmation — `apps/web`/`packages/ui` only; depends on Story 0.49 being done first.
- [ ] Testing plan confirmation — existing test suites unmodified + green; manual visual smoke check.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1-3: no gap for this story specifically (Story 0.49's own Gate 3 finding/FIND-077 already accepted there).

## Testing Requirements

- [ ] Integration tests — every existing test suite mounting a `Dialog`/`Select`/`Sheet`/`Popover` consumer, re-run unmodified to green.
- [ ] E2E tests — Not applicable; no new user-facing behavior.

## Deliverables Checklist

- [ ] `dialog.tsx`, `select.tsx`, `sheet.tsx`, `popover.tsx` all import and use `OVERLAY_MODAL_Z` instead of inlining `z-50`.
- [ ] Zero resolved-value change confirmed (manual check).

## Out of Scope

- `apps/web/src/features/post-selection/components/summary-bar.tsx` and every `packages/ui/src/features/events/*` overlay consumer — Story 0.49c.
- `AppShell`/`NavRailItem`/`UserMenu`/`blocking-loader` — Story 0.49b.
- `LocationPickerField`/`LocationPickerMapPanel`/`subscribe-account-dialog` — Story 0.49d.

## Definition of Done

- [ ] AC1–AC6 satisfied.
- [ ] Lint and type checks passing for `apps/web` and `packages/ui`.
- [ ] Every existing Dialog/Select/Sheet/Popover-consuming test passes unmodified.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (bmad-dev-story workflow)

### Debug Log References

- `pnpm --filter web exec vitest run src/app/[locale]/settings/locations/location-form-dialog.test.tsx src/app/[locale]/moderator/items/moderator-items-content.test.tsx src/features/events/EventDetailWrapper.test.tsx src/features/events/report-dialog.test.tsx` → 4 files / 82 tests passed.
- `pnpm --filter @festgrid/ui exec vitest run src/features/events/FilterHub.test.tsx` → 1 file / 7 tests passed (exercises `Popover`).
- `pnpm --filter web lint` → exit 0, no new issues in `dialog.tsx`/`select.tsx`/`sheet.tsx`.
- `pnpm --filter web exec tsc --noEmit` → 19 pre-existing errors, all in files unrelated to this story's 4 touched files (msw/mock-typing in `posts-select-content.test.tsx`, `reports-content.test.tsx`, `CalendarView.test.tsx`, `EventDetailWrapper.test.tsx`'s mock typings, `auth-session-provider.test.tsx` Bearer-casing, `mapper.test.ts` DayOfWeek typing, two `e2e/*.spec.ts` null-narrowing issues) — 0 new errors attributable to this story.
- `pnpm --filter @festgrid/ui lint` → exit 0, 0 warnings/errors (`--max-warnings 0`).
- `pnpm --filter @festgrid/ui exec tsc --noEmit` → 1 pre-existing, file-independent error (`tsconfig.json(5,5)` deprecated `baseUrl` option) — not caused by `popover.tsx`'s edit.

### Completion Notes List

- Migrated all four Radix UI wrapper components named in AD-33's Binds clause (`apps/web/src/components/ui/dialog.tsx`, `select.tsx`, `sheet.tsx`, and `packages/ui/src/core/ui/popover.tsx`) from an inlined `z-50` literal to the shared `OVERLAY_MODAL_Z` constant — 6 class-string substitution sites total (AC1–AC4), each a pure token-name swap with every other class in the string left untouched, exactly as scoped.
- `dialog.tsx`/`select.tsx`/`sheet.tsx` import `OVERLAY_MODAL_Z` from the `@festgrid/ui` barrel; `popover.tsx` (itself inside `packages/ui`) imports it via the relative sibling path `../overlay-z` per AC4/Dev Notes, avoiding a self-import cycle through its own package's barrel.
- Verified by inspection (not by code change) that `OVERLAY_MODAL_Z = 'z-overlay-modal'` and `apps/web/tailwind.config.ts` maps `theme.extend.zIndex['overlay-modal']` to `'50'` — confirming AC5 (no resolved z-index value change; still computed `z-index: 50` everywhere).
- No new tests added, per the story's own Testing Standards summary (non-behavioral token substitution) — Task 5.3's existing-test regression run is the net, and it is green (89 tests total across the two packages, all unmodified).
- Dependency note: Story 0.49 (which defines `OVERLAY_MODAL_Z`) is itself still at `review` status in sprint-status.yaml rather than `done`. Verified directly that its deliverable already exists and is exported (`packages/ui/src/core/overlay-z.ts` → barreled via `packages/ui/src/index.ts`), so the dependency is functionally satisfied. Flagged to the user before starting; explicit approval to proceed was given (orchestrator-level decision: routine in-lane migration, prerequisite gap accepted).
- Lane discipline: only `apps/web` and `packages/ui` files touched, per the UI-lane-only instruction; no backend/database files read or written beyond the standard repo-wide `pnpm install`/migrate step the sandbox runs automatically on session start.
- Verification commands were run as targeted/package-scoped only (specific Vitest files, package-scoped lint, package-scoped `tsc --noEmit`) — no whole-repo lint/build/test was run, per the UI-lane rules for this story.

### File List

- Modified: `apps/web/src/components/ui/dialog.tsx`
- Modified: `apps/web/src/components/ui/select.tsx`
- Modified: `apps/web/src/components/ui/sheet.tsx`
- Modified: `packages/ui/src/core/ui/popover.tsx`

### Change Log

- 2026-10-06 — Migrated `dialog.tsx`, `select.tsx`, `sheet.tsx`, and `popover.tsx` to source their Overlay-modal z-index class from the shared `OVERLAY_MODAL_Z` constant instead of each inlining a `z-50` literal (AC1–AC6). No behavioral/visual change; targeted regression tests (82 + 7 = 89 tests) pass unmodified; package-scoped lint/typecheck show 0 new issues.
