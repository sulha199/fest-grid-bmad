# Story 3.6g: Add image-storage opt-in flag and moderator-only mutation

## Story Details

- Epic: 3
- Story ID: 3.6g
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a moderator,
I want to mark a social media account as opted-in to durable image storage,
so that the platform can legally re-host and serve that account's post images with consent on record, ahead of a future self-service account-claim flow.

## Acceptance Criteria

1. **Given** the `social_media_account_profiles` table, **when** this story's migration runs, **then** it adds `is_image_storage_opted_in boolean not null default false` and `image_storage_opt_in_source` (nullable, values `'MODERATOR' | 'ACCOUNT_OWNER'`, via a new `imageStorageOptInSourceEnum` Drizzle `pgEnum` — matching the `defaultLocationChangeSourceEnum` precedent, not a bare `text` column) columns, matching PRD §4.5. [epics.md AC1]
2. **And** a new `setImageStorageOptIn(accountId: ID!, optedIn: Boolean!)` GraphQL mutation, guarded by `requireModerator(context)` only (no subscriber path — not a self-service action yet), sets `isImageStorageOptedIn` and stamps `imageStorageOptInSource: 'MODERATOR'`; throws `NOT_FOUND` if `accountId` doesn't resolve to a `social_media_account_profiles` row. [epics.md AC2]
3. **And** setting `optedIn: false` on a previously-opted-in account does not retroactively delete any already-stored `durableImageUrl` values on that account's posts (matches AD-12 Rule 6's existing no-deletion stance) — it only stops future re-hosting (Story 3.6h, out of scope here); verified with a resolver test that seeds a post with a populated `durableImageUrl`, toggles the account to `optedIn: false`, and asserts the post's `durableImageUrl` is unchanged. [epics.md AC3]
4. **And** the flag is surfaced as a visible toggle in a new **"Accounts" tab** added to Moderator Tools (`/moderator/tools`, `moderator-tools-content.tsx`'s existing `TabbedShell`, alongside "Actor Runs" and "Unprocessed Payloads") — not a hidden admin-only field. [epics.md AC4, corrected — see "AC4 Wording Correction" below]
5. **And** the Accounts tab supports searching by display name, username, or platform (mirroring `ActorRunsContent`'s filter pattern) and paginates results (mirroring `queryActorRuns`'s cursor pagination), since `social_media_account_profiles` has no bound on row count.
6. **And** toggling an account's opt-in state shows a success/error toast and a blocking loader while the mutation is in flight (matching `ActorRunsContent`'s replay-button pattern), and the UI is fully translated (English/Indonesian, next-intl) per the "Exact Locale Keys" list below.

### AC4 Wording Correction

epics.md's AC4 says the flag should be surfaced in Moderator Tools' "**existing** account-management surface (Story 3.11/4.7 family)." During this story's creation I verified that surface does not exist:
- Story 3.11 built `/{platformSlug}/{accountId}` — a **public, unauthenticated** per-account event page, not a moderator surface.
- `/moderator/items` (`moderator-items-content.tsx`) is two **reactive queues** (pending reports, pending default-location-change requests) — it only shows accounts that currently have a pending item, not a browsable account directory.
- `/moderator/tools` (`moderator-tools-content.tsx`) has two tabs today (Actor Runs, Unprocessed Payloads); neither lists/manages accounts generally.

User confirmed via `AskUserQuestion` during this story's creation: build a **new** "Accounts" tab in Moderator Tools (Recommended option), rather than extending the Actor Runs tab or shipping the mutation with no UI. AC4/5/6 above reflect that decision.

## Tasks / Subtasks

