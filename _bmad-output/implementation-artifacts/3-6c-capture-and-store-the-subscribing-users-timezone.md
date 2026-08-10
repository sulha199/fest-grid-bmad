---
baseline_commit: c7b60442dc7946373e536a48f4df121cdac9c9ad
---

# Story 3.6c: Capture and store the subscribing user's timezone

## Story Details

- **Epic:** 3
- **Story ID:** 3.6c
- **Status:** ready-for-dev

## Story

**As a** system,
**I want** to capture and persist each user's IANA timezone,
**So that** PRD FR33 Tier 2 (subscriber-timezone fallback, Story 3.6a) has real data to resolve ambiguous event timezones instead of every case falling through to manual clarification.

## Acceptance Criteria

1. **Given** a user has an active authenticated session, **when** the client resolves the browser's IANA timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, **then** capture is attempted both (a) on initial session establishment (the existing `getSession()` call in `AuthSessionProvider`, which fires on every app load for an already-logged-in user) and (b) on every subsequent Supabase `onAuthStateChange` callback where a session is present — not gated to the `SIGNED_IN` event alone. [User-confirmed via `AskUserQuestion` during this story's creation — see Dev Notes "Capture Trigger Decision"; this is what makes Tier 2 reachable for users who were already logged in before this feature shipped, per AC5's "next authenticated session" language.]
2. **And** the resolved timezone string is sent to a new, `requireAuth`-protected GraphQL mutation `updateUserTimezone(timezone: String!): Boolean!` (`apps/backend`), following the exact `registerFcmToken` precedent (`apps/backend/src/schema/resolvers.ts`) for a simple, user-scoped, boolean-returning mutation.
3. **And** the resolver validates the incoming string is a syntactically valid IANA timezone identifier using a new pure `isValidIanaTimezone(timezone: string): boolean` function (`packages/domain/src/users`, using `Intl.DateTimeFormat`'s own validation via try/catch — no external library) before writing; an invalid value is rejected with a `GraphQLError` (`extensions.code = 'BAD_REQUEST'`) and `users.timezone` is left unchanged. This is a defense-in-depth boundary check — the client always sends a browser-generated value, but the resolver must not trust an arbitrary client-supplied string.
4. **And** the resolver only writes to `users.timezone` when the validated incoming value differs from the currently-stored value (a `db.select` read followed by a conditional `db.update`, not an unconditional write) — this keeps the mutation cheap to call on every session establishment per AC1, since after the first successful capture in a browser/timezone combination, every subsequent call is a read-and-skip.
5. **And** existing users who have not yet had a session capture their timezone continue to have `users.timezone = NULL` until their next authenticated session captures one — this story does not backfill.
6. **And** the client-side capture call is entirely best-effort/non-blocking: any failure (network error, mutation error) is caught and logged via `console.warn` without surfacing a UI error, blocking navigation, or interrupting the session — mirroring the existing `try/catch` + `console.warn` pattern already used for the PostHog `identify`/`capture` calls in the same `AuthSessionProvider` file.

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.6a):** Story 3.6a's own creation found that `users.timezone` (needed for PRD FR33 Tier 2) has no capture mechanism anywhere in the codebase — without this story, Tier 2 can structurally never fire (every schedule falls through to Tier 3/flagged). Surfaced by Gate 3 (`story-split-gate.md`); user confirmed via `AskUserQuestion` to split this out as its own story rather than have 3.6a build the capture UI/mutation itself, keeping 3.6a's zero-`apps/web`-surface shape consistent with Story 3.5/3.6's own precedent. Positioned as a lettered suffix directly off Story 3.6, matching the existing 3.6a/3.6b sibling family.

