# Story 2.6a: Create user-settings table and settings query/mutation resolvers

## Story Details

- Epic: 2
- Story ID: 2.6a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a `user_settings` table (holding at least `hidePastEventsAfterDays` and `pushNotificationsEnabled`, keyed 1:1 to `users`) with a `mySettings` query and `updateUserSettings` mutation,
so that every feature needing a per-user preference — past-event auto-hide (Epic 2, Story 2.7), notification toggle (Epic 2, Story 2.9), and notification-gated delivery (Epic 3, Story 3.8) — reads and writes through one consistent, owned settings store instead of each feature inventing its own.

## Acceptance Criteria

1. **Given** Story 1.1's `users` table and Story 0.17's auth context exist, **when** the migration script runs, **then** a `user_settings` table is created with `id` (uuid pk), `user_id` (uuid FK to `users.id`, `unique`, `onDelete: cascade`), `hide_past_events_after_days` (int, not null, default `7` per PRD §3.4.2), `push_notifications_enabled` (boolean, not null, default `true` — confirmed with user 2026-08-06, no PRD/epics.md default existed prior), plus standard `created_at`/`updated_at` timestamps.
2. **Given** an authenticated user who has never touched Settings before (no `user_settings` row exists yet), **when** `mySettings` is queried or `updateUserSettings` is called, **then** a default-valued row is transparently created for them (get-or-create, race-safe under concurrent requests) and returned/updated — never a `NOT_FOUND` error and never a silently-ephemeral, unpersisted default.
3. **Given** an authenticated user, **when** they call `updateUserSettings(input: { hidePastEventsAfterDays, pushNotificationsEnabled })` with one or both fields set, **then** only the provided fields are updated (partial update, unset fields keep their current stored value) and the updated row is returned.
4. **Given** an unauthenticated caller, **when** `mySettings` or `updateUserSettings` is called, **then** the server returns a `GraphQLError` with `extensions.code === 'UNAUTHENTICATED'` — scoped to `context.user` via `requireAuth` (Story 0.17), never trusting a client-supplied user ID.
5. **Given** an authenticated user, **when** they call `updateUserSettings` with `hidePastEventsAfterDays` outside the sensible bound (< 0 or > 365), **then** the server returns a `GraphQLError` with `extensions.code === 'BAD_REQUEST'` and no row is written.
6. **And** Story 2.7's past-event hiding logic and Story 2.9's notification toggle are expected to read/write through this single table/query/mutation rather than each defining its own storage (this story only provides the storage + API; no `apps/web` or `packages/ui` code ships here).
7. **And** Epic 3's Story 3.8 is expected to read `pushNotificationsEnabled` from this same table/query rather than a separate notification-preferences store, per the cross-epic dependency identified by the Epic 2 readiness sweep.

## Tasks / Subtasks

- [ ] **Task 1: Domain validation logic** (AC: 5)
  - [ ] Create `packages/domain/src/user-settings/validateUserSettingsInput.ts`: `InvalidUserSettingsInputError extends Error`, and `validateHidePastEventsAfterDays(value: number): void` — throws if not an integer or outside `0..365` inclusive, mirroring `validateLocationInput.ts`'s `InvalidUserLocationInputError`/`validateRadiusMeters` style exactly (same package, same error-class pattern).
  - [ ] Create `packages/domain/src/user-settings/index.ts` barrel export.
  - [ ] Add `packages/domain/package.json` `exports["./user-settings"]` entry (mirror the existing `./user-locations` entry).
  - [ ] Unit tests (`validateUserSettingsInput.test.ts`) covering boundary values (0, 365 valid; -1, 366, non-integer invalid) — 100% coverage per Testing Rules (this is the only place unit tests are required in this repo).

