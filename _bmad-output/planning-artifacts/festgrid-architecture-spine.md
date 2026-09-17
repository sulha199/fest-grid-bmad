---
title: "Architecture Spine: FestDaily"
status: "draft"
created: "2026-07-20T09:34:00Z"
updated: "2026-09-17T00:00:00Z"
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
          `apps/web/src/features/events/mapper.test.ts`; GraphQL exposure — the three
          `apps/web` `.graphql.test.ts` AST guard tests from Story 0.i7d
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
        - **Enforced by:** `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` AC1
          (`flex-fill`/`fixed-square` className-shape assertions) — the primitive's own shape half of the
          proof (Story 1.i1a; ratchet = Story 1.i1z) — plus the two adopting consumers' own tests:
          `EventCard.test.tsx`'s `renders a blank, flex-fill fallback on masonry default (prominentPoster=false, top_row_default)`
          and `WeeklyCalendarView.test.tsx`'s `renders the thumbnail image and its favorite badge when imageUrl is present (AC1)`.
    2.  **Fallback is reserved-blank, not a placeholder.** A missing/errored image renders zero content in
        the reserved slot — no icon, no filler, no "No image available" text — keeping the exact AC1
        footprint. Only the large favorite badge (rule 3) renders, centered in the slot's place.
        - **Enforced by:** the same test file's AC3 suite (blank-reserved assertions + `onError` switch),
          plus the two consumers' reserved-blank tests: `EventCard.test.tsx`'s
          `renders a blank, flex-fill fallback on masonry default (prominentPoster=false, top_row_default)` and
          `renders a blank, correctly-sized fallback on masonry with prominentPoster=true`, and
          `WeeklyCalendarView.test.tsx`'s `renders the reserved-blank fallback with a large centered favorite badge when imageUrl is absent (AC2)`
          and `switches to the reserved-blank fallback when the image onError fires (AC2)`.
    3.  **One shared icon-scale token family, CSS-custom-property driven.** Both badge scales derive their
        icon size from a single exported ratio family keyed off the date box's `text-xs` (12px) via
        `calc(var(--event-card-badge-font-size,0.75rem) * <ratio>)` — the mechanism that works because the
        date box and badge are DOM *siblings* (plain `em` inheritance only flows down a subtree). `large`
        is calibrated to DESIGN.md's explicit 24px target (ratio 2); `default` is a distinct smaller ratio
        (5/3 → 20px, matching EventCard's current corner heart so 1.i1b reads as a proportion fix). No
        consumer computes pixels; nothing hardcodes a fixed pixel `w-*`/`h-*` class on either variant.
        - **Enforced by:** the same test file's AC2 suite (ratio values + distinct computed sizes).
    4.  **The favorite badge is always one live control, at a real tap target.** Both scales render as a
        single focusable favorite-toggle `<button>` sharing one accessible name/role — never a decorative
        label, never an extra independent focus stop. The `large` fallback variant keeps a `min-h-11
        min-w-11` (≥44px) tap target per `components.nav.item_hit_area`'s convention and
        EXPERIENCE.md's reachable-control rule.
        - **Enforced by:** the same test file's AC4 suite (single-focusable + min hit area).

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

### AD-20: Temporal Filter (Happening Now / Upcoming) — Clock-Time-Precise, New DSL Extension Point

*   **Binds:** IDEA-019's card-view temporal filter (`EXPERIENCE.md` § "Temporal Filter: Happening
    Now / Upcoming / All"), `EventFilterInput` (`apps/backend/src/schema/events.graphql`),
    `buildEventsQueryCondition.ts` (client-invoked per `home-content.tsx:178-183`), and
    `packages/graphql-select/drizzle-where.ts`'s field/operator dispatch.
*   **Prevents:** Implementing this filter as a date-only condition on the existing AD-1
    `scheduleDateRange.overlaps` mechanism — verified that mechanism only compares Postgres `date`
    columns (`schedules.eventStartDate`/`eventEndDate`), with no time-of-day component at all,
    which would make an event starting later today (badge: "In N hours", per `formatEventStatus`)
    incorrectly match a date-only "Happening now" filter, visibly contradicting that same card's
    own badge. Also prevents this filter becoming a second, independent reimplementation of
    started/ended semantics that could silently diverge from `formatEventStatus`'s (the badge's)
    existing JS definition on an edge case — missing `startTime`/`endTime`, `endDate` defaulting to
    `startDate`.
*   **Rule:**
    1.  **New `EventFilterInput.temporalFilter: TemporalFilter` enum** (`HAPPENING_NOW` |
        `UPCOMING`), absent/null = "All" — matching every other optional `FilterHub` facet's
        convention of "absent means unrestricted."
    2.  **`buildEventsQueryCondition.ts` translates it into a new DSL condition whose value is a
        client-resolved literal ISO instant** (`now.toISOString()`) — **not** a live SQL `NOW()` —
        consistent with every other date/time value in this DSL already being resolved once
        client-side before the query is sent. `buildDefaultEventVisibilityConditions` (Story 2.7)
        already establishes the identical resolve-once-in-JS-then-embed-as-literal pattern,
        server-side instead of client-side, for the past-events threshold.
    3.  **`drizzle-where.ts` gains a new field/operator case,** extending the same
        fieldMap-descriptor-to-`EXISTS`-subquery pattern `scheduleDateRange.overlaps` already uses,
        whose descriptor combines `eventStartDate`+`eventStartTime` (and the end-date/time
        equivalents) into a comparable timestamp expression inside an `EXISTS` subquery against
        `schedules`, compared against the literal instant from Rule 2.
    4.  **The started/ended boundary-case handling in this new SQL expression must exactly mirror
        `formatEventStatus`'s existing documented rules** (`format-event-date.ts`) — since JS and
        SQL can't literally share code across this boundary, this is enforced via a single shared
        boundary-case fixture (e.g. `packages/domain/src/events/__fixtures__/started-ended-cases.ts`
        — exact date/time/now inputs and their expected started/ended outcome, covering the
        documented edge cases: missing `startTime`, missing `endTime`, `endDate` absent/falling
        back to `startDate`) that **both** `formatEventStatus`'s unit tests and the new SQL
        condition's integration tests import and assert against — not two independently-written
        "matching" test suites, which two engineers working from the same prose description could
        still drift on without ever comparing notes.
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


## Related Documents

- [Infrastructure](../../docs/infrastructure/index.md)

