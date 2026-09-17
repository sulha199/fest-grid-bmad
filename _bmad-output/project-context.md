---
project_name: 'festgrid'
baseline_commit: 198301f0757cfed0df2316ac947793691ff189e9
user_name: 'shulha'
date: '2026-08-01T00:00:00Z'
status: 'complete'
rule_count: 61
optimized_for_llm: true
sections_completed:
  - 'technology_stack'
  - 'critical_implementation_rules'
  - 'code_quality_rules'
  - 'testing_rules'
  - 'development_workflow_rules'
  - 'critical_dont_miss_rules'
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## App Name
The application name is "FestDaily" (previously "FestGrid"). All instances of "FestGrid" in legacy documentation should be treated as "FestDaily" in implementation. Do not raise issues for renaming "FestGrid" to "FestDaily".

## Reference Documents

The following documents contain detailed specifications, architectures, and design definitions for the project. Ensure you read only the required ones when it matters.

### Planning & Requirements
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`

### Architecture & Infrastructure
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- `docs/infrastructure/index.md` *(sharded — read the relevant section file under `docs/infrastructure/` only when the task touches that layer)*
- `SETUP_WALKTHROUGH.md` *(Read only if you need to read/write related to deployment/setup to save token usage)*

### UX Design (Festgrid Main App)
- `design-artifacts/UX-festgrid-run-1/DESIGN.md`
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`

### UX Design (Wizard Page)
- `design-artifacts/UX-wizard-page-run-1/DESIGN.md`
- `design-artifacts/UX-wizard-page-run-1/EXPERIENCE.md`

---

## Technology Stack & Versions

*   **Monorepo:** `pnpm` and `turbo`
*   **Language:** `TypeScript 6` (Strict mode enabled)
*   **Frontend:** `Next.js 15+`, `React 19`
*   **Backend:** Serverless on AWS (`API Gateway`, `Lambda`, `SQS`, `EventBridge`)
*   **Database:** `Supabase` (PostgreSQL) with `Drizzle ORM`
*   **Analytics & User Interactions:** `PostHog` (for product analytics, session replay, and feature flags)
*   **Push Notifications:** `Firebase Cloud Messaging (FCM)`
*   **Shared Code:** Workspace packages (`@festgrid/shared-types`, `@festgrid/typescript-config`, `@festgrid/eslint-config`, `@festgrid/ui`, `@festgrid/analytics`)
*   **Linting:** `ESLint` extending global flat configurations in `packages/eslint-config`
*   **UI Component Library:** `Shadcn/ui` (built on Radix UI and Tailwind CSS) - all reusable UI components must be placed in the `@festgrid/ui` package.

## Critical Implementation Rules

