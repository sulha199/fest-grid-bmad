---
baseline_commit: 0fb6a3eb8a586831b0842fe09b1f6fe7f99cacc7
---

# Story 0.41: Wire up packages/ui's standard ESLint configuration

## Story Details

- Epic: 0
- Story ID: 0.41
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Sourced from backlog.yaml's FIND-036 (created 2026-09-18 while drafting Story 1.i1k; renumbered
from FIND-035). The user already measured and decided the one open question this story's own
AC3 leaves conditional ("fix everything" vs. "ship a scoped override") on 2026-10-06, before
this story file existed: enabling `@festgrid/eslint-config/react-internal` on `packages/ui`
yields 0 errors / 167 warnings across 48 of 198 `src` files, and the decision is to fix every
one of them -- no exception list, `--max-warnings 0` passes from day one. This session
independently re-verified that exact measurement by temporarily swapping the full ruleset into
`packages/ui/eslint.config.mjs` and running `eslint . --max-warnings 0` for real (then
restoring the file via `git checkout`, confirmed clean) -- see Dev Notes.
-->

## Story

As a developer,
I want `packages/ui` to have its own `eslint.config.mjs` (extending `@festgrid/eslint-config/react-internal`, matching every sibling package) and a `lint` script in its `package.json`, with the repo's existing `pnpm run lint`/CI pipeline (`turbo run lint`) actually running it,
so that `packages/ui` — the package every shared UI primitive in this monorepo lives in — gets the same baseline static-analysis coverage every other workspace package (`database`, `domain`, `graphql-select`, `shared-types`, `apps/backend`, `apps/web`) already has, instead of silently having none at all.

## Acceptance Criteria

1. **Given** `packages/ui/package.json` has no `@festgrid/eslint-config` devDependency today and `packages/ui/eslint.config.mjs` currently only registers one narrow, file-scoped custom rule (`local/no-dynamic-tailwind-arbitrary-value`, added by Story 1.i1k) rather than the project's standard ruleset,
   **When** this story ships,
   **Then** `packages/ui/eslint.config.mjs` spreads `@festgrid/eslint-config/react-internal`'s exported `config` array (the export documented as "for libraries that use React" — matches `packages/ui`'s own nature exactly, and is not yet used by any other package in the monorepo today), and `packages/ui/package.json` gains `"@festgrid/eslint-config": "workspace:*"` as a devDependency — the exact same range (`workspace:*`, not a semver range) every sibling package (`database`, `domain`, `graphql-select`, `shared-types`, `apps/backend`, `apps/web`) already uses for this dependency.
