# Story 0.8: Set up GraphQL server scaffold, Code Generator pipeline, and the optimized-select query utility

## Story Details

- Epic: 0
- Story ID: 0.8
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the GraphQL server foundation, the GraphQL Code Generator pipeline, and the mandated `buildOptimizedDrizzleSelect` utility built once as shared, generic infrastructure,
so that every future resolver (events now; schedules, users, locations, subscriptions later) reuses the same query-optimization and type-generation machinery instead of each feature reimplementing it.

## Acceptance Criteria

1. **Given** Drizzle ORM and the initial schema exist (Story 0.4, Story 1.1), **when** the backend app (`apps/backend`) starts, **then** a GraphQL server is running with query depth/complexity limits configured to prevent abuse.
2. **And** `GraphQL Code Generator` is configured against the GraphQL schema, generating end-to-end TypeScript types (and typed `graphql-request`/`react-query` hooks) consumed by `apps/web`, so client and server can never silently drift out of sync.
3. **And** a generic, strictly-typed `buildOptimizedDrizzleSelect` function exists in `packages/graphql-select` (a new dedicated package — see Dev Notes for why it is not `packages/database`), translating GraphQL resolve-info/AST into an optimized Drizzle `select` that only fetches requested fields.
4. **And** `buildOptimizedDrizzleSelect` is table/schema-agnostic (not events-specific) so any future resolver can import and reuse it, and it has dedicated unit tests proving correct field-selection behavior.
5. **And** the codegen script runs as part of `pnpm build`/CI (Story 0.5) so type drift fails the build.

## Tasks / Subtasks