**Amendment (2026-08-10, added via `bmad-create-story` during this story's own creation):** epics.md's original AC left "an appropriate point in the session (e.g. login, or settings page load)" as an open example, not a mandate. Investigating `AuthSessionProvider` (`apps/web/src/components/providers/auth-session-provider.tsx`) found its only per-session side effects (PostHog `identify`/`capture`) are gated to the Supabase `SIGNED_IN` auth event, which fires on a *fresh* login but **not** when an already-authenticated user simply reloads the app (that path only calls `supabase.auth.getSession()`, with no equivalent hook today). A real, non-mechanical tradeoff — capture coverage speed vs. minimal footprint — was presented to the user via `AskUserQuestion` before drafting AC1: **decided** to capture on every established session (both the initial `getSession()` resolution and every `onAuthStateChange` event with a truthy session), not just `SIGNED_IN`, so that a user who was already logged in before this feature shipped gets captured on their very next app open rather than only their next explicit login. AC4's read-before-write guard is what keeps this affordable to call this frequently.

**Depends on:** Story 3.6a (`review` — the `users.timezone` nullable text column and its migration are already committed; confirmed directly by reading `packages/database/schema.ts`, which has `timezone: text('timezone')` on the `users` table, migration `0019_wet_leper_queen.sql`, and `packages/shared-types/src/index.ts`, which already has `User.timezone?: string`).

## Tasks / Subtasks

- [ ] **Task 1 (AC3) — IANA timezone validator (`packages/domain`):**
  - Create `packages/domain/src/users/validateTimezone.ts` exporting `isValidIanaTimezone(timezone: string): boolean` — returns `true` only if `new Intl.DateTimeFormat(undefined, { timeZone: timezone })` does not throw and `timezone` is a non-empty string; `false` otherwise (catches the `RangeError` `Intl.DateTimeFormat` throws for an invalid zone).
  - Create `packages/domain/src/users/index.ts` exporting `export * from './validateTimezone.js';`, mirroring `packages/domain/src/user-settings/index.ts`'s exact shape.
  - Add a new `"./users"` entry to `packages/domain/package.json`'s `exports` map (`types`/`default` pointing at `./dist/users/index.d.ts` / `./dist/users/index.js`), mirroring the existing `"./user-settings"` entry exactly.
  - **No React, no `drizzle-orm`, no Node-runtime-only import** — pure `Intl` usage only, satisfying `packages/domain`'s frontend-safety constraint (this function is intentionally also safe to call from `apps/web` if ever needed, though this story only calls it from `apps/backend`).
- [ ] **Task 2 (AC3) — Test the validator (`packages/domain`, 100% coverage):**
  - Create `packages/domain/src/users/validateTimezone.test.ts` (`node:test`, no DB): valid zones (`'America/New_York'`, `'Asia/Jakarta'`, `'UTC'`, `'Etc/UTC'`) return `true`; invalid strings (`'Not/AZone'`, `''`, `'garbage'`, `'America/NotACity'`) return `false`.
- [ ] **Task 3 (AC2, AC3, AC4) — GraphQL mutation schema (`apps/backend`):**
  - Create `apps/backend/src/schema/user-timezone.graphql`:
    ```graphql
    extend type Mutation {
      updateUserTimezone(timezone: String!): Boolean!
    }
    ```
  - Run `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` with the new `updateUserTimezone` resolver signature.
- [ ] **Task 4 (AC2, AC3, AC4) — Resolver implementation (`apps/backend`):**
  - In `apps/backend/src/schema/resolvers.ts`, import `isValidIanaTimezone` from `@festgrid/domain/users` (alongside the existing `@festgrid/domain/user-settings`/`@festgrid/domain/user-locations` imports).
  - Add `updateUserTimezone` to the `Mutation` resolver map, following the `registerFcmToken` shape precisely: `requireAuth(context)` first; then validate via `isValidIanaTimezone` (throw `GraphQLError('Invalid IANA timezone.', { extensions: { code: 'BAD_REQUEST' } })` if invalid); then `db.select({ timezone: users.timezone }).from(users).where(eq(users.id, authUser.userId)).limit(1)`; if the current value differs from the incoming `timezone`, `db.update(users).set({ timezone, updatedAt: new Date() }).where(eq(users.id, authUser.userId))`; return `true` unconditionally on success (whether or not a write occurred).
- [ ] **Task 5 (AC2) — Integration tests (`apps/backend`, real local DB):**
  - Create `apps/backend/src/schema/user-timezone.test.ts`, mirroring `apps/backend/src/schema/fcm-tokens.test.ts`'s exact harness (`graphql-yoga` `createSchema`/`createYoga` over the real `.graphql` files, seeded test users from `db.select().from(users).limit(...)`, mock `context.user`).
  - Cases: unauthenticated call rejected (`UNAUTHENTICATED`, no DB write); invalid timezone string rejected (`BAD_REQUEST`), `users.timezone` unchanged; first-time capture writes the value and returns `true`; resubmitting the identical value returns `true` and does **not** re-issue an `UPDATE` (assert `users.updatedAt` is unchanged across the two calls, proving AC4's read-before-write guard); submitting a different valid value after an existing value updates it.
- [ ] **Task 6 (AC1) — Frontend GraphQL operation document (`apps/web`):**
  - Create `apps/web/src/features/auth/mutations.graphql`:
    ```graphql
    mutation updateUserTimezone($timezone: String!) {
      updateUserTimezone(timezone: $timezone)
    }
    ```
  - Run `pnpm --filter web codegen` to regenerate `apps/web/src/generated/graphql.ts` with the new `useUpdateUserTimezoneMutation` React Query hook, following the exact pattern `useUpdateUserSettingsMutation`/`useRegisterFcmTokenMutation` already use.
- [ ] **Task 7 (AC1, AC6) — Wire capture into `AuthSessionProvider` (`apps/web`):**
  - In `apps/web/src/components/providers/auth-session-provider.tsx`, add a local helper (e.g. `captureTimezone(mutateAsync)`) that resolves `Intl.DateTimeFormat().resolvedOptions().timeZone` and calls `mutateAsync({ timezone })` inside a `try/catch`, `console.warn`-ing (never throwing) on failure — mirroring the existing PostHog `try { ... } catch (e) { console.warn(...) }` blocks in the same file exactly.
  - Call it from **both** places a truthy session becomes available: (a) inside the initial `supabase.auth.getSession().then(...)` block, when `initialSession` is truthy; (b) inside the `onAuthStateChange` callback, whenever `currentSession` is truthy (not gated to `event === 'SIGNED_IN'`), per AC1.
  - Use the generated `useUpdateUserTimezoneMutation(graphqlClient)` hook (Task 6) for `mutateAsync`, called from the component body (not conditionally), consistent with the Rules of Hooks — the two call sites above invoke the resulting `mutateAsync` function, not the hook itself.
- [ ] **Task 8 (Global) — Full verification:**
  - `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained.
  - `pnpm --filter backend test` — new `user-timezone.test.ts` passes; all existing suites remain green, unmodified.
  - `pnpm --filter web test` — new/updated frontend tests pass (see Testing Requirements).
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions.

## Dev Notes

### Architecture & UX Gate Findings

**This story is NOT covered by the swept `epic-3-readiness.md`** — its frontmatter `stories_covered` list (checked directly during this story's creation) includes `3.6` and `3.6b`, but not `3.6a` or `3.6c` (both were created 2026-08-10, the day after the 2026-08-09 sweep). Per the lightweight-guard instruction in `story-split-gate.md`, all three gates were run fresh via one-shot persona subagents against this story's specific scope rather than silently trusted from the epic-wide sweep:

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona) — No gap found.** The client only calls a browser-native `Intl` API and a GraphQL mutation (no direct DB/ORM/external-service access from `apps/web`); the mutation rides the already-established schema-first GraphQL + `requireAuth` + Drizzle resolver pattern (`registerFcmToken` is a directly comparable precedent); no new infra is required (the `users.timezone` column and its migration already exist, shipped by Story 3.6a).
- **Gate 2 (UI Complexity & Reusability, Freya persona) — No gap found.** This story renders nothing — no new component, no visible UI, no complex/reusable hook exposed to other consumers (a single `useEffect`-style capture call added to the existing `AuthSessionProvider`, not extracted for reuse elsewhere). A grep of `design-artifacts/` for "timezone" (case-insensitive) returned zero matches, confirming no authoritative UX spec documents a visible timezone capture/display flow this silent-background approach would be missing.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona) — No gap found.** The GraphQL scaffold, GraphQL Code Generator pipeline, `AuthSessionProvider`/session infrastructure, and analytics foundation are all already established by prior stories (0.x, 1.7, 1.9); this story adds one new mutation resolver and one new effect inside an existing provider, introducing no new named cross-entity utility and nothing a second future story/epic would independently need to build.

### Capture Trigger Decision

See the Amendment note under Acceptance Criteria above for the full tradeoff writeup. Summary: `AuthSessionProvider`'s only existing per-session logic (PostHog `identify`/`capture`) is gated to the Supabase `SIGNED_IN` event, which does not refire for an already-persisted session on page reload — only the separate, effect-free `getSession()` call handles that path today. Capturing timezone only on `SIGNED_IN` would leave any user who was already logged in before this story ships without a captured timezone until their next explicit logout/login, which could be indefinite for a persistent OAuth session — directly undermining this story's stated purpose ("so that Tier 2 has real data instead of every case falling through to manual clarification"). The user confirmed via `AskUserQuestion`: capture on every established session (both `getSession()`'s initial resolution and every `onAuthStateChange` event with a truthy session), relying on AC4's server-side diff-check to keep repeat calls cheap.

### Return Type & `Me` Type Decision

No GraphQL `User` object type exists in this codebase today — only a minimal `type Me { id, email, role }` (`apps/backend/src/schema/auth.graphql`), which does not expose `timezone`. Since no AC in this story (or any dependent story) requires reading the timezone back via GraphQL, this story does **not** extend `Me` or introduce a `User` GraphQL type — `updateUserTimezone` returns a plain `Boolean!`, mirroring `registerFcmToken` exactly. This is a mechanical precedent-following choice, not a tradeoff requiring separate confirmation.

### "Only Write If Differs" Is a New Precedent

No existing resolver in this codebase does a read-then-compare-then-conditionally-write for a scalar field — existing patterns are either idempotent upserts (`registerFcmToken`'s `onConflictDoUpdate`) or unconditional field-diff-based partial updates (`updateUserSettings` only *sets* fields present in the input, but always issues the `UPDATE`). This story's resolver introduces the first true read-compare-skip pattern, required by AC4 to make AC1's "call on every established session" affordable. Confirm this shape via Task 5's dedicated "resubmitting the identical value does not re-issue an UPDATE" test (asserted via unchanged `users.updatedAt`).

### Previous Story Intelligence (Story 3.6a, `review`)

- `packages/database/schema.ts`: `users.timezone: text('timezone')` (nullable, no default) — already exists, migration `0019_wet_leper_queen.sql` already committed. This story does **not** need a new migration.
- `packages/shared-types/src/index.ts`: `User.timezone?: string` already present, matching PRD §4.8's doc comment verbatim. No `shared-types` change needed.
- Story 3.6a's own Dev Notes ("Timezone Capture Is a Separate Story") explicitly named this story as the intended consumer and confirmed `users.timezone` is expected to stay `NULL` for all users until this story ships.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no DB schema or migration changes required; one additive GraphQL schema change; one new internal `packages/domain` export path.**
- **Impacted fields/contracts:**
  - `packages/database/schema.ts`: no change — `users.timezone` already exists (Story 3.6a).
  - `packages/shared-types/src/index.ts`: no change — `User.timezone?: string` already exists (Story 3.6a).
  - `apps/backend/src/schema/user-timezone.graphql` (new): additive `extend type Mutation { updateUserTimezone(timezone: String!): Boolean! }` — no existing type/field modified.
  - `packages/domain/package.json`: new `"./users"` export path — additive, no existing export path changed.
- **Required DB migration changes:** None. `users.timezone` and its migration already exist and are committed.
- **Required TypeScript type changes:** None beyond the new, purely-additive `packages/domain/src/users` module and the codegen-regenerated `apps/backend/src/generated/resolvers-types.ts` / `apps/web/src/generated/graphql.ts` (both auto-generated, not hand-edited).
- **Backward compatibility and rollout notes:** Purely additive on every layer. No existing resolver, query, or component is modified in a breaking way — `AuthSessionProvider`'s existing session/PostHog logic is extended (new calls added alongside, not replacing existing branches).
- **Verification checks:** Task 2's 100%-covered validator unit tests; Task 5's real-local-DB integration tests (including the read-before-write proof); Task 8's full build/lint/test.

### Project Structure Notes

- **New:** `packages/domain/src/users/validateTimezone.ts` + `.test.ts` + `index.ts`; `apps/backend/src/schema/user-timezone.graphql` + `user-timezone.test.ts`; `apps/web/src/features/auth/mutations.graphql`.
- **Modified:** `packages/domain/package.json` (`exports` map); `apps/backend/src/schema/resolvers.ts` (new `updateUserTimezone` resolver + import); `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen); `apps/web/src/components/providers/auth-session-provider.tsx` (new capture calls); `apps/web/src/generated/graphql.ts` (regenerated via codegen).
- **Not modified:** `packages/database/schema.ts` / `packages/database/migrations/`; `packages/shared-types/src/index.ts`; `apps/backend/src/schema/auth.graphql` (`Me` type, deliberately not extended — see "Return Type & `Me` Type Decision"); `apps/infrastructure/*` (no new infra); `apps/backend/src/env.ts` / `SETUP_WALKTHROUGH.md` (no new external vendor/service).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6c] — this story's authoritative AC/Note/Amendment text.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept report frontmatter checked directly; `3.6a`/`3.6c` confirmed absent from `stories_covered`, triggering the fresh-gate lightweight guard.
- [Source: _bmad-output/implementation-artifacts/3-6a-infer-event-timezone-from-subscriber-context-and-flag-ambiguous-cases-for-clarification.md] — confirmed `review`/real-code status of the `users.timezone` column and `User.timezone` type this story depends on; the story that originally deferred capture to this one.
- [Source: apps/backend/src/lib/auth/context.ts] — `requireAuth(context)` / `AuthenticatedUser` shape this story's resolver uses.
- [Source: apps/backend/src/schema/resolvers.ts:581-675] — `updateUserSettings` (conditional-field-update precedent) and `registerFcmToken` (simple `requireAuth` + Boolean-return mutation precedent) this story's resolver follows.
- [Source: apps/backend/src/schema/fcm-tokens.test.ts] — the real-local-DB `graphql-yoga` integration-test harness Task 5 mirrors exactly.
- [Source: apps/backend/src/schema/auth.graphql] — confirmed `Me { id, email, role }` is the only GraphQL user-facing type today, with no `timezone` field.
- [Source: apps/web/src/components/providers/auth-session-provider.tsx] — read in full during this story's creation; confirmed the `SIGNED_IN`-only gating of existing per-session side effects (the exact gap AC1's Amendment resolves), and the `try/catch` + `console.warn` non-blocking pattern Task 7 mirrors.
- [Source: apps/web/src/app/[locale]/settings/notifications/notifications-content.tsx] — the `useXMutation(graphqlClient)` / `mutateAsync` calling convention this story's Task 7 follows.
- [Source: apps/web/src/features/settings/mutations.graphql, apps/web/src/features/settings/queries.graphql] — the per-feature `.graphql` operation-document file convention Task 6's new `apps/web/src/features/auth/mutations.graphql` follows (an existing `apps/web/src/features/auth/queries.graphql` — the `me` query — already establishes the `auth` feature folder).
- [Source: apps/web/codegen.ts, apps/backend/codegen.ts] — confirmed both `pnpm --filter web codegen` and `pnpm --filter backend codegen` regenerate typed hooks/resolver signatures from `.graphql` files; neither generated file is hand-edited.
- [Source: packages/domain/src/user-settings/index.ts, validateUserSettingsInput.ts, packages/domain/package.json] — the domain-subfolder + `index.ts` re-export + `package.json` `exports`-map-entry convention Task 1 mirrors exactly for the new `packages/domain/src/users` module.
- [Source: apps/web/src/app/[locale]/settings/notifications/notifications-content.test.tsx] — the `msw` `graphql.mutation(...)` + `graphql-request`-mocked-client integration-test pattern available for frontend testing, cited in Testing Requirements.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions; epic-level-sweep-mode guidance and its lightweight-guard escape hatch (the basis for running all three gates fresh here).
- [Source: _bmad-output/project-context.md#Code-Quality-Style-Rules, #Testing-Rules] — `packages/domain` pure-logic/no-DB-leakage/100%-coverage rules; State Management / testing-trophy philosophy for `apps/*`.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md §3.7, §4.8] — FR33's three-tier timezone strategy; `User.timezone`'s already-documented doc comment.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Organization (`packages/domain` pure logic vs. `apps/backend` DB-coupled code; new `./users` export path); API & Data (GraphQL-only client-server data fetching); Testing Rules (`packages/domain` 100% coverage; `apps/backend` real-local-DB integration-test convention; `apps/web` testing-trophy).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD-3 migration needed (column pre-exists); GraphQL-only client-server contract preserved (AD-1/AD-2 not implicated — this is a scalar mutation, not an event-collection query).
- [ ] `docs/infrastructure/index.md` / `2-backend.md` — no infra/topology change; this story adds one GraphQL mutation resolver reusing the already-provisioned API Gateway/Lambda/resolver stack — read to confirm no new edge is implied.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/domain/src/users/validateTimezone.ts` + `.test.ts` + `index.ts`; `apps/backend/src/schema/user-timezone.graphql` + `user-timezone.test.ts`; `apps/web/src/features/auth/mutations.graphql`.
- **Modified:** `packages/domain/package.json`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/generated/resolvers-types.ts` (codegen); `apps/web/src/components/providers/auth-session-provider.tsx`; `apps/web/src/generated/graphql.ts` (codegen).
- **Not modified:** `packages/database/schema.ts` / `packages/database/migrations/`; `packages/shared-types/src/index.ts`; `apps/backend/src/schema/auth.graphql`; `apps/infrastructure/`; `apps/backend/src/env.ts`; `SETUP_WALKTHROUGH.md`.

### Rule Mapping

- Code Organization (Domain vs. I/O-coupled) → Task 1 (pure `isValidIanaTimezone` in `packages/domain/src/users`) vs. Task 4 (DB-coupled resolver in `apps/backend`).
- `packages/domain` 100%-coverage rule → Task 2.
- Database Access (Drizzle ORM only) → Task 4's `db.select`/`db.update` calls, no Supabase client, no raw SQL.
- GraphQL Code Generator pipeline (mandated, already established) → Tasks 3 and 6 regenerate typed resolver/hook signatures rather than hand-writing them.
- Reuse over reinvention (`registerFcmToken`'s `requireAuth` + Boolean-return shape, `updateUserSettings`'s conditional-update style, the existing per-feature `.graphql` operation-document convention, `AuthSessionProvider`'s existing `try/catch`/`console.warn` non-blocking pattern) → Tasks 4, 6, 7.
- Story-split-gate discipline (fresh Gate 1/2/3 run since this story predates/postdates the swept report's coverage) → Dev Notes "Architecture & UX Gate Findings" (all three: no gap).

### Verification Plan

- `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained on the new `users` module.
- `apps/backend`: `pnpm --filter backend codegen` produces a clean, additive `resolvers-types.ts` diff; `pnpm --filter backend test` — new `user-timezone.test.ts` passes (including the read-before-write proof), all existing suites remain green and unmodified.
- `apps/web`: `pnpm --filter web codegen` produces a clean, additive `generated/graphql.ts` diff (new `useUpdateUserTimezoneMutation` hook); `pnpm --filter web test` — new/updated tests pass (see Testing Requirements).
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- Manual/deferred: no live Supabase auth flow exercised in an automated test beyond mocking (matches `notifications-content.test.tsx`'s own established `AuthSessionProvider`-mocking precedent for component tests).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements PRD FR33 Tier 2's data-capture side — a new `updateUserTimezone` GraphQL mutation (`apps/backend`), a new pure `isValidIanaTimezone` validator (`packages/domain`), and client-side capture wiring inside the existing `AuthSessionProvider` (`apps/web`), firing on every established authenticated session (not just fresh logins). It does **not** touch Story 3.6a's read-side Tier 2/3 resolution logic, Story 3.6b's Ingestor Lambda, or Story 3.6d's clarification-flag surfacing.
- [ ] Architecture and boundary confirmation: pure logic (`isValidIanaTimezone`) confined to `packages/domain/src/users`, no `drizzle-orm`/Node-only imports; the DB-reading/writing resolver confined to `apps/backend/src/schema/resolvers.ts`; Drizzle ORM is the only DB access path; no direct DB/backend-only dependency called from `apps/web`.
- [ ] Testing plan confirmation: `packages/domain`'s new validator stays 100%-covered; `apps/backend`'s new mutation gets real-local-DB integration tests covering unauthenticated rejection, invalid-timezone rejection, first-write, and the no-op-on-identical-resubmission case (AC4's key guarantee); `apps/web` gets at least one integration test proving the capture call fires on session establishment (see Testing Requirements).
- [ ] **Capture-trigger-frequency decision accepted:** confirm firing on every established authenticated session (initial `getSession()` resolution + every `onAuthStateChange` event with a truthy session), not just the `SIGNED_IN` event, per the user's `AskUserQuestion` decision during this story's creation (see Dev Notes "Capture Trigger Decision").
- [ ] **`Me` type not extended, Boolean return type accepted:** confirm `updateUserTimezone` returns a plain `Boolean!` (mirroring `registerFcmToken`) rather than extending the minimal `Me` GraphQL type with a `timezone` field, since no AC requires reading the value back via GraphQL.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: all three run fresh via one-shot persona subagents (this story is absent from `epic-3-readiness.md`'s swept `stories_covered`) — Gate 1 no gap, Gate 2 no gap, Gate 3 no gap. No prerequisite story added to `epics.md`/`sprint-status.yaml`.
- [ ] **Dependency status confirmed:** Story 3.6a is `review` (not yet `done`, but its `users.timezone` column/migration and `User.timezone` type are real, committed code — confirmed by reading `packages/database/schema.ts` and `packages/shared-types/src/index.ts` directly during this story's creation, the same "review, real code exists" precedent Story 3.6b's own creation relied on).
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/domain/src/users/validateTimezone.test.ts` (new, `node:test`, no DB, 100% coverage): valid IANA zones return `true`; invalid/empty/garbage strings return `false`.
- [ ] `apps/backend/src/schema/user-timezone.test.ts` (new, real local DB, mirrors `fcm-tokens.test.ts`'s seed/cleanup pattern): unauthenticated call rejected (`UNAUTHENTICATED`); invalid timezone string rejected (`BAD_REQUEST`), no DB write; first-time capture writes `users.timezone` and returns `true`; resubmitting the identical value returns `true` without re-issuing an `UPDATE` (assert `users.updatedAt` unchanged — proves AC4); a different valid value after an existing one updates it.
- [ ] `apps/web/src/components/providers/auth-session-provider.test.tsx` (new — no test file exists for this provider today; Vitest + Testing Library + `msw`, following `notifications-content.test.tsx`'s `graphql.mutation(...)`/mocked-`graphqlClient` pattern, with `@/lib/supabase/client`'s `getSupabaseBrowserClient` mocked to control `getSession()`/`onAuthStateChange` behavior): capture mutation fires with a resolved `Intl.DateTimeFormat` timezone string on initial session resolution when a session already exists; capture mutation fires again on a subsequent `onAuthStateChange` event with a truthy session (not just `SIGNED_IN`); a mutation failure is caught and does not throw/break rendering or the existing PostHog/session logic (AC6).
- [ ] E2E: not required — no new visible UI/user flow; per `project-context.md`'s testing-trophy philosophy, matches Story 3.5/3.6/3.6a's own "zero visible UI" precedent for backend-facing plumbing.

## Deliverables Checklist

- [ ] `packages/domain/src/users/validateTimezone.ts` + `index.ts`: implemented, 100%-covered; `"./users"` export added to `packages/domain/package.json`.
- [ ] `apps/backend/src/schema/user-timezone.graphql`: `updateUserTimezone(timezone: String!): Boolean!` added.
- [ ] `apps/backend/src/schema/resolvers.ts`: `updateUserTimezone` resolver implemented and integration-tested.
- [ ] `apps/web/src/features/auth/mutations.graphql`: `updateUserTimezone` operation document added.
- [ ] `apps/web/src/components/providers/auth-session-provider.tsx`: capture wiring added on both initial session resolution and every `onAuthStateChange` event with a session; non-blocking on failure.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- Story 3.6a's read-side Tier 2/3 resolution logic (already implemented, `review` status) — this story only populates the data it reads.
- Story 3.6b's Ingestor Lambda and Story 3.6d's clarification-flag surfacing — unrelated to this story's scope of capturing `users.timezone`.
- Backfilling `users.timezone` for existing users who have not yet had a session since this story ships (AC5, explicit non-goal).
- Extending the GraphQL `Me` type with a `timezone` field, or building any UI to *display* the captured timezone to the user (e.g. in `/settings`) — no AC requires reading it back; this story is capture-only.
- A capture point on the `/settings` page specifically (one of epics.md's two original examples) — superseded by the broader "every established session" decision (Dev Notes "Capture Trigger Decision"), which already covers users who never visit `/settings`.

## Definition of Done

- [ ] All 6 Acceptance Criteria satisfied.
- [ ] `validateTimezone.test.ts` (new) passing with 100% coverage.
- [ ] `user-timezone.test.ts` (new) passing, including the read-before-write ("no-op on identical resubmission") proof.
- [ ] `auth-session-provider.test.tsx` (new) passing, proving capture fires on both initial session resolution and subsequent auth-state changes, and fails silently on mutation error.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] No Drizzle migration generated (none required — confirmed in Data Type Compatibility).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