### API & Data
- **API Style (GraphQL):** The backend API **must** use GraphQL for all client-server data fetching.
- **Data Schemas:** The Drizzle ORM schema, defined in TypeScript, and the PRD's TypeScript interfaces are the single source of truth for data structures.
- **End-to-End Type Safety:** Use `GraphQL Code Generator` to generate TypeScript types from the GraphQL schema, ensuring client and server are always in sync.
- **Runtime Schema Validation:** All data entering the system from external sources (APIs, scrapers) **must** be validated at the point of entry with `Zod` (frontend) or `AJV` (backend).
- **Unique Identifiers (Database UUIDs & Slugs):** All primary entity identifier fields (`id: string`) **must** be generated automatically as UUIDs by the PostgreSQL database (e.g. via Drizzle ORM). However, for `EventInfo` and `Schedule`, a unique `slug: string` property **must** be present, supporting manual/custom modification post-MVP for premium users (PRD §8.2, not yet built).
  - **`Schedule.slug`**, and any `EventInfo` with no resolvable source-platform post, use the legacy generator: `randomBytes(6).toString('hex')` (`packages/database/schema.ts` — this, not Nano ID, has always been the shipped mechanism; the PRD's Nano ID description is stale).
  - **`EventInfo.slug` for platform-sourced events** (added 2026-09-15, see Architecture Spine AD-16) is `{platformSlug}_{postType}_{platformPostId}` (e.g. `ig_p_Cx9uWttkSN`) — built exclusively from `packages/domain/src/scraper/platform-registry.ts`'s `getPlatformSlug()`/`getPlatformByCode()`. **Any code that needs a platform's short code (`instagram→ig`, `twitter→x`) must import these functions — never re-declare a local platform-to-code mapping.** This is the same registry already consumed by the social-media-account route (`apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx`); a second mapping would silently drift from it.
- **Drizzle ORM Types:** When defining database schemas, **must** utilize PostgreSQL-specific data types directly imported from `drizzle-orm/pg-core` (e.g. `{ pgTable, uuid, text, integer, timestamp }`). Avoid using generic defaults when specific types are required (e.g. use `uuid` instead of `serial` for identifiers).

### Database & Performance
- **Database Environments:** Local development will use a local PostgreSQL database (configured via `DATABASE_URL` in `packages/database/.env`), while Supabase is strictly used as the cloud database for production environments. All migrations and Drizzle queries must work seamlessly across both.
- **Connection Pooling (added 2026-08-27, incident fix):** Production `DATABASE_URL` **must** use Supabase's transaction-mode pooler (port `6543`) with `prepare: false` on the `postgres()` client (`apps/backend/src/db/client.ts`) — never the session-mode pooler (port `5432`), which caps total concurrent Lambda connections at a low `pool_size` and gets exhausted by routine post-login query bursts. See `docs/infrastructure/3-database.md` and `docs/infrastructure/incidents/2026-08-27-connection-pool-exhaustion.md`.
- **Database Access (Drizzle ORM):** All database access **must** be handled through the Drizzle ORM. Do not use the Supabase client for data queries.
- **Optimized DB Queries:** To prevent over-fetching from the database, GraphQL resolvers running in AWS Lambda **must** dynamically build Drizzle queries to select only the specific fields requested in the GraphQL operation. This **must** be implemented using a generic, strictly-typed function named `buildOptimizedDrizzleSelect` that translates GraphQL AST into an optimized Drizzle `select` query, ensuring this optimization is reused whenever reading data.
- **Database Indexing for Performance:** To ensure fast query performance for search and filtering, database columns that are frequently used in `WHERE` clauses **must** be indexed. This specifically includes columns for `eventName`, `performers`, `location`, `types`, `categories`, and `hashtags` (added 2026-08-28) — the latter uses a **GIN index**, not a plain btree, since hashtag search (Section 3.1/3.7) is array-containment on an exact value rather than a substring `ILIKE`.
- **`Query.events` (`getEvents`) is the highest-traffic endpoint in the system** — the shared backing query for Discovery, Feed, Favorites, and every calendar view. Any change to it or `Event`'s field resolvers **must** be evaluated for per-row cost, since it multiplies across every consumer at once. A known N+1 (computed fields like `isFavorited`/`favoriteCount`/`schedules` each issuing their own per-row DB round trip) has a decided-but-not-yet-built fix — extend `buildOptimizedDrizzleSelect` with a `virtualFields` map. **See Architecture Spine AD-17 for the full mechanism before touching this resolver.** Do not add a new unconditional secondary query (e.g. `totalCount`) or a new per-row field resolver here — default to batched/joined instead.
- **`Query.eventBySlug` (the event-detail page) is the second-highest-traffic endpoint.** AD-16 restructures `EventDetailWrapper.tsx` so primary content is never gated on the Instagram oEmbed round trip (`instagramEmbed` fires as an independent parallel React Query hook) — do not re-nest it back into `getEventBySlug` or introduce a shared awaited gate. New fields should default to the same optimized flat select as `Query.events`, not a new per-field resolver. **See Architecture Spine AD-16/AD-17** for the full mechanism, including the `Schedule.isAddedToCalendar` N+1 fix (BUG-033) and the required `favorites (eventId)` partial index (BUG-034).
- **Soft-Delete Convention:** Tables that support removal **must** use a `deletedAt: timestamp | null` column, default every query to `deletedAt IS NULL`, and index hot lookup columns with a **partial index** scoped to that condition (never a bare index on `deletedAt`). Soft-delete mutations take an explicit `action: SoftDeleteAction!` (`DELETE`/`RESTORE`) argument. **See Architecture Spine AD-8** for the exact table list/exclusions, current per-resolver (not yet centralized) enforcement state, and the `drizzle-kit`-drops-the-WHERE-clause workaround.

### Security
- **Credential Management:** Important credentials (e.g. `DATABASE_URL`, API keys) **must** be stored securely in `.env` files and never be hardcoded or have fallback default values in code.
- **User API Key Encryption:** All user-provided API keys (BYOK) **must** be stored encrypted at rest in the database. The application **must** use a dedicated, secure service like AWS KMS for managing encryption keys. Keys will be decrypted in memory by a trusted service (e.g., an AWS Lambda function with specific IAM permissions) only when needed to make an external API call, and never logged or stored in plaintext.
- **Resilient Processing Pipeline:** The backend processing pipeline **must** use Amazon SQS queues (`ScrapingQueue`, `AIProcessingQueue`, `DataIngestionQueue`) to decouple services and manage flow between AWS Lambda functions, as defined in the infrastructure architecture.
- **Prevent GraphQL Abuse:** The GraphQL server **must** be configured with query depth and complexity limits to prevent DoS attacks.
- **Force Logout on Auth Failure** (added 2026-08-28, `bmad-quick-dev`): A GraphQL resolver's `requireAuth()` failure throws with `extensions.code: 'UNAUTHENTICATED'`, but because this happens inside resolver execution (not at HTTP-context creation) and the Yoga server has no custom `formatError`, it returns as **HTTP 200 with a GraphQL `errors` array** — never a 401 status. Nothing HTTP-status-based will ever catch this. The shared `graphqlClient` (`apps/web/src/lib/graphql-client.ts`) **must** therefore inspect every response via `responseMiddleware`, and when it sees a `ClientError` with `extensions.code === 'UNAUTHENTICATED'`, force a client-side logout (`getSupabaseBrowserClient().auth.signOut()`) rather than leaving the UI showing a stale logged-in state while requests silently fail auth. This relies on the existing Supabase `onAuthStateChange` listener in `auth-session-provider.tsx` to cascade the resulting session-cleared state app-wide — no separate state-wiring needed, just detecting the failure and calling `signOut()` from anywhere. Guard this logic to client-only (the same client/server split already used via `isServer` in that file) and against duplicate triggers when multiple requests fail in the same burst.

### UI Patterns & UX Invariants
- **Loaders:** The application must strictly differentiate between blocking and non-blocking asynchronous operations. 
  - **Blocking:** For critical mutations (e.g., submitting a report, saving a location), a full-screen, semi-transparent overlay with a spinner must be used to prevent further interaction.
  - **Non-Blocking (Initial Load):** Use Skeleton screens matching the layout of the incoming data to reduce Cumulative Layout Shift (CLS) and improve perceived performance.
  - **Keep Skeletons in Sync With Their Real Component** (added 2026-08-28, `bmad-quick-dev`): When a component's own visual sizing/styling changes (e.g. an image's aspect-ratio treatment, a card's dimensions), every skeleton/loading-state or preview/peek component that mirrors its shape **must** be updated to match — not just the initial pass, but any later restructure too. A skeleton that silently drifts from the real component it stands in for reintroduces the exact CLS/layout-shift problem skeletons exist to prevent, just delayed until the swap. Reference: `EventImage.tsx`'s aspect-ratio fix (fixed `aspect-video` → auto-height capped at `max-h-[70vh]`) initially left `EventDetailView.tsx`'s own `loading` skeleton (a stale fixed `h-64` box) and `event-preview-card.tsx`'s carousel peek skeleton (a stale `aspect-video` + `object-cover` box, with a comment claiming exact parity that was no longer true) both out of sync until a dedicated follow-up pass caught and fixed both.
  - **Non-Blocking (Infinite Scroll):** Use a localized spinner at the bottom of the list when fetching subsequent pages to avoid disrupting the user's reading flow.
- **Route-Level Suspense Fallback:** (added 2026-08-07, `bmad-correct-course`) Every route-page's Server Component `page.tsx` **must** supply a `fallback` to its top-level `<Suspense>` boundary (the boundary already exists project-wide per Story 1.9's Server/Client split for `useSearchParams`-consuming content) — never leave it fallback-less. The fallback **must** be the shared `<RouteLoader />` component (`packages/ui/src/core/route-loader.tsx`, Story 0.26): a container-relative (fills its parent, never viewport-fixed — required both for full-page routes under the persistent `AppShellWrapper` nav rail, and for the intercepted modal route's bounded `DialogContent`), animated ("beating") rendering of the app's `LogoMark` (the icon-only 2x2 grid extracted from `Logo.tsx`, no "FestGrid" text). This is a distinct loading layer from the "Non-Blocking (Initial Load)" skeleton rule above — `RouteLoader` covers the route shell boundary itself, before any content component mounts; skeletons remain for in-page data fetching once mounted. Reference implementation: Story 0.26.
  - **No `loading.tsx` on a route only ever reached via in-app navigation** (added 2026-08-16, corrected 2026-08-17, `bmad-correct-course`, Story 1.6): if a route performs its own server-side data fetch inside `generateMetadata` (e.g. for a per-item dynamic title), Next.js shows a segment's `loading.tsx`/`RouteLoader` fallback on *every* navigation to a new dynamic-segment value — including an in-app transition from an already-mounted client component, not just a cold/direct-URL open, since the framework's route-segment Suspense model can't distinguish the two on its own. **`router.prefetch()` on a known next target does NOT fix this for a route that has its own `loading.tsx` file** — Next.js only prefetches "down to and including `loading.js`" for a dynamic segment, never the actual dynamic content behind that boundary, so the `generateMetadata` fetch stays cold regardless of prefetching. For a route reachable via **both** a cold/direct-URL open and in-app navigation (e.g. the full-page `events/[slug]/page.tsx`, which has no sibling `loading.tsx`, only an inline `<Suspense fallback={<RouteLoader/>}>`), `router.prefetch()` on the known next/previous target *does* warm the full dynamic payload and is worth doing. For an **intercepted modal route** (e.g. `@modal/(.)events/[slug]/page.tsx`) that can *only* ever be reached via an in-app client-side transition — interception never applies to a direct URL, typed address, or refresh, which always resolve the non-modal route instead — do not give it its own `loading.tsx` at all: that file could never legitimately serve the cold-open case anyway, and removing it lets Next.js's default behavior (keep the current content mounted and interactive during the transition, swap in once ready) take over instead of flashing a fallback. Reference implementation: Story 1.6's `EventDetailWrapper.tsx` (prefetches `nav.previous`/`nav.next` targets, benefiting the full-page route) and the removal of `@modal/(.)events/[slug]/loading.tsx`. Confirmed forward-applicable to Story 2.2 (Favorites) and Story 2.6 (Calendar), both future consumers of the same navigation hook and likely the same modal-route pattern.
- **List Navigation:** All long lists (Discovery, Favorites, Subscriptions, etc.) **must** implement infinite scrolling (autoscroll) rather than traditional pagination controls.
- **Page Containers & Grids:** Every page **must** use the shared `PageContainer` primitive (`packages/ui/src/core/page-container.tsx`) instead of a page-local `max-w-* mx-auto` wrapper, and every card grid **must** use `GridContainer` (`packages/ui/src/core/grid-container.tsx`) instead of a hand-written `grid-cols-*` string — both replace copy-pasted/drifted duplication found across 13+ files before they existed. `PageContainer` takes a `fullWidth?: boolean` prop (default `true`, for card-grid/list pages that may be embedded or squeezed by a host); `GridContainer` takes `baseCols`/`colsStep` props (standard grid: `1`/`1`; masonry: `2`/`1`). **See Story 0.30 (PageContainer) and Story 0.31 (GridContainer)** for the exact breakpoint values and column-count formula.
- **Page Headers:** Every page's title row **must** use the shared `PageHeader` primitive (`packages/ui/src/core/page-header.tsx`) instead of a page-local `<h1>`+button row, found duplicated with drifting styles across 18 files before this existed. **See Story 0.32** for the exact prop shape (`action`, `description`).
- **Context-Aware Detail Views:** When opening an item's detail view from any list, the detail view must provide "Next" and "Previous" navigation buttons. This navigation must inherit the context of the list it was opened from (search query, filters, sort). If a user navigates to the end of the currently loaded page of data, the system must seamlessly fetch the next page of results in the background to maintain uninterrupted navigation. (This requirement may be bypassed if the detail view is accessed via a direct deep-link without prior list context).
- **Filter Apply-Timing Convention (AD-18):** Filters apply immediately on change — no user-facing "Apply" action. Discrete controls commit on the same interaction; continuous/free-text controls debounce via the shared `useDebounce` hook, never a second explicit commit action. Any list/pagination consumer of a filter's committed value **must** own its pagination via `useListPaginationController`, not a hand-rolled cursor `useState` (the structural fix for the append-instead-of-reload bug class, BUG-019). **See Architecture Spine AD-18** for the full contract.
- **Dynamic Page Title & Meta Tags:** Every route in `apps/web` **must** set its browser tab title and meta description via Next.js App Router's `generateMetadata` — never a static `metadata` export, and never a client-side `document.title` mutation (the latter fights the framework's own per-segment metadata resolution and breaks SSR/SEO). Title/description strings **must** be sourced through next-intl's server-side `getTranslations()` (not the client `useTranslations` hook) from a dedicated `Metadata` i18n namespace, and built via the shared `apps/web/src/lib/metadata.ts` helper so every route's `Metadata` object (including baseline `og:title`/`og:description`) has a consistent shape. If a route's default export must be a Client Component, split it into a Server Component `page.tsx` (holding `generateMetadata`) that renders the client logic from a colocated file, rather than exporting metadata from a `"use client"` file (not supported). Reference implementation: Story 1.9 (`_bmad-output/implementation-artifacts/1-9-dynamic-browser-title-and-meta-tags.md`).