2. **And** `packages/ui`'s existing `"lint": "eslint . --max-warnings 0"` script (already present since Story 1.i1k) is unchanged, and running it (`pnpm --filter @festgrid/ui lint`, and therefore `pnpm run lint` / CI's existing `Run lint` step via `turbo run lint`) actually executes the now-full ruleset and passes with zero warnings against the real, current `packages/ui` source tree.
3. **And** every one of the 167 pre-existing warnings (0 errors) the newly-enabled ruleset surfaces across 48 of `packages/ui`'s 198 real `src` files is fixed as a real source change — **no exception list, no rule downgraded to `warn`, no `ignores` added on any real source directory.** This resolves AC3's original either/or (epics.md Story 0.41) in favor of "fix everything": a user decision made and measured on 2026-10-06, before this story file existed (see Dev Notes' "2026-10-06 decision" and "Verified violation inventory"). The one path this AC does **not** sanction is leaving any of the 167 as a suppressed/deferred warning.
4. **And** Story 1.i1k's own narrow, file-scoped `no-dynamic-tailwind-arbitrary-value` custom rule (already in `packages/ui/eslint.config.mjs`, `files: ['src/features/events/**/*.{ts,tsx}']`, with its `ignores: ['src/features/events/InstagramEmbed.tsx']` entry) continues to apply completely unchanged — this story appends `react-internal`'s config array alongside that existing block in the same file; it does not replace, reorder in a way that changes merge semantics, or narrow it. (Verified directly this session: spreading `react-internal`'s config ahead of the existing custom-rule block and running the real lint reproduces the exact same 167-warning/0-error result with no "unknown rule" or duplicate-plugin errors — the custom block's own `plugins`/`rules` keys merge additively with the preceding config objects in flat-config's array-merge semantics, they don't get clobbered.)
5. **And** this story adds zero new application/business logic — every one of the 167 fixes is a real, behavior-preserving source change (narrowing an `any` to a concrete/narrower type, removing a genuinely-unused variable/import, converting a `require()` call to an ESM `import`, correcting a `useEffect`/`useMemo`/`useCallback` dependency array, removing `this`-aliasing, replacing the bare `Function` type, removing an empty block statement, etc.) — not a UI/UX/business-logic change. The one category with a genuine (if small) runtime-behavior-change risk is `react-hooks/exhaustive-deps` (4 occurrences): adding a missing dependency to a hook's array can change when that hook re-fires. Each of those 4 fixes must be verified against `packages/ui`'s existing test suite (`pnpm --filter @festgrid/ui test`) to confirm no behavioral regression, not merely silenced.
6. **And** the `pnpm-lock.yaml` diff produced by adding this one new devDependency is limited to `packages/ui`'s own importer entry (a new `devDependencies['@festgrid/eslint-config']: { specifier: workspace:*, version: link:../eslint-config }` block) — no other importer's entries change, and no new package version is added to the lockfile's `packages:` section, since every one of `@festgrid/eslint-config`'s own transitive dependencies is already resolved identically for its existing consumers (`domain`, `database`, `graphql-select`, `shared-types`, `apps/backend`, `apps/web`).
7. **And** `pnpm --filter @festgrid/ui test` and `tsc --noEmit` (for `packages/ui`) are re-run before/after this story's changes and show no new failures: the existing test suite stays green, and any pre-existing `tsc` errors (currently 115 with `--ignoreDeprecations 6.0` — unrelated `require`/`process`/`global` ambient-type gaps in test files and pre-existing prop-type mismatches, none caused by or in scope for this story's ESLint-config wiring) are unchanged in count/identity by a before/after diff, not newly introduced by this story's fixes.

## Tasks / Subtasks

- [ ] Task 1: Wire the dependency and config (AC1, AC4, AC6)
  - [ ] 1.1 Add `"@festgrid/eslint-config": "workspace:*"` to `packages/ui/package.json`'s `devDependencies` (alphabetically sorted alongside the existing `@festgrid/testing-config`/`@festgrid/typescript-config` entries).
  - [ ] 1.2 Update `packages/ui/eslint.config.mjs`: add `import { config as reactInternalConfig } from '@festgrid/eslint-config/react-internal';` and prepend `...reactInternalConfig` to the exported array, ahead of the existing `no-dynamic-tailwind-arbitrary-value` config object (which stays byte-for-byte unchanged otherwise).
  - [ ] 1.3 Run the targeted, minimal-diff dependency install for this one new workspace link (e.g. `pnpm install --filter @festgrid/ui...` or equivalent scoped invocation) — **never** a bare unfrozen repo-wide `pnpm install`. Confirm via `git diff pnpm-lock.yaml` that the only change is the new `packages/ui` importer entry for `@festgrid/eslint-config` (AC6) — no other importer block, no new `packages:` entry.
