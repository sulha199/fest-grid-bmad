---
baseline_commit: ebdc960898e9ff717e6c0473499a70ed5bce6595
---

# Story 0.49b: Migrate AppShell, UserMenu's backdrop, and the blocking loader to their named tiers

## Story Details

- Epic: 0
- Story ID: 0.49b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `AppShell.tsx`'s two persistent chrome sites and `UserMenu.tsx`'s mobile backdrop to use the named `z-chrome` token, and `blocking-loader.tsx`'s one site to use `z-overlay-blocking`,
so that the app's permanent navigation chrome and its one full-screen blocking state are each on their correctly-named Architecture Spine AD-33 tier instead of a raw `z-40`/`z-[60]` literal.

## Acceptance Criteria

1. **Given** `packages/ui/src/core/app-shell/AppShell.tsx`'s mobile bottom tab bar (line 129, `"fixed inset-x-0 bottom-0 z-40 flex items-center ..."`) and its desktop sidenav rail (line 162, `"fixed inset-y-0 start-0 z-40 hidden md:flex ..."`), **when** this story ships, **then** both replace the literal `z-40` with the Tailwind token class `z-chrome` (a plain class-name swap — no import needed, since `z-chrome` is a named Tailwind utility from Story 0.49's config change, not a JS constant like `OVERLAY_MODAL_Z`).
2. **Given** `packages/ui/src/core/app-shell/UserMenu.tsx`'s "Mobile Backdrop Overlay" `<div>` (line 101, `"fixed inset-0 bg-background/50 z-40 md:hidden"`), **when** this story ships, **then** it replaces `z-40` with `z-chrome`. **UserMenu.tsx's other z-index site — the "Main Menu Container" at line 109 (currently `z-50`) — is explicitly excluded from this story.** Gate 2 (run during this story set's creation) found that AD-33's Overlay-modal tier definition ("every ... menu ... hand-rolled") covers this hand-rolled menu panel, not Chrome — despite AD-33's Binds clause naming "UserMenu" generally alongside "AppShell"/"NavRailItem" under Chrome, the menu panel itself is a hand-rolled, no-`isolate`-ancestor overlay that must outrank arbitrary page content exactly like the `EventDetailView` kebab dropdown AD-33 explicitly classifies as Overlay-modal. It migrates in Story 0.49c instead, alongside `NavRailItem.tsx`'s tooltip (same reclassification, same reasoning).
3. **Given** `packages/ui/src/core/blocking-loader.tsx`'s one full-screen overlay `<div>` (line 82, `"fixed inset-0 z-[60] flex items-center justify-center bg-black/50 outline-none"`), **when** this story ships, **then** it replaces the non-Tailwind-scale literal `z-[60]` with the named token `z-overlay-blocking` — AD-33 Rule 2 explicitly calls this out as "replaces the sole non-Tailwind-scale `z-[60]` literal with a named tier instead of a magic number."
4. **Given** all three sites keep the same resolved numeric z-index value (40 for the two AppShell sites and the UserMenu backdrop; 60 for the blocking loader) — this story changes no value, only the class name that produces it, **when** this story ships, **then** no visual/stacking regression occurs; the ratchet test (Story 0.49e) will treat all three post-migration sites as correctly-tiered examples.
5. **Given** this story touches only `packages/ui` with zero behavioral change, **when** this story ships, **then** every existing test exercising `AppShell`, `UserMenu`, or `BlockingLoader` continues to pass unmodified (confirmed by grep during this story's creation — no test asserts on the literal `z-40`/`z-[60]` className string in any of these three components).

## Tasks / Subtasks

- [x] Task 1 — `AppShell.tsx` (AC1)
  - [x] 1.1 Line 129 (mobile tab bar): replace `z-40` with `z-chrome` inside the existing class string — no other class changes.
  - [x] 1.2 Line 162 (desktop sidenav rail): same substitution.
- [x] Task 2 — `UserMenu.tsx`'s backdrop only (AC2)
  - [x] 2.1 Line 101 (mobile backdrop `<div>`): replace `z-40` with `z-chrome`. **Do not touch line 109** (the menu container) — that site belongs to Story 0.49c.
- [x] Task 3 — `blocking-loader.tsx` (AC3)
  - [x] 3.1 Line 82: replace `z-[60]` with `z-overlay-blocking`.
- [x] Task 4 — Verification (AC4, AC5)
  - [x] 4.1 `pnpm --filter @festgrid/ui lint && pnpm --filter @festgrid/ui exec tsc --noEmit` (or project standard) — 0 new errors. Lint: 0 errors/warnings. `tsc --noEmit`: fails, but only on a pre-existing, unrelated `TS5101` ("Option 'baseUrl' is deprecated") config-level error in `packages/ui/tsconfig.json` — not caused by this story's edits (no tsconfig/type changes made; verified via `git diff --stat`, which shows only the story's own className/test edits). Flagged as pre-existing/out of scope rather than fixed, per scope guard.
  - [x] 4.2 Run every existing test suite exercising `AppShell.test.tsx`, `UserMenu.test.tsx` (if present), and any `BlockingLoader`/`blocking-loader` test — confirm unmodified pass. **Correction to AC5's premise:** `blocking-loader.test.tsx` DID assert on the literal `'z-[60]'` className (the AC5 grep claim during story creation was inaccurate for this one test). Updated that single assertion to `'z-overlay-blocking'` (tracking the sanctioned rename, same resolved value per AC4) — all 15 tests across the 3 suites pass.
  - [x] 4.3 Manual visual smoke check: confirm the mobile tab bar, desktop sidenav rail, the mobile backdrop behind an open `UserMenu`, and the blocking loader all render identically to before (same stacking relative to page content). Confirmed via source inspection: all 4 sites now read the correct named token class; `UserMenu.tsx` line 109 (`z-50`) verified untouched. No value change (AD-33 tokens: chrome=40, overlay-blocking=60, matching prior literals).

## Dev Notes

- Relevant architecture patterns and constraints: AD-33 Rule 1 (Chrome=40: AppShell/NavRailItem/UserMenu — scoped here to the *persistent chrome* sites only, not every z-index site these three components happen to contain), Rule 2 (migration), the explicit `z-[60]`→`z-overlay-blocking` callout for the blocking loader.
- Source tree components to touch: `packages/ui/src/core/app-shell/AppShell.tsx`, `packages/ui/src/core/app-shell/UserMenu.tsx` (one site only — see AC2), `packages/ui/src/core/blocking-loader.tsx`.
- Testing standards summary: no new tests — non-behavioral token substitution. Existing `AppShell`/`UserMenu`/`BlockingLoader` tests are the regression net.
- **Depends on:** Story 0.49 (the `z-chrome`/`z-overlay-blocking` Tailwind tokens must exist first). Independent of Story 0.49a/0.49c/0.49d (disjoint files, except the file-level split with 0.49c on `UserMenu.tsx` — see below).
- **Why `UserMenu.tsx` is split across two stories:** this file has two z-index sites on two different tiers (backdrop = Chrome, menu panel = Overlay-modal per Gate 2's finding). Rather than force one adoption story to handle both tiers (risking exactly the "blanket file-level conversion" mistake Gate 2 flagged against the original draft grouping), the backdrop ships here and the menu panel ships in Story 0.49c. Both stories can land in either order or in parallel — they touch different lines of the same file, so sequence them to avoid a merge conflict, not because of a logical dependency.
- **`NavRailItem.tsx` has no site in this story at all** — despite being named alongside AppShell/UserMenu in AD-33's Chrome binding, its one z-index site (a hover tooltip, line 52) is a hand-rolled, no-`isolate` overlay per the same Gate 2 reasoning as UserMenu's menu panel, and migrates entirely in Story 0.49c.

### Architecture & UX Gate Findings

- **Gate 1 — No gap found.** Fresh for this story. Pure className substitution in existing shared `packages/ui` components; no backend/API/infra.
- **Gate 2 — Finding incorporated into this story's scope (not a split-off story).** Gate 2, run during this story set's creation against the original draft (which had bundled all of `AppShell`/`NavRailItem`/`UserMenu` into one "chrome" adoption story), found that a blanket file-level conversion would wrongly drop `UserMenu`'s menu panel and `NavRailItem`'s tooltip from 50 to 40 — a real stacking regression, not a pure rename (both are hand-rolled, no-`isolate` overlays that must compete with arbitrary page content, matching AD-33's own Overlay-modal classification of the structurally identical `EventDetailView` kebab dropdown). This story's AC2 explicitly carves the menu-panel site out to Story 0.49c instead of absorbing Gate 2's correction silently.
- **Gate 3 — No gap found** beyond Story 0.49's own finding (already recorded/accepted there as `FIND-074`).

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — className literals only.
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: Zero value change (AC4) — pure class-name-source substitution at identical resolved values (40, 40, 60).
- Verification checks: Task 4's lint/typecheck/existing-test pass, plus manual visual smoke check.

### Project Structure Notes

- All three files exist at their current paths; no new files.
- No conflicts detected, aside from the intentional, documented file-level split with Story 0.49c on `UserMenu.tsx` (see above).

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-33] (Rule 1 Chrome definition, Rule 2 migration, explicit `z-[60]` callout)
- [Source: packages/ui/src/core/app-shell/AppShell.tsx] (read in full)
- [Source: packages/ui/src/core/app-shell/UserMenu.tsx] (read in full — confirmed both z-index sites and their distinct tiers)
- [Source: packages/ui/src/core/blocking-loader.tsx] (read in full)
- [Source: _bmad-output/implementation-artifacts/0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant.md] (prerequisite mechanism story)
- [Source: _bmad-output/implementation-artifacts/0-49c-migrate-the-events-feature-overlay-menu-tooltip-sites-and-the-summary-bar.md] (sibling story — owns `UserMenu.tsx`'s other site and `NavRailItem.tsx`)

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Layering (z-index tiers)" rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md`
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-33.
- [x] `docs/infrastructure/index.md` — consulted; not applicable.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/ui/src/core/app-shell/AppShell.tsx` (2 sites)
  - Modified: `packages/ui/src/core/app-shell/UserMenu.tsx` (1 site only — line 101; line 109 is Story 0.49c's)
  - Modified: `packages/ui/src/core/blocking-loader.tsx` (1 site)
  - **Not touched:** `NavRailItem.tsx` (entirely Story 0.49c's); `UserMenu.tsx` line 109 (Story 0.49c's).
- **Rule Mapping:**
  - AD-33 Rule 1 (Chrome) + explicit blocking-loader callout → Tasks 1-3.
  - Gate 2 correction → AC2's explicit carve-out.
- **Verification Plan:**
  - Lint/typecheck for `packages/ui` (Task 4.1).
  - Existing `AppShell`/`UserMenu`/`BlockingLoader` tests, unmodified and green (Task 4.2).
  - Manual visual smoke check (Task 4.3).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — 3 class-string substitutions (2 AppShell + 1 UserMenu backdrop) to `z-chrome`, 1 substitution (blocking-loader) to `z-overlay-blocking`. `UserMenu.tsx` line 109 and all of `NavRailItem.tsx` explicitly excluded.
- [ ] Architecture and boundary confirmation — `packages/ui` only; depends on Story 0.49.
- [ ] Testing plan confirmation — existing tests unmodified + green; manual visual smoke check.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 2's finding is incorporated into this story's own AC2, not deferred.

## Testing Requirements

- [ ] Integration tests — existing `AppShell`/`UserMenu`/`BlockingLoader` test suites, re-run unmodified to green.
- [ ] E2E tests — Not applicable.

## Deliverables Checklist

- [ ] `AppShell.tsx`'s two chrome sites on `z-chrome`.
- [ ] `UserMenu.tsx`'s backdrop (only) on `z-chrome`.
- [ ] `blocking-loader.tsx`'s one site on `z-overlay-blocking`.

## Out of Scope

- `UserMenu.tsx` line 109 (menu panel) and all of `NavRailItem.tsx` — Story 0.49c.
- The four Radix UI wrappers — Story 0.49a.
- The location/subscribe-account dropdowns — Story 0.49d.

## Definition of Done

- [ ] AC1–AC5 satisfied.
- [ ] Lint and type checks passing for `packages/ui`.
- [ ] Every existing AppShell/UserMenu/BlockingLoader test passes unmodified.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Pre-coding approval: user explicitly approved via AskUserQuestion on 2026-10-06 (Pre-Coding Approval Gate checklist itself not edited, per story-edit permission scope).
- Verified dependency Story 0.49 (`0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant`) was `review` in sprint-status.yaml, and confirmed the `chrome`/`overlay-blocking` zIndex tokens exist in `apps/web/tailwind.config.ts` (`chrome: '40'`, `overlay-blocking: '60'`) before coding.
- `pnpm --filter @festgrid/ui exec vitest run src/core/blocking-loader.test.tsx src/core/app-shell/AppShell.test.tsx src/core/app-shell/UserMenu.test.tsx` — 15/15 passed after the test-assertion fix below.
- `pnpm --filter @festgrid/ui lint` — 0 errors/warnings.
- `pnpm --filter @festgrid/ui exec tsc --noEmit` — fails on pre-existing `TS5101` ("Option 'baseUrl' is deprecated") in `packages/ui/tsconfig.json`, unrelated to this story's edits (no tsconfig/type files touched; confirmed via `git diff --stat`). Flagged as pre-existing/out of scope, not fixed.

### Completion Notes List

- Replaced `z-40` → `z-chrome` at `AppShell.tsx` lines 129 and 162 (mobile tab bar, desktop sidenav rail).
- Replaced `z-40` → `z-chrome` at `UserMenu.tsx` line 101 (mobile backdrop only); confirmed line 109 (menu container, `z-50`) left untouched.
- Replaced `z-[60]` → `z-overlay-blocking` at `blocking-loader.tsx` line 82.
- **AC5 discrepancy found and corrected:** the story's AC5 claimed no existing test asserts on the literal `z-40`/`z-[60]` className string, but `blocking-loader.test.tsx` did assert `toHaveClass('fixed', 'inset-0', 'z-[60]')`. Updated that one assertion to `'z-overlay-blocking'` to track the sanctioned rename (AC4: same resolved value, class-name-only change). This is the only test file modified; no other test content changed.
- All three target files verified by direct grep post-edit: no remaining `z-40`/`z-[60]` literals in any of the three components; the explicitly-excluded `UserMenu.tsx` line 109 and all of `NavRailItem.tsx` are untouched.
- Verification commands actually executed and their results are recorded above (Debug Log References) per the Verification Plan: vitest (targeted files) green, lint green, tsc pre-existing failure flagged as out of scope.
- Ran package-scoped commands only (`pnpm --filter @festgrid/ui ...`); no whole-repo lint/build/test, no backend suite, no DB touched, no unfrozen install.

### File List

- Modified: `packages/ui/src/core/app-shell/AppShell.tsx`
- Modified: `packages/ui/src/core/app-shell/UserMenu.tsx`
- Modified: `packages/ui/src/core/blocking-loader.tsx`
- Modified: `packages/ui/src/core/blocking-loader.test.tsx` (one stale literal-string assertion updated to track the sanctioned rename — see Completion Notes)
- Modified: `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions for this story key)
- Modified: `_bmad-output/implementation-artifacts/0-49b-migrate-appshell-usermenus-backdrop-and-the-blocking-loader-to-their-tiers.md` (this story file: frontmatter, Tasks/Subtasks, Dev Agent Record, Change Log, Status)

### Change Log

- 2026-10-06: Implemented Story 0.49b — migrated AppShell's two chrome sites and UserMenu's mobile backdrop to `z-chrome`, and blocking-loader's overlay to `z-overlay-blocking`. Fixed one stale test assertion in `blocking-loader.test.tsx` that the story's AC5 had missed (asserted literal `z-[60]`). All targeted tests pass (15/15); lint clean; `tsc --noEmit` blocked by a pre-existing, unrelated tsconfig `TS5101` error, flagged as out of scope. Status moved ready-for-dev → in-progress → review.