- [ ] **Task 1 (AC1) — Database migration:**
  - [ ] In `packages/database/schema.ts`, add `export const imageStorageOptInSourceEnum = pgEnum('image_storage_opt_in_source', ['MODERATOR', 'ACCOUNT_OWNER'])`, positioned near the existing `defaultLocationChangeSourceEnum` (the precedent this mirrors).
  - [ ] Add `isImageStorageOptedIn: boolean('is_image_storage_opted_in').default(false).notNull()` and `imageStorageOptInSource: imageStorageOptInSourceEnum('image_storage_opt_in_source')` (nullable — no `.notNull()`) to the `socialMediaAccountProfiles` table definition.
  - [ ] Run `pnpm --filter @festgrid/database generate` (drizzle-kit) to produce the next-numbered migration file (`packages/database/migrations/00NN_*.sql`, following `0041_pretty_joseph.sql`). Commit the generated SQL and updated `meta/` snapshot — do not hand-write the migration.
  - [ ] Verify the generated SQL creates the `image_storage_opt_in_source` Postgres enum type and both columns with the correct defaults/nullability (spot-check, matching the "Drizzle ORM Types" rule in project-context.md).

- [ ] **Task 2 (AC2, AC3) — Backend GraphQL mutation:**
  - [ ] In `apps/backend/src/schema/social-media-accounts.graphql`, add `isImageStorageOptedIn: Boolean!` and `imageStorageOptInSource: ImageStorageOptInSource` to `type SocialMediaAccountProfile`; add `enum ImageStorageOptInSource { MODERATOR ACCOUNT_OWNER }`; add `setImageStorageOptIn(accountId: ID!, optedIn: Boolean!): SocialMediaAccountProfile!` to `extend type Mutation`.
  - [ ] In `apps/backend/src/schema/resolvers.ts` `Mutation` map, add `setImageStorageOptIn`: call `requireModerator(context)`; select the profile row by `id = accountId` (throw `GraphQLError('Account profile not found', { extensions: { code: 'NOT_FOUND' } })` if missing, mirroring `setAccountDefaultLocation`'s existing not-found pattern); `db.update(socialMediaAccountProfiles).set({ isImageStorageOptedIn: optedIn, imageStorageOptInSource: 'MODERATOR' }).where(eq(socialMediaAccountProfiles.id, accountId)).returning()`; return the updated row. No `packages/domain` extraction needed — this is a direct DB update with no computable business logic, matching `setAccountDefaultLocation`/`editAccountDefaultLocation`'s own precedent of staying inline in `resolvers.ts`.
  - [ ] Do **not** touch `posts` table logic anywhere in this resolver — AC3's no-deletion guarantee is structural (the resolver never reads/writes `posts`), not something to implement defensively.
  - [ ] Run `pnpm --filter backend codegen` (both `apps/backend` and `apps/web`, per Task 4) after the schema change.

- [ ] **Task 3 (AC5) — Backend GraphQL query (Accounts list):**
  - [ ] In `social-media-accounts.graphql`, add `input ModeratorAccountProfileFilters { search: String }`, `type SocialMediaAccountProfileEdge { node: SocialMediaAccountProfile! cursor: String! }`, `type SocialMediaAccountProfileConnection { edges: [SocialMediaAccountProfileEdge!]! pageInfo: PageInfo! totalCount: Int! }` (reusing the global `PageInfo` type already declared in `unprocessed-payloads.graphql` — do not redeclare, per that file's own "auto-discovered" convention), and `queryModeratorAccountProfiles(filters: ModeratorAccountProfileFilters, first: Int, after: String): SocialMediaAccountProfileConnection!` on `extend type Query`.
  - [ ] In `resolvers.ts` `Query` map, add `queryModeratorAccountProfiles`: `requireModerator(context)`; reuse the already-exported `decodeActorRunCursor(after)` for offset decoding (already reused across `queryActorRuns` and the unprocessed-payloads query — despite its name, it's a generic base64-offset decoder, not actor-run-specific); when `filters?.search` is set, filter with `or(ilike(socialMediaAccountProfiles.displayName, '%${search}%'), ilike(socialMediaAccountProfiles.username, '%${search}%'), ilike(socialMediaAccountProfiles.platform, '%${search}%'))` (mirrors `votedAccountSuggestions`'s existing `ilike` pattern); order by `displayName` ascending; mirror `queryActorRuns`'s exact `limit(first+1)`/`hasNextPage`/`totalCount` shape.

- [ ] **Task 4 (AC4, AC6) — Frontend: new Accounts tab:**
  - [ ] Create `apps/web/src/app/[locale]/moderator/tools/moderator-accounts.graphql` with the `queryModeratorAccountProfiles` query (fields: `id accountId platform displayName username isImageStorageOptedIn`) and the `setImageStorageOptIn` mutation. Run `pnpm --filter web codegen` to generate `useQueryModeratorAccountProfilesQuery`/`useSetImageStorageOptInMutation`.
  - [ ] Create `apps/web/src/app/[locale]/moderator/tools/moderator-accounts-hooks.ts`, mirroring `actor-runs-hooks.ts`'s exact shape: a `useQueryModeratorAccountProfiles(filters, cursor, pageSize, enabled)` wrapper and a `useSetImageStorageOptInMutation()` wrapper.
  - [ ] Create `apps/web/src/app/[locale]/moderator/tools/moderator-accounts-content.tsx`, structurally mirroring `actor-runs-content.tsx`: `useRequireModerator()` gate → `RouteLoader` while loading/unauthorized; a search input (debounce not required — matches `ActorRunsContent`'s un-debounced filter precedent) driving `filters.search` via local `useState` (ephemeral, single-component-scoped — no `nuqs`/`zustand`, matching `ActorRunsContent`'s own precedent of plain component state over URL state for this internal tool); a list of rows, each showing `displayName`/`platform`/`username` and the existing `Checkbox` component from `@festgrid/ui` (`packages/ui/src/core/checkbox.tsx` — reuse as-is; do **not** add a new Radix `Switch` primitive/dependency for this, since `Checkbox` already satisfies "a visible toggle" and the project has no existing Radix-`Switch`-based precedent to justify the new dependency) bound to `isImageStorageOptedIn`, calling `setImageStorageOptIn` on change; `BlockingLoader active={isAnyToggleInProgress}` while any row's mutation is in flight (mirrors `ActorRunsContent`'s `isAnyReplayInProgress`); `toast.success`/`toast.error` (via `sonner`, matching `moderator-items-content.tsx`'s pattern) on mutation settle; a "Load more" button mirroring `ActorRunsContent`'s cursor-advance pattern.
  - [ ] Add a `usePostHog()` capture on successful toggle: event name `moderator_image_storage_opt_in_toggled`, payload `{ accountId: string, optedIn: boolean }` (matches the existing `moderator_default_location_change_resolved`/`moderator_report_resolved` payload-shape convention in `moderator-items-content.tsx`).
  - [ ] In `moderator-tools-content.tsx`: add `'accounts'` to the `parseAsStringEnum([...])` tab list, add the third `tabs` entry (`key: 'accounts', label: t('accountsTabLabel'), Component: ModeratorAccountsContent`), import `ModeratorAccountsContent` from the new file.

- [ ] **Task 5 (AC6) — i18n:** Add `accountsTabLabel` to the existing `ModeratorToolsPage` namespace, and a new `ModeratorAccountsPage` namespace, to both `apps/web/locales/en.json` and `apps/web/locales/id.json` (see "Exact Locale Keys" below).

- [ ] **Task 6 — Testing (see Testing Requirements for full detail):**
  - [ ] `apps/backend` `node:test` cases in `resolvers.test.ts`: `setImageStorageOptIn` happy path (moderator toggles true→ returns updated profile), `NOT_FOUND` for an unknown `accountId`, `FORBIDDEN` for a non-moderator caller (mirrors existing `requireModerator`-guarded test precedent), and the AC3 no-deletion case (seed a post with `durableImageUrl` set, toggle the account's opt-in to `false`, assert the post row is untouched); `queryModeratorAccountProfiles` happy path plus a `search` filter case.
  - [ ] `apps/web` Vitest/MSW integration test `moderator-accounts-content.test.tsx`: list renders, search filters the list, toggling a row calls the mutation and shows a success toast, a mutation error shows an error toast.
  - [ ] `apps/web/e2e/moderator-accounts.spec.ts` (Playwright, critical-path only, `test.skip` gated on `E2E_AUTH_STORAGE_STATE` exactly like `actor-runs.spec.ts`): moderator navigates to `/moderator/tools` → "Accounts" tab → toggles a seeded account's opt-in checkbox → sees a success toast.

## Dev Notes

- This story is purely additive within the existing three-tier architecture (`packages/database` → `apps/backend` GraphQL → `apps/web`) — no new AWS infra, no new queue, no AI Gateway involvement.
- The 2026-09-02 `sprint-change-proposal-2026-09-02.md` correct-course session that created this story (and Stories 3.6h-3.6k) is the authoritative source for *why*: Stories 3.6e/3.6f shipped re-hosting/serving unconditionally, with no account-level consent concept in the schema. This story is the schema/mutation half of closing that gap; Story 3.6h (out of scope here, depends on this story) is the half that actually gates re-hosting/serving on the flag this story adds.
- `imageStorageOptInSource` is deliberately nullable and only ever written as `'MODERATOR'` today — `'ACCOUNT_OWNER'` is reserved for a future, not-yet-spec'd self-service account-claim epic (see AD-12 Rule 7, PRD §4.5's doc comment on the field). Do not build any `ACCOUNT_OWNER`-setting path in this story.

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-readiness/epic-3-readiness.md`, `swept: true`) predates this story (swept 2026-08-09; this story was added 2026-09-02 via correct-course), so per `story-split-gate.md`'s epic-level-sweep-mode lightweight guard, Gate 1 and Gate 3 were re-run fresh for this story specifically (not just cited from the stale sweep), alongside a fresh Gate 2 pass (which always runs per-story regardless of sweep status).

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** The migration targets an already-existing table (Story 3.1a, done); the mutation/query live in `apps/backend`, guarded by the already-proven `requireModerator()` helper (used by ~15 other mutations); no new API surface bypasses the backend; no auth/business logic is pushed into the frontend; no new AWS infra is touched.
- **Gate 2 (UI Complexity & Reusability) — No gap found**, run via `runSubagent` (Freya persona). The new "Accounts" tab (paginated/searchable list + one boolean toggle per row) is structurally identical in shape/complexity to the existing `ActorRunsContent` tab, which was itself shipped inline within its own single story (not split out) — same precedent applies here. It has exactly one consumer (this story); no other `epics.md` story currently plans to reuse an accounts-list component. The one real finding from this pass was **factual, not a complexity gap**: epics.md's AC4 describes an "existing account-management surface" that does not exist — corrected above under "AC4 Wording Correction," confirmed with the user via `AskUserQuestion` (chose: build a new tab, the recommended option).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Every shared capability this story needs already exists and is already reused by sibling stories: GraphQL codegen pipeline, the Drizzle nullable-provenance-enum pattern (`defaultLocationChangeSourceEnum` precedent), the moderator route guard (`requireModerator`/`useRequireModerator`, Story 4.7a), and the `TabbedShell` tab-composition pattern already used by `ModeratorToolsContent`. Nothing here is a first-of-its-kind foundation other future stories would also silently depend on.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** two new columns on an existing table, one new Postgres enum type, one new nullable/additive GraphQL field pair, one new mutation, one new paginated query. No breaking change to any existing contract.
- **Impacted fields/contracts:**
  - `packages/database/schema.ts`: new `imageStorageOptInSourceEnum` pgEnum; `socialMediaAccountProfiles.isImageStorageOptedIn` (boolean, not null, default false), `socialMediaAccountProfiles.imageStorageOptInSource` (nullable enum).
  - `apps/backend/src/schema/social-media-accounts.graphql`: `SocialMediaAccountProfile.isImageStorageOptedIn: Boolean!` (additive, always resolvable since the DB column is `not null`), `SocialMediaAccountProfile.imageStorageOptInSource: ImageStorageOptInSource` (additive, nullable); new `enum ImageStorageOptInSource`; new `setImageStorageOptIn` mutation; new `queryModeratorAccountProfiles` query + `ModeratorAccountProfileFilters`/`SocialMediaAccountProfileEdge`/`SocialMediaAccountProfileConnection` types.
  - `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts`: regenerated (mechanical, via `codegen`), both committed.
  - **Deliberately not touched:** `posts` table/schema (AC3 depends on this resolver never touching it); `packages/shared-types` (no interface there represents `SocialMediaAccountProfile` — PRD §4.5's interface is documentation-only, per the same pattern confirmed by prior 3.6-family stories); `Event`/`Post` GraphQL types.
- **Required DB migration:** yes — Task 1, drizzle-kit generated, additive-only (new enum type + two new nullable/defaulted columns; no data migration/backfill needed since `is_image_storage_opted_in` defaults `false` for all existing rows, matching the PRD's stated default).
- **Required TypeScript type changes:** `social-media-accounts.graphql` schema additions (source of truth); both apps' generated GraphQL types via `codegen`. No `packages/domain` or `packages/shared-types` changes.
- **Backward compatibility and rollout notes:** Fully additive. Any existing query selecting `SocialMediaAccountProfile` fields is unaffected (no field removed/retyped). Every pre-existing account row gets `isImageStorageOptedIn = false`, `imageStorageOptInSource = null` on migration — matches AD-12 Rule 7's "opted-in only via explicit moderator action" default.
- **Verification checks:** Task 6's backend resolver tests (mutation happy/NOT_FOUND/FORBIDDEN/no-deletion cases, query happy/search cases); `pnpm codegen` run with no drift in both apps; full `pnpm build`/`pnpm lint`/`pnpm test`.

### Project Structure Notes

- **New:** `apps/web/src/app/[locale]/moderator/tools/{moderator-accounts.graphql, moderator-accounts-hooks.ts, moderator-accounts-content.tsx, moderator-accounts-content.test.tsx}`; `apps/web/e2e/moderator-accounts.spec.ts`; `packages/database/migrations/00NN_*.sql` (drizzle-kit generated name).
- **Modified:** `packages/database/schema.ts` (new enum + 2 columns); `apps/backend/src/schema/social-media-accounts.graphql`; `apps/backend/src/schema/resolvers.ts` (`setImageStorageOptIn`, `queryModeratorAccountProfiles`); `apps/backend/src/schema/resolvers.test.ts`; `apps/backend/src/generated/resolvers-types.ts` (codegen); `apps/web/src/app/[locale]/moderator/tools/moderator-tools-content.tsx` (third tab); `apps/web/src/generated/graphql.ts` (codegen); `apps/web/locales/en.json`, `apps/web/locales/id.json`.
- **Not modified:** `packages/domain/**` (no pure/reusable business logic identified — this is direct CRUD, matching `setAccountDefaultLocation`/`editAccountDefaultLocation`'s own precedent); `packages/ui/**` (reuses the existing `Checkbox` core primitive as-is, no new component); `posts` table/schema; anything in `apps/infrastructure/**` (no infra change); Story 3.6h's re-hosting/serving gate logic (explicitly out of scope, see below).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6g] — this story's own AC/Note, and Stories 3.6e/3.6f/3.6h (surrounding family) for context on the consent gap being closed.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12] — Rule 1 (trigger gated on `isImageStorageOptedIn`, this story's flag), Rule 6 (no-deletion stance, AC3), Rule 7 (consent-gate correction, moderator-only-until-self-service-flow framing this story implements).
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.5] — `SocialMediaAccountProfile.isImageStorageOptedIn`/`imageStorageOptInSource` doc comments, exact field names/types/defaults this story's schema must match.
- [Source: packages/database/schema.ts] — confirmed `socialMediaAccountProfiles` (Story 3.1a) exists with no existing opt-in columns; confirmed the `defaultLocationChangeSourceEnum`/`defaultLocationChangeRequests.changeSource` precedent this story's new enum mirrors exactly.
- [Source: apps/backend/src/lib/auth/context.ts] — `requireModerator()` (existing, proven, used by ~15 mutations).
- [Source: apps/backend/src/schema/resolvers.ts] — read the `setAccountDefaultLocation`/`editAccountDefaultLocation` mutations in full (not-found/state-transition error pattern this story's simpler mutation partially mirrors); the `queryActorRuns` query and `decodeActorRunCursor` (L89) in full (exact pagination shape/cursor-decode reuse this story's new query follows); `votedAccountSuggestions`'s `ilike` multi-field search pattern (this story's `search` filter mirrors it).
- [Source: apps/backend/src/schema/{actor-runs.graphql, social-media-accounts.graphql, unprocessed-payloads.graphql}] — confirmed `PageInfo` is declared once (`unprocessed-payloads.graphql`) and reused/auto-discovered elsewhere, per that file's own comment; exact `Connection`/`Edge`/`Filters` type shape this story's new types mirror.
- [Source: apps/web/src/app/[locale]/moderator/tools/{actor-runs-content.tsx, actor-runs-hooks.ts, actor-runs.graphql, moderator-tools-content.tsx}] — read in full; exact tab-composition (`TabbedShell`, `nuqs` tab enum), hooks-wrapper, and co-located `.graphql` file patterns this story's new tab follows.
- [Source: apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx] — `sonner` toast pattern, `usePostHog().capture()` payload-shape convention (`moderator_default_location_change_resolved`, `moderator_report_resolved`) this story's new PostHog event mirrors.
- [Source: apps/web/src/features/auth/use-require-moderator.ts] — existing moderator route-guard hook (Story 4.7a), reused as-is (`status: 'loading'|'unauthenticated'|'unauthorized'|'authorized'`).
- [Source: packages/ui/src/core/checkbox.tsx] — confirmed this is a plain hand-rolled `<input type="checkbox">` component (not Radix-based); confirmed reusing it (rather than adding a new `@radix-ui/react-switch` dependency the project has never used) satisfies AC4's "visible toggle" requirement.
- [Source: git log --follow packages/ui/src/core/{checkbox.tsx, RawJsonViewer.tsx}] — confirmed the precedent that small, single-consumer `packages/ui/core` primitives are added inline within the feature story that first needs them (e.g. `RawJsonViewer` shipped as part of Story 3-4k's own actor-run-browser UI), not split into a dedicated story — informs this story not needing its own UI-primitive split despite touching `packages/ui`-adjacent concerns (ultimately concluded no new primitive is needed at all).
- [Source: apps/web/e2e/actor-runs.spec.ts] — exact E2E pattern (storage-state skip-gate, navigation via profile menu, assertions) this story's new spec mirrors; [Source: _bmad-output/implementation-artifacts/3-4k-moderator-actor-run-browser-and-replay-ui.md] — precedent confirming a moderator-tool UI story includes a critical-path E2E test, not just backend/integration coverage.
- [Source: apps/web/locales/en.json L46-56, L715-745] — exact `ModeratorToolsPage`/`ActorRunsPage` key-naming convention this story's `accountsTabLabel`/`ModeratorAccountsPage` keys follow.
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules] — Drizzle ORM Types rule (Task 1); AD-1/AD-2 Unified Query DSL is confirmed **not applicable** — it binds event-collection retrieval only, and `queryActorRuns`/`votedAccountSuggestions` already establish precedent for non-event admin/list queries bypassing it.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode lightweight-guard basis for re-running Gates 1/3 fresh here.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Critical Implementation Rules (Drizzle ORM Types for the new enum/columns, Task 1; Database Access via Drizzle only, no new pattern; AD-1/AD-2 confirmed not applicable to this non-event query); Code Quality & Style Rules (`packages/ui` Core Primitives reuse — no new component added, existing `Checkbox` reused); Testing Rules (testing-trophy: integration tests required, E2E for this moderator-tool's critical path per the 3-4k precedent).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-12 (this story's binding design: Rules 1, 6, 7).
- [ ] `docs/infrastructure/index.md` — confirmed not applicable: no backend compute/queue/EventBridge/DB-provisioning change, only an additive table-column + resolver change on already-provisioned infrastructure.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/database/migrations/00NN_*.sql` (generated); `apps/web/src/app/[locale]/moderator/tools/{moderator-accounts.graphql, moderator-accounts-hooks.ts, moderator-accounts-content.tsx, moderator-accounts-content.test.tsx}`; `apps/web/e2e/moderator-accounts.spec.ts`.
  - Modified: `packages/database/schema.ts`; `apps/backend/src/schema/social-media-accounts.graphql`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/resolvers.test.ts`; `apps/backend/src/generated/resolvers-types.ts` (codegen); `apps/web/src/app/[locale]/moderator/tools/moderator-tools-content.tsx`; `apps/web/src/generated/graphql.ts` (codegen); `apps/web/locales/en.json`; `apps/web/locales/id.json`.
- **Rule Mapping:**
  - Drizzle ORM Types / DB schema changes ship as generated SQL migrations (project-context.md) → Task 1.
  - Moderator-only mutation guard (`requireModerator`, Story 4.7a) → Task 2.
  - AD-12 Rule 6 (no-deletion on opt-out) → AC3, Task 6's dedicated resolver test.
  - Reuse over reinvention (`decodeActorRunCursor`, `Checkbox`, `TabbedShell`, `ilike` search pattern, `sonner` toast pattern) → Tasks 3, 4.
  - AD-5 analytics (exact PostHog event name/payload) → Task 4.
  - AD-6 i18n (exact locale keys) → Task 5.
  - Story-split-gate discipline (fresh Gate 1/2/3, epic-level-sweep-mode lightweight guard) → Dev Notes "Architecture & UX Gate Findings".
  - Testing-trophy + Definition-of-Done-for-Testing (E2E happy path required per 3-4k precedent) → Task 6.
- **Verification Plan:**
  - `packages/database`: `pnpm --filter @festgrid/database generate` produces a clean migration with no manual SQL edits needed beyond the standard `WHERE`-clause/`.using()` gaps already documented elsewhere in `schema.ts` (neither applies here — no partial index, no GIN index on these columns).
  - `apps/backend`: `pnpm --filter backend test` — new `setImageStorageOptIn`/`queryModeratorAccountProfiles` cases pass; `pnpm --filter backend build`/`lint` clean; `pnpm --filter backend codegen` output committed, matches a fresh regeneration (no drift).
  - `apps/web`: `pnpm --filter web test` — `moderator-accounts-content.test.tsx` passes; `pnpm --filter web codegen` output committed, matches a fresh regeneration; `pnpm --filter web lint`/build clean.
  - `apps/web/e2e/moderator-accounts.spec.ts` — passes locally against a moderator `E2E_AUTH_STORAGE_STATE` session (skipped in CI environments without one, matching `actor-runs.spec.ts`'s existing gate).
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — 2 new DB columns + 1 new enum (additive migration), 1 new moderator-only mutation, 1 new moderator-only paginated query, 1 new tab in an existing moderator page reusing existing primitives (`Checkbox`, `TabbedShell`, `BlockingLoader`, `RouteLoader`). No `packages/domain` change; no new `packages/ui` component; no infra change.
- [ ] Architecture and boundary confirmation — mutation/query stay inline in `apps/backend/src/schema/resolvers.ts` (matching `setAccountDefaultLocation`/`editAccountDefaultLocation`'s own precedent of not extracting to `packages/domain` for straightforward CRUD); frontend stays within `apps/web/src/app/[locale]/moderator/tools/` (no new top-level route — this is a tab, not a page).
- [ ] Testing plan confirmation — backend: mutation happy/NOT_FOUND/FORBIDDEN/no-deletion cases + query happy/search cases (Task 6); frontend: Vitest/MSW integration test (list/search/toggle/error-toast) + one Playwright E2E happy path (moderator toggles opt-in, sees success toast), as specified in the Verification Plan above.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (re-run fresh, epic sweep predates this story). Gate 2: no gap on complexity, but the **AC4 wording correction is accepted** (user confirmed via `AskUserQuestion`: build a new "Accounts" tab, not "surface on an existing" one — epics.md's premise was factually wrong, corrected in this story's own AC4). Gate 3: no gap (re-run fresh; every dependency this story needs already exists).
- [ ] **Design decision accepted:** reuse the existing `packages/ui` `Checkbox` component for the opt-in toggle rather than adding a new Radix `Switch` primitive/dependency (Dev Notes References — no existing Radix-`Switch` precedent in this codebase to justify the new dependency; `Checkbox` already satisfies AC4's "visible toggle" requirement).
- [ ] **Dependency confirmed:** Story 3.1a (`social_media_account_profiles` table) — done. Story 4.7a (moderator auth pattern) — status `review` (not yet `done`, but the underlying `requireModerator`/`useRequireModerator` implementation is already merged and already consumed by `ActorRunsContent`/`ModeratorItemsContent` today); no blocker to proceeding.

## Testing Requirements

- [ ] Integration tests (required): `apps/backend` `node:test` cases in `resolvers.test.ts` for `setImageStorageOptIn` (happy path, `NOT_FOUND`, `FORBIDDEN` for non-moderator, AC3's no-deletion-of-`durableImageUrl` case) and `queryModeratorAccountProfiles` (happy path, `search` filter); `apps/web` Vitest/MSW integration test `moderator-accounts-content.test.tsx` (list render, search filtering, toggle-success-toast, toggle-error-toast).
- [ ] E2E tests (required, critical path only, matching the Story 3-4k moderator-tool precedent): `apps/web/e2e/moderator-accounts.spec.ts` — moderator logs in → navigates to `/moderator/tools` → "Accounts" tab → toggles a seeded account's opt-in checkbox → sees a success toast confirming the change persisted.

### Exact Locale Keys (i18n, Task 5 — both `en.json` and `id.json`)

- `ModeratorToolsPage.accountsTabLabel`
- `ModeratorAccountsPage.pageHeading`, `.pageDescription`, `.searchLabel`, `.searchPlaceholder`, `.optedInLabel`, `.platformLabel`, `.usernameLabel`, `.emptyHeadline`, `.emptyMessage`, `.loadMoreButton`, `.optInSuccessToast`, `.optOutSuccessToast`, `.toggleErrorToast`, `.errorHeadline`, `.errorTryAgain`, `.unknownError`

## Deliverables Checklist

- [ ] `imageStorageOptInSourceEnum` + `isImageStorageOptedIn`/`imageStorageOptInSource` columns added to `socialMediaAccountProfiles`; migration generated and committed.
- [ ] `setImageStorageOptIn` mutation implemented, moderator-guarded, `NOT_FOUND`-safe, never touches `posts`.
- [ ] `queryModeratorAccountProfiles` query implemented, paginated, search-filterable.
- [ ] New "Accounts" tab added to `/moderator/tools`, reusing `Checkbox`/`TabbedShell`/`BlockingLoader`/`RouteLoader`/`sonner` toasts.
- [ ] PostHog `moderator_image_storage_opt_in_toggled` event wired.
- [ ] Backend and frontend GraphQL codegen regenerated and committed.
- [ ] i18n keys added to both `en.json` and `id.json`.

## Out of Scope

- Actually gating the re-hosting upload step or the Event resolver's serving logic on this flag — that is Story 3.6h, which depends on this story.
- The `ACCOUNT_OWNER` self-service opt-in path — no such flow is spec'd anywhere yet (future epic, per AD-12 Rule 7).
- Any backfill/purge of already-stored `durableImageUrl` values for currently-non-opted-in accounts — AD-12 Rule 6's no-deletion stance already covers this; explicitly deferred per Story 3.6h's own Note.
- Any change to `posts`/`events` schema, resolvers, or frontend event-serving components.
- A new `packages/ui` `Switch`/toggle primitive — the existing `Checkbox` is reused instead (design decision above).

## Definition of Done

- [ ] AC1-6 satisfied (including the AC4 wording correction).
- [ ] All required tests passing (backend integration — mutation + query cases; frontend integration; one Playwright E2E happy path).
- [ ] Lint and type checks passing for `packages/database`, `apps/backend`, `apps/web`.
- [ ] `pnpm codegen` run and committed for both `apps/web` and `apps/backend`.
- [ ] The prerequisite confirmation above (Story 4.7a's underlying auth pattern already merged and in active use) remains true at merge time.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
