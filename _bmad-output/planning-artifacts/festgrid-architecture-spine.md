---
title: "Architecture Spine: FestDaily"
status: "draft"
created: "2026-07-20T09:34:00Z"
updated: "2026-10-19T00:00:00Z"
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
    *   **date range (scheduleDateRange):** `overlaps` (value: `{ from: string; to: string | null }` ISO dates — a null `to` means an open/unbounded upper range, added by Story 2.7)
    *   **Geo (scheduleCoordinates):** `withinRadius` (value: `{ locationPreferenceId: ID, radiusKm: number [1-50] }` | `{ latitude: Float, longitude: Float, radiusKm: number [1-50] }`)

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

*   **Binds:** All reads and writes against `EventInfo` (PRD 4.1 — pre-existing binding, still not implemented in `schema.ts`'s `events` table), `Favorite` (`favorites`), `CalendarEntry` (`calendarAdditions`/`calendar_additions`), `Subscription` (`subscriptions`), `ApiKey` (`apiKeys`), `UserLocation` (`userLocations`; PRD 4.6 names this `UserLocationPreference`), `AccountVote` (`account_votes`; PRD 4.15, Story 6.1a), and `EmbedDomain` (`embed_domains`; PRD 4.16, Story 6.6a) — the last two added ahead of the spine during the PRD's Epic 6 update (`project-context.md` already reflected this; the spine is corrected here to match, per the Epic 6 readiness sweep's finding).
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

        **Accepted hard-delete exception (added 2026-08-11, Epic 4 readiness re-sweep, confirmed with the user via `AskUserQuestion`):** `deleteEventPermanently(id: ID!): Boolean!` (Story 4.4a, `events`, moderator-only) is a genuine hard `DELETE`, not a soft-delete/restore-cycle mutation, and is therefore exempt from — not a violator of — this AD's "Prevents: hard deletes on bound tables" clause. It exists as a deliberate, distinct moderator action from `restoreEvent` (the soft-delete/undo pair): permanently removing egregious/abusive event listings that should not remain recoverable, cascading to dependent `schedules`/`corrections`/`reports`/`favorites`/`calendarAdditions` rows. Any future hard-delete mutation on a bound table must be similarly named here as an explicit exception before being built — this is not a general license to bypass rule 1/4 for convenience.

---

### AD-9: Date/Week Selection UI Convention

*   **Binds:** Any FestGrid UI that lets a user pick a calendar date — currently Story 1.3g's manual week-picker (`packages/ui/src/features/events/WeeklyCalendarView.tsx`, CAP-4 of the 2026-08-13 Discovery/Detail/Calendar UX change), and any future date-selection UI added to the app.
*   **Prevents:**
    1.  A third-party date-picker dependency. **Verified 2026-08-14** against `ui.shadcn.com/docs/components/base/date-picker`: shadcn/ui has no dedicated `DatePicker` component — its "Date of Birth" example is a composition recipe (`Button` trigger inside `Popover`, wrapping `Calendar` with `mode="single"`, `captionLayout="dropdown"`, `React.useState<Date>()` for selected-date state). This composition is the only sanctioned base going forward.
    2.  A hand-rolled calendar grid reimplementing `Calendar`/`react-day-picker` from scratch.
    3.  A second, independently-computed week/date-boundary calculation living inside any picker component. Boundary math has exactly one home: Story 3.7a's `useWeeklyCalendarController` (`getWeekStart`/`getWeekEnd`, AD-8-adjacent AC6/AC7 of the same change proposal).
*   **Rule:**
    1.  **Composition base:** every date-picker in FestGrid is `Button` (trigger) + `Popover` + `Calendar`, `mode="single"` unless a feature genuinely needs range/multi-select selection — never a hand-rolled grid or a new npm date-picker dependency.
    2.  **`WeekPicker` wrapper:** `packages/ui/src/core/WeekPicker.tsx` wraps `Calendar` with `modifiers`/`modifiersClassNames` to visually highlight the full selected week row (not just the clicked day) — chosen over a plain undecorated composition for the better picking affordance (user-confirmed 2026-08-14). It takes `onSelectWeek(date: string)` and a **required** `getWeekRange(date: Date): { start: Date; end: Date }` prop supplied by the caller from Story 3.7a's exported `getWeekStart`/`getWeekEnd` — `WeekPicker` never computes a boundary itself, so exactly one boundary implementation exists app-wide.
    3.  **Reuse before regeneralization:** future date-pickers reuse `WeekPicker` directly if week-range selection is needed again; otherwise compose `Button`+`Popover`+`Calendar` inline per rule 1. A pattern graduates into a new `packages/ui/src/core/` primitive only once a second real consumer exists, matching the project's existing `core/` (domain-agnostic, reused) vs. `features/<domain>/` (single-feature) placement convention.

---

### AD-10: System Gemini Key for Location Inference

*   **Binds:** Story 3.4m's default-location-inference call only (PRD §3.7 "AI-Assisted Location Inference" / "Key Used for Inference", amended 2026-08-24).
*   **Prevents:** This key being reachable from the general post-extraction path (Story 3.6's queue processor) or read anywhere outside Story 3.4m's own call site — an explicit scope fence, not just a naming convention, so it can't be casually widened into a general managed-key-pool (PRD §6's Phase 2, not yet built) without a deliberate future decision.
*   **Rule:**
    1.  **Storage:** a new `SYSTEM_GEMINI_API_KEY` env var, classified as a credential (AWS Secrets Manager SecureString) — matching `GEOAPIFY_API_KEY`'s existing classification (Story 0.25's Dev Notes table), not a plain environment property — wired into the deployed Lambda's environment configuration the same way Story 0.25 wired `GEOAPIFY_API_KEY`.
    2.  **Selection:** a new sibling function, `callGeminiForLocationInference(request)`, alongside Story 0.13's existing `callGemini(request)` — **not** a modification to `callGemini`'s own tier logic. It first calls `callGemini` exactly as-is (reusing Tier 1/Tier 2 subscriber-key selection, backoff, and retry unchanged); only when that call throws `AiGatewayExhaustedError` does it fall back to one additional attempt against `SYSTEM_GEMINI_API_KEY`, decrypted/read directly — no `usage-store`/`selectApiKey` candidate lookup, since there is exactly one fixed key, not a pool to select from. This keeps the system key structurally unreachable from `callGemini`'s existing call sites (Story 3.6) — only code that explicitly calls the new sibling function can ever reach it.
    3.  **Cost/quota posture (explicit MVP decision, not left implicit):** no additional rate-limiting is designed in for this key, because Story 3.4m's own design already bounds its call frequency — the inferred result persists to `defaultLocation` (PRD §3.7), so this call fires at most once per account that has no default location *and* no usable subscriber key, never once per post.

---

### AD-11: Moderator Override on Subscriber-Scoped Mutations

*   **Binds:** `editAccountDefaultLocation` (`apps/backend/src/schema/resolvers.ts:496`) — today subscriber-only, gated on an active subscription to the account (PRD §3.7 "Moderator Override", §4.14, amended 2026-08-24).
*   **Prevents:** A separate moderator-only fork of this (or any future) subscriber-facing edit mutation; a second moderator being required to review a moderator's own correction (a redundant loop rejected during design); stale `PENDING_REVIEW` rows accumulating unnoticed once a later edit has already overtaken them.
*   **Rule:**
    1.  **Additive auth, not a replacement:** `requireModerator(context)` (AD-7 rule 3) OR the existing active-subscription check satisfies authorization — either path grants access; the subscriber path is unchanged. This is the first mutation in the codebase where a moderator gains access to an otherwise subscriber-scoped write via a second, independent auth path rather than a dedicated moderator-only mutation — the sanctioned shape for any future case with the same need.
    2.  **Moderator writes are self-resolved:** when the caller is identified as a moderator (not a subscriber), the resolver sets `changeSource: 'MODERATOR'` and inserts the `DefaultLocationChangeRequest` already resolved — never `PENDING_REVIEW` — since the moderator's own edit *is* the review.
    3.  **Any successful write supersedes stale pending requests:** on every successful call to this mutation, regardless of `changeSource`, every other still-`PENDING_REVIEW` `DefaultLocationChangeRequest` for that same `accountId` is marked `SUPERSEDED`. Not moderator-specific — the mutation has no existing pending-request de-duplication, so a subscriber alone can already stack multiple pending rows for one account before any are reviewed; a later successful edit (by anyone) makes every earlier pending snapshot's `previousLocation`/`newLocation` stale.

---

### AD-12: Durable Media Re-hosting for Scraped Post Images

*   **Binds:** `posts.durableImageUrl`/`posts.imageUrlExpiresAt` (new columns) and how the Event
    GraphQL resolver computes the `imageUrl` it serves, for posts that yield a
    successfully-extracted `EventInfo` (PRD §4.1/§4.7, amended 2026-08-25). `posts.imageUrl`
    itself is unaffected — it keeps meaning "the raw scraper-source URL," never overwritten. Does
    not bind `posts.videoUrl` — video is explicitly accepted as ephemeral (see Rule 3).
*   **Prevents:** Building a new/duplicate media-download step — this reuses the byte fetch the
    AI-extraction path already performs for Gemini's vision call; serving media directly from a
    public S3 bucket, which would tie this project's media-serving cost/limits to S3's own
    account-age-dependent free-tier allowance instead of CloudFront's permanent one (Rule 2);
    scope creep into re-hosting non-extracted posts (Manual Post Selection, moderator triage) or
    backfilling already-broken existing images — both explicitly deferred, not silently expanded
    later without a fresh decision.
*   **Rule:**
    1.  **Trigger & source of bytes:** on successful AI extraction (Story 3.6's pipeline,
        `build-gemini-request.ts`'s existing `fetch(message.imageUrl)` call), **and only when
        the post's account has `SocialMediaAccountProfile.isImageStorageOptedIn = true`
        (PRD §4.5, Rule 7 below)**, the same already-fetched image bytes are uploaded to the
        new media bucket and written to `posts.durableImageUrl`. No second fetch of the source
        image is performed, and `posts.imageUrl` is left untouched. For a non-opted-in
        account's post, this step is skipped entirely — no bytes are uploaded, no
        `durableImageUrl` is ever populated for that post.
    2.  **Storage & serving:** a new, private S3 bucket (Origin Access Control, no public bucket
        access) fronted by a CloudFront distribution; only the CloudFront URL is ever written to
        `durableImageUrl`. Objects are served with `Cache-Control: public, max-age=31536000,
        immutable` — each is a unique file, never mutated once uploaded, so this is safe and lets
        the browser's normal HTTP cache do the rest with no custom code. This is a deliberate
        choice over serving S3 URLs directly: CloudFront's Always-Free tier (1 TB data transfer
        out + 10M requests/month) is permanent and account-age-independent, unlike S3's own free
        allowances, which per AWS's 2025-07-15 Free Tier restructuring only apply to legacy
        accounts within their first 12 months. Verified negligible cost at current project scale
        regardless of tier status (`sprint-change-proposal-2026-08-25-video-priority-display.md`
        Section 1.4).
    3.  **Original-preferred serving, computed per request:** `posts.imageUrlExpiresAt` is parsed
        once at scrape time from the raw URL's own embedded expiry (e.g. Instagram's `oe=` query
        param) and stored — parsed at write time, not read time, so a future change to a
        platform's URL format fails loudly once at ingestion rather than silently on every read.
        Adapters whose URL format has no parseable expiry leave this null, treated as
        "already expired" (never assumed valid indefinitely). The Event resolver then serves
        `posts.imageUrl` while `now < imageUrlExpiresAt`, else `durableImageUrl` **if and only if
        the account is opted in (Rule 7) — a non-opted-in account's expired original never falls
        back to `durableImageUrl` under any circumstance, since none was ever stored (Rule 1);
        the resolver instead returns null/no-image for that request, and the frontend renders
        its defined placeholder state (PRD §3.16), never a broken-image icon.** For an opted-in
        account, `durableImageUrl` is additionally exposed as a secondary field so the frontend
        can retry it via the same `onError` pattern if the served choice fails earlier than its
        nominal expiry. This offloads an event's freshest, highest-traffic window onto Instagram's
        own CDN at the cost of one extra stored timestamp — a real reduction in CloudFront usage,
        unlike the client-side approach considered and rejected below.
    4.  **Scope boundary (explicit MVP decision):** only posts that reach a successful extraction
        are re-hosted. Posts that never extract (rejected, or awaiting triage in Manual Post
        Selection) keep their raw, time-limited scraper-source `imageUrl` — acceptable given
        their short, near-real-time usage window, well inside the source URL's ~4-day lifetime.
        `posts.videoUrl` is never re-hosted — accepted as ephemeral; on playback failure the
        product falls back to the (durable, once extracted) image and links to the original post
        (PRD §3.3.5).
    5.  **No backfill:** already-persisted posts/events with a raw (likely already-expired)
        `imageUrl` are not retroactively re-hosted in this pass — fix-going-forward only, an
        explicit decision, not an oversight.
    6.  **No expiry-triggered deletion:** hosted images are never deleted when their event
        "expires" (its schedules pass). Checked directly, not assumed: `events.postId` is a
        strict 1:1 unique constraint (`packages/database/schema.ts:243`, no shared-image risk
        either way), but "expired" is not "deleted" anywhere in this product — PRD §3.4.2 only
        hides expired events from personalized *list* views, `Post` is explicitly excluded from
        the soft-delete convention (AD-8), and Story 4.8 (Archived/Hidden Personal Events, done)
        plus any direct slug deep-link keep an expired event's detail page — and therefore its
        image — reachable indefinitely. Deleting on expiry would reintroduce this exact AD's
        problem on a delay. The cost case is also nil: even accumulating every extracted event's
        image with zero deletion for a full year is single-digit GB (Section 1.4 of the sprint
        change proposal above) — there is no storage-cost problem to solve. If storage hygiene is
        ever wanted, the right tool is a no-code **S3 Lifecycle rule** keyed to object age (e.g.
        transition/delete after 2+ years), not application logic keyed to event-expiry semantics.

        **Premise amended 2026-10-01 (AD-30, CC-024):** `events.postId` is no longer 1:1 — it is
        the *primary-post* pointer, and one post may now yield several events and one event may be
        linked to several posts. Re-hosting stays strictly per post (Rule 1 is unchanged: bytes
        belong to `posts.durableImageUrl`), and an event serves its **primary** post's media, so
        this rule's conclusion (never delete on expiry) holds; only its "no shared-image risk"
        aside no longer applies — a post's image is now legitimately shared by sibling events.
    7.  **Consent gate (added 2026-09-02, `bmad-correct-course`, sprint-change-proposal-2026-09-02.md):**
        this AD originally shipped (Story 3.6e/3.6f) with re-hosting and serving unconditional for
        every extracted post — no account-level consent concept existed in the schema yet. That
        default was found to conflict with `monetization-plans/scraping-extraction-display-rules-2026-09-02.md`'s
        minimization design (default embed/hotlink, never a persistent copy, until the account
        owner opts in) — a live gap in `master`, not a hypothetical one. Rules 1 and 3 above are
        now stated in their corrected, consent-gated form; this sub-rule records that the
        correction happened and why. `SocialMediaAccountProfile.isImageStorageOptedIn` (PRD §4.5)
        is currently moderator-set only — no self-service account-claim/ownership-verification
        flow exists yet (tracked as a future epic in epics.md, not built here). Until that flow
        ships, an account only becomes opted-in via explicit moderator action.
*   **Considered and rejected:** a Service Worker persisting the *original* (cross-origin,
    Instagram-hosted) image client-side past its own expiry, using the Cache Storage API to
    intercept the browser's request and replay a stored copy. Rejected because (a) Instagram's
    CDN won't grant CORS, so a page-script `fetch` only yields an opaque response whose body JS
    cannot read/reconstruct into a usable `Blob` — reliably replaying it requires a Service
    Worker's `fetch`-event `respondWith`, not a simple client-side cache check; (b) once Rule 3's
    original-vs-durable switch exists, the benefit shrinks to avoiding one already-fast,
    already-free CloudFront request, and only for a repeat visitor on the *same device* — a new
    device or cleared cache gets no benefit either way; (c) real ongoing complexity independent of
    this decision — SW registration/scope, cache versioning so deploys don't serve stale content,
    no automatic eviction, and SW bugs are notoriously hard to debug once stuck on a client. The
    complexity-to-benefit ratio doesn't clear the bar this project's other infra decisions do.
*   **Open for future discussion (not decided, not built):** whether push-notification delivery
    (FCM, Story 2.9) should trigger proactive cache-warming of a post's image/video, so the media
    is already loaded by the time a subscriber taps the notification — e.g. a push-event-triggered
    Service Worker warm, and/or ensuring server-side re-hosting has completed before the push is
    sent. This is a narrower, more targeted trigger than the general "cache every image for repeat
    visits" case rejected above (Push API's `push` event handler is the standard place for
    background work triggered by a notification, not by browsing), and could also bear on whether
    `videoUrl` re-hosting is worth revisiting for the push-triggered case specifically, since a
    push fired soon after extraction would land well inside video's ~25-hour window. Deliberately
    left open, not designed here.

---

### AD-13: Multi-Image (Carousel) Extraction Is Batched, Not Sequential

*   **Binds:** Story 3.3e (`posts.additionalImageUrls` capture) and Story 3.6l (`build-gemini-request.ts`'s
    multi-image request construction, `process-ai-job.ts`'s completeness logging) — PRD §3.7/§3.8, FR104,
    amended 2026-09-03.
*   **Prevents:** A sequential "call Gemini again on image N+1, N+2…" re-trigger loop for carousel posts;
    treating `Post.additionalImageUrls` as display-facing or durable (conflating it with `Post.imageUrl`'s
    AD-12 re-hosting treatment); an unbounded per-post image count reaching the AI Processor Lambda's fixed
    timeout (the same class of bug Story 3.4f fixed for Apify's scrape paths).
*   **Rule:**
    1.  **One request per post, always.** When a post has additional images beyond its cover
        (`Post.additionalImageUrls`, Story 3.3e), extraction sends the cover image plus up to
        `MAX_CAROUSEL_IMAGES` (default 5, env-configurable) additional images as multiple `inlineData`
        parts of the **same** Gemini request — never as separate sequential requests. Confirmed via
        research (2026-09-03): Gemini's free-tier quota is bound by RPM/RPD (request count) *and* TPM
        (token throughput) simultaneously; batching avoids multiplying request count per post (the
        RPM/RPD-expensive dimension) while costing the same TPM as separate calls would.
    2.  **Extraction-time-only, never durable.** `additionalImageUrls`/the bytes fetched from them are
        never written to any durable-storage path and never served to a client — distinct from
        `Post.imageUrl`, which AD-12 re-hosts on successful extraction. `rehostPostImageSeam` continues to
        operate only on the cover image's bytes.
    3.  **Completeness is a signal, not a driver.** The response schema's `minScheduleCount`/
        `expectedScheduleNames` fields (model self-reported) are used only to log an "incomplete
        extraction" flag for moderator visibility when `schedules.length < minScheduleCount` — they never
        trigger an additional Gemini call. A genuine multi-call re-processing loop was considered and
        explicitly rejected in favor of this rule; revisit only if the batched cap itself proves
        insufficient in practice.
    4.  **Amended 2026-10-01 (AD-30, CC-024):** the request still covers exactly one post, but its
        response now carries `events[]`; `minScheduleCount`/`expectedScheduleNames` become
        **per-event** fields and the post-level `minEventCount` joins them. All three stay
        log-only signals under rule 3 — a short event list never triggers another Gemini call.

---

### AD-14: Geoapify Confidence Signal Propagation

*   **Binds:** Every `resolveLocation()`/`resolveLocationSeam()` call site that trusts a Geoapify
    result — this epic's 7 known consumers (`apps/backend/src/schema/resolvers.ts` and
    `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts`) — and every Geoapify
    response mapper in `apps/backend/src/lib/geolocation/geoapify-client.ts`. Introduced by Story
    0.i7a; the CI-enforced consumer ratchet is Story 0.i7z. The ratchet is fulfilled by
    citation to prior stories' already-shipped regression tests (each rule's "Enforced by"
    lines below) plus Story 0.i7z's header-comment marking of those test files — it is not a
    separate 0.i7z-specific test suite.
*   **Prevents:** A consumer silently trusting a Geoapify coordinate/place while ignoring the
    `confidence`/`matchType` signal that says how ambiguous that match was (the BUG-027 failure
    class); a low- or synthetic-confidence result being treated as authoritative simply because it
    was Geoapify's top-ranked entry; and, on the schedule-location path, a same-named venue abroad
    being preferred over the local one because the account's own country was not used as a search
    bias.
*   **Rule:**
    1.  **Every mapper populates the signal.** `geocodeAddress` and `reverseGeocode` spread
        Geoapify's `rank.confidence`/`rank.match_type` and `country_code` onto `LocationDetails`
        (conditionally, only when present — never as an `undefined` key). `getPlaceDetails` is a
        direct ID lookup with no `rank`, so it sets a synthetic `confidence: 1` /
        `matchType: 'PLACE_ID_EXACT'` meaning "no ambiguity left to resolve"; its `countryCode`
        is populated conditionally from `properties.country_code`.
        - **Enforced by:** `apps/backend/src/lib/geolocation/geoapify-client.test.ts` — its
          `deepEqual`/`deepStrictEqual` assertions on the full mapped `LocationDetails` object
          fail if `confidence`, `matchType`, or `countryCode` are dropped from any of the three
          mappers' output. (Story 0.i7z AC 1 ratchet.)
    2.  **Every new consumer must read the signal before trusting a result.** Any code that newly
        consumes a `LocationDetails` produced by a Geoapify mapper must consider `confidence`/
        `matchType` (and, where re-ranking applies, the full candidate set) before treating a
        coordinate or place as authoritative. Absence of the signal means "untrusted" — the
        graceful-degradation posture AC 4 of Story 0.i7a accepts.
        - **Enforced by:** re-ranking — `packages/domain/src/geolocation/select-best-candidate.test.ts`
          (pure-function coverage of `selectBestCandidate`) + `apps/backend/src/lib/geolocation/adapter.test.ts`'s
          `'adapter resolveLocation re-ranks ADDRESS by confidence (BUG-017)'` integration test;
          map-link gate — `packages/domain/src/geolocation/is-location-trustworthy.test.ts` +
          `packages/ui/src/core/LocationLink.test.tsx` (confidence-boundary cases; Story 1.6d, carries the
          0.i7z ratchet header) + the `locationDetails` passthrough test in
          `apps/web/src/features/events/mapper.test.ts` (Story 1.6e; supersedes the removed
          `mapUrl gating (Story 0.i7c / 0.i7z)` block — both 1.6d and 1.6e have now landed, so this is the
          current enforcer, not a future-tense placeholder); account-card consumer —
          `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx`'s `location prop`
          block (Story 0.i6e, carries the 0.i7z ratchet header, including the `confidence: 0.5`/
          `matchType: 'full_match'` trustworthy boundary case and the `null`-confidence untrustworthy
          case) + the `accountLocation derivation` block in `apps/web/src/features/events/mapper.test.ts`
          (Story 0.i6e; proves the `defaultLocation` passthrough that feeds that gate); GraphQL exposure —
          the three `apps/web` `.graphql.test.ts` AST guard tests from Story 0.i7d
          (`apps/web/src/features/subscriptions/mutations.graphql.test.ts`,
          `apps/web/src/features/locations/mutations.graphql.test.ts`,
          `apps/web/src/features/locations/queries.graphql.test.ts`). (Story 0.i7z AC 2–4 ratchet.)
    3.  **Country bias is part of the resolution identity.** The schedule-location geocoding path
        passes the account's own `defaultLocation.countryCode` as `bias=countrycode:xx`, and the
        ADDRESS cache key folds that bias in, so two accounts geocoding the identical address with
        different biases can never be served each other's cached result. When no bias is known, the
        parameter (and its cache-key segment) is omitted entirely — self-healing, not a gap.
        - **Enforced by:** `packages/domain/src/geolocation/build-cache-key.test.ts` (countryBias
          cache-key folding) + `apps/backend/src/lib/geolocation/adapter.test.ts`'s countryBias
          integration case.
    **Amended 2026-10-19 (production check, BUG-066; evidence:
    `event-insight-poc/prod-check-results-review-2026-10-19.md` §3 and §10).**
    3a. **Rule 3's "self-healing, not a gap" is withdrawn.** Production: 627 of 1,460 stored pins
        (43%) have a stored confidence under 0.5; of the first 333 wrong-country pins, 214 (64%)
        come from accounts with **no** default location (so no bias at all) and the pin country
        equals the account's default in only 15; the bias is a soft preference and changes
        nothing for a bad text. Omitting the bias is now a known source of wrong pins, not a no-op.
    4.  **Pin trust is one predicate, stored.** `isPinTrusted()` in `packages/domain` (the
        confidence-only `isLocationTrustworthy` becomes its first leg) is true only when: (a) the
        stored confidence reaches the floor (start value 0.5, uncalibrated; `[ASSUMPTION]`
        confirm after `confidence-by-country-box` and the compound-text probe), (b) the answer is
        not a non-place (Rule 5), and (c) when the event has area keys (AD-39), the pin's
        administrative path intersects them. The result is written at geocode time as
        `schedules.pin_trust` (`trusted | untrusted | none`) and is the **only** input every pin
        consumer reads (map link, radius filter, Nearby badge and distance term, AD-22; the paid
        distance term, AD-39). Confidence alone cannot separate good from bad pins (129 of 343
        pins outside Indonesia are ≥ 0.5, 83 at exactly 1.00; 413 of 959 inside are < 0.5), which
        is why (c) exists. `[ADOPTED, user-accepted with the place-model decisions]`
    5.  **Geocode input hygiene.** A non-place ("Online", "Zoom", "Google Meet"; BUG-064) is never
        sent to the geocoder. A sub-venue qualifier (floor, level, room, counter, atrium) is
        removed before geocoding, keeping venue name plus the stated city; production texts such as
        "Atrium & Plaza Rama, Sleman City Hall" fail at confidence 0.00 because the geocoder matches
        the generic word. `[ASSUMPTION]` the qualifier rule is confirmed by Round 3 item 10
        (`probe-geocode-compound.ts`, not yet run); the non-place rule is not an assumption.
    *   **Deferred (AD-14 amendment):** the floor value; the gazetteer-first routing of area phrases
        ("DIY & Jawa Tengah" answered with a PLN office at 0.66) belongs to AD-39 and IDEA-081.

---
### AD-15: Event Card Media Primitive