- [ ] **Task 2: Database schema + migration** (AC: 1)
  - [ ] Add `userSettings` table to `packages/database/schema.ts`: `id` (uuid pk, `defaultRandom()`), `userId` (`uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull()`), `hidePastEventsAfterDays` (`integer('hide_past_events_after_days').default(7).notNull()`), `pushNotificationsEnabled` (`boolean('push_notifications_enabled').default(true).notNull()`), `...timestamps`. No `deletedAt` column — `user_settings` is explicitly outside AD-8's bound-table list (config-per-user, not a user-removable resource).
  - [ ] Add `userSettingsRelations = relations(userSettings, ({ one }) => ({ user: one(users, { fields: [userSettings.userId], references: [users.id] }) }))`, mirroring `userLocationsRelations`. Add a reverse `userSettings: one(userSettings, { fields: [users.id], references: [userSettings.userId] })` entry to `usersRelations` (true 1:1, unlike `userLocations`/`subscriptions`/`apiKeys`/`favorites`/`calendarAdditions`, which are `many()` from the `users` side).
  - [ ] Run `drizzle-kit generate` to produce `packages/database/migrations/0010_<generated-name>.sql` (+ matching `meta/0010_snapshot.json`/`_journal.json` entries, drizzle-kit-produced). No hand-appended backfill `UPDATE` needed (JIT get-or-create per AC2/Task 3 — see Dev Notes → Design Decisions).
  - [ ] Apply the migration locally and confirm it applies cleanly against local dev Postgres.

- [ ] **Task 3: JIT get-or-create helper (backend, DB-coupled)** (AC: 2)
  - [ ] Create `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts` exporting `getOrCreateUserSettings(userId: string): Promise<UserSettingsRow>` — mirrors `apps/backend/src/lib/auth/user-provisioning.ts`'s `getOrCreateUser` idiom exactly: `db.select()...where(eq(userSettings.userId, userId))`; if found, return it; otherwise `db.insert(userSettings).values({ userId }).onConflictDoNothing({ target: userSettings.userId })` (defaults apply from the column definitions) then re-select and return the final row (race-safe under concurrent requests, whichever insert wins). This helper is DB/Drizzle-coupled (imports `db`, `userSettings` table) — it belongs in `apps/backend`, not `packages/domain`, per the Code Organization rule (packages/domain must stay dependency-free of DB/ORM-specific modules).
  - [ ] This is the single call site both `mySettings` and `updateUserSettings` resolvers use — neither resolver hand-rolls its own get-or-create logic.

