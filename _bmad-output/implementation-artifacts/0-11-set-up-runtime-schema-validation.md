---
baseline_commit: 272da91933b040f45f2eaf9b5a566d71d85f3246
---
# Story 0.11: Set up runtime schema validation (Zod, AJV)

## Story Details

- Epic: 0
- Story ID: 0.11
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to establish `Zod` (for frontend) and `AJV` (for backend) validation patterns with strict package dependency isolation,
so that all data entering the system is strictly validated at the boundaries without bundle pollution.

## Acceptance Criteria

1. **Given** `apps/backend` exists as a workspace (Story 0.8), **when** external/untrusted data would enter the backend (e.g. a scraped post or an AI-extraction payload), **then** `ajv` (plus `ajv-formats` for common string formats) is installed as a **dependency of `apps/backend` only**, and a working, unit-tested example validator demonstrates compiling a JSON Schema and rejecting/accepting a payload shaped like a real future consumer (the AI-extraction output validated in Story 3.6 before `DataIngestionQueue` ingestion). [epics.md AC1]
2. **Given** `apps/web` exists, **when** untrusted data is received client-side (a form field or an external API response, e.g. the browser Geolocation API's coordinates), **then** `zod` is installed as a **dependency of `apps/web` only**, and a working, unit-tested example schema demonstrates `safeParse`-based validation for both a valid and an invalid input. [epics.md AC2]
3. No shared/workspace package declares both `ajv` and `zod` (or either alongside the other's domain) — confirmed by inspecting every `package.json`'s dependency list; `ajv`/`ajv-formats` appear only under `apps/backend`, `zod` appears only under `apps/web`. [epics.md AC3]
4. The validation examples are pure, framework-agnostic demonstration code (no product page/component depends on them) — this story establishes the pattern and proves the pipeline works, it does not implement any real feature's validation (that remains the job of the feature story that first receives real external data, e.g. Story 3.6 for AJV, Epic 3's subscription/API-key forms for Zod).
5. `pnpm build`, `pnpm lint`, and `pnpm test` all pass at the repo root after this story lands, for every touched package.

## Tasks / Subtasks

- [x] Task 1: Add AJV to `apps/backend` (AC: 1, 3)
  - [x] Confirm `apps/backend/package.json` exists (Story 0.8 must be `done` first — see Dev Notes "Sequencing Dependency on Story 0.8"). If it does not exist yet, HALT and do not create it here; that scaffold belongs exclusively to Story 0.8.
  - [x] Add `ajv` (`^8.20.x`) and `ajv-formats` (for `email`/`date`/`uri` string-format keywords) as `dependencies` of `apps/backend/package.json` only.
  - [x] Create `apps/backend/src/validation/extracted-event.schema.ts` exporting a JSON Schema (`JSONSchemaType<ExtractedEventPayload>` if using AJV's typed helper, or a plain `const` object) for a minimal `ExtractedEventPayload` shape mirroring the real fields Story 3.6's AI-extraction pipeline will need to validate before `DataIngestionQueue` ingestion: `isEvent: boolean`, `eventName: string`, `types: string[]`, `categories: string[]` (subset of `@festgrid/shared-types`' `EventInfo`, not a full duplicate — see Dev Notes on why this stays a demonstration, not the real Story 3.6 schema).
  - [x] Create `apps/backend/src/validation/validate.ts` exporting a small `compileValidator<T>(schema)` helper that wraps `new Ajv({ allErrors: true })` + `addFormats(ajv)` + `ajv.compile(schema)`, returning a typed validate function — this is the reusable *pattern* future backend stories (3.6, 3.9, etc.) adopt, not a single-use script.
  - [x] Add `apps/backend/src/validation/validate.test.ts` (using `node:test`/`node:assert` via `tsx --test`, mirroring `packages/graphql-select/optimized-select.test.ts`'s precedent from Story 0.8 — `apps/backend` is not wired to Vitest by Story 0.10, which only covers `apps/web`/`packages/database`/`packages/analytics`) proving: a valid `ExtractedEventPayload` passes, and an invalid one (missing `eventName`, wrong type for `types`) is rejected with populated `errors`.
  - [x] Add a `"test": "tsx --test src/**/*.test.ts"` script to `apps/backend/package.json` (it has none yet per Story 0.8's Task 1 — only `dev`/`build`/`start`/`lint`/`codegen`) so `turbo run test` picks it up.
- [x] Task 2: Add Zod to `apps/web` (AC: 2, 3)
  - [x] Add `zod` (`^4.4.x`) as a `dependency` of `apps/web/package.json` only.
  - [x] Create `apps/web/src/lib/validation/coordinates.schema.ts` exporting a `coordinatesSchema` (`z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })`) — a realistic client-side-data-parsing example validating the browser Geolocation API's untrusted output (`GeolocationCoordinates`), matching `@festgrid/shared-types`' `Coordinates` shape, and a direct precursor to Story 2.4's "set location by current location" work.
  - [x] Create `apps/web/src/lib/validation/coordinates.schema.test.ts` (using the `@festgrid/testing-config/vitest-node` preset from Story 0.10 — pure logic, no DOM needed) proving `safeParse` succeeds for valid coordinates and fails (with a populated `error`) for out-of-range/malformed input.
  - [x] Add `apps/web/package.json`'s `"test"` script (added by Story 0.10) picks this test up automatically — no script changes needed here.
- [x] Task 3: Package-isolation audit (AC: 3)
  - [x] Grep every `package.json` in the repo (`apps/*`, `packages/*`) for `"ajv"` and `"zod"` and confirm `ajv`/`ajv-formats` appear only under `apps/backend`, and `zod` appears only under `apps/web`. Record the grep output in Completion Notes as the verification evidence for AC3.
- [x] Task 4: Documentation (AC: 4)
  - [x] Add a short `## Runtime Validation` section to the root `README.md` (or `apps/backend/README.md`/`apps/web/README.md` if a root README doesn't exist — check first) explaining: AJV validates external/untrusted data at the backend boundary (JSON Schema, compiled validators), Zod validates client-side data/forms at the frontend boundary (schema + `safeParse`), and the two are never mixed in a shared package — link to `project-context.md`'s "Runtime Schema Validation" rule as the source of truth.
- [x] Task 5: Verification (AC: 5)
  - [x] Run `pnpm --filter backend test` and confirm the new AJV test passes.
  - [x] Run `pnpm --filter web test` and confirm the new Zod test passes.
  - [x] Run `pnpm build` and `pnpm lint` at the repo root and confirm both are clean.

## Dev Notes

- **This story is pure dev-tooling/pattern-setup — no product UI, no real feature integration.** Per Gate 2's fresh subagent finding (below), the actual reusable form components and their validation UX (In-Table Add Form, inline error states) are already owned by Epic 3 (Stories 3.1/3.2/3.3). This story must not attempt to build or pre-empt that UI.
- **Sequencing Dependency on Story 0.8 (`apps/backend` scaffold) — read before starting Task 1.** As of this story's creation, `apps/backend` contains only a `.env` file — **no `package.json` exists** (confirmed via `git ls-files apps/backend` returning nothing, and directly mirroring Story 0.8's own Dev Notes: "This story is a full scaffold from zero, not an edit"). Story 0.8 is numbered *before* this story (0.8 < 0.11) and sprint execution proceeds in story-key order, so by the time a dev agent picks up 0.11, Story 0.8 should already be `done`. This is a **normal forward dependency in numeric order**, unlike Story 0.8's own reverse-order dependency on Story 0.9 (which required an explicit approval-gate workaround) — no workaround is needed here. However, if `apps/backend/package.json` still does not exist when this story is picked up, **do not scaffold it as a side effect of this story** (that would create a competing/premature scaffold Story 0.8 would then have to reconcile with) — halt Task 1 and complete Story 0.8 first.
- **Why the AJV/Zod example schemas are NOT placed in `packages/domain`, despite the persistent "reusable mechanism → `packages/domain`" project rule.** `packages/domain` is (once scaffolded) a single shared package importable by both `apps/web` and `apps/backend`/Lambda code. If the AJV-compiled-validator helper or Zod-schema code lived there, both apps would transitively pull in *both* `ajv` and `zod` through one shared dependency — directly violating this story's own AC3 ("no shared validation package that mixes these dependencies") and `project-context.md`'s explicit package-isolation mandate, which is more specific than the general reusability rule and takes precedence here. The validation *pattern* (JSON Schema + `compileValidator` for AJV; `z.object` + `safeParse` for Zod) is documented and demonstrated in each app so future stories copy the pattern, not a shared implementation. (Note: `packages/domain` does not exist yet as a real workspace either — no committed `package.json`, same variance already documented in Stories 0.9/0.10 — so this is moot for this story regardless.)
- **`apps/backend` does not get Vitest.** Story 0.10 ("Set up testing frameworks foundation") wires `@festgrid/testing-config`'s Vitest presets into `apps/web`, `packages/database`, and `packages/analytics` only — `apps/backend` was deliberately left out of that story's scope (it has no test framework at all until this story adds one). This story reuses the `node:test`/`tsx --test` pattern Story 0.8 already established for `packages/graphql-select` (same archetype: a Node-run, non-DOM package) rather than introducing a second, inconsistent test runner for `apps/backend`. If Story 0.10 has since added Vitest to `apps/backend` by the time this story is implemented, prefer that instead and update this note — but do not block on it either way, since `node:test` is a valid zero-dependency fallback.
- **Example schema choices are deliberately tied to real future consumers, not arbitrary:** the AJV `ExtractedEventPayload` example mirrors the shape Story 3.6 ("Process posts from the queue and extract event information") will validate before `DataIngestionQueue` ingestion (per `docs/infrastructure/2-backend.md`'s three-queue architecture and `@festgrid/shared-types`' `EventInfo`); the Zod `coordinatesSchema` example mirrors what Story 2.4 ("Set location by current location or map") will need to validate from the browser's untrusted Geolocation API, matching `@festgrid/shared-types`' `Coordinates` shape. Neither example is a full duplicate of those future stories' real implementation — they are minimal, illustrative subsets proving the validation *pipeline* works end-to-end, so those later stories adopt an established pattern instead of inventing one ad hoc.
- **Package isolation (project-context.md, persistent fact, and this story's own AC3):** `ajv`/`ajv-formats` → `apps/backend` dependencies only. `zod` → `apps/web` dependencies only. Neither is added to `packages/domain`, `packages/shared-types`, `packages/database`, `packages/graphql-select`, `packages/ui`, `packages/analytics`, `packages/testing-config`, `packages/eslint-config`, or `packages/typescript-config`.
- **No cloud/external service is introduced** — both AJV and Zod are pure npm libraries with no account/credential setup. No `SETUP_WALKTHROUGH.md` update required.
- **No PostHog events or i18n strings are introduced** — no AD-5 event taxonomy additions, no AD-6 locale keys required. (The example validators produce internal `error`/`errors` objects for developers, not user-facing copy.)
- **No state-management or async-loader categorization applies** — this story adds no application state or data-fetching UI of its own.
- Git history check: the 10 most recent commits (`e301498`…`b8ae508`) are all BMad skill/planning changes or earlier Epic 0/1 app-code commits (`analytics` package, `database` schema, CI pipeline) — none touch validation libraries; no existing AJV/Zod usage pattern exists anywhere in the repo to reconcile with (confirmed via repo-wide grep for `"ajv"`/`"zod"` in `package.json` files returning zero matches before this story).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` (`swept: true`, `stories_covered` explicitly includes `0.11`). The report states Epic 0's own list is complete for validation: *"All other project-context.md-mandated foundations (`buildOptimizedDrizzleSelect`, GraphQL Code Generator, shared testing-config package, Zod/AJV isolation, FCM) already have direct, unambiguous Epic 0 stories (0.8, 0.10, 0.11, 0.12) — no gap."* The report's two new findings (missing outbound-email adapter → Story 0.15, missing Geolocation adapter+cache → Story 0.16) are unrelated to runtime schema validation. No Gate 1/3 gap applies to this story.
  - **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep — installing `ajv`/`zod` as isolated devDependencies-of-sibling-apps and writing two illustrative example schemas introduces no new external service, no new data entity, and no new infra dependency beyond what the sweep anticipated. The one genuine wrinkle found during drafting — `apps/backend/package.json` not existing yet — is a Story 0.8 sequencing note (documented above), not a Gate 1/3 architectural gap, since Story 0.8 already exists as the unambiguous owner of that scaffold. No fresh Gate 1/3 subagent run needed.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya/UX-designer-persona subagent (required per-story even when the epic sweep is used). The subagent read `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` in full, plus targeted searches for form/validation/error/input terminology. It found a real reusable UI pattern — "In-Table Add Form" (`EXPERIENCE.md` line 66, also `epics.md` UX-DR21) used for API Keys and Subscriptions lists — but confirmed it, and the field-level validation/error-message UX it implies, is already explicitly owned by Epic 3 (Story 3.1 "Onboarding wizard for API key and subscriptions", Story 3.2 "Subscribe to a social media account", Story 3.3 "Set a default location for a subscription"), not this story. **Verdict: No gap found.** This story remains scoped to installing/configuring the validation libraries with non-product example schemas; the actual form components consuming Zod are Epic 3's responsibility.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, GraphQL contract, or hand-authored `@festgrid/shared-types` changes. The example AJV schema (`ExtractedEventPayload`) and Zod schema (`coordinatesSchema`) are deliberately minimal, illustrative subsets of `EventInfo`/`Coordinates` for demonstration purposes only — they are not registered anywhere as the canonical validation contract for those types (that responsibility belongs to the feature story that first validates real data of that shape, e.g. Story 3.6 for extraction payloads).
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required. The example schemas' inferred/declared TypeScript shapes are a subset of, and consistent with, the existing `@festgrid/shared-types` field names/casing (camelCase throughout, matching Drizzle/GraphQL conventions already established by Stories 0.8/1.1) — no new or diverging type is introduced.
- Backward compatibility and rollout notes: N/A — greenfield addition, no existing consumers of AJV or Zod exist yet anywhere in the repo.
- Verification checks: `apps/backend`'s `node:test` suite (Task 1) proves the AJV validator accepts/rejects correctly; `apps/web`'s Vitest suite (Task 2) proves the Zod schema's `safeParse` accepts/rejects correctly; the Task 3 grep audit proves package-dependency isolation; `pnpm build`/`pnpm lint`/`pnpm test` all pass at the repo root.

### Project Structure Notes

- Alignment with unified project structure: New validation code lives at `apps/backend/src/validation/` and `apps/web/src/lib/validation/`, following each app's existing `src/` layout (mirrors `apps/backend/src/schema/` from Story 0.8, and `apps/web/src/lib/utils.ts` from the existing Shadcn setup). No new workspace package is created by this story — deliberately, since the validation *pattern* is meant to be copied per-app, not centralized (see Dev Notes on why `packages/domain` is not used).
- Detected conflicts or variances: `apps/backend/package.json` does not exist as of this story's drafting (Story 0.8 still `ready-for-dev`) — this is a sequencing dependency, not a defect, and is handled via the Dev Notes callout and Pre-Coding Approval Gate item rather than by this story scaffolding `apps/backend` itself. `packages/domain` and `packages/ui` also remain unscaffolded (same pre-existing variance already documented in Stories 0.9/0.10) and are not touched by this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.11] — story AC source.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, `swept: true`, explicitly covers `0.11`, confirms no gap.
- [Source: _bmad-output/project-context.md#API & Data] — "Runtime Schema Validation" rule (Zod frontend / AJV backend at entry points).
- [Source: _bmad-output/project-context.md#Code Quality & Style Rules] — `packages/domain` reusability rule and its "no React" restriction, weighed against the package-isolation mandate in this story's Dev Notes.
- [Source: _bmad/custom/bmad-create-story.toml persistent facts] — "Schema validation must be strictly isolated: zod only in apps/web (or specific UI packages) and ajv only in apps/backend" — the direct mandate this story implements.
- [Source: docs/infrastructure/2-backend.md] — three-queue architecture (`ScrapingQueue`/`AIProcessingQueue`/`DataIngestionQueue`), the real future home of the AJV extraction-validation example.
- [Source: packages/shared-types/src/index.ts] — `EventInfo`, `Coordinates`, `Schedule` shapes the example schemas mirror (subset only, not a full duplicate).
- [Source: _bmad-output/implementation-artifacts/0-8-set-up-graphql-server-scaffold-code-generator-pipeline-and-the-optimized-select-query-utility.md] — confirms `apps/backend` currently has no `package.json` ("full scaffold from zero"), source of this story's sequencing note; also source of the `node:test`/`tsx --test` precedent this story reuses for `apps/backend`.
- [Source: _bmad-output/implementation-artifacts/0-10-set-up-testing-frameworks-foundation.md] — confirms Vitest (`@festgrid/testing-config`) is wired into `apps/web`/`packages/database`/`packages/analytics` only, not `apps/backend` — source of this story's testing-approach split between the two apps.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md, epics.md UX-DR21] — "In-Table Add Form" reusable pattern, confirmed owned by Epic 3 (Stories 3.1/3.2/3.3), not this story (Gate 2 evidence).
- [Web research, 2026-07-31: npm] `zod` latest stable `4.4.3` (npmjs.com/package/zod). `ajv` latest stable `8.20.0` (npmjs.com/package/ajv) — `ajv-formats` added alongside it for standard string-format validation (email/date/uri), a common companion package for AJV 8.x.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — "Runtime Schema Validation" rule (API & Data), package-dependency-isolation rules (Code Quality & Style Rules, and the dedicated persistent fact).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated AD exists for runtime validation (confirmed via grep, zero matches for "AJV"/"Zod"/"validation"); governed entirely by `project-context.md`, mirroring Story 0.10's precedent for testing conventions.
- [ ] `docs/infrastructure/2-backend.md` — three-queue architecture context for the AJV example schema's real future consumer (Story 3.6).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/backend/src/validation/extracted-event.schema.ts`, `apps/backend/src/validation/validate.ts`, `apps/backend/src/validation/validate.test.ts`.
  - New: `apps/web/src/lib/validation/coordinates.schema.ts`, `apps/web/src/lib/validation/coordinates.schema.test.ts`.
  - Modified: `apps/backend/package.json` (add `ajv`, `ajv-formats` dependencies + `"test"` script), `apps/web/package.json` (add `zod` dependency).
  - Modified: root `README.md` (or per-app `README.md` if no root README exists) — new "Runtime Validation" section.
  - Not modified: `packages/domain`, `packages/ui`, `packages/database`, `packages/graphql-select`, `packages/shared-types`, `turbo.json` (existing `test` task already generic enough), `.github/workflows/ci.yml` (existing `Run tests` step already calls `pnpm run test`).
- **Rule Mapping:**
  - AJV strictly in `apps/backend`, Zod strictly in `apps/web`, no shared package mixing → `project-context.md` "Runtime Schema Validation" rule + persistent package-isolation fact → Task 1/2/3.
  - Reusable-mechanism-to-`packages/domain` general rule explicitly overridden by the more specific isolation mandate → Dev Notes rationale.
  - Example schemas tied to real future consumers (Story 3.6 AJV, Story 2.4 Zod) rather than arbitrary demo data → Dev Notes "Example schema choices" callout.
  - `apps/backend` uses `node:test`/`tsx --test` (Story 0.8 precedent), `apps/web` uses Vitest (Story 0.10 precedent) → Dev Notes testing-approach split.
- **Verification Plan:**
  - `pnpm --filter backend test` passes (new `node:test` AJV suite).
  - `pnpm --filter web test` passes (new Vitest Zod suite).
  - Task 3's repo-wide `package.json` grep confirms `ajv`/`ajv-formats` under `apps/backend` only and `zod` under `apps/web` only.
  - `pnpm build` and `pnpm lint` pass cleanly at the repo root.

## Pre-Coding Approval Gate

- [x] Scope confirmation: install `ajv`+`ajv-formats` in `apps/backend` only and `zod` in `apps/web` only, each with one illustrative, unit-tested example schema tied to a real future consumer (Story 3.6 AJV example; Story 2.4 Zod example) — no real feature/form integration, no new shared package.
- [x] Architecture and boundary confirmation: `ajv`/`zod` isolated per-app as mandated; validation pattern documented, not centralized in `packages/domain` (see Dev Notes rationale for why the general reusability rule is overridden here).
- [x] Testing plan confirmation: `apps/backend` uses `node:test`/`tsx --test` (Story 0.8 precedent, since Story 0.10 does not wire Vitest into `apps/backend`); `apps/web` uses the Story 0.10 Vitest/`vitest-node` preset.
- [x] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (no gap, `0.11` explicitly covered); Gate 2 run fresh (no gap found — Epic 3 owns the actual form UI).
- [x] **Sequencing dependency confirmed:** Story 0.8 (`apps/backend` scaffold) is `done` before Task 1 of this story begins. If not yet done, complete Story 0.8 first rather than having this story create a competing `apps/backend/package.json`.

## Testing Requirements

- [x] Unit tests: `apps/backend/src/validation/validate.test.ts` (`node:test` via `tsx --test`) — valid and invalid `ExtractedEventPayload` cases. `apps/web/src/lib/validation/coordinates.schema.test.ts` (Vitest, `vitest-node` preset) — valid and invalid `coordinatesSchema` cases.
- [x] Integration tests: Not applicable — no real feature/API/form consumes these example schemas yet (that begins with Story 3.6 for AJV and Epic 3's form stories for Zod).
- [x] E2E tests: Not applicable — no UI is introduced by this story.
- [x] Manual verification: `pnpm --filter backend test`, `pnpm --filter web test`, `pnpm build`, and `pnpm lint` all pass at the repo root.

## Deliverables Checklist

- [x] `ajv` + `ajv-formats` installed as `apps/backend`-only dependencies, with a working `compileValidator` helper and a passing `node:test` suite.
- [x] `zod` installed as an `apps/web`-only dependency, with a working `coordinatesSchema` example and a passing Vitest suite.
- [x] Repo-wide package-isolation grep audit recorded in Completion Notes, confirming no shared package mixes `ajv` and `zod`.
- [x] Short "Runtime Validation" documentation section added explaining the AJV/Zod split.
- [x] `pnpm test`, `pnpm build`, `pnpm lint` all pass at the repo root.

## Out of Scope

- Any real feature's validation logic (Story 3.6's actual AI-extraction validator, Epic 3's actual API-key/subscription form validation) — this story only establishes the pattern with illustrative examples; those feature stories build the real thing against this pattern.
- The "In-Table Add Form" reusable UI component and its field-level error-message UX — confirmed by Gate 2 to be owned by Epic 3 (Stories 3.1/3.2/3.3), not this story.
- Scaffolding `apps/backend`, `packages/domain`, or `packages/ui` — `apps/backend` is exclusively Story 0.8's scope (this story only adds to it once it exists); `packages/domain`/`packages/ui` remain unscaffolded, owned by their respective future stories (mirrors Stories 0.9/0.10's precedent).
- JSON-Schema-to-TypeScript codegen or any AJV/TypeScript type-generation tooling — not required by `epics.md`'s ACs; the example schema's TypeScript shape is hand-authored, consistent with `@festgrid/shared-types`.
- Adding AJV/Zod to CI as a distinct pipeline step beyond the existing `pnpm test`/`pnpm build`/`pnpm lint` — no `.github/workflows/ci.yml` changes are needed since those steps already exist (Story 0.5) and will pick up the new tests automatically.

## Definition of Done

- [x] AC 1-5 satisfied.
- [x] `pnpm test`, `pnpm lint`, and `pnpm build` all pass at the repo root.
- [x] Lint and type checks passing for all touched packages (`apps/backend`, `apps/web`).
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the Story 0.8 sequencing item.

## Completion Status

- [x] review

## Dev Agent Record

### Agent Model Used
Claude 3.5 Sonnet

### Debug Log References
- Addressed `pnpm filter` requirement: verified packages exist and ran `pnpm --filter backend add ajv ajv-formats` and `pnpm --filter web add zod`.
- Excluded `**/e2e/**` in `vitest-node.ts` and `vitest-react.ts` within `@festgrid/testing-config` to fix an underlying testing configuration issue causing Vitest to inadvertently run Playwright files.

### Completion Notes List
- **Package Isolation Audit**: Created a Node script `temp_grep.js` to search for `"ajv"` and `"zod"` in `packages/*/package.json` and `apps/*/package.json` to verify isolation. 
  Output:
  `apps/backend/package.json`: `"ajv": "^8.20.0"`, `"ajv-formats": "^3.0.1"`
  `apps/web/package.json`: `"zod": "^4.4.3"`
  Neither library exists in any shared `packages/` or cross-contaminated between `apps/`.
- Created Root `README.md` and added "Runtime Validation" section.
- Added `apps/backend/src/validation/validate.ts`, `apps/backend/src/validation/extracted-event.schema.ts`, and test via `tsx --test`. Tests passing.
- Added `apps/web/src/lib/validation/coordinates.schema.ts` and test via `vitest run`. Tests passing.

### File List
- `apps/backend/package.json`
- `apps/backend/src/validation/validate.ts`
- `apps/backend/src/validation/extracted-event.schema.ts`
- `apps/backend/src/validation/validate.test.ts`
- `apps/web/package.json`
- `apps/web/src/lib/validation/coordinates.schema.ts`
- `apps/web/src/lib/validation/coordinates.schema.test.ts`
- `packages/testing-config/vitest-react.ts`
- `packages/testing-config/vitest-node.ts`
- `README.md`