### State Management Architecture
To avoid monolithic global stores and ensure strict end-to-end typing, the application state **must** be divided into three distinct scopes:
- **Server State (Async & Cached):** Use `@tanstack/react-query` combined with `graphql-request`. All operations must rely on TypeScript types auto-generated by `GraphQL Code Generator` to ensure end-to-end type safety. This manages all async data fetching, caching, and optimistic UI updates.
- **URL State (Shareable & SSR-Friendly):** Use `nuqs` for managing all URL search parameters (e.g., active filters, search queries, location radius). This ensures URL state is strictly parsed and type-safe (e.g., parsing a string into an enum array), preventing runtime errors.
  - **Explicit Query Parameter Validation:** Never use the raw size or generic presence of URL query parameters (e.g., `searchParams.size > 0` or `Object.keys(query).length > 0`) to infer application state (such as determining if a user has active filters or if a specific feature context exists). The URL query string is a shared global namespace where analytics trackers (`?utm_...`), framework internals, or marketing tools will inevitably inject arbitrary keys. You **must** explicitly validate against the known, specific keys your feature owns (e.g., `searchParams.has('q') || searchParams.has('types')`) before altering component behavior or triggering conditional data fetches.
- **Client Global State (Ephemeral UI):** Use `zustand` strictly for ephemeral, true global UI state that needs to cross component boundaries without prop drilling (e.g., the manual post extraction multi-tab selection state). All Zustand stores **must** be interface-driven with strictly defined states and actions.

