---
baseline_commit: 74e6d915f694338994915713d14f8bff16f1f284
---

# Story 0.22: Build the shared active-rows query-filter helper for AD-8

## Story Details

- Epic: 0
- Story ID: 0.22
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a single shared `activeOnly(table)` Drizzle where-fragment helper (`packages/graphql-select`) that every resolver imports instead of hand-writing `isNull(table.deletedAt)`, backed by a lint rule that makes the convention non-optional,
so that AD-8 rule 2's "enforced once, never per-resolver" requirement is actually true, rather than the seven independent hand-written call sites it is today — and stays true as future resolvers (Epic 3/4's `subscriptions`/`apiKeys` mutations) get built.

## Acceptance Criteria

1. **Given** AD-8 rule 2 (Architecture Spine), **when** a resolver needs to exclude soft-deleted rows, **then** it imports `activeOnly(table)` from `@festgrid/graphql-select` rather than writing `isNull(table.deletedAt)` inline. [epics.md AC1]
2. **And** the six existing hand-written sites in `apps/backend/src/schema/resolvers.ts` (favorites/calendarAdditions filtering) are retrofitted to use the helper — behavior-preserving, no functional change, pure refactor. [epics.md AC2]
3. **And** `myLocations`'s hand-written `isNull(userLocations.deletedAt)` filter is retrofitted to use the helper too, once sequenced against this story. [epics.md AC3]
4. **And** the helper works both for resolvers going through the Unified Query DSL (`buildDrizzleWhere`/`buildOptimizedDrizzleSelect`, AD-1/AD-2) and hand-written Drizzle queries like `myLocations` that don't — a plain composable where-fragment (`and(activeOnly(table), otherCondition)`), not DSL-coupled. [epics.md AC4]
5. **Given** a future resolver in `apps/backend/src/**` hand-writes `isNull(someTable.deletedAt)` instead of importing `activeOnly(someTable)`, **when** `pnpm --filter backend run lint` runs, **then** it fails with a `no-restricted-syntax` violation naming `activeOnly` as the required replacement — the "enforced once" guarantee is backed by tooling, not just code-review convention. [Added per Gate 3 finding, user-confirmed 2026-08-06: a plain exported helper that resolvers merely *choose* to import remains opt-in, not enforced, and would silently regress the moment Epic 3/4 adds `subscriptions`/`apiKeys` resolvers]
6. **Given** the new `no-restricted-syntax` lint rule, **when** a file calls `activeOnly(table)` (the sanctioned helper) or `isNull(...)` on a non-`deletedAt` column, **then** the rule does not fire — it targets the exact `isNull(*.deletedAt)` pattern only, never a false positive on unrelated `isNull` usage. [Added per Gate 3 finding — precision requirement so the rule doesn't become noisy/disabled]

## Tasks / Subtasks

- [x] Task 1: Add the `activeOnly(table)` helper to `packages/graphql-select` (AC: 1, 4)
  - [x] Create `packages/graphql-select/active-only.ts` (package convention: files live at package root, no `src/` subfolder — matches `drizzle-where.ts`/`optimized-select.ts`, not `packages/domain`'s `src/query/` convention):
    ```ts
    import { isNull, SQL } from "drizzle-orm";
    import { PgColumn, PgTable } from "drizzle-orm/pg-core";

    export function activeOnly<T extends PgTable & { deletedAt: PgColumn }>(table: T): SQL {
      return isNull(table.deletedAt);
    }
    ```
    The generic constraint `T extends PgTable & { deletedAt: PgColumn }` is what makes this "generic, strictly-typed" per `project-context.md`'s `buildOptimizedDrizzleSelect` precedent: it only accepts tables that actually declare a `deletedAt` column (compile-time safety — calling `activeOnly(events)` today would be a type error, correctly reflecting that `events` has no `deletedAt` column yet), while still being fully composable with plain `and(...)`/`or(...)` — no DSL/`QueryCondition` coupling, satisfying AC4.
  - [x] Add `export * from './active-only.js';` to `packages/graphql-select/index.ts` (alongside the existing `optimized-select.js`/`drizzle-where.js` re-exports).
  - [x] Add `packages/graphql-select/active-only.test.ts` (mirrors `drizzle-where.test.ts`'s `node:test`/`node:assert` pattern, a local `pgTable` test fixture, no DB connection needed since this only builds SQL fragments): assert `activeOnly(testTableWithDeletedAt)` returns a defined `SQL` object, and assert it composes correctly inside `and(activeOnly(table), eq(table.userId, 'x'))` without throwing.
- [x] Task 2: Retrofit the six `favorites`/`calendarAdditions` call sites in `apps/backend/src/schema/resolvers.ts` (AC: 1, 2, 6)
  - [x] Add `activeOnly` to the existing `import { buildOptimizedDrizzleSelect, buildDrizzleWhere } from '@festgrid/graphql-select'` line (→ `import { buildOptimizedDrizzleSelect, buildDrizzleWhere, activeOnly } from '@festgrid/graphql-select'`).
  - [x] Replace all six occurrences of the pattern, each **exactly** in place (do not restructure the surrounding `and(...)` calls — behavior-preserving pure refactor per AC2):
    - Line ~451: `isNull(favorites.deletedAt)` → `activeOnly(favorites)` (inside the `isFavorited` EXISTS-subquery field-map entry).
    - Line ~460: `isNull(calendarAdditions.deletedAt)` → `activeOnly(calendarAdditions)` (`isAddedToCalendar` EXISTS-subquery field-map entry).
    - Line ~503: `isNull(favorites.deletedAt)` → `activeOnly(favorites)` (the conditional `leftJoin(favorites, and(..., ...))` for `sortByFavoritedAt`).
    - Line ~590: `isNull(favorites.deletedAt)` → `activeOnly(favorites)` (`Event.isFavorited` field resolver).
    - Line ~605: `isNull(calendarAdditions.deletedAt)` → `activeOnly(calendarAdditions)` (`Event.isAddedToCalendar` field resolver).
    - Line ~622: `isNull(calendarAdditions.deletedAt)` → `activeOnly(calendarAdditions)` (`Schedule.isAddedToCalendar` field resolver).
  - [x] After the retrofit, `isNull` should no longer appear anywhere in `resolvers.ts` used against a `.deletedAt` column — confirm via `grep -n "isNull" apps/backend/src/schema/resolvers.ts` (any remaining `isNull` import usage, if none remains, remove `isNull` from the `drizzle-orm` import line too — check first, since `myLocations` in Task 3 also uses it).
- [x] Task 3: Retrofit `myLocations` (AC: 1, 3, 4)
  - [x] In `myLocations` (`apps/backend/src/schema/resolvers.ts` ~line 346-350), replace `.where(and(eq(userLocations.userId, authUser.userId), isNull(userLocations.deletedAt)))` with `.where(and(eq(userLocations.userId, authUser.userId), activeOnly(userLocations)))`. This is the hand-written, non-DSL query path AC4 requires the helper to also support.
  - [x] Once both Task 2 and Task 3 are done, remove `isNull` from the `import { eq, count, sql, asc, and, exists, isNull, desc } from 'drizzle-orm'` line at the top of `resolvers.ts` (no remaining callers) — an unused import would otherwise fail lint on its own.
- [x] Task 4: Add the `no-restricted-syntax` ESLint enforcement rule (AC: 5, 6)
  - [x] In `apps/backend/eslint.config.mjs`, add a new config object scoped to `files: ["src/**/*.ts"]` (do not add this to the shared `@festgrid/eslint-config/base.js` — it must not apply to `packages/graphql-select`, where `active-only.ts`'s own implementation legitimately calls `isNull(table.deletedAt)`; scoping it only in `apps/backend`'s own config, which `packages/graphql-select` never imports, is what avoids needing a carve-out exception):
    ```js
    import { config as baseConfig } from "@festgrid/eslint-config/base";

    /** @type {import("eslint").Linter.Config[]} */
    export default [
      ...baseConfig,
      {
        ignores: ["dist/", "src/generated/"],
      },
      {
        files: ["src/**/*.ts"],
        rules: {
          "no-restricted-syntax": [
            "error",
            {
              selector: "CallExpression[callee.name='isNull'] Identifier[name='deletedAt']",
              message:
                "Do not hand-write isNull(table.deletedAt) — import activeOnly(table) from '@festgrid/graphql-select' instead (AD-8 rule 2).",
            },
          ],
        },
      },
    ];
    ```
    The selector matches only `isNull(...)` calls whose argument subtree contains an `Identifier` named `deletedAt` (i.e. a `<table>.deletedAt` member access) — it does not match `isNull(someOtherColumn)` or any call to `activeOnly(...)`, satisfying AC6's precision requirement. Note this repo's flat config layers `eslint-plugin-only-warn` (in `base.js`), which downgrades every rule's reported severity to `warn` regardless of how it's declared here — this is expected and matches every other rule in the repo; `--max-warnings 0` (already in `apps/backend/package.json`'s `lint` script) still fails CI on any occurrence, so declaring the rule at `"error"` here is correct and consistent with existing rules in this config.
  - [x] Add `"eslint": "^9.9.0"` to `apps/backend/package.json`'s `devDependencies` (currently only pulled in transitively via `@festgrid/eslint-config`; Task 5's fixture test needs to `import { ESLint } from 'eslint'` directly from `apps/backend`, and this repo's pnpm workspace uses strict, non-hoisting node_modules — an undeclared transitive dependency would not resolve).
- [x] Task 5: Fixture test proving the lint rule fires (and doesn't false-positive) (AC: 5, 6)
  - [x] Create `apps/backend/src/eslint-enforcement.test.ts` using `node:test`/`node:assert` and ESLint's Node API (`import { ESLint } from 'eslint'`), loading the real `apps/backend/eslint.config.mjs` via `overrideConfigFile`:
    ```ts
    import test from 'node:test';
    import * as assert from 'node:assert';
    import { ESLint } from 'eslint';
    import * as path from 'node:path';

    test('AD-8 rule 2 lint enforcement (Story 0.22)', async (t) => {
      const eslint = new ESLint({
        overrideConfigFile: path.resolve(process.cwd(), 'eslint.config.mjs'),
      });

      await t.test('flags a hand-written isNull(table.deletedAt) call', async () => {
        const results = await eslint.lintText(
          `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\nconst w = isNull(favorites.deletedAt);\n`,
          { filePath: path.resolve(process.cwd(), 'src/schema/__lint_fixture__.ts') }
        );
        const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
        assert.strictEqual(violations.length, 1);
      });

      await t.test('does not flag activeOnly(table) usage', async () => {
        const results = await eslint.lintText(
          `import { activeOnly } from '@festgrid/graphql-select';\nimport { favorites } from '@festgrid/database';\nconst w = activeOnly(favorites);\n`,
          { filePath: path.resolve(process.cwd(), 'src/schema/__lint_fixture__.ts') }
        );
        const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
        assert.strictEqual(violations.length, 0);
      });

      await t.test('does not flag isNull on an unrelated column', async () => {
        const results = await eslint.lintText(
          `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\nconst w = isNull(favorites.eventId);\n`,
          { filePath: path.resolve(process.cwd(), 'src/schema/__lint_fixture__.ts') }
        );
        const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
        assert.strictEqual(violations.length, 0);
      });
    });
    ```
  - [x] The `filePath` passed to `lintText` must resolve under `src/` (matching the rule's `files: ["src/**/*.ts"]` scope) for ESLint to apply the new override at all — a `filePath` outside `src/` would silently skip the rule and produce a false-negative test.
- [ ] Task 6: Verification (AC: 1-6)
  - [ ] `pnpm --filter backend exec tsx --test src/schema/favorites-and-calendar.test.ts src/schema/user-locations.test.ts` still passes unchanged (behavior-preserving refactor proof for AC2/AC3 — same assertions, same results, against the real local Postgres instance).
  - [ ] `pnpm --filter graphql-select run test` passes (new `active-only.test.ts`, Task 1).
  - [ ] `pnpm --filter backend exec tsx --test src/eslint-enforcement.test.ts` passes (Task 5).
  - [ ] `pnpm --filter backend run lint` passes cleanly (confirms the retrofit left zero raw `isNull(*.deletedAt)` call sites in `apps/backend/src/**`, since the rule now fails the build if any remain).
  - [ ] `pnpm build` and `pnpm lint` pass cleanly at the repo root.

## Dev Notes

- **This story closes a real, already-shipped compliance gap in AD-8 rule 2** — the architecture spine (`festgrid-architecture-spine.md` AD-8 rule 2) explicitly documents that, as of its 2026-08-06 revision, the "enforced once, never per-resolver" claim is **not true today**: `packages/graphql-select` has no `deletedAt` awareness at all, and seven hand-written `isNull(table.deletedAt)` call sites exist across `apps/backend/src/schema/resolvers.ts` (six in favorites/calendarAdditions filtering, plus `myLocations`). This story is the spine's own named "required fix," not new scope this story invented.
- **Verified exact call-site count via direct grep of `resolvers.ts`** (not assumed from the spine's prose): `isNull(favorites.deletedAt)` at lines ~451, ~503, ~590; `isNull(calendarAdditions.deletedAt)` at lines ~460, ~605, ~622 (six total, matching epics.md AC2's "six existing hand-written sites"); plus `isNull(userLocations.deletedAt)` at line ~349 inside `myLocations`, called out separately by epics.md AC3 since it's a structurally different case (hand-written query, not part of the DSL-adjacent `events` list resolver the other six live in). Line numbers are approximate — confirm against current file state before editing, since other stories (`review` status, could land first) may shift them.
- **Gate 3 escape-hatch — enforcement gap, resolved via user decision (2026-08-06, `AskUserQuestion`):** a fresh Gate 3 pass (this story predates and is not covered by `epic-0-readiness.md`'s `swept: true` sweep — that report's `stories_covered` list only goes up to `0.19`, dated 2026-08-03, three days before this story was added) found that a plain exported `activeOnly(table)` helper is *opt-in*: nothing stops a future resolver (Epic 3/4's `subscriptions`/`apiKeys` soft-delete mutations, not yet built) from hand-writing `isNull(table.deletedAt)` again, silently regressing the exact fragmentation this story exists to close. **User chose: add an ESLint enforcement rule as part of this story's scope** (Task 4/5, AC5/AC6) rather than ship convention-only or split enforcement into a separate follow-up story — closing the gap for real rather than leaving "enforced once" aspirational.
- **Scope boundary vs. AD-8 rule 4:** this story is strictly rule 2 (query-default filtering) — it does **not** touch AD-8 rule 4 (the `SoftDeleteAction`/`action` argument mutation contract, or `deleteUserLocation`'s hard-delete-to-soft-delete migration). That migration is explicitly owned by Story 2-3 (`review` status, already scoped with revised AC9-11 for exactly this). Confirmed via the fresh Gate 1/3 subagent pass: no scope-creep risk found — the ACs as written wall this off correctly already.
- **Why `packages/graphql-select`, not `packages/domain`:** `activeOnly` is a thin Drizzle-`isNull`-coupled where-fragment operating directly on `PgColumn`/`PgTable` types — it is DB/ORM-coupled by construction (its whole purpose is producing a Drizzle `SQL` fragment), which `project-context.md`'s Code Organization rule explicitly bars from `packages/domain` ("Logic placed in packages/domain must be pure and dependency-free of any DB/ORM-specific modules"). `packages/graphql-select` is the existing precedent for exactly this category of logic (`buildOptimizedDrizzleSelect`, `buildDrizzleWhere` are the same kind of Drizzle-query-building utility).
- **Why the lint rule lives in `apps/backend/eslint.config.mjs`, not `@festgrid/eslint-config/base.js`:** adding it to the shared base config would also apply it inside `packages/graphql-select` itself, where `active-only.ts`'s own implementation legitimately contains `isNull(table.deletedAt)` — the rule would flag its own canonical implementation. Scoping the override to `apps/backend`'s own config file (which `packages/graphql-select`'s `eslint.config.mjs` does not import) avoids needing any inline disable-comment exception. If a future backend-only package beyond `apps/backend` starts writing hand-rolled Drizzle queries against AD-8-bound tables, the same scoped override should be copied into that package's own `eslint.config.mjs` at that time — not preemptively added here (see Out of Scope).
- **No `packages/ui` change** — confirmed via a fresh Gate 2 (Freya-lens) subagent pass: zero UI/frontend surface, no component, hook, or util ships. This story touches zero files under `apps/web` or `packages/ui`.
- **No Unified Query DSL (AD-1/AD-2) change** — `activeOnly` is deliberately DSL-independent per AC4; `buildDrizzleWhere`/`buildOptimizedDrizzleSelect` in `drizzle-where.ts`/`optimized-select.ts` are unmodified.
- **No PostHog/analytics events (AD-5), no i18n strings (AD-6)** — this story introduces no user-facing interaction or text; it is a pure server-side query-layer refactor plus a dev-tooling lint rule.
- **No state-management categorization applies** — backend-only; nothing is stored in Server State/URL State/Client Global State.
- **No async loader (blocking/non-blocking) categorization applies** — no UI renders a loading state for this story's changes.
- **AD-8 itself:** this story is the mechanism, not a new binding — it does not add `deletedAt` to any new table (`events` remains explicitly out of scope per the spine's own note that it's "still not implemented," and is not part of this story either).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness):** Run fresh via a Winston-persona subagent (this story is **not** covered by `epic-0-readiness.md`'s `swept: true` report — that sweep's `stories_covered` list only spans `0.1`-`0.19`, dated 2026-08-03, before this story existed). **No gap found.** The story is confined to a workspace package (`packages/graphql-select`) and one backend resolver file, adds no GraphQL surface, no frontend touch, no direct DB access from a UI layer, and no new infra — a pure ORM-layer refactor consumed entirely server-side.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Run fresh (same reason as Gate 1). **One gap found and resolved in-story** (see Dev Notes above): a plain exported helper is opt-in, not enforced — nothing would stop future resolvers from reintroducing hand-written `isNull(table.deletedAt)`. Resolved via user decision (2026-08-06): add ESLint `no-restricted-syntax` enforcement as part of this story's own scope (Task 4/5, AC5/AC6) rather than deferring to a separate story. No AD-8-rule-4 scope-creep risk found (the ACs correctly wall off `deleteUserLocation`'s migration, owned by Story 2-3).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya-persona subagent. **No gap found.** The `activeOnly(table)` helper is a Drizzle where-fragment operating purely on the backend query layer — it is neither a React component nor a hook/frontend util, has no visual or interaction surface, and touches zero files under `apps/web` or `packages/ui`; none of Gate 2's reuse/complexity/visual-spec triggers apply.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found — no database schema change, no new column, no new table. This is a pure query-construction and code-organization refactor.
- Impacted fields/contracts: None. `packages/database/schema.ts` is unmodified. No `@festgrid/shared-types` interface changes. No GraphQL schema (`.graphql`) file changes — the retrofitted resolvers already expose the exact same fields/behavior as before (AC2's "behavior-preserving, no functional change" requirement).
- Required DB migration changes: None. No `drizzle-kit generate` run needed for this story.
- Required TypeScript type changes: `packages/graphql-select/index.ts` gains one new re-export (`active-only.js`). `apps/backend/src/schema/resolvers.ts`'s import line changes (add `activeOnly`, eventually drop `isNull` once unused). No `apps/backend/src/generated/resolvers-types.ts` change — no GraphQL schema/resolver signature changes, so no codegen run is needed for this story.
- Backward compatibility and rollout notes: Purely internal refactor — the six retrofitted resolver call sites and `myLocations` must produce byte-identical query results before and after (Task 6's existing-test-suite-still-passes verification is the proof). The new lint rule only affects future code; it does not retroactively fail on any code this story doesn't touch (no other `apps/backend/src/**` file currently contains a raw `isNull(*.deletedAt)` call outside the seven already retrofitted here — confirmed via full-file grep during story creation).
- Verification checks: Task 6's full list — existing `favorites-and-calendar.test.ts`/`user-locations.test.ts` integration suites unchanged and passing (behavior-preservation proof), new `active-only.test.ts` unit test, new `eslint-enforcement.test.ts` fixture proving both the positive (flags violation) and negative (no false-positive on `activeOnly`/unrelated `isNull`) cases, and `pnpm --filter backend run lint` passing cleanly post-retrofit.

### Project Structure Notes

- New: `packages/graphql-select/active-only.ts`, `packages/graphql-select/active-only.test.ts`, `apps/backend/src/eslint-enforcement.test.ts`.
- Modified: `packages/graphql-select/index.ts` (new re-export); `apps/backend/src/schema/resolvers.ts` (import line change, 7 call-site replacements); `apps/backend/eslint.config.mjs` (new scoped `no-restricted-syntax` rule); `apps/backend/package.json` (add direct `eslint` devDependency).
- Not modified: `apps/web`, `packages/ui`, `packages/domain`, `packages/database` (no schema/migration change), `apps/backend/src/generated/` (no codegen run needed), `.github/workflows/ci.yml` (existing `pnpm run lint`/`pnpm run test` steps already exercise the new rule and tests, no new CI step needed), any `.graphql` schema file (no API contract change).
- Detected conflicts or variances: None found — `resolvers.ts`'s seven call sites match epics.md's "six existing... plus `myLocations`" description exactly (verified via direct grep, not assumed). `eslint-plugin-only-warn` (already active repo-wide via `base.js`) downgrades the new rule's reported severity to `warn`, same as every other existing rule — expected, not a defect, since `--max-warnings 0` in `apps/backend/package.json`'s `lint` script already fails CI on any warning.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.22] — story AC source (helper contract, six-plus-`myLocations` retrofit scope, DSL/hand-written composability requirement).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8] — full AD-8 text, in particular rule 2's explicit "as shipped today, this is not true" admission and "required fix" description that this story implements verbatim (single shared `activeOnly(table)` helper, exported from `@festgrid/graphql-select`, retrofitting the six `favorites`/`calendarAdditions` sites plus `myLocations`).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — checked and found **not applicable** to this story: `swept: true` but `stories_covered` spans only `0.1`-`0.19` (dated 2026-08-03), predating this story (added 2026-08-06) — fresh Gate 1/3 subagent passes were run instead of citing this report.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, "lightweight escape-hatch guard" rationale for why the swept report couldn't be relied on here.
- [Source: _bmad-output/project-context.md#API-Data, #Database-Performance, #Code-Quality-Style-Rules] — `buildOptimizedDrizzleSelect`'s "generic, strictly-typed function" precedent mirrored by `activeOnly`'s own generic signature; AD-8 Soft-Delete Convention summary (cites this exact story by name: "Story 0.22 tracks building the shared `activeOnly(table)` helper this rule requires"); `packages/domain` DB/ORM-coupling restriction (informing the `packages/graphql-select` placement decision).
- [Source: apps/backend/src/schema/resolvers.ts] — read in full around all seven call sites (lines ~346-357, ~425-465, ~497-513, ~583-625) plus the top-of-file import block (line 1-13); confirmed exact current code shape being retrofitted.
- [Source: packages/graphql-select/index.ts, drizzle-where.ts, optimized-select.ts, drizzle-where.test.ts, package.json] — read in full; confirmed package-root file convention (no `src/` subfolder, unlike `packages/domain`), existing `node:test`/`tsx --test *.test.ts` test-runner pattern, and `PgTable`/`PgColumn` typing precedent from `drizzle-orm/pg-core` mirrored by `activeOnly`'s generic constraint.
- [Source: packages/database/schema.ts] — read in full; confirmed the six tables currently carrying `deletedAt` (`users`, `userLocations`, `subscriptions`, `apiKeys`, `favorites`, `calendarAdditions`) and confirmed `events` does not yet have the column (out of scope, matches AD-8's own note).
- [Source: apps/backend/eslint.config.mjs, packages/eslint-config/base.js, packages/graphql-select/eslint.config.mjs] — read in full; confirmed `onlyWarn` plugin behavior (downgrades all rule severities to `warn`, `--max-warnings 0` still fails CI), confirmed `packages/graphql-select`'s own config never imports `apps/backend`'s config (so no carve-out exception is needed for `active-only.ts`'s own `isNull` usage).
- [Source: apps/backend/package.json, root package.json] — confirmed ESLint 9 (flat config, Node API `overrideConfigFile` usable), confirmed `eslint` is not currently a direct `apps/backend` dependency (only transitive via `@festgrid/eslint-config`) — informing Task 4's added devDependency.
- [Source: apps/backend/src/schema/favorites-and-calendar.test.ts, user-locations.test.ts] — read relevant sections; confirmed these existing integration suites already exercise all seven retrofitted call sites end-to-end against a real local Postgres instance, making "still passes unchanged" a valid behavior-preservation proof for AC2/AC3 without needing new assertions duplicating their coverage.
- [Source: _bmad-output/implementation-artifacts/0-21-set-up-fcm-device-token-registry.md] — previous story in Epic 0; format/rigor precedent followed for this story's structure (Architecture & UX Gate Findings phrasing, Dev Notes granularity, References list style).
- [User decision, 2026-08-06] — explicit `AskUserQuestion` resolution of the Gate 3 enforcement-gap tradeoff: add an ESLint `no-restricted-syntax` rule to this story's scope (chosen over "document convention only" and "split into a follow-up story").

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API & Data (Drizzle-only DB access, `buildOptimizedDrizzleSelect` generic-utility precedent mirrored here), Database & Performance (AD-8 Soft-Delete Convention, cites this story by name), Code Quality (`packages/domain` DB/ORM-coupling restriction informing the `packages/graphql-select` placement decision).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8` — rule 2's exact "required fix" description, implemented verbatim by this story.
- [ ] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 execution protocol and epic-sweep-mode applicability check (found not applicable here — fresh gates run instead).
- [ ] `docs/infrastructure/index.md` — checked; no infra shard content applies (no new AWS/cloud resource, no infra layer touched — pure application-code + tooling-config change).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/graphql-select/active-only.ts`, `packages/graphql-select/active-only.test.ts`, `apps/backend/src/eslint-enforcement.test.ts`.
  - Modified: `packages/graphql-select/index.ts` (new re-export); `apps/backend/src/schema/resolvers.ts` (import line, 7 call-site replacements, drop unused `isNull` import once empty); `apps/backend/eslint.config.mjs` (new scoped rule); `apps/backend/package.json` (add `eslint` devDependency).
  - Not modified: `apps/web`, `packages/ui`, `packages/domain`, `packages/database`, `apps/backend/src/generated/`, `.github/workflows/ci.yml`, any `.graphql` schema file.
- **Rule Mapping:**
  - AD-8 rule 2 (query default enforced once) → `activeOnly(table)` helper (Task 1) + 7-site retrofit (Task 2/3) → AC1-4.
  - Gate 3 enforcement-gap finding (user-confirmed 2026-08-06) → `no-restricted-syntax` ESLint rule scoped to `apps/backend/src/**` (Task 4) + fixture test proving positive/negative cases (Task 5) → AC5/AC6.
  - `packages/domain` vs `packages/graphql-select` placement rule → evaluated, `activeOnly` placed in `packages/graphql-select` (DB/ORM-coupled, barred from `packages/domain`) → Dev Notes.
  - `packages/ui` reusable-component check → evaluated and rejected (zero UI ships) → Dev Notes / Gate 2 finding.
  - i18n/analytics/state-management/loader categorization → all evaluated and found not applicable → Dev Notes.
  - Data-type compatibility check (mandatory per this skill's persistent facts) → evaluated, no mismatch found (no schema/type change) → Data Type Compatibility & Migration Requirements section.
- **Verification Plan:**
  - `packages/graphql-select/active-only.test.ts` (Task 1) proves the helper builds a valid, composable `SQL` fragment.
  - Existing `favorites-and-calendar.test.ts`/`user-locations.test.ts` integration suites (Task 6) still pass unchanged post-retrofit — the behavior-preservation proof for AC2/AC3, run against real local Postgres.
  - `apps/backend/src/eslint-enforcement.test.ts` (Task 5) proves the lint rule fires on a raw `isNull(*.deletedAt)` fixture and does not false-positive on `activeOnly(...)` or an unrelated-column `isNull(...)` fixture — AC5/AC6.
  - `pnpm --filter backend run lint` passing cleanly (Task 6) confirms zero remaining raw `isNull(*.deletedAt)` sites in `apps/backend/src/**`.
  - `pnpm build` and `pnpm lint` pass cleanly at the repo root (Task 6).

## Pre-Coding Approval Gate

- [x] Scope confirmation: build the `activeOnly(table)` helper in `packages/graphql-select`, retrofit all seven existing hand-written `isNull(*.deletedAt)` call sites (six favorites/calendarAdditions + `myLocations`), and add an ESLint enforcement rule + fixture test — exactly as ACed; no AD-8 rule 4 (mutation-contract/`deleteUserLocation` migration) work, no new schema/table changes, no frontend/UI work.
- [x] Architecture and boundary confirmation: `activeOnly` lives in `packages/graphql-select` (not `packages/domain`, which bars DB/ORM-coupled code); the new lint rule is scoped to `apps/backend/eslint.config.mjs` only (not the shared `@festgrid/eslint-config/base.js`), so it does not flag `active-only.ts`'s own canonical `isNull(table.deletedAt)` implementation; all seven retrofits are behavior-preserving (verified by existing test suites passing unchanged, not new assertions).
- [x] Testing plan confirmation: `active-only.test.ts` (new unit test, `packages/graphql-select` — the one place in this repo's testing philosophy where 100%-coverage unit tests are expected is `packages/domain`, but this Drizzle-query-fragment logic is analogous to `drizzle-where.test.ts`'s existing precedent in the same package); `eslint-enforcement.test.ts` (new fixture test, `apps/backend`); existing `favorites-and-calendar.test.ts`/`user-locations.test.ts` integration suites re-run unchanged as the behavior-preservation proof — non-negotiable per AC2/AC3's "no functional change" requirement.
- [x] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — no gap (fresh Winston-persona pass, not covered by the swept `epic-0-readiness.md`). Gate 2 — no gap (fresh Freya-persona pass, zero UI surface). Gate 3 — gap found (opt-in helper, no enforcement) and **resolved in-story**: user confirmed 2026-08-06 via `AskUserQuestion` to add the ESLint rule here (Task 4/5) rather than defer or skip.
- [x] **Enforcement-scope decision accepted:** confirmed 2026-08-06 via `AskUserQuestion` — add an ESLint `no-restricted-syntax` rule scoped to `apps/backend/src/**`, rejecting both "document convention only, accept the risk" and "split enforcement into its own follow-up story."

## Testing Requirements

- [x] Unit tests (required): `packages/graphql-select/active-only.test.ts` — proves the helper produces a valid, composable Drizzle `SQL` where-fragment (no DB connection needed; mirrors `drizzle-where.test.ts`'s local-`pgTable`-fixture pattern).
- [x] Integration tests (required, not deferred): re-run of existing `apps/backend/src/schema/favorites-and-calendar.test.ts` and `user-locations.test.ts` — both must pass **unchanged** post-retrofit (real local Postgres, no mocked DB layer), proving AC2/AC3's behavior-preservation requirement. `apps/backend/src/eslint-enforcement.test.ts` (new) proves the lint rule fires correctly (AC5/AC6) via ESLint's Node API against inline code fixtures.
- [x] E2E tests: Not applicable — no UI ships in this story, no user-facing flow changes; the retrofitted resolvers already have full E2E/integration coverage from the stories that originally built them (favorite/calendar toggling, saved-locations management).
- [x] Manual verification: Run `pnpm --filter backend run lint` locally after the retrofit and confirm it passes with zero warnings — the fastest way to visually confirm all seven sites were actually replaced (a missed site would immediately fail lint, not just fail a targeted test).

## Deliverables Checklist

- [x] `activeOnly(table)` exported from `@festgrid/graphql-select` (`packages/graphql-select/active-only.ts` + `index.ts` re-export), generically typed to only accept tables with a `deletedAt` column.
- [x] All seven hand-written `isNull(*.deletedAt)` call sites in `apps/backend/src/schema/resolvers.ts` (six favorites/calendarAdditions + `myLocations`) replaced with `activeOnly(table)`, behavior-preserving.
- [x] Unused `isNull` import removed from `resolvers.ts`'s `drizzle-orm` import line once no callers remain.
- [x] `no-restricted-syntax` ESLint rule added to `apps/backend/eslint.config.mjs`, scoped to `src/**/*.ts`, banning `isNull(*.deletedAt)` with a message pointing to `activeOnly`.
- [x] `eslint` added as a direct `apps/backend` devDependency.
- [x] `packages/graphql-select/active-only.test.ts` and `apps/backend/src/eslint-enforcement.test.ts` passing.
- [x] Existing `favorites-and-calendar.test.ts`/`user-locations.test.ts` integration suites still passing unchanged.
- [x] `pnpm build`/`pnpm lint` pass at the repo root.

## Out of Scope

- AD-8 rule 4 (the `SoftDeleteAction`/`action`-argument mutation contract, and `deleteUserLocation`'s hard-delete-to-soft-delete migration) — owned by Story 2-3 (`review` status, already scoped with revised AC9-11 for exactly this).
- Adding `deletedAt` to the `events` table — explicitly deferred per the architecture spine's own AD-8 note ("still not implemented... not built in this AD's session"); no story currently scopes this.
- Retrofitting `subscriptions`/`apiKeys` resolvers to use `activeOnly` — neither table has any resolver yet (both ship in Epic 3/4); the new lint rule (Task 4) will require whoever builds those resolvers to use `activeOnly` from the start, so no retrofit will ever be needed there.
- Copying the `no-restricted-syntax` override into any package/app beyond `apps/backend` — no other package currently writes hand-rolled Drizzle queries against AD-8-bound tables (`packages/domain` cannot touch the DB at all; `packages/graphql-select` is the helper's own home). If a future backend-only package needs the same guard, add the same scoped override to that package's own `eslint.config.mjs` at that time.
- Any change to the two "accepted legacy exception" mutations (`toggleFavorite`/`toggleCalendarAddition`'s implicit-toggle shape) — AD-8 rule 4 explicitly grandfathers these; this story only touches their *read-path* filtering (the `isNull`/`activeOnly` calls), never their mutation shape.

## Definition of Done

- [x] AC 1-6 satisfied.
- [x] `active-only.test.ts` and `eslint-enforcement.test.ts` passing (Testing Requirements — non-negotiable).
- [x] `favorites-and-calendar.test.ts`/`user-locations.test.ts` still passing unchanged (behavior-preservation proof).
- [x] `pnpm --filter backend run lint` passing with zero warnings (confirms full retrofit, zero remaining raw `isNull(*.deletedAt)` sites).
- [x] `pnpm build` and `pnpm lint` passing for the repo root, `apps/backend`, `packages/graphql-select`.
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the enforcement-scope acceptance item.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

- Executed packages/graphql-select unit tests successfully with exit code 0.
- Executed apps/backend eslint-enforcement unit/integration tests successfully with exit code 0.
- Executed existing integration tests (favorites-and-calendar, user-locations) successfully.
- Ran clean full workspace build with exit code 0.

### Completion Notes List

- Implemented activeOnly(table) generically typed helper in packages/graphql-select.
- Re-exported activeOnly in packages/graphql-select index.ts.
- Retrofitted resolvers.ts to use activeOnly for all 7 soft-delete default filtering queries instead of hand-written isNull calls, and cleaned up the unused isNull import.
- Added a scoped no-restricted-syntax rule in apps/backend eslint config to enforce activeOnly helper usage on deletedAt.
- Added fixture tests in eslint-enforcement.test.ts proving the rule fires on handwritten isNull and passes on activeOnly.

### File List

- packages/graphql-select/active-only.ts (New)
- packages/graphql-select/active-only.test.ts (New)
- packages/graphql-select/index.ts (Modified)
- apps/backend/src/eslint-enforcement.test.ts (New)
- apps/backend/src/schema/resolvers.ts (Modified)
- apps/backend/eslint.config.mjs (Modified)
- apps/backend/package.json (Modified)