- [ ] **Task 4: GraphQL schema** (AC: 1, 3, 6)
  - [ ] Create `apps/backend/src/schema/user-settings.graphql`:
    ```graphql
    type UserSettings {
      id: ID!
      hidePastEventsAfterDays: Int!
      pushNotificationsEnabled: Boolean!
      createdAt: String!
      updatedAt: String!
    }

    input UpdateUserSettingsInput {
      hidePastEventsAfterDays: Int
      pushNotificationsEnabled: Boolean
    }

    extend type Query {
      mySettings: UserSettings!
    }

    extend type Mutation {
      updateUserSettings(input: UpdateUserSettingsInput!): UserSettings!
    }
    ```
    (No `userId` field exposed — matches `UserLocation`'s precedent of never exposing the raw owner FK to the client.)
  - [ ] Run `pnpm --filter @festgrid/backend run codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` (new SDL types — unlike Story 2.5a, this DOES require a codegen re-run since `UserSettings`/`UpdateUserSettingsInput` are brand-new named types, not an existing `JSON`-typed field). Confirm this explicitly, don't assume.
  - [ ] `apps/web`'s own codegen (`apps/web/codegen.ts`, `ignoreNoDocuments: true`) does NOT need a re-run in this story — no `apps/web/src/**/*.graphql` operation document references `mySettings`/`updateUserSettings` yet (that's Story 2.7/2.9's scope). Confirm no `apps/web` generated output changes as a result of this story.

- [ ] **Task 5: Resolvers** (AC: 2, 3, 4, 5)
  - [ ] `Query.mySettings`: `requireAuth(context)` → `getOrCreateUserSettings(authUser.userId)` → return with `createdAt`/`updatedAt` as `.toISOString()` (matching `myLocations`/`createUserLocation`'s existing date-serialization precedent).
  - [ ] `Mutation.updateUserSettings`: `requireAuth(context)` → if `input.hidePastEventsAfterDays !== undefined`, call `validateHidePastEventsAfterDays` (catch `InvalidUserSettingsInputError` → `GraphQLError(..., { extensions: { code: 'BAD_REQUEST' } })`, mirroring `createUserLocation`'s `InvalidUserLocationInputError` catch pattern) → `getOrCreateUserSettings(authUser.userId)` to ensure a row exists → `db.update(userSettings).set({ ...only-provided-fields, updatedAt: new Date() }).where(eq(userSettings.userId, authUser.userId)).returning()` → return with ISO date serialization.
  - [ ] Add `userSettings` to the `@festgrid/database` import list at the top of `apps/backend/src/schema/resolvers.ts` (alongside `events, schedules, posts, users, favorites, calendarAdditions, userLocations`).

- [ ] **Task 6: Integration tests** (AC: 2, 3, 4, 5)
  - [ ] In `apps/backend/src/schema/resolvers.test.ts` (Yoga + real local test DB, matching this file's established `mockUser`/`yoga.fetch` pattern — no mocks for the DB layer): `mySettings` returns `UNAUTHENTICATED` when `mockUser = null`; `mySettings` returns default values (`hidePastEventsAfterDays: 7`, `pushNotificationsEnabled: true`) for a seeded user's first-ever call; a second `mySettings` call for the same user returns the same row (no duplicate insert — assert via a direct `db.select()` count of `1`); `updateUserSettings` partially updates only the provided field and leaves the other untouched; `updateUserSettings` with `hidePastEventsAfterDays: 400` returns `BAD_REQUEST` and does not persist.
  - [ ] No new E2E test in this story — no UI ships (Story 2.7/2.9 own the E2E happy paths for the actual user-facing settings features).

- [ ] **Task 7: Manual verification & documentation**
  - [ ] `pnpm build` / `pnpm lint` clean at the repo root for touched packages (`packages/domain`, `packages/database`, `apps/backend`).
  - [ ] GraphiQL/`curl` smoke test: `mySettings` on a fresh user, then `updateUserSettings`, confirm persisted values survive a second query.
  - [ ] Update `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`'s AD-1/AD-2 field documentation is NOT applicable here (this story adds no DSL field — `mySettings`/`updateUserSettings` are plain auth-scoped root fields, not part of the `events` Unified Query DSL). Explicitly confirm no AD-1 doc change is needed rather than silently skipping it.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`; Story 2.6a is listed in `stories_covered` and is itself the previously-identified resolution to that report's "Cross-epic shared-data-ownership" Gate 3 finding — "User-settings storage for past-event auto-hide (Story 2.7) and push notifications (Story 2.9, 3.8) is addressed by Story 2.6a"). No new Gate 1/3 gap surfaced for this story beyond that already-recorded one. Lightweight escape-hatch guard: this story's scope (one new table + two auth-scoped root resolvers, no external service, no new infra dependency) is exactly what the epic-wide sweep anticipated — no fresh Gate 1/3 subagent dispatch needed.
- **Gate 2 (UI Complexity & Reusability):** Ran via a one-shot Freya-persona subagent dispatch (this story has zero UI surface — pure GraphQL schema/resolver/DB change, matching Stories 2.1a/2.3a/2.3b/2.4b/2.5a/0.16's identical zero-UI precedent). **Verdict: no gap found.** `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` confirms `/settings/notifications` exists only as a bare route name with no detailed UI spec content beyond that, and `DESIGN.md` has no mention of notifications-settings or past-event-hiding UI — so no undocumented visual/interaction requirement is being silently absorbed into this story either. The actual toggle/control UI correctly belongs to Stories 2.7/2.9, both already-existing `backlog` entries.

### Design Decisions Confirmed With User (2026-08-06)

Two real, non-mechanical tradeoffs were surfaced via `AskUserQuestion` before this story was drafted, since neither `epics.md` nor the PRD specifies an implementation approach:

1. **Settings row creation strategy:** Chosen — JIT get-or-create, mirroring Story 0.17's `getOrCreateUser` exact `insert().onConflictDoNothing()` + re-select idiom (AD-7 precedent for identity-adjacent per-user rows), over a migration-time backfill that would also require extending `getOrCreateUser` to insert a settings row on every new-user provisioning. Reasoning: avoids coupling user creation across two tables in one transaction, avoids a backfill migration needing to enumerate all existing users, and is the more idiomatic match for this codebase's existing JIT-provisioning precedent. Consequence for future consumers: Story 2.7/3.8 (and any other future reader of `user_settings`) **must** call the shared `getOrCreateUserSettings(userId)` helper (Task 3) rather than assuming a row always exists via a plain `db.select()` — see Task 3/5, AC2.
2. **`pushNotificationsEnabled` default value:** Chosen — `true` (opt-out), over `false` (opt-in). Reasoning: matches Story 3.8's implicit assumption that push notifications are the primary delivery path for newly-extracted events — an opt-in default would mean most users never discover/enable the feature, weakening the notification FR's actual reach. See AC1.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no mismatch found** — this is a wholly new table with no pre-existing column to reconcile against. Included per this workflow's mandatory section regardless.
- **Impacted contracts:** `packages/database/schema.ts` (new `userSettings` table + `userSettingsRelations` + `usersRelations.userSettings` back-reference); new migration `packages/database/migrations/0010_<generated-name>.sql`; new `apps/backend/src/schema/user-settings.graphql` (new SDL types `UserSettings`/`UpdateUserSettingsInput`); `apps/backend/src/schema/resolvers.ts` (`Query.mySettings`, `Mutation.updateUserSettings`); new `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts`; new `packages/domain/src/user-settings/validateUserSettingsInput.ts` + `packages/domain/package.json` exports map.
- **Required DB migration changes:** Yes — a new table via `drizzle-kit generate` (Task 2). No backfill `UPDATE` needed (JIT get-or-create, not migration-time backfill — see Design Decisions above).
- **Required TypeScript type changes:** Yes, additive — `apps/backend/src/generated/resolvers-types.ts` gains `UserSettings`/`UpdateUserSettingsInput` via a real codegen re-run (Task 4), unlike Story 2.5a which needed no re-run. No `packages/shared-types` interface is added: `user_settings` has no PRD-documented data model (it's an architecture-spine/epics.md-originated addition from the Epic 2 readiness sweep, not a PRD §4.x entity), and this project's end-to-end type safety for GraphQL fields is already provided by `GraphQL Code Generator` per project-context.md's "API & Data" rule — adding a parallel hand-written `shared-types` interface would be a redundant, driftable second source of truth for a shape codegen already owns.
- **Backward compatibility and rollout notes:** Purely additive — a brand-new table and two brand-new root fields (`mySettings`/`updateUserSettings`). No existing query, mutation, table, or resolver behavior changes for any caller. Safe to deploy independently of Stories 2.7/2.9 (which will consume it later).
- **Verification checks:** Task 1's domain unit tests (100% coverage on `validateHidePastEventsAfterDays`); Task 6's integration tests (get-or-create idempotency — asserting exactly one row is ever inserted per user across repeated `mySettings` calls; partial-update correctness; auth/validation error paths); a manual check that the migration applies cleanly and the default values (`7`, `true`) match AC1 exactly.

### Architecture / technical constraints

- **AD-3 (Database Schema Management):** Schema change ships as a `drizzle-kit generate`-produced SQL migration, committed to the repo (Task 2).
- **AD-7 (Authenticated Context):** Both `mySettings` and `updateUserSettings` are fully auth-gated (unlike `events`, which is public-tolerant) — `requireAuth` is called unconditionally at the top of each resolver, and `authUser.userId` (never a client-supplied id) is the sole key used to look up/create/update the settings row (AC4).
- **AD-8 (Soft-Delete Convention) does not bind `user_settings`** — confirmed it is not in AD-8's explicit bound-table list (`EventInfo`, `Favorite`, `CalendarEntry`, `Subscription`, `ApiKey`, `UserLocation`); a per-user config row has no user-facing "delete" action, so no `deletedAt` column, no partial index, and no `SoftDeleteAction` mutation argument apply here (unlike `deleteUserLocation`'s precedent, which is not analogous to this story).
- **Adapter Pattern / General Architecture:** No external service call is introduced. `validateHidePastEventsAfterDays` is pure, dependency-free logic living in `packages/domain/src/user-settings/` per the Code Organization rule (no DB/ORM/Node-only imports). `getOrCreateUserSettings` is intentionally DB-coupled (imports `db`/Drizzle table objects) and therefore lives in `apps/backend`, not `packages/domain` — matching the same domain/backend split already established by `resolveLocationInputMode`/`validateRadiusMeters` (domain, pure) vs. the DB lookups in `createUserLocation`/`updateUserLocation` resolvers (backend, DB-coupled).
- **Package boundaries:** No `packages/graphql-select` involvement — `mySettings` is a direct single-row auth-scoped lookup, not a filterable/paginated list going through the Unified Query DSL (AD-1/AD-2 bind `events`, not this story's root fields).
- **Testing Rules:** `packages/domain` additions get 100% unit-test coverage (Task 1). `apps/backend` follows this repo's existing "testing trophy" pattern — integration tests with a real local test DB for the resolvers (Task 6, matching `resolvers.test.ts`'s established `me`/`mySettings`-analog style, e.g. the existing `me - throws UNAUTHENTICATED error when not authenticated` test). No E2E test in this story — no UI ships.
- **State Management / Loader categorization: not applicable** — backend-only, no UI renders any async state for this story.
- **AD-5 (Analytics) / AD-6 (i18n): not applicable** — no user-facing interaction or text ships from this story (`GraphQLError` messages are developer-facing; Stories 2.7/2.9 own any user-facing translation/display of settings values, matching Story 2.5a/2.3b/2.4b's identical precedent).

### Previous/Sibling Story Intelligence (Stories 0.17, 2.3a, 2.5a)

- **Story 0.17 (`review`, fully implemented in code)** — confirmed via direct read of `apps/backend/src/lib/auth/user-provisioning.ts` and `apps/backend/src/lib/auth/context.ts`. `getOrCreateUser`'s exact `db.select()` → `db.insert().onConflictDoNothing({ target: users.id })` → re-select idiom is the direct, line-level precedent `getOrCreateUserSettings` (Task 3) mirrors. `requireAuth`/`GraphQLContext` (`context.user: { userId, role } | null`) confirmed as the single sanctioned auth-check surface (AD-7 rule 3).
- **Story 2.3a (`review`, fully implemented in code)** — confirmed `createUserLocation`/`updateUserLocation`'s `InvalidUserLocationInputError` → `GraphQLError(..., { extensions: { code: 'BAD_REQUEST' } })` catch pattern via direct read of `apps/backend/src/schema/resolvers.ts` (lines ~64-69) — this story's `Mutation.updateUserSettings` (Task 5) mirrors it exactly for `InvalidUserSettingsInputError`.
- **Story 2.5a (`ready-for-dev`, not yet implemented)** — closest recent architectural analog for "confirm zero-UI Gate 2 precedent via one-shot subagent, confirm Gate 1/3 sourced from the swept `epic-2-readiness.md`, confirm whether a codegen re-run is needed." Unlike 2.5a (which added no new named GraphQL type, so needed no codegen re-run), this story adds brand-new SDL types (`UserSettings`, `UpdateUserSettingsInput`) and therefore DOES require a backend codegen re-run (Task 4) — do not assume 2.5a's "no re-run needed" conclusion carries over here.

### Git Intelligence Summary

Recent commits (`552561c`, `dbf1f80`, `2af58dc`, `767ff1d`, `d8792a9`) are all scoped to Story 2.3's soft-delete-with-undo rollout for `user_locations` and the frontend map-picker UI — none touch `apps/backend/src/schema/resolvers.ts`'s root `Query`/`Mutation` maps for anything settings-related, `packages/database/schema.ts` beyond `user_locations`' `deletedAt` column, or any `user-settings`-named file. Confirms this story's scope genuinely has not started implementation.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Database & Performance, Security; Code Quality & Style Rules → Code Organization; Testing Rules; General Architecture → Adapter Pattern)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-3, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.6a, Story 0.17, Story 1.1, Story 2.7, Story 2.9, Story 3.8)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/3-database.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `packages/domain/src/user-settings/validateUserSettingsInput.ts` (+ `.test.ts`); `packages/domain/src/user-settings/index.ts`.
- Modified: `packages/domain/package.json` (`exports["./user-settings"]`).
- Modified: `packages/database/schema.ts` (`userSettings` table, `userSettingsRelations`, `usersRelations.userSettings` back-reference).
- New: `packages/database/migrations/0010_<generated-name>.sql` (drizzle-kit generated, no hand-appended backfill needed), matching `meta/0010_snapshot.json`/`_journal.json` entries drizzle-kit produces automatically.
- New: `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts`.
- New: `apps/backend/src/schema/user-settings.graphql`.
- Modified: `apps/backend/src/schema/resolvers.ts` (`userSettings` import; `Query.mySettings`; `Mutation.updateUserSettings`); `resolvers.test.ts` (new integration tests).
- Modified: `apps/backend/src/generated/resolvers-types.ts` (regenerated via `pnpm --filter @festgrid/backend run codegen` — not hand-edited).
- **Not modified:** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (no AD-1 DSL field added — see Task 7); `apps/web` (no source or generated-output change — Story 2.7/2.9's scope); `packages/ui` (no UI in this story); `packages/shared-types` (see Data Type Compatibility — codegen already provides end-to-end type safety, no parallel interface needed); `packages/graphql-select` (no DSL/filterable-list involvement).

### Rule Mapping

- *AD-3* → schema change ships as a committed `drizzle-kit generate`d migration (Task 2).
- *AD-7* → `requireAuth` unconditionally gates both `mySettings` and `updateUserSettings`; `authUser.userId` (never client-supplied) is the sole ownership key (AC4, Task 5).
- *AD-8* → confirmed `user_settings` is outside AD-8's bound-table list; no `deletedAt`/partial-index/`SoftDeleteAction` machinery applies.
- *Code Organization (packages/domain)* → pure validation logic lives in `packages/domain/src/user-settings/` (DB/Node-dependency-free); the DB-coupled get-or-create helper correctly lives in `apps/backend` instead (Task 1/3).
- *Testing Rules* → 100% unit coverage for the new `packages/domain` logic (Task 1); integration tests for both resolvers, including get-or-create idempotency (Task 6).
- *Story-split-gate Gate 1/2/3* → Gate 1/3 cited from swept `epic-2-readiness.md` (this story is itself the identified gap-fill, confirmed no fresh gap); Gate 2 run via one-shot subagent, zero in-scope UI gap.

### Verification Plan

- `packages/domain`: `tsx --test` unit tests for `validateHidePastEventsAfterDays` (boundary values 0, 365, -1, 366, non-integer) — 100% coverage.
- `apps/backend`: integration tests (Yoga + real local test DB, `resolvers.test.ts`, matching this file's established pattern — no mocks for the DB layer) — `UNAUTHENTICATED` for both fields when unauthenticated (AC4); default-value first-call correctness (AC1, AC2); get-or-create idempotency via a direct row-count assertion (AC2); partial-update correctness (AC3); `BAD_REQUEST` + no-persist for out-of-bounds `hidePastEventsAfterDays` (AC5).
- Manual: GraphiQL/`curl` smoke test against a fresh local user; confirm migration applies cleanly locally; confirm `pnpm build`/`pnpm lint` clean at the repo root; confirm the backend codegen re-run actually changed `resolvers-types.ts` (not silently skipped) and `apps/web`'s generated output is unchanged (no re-run needed there).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`packages/domain`, `packages/database`, `apps/backend`) — no `apps/web`/`packages/ui` changes (Story 2.7/2.9 consume this later).
- [ ] **No blocking dependency:** confirmed via direct reads that Story 0.17 (`review`, fully implemented in code) and Story 1.1 (`done`) are both real and complete.
- [ ] **Design decisions accepted:** JIT get-or-create (not migration-time backfill), and `pushNotificationsEnabled` defaulting to `true`/opt-out (not `false`/opt-in) — both confirmed with the user via `AskUserQuestion` before drafting (see Dev Notes → Design Decisions Confirmed With User).
- [ ] **Gate 1/2/3 prerequisites confirmed:** Gate 1/3 sourced from swept `epic-2-readiness.md` (this story is itself the identified gap-fill, no fresh gap); Gate 2 run via one-shot subagent — no in-scope UI gap.
- [ ] Architecture and data/API boundaries confirmed: pure validation logic in `packages/domain`; DB-coupled get-or-create helper in `apps/backend`; no `packages/graphql-select` involvement (not a filterable list); new SDL types require a real backend codegen re-run.
- [ ] Testing plan confirmed: 100%-covered `packages/domain` unit tests; `apps/backend` integration tests (real local test DB, no mocks for the DB layer), including get-or-create idempotency.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/domain`: `tsx --test` unit tests, 100% coverage, for `validateHidePastEventsAfterDays` (Testing Rules — the only place unit tests are required in this repo).
- `apps/backend`: integration tests (`tsx --test`, Yoga + real local test Postgres DB, matching `resolvers.test.ts`'s established pattern) for auth gating, default-value first-call behavior, get-or-create idempotency, partial-update correctness, and out-of-bounds validation rejection.
- No new E2E test in this story — no UI ships (Story 2.7/2.9 own the E2E happy paths for the actual user-facing settings features).

## Deliverables Checklist

- [ ] `userSettings` table (`hidePastEventsAfterDays` default `7`, `pushNotificationsEnabled` default `true`, unique `userId` FK) added to `schema.ts`; migration generated and applied locally.
- [ ] `getOrCreateUserSettings(userId)` implemented in `apps/backend`, race-safe (`onConflictDoNothing` + re-select).
- [ ] `validateHidePastEventsAfterDays` implemented and 100%-covered in `packages/domain/src/user-settings/`.
- [ ] `mySettings` query and `updateUserSettings` mutation implemented end-to-end: auth gating, get-or-create, partial update, validation error remapping — with passing integration tests covering AC1-AC5.
- [ ] Backend codegen re-run confirmed to have regenerated `resolvers-types.ts` with the new `UserSettings`/`UpdateUserSettingsInput` types.
- [ ] `pnpm build`/`pnpm lint` clean at the repo root for touched packages.

## Out of Scope

- Any frontend UI for viewing/editing settings (a "Notifications" toggle, a past-event-hiding control on a Settings page) — entirely Story 2.7/2.9's scope; this story only provides the backend storage + API they will consume.
- Epic 3's Story 3.8 actually reading `pushNotificationsEnabled` to gate notification delivery — this story only ensures the field/query exist and are correctly named for that future consumer; no Epic 3 code is touched.
- A migration-time backfill inserting default rows for existing seeded users — explicitly decided against in favor of JIT get-or-create (Dev Notes → Design Decisions Confirmed With User).
- Any additional settings fields beyond `hidePastEventsAfterDays`/`pushNotificationsEnabled` — the AC's "at minimum" phrasing is satisfied by exactly these two; new fields are added by whichever future story first needs them, not speculatively here.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] Required tests passing: `packages/domain` (100% coverage), `apps/backend` integration tests.
- [ ] Lint and type checks passing for `packages/domain`, `packages/database`, `apps/backend`.
- [ ] Migration applied cleanly against local dev Postgres; backend codegen re-run confirmed.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. Gate 1/3 cited from swept `epic-2-readiness.md` (`swept: true`; Story 2.6a listed in `stories_covered` as the already-identified resolution to that report's Gate 3 cross-epic shared-data-ownership finding). Gate 2 run via a one-shot Freya-persona subagent dispatch (evidence inlined into the prompt rather than re-read from cold context, per token-efficiency guidance) — found zero in-scope UI gap (this story is backend-only).
- Two real design tradeoffs — (1) JIT get-or-create vs. migration-time backfill for settings-row creation, (2) `pushNotificationsEnabled`'s default value (no PRD/epics.md guidance existed) — were surfaced to and confirmed by the user via `AskUserQuestion` before drafting, per this project's guidance to not silently pick a side on non-mechanical tradeoffs. Both were resolved toward the recommended, more spec-consistent/idiomatic option (see Dev Notes → Design Decisions Confirmed With User).
- Confirmed (via direct reads of `packages/database/schema.ts` and `festgrid-architecture-spine.md`'s AD-8) that `user_settings` is correctly excluded from the soft-delete convention — a mechanical, not escalated, determination.

### Completion Notes List

### File List