- [ ] Task 2: Fix every `@typescript-eslint/no-explicit-any` warning (AC3, AC5) — 96 occurrences, the largest category, concentrated in `src/hooks/*.test.ts(x)` (mock typings), `useWeeklyCalendarController.ts`/`.types.ts` (controller return-value typing), and scattered `src/core`/`src/features` files. Replace each `any` with the real/narrowest correct type (prefer the actual prop/return type already defined elsewhere in the file or its imports over a new `unknown`-and-cast escape hatch).
- [ ] Task 3: Fix every `@typescript-eslint/no-unused-vars` warning (AC3, AC5) — 29 occurrences. Remove genuinely-dead variables/imports/params; for an intentionally-unused destructured/callback param that must stay for signature shape, prefix with `_` (already-recognized convention for this rule) instead of leaving it bare.
- [ ] Task 4: Fix every `@typescript-eslint/no-require-imports` warning (AC3, AC5) — 9 occurrences. Convert each `require(...)` call (found in test-file mocking, e.g. `EventDiscoveryPanel.test.tsx`) to an ESM `import`/`vi.mock` pattern already used elsewhere in this package's test suite.
- [ ] Task 5: Fix every `react-hooks/exhaustive-deps` warning (AC3, AC5) — 4 occurrences. For each, add the missing dependency and then run that specific component/hook's test file to confirm no new re-render/re-fetch regression; do not silence with an `eslint-disable` comment.
- [ ] Task 6: Fix every `no-this-alias` (4), `@typescript-eslint/no-unsafe-function-type` (4, the bare `Function` type), and `no-empty` (4) warning (AC3, AC5) — all mechanical, no behavior change expected.
- [ ] Task 7: Fix the remaining smaller categories found in the real verification run (AC3, AC5): `turbo/no-undeclared-env-vars` (4, all in `src/features/events/combineDateTime.test.ts` — `TZ` env var not declared in `turbo.json`'s `test` task's `env` array; add it there, matching the existing env-list convention), `react-hooks/rules-of-hooks` (3), `react/prop-types` (2), `@typescript-eslint/prefer-as-const` (2), `react/no-unescaped-entities` (1), and the 5 unattributed warnings (3 stale `eslint-disable-next-line react-hooks/exhaustive-deps` directives left over from before this package had a working ruleset to resolve them against, plus 2 `no-bitwise`/`no-console` stale directives — remove each stale directive rather than leaving it).
- [ ] Task 8: Verification pass (AC2, AC5, AC6, AC7)
  - [ ] 8.1 Run `pnpm --filter @festgrid/ui lint` — confirm `0 errors, 0 warnings` (AC2, AC3).
  - [ ] 8.2 Run `pnpm --filter @festgrid/ui test` — confirm the full existing suite is green, with particular attention to the test files touching the 4 `react-hooks/exhaustive-deps` fixes (AC5).
  - [ ] 8.3 Run `tsc --noEmit` for `packages/ui` (with `--ignoreDeprecations 6.0`, matching this package's pre-existing `tsconfig.json` baseUrl situation) before and after this story's changes; diff the two outputs and confirm zero new errors (AC7). Do not attempt to fix any of the pre-existing ~115 errors — out of scope (see Out of Scope).
  - [ ] 8.4 Confirm `git diff pnpm-lock.yaml` is limited to the single new `packages/ui` importer entry (AC6).

## Dev Notes

- **2026-10-06 decision (resolves epics.md Story 0.41's AC3 either/or):** the user already measured and decided, before this story file existed, that the volume (167 warnings, 0 errors, across 48/198 files) is fixed in full — no scoped/temporary override, no exception list. This story's own AC3/AC5 above encode that decision directly; do not re-open it or propose a partial/override alternative during implementation.
- **Verified violation inventory (re-confirmed this session, not just taken on the user's word):** this session temporarily spread `@festgrid/eslint-config/react-internal`'s config into `packages/ui/eslint.config.mjs` (ahead of the existing custom-rule block, exactly as Task 1.2 specifies) and ran `pnpm exec eslint . --max-warnings 0` for real inside `packages/ui`, then restored the file via `git checkout -- packages/ui/eslint.config.mjs` (confirmed clean via `git status --porcelain` afterward — no stray diff left behind). Real result: **167 problems, 0 errors, 167 warnings, across 48 files** (exactly matching the user's measurement). Full category breakdown from that real run: `@typescript-eslint/no-explicit-any` 96, `@typescript-eslint/no-unused-vars` 29, `@typescript-eslint/no-require-imports` 9, `react-hooks/exhaustive-deps` 4, `@typescript-eslint/no-this-alias` 4, `@typescript-eslint/no-unsafe-function-type` 4, `no-empty` 4, `turbo/no-undeclared-env-vars` 4, `react-hooks/rules-of-hooks` 3, `react/prop-types` 2, `@typescript-eslint/prefer-as-const` 2, `react/no-unescaped-entities` 1, plus 5 unattributed (stale `eslint-disable` directives / bare message lines in the CLI output with no inline rule id — all traced to specific rule contexts during the real run, see Tasks 6-7). The user's own summary ("96/29/9/4-each/5 unattributed") covers the five largest buckets; the smaller `turbo`/`rules-of-hooks`/`prop-types`/`prefer-as-const`/`no-unescaped-entities` categories (12 warnings total) are real and must be fixed too — they are simply not called out individually in the dispatching command's summary. Nothing here is estimated; every number above came from a real `eslint` run against the real current source tree, not from re-deriving or trusting the September measurement blind.
- **`packages/ui/eslint.config.mjs` merge mechanics confirmed safe (AC4):** prepending `...reactInternalConfig` ahead of the existing `no-dynamic-tailwind-arbitrary-value` config object in the exported array does not break or shadow that custom rule — ESLint flat config merges array entries by `rules`/`plugins` key additively across all matching config objects for a given file, it does not let an earlier object's absence of a key erase a later object's presence of that key. The real verification run reproduced the identical 167/0 result with the custom rule's own config object present and unmodified, and zero "unknown rule"/"duplicate plugin" errors — confirming the two config layers coexist cleanly exactly as they will ship.
- **`tsc --noEmit` baseline (AC7, out-of-scope boundary):** running `tsc --noEmit` for `packages/ui` without `--ignoreDeprecations 6.0` stops immediately after a single `TS5101` (`baseUrl` deprecated) diagnostic and never reaches the rest of the codebase's type errors. With `--ignoreDeprecations 6.0` (the flag Story 1.i1k's own verification pass already established as this package's correct invocation), the real current count is **115 pre-existing errors** (re-measured this session, not reused from Story 1.i1k's September figure of 207 — the difference reflects intervening stories' own fixes, not a regression). These are unrelated to this story (ambient `require`/`process`/`global` Node-type gaps in test files, pre-existing mock/prop-type mismatches in `FilterHub.test.tsx`/`EventDiscoveryPanel.test.tsx`, etc.) — **not in scope to fix here.** This story's own Definition of Done is "zero *new* type errors introduced," verified by a before/after diff of the full error list, never "zero errors overall."
- **`turbo/no-undeclared-env-vars` fix location (Task 7):** the 4 occurrences are all in `src/features/events/combineDateTime.test.ts`, which deliberately mutates `process.env.TZ` (in an isolated single-test file, per that file's own extensive docstring on `Intl`/V8 timezone-caching) to reproduce a timezone-dependent bug. `TZ` is not currently listed in any of `turbo.json`'s task `env` arrays. The correct fix is adding `"TZ"` to the `test` task's `env` array in root `turbo.json` (where `BACKEND_PORT`/`DATABASE_URL`/etc. already live) — not to the `lint` task's own list, since `TZ` is read at test-runtime, not lint-time; the ESLint rule still clears once it's declared anywhere relevant to this package's task graph. Confirmed this is a pre-existing, mechanical declare-the-var fix (not a new foundational gap) by Gate 3 below.

### Architecture & UX Gate Findings

- No `epic-{N}-readiness.md` sweep covers this story — `epic-0-readiness.md`'s `swept: true` report's `stories_covered` list stops at `0.19`, well short of `0.41`. Per `story-split-gate.md`, all three gates were run fresh this session (not skipped/cited from a sweep).
- **Gate 1 (Architecture/Infrastructure Completeness, Winston lens, run fresh):** **No gap found.** The story adds no DB/ORM calls, no direct third-party service calls, no new API surface (resolver/query/mutation), no auth/secrets/business-rule logic, and no new infra dependency — it's config wiring (`eslint.config.mjs`, one devDependency) plus mechanical lint fixes. The one theoretical risk pattern — a lint-driven fix touching a file that itself calls backend/DB/GraphQL code — is low severity: fixes only tighten types or remove dead code in files `packages/ui` already owns; `packages/ui` as a presentational component library has no legitimate direct DB/backend call path to begin with, so lint surfacing one would be a pre-existing violation the story merely reveals, not a new layer-bypass it introduces. Not a blocker.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston lens, run fresh):** **No gap found.** `@festgrid/eslint-config` (including the `react-internal` export specifically) is already a built, established foundation — consumed today by `database`, `domain`, `graphql-select`, `shared-types`, `apps/backend`, `apps/web`. Story 0.41 is the Nth adopter, not the first; nothing new is being built here. The 167 warnings all fall into self-contained, mechanical ESLint/TypeScript categories — none implies a missing shared type, missing i18n/analytics wiring, or any other unbuilt foundation. The one borderline item (`turbo/no-undeclared-env-vars` possibly needing a `turbo.json` edit) uses a list-entry mechanism that already exists and is already used project-wide (see Dev Notes above) — a mechanical fix within this story, not a new foundational dependency.
- **Gate 2 (UI Complexity & Reusability, Freya lens, run fresh — no DESIGN.md/EXPERIENCE.md load needed, see below):** **No gap found.** This story introduces no new component, hook, prop, variant, visual state, or user-facing behavior — it is mechanical remediation of existing, already-shipped code. The 4 `react-hooks/exhaustive-deps` fixes correct dependency arrays on hooks that already exist and are already in use; aligning a hook's deps array to its already-intended behavior is not "introducing or modifying a complex hook" in the Gate 2 sense. Touching 48 files is breadth of a known, already-built package, not evidence of a hidden "never properly scoped" component. No DESIGN.md/EXPERIENCE.md visual/interaction surface is implicated since nothing user-facing changes — this story has zero UI scope in the Gate-2 sense, which is why DESIGN.md/EXPERIENCE.md/EVENT-CARD-DESIGN.md were not loaded for this story (consistent with Story 0.40's own precedent for a story with zero UX-artifact-relevant surface).
- **Lightweight escape-hatch guard:** reasoned through whether this story's scope contains anything an epic-wide sweep plausibly wouldn't have anticipated (new external service, new data entity, new infra dependency) — it does not; this is a closed-scope, fully-measured tooling/lint-config change with no external dependencies beyond the already-established `@festgrid/eslint-config`. No further gate re-run warranted.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story is ESLint config wiring plus lint-violation remediation in `packages/ui` only — no Drizzle schema change, no `packages/database` migration, no `@festgrid/shared-types` change, and no GraphQL contract change.
- Impacted fields/contracts: None. (The `any`-to-concrete-type narrowing fixes in Task 2 are purely local type annotations — they do not change any DB column, API payload shape, or exported shared type.)
- Required DB migration changes: None.
- Required TypeScript type changes: None to any shared/domain/database type. Every type narrowing in Task 2 is internal to `packages/ui`'s own local types/props/mocks.
- Backward compatibility and rollout notes: Purely additive/internal — no runtime contract with `apps/web` or `apps/backend` changes. The only categories with any runtime-behavior risk at all (the 4 `react-hooks/exhaustive-deps` fixes) are scoped entirely within `packages/ui`'s own components/hooks and verified via that package's own existing test suite (AC5, Task 8.2) — no cross-package rollout concern.
- Verification checks: `pnpm --filter @festgrid/ui test` and `tsc --noEmit` before/after diff (AC7, Task 8.2-8.3) serve as the end-to-end proof that no type or runtime-behavior drift was introduced.

### Project Structure Notes

- All changes are confined to `packages/ui/eslint.config.mjs`, `packages/ui/package.json`, `pnpm-lock.yaml` (the one new importer entry), `turbo.json` (one `env` array entry, Task 7), and the 48 `packages/ui/src` files Task 2-7 touch. No new files, directories, or package-export entries are introduced.
- No conflict with `packages/ui`'s existing structure conventions (`src/core/`, `src/features/<domain>/`, `src/hooks/`) — every one of the 48 files already lives in one of these existing locations; this story edits in place, it does not relocate or restructure anything.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.41] — originating AC/Note text.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#FIND-036] — promoted backlog row (status: `promoted`, `stories: [0-41-wire-up-packages-ui-eslint-configuration]` already recorded).
- [Source: _bmad-output/implementation-artifacts/backlog/FIND-036-packages-ui-no-lint-config.md] — full finding capture/history, including the FIND-035→FIND-036 renumber and the Story 0.40→0.41 renumber (both collision-resolution precedents from concurrent sessions landing on master).
- [Source: _bmad-output/implementation-artifacts/1-i1k-give-eventcarddatebox-the-design-specified-two-tier-chrome.md#Task 6, #Dev Notes] — the story that gave `packages/ui` its first-ever (deliberately minimal) `eslint.config.mjs`/`lint` script and explicitly deferred the full-ruleset gap to this story.
- [Source: packages/eslint-config/react-internal.js] — the exact config array this story wires in (`@eslint/js` recommended, `eslint-config-prettier`, `typescript-eslint` recommended, `eslint-plugin-react` flat recommended, `eslint-plugin-react-hooks` recommended, React-version auto-detect, `react/react-in-jsx-scope` off).
- [Source: packages/domain/eslint.config.mjs, packages/graphql-select/eslint.config.mjs, pnpm-lock.yaml#packages/domain] — sibling-package precedent for the `@festgrid/eslint-config` devDependency range (`workspace:*`) and lockfile importer-entry shape this story must match.
- [Source: _bmad-output/project-context.md#Shared Linting & TypeScript Base Configurations] — "All workspace packages must extend the global linting flat configurations from `@festgrid/eslint-config`."
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and execution protocol applied fresh above.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical section order and status vocabulary this file follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Shared Linting & TypeScript Base Configurations" rule (all workspace packages must extend `@festgrid/eslint-config`), Code Organization (packages/ui component placement, unaffected by this story), Testing Rules (this story doesn't add domain logic, so the 100%-coverage rule doesn't newly apply; existing `packages/ui` tests must stay green per AC5/AC7).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — no direct feature/business-logic requirement is implicated by a pure tooling/lint-config story; cited for completeness per the project's mandatory-reference rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section is implicated by a pure ESLint-config/tooling change (no API, data, or infra architecture decision is touched or overridden); cited for completeness per the project's mandatory-reference rule, full file not loaded (no AD lookup was needed).
- [x] `docs/infrastructure/index.md` — not applicable (no backend compute, queue, EventBridge, API Gateway, or DB-provisioning change); confirmed via the index summary, full shard files not loaded (per persistent-fact token-efficiency guidance for a frontend/tooling-only story with no infra touch).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `packages/ui/package.json` — add `"@festgrid/eslint-config": "workspace:*"` to `devDependencies` (Task 1.1).
- `packages/ui/eslint.config.mjs` — add the `react-internal` import and spread it ahead of the existing custom-rule config object (Task 1.2); no other line in this file changes.
- `pnpm-lock.yaml` — one new importer entry under `packages/ui.devDependencies` for `@festgrid/eslint-config` (Task 1.3); no other importer or `packages:` entry changes.
- `turbo.json` — add `"TZ"` to the `test` task's `env` array (Task 7).
- The 48 `packages/ui/src` files listed in the Dev Notes' verified violation inventory (full file list captured in this session's verification run; representative spread: `src/core/*.test.tsx`, `src/core/grid-container.tsx`, `src/core/map.tsx`, `src/core/ui/calendar.tsx`, `src/core/wizard/WizardStepSummary.tsx`, `src/features/events/*.tsx`/`*.test.tsx`/`format-event-date.ts`/`combineDateTime.test.ts`, `src/features/locations/LocationPickerField.test.tsx`, `src/features/subscriptions/SubscribedAccountCard.tsx`, `src/hooks/*.ts`/`*.test.ts(x)`) — each gets only the minimal fix for its specific violation(s) (Tasks 2-7); no unrelated refactor.

### Rule Mapping

- AC1/AC6 → Task 1 (dependency + lockfile diff scope).
- AC2 → Task 8.1 (`pnpm --filter @festgrid/ui lint` passes clean).
- AC3/AC5 → Tasks 2-7 (every warning category fixed as a real source change, no suppression).
- AC4 → Task 1.2 + Dev Notes' merge-mechanics confirmation (custom rule preserved, verified by the real run reproducing the identical 167/0 result).
- AC7 → Task 8.2/8.3 (test suite green, `tsc --noEmit` before/after diff shows zero new errors).

### Verification Plan

- `pnpm --filter @festgrid/ui lint` → `0 errors, 0 warnings` (AC2, AC3).
- `pnpm --filter @festgrid/ui test` → full existing suite green, no new failures, with explicit attention to the 4 files touched by the `exhaustive-deps` fixes (AC5).
- `tsc --noEmit` (packages/ui, `--ignoreDeprecations 6.0`) before vs. after diff → zero new errors; pre-existing ~115 count/identity unchanged (AC7).
- `git diff pnpm-lock.yaml` → confined to the single `packages/ui` importer entry (AC6).
- All four run in the foreground, targeted/package-scoped (`--filter @festgrid/ui`, or `cd packages/ui &&`), never a bare repo-wide `pnpm install`/`pnpm run lint`/`pnpm test`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — fix all 167 warnings (no exception list), per the 2026-10-06 user decision and this session's independent re-verification.
- [ ] Architecture and boundary confirmation — Gate 1/2/3 all cleared fresh this session (no gap found); no prerequisite story required.
- [ ] Testing plan confirmation — existing `packages/ui` test suite + `tsc --noEmit` before/after diff is the verification mechanism (no new tests required; this story adds no new logic).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, no gap found by any gate.

## Testing Requirements

- [ ] `pnpm --filter @festgrid/ui test` passes in full, including the files touched by the 4 `react-hooks/exhaustive-deps` fixes (regression check, not new test authorship — this story adds zero new logic, so no new test cases are required by `project-context.md`'s Testing Rules).
- [ ] `tsc --noEmit` for `packages/ui` before/after diff shows zero new errors (AC7).
- [ ] E2E: not applicable — no user-facing behavior changes.

## Deliverables Checklist

- [ ] `packages/ui/eslint.config.mjs` extends `@festgrid/eslint-config/react-internal` alongside the unchanged `no-dynamic-tailwind-arbitrary-value` custom rule.
- [ ] `packages/ui/package.json` carries the new `@festgrid/eslint-config` devDependency (`workspace:*`).
- [ ] `pnpm-lock.yaml` diff limited to that one new importer entry.
- [ ] `turbo.json`'s `test` task `env` array includes `TZ`.
- [ ] All 167 warnings fixed in source (0 remaining), `pnpm --filter @festgrid/ui lint` passes with `--max-warnings 0`.
- [ ] `pnpm --filter @festgrid/ui test` green; `tsc --noEmit` before/after diff clean.

## Out of Scope

- Fixing any of the ~115 pre-existing `tsc --noEmit` errors in `packages/ui` unrelated to this story's ESLint-config wiring (ambient Node-type gaps in test files, pre-existing mock/prop-type mismatches) — a separate, unbounded-size type-hygiene concern, not this story's scope (AC7, Dev Notes).
- Any change to `packages/ui`'s existing `no-dynamic-tailwind-arbitrary-value` custom rule's logic, scope, or `ignores` list — it ships unchanged (AC4).
- Enabling the full ruleset on any other package — every sibling package already has it; this story is `packages/ui`-only.
- No Gate 1/2/3 gap was found, so no prerequisite story/backlog entry/epics.md addition was required by this story.

## Definition of Done

- [ ] All Acceptance Criteria (1-7) satisfied.
- [ ] `pnpm --filter @festgrid/ui lint` passes with `0 errors, 0 warnings`.
- [ ] `pnpm --filter @festgrid/ui test` passes (no new failures vs. baseline).
- [ ] `tsc --noEmit` for `packages/ui` introduces zero new errors vs. the pre-story baseline (pre-existing count not required to reach zero).
- [ ] `pnpm-lock.yaml` diff confined to the single new `packages/ui` importer entry for `@festgrid/eslint-config`.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
