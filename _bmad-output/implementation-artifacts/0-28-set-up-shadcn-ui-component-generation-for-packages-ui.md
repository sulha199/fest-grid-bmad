---
baseline_commit: 5bab47f5400eafc3494565d0805d38033e7aac6a
---

# Story 0.28: Set up shadcn/ui component generation for packages/ui

## Story Details

- **Epic:** 0 - Foundational Infrastructure
- **Story ID:** 0.28
- **Status:** ready-for-dev

## Story

**As a** developer,
**I want** `packages/ui` to have its own shadcn/ui `components.json` and the underlying Radix/date-picker dependencies it needs (`@radix-ui/react-popover`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `react-day-picker`),
**So that** reusable `packages/ui` components (Story 1.3g's `WeekPicker`, Story 1.5's `FilterHub` dropdown popovers) can be built on the shadcn-sanctioned `Button`+`Popover`(+`Calendar`) composition without either duplicating `apps/web`'s own shadcn setup ad hoc or, worse, having `packages/ui` import from `apps/web` (the wrong dependency direction — `packages/ui` is a dependency of `apps/web`, never the reverse).

## Acceptance Criteria

1. **Given** `apps/web/components.json` already configures shadcn CLI output into `apps/web/src/components/ui/` (with a `@/lib/utils` → `cn()` helper and a `@/*` → `./src/*` tsconfig path alias it relies on), and `packages/ui` currently has zero shadcn/Radix components, no `components.json`, no `cn()` utility, no `@/*` path alias, and no `@radix-ui/*`/`clsx`/`tailwind-merge`/`class-variance-authority` dependency — while `apps/web/tailwind.config.ts` already scans `packages/ui/src/**/*.{ts,tsx}` for Tailwind classes, so no separate Tailwind config is needed inside `packages/ui` itself,
2. **When** this story adds a `@/*` → `./src/*` path alias to `packages/ui/tsconfig.json` (mirroring `apps/web`'s exact convention) and creates `packages/ui/src/lib/utils.ts` with the same `cn()` helper (`clsx` + `tailwind-merge`) as `apps/web/src/lib/utils.ts`, then adds a new `packages/ui/components.json` targeting `packages/ui/src/core/ui/` as its primitive-output directory (matching `apps/web`'s convention of a dedicated `ui/` subfolder for CLI-generated files, separate from `packages/ui`'s existing hand-authored `core/` components) with `aliases.utils` pointing at `@/lib/utils`,
3. **Then** `packages/ui/src/core/ui/button.tsx`, `popover.tsx`, and `calendar.tsx` are generated via `pnpm --filter @festgrid/ui exec shadcn add button popover calendar` (all three, since AD-9's composition is `Button` (trigger) + `Popover` + `Calendar` — not just the latter two), and `packages/ui/package.json` gains the CLI's resulting dependencies as **direct** dependencies (not devDependencies, since `packages/ui` ships un-bundled — see AC4): `@radix-ui/react-popover`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `react-day-picker`, and whatever date-utility dependency the `calendar` component's generated code actually imports (commonly `date-fns` — confirm against the real CLI output, do not assume a version ahead of time).
4. **And**, since `packages/ui` has **no separate build/bundle step** (`package.json`'s `main`/`types` point directly at `src/index.ts`; it ships as raw TypeScript source, transpiled by `apps/web`'s own Next.js/Turbopack build — confirmed via `packages/ui/package.json` and the absence of any `tsup`/`rollup`/bundler config anywhere in `packages/ui/`), there is no build-config include/exclude pattern to update for the new files — this AC exists to document that fact, not to change a build config that doesn't exist.
5. **And** `packages/ui`'s existing hand-rolled `core/` primitives (`checkbox.tsx`, `multi-select.tsx`, `blocking-loader.tsx`, `map.tsx`, `route-loader.tsx`, `soft-delete-toaster.tsx`, `status-badge.tsx`, `swipe-to-reveal.tsx`, `app-shell/`, `wizard/`) are left untouched — this story only adds the new CLI-generated `core/ui/` subfolder and the new `lib/utils.ts` alongside them, it does not migrate/replace any existing component to use the new primitives.
6. **And** `pnpm --filter @festgrid/ui test` and `pnpm --filter web build` (the actual consumer, since `packages/ui` has no build of its own) both pass with the new dependencies and files added.
7. **And** this story ships no consumer of the new primitives itself — Story 1.3g's `WeekPicker.tsx` and Story 1.5's `FilterHub` popover redesign are its first two consumers, built in their own stories.

**Note (2026-08-15, added via `bmad-create-story` while reopening Story 1.3g for AC13):** `festgrid-architecture-spine.md`'s AD-9 (Date/Week Selection UI Convention) mandates `packages/ui/src/core/WeekPicker.tsx` wrapping shadcn `Button`+`Popover`+`Calendar`, but no shadcn/Radix setup, `cn()` utility, or `@/*` path alias exists anywhere in `packages/ui` — only `apps/web` has these, and `packages/ui` cannot depend on `apps/web` (wrong dependency direction). The same gap independently blocks Story 1.5's FilterHub popover redesign (`sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md` Section 4.1), so this is a tooling/infrastructure gap needed by ≥2 stories, not a single-story concern — split into this new Epic 0 story per `story-split-gate.md`'s numbering rule (tooling gap → new Epic 0 whole number) rather than absorbed into either 1.3g or 1.5. User confirmed via `AskUserQuestion` during Story 1.3g's reopening.

**Depends on:** None.
**Blocks:** Story 1.3g (Tasks 13-14, `WeekPicker.tsx`), Story 1.5 (FilterHub popover redesign).

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2) — Add the `@/*` path alias to `packages/ui`:**
  - Add `"paths": { "@/*": ["./src/*"] }` to `packages/ui/tsconfig.json`'s `compilerOptions`, mirroring `apps/web/tsconfig.json`'s exact convention (`packages/ui/tsconfig.json` currently extends `@festgrid/typescript-config/react-library.json` with no `paths` override — confirmed via reading the file directly).
  - Verify `packages/ui/vitest.config.ts` resolves the new alias too (check for an existing `resolve.alias` block; add `'@': path.resolve(__dirname, './src')` if none exists, matching whatever pattern `apps/web`'s own Vitest/Next config uses for `@/`).
- [ ] **Task 2 (AC2) — Create the `cn()` utility:**
  - Create `packages/ui/src/lib/utils.ts`, copying `apps/web/src/lib/utils.ts`'s exact implementation (`clsx` + `tailwind-merge`, re-exported as `cn`).
  - Do not create a `packages/ui/src/lib/index.ts` barrel unless one is already the established pattern elsewhere in `packages/ui` — check `packages/ui/src/index.ts`'s existing export style first and match it.
- [ ] **Task 3 (AC2) — Create `packages/ui/components.json`:**
  - Model directly on `apps/web/components.json` (`style: "default"`, `tsx: true`, `iconLibrary: "lucide"` — `packages/ui` already depends on `lucide-react`), with these differences: no `tailwind` block is meaningful here (no local Tailwind config/CSS file exists in `packages/ui` — `apps/web`'s own `tailwind.config.ts` already scans `packages/ui/src/**/*.{ts,tsx}`, confirmed via that file's `content` array), so either omit the `tailwind` block or point its `config`/`css` fields at `apps/web`'s files if the CLI requires them to resolve at all (test this — if the CLI errors without a resolvable Tailwind config, point at `../../apps/web/tailwind.config.ts` and `../../apps/web/src/app/globals.css` relatively; do not create a duplicate Tailwind config).
  - Set `aliases.ui` → `@/core/ui`, `aliases.utils` → `@/lib/utils`, `aliases.components` → `@/core` (adjust exact alias names to whatever the CLI accepts, but the resolved paths must land generated primitives in `packages/ui/src/core/ui/` and resolve `cn` from `packages/ui/src/lib/utils.ts`).
  - `rsc: false` — `packages/ui` is a plain React library, not a Next.js App Router project itself (unlike `apps/web`); do not copy `apps/web`'s `rsc: true` verbatim without considering this.
- [ ] **Task 4 (AC3) — Run the shadcn CLI:**
  - `pnpm --filter @festgrid/ui exec shadcn add button popover calendar` (all three components — AD-9's composition explicitly names `Button` (trigger) + `Popover` + `Calendar`, not just the latter two).
  - Confirm the CLI writes to `packages/ui/src/core/ui/button.tsx`, `popover.tsx`, `calendar.tsx` (per Task 3's alias config) and reports the new dependencies it wants to install — let the CLI manage `packages/ui/package.json`'s dependency additions directly rather than hand-editing versions.
- [ ] **Task 5 (AC3) — Move CLI-added dependencies to `dependencies`, not `devDependencies`:**
  - The shadcn CLI may add new packages to whichever dependency section `packages/ui/package.json` defaults to (often `dependencies` already, but verify). Since `packages/ui` ships raw source consumed directly by `apps/web`'s build (AC4 — no separate bundling step of its own), every one of `@radix-ui/react-popover`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `react-day-picker`, and any calendar date-utility dependency **must** end up in `dependencies`, matching the existing pattern for `lucide-react`/`maplibre-gl`/`sonner` in the same file — not `devDependencies`, which would silently break `apps/web`'s build in a real install (devDependencies aren't guaranteed present in `apps/web`'s own resolution).
- [ ] **Task 6 (AC5) — Verify no existing `packages/ui` component was touched:**
  - `git diff --stat` after Tasks 1-5 should show only new files (`components.json`, `src/lib/utils.ts`, `src/core/ui/button.tsx`/`popover.tsx`/`calendar.tsx`) plus `tsconfig.json`, `vitest.config.ts`, and `package.json` modifications — no existing `core/`/`features/`/`hooks/` file's content should change.
- [ ] **Task 7 (AC6) — Full verification:**
  - `pnpm --filter @festgrid/ui test` — existing suite must still pass unmodified (this story adds no new test files of its own; the new primitives have no consumer yet to test against).
  - `pnpm --filter web build` — confirms `apps/web`'s Next.js build still transpiles `packages/ui` successfully with the new Radix/date-picker dependencies and the new `@/*` alias resolving correctly inside `packages/ui`'s own source (Next.js/Turbopack resolves each workspace package's own `tsconfig.json` when compiling it).
  - `pnpm --filter web lint` / `pnpm --filter @festgrid/ui` type-check — zero new errors.

## Dev Notes

### Architecture & UX Gate Findings

`epic-0-readiness.md` is `swept: true` but predates this story (`date: 2026-08-03`; this story was created 2026-08-15) — its `stories_covered` list does not include 0.28. Per the lightweight-guard instruction, reasoned fresh rather than assuming the sweep covers it:

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** This story is itself the correct, minimal resolution of a Gate 3 finding surfaced during Story 1.3g's reopening (see below) — there is no further architecture/infra gap to find; it adds no backend surface, no database access, no external service call, purely frontend build tooling and dependency setup.
- **Gate 2 (UI Complexity & Reusability) — Not applicable.** This story ships zero UI of its own (AC7) — the generated `button.tsx`/`popover.tsx`/`calendar.tsx` are shadcn's own standard primitives, and `WeekPicker.tsx`/`FilterHub`'s popover redesign (their actual UI) are built in Stories 1.3g/1.5, not here. No subagent pass was warranted for a story with no UI surface.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — This story IS the resolution of a Gate 3 finding**, not a source of a new one. Surfaced during Story 1.3g's reopening (2026-08-15): `packages/ui` needed a shadcn/Radix setup that AD-9 assumes exists but that was never actually established anywhere, and the gap was shared by ≥2 stories (1.3g, 1.5) rather than being either story's own concern — split out per `story-split-gate.md`'s numbering rule, confirmed via `AskUserQuestion`. See Story 1.3g's own Dev Notes → Architecture & UX Gate Findings for the original finding.

### Current State (read before starting)

- `packages/ui/package.json`: `main`/`types` point at `src/index.ts` directly — confirmed no separate build step (no `tsup.config.*`, `rollup.config.*`, or any bundler config found anywhere under `packages/ui/`). Current `dependencies`: `@festgrid/domain`, `@festgrid/shared-types`, `lucide-react`, `maplibre-gl`, `react`, `react-dom`, `sonner`. `peerDependencies`: `nuqs`. No `@radix-ui/*`, `clsx`, `tailwind-merge`, or `class-variance-authority` present anywhere in this file today.
- `packages/ui/tsconfig.json`: extends `@festgrid/typescript-config/react-library.json` (which itself only sets `jsx: "react-jsx"` on top of a shared `base.json` — no path aliases anywhere in the chain). No `@/*` alias exists; every current `packages/ui` import uses relative paths (e.g. `WeeklyCalendarView.tsx`'s `import { useScopedLocale, useScopedTimezone } from '../../hooks'`).
- `apps/web/components.json` (the pattern to mirror): `style: "default"`, `rsc: true`, `tsx: true`, `tailwind: { config: "tailwind.config.ts", css: "src/app/globals.css", baseColor: "slate", cssVariables: true, prefix: "" }`, `aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" }`, `iconLibrary: "lucide"`.
- `apps/web/src/lib/utils.ts` (the exact `cn()` to replicate): `clsx` + `tailwind-merge`, ~4 lines — read it directly before writing `packages/ui/src/lib/utils.ts`, do not reconstruct from memory.
- `apps/web/tailwind.config.ts`'s `content` array already includes `'../../packages/ui/src/**/*.{ts,tsx}'` — confirmed via direct read. This is why Task 3 does not need to create a `packages/ui`-local Tailwind config: any Tailwind class string written inside `packages/ui/src/core/ui/*.tsx` is already picked up by `apps/web`'s single global Tailwind build, exactly like every other existing `packages/ui` component's Tailwind classes already are.
- `apps/web/src/components/ui/button.tsx` exists already (shadcn `button`, `cva`-based, `@radix-ui/react-slot` for `asChild`) — useful as a reference for what the generated `packages/ui/src/core/ui/button.tsx` should look like structurally, though it will be a separate, independently-generated copy, not a shared import (two packages, two copies — this is the accepted tradeoff of AD-9's placement decision, confirmed with the user during Story 1.3g's reopening).

### Data Type Compatibility & Migration Requirements

**No changes required.** This story adds no database, GraphQL, or TypeScript-type contract changes — purely build tooling, a new utility function, and new UI primitive files with no consumer yet.

### Package boundaries

- `packages/ui/`: new `components.json`, `src/lib/utils.ts`, `src/core/ui/button.tsx`, `popover.tsx`, `calendar.tsx`. Modified: `package.json` (new dependencies), `tsconfig.json` (new `@/*` alias), `vitest.config.ts` (alias resolution, if needed).
- No other package touched — `apps/web`, `apps/backend`, `packages/domain`, `packages/database` are all out of scope; `apps/web`'s own `components.json`/`components/ui/` are read as a reference pattern only, never modified.

### Project Structure Notes

- New: `packages/ui/components.json`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/core/ui/button.tsx`, `packages/ui/src/core/ui/popover.tsx`, `packages/ui/src/core/ui/calendar.tsx`.
- Modified: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts` (only if alias resolution requires it).
- Not modified: anything under `apps/web/**`, `apps/backend/**`, `packages/domain/**`, `packages/database/**`, or any existing `packages/ui/src/{core,features,hooks}/*` file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.28`] — authoritative AC text.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` AD-9] — the requirement this story exists to unblock.
- [Source: `_bmad-output/implementation-artifacts/1-3g-build-the-reusable-weeklycalendarview-component.md`] — Tasks 13-14, this story's immediate downstream consumer.
- [Source: `apps/web/components.json`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/button.tsx`, `apps/web/tailwind.config.ts`] — the exact patterns mirrored/reused by this story.
- [Source: `packages/ui/package.json`, `packages/ui/tsconfig.json`] — current state, read in full before making changes.

## Global Rules References

- `_bmad-output/project-context.md` (Technology Stack — Shadcn/ui, Shared Linting & TypeScript Base Configurations; UI Components & Scalability — `packages/ui/src/core/` placement for domain-agnostic primitives).
- `_bmad-output/planning-artifacts/story-content-structure.md`.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-9 — the authoritative source this story implements the tooling prerequisite for).
- `_bmad-output/planning-artifacts/epics.md` (Story 0.28, Story 1.3g, Story 1.5).
- `_bmad-output/planning-artifacts/story-split-gate.md` (this story's own origin — a Gate 3 tooling-gap split).
- `docs/infrastructure/index.md` — not applicable; this story touches no backend/infra layer (frontend build tooling only).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `packages/ui/components.json`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/core/ui/button.tsx`, `packages/ui/src/core/ui/popover.tsx`, `packages/ui/src/core/ui/calendar.tsx`.
- Modified: `packages/ui/package.json` (new direct dependencies), `packages/ui/tsconfig.json` (new `@/*` path alias), `packages/ui/vitest.config.ts` (only if the new alias needs explicit Vitest resolver config).
- Not modified: any existing `packages/ui/src/{core,features,hooks}/*` file; anything under `apps/web/**`, `apps/backend/**`, `packages/domain/**`, `packages/database/**`.

### Rule Mapping

- *UI Components & Scalability* → new primitives land in `packages/ui/src/core/ui/` (domain-agnostic, CLI-generated), kept distinct from `packages/ui/src/core/`'s existing hand-authored primitives.
- *Shared Linting & TypeScript Base Configurations* → `packages/ui/tsconfig.json` still extends `@festgrid/typescript-config/react-library.json`; only a `paths` addition is layered on top, no divergence from the shared base.
- *Code Organization (Domain vs UI)* → not applicable (no `packages/domain` logic in this story).
- *AD-9 (Date/Week Selection UI Convention)* → this story is the direct tooling prerequisite AD-9's `WeekPicker.tsx` requirement depends on; no date-picker UI is built here, only the primitives it will be built from.

### Verification Plan

- `pnpm --filter @festgrid/ui test` — existing suite passes unmodified (Task 7).
- `pnpm --filter web build` — the real proof this story works end-to-end, since `packages/ui` has no build of its own; confirms Next.js/Turbopack resolves the new alias, dependencies, and generated files correctly when compiling `packages/ui` as part of `apps/web`'s build (Task 7).
- `pnpm --filter web lint` / type-check — zero new errors.
- `git diff --stat` confirms no existing `packages/ui` component file changed (Task 6).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: this story adds shadcn/Radix tooling to `packages/ui` only (`components.json`, `cn()` utility, `@/*` alias, three generated primitives: `button.tsx`/`popover.tsx`/`calendar.tsx`). It does **not** build `WeekPicker.tsx` (Story 1.3g), `FilterHub`'s popover redesign (Story 1.5), or touch any existing `packages/ui` component.
- [ ] Gate 1/2/3 prerequisites confirmed: this story is itself the resolution of a Gate 3 finding from Story 1.3g's reopening (Architecture & UX Gate Findings above) — no further gate gap applies to its own narrow scope.
- [ ] Architecture and boundary confirmation: `packages/ui` gains its own independent copy of shadcn primitives rather than importing from `apps/web` (correct dependency direction preserved); no Tailwind config duplicated (reuses `apps/web`'s existing content-scanning of `packages/ui/src/**`).
- [ ] Testing plan confirmed: `pnpm --filter @festgrid/ui test` and `pnpm --filter web build` both must pass (Task 7) — no new test files required since this story ships no consumer of the new primitives.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/ui`: no new test files required — this story's own scope has no logic to unit test (CLI-generated boilerplate primitives with no consumer yet). The existing `pnpm --filter @festgrid/ui test` suite must continue to pass unmodified.
- Integration: `pnpm --filter web build` is this story's real correctness check — proves the new dependencies, alias, and generated files compile cleanly as part of `apps/web`'s actual build.
- E2E: none — no UI is shipped by this story.

## Deliverables Checklist

- [ ] `packages/ui/tsconfig.json` has a `@/*` → `./src/*` path alias.
- [ ] `packages/ui/src/lib/utils.ts` exports `cn()`, matching `apps/web`'s implementation.
- [ ] `packages/ui/components.json` exists, correctly aliased to `packages/ui/src/core/ui/` and `packages/ui/src/lib/utils.ts`.
- [ ] `packages/ui/src/core/ui/button.tsx`, `popover.tsx`, `calendar.tsx` generated via the shadcn CLI.
- [ ] `packages/ui/package.json` has the new Radix/date-picker dependencies as direct `dependencies`, not `devDependencies`.
- [ ] No existing `packages/ui` component file changed.
- [ ] `pnpm --filter @festgrid/ui test` and `pnpm --filter web build` both pass.

## Out of Scope

- **`WeekPicker.tsx`** (Story 1.3g, Task 14) — consumes this story's output, not built here.
- **`FilterHub`'s popover redesign** (Story 1.5) — consumes this story's output, not built here.
- **Migrating any existing hand-rolled `packages/ui/src/core/` component** to use the new shadcn primitives — out of scope; existing components stay exactly as they are.
- **A `packages/ui`-local Tailwind config or CSS file** — not needed; `apps/web`'s existing Tailwind config already scans `packages/ui/src/**`.

## Definition of Done

- All 7 Acceptance Criteria satisfied.
- `pnpm --filter @festgrid/ui test` passing (existing suite, unmodified).
- `pnpm --filter web build` passing with the new dependencies/files in place.
- Lint and type checks passing for `packages/ui` and `apps/web`.
- No existing `packages/ui` component file changed (verified via `git diff --stat`).

## Completion Status

**Created 2026-08-15** — new story, split from Story 1.3g's reopening per a Gate 3 finding shared with Story 1.5. Not yet implemented.

## Dev Agent Record

### Completion Notes List

_To be filled by the dev agent._

### File List

_To be filled by the dev agent._

### Change Log

- **2026-08-15**: Story created via `bmad-create-story`, split out of Story 1.3g's reopening as a new Epic 0 prerequisite (Gate 3 finding, shared with Story 1.5, per `story-split-gate.md`'s tooling-gap numbering rule). User confirmed via `AskUserQuestion`.
