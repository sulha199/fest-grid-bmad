---
title: "Architecture Spine: FestDaily"
status: "draft"
created: "2026-07-20T09:34:00Z"
updated: "2026-08-06T00:00:00Z"
---

# Architecture Spine: FestDaily

This document defines the core architectural invariants for the FestDaily application. These decisions are binding for all development to ensure consistency and coherence across the platform.

## Architectural Decisions

### AD-1: Unified Query DSL

*   **Binds:** All filtering and query operations for events across the application, including the discovery page, subscribed account page, and push notification filtering.
*   **Prevents:** The development of separate or incompatible query mechanisms for different features.
*   **Rule:** All event queries sent from a client to the backend will conform to a unified JSON-based Domain Specific Language (DSL). This DSL has a recursive structure to allow for complex, nested queries.

    **Structure:**
    The core of the DSL is a JSON object with two keys:
    *   `operator`: (`"and"` | `"or"`) - Defines how the conditions should be combined.
    *   `conditions`: An array of one or more condition objects.

    A condition object can be either:
    1.  A nested query object, containing its own `operator` and `conditions`.
    2.  A terminal condition object with the structure:
        *   `field`: The name of the field to query (e.g., `"eventName"`, `"category"`).
        *   `operator`: The comparison operator (e.g., `"contains"`, `"in"`).
        *   `value`: The value to compare against.

    **Example:**
    This example finds events where the name contains "Festival" AND (the category is "MUSIC" OR the location is near the user's "Home").

    ```json
    {
      "operator": "and",
      "conditions": [
        { "field": "eventName", "operator": "contains", "value": "Festival" },
        {
          "operator": "or",
          "conditions": [
            { "field": "category", "operator": "in", "value": ["MUSIC"] },
            { "field": "locationPreferenceId", "operator": "in", "value": ["uuid-for-home"] }
          ]
        }
      ]
    }
    ```

    **Fields and Operators:**
    A formal list of queryable fields and the operators that apply to them will be maintained in the API documentation. This includes:
    *   **string:** `contains`, `equals`, `notEquals`
    *   **enum (type, category):** `in`, `notIn`
    *   **ID (locationPreferenceId, socialMediaAccountProfileId):** `in`, `notIn`
    *   **date range (scheduleDateRange):** `overlaps` (value: `{ from: string; to: string }` ISO dates)

---

### AD-2: Unified Event Querying

*   **Binds:** The retrieval of all event collections, including the main discovery page, the user's "Favorite Events" page, and the "Added to Calendar" page.
*   **Prevents:** The creation of specialized, single-purpose API endpoints for fetching different collections of events (e.g., `/api/favorites`, `/api/added-events`).
*   **Rule:** All event collections must be retrieved through the primary event query endpoint using the `Unified Query DSL` (AD-1). Specific collections will be requested by adding the appropriate conditions to the query.

    **Example (fetching favorited events):**
    ```json
    {
      "operator": "and",
      "conditions": [
        { "field": "isFavorited", "operator": "equals", "value": true }
      ]
    }
    ```

---

### AD-3: Database Schema Management

*   **Binds:** All database schema changes and migrations.
*   **Prevents:** Manual, ad-hoc database changes and inconsistencies between environments.
*   **Rule:** Database schema will be managed code-first using Drizzle ORM TypeScript schema definitions. Migrations will be generated as SQL files using `drizzle-kit`. These migration files will be committed to the repository and applied automatically as part of the CI/CD deployment pipeline to ensure consistency across all environments.

---

### AD-4: Multi-Tiered Strict State Management

*   **Binds:** The implementation of all stateful logic on the frontend client.
*   **Prevents:** Monolithic global stores, untyped URL parameters, and overlapping responsibilities between server caches and client stores.
*   **Rule:** The frontend application must rigidly separate its state into three distinct, strictly-typed tiers:
    1.  **Server State:** `@tanstack/react-query` combined with `graphql-request` handles all async data (e.g., event feeds). It must rely on auto-generated types from `GraphQL Code Generator` to guarantee end-to-end type safety.
    2.  **URL State:** `nuqs` manages all shareable UI state (filters, search queries) by parsing URL parameters directly into strict TypeScript types (e.g., parsing a string into an `EventType` array), eliminating runtime string-parsing bugs.
    3.  **Client Global State:** `zustand` is reserved strictly for ephemeral UI state that crosses component boundaries (e.g., multi-tab post selection state). All Zustand stores must be interface-driven with strictly defined states and actions.

---

### AD-5: Analytics Instrumentation

*   **Binds:** All product-analytics/event-tracking calls across the frontend application.
*   **Prevents:** Ad-hoc, inconsistently-named tracking calls scattered per feature, and duplicate/competing analytics providers.
*   **Rule:** PostHog is the single analytics provider, initialized exactly once via a `PostHogProvider` composed in the global app shell (Story 0.7 / Story 1.8) — feature stories must never re-initialize or duplicate provider setup.
    1.  **Event taxonomy:** Tracked events use a consistent `noun_verb` naming convention (e.g., `event_favorited`, `search_submitted`, `filter_applied`), defined and reused via a shared analytics helper in `@festgrid/analytics` — features must not call the PostHog SDK directly.
    2.  **Automatic capture:** Page views and basic interactions are captured automatically by the provider; features only need to instrument feature-specific business events (favoriting, searching, filtering, reporting, etc.).
    3.  **New tracked events:** Any story that introduces user-trackable interactions must explicitly list the new event name(s) and payload shape it adds to the taxonomy.

---

### AD-6: i18n / Locale Strategy

*   **Binds:** All user-facing text and locale-dependent rendering across the frontend application.
*   **Prevents:** Hardcoded strings shipped ad hoc per feature, and layout assumptions that only work for LTR/English.
*   **Rule:** `next-intl` is the single i18n framework, configured once in the global app shell (Story 0.6 / Story 0.7) — feature stories consume `useTranslations`/message keys, they do not configure routing or providers themselves.
    1.  **Message organization:** Locale strings live in a dedicated `locales` directory as one JSON file per language (`en`, `id` for MVP per NFR23); feature stories add keys to these files rather than inlining strings.
    2.  **Layout resilience:** Components must be built to tolerate varying text lengths and remain functional in both LTR and RTL layouts (NFR24), even though only LTR locales ship at MVP.
    3.  **New locale strings:** Any story that introduces user-facing text must add message keys for all supported locales, not just English, as part of that story's Definition of Done.

---

### AD-7: Authenticated Context & Authorization

*   **Binds:** All GraphQL server-side identity verification, resolver-context user/role exposure, and authorization checks (Story 0.17 and every story that follows it).
*   **Prevents:** Resolvers hand-rolling their own session/identity checks, client-supplied user IDs being trusted for ownership decisions, and confusion between Supabase's own JWT `role` claim and this application's `users.role` column.
*   **Rule:**
    1.  **Identity source of truth:** The GraphQL server verifies the caller's Supabase Auth JWT on every request (via Supabase Auth's asymmetric/JWKS signing keys — no legacy shared-secret verification) and populates resolver context with the caller's identity. Resolvers/mutations never accept a client-supplied user ID as the basis for an authorization or ownership decision — the verified context is the only trusted source.
    2.  **`public.users.id === auth.users.id`:** The application's `users` table is keyed identically to Supabase Auth's own user ID. When a verified JWT's `sub` has no matching `users` row yet, the row is just-in-time provisioned using that `sub` as the explicit primary key (never relying on a database-generated default) — no separate bridging/lookup column exists or is needed.
    3.  **Single enforcement surface:** `requireAuth`/`requireModerator` (exported once from the backend's auth-context layer) are the only sanctioned way for a resolver to enforce "caller must be logged in" / "caller must be a moderator." Individual resolvers must import and call these rather than re-implementing equivalent checks.
    4.  **Role model:** Application-level authorization uses the `users.role` column (`user` | `moderator`, assigned manually via direct database access per the PRD's MVP scope — no self-service promotion). This is distinct from Supabase's own JWT `role` claim, which reflects the caller's Postgres role (`authenticated`/`anon`/`service_role`) for Supabase's Row Level Security and must never be used for application-level authorization decisions.
    5.  **New moderator-gated resources extend, not bypass, this surface:** e.g. accepting/reverting a `DefaultLocationChangeRequest` (PRD Section 4.14) is gated by the same `requireModerator` check as report moderation — a new resource type, not a new enforcement mechanism.

---

### AD-8: Soft-Delete Convention

*   **Binds:** All reads and writes against `EventInfo` (PRD 4.1 — pre-existing binding, still not implemented in `schema.ts`'s `events` table), `Favorite` (`favorites`), `CalendarEntry` (`calendarAdditions`/`calendar_additions`), `Subscription` (`subscriptions`), `ApiKey` (`apiKeys`), and `UserLocation` (`userLocations`; PRD 4.6 names this `UserLocationPreference`).
*   **Excluded / deferred (not bound), each with a reason — not silently omitted:**
    *   `GeolocationCache` — a geocoding-API response cache with no user-facing delete action; evicted/replaced, never user-undone. Treated as log-like despite not being literally named a log.
    *   `Schedule` (`schedules`) and `Post` (`posts`) — considered for inclusion in this AD's 2026-08-06 revision and found to have no documented user- or moderator-facing delete action anywhere in the PRD or `EXPERIENCE.md`; both are internally-generated/ingested catalog content, closer to the log-exclusion rationale than to user-owned data. Bind them only once a concrete delete-capable action is specified for them — do not add the column speculatively.
    *   `users` — already carries a live `deletedAt` column in `schema.ts` (pre-existing, unrelated to this session), but no resolver reads or writes it and account deletion/suspension is out of MVP scope. **Open item:** `favorites`, `calendarAdditions`, `userLocations`, `subscriptions`, and `apiKeys` all declare `onDelete: 'cascade'` FKs to `users.id` — a DB-level cascade that only fires on a hard delete and therefore **never fires** for a soft-deleted user. Whoever eventually builds user deletion/suspension must not rely on that FK cascade; it must explicitly enumerate and soft-delete every dependent row across all five tables in one transaction, or explicitly decide dependents stay visible. Any future audit/log table is excluded from this AD by the same logic as the tables above: soft-delete-with-undo would let a user quietly erase their own audit trail, defeating the table's purpose.
*   **Prevents:** Hard deletes on bound tables, and any read path that bypasses the active-rows-only default — which would silently resurface data a user removed or a moderator reverted. Also prevents each soft-delete-capable resource from inventing its own bespoke restore mechanism (rule 4), and prevents a mutation from claiming rule-4 compliance by signature alone without the underlying table/resolver actually supporting a reachable restore.
*   **Rule:**
    1.  **Field:** Each bound table carries `deletedAt: timestamp | null`. `null`/absent means the row is active.
    2.  **Query default (target — not yet the current state, found during this AD's 2026-08-06 reviewer pass):** The `Unified Query DSL` (AD-1) and `Unified Event Querying` (AD-2) are intended to apply an implicit `deletedAt IS NULL` condition on bound tables for every query, enforced once in the shared query-building layer — never per-resolver. **As shipped today, this is not true:** `packages/graphql-select`'s `buildDrizzleWhere`/`buildOptimizedDrizzleSelect` have no `deletedAt` awareness at all; `favorites`/`calendarAdditions` filtering is hand-written `isNull(...)` at six separate call sites in `apps/backend/src/schema/resolvers.ts`; and `myLocations` is a hand-written query that doesn't go through the DSL at all. This is exactly the divergence this rule exists to prevent, already present in shipped code. **Required fix (tracked as follow-up, not built in this AD's session):** a single shared `activeOnly(table)` Drizzle where-fragment helper, exported from `@festgrid/graphql-select`, imported by every resolver — DSL-based or hand-written — in place of inline `isNull(...)` calls. Retrofit the six existing `favorites`/`calendarAdditions` call sites and add it to `myLocations`, in the same follow-up story that migrates `deleteUserLocation` (rule 4). A caller must explicitly opt in to see soft-deleted rows (e.g., the Moderator Items screen).
    3.  **Indexing:** Use Postgres partial indexes scoped to active rows (`WHERE deleted_at IS NULL`) on each table's hot lookup columns, rather than a bare index on `deleted_at`. **Known tooling limitation (verified 2026-08-06):** the installed `drizzle-kit@^0.21.2`/`drizzle-orm@^0.30.10` does not emit the `WHERE` predicate for partial indexes in generated migration SQL, even when declared correctly as `.where(sql\`deleted_at IS NULL\`)` in `schema.ts` — confirmed against this project's own generated migration (`packages/database/migrations/0004_optimal_frog_thor.sql`, no `WHERE` clause present) and matching still-open upstream issues ([drizzle-orm#3349](https://github.com/drizzle-team/drizzle-orm/issues/3349), [drizzle-kit-mirror#461](https://github.com/drizzle-team/drizzle-kit-mirror/issues/461)). The two indexes already in `schema.ts` claiming to be partial (`idx_favorites_active`, `idx_calendar_additions_active`) are therefore live in Postgres today as full, non-partial indexes. Until upstream fixes this (recheck on the next `drizzle-kit` upgrade), any migration adding one of these indexes must hand-edit the generated SQL file to append the `WHERE deleted_at IS NULL` clause before running it, with a comment noting the hand-edit and linking the tracked issue; a follow-up migration should correct the two already-shipped indexes to match. Use the real table/column identifiers, not the PRD's singular domain names:

        ```sql
        CREATE INDEX idx_favorites_active ON favorites (user_id) WHERE deleted_at IS NULL;
        CREATE INDEX idx_calendar_additions_active ON calendar_additions (user_id, schedule_id) WHERE deleted_at IS NULL;
        CREATE INDEX idx_subscriptions_active ON subscriptions (user_id) WHERE deleted_at IS NULL;
        CREATE INDEX idx_user_locations_active ON user_locations (user_id) WHERE deleted_at IS NULL;
        ```

        The migration that adds `UserLocation`'s `deletedAt` column and this index must also drop the pre-existing plain `idx_user_locations_user_id` index (superseded — no moderator/all-rows path currently needs it; reintroduce only if one is built).

    4.  **Mutation contract (added 2026-08-06, alongside `EXPERIENCE.md`'s revised Soft Delete with Undo pattern):** every soft-delete mutation takes an explicit direction argument via one shared enum, `SoftDeleteAction { DELETE, RESTORE }`, argument name `action`, **declared exactly once** in `apps/backend/src/schema/typeDefs.graphql` (the existing schema-merge root) — resource-specific `.graphql` files reference it, they never redeclare it (the codebase's real convention is one `.graphql` file per resource with no shared-types file today, which would otherwise make a duplicate `SoftDeleteAction` declaration the likely outcome once `ApiKey` and `Subscription` delete mutations are built independently in Epic 3/4). Shape: `<mutationName>(id: ID!, action: SoftDeleteAction!): <Resource>!` — non-null return of the resource's own type (not a bare `Boolean`), matching the return-type precedent already set by `updateUserLocation(...): UserLocation!`. The mutation validates the state transition server-side — `DELETE` requires the row currently active, `RESTORE` requires it currently soft-deleted — and on a mismatch throws a `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` (a new code, distinct from the `BAD_REQUEST`/`NOT_FOUND` codes already in use in `resolvers.ts`) rather than silently no-op'ing or returning `null`. **Compliance is not signature-only:** a mutation may not claim rule-4 compliance by matching this GraphQL shape alone — its table must already carry `deletedAt` (rule 1) and its resolver must perform an `UPDATE`, never a `DELETE`; `RESTORE` must be verified actually reachable (tested), not merely typed.

        **`deleteUserLocation` status — not yet compliant, and not a legacy exception either:** it ships today as `deleteUserLocation(id: ID!): Boolean!`, performing a real `db.delete(userLocations)...` hard delete (`resolvers.ts:130-135`) — this is the exact bug this AD exists to close, not a "not-yet-built" mutation comparable to the future `ApiKey`/`Subscription` ones. It must be migrated to the rule-4 shape as a **breaking API change**, in one follow-up story that together: (a) adds the `deletedAt` column and partial index (rules 1/3), (b) rewrites the resolver to an `UPDATE` with the `action` argument and `INVALID_STATE_TRANSITION` handling, (c) updates its frontend caller (`apps/web/src/features/locations/mutations.graphql`, `locations-content.tsx`) and their tests, and (d) adds the rule-2 default filter to `myLocations`, which lacks it today since a hard delete never needed one. Once migrated, `deleteUserLocation` becomes the canonical rule-4 reference implementation for future `ApiKey`/`Subscription` mutations to copy — cited by name here so grep-driven pattern-matching favors the compliant shape over the more numerous (but exception-only) toggle examples below.

        **Accepted legacy exception:** `toggleFavorite` and `toggleCalendarAddition` (`apps/backend/src/schema/resolvers.ts`) predate this rule and use an implicit-toggle shape instead (no `action` argument; the server infers direction from the row's current `deletedAt`, returning a custom `ToggleFavoriteResult`/`ToggleCalendarAdditionResult` boolean-flag type rather than the resource's own type). They are shipped, tested, and functionally equivalent (both achieve delete-then-undo), and are not being reconciled to rule 4. Every new soft-delete mutation — `deleteUserLocation`'s migration above, and `ApiKey`/`Subscription` delete mutations (Epic 3/4) once built — must use the rule 4 shape.

---

## Related Documents

- [Infrastructure](../../docs/infrastructure/index.md)

