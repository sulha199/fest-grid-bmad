---
title: "Architecture Spine: FestDaily"
status: "draft"
created: "2026-07-20T09:34:00Z"
updated: "2026-08-01T07:30:00Z"
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

*   **Binds:** All reads and writes against `EventInfo`, `Favorite`, `CalendarEntry`, `Subscription`, and `ApiKey` (PRD Section 4).
*   **Prevents:** Hard deletes on these tables, and any read path that bypasses the active-rows-only default — which would silently resurface data a user removed or a moderator reverted.
*   **Rule:**
    1.  **Field:** Each table carries `deletedAt: timestamp | null`. `null`/absent means the row is active.
    2.  **Query default:** The `Unified Query DSL` (AD-1) and `Unified Event Querying` (AD-2) apply an implicit `deletedAt IS NULL` condition on these tables for every query, enforced once in the shared query-building layer — never per-resolver. A caller must explicitly opt in to see soft-deleted rows (e.g., the Moderator Items screen).
    3.  **Indexing:** Use Postgres partial indexes scoped to active rows (`WHERE deleted_at IS NULL`) on each table's hot lookup columns, rather than a bare index on `deleted_at` — the default-excluded majority of queries benefit from the partial index; the low-volume moderator/admin paths that need soft-deleted rows can fall back to a sequential scan or a dedicated index.

        ```sql
        CREATE INDEX idx_favorite_active ON favorite (user_id) WHERE deleted_at IS NULL;
        CREATE INDEX idx_calendar_entry_active ON calendar_entry (user_id, schedule_id) WHERE deleted_at IS NULL;
        CREATE INDEX idx_subscription_active ON subscription (user_id, account_id) WHERE deleted_at IS NULL;
        ```

---

## Related Documents

- [Infrastructure](../../docs/infrastructure/index.md)