*   **Binds:** Every event-card image/media slot and favorite badge across the shared `event_card_*`
    primitive (`packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — `EventCardMediaSlot`,
    `EventCardFavoriteBadge`, `EventCardDateBox`) and the consumers that adopt it: Story 1.i1b re-points
    `EventCard.tsx`'s existing corner-heart at the shared scale token, 1.i1c replaces its broken-image
    fallback, 1.i1d/1.i1e adopt the primitive into `WeeklyCalendarView`'s compact row and `EventCard`'s
    masonry default state. Introduced by Story 1.i1a (build-only — the primitive ships dark, tested but
    not wired in); the CI-enforced consumer ratchet is Story 1.i1z, which enforces rather than introduces
    this rule. That ratchet's scope is narrowed to the primitive itself plus its two adopting consumers —
    `EventCard.tsx`'s masonry `prominentPoster=false` (default) branch and `WeeklyCalendarView.tsx`'s
    `CalendarCard` `variant='list'` branch. `EventCard.tsx`'s `variant="standard"` and masonry
    `prominentPoster=true` branches, and `CalendarCard`'s `variant='grid'` path, are explicitly excluded:
    Stories 1.i1c/1.i1d deliberately left those branches on their local sizing by user-confirmed scope
    decision, and the 2026-09-11 epic-formation checkpoint accepted that Epic 1.i1's surfaces need not be
    fully cross-surface consistent. The ratchet is fulfilled by citation + comment-marking (the specific
    tests named in Rules 1–2 below carry Story 1.i1z ratchet comments), not by a new duplicate test suite.
*   **Prevents:** Each surface re-deciding image-slot sizing and fallback locally (the exact "every
    surface re-decides" problem Epic 1.i1 exists to fix); the media slot's dimensions depending on the
    image's natural size so a loaded/failed image reflows the card (FIND-023); an icon-to-date-badge
    scale that silently diverges between the large fallback badge and the small corner badge (BUG-023).
*   **Rule:**
    1.  **Slot dimensions come from the surrounding chrome, never the image.** The media slot renders at a
        footprint fixed by its layout — masonry `flex-fill` matches a sibling date box's own height via the
        row's `items-stretch` (`flex-1 h-full min-w-0`); calendar-compact is a fixed `w-16 h-16 shrink-0` —
        so nothing shifts when the image loads or fails.

        **Narrowed to masonry only, 2026-09-21 (Story 1.i1m).** This rule now binds `EventCard.tsx`'s
        masonry `prominentPoster=false` branch alone. The calendar-compact row is no longer bound by it —
        the row's own image element is omitted from the DOM entirely on absence/error (`collapseOnFallback`
        on `EventCardMediaSlot`), a deliberate, user-directed 2026-09-14 reversal of the row's own prior
        convention, distinct from masonry's, which is unchanged. See Rule 2's own amendment note below and
        Story 1.i1m's Dev Notes for the full record.
        - **Enforced by:** `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` AC1
          (`flex-fill`/`fixed-square` className-shape assertions) — the primitive's own shape half of the
          proof (Story 1.i1a; ratchet = Story 1.i1z) — plus the two adopting consumers' own tests:
          `EventCard.test.tsx`'s `renders a blank, flex-fill fallback on masonry default (prominentPoster=false, top_row_default)`
          and `WeeklyCalendarView.test.tsx`'s `renders the thumbnail image and its favorite badge when imageUrl is present (AC1)`
          (the with-image case, unchanged by Story 1.i1m).
    2.  **Fallback is reserved-blank, not a placeholder.** A missing/errored image renders zero content in
        the reserved slot — no icon, no filler, no "No image available" text — keeping the exact AC1
        footprint. Only the large favorite badge (rule 3) renders, centered in the slot's place.

        **Narrowed to masonry only, 2026-09-21 (Story 1.i1m).** Masonry's own reserved-space convention
        (`event_card_masonry.thumbnail_default_fallback`) is unchanged. The calendar-compact row no longer
        follows this rule at all: per DESIGN.md `event_card_compact_thumbnail_fallback` ("no area for image
        at all"), the row omits the media-slot element from the DOM entirely when the image is absent or
        errored, rather than rendering it reserved-but-blank — a real, user-directed reversal of the row's
        own prior behavior, not a bug. `EventCardMediaSlot`'s new `collapseOnFallback` prop (default `false`,
        preserving this rule unchanged for every existing consumer) is what the row opts into; masonry's two
        call sites omit it and keep exactly the reserved-blank behavior this rule still describes for them.
        - **Enforced by:** the same test file's AC3 suite (blank-reserved assertions + `onError` switch),
          plus masonry's own reserved-blank tests: `EventCard.test.tsx`'s
          `renders a blank, flex-fill fallback on masonry default (prominentPoster=false, top_row_default)` and
          `renders a blank, correctly-sized fallback on masonry with prominentPoster=true`. The calendar-row
          counterpart tests this rule used to cite — `WeeklyCalendarView.test.tsx`'s
          `renders the reserved-blank fallback with a large centered favorite badge when imageUrl is absent (AC2)`
          and `switches to the reserved-blank fallback when the image onError fires (AC2)` — were **inverted**
          by Story 1.i1m into ratchets for the row's own (opposite) behavior; they no longer enforce this rule
          and are cited instead under Story 1.i1m's own Dev Notes.
    3.  **One shared icon-scale token family, CSS-custom-property driven.** Both badge scales derive their
        icon size from a single exported ratio family via `calc(var(--event-card-badge-font-size,0.75rem) *
        <ratio>)` — the mechanism that works because the date box and badge are DOM *siblings* (plain `em`
        inheritance only flows down a subtree). `large` is calibrated to DESIGN.md's explicit 24px target
        (ratio 2); `default` is a distinct smaller ratio (5/3 → 20px, matching EventCard's current corner
        heart so 1.i1b reads as a proportion fix). No consumer computes pixels; nothing hardcodes a fixed
        pixel `w-*`/`h-*` class on either variant. **Recalibrated by Story 1.i1k:** the token is now
        size-keyed (`EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE`, `EventCardDateBoxSize = 'default' | 'compact'`) —
        `default` → `1.125rem` (masonry's own `month`-line size), `compact` → `0.875rem` (the compact row's
        own `month`-line size) — since `EventCardDateBox` moved from a single-line `text-xs` box to
        DESIGN.md's two-tier stacked month/day chrome and no longer has one flat font-size to key off. The
        flat `EVENT_CARD_BADGE_FONT_SIZE` (`0.75rem`) constant is unchanged and keeps its distinct,
        narrower role as `eventCardBadgeIconSizeStyle`'s own inline `calc()` fallback for the untouched
        standalone/`prominentPoster=true` corner-badge path, which renders outside any slot/date-box root
        and never had a `size` variant.
        - **Enforced by:** the same test file's AC2 suite (ratio values + distinct computed sizes).
    4.  **The favorite badge is always one live control, at a real tap target.** Both scales render as a
        single focusable favorite-toggle `<button>` sharing one accessible name/role — never a decorative
        label, never an extra independent focus stop. The `large` fallback variant keeps a `min-h-11
        min-w-11` (≥44px) tap target per `components.nav.item_hit_area`'s convention and
        EXPERIENCE.md's reachable-control rule.

        **Narrowed to a consumer-level guarantee, 2026-10-06 (Story 1.i1p).** This rule used to be
        enforced *inside* `EventCardMediaSlot` itself (the primitive rendered the control directly).
        Story 1.i1p removed that internal rendering once both real consumers were found to always
        suppress it in favor of composing `EventCardFavoriteBadge` externally — `EventCard.tsx`'s
        masonry-default state and `EventCardCompact.tsx`'s row each already proved this invariant for
        their own composition before this story, and continue to. The rule's substance is unchanged;
        only who is responsible for upholding it moved from the primitive to each consumer.
        - **Enforced by:** `EventCardFavoriteBadge`'s own AC5 suite (`EventCardMediaPrimitives.test.tsx`
          — single accessible name, `min-h-11 min-w-11` tap target, unchanged by Story 1.i1p) plus each
          consumer's own single-control proof: `EventCard.test.tsx`'s
          `renders exactly one focusable favorite-toggle control (outer top-right button suppressed) when onFavoriteToggle is provided`
          and `EventCardCompact.test.tsx`'s `Image-present vs. image-absent favorite-badge placement`
          describe block.

---

### AD-16: Platform-Prefixed Event Slugs & Parallel oEmbed Resolution

*   **Binds:** `events.slug` generation (today `packages/database/schema.ts`'s `generateSlug`
    `$defaultFn`, `randomBytes(6).toString('hex')`), the `events`→`posts` ingestion insert path
    (`packages/domain/src/events/build-event-insert-values.ts`,
    `apps/backend/src/lib/ingestor/process-ingestion-job.ts`), the `eventBySlug` resolver and its
    `Event.instagramEmbed` field resolver (`apps/backend/src/schema/resolvers.ts`), the Instagram
    oEmbed adapter (`apps/backend/src/lib/instagram-oembed/adapter.ts`), and the event-detail route
    components (`apps/web/src/app/[locale]/events/[slug]/page.tsx` and the intercepted
    `@modal/(.)events/[slug]/page.tsx`). Corrects a drift in the PRD's §8.2/§4.1 slug description,
    which claims Nano ID generation — the shipped mechanism has always been
    `randomBytes(6).toString('hex')`; this AD fixes that description as well as extending the scheme.
*   **Prevents:** A second, independently-maintained platform-code mapping — the slug's platform
    segment **must** reuse `packages/domain/src/scraper/platform-registry.ts`'s `getPlatformSlug()`/
    `getPlatformByCode()` (already the single source of truth for `instagram↔ig`, `twitter↔x`,
    consumed today by `apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx`), never a
    locally re-declared platform string. Also prevents: assuming Instagram's `/p/` and `/reel/`
    permalink paths are interchangeable for Meta's oEmbed endpoint (unconfirmed by Meta's own docs —
    see Rule 2); moving the Instagram oEmbed call, its cache, or its credentials out of
    `apps/backend` into `apps/web` (would duplicate `instagramOembedCache` and split credential
    ownership); and gating the event-detail page's primary content render on the oEmbed HTTP round
    trip.
*   **Rule:**
    1.  **Slug shape:** `{platformSlug}_{postType}_{platformPostId}` (e.g. `ig_p_Cx9uWttkSN`,
        `ig_reel_Cx9uWttkSN`), built from `getPlatformSlug()`'s existing output — never a new
        mapping. Parsing splits on the first two `_` occurrences only (`platformSlug` and `postType`
        are both fixed, known vocabularies that never themselves contain `_`); everything after the
        second `_` is the opaque `platformPostId`, which may itself safely contain `_`/`-` since it
        is never split further.
    2.  **Capture the real permalink type, never assume one — parsed at post-scrape time, not
        event-creation time.** `posts` gains two new nullable columns, `platformPostId: text` and
        `platformPostType: text` (e.g. `'p' | 'reel'`), parsed once inside
        `persistScrapedPost()` (`apps/backend/src/lib/posts/persist-scraped-post.ts`) — the same
        function that already calls `parseImageUrlExpiry()` (`@festgrid/domain/scraper`) for AD-12's
        `imageUrlExpiresAt`. A new sibling parser in that same `@festgrid/domain/scraper` module
        derives `platformPostId`/`platformPostType` from `postUrl`/`originalPostUrl` at that call
        site, alongside the existing expiry parse — never re-parsed later, and never deferred to
        event-creation time (`buildEventInsertValues()`, rule 3), which runs on a `posts` row that
        already exists and must only read these columns, not parse them. **Verified 2026-09-15:**
        Meta's oEmbed docs (developers.facebook.com/docs/instagram-platform/oembed/) confirm the
        endpoint supports photo/video/Reel/Feed posts but only show a `/p/` example; independent
        tooling (microlink.io's embed generator, community shortcode-parsing regexes) treats `/p/`,
        `/reel/`, and `/reels/` as distinct, non-interchangeable path prefixes. Given that ambiguity,
        the real scraped path type is captured and replayed verbatim, never assumed.
    3.  **Slug construction moves out of the DB-level default.** Drizzle's `$defaultFn` has no join
        access to the referenced `posts` row, so it cannot see `platform`/`platformPostId`/
        `platformPostType`. Slug generation moves into `buildEventInsertValues()`
        (`packages/domain/src/events/build-event-insert-values.ts`), which already runs after the
        source post is known and simply reads that post's already-populated `platformPostId`/
        `platformPostType` (rule 2) to construct the slug — it performs no parsing of its own.
    4.  **Fallback is the unchanged legacy generator, not new code.** Any event with no resolvable
        `platformPostId`/`platformPostType` at insert time (no current ingestion path produces this,
        but `events.postId`'s nullable `onDelete: 'set null'` FK and the PRD §8.2 future custom-slug
        feature both mean it's not hypothetical) keeps `randomBytes(6).toString('hex')` unchanged.
        The two formats are unambiguous by shape alone (`^[0-9a-f]{12}$`, no delimiter, vs. the new
        underscore-delimited form) — no format-tagging column or migration flag needed.
    5.  **Fix-going-forward only — no backfill.** Existing events keep their current hex slugs
        permanently, consistent with AD-12 rule 5's precedent; regenerating would break every
        already-shared/bookmarked/indexed event URL.
    6.  **oEmbed resolution stays entirely backend-owned, but becomes DB-free.** A new resolver/query
        in `apps/backend` reconstructs the Instagram permalink directly from the slug's
        `platformPostId`/`platformPostType` (no join to `posts` required), then calls the existing
        `resolveInstagramOEmbed()` adapter and `instagramOembedCache` unchanged. `apps/web` never
        calls Meta directly and never owns oEmbed credentials or caching.
    7.  **Primary content is never gated on the oEmbed call.** **Verified 2026-09-15:** this route
        does not server-fetch its content at all — `page.tsx`'s only server-side
        `graphqlClient.request()` call lives inside `generateMetadata()` (for the tab title/
        description) and its result is discarded, never passed to the page body. The actual content
        is fetched entirely client-side by `EventDetailWrapper.tsx` ("use client") via
        `useGetEventBySlugQuery(graphqlClient, { slug })`, a React Query hook — matching AD-4's
        Server State convention. Given that, splitting the gate means: strip `instagramEmbed` out of
        `getEventBySlug.graphql`, and add a second, independent React Query hook (generated the same
        way as `useGetEventBySlugQuery`) calling the new DB-free oEmbed query (rule 6), both invoked
        in `EventDetailWrapper.tsx` on mount. React Query dispatches independent hooks' network
        requests in parallel automatically — no explicit `Promise.all`/`race` orchestration needed.
        Primary event-detail content renders off `useGetEventBySlugQuery`'s own `isPending`/`data`,
        never waiting on Instagram; `InstagramEmbed.tsx` (Story 3-7d's dedicated component with its
        own loading state machine) renders off the new hook's own independent `isPending`/`data`/
        `error` state for its skeleton. The outer `<Suspense fallback={<RouteLoader />}>` in
        `page.tsx`/the modal route is unrelated to this — it covers the route-shell boundary only
        (project-context.md's Route-Level Suspense Fallback rule), not in-page data fetching, and is
        unchanged by this AD.
*   **Amended 2026-10-01 (AD-30, CC-024 multi-event posts)** — Rules 1 and 6 are read together
    with Rules 8–12 below; Rules 2–5 and 7 are unchanged. Rules 2–7 are themselves **not yet
    built** (`posts.platformPostId`/`platformPostType` do not exist; IDEA-028 owns them), so Rules
    8–12 build on top of that work — the dependency Stories 3.6t/3.6v already record.
    8.  **The slug names the primary post.** For an event with a primary post (`events.post_id`,
        AD-30), the slug is the Rule 1 form built from that post, plus `~{ordinal}` when
        `events.extraction_ordinal > 0` (`ig_p_Ddi9wU6RCRQ`, `ig_p_Ddi9wU6RCRQ~2`). Ordinal 0 keeps
        the unsuffixed form, so every existing slug is unchanged. This invariant is what keeps
        Rule 6's DB-free oEmbed correct: Rule 6 reads only the id/type segments and ignores the
        ordinal.
    9.  **The ordinal separator is `~`, not `-`.** The first draft of this amendment used
        `-{ordinal}`; rejected because Instagram shortcodes are base64url (`A-Za-z0-9-_`, verified
        2026-10-01) and Rule 1 already allows `-` inside `platformPostId`, so `ig_p_X-2` could
        mean post `X`/ordinal 2 *or* post `X-2`/ordinal 0 (roughly 1 in 400 posts end in
        `-<digit>`), and Rule 6 would embed the wrong post with no visible failure. `.` is also
        unusable: `apps/web/src/middleware.ts`'s matcher skips any path containing a dot, so
        locale handling would not run. **Parse:** after splitting `platformSlug`/`postType` on the
        first two `_`, split the remainder at the **last** `~`; no `~` means ordinal 0. A platform
        adapter whose ids can contain `~` must fail loudly at Rule 2's parse step, never silently.
    10. **Re-slug on primary change, alias redirect.** Changing the primary post re-slugs the event
        in the same transaction as the pointer change (AD-30 Rule 2) and inserts the old slug into
        `event_slug_aliases`. Aliases are permanent tombstones: a slug present in the alias table
        is never issued as canonical for any **other** event, and slug generation checks it. The one
        exception is a primary that returns to a former post (R→O→R): the event may re-take its own
        old slug, and that alias row is deleted in the same transaction.
    11. **Resolution order.** `eventBySlug` looks up the canonical slug first (the unchanged hot
        path — no extra query on a hit) and consults `event_slug_aliases` only on a miss, then
        signals a permanent redirect to the canonical slug. Rule 6's oEmbed query must only ever
        be called with a canonical slug (the route redirects before the embed hook mounts).
    12. **Events with no primary post keep their slug.** When the last linked post is deleted
        (AD-30 Rule 8) the slug stays as it was; no re-slug to the legacy hex form, since that
        would orphan every shared URL for no gain.
*   **Considered and rejected:** A 2-part slug (`{platformSlug}_{platformPostId}`) that always
    reconstructs the URL as `instagram.com/p/{id}`, on the assumption that `/p/` resolves reels too.
    Rejected — unverified against Meta's own documentation, and wrong would silently break the
    entire optimization for every reel-sourced event with no visible failure signal until a user
    actually opened one. A single `Promise.all` gating the whole page on both fetches together.
    Rejected — still blocks the faster result on the slower one, only reducing total wait from
    `sum` to `max`, not removing the gate. A literal `Promise.race`. Rejected — discards whichever
    fetch loses, but both results are needed, not just the faster one. React 19 `use()` +
    Suspense-boundary streaming of unawaited promises passed down from a Server Component. Rejected
    on verification — this route's real content isn't server-fetched at all (rule 7), so there is no
    Server Component data-fetch to split this way; adopting it here would introduce an SSR-streaming
    pattern used nowhere else in the app instead of reusing the existing React Query convention
    (AD-4). A direct-from-browser call to Meta's oEmbed endpoint, bypassing `apps/backend` entirely.
    Rejected — duplicates the existing cache and credential ownership, and Meta's Graph API endpoint
    isn't confirmed to accept unauthenticated browser CORS requests.

---

### AD-17: Computed Event/Schedule Field Batching — Extended fieldMap, Not DataLoader

*   **Binds:** `apps/backend/src/schema/resolvers.ts`'s `events` (`getEvents`), `event`, and
    `eventBySlug` resolvers, their `Event.schedules`/`Event.isFavorited`/`Event.favoriteCount`/
    `Event.isAddedToCalendar` and `Schedule.isAddedToCalendar` field resolvers, and
    `packages/graphql-select/optimized-select.ts`'s `buildOptimizedDrizzleSelect` — the shared
    helper all three top-level resolvers already call. Answers BUG-030 and BUG-033 (same defect
    class, two different queries) and settles where BUG-034/BUG-035/FIND-027/FIND-028 land
    relative to the fix (Rule 5).
*   **Prevents:** A second, parallel batching mechanism (DataLoader) growing up alongside the
    existing `fieldMap` `EXISTS`-subquery mechanism for what the schema treats as the same
    category of thing — a computed field — so WHERE-filtering and output-selection diverge in
    how they resolve the identical field; any future computed field being added as a new
    per-row `Event.*`/`Schedule.*` field resolver by default, re-opening this exact class of N+1
    (the standing rule already added to `project-context.md`'s Database & Performance section on
    2026-09-15 already prevents this in principle — this AD supplies the actual mechanism that
    rule pointed at); introducing a request-scoped loader-registry pattern into
    `apps/backend/src/lib/auth/context.ts`/`server.ts`'s `createContext` for a coordination
    problem this codebase doesn't actually have (Rule 4).
*   **Rule:**
    1.  **Scalar/boolean computed fields batch as correlated subqueries in the same flat
        `SELECT` that already fetches the row — reusing, not duplicating, the `fieldMap`
        mechanism.** `isFavorited`, `isAddedToCalendar`, and a new `favoriteCount` entry on
        `Event` (the latter not in today's `fieldMap` at all — `count(*)` has no boolean
        `EXISTS` precedent there, but is the same shape: a correlated subquery, `(SELECT
        count(*) FROM favorites WHERE favorites.event_id = events.id AND
        favorites.deleted_at IS NULL)`) are embedded directly in the `events`/`event`/
        `eventBySlug` resolvers' own `db.select({...})` call, gated on the field actually being
        requested (reusing `info`, the same signal `buildOptimizedDrizzleSelect` and Rule 3
        below already use). `packages/graphql-select/optimized-select.ts` gains an optional
        `virtualFields: Record<string, SQL>` parameter on `buildOptimizedDrizzleSelect` — for
        any requested GraphQL field with no matching physical column, it checks `virtualFields`
        and includes that expression in the returned `select()` object instead. The three
        resolvers pass their existing `fieldMap`'s `isFavorited`/`isAddedToCalendar` entries
        (already-built `exists(...)` Drizzle expressions, today only wired into
        `buildDrizzleWhere` for `WHERE`) plus the new `favoriteCount` entry as this
        `virtualFields` map — the exact expressions, not re-implementations, so `WHERE`
        filtering and output selection can never drift onto two different definitions of
        "favorited." `Event.isFavorited`/`Event.favoriteCount`/`Event.isAddedToCalendar` become
        passthroughs reading the pre-populated parent value; the existing per-row query in each
        stays only as a defensive fallback for a caller that somehow reaches the field resolver
        without the value pre-populated (e.g. a future direct test/mutation payload) — never the
        expected path once this ships.
    2.  **The one-to-many `schedules` relation batches as one additional `IN (...)`-scoped query
        issued inside the same top-level resolver, not a scalar subquery.** A list of objects
        can't be embedded as a single correlated-subquery column without a materially new kind
        of complexity (`json_agg`/`json_build_object` reimplementing GraphQL's own per-field
        selection logic inside SQL) — that would be a second, bespoke mechanism, not a reuse of
        Rule 1's. Instead: immediately after `events`/`event`/`eventBySlug` fetches its parent
        row(s), when `schedules` (or a nested `Schedule` field, per Rule 3) was requested, issue
        one `db.select({...buildOptimizedDrizzleSelect(schedules, info, {path: 'schedules',
        virtualFields: {...}}), })().from(schedules).where(inArray(schedules.eventId, ids))`
        query, group the rows by `eventId` in JS, and attach the result directly onto each
        parent row as `item.schedules` before returning — the same "precompute on the parent row,
        field resolver reads it back" idiom this resolver already uses for `imageUrl`/
        `durableImageUrl`/`isImageStorageOptedIn` (`resolvers.ts`, `Event.durableImageUrl`:
        `(parent) => parent.durableImageUrl || null`). `Event.schedules` becomes: read
        `parent.schedules` if present, else fall back to its current per-row query (same
        defensive-fallback posture as Rule 1). This applies identically whether the top-level
        resolver returns one row (`event`/`eventBySlug`) or a full page (`events`) — an
        `IN (...)` query over a one-element id array costs the same shape of query as over a
        hundred, so no special-casing by resolver arity is needed.
    3.  **`Schedule.isAddedToCalendar` (BUG-033) folds into Rule 2's SAME batched query, not a
        separate mechanism.** The batched `schedules` query's own `virtualFields` map includes
        an `isAddedToCalendar` entry — `exists(db.select(...).from(calendarAdditions).where(and(
        eq(calendarAdditions.userId, userId), eq(calendarAdditions.scheduleId,
        schedules.id), activeOnly(calendarAdditions))))` — gated on `userId` being known, exactly
        mirroring Rule 1's `Event`-level booleans one level down. `Schedule.isAddedToCalendar`
        becomes a passthrough reading `parent.isAddedToCalendar`, fallback-only otherwise. This
        is what makes BUG-033 "the same defect class as BUG-030, on a different query" literally
        true at the fix level too: `eventBySlug`'s single-event call and `events`' full-page call
        both go through Rule 2/3's identical batched-schedules-query code path — there is no
        `eventBySlug`-specific batching logic to write.
    4.  **DataLoader (graphql-yoga's built-in context/dataloader pattern) was considered and
        rejected** for both Rule 1 and Rule 2/3's fields. Every N+1 in scope here originates from
        exactly one top-level resolver per operation (`events`, `event`, or `eventBySlug`) that
        already fetches its own full ID set in a single query before any nested field resolver
        runs — there is no scenario where two independent, uncoordinated parts of one GraphQL
        operation each need the same batch of schedules/favorites rows, which is the coordination
        problem DataLoader's per-tick call-coalescing actually solves. `dataloader` is not a
        dependency anywhere in this codebase today, and no request-scoped loader-registry exists
        in `createContext` (`apps/backend/src/lib/auth/context.ts`, `server.ts`) — adopting it
        here would add a new cross-cutting request-lifecycle pattern (batch-fn wiring, cache-key
        hygiene, per-request instantiation to avoid cross-request cache leaks) to solve a problem
        the resolver's own existing structure already solves for free once the fetch is
        deliberately sequenced (Rule 2). Reusing/extending `fieldMap` also keeps exactly one
        mechanism — "a SQL expression per GraphQL field, gated by `info`" — governing both
        `WHERE`-filtering (existing) and output-selection (this AD), instead of two conceptually
        different batching systems for what the schema treats as one category of field.
    5.  **BUG-034, BUG-035, FIND-027, FIND-028 relative to this mechanism — two stories, not one,
        in the same story sequence:**
        - **Story sequence item A — `Query.events` computed-field batching:** BUG-030 (Rules
          1–2, applied to `events`) + **FIND-027** (gate the existing unconditional `totalCount`
          second query on `info` field-selection, the same technique and the same function
          being touched for BUG-030 — trivial to include, not worth a separate story) +
          **BUG-034** (add the `(eventId)` partial index on `favorites`, matching AD-8 rule 3's
          `idx_favorites_active` precedent/hand-edit workaround) — this is not an optional
          companion, it's a **prerequisite**: Rule 1's `favoriteCount`/`isFavorited` correlated
          subqueries run once per output row inside the SAME query plan, so without a usable
          `eventId`-leading index they'd force a sequential scan of `favorites` once per row
          inside one query execution — arguably worse than today's separate per-row queries,
          not a fix. It ships in the same story as the subquery it makes viable. + **FIND-028**
          (add `staleTime` to the three `getEvents` consumer hooks — `home-content.tsx`,
          `feed-content.tsx`, `favorites-content.tsx` — the same query surface already being
          touched/re-tested for BUG-030, trivial addition).
        - **Story sequence item B — `eventBySlug`/event-detail-page hardening:** BUG-033
          (Rules 2–3, applied to `event`/`eventBySlug` — reuses Story A's batched-schedules-query
          code path, does not reimplement it) + **BUG-035** (the double-fetch dedup — either
          `HydrationBoundary`/`dehydrate` seeding the client cache from `generateMetadata`'s
          server fetch, or narrowing `generateMetadata`'s own query to the 2 scalar fields it
          actually reads). BUG-035's own fix shape is **not decided by this AD** — it's a
          frontend request-dedup/caching-architecture question, orthogonal to this AD's DB-layer
          batching mechanism (a doubled-but-now-cheap fetch is still wasted work; a single
          expensive fetch would still be bad) — left for story-drafting to resolve, same as its
          backlog note already says ("Fix direction (not yet designed)").
        - Story B is sequenced after Story A because Rule 3 reuses Rule 2's mechanism verbatim;
          it is a separate story rather than folded into Story A because it's scoped to a
          different route (event-detail page vs. the three list views) and BUG-035 is a
          materially different fix category (frontend caching, not DB batching) that doesn't
          belong bundled into Story A's DB-layer change set.
        - **Story sequence item B shipped (Story 1.6c, 2026-09-30).** BUG-035's fix used the
          **authenticated `cache()` + `HydrationBoundary`** variant, not the anonymous-only
          alternative: the SSR fetch that seeds the client's `getEventBySlug` cache reads the
          visitor's session server-side (`createSupabaseServerClient()`) and forwards the token
          per-request via `graphqlClient.request()`'s own `headers` argument — never the shared
          singleton's `.setHeader()`, which would race across concurrent requests from different
          users in the same Node process. This was a real, escalated tradeoff (not mechanical):
          an anonymous-only SSR fetch would have hydrated `isFavorited`/`isAddedToCalendar`
          forced `false` for every visitor, including logged-in ones with real favorited/
          calendar-added state, masked for up to the app's 30s default `staleTime`. A future
          route introducing a similar SSR-fetch-plus-client-hydration page (Gate 3 confirmed
          this story's scope is narrow-by-design, not shared infra) should default to this same
          authenticated pattern, not the cheaper anonymous-only one, unless that route's data has
          no per-visitor-authenticated fields at all. See Story 1.6c's own Dev Notes → "Design
          Decision" for the full tradeoff writeup.
*   **Considered and rejected:** Leaving `schedules` as a per-row field resolver while only
    fixing the scalar fields (Rule 1) — rejected because `schedules{...}` is requested on every
    item by the shared `getEvents.graphql` document (per BUG-030's own finding) and is exactly as
    expensive per-row as the scalar fields; fixing three of four fields and leaving the most
    commonly-requested one unbatched would not actually resolve BUG-030. A `json_agg`-based
    single-query approach that inlines the entire `schedules` array (including
    `isAddedToCalendar`) as one JSON column on the parent `SELECT`, avoiding Rule 2's second
    query entirely — considered attractive for reducing query count from 2 to 1, but rejected:
    it requires dynamically building a `json_build_object(...)` expression from `info`'s
    requested `Schedule` sub-fields (reimplementing `buildOptimizedDrizzleSelect`'s own
    field-to-column logic inside a SQL string rather than as typed Drizzle `select()` keys), a
    new and meaningfully more complex code shape with no precedent anywhere in this codebase,
    for a benefit (one fewer query) that doesn't move the needle relative to eliminating the
    O(N) per-row resolver calls, which Rule 2's simpler `IN (...)` query already fully achieves.
*   **Status (2026-09-20):** **Story sequence item A has shipped** (Story **1.3j**,
    `batch-computed-event-fields-and-gate-totalcount-staletime`, status `review`). The `events`
    resolver now passes `isFavorited`/`favoriteCount`/`isAddedToCalendar` as
    `virtualFields` into its items select (gated on `info`), batch-resolves `schedules` as one
    `IN (...)` query, gates the `totalCount` count query on selection, the four `Event` field
    resolvers became passthrough-with-fallback, the `idx_favorites_event_id` partial index
    shipped (migration `0060_square_pretty_boy.sql`, hand-edited per AD-8 rule 3), and the three
    `getEvents` hooks gained `staleTime: 30_000`. Story B (Story **1.6c**) reuses this landed
    `virtualFields`/batched-schedules mechanism verbatim rather than reimplementing it.
*   **Note 2026-10-01 (AD-30, CC-024):** related-events and source-post loading are
    detail-page-only and lazy, and add nothing to `Query.events` per-row cost. (1)
    `Query.relatedEventIds` is a separate index-driven read, and the client follows it with the
    existing `id in [...]` DSL condition through this AD's own `buildOptimizedDrizzleSelect` path,
    so computed fields batch exactly as Rules 1–2 describe. (2) `Event.sourcePosts` is **not** a
    per-row field resolver: it is resolved as one batched `IN (...)` query (Rule 2's idiom) over
    `event_posts JOIN posts`, only when requested, and the shared list documents
    (`apps/web/src/features/events/queries.graphql`) must not request it. (3) The only per-row change to `Query.events` is
    `isFromSubscribedAccount`'s `EXISTS` gaining one index lookup (AD-30 Rule 6, EXPLAIN-gated).

---
### AD-18: Filter Apply-Timing Convention

*   **Binds:** Every filter/facet control across list, discovery, and moderation surfaces —
    `packages/ui/src/features/events/FilterHub.tsx`'s discrete facets (types/categories/etc.),
    `SearchBar.tsx`'s free-text search, `apps/web/src/app/[locale]/moderator/tools/filter-panel.tsx`'s
    controls, and any future filter control. Also binds every list/pagination consumer of a
    filter's committed value — introduced by Story 0.i5a alongside the shared
    `useListPaginationController` hook (`packages/ui/src/hooks/useListPaginationController.ts`),
    which is the required mechanism this rule points those consumers at.
*   **Prevents:** A mix of "apply on every change" vs. "apply only after an explicit Apply
    button" behavior across different surfaces (the decorative, non-functional "Apply" button in
    `moderator/tools/filter-panel.tsx` is the concrete example of this drift — its `onChange`
    handlers already fire immediately, contradicting the button's implied semantics); and the
    append-instead-of-reload bug class (BUG-019) caused by a consumer forgetting to reset
    pagination state when a filter's committed value changes.
*   **Rule:**
    1.  **Filters apply immediately on change — there is no user-facing "Apply" action that gates
        when a filter takes effect.** This is confirmed against `EXPERIENCE.md`'s Filter Hub spec
        ("The event grid below will update in real-time with each selection"), and is already the
        unanimous behavior of every discrete control in `FilterHub.tsx` today (`onChange`/`nuqs`
        setters fire immediately, no Apply button exists there) — AD-18 codifies this as the
        binding rule rather than introducing new behavior.
    2.  **Discrete controls (checkboxes, toggles, multi-select facets, single-select dropdowns)
        commit on the same interaction that changes the value.** No intermediate "staged" or
        "pending" value is held back from taking effect.
    3.  **Continuous/free-text controls (search box, date-range text input) debounce internally
        via the existing shared `useDebounce` hook** (`packages/ui/src/hooks/useDebounce.ts`,
        already used by `SearchBar.tsx`) before committing. The debounce delay is the only
        permitted "not instant" gap between user input and a filter taking effect — there is
        never a second required user action to commit a continuous control's value.
    4.  **Any list/pagination consumer of a filter's committed value must own its pagination/
        cursor state via `useListPaginationController`** (Story 0.i5a) rather than hand-rolling a
        `useState` cursor that must be remembered to reset on filter change. This is what
        structurally prevents BUG-019's failure mode from recurring at a new call site.
        - **Enforced by:** `packages/ui/src/hooks/useListPaginationController.test.ts` (Story
          0.i5a) proves the reset-on-filter-change contract in isolation; adoption at concrete
          call sites (Discovery's `home-content.tsx`, moderator tools) and the CI-enforced
          no-local-pagination-state ratchet land in Stories 0.i5b/0.i5c/0.i5d/0.i5z.

---

### AD-19: Day-of-Week Weekday-Match — Single Domain Mechanism

*   **Binds:** Any code that must determine which calendar dates a `DayOfWeek`-scoped pattern
    actually lands on — `Schedule.applicableDaysOfWeek?: DayOfWeek[]` (PRD §4.4, BUG-026's
    2026-09-11 amendment) and `EventFilterInput.dayOfWeek` (existing). Today this logic exists at
    `packages/domain/src/events/buildEventsQueryCondition.ts`'s module-local `getDays(fromStr,
    toStr, dow)` (single `DayOfWeek` only, not exported) and, per the `bmad-ux` pass of
    2026-09-16/17, needs a second consumer: `WeeklyCalendarView.tsx`'s new day-of-week occurrence
    expansion (`EXPERIENCE.md` § "Day-of-Week Recurring Schedules").
*   **Prevents:** A third independent reimplementation of weekday-matching logic — BUG-026 already
    found the AI-extraction layer has none and the backend filter has this one; a frontend-only
    version would make three. Also prevents relying on an unenforced string-value coincidence
    between domain's own `DayOfWeek` enum (`packages/domain`, string-valued, `MON = 'MON'` etc.,
    used internally for date math) and the GraphQL-generated `DayOfWeek` enum
    (`@festgrid/shared-types`, what `Schedule.applicableDaysOfWeek`/`EventFilterInput.dayOfWeek`
    actually arrive as client-side per AD-4's End-to-End Type Safety rule) — the two enums'
    values happen to match today, but nothing enforces that they always will.
*   **Rule:**
    1.  **`getDays` is exported and generalized to accept `DayOfWeek[]`,** not just one — used by
        both `buildEventsQueryCondition.ts`'s existing `EventFilterInput.dayOfWeek` path (wrapped
        as a 1-element array) and the new frontend occurrence-expansion. `packages/ui` already
        depends on `@festgrid/domain` (`EventListView.tsx`, `EventDetailView.tsx`,
        `CorrectionForm.tsx` are existing consumers), so this crosses an already-exercised package
        boundary, not a new one.
    2.  **An explicit `Record<GqlDayOfWeek, DomainDayOfWeek>` mapping function is the one sanctioned
        way** to convert a GraphQL-generated `DayOfWeek` value into domain's own `DayOfWeek` before
        calling the shared function — chosen over relying on the two enums' string values happening
        to already match, because a `Record` literal mapping every enum member gets TypeScript's
        exhaustiveness checking for free: a future enum member added to either side without
        updating the map fails the build, not silently drifts at runtime. Mirrors this project's
        existing verify-don't-assume pattern (AD-14, AD-16) rather than introducing a new
        implicit-coincidence one.
    3.  **Domain's own `DayOfWeek` enum stays domain's internal vocabulary,** not replaced by the
        GraphQL-generated one — keeps `packages/domain`'s pure date-math functions decoupled from
        `GraphQL Code Generator`'s output, consistent with domain's existing framework-agnostic,
        no-Node-only-deps posture (`project-context.md`'s Code Organization rules).

---

### AD-20: Temporal Filter (Today / Upcoming) — `!ended`-Only DSL Extension Point

*   **Amended 2026-09-17 (same day as original), user-directed:** the filter's first bucket was
    originally "Happening Now" (`started && !ended`, clock-time-strict on both boundaries) and its
    second was "Upcoming" (`!started`). Renamed/redefined to **Today** (`!ended`, no longer
    requiring `started` — a later-today event that hasn't started yet now qualifies) and
    **Upcoming** (`eventStartDate > todayISO`, a genuinely future day — no longer merely
    "not started yet"), so the two stay a non-overlapping partition. This amendment **shrinks**
    the new-mechanism surface below (Rules 2–4 originally covered both a start-boundary and an
    end-boundary clock-time check; only the end-boundary check survives). AD ID and Binds/Prevents
    below are otherwise unchanged from the original pass; only the Rule is amended.
*   **Binds:** IDEA-019's card-view temporal filter (`EXPERIENCE.md` § "Temporal Filter: Today /
    Upcoming / All"), `EventFilterInput` (`apps/backend/src/schema/events.graphql`),
    `buildEventsQueryCondition.ts` (client-invoked per `home-content.tsx:178-183`), and
    `packages/graphql-select/drizzle-where.ts`'s field/operator dispatch.
*   **Prevents:** Implementing **Today** as a date-only condition on the existing AD-1
    `scheduleDateRange.overlaps` mechanism — verified that mechanism only compares Postgres `date`
    columns (`schedules.eventStartDate`/`eventEndDate`), with no time-of-day component at all,
    which would incorrectly include an event that already fully finished earlier today (badge:
    "Ended"), visibly contradicting that same card's own badge. Also prevents this filter becoming
    a second, independent reimplementation of `ended` semantics that could silently diverge from
    `formatEventStatus`'s (the badge's) existing JS definition on an edge case — missing
    `endTime`, `endDate` defaulting to `startDate`. Also prevents over-building **Upcoming**: since
    it no longer needs any clock-time precision (a pure date comparison), it must **not** get its
    own new SQL mechanism — see Rule 3.
*   **Rule:**
    1.  **`EventFilterInput.temporalFilter: TemporalFilter` enum is `TODAY` | `UPCOMING`**
        (renamed from `HAPPENING_NOW`), absent/null = "All" — matching every other optional
        `FilterHub` facet's convention of "absent means unrestricted."
    2.  **`TODAY` needs one new SQL capability: an `!ended` check.** `buildEventsQueryCondition.ts`
        translates it into an `and` of (a) the **existing, unmodified** `scheduleDateRange.overlaps
        {from: todayISO, to: todayISO}` condition (AD-1, already handles "today falls in this
        schedule's date range" — no new code) and (b) one new `drizzle-where.ts` field/operator
        case testing `!ended`, extending the same fieldMap-descriptor-to-`EXISTS`-subquery pattern
        `scheduleDateRange.overlaps` already uses. Its descriptor combines `eventEndDate ??
        eventStartDate` with `eventEndTime` into a comparable end-timestamp expression, compared
        against a **client-resolved literal ISO instant** (`now.toISOString()`) — **not** a live
        SQL `NOW()` — consistent with every other date/time value in this DSL already being
        resolved once client-side before the query is sent (mirrors `buildDefaultEventVisibility
        Conditions`' identical resolve-once-in-JS-then-embed-as-literal pattern, server-side
        instead of client-side, for Story 2.7's past-events threshold).
    3.  **`UPCOMING` needs no new SQL mechanism at all.** `eventStartDate > todayISO` is fully
        expressible via the **existing, unmodified** `scheduleDateRange.overlaps {from:
        tomorrowISO, to: null}` (the `to: null` open-ended-upper-bound capability Story 2.7 already
        added) — `buildEventsQueryCondition.ts` translates `UPCOMING` straight into this DSL
        condition, no `drizzle-where.ts` change, no clock-time instant needed.
    4.  **The `ended` boundary-case handling in the new SQL expression (Rule 2) must exactly mirror
        `formatEventStatus`'s existing documented rules** (`format-event-date.ts`) — since JS and
        SQL can't literally share code across this boundary, this is enforced via a single shared
        boundary-case fixture (e.g. `packages/domain/src/events/__fixtures__/ended-cases.ts` —
        exact date/time/now inputs and their expected `ended` outcome, covering missing `endTime`
        and `endDate` absent/falling back to `startDate`) that **both** `formatEventStatus`'s unit
        tests and the new SQL condition's integration tests import and assert against — narrower
        than the original pass's fixture scope, since `started` is no longer part of either
        bucket's SQL condition at all.
*   **Deferred, not decided here:** whether this new condition needs its own DB index. The
    existing `schedule_event_date_idx` is a hand-tuned expression index that already needed a
    manual migration edit (`drizzle-kit` cannot generate it — `packages/database/schema.ts`'s own
    documented limitation), and a time-aware condition likely needs something similar, but sizing
    that requires real `EXPLAIN ANALYZE` evidence at the implementation story, not a guess here.

---

### AD-21: Instagram Embed Load Speed — Re-scoped Caching (PWA/iOS UX Excluded)

*   **Binds:** `InstagramEmbed.tsx`'s `embed.js` loading (`loadInstagramEmbedScript`), and a new
    dedicated caching service worker (a separate file/registration from
    `apps/web/public/firebase-messaging-sw.js`). Does not bind PWA installability or iOS install
    UX (see Excluded, below).
*   **Prevents:** Assuming Instagram CDN media loaded *inside* the embed's own iframe can be
    cached by our service worker. **Web-verified 2026-09-17**
    ([github.com/emilisb/ff-iframe-sw-test](https://github.com/emilisb/ff-iframe-sw-test),
    corroborated by MDN/W3C service worker scope semantics): a page's service worker can only
    intercept fetches initiated by that page's own document/clients, never requests made by a
    cross-origin iframe's own internal document — Instagram's iframe fetching its own
    thumbnail/video from Instagram's CDN is invisible to our service worker entirely. This
    invalidates IDEA-020 item (2)'s original premise ("cache Instagram CDN images/reel video") for
    the current oEmbed+iframe approach (item (1)'s already-rejected fully-client-side
    alternative) — a hard platform limitation, not a gap to design around. Also prevents
    registering the new caching service worker at root scope, which would conflict with
    `firebase-messaging-sw.js`'s existing default root-scope registration
    (`push-notifications.ts:66`, no explicit scope passed).
*   **Rule:**
    1.  **Caching scope is narrowed to what's actually cacheable:** `embed.js` itself (fetched by
        *our* page, not the iframe) gets a stale-while-revalidate fetch handler in the new
        dedicated service worker. Instagram's own CDN media inside the iframe is not cached by us
        under any part of this AD — deliberately out of scope, not deferred.
    2.  **`<link rel="preconnect">`/`dns-prefetch` resource hints** to Instagram's CDN origins,
        added to the event-detail route, are the lever for the genuinely uncacheable iframe-internal
        fetch chain's connection-setup latency — no service worker involved, a separate,
        complementary technique.
    3.  **A separate, dedicated service worker** (user-directed — stronger separation of push vs.
        asset-caching concerns, over the lower-friction option of extending the existing FCM
        worker) is registered with an **explicit scope narrower than root**, so it coexists with
        the FCM worker's root-scope registration rather than replacing it. Per this app's
        locale-prefixed routing (AD-6) and since a static file under `apps/web/public/` always
        serves at a fixed root-level URL regardless of Next.js's locale route prefixing, the
        **same** caching-worker script file is registered **twice**, once per locale
        (`scope: '/en/events/'`, `scope: '/id/events/'`) — not duplicated or relocated per locale.
        This covers both the full event-detail page and the intercepted modal route, since AD-16
        already established both update the visible URL to the same `/events/[slug]` path.
    4.  **The existing CSP e2e guard** (`apps/web/e2e/event-details-instagram-csp.spec.ts`,
        `frame-src`/`child-src` allowlisting `instagram.com`) is an unconditional regression
        constraint on any change here — must stay green; this AD does not change where the iframe
        loads from.
*   **Excluded / deferred, explicitly, for a future `bmad-ux` pass:** PWA installability
    (`manifest.json` — none exists today) and iOS-specific install UX (no `beforeinstallprompt` on
    iOS Safari; needs a custom Share-to-Home-Screen banner gated on `navigator.standalone`/
    `display-mode: standalone`). This AD does not decide whether or how the app becomes
    installable — only how `embed.js` gets cached once a service worker exists.

---

### AD-22: Shared Distance Computation for Nearby Badges

*   **Binds:** `EventCard.tsx`'s `distanceKm` prop (`{components.event_card_nearby_badge}`, Story
    1.3b AC16, DESIGN.md's `<8km` threshold), the new `distanceKm` field this AD adds to
    `WeeklyCalendarViewScheduleShape`, and whatever page-level code computes it
    (`home-content.tsx`/`feed-content.tsx`/`favorites-content.tsx`, `CalendarView`).
*   **Prevents:** Treating IDEA-025/026's data-plumbing question as calendar-specific. **Verified
    2026-09-17** that `distanceKm` is not computed anywhere in this codebase today: `EventCard`/
    `EventCardMediaPrimitives` define and consume the prop, but no real caller
    (`home-content.tsx`, `feed-content.tsx`, `EventListView.tsx`) ever populates it — the shipped,
    DESIGN.md/EXPERIENCE.md-documented nearby badge has never actually rendered in production
    regardless of real distance. The only existing distance math anywhere is an inline SQL
    haversine expression in `drizzle-where.ts`'s `withinRadius` filter operator (server-side,
    filtering-only, not reusable client-side, not display-oriented). Also prevents a second,
    independently-computed distance formula or threshold-priority ever diverging from the filter's
    own definition of "N km away" between what a radius filter excludes and what a nearby badge
    claims.
*   **Rule:**
    1.  **Computed status (Ended/Happening Now/etc.) needs no new plumbing and no adaptation.**
        `WeeklyCalendarViewScheduleShape` already carries `eventStartDate`/`eventEndDate`/
        `eventStartTime`/`eventEndTime` — exactly what `formatEventStatus` needs, and
        `WeeklyCalendarView.tsx` already imports from that module for
        `computeCalendarSegmentTillText`. Status is computed relative to real "now," not the
        rendering day-cell, so there is no day-segment ambiguity the way there was for the
        till-text (already solved separately by the `bmad-ux` pass).
    2.  **A new shared pure function** (`packages/domain`, e.g. `computeDistanceKm(viewerCoord,
        targetCoord)`) is the one sanctioned way to compute a display `distanceKm` — mirrors the
        existing SQL haversine's formula/constants (6371 km radius) so client-displayed distance
        and server-side radius-filter distance can never silently disagree about what a given km
        figure means. Consumes the same source-of-truth priority `event_card_nearby_badge`'s own
        threshold rule already established: active filter location if one is selected, else the
        viewer's current location coordinate.
    3.  **`WeeklyCalendarViewScheduleShape` gains `distanceKm?: number`,** computed and passed in
        by the caller exactly like `EventCard` already receives it as a plain prop — neither
        component computes it internally. The implementation story must confirm
        `Schedule.latitude`/`longitude` (`schema.ts:385-386`) are actually exposed via the GraphQL
        queries feeding both surfaces — not verified in this session.
    4.  **Sequencing:** IDEA-026's own first story builds the shared utility and wires **both** the
        new desktop calendar card and `EventCard`'s currently-dead masonry nearby badge in the same
        pass, rather than shipping the calendar card without badges and leaving the pre-existing
        masonry gap open as a separate follow-on.
*   **Explicitly deferred, not decided here:** FIND-026 (whether `max_events_per_day`'s cap of 5
    is still right now that popover overflow shows a materially richer card) is a product/UX call,
    not an architecture question — left open per `EXPERIENCE.md`'s own existing flag on this.
    *(Resolved by a subsequent `bmad-ux` pass — see `EXPERIENCE.md` § "Calendar Overflow: Scalable
    Cap + Infinite-Scroll Popup" and AD-23 below.)*

---

### AD-23: Calendar Overflow Data-Fetching — Fair Per-Day Windowing + Reused `Query.events`

*   **Binds:** `CalendarView.tsx`'s week-level fetch (`useGetEventsForCalendarQuery`, `limit: 1000`),
    the `Query.events` resolver's default ordering (`resolvers.ts:3130-3157`, Story 2.7's
    next-upcoming-date-ASC chain), and the `bmad-ux`-designed Calendar Overflow dialog
    (`EXPERIENCE.md` § "Calendar Overflow: Scalable Cap + Infinite-Scroll Popup", resolving
    FIND-026).
*   **Prevents:**
    1.  **A latent, pre-existing correctness bug found this session:** the flat `ORDER BY
        next-upcoming-date ASC LIMIT 1000` week-level fetch can let one early, popular day in the
        visible week consume most or all of the 1000-row budget, silently starving a later day in
        the *same* week down to zero or artificially few events — with no signal to the client
        that truncation happened at all. This is worse than the redesigned capped-day case (which
        at least shows "+N more"), predates the FIND-026 redesign entirely, and is independent of
        it.
    2.  **A second, parallel query surface for the overflow dialog's own pagination** — AD-2's
        existing mandate ("every event collection is retrieved through the primary event query
        endpoint") already covers a single day's paginated overflow; it is just another
        collection, not a new one.
*   **Rule:**
    1.  **The week-level fetch's ordering is replaced with a SQL window function partitioned per
        day** (`ROW_NUMBER() OVER (PARTITION BY event_start_date ORDER BY event_start_time ASC
        NULLS LAST, id ASC) <= N`), guaranteeing every day in the visible week gets its own fair
        slice of the fetch budget instead of one global date-ordered cut. `N` is the same
        real-dimension-derived per-day cap the `bmad-ux` pass already decided (`EXPERIENCE.md`),
        not a second, independently-chosen number.
    2.  **Multi-day segments and collapsed day-of-week runs are excluded from this
        windowed/partitioned set** and fetched unconditionally alongside it — the same exempt-set
        principle `EXPERIENCE.md` already established for rendering extends to the fetch itself;
        neither is ever subject to the per-day window's own row-number cutoff.
    3.  **The overflow dialog's own "load more for this day" pagination reuses `Query.events`
        unchanged** — no new GraphQL field or query. It is called with a DSL condition narrowed to
        that one specific date (`scheduleDateRange overlaps {date, date}`) plus `offset`/`limit`
        picking up where the week-level windowed fetch's per-day `N` left off. **Correctness
        precondition, caught by this pass's own reviewer gate:** the resolver's existing top-level
        `ORDER BY` (`resolvers.ts:3130-3157`) only has a stable secondary sort *inside* the
        subqueries that compute each event's coalesced next-upcoming date — once a DSL condition
        narrows to one exact date, every matching row's computed date is identical, and nothing at
        the outer query guarantees a stable tie-break. Offset-based pagination across two separate
        calls (the windowed week-fetch's first page, then this dialog's own continuation) is only
        correct if both share the *identical* fully-specified ordering. The windowed fetch (Rule 1)
        and this reused endpoint must therefore apply the same explicit secondary sort —
        `event_start_time ASC NULLS LAST, id ASC` — at the resolver's outer `ORDER BY` whenever the
        active DSL condition resolves to a single exact date, not only inside the date-selecting
        subquery.
*   **Sequencing (user-confirmed):** the window-function fairness fix ships in the same story as
    the overflow dialog's pagination, since both touch the same calendar data-fetch surface —
    but is tracked as its own backlog `BUG` row too, not folded silently into FIND-026's own item,
    since it is a real, independently-discovered pre-existing defect, not a byproduct of this
    redesign.

---

### AD-24: Shared Event-Card Status/Nearby Badge Primitives

*   **Binds:** The event/schedule status badge and the nearby-distance badge across the shared
    `event_card_*` primitive (`packages/ui/src/features/events/EventCardMediaPrimitives.tsx` —
    `EventCardStatusBadge`, `EventCardNearbyBadge`) and the consumers that adopt it: Story 1.i1i
    (this story) migrates `EventCard.tsx`'s masonry branch off its own inline computation/JSX onto
    the two shared components; future consumers are Story 1.i1f's `EventCardCalendarGridItem` and
    Story 1.i1j's compact row (both build-then-adopt later, matching this epic's own precedent).
    The badge_row insertion point between `EventCardStatusBadge` and `EventCardNearbyBadge` is
    reserved for Story 1.3k's not-yet-built `EventCardRepeatBadge` (`EXPERIENCE.md`'s "Day-of-Week
    Recurring Schedules" ordering: status → repeat → nearby). This is a new AD, not an amendment to
    AD-15 — AD-15's own Binds list is scoped to the media slot/favorite badge/date box, a different
    concern from status/nearby badge content.
*   **Prevents:**
    1.  **The status/nearby badge markup becoming a third independent inline duplicate**
        (`EventCard.tsx`'s shipped masonry branch, Story 1.i1f's not-yet-implemented
        `EventCardCalendarGridItem`, and Story 1.i1j's compact row) — the exact drift pattern
        (BUG-023/FIND-023) that already motivated this epic's own `EventCardMediaPrimitives`
        extraction (Story 1.i1a, AD-15).
    2.  **A second, independently-chosen nearby-distance threshold.** `<8km` is the one sanctioned
        gate (DESIGN.md's corrected value, replacing the shipped `<=5km` bug); no consumer may
        hardcode or re-derive its own threshold — `EventCardNearbyBadge` self-gates on it.
    3.  **A combined "badge row" primitive swallowing the insertion point** Story 1.3k needs —
        `EventCardStatusBadge` and `EventCardNearbyBadge` are two independently composable
        components, not a merged wrapper; the consumer (`EventCard.tsx`) keeps owning the badge-row
        `<div>` and renders each as a sibling child.
*   **Rule:**
    1.  **One neutral style, one named exception.** `EventCardStatusBadge` renders all 8
        `formatEventStatus` states with the neutral `bg-muted text-muted-foreground` base style,
        except the `happeningNow` state, which renders `bg-emerald-600 text-white` instead — the
        one sanctioned per-state override, not a general per-state styling mechanism. The
        `happeningNow` discriminant is surfaced from `formatEventStatus`'s existing internal
        `started && endDayDiff > 0` computation, never re-derived independently at the call site.
        - **Enforced by:** `EventCardMediaPrimitives.test.tsx`'s `EventCardStatusBadge` coverage
          (all 8-state neutral rendering; `happeningNow` emerald override) and
          `format-event-date.test.ts`'s `isHappeningNow` branch assertions (Story 1.i1i).
    2.  **`<8km` is the one sanctioned nearby-badge gate.** `EventCardNearbyBadge` self-gates,
        returning `null` unless `distanceKm != null && distanceKm < 8` — callers no longer
        precompute a `showNearbyBadge` boolean locally. The threshold is the primitive's own
        default, not a value each consumer re-derives; the only sanctioned override is a
        forwarded caller-level value (`EventCardNearbyBadge`'s `thresholdKm`, defaulting to `8`,
        fed by `EventCardProps.nearbyBadgeThreshold` — Story 1.i1f already shipped that prop and
        its tests), which still leaves the comparison itself owned by the primitive.
        - **Enforced by:** `EventCardMediaPrimitives.test.tsx`'s boundary assertions
          (`distanceKm=7.99` renders, `8` and above omit, `null`/`undefined` omit) and
          `EventCard.test.tsx`'s rewritten masonry boundary test (Story 1.i1i).
    3.  **Both badges stay independently composable, never a combined row.** Each primitive is
        importable and renders on its own; the consumer's badge-row wrapper owns ordering and
        spacing, preserving the slot Story 1.3k's `EventCardRepeatBadge` will later occupy between
        them without modifying either.
        - **Enforced by:** `EventCardMediaPrimitives.tsx`'s file structure itself (two exported
          components, no combined-row export) plus `EventCard.tsx`'s masonry JSX rendering them as
          separate sibling children of its existing badge-row `<div>` (Story 1.i1i).
    4.  **Neither badge is independently focusable or interactive.** No `aria-label`, no tooltip, no
        independent focus stop — both remain non-interactive supplementary metadata inside
        `EventCard`'s single existing focusable card region, per `EXPERIENCE.md`'s Accessibility
        Floor (that floor's focus/aria requirements are reserved for the future repeat badge only).
        - **Enforced by:** `EventCardMediaPrimitives.test.tsx`'s a11y assertions (no `aria-label`,
          no independent tab stop) for both components (Story 1.i1i).

---

### AD-25: Post-Account Association Table Shape

*   **Binds:** The new `post_account_associations` table (`packages/database/schema.ts`) and its
    two writers/readers — Story 3.15's CAP-3 ingestion write path (`persistScrapedPost` and its
    lossless migration over existing `posts` rows) and Story 3.18's CAP-6 union-of-associations
    feed filter (`Query.events`/`getEvents`). Resolves SPEC-post-coauthor-attribution's own Open
    Questions item, which explicitly deferred the table's uniqueness DDL to architecture/epic
    decomposition.
*   **Prevents:**
    1.  A `UNIQUE(post_id, account_id)` constraint — the naive dedupe-by-pair shape — which would
        make it structurally impossible for one account to hold both a `PUBLISHER` and a
        `SCRAPING_SOURCE` row on the same post, even though the spec explicitly requires that case
        ("may equal the publisher").
    2.  Two different accounts both being written as `PUBLISHER` (or both as `SCRAPING_SOURCE`) on
        one post — a defect a bare 3-column unique constraint is silent on, since it keys on
        `account_id` too and so allows unlimited distinct-account rows per role.
    3.  A second, independently-drifting representation of scrape provenance (`vendor` + `runId`)
        growing up alongside the `scraperActorRunId` FK `posts` already uses for the same fact.
    4.  Story 3.18's filter join reopening the exact per-row-cost defect AD-17 already fixed
        elsewhere (BUG-030/BUG-034's sequential-scan class) by shipping against a table with no
        index serving the join's actual predicate column.
*   **Rule:**
    1.  **Base idempotency constraint:** `UNIQUE(post_id, account_id, role)` — one row per
        (post, account, role) triple. This is what makes CAP-3's re-ingestion idempotency (the
        spec's own Constraints section, and epics.md's Story 3.15 AC) hold: re-processing a post
        can never append a duplicate role row, and the same account legitimately gets two rows
        (`PUBLISHER` + `SCRAPING_SOURCE`) when it holds both roles on one post.
    2.  **Per-post cardinality, two partial unique indexes** — the base constraint alone doesn't
        cover this, since it keys on `account_id` too:
        - `UNIQUE(post_id) WHERE role IN ('PUBLISHER', 'PUBLISHER_UNKNOWN')` — exactly one
          publisher-or-unknown row per post.
        - `UNIQUE(post_id) WHERE role = 'SCRAPING_SOURCE'` — exactly one scraping-source row per
          post.
        Direct precedent already in this schema: `schedules.oneMainPerEventIdx`
        (`idx_schedules_one_main_per_event`, `UNIQUE(event_id) WHERE is_main_schedule = true`) is
        the identical "exactly one X per parent" shape. The same build-time gotcha applies and must
        carry into the migration: drizzle-kit 0.21.4's `index()`/`uniqueIndex()` builder drops the
        `WHERE` predicate from generated migration SQL (same gap as that schedules precedent and
        AD-8 rule 3's `idx_favorites_active`) — the builder call documents intent for
        drizzle-orm's runtime/type layer only; the actual partial-unique DDL must be hand-added to
        the generated migration file, not trusted to `drizzle-kit generate`.
    3.  **Provenance is a nullable FK, not a denormalized copy:** `scraperActorRunId: uuid
        references scraper_actor_runs.id` — the same column/pattern `posts.scraperActorRunId`
        already uses, including reusing `persistScrapedPost`'s existing graceful FK-violation
        fallback (insert with `scraperActorRunId: null` on a `23503`) for the association insert.
        `vendor`/`runId` are read via one join to `scraper_actor_runs` (itself unique on
        `vendor, runId`) rather than duplicated inline — one source of truth for "which scrape run
        produced this."
    4.  **CAP-6 filter index:** `INDEX(account_id, post_id)`, leading column `account_id` — matches
        the filter's actual predicate (`WHERE account_id = ANY(subscribedAccountIds)` /
        an `IN`-join), satisfying AD-17's per-row-cost discipline for Story 3.18's join. No
        standalone `post_id`-only index is added: the base unique constraint's own index already
        leads on `post_id` and serves "all associations for a post" (moderation/analytics) lookups.
    5.  **No soft-delete.** The table is exempt from AD-8, on the same grounds AD-8 already exempts
        `posts` itself and the append-only-log tables (`scraperBatchRuns`,
        `scraperProviderHealth`): rows are only ever inserted, idempotently, via Rules 1–2 above —
        never updated or deleted after the fact.
    6.  **Cascade convention:** `postId` FK is `onDelete: 'cascade'` (matches
        `schedules`/`favorites`/`calendarAdditions` → `events`'s convention for child rows with no
        independent meaning without their parent). `accountId` FK carries no `onDelete` override,
        mirroring `posts.accountId`/`subscriptions.accountId` exactly — `socialMediaAccountProfiles`
        rows are never deleted in this codebase, so no cascade path is needed.
    7.  **Scope note 2026-10-01:** this AD remains the sole owner of the table's DDL. The role
        vocabulary and meaning, the "organizer-authored" predicate, and event-level union
        filtering are owned by **AD-31**, which inherits this AD unchanged. Story 3.15's
        `blocked` status in `sprint-status.yaml` predates this AD's resolution and is stale.

---

### AD-26: Visual-Fidelity Audit Tool — Reference + Rule-Based, Isolated-Render-First

*   **Binds:** A new workspace package, `packages/visual-audit`, and any future story whose
    acceptance criteria depend on matching a design-reference prototype (the 7
    `design-artifacts/UX-festgrid-run-1/prototypes/**/*.html` + `imports/**/*.png` pairs today,
    and any added later) or a described-but-unprototyped visual invariant (e.g. AD-27's masonry
    column behavior, which has no HTML/PNG reference at all). Triggered by this session's own
    visual-fidelity audit of the event-card/calendar family, which had to improvise its method ad
    hoc (isolated Playwright screenshots + manual `getBoundingClientRect` measurement) for lack of
    reusable tooling, and which found a real production bug (`EventCardDateBox`'s day slot
    overflowing on word/time content, e.g. "Tomorrow") that no existing test caught because no
    prototype ever depicted that content variant.
*   **Prevents:**
    1.  **Ad-hoc, session-specific verification methods** that aren't reusable and leave no
        artifact behind — the exact gap this session hit.
    2.  **Content-variant blind spots.** A prototype/PNG is one frozen snapshot; a component's real
        content space (e.g. a formatted date that can render as a number, "Today", "Tomorrow", or
        a time string) is usually larger than what any one screenshot shows. A check that only
        compares against the one depicted state can pass while a real, undepicted state overflows
        in production.
    3.  **False confidence from either signal alone.** Pixel-diff alone is noisy (font
        rendering/anti-aliasing) and can't explain *why* two renders differ; computed-style
        assertions alone can miss whatever no one thought to assert. Neither is sufficient by
        itself.
    4.  **A tool that only works when a golden HTML/PNG reference exists** — several real defects
        (e.g. AD-27's masonry grid behavior) are only ever specified in prose, never prototyped.
*   **Rule:**
    1.  **Two audit modes, one check engine.** *Reference-based*: live render is compared against
        a validated prototype HTML/PNG pair. *Rule-based*: an invariant with no golden reference
        (e.g. "masonry columns share one width; cards within a column vary height independently")
        is hand-encoded directly as an expected structural value. Both modes resolve to the same
        underlying computed-style/DOM assertions — the only difference is where the expected value
        comes from.
    1a. **Render scope is per-manifest-entry, not fixed to "one instance."** Most entries mount a
        single component instance (isolated-render, Rule 4) — that's what Rule 5's sibling-dimension
        auto-clustering groups elements *within*. A manifest entry may instead declare a
        **multi-instance** render (e.g. AD-27's masonry check mounts several cards to assert
        cross-card column behavior) when the invariant is inherently about more than one instance.
        Rule 5's auto-clustering then groups across whatever the manifest actually rendered — never
        silently assumed to be single- or multi-instance by the engine itself.
    2.  **Compare mechanism is a hybrid, computed-style first.** Primary signal: DOM introspection
        — bounding rects and computed CSS properties compared against resolved DESIGN.md/Tailwind
        token values (precise, explainable). Secondary/confirmatory signal: pixel screenshot diff
        against the source PNG, for whatever the assertions don't yet cover.
    3.  **A manifest declares what's checked, not inline per-story code.** Each covered
        component/variant/viewport gets one manifest entry (e.g.
        `packages/visual-audit/manifests/event-card-masonry.ts`) naming its prototype/PNG pair (if
        reference-based), its fixture props, and its rule set. A story's AC cites the manifest
        entry by name; `bmad-dev-story` runs it like any other test, and the story isn't `done`
        until it passes. This keeps a running, queryable catalog of what actually has a visual AC
        versus what doesn't (today: 7 reference-based pairs, `IDEA-046`/`IDEA-048`'s remaining
        gaps, and AD-27's rule-based masonry check).
    4.  **Isolated-component-render is the default mode.** The manifest mounts the component
        directly with fixture props — no live server, no DB, no auth. Live-route mode is a
        documented fallback only for defects that are genuinely route/data-dependent. Directly
        motivated by this session's own audit stalling against `my-calendar` (auth-gated) and
        missing near-term/multi-day/durable-image seed data in `packages/database/seed.ts` — a
        tool that always needs a live route+DB inherits that same fragility.
    5.  **Four checkable rule classes, each with its own tolerance shape:**
        - **Cross-render fidelity** (reference-based only): live vs. prototype computed-style and
          pixel diff, at the manifest's declared viewport(s).
        - **Sibling-dimension consistency**: elements are auto-clustered into rows/columns by
          bounding-box coordinate overlap, scoped to whatever the manifest entry actually rendered
          (Rule 1a) — a single card instance for most entries, or multiple instances when the
          invariant is inherently cross-instance (e.g. AD-27's masonry columns). Clustered siblings
          expected to share a dimension are checked at a **near-zero absolute tolerance, default
          ≤2px** (they're supposed to be identical, not merely similar).
        - **Intra-box ratio consistency**: named element pairs (e.g. month-text:day-text size)
          checked against an expected ratio — sourced from an explicit DESIGN.md token when the
          relationship is a deliberate design rule, otherwise derived once from the validated
          prototype's own rendered ratio — at a **relative tolerance, default ±8–10%** (proportional
          by nature, unlike sibling-dimension equality). Both tolerances are overridable per rule
          in the manifest, not hardcoded in the engine.
        - **Overflow/clipping, including *potential* overflow for undepicted content.** The
          content-variant catalog for a text/content slot is derived via **static analysis of its
          formatting function's branches** (e.g. `format-event-date.ts`'s `dayDiff` branches for
          `EventCardDateBox`'s day slot), not hand-authored fixtures. Each enumerated variant is
          rendered and checked for `scrollWidth > clientWidth` / a bounding rect exceeding its
          ancestor's. Accepted gap: this enumerates branch *shapes*, not arbitrary translated
          *string content* — i18n string-length variance is a known blind spot this rule accepts,
          not one it solves.
        - **Enforced by:** `packages/visual-audit/manifests/event-card-date-box-overflow.ts`
          (`event-card-date-box:overflow-word-time-content:175x160`) — the real
          `EventCardDateBox` day slot checked against every `formatShortEventDateTimeParts`
          branch, including the `content-variants.ts` ternary-enumeration fix (Story 1.i1n AC6)
          that makes the `hasTime` time-string sub-variant enumerable at all.
    6.  **Color fidelity**: resolve the expected color from its DESIGN.md/Tailwind token (exact
        computed-value match, e.g. `bg-slate-800`'s resolved RGB/OKLCH) as the primary check;
        perceptual pixel diff against the source PNG is the fallback for anything not yet
        tokenized.

### AD-27: Masonry Grid — JS Shortest-Column Placement, Not CSS Grid

*   **Binds:** `GridContainer`'s (`packages/ui/src/core/grid-container.tsx`) `variant="masonry"`
    consumer path (`EventListView.tsx`'s Discovery/masonry surface). Surfaced while scoping AD-26:
    the component is named "masonry" but is implemented as plain CSS Grid (`grid-cols-N`, default
    `grid-auto-rows`) — a layout with no prototype/PNG reference of its own (only ever described in
    prose/expectation, exactly the gap AD-26's rule-based audit mode exists to check).
*   **Prevents:**
    1.  **CSS Grid's row-locking behavior masquerading as masonry.** In CSS Grid, every row's
        height is set by its tallest cell across *all* columns — a short card in column 1 can never
        let column 2 flow independently past it. This is a card-*grid*, not Pinterest-style
        masonry, regardless of the prop's name.
    2.  **Adopting native CSS masonry before it's viable.** Web-verified 2026-09-22: CSS Grid Lanes
        (`grid-template-rows: masonry`) ships only in Safari 26; Chrome/Firefox remain behind
        experimental flags with non-interoperable edge-case behavior
        ([caniuse](https://caniuse.com/mdn-css_properties_grid-template-rows_masonry),
        [stefanjudis.com](https://www.stefanjudis.com/blog/how-to-use-and-feature-detect-css-grid-masonry-layout/)).
        Not production-viable; do not bind to it.
    3.  **A silent reading-order regression.** CSS multi-column (`columns-N`) achieves independent
        column flow in pure CSS, but reorders content column-major (top-to-bottom, then wraps to
        the next column) instead of today's row-major left-to-right — a real, user-visible behavior
        change that must not be adopted as a shortcut.
*   **Rule:**
    1.  **JS shortest-column placement** (the standard Pinterest/`react-masonry-css` algorithm):
        measure each card's rendered height, then place each next item into whichever column is
        currently shortest. Achieves true independent per-column height while keeping the visual
        placement order close to today's left-to-right reading order (unlike CSS multi-column).
    2.  **Client-side measurement implies a hydration/layout-shift strategy** — the initial
        server-rendered pass has no measured heights yet. Deferred to the implementing story: pick
        an explicit strategy (e.g. an estimated-height first pass reflowed post-hydration, or a
        skeleton state held until measurement completes) rather than leaving it implicit.
    3.  **Verified by AD-26's rule-based audit mode**, not a bespoke one-off test: the manifest
        entry for `GridContainer`'s masonry variant encodes "columns share one width; cards within
        a column vary height independently; placement order approximates left-to-right" as its
        rule set.
    4.  **Measured-phase (Phase 2) layout invariants** (CC-030, 2026-10-06): items placed with
        `position: absolute` + `translateY` must (a) use a **definite two-line `grid-column`**
        (`N / N+1`) — a bare `grid-column: N` leaves the end line `auto`, which for an absolutely
        positioned grid child resolves to the container's padding edge and stretches the item
        across the full width; and (b) get their vertical gap from the container's **computed
        `row-gap`** added to each Y offset — absolutely positioned items ignore the grid's
        `row-gap`. Neither is observable in jsdom or in a server-rendered (`renderToStaticMarkup`)
        audit, so both are verified by a **client-mounted** manifest (`client-bundle` render) using
        the `sibling-dimension` and `sibling-gap` rules.
*   **Deferred:** the specific library-vs-hand-rolled-hook choice for the shortest-column algorithm
    itself, and the exact hydration/layout-shift strategy (Rule 2) — left to the implementing
    story's own research, not decided here.

---

### AD-28: Face-Blurred Thumbnails — Consent-Independent, Expiry-Gated

*   **Binds:** New `posts.durableThumbnailUrl` column (distinct from and independent of AD-12's
    `posts.durableImageUrl`); `geminiExtractionResponseSchema` (build-gemini-request.ts) and
    `extractedEventSchema` (extracted-event.schema.ts) — gain `hasFaceImage`/`faceImageCount`,
    same pattern Story 3.6l used for `minScheduleCount`; the AI Processor Lambda's
    post-extraction step (new face-api.js detection + sharp blur/resize stage);
    `event_card_masonry`'s `prominentPoster` trigger (EVENT-CARD-DESIGN.md).
*   **Prevents:** AWS Rekognition as the detector (per-image fee, rejected for zero marginal AWS
    cost); merging multiple thumbnails into one batched Rekognition call (buffering layer foreign
    to the per-post SQS pipeline, risks silently dropping faces past Rekognition's per-call cap);
    gating this feature on `isImageStorageOptedIn` (Rule 6); running detection/blur/storage for
    events that will never need the durable copy (Rule 2); conflating `durableThumbnailUrl` with
    `durableImageUrl` — they are separate fields with separate consent rules and must never merge
    into one gate or one column.
*   **Rule:**
    1.  **Pre-filter:** the Gemini extraction schema gains `hasFaceImage: boolean` and
        `faceImageCount: number`. Near-zero marginal cost — rides the extraction call that
        already fetches the image bytes. Used to skip face-detection when `hasFaceImage === false`,
        and captured into `extraction_audit_logs` (AD-29) for evaluation — never written to
        `posts`/`EventInfo`, never GraphQL-exposed. `faceImageCount` is advisory/logging-only —
        general vision-language models are unreliable at precise counting in dense scenes and this
        is never trusted for a hard cutoff. **Amended 2026-10-04 (CC-028, Rule 10):** this
        pre-filter applies only while blur-before-AI is off. When it is on, our own detection has
        already run on every image before the call, so `hasFaceImage` is no longer a gate; it is
        still requested and logged, but it describes an already-blurred image and must not be read
        as a false-negative signal (IDEA-051).
    2.  **Relevance gate:** before running detection, compare the event's latest schedule end
        (max of `schedules[].eventEndDate`/`eventEndTime` across all extracted schedules, from
        this same Gemini response) against `posts.imageUrlExpiresAt` (AD-12 Rule 3, already
        parsed and stored at scrape time). If the event ends at or before the original image URL
        itself expires, skip detection, blur, thumbnail generation, and storage entirely — the
        hotlinked original stays valid for the event's entire relevant display window. Distinct
        from `Event.isExpiredForCurrentUser`/`computePastEventThreshold` (a runtime, grace-period
        visibility check) — this is a one-time build-time relevance check. **Amended 2026-10-04
        (CC-028, Rule 10):** with blur-before-AI on, detection runs before extraction, when no
        dates exist yet, so this gate cannot skip detection; it still skips the thumbnail's
        resize, upload and storage.
    3.  **Detection:** for images passing both gates, run `@vladmandic/face-api` (TensorFlow.js,
        pure npm, no native binaries; **backend amended 2026-10-03: the WASM backend,
        `tfjs-backend-wasm`** — the package's default Node entry `require`s the native
        `@tensorflow/tfjs-node`, so the backend is chosen explicitly. The `.wasm` files are
        platform-independent, not a compiled Node addon, and ship in the Lambda bundle like the
        model weights; see Story 0.46) with the SSD MobileNetV1 detector — chosen over the Tiny
        Face Detector for better small/angled-face accuracy — directly against the image's
        *original* fetched bytes, never a pre-resized copy. The detector's own `inputSize`
        parameter (default 512) already downsamples internally for its forward pass and returns
        boxes in the coordinate space of whatever image it was given; pre-resizing ourselves would
        only risk shrinking small/distant faces below a recoverable resolution and would force an
        extra coordinate-remapping step before Rule 4's blur, for no compute or accuracy benefit.
        Runs in the same AI Processor Lambda that already holds the fetched image bytes — no
        second fetch.
    4.  **Processing order (correctness-critical):** detect faces and apply the Gaussian blur at
        the image's *original* fetched resolution/coordinates first; only *then* resize/crop to
        the final thumbnail. Cropping before blurring risks a face partially outside the eventual
        square being detected against the wrong coordinate space.
    5.  **Thumbnail spec:** `sharp.resize(480, 480, { fit: 'cover', withoutEnlargement: true })`,
        JPEG quality 80, square-cropped. Sized for 2x-retina sharpness through phones, tablets,
        and common laptops (~1366-1440px); deliberate, accepted softness on desktop/ultrawide
        viewports (masonry's `image_prominent` slot can render up to ~400-550px CSS-wide there),
        on the reasoning that desktop viewing distance is typically greater, making that softness
        acceptable — and this is a privacy-motivated blurred thumbnail, not a pixel-fidelity
        showcase. Well under typical Instagram source resolution (commonly 1080px), so this is a
        real bandwidth/storage reduction, not an upscale.
    6.  **Consent-independent by design:** `durableThumbnailUrl` is populated **regardless of
        `isImageStorageOptedIn`** — a deliberate, explicit divergence from AD-12 Rule 7's consent
        gate, not an oversight. Rule 7 exists to prevent an unconsented *persistent copy* of a
        scraped account's original content, for copyright/ToS-exposure reasons; this AD persists
        a blurred derivative for an independent reason (bystander privacy), and Rule 2 above
        narrows the resulting footprint by skipping storage for short-lived events.
        `durableImageUrl` (AD-12) keeps its exact existing meaning and behavior — full
        resolution, unblurred, opted-in-only — completely untouched by this AD.
    7.  **`prominentPoster` trigger widens:** from `durableImageUrl != null` to
        `durableImageUrl != null || durableThumbnailUrl != null` — non-opted-in accounts now
        also qualify for the prominent square card treatment, using the blurred thumbnail.
        Render preference when both exist: `durableImageUrl` (opted-in, sharp) wins; otherwise
        `durableThumbnailUrl` (blurred); otherwise today's default non-prominent state
        (e.g. for an event Rule 2 skipped). This measurably dilutes PRD §3.16's framing of the
        prominent card as a binary "felt incentive to opt in" — opt-in is now "sharp prominent"
        vs. "blurred prominent," not "prominent" vs. "nothing." PRD wording updated accordingly
        (Section 3.16). **Served-URL clarification, 2026-10-03 (decided with the user):** this
        governs the card's render preference only. In `resolveServedImageUrl`, the still-valid
        original is served unchanged, unblurred, exactly as today; `durableThumbnailUrl` fills the
        gap only once the original expires (a non-opted-in account gets the blurred thumbnail
        instead of nothing). Consistent with Rule 2, which already assumes the hotlinked original
        is acceptable for the event's whole display window. Delivered by Story 3.6n2.
    8.  **Accepted accuracy trade-off:** face-api.js has materially lower recall than Rekognition
        on small/angled/occluded/low-light faces — the profile of real event crowd photos — so
        some faces may go unblurred. Chosen deliberately to avoid a per-image AWS fee.
    9.  **Media caching — versioned URLs, HTTP cache only (amends AD-12 Rule 2; added via
        `bmad-correct-course` follow-up, 2026-10-01):** every re-hosted media object
        (`durableThumbnailUrl` and `durableImageUrl` alike) is stored under a *content-versioned*
        key, `posts/{postId}/thumb-{hash8}.jpg` / `posts/{postId}/full-{hash8}.{ext}`
        (`hash8` = first 8 hex chars of the SHA-256 of the stored bytes), replacing today's fixed
        `posts/{postId}` key. A changed or re-blurred image therefore always gets a new URL, so
        `immutable` caching is safe. The CloudFront response-headers policy sends
        `Cache-Control: public, max-age=604800, immutable` (7 days, down from 1 year): the 7-day
        value is the ceiling on how long a deleted or replaced object can linger on a device that
        never refreshes its event data. **Deletion semantics:** deleting an image sets the DB
        column to null and removes the S3 object (plus a CloudFront invalidation of its key);
        clients stop requesting it as soon as their event data refreshes — no client-side eviction
        is attempted. **No Cache API / service-worker image cache** (considered, rejected: the
        HTTP cache already gives cache-first behavior for immutable versioned URLs, a service
        worker would only add offline viewing — not a current requirement — plus CORS/opaque-
        response handling and custom expiry code, and Safari caps script-writable storage at 7
        days for non-installed sites, negating a 7-day SW ceiling there). Revisit only if offline
        image viewing becomes a requirement.
    10. **Blur-before-AI — configurable (added 2026-10-04, CC-028; amends Rules 1-2 for the
        mode-on case).** Google's Gemini API terms let it use content submitted through *unpaid*
        keys, including images, to improve its products (with possible human review); paid keys
        are not used that way. Extraction keys include subscribers' own keys whose billing tier is
        not verified, so by default the vendor must not receive an unblurred face. A backend env
        var `BLUR_FACES_BEFORE_AI` (boolean, **default on**; only an explicit `false` or `0` turns
        it off, set explicitly per stage in the AI Lambda's IaC) decides whether the blur of Rules
        3-4 runs **before** the extraction call. When on: (a) every image sent to Gemini — the
        cover and each carousel slide, up to `MAX_CAROUSEL_IMAGES` — is detected and blurred at
        original resolution first, one image at a time (peak memory stays that of one image), and
        the *blurred* bytes are what go into the request; (b) **owner opt-in exception:** when the
        post's owner — the account with role `PUBLISHER` on the post (`posts.accountId`, AD-31),
        never a co-author — has `isImageStorageOptedIn = true` (any `imageStorageOptInSource`), the
        original is sent unchanged and no pre-AI blur runs; a post whose publisher is unverified
        (`PUBLISHER_UNKNOWN`) is not opted in; (c) **fail closed:** if detection or blur fails,
        times out, or the remaining-time budget (`FACE_BLUR_MIN_REMAINING_TIME_MS`) is too low for
        an image, that image is not sent — a failed slide is dropped and a failed cover sends the
        caption text only (the existing text-only extraction path) — the original is never the
        fallback; (d) the one detection pass is reused: the blurred cover bytes are what Rule 5
        resizes into `durableThumbnailUrl`, so detection never runs twice for one image. When off,
        or for an opted-in owner, the request is exactly what it was before this Rule. The opt-in
        flag's meaning widens accordingly (PRD §4.5). A queued blur stage ahead of the AI queue was
        considered and deferred (IDEA-057); eyes-only redaction was considered and deferred
        (IDEA-058) — it is a much weaker de-identification and its extraction benefit is unmeasured.
*   **Considered and rejected:** AWS Rekognition `DetectFaces` per-image (higher accuracy, ongoing
    per-image fee); batching multiple thumbnails into one Rekognition call (foreign buffering
    stage, risks a face silently escaping detection past the API's per-call face-count cap).

---

### AD-29: Extraction Quality Audit Log — Separate Table, Ground Truth Where Available

*   **Binds:** New `extraction_audit_logs` table (`packages/database/schema.ts`);
    `process-ai-job.ts`'s post-extraction step (writes one row per extraction attempt);
    Story 3.6l's `minScheduleCount`/`expectedScheduleNames` (retrofit) and Story 3.6m's
    `hasFaceImage`/`faceImageCount` (new).
*   **Prevents:** Polluting `posts`/`events`'s business-facing schema with internal
    model-self-report telemetry no product surface consumes; joining this table into any
    hot-path resolver (`Query.events`/`Query.eventBySlug`, AD-17) — it is write-once/read-rarely,
    for offline evaluation tooling only, never a GraphQL-exposed field; a self-reported value
    being read as verified when its ground-truth counterpart is silently absent from the row.
*   **Rule:**
    1.  **New table, not new columns:** one row per extraction attempt (`postId` FK), holding
        every Gemini self-reported extraction-quality signal — so this class of data has one
        growing home instead of accumulating as ad hoc columns on `posts`/`events` each time a
        new self-reported field is added.
    2.  **Ground truth captured alongside self-report, wherever available:**
        `actualScheduleCount` (the real persisted `schedules.length`; **amended 2026-10-03:
        recorded as the extraction-time count, `event.schedules.length` of the accepted Gemini
        payload, written synchronously in the AI Processor, because persistence happens
        asynchronously per event in the ingestor — it can differ from the persisted count after an
        idempotent skip or a later merge**) sits beside
        `minScheduleCount`; `actualFaceDetectionCount` (face-api.js's real detected count) sits
        beside `faceImageCount`. A self-reported value with no ground-truth counterpart in the
        same row is only useful for manual spot review, not automated accuracy scoring.
    3.  **Skips are recorded, not silently absent:** `faceDetectionSkippedReason`
        (`'no_face_reported' | 'event_relevance_gate' | null`) records why
        `actualFaceDetectionCount` is null, so a null is never misread as "detection ran and
        found zero faces."
    4.  **Known blind spot, recorded not hidden:** rows where `hasFaceImage = false` never get a
        ground-truth comparison, since Story 3.6n's face-api.js pipeline never runs on them by
        design (AD-28 Rule 1). This table cannot measure the pre-filter's false-negative rate on
        its own — only its behavior when it already said yes. Closing that gap would need
        periodically sampling `hasFaceImage = false` rows through face-api.js anyway, spending
        some of the compute the pre-filter exists to save — left as an explicit future decision,
        not built here.
    5.  **Never joined into a hot path:** no resolver serving any client-facing field ever reads
        this table. Offline/admin evaluation tooling only.
    6.  **Multi-event posts, 2026-10-01 (AD-30):** still one row per extraction attempt, which now
        also records `minEventCount` and `actualEventCount`. The shape of per-event completeness
        data (per-event `minScheduleCount`/`expectedScheduleNames` vs. persisted counts) is left to
        Stories 3.6s/3.6p — a story-level call, not an invariant.
    7.  **Blur-before-AI, 2026-10-04 (AD-28 Rule 10, CC-028):** the row also records which image
        the AI saw, as `aiImageInput` (`'blurred' | 'original_owner_opted_in' |
        'original_mode_off' | 'text_only_fail_closed' | 'no_image_sent'`; the last, added by the
        2026-10-04 readiness sweep, covers a request that carried no image at all, whether the post
        has none or its fetch failed, so it is never mislabelled as an original or a fail-closed
        drop). With the mode on, detection precedes the
        call, so `actualFaceDetectionCount` is known at insert (no backfill); it is the **sum of
        face counts across every image sent**, the only value comparable with the model's
        all-slides `faceImageCount`. No new
        `faceDetectionSkippedReason` is needed: an opted-in owner's pipeline is identical to the
        mode-off pipeline.
*   **Considered and rejected:** adding these fields directly as columns on `posts`/`events` —
    rejected once the audit requirement was raised, since no product surface consumes them and
    there would be no natural home for the ground-truth comparison columns this table exists to
    hold.

---


### AD-30: Event↔Post Is Many-to-Many — `events.post_id` Stays the Primary Pointer

*   **Binds:** `packages/database/schema.ts` (`events`, new `event_posts`, `event_slug_aliases`,
    `posts` columns); the extraction contract (`build-gemini-request.ts`, `process-ai-job.ts`);
    ingestion (`process-ingestion-job.ts`, `build-event-insert-values.ts`); the matching, enrichment
    and merge paths (Stories 3.6v/3.6w); `Query.events`'s account filter and `isFromSubscribedAccount`
    (`resolvers.ts`); the new `Query.relatedEventIds`. Delivered by Stories 3.6r–3.6z (CC-024,
    BUG-051 "Multi-event posts merged into one event", BUG-052 "No cross-post duplicate
    detection"). Reads `schedules.applicable_days_of_week` (BUG-026, already shipped by Story 1.3k).
*   **Prevents:** A second representation of "which post is primary" (an `is_primary` column that can
    disagree with `events.post_id`); any hot-path resolver reading `event_posts` for a field that
    `events.post_id` already answers; re-extraction creating duplicate events; enrichment or merge
    silently deleting a user's calendar entries; two units each inventing their own grouping
    vocabulary, ordinal numbering, or "organizer-authored" test.
*   **Rule:**
    1.  **Tables and columns.**
        ```mermaid
        erDiagram
          events }o--o| posts : "post_id = PRIMARY post"
          events ||--o{ event_posts : "linked posts"
          posts  ||--o{ event_posts : "linked events"
          events ||--o{ event_slug_aliases : "old slugs"
          events ||--o{ schedules : has
          events }o--o| events : "merged_into_event_id"
        ```
        - `event_posts(event_id FK cascade, post_id FK cascade, extraction_ordinal smallint null,
          created_at)`; PK `(event_id, post_id)`; index `(post_id, event_id)`; **full** unique
          `(post_id, extraction_ordinal)` (Postgres treats NULLs as distinct, so manual links with a
          null ordinal never collide and no partial predicate is needed).
        - `events.post_id` is **kept** as the primary-post pointer; its `unique()` is dropped. There
          is no `is_primary` column — "primary = `events.post_id`, and a matching `event_posts` row
          exists" is the single source of truth.
        - `events.extraction_ordinal smallint null` (the event's index within its **primary** post's
          extraction; existing rows backfill to 0), `events.detail_level` (`stub | full`, default
          `full`), `events.merged_into_event_id uuid null` (self-FK, `on delete set null`),
          `events.notified_at timestamptz null` (Rule 10). New unique index
          `events(post_id, extraction_ordinal)`, **unconditional on `deleted_at`** — a soft-deleted
          event is not recreated by re-extraction. A hand-written
          `CHECK (post_id IS NULL OR extraction_ordinal IS NOT NULL)` closes the NULL-ordinal hole
          (NULLs are distinct in a unique index, so a null ordinal would bypass idempotency).
        - `posts.grouping_reason` and `posts.extracted_event_count` (nullable post-level facts that
          product UI reads, so they do not live only in AD-29's audit table; `groupingRationale` is
          never persisted).
        - `event_slug_aliases(slug unique, event_id FK cascade)`.
        - `pg_trgm` plus a trigram GIN index on `events.event_name` (partial, `deleted_at IS NULL`),
          for write-path matching only — never in a hot-path query.
        - `grouping_reason`, `detail_level` are closed sets declared once in `packages/domain` and
          persisted as `pgEnum` (repo precedent: `scheduleTimezoneStatusEnum`).
        - **Migration:** one migration creates the tables, backfills an `event_posts` row (ordinal 0)
          for every event with a `post_id`, then drops the old unique and creates the new one. The
          trigram index, `CREATE EXTENSION IF NOT EXISTS pg_trgm` (default schema, so local native
          Postgres and Supabase behave alike) and the partial predicates are **hand-written** in the
          SQL (as is the `CHECK` above): drizzle-kit 0.21 drops `WHERE` predicates (AD-8 rule 3), and
          operator classes are reported to be ignored too (drizzle-orm#2935 — not re-verified against
          0.21.x, so hand-write regardless). `pg_trgm` 1.6 is available on the local PG 18.4.
    2.  **Drift guard — one write helper.** A single backend module owns every write to
        `events.post_id`: it sets the pointer, upserts the matching `event_posts` row (and its
        ordinal), re-slugs and records the alias (AD-16 Rules 10–11) in **one transaction**. Nothing
        else writes `events.post_id`. A consistency check asserts every non-null `events.post_id` has
        its `event_posts` row with an equal ordinal. (A deferrable composite FK would enforce this
        in the DB, but Drizzle cannot express deferrable FKs.) **Enforced by** a source-scan test in
        the AD-14 citation-ratchet style: it fails if any file other than the helper's module writes
        `postId` in an `events` insert or update.
    3.  **Ingestion idempotency.** Ingestion first looks up `event_posts(post_id, extraction_ordinal)`;
        a hit means "this item is already represented" and the item is skipped or enriched. Creation
        then relies on both unique indexes inside one transaction. A unique violation on either
        `events(post_id, extraction_ordinal)`, `event_posts(post_id, extraction_ordinal)` or the
        `event_posts` PK means "already represented": it is an idempotent **skip**, never a
        failure, so a queue redelivery cannot loop to the dead-letter queue. The per-link ordinal is what keeps a re-run idempotent **after** a
        roundup stub was promoted to another primary post — otherwise the roundup's ordinal slot is
        free again, the stub is re-created, and its slug collides with the promoted event's alias.
    4.  **Hot path unchanged.** `Query.events`, `Query.eventBySlug` and `Report.event` keep
        `events LEFT JOIN posts ON events.post_id = posts.id` — same join count, no `event_posts`
        read. **Acceptance:** `EXPLAIN` plans for `Query.events` and `Query.eventBySlug` before/after
        on representative seed data show identical join count and no new Seq Scan.
        `event_post_id_idx` is dropped only if `EXPLAIN` shows the planner does not need it beside
        the new unique index.
    5.  **Extraction contract.** One Gemini call per post (AD-13, quota unchanged). The payload gains
        `events[]`, each with its own `schedules[]`, `expectedScheduleNames`, `organizerHandle`
        (captured **at extraction time**: Story 3.4o — planned, not yet built — nulls a
        `CURATOR_GUIDE` post's caption after extraction, so matching can never re-read it) and per-schedule
        `applicableDaysOfWeek`; and post-level `groupingReason` (`single-event | program-lineup |
        dependent-stages | separate-events | roundup`), `groupingRationale`, `skippedItems`,
        `minEventCount`. `hasFaceImage`/`faceImageCount` stay at the payload root (post-level).
        Per-post cap on events (default 10, configurable); timezone inference, private-contact and
        performer-leakage guards (3.6a/3.6i/3.6j) run **per event**; the children's-data filter
        (3.6k) stays post-level.
        **Grouping rules, in order:** (1) any strong signal — own registration/ticket/fee/sign-up,
        own organizer handle, different venue — ⇒ separate events; (2) two or more weak signals —
        standalone headliner/title, dates more than ~7 days apart, different category ⇒ separate;
        (3) items within ~7 days under one title and venue ⇒ one event; (4) dependent stages ⇒ one
        event, and registration windows are schedules; (5) otherwise one event. **Roundup:** an event
        per item only with a readable date **and** location (items missing either go to
        `skippedItems`), capped per post. `[ASSUMPTION]` the proposal also mentions "reduced
        confidence when location missing"; that is kept only for non-roundup separate events, since
        a roundup item with no location is skipped outright.
        **Amended 2026-10-19 (AD-38).** Grouping rule (1)'s "different venue ⇒ separate events" is
        no longer left to the prompt: production showed one event holding three schedules at three
        venues (Riot Jogja "Wednesday Night Run"), and the same caption extracted into 7 events in
        one post and 10 in another. A deterministic **place normalizer** (AD-38 Rule 2) enforces it
        after extraction. The `program-lineup` shape that keeps distinct programme items as
        **hidden schedules of one event** is **superseded**: such items become visible events tied
        by an event group (AD-36 Rule 6, AD-38). Rules (3) and (4) stand: items within about 7 days
        under one title and venue stay one event, and **dependent stages are never split**.
    6.  **Account-feed matching is any-linked-post.** The account filter and
        `isFromSubscribedAccount` match an event when **any** post in `event_posts` belongs to a
        subscribed account (via `posts.accountId`; via the association table once Story 3.15 lands —
        see AD-31 Rule 4, which owns the shared helper and the union semantics). Both become
        `EXISTS (event_posts → posts → …)` descriptors in the `fieldMap` mechanism (AD-17); the
        account filter today is a join on the primary post (`socialMediaAccountProfileId:
        posts.accountId`) and stops being one. **EXPLAIN gate:** the plans for the account-filtered
        `Query.events` and for a selection including `isFromSubscribedAccount` show no new Seq Scan
        and no regression beyond the single added index lookup.
    7.  **Matching (BUG-052), write-path only.** After extraction and before insert, per extracted
        event: candidates by overlapping schedule dates (±2 days) plus trigram name similarity; score
        on same organizer account (the item's `organizerHandle`, or the candidate's organizer),
        shared registration/ticket link, date+name similarity, venue/coordinates. High ⇒ auto-link;
        mid ⇒ moderation queue; low ⇒ new event. Thresholds are tuned in Story 3.6v (values: see the 2026-10-12 amendment below).
        **Mid-confidence interim:** the item is ingested as its own **new event** (so its
        `(post, ordinal)` slot is taken and a re-run skips it, Rule 3) and a suggested-match record
        is queued; approving it *is* a merge (Rule 9), rejecting it is a recorded dismissal. There is
        no separate "pending" event state. An event absorbs **at most one item per post**: when two
        items of one post match the same event, the better-scoring one links and the other is
        treated as a lower band. The suggested-match record's shape: see the 2026-10-12 amendment below.
        Matching is best-effort: a concurrent-ingestion duplicate it misses is resolved by moderator
        merge (Rule 9), no distributed lock is designed.
        **Primary-post rule, evaluated in order:** (1) organizer-authored (AD-31 Rule 3) beats
        roundup/aggregator/curator; (2) the post whose extraction has more schedules with a complete
        date and location `[ASSUMPTION]`; (3) earlier post; (4) lower post id (deterministic final
        tie-break). `CURATOR_GUIDE` accounts (Story 3.4n) mark an event `stub` and rank last.
        **Amended 2026-10-12 (Story 3.6v as built, verified against code; diagram:
        `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html`).** The tuning and record
        shape deferred above are now fixed in code; changing any value below is a spine amendment,
        not a code-only edit.
        *   **Entry point.** `findMatchingEvent()` (`apps/backend/src/lib/events/match-event-to-existing.ts`),
            called by `processIngestionJob` (`apps/backend/src/lib/ingestor/process-ingestion-job.ts`)
            between `buildEventInsertValues()` and the insert, only after the `(post, ordinal)`
            idempotency lookup missed and the source post row exists. Returns the single
            best-scoring candidate (any tier) or `null`; no usable schedule start date on the new
            item ⇒ `null` (plain insert).
        *   **Candidate query.** Excludes soft-deleted and merged events and any event already
            linked (`event_posts`) to the new item's own post — this is what enforces "at most one
            item per post" and stops a multi-event post's sibling ordinals re-merging. A schedule
            start date within ±2 days (`DATE_WINDOW_DAYS`) of any new schedule; trigram name filter
            `event_name % name` **and** an explicit `similarity(…) > 0.3` (`NAME_SIMILARITY_FLOOR`,
            so the floor never depends on the mutable `pg_trgm.similarity_threshold` GUC); `LIMIT 20`
            (`CANDIDATE_LIMIT`) applies to joined event×schedule rows, ordered by name similarity
            descending so truncation drops only the weakest.
        *   **Scoring (pure, `packages/domain/src/events/match-scoring.ts`).** `computeMatchScore` =
            organizer 0.40 + shared link 0.20 + mean(name similarity, date proximity `1 − minDayDiff/2`,
            clamped) × 0.25 + venue 0.15 (`MATCH_SCORE_WEIGHTS`). `MATCH_SCORE_THRESHOLDS`: high ≥ 0.75,
            mid ≥ 0.45, else low (`classifyMatchTier`). Helpers: `hasSharedEventLink` (normalized URL),
            `hasVenueMatch` (same location string or coordinates within 150 m),
            `minScheduleDayDifference`. The organizer signal is true when the new item's posting
            account, or the account resolved from its `organizerHandle`, matches the candidate
            through any linked post (`buildEventAccountMatchCondition`, AD-31 Rule 4);
            For roundup- or curator-sourced items **both** `organizerHandle` and the posting
            account are passed as `undefined` (BUG-058), so an aggregator can earn the organizer
            weight only through an organizer the caption explicitly tags. The extraction prompt
            returns `organizerHandle` only for an explicitly tagged or named organizer and never
            defaults it to the posting account (IDEA-068).
        *   **Tier outcomes.** High: `enrichAndPromoteEvent` enriches the candidate in place and
            promotes the new post per the primary-post ordering above; no new `events` row, no
            moderator step. Mid: the item is inserted as its own event and one
            `event_match_candidates` row is queued (`ON CONFLICT (event_id, candidate_event_id) DO
            NOTHING`). Low or `null`: plain new event; the mid event is
            ingested like any other, so it notifies at creation unless it is a stub (Rule 10), before
            a moderator has reviewed the suggestion.
        *   **Suggested-match record.** `event_match_candidates` (`packages/database/schema.ts`):
            `event_id` (the new mid event), `candidate_event_id` (the existing event), `score`,
            `post_id`, `status` (`suggested_event_match_status`: pending | accepted | rejected),
            `resolved_at`, `resolved_by_moderator_id`; unique on `(event_id, candidate_event_id)`,
            indexed on `candidate_event_id` and `status`. `Mutation.resolveSuggestedEventMatch`
            ACCEPT runs `mergeEvents()` (Rule 9) with the existing candidate as winner and the new
            event as loser, which also flips the suggestion to `accepted` and writes an
            `event_merges` journal row; REJECT only records `rejected`. `undoEventMerge` restores
            both events and returns the suggestion to `pending`.
        **Amended 2026-10-19 (production check 2026-10-19; IDEA-085; evidence:
        `event-insight-poc/prod-check-results-review-2026-10-19.md` §2 and §10).** Of the 446
        same-account, same-normalized-name pairs, the matcher is *able* to act on only the
        reachable ones; recall on them is 23 of 178 (12.9%).
        *   **Stub pairs cannot reach `mid` by construction.** For a roundup- or curator-sourced
            item the organizer weight is discounted on purpose (BUG-058), so a same-name, same-day
            pair scores at most 0.25 + 0.15 (same venue) = 0.40 < 0.45 unless the two share a link
            (+0.20). Production: stub pairs without a shared link are candidates **0 of 122**.
            **A scoring rule for stub-vs-stub pairs is required.** The exact rule and weights are
            **Deferred** to IDEA-085 after the offline `computeMatchScore` replay
            (`recall-replay.sql`, Round 3 item 8), as a further amendment of this Rule (weights are
            spine-fixed). It must keep BUG-058's intent for pairs that span different accounts.
        *   **The matcher gets a second entry point.** Matching was write-path only, so pairs that
            existed before the matcher ran (160 of 446) can never be touched. IDEA-085 adds a
            one-time sweep over existing rows that scores pairs with the same pure
            `computeMatchScore`: `high` pairs are merged through `mergeEvents()` (journaled,
            undoable, Rule 9), `mid` pairs become `event_match_candidates`, `low` are ignored.
            The sweep **must not enqueue `mid` candidates faster than moderators resolve them**
            (147 pending, 0 merges at the check); queue capacity is part of IDEA-085.
            `[ADOPTED scope, user-agreed]`; auto-merging `high` pairs in the sweep needs one PRD
            sentence (the PRD says moderators merge duplicates and `high` links at ingest).
        *   **Pair classes.** Same-name pairs more than two days apart (107 of 446) are **series
            members, not duplicates** (AD-36 Rule 12); the duplicate key is organizer + normalized
            name + date + place (AD-38 Rule 6).
    8.  **Promotion and post deletion.** On promotion the event adopts the matched candidate's
        `extraction_ordinal` under the new primary (that `(post, ordinal)` slot is free — the
        candidate was matched to this event rather than creating one) and keeps its old link
        and the old link's ordinal. Promoting to a post whose link has a null ordinal (a manual
        link) assigns that post's next free ordinal (`max + 1`), never null (Rule 1's `CHECK`).
        Deleting a post (including profile/account erasure) promotes the
        next linked post by the primary rule, else sets `events.post_id` null. Because
        `events.post_id` is `ON DELETE SET NULL` (`schema.ts`), the DB nulls the pointer **inside the
        delete itself**; promotion therefore runs in the same transaction **before** the post is
        deleted, through the Rule 2 helper. `event_posts` rows then cascade.
    9.  **Enrichment in place and merge.** Fields with an approved correction or moderator edit are
        never overwritten (proposed changes queue for moderation). Schedules match by date: updated,
        added, **never deleted while a `calendar_additions` row references them**
        (`calendar_additions.schedule_id` is `ON DELETE CASCADE`, so wholesale replacement would
        silently delete users' entries). A moderator merge soft-deletes the loser, sets
        `merged_into_event_id` to the **final** winner (the winner must not itself be merged),
        repoints favorites and reports (deduplicated per user), and repoints every alias that
        targeted the loser to the winner (flat, no chains) plus registers the loser's own slug as an
        alias (AD-16 Rule 10). **Calendar entries** follow schedules, not events: each loser
        schedule maps to the winner schedule with the same date (the enrichment match key), or is
        copied onto the winner when none matches, and `calendar_additions.schedule_id` is repointed
        to that schedule (deduplicated per user on `(user_id, schedule_id)`). **A merge never
        deletes an `event_posts` row**: links to posts the winner does not yet link are repointed;
        links to posts it already links stay on the soft-deleted loser and are excluded from reads
        — deleting one would free that `(post, ordinal)` slot and let a re-run re-create the
        duplicate. A merge must be reversible within the moderator undo window (`EXPERIENCE.md`'s
        soft-delete-with-undo pattern); the journal that records what was repointed is owned by
        Story 3.6w and must preserve these link rows.
        **Amended 2026-10-12 (as built, Story 3.6w):** the "undo window" is the UI's 6 s
        soft-delete-with-undo toast only. The merge commits immediately and `undoEventMerge` has
        **no server-side expiry** (it rejects only an unknown or already-undone journal row), so
        undo stays callable after the toast closes. This is the accepted behavior; adding a server
        expiry is a spine amendment.
    10. **Notifications are per event, with one marker.** `events.notified_at` is set by one
        notify helper and nowhere else. An event notifies at ingestion iff its primary post's
        `grouping_reason` is not `roundup` and the post is not curator-sourced (AD-31 Rule 3
        negated for the curator case); a roundup-sourced stub never notifies at ingestion. When a
        later primary change makes the event organizer-authored (AD-31 Rule 3) and `notified_at IS
        NULL`, exactly one notification is sent and `notified_at` is set. A merge keeps the earliest
        non-null `notified_at` of the two events, so it can never re-fire. Stories 3.8 and 3.6t
        consume this; neither defines its own marker.
        **Amended 2026-10-19 (AD-36 Rule 14).** For an event with a `group_id`, the claim is atomic on
        `(group, source post)`, one notification per group and post, sent after a short delay; the
        covered events get `notified_at` set. An ungrouped event is unchanged. `notifyNewEvent`
        stays the only claim point.
    11. **Related events and source posts.** `Query.relatedEventIds(eventId | postId)` is an
        index-driven read of `event_posts` joined to `events` — it excludes soft-deleted and merged
        events and the subject event itself, so a "See all N" count never includes a hidden event —
        returning IDs grouped by linked post; the client then calls `Query.events` with the
        existing `id in [...]` condition (`id` is already in the `fieldMap`, and `activeOnly(events)`
        already hides soft-deleted and merged events). No new `Query.events` filter and no per-row
        field resolver (AD-17 note). `Event.sourcePosts` follows AD-17's batched-`IN` idiom and is
        requested only by the event-detail document.
    12. **Weekday-narrowed schedules (BUG-026).** `schedules.applicable_days_of_week` **already
        exists** (Story 1.3k) — this change must not re-add it. It only binds that per-event
        extraction populates it and ingestion persists it; matching stays AD-19's single mechanism.
*   **Considered and rejected:** an `is_primary` column on `event_posts` (two truths); making the
    slug opaque so a primary change needs no re-slug (reverses AD-16's DB-free embed); reading
    `event_posts` in the hot-path join (adds a join to the most-queried endpoint); promoting a
    roundup's events by editing in place without a per-link ordinal (re-run duplicates, Rule 3).

---

### AD-31: Post–Account Association Semantics — Roles, Organizer-Authored Predicate, Event-Level Union Filtering

*   **Binds:** The values and meaning of `post_account_associations.role` (the table's DDL is owned
    by **AD-25**, which this AD inherits unchanged); Stories 3.13 (role normalization), 3.15
    (table + migration), 3.18 (union-of-associations filtering), 3.6v (primary-post rule), 3.8
    (first-organizer-post notification), 0.i6g (coauthor toggle); and AD-30 Rule 6's event-level
    account matching.
*   **Prevents:** Two owners of one table (this AD adds no DDL); each consumer re-deriving
    "organizer-authored" differently; the post-level (3.18) and event-level (AD-30) account filters
    drifting into two implementations; a role inferred from vendor producer-array position; the
    scraping-source account being read as an author.
*   **Rule:**
    1.  **Inherited, not redeclared.** AD-25's `UNIQUE(post_id, account_id, role)`, the two partial
        uniques, the `scraperActorRunId` FK, `INDEX(account_id, post_id)` and its cascade/no-soft-
        delete rules are binding and unchanged. `[ADOPTED]` — Story 3.15 is unblocked by AD-25
        (2026-09-18); the `blocked` entry in `sprint-status.yaml` is stale.
    2.  **Closed role vocabulary**, declared once in `packages/domain` and persisted as a `pgEnum`:
        - `PUBLISHER` — the verified canonical publisher, from a vendor role-bearing field
          (never producer-array order).
        - `COAUTHOR` — zero or more per post, from the vendor coauthor field.
        - `SCRAPING_SOURCE` — the account the scrape ran under; may equal the publisher.
        - `PUBLISHER_UNKNOWN` — legacy migrated rows only; never written for a newly ingested post.
    3.  **Organizer-authored predicate.** A post is organizer-authored iff it has a `PUBLISHER` or
        `COAUTHOR` association whose account is not curator-typed. **Curator-typed** means
        `accountType = CURATOR_GUIDE` whether `CONFIRMED` or `AWAITING_APPROVAL` (conservative: a
        misread curator must not become a primary or fire a notification); a **NULL** `accountType`
        (the column is nullable) is *not* curator-typed, so the test is `IS DISTINCT FROM`, never
        `<>`. `SCRAPING_SOURCE` never counts as authorship. **Legacy posts:** a post with no
        `PUBLISHER` association (only the migrated `PUBLISHER_UNKNOWN`/`SCRAPING_SOURCE` rows)
        falls back to `posts.accountId` with the same curator test, so Story 3.15's migration does
        not flip every historical organizer post to "not organizer-authored". The same fallback is
        the whole predicate until Story 3.15 lands. One shared domain function owns it — created by
        the first story that needs it, extended with the association leg by Story 3.15 — and
        primary-post selection (AD-30 Rule 7), the stub marker, and the first-organizer-post
        notification (AD-30 Rule 10) all call it.
    4.  **Event-level union filtering — one helper.** An event matches account A iff some post in
        `event_posts(event)` has an association with A in **any** of the four roles (a strict
        addition to today's `posts.accountId` behavior, per Story 3.18). One shared helper builds
        `EXISTS (event_posts ep JOIN post_account_associations paa ON paa.post_id = ep.post_id
        WHERE ep.event_id = events.id AND paa.account_id = …)`; before Story 3.15 its second leg
        reads `posts.accountId`. The account filter, `isFromSubscribedAccount` and Story 3.18 all use
        it; none re-implements it. Story 3.6v (the first story that creates multi-linked events) ships
        it with the `posts.accountId` leg, and Story 3.18 owns the switch to the association leg.
        **Enforced by** the same source-scan ratchet style as AD-30 Rule 2: a test fails if the
        account `fieldMap` entry or `isFromSubscribedAccount` is built without the helper.
        Serving indexes are AD-25's `(account_id, post_id)` and AD-30's `event_posts` PK and
        `(post_id, event_id)`; **EXPLAIN gate** as in AD-30 Rule 6. **Input contract (BUG-056):**
        the helper's `accountId` binds against a `uuid` column, so the `Query.events` account
        `fieldMap` entry drops any non-UUID value before it reaches SQL (a non-UUID can never equal
        an account id; a Postgres cast error would otherwise 500 the whole list, e.g. Favorites +
        an AI-filter `accountId`). No valid id left ⇒ `false`, no subquery emitted; a valid UUID
        emits the unchanged `EXISTS`, so the serving index and EXPLAIN gate are unaffected.
    5.  **Migration independence.** `event_posts` (3.6r) and `post_account_associations` (3.15) are
        independent tables with no FK between them and may land in either order; both edit
        `schema.ts`, so each ships as its own self-contained migration.
*   **Considered and rejected:** an event-level association table (`event_account_associations`) —
    derivable from `event_posts × post_account_associations`, so a stored copy would only drift;
    counting `SCRAPING_SOURCE` as authorship — it is the *subscription* account, not the author.

---

### AD-32: Guarded Vendor-Call Wrapper — Per-Credential Lock, Timeout, Transient-Retry, Vendor-DPA Gate

*   **Binds:** The sole chokepoint every caller must pass through before an outbound Gemini call
    can be made. Concretely: `callGemini`'s candidate-exclusion loop
    (`apps/backend/src/lib/ai-gateway/adapter.ts`), `verifyGeminiApiKey`
    (`gemini-client.ts:168`, invoked from `createApiKey`, `resolvers.ts:526` — BUG-012/DW-069's
    named victim), and `system-key-adapter.ts`'s `callGeminiForLocationInference`/
    `callGeminiForAccountClassification` AD-10 system-key fallback — today three independent
    paths into `callGeminiGenerateContent`, not one. Downstream of `callGemini`, this transitively
    covers `process-ai-job.ts` (the extraction pipeline), `resolvers.ts`'s
    `resolvePromptToEventFilter`, and `backfill-account-profile-and-infer-location.ts` with no
    separate adoption needed. Stories 0.i2a (build), 0.i2b (adopt: synchronous verification),
    0.i2c (adopt: `callGemini` + every async inference path), 0.i2z (ratchet). Supersedes Story
    3.6s's inline `AbortController` timeout guard (`build-gemini-request.ts`'s `timeoutMs` comment,
    `gemini-client.ts`'s own `AbortController` block) — 0.i2c deletes it, per that story's own
    amendment note, rather than stacking a second timeout on top. Resolves BUG-012 (no
    request-level timeout) and FIND-004 (Apify/Bright Data DPA confirmation, scope below).
*   **Prevents:** A future call site reaching `@google/genai` (or, once Apify/Bright Data adopt
    this, their SDKs) directly instead of through the wrapper — enforced as two separate
    properties, not one: the SDK import itself stays confined to its existing vendor-specific
    adapter file (`gemini-client.ts` — already, verified, the only `@google/genai` importer
    today), and every *caller* of that adapter's raw SDK-calling export
    (`callGeminiGenerateContent`) is a named, source-scanned allowlist (`adapter.ts`,
    `gemini-client.ts`'s own `verifyGeminiApiKey`, `system-key-adapter.ts`'s fallback — the same
    three Binds above, no others), same ratchet style as AD-14/AD-30's existing source-scan tests —
    0.i2z's "any file outside the wrapper module imports the SDK directly" AC is the first property;
    this second one is what actually stops a new caller from reaching
    `callGeminiGenerateContent` directly while still technically importing nothing itself. Two of
    today's three entry points
    silently staying unguarded while only `callGemini` gets the new mechanism — exactly the gap
    0.i2z's ratchet exists to catch. A rate-limit/invalid-key/timeout error being retried
    in-place by the wrapper on the same credential when it should propagate to the caller's own
    key-selection logic — breaking the existing, deliberately-protected contract that
    `GeminiTimeoutError` (and the other two) are never retried, only reported. An in-process lock
    that looks correct in a single test run but cannot serialize concurrent *Lambda containers* at
    all. A Postgres advisory lock that silently breaks under this project's own already-mandated
    Supabase transaction-mode pooler. The DPA gate being applied to a vendor it was never meant to
    cover, or becoming a second, drifting definition of "confirmed" per call site.
*   **Rule:**
    1.  **One function, one new module.** `callVendor(vendor, opts)` in a new
        `apps/backend/src/lib/vendor-gateway/guarded-call.ts` (sibling to `lib/ai-gateway` and
        `lib/scraper`, not folded into either — the epic's own invariant spans Gemini *and*
        Apify/Bright Data, which live in different directories today). It wraps exactly **one**
        attempt against **one** already-identified credential: DPA-gate check → lock claim →
        caller's `call()` thunk → lock release (`finally`) → on failure, `isTransient(error)`
        decides same-credential retry-with-backoff vs. propagate. It does **not** do
        multi-credential selection — `callGemini`'s existing tiered candidate/exclusion loop
        (AD-10) is unchanged and sits *above* it, calling it once per attempt instead of calling
        `callGeminiGenerateContent` directly at its current line 67.
    2.  **Per-credential lock — a lease row, not an advisory lock.** Verified: production
        `DATABASE_URL` is Supabase's transaction-mode pooler (`db/client.ts`, port `6543`,
        `prepare:false`, `max:1`/container — a documented incident fix, 2026-08-27). A
        session-scoped `pg_advisory_lock`/`unlock` pair is unsafe there (no guarantee the unlock
        runs on the same backend connection the pooler handed out for the lock); holding an open
        transaction for `pg_advisory_xact_lock` across a slow external HTTP call, repeated across
        many concurrent Lambda containers, reproduces the same connection-exhaustion shape that
        incident already happened once. An in-process `Map` mutex cannot serialize across
        containers at all. Instead: new table `vendor_call_locks(lock_key TEXT PRIMARY KEY,
        locked_until TIMESTAMPTZ NOT NULL)`. Claim is one atomic, pooler-safe statement — `INSERT
        INTO vendor_call_locks (lock_key, locked_until) VALUES ($1, now() + $2) ON CONFLICT
        (lock_key) DO UPDATE SET locked_until = EXCLUDED.locked_until WHERE
        vendor_call_locks.locked_until < now() RETURNING *` — zero rows back means busy elsewhere,
        thrown as `VendorKeyBusyError` (see rule 4). The claim returns an **ownership token** (the
        claimed `locked_until` as exact epoch text); release is one `UPDATE … SET locked_until =
        now() WHERE lock_key = $1 AND <locked_until matches the token>` in a `finally`, so a lease
        that expired mid-call and was reclaimed by another caller is never cleared by the original
        caller (`[AMENDED, PR #57 review, 2026-10-07]`). A `lockTtlMs` that does not exceed the
        attempt's `timeoutMs` is rejected up front (a lease must outlive the attempt it protects).
        The TTL (default `max(2 × timeoutMs, 60s)`) is the crash-safety net when release never runs. `lock_key` is a plain string,
        not an FK, so it covers identities with no DB row at all: `gemini:key:<apiKeys.id>` for
        pool keys, `gemini:system` for the AD-10 system-key fallback, future
        `apify:<credential-id>` / `brightdata:<credential-id>`.
    3.  **`verifyGeminiApiKey` is an explicit, named exception to locking**, not an oversight: the
        key under verification has no `apiKeys.id` yet (`createApiKey` calls it *before* insert),
        and nothing else can concurrently bill against a key not yet in the candidate pool. Calls
        `callVendor` with no `lockKey` (claim/release skipped entirely) rather than inventing a
        plaintext-hash identity. It still gets the timeout, via a **new**, deliberately short
        `GEMINI_VERIFICATION_TIMEOUT_MS` — distinct from `env.geminiExtractionTimeoutMs`, since a
        synchronous `createApiKey` mutation must fail fast on a hung key (BUG-012's actual
        complaint), not wait as long as a real multi-image extraction call would. Gemini never
        passes through the DPA gate (rule 5) on this or any path.
    4.  **Retry scope is same-credential and narrow.** `callVendor`'s own backoff-retry fires only
        when the vendor adapter's `isTransient(error)` predicate says so (network-level failures —
        connection errors, 5xx — not yet distinguished anywhere in this codebase today) and reuses
        the existing `computeBackoffDelayMs` (`@festgrid/domain`) rather than a second formula.
        `GeminiRateLimitedError`, `GeminiInvalidKeyError`, and `GeminiTimeoutError` are never
        transient — they propagate out of `callVendor` unretried, unchanged from today's contract.
        New `VendorKeyBusyError` (rule 2's zero-rows case) is a **required new catch branch** in
        `callGemini`'s loop — the busy key is excluded and the next candidate tried, not left to
        fall into the generic re-throw-unknown-errors branch. `[AMENDED, PR #57 review,
        2026-10-07]` Busy keys are tracked **separately** from genuinely exhausted ones: when no
        candidate is selectable but busy keys exist, `callGemini` waits (bounded, `computeBackoffDelayMs`,
        3 rounds) and retries them; if they are still all busy it throws the distinct
        **`AiGatewayBusyError`** — never `AiGatewayExhaustedError`, because contention is not
        quota exhaustion. Consumers map it truthfully (manual extraction job: `EXTRACTION_FAILED`
        with a "temporarily busy" message, since manual jobs deliberately have no automatic retry;
        `resolvePromptToEventFilter`: `TEMPORARILY_BUSY`; the AD-10 system-key fallback converts a
        busy `gemini:system` lease the same way; the SQS-driven AI job simply rethrows and is
        redelivered). **Overall deadline:** `callVendor` accepts `overallTimeoutMs` covering all
        attempts *and* backoff; each attempt is capped to what remains and no retry starts unless
        backoff plus a minimal attempt still fits. Call sites derive it as `2 × timeoutMs`
        (verification 20s inside the API Lambda's 25s limit; extraction 240s inside the AI
        Processor's 300s limit), so a Lambda is never killed mid-retry before the typed error and
        lease cleanup run. A timeout is rejected *before* its `AbortSignal` is aborted, so a thunk
        that rejects from its own abort listener can never mask `VendorCallTimeoutError`.
    5.  **DPA gate is Apify/Bright Data only — Gemini is not in it.** `[ADOPTED, user-directed,
        2026-10-06]` Gemini's data-use posture is a separate, not-yet-resolved item (FIND-066) —
        conflating it here would misname what this flag means. For `apify`/`brightdata`,
        `callVendor` checks one boolean **before** the lock claim and before any network call:
        `APIFY_SCRAPING_CONFIRMED` / `BRIGHTDATA_SCRAPING_CONFIRMED`, read through the same
        `parseBooleanDefaultOn()` helper `env.ts` already uses for `BLUR_FACES_BEFORE_AI` —
        **default `true` when unset**; setting either to `false` is a kill switch, not the
        starting state. This inverts FIND-004's original "starts false, needs a confirmation
        action" framing: the user's own determination (recorded here as the evidentiary basis,
        not independently re-verified by this architecture pass) is that FIND-004 is **already
        satisfied** — Apify's and Bright Data's own public documentation states their Instagram
        scrapers read public, logged-out data only (no login/cookies), consistent with *Meta v.
        Bright Data* (N.D. Cal., Jan 2024: scraping publicly available, logged-out data does not
        violate Meta's terms). A failed check throws `VendorDpaNotConfirmedError` — always
        propagates, never retried, never excludes a key (it is a vendor-level refusal, not a
        per-credential one). No DB table, no runtime admin toggle — flipping a flag is a deploy,
        same posture as every other compliance-adjacent env var in this codebase.
    6.  **Apify/Bright Data adoption is not this pass's scope.** `0.i2a`/`0.i2z` are the only
        epics.md stories naming all three vendors; `0.i2b`/`0.i2c` are Gemini-only, and no story
        yet wires `callVendor` into the scraper call sites (`lib/scraper/brightdata-client.ts`,
        `trigger-apify-for-target.ts`, etc.) even though `0.i2z`'s own ratchet AC presumes they
        already do. This AD fixes the wrapper's and the DPA gate's shape so that adoption is a
        drop-in later; it does not add the missing story. Flagged to the user as an `epics.md` gap
        (not written in this pass — out of this run's scope).
*   **Lease rows are permanent by design, and the test row-count ratchet accounts for it (added 2026-10-11, Story 0.51 follow-up):** `vendor_call_locks` holds one row per credential identity (`gemini:system`, `gemini:key:<apiKeyId>`) that the wrapper upserts on every real call and never deletes — it is runtime state, not test data, and a fire-and-forget call can claim it after a test's cleanup. `apps/backend/scripts/run-tests-with-row-count-ratchet.ts` therefore sweeps and logs the lease keys created during a run before its final row-count snapshot; every other table remains strictly ratcheted. Do not "fix" a lease row by adding a delete to the wrapper.
*   **Considered and rejected:** Wrapping only `callGemini` and leaving `verifyGeminiApiKey`/the
    AD-10 system-key fallback as direct SDK calls — rejected, it's precisely the gap BUG-012/DW-069
    and 0.i2z's ratchet already name. A session-scoped or transaction-scoped Postgres advisory lock
    — rejected against this project's own documented transaction-pooler constraint and prior
    connection-exhaustion incident. A DB-backed `vendor_confirmations` table with audit metadata
    (confirmed-by/at/evidence) for the DPA gate — rejected by the user as disproportionate to
    FIND-004's own "effort: s" sizing and without precedent elsewhere in this codebase's
    config-flag conventions. Gating Gemini under the same DPA flag "for uniformity" — rejected by
    the user; it would misclassify a separate, unresolved concern (FIND-066) as settled.

### AD-33: Z-Index Layering Tiers

*   **Binds:** Every `z-*`-stacking element in `packages/ui/src` and `apps/web/src` (~66 sites at
    capture: IDEA-060's inventory — card/badge/calendar overlays, `AppShell`/`NavRailItem`/
    `UserMenu`, the post-selection `summary-bar`, every Radix `Dialog`/`Sheet`/`Select`/`Popover`
    Content/Overlay, `EventDetailView`'s "more actions" kebab menu and "Add to Calendar" modal,
    `CalendarOverflowDialog`, the AI filter overlay, and the one full-screen blocking loader).
*   **Prevents:** A new component picking a `z-*` number that "works locally" against whatever
    happens to be on screen when it was built — the defensive-bump pattern that produced the
    `z-30` comments in `EventCard.tsx`/`EventCardMediaPrimitives.tsx` and left 17 unrelated things
    tied at a single shared `z-50`, with DOM/portal order silently deciding the winner; a
    non-Tailwind-scale literal (`z-[60]`) standing in for a tier that has no name; each Radix
    wrapper (`dialog.tsx`, `select.tsx`, `sheet.tsx`, `popover.tsx`) independently re-asserting its
    own copy of "which number is the overlay level," so a future re-tiering requires finding and
    editing every copy instead of one.
*   **Rule:**
    1.  **Five tiers, ascending, each a `theme.extend.zIndex` token in `apps/web/tailwind.config.ts`**
        (Tailwind theme tokens only — no backing CSS custom properties; every existing `z-*` site in
        the codebase is a Tailwind utility class, none is inline-style/non-Tailwind, so this adds no
        indirection colors/`border-radius` need only for dark-mode runtime switching):
        - **Local** — bare, unnamed Tailwind `z-0`/`z-10`/`z-20`/`z-30`, unchanged. Legal **only** on
          a component whose own root carries `isolate` — not merely "some ancestor, anywhere, has
          one." Two unrelated components sharing one distant ancestor's `isolate` (e.g. a page
          shell's) would each think they own a private stacking context and collide exactly like the
          17-at-`z-50` problem, one tier down; requiring `isolate` on the component's own root keeps
          each Local-tier numeral scoped to that one component's subtree. Without an owning
          `isolate`, the value escapes to the page's root stacking context and can collide with
          anything else on the page. `WeeklyCalendarView.tsx`'s existing `isolate` + `z-10`
          click-target-under-`z-20` visual-layer pattern is the reference instance — left as-is, not
          renamed. Caveat shared by every tier below, not just Local: an ancestor that incidentally
          forms its own stacking context (a `transform`, `filter`, or `opacity < 1`) silently resets
          comparison to that local context — no tier numbering can out-rank a sibling across that
          boundary, so an animated/transformed wrapper must never sit between a tiered element and
          the tier it needs to beat. Not solvable by a flat numeric scale; treat it as a review
          convention, same as the `isolate` placement rule.
        - **Chrome** — `z-chrome` = `40`. `AppShell`, `NavRailItem`, `UserMenu`.
        - **Overlay-sticky** — `z-overlay-sticky` = `45`. Sticky action/summary bars that must clear
          chrome but never contest a true overlay (e.g. the post-selection `summary-bar.tsx`).
        - **Overlay-modal** — `z-overlay-modal` = `50`. Every dialog/sheet/popover/select/menu: all
          four Radix wrappers, `CalendarOverflowDialog`, the AI filter overlay, and both
          `EventDetailView` sites — the kebab "more actions" dropdown (no `isolate` ancestor, so it
          must out-rank arbitrary page content exactly like a Radix popover despite being
          hand-rolled) and the "Add to Calendar" schedule picker (a true `fixed inset-0`/
          `aria-modal`/backdrop dialog).
        - **Overlay-blocking** — `z-overlay-blocking` = `60`. The one full-screen blocking loader;
          replaces the sole non-Tailwind-scale `z-[60]` literal with a named tier instead of a magic
          number.
    2.  **Migration, one pass:** every raw `z-40`, `z-50`, and `z-[60]` class across
        `packages/ui/src`/`apps/web/src` is replaced by its tier token. Bare `z-0`/`z-10`/`z-20`/
        `z-30` are left untouched (Local tier stays unnamed, scoped by the `isolate` convention, not
        by value). One misclassification surfaces in the same sweep: `CalendarOverflowDialog`'s
        backdrop sits at `z-40` (Chrome) despite being a modal overlay — it migrates to
        `z-overlay-modal`, not `z-chrome`.
    3.  **Every Overlay-modal-tier consumer — Radix-portaled or hand-rolled — takes its tier from
        one shared, imported constant, never an inlined class string.** `packages/ui` exports a
        single `OVERLAY_MODAL_Z` class-name constant; every Radix `Portal`-rendered `Content`/
        `Overlay` (today: `dialog.tsx`, `select.tsx`, `sheet.tsx`, `popover.tsx`) **and** every
        non-portaled Overlay-modal element (today: `EventDetailView`'s kebab dropdown) imports and
        uses it instead of writing `'z-overlay-modal'` or `'z-50'` literally in its own `className`.
        Scoping this to "Radix portals" only would leave the kebab dropdown — explicitly placed in
        this same tier by Rule 1 — free to inline its own literal, defeating the one-file-edit
        guarantee below. A future re-tiering of the overlay level is a one-file edit, not a
        grep-and-replace across every consumer.
    4.  **Ratchet is a Vitest test, not an ESLint rule.** `packages/ui`'s only ESLint config
        (`eslint.config.mjs`, added Story 1.i1k Task 6.2) is deliberately narrow — `files`-scoped
        to `src/features/events/**` with one existing rule, not the full ruleset every sibling
        package extends (that parity gap is tracked separately as FIND-036 / Story 0.41) — and it
        registers nothing for `apps/web/src`, which this ratchet must also cover. A fresh,
        cross-package static-analysis rule is out of scope for that narrow config, so a Vitest
        test does the job instead. Two assertions, both source-text static checks (the same
        "test as static analysis"
        shape as AD-30 Rule 2's/AD-31 Rule 4's source-scan ratchets):
        - **No raw tier values.** A test fails if any file under `packages/ui/src` or
          `apps/web/src` (excluding tests/stories/generated output) contains a bare `z-<N>` or
          `z-[<N>]` class where `N` is `40`, `45`, `50`, or `60` and is not spelled as its named
          tier token — i.e. the check is "does this numeral match an approved tier's *value*,"
          not a fixed string list of today's two offending literals (`z-40`/`z-50`), so it also
          catches a future `z-45`/`z-60` written directly instead of `z-overlay-sticky`/
          `z-overlay-blocking`. `z-0`/`z-10`/`z-20`/`z-30` are deliberately **not** ratcheted —
          there is no reliable static check for "does this component's own root carry `isolate`,"
          so Local-tier correctness stays a code-review convention, not a CI gate.
        - **No inlined overlay-modal class.** A test fails if any Overlay-modal-tier consumer file
          (Radix `Portal`-using wrapper, or a hand-rolled one like the kebab dropdown) contains a
          literal `'z-overlay-modal'`/`'z-50'` string in its own source instead of importing
          `OVERLAY_MODAL_Z` (Rule 3).
    5.  **Documentation.** The five tiers, their token names/values, and the `isolate` contract for
        Local are recorded as a new "Layering" section in `project-context.md`, cross-referenced
        from `DESIGN.md` — neither currently has one (IDEA-060's capture finding).
*   **Considered and rejected:** demoting the `EventDetailView` kebab dropdown to Local tier — it
    has no `isolate` ancestor, so a lower value would still escape to the page root and could still
    lose a stacking fight against unrelated page content, the exact bug class this AD exists to
    close; keeping each Radix wrapper's `z-50` as an independently-edited literal (just renamed to
    a token string) — still duplicates the one fact ("which number is the overlay level") across
    four files instead of one; CSS custom properties for the tiers — no non-Tailwind consumer exists
    today, and none of the `isolate`/dark-mode reasons that justify colors/`border-radius` using
    variables apply to a static layering scale.
*   **Enforced by:** the Vitest ratchet in Rule 4, to be added by the story that performs the Rule 2
    migration (not built in this architecture pass — planning/architecture work does not modify
    source or test code; see routing).

---

### AD-34: Scrape Gate — One Rule for "May This Account Be Scraped"

*   **Binds:** `isScrapableAccountType(accountType, accountTypeStatus)` in
    `packages/domain/src/scraper/account-classification.ts`; every code path that *starts* a scrape
    — `triggerAccountScrape` (`apps/backend/src/schema/resolvers.ts`), the subscribe-time
    classify-then-scrape cascade (`subscribeToAccount`), and the daily batch
    (`getBatchScrapeTargets`, `apps/backend/src/lib/scraper/get-scrape-targets.ts`); Stories 3.4n
    (classification + gate), 3.4o (curator accounts become scrapable), 3.16.
*   **Prevents:** The incident that created this AD (2026-10-15): Story 3.4o widened the gate in the
    batch's SQL only, so `triggerAccountScrape` and `subscribeToAccount` kept rejecting `CONFIRMED`
    `CURATOR_GUIDE` accounts (prod `FORBIDDEN` on `laridijogja`) while the daily batch scraped the
    same accounts. Each entry point re-inlining its own copy of the condition, so a change to the
    rule lands in one and not the others.
*   **Rule:**
    1.  **One definition.** An account is scrapable iff `accountTypeStatus` is `NULL` (a legacy
        account, never classified) **or** (`accountTypeStatus = CONFIRMED` **and** `accountType` is
        `ORGANIZER_VENUE_EVENT` or `CURATOR_GUIDE`). `PERSONAL`, and any account `AWAITING_APPROVAL`
        whatever its proposed type, is never scraped. The rule lives only in
        `isScrapableAccountType()`, which has the 100% unit coverage `packages/domain` requires.
    2.  **TypeScript gates call it; none re-inline the condition.** `triggerAccountScrape` and the
        subscribe-time cascade import the function.
    3.  **The batch is the one SQL form.** A TypeScript function cannot sit in a query's `where`, so
        `getBatchScrapeTargets` expresses the same rule as a clause, marked with a comment pointing at
        the function. Its test file **must** cover every `accountType` × `accountTypeStatus`
        combination (including `NULL`), so the two forms cannot drift unnoticed.
    4.  **A new code path that starts a scrape adopts the gate** (Rule 2 or Rule 3) in the same
        change. Paths that only *process* an already-started run (`stale-job-sweep.ts`, the Apify and
        Bright Data result handlers) do not start one and are exempt.
    5.  **Distinct from AD-31's "curator-typed".** That predicate answers "was this post authored by
        an organizer?" and deliberately counts `AWAITING_APPROVAL` curators; this one answers "may we
        scrape this account?". Do not reuse one for the other.
*   **Enforced by:** the unit tests in Rule 1 and the lockstep tests in Rule 3. No lint or source-scan
    ratchet yet; see Deferred.
*   **Deferred:** a source-scan ratchet forbidding a raw `accountTypeStatus === ` comparison outside
    `packages/domain` and `get-scrape-targets.ts`. Revisit if a fourth scrape entry point is added or
    a gate drifts again.

---

### AD-35: Account URLs Resolve by Username, Never by `account_id`

*   **Binds:** the account page route `apps/web/src/app/[locale]/[platformSlug]/[accountId]/`
    (segment renamed `[username]`); the GraphQL query that loads it; every `accountHref` builder —
    `apps/web/src/features/events/mapper.ts` (4 sites), `subscriptions-content.tsx`; the
    `accountHref` props of `EventDetailView` and `SubscribedAccountCard` in `packages/ui`;
    BUG-059 story 1 (URL resolution by username) and `_bmad-output/specs/spec-profile-identity-unification/DESIGN.md` §3.2.
*   **Prevents:** The incident that created this AD (2026-10-18): `account_id` now holds the
    platform's numeric ID, so every link built as `/${platformSlug}/${accountId}` shows a numeric
    URL. Four copies of that template literal each need the same fix, and any future link builder
    can reintroduce the numeric form. Also prevents two units resolving one URL segment
    differently (page vs `generateMetadata`), and one account answering at several URLs.
*   **Rule:**
    1.  **The URL carries the normalized `username`** (lower-case, no `@`). `account_id` never
        appears in a URL, a link label or an `href`. It stays in GraphQL types for identity
        comparison (`isSubscribed`) and mutation arguments only.
    2.  **One builder.** `buildAccountHref(platform, username)` in `packages/domain/src/scraper/`,
        beside `getPlatformSlug`, is the only code that forms the path. `packages/ui` never builds
        account URLs; it renders the `accountHref` it is given. An empty `username` yields
        `null` (rendered unlinked), never a numeric-ID fallback link.
    3.  **One backend resolution point.** `socialMediaAccountProfileByUsername(platform, username)`
        replaces `socialMediaAccountProfileByAccountId` (the account page is its only consumer).
        Order: match `lower(username)`; only if nothing matches **and** the segment is all digits,
        match `account_id`. **Username wins** when an all-digit username equals another account's
        numeric ID; the rare collision is accepted.
    4.  **Transitional tie-break.** While twin rows exist (before BUG-059 story 4), a handle-keyed
        row and its numeric twin share one username. The resolver orders matches numeric
        `account_id` first, then oldest `created_at`, and takes one. Remove this rule when story 4
        has run and a unique `(platform, lower(username))` index exists.
    5.  **One canonical URL, by redirect.** The page compares the URL segment with
        the **normalized** `profile.username` (the same lower-casing `buildAccountHref` applies, so a
        stored mixed-case value cannot cause a redirect loop); any difference (numeric ID,
        upper-case, other spelling) calls `permanentRedirect` (308) to
        `/<locale>/<platformSlug>/<username>`, **carrying the incoming search params**, because the `nuqs` filters (`q`, `types`, `categories`, `view`) live in the
        query string and `permanentRedirect` does not carry it. Existing `/instagram/<numeric>`
        links therefore keep working.
    6.  **One fetch per request.** `generateMetadata` and the page share one `cache()`-wrapped
        lookup, so both resolve the segment identically and agree on `notFound()`.
    7.  **Rename and reuse.** After a rename the old username resolves nothing (404); no history
        table. Once BUG-059 story 5's stale-claimant marker exists, the resolver excludes stale
        rows.
*   **Enforced by:** a unit test on `buildAccountHref`; a Vitest source-scan ratchet failing on any
    template literal under `apps/web/src` that interpolates an `accountId` into a path; resolver
    tests (username wins, digit fallback, tie-break, not found); a page test for the 308 with
    preserved params. All added by BUG-059 story 1 (planning work does not modify source).
*   **Deferred:** `alternates.canonical` in the account page metadata (revisit if account pages get
    indexed); redirects from old usernames after a rename (revisit if rename 404s are reported).
*   **Verified:** `permanentRedirect` in Next.js App Router serves 308 outside a streaming context
    and a meta redirect inside one, throws `NEXT_REDIRECT`, and does not preserve the query string
    (Next.js docs, 2026-10-18; repo pins `next ^15.1.3`). Precedent for page-level canonical
    redirects: AD-16 / Story 3.6v in `events/[slug]/page.tsx`, which uses the 307 `redirect`.

---

### AD-36: Event Groups — Named-Programme Entity, Tiered Anchor Detection, Non-Blocking Moderator Review

*   **Binds:** `packages/database/schema.ts` (new `event_groups` table, new `events.group_id`
    nullable FK); the group-suggestion pipeline (new); `mergeEvents()`/`undoEventMerge` (AD-30 Rule
    9, Stories 3.6v/3.6w); Moderator Tools (PRD §3.9.3); AD-30 Rule 5 / FR113's `program-lineup`
    branch (reopened as a **plan**, Rule 6 below); IDEA-084 (event groups), IDEA-085 (matcher
    recall), BUG-068 (`location_details` JSON-string encoding) and the PRD §3.7 "Default Location:
    Immediate Apply with Moderator Oversight" convention this AD reuses; since 2026-10-19 also
    AD-37 (jsonb write path), AD-38 (event identity, which creates `series` groups) and AD-39
    (place model). Evidence:
    `planning-artifacts/event-insight-poc/results/prod-findings-and-event-groups-2026-10-19.md`
    (production read-only snapshot, 2026-10-19).
*   **Prevents:** Two representations of "this event belongs to a named programme" (ad hoc
    title-parsing at render time, vs a real relation someone can query and moderate); a group model
    that cannot express a cross-account member (the SCH *8th Anniversary* keyword spans
    `slemancityhall`, `tirta_lie`, `sarangbuah.id` — no shared post, no shared account) or an
    umbrella-less tournament (only children, no anchor row); grouping running over unmerged
    duplicates and producing groups of copies; a group-based location inherited from an anchor whose
    own `location_details` is unverified-shape data; a pre-approval gate for group suggestions that
    contradicts the spine's existing non-blocking-review convention; two independent rewrites of the
    `program-lineup` extraction shape (this AD's plan vs whatever IDEA-074's branch does on its own).
*   **Rule:**
    1.  **Schema — a group entity, not a second merge and not a schedule.** A group is "these
        distinct events belong to one named programme"; a merge is "these rows are one event"
        (AD-30); a schedule is "this event has several dates." The three stay separate mechanisms.
        ```mermaid
        erDiagram
          event_groups ||--o{ events : "group_id (nullable)"
          events }o--o| events : "anchor_event_id (nullable, within event_groups)"
        ```
        - `event_groups(id, name, anchor_event_id uuid null FK events ON DELETE SET NULL,
          window_start date null, window_end date null, confidence_tier
          group_confidence_tier_enum, source group_source_enum, status
          group_status_enum default 'active', created_at)`.
        - `events.group_id uuid null FK event_groups ON DELETE SET NULL` — **one group per event**
          (a nullable scalar FK, not a join table): the write-up's option A fit note and every
          observed case (SCH, VICTORIA TOURNAMENT, Logolepsy 2026) show one programme per event: no
          case for an event in two programmes at once was found, so a join table is not justified
          yet. Revisit only if a real two-programme case turns up.
        - `group_confidence_tier_enum`: `title_pattern | keyword_organizer | extraction_field |
          moderator`. `group_source_enum` mirrors it (records which tier produced the group, for
          the moderator-review surface and for measuring tier-2 precision post-launch — §9 flags
          this as currently unmeasured). `group_status_enum`: `active | dissolved` (Rule 5).
        - Closed sets declared once in `packages/domain`, persisted as `pgEnum` — same convention as
          AD-30's `grouping_reason`/`detail_level`.
        **Amended 2026-10-19 (Rules 12–15 below, AD-38).** `event_groups` also carries
        `kind group_kind_enum (series | programme)`, `organizer_account_id text null` and
        `stem text null` (a series' identity, Rule 12), `member_count int` (denormalized,
        maintained on membership change) and the group's display `name`; `group_source_enum` gains
        `place_split` (a group created by the AD-38 splitter), and `group_confidence_tier_enum` gains
        `deterministic` (a group made by a rule with no model call, such as the place split).
        `events.group_id` is indexed
        `WHERE group_id IS NOT NULL AND deleted_at IS NULL`.
    2.  **Cross-account membership is free, not a special case.** Membership is keyed by
        `events.group_id`, not by account or by a shared post/association row — an event from any
        account can join a group regardless of who posted it. `[ADOPTED, settled — not a fork]`:
        the write-up already demonstrates this is required (§4), and nothing in the schema above
        constrains a member's account.
    3.  **Anchor detection — three tiers, in the precision order §5 measured.**
        - **Tier 1 — `title_pattern`.** Same-account title "Umbrella - Child" with 2+ distinct
          children. Measured: 17 groups, 52 events, spot-checked all genuine (§5). The only tier
          with measured precision.
        - **Tier 2 — `keyword_organizer`.** A keyword anchor plus its organizer (e.g. "8th
          Anniversary" + Sleman City Hall), suggesting children inside the anchor's window that
          share its venue and either a shared post or a schedule-title match (write-up §7's tier-2
          combination). **Precision is NOT measured** (§9) — good anchor finder, unproven child
          finder (1 of 21 SCH children carried the keyword, §4).
        - **Tier 3 — `extraction_field` / `moderator`.** Reserved enum values for (a) a future
          extraction field naming the programme a post belongs to (not built — no story exists yet;
          this AD only reserves the slot) and (b) a moderator creating or editing a group by hand.
          No precision claim possible for either; `extraction_field` has never run.
        **Amended 2026-10-19.** Tier 1 also covers the **series stem rule** (Rule 12): same account,
        same normalized stem before the first spaced dash, deterministic, no model call. Tier 2
        requires a **seeded anchor**: a Tier 1 umbrella event or a moderator-created group carries
        `(keyword, organizer_account_id)`, and new posts are matched against the seeded list in
        memory at ingest, never by scanning captions (no table scan); third-party captions never
        attach an event on their own, and the "shares its venue" test compares the normalized
        venue name plus account, not coordinates, until BUG-066 and AD-37's migration land.
        `[ASSUMPTION]` (review gaps G6/G7, not yet user-confirmed).
    4.  **Confirmation policy — immediate-apply, notify-don't-block.** `[ADOPTED, user-directed,
        modified from the tier-gated recommendation]`: every tier writes the group/membership
        immediately; **nothing in ingestion, matching or display waits on a moderator.** This
        reuses PRD §3.7's "Default Location: Immediate Apply with Moderator Oversight" posture
        rather than inventing a new pre-approval gate. Tier 2 and Tier 3 suggestions generate a
        moderator notification; Moderator Tools (§3.9.3) gains a "review group" action — detach a
        wrongly-suggested child, rename, or dissolve the group (Rule 5) — which is a **revert**,
        never a block. `[ASSUMPTION]` Tier 1 also notifies, at lower priority than Tier 2/3, since
        even a precise signal can mis-group (two accounts could reuse an "Opening - Day 1" style
        title); confirm at story time whether Tier 1 needs a notification at all.
        **Amended 2026-10-19.** Immediate-apply is safe only if an unreviewed group's *effect* is
        bounded: until a group is confirmed (Tier 1, or a moderator), its only effect is the
        "part of …" link on the event page and the Rule 13 Discovery policy; any location or
        audience-area inheritance (Rule 9) applies to confirmed groups only. Each detection tier
        has a configuration kill switch and a daily cap on suggestions, because the moderator queue
        has resolved nothing so far (147 pending, 0 merges). `[ASSUMPTION]` (review gap G4).
    5.  **Group edits are reversible, not a hard delete** — same undo convention as AD-30 Rule 9's
        merge journal. Detaching a member, renaming, or dissolving a group (`status: 'dissolved'`)
        is logged and reversible; dissolving never deletes the member events or their own data. The
        exact journal shape (a new table vs. riding on `event_groups.status` transitions) is left to
        story time — not a spine-level fork.
    6.  **`program-lineup` reshape — a committed plan, not built this session.** `[ADOPTED,
        user-directed, PLAN-ONLY]`: AD-30 Rule 5 item 3 / FR113's `program-lineup` branch today
        keeps a programme's items as **schedules** of one event, which hides each one from listing,
        filters and the calendar (write-up §7(a) — this is exactly what hides SCH's own programme).
        This AD commits the target shape: `program-lineup` items become real, visible child
        **events** with `group_id` set, under an anchor detected the same way as Rule 3. **This is
        marked pending-supersession of AD-30 Rule 5 item 3, not a rewrite of it now** — the
        extraction contract, ingestion shape and migration are **not changed in this pass**.
        Current production behavior (hidden schedules) stays in force until delivered. Per the
        user: "we only make the plan now, but the implementation will be done together along with
        the personalization works that is in this branch" (IDEA-074 and its dependents) — so this
        reshape is sequenced with that branch's work, not scheduled independently.
        **Amended 2026-10-19.** The reshape is now the group half of one rule, **AD-38**: an event
        is one activity at one place-set. Items of a `program-lineup` post that are distinct
        activities, and schedules at a different place, become events tied by a group (kind
        `programme`, or `series` when the activity is the same). It remains **not built**; it
        needs, before it ships: AD-38's place normalizer, the dedup gate (Rule 10), per-group
        notifications and the Discovery policy (Rules 13–14), and a PRD change. Production size:
        47 `program-lineup` posts (about +10% events as an estimate, to be sized by Round 3 item
        11).
    7.  **Merge interaction (`event_merges`, AD-30 Rule 9, Stories 3.6v/3.6w).** A merge must stay
        correct for a grouped event without blocking deduplication:
        - The winner keeps its own `group_id` if already set.
        - If the winner's `group_id` is null and the loser's is not, the winner **inherits** the
          loser's `group_id` — a merge means "same real event," so group membership must not be
          silently lost (same spirit as AD-30 Rule 9's link-preservation rule).
        - If both carry **different**, non-null `group_id`s, the merge still **proceeds**
          (deduplication must never block on a group conflict) keeping the winner's `group_id`, and
          queues a moderator notification flagging the conflict — non-blocking, same posture as
          Rule 4. The system does not guess which group is right.
        - `undoEventMerge` restores the pre-merge `group_id` exactly as it restores every other
          field AD-30 Rule 9 names — one more column riding the existing merge journal row, not a
          new mechanism.
        **Amended 2026-10-19 (review gap G1).** A merge soft-deletes the loser (`deletedAt` +
        `mergedIntoEventId`), so `event_groups.anchor_event_id`'s `ON DELETE SET NULL` never fires:
        `mergeEvents()` repoints `anchor_event_id` from loser to winner, journals it
        (`repointedGroupAnchorIds`) and `undoEventMerge` restores it. A group's **active members**
        are events with `group_id` set and `deleted_at IS NULL`; `member_count` counts only those.
    8.  **Distinct from Related Events (`Query.relatedEventIds`, AD-30 Rule 11, Story 3.6u).**
        `relatedEventIds` means "linked by a shared post"; a group means "linked by a named
        programme," independent of any shared post. The two can and do disagree — SCH's
        "road-to" events (Jogja Otomotif Show #8, Tirta Lie's Bakmi Festival) are keyword-tagged by
        caption mention without being programme children, and a group member need not share a post
        with any other member. No shared implementation; both may surface as separate affordances
        on the event-detail page.
    9.  **Location inheritance is gated behind BUG-068 — a hard sequencing rule, not a preference.**
        A child event missing a location MAY eventually inherit its anchor's venue, but this
        **must not ship** before `schedules.location_details`'s JSON-string storage (BUG-068) is
        fixed and reverified on production. Shipping earlier risks propagating a double-encoded or
        (BUG-066) wrong-country value to every ungrounded child. This AD reserves the behavior; it
        does not build it.
        **Amended 2026-10-19.** The BUG-068 writer fix is implemented (AD-37) and **not deployed**;
        the gate is now "writer deployed, row migration run and verified on production, and
        BUG-066's wrong-country pins no longer reach a child". **Audience-area inheritance** (a
        child with no stated area taking its group's) does not depend on coordinates and is
        therefore not gated by this Rule; it is an open decision (AD-39, Deferred).
    10. **Deduplication-first is a hard sequencing rule, not a preference.** Grouping must not run —
        not even Tier 1 — over the **existing backlog** of unmerged duplicate events: the write-up's
        §6/§7 conclusion is that doing so "builds groups of copies." **IDEA-085 (raise the
        matcher's recall, clear the 147-candidate/75-stale-day moderator queue) must ship and be
        verified** (`event_merges` > 0 rows, recall measurably above the observed 5%) **before
        IDEA-084 processes the existing event backlog.** `[ASSUMPTION]` going-forward grouping of
        newly-ingested events is not held to the same gate, since AD-30's write-path matching
        (Rule 7) already reduces, though does not eliminate, new duplicates — confirm this
        backfill-vs-going-forward split at story time if a stricter "pause everything" reading is
        wanted instead.
        **Amended 2026-10-19.** "Recall above 5%" is retired: the 5% mixed pairs the matcher cannot
        reach by design. The gate is stated on **reachable pairs** (the class-4 query of
        `recall-classes.sql`): at least 80% merged, dismissed, or holding a candidate no older than
        7 days, and the legacy class swept (AD-30 Rule 7, amended). `[ASSUMPTION]` the 80%
        threshold (review gap G3), to be confirmed in IDEA-085.
    11. **What's measured and what isn't (write-up §9 — carried forward, not re-claimed as
        settled).** Measured: Tier-1 precision (§5, spot-checked genuine); Tier-2 as an
        anchor/road-to-event finder but not as a children finder (§4); matcher recall (5%, 23/446,
        §6); `location_details` double-encoding prevalence (1,460/1,460 rows, §3). **Not measured:**
        Tier-2 precision as a general rule (whether another organizer's generic phrase, e.g. a bare
        "anniversary," produces false groups); the plan/cost of the production list query
        on production data; anything beyond this one ~7-week snapshot.
        **Amended 2026-10-19.** The double-encoding **mechanism is verified** and is not the
        pooler: drizzle-orm 0.30's `jsonb()` stringifies and postgres.js stringifies again, with
        `prepare` on or off (AD-37). The 2026-10-19 Round 2 results also measured: matcher recall
        on reachable pairs 12.9% (AD-30 Rule 7); 29 pairs of two full events remain unexplained
        pending the replay.
    12. **Group kinds and identity over time** (added 2026-10-19). `[ADOPTED, user-confirmed]`
        - **Two kinds**, `group_kind_enum (series | programme)`, stored on `event_groups` so a
          moderator can correct them (a Rule 4 revert-class action). A **series** is members with
          the *same activity* at different places or times (Riot Jogja's "Wednesday Night Run" at
          three venues). A **programme** is members with *different activities* under one named
          umbrella (SCH's "8th Anniversary": circus, line dance, zumba, fireworks, …). Kind is
          derived when the group is created: a group made by the AD-38 place split or the series
          stem rule is a `series`; a group made from `program-lineup` activities is a `programme`;
          a Tier 1/2/3 or moderator group of unclear kind defaults to `programme`, the policy
          that never hides an event (Rule 13). `[ASSUMPTION]` the default for Tier 1 groups.
        - **Series roll.** Identity key = `(organizer_account_id, stem)`, where `stem` is the name
          normalized (lower-case, diacritics stripped, whitespace collapsed; one function in
          `packages/domain`) and cut before the **first spaced dash** ("Wednesday Night Run -
          Kenes Soho" → `wednesday night run`). A new member joins the open series when its first
          date falls within `GAP` of the latest date of any existing member (**start value 60
          days** `[ASSUMPTION]`, to be sized by the series-candidates query, Round 3 item 13);
          otherwise it opens a new series (a new season). Past members stay in the group as its
          archive. A series with no upcoming member is **dormant**: invisible to Discovery
          (Rule 13 has nothing to collapse) and still reachable from any member's page. Series
          detection is deterministic (same account, same stem), no model call.
        - **Programmes are time-bound.** Identity = name + date window (`window_start`,
          `window_end`); next year's edition is a new group, and a year inside the name keeps
          annual events apart by construction.
        - **A poster's agenda heading is not a group.** One group per event (Rule 1): the "also in
          this agenda" relation stays the shared-post related events (AD-30 Rule 11, Rule 8
          above), not a second group.
    13. **Discovery handling — the cover is computed, never stored** (added 2026-10-19).
        `[ADOPTED, user-accepted]`
        - Filters apply to **members** first; the collapse runs after filtering and ranking. A
          group appears iff at least one member matches, and its cover is the best-ranked
          *matching* member. The cover may differ with and without a filter, by design; no column
          holds it, so nothing goes stale when a member is added, merged or filtered out.
        - **One cap, applied globally over the ranked list, not per page** (a per-page cap would
          show a series again on page 2): `series` is a **hard** cap `k = 1` (the other members
          collapse behind the cover and are reached through the group surface, Rule 15);
          `programme` is a **soft** cap `k = 3` — members beyond the third in rank order take a
          rank penalty and are never removed, so a programme spreads over pages instead of
          flooding one. A group of unknown kind takes the programme policy. `k` and the penalty
          are start values to calibrate `[ASSUMPTION]`.
        - **Discovery only.** The calendar, favorites, the feed and account pages list every
          event; the collapse never runs there.
        - The card shows the count of *matching* members ("+2 more matching sessions") from the
          same pass. When a filter leaves one match, the card is a plain event card with a small
          "part of <group>" link. The programme anchor gets no cover priority in v1.
        - **Group-level seen, for a series.** Any member seen counts as the series seen, otherwise
          the cover rotates to the next occurrence and re-surfaces as new. It is the only place a
          group needs its own score input.
        - **No double fetch.** `Query.events` stays one query: the per-event score as today, then
          window functions (`row_number`, `count`, `bool_or` partitioned by
          `coalesce(group_id, -id)`) over the already ranked candidate set, then the cap, then the
          final order and `LIMIT/OFFSET` (so `hasMore` and page sizes stay correct). Name, kind and
          `member_count` are denormalized on `event_groups` and joined for the displayed rows. With
          ids-then-hydrate (IDEA-076) the id list also carries `group_id`, name, kind and
          `matching_count`; hydrate is unchanged. The group surface is a **separate on-demand
          query** on the partial index of Rule 1.
        - **Measured cost** (synthetic table, 12% of rows in about 400 groups, PostgreSQL 16.15,
          JIT off, median of 9, local): at K = 3,000 candidates the baseline top-200 is 1.1 ms, with
          the series cap 3.1 ms, with cap + matching count + group-level seen 4.8 ms; at K = 10,000
          it is 2.0, 7.8 and 15.5 ms. About +2 to +4 ms at the planned K, growing with K: **keep K
          at or below 3,000**. Not measured on real data or the real score; the count and seen
          windows are the costly part and can move after the cap.
    14. **Notifications — one per (group, source post)** (added 2026-10-19). `[ADOPTED,
        user-directed, delay confirmed]`
        - A new event that belongs to a group does not notify on its own. One notification is sent
          per `(group, source post)`: a later post that adds members to an existing group notifies
          once for those members. An ungrouped event notifies per event, as today. **This replaces
          the PRD rule "push notifications are sent per event, not per post"** for grouped events,
          so the PRD changes before this ships.
        - **Sent after a short delay**, about 60 to 120 seconds (an SQS `DelaySeconds` on the
          notify message). Ingestion runs one message per event, so a send triggered by the first
          sibling would announce a partial group; the delay lets the post's siblings land, and the
          text ("N sessions") is counted at send time. A sibling that lands after the send joins
          the group silently.
        - **One claim point.** `notifyNewEvent` (AD-30 Rule 10) stays the only helper that claims
          and sends. Its claim becomes atomic on `(group_id, source post)` for a grouped event
          (still `UPDATE ... WHERE ... IS NULL RETURNING`-style: claim, then send), and the event
          rows it covers get `notified_at` set so the per-event path cannot fire again. The storage
          of the group claim (a keyed row or a column) is left to story time. A group dissolved
          or emptied before the send falls back to the per-event claim.
    15. **Favorites and the group surface** (added 2026-10-19). `[ADOPTED, user-directed]`
        - **Favorites are per event, never per group**; calendar additions stay per schedule.
          When the AD-38 splitter splits an event, the user's favorite is **copied to every
          child** (they favorited the series) and calendar additions follow the schedules, whose
          ids are stable (AD-38 Rule 4). The split journal records the favorites it created so an
          undo removes exactly those.
        - **The group surface is new UI**, because the Discovery collapse (Rule 13) hides members
          that a user may have favorited: the event page shows "part of <group>" with the active
          members (a series by place and date, a programme by activity), and every member must be
          reachable from there. Layout and copy belong to the UX step; this rule fixes only that
          the surface exists and that it reads from the separate on-demand query.
*   **Considered and rejected:** Option B, reusing Story 3.6u's related events (shared-post-only,
    cannot express a cross-post or cross-account group); Option C, `parent_event_id` on `events`
    (requires the umbrella to exist as its own event — fails for an umbrella-less tournament); a
    pre-approval gate for Tier-2/3 suggestions (rejected by user decision as inconsistent with the
    spine's existing immediate-apply-with-oversight convention); a `group_id` join table for
    multi-group membership (no observed case justifies it yet, Rule 1). Added 2026-10-19: a
    stored group cover or representative (goes stale on every member change and filter,
    Rule 13); a per-page cap (re-shows a series on page 2, Rule 13); one notification per
    event for grouped events (a burst of N pushes for one poster, Rule 14).
*   **Deferred:** the group-review journal's exact shape (Rule 5); whether Tier 1 also notifies
    moderators (Rule 4's `[ASSUMPTION]`); the Tier-3 `extraction_field` anchor itself (reserved, not
    built — no story yet); the `program-lineup` reshape's migration and extraction-contract rewrite
    (Rule 6) — its own architecture/story pass, timed with the IDEA-074 branch; whether
    `event_groups` needs a dedicated undo-toast UI beyond the moderator "review group" action; the
    backfill-vs-going-forward dedup-gate split (Rule 10's `[ASSUMPTION]`). Added 2026-10-19: the
    values of `GAP`, `k` and the programme penalty (Rules 12–13), to calibrate after Round 3
    item 13 and a shadow run of Discovery; the storage of the group notification claim
    (Rule 14); the group-surface UX (Rule 15).
*   **Follow-ups this AD creates (for `bmad-form-epics` to cluster):**
    1.  **IDEA-084 core** — `event_groups` schema, the Tier-1/Tier-2 suggestion pipeline, the
        non-blocking moderator notification + "review group" action (Rules 1–5).
    2.  **Merge/group reconciliation** — the small addition to `mergeEvents()`/`undoEventMerge`
        (Rule 7); naturally rides with Stories 3.6v/3.6w's existing surface.
    3.  **`program-lineup` reshape** — the AD-30 Rule 5 amendment itself plus its migration and
        extraction-contract change (Rule 6); sequence with the IDEA-074 personalization branch per
        the user's explicit instruction, not as a standalone epic.
    4.  **Group-based location inheritance** — a distinct, later idea gated behind BUG-068's fix and
        reverification (Rule 9); do not bundle into the IDEA-084 core epic.
    5.  **IDEA-085 (prerequisite)** — matcher recall + moderator-queue clearing; must land and be
        verified before IDEA-084 runs against the existing event backlog (Rule 10).
    6.  **BUG-068 (prerequisite)** — fix the `location_details` JSON-string encoding and verify the
        mechanism; gates follow-up 4.
    7.  **Tier-3 extraction-field anchor** — a new idea, not yet in the backlog; an AI-extraction
        contract change, candidate for its own `IDEA-0xx` row when the team is ready to schedule it.
    8.  **Group kinds, series identity and Discovery handling** (Rules 12–13) — the stem rule, the
        window-function cap in `Query.events` and the group-level seen input; ships with the
        AD-38 splitter, not before.
    9.  **Per-group notifications** (Rule 14) — the delayed notify message, the group claim in
        `notifyNewEvent`, and the PRD change.
    10. **Group surface** (Rule 15) — the on-demand members query and the event-page section
        (UX step first).

---

### AD-37: jsonb Columns Are Written Through `customJsonb` Only

*   **Binds:** `packages/database/schema.ts` (all 30 jsonb columns); `customJsonb` in the same file;
    the ratchet `packages/database/jsonb-columns.test.ts` and the regression test
    `apps/backend/src/schema/jsonb-encoding.test.ts`; every `postgres()` client (`db/client.ts`,
    scripts, seeds); any SQL that reads a jsonb column (`->>`, `jsonb_array_elements`, `@>`,
    expression indexes: IDEA-073, IDEA-081, AD-39, AD-36 Rule 9); the migration runbook
    `_bmad-output/implementation-artifacts/backlog/BUG-068-jsonb-migration/`; BUG-068 (implemented
    2026-10-19, commit `decbd76`, **not deployed**).
*   **Prevents:** A jsonb *string* stored where an object was meant: with drizzle-orm 0.30.10 and
    postgres.js 3.4.9 a plain `jsonb()` column is stringified twice, so production holds a string
    in 2,231 of 2,231 non-null values of the four columns the read-only role can see
    (`schedules.location_details` 1,460 of 1,460). Reads through Drizzle work in both shapes; any
    reader evaluated inside PostgreSQL (`->>`, `jsonb_array_elements`, `@>`) sees nothing, so every
    planned area, filter and index feature would be blind on old rows and silently correct on new
    ones. Also prevents the next plain `jsonb()` column from reintroducing it, and a Drizzle
    upgrade that turns `customJsonb` into a runtime error.
*   **Rule:**
    1.  **Every jsonb column uses `customJsonb<T>('col')`; a plain `jsonb()` is a regression.**
        `toDriver` hands the **raw object** to postgres.js, which serializes it once; `fromDriver`
        parses a legacy string, so a row is readable in either shape. `.notNull()` and
        `.default([])` are kept. The type had been applied to the three
        `unprocessed_scraper_payloads` columns since 2026-08-29; BUG-068 completes it for the other
        27. It is migration-neutral (`drizzle-kit generate` reports nothing to migrate).
    2.  **A ratchet, not a convention.** `jsonb-columns.test.ts` enumerates the exported tables
        (`is(v, PgTable)`, `getTableColumns`), keeps columns whose SQL type is `jsonb`, and fails if
        any has `columnType === 'PgJsonb'`. A comment on `customJsonb` and a rule in
        `project-context.md` point at it.
    3.  **A Drizzle upgrade to 0.33 or later revisits `customJsonb` in the same change.** From 0.33
        the postgres-js driver installs pass-through serializers for OIDs 114 and 3802; `customJsonb`
        would then hand a raw object to a driver that expects a string and raise `The "string"
        argument must be of type string…`. The probe
        (`apps/backend/scripts/poc-event-insight/probe-jsonb-encoding.ts`, including the
        customJsonb rows) is the check to re-run. Likewise, a new `postgres()` client must not set
        custom serializers for 114/3802.
    4.  **Rows are converted by the runbook, after the writer is deployed, never before.** Order:
        deploy the writer; `01-look.sql`; `02-apply.sql` (one transaction, core columns first,
        `rest` columns only after reading the byte sizes); `01-look.sql` again; the production pack's
        "JSON encoding" item shows every row `object`/`array` and `schedules` reports the same
        `pinned` count before and after. Running apply first converts today's rows and leaves
        tomorrow's as strings.
    5.  **No SQL-side jsonb reader ships before step 4 is verified.** Until then, new rows are
        objects and old rows are strings. A reader that must run earlier uses one shared unwrap
        fragment (`CASE WHEN jsonb_typeof(c) = 'string' THEN (c #>> '{}')::jsonb ELSE c END`),
        defined once in `packages/database` and removed after the migration, so no two units invent
        their own. `[ASSUMPTION]` the fragment is needed only if a reader is pulled forward; the
        default is to wait.
*   **Enforced by:** `packages/database/jsonb-columns.test.ts` (fails on the old schema: 27 `PgJsonb`
    columns); `jsonb-encoding.test.ts` (runs on a migrated scratch database: `jsonb_typeof` is
    `object`/`array` for inserts into `schedules.location_details`, `events.links`,
    `social_media_account_profiles.default_location`, `posts.additional_image_urls`; SQL-side `->>`
    and `jsonb_array_elements` work; a legacy string row still reads parsed); the runbook's
    `test-on-scratch-db.sh`.
*   **Considered and rejected:** client-level pass-through serializers in every `postgres()` client
    (the existing `customJsonb` would then error; covers future columns but needs every client,
    seed and test to use the helper); upgrading Drizzle to 0.33 or later now (same coupling, a
    version bump across `drizzle-orm`/`drizzle-kit` for one defect). The cause is not `prepare:
    false` (the probe reproduces the double encoding with it on and off); that earlier attribution
    (2026-08-29) is withdrawn.
*   **Deferred:** converting the `rest` columns' rows (journal, audit and payload tables) until the
    look output gives their byte sizes; removing the defensive `->>` reads in
    `resolvers.ts:4318–4336` (keep until step 4 is verified); BUG-066 (wrong pins) and BUG-063
    (`adminArea` never written, 0 of 1,460) are separate.
*   **Verified:** `apps/backend/scripts/poc-event-insight/probe-jsonb-encoding.ts` on a scratch
    PostgreSQL 16.15, 2026-10-19: Drizzle `jsonb()` and `$1::jsonb` with a JSON string store a
    **string** with `prepare` on or off and with `max_lifetime`; `customJsonb` stores an **object**;
    with serializers 114/3802 set to pass-through, `jsonb()` stores an object and `customJsonb`
    errors. Production confirmation: read-only role, 2026-10-19.

---

### AD-38: Event Identity — One Activity at One Place-Set, Enforced by a Deterministic Place Normalizer

*   **Binds:** the extraction post-processing (`process-ai-job.ts`, `process-ingestion-job.ts`,
    `build-event-insert-values.ts`) and a new pure module in `packages/domain` (the place
    normalizer, `place_key`); AD-30 Rule 5 (grouping rules) and Rule 7 (matcher candidate
    exclusions); `mergeEvents()` (AD-30 Rule 9); `notifyNewEvent` (AD-30 Rule 10, via AD-36 Rule
    14); the new split journal and Moderator Tools "split event"; AD-36 (groups, Rules 6 and
    12–15); `Query.events` location filters (BUG-064, via AD-39); IDEA-086 (new: event identity),
    IDEA-084, IDEA-085; the Gemini quota (AD-10, AD-32). Evidence:
    `event-insight-poc/prod-check-results-review-2026-10-19.md` and the Riot Jogja "Wednesday
    Night Run" case (one event, three schedules at three venues).
*   **Prevents:** An event whose schedules sit at several venues, so any filter that joins the main
    schedule is wrong for it (BUG-064) and "different venue ⇒ separate events" (AD-30 Rule 5 (1))
    holds only if the prompt obeys; one caption extracted into 7 events in one post and 10 in
    another; programme items hidden as schedules where no list, filter or calendar can reach them
    (`program-lineup`, 47 production posts); the matcher scoring two sibling places of one series
    as duplicates; a first-sibling notification announcing a partial group; two units inventing
    their own meaning of "the same place".
*   **Rule:**
    1.  **Definition.** An **event is one activity at one place-set**; its **schedules are the
        dates** of that activity at that place-set. `[ADOPTED, user-confirmed 2026-10-19]`

        | Shape | Result | Group (AD-36) |
        |---|---|---|
        | one activity, one place, several dates | one event, N schedules | none |
        | one activity, different places (Riot "Wednesday Night Run" at three venues) | one event per place | `series` |
        | different activities under one named umbrella (SCH "8th Anniversary": circus, line dance, zumba, fireworks), even at one venue | one event per activity | `programme` |
        | a route (start pin, passed-through areas) | one event; place-set = start pin + area set | none |
        | dependent stages of one competition (AD-30 Rule 5 (4)) | one event; stages are schedules | none |
        | a schedule with no place of its own | stays with its event, inherits its place-set | none |

        **Place identity.** `place_key` = normalized venue name plus the area key of the venue's
        city (AD-39). Two venue texts are the same place when their `place_key`s are equal, or the
        area keys are equal and name similarity reaches a start value `[ASSUMPTION]`; coordinates
        count only when `pin_trust` is `trusted` (AD-14 Rule 4) and are never the sole basis. A
        compound venue text ("Atrium & Plaza Rama, Sleman City Hall") is one place.
    2.  **The place normalizer is deterministic code, after extraction, with no model call.** A pure
        function in `packages/domain` (100% unit-tested) maps the extracted post payload to the
        events to persist.
        - **Place split:** the schedules of one extracted event are grouped by `place_key`; more
          than one place yields sibling events, the group kind `series`. A sibling's name is the
          schedule title when it follows "Umbrella - Child", else `<event name> - <venue name>`.
        - **Activity split:** only when the post's `groupingReason` is `program-lineup`; each
          distinct lineup item becomes an event, the group kind `programme`. **Never** for
          `dependent-stages`.
        - The place split is a pure function of the extractor output. The activity split inherits
          the extractor's non-determinism (7 events in one post, 10 in another from one caption);
          that is fixed in the extraction contract (AD-30 Rule 5), not here.
        - A second cap bounds the post-split event count per post (start value three times the
          extraction cap, AD-30 Rule 5) `[ASSUMPTION]`.
    3.  **Write-path order.** `[ADOPTED, user-accepted]`
        ```mermaid
        flowchart LR
          A["Extraction<br/>1 Gemini call per post"] --> B["Place normalizer<br/>deterministic"]
          B -->|"one place"| C
          B -->|"N places or activities"| S["N sibling events"]
          S --> C["Per-event matcher<br/>AD-30 Rule 7: enrich / candidate / new"]
          C --> D["Group attach<br/>stem rule, AD-36 tiers, moderator"]
          D --> E["Delayed notify claim<br/>per group and source post<br/>60 to 120 s"]
        ```
        The normalizer runs **before** the matcher so the matcher compares events of the same shape
        (an unsplit three-place event never matches its per-place duplicates), and the group is
        attached **after** the events exist. Ingestion runs one message per event, so the
        notification is claimed after a short delay (AD-36 Rule 14).
        **Ordinals stay idempotent** (AD-30 Rule 3): the first place keeps the extracted event's
        index; each further place takes the next free ordinal after the post's last extracted
        index, in extracted-event order then earliest-date order. The backfill (Rule 4) calls the
        same function, so a re-run of the same extractor output finds every `(post, ordinal)` slot.
        This is as stable as the extractor itself, the same caveat AD-30 Rule 3 already carries.
    4.  **Split mechanics for events that already exist** (backfill, and a moderator "split event"
        action). `[ADOPTED direction; the journal shape is story time]`
        - The **original event stays the first child**: it keeps its id, slug, favorites and links.
          Its schedules at other places **move** to new sibling events with their **schedule ids
          unchanged**, so `calendar_additions` stay attached (AD-30 Rule 9). New siblings copy the
          organizer, category, links and `event_posts` rows (ordinals by Rule 3) and get fresh
          slugs (AD-16); a renamed original registers its old slug as an alias.
        - **Favorites are copied to every child** (the user favorited the series).
          `[ADOPTED, user-confirmed]`
        - **Immediate-apply with a journal and undo**, the AD-30 Rule 9 convention: the journal
          records the moved schedule ids, created events, created `event_posts` rows, copied
          favorites and the group; `undoEventSplit` inverts exactly that and repoints what changed
          on a child since (new favorites, reports) to the original, deduplicated per user.
        - The group is created with `source = place_split` (AD-36 Rule 1) and kind `series`.
    5.  **Backfill: upcoming events only, deterministic first, Flash Lite for the residual, inside
        the quota.** `[ADOPTED, user-directed]`
        - Scope: events with an open (upcoming) schedule. Past events are left as they are.
        - Step 1, **no model call:** events whose schedules already carry distinct places are
          split by the Rule 2 function.
        - Step 2, **Gemini Flash Lite re-extraction** only for the residual (the place exists only
          in a schedule title). Never the non-lite model (20 requests per day).
        - Budget: Flash Lite is **500 requests per day and 20 per minute**, shared with live
          ingestion (the platform-funded `SYSTEM_GEMINI_API_KEY`, AD-10, through the AD-32
          wrapper). The backfill budget is 500 minus the day's live use, at most 20 per minute,
          and **yields to live traffic**. Live use is estimated at about 47 posts per day (2,337
          posts over 7 weeks) and is measured by `gemini-usage.sql` (Round 3 item 12, not yet
          run). Forward risk: the Phase 0+1 forecast is about 813 posts per day, above one
          500-per-day key, so the daily quota, not the database, is the first ingestion scaling
          limit.
        - The backfill creates groups, so it is gated by AD-36 Rule 10 (deduplication first).
          Going-forward ingestion is not gated.
    6.  **The duplicate key, and pairs that are never duplicates.** Two events are duplicates when
        they share the organizer account, the normalized name, a date within 2 days and the
        `place_key`. A pair is **never** a duplicate candidate when (a) both are linked to the same
        post under different ordinals (the extractor said they are distinct), or (b) both have a
        resolved `place_key` and the keys differ (sibling places of a series, Rule 1). This is a
        candidate-generation exclusion in the matcher and in the IDEA-085 sweep, not a change to
        the spine-fixed weights and thresholds (AD-30 Rule 7).
    7.  **Consequences owned elsewhere.** Notifications per (group, source post) and favorites
        (AD-36 Rules 14–15); Discovery collapse (AD-36 Rule 13); area filters (AD-39 Rule 5; with
        one place-set per event, the main-schedule join of BUG-064 is correct for place filters; the
        date leaves stay independent `EXISTS` subqueries); a PRD change for per-group
        notifications.
*   **Enforced by:** unit tests of the normalizer (place split, activity split only for
    `program-lineup`, never for `dependent-stages`, ordinal assignment, the Riot Jogja and SCH
    fixtures from production); a regression test that a re-run of one extractor output creates no
    new event; matcher tests for exclusions (a) and (b); a split/undo round trip test on a scratch
    database; a source-scan ratchet that only the split helper writes `schedules.event_id` outside
    ingestion.
*   **Considered and rejected:** a **schedule-scoped location predicate** (an event matches when any
    schedule matches, with `matchedSchedule` and best-schedule ordering per user): touches the
    highest-traffic endpoint and every event-level ranking key; withdrawn on 2026-10-19. **One event
    per schedule** always: loses "one activity on several dates" (AD-30 Rule 5 (3)) and multiplies
    favorites and notifications. **Prompt-only enforcement** of "different venue ⇒ separate": the
    extractor is not deterministic. **A nested group for a poster's agenda heading:** one group
    per event (AD-36 Rule 1); the "also in this agenda" relation stays the shared-post related
    events (AD-30 Rule 11).
*   **Deferred:** the `place_key` similarity threshold and the venue-name normalization details;
    backfill sizing, until Round 3 items 9, 11 and 12 (`events-multi-place.sql`,
    `series-candidates.sql`, `gemini-usage.sql`) are run; the split journal's exact shape and what
    `undoEventSplit` does for a child edited since; the extraction-contract change that makes the
    activity split stable.
*   **Follow-ups this AD creates (for `bmad-form-epics`):**
    1.  **IDEA-086 core** — the place normalizer, `place_key`, ordinals, the cap and the write-path
        order (Rules 1–3).
    2.  **Split and backfill** — the journal, `undoEventSplit`, the moderator action and the
        quota-bounded backfill (Rules 4–5); gated by IDEA-085 (AD-36 Rule 10).
    3.  **Matcher exclusions** (Rule 6) — ride with IDEA-085.
    4.  **PRD change** — per-group notifications, favorites at split.

---

### AD-39: Place Model — Pin, Area and Provenance Are Three Independent Facts

*   **Binds:** `schedules` (`pin_trust`, `location_source`, `location_precision`) and `events`
    (`area_status`, the event's area keys); `resolve-account-and-locations.ts` (the account-default
    fallback, BUG-065); the `Query.events` location filters, tier ordering (the POC's `tierFor`)
    and partial-match lane; the paid score's distance term; AD-14 (pin trust), AD-22 (Nearby),
    AD-24 (badge primitives), AD-34 (account types); the GraphQL `Event` type; IDEA-073 (area
    ladder), IDEA-075 (audience-area enrichment), IDEA-081 (target-area resolver), IDEA-087 (new:
    place model), BUG-063, BUG-064, BUG-065, BUG-066. Reference implementations (POC, not
    production): `apps/backend/scripts/poc-event-insight/area-resolver.ts`, `location-policy.ts`,
    `audience-areas.ts`, `partial-match.ts`.
*   **Prevents:** One nullable location read as "anywhere" by one unit and as "hidden" by another;
    an account's default location copied onto a curator's event and indistinguishable from a stated
    place (`resolve-account-and-locations.ts` does this today; 11 of the 17 production curators hold
    an arbitrary default); a wrong-country pin driving the map link, the radius filter and the
    Nearby badge (BUG-066); an area-level guess presented as a distance; a strict "in Sleman"
    filter that admits a DIY-wide event; list and detail disagreeing about how exact a place is.
*   **Rule:**
    1.  **Three independent facts, never inferred from one another.** (a) The **pin**: coordinates
        plus `pin_trust` (AD-14 Rule 4). (b) The **area**: the event's set of gazetteer area keys
        plus an explicit `area_status` (`known | unknown`); `unknown` is a value, **never null read
        as "national"**. (c) The **provenance**: `location_source`
        (`stated | geocoded_from_text | account_default | account_audience_area`, written at
        ingestion because a copied account default is otherwise indistinguishable from a stated
        place) and `location_precision` (`EXACT` only with a trusted pin, `AREA` with area keys and
        no trusted pin, `UNKNOWN`). `[ADOPTED, user-accepted]`
    2.  **Area keys come from the first source that answers, in this order**
        `[ASSUMPTION: the order is derived from the confirmed decisions, not itself confirmed]`:
        ```mermaid
        flowchart TD
          A["Event text and post"] --> B{"Stated area resolves<br/>in the gazetteer?"}
          B -->|yes| K["area keys known"]
          B -->|no| C{"Trusted pin?<br/>its administrative path"}
          C -->|yes| K
          C -->|no| D{"Roundup heading<br/>names an area?"}
          D -->|yes| K
          D -->|no| E{"Account fallback allowed?<br/>Rule 3"}
          E -->|yes| K
          E -->|no| U["area_status = unknown<br/>Rule 4"]
        ```
        Area phrases ("DIY & Jawa Tengah", "Jabodetabek") are resolved by the gazetteer first and are
        not sent to the geocoder (production: answered with a PLN office at 0.66). A stated area
        and a pin must agree (AD-14 Rule 4 (c)); on conflict the pin is `untrusted`, not the text.
    3.  **Account fallbacks are narrow and recorded.** `[ADOPTED, user-directed and user-accepted]`
        - **Curators** (`CURATOR_GUIDE`): an event with no exact location does **not** take the
          account's location (reverses today's fallback; BUG-065). The account instead carries a
          **mandatory audience target area** (a set of area keys with qualifiers); a location-less
          curator event inherits it, with `location_source = account_audience_area` and precision
          `AREA`. "Mandatory" means required to reach `CONFIRMED` as `CURATOR_GUIDE`; it is **not**
          part of the AD-34 scrape gate, so legacy curators keep being scraped and their events are
          `unknown` until an area is set. For the legacy 463 accounts (IDEA-075 bulk update) the
          area is derived in profile enrichment (bio and name through the gazetteer); where
          undecided it stays unset, not a provisional guess.
        - **Venue accounts:** the account's default location may serve as the event's place only
          when it is recorded as `location_source = account_default`, the account is a confirmed
          `ORGANIZER_VENUE_EVENT`, and the event is organizer-authored (AD-31 Rule 3). Everything
          else is partial. This narrows the POC's `mayUseAccountLocation`, which let
          never-classified accounts lend their location.
    4.  **Unknown area is shown, penalised and capped, and retried automatically.**
        `[ADOPTED, user-accepted]` An event with no stated area, no usable place text and no usable
        account fallback appears in the default Discovery tier of national events (the POC's
        tier 1) with a ranking penalty and a per-page cap (start values at story time, from Round 3
        item 9). Resolution is retried by a fixed ladder, each step at most once per event:
        re-geocode with the sub-venue qualifier stripped, then the roundup heading, then the account
        area (Rule 3). The moderator "needs location" list is a **backstop, never the mechanism**
        (moderators resolved 0 of 147 queued candidates).
    5.  **Filter and lane semantics.** `[ADOPTED]`
        - A strict "in X" area filter matches an event only when its area key is the **same as or
          inside** X. An event whose area **covers** X (a DIY-wide curator event for a Sleman user)
          goes to the **partial-match lane**; `sibling`, `other` and `unknown` never match it.
          `[ASSUMPTION]` whether a `sibling` belongs in the lane (the POC says no).
        - **Nearby stays a pin-only distance claim** (AD-22, one shared computation, trusted pins
          only). **"In your area"** is a separate, honestly named area concept (the default
          Discovery tier and a chip). Events with area-only precision appear in a radius filter's
          partial lane as "no exact location".
        - The **paid score** uses area closeness in place of the distance term when there is no
          trusted pin: same 1.0, inside 0.8, covers 0.5, sibling 0.3, other 0 (start values), and
          never calls it distance. With one place-set per event (AD-38), place filters and this
          term read one place per event.
    6.  **Exposure.** GraphQL exposes `locationPrecision: EXACT | AREA | UNKNOWN` and a localized
        `areaLabel`; **not** `detail_level` (that is the extraction's stub/full, a different
        fact). The list card shows an area badge whenever precision is not `EXACT`; the roundup
        provenance ("from <roundup title>") stays on the detail page. Labels resolve through the
        enum translation namespace (the project-context i18n rule). `[ADOPTED]`
*   **Enforced by:** `isPinTrusted` tests (AD-14); the area resolver's `relation` and `tierFor`
    tests promoted from the POC; a source-scan ratchet that the account default location is read
    for an event's place only inside the one resolver that writes `location_source`; an AST guard
    that GraphQL documents select `locationPrecision`/`areaLabel` and not `detail_level` for
    location; filter tests for same, inside, covers, sibling, other and unknown.
*   **Considered and rejected:** reading a missing area as national, or hiding unknown-area events
    (the first shows a local event to everyone, the second drops events whose posts only omit the
    place); the account's location as a curator fallback (BUG-065; arbitrary defaults); one
    `location_confidence` scalar for all three facts; `detail_level` as the precision field; the
    moderator list as the mechanism; a Nearby badge for area-only events.
*   **Deferred:** the pin-trust floor (AD-14); the gazetteer's data source, licence and coverage
    beyond the POC's sample list; the storage shape of an event's area keys (an array with a GIN
    index versus a link table); **audience-area inheritance by group members** (a child with no
    stated area taking its group's, AD-36 Rule 9; no coordinates involved, so not gated by
    BUG-068); deriving a schedule's time zone from its area key when there is no pin
    `[ASSUMPTION]`; the penalty and per-page cap values (Rule 4).
*   **Follow-ups this AD creates (for `bmad-form-epics`):**
    1.  **IDEA-087 core** — the provenance fields, `area_status`, the area-key resolver and the
        gazetteer (Rules 1–2).
    2.  **Curator audience area** — the mandatory field at `CONFIRMED`, the legacy derivation and
        the removal of the account-default fallback for curators (Rule 3; BUG-065, IDEA-075).
    3.  **Filter, lane and score semantics** (Rule 5; BUG-064, IDEA-081).
    4.  **Exposure and badge** (Rule 6) — with the UX step.

---

## Related Documents

- [Infrastructure](../../docs/infrastructure/index.md)