### General Architecture
- **TypeScript Strict Mode:** All code **must** be compliant with strict TypeScript.
- **Path Aliases:** Use monorepo path aliases (e.g., `@festgrid/shared-types`) for all internal package imports.
- **Adapter Pattern:** Use an adapter pattern for all external AI services (e.g., Gemini) to ensure modularity.
- **Core Principle:** Internationalization is a foundational requirement, not an afterthought. All user-facing components and content must be developed with i18n in mind from the start.
- **Framework:** Use the `next-intl` library for all i18n handling in the Next.js frontend.
- **Locale Management:** Locales (e.g., `en`, `id`) will be managed via a dedicated `locales` directory, with separate JSON files for each language.
- **Component Design:** All UI components must be designed to accommodate varying text lengths and support both LTR and RTL layouts to ensure future scalability to other languages.
- **Locale-Sensitive Data Rendering:** Data that varies in display by locale **must never** be rendered raw (i.e. directly interpolated into JSX without a formatting/translation step). This applies to:
  - **Enums:** Enum values (e.g. `EventCategory`, `EventType`) **must** resolve through a dedicated `next-intl` translation namespace keyed by the exact enum member name (e.g. `locales/en.json` → `"EventCategory": { "MUSIC": "Music", ... }`), resolved via `useTranslations()` at render time.
  - **Dates & DateTimes:** **must** be formatted with `Intl.DateTimeFormat` (or a `next-intl` date formatter) using the active locale — see `EventCard.tsx`'s `formattedDate` for the pattern to follow. Never render a raw ISO string or apply a fixed, non-locale-aware format.
  - **Numbers stored as numeric types:** any value stored as `number`/`decimal`/`integer` (currency amounts, counts, percentages, etc.) **must** be formatted with `Intl.NumberFormat` using the active locale (with `style: 'currency'` and the correct currency code where applicable) — never interpolated as a raw number. This does **not** apply to fields that are intentionally free-form text at the source (e.g. `Schedule.ticketPrice`, stored and scraped as text like `"IDR 150000"` or `"Free"`) — those remain unchanged and are out of scope for this rule.
  - **Scoped locale/timezone context:** `packages/ui` components that need the active locale and/or IANA timezone but must stay framework-agnostic (no direct `next-intl` dependency, per the Adapter/decoupling principle below) **must** read them via `useScopedLocale()`/`useScopedTimezone()` from `packages/ui/src/hooks/useScopedLocale.tsx` — never a hardcoded default or a required prop. Named distinctly from `next-intl`'s own `useLocale`/`useTimeZone` (different semantics, no `NextIntlClientProvider` dependency) so the two are never confused in an `apps/web` file that imports both.
    - Both hooks resolve to the nearest ancestor `ScopedLocaleProvider`'s value. `useScopedLocale()` falls back to `'en-US'` if no provider is present; `useScopedTimezone()` falls back to `undefined` (letting `Intl` use the runtime's default timezone).
    - Providers may be nested. A nested provider overrides `locale` unconditionally, but a nested provider that omits `timezone` **inherits** the outer provider's timezone rather than resetting it to "unset" — only an explicitly-passed `timezone` overrides the ambient value.
    - A component's own `locale`/`timezone` props (if it exposes them, e.g. `EventCard`), when explicitly passed (including guarding against an accidental empty string), always take precedence over the context value.
    - The app root (`apps/web/src/app/[locale]/layout.tsx`) wraps `<AppShell>` in `<ScopedLocaleProvider locale={...}>`, mapping the route's bare locale code (`en`/`id`) to a region-qualified BCP-47 tag (`en-US`/`id-ID`) via `localeIntlTagMap` rather than passing the bare code straight to `Intl`. No app-wide `timezone` is sourced yet — `LocationDetails.timezone` on the event's location is a candidate per-event source for a future pass, not wired up here.
    - Components consuming a possibly-invalid IANA timezone/locale string (e.g. scraped/CMS-sourced data, not a trusted enum) **must** degrade gracefully instead of letting `Intl` throw — see `formatEventDate` in `EventCard.tsx` for the retry-without-timezone-then-without-locale pattern.

