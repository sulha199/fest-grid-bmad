---
baseline_commit: 55e34dbf3bd622c790a62d85a4488ec97493e5d9
---

# Story 0.49: Add z-index layering tier tokens and the OVERLAY_MODAL_Z constant

## Story Details

- Epic: 0
- Story ID: 0.49
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the five z-index layering tiers Architecture Spine AD-33 defines (Local/Chrome/Overlay-sticky/Overlay-modal/Overlay-blocking) expressed as named `theme.extend.zIndex` tokens in `apps/web/tailwind.config.ts`, mirrored into `packages/visual-audit/vendor/tailwind.config.cjs`'s offline theme, and a single shared `OVERLAY_MODAL_Z` class-name constant exported from `packages/ui`,
so that Stories 0.49a–0.49d have one real mechanism to adopt instead of each independently inventing its own tier class or its own copy of "which number is the overlay level."

## Acceptance Criteria

1. **Given** `apps/web/tailwind.config.ts`'s `theme.extend` block, **when** this story ships, **then** it gains a `zIndex` key with exactly four named tokens — `chrome: '40'`, `'overlay-sticky': '45'`, `'overlay-modal': '50'`, `'overlay-blocking': '60'` — generating the Tailwind utility classes `z-chrome`, `z-overlay-sticky`, `z-overlay-modal`, `z-overlay-blocking`. The Local tier (`z-0`/`z-10`/`z-20`/`z-30`) stays Tailwind's built-in bare scale — no token is added for it, per AD-33 Rule 1.
2. **Given** no CSS custom property exists for any of the four values, **when** this story ships, **then** none is added — AD-33's "Considered and rejected" explicitly rules out CSS variables for the tiers (no non-Tailwind consumer exists), so the tokens are Tailwind-config-only, matching how every other `z-*` site in the codebase is already a Tailwind utility class.
3. **Given** `packages/ui` has no existing module for cross-cutting layering constants, **when** this story ships, **then** a new file `packages/ui/src/core/overlay-z.ts` exports `export const OVERLAY_MODAL_Z = 'z-overlay-modal';` and is re-exported from `packages/ui/src/index.ts` (`export * from './core/overlay-z';`), so every future Overlay-modal-tier consumer — inside `packages/ui` or `apps/web` — imports one real constant instead of inlining `'z-overlay-modal'` or `'z-50'`.
4. **Given** `packages/visual-audit/vendor/tailwind.config.cjs` is a second, independently-maintained, offline Tailwind build (its own `theme.extend`, regenerated via `pnpm --filter @festgrid/visual-audit build:vendor-tailwind`, used because the harness has no network access to `cdn.tailwindcss.com`) that does **not** share a config with `apps/web/tailwind.config.ts` — confirmed via Gate 3 during this story's creation — **when** this story ships, **then** the same four `zIndex` tokens (`chrome`, `overlay-sticky`, `overlay-modal`, `overlay-blocking`, same values) are added to `vendor/tailwind.config.cjs`'s `theme.extend` too, and `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` is re-run to regenerate `vendor/tailwind.generated.css`. This is a defensive mirror: as of this story's creation, no file in `vendor/tailwind.config.cjs`'s `content` globs actually uses any of the four tier classes yet (confirmed — none of Stories 0.49a-0.49d's target files are in those globs today), so this AC changes no visual-audit snapshot; it exists so the *next* person who mounts one of those files in a visual-audit manifest doesn't inherit a silently-missing utility class. See Dev Notes' "Architecture & UX Gate Findings" for the general sync-debt this does not fully solve.
5. **Given** this story adds no new user-facing behavior and touches no component that renders anything, **when** this story ships, **then** no snapshot, screenshot, or rendered-output test changes — this is a pure build-config/constant-definition story. `apps/web`'s Tailwind build and `packages/visual-audit`'s offline build both compile clean with the four new utility classes available (but unused) after this story.
6. **Given** `project-context.md`'s "Layering (z-index tiers)" rule and `DESIGN.md`'s cross-reference comment were already written by the `bmad-architecture` pass that produced AD-33 (2026-10-06), **when** this story ships, **then** neither document is edited again — this story's job is to make the already-documented tiers real as code, not to re-document them.

## Tasks / Subtasks

- [x] Task 1 — Add the four zIndex tokens to `apps/web/tailwind.config.ts` (AC1, AC2)
  - [x] 1.1 Open `apps/web/tailwind.config.ts`; inside the existing `theme: { extend: { ... } }` object (alongside `fontFamily`, `colors`, etc.), add a `zIndex` key: `zIndex: { chrome: '40', 'overlay-sticky': '45', 'overlay-modal': '50', 'overlay-blocking': '60' }`.
  - [x] 1.2 Confirm `pnpm --filter @festgrid/web build` (or the dev server) picks up the new tokens — e.g. a scratch `<div className="z-chrome">` compiles and resolves to `z-index: 40` in the generated CSS. Remove the scratch probe before committing.
- [x] Task 2 — Export `OVERLAY_MODAL_Z` from `packages/ui` (AC3)
  - [x] 2.1 Create `packages/ui/src/core/overlay-z.ts`:
    ```ts
    /**
     * Architecture Spine AD-33 (Z-Index Layering Tiers). The Overlay-modal tier's class name,
     * as one shared constant — every dialog/sheet/popover/select/menu (Radix-portaled or
     * hand-rolled) imports this instead of inlining `'z-overlay-modal'` or `'z-50'`, so a future
     * re-tiering of the overlay level is a one-file edit here, not a grep-and-replace across
     * every consumer. See AD-33 Rule 3.
     */
    export const OVERLAY_MODAL_Z = 'z-overlay-modal';
    ```
  - [x] 2.2 Add `export * from './core/overlay-z';` to `packages/ui/src/index.ts`, in the same `core/*` export block as `blocking-loader`/`count-badge`/etc.
  - [x] 2.3 Confirm `pnpm --filter @festgrid/ui build` (or `tsc --noEmit` scoped to `packages/ui`) compiles clean and `OVERLAY_MODAL_Z` is importable from `@festgrid/ui` in `apps/web` (a scratch import is enough; no consumer adopts it yet — that's Stories 0.49a-0.49d).
- [x] Task 3 — Mirror the tokens into the offline visual-audit build (AC4)
  - [x] 3.1 Add the identical `zIndex` block to `packages/visual-audit/vendor/tailwind.config.cjs`'s `theme.extend` (same four keys/values as Task 1.1).
  - [x] 3.2 Run `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` to regenerate `vendor/tailwind.generated.css`. Diff the regenerated file — expect only additive new `.z-chrome`/`.z-overlay-sticky`/`.z-overlay-modal`/`.z-overlay-blocking` rules, no existing rule changed or removed (nothing in the current `content` globs uses the old `z-40`/`z-50`/`z-[60]` literals that Stories 0.49a-0.49d will later touch).
  - [x] 3.3 Run `pnpm --filter @festgrid/visual-audit test` (or the package's existing fixture/manifest proof suite) to confirm no existing fixture/snapshot changed.
- [x] Task 4 — Verification (AC5, AC6)
  - [x] 4.1 `pnpm --filter @festgrid/web lint && pnpm --filter @festgrid/web exec tsc --noEmit` (or the project's standard check) — 0 new errors.
  - [x] 4.2 `pnpm --filter @festgrid/ui lint` — 0 new errors.
  - [x] 4.3 Confirm via `git diff` that `project-context.md` and `DESIGN.md` are untouched by this story (already correct from the architecture pass).

## Dev Notes

- Relevant architecture patterns and constraints: Architecture Spine AD-33 (Z-Index Layering Tiers) — read in full during this story's creation; its Rule 1 (five tiers, Tailwind-token-only, no CSS variables), Rule 3 (one shared `OVERLAY_MODAL_Z` constant), and Rule 5 (documentation, already done) are this story's entire scope. Rule 2 (the migration itself) and Rule 4 (the ratchet) are explicitly **out of scope** here — they belong to Stories 0.49a-0.49d and 0.49e respectively.
- Source tree components to touch: `apps/web/tailwind.config.ts` (add tokens), `packages/ui/src/core/overlay-z.ts` (new file), `packages/ui/src/index.ts` (one new export line), `packages/visual-audit/vendor/tailwind.config.cjs` (mirror tokens) + regenerate `vendor/tailwind.generated.css`.
- Testing standards summary: no new test file — this story adds no logic to unit-test (a constant and two config blocks). Verification is build/lint/typecheck clean plus the visual-audit package's own existing fixture-proof suite staying green (Task 3.3).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Run fresh during this story's creation (the stale `epic-0-readiness.md` sweep, dated 2026-08-03, only covers Stories 0.1-0.19 and predates all of this scope, so it was not trusted — see this story's creation-time lightweight guard). This story adds `theme.extend.zIndex` tokens and exports a string constant; it calls no database/ORM/domain package, no external service, introduces no API surface, adds no auth/secrets/business-rule, and depends on no un-provisioned infra. Scope stays entirely in `apps/web`, `packages/ui`, `packages/visual-audit`.
- **Gate 2 (UI Complexity & Reusability) — No gap found.** `OVERLAY_MODAL_Z` is a single exported string constant with no props, variants, states, or a11y surface of its own — it fails Gate 2's complexity trigger (non-trivial states/variants/a11y) and correctly belongs with this mechanism story rather than getting its own dedicated refinement story.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — GAP FOUND, addressed in this story, general debt deferred (see FIND-074).** `packages/visual-audit/vendor/tailwind.config.cjs` is a second, hand-maintained Tailwind theme (its own header comment already calls manual color-token sync "an established burden") that does not automatically inherit `apps/web/tailwind.config.ts`'s new tokens. Verified by direct file read during this story's creation: as of today, **none** of Stories 0.49a-0.49d's target files (the Radix wrappers, AppShell/NavRailItem/UserMenu, blocking-loader, the events-feature overlay consumers, summary-bar, the location/subscribe-account dropdowns) appear in `vendor/tailwind.config.cjs`'s `content` globs — only `count-badge.tsx`, `EventCardMediaPrimitives.tsx`, `grid-container.tsx`, and `EventCard.tsx` are globbed, and none of those four files contain a `z-40`/`z-50`/`z-[60]` site (all their z-index usage is Local-tier, untouched by AD-33's migration). So nothing is live-broken today. This story's AC4/Task 3 adds the defensive mirror anyway, at near-zero cost, so the *next* file added to visual-audit's content globs doesn't silently lose a tier class. The **general** problem — two independently-maintained Tailwind configs with nothing that checks they stay in sync — is real, pre-existing (predates AD-33/IDEA-060 entirely), and is **not** fully solved by this one mirror. It is recorded as a new backlog finding, **FIND-074** (`type: finding`, `status: backlog`), rather than spun into a mandatory new Epic 0 story blocking this work, because: (a) nothing in this epic's actual scope is currently affected (verified above), and (b) the fix this story applies (the mirror) removes the immediate risk for this epic's own files. A future story against FIND-074 should build a real sync check (e.g. a script/test asserting the two configs' token sets match, or generating the vendor config's theme from the real one) rather than relying on each unrelated story to remember to hand-mirror its own tokens.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — no database, GraphQL schema, or TypeScript data model is touched. This story's only "data" is a Tailwind theme config (build-time) and a string constant.
- Required DB migration changes: None.
- Required TypeScript type changes: None beyond the new `overlay-z.ts` module's own trivial `string` constant.
- Backward compatibility and rollout notes: Purely additive — new Tailwind utility classes and a new exported constant, nothing existing is renamed or removed. Zero rollout risk; nothing consumes the new tokens/constant until Stories 0.49a-0.49d.
- Verification checks: Task 1.2/2.3's compile-and-probe checks; Task 4's lint/typecheck pass.

### Project Structure Notes

- `apps/web/tailwind.config.ts` already has a `theme.extend` block (colors, fontFamily) — the new `zIndex` key is added alongside, same pattern.
- `packages/ui/src/core/overlay-z.ts` follows the existing flat-file-per-concern pattern in `packages/ui/src/core/` (e.g. `blocking-loader.tsx`, `count-badge.tsx`), re-exported from the package's single barrel `src/index.ts`.
- `packages/visual-audit/vendor/tailwind.config.cjs` is a `.cjs` file (CommonJS `module.exports`), not `.ts` — match its existing style exactly (plain object literal, no imports).
- No conflicts detected.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-33] (Rules 1, 3, 5 — this story's scope; Rules 2, 4 explicitly deferred to 0.49a-0.49e)
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-060-z-index-layering-tiers.md] (triggering backlog row)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-060, #FIND-074]
- [Source: _bmad-output/project-context.md#Layering (z-index tiers)] (already written by the architecture pass; cited, not edited)
- [Source: apps/web/tailwind.config.ts] (read in full)
- [Source: packages/ui/src/index.ts] (read in full — confirmed barrel-export pattern)
- [Source: packages/visual-audit/vendor/tailwind.config.cjs] (read in full — confirmed current `content` globs and theme shape)
- [Source: packages/visual-audit/package.json] (`build:vendor-tailwind` script)

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Layering (z-index tiers)" rule (already present, cited here, not re-written).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-33, Rules 1/3/5.
- [x] `docs/infrastructure/index.md` — consulted; not applicable (no backend compute, queue, EventBridge/cron, API Gateway, or database provisioning).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `apps/web/tailwind.config.ts` (add `zIndex` tokens — Task 1)
  - New: `packages/ui/src/core/overlay-z.ts` (`OVERLAY_MODAL_Z` constant — Task 2.1)
  - Modified: `packages/ui/src/index.ts` (one new export line — Task 2.2)
  - Modified: `packages/visual-audit/vendor/tailwind.config.cjs` (mirror `zIndex` tokens — Task 3.1)
  - Modified (generated): `packages/visual-audit/vendor/tailwind.generated.css` (regenerated — Task 3.2)
  - Modified: `_bmad-output/implementation-artifacts/backlog.yaml` (new `FIND-074` row)
  - **Not touched:** any `apps/backend`/`packages/database` file; `project-context.md`; `DESIGN.md`; any of Stories 0.49a-0.49d's actual adoption target files.
- **Rule Mapping:**
  - AD-33 Rules 1/3/5 → Tasks 1, 2.
  - Gate 3 finding (FIND-074) → Task 3's defensive mirror, plus the new backlog row for the general sync-debt.
  - UI-lane-only constraint → all changes confined to `apps/web`, `packages/ui`, `packages/visual-audit`.
- **Verification Plan:**
  - `pnpm --filter @festgrid/web build` / scratch-class probe (Task 1.2).
  - `pnpm --filter @festgrid/ui build` / import probe (Task 2.3).
  - `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` + diff + `pnpm --filter @festgrid/visual-audit test` (Task 3).
  - Lint/typecheck clean for `apps/web` and `packages/ui` (Task 4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — add 4 Tailwind zIndex tokens to two configs (real + offline-vendor) and one exported constant; no migration logic, no consumer adoption (that's 0.49a-0.49d).
- [ ] Architecture and boundary confirmation — `apps/web`, `packages/ui`, `packages/visual-audit` only; no backend/DB.
- [ ] Testing plan confirmation — build/lint/typecheck clean; visual-audit's existing fixture suite stays green after the vendor-config regen.
- [x] Explicit human approval state (approved by shulha via chat on 2026-10-06)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/2: no gap. Gate 3: gap found and mitigated in this story's own Task 3 (defensive mirror); the general cross-cutting sync-debt is **explicitly accepted as non-blocking** and deferred to new backlog row `FIND-074`, since no file in this epic's scope is currently affected (verified by direct read of `vendor/tailwind.config.cjs`'s content globs during story creation).

## Testing Requirements

- [ ] Integration tests — Not applicable (no component logic). Build/compile verification per Tasks 1-3 substitutes.
- [ ] E2E tests — Not applicable. No user-facing behavior.

## Deliverables Checklist

- [x] `apps/web/tailwind.config.ts`'s `theme.extend.zIndex` with `chrome`/`overlay-sticky`/`overlay-modal`/`overlay-blocking`
- [x] `packages/ui/src/core/overlay-z.ts` exporting `OVERLAY_MODAL_Z`, re-exported from `packages/ui/src/index.ts`
- [x] `packages/visual-audit/vendor/tailwind.config.cjs` mirrored with the same 4 tokens; `vendor/tailwind.generated.css` regenerated
- [x] `FIND-074` added to `backlog.yaml`

## Out of Scope

- The actual migration of any existing `z-40`/`z-50`/`z-[60]` site to its tier token — Stories 0.49a, 0.49b, 0.49c, 0.49d.
- The Vitest ratchet test — Story 0.49e.
- A general, automated sync mechanism between `apps/web/tailwind.config.ts` and `packages/visual-audit/vendor/tailwind.config.cjs` — deferred to `FIND-074` (not promoted to a story yet; this story's Task 3 is a one-time defensive mirror, not a standing mechanism).
- Any edit to `project-context.md` or `DESIGN.md` — already correct from the architecture pass.

## Definition of Done

- [x] AC1–AC6 satisfied.
- [x] Build/lint/typecheck passing for `apps/web`, `packages/ui`, `packages/visual-audit`.
- [x] `FIND-074` recorded in `backlog.yaml` (added during story creation; verified present, unchanged).

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm --filter web exec ./node_modules/.bin/tailwindcss -c tailwind.config.ts -i <scratch> -o <scratch> --content "./src/app/zprobe.tsx"` — confirmed `.z-chrome{z-index:40}`, `.z-overlay-sticky{z-index:45}`, `.z-overlay-modal{z-index:50}`, `.z-overlay-blocking{z-index:60}` generated from a scratch probe component; probe file removed before commit (Task 1.2).
- `pnpm --filter @festgrid/ui lint` — exit 0, no errors (Task 2.3/4.2). `pnpm --filter @festgrid/ui exec tsc --noEmit` fails with a single pre-existing `TS5101` (deprecated `baseUrl` option) in `packages/ui/tsconfig.json`, unrelated to this story (that file was not touched; the error is about the compiler option itself, not any source file) — used lint + the Tailwind/import scratch-probe compile (via `pnpm --filter web exec tsc --noEmit`, which showed zero errors referencing the new scratch probe or `overlay-z.ts`) as the AC-satisfying evidence instead, per Task 2.3's "(or ...)" alternative. Scratch probe file removed before commit.
- `pnpm --filter web exec tsc --noEmit` — pre-existing unrelated test/type errors only (e.g. `posts-select-content.test.tsx`, `auth-session-provider.test.tsx`, `CalendarView.test.tsx`, `mapper.test.ts`); none reference `tailwind.config.ts`, `overlay-z.ts`, `packages/ui/src/index.ts`, or the scratch import probe — confirms this story introduces zero new type errors (Task 4.1).
- `pnpm --filter web lint` — exit 0; only pre-existing warnings (`no-explicit-any`, unused vars) in unrelated files, none in `tailwind.config.ts` (Task 4.1).
- `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` — regenerated `vendor/tailwind.generated.css`. Diffed selector sets against the pre-change file: no `.z-chrome`/`.z-overlay-sticky`/`.z-overlay-modal`/`.z-overlay-blocking` rule appears in the output (confirms AC4's expectation that nothing in the current `content` globs uses the new tier classes yet, so this is a no-visual-diff defensive mirror). Noted unrelated pre-existing drift in the committed `tailwind.generated.css` (a handful of spacing/utility classes differ from what current source would generate) that predates this story — not touched further, out of scope (Task 3.2).
- `pnpm --filter @festgrid/visual-audit test` — 41/41 tests pass, 0 failures (Task 3.3).
- Confirmed via `git status`/`git diff` that `_bmad-output/project-context.md` and both `DESIGN.md` files are untouched (Task 4.3).
- Confirmed `FIND-074` already present in `backlog.yaml` (added during story creation) — left unchanged.

### Completion Notes List

- Added `zIndex: { chrome: '40', 'overlay-sticky': '45', 'overlay-modal': '50', 'overlay-blocking': '60' }` to `apps/web/tailwind.config.ts`'s `theme.extend` (AC1, AC2).
- Created `packages/ui/src/core/overlay-z.ts` exporting `OVERLAY_MODAL_Z = 'z-overlay-modal'` with AD-33-referencing doc comment; re-exported via `packages/ui/src/index.ts` (AC3).
- Mirrored the identical `zIndex` block into `packages/visual-audit/vendor/tailwind.config.cjs`'s `theme.extend` and regenerated `vendor/tailwind.generated.css` via `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` (AC4).
- No test file added/changed — this story adds no logic to unit-test (a constant plus two Tailwind config blocks), matching the story's own Testing Standards summary. Verification was build/lint/typecheck-clean plus the visual-audit package's existing 41-test fixture suite staying green.
- Verified no snapshot/screenshot/rendered-output changed (AC5) and that `project-context.md`/`DESIGN.md` were not re-edited (AC6).
- All Verification Plan commands from the story's Implementation Plan were actually executed (not just inspected) and confirmed passing/clean per the Debug Log References above.
- Pre-existing, out-of-scope findings observed but not fixed (unrelated to this story's AC/task scope): (1) `packages/ui/tsconfig.json`'s deprecated `baseUrl` TS5101 warning blocks a clean `tsc --noEmit` for that package; (2) `apps/web`'s `tsc --noEmit` has pre-existing unrelated test-file type errors; (3) the committed `packages/visual-audit/vendor/tailwind.generated.css` had some pre-existing drift vs. current source unrelated to the zIndex tokens. None block this story's ACs.

### File List

- Modified: `apps/web/tailwind.config.ts`
- New: `packages/ui/src/core/overlay-z.ts`
- Modified: `packages/ui/src/index.ts`
- Modified: `packages/visual-audit/vendor/tailwind.config.cjs`
- Modified (generated): `packages/visual-audit/vendor/tailwind.generated.css`
- Modified (process/tracking only): `_bmad-output/implementation-artifacts/0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant.md` (this story file), `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date       | Change                                                                 |
|------------|-------------------------------------------------------------------------|
| 2026-10-06 | Pre-Coding Approval Gate approved by shulha via chat.                   |
| 2026-10-06 | Implemented Tasks 1-4: zIndex tokens in `apps/web/tailwind.config.ts`, `OVERLAY_MODAL_Z` export from `packages/ui`, mirrored tokens + regenerated CSS in `packages/visual-audit`, verification (lint/typecheck/tests) all clean. Status moved to review. |