- [ ] Task 1: Scaffold `apps/backend` as a functioning workspace package (AC: #1)
  - [ ] Create `apps/backend/package.json` (unscoped name `backend`, mirroring `apps/web`'s package.json naming — not `@festgrid/backend`), with `dev`/`build`/`start`/`lint`/`codegen` scripts.
  - [ ] Create `apps/backend/tsconfig.json` extending `@festgrid/typescript-config/base.json` with `module`/`moduleResolution: "NodeNext"` and `outDir: "dist"`, mirroring `packages/database/tsconfig.json` (Node-run package, not a Next.js/browser package).
  - [ ] Create `apps/backend/eslint.config.mjs` mirroring `packages/database/eslint.config.mjs` (extends `@festgrid/eslint-config/base`, ignores `dist/`).
  - [ ] Add dependencies: `graphql`, `graphql-yoga`, `@escape.tech/graphql-armor`, `@festgrid/shared-types` (workspace). Add devDependencies: `@festgrid/typescript-config`, `@festgrid/eslint-config`, `typescript`, `tsx`, `dotenv`, `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `@graphql-codegen/typescript-resolvers`. **Do not** add `@festgrid/database` or `@festgrid/graphql-select` yet — this story's placeholder `health` resolver imports neither; Story 1.3a adds both workspace dependencies when its resolver actually calls `buildOptimizedDrizzleSelect` against the Drizzle client (same package.json-honesty principle applied to `packages/graphql-select` below — don't declare a dependency before something imports it).
  - [ ] No `pnpm-workspace.yaml` change needed — `apps/*` is already included.
- [ ] Task 2: Define the placeholder GraphQL schema and stand up the Yoga server with abuse protection (AC: #1)
  - [ ] Create `apps/backend/src/schema/typeDefs.graphql` with a minimal placeholder schema (e.g. `type Query { health: Boolean! }`) — the real `Event`/`Schedule` types and resolvers are Story 1.3a's job, which depends on this story per epics.md.
  - [ ] Create `apps/backend/src/schema/resolvers.ts` implementing `Query.health` returning `true`, proving the schema→resolver wiring works end-to-end.
  - [ ] Create `apps/backend/src/server.ts` building the GraphQL server via `createYoga({ schema: createSchema({ typeDefs, resolvers }), plugins: [...] })`, adding `@escape.tech/graphql-armor`'s `.protect()` plugin bundle configured with `maxDepth` and `maxAliases`/`maxDirectives`/`costLimit` limits to satisfy AC #1's abuse-prevention requirement (`project-context.md` Security rule: "Prevent GraphQL Abuse").
  - [ ] Create `apps/backend/src/env.ts` loading `BACKEND_PORT` from the **root** `.env` (not a local `apps/backend/.env`), mirroring `packages/database/env.ts`'s root-env-loading convention — root `.env` already defines `BACKEND_PORT="4001"` and `BACKEND_GRAPHQL_URL="http://localhost:4001/graphql"` (added ahead of this story; reuse as-is, do not rename).
  - [ ] Create `apps/backend/src/index.ts` mounting the Yoga server on Node's `http.createServer` and listening on `BACKEND_PORT`.
- [ ] Task 3: Configure GraphQL Code Generator for both the server and the client (AC: #2, #5)
  - [ ] Create `apps/backend/codegen.ts` (`@graphql-codegen/cli` config) generating `@graphql-codegen/typescript` + `@graphql-codegen/typescript-resolvers` from `src/schema/typeDefs.graphql` into `apps/backend/src/generated/resolvers-types.ts`. Wire `apps/backend/package.json`'s `"codegen"` script to run it.
  - [ ] Create `apps/web/codegen.ts` pointing `schema` at the SDL file path across the monorepo (`../backend/src/schema/**/*.graphql`) and `documents` at `src/**/*.graphql` (none exist yet — this is fine; codegen still generates the base/schema types). Configure plugins `typescript` + `typescript-operations` + `typescript-react-query` with `fetcher: 'graphql-request'`, output to `apps/web/src/generated/graphql.ts`. Wire `apps/web/package.json`'s `"codegen"` script.
  - [ ] Add `graphql`, `graphql-request`, and (per the sequencing note in Dev Notes) `@tanstack/react-query` as dependencies of `apps/web`; add `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `@graphql-codegen/typescript-operations`, `@graphql-codegen/typescript-react-query` as devDependencies of `apps/web`.
  - [ ] Add a `"codegen"` task to root `turbo.json` (`dependsOn: []`, `outputs: ["src/generated/**"]`) and change the `"build"` task's `dependsOn` to `["^build", "codegen"]`, so each package's own `codegen` script runs before its own `build` — this is what makes `pnpm build`/CI fail on schema/operation drift (AC #5), with no `.github/workflows/ci.yml` changes needed since CI already calls `pnpm run build`.
- [ ] Task 4: Scaffold `packages/graphql-select` and build the generic `buildOptimizedDrizzleSelect` utility (AC: #3, #4)
  - [ ] Create `packages/graphql-select/package.json` (name `@festgrid/graphql-select`), `packages/graphql-select/tsconfig.json` (extends `@festgrid/typescript-config/base.json`, `module`/`moduleResolution: "NodeNext"`, `outDir: "dist"`), and `packages/graphql-select/eslint.config.mjs` — all three mirroring `packages/database`'s existing shape exactly (same Node-run package archetype).
  - [ ] Add dependencies: `@festgrid/database` (workspace — for Drizzle table/column *types* only; this package never touches migrations, seeding, or schema definitions itself), `graphql`, `graphql-parse-resolve-info` (maintained, handles nested-fragment/`@include`/`@skip` resolution correctly — do not hand-roll AST traversal). Add devDependencies: `@festgrid/typescript-config`, `@festgrid/eslint-config`, `typescript`, `tsx`.
  - [ ] **Do not** add `graphql`/`graphql-parse-resolve-info` to `packages/database` itself — keeping them out is the entire point of this package split (see Dev Notes: "Why `buildOptimizedDrizzleSelect` lives in its own package"). `packages/database` is not modified by this story at all.
  - [ ] Create `packages/graphql-select/optimized-select.ts` exporting a generic `buildOptimizedDrizzleSelect<TTable extends PgTable>(table: TTable, info: GraphQLResolveInfo): Record<string, PgColumn>` that parses `info` via `graphql-parse-resolve-info`, maps each requested top-level GraphQL field name to the matching Drizzle column on `table` (Drizzle's JS object keys are already camelCase — e.g. `events.eventName` — matching GraphQL field-name casing 1:1, confirmed against `packages/database/schema.ts`), and silently skips any requested field with no matching column (e.g. computed/relation fields resolved separately).
  - [ ] Create `packages/graphql-select/index.ts` exporting `buildOptimizedDrizzleSelect` (mirrors `packages/database/index.ts`'s barrel-export pattern).
  - [ ] Create `packages/graphql-select/optimized-select.test.ts` using `node:test`/`node:assert` (mirroring `packages/database/seed.integration.test.ts`'s pattern, run via `tsx --test`, no live DB connection required — construct a mock/minimal `GraphQLResolveInfo` fixture or exercise it via a small in-memory schema+`graphql()` call). Cover: only requested fields are selected, unrelated table columns are excluded, and the function works against more than one table (e.g. `events` and `schedules`) to prove it is schema-agnostic.
  - [ ] Add a `"test"` script to `packages/graphql-select/package.json` (e.g. `"test": "tsx --test *.test.ts"`) from the start, so `turbo run test` (Story 0.5's CI pipeline) picks it up.
- [ ] Task 5: Manual end-to-end verification (AC: #1, #2, #3, #5)
  - [ ] Run `pnpm --filter backend dev`; confirm the Yoga server boots on `http://localhost:4001/graphql` and Yoga's built-in GraphiQL UI (or a `curl -X POST` with `{"query":"{ health }"}`) returns `{"data":{"health":true}}`.
  - [ ] Send an over-limit request (e.g. a deeply nested/aliased fragment beyond the configured `maxDepth`/`maxAliases`) and confirm `graphql-armor` rejects it with a clear error instead of executing it.
  - [ ] Run `pnpm run codegen` (or `pnpm build`, which now runs it first) and confirm `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` are produced without errors.
  - [ ] Run `pnpm --filter graphql-select test` and confirm `buildOptimizedDrizzleSelect`'s new unit tests pass.
  - [ ] Run `pnpm build` and `pnpm lint` at the repo root and confirm both are clean across `apps/backend`, `apps/web`, and `packages/graphql-select`.
  - [ ] Record the manual verification steps performed in this story's Completion Notes (no automated integration/E2E framework exists yet for `apps/backend`/`apps/web` — Story 0.10 is still `backlog`).

## Dev Notes

- This is a foundational Epic 0 story: the GraphQL server, codegen pipeline, and `buildOptimizedDrizzleSelect` must be generic and reusable — Story 1.3a (the events resolver, `Depends on: Story 0.8` per `epics.md`) is the first real consumer and must not need to rebuild any of this.
- **`apps/backend` currently contains only a `.env` file** — no `package.json`, no source code at all. This story is a full scaffold from zero, not an edit. Local dev only: this story stands up a Node-runnable GraphQL server (`tsx`/`node`), it does **not** deploy anything to AWS Lambda/API Gateway — that is Story 0.14's job ("Set up AWS IaC for Lambda, SQS, EventBridge, and KMS", still `backlog`). `SETUP_WALKTHROUGH.md`'s current "Backend (AWS Serverless)" section describes a `serverless create` scaffold that does not reflect what this story builds; do not follow it, and do not edit `SETUP_WALKTHROUGH.md` in this story (it will be corrected once Story 0.14 exists and the deployment story is real — not user/cloud credentials, so the persistent "update SETUP_WALKTHROUGH.md" rule does not apply here since no cloud/external service account is created by this story).
- **Sequencing note — Story 0.4 (Drizzle ORM setup) is `review`, not `done`.** In practice this is not a blocker: `packages/database/schema.ts`, migrations, and the Drizzle client already exist and work (confirmed by reading the package directly), so this story can safely build on them. Flagged here for completeness, mirroring the precedent set by Story 0.7 flagging Story 0.6's non-`done` status.
- **Sequencing conflict — `@tanstack/react-query` is not yet installed in `apps/web` (Story 0.9, "Set up state management foundation", is `backlog` and numbered *after* this story).** `epics.md` AC #2 for this story explicitly requires generating "typed `graphql-request`/`react-query` hooks" (i.e., `@graphql-codegen/typescript-react-query` configured with `fetcher: 'graphql-request'`), and that generated file will not type-check unless `@tanstack/react-query` exists as a dependency of `apps/web`. **Resolution (requires explicit human sign-off, see Pre-Coding Approval Gate):** this story adds the raw `@tanstack/react-query` npm dependency to `apps/web` — purely so the generated hooks file compiles — but does **not** configure a `QueryClientProvider`, does not establish any Server State usage pattern, and does not compose the provider in the app shell. That remains exclusively Story 0.9's scope (mirrors the "reserved slot, not implemented" pattern Story 0.7 used for the i18n provider). The generated `apps/web/src/generated/graphql.ts` file is allowed to exist and compile without being imported by any page/component yet — no page wires it up in this story (Story 1.3a/1.3 will be the first real consumer).
- **State management categorization (per project-context.md):** The generated `react-query` hooks are **Server State** (AD-4) — this story only generates the typed hook *shapes*; it does not configure React Query's provider/cache, which is Story 0.9's responsibility. No URL State (`nuqs`) or Client Global State (`zustand`) is introduced by this story.
- **Loader categorization:** Not applicable — this story ships no UI. Loading-state UX (Skeleton vs. spinner vs. blocking overlay) is decided by the feature stories that first call the generated hooks (e.g. Story 1.3).
- **Package dependency isolation (project-context.md):** `@tanstack/react-query` and `graphql-request` are added to `apps/web` **only**. `graphql` and `graphql-parse-resolve-info` are added to `packages/graphql-select` **only** — explicitly *not* to `packages/database`, see the rationale below. `apps/backend` gets its own `graphql`/`graphql-yoga`/`graphql-armor`/codegen devDependencies, isolated from `apps/web`. No shared package mixes these domains.
- **Why `buildOptimizedDrizzleSelect` lives in its own package (`packages/graphql-select`), not `packages/database`:** `packages/database` is consumed by more than just resolvers — `.github/workflows/ci.yml`'s `db-migrate` job runs `pnpm run migrate` directly out of that package on every push to `main`, and has nothing to do with GraphQL. pnpm installs a package's dependencies based on what's *declared* in its `package.json`, not on what's actually imported by the script being run — so if `optimized-select.ts` (and its `graphql`/`graphql-parse-resolve-info` dependencies) lived inside `packages/database`, that package's dependency graph would be lying about what a schema migration actually needs, and would permanently block ever scoping `db-migrate`'s install to something minimal. Splitting into `packages/graphql-select` (depending on `@festgrid/database` only for Drizzle table/column *types*) keeps `packages/database` honestly scoped to schema/migrations/seed, and costs nothing today since the function doesn't exist yet (cheapest possible moment to draw this boundary, per Rule of Three's spirit — the trigger here is a second *unrelated package consumer*, not a second caller of the function). Note this does **not** shrink CI's install time today, since `.github/workflows/ci.yml` runs an unscoped root `pnpm install --frozen-lockfile` for every job regardless of package boundaries — the benefit is a truthful dependency graph and the option to scope installs later, not an immediate CI speedup. `buildOptimizedDrizzleSelect` still does **not** belong in `packages/domain` — it remains Drizzle/GraphQL-AST-coupled, not framework-agnostic business logic.
- **AD-1/AD-2 (Unified Query DSL) is not implemented by this story.** This story only builds the generic query-optimization/codegen *machinery*; the actual DSL parsing and `events` resolver that use it are Story 1.3a's responsibility. `buildOptimizedDrizzleSelect` is intentionally schema-agnostic so 1.3a (and later schedules/users/locations/subscriptions resolvers) can reuse it without modification.
- **AD-3 (Database Schema Management)/Data migrations:** Not applicable — no schema changes in this story (see Data Type Compatibility section below).
- **Analytics (AD-5):** Not applicable — no user-facing interaction is introduced.
- **i18n (AD-6):** Not applicable — no user-facing text is introduced (the `health` field and error messages are internal/dev-facing only).
- Codegen schema source of truth: `apps/web/codegen.ts` reads the schema directly from `apps/backend`'s `.graphql` SDL file(s) via a relative filesystem path (`../backend/src/schema/**/*.graphql`) — it does **not** require the backend server to be running during `pnpm build`/CI, and does **not** create a workspace package dependency between `apps/web` and `apps/backend` (apps do not depend on other apps as packages in this monorepo).
- Recommended libraries and why (see Latest Tech Information below for versions): `graphql-yoga` (official, actively maintained, first-class AWS Lambda support for when Story 0.14 lands) + `@escape.tech/graphql-armor` (bundles max-depth/max-aliases/max-directives/cost-limit/block-field-suggestions in one `.protect()` call, purpose-built for exactly AC #1's requirement) for the server; `graphql-parse-resolve-info` (Graphile-maintained, correctly resolves fragments/`@include`/`@skip`, unlike the unmaintained `graphql-fields`) for `buildOptimizedDrizzleSelect`.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` (`swept: true`, explicitly lists `0.8` in `stories_covered`). The report's two findings (no outbound-email adapter → Story 0.15; no Geolocation adapter/cache → Story 0.16) are unrelated to this story's GraphQL/codegen scope. No Gate 1/3 gap applies to Story 0.8 itself.
  - **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep — the GraphQL server, codegen pipeline, and `buildOptimizedDrizzleSelect` utility are exactly what Story 0.8 was already scoped to build (per its own `Note:` in `epics.md`); no new external service, data entity, or infra dependency appears here that the epic-wide sweep didn't anticipate. The one genuine new wrinkle found during drafting — the `@tanstack/react-query` forward-dependency on Story 0.9 — is not an architecture/infra completeness gap in the Gate 1/3 sense (it doesn't require a new backend layer or a new cross-cutting foundational story); it's a within-story sequencing risk, handled via the dedicated Dev Notes callout and Pre-Coding Approval Gate item above/below rather than a new prerequisite story.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya (`wds-agent-freya-ux`). Both `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` were checked in full (plus targeted grep for GraphQL/query/codegen/loading/resolver/drizzle terms) — zero mentions of the GraphQL API surface, query-depth/complexity limits, Codegen, typed hooks, resolve-info/AST, or `buildOptimizedDrizzleSelect` in either authoritative UX artifact. This story ships no React component, page, hook, or util with UI-facing states/variants — it is pure backend/tooling infrastructure consumed by later resolver/UI stories (e.g. 1.3a). **Result: No gap found.**

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found for this story's actual scope. This story's GraphQL schema is a placeholder (`type Query { health: Boolean! }`) — it does not yet define `Event`/`Schedule` types, so there is no entity-level mapping to validate yet (that begins in Story 1.3a). The forward-looking alignment this story *establishes the machinery for* is confirmed compatible: `packages/database/schema.ts`'s Drizzle table objects already use camelCase JS keys (e.g. `events.eventName`, `schedules.eventStartDate`) that match GraphQL's camelCase field-naming convention 1:1, so `buildOptimizedDrizzleSelect`'s field-name-to-column mapping requires no case-conversion layer.
- Impacted fields/contracts: None yet (no `Event`/`Schedule` GraphQL type exists in this story). Future consumers (Story 1.3a) must keep the GraphQL SDL field names, `@festgrid/shared-types`' `EventInfo`/`Schedule` interfaces, and `packages/database/schema.ts`'s Drizzle column keys in sync by construction (all three already share the same camelCase vocabulary as of this story).
- Required DB migration changes: No changes required — this story adds no tables/columns.
- Required TypeScript type changes: No changes required to `@festgrid/shared-types` — this story's only new generated types are the placeholder `health` query type and the `resolvers-types.ts`/`graphql.ts` codegen scaffolding files, which are net-new generated artifacts, not edits to hand-authored types.
- Backward compatibility and rollout notes: N/A — greenfield addition, no existing consumers of a GraphQL API exist yet.
- Verification checks: `buildOptimizedDrizzleSelect` unit tests (Task 4) proving field-selection correctness against at least two different tables; `pnpm run codegen` succeeding with no schema/operation-document drift errors; `pnpm build`/`pnpm lint` clean across `apps/backend`, `apps/web`, `packages/graphql-select`.

### Previous Story Intelligence (Stories 0.6, 0.7)

- Both 0.6 and 0.7 hit "no automated test framework exists yet" (Story 0.10 still `backlog`) and used manual/browser verification as the interim testing strategy — this story follows the same pattern for `apps/backend`/`apps/web`, but note `packages/database` already has a *Node-native* test precedent (`seed.integration.test.ts`, `node:test` via `tsx --test`) that this story reuses directly in the new `packages/graphql-select` package for `buildOptimizedDrizzleSelect`'s required unit tests (AC #4 is non-negotiable — unlike 0.6/0.7, this story cannot defer its own explicitly-required unit tests to Story 0.10, since a Node-native path already exists and costs nothing extra to reuse).
- Story 0.7 established the precedent of flagging a real cross-story sequencing conflict (its Story 0.6 dependency) as a **Pre-Coding Approval Gate item requiring explicit human sign-off** rather than silently working around it or silently absorbing the missing piece. This story applies the same pattern to its own Story 0.9 (`@tanstack/react-query`) sequencing conflict.
- Story 0.7 also established the `packages/ui`/`packages/analytics` package.json+tsconfig.json scaffolding shape as the canonical pattern for new workspace packages; this story instead mirrors `packages/database`'s shape for `apps/backend` (Node-run, `NodeNext` module resolution) since `apps/backend` is a server, not a React library.

### Git Intelligence Summary

- The last 10 commits are all `bmad-*` skill/planning-process changes (gate tooling, epic readiness sweep, sharded docs migration) — none touch application code in `apps/backend`, `apps/web`, or `packages/database`. There is no recent app-code commit pattern to mirror for this story's implementation; follow `festgrid-architecture-spine.md` (AD-1 through AD-4) and the GraphQL Yoga/Code Generator documentation instead.

### Latest Tech Information

- `graphql-yoga` latest stable is `^5.21.2` (npm, checked 2026-07-31) — supports Node.js and every deployment target including AWS Lambda (relevant for when Story 0.14 deploys this backend), built on top of `envelop`.
- `@escape.tech/graphql-armor` latest stable is `^3.2.0` (npm, checked 2026-07-31) — a single package bundling `max-depth`, `max-aliases`, `max-directives`, `cost-limit`, and `block-field-suggestions` protections behind one `.protect()` call for Yoga/Envelop servers; purpose-built for AC #1's "query depth/complexity limits" requirement.
- `@graphql-codegen/typescript-react-query` latest stable is `7.0.1` (npm, checked 2026-07-31); it supports `fetcher: 'graphql-request'` to generate hooks that call a `GraphQLClient` instance directly, exactly matching `epics.md` AC #2's "typed `graphql-request`/`react-query` hooks" wording. Full plugin chain needed: `@graphql-codegen/typescript` (base types) → `@graphql-codegen/typescript-operations` (operation types) → `@graphql-codegen/typescript-react-query` (hooks).
- `graphql-parse-resolve-info` (Graphile-maintained) is the recommended library for turning `GraphQLResolveInfo` into a field tree inside `buildOptimizedDrizzleSelect` — correctly handles fragments, `@include`/`@skip` directives, and nested selections, unlike the now-unmaintained `graphql-fields`.
- Sources: [graphql-yoga npm](https://www.npmjs.com/package/graphql-yoga), [GraphQL Yoga AWS Lambda deployment docs](https://the-guild.dev/graphql/yoga-server), [@escape.tech/graphql-armor npm](https://www.npmjs.com/package/@escape.tech/graphql-armor), [GraphQL Armor docs](https://escape.tech/graphql-armor/docs/getting-started/), [@graphql-codegen/typescript-react-query npm](https://www.npmjs.com/package/@graphql-codegen/typescript-react-query), [GraphQL Codegen React Query guide](https://the-guild.dev/graphql/codegen/docs/guides/react-query), [graphql-parse-resolve-info npm](https://www.npmjs.com/package/graphql-parse-resolve-info).

### Project Structure Notes

- New: `apps/backend/package.json`, `apps/backend/tsconfig.json`, `apps/backend/eslint.config.mjs`, `apps/backend/codegen.ts`, `apps/backend/src/schema/typeDefs.graphql`, `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/server.ts`, `apps/backend/src/env.ts`, `apps/backend/src/index.ts`, `apps/backend/src/generated/resolvers-types.ts` (generated, not hand-authored).
- New: `apps/web/codegen.ts`, `apps/web/src/generated/graphql.ts` (generated, not hand-authored).
- New `packages/graphql-select` package: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `optimized-select.ts`, `optimized-select.test.ts`, `index.ts`.
- Modified: `apps/web/package.json` (add `graphql`/`graphql-request`/`@tanstack/react-query` + codegen devDependencies), `turbo.json` (add `codegen` task, update `build`'s `dependsOn`).
- **`packages/database` is untouched by this story** — no edits to `schema.ts`, `index.ts`, `package.json`, or any other file in it. This is deliberate (see Dev Notes "Why `buildOptimizedDrizzleSelect` lives in its own package").
- No changes to `pnpm-workspace.yaml` (`apps/*`/`packages/*` already cover the new `packages/graphql-select` files), no changes to `.github/workflows/ci.yml` (existing `pnpm run build` step picks up the new `codegen` → `build` turbo dependency automatically), no changes to `SETUP_WALKTHROUGH.md` (no new cloud/external service account is introduced by this story).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.8] — canonical ACs and Note.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-1, #AD-2, #AD-3, #AD-4] — Unified Query DSL, Unified Event Querying, DB Schema Management, State Management tiers.
- [Source: _bmad-output/project-context.md#API-&-Data, #Database-&-Performance, #Security, #State-Management-Architecture] — GraphQL mandate, `buildOptimizedDrizzleSelect` mandate, GraphQL abuse prevention, package isolation rules.
- [Source: docs/infrastructure/2-backend.md] — API Gateway/Lambda/SQS/EventBridge backend architecture (deployment target for Story 0.14, not this story).
- [Source: docs/infrastructure/high-level-overview.md] — confirms `L_API` Lambda is the GraphQL API's eventual deployment target.
- [Source: docs/infrastructure/3-database.md] — Supabase/PostgreSQL context.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, `swept: true`, Story 0.8 in `stories_covered`.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and execution protocol.
- [Source: packages/database/schema.ts, index.ts, env.ts, seed.integration.test.ts, package.json] — existing Drizzle schema, root-env-loading pattern, and `node:test`/`tsx --test` precedent this story reuses.
- [Source: .env] — pre-existing `BACKEND_PORT`/`BACKEND_GRAPHQL_URL` values this story must reuse, not rename.
- [Source: _bmad-output/implementation-artifacts/0-6-set-up-i18n-foundation-next-intl.md, 0-7-build-the-global-app-shell-and-navigation-layout.md] — precedent for handling a cross-story sequencing conflict via an explicit Pre-Coding Approval Gate item.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API & Data rules (GraphQL, `buildOptimizedDrizzleSelect`, Zod/AJV), Security (GraphQL abuse prevention), State Management Architecture, package dependency isolation rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order applied to this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-3, AD-4) — Unified Query DSL/Event Querying, DB Schema Management, State Management tiers.
- [ ] `docs/infrastructure/2-backend.md`, `docs/infrastructure/high-level-overview.md`, `docs/infrastructure/3-database.md` — backend/queue/DB architecture context (deployment itself is Story 0.14's scope).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New `apps/backend` package: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `codegen.ts`, `src/schema/typeDefs.graphql`, `src/schema/resolvers.ts`, `src/server.ts`, `src/env.ts`, `src/index.ts`, `src/generated/resolvers-types.ts` (generated).
  - New in `apps/web`: `codegen.ts`, `src/generated/graphql.ts` (generated). Modified: `package.json` (new dependencies, see Task 3).
  - New `packages/graphql-select` package: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `optimized-select.ts`, `optimized-select.test.ts`, `index.ts`. **`packages/database` is not modified.**
  - Modified: `turbo.json` (new `codegen` task; `build` task's `dependsOn` updated).
- **Rule Mapping:**
  - AC #1 (GraphQL server + abuse limits) → `project-context.md` "Prevent GraphQL Abuse" Security rule → `apps/backend/src/server.ts` + `@escape.tech/graphql-armor` (Task 2).
  - AC #2 (Codegen, client/server never drift) → `project-context.md` "End-to-End Type Safety" rule → `apps/backend/codegen.ts` + `apps/web/codegen.ts` (Task 3).
  - AC #3/#4 (`buildOptimizedDrizzleSelect`, generic + unit-tested) → `project-context.md` "Optimized DB Queries" rule → `packages/graphql-select/optimized-select.ts` + `.test.ts` (Task 4).
  - AC #5 (codegen fails build on drift) → `turbo.json` `codegen`→`build` `dependsOn` chain (Task 3).
  - `@tanstack/react-query` dependency added but not configured → AD-4 (State Management, Server State tier) + explicit Pre-Coding Approval Gate sign-off (Dev Notes sequencing conflict).
  - Package isolation (`react-query`/`graphql-request` in `apps/web` only; `graphql`/`graphql-parse-resolve-info` in `packages/graphql-select` only, kept out of `packages/database` so the `db-migrate` CI job's dependency graph stays honest) → project-context.md package dependency rules + Dev Notes rationale.
- **Verification Plan:**
  - `pnpm --filter backend dev` + manual GraphQL query against `http://localhost:4001/graphql` (`{ health }`) returns `true`; an over-limit query is rejected by `graphql-armor`.
  - `pnpm run codegen` (or `pnpm build`) succeeds, producing `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts`.
  - `pnpm --filter graphql-select test` passes, covering `buildOptimizedDrizzleSelect` against ≥2 different tables.
  - `pnpm build` and `pnpm lint` clean at the repo root, and `packages/database/package.json` is confirmed unchanged (diff check).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: GraphQL server scaffold (local-dev-runnable only, no AWS deployment — that's Story 0.14) + Code Generator pipeline (server + client) + generic `buildOptimizedDrizzleSelect` utility — no `Event`/`Schedule` GraphQL types or resolvers (Story 1.3a's scope), no React Query provider wiring (Story 0.9's scope).
- [ ] Architecture and boundary confirmation: `apps/backend` is net-new; `buildOptimizedDrizzleSelect` lives in a new dedicated `packages/graphql-select` package — not `packages/database` (kept pure schema/migrations/seed so the `db-migrate` CI job's dependency graph never has to declare `graphql`, per Dev Notes), and not `packages/domain` (it is a Drizzle/GraphQL-AST-coupled data-access utility, not framework-agnostic business logic); codegen output for `apps/web` lives at `apps/web/src/generated/graphql.ts` (never a shared package, to preserve `react-query`-in-`apps/web`-only isolation).
- [ ] Testing plan confirmation: `buildOptimizedDrizzleSelect` gets real `node:test` unit tests (Task 4, AC #4 is non-negotiable); everything else is manual/browser verification (Task 5), given no automated integration/E2E framework exists yet (Story 0.10 `backlog`).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (no gap); Gate 2 run fresh (no gap).
- [ ] **Sequencing conflict accepted:** `@tanstack/react-query` will be added as an `apps/web` dependency by this story (required for the generated `typescript-react-query` hooks file to type-check), even though Story 0.9 ("Set up state management foundation") — which owns configuring the actual `QueryClientProvider`/Server State pattern — is still `backlog` and numbered after this story. Confirm this is acceptable, OR implement Story 0.9 first via `dev-story`, OR descope the `react-query` codegen plugin from this story (generating only plain `graphql-request`-typed functions) and defer it to whichever story first wires up React Query.

## Testing Requirements

- [ ] Unit tests (required, not deferred): `packages/graphql-select/optimized-select.test.ts` via `node:test`/`tsx --test`, proving `buildOptimizedDrizzleSelect` selects only requested fields across ≥2 different tables (AC #4).
- [ ] Integration tests: Deferred — no test framework exists yet for `apps/backend`/`apps/web` (Story 0.10 `backlog`). Backfill an integration test asserting the `health` query resolves correctly once Vitest/MSW land.
- [ ] E2E tests: Deferred for the same reason; not applicable to this story regardless (no UI).
- [ ] Manual verification (interim, required before marking this story done): GraphQL server boot + `health` query, `graphql-armor` rejection of an over-limit query, `codegen` producing both generated files, `pnpm build`/`pnpm lint` clean (Task 5).

## Deliverables Checklist

- [ ] `apps/backend` scaffolded as a working workspace package with `graphql-yoga` server, `graphql-armor` depth/complexity protection, and a `health` placeholder query.
- [ ] `apps/backend/codegen.ts` and `apps/web/codegen.ts` configured and producing generated types/hooks; wired into `turbo.json`'s `build` task so drift fails CI.
- [ ] New `packages/graphql-select` package scaffolded (`package.json`, `tsconfig.json`, `eslint.config.mjs`) with `buildOptimizedDrizzleSelect` (`optimized-select.ts`) exported from its `index.ts`, and passing unit tests in `optimized-select.test.ts`.
- [ ] `packages/graphql-select/package.json` has a `"test"` script so `turbo run test` picks up the new tests; `packages/database` is confirmed untouched.
- [ ] Manual verification pass completed (Task 5) and recorded in Completion Notes.

## Out of Scope

- `Event`/`Schedule` GraphQL types, the Unified Query DSL parser, and the actual events resolver — Story 1.3a (`Depends on: Story 0.8` per `epics.md`).
- Configuring `QueryClientProvider` or any React Query usage pattern in `apps/web` — Story 0.9 ("Set up state management foundation", `backlog`). This story only adds the raw dependency so generated hooks compile (see Pre-Coding Approval Gate).
- Any actual AWS deployment (Lambda handler wrapper, API Gateway wiring, IaC) — Story 0.14 ("Set up AWS IaC for Lambda, SQS, EventBridge, and KMS", `backlog`). This story's server is local-dev-runnable only.
- Updating `SETUP_WALKTHROUGH.md`'s stale "Backend (AWS Serverless)" section — no new cloud/external service account is created by this story; that section should be corrected once Story 0.14 (real AWS deployment) lands.
- Automated integration/E2E tests for the GraphQL server or generated hooks — blocked on Story 0.10 (`backlog`); tracked as a backfill note in Testing Requirements.
- Wiring the generated `apps/web/src/generated/graphql.ts` hooks into any actual page/component — the first real consumer is Story 1.3a/1.3.

## Definition of Done

- [ ] AC #1-#5 satisfied.
- [ ] `buildOptimizedDrizzleSelect` unit tests passing (Task 4/Testing Requirements — non-negotiable, unlike the deferred integration/E2E tests).
- [ ] Manual verification (Task 5) performed and recorded in Completion Notes.
- [ ] `pnpm lint` and `pnpm build` passing for `apps/backend`, `apps/web`, and `packages/graphql-select` (`packages/database` untouched).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the `@tanstack/react-query` sequencing item.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
