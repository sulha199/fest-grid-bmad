# Story 0.43: Build the visual-fidelity audit engine (packages/visual-audit)

## Story Details

- Epic: 0
- Story ID: 0.43
- Status: ready-for-dev
- **Depends on: Story 0.44** (`0-44-define-testing-standard-for-meta-testing-tooling-packages`) — see Pre-Coding Approval Gate below. `bmad-dev-story` must not start on this story until Story 0.44 reaches `done`.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a new workspace package, `packages/visual-audit`, implementing Architecture Spine AD-26 — a reusable check engine that compares a live, isolated component render against either a validated design-reference prototype (reference-based mode) or a hand-encoded structural invariant with no golden reference (rule-based mode), plus the manifest file format a story's acceptance criteria can cite by name,
so that a future story's AC can automate "does this match its prototype / does this satisfy this structural rule" instead of a developer eyeballing it or improvising a one-off Playwright script — the exact gap this session's own visual-fidelity audit of the event-card/calendar family hit (ad hoc Playwright screenshots + manual `getBoundingClientRect` measurement, no reusable artifact left behind, and a real production bug — `EventCardDateBox`'s day-slot overflow on word/time content, BUG-040 — that no test caught because no prototype ever depicted that content variant).

## Acceptance Criteria

1.  **Given** no `packages/visual-audit` package exists today, **When** this story ships, **Then** the package exists at `packages/visual-audit/` with `package.json`/`tsconfig.json` matching this repo's existing small-package boilerplate (`packages/graphql-select`'s pattern: `@festgrid/eslint-config`/`@festgrid/typescript-config` devDependencies, a `lint` script, `NodeNext` module resolution), and is wired into the pnpm workspace.
2.  **Given** AD-26 Rule 1's "two audit modes, one check engine," **When** a manifest entry is authored, **Then** the engine exposes both a **reference-based** check (live render vs. a validated prototype HTML/PNG pair under `design-artifacts/UX-festgrid-run-1/prototypes/**` + `imports/**`) and a **rule-based** check (a hand-encoded expected structural value, no golden reference) — both resolving to the same underlying computed-style/DOM assertion primitives, proven by at least one working example of each mode against a real, already-validated prototype pair (reference-based) and one synthetic hand-authored rule (rule-based, since AD-27's real rule-based consumer is a future story).
3.  **Given** AD-26 Rule 1a, **When** a manifest entry declares its render scope, **Then** the engine supports both **single-instance** (default) and **multi-instance** render, and Rule 5's sibling-dimension clustering (AC7) operates over whichever the manifest actually rendered — never hardcoded to assume single-instance only.
4.  **Given** AD-26 Rule 3, **When** a component/variant/viewport is covered, **Then** exactly one manifest entry exists for that triple (`packages/visual-audit/manifests/<name>.ts`), declaring: its prototype/PNG reference (reference-based only), its fixture props, its target viewport(s), and its rule set — the engine rejects (throws a clear error) a second manifest entry declaring the same component/variant/viewport triple.
5.  **Given** AD-26 Rule 4, **When** a manifest entry does not explicitly opt into live-route mode, **Then** it renders via **isolated-component-render** — Playwright 1.62's native stories/gallery component-testing model (`fixtures.mount()`, already implied by `apps/web`'s pinned `@playwright/test@1.62.0`), with fixture props only: no live Next.js server, no database, no auth. Live-route mode exists only as a documented escape hatch for genuinely route/data-dependent checks and is not exercised by this story's own example manifests.
6.  **Given** AD-26 Rule 2, **When** a reference-based check runs, **Then** the primary signal is computed-style/DOM introspection (bounding rects + `getComputedStyle()` values, compared against resolved DESIGN.md/Tailwind token values) and the secondary/confirmatory signal is a pixel screenshot diff against the source PNG via Playwright's built-in `toHaveScreenshot()` — both signals are reported, and a failure in either fails the check.
7.  **Given** AD-26 Rule 5's **sibling-dimension consistency** class, **When** elements are auto-clustered into rows/columns by bounding-box coordinate overlap (scoped per AC3), **Then** clustered siblings expected to share a dimension are checked at a configurable **absolute tolerance, default ≤2px**, overridable per rule in the manifest.
8.  **Given** AD-26 Rule 5's **intra-box ratio consistency** class, **When** a named element pair is checked against an expected ratio, **Then** the check uses a configurable **relative tolerance, default ±8–10%**, overridable per rule in the manifest, and the expected ratio can be sourced either from an explicit DESIGN.md token or derived once from the referenced prototype's own rendered ratio.
9.  **Given** AD-26 Rule 5's **overflow/clipping** class, **When** a manifest entry names a text/content slot and its backing formatting function, **Then** the engine derives that slot's content-variant catalog via **static analysis of the formatting function's branches** (using `ts-morph` to parse and enumerate the function's conditional/switch branches — a new devDependency, confirmed not already present anywhere in this monorepo), renders each enumerated variant, and flags `scrollWidth > clientWidth` or a bounding rect exceeding its ancestor's for any variant — including variants the source prototype never itself depicted.
10. **Given** AD-26 Rule 6's **color fidelity** class, **When** an element's color is checked, **Then** the primary signal is an exact computed-value match against the element's resolved DESIGN.md/Tailwind token (e.g. `bg-slate-800`'s resolved RGB/OKLCH), and the fallback signal (used only when no token is declared for that element) is a perceptual pixel diff against the source PNG.
11. **Given** this story builds the mechanism, not every manifest entry, **When** this story ships, **Then** it includes example/proof manifest entries for at most 1–2 already-validated prototypes (sufficient to prove AC2/AC6–AC10 end-to-end) — it does NOT retroactively author manifest entries for all 7 existing validated prototypes, does NOT fix BUG-040 (`EventCardDateBox` overflow), and does NOT build AD-27's masonry engine or its manifest entry; those remain separate, not-yet-created stories that consume this engine.
12. **Given** the engine must be usable as a library, **When** a future story's own test file imports it, **Then** `packages/visual-audit` exports a documented, typed public API (at minimum: a function to run a named manifest entry and return a structured pass/fail result per rule class) usable from a `vitest`/`tsx --test` test file in another package the same way `packages/graphql-select`'s utilities are imported today — it is not CLI-only.
13. **Given** the user chose to sequence Story 0.44 (define the testing standard for meta-testing/tooling packages) before this story rather than accept this story's original Escape Hatch (a self-declared scoped DoD, since retracted — see Dev Notes), **When** this story ships, **Then** its own Definition of Done for testing conforms to `project-context.md`'s "Meta-Testing / Tooling Packages" tier as defined by Story 0.44 (unit tests via `tsx --test` for the pure comparison/tolerance/clustering/branch-enumeration logic, no 100%-coverage requirement, and the example manifest entries themselves serving as this story's integration proof for its browser-automation/AST-analysis surfaces) — inheriting that project-wide rule rather than re-declaring its own.

## Tasks / Subtasks

- [ ] Task 1 — Package scaffold (AC: #1)
  - [ ] Create `packages/visual-audit/package.json`, `tsconfig.json`, `eslint.config.mjs` matching `packages/graphql-select`'s boilerplate; add `@playwright/test` (pinned to `apps/web`'s `1.62.0`) and `ts-morph` as dependencies.
  - [ ] Wire into pnpm workspace; confirm `pnpm install` resolves cleanly.
- [ ] Task 2 — Manifest schema and registry (AC: #4, #11, #12)
  - [ ] Define the manifest entry TypeScript type (component ref, variant, viewport(s), render scope, prototype/PNG reference optional, fixture props, rule set).
  - [ ] Implement a manifest registry that rejects duplicate component/variant/viewport triples.
  - [ ] Export a public `runManifestEntry(name)` (or equivalent) API.
- [ ] Task 3 — Isolated-component-render harness (AC: #5)
  - [ ] Set up Playwright 1.62's stories/gallery component-testing model (`fixtures.mount()`) inside `packages/visual-audit`, mounting components with fixture props, no server/DB/auth.
  - [ ] Document the live-route-mode escape hatch (not exercised by this story's own examples).
- [ ] Task 4 — Compare engine: computed-style + pixel diff (AC: #2, #6)
  - [ ] Implement computed-style/bounding-rect extraction via `page.evaluate()`/`getComputedStyle()`.
  - [ ] Wire Playwright's built-in `toHaveScreenshot()` as the secondary pixel-diff signal.
  - [ ] Implement the rule-based mode (hand-encoded expected value, no golden reference) sharing the same assertion primitives.
- [ ] Task 5 — Sibling-dimension clustering rule (AC: #3, #7)
  - [ ] Implement bounding-box coordinate-overlap auto-clustering, scoped to whatever the manifest rendered (single- or multi-instance).
  - [ ] Implement the ≤2px default absolute-tolerance check, overridable per rule.
- [ ] Task 6 — Intra-box ratio rule (AC: #8)
  - [ ] Implement named-pair ratio comparison with ±8–10% default relative tolerance, overridable per rule; support both DESIGN.md-token-sourced and prototype-derived expected ratios.
- [ ] Task 7 — Overflow/content-variant rule via ts-morph (AC: #9)
  - [ ] Implement branch enumeration over a named formatting function's source via `ts-morph`.
  - [ ] Render each enumerated variant and assert no overflow/clipping.
- [ ] Task 8 — Color fidelity rule (AC: #10)
  - [ ] Implement token-exact-match-primary / pixel-diff-fallback color check.
- [ ] Task 9 — Example manifest entries and proof (AC: #2, #11)
  - [ ] Author 1–2 example manifest entries against an already-validated `design-artifacts/UX-festgrid-run-1/prototypes/**` pair, exercising both audit modes and all five rule classes end-to-end.
- [ ] Task 10 — Testing (AC: #13)
  - [ ] Unit-test the pure comparison/tolerance/clustering/branch-enumeration logic (`tsx --test`, mirroring `packages/graphql-select`).
  - [ ] Confirm the example manifest entries themselves pass, serving as this story's own integration proof.
  - [ ] Document the scoped DoD decision in Dev Notes pending Story 0.44.

## Dev Notes

- This is a pure dev-tooling/testing package. It ships zero production UI, zero database/GraphQL surface, and is never bundled into `apps/web`'s production build — it sits in the same category as `packages/graphql-select`/`packages/testing-config`.
- **Package boilerplate precedent:** `packages/graphql-select/package.json` (main/types/exports pointing at `dist/`, `build`/`test`/`lint` scripts, `@festgrid/eslint-config`+`@festgrid/typescript-config` devDependencies) and its `tsconfig.json` (`extends: "@festgrid/typescript-config/base.json"`, `module`/`moduleResolution: "NodeNext"`, `outDir: "dist"`) are the closest existing shape to copy. Its `test: "tsx --test *.test.ts"` script is the pattern this story's own unit tests should follow, since `packages/visual-audit` is not `packages/domain` and not an `apps/*` app.
- **`apps/web/e2e/`** already carries `@playwright/test@1.62.0` as a devDependency and has an established Playwright config/spec-file pattern (`apps/web/e2e/*.spec.ts`, `global-setup.ts`). This story pins the same version in `packages/visual-audit` rather than introducing a second Playwright version or a second browser-automation library.
- **Design-reference source of truth:** `design-artifacts/UX-festgrid-run-1/prototypes/**/*.html` + `imports/**/*.png` (currently 3 prototype families: `event-card-calendar-grid-item/`, `event-card-calendar-row/`, `event-card-masonry/`). `prototypes/validation-log.md` is the existing (informal, not schema-binding) precedent for how a "validated" prototype's own metadata is tracked — Gate 2 (Freya) suggests the manifest format could usefully capture similar fields (validated date, documented deviations, real-dimension check) for consistency, though this is a suggestion, not a hard requirement.
- **Sequencing (per the user's explicit instruction):** this is the first of a 3-story sequence: this tool (Story 0.43) → AD-27's masonry engine story (not yet created, tracked as `IDEA-050`) → BUG-040's `EventCardDateBox` date-box fix story (not yet created, tracked as `BUG-040`). Story `1-3k-render-day-of-week-recurring-schedules-and-repeat-badge` (currently `ready-for-dev`, untouched by this story) shares files (`EventCardMediaPrimitives.tsx`, `EventCard.tsx`, `WeeklyCalendarView.tsx`) with the eventual BUG-040 fix story — the actual `epics.md` dependency amendment to Story 1.3k belongs to the BUG-040 fix story once it exists, not this one.
- **Full decision trail:** `_bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/.memlog.md` (21 entries) records the rejected alternatives behind every AD-26/AD-27 decision cited above (e.g. manifest-declared selectors vs. auto-clustering for sibling grouping; hand-authored vs. static-analysis content-variant catalogs; native CSS masonry ruled out as Safari-only in 2026).
- **Web-verified technical choices (2026-09-22), cited per this session's own research, not training-data assumption:**
  - **Isolated-component-render mechanism:** Playwright 1.62 (shipped 24 July 2026, patched to 1.62.1) introduced a native "stories and galleries" component-testing model built directly into plain `@playwright/test` — a `fixtures.mount()` fixture navigates to a gallery page and mounts a named story (component + fixture props), returning a `Locator` with `update()`/`unmount()`. This supersedes the older, separate `@playwright/experimental-ct-react` package for a codebase already on `@playwright/test@1.62.0` (as `apps/web` is) and is the mechanism this story should use — it satisfies "Playwright is already a devDependency ... reuse it, don't add a second browser-automation dependency" more literally than the older CT package would, since it's native to the version already pinned. [Source: github.com/microsoft/playwright releases v1.62.0; bug0.com "What's new in Playwright 1.62"]
  - **Computed-style/DOM assertions:** current guidance favors `toHaveCSS()` for simple single-property retrying assertions, and `page.evaluate()`/`locator.evaluate()` wrapped in `expect.poll()` for multi-property `getComputedStyle()`/bounding-rect reads — no dedicated third-party assertion library is needed or commonly recommended over Playwright's own native APIs. [Source: qaskills.sh "How to Assert CSS Computed Style in Playwright Without Brittle Tests"; playwright.dev/docs/handles]
  - **Pixel screenshot diffing:** Playwright's built-in `toHaveScreenshot()` (backed internally by `pixelmatch`) remains the current standard approach — no need for a separate diffing library. 2026 best practice: prefer component-level (not full-page) screenshots, mask dynamic content, disable animations before capture, and set per-component `threshold`/`maxDiffPixelRatio` rather than one global tolerance. [Source: playwright.dev/docs/test-snapshots; bug0.com "Playwright Visual Regression Testing: Built-In Guide 2026"]
  - **Content-variant catalog via static analysis:** `ts-morph` (TypeScript Compiler API wrapper) is a live, actively documented library purpose-built for exactly this — traversing a function's AST (`forEachDescendant`, branch/traversal control) to enumerate its conditional/switch branches programmatically, rather than hand-authoring a fixture list. Confirmed as a sane, current choice for this repo's TS/monorepo context; not previously used anywhere in this codebase (new dependency). [Source: ts-morph.com; github.com/dsherret/ts-morph]

### Architecture & UX Gate Findings

- **Gate 1 (Winston, Architecture/Infrastructure Completeness): No gap found.** This package never enters `apps/web`'s production bundle; Playwright's `mount()`/`getComputedStyle()`/`toHaveScreenshot()` calls are test-time/CI-time tool invocations, not a production frontend-to-external-service call. No DB/ORM/domain reachthrough, no new backend API surface, no auth/secrets in frontend code, and `ts-morph`/Playwright's story-bundling are devDependency-tier additions with no deploy/IaC surface (the tool itself is never deployed anywhere).
- **Gate 2 (Freya, UI Complexity & Reusability): No gap found.** Verified, not assumed: this story ships zero production React components/routes; its only "UI" is CLI/report output. The manifest schema and fixture-mounting helper are correctly scoped as this story's own deliverable (the primitive being built), not a UI primitive masking a missing shared piece. DESIGN.md is a token spec, not a manifest-format spec, so it imposes no binding schema here; `prototypes/validation-log.md` is informal precedent worth drawing on for consistency (see Dev Notes above), not a hard requirement.
- **Gate 3 (Winston, Foundational/Cross-Cutting Dependency Completeness): Gap found.** `project-context.md`'s Testing Rules section is a closed two-tier partition (`packages/domain`: 100% unit coverage; `apps/*`: testing-trophy + E2E DoD) that a meta-testing/tooling package like `packages/visual-audit` fits neither. Since this story is the first of its kind and its own future adopters (AD-27's masonry story, BUG-040's fix story) will inherit whatever precedent it sets, left undecided this becomes an ad-hoc convention set by accident rather than a deliberate, project-wide rule. **Recorded as `FIND-047`, split into Story 0.44** (see `## Out of Scope` below) per the tooling/infrastructure numbering rule (new sequential Epic 0 story, since this is reusable/foundational by nature). Gate 3 also confirmed: zero GraphQL/codegen dependency in this story's scope; a `bmad-dev-story` workflow-wiring note (teaching it to execute a `packages/visual-audit` manifest check) is recorded as a Dev Note for whichever story first cites a manifest entry from its own AC, not a second foundational story; and Playwright's story/gallery bundling (Vite-based) is contained entirely within this package's own test execution, analogous to `apps/web`'s existing Vitest+`vite-tsconfig-paths` test-only bundling — not a second production build pipeline, so not cross-cutting on its own.
  - **UPDATE 2026-09-22 (sequencing amendment):** the Escape Hatch clause originally cited here (proceed under a self-declared scoped DoD, AC13, without waiting for Story 0.44) was **rejected by the user**, who explicitly chose "0.44 first, then 0.43" when asked to decide between the two paths. This story is amended accordingly: **AC13 no longer self-declares a scoped DoD** — it now inherits whatever testing standard Story 0.44 defines (that story shipped `ready-for-dev` the same session, see its file's Dev Notes for the side-by-side confirming it matches this story's originally-intended approach exactly). A `Depends on: Story 0.44` note and a corresponding Pre-Coding Approval Gate blocking item (below) were added. This story's own status remains `ready-for-dev` in `sprint-status.yaml` — per this repo's established convention (see `event-pages-dev-story-tracking.md`'s dependency graph), the gate is enforced via this explicit Pre-Coding Approval Gate note, checked at `bmad-dev-story` dispatch time, not via a separate sprint-status value.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, no GraphQL types, and no new TypeScript models consumed across a DB/API/frontend boundary.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required — the manifest/rule-result types are internal to `packages/visual-audit` and its consumers' test files.
- Backward compatibility and rollout notes: Not applicable — new, standalone package with no existing consumers to break.
- Verification checks: `packages/visual-audit`'s own `tsc`/lint pass is sufficient; no cross-boundary type verification needed.

### Project Structure Notes

- New package at `packages/visual-audit/`, matching the flat top-level `packages/*` convention (alongside `graphql-select`, `domain`, `ui`, `database`, `shared-types`, `testing-config`).
- No conflicts detected with the existing monorepo structure; no existing file needs to move.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-26] — full rule set this story implements.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-27] — adjacent future consumer; this story must not preclude it (Rule 1a exists for this reason).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/.memlog.md] — full decision trail and rejected alternatives.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-049] — originating backlog row.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#BUG-040] — the production bug this tool exists to catch (not fixed by this story).
- [Source: packages/graphql-select/package.json, packages/graphql-select/tsconfig.json] — package boilerplate precedent.
- [Source: design-artifacts/UX-festgrid-run-1/prototypes/validation-log.md] — informal prototype-validation metadata precedent.

## Global Rules References

- [x] project-context.md — Code Organization (`packages/*` conventions), Testing Rules (Gate 3 finding applies, see Dev Notes).
- [x] story-content-structure.md — canonical section order followed.
- [x] architecture spine — AD-26 (this story), AD-27 (adjacent, not in scope).
- [x] infrastructure docs — not applicable (no AWS/infra surface introduced).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/visual-audit/package.json`, `tsconfig.json`, `eslint.config.mjs`
  - New: `packages/visual-audit/src/index.ts` (public API)
  - New: `packages/visual-audit/src/manifest.ts` (manifest type + registry)
  - New: `packages/visual-audit/src/render.ts` (isolated-component-render harness via Playwright 1.62 stories/gallery)
  - New: `packages/visual-audit/src/compare/computed-style.ts`, `pixel-diff.ts`
  - New: `packages/visual-audit/src/rules/sibling-dimension.ts`, `intra-box-ratio.ts`, `overflow.ts`, `color.ts`
  - New: `packages/visual-audit/src/content-variants.ts` (`ts-morph`-based branch enumeration)
  - New: `packages/visual-audit/manifests/<example>.ts` (1–2 proof entries)
  - New: `packages/visual-audit/*.test.ts` (unit tests, `tsx --test` pattern)
- **Rule Mapping:** AC1→package scaffold; AC2/AC11→two-mode engine + example manifests; AC3→Rule 1a render-scope; AC4→manifest registry/dedup; AC5→isolated-render default; AC6→hybrid compare; AC7→sibling-dimension tolerance; AC8→intra-box ratio tolerance; AC9→ts-morph content-variant catalog; AC10→color fidelity; AC12→public library API; AC13→testing/DoD inherited from Story 0.44 (dependency, see Pre-Coding Approval Gate).
- **Verification Plan:** `pnpm --filter @festgrid/visual-audit test` (unit tests for pure logic) + the example manifest entries themselves passing end-to-end (proving isolated-render, both audit modes, and all five rule classes against a real validated prototype); `pnpm --filter @festgrid/visual-audit lint` clean; `pnpm install` resolves the new `ts-morph`/`@playwright/test` dependencies without version conflicts against `apps/web`'s existing `@playwright/test@1.62.0`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — **Gate 3's gap (FIND-047) is BLOCKING per the user's explicit sequencing decision (2026-09-22): Story 0.44 must reach `done` before this story's `bmad-dev-story` starts. The Escape Hatch (AC13's original self-declared scoped DoD) was considered and rejected in favor of proper sequencing. Do not begin implementation until Story 0.44's status is `done` in `sprint-status.yaml`.**

## Testing Requirements

- [ ] Unit tests for pure comparison/tolerance/clustering/branch-enumeration logic (`tsx --test`, `packages/graphql-select` pattern)
- [ ] Integration proof via the example manifest entries themselves (isolated-render + both audit modes + all five rule classes, against a real validated prototype)

## Deliverables Checklist

- [ ] `packages/visual-audit` package scaffolded and wired into the pnpm workspace
- [ ] Manifest schema + registry with duplicate-triple rejection
- [ ] Isolated-component-render harness (Playwright 1.62 stories/gallery)
- [ ] Hybrid compare engine (computed-style primary, pixel diff secondary)
- [ ] All five rule classes implemented with their specified tolerance shapes
- [ ] Public, documented, importable API
- [ ] 1–2 example/proof manifest entries against a real validated prototype
- [ ] Unit tests + documented scoped DoD (AC13)

## Out of Scope

- Authoring manifest entries for the remaining validated prototypes (deferred to each adopting story).
- Fixing BUG-040 (`EventCardDateBox` overflow) — a future story, though it should cite this tool's engine for its own AC once created.
- Building AD-27's masonry engine or its manifest entry — a future story (`IDEA-050`).
- **Gate 3 finding (FIND-047):** promoting a permanent testing-standard tier for meta-testing/tooling packages into `project-context.md` — split into **Story 0.44** (`0-44-define-testing-standard-for-meta-testing-tooling-packages`), not built as a byproduct of this story. **This is now a hard dependency, not a parallel/non-blocking item** — see `Depends on` note and Pre-Coding Approval Gate above.
- Wiring `bmad-dev-story`'s own verification step to automatically execute a `packages/visual-audit` manifest check — deferred to whichever story first cites a manifest entry from its own AC.

## Definition of Done

- [ ] AC satisfaction (AC1–AC13)
- [ ] Required tests passing (unit tests + example manifest entries)
- [ ] Lint and type checks passing for `packages/visual-audit`

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
