---
baseline_commit: 3b506cdaeb473b829432d81ab69368828f0e5127
---

# Story 0.21: Set up FCM device token registry

## Story Details

- Epic: 0
- Story ID: 0.21
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an `fcm_tokens` table and a GraphQL mutation resolver to register/unregister device tokens,
so that the backend can reliably map a user to their active devices when sending push notifications (Story 0.12) and clean up inactive tokens.

## Acceptance Criteria

1. **Given** the GraphQL server scaffold (Story 0.8) and FCM SDK setup (Story 0.12) exist, **when** the migration script runs, **then** an `fcm_tokens` table is created (`token` PK, `user_id` FK, `created_at`, `updated_at`). [epics.md AC1]
2. **And** a `registerFcmToken(token: String!)` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17), which upserts the token for the current user. [epics.md AC2]
3. **And** a `unregisterFcmToken(token: String!)` mutation is exposed to allow clients to explicitly remove a token on logout. [epics.md AC3]
4. **Given** a token already exists in `fcm_tokens` (registered previously by this user or a different user — e.g. a shared/reinstalled device), **when** `registerFcmToken` is called with that token, **then** the row's `user_id` is reassigned to the *current* authenticated caller and `updated_at` refreshes — `token` is the upsert conflict target, so the row always reflects "whoever most recently registered this device," never a duplicate row. [Derived from AC2's "upserts the token for the current user" wording — clarifies the reassignment-on-conflict behavior an LLM developer could otherwise miss]
5. **Given** `unregisterFcmToken(token)` is called with a token that belongs to a *different* user than the caller, **when** the mutation resolves, **then** it is a no-op (the other user's row is left untouched) rather than deleting a row the caller doesn't own — the delete is scoped to `token AND user_id = context.user.userId`, never `token` alone. [Derived — AD-7's "never trust client-supplied input for ownership decisions" applies here: a token string is caller-supplied input, so ownership must still be verified against the authenticated context before any row is removed]

## Tasks / Subtasks

- [ ] Task 1: Add the `fcm_tokens` table to `packages/database/schema.ts` (AC: 1)
  - [ ] Add `export const fcmTokens = pgTable('fcm_tokens', { token: text('token').primaryKey(), userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(), ...timestamps }, (t) => ({ userIdIdx: index('idx_fcm_tokens_user_id').on(t.userId) }))` — mirrors the existing `favorites`/`calendarAdditions` table shape (uuid FK to `users` with cascade delete, shared `...timestamps` spread), except the primary key is the `token` string itself (not a separate `id: uuid`), since AC1 explicitly specifies `token` as the PK and a device token is already a natural unique identifier — no surrogate `id` column is added.
  - [ ] Add `fcmTokensRelations = relations(fcmTokens, ({ one }) => ({ user: one(users, { fields: [fcmTokens.userId], references: [users.id] }) }))`, and add `fcmTokens: many(fcmTokens)` to the existing `usersRelations` — mirrors the `favoritesRelations`/`favoritesRelations`-in-`usersRelations` pattern.
  - [ ] Do **not** add a `deletedAt` column — `fcm_tokens` is not in `festgrid-architecture-spine.md`'s AD-8 Soft-Delete Convention list (`EventInfo`, `Favorite`, `CalendarEntry`, `Subscription`, `ApiKey`), and AC1's explicit column list (`token`, `user_id`, `created_at`, `updated_at`) omits it — `unregisterFcmToken` (Task 3) performs a real hard delete.
  - [ ] Run `pnpm --filter database run generate` (drizzle-kit) to produce a new committed migration SQL file (AD-3: schema changes must ship as generated migration files, never hand-written). The output filename is auto-assigned by drizzle-kit (e.g. `0006_<adjective>_<noun>.sql`, following the existing `migrations/0000`-`0005` naming) — do not hand-name it.
  - [ ] Run `pnpm --filter database run migrate` against a local Postgres instance and confirm it applies cleanly; confirm `packages/database/seed.ts` still runs without error (no seed changes needed — no `fcm_tokens` seed data is required for local dev).
- [ ] Task 2: Add the GraphQL mutation schema (AC: 2, 3)
  - [ ] Create `apps/backend/src/schema/fcm-tokens.graphql` with **`extend type Mutation { registerFcmToken(token: String!): Boolean! unregisterFcmToken(token: String!): Boolean! }`** — critically, this must use `extend type Mutation`, **not** a bare `type Mutation { ... }` declaration. `apps/backend/src/schema/favorites-and-calendar.graphql` already declares the base `type Mutation { toggleFavorite... toggleCalendarAddition... }`; `server.ts` (`buildServer()`) concatenates every `*.graphql` file in `src/schema/` into one SDL string, so a second bare `type Mutation` would collide with the existing one and fail schema construction (`Error: Type "Mutation" already exists`). `auth.graphql`/`events.graphql`'s existing `extend type Query { ... }` blocks are the precedent to follow for `Mutation` here.
  - [ ] Both mutations return a plain `Boolean!` (success flag) rather than a dedicated payload type — unlike `toggleFavorite`/`toggleCalendarAddition` (which return the resulting `isFavorited`/`isAddedToCalendar` state because a UI needs to reflect a toggle), no UI consumes these mutations' return value in this story or any currently-`ready-for-dev`/`backlog` story; a bare success boolean is the minimal contract until a real caller (Story 2.9) needs richer feedback.
- [ ] Task 3: Implement `registerFcmToken`/`unregisterFcmToken` resolvers (AC: 2, 3, 4, 5)
  - [ ] In `apps/backend/src/schema/resolvers.ts`, add `fcmTokens` to the existing `import { events, schedules, posts, users, favorites, calendarAdditions } from '@festgrid/database'` line, and add both mutations to the existing `Mutation: { ... }` object (this project's convention keeps all resolvers in this one file regardless of how many `.graphql` schema files exist — do not create a separate resolver module).
  - [ ] `registerFcmToken: async (_, { token }, context) => { const authUser = requireAuth(context); await db.insert(fcmTokens).values({ token, userId: authUser.userId }).onConflictDoUpdate({ target: fcmTokens.token, set: { userId: authUser.userId, updatedAt: new Date() } }); return true; }` — implements AC2/AC4's upsert-and-reassign-on-conflict behavior in a single statement (mirrors Story 0.16's `cache-store.ts` `onConflictDoUpdate` idempotent-write precedent).
  - [ ] `unregisterFcmToken: async (_, { token }, context) => { const authUser = requireAuth(context); await db.delete(fcmTokens).where(and(eq(fcmTokens.token, token), eq(fcmTokens.userId, authUser.userId))); return true; }` — the `and(...)` ownership scoping is the AC5 requirement; a delete filtered on `token` alone would let any authenticated caller remove any other user's device registration just by knowing/guessing their token string.
  - [ ] Both resolvers throw via `requireAuth`'s existing `GraphQLError('...', { extensions: { code: 'UNAUTHENTICATED' } })` for unauthenticated callers — no new error-handling code needed, reuse Story 0.17's helper exactly as `toggleFavorite`/`toggleCalendarAddition` already do.
- [ ] Task 4: Regenerate GraphQL Codegen types (AC: 2, 3)
  - [ ] Run `pnpm --filter backend run codegen` and confirm `apps/backend/src/generated/resolvers-types.ts` regenerates with `registerFcmToken`/`unregisterFcmToken` in the `MutationResolvers`/`Resolvers<GraphQLContext>` shape, and that `resolvers.ts`'s `Mutation` object still satisfies the `Resolvers` type (no `any`-cast escape needed beyond the existing per-argument `any` typing already used throughout `resolvers.ts`).
- [ ] Task 5: Integration tests (AC: 1-5)
  - [ ] Create `apps/backend/src/schema/fcm-tokens.test.ts` using `node:test`/`node:assert`, mirroring `favorites-and-calendar.test.ts`'s exact pattern: read `typeDefs.graphql` + `auth.graphql` + `fcm-tokens.graphql`, build a `createSchema`/`createYoga` instance with a mutable `mockUser` variable swapped per-test to simulate authenticated/unauthenticated calls, run against the real local Postgres (`db` from `../db/client.js`) — no mocking of the DB layer, consistent with this file's sibling tests.
  - [ ] Cover: (a) `registerFcmToken` with no authenticated user → `UNAUTHENTICATED` GraphQL error, no row written; (b) `registerFcmToken` with an authenticated user → a new `fcm_tokens` row exists with that `token`/`userId`; (c) calling `registerFcmToken` again with the **same token** and the **same user** → still exactly one row, `updated_at` changes; (d) calling `registerFcmToken` again with the **same token** but a **different** authenticated user → the row's `userId` is reassigned to the new user (AC4); (e) `unregisterFcmToken` with no authenticated user → `UNAUTHENTICATED` error, no row removed; (f) `unregisterFcmToken` called by the token's actual owner → the row is deleted; (g) `unregisterFcmToken` called with a token that belongs to a **different** user than the caller → the row still exists afterward (AC5's ownership-scoped no-op).
  - [ ] Test setup/teardown must delete any `fcm_tokens` rows it creates (scoped to test-created tokens/user IDs) before and after the suite, mirroring `favorites-and-calendar.test.ts`'s `db.delete(favorites).where(eq(favorites.userId, testUser.id))` cleanup pattern — this suite needs **two** seeded test users (to exercise AC4/AC5's cross-user reassignment/ownership cases), so grab the first two rows from `db.select().from(users).limit(2)` rather than one.
- [ ] Task 6: Verification (AC: 1-5)
  - [ ] `pnpm --filter backend exec tsx --test src/schema/fcm-tokens.test.ts` (or the wired `pnpm --filter backend run test`, which already globs `src/**/*.test.ts`) passes.
  - [ ] `pnpm --filter database run generate` produced migration applies cleanly (Task 1) and `seed.ts` still succeeds.
  - [ ] `pnpm --filter backend run codegen` regenerates cleanly (Task 4).
  - [ ] `pnpm build` and `pnpm lint` pass cleanly at the repo root.

## Dev Notes

- **This story completes Story 0.12's FCM foundation with the missing storage/API layer — this is the Gate 1 finding itself, not a story that depends on new Gate 1/3 analysis.** Story 0.12 established the `firebase-admin`/`firebase` SDK wrappers but persisted no device tokens anywhere (its own Dev Notes explicitly say so: "No new database entity is introduced... Persisting a token... is deliberately left to whichever story first needs it end-to-end"). This story is that story.
- **Story 0.12's own code has not been implemented yet — confirmed via `apps/backend/src/` and `apps/web/src/lib/` listing (no `firebase-admin.ts`, `firebase-client.ts`, or `push-notifications.ts` present; Story 0.12 is still `ready-for-dev` in `sprint-status.yaml`).** This is **not** a blocking sequencing conflict for this story (unlike Story 0.12's own Story-0.8 scaffolding conflict): Story 0.21's scope (the `fcm_tokens` table + `registerFcmToken`/`unregisterFcmToken` mutations) has zero code dependency on Story 0.12's `sendPushNotification`/`buildPushMessage`/`requestPushPermissionAndRegister` functions — nothing in this story imports or calls them. The two stories only relate thematically ("both parts of the FCM foundation"), not through any actual import graph. This story's real code dependencies — Story 0.8 (`apps/backend`/GraphQL scaffold) and Story 0.17 (`requireAuth`, the `users` table) — are both confirmed present and already in active use by other resolvers (`toggleFavorite`, `me`).
- **Scope boundary — explicitly confirmed with the user (2026-08-04):** this story's "So that" clause mentions the backend being able to "clean up inactive tokens," but epics.md's ACs only require the explicit `unregisterFcmToken` mutation (a user-initiated removal on logout) — they do not require a read-side helper for fetching a user's tokens (which Story 3.8 will need to fan out a send across multiple devices) or any automatic/FCM-error-driven invalid-token cleanup mechanism. The user confirmed **strict AC scope only**: this story builds exactly the table + the two mutations, nothing more. A `getActiveFcmTokensForUser(userId)`-style lookup helper and any "remove token after FCM reports it as unregistered" cleanup logic are explicitly deferred to Story 3.8 (`backlog`) — the only story that will actually call `sendPushNotification` and is best positioned to shape that lookup/cleanup around its own retry/error-handling design. This mirrors the "reserved slot, not implemented" precedent Stories 0.12/0.17 both established for their own forward-looking scope boundaries.
- **`epics.md`'s Story 3.8 "Depends on: Story 0.12, Story 2.9" line does not list this story (0.21)**, even though Story 3.8 ("push notification on my registered devices") will clearly need to query the `fcm_tokens` table this story creates. This is because Story 0.21 did not exist yet when Story 3.8's dependency line was originally written (0.21 was added later by the Epic 0 readiness sweep). Not a gap in *this* story — flagged here only so whoever picks up Story 3.8 knows to add `fcm_tokens`/Story 0.21 to its own dependency list and Dev Notes when that story is created.
- **Why no `packages/domain` change:** `registerFcmToken`/`unregisterFcmToken`'s logic is a thin, Drizzle-`onConflictDoUpdate`-coupled upsert/delete — not framework-agnostic business logic, and `packages/domain` is explicitly barred from DB/ORM-specific modules per `project-context.md`. Mirrors Story 0.16/0.17's identical conclusion for their own DB-coupled write logic.
- **Why no `packages/ui` change:** Zero UI ships in this story — confirmed via a fresh Gate 2 (Freya persona) subagent pass (see Architecture & UX Gate Findings below). No component, hook, or util is introduced.
- **No Unified Query DSL (AD-1/AD-2) involvement** — `fcm_tokens` is never queried as an event collection, and no GraphQL `Query` field is added for it in this story (matches epics.md AC's explicit mutation-only surface).
- **No PostHog/analytics events (AD-5)** — this story introduces no user-facing interaction to instrument; the actual moment a user opts into notifications (which would trigger `registerFcmToken` from the frontend) belongs to Story 2.9, which is where any `notification_enabled`-style analytics event should be defined, not here. Mirrors Story 0.12's identical "AD-5 doesn't bind, deferred to the real UI caller" conclusion.
- **No i18n strings (AD-6)** — no user-facing text ships in this story.
- **No state-management categorization applies** — backend-only; nothing is stored in Server State/URL State/Client Global State.
- **No async loader (blocking/non-blocking) categorization applies** — no UI renders a loading state for this story's mutations.
- **AD-8 Soft-Delete Convention does not bind `fcm_tokens`** — it is not in the AD-8 table list (`EventInfo`/`Favorite`/`CalendarEntry`/`Subscription`/`ApiKey`), and AC1's explicit 4-column list omits `deletedAt`. `unregisterFcmToken` performs a genuine hard delete.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` (`swept: true`). This story *is itself* one of the two prerequisite stories that report's Gate 1 pass produced ("Missing DB Table and API for FCM Device Tokens: Story 0.12 establishes the FCM SDKs but provides no database table or API mutation to store device tokens... Added to Epic 0 as it completes the FCM foundation"). No further Gate 1/3 gap analysis is owed by this story — it closes the gap rather than surfacing a new one. **Lightweight escape-hatch guard:** re-checked this story's specific draft scope (one new table, two auth-scoped mutations, reusing the existing `requireAuth`/Drizzle/GraphQL-Yoga stack unchanged) against the sweep and found no new external service category, data entity beyond the one the sweep already anticipated, or infra dependency the epic-wide sweep would not have foreseen — no fresh Gate 1/3 subagent pass warranted.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya (`wds-agent-freya-ux`) persona subagent (required per-story even when the epic sweep is used, since UI scope is story-specific). The subagent read `design-artifacts/UX-festgrid-run-1/DESIGN.md` and `EXPERIENCE.md` in full and confirmed `design-artifacts/UX-wizard-page-run-1/` is unrelated (a generic `/wizard` step-flow page). **Verdict: No gap found.** The only notification-adjacent content found: `/settings/notifications` (EXPERIENCE.md) is the route stub for Story 2.9's own already-scoped toggle screen; a generic app-wide toast/notification visual-style block (DESIGN.md) unrelated to device registration; and a generic "Notifications" line in the Component Patterns inventory with no permission-prompt, opt-in-banner, or device-list UI spec. Neither artifact specifies any component/interaction tied to registering or unregistering an FCM device token — none of Gate 2's three triggers apply to this story's pure-backend scope.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found — this is a net-new table with no existing consumer to reconcile against.
- Impacted fields/contracts: `packages/database/schema.ts` (new `fcmTokens` table + `fcmTokensRelations` + an addition to `usersRelations`). No `@festgrid/shared-types` interface is added or changed — this story exposes no GraphQL `Query` field or read type for `fcm_tokens` (mutation-only surface per epics.md AC), so there is no client-facing data shape to keep in sync.
- Required DB migration changes: A new `drizzle-kit generate`-produced, committed SQL migration file creating the `fcm_tokens` table (`token` text PK, `user_id` uuid FK → `users.id` with `ON DELETE CASCADE`, `created_at`/`updated_at` timestamps) plus its `user_id` index (Task 1).
- Required TypeScript type changes: `packages/database/schema.ts` gains one new table export (`fcmTokens`) and one new relations export (`fcmTokensRelations`), both compile-time inferred — no manually-authored type. `apps/backend/src/generated/resolvers-types.ts` regenerates (Task 4) to add `registerFcmToken`/`unregisterFcmToken` to the `MutationResolvers` shape — a generated-file change, verified via `pnpm build`, not hand-edited.
- Backward compatibility and rollout notes: Purely additive (new table, new mutations) — no existing table, resolver, or client code is modified or could regress. No backfill needed (no `fcm_tokens` data exists anywhere prior to this story).
- Verification checks: `fcm-tokens.test.ts`'s 7 cases (Task 5); the generated migration applying cleanly against local Postgres and `seed.ts` still succeeding (Task 1/Task 6); `pnpm --filter backend run codegen` regenerating without error and `pnpm build` type-checking the new resolvers against the regenerated `MutationResolvers` shape (Task 4/Task 6).

### Project Structure Notes

- Modified: `packages/database/schema.ts` (new `fcmTokens` table/relations) + one new committed migration file under `packages/database/migrations/`; `apps/backend/src/schema/resolvers.ts` (two new `Mutation` resolvers + import addition); `apps/backend/src/generated/resolvers-types.ts` (regenerated).
- New: `apps/backend/src/schema/fcm-tokens.graphql`; `apps/backend/src/schema/fcm-tokens.test.ts`.
- Not modified: `apps/web`, `packages/domain`, `packages/ui`, `packages/graphql-select`, `apps/backend/src/lib/` (no auth/FCM-SDK code touched — `requireAuth` is imported/reused as-is, not modified), `.github/workflows/ci.yml` (no new secrets/env vars needed — this story reads/writes only via the already-configured `DATABASE_URL`).
- Detected conflicts or variances: `apps/backend/src/schema/favorites-and-calendar.graphql` already declares the base `type Mutation { ... }` — `fcm-tokens.graphql` must use `extend type Mutation { ... }` (Task 2) to avoid a duplicate-type schema-build error. Story 0.12 (thematically related, listed as a "Depends on" in epics.md) has not actually been implemented in code yet, but this story has no real code dependency on it (see Dev Notes).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.21] — story AC source (`token` PK / `user_id` FK / `created_at` / `updated_at` column list; mutation signatures).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep (`swept: true`); this story is one of the two prerequisite stories ("Missing DB Table and API for FCM Device Tokens") that report's own Gate 1 pass produced.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule, epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-3, #AD-7, #AD-8] — generated-migrations-only rule; `requireAuth`/`requireModerator` as the single enforcement surface and "never trust client-supplied input for ownership decisions" (informing AC5's ownership-scoped delete); `fcm_tokens`' explicit exclusion from the Soft-Delete Convention's table list.
- [Source: _bmad-output/project-context.md#Technology-Stack, #API-Data, #Database-Performance, #Code-Quality-Style-Rules] — FCM technology choice; Drizzle-only DB access; generated-migration mandate; `packages/domain`/`packages/ui` restrictions (both evaluated, not applicable).
- [Source: _bmad-output/implementation-artifacts/0-12-set-up-firebase-cloud-messaging-foundation.md] — confirms no `fcm_tokens`/device-token persistence exists yet and that persisting a token was deliberately deferred to "whichever story first needs it" — this story.
- [Source: _bmad-output/implementation-artifacts/0-17-set-up-graphql-authenticated-context-layer.md] — `requireAuth`/`GraphQLContext`/`UNAUTHENTICATED` error-code precedent reused unchanged; confirms `@festgrid/database` is already an expected `apps/backend` dependency.
- [Source: apps/backend/src/schema/resolvers.ts, favorites-and-calendar.graphql, favorites-and-calendar.test.ts] — read in full; `toggleFavorite`/`toggleCalendarAddition`'s `requireAuth`-scoped mutation pattern and the `node:test`/`createSchema`+`createYoga`+mutable-`mockUser` integration-test pattern this story mirrors exactly; confirmed `favorites-and-calendar.graphql` already owns the base `type Mutation` declaration (informing the `extend type Mutation` requirement).
- [Source: apps/backend/src/server.ts] — confirms `buildServer()` concatenates every `src/schema/*.graphql` file's raw SDL text, which is why a second bare `type Mutation` declaration would collide.
- [Source: packages/database/schema.ts] — read in full; `favorites`/`calendarAdditions` table shape (uuid FK + cascade delete + `...timestamps` spread) and `usersRelations` mirrored for the new `fcmTokens` table/relations; confirmed no `geolocationCache`/`fcm_tokens` table exists yet (Story 0.16/0.20's table and this story's table are both still pending).
- [Source: packages/database/migrations/0002_military_sir_ram.sql] — `drizzle-kit generate` output-file shape/naming precedent (auto-named, not hand-written).
- [Source: git ls-files / directory listing, apps/backend/src, apps/web/src] — confirmed Story 0.12's `firebase-admin.ts`/`firebase-client.ts`/`push-notifications.ts` do not exist in the codebase yet, informing the "no real code dependency on Story 0.12" Dev Notes finding.
- [Source: docs/infrastructure/4-push-notifications.md, docs/infrastructure/high-level-overview.md] — confirms FCM's role in the architecture; no infra shard content needs updating (this story adds no new AWS/cloud resource, only a DB table + GraphQL mutations on the existing local-dev-runnable backend).
- [User decision, 2026-08-04] — explicit scope-boundary confirmation via `AskUserQuestion`: strict AC scope only; token-lookup helper and invalid-token cleanup both deferred to Story 3.8.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack (Firebase Cloud Messaging), API & Data (Drizzle-only DB access, generated migrations), Code Quality (`packages/domain`/`packages/ui` restrictions, both evaluated not applicable).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-3, #AD-7, #AD-8` — generated-migration mandate; `requireAuth` as the single enforcement surface and ownership-check rule; Soft-Delete Convention's explicit exclusion of `fcm_tokens`.
- [ ] `docs/infrastructure/4-push-notifications.md`, `docs/infrastructure/high-level-overview.md` — confirms FCM's role in the architecture; no infra shard content needs updating (no new AWS/cloud resource).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/database/schema.ts` (new `fcmTokens` table, `fcmTokensRelations`, `usersRelations` addition) + one new committed `drizzle-kit`-generated migration SQL file.
  - New: `apps/backend/src/schema/fcm-tokens.graphql` (`extend type Mutation` block), `apps/backend/src/schema/fcm-tokens.test.ts`.
  - Modified: `apps/backend/src/schema/resolvers.ts` (new `fcmTokens` import + two new `Mutation` resolvers), `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen, not hand-edited).
  - Not modified: `apps/web`, `packages/domain`, `packages/ui`, `packages/graphql-select`, `apps/backend/src/lib/auth/*`, `.env.example`, `turbo.json`, `.github/workflows/ci.yml`.
- **Rule Mapping:**
  - AD-3 (generated migrations only) → `pnpm --filter database run generate` producing the committed migration (Task 1) → AC1.
  - AD-7 (single enforcement surface + never trust client-supplied ownership input) → both mutations call `requireAuth`; `unregisterFcmToken`'s delete is scoped to `token AND userId = context.user.userId`, not `token` alone (Task 3) → AC2/AC3/AC5.
  - AD-8 (Soft-Delete Convention) → evaluated and found **not applicable** — `fcm_tokens` is outside AD-8's table list, so `unregisterFcmToken` hard-deletes (Task 1/Task 3 Dev Notes).
  - `packages/domain` reusable-mechanism check → evaluated and rejected (Drizzle-`onConflictDoUpdate`-coupled, not framework-agnostic) → Dev Notes, mirrors Story 0.16/0.17 precedent.
  - `packages/ui` reusable-component check → evaluated and rejected (zero UI ships) → Dev Notes / Gate 2 finding.
  - i18n/analytics/state-management/loader categorization → all evaluated and found not applicable → Dev Notes.
  - Scope-boundary rule (user decision, 2026-08-04) → strict AC scope only; no lookup helper, no cleanup mechanism → Dev Notes, Out of Scope.
- **Verification Plan:**
  - `apps/backend/src/schema/fcm-tokens.test.ts`'s 7 cases (Task 5) prove AC1-5 end-to-end against a real local Postgres instance, no mocked DB layer.
  - Generated migration applies cleanly to local Postgres; `seed.ts` still succeeds (Task 1/Task 6).
  - `pnpm --filter backend run codegen` regenerates `resolvers-types.ts` cleanly with the two new mutations in `MutationResolvers` (Task 4/Task 6).
  - `pnpm build` and `pnpm lint` pass cleanly at the repo root (Task 6).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: add the `fcm_tokens` table (`token` PK, `user_id` FK, `created_at`, `updated_at`) plus `registerFcmToken`/`unregisterFcmToken` mutations exactly as ACed; no read-side lookup helper, no automatic invalid-token cleanup, no frontend wiring, no UI.
- [ ] Architecture and boundary confirmation: `fcm-tokens.graphql` uses `extend type Mutation` (not a duplicate bare `type Mutation`, which would collide with `favorites-and-calendar.graphql`'s existing declaration); resolvers reuse `requireAuth` unchanged; `unregisterFcmToken`'s delete is ownership-scoped (`token AND userId`), never `token` alone; no `packages/domain`/`packages/ui` change (both evaluated, not applicable).
- [ ] Testing plan confirmation: integration tests (`node:test`, real local Postgres, mirroring `favorites-and-calendar.test.ts`'s exact pattern) covering unauthenticated-rejected, create, same-user re-register, cross-user reassignment (AC4), owner-unregister, and cross-user-unregister-no-op (AC5) — non-negotiable per this project's testing-trophy standard for backend logic.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` — this story *is* the prerequisite that report's own Gate 1 finding produced, no further gap analysis owed; Gate 2 run fresh via Freya persona subagent (no gap found, zero UI surface).
- [ ] **Scope-boundary decision accepted:** confirmed 2026-08-04 via `AskUserQuestion` — "Strict AC scope only." The `getActiveFcmTokensForUser`-style lookup helper and any FCM-invalid-token cleanup mechanism are explicitly deferred to Story 3.8, not built here even as unused reserved code.
- [ ] **Story 0.12 non-blocking sequencing risk accepted:** confirmed via directory-listing check — Story 0.12's `firebase-admin.ts`/`firebase-client.ts` do not exist in the codebase yet (still `ready-for-dev`), but this story's scope has no code dependency on them; only Story 0.8 (`apps/backend`/GraphQL scaffold, confirmed present) and Story 0.17 (`requireAuth`, confirmed present) are real dependencies.

## Testing Requirements

- [ ] Integration tests (required, not deferred): `apps/backend/src/schema/fcm-tokens.test.ts` via `node:test`/`tsx --test`, against a real local Postgres instance, covering all 7 cases listed in Task 5 (unauthenticated-rejected ×2, create, same-user re-register, cross-user reassignment, owner-unregister, cross-user-unregister-no-op).
- [ ] E2E tests: Not applicable — no UI ships in this story (mirrors Story 0.12/0.17's identical "no UI, no E2E" conclusion); a real end-to-end check (frontend calling `registerFcmToken` after obtaining a real FCM token) is deferred until Story 2.9 exists and wires Story 0.12's `requestPushPermissionAndRegister()` to these mutations.
- [ ] Manual verification: Not required for this story (unlike Story 0.12/0.17, this story has no external cloud service or SDK call to verify manually — it is pure Drizzle + GraphQL Yoga, fully covered by the integration test suite above).

## Deliverables Checklist

- [ ] `fcm_tokens` table exists in `packages/database/schema.ts` with a committed, `drizzle-kit`-generated migration applying cleanly.
- [ ] `registerFcmToken(token: String!): Boolean!` and `unregisterFcmToken(token: String!): Boolean!` mutations exposed via `extend type Mutation` in `apps/backend/src/schema/fcm-tokens.graphql`, both `requireAuth`-scoped.
- [ ] `apps/backend/src/schema/resolvers.ts` implements both mutations with correct upsert-and-reassign (AC4) and ownership-scoped-delete (AC5) semantics.
- [ ] `apps/backend/src/generated/resolvers-types.ts` regenerated cleanly via `pnpm --filter backend run codegen`.
- [ ] `apps/backend/src/schema/fcm-tokens.test.ts` passing, covering all 7 cases in Task 5.
- [ ] `pnpm build`/`pnpm lint` pass at the repo root.

## Out of Scope

- A `getActiveFcmTokensForUser(userId)`-style read helper for fetching a user's device tokens — deferred to Story 3.8 (`backlog`), per the user's explicit 2026-08-04 "strict AC scope only" decision.
- Any automatic/FCM-error-driven invalid-token cleanup mechanism (e.g. removing a token after FCM reports it as "not registered" on send) — deferred to Story 3.8 (`backlog`), same decision.
- Actually calling `registerFcmToken`/`unregisterFcmToken` from the frontend — Story 2.9 ("Manage Push Notification Settings", `backlog`) is the future caller that wires Story 0.12's `requestPushPermissionAndRegister()` result into `registerFcmToken`, and calls `unregisterFcmToken` on logout.
- Actually sending a push notification to a user's registered devices — Story 3.8 ("Push notifications for extracted events", `backlog`), which will query this story's `fcm_tokens` table and call Story 0.12's `sendPushNotification` per token.
- Any change to Story 0.12's `firebase-admin`/`firebase` SDK wrapper code — untouched by this story.
- Any AWS Lambda deployment of `apps/backend` — Story 0.14 ("Set up AWS IaC for Lambda, SQS, EventBridge, and KMS", `ready-for-dev`). This story's backend code remains local-dev-runnable/unit-testable only, same scope boundary as every other Epic 0 backend story.

## Definition of Done

- [ ] AC 1-5 satisfied.
- [ ] `fcm-tokens.test.ts`'s integration tests passing (Task 5/Testing Requirements — non-negotiable).
- [ ] Migration committed and applies cleanly; `seed.ts` still succeeds.
- [ ] `pnpm --filter backend run codegen` regenerates cleanly with the two new mutations; `pnpm lint` and `pnpm build` passing for `apps/backend`, `packages/database`.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the scope-boundary and Story-0.12-sequencing acceptance items.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