### Code Quality & Style Rules

- **Code Organization (Domain vs UI):** Pure, framework-agnostic business logic **must** live in a dedicated `packages/domain` package. Within this package, logic should be organized into sub-folders by domain area (e.g., `/events`, `/users`, `/subscriptions`). 
  - **CRITICAL RESTRICTION:** Absolutely NO React code (including hooks, UI state, or React imports) is allowed in `packages/domain`. This package may be imported by Node/Backend stacks (e.g., AWS Lambda), and importing React will bloat or break backend bundles.
  - Any reusable React hooks (e.g., `useInfiniteScroll`, `useListContext`) or stateful UI logic must be placed inside `packages/ui/src/hooks/` or co-located with their UI components.
  - **CRITICAL RESTRICTION:** Logic placed in `packages/domain` must be pure and dependency-free of any DB/ORM-specific modules (e.g. `drizzle-orm` table/column types, a DB client/schema) or other Node-runtime-only dependencies (`fs`, `net`, `dotenv`, a raw DB driver, etc.) — `packages/domain` is only guaranteed Node/backend-safe (see above), not frontend-safe, and an undocumented DB/Node dependency risks bloating or breaking a future frontend import. If a piece of logic is inherently DB/ORM-coupled, it does not belong in `packages/domain` — put it in `apps/backend` or an existing backend-only package instead (e.g. `packages/graphql-select`, which holds Drizzle-query-building utilities like `buildOptimizedDrizzleSelect`).
  - When the portable logic/types being placed in `packages/domain` represent a generic, cross-entity mechanism (e.g. a query DSL, a pagination shape, a validation pattern) rather than logic specific to one domain entity, organize them into a generic subfolder (e.g. `packages/domain/src/query/`) instead of nesting them under a single entity's folder (e.g. `/events/`), so the mechanism reads as reusable across other entities (e.g. reports, subscriptions) rather than events-specific.
