# Story 0.10: Set up testing frameworks foundation (Vitest, MSW, Playwright)

## Story Details

- Epic: 0
- Story ID: 0.10
- Status: ready-for-dev

## Story

As a developer,
I want to configure `Vitest`, `MSW` (Mock Service Worker), and `Playwright` in the monorepo,
so that all packages and applications have the necessary tools for the "testing trophy" approach.

## Acceptance Criteria

1. **Given** the monorepo is initialized (Story 0.1), **when** I run `pnpm test` from the repo root, **then** a shared testing configuration workspace package (`@festgrid/testing-config`) exists and is consumed by every workspace that runs Vitest, so setup code (test environment, globals, reporters) is not duplicated per package. [epics.md AC1]
2. `Vitest` runs unit/integration tests across all packages that currently have testable source code (`apps/web`, `packages/database`, `packages/analytics`) via a `test` script wired into `turbo run test`; `packages/domain` and `packages/ui` do not yet exist as workspaces (no `package.json` committed — see Dev Notes), so the Node-preset config is established generically in `@festgrid/testing-config` so those packages adopt it with zero extra setup once they're scaffolded by their owning stories. [epics.md AC2]
3. `MSW` is installed and configured (via `@festgrid/testing-config`'s Vitest setup file) to intercept and mock HTTP calls for integration tests — a working example handler + integration test proves the interception pipeline end-to-end. [epics.md AC3]
4. `Playwright` (`@playwright/test`) is installed and configured strictly in `apps/web` for running E2E tests against the Next.js app; it is **not** added to `@festgrid/testing-config` or any other shared/workspace package. [epics.md AC4]
5. `pnpm test` (root) and `pnpm lint` (root) both continue to pass after this story lands, and CI's existing `Run tests` step (`.github/workflows/ci.yml`, Story 0.5) now actually executes real test suites instead of being a no-op (today no package defines a `test` script matching turbo's `test` task, so `pnpm run test` in CI currently does nothing).
6. The pre-existing `packages/database/seed.integration.test.ts` (uses Node's built-in `node:test` runner via the `test:seed` script, requires a live `DATABASE_URL`) is left untouched and is explicitly **not** migrated to Vitest or wired into the root `test` task — it stays a separate, opt-in, live-DB integration check (see Dev Notes and Out of Scope).

## Tasks / Subtasks

- [ ] Task 1: Scaffold the `@festgrid/testing-config` shared package (AC: 1)
  - [ ] Create `packages/testing-config/package.json` mirroring the `@festgrid/eslint-config` pattern (`private: true`, subpath `exports`, `devDependencies` only — this package ships config, not runtime code).
  - [ ] Add subpath exports: `./vitest-node` (Node/domain-agnostic preset — no DOM), `./vitest-react` (jsdom environment + `@testing-library/react` + `@testing-library/jest-dom` + MSW server setup), and `./msw-handlers` (a base/example `http.get`/`http.post` handler array consumers extend).
  - [ ] Add `packages/testing-config/tsconfig.json` extending `@festgrid/typescript-config/base.json`.
  - [ ] Add `packages/testing-config/eslint.config.mjs` extending `@festgrid/eslint-config/base`.
- [ ] Task 2: Wire the Node/domain-agnostic Vitest preset (AC: 1, 2)
  - [ ] In `packages/testing-config/vitest-node.ts`, export a base `defineConfig`/`mergeConfig`-compatible object: `test.environment: "node"`, coverage provider `v8`, standard `include`/`exclude` globs.
  - [ ] Consuming packages create a **thin** `vitest.config.ts` that imports and re-exports/extends this preset (per Vitest 4's guidance: individual package configs should own their own small config next to their source and import shared pieces — the root config uses `test.projects`, not the deprecated `test.workspace`, to discover them).
  - [ ] Add a root `vitest.config.ts` at the repo root using `test.projects: ["apps/web", "packages/database", "packages/analytics"]` (glob-based) so a single `vitest run` from the root can execute every package's tests, in addition to each package's own `turbo run test`.
- [ ] Task 3: Wire the jsdom/React Vitest preset + Testing Library (AC: 1, 2, 3)
  - [ ] In `packages/testing-config/vitest-react.ts`, extend the Node preset with `test.environment: "jsdom"`, `test.setupFiles` pointing to a `vitest.setup.ts` that imports `@testing-library/jest-dom/vitest` matchers and starts/stops the MSW `setupServer` (`beforeAll`/`afterEach`/`afterAll` lifecycle hooks: `server.listen()`, `server.resetHandlers()`, `server.close()`).
  - [ ] Add `@testing-library/react` (`^16.3.x`, required for React 19 compatibility — see Latest Tech Information) and `@testing-library/jest-dom` as `devDependencies` of `packages/testing-config`.
- [ ] Task 4: Set up MSW (AC: 3)
  - [ ] Add `msw` (`^2.15.x`) as a `devDependency` of `packages/testing-config`.
  - [ ] Create `packages/testing-config/msw-handlers.ts` exporting an empty/example `handlers: HttpHandler[]` array using the v2 `http`/`HttpResponse` API (not the deprecated v1 `rest` API) that consumers spread/extend with their own handlers.
  - [ ] `setupServer(...handlers)` lives in the `vitest-react.ts` setup file (Node-only MSW integration — no Service Worker file needed for Vitest's Node/jsdom environment, per MSW's Node testing docs).
- [ ] Task 5: Wire `apps/web`, `packages/database`, `packages/analytics` to the shared config (AC: 2, 5)
  - [ ] `apps/web/package.json`: add `"test": "vitest run"` script; add `vitest`, `jsdom`, and `@festgrid/testing-config` (`workspace:*`) as `devDependencies`; add `apps/web/vitest.config.ts` importing `@festgrid/testing-config/vitest-react`.
  - [ ] `packages/database/package.json`: add `"test": "vitest run"` script (distinct from the existing `test:seed` — see AC6/Dev Notes); add `vitest` + `@festgrid/testing-config` (`workspace:*`) as `devDependencies`; add `packages/database/vitest.config.ts` importing `@festgrid/testing-config/vitest-node` (no DOM needed — pure Node/Drizzle logic).
  - [ ] `packages/analytics/package.json`: add `"test": "vitest run"` script; add `vitest`, `jsdom`, `@festgrid/testing-config` (`workspace:*`) as `devDependencies`; add `packages/analytics/vitest.config.ts` importing `@festgrid/testing-config/vitest-react` (it exports a `"use client"` React provider, so jsdom is appropriate).
  - [ ] Confirm `turbo.json`'s existing `test` task (`dependsOn: ["^build"]`) picks up the three new `test` scripts automatically — no `turbo.json` changes needed since the task is already defined generically.
- [ ] Task 6: Write one proof-of-pipeline test per wired package (AC: 1, 2, 3, 5)
  - [ ] `apps/web`: a unit test for the pure `cn()` utility (`apps/web/src/lib/utils.ts`) using the Node preset's assertions, **plus** one integration test (jsdom + MSW) that mounts a minimal component and asserts an MSW-mocked `fetch`/`http` call resolves as expected — this is the concrete proof AC3 requires.
  - [ ] `packages/database`: a small pure-function unit test (e.g. a slug/id helper already exported from `schema.ts`/`seed.ts` — do not write a new live-DB test; that pattern is already covered by `seed.integration.test.ts`, which is explicitly out of scope per AC6).
  - [ ] `packages/analytics`: a unit test for a pure exported helper (e.g. from `env.ts`) — do not attempt to unit-test `posthog-js` initialization itself (external SDK, no add-on value here).
- [ ] Task 7: Set up Playwright in `apps/web` only (AC: 4)
  - [ ] Add `@playwright/test` (`^1.62.x`) as a `devDependency` of `apps/web` **only** — never `packages/testing-config` or any shared package (per project-context.md's strict package-isolation rule: Playwright must stay in `apps/web`).
  - [ ] Create `apps/web/playwright.config.ts` (`testDir: "./e2e"`, `webServer` block that runs `pnpm dev`/`pnpm build && pnpm start` against a local port, per Playwright's Next.js guidance).
  - [ ] Add `apps/web/package.json` script `"test:e2e": "playwright test"` (kept separate from `"test"`/Vitest per the testing-trophy split — E2E is a distinct, slower lane, not run by the default `turbo run test`).
  - [ ] Write one smoke E2E test (`apps/web/e2e/home.spec.ts`) that loads `/` and asserts the page renders (e.g. the "FestGrid Design System Verification" heading is visible) — proves the Playwright pipeline works end-to-end without depending on any not-yet-built feature.
- [ ] Task 8: CI verification (AC: 5)
  - [ ] Confirm `.github/workflows/ci.yml`'s existing `Run tests` step (`pnpm run test`) now executes the new Vitest suites via `turbo run test` — no CI YAML changes should be needed since the step already exists (Story 0.5); only the underlying package `test` scripts were missing before this story.
  - [ ] Do **not** add `test:e2e`/Playwright to the CI `ci` job in this story — Playwright's browser-install and `webServer` boot requirements are a heavier, separate CI concern; note this explicitly under Out of Scope rather than silently expanding CI scope.
- [ ] Task 9: Documentation (AC: 1)
  - [ ] Add `packages/testing-config/README.md` explaining the three exports (`vitest-node`, `vitest-react`, `msw-handlers`), when each package should import which, and the Testing Philosophy split from `project-context.md` (Vitest+MSW = testing-trophy integration layer; Playwright = critical-path E2E only; `packages/domain`'s future 100%-unit-coverage rule uses `vitest-node`).

## Dev Notes

- **This story is pure dev-tooling/workspace-config — no product UI, no backend compute, no cloud infra.** Confirmed via `docs/infrastructure/index.md` and all four shard files (`1-frontend.md`, `2-backend.md`, `3-database.md`, `4-push-notifications.md`) — grepped for "test"/"Vitest"/"Playwright"/"MSW", zero matches. No infra shard read beyond the index was needed; this mirrors Story 0.9's precedent for frontend-only/tooling-only stories.
- **Current repo state (read in full before writing this story) — three packages named in the epics.md AC do not exist yet:**
  - `packages/domain` and `packages/ui` have **no `package.json` committed to git** (`git ls-files packages/domain packages/ui` returns nothing — only stray, gitignored `node_modules/` leftovers exist locally from dependency installs, not real workspace packages). Despite Story 0.3 ("Set up Shadcn/UI") being marked `done`, Shadcn components currently live in `apps/web/src/components/ui/` (`button.tsx`, `card.tsx`, `dialog.tsx`), not `packages/ui` — this is the same pre-existing variance flagged in Stories 0.7 and 0.9's Dev Notes, not something this story should silently "fix" by inventing a `packages/ui` scaffold as a side effect.
  - `apps/backend` similarly has **no `package.json` committed** — the `dist/`/`node_modules/` present locally are untracked, gitignored build leftovers (confirmed via `git status`/`git ls-files`), not the real output of Story 0.8 (still `ready-for-dev`, not `done`). Do not treat these local files as evidence that a backend workspace exists.
  - **Implication for this story:** AC2's "packages/domain, packages/ui, etc." wording from `epics.md` names packages that are aspirational (owned by other, not-yet-done stories: 0.7/1.3b/1.6a for `packages/ui`, future domain-logic stories for `packages/domain`, 0.8 for `apps/backend`). This story's job is to build the **generic, reusable preset** (`@festgrid/testing-config`) so that whichever story creates those packages next can adopt Vitest with a two-line `vitest.config.ts`, not to scaffold empty `package.json` files for packages that don't have any source yet. Wiring the actual `test` script only happens for the three packages that exist today with real, testable code: `apps/web`, `packages/database`, `packages/analytics`.
- **Existing `packages/database/seed.integration.test.ts` uses Node's built-in `node:test` runner (`import { test } from 'node:test'`), invoked via the `test:seed` script — not `test`.** It requires a live `DATABASE_URL` Postgres connection and is a genuine live-DB integration check (seed determinism/idempotency), fundamentally different in kind from the MSW-mocked HTTP integration tests this story sets up. It is **not** currently wired into the root `pnpm test` → `turbo run test` task (confirmed: `turbo.json`'s `test` task only runs against packages with a `test` script; `database`'s script is named `test:seed`, so it's already excluded from CI's `Run tests` step today). This story must not rename/merge `test:seed` into `test` or migrate it to Vitest — doing so would make every CI run require a live database, breaking CI. Leave `test:seed` exactly as-is; `packages/database`'s new `test` script (Task 5/6) is a separate, additive Vitest suite for pure-function unit tests only.
- **Root `pnpm test` is currently a no-op.** `package.json`'s `"test": "turbo run test"` and `turbo.json`'s `test` task exist (from Story 0.5's CI setup), but *zero* workspace package currently defines a `test` script, so `turbo run test` finds nothing to run and CI's "Run tests" step has been silently passing on an empty task list. This story is what makes that step meaningful for the first time — worth calling out explicitly since it's not visible from reading `ci.yml` alone.
- **Vitest workspace-discovery note (current as of this story's creation):** Vitest deprecated the standalone `vitest.workspace.ts` file and the `test.workspace` config key starting in 3.2, in favor of `test.projects` directly in the root config (functionally equivalent; the standalone workspace file no longer accepts a JS/TS file exporting an array). Since the project pins Vitest `^4.1.x` (see Latest Tech Information), use `test.projects` — do not create a `vitest.workspace.ts` file, which is on a deprecation path to removal.
- **Package isolation (project-context.md rule, `_bmad/custom/bmad-create-story.toml` persistent fact):** Vitest and MSW live in the shared `@festgrid/testing-config` package; **Playwright must stay in `apps/web` only** and must never be added to `@festgrid/testing-config` or any other shared workspace package. This is an explicit, mandated split — do not simplify by putting all three tools in one shared package.
- **No reusable `packages/ui` component or `packages/domain` business logic is introduced by this story** — it is exclusively dev-tooling/config. Gate 2 finding below confirms zero UI surface.
- **No cloud/external service is introduced** — MSW mocks HTTP at the Node/test-runtime level; it never talks to a real external service. No `SETUP_WALKTHROUGH.md` update required.
- **No PostHog events or i18n strings are introduced** — no AD-5 event taxonomy additions, no AD-6 locale keys required.
- **No state-management or async-loader categorization applies** — this story adds no application state or data-fetching UI of its own (project-context.md's State Management / Loader rules govern feature code, not test tooling).
- Git history check: the 5 most recent commits (`e301498`, `1688b46`, `ff14fa0`, `87edeee`, `4375dd8`) are all BMad skill/planning changes, not application code — no relevant frontend/backend code patterns to extract from recent commits beyond what was already read directly from `package.json` files, `turbo.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, and `packages/database/seed.integration.test.ts`.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` (`swept: true`, `stories_covered` explicitly includes `0.10`). No gap applicable to this story. The report's two findings (missing outbound-email adapter → Story 0.15, missing Geolocation adapter+cache → Story 0.16) are unrelated to testing-framework setup.
- **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep — creating a shared dev-tooling config package (`@festgrid/testing-config`) and wiring `vitest`/`msw`/`@playwright/test` as `devDependencies` introduces no new external service, no new data entity, and no new infra dependency the epic-wide sweep wouldn't have anticipated (this is exactly the kind of foundational tooling story Epic 0 exists for, and `epic-0-readiness.md` explicitly confirms Story 0.10 already has an "unambiguous Epic 0 story" for the shared testing-config package — no gap). No fresh Gate 1/3 subagent run needed.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya/UX-designer-persona subagent (required per-story even when the epic sweep is used). Verdict: **No gap found.** The subagent grepped all four authoritative UX artifacts (`design-artifacts/UX-festgrid-run-1/DESIGN.md`, `EXPERIENCE.md`, `design-artifacts/UX-wizard-page-run-1/DESIGN.md`, `EXPERIENCE.md`) for test/vitest/playwright/msw/render-wrapper/provider-wrap terminology and found zero matches — they contain only product UX/visual specs. This story's deliverables (a workspace config package, Vitest presets, MSW handlers, Playwright setup) are pure dev-infrastructure with no product-facing component, hook, or reusable React test-utility implied. None of Gate 2's three triggers (reusable component, complex shared hook, unreflected visual/interaction spec) apply.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or TypeScript data-model changes. It adds dev/test tooling and configuration only.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required. (Test files/configs are strictly typed per the existing `@festgrid/typescript-config` base, but no product data model is touched.)
- Backward compatibility and rollout notes: N/A — no persisted data or API contract is touched. The one behavior change with external visibility is that CI's "Run tests" step (`ci.yml`) will now actually execute test suites where it previously ran zero tests; this is the intended fix (AC5), not a regression, but the dev agent should flag it clearly in the PR description since it may surface latent issues in `apps/web`/`packages/database`/`packages/analytics` code that were never actually exercised by CI before.
- Verification checks: `pnpm build`/`pnpm lint`/`pnpm test` all pass at the repo root; `pnpm --filter web test:e2e` passes locally (Playwright, not run in CI per Task 8).

### Project Structure Notes

- Alignment with unified project structure: New shared package lives at `packages/testing-config/`, following the exact sibling pattern of `packages/eslint-config/` and `packages/typescript-config/` (subpath `exports`, `private: true`, devDependencies-only). Per-package `vitest.config.ts` files are co-located with each consuming package's own `package.json`/`tsconfig.json`, per Vitest 4's monorepo guidance (small local config importing a shared preset, not one monolithic root config owning everything).
- Detected conflicts or variances: `packages/domain` and `packages/ui` referenced by `epics.md`'s Story 0.10 AC text do not exist as real workspaces yet (no committed `package.json`) — this story does not create them; it only ensures the shared preset they'll need is ready. `apps/backend` likewise has no committed `package.json`; any local `dist/`/`node_modules/` content found there is untracked/gitignored and must not be treated as real Story 0.8 output. `packages/database/seed.integration.test.ts` uses `node:test`, not Vitest, and is intentionally left as a separate, non-CI-wired `test:seed` script (see Dev Notes/AC6/Out of Scope) — this is a deliberate, documented variance, not an oversight to "fix."

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.10] — story AC source.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, swept:true, covers 0.10.
- [Source: _bmad-output/project-context.md#Testing Rules] — testing-trophy philosophy, Vitest/msw/Playwright roles, `packages/domain` 100%-coverage rule (future, once that package exists).
- [Source: _bmad-output/project-context.md#Development Workflow Rules] — PR-template checklist precedent (not directly required by this story, but the same rigor standard).
- [Source: _bmad/custom/bmad-create-story.toml] — strict package-dependency-isolation persistent fact: Vitest/MSW in shared `@festgrid/testing-config`, Playwright strictly in `apps/web`.
- [Source: docs/infrastructure/index.md] — confirms no infra shard content relevant to testing tooling.
- [Source: package.json, turbo.json] — confirms root `test` script/task exist but are currently a no-op (no package defines a matching `test` script yet).
- [Source: .github/workflows/ci.yml] — confirms CI's `Run tests` step already calls `pnpm run test`; no CI YAML change needed, only underlying package scripts.
- [Source: pnpm-workspace.yaml] — confirms `apps/*`/`packages/*` glob covers the new `packages/testing-config` workspace automatically.
- [Source: packages/eslint-config/package.json, packages/typescript-config/package.json] — shared-config package pattern (`exports`, `private`, devDependencies-only) mirrored for `@festgrid/testing-config`.
- [Source: packages/database/seed.integration.test.ts, packages/database/package.json] — existing `node:test`-based `test:seed` script; confirms it requires live `DATABASE_URL` and is excluded from the root `test` task by naming today; this story preserves that exclusion deliberately.
- [Source: apps/web/src/lib/utils.ts, apps/web/src/app/page.tsx] — identified `cn()` as the simplest pure-function unit-test target and the current home page as the Playwright smoke-test target (mirrors Story 0.6's "migrate one string to prove the pipeline" precedent).
- [Source: apps/web/package.json, packages/analytics/package.json] — confirms current dependency baselines (React 19, Next 15.1.3, no existing test deps) the new tooling must be compatible with.
- [Source: _bmad-output/implementation-artifacts/0-9-set-up-state-management-foundation.md] — precedent for Gate-sourcing format, manual-testing-fallback framing, and story-file structure; also the direct source of the "Story 0.10 still backlog" cross-references this story now resolves.
- [Web research, 2026-07-31: npm] `vitest` latest stable `4.1.x` (workspace/`test.workspace` deprecated since 3.2 in favor of `test.projects`), `msw` latest `2.15.x` (Node 18+ required, v2 `http`/`HttpResponse` API), `@playwright/test` latest `1.62.x`, `@testing-library/react` `^16.3.x` required for React 19 compatibility (14.x only supports React 18 types).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Testing Rules (testing-trophy philosophy, Vitest/MSW/Playwright roles), Development Workflow Rules, package-isolation intent.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated AD for testing exists (confirmed via grep); testing conventions are governed entirely by `project-context.md`.
- [ ] `docs/infrastructure/index.md` — confirms no infra changes; testing tooling is not part of the infrastructure architecture.
- [ ] `_bmad/custom/bmad-create-story.toml` — strict package-dependency-isolation rule (Vitest/MSW shared, Playwright `apps/web`-only).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/testing-config/package.json`, `tsconfig.json`, `eslint.config.mjs`, `README.md`, `vitest-node.ts`, `vitest-react.ts`, `vitest.setup.ts`, `msw-handlers.ts`.
  - New: `vitest.config.ts` (repo root, `test.projects`).
  - New: `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/web/e2e/home.spec.ts`, at least one unit test for `cn()` and one MSW-backed integration test.
  - New: `packages/database/vitest.config.ts` + one pure-function unit test.
  - New: `packages/analytics/vitest.config.ts` + one pure-function unit test.
  - Modified: `apps/web/package.json` (add `test`, `test:e2e` scripts + `vitest`/`jsdom`/`@playwright/test`/`@festgrid/testing-config` deps), `packages/database/package.json` (add `test` script + `vitest`/`@festgrid/testing-config` deps — `test:seed` untouched), `packages/analytics/package.json` (add `test` script + `vitest`/`jsdom`/`@festgrid/testing-config` deps).
  - Not modified: `turbo.json` (existing `test` task already generic enough), `.github/workflows/ci.yml` (existing `Run tests` step already calls `pnpm run test`), `packages/database/seed.integration.test.ts` (left as-is per AC6).
- **Rule Mapping:**
  - Shared Vitest/MSW config, Playwright `apps/web`-only isolation → `_bmad/custom/bmad-create-story.toml` persistent fact + project-context.md Testing Rules.
  - Testing-trophy prioritization (integration > unit, E2E for critical paths only) → project-context.md Testing Philosophy.
  - `packages/domain`/`packages/ui` not scaffolded here, preset made generic instead → Dev Notes' documented variance analysis (these packages don't exist yet; owned by other stories).
  - `test:seed` left untouched, not merged into `test` → AC6 + Dev Notes (CI must not require a live DB).
  - Shared-config-package structural pattern (`exports`, `private`, devDependencies-only) → mirrors `packages/eslint-config`/`packages/typescript-config` precedent.
- **Verification Plan:**
  - `pnpm install` at repo root resolves the new `@festgrid/testing-config` workspace and all new devDependencies without conflicts.
  - `pnpm build` (root, via turbo) still succeeds — `packages/testing-config` needs no `build` step (config-only), or a no-op passthrough if turbo requires one for its `dependsOn: ["^build"]` chain.
  - `pnpm lint` passes for all touched packages.
  - `pnpm test` (root, via `turbo run test`) now executes real Vitest suites in `apps/web`, `packages/database`, `packages/analytics` and passes.
  - `pnpm --filter database run test:seed` (manual, requires local `DATABASE_URL`) still works unchanged — confirms no regression to the pre-existing live-DB integration test.
  - `pnpm --filter web test:e2e` (manual/local) runs the Playwright smoke test against a locally built/served `apps/web` and passes.
  - `pnpm-lock.yaml` diff confirms `@playwright/test` appears only under the `web` workspace entry, and `vitest`/`msw`/testing-library packages appear only under `testing-config`, `web`, `database`, and `analytics` — never under any other package.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build `@festgrid/testing-config` (Vitest Node + React/jsdom + MSW presets) and wire `test` scripts into `apps/web`, `packages/database`, `packages/analytics`; set up Playwright strictly in `apps/web`; leave `packages/database`'s existing `test:seed` (live-DB, `node:test`) untouched; do not scaffold `packages/domain`/`packages/ui`/`apps/backend` (they don't exist yet).
- [ ] Architecture and boundary confirmation: `vitest`/`msw` devDependencies isolated to `@festgrid/testing-config` and its consumers; `@playwright/test` isolated to `apps/web` only, never added to any shared package.
- [ ] Testing plan confirmation: one proof-of-pipeline unit test per wired package (Task 6), one MSW-backed integration test (`apps/web`), one Playwright smoke E2E test (`apps/web/e2e/home.spec.ts`) — per Testing Requirements below.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (no gap, `0.10` explicitly covered); Gate 2 run fresh (no gap found).

## Testing Requirements

- [ ] Unit tests: `cn()` (`apps/web`), a pure-function helper in `packages/database`, and a pure-function helper in `packages/analytics` — each run through the `vitest-node`/`vitest-react` preset as appropriate, proving the shared config works across differently-shaped packages.
- [ ] Integration tests: one MSW-backed test in `apps/web` proving a mocked HTTP call is intercepted and resolved as configured — the concrete AC3 proof.
- [ ] E2E tests: one Playwright smoke test (`apps/web/e2e/home.spec.ts`) loading `/` and asserting the page renders — proves the E2E pipeline works end-to-end without depending on any unbuilt feature. Not run in CI yet (Task 8) — local/manual only until a future story adds Playwright to CI.
- [ ] Manual verification: `pnpm test` at the repo root passes cleanly; `pnpm --filter database run test:seed` (existing live-DB test) still passes unchanged; `pnpm --filter web test:e2e` passes locally.

## Deliverables Checklist

- [ ] `packages/testing-config` package created with `vitest-node`, `vitest-react`, and `msw-handlers` subpath exports, plus a `README.md` explaining when to use each.
- [ ] Root `vitest.config.ts` using `test.projects` (not the deprecated `test.workspace`).
- [ ] `apps/web`, `packages/database`, `packages/analytics` each have a `test` script wired to the shared config, with at least one passing test each.
- [ ] MSW example handler + one integration test proving request interception works.
- [ ] `@playwright/test` installed and configured strictly in `apps/web`, with a passing smoke E2E test.
- [ ] `packages/database/seed.integration.test.ts`/`test:seed` verified unchanged and still passing (manual, live DB).
- [ ] `pnpm test` (root) passes; CI's existing `Run tests` step now executes real suites.

## Out of Scope

- Scaffolding `packages/domain` or `packages/ui` as real workspaces — they don't exist yet (no committed `package.json`); this story only ensures the shared testing preset they'll need is ready for them to adopt when their owning stories (e.g. `1.3b`, `1.6a`, or a future domain-logic story) create them.
- Scaffolding `apps/backend` or wiring any backend test tooling — no `apps/backend` workspace exists yet (Story 0.8, GraphQL server scaffold, is still `ready-for-dev`); backend testing setup belongs to whichever story actually creates that workspace.
- Migrating `packages/database/seed.integration.test.ts` from `node:test` to Vitest, or merging `test:seed` into the root `test` task — deliberately preserved as a separate, opt-in, live-DB check per AC6.
- Adding Playwright/E2E execution to the CI `ci` job in `.github/workflows/ci.yml` — browser install + `webServer` boot is a heavier, separate CI concern; deferred to a future CI-enhancement story rather than silently expanding this story's/Story 0.5's scope.
- Achieving `packages/domain`'s mandated 100% unit-test-coverage rule (`project-context.md` Testing Rules) — not applicable until `packages/domain` itself exists with real business logic to cover.
- Any real feature integration test beyond the one proof-of-pipeline example per package — feature stories (Epic 1+) write their own tests against this foundation as they build real functionality.

## Definition of Done

- [ ] AC 1-6 satisfied.
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` all pass at the repo root.
- [ ] Lint and type checks passing for all touched packages (`apps/web`, `packages/database`, `packages/analytics`, `packages/testing-config`).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