- **UI Components & Scalability:** All reusable UI components (e.g., Shadcn/ui components, custom generic components) **must** be created in a dedicated `packages/ui` workspace package. To ensure scalability and ease of future migration (if we need to break the UI into separate packages), components **must** be strictly organized by role within `packages/ui/src/`:
  - **Core Primitives:** Place generic, domain-agnostic components (e.g., Shadcn `Button`, `Card`, generic `MultiSelect`) in `packages/ui/src/core/`.
  - **Domain Features:** Place domain-specific reusable components in `packages/ui/src/features/<domain>/` (e.g., `packages/ui/src/features/events/EventCard.tsx`, `packages/ui/src/features/events/FilterHub.tsx`, `packages/ui/src/features/auth/GoogleLoginButton.tsx`).
- **Shared Linting & TypeScript Base Configurations:** All workspace packages **must** extend the global linting flat configurations from `@festgrid/eslint-config` (inside `packages/eslint-config`) and TypeScript configurations from `@festgrid/typescript-config` (inside `packages/typescript-config`).

### Testing Rules

- **Unit Test Requirement:** All logic exported from `packages/domain` **must** have 100% unit test coverage. This is the *only* place where unit tests should be written.
- **Testing Philosophy:** For all other code (`apps/*`, etc.), employ a "testing trophy" approach. Prioritize integration tests with `Vitest` and `msw`, and use E2E tests (`Playwright`) for critical user flows only.
- **Definition of Done for Testing:** A feature is considered tested when:
    a. The primary E2E "happy path" test is passing.
    b. At least one integration test for the "unhappy path" (e.g., error handling, validation failure) exists for any new logic.
    c. The pull request does not decrease the overall project test coverage percentage.

### Development Workflow Rules

- **Pull Request Template:** The PR template **must** include a mandatory checklist item: "[ ] I have confirmed that any new complex business logic has been moved to the `packages/domain` package and is 100% unit tested."

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented.
- When in doubt, ask for clarification.

**For Humans:**

- Keep this file lean and focused on rules AI agents might miss.
- Update when the technology stack or core patterns change.
- Review quarterly to remove rules that have become obvious or obsolete.

_Last Updated: 2026-09-17T00:00:00Z_
