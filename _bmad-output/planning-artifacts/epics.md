---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics"]
inputDocuments: [
  "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md",
  "_bmad-output/planning-artifacts/festgrid-architecture-spine.md",
  "design-artifacts/UX-festgrid-run-1/DESIGN.md",
  "design-artifacts/UX-festgrid-run-1/EXPERIENCE.md",
  "design-artifacts/UX-wizard-page-run-1/DESIGN.md",
  "design-artifacts/UX-wizard-page-run-1/EXPERIENCE.md",
  "_bmad-output/project-context.md",
  "docs/infrastructure/index.md"
]
---
# festgrid - Epic Breakdown

## Overview
This document provides the complete epic and story breakdown for festgrid, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements
- **FR1:** Display a curated selection of local events.
- **FR2:** Allow users to search by event-name, performers, and location name with partial matching.
- **FR3:** Allow users to filter events by type and category.
- **FR4:** Default event discovery page to show only ongoing and upcoming events.
- **FR5:** Users can "favorite" events.
- **FR6:** A dedicated page will show all favorited events.
- **FR7:** A dedicated page will show all events the user has added to their calendar.
- **FR8:** Users can save multiple named locations (e.g., "Home", "Work").
- **FR9:** A location can be set by using the user's current location or by picking a point on a map.
- **FR10:** Saved locations can be used to find "nearby events" within a user-defined radius (1km-50km).
- **FR11:** When adding an event to a calendar, users can select which specific schedules to add.
- **FR12:** One-way calendar integration (app to calendar) for MVP.
- **FR13:** Consolidate all relevant event information in one place.
- **FR14:** All event discovery pages will by default only show ongoing and upcoming events.
- **FR15:** Events in a user's personal lists ('favorited' or 'added to calendar') will be hidden `N` days after they have passed. `N` is configurable.
- **FR16:** "Favorited" and "Added to Calendar" events will have a distinct visual treatment on the calendar.
- **FR17:** The calendar will have toggles to show/hide all "favorited" events and all "added" events.
- **FR18:** Users can subscribe to social media accounts by providing their own Gemini API Key (BYOK).
- **FR19:** For accounts subscribed to by multiple users, the system will intelligently utilize any valid API key from contributing users.
- **FR20:** Users can optionally set a "Default Location" when subscribing to an account.
- **FR21:** If the AI agent does not find an explicit location in a post, it will use the default location.
- **FR22:** Users will receive email notifications if `X` of their subscribed posts have been queued for `Y` days due to Gemini API quota exhaustion.
- **FR23:** A dedicated section within the user menu will display the real-time queue status of posts pending extraction.
- **FR24:** Implement a quota management algorithm for API keys (Tier 1: User-Specific, Tier 2: Shared with round-robin).
- **FR25:** Events extracted from a user's social media accounts will be displayed to the user.
- **FR26:** Users can view subscribed events in a calendar-view (default) or a card-view.
- **FR27:** Each schedule within an `EventInfo` object will be displayed as a separate, clickable item in the calendar.
- **FR28:** Calendar item title will be `eventName` if `isMainSchedule` is true, otherwise `eventName - schedule.title`.
- **FR29:** Clicking on any schedule item in the calendar will open a detail view for the entire event.
- **FR30:** A free-text search bar will allow users to search events from their subscribed accounts by event name, performers, and location name.
- **FR31:** Users can filter subscribed events by type, category, and the specific social media account source.
- **FR32:** Event data processed from subscribed accounts will be used to generate personalized event reminders.
- **FR33:** Infer timezone from location, or user's timezone, or ask for clarification.
- **FR34:** API keys are validated reactively.
- **FR35:** Track consecutive invalid API key attempts and send email notification after `N` attempts.
- **FR36:** For shared accounts, if one user's API key becomes invalid, use another user's key.
- **FR37:** Users with an invalid API key will cease to receive push notifications for events from accounts relying on their specific key.
- **FR38:** Implement a manual event data correction system with typed inputs.
- **FR39:** Perform data inconsistency checks on corrections.
- **FR40:** Optional AI-assisted correction for users with a BYOK key.
- **FR41:** A 'Report' button will be available for all events.
- **FR42:** Unauthenticated users will need to log in to report.
- **FR43:** Users can request event deletion with a reason.
- **FR44:** If 3 users report an event as cancelled in 7 days, it is soft-deleted.
- **FR45:** A moderator can restore a cancelled event.
- **FR46:** Reports of dangerous events will notify an admin/moderator immediately.
- **FR47:** If a moderator marks an event as safe, subsequent reports from the same user for that event will be ignored for that user.
- **FR48:** Users can report an event for personal reasons, hiding it only for themselves.
- **FR49:** Authenticated users will have a 'Reports' page.
- **FR50:** Moderators will have a 'Moderator Items' page.
- **FR51:** Manual post selection for event extraction.
- **FR52:** A new screen will show the 20 most recent posts from each subscribed account in tabs.
- **FR53:** Lazy loading of posts in tabs.
- **FR54:** Users can select multiple posts to process.
- **FR55:** Selection state is preserved between tabs.
- **FR56:** Processed posts will be visually disabled.
- **FR57:** A summary bar will display the number of selected posts against the user's remaining API quota.
- **FR58:** Prevent users from extracting more posts than their quota allows.
- **FR59:** A warning icon will be displayed on inactive accounts.
- **FR60:** The manual post selection screen is integrated into the getting started wizard.
- **FR61:** When a new subscription is added, its tab will be automatically activated.
- **FR62:** Users can access the manual post selection from the user menu.
- **FR63:** Free signup for the web application.
- **FR64:** Users can optionally integrate their own BYOK Gemini API key.
- **FR65:** Provide guides for setting up BYOK.

### NonFunctional Requirements
- **NFR1:** Event discovery page should load in under 2 seconds on a standard 4G connection.
- **NFR2:** Key interactive elements should be interactive within 1.5 seconds.
- **NFR3:** 95% of API calls should complete in under 500ms.
- **NFR4:** The system should be able to handle 100 concurrent users with a response time degradation of no more than 15%.
- **NFR5:** The event ingestion pipeline should be able to process 100 events per hour.
- **NFR6:** The architecture should be designed to be horizontally scalable.
- **NFR7:** The service should have 99.9% uptime.
- **NFR8:** Server-side error rate should be below 0.5%.
- **NFR9:** At least 90% of users should be able to add an event to their calendar in their first session without assistance.
- **NFR10:** Target a SUS score of 75 or higher.
- **NFR11:** Use an Adapter pattern for AI services.
- **NFR12:** All API keys must be stored securely in environment variables.
- **NFR13:** All API keys should be restricted in the Google Cloud Console.
- **NFR14:** A caching mechanism will be implemented for the Geolocation service.
- **NFR15:** All AI-driven event extractions must produce a `confidenceScore`.
- **NFR16:** Events with a score below a defined threshold will be flagged for human review.
- **NFR17:** User data and privacy must be protected.
- **NFR18:** BYOK Gemini API keys must be securely stored and managed.
- **NFR19:** The 'add to calendar' feature works one-way.
- **NFR20:** The platform will use a web analytics service.
- **NFR21:** Gracefully inform users about capacity limits.
- **NFR22:** Advise users to independently verify event status.
- **NFR23:** Support Indonesian and English for MVP.
- **NFR24:** The layout must support both LTR and RTL languages.

### Additional Requirements
- **AR1:** All event queries sent from a client to the backend will conform to a unified JSON-based Domain Specific Language (DSL).
- **AR2:** All event collections must be retrieved through the primary event query endpoint using the Unified Query DSL.
- **AR3:** Database schema will be managed code-first using Drizzle ORM TypeScript schema definitions.
- **AR4:** Migrations will be generated as SQL files using `drizzle-kit` and applied automatically via CI/CD.

### UX Design Requirements
- **UX-DR1:** Implement a light theme with a clean grid of cards for events.
- **UX-DR2:** Implement the "Spark in the Grid" logo concept.
- **UX-DR3:** Use "Inter" font, with "Fest" as bold and "Grid" as light.
- **UX-DR4:** Implement the color palette: primary: "#1E293B", secondary: "#6366F1", accent: "#FF5A5F", neutral: "#FAFAFC", success: "#10B981", error: "#EF4444".
- **UX-DR5:** Use a base corner radius of 0.5rem.
- **UX-DR6:** Use a spacing unit of 0.25rem.
- **UX-DR7:** Implement the following components with the specified styles: Card, Button, Grid, Calendar, Event Card Compact, Modal, Notification, Spark, Input with Label.
- **UX-DR8:** The primary experience is mobile-first, but the application will be a responsive web app.
- **UX-DR9:** Create the following pages/routes: `/`, `/favorites`, `/my-calendar`, `/feed`, `/settings`, `/settings/locations`, `/settings/subscriptions`, `/settings/api-keys`, `/settings/notifications`.
- **UX-DR10:** Implement a Filter Hub at the top of the discovery view for filtering events by `EventType` and `EventCategory` with multi-selection.
- **UX-DR11:** The event grid should update dynamically as filters are applied.
- **UX-DR12:** The weekly calendar should have previous/next week navigation and a "Today" button.
- **UX-DR13:** Each schedule of an event is displayed as a separate compact card in the calendar.
- **UX-DR14:** Clicking on an event card or schedule opens a modal with full event details and updates the URL.
- **UX-DR15:** On mobile, a swipe gesture on a list item reveals a "Delete" button.
- **UX-DR16:** Implement the "Set Default Location" user flow for subscriptions.
- **UX-DR17:** Microcopy should be clear, concise, and helpful, providing immediate feedback.
- **UX-DR18:** All components must meet WCAG 2.1 AA standards.
- **UX-DR19:** Use subtle animations on interactive elements.
- **UX-DR20:** Components should adjust information density based on screen size.
- **UX-DR21:** Implement an in-table add form for managing lists.
- **UX-DR22:** Implement the "Soft Delete with Undo" pattern for all destructive actions.

### FR Coverage Map

- FR1: Epic 1 - Core App and Event Discovery
- FR2: Epic 1 - Core App and Event Discovery
- FR3: Epic 1 - Core App and Event Discovery
- FR4: Epic 1 - Core App and Event Discovery
- FR5: Epic 2 - User Personalization
- FR6: Epic 2 - User Personalization
- FR7: Epic 2 - User Personalization
- FR8: Epic 2 - User Personalization
- FR9: Epic 2 - User Personalization
- FR10: Epic 2 - User Personalization
- FR11: Epic 2 - User Personalization
- FR12: Epic 2 - User Personalization
- FR13: Epic 1 - Core App and Event Discovery
- FR14: Epic 1 - Core App and Event Discovery
- FR15: Epic 2 - User Personalization
- FR16: Epic 2 - User Personalization
- FR17: Epic 2 - User Personalization
- FR18: Epic 3 - Social Media Event Integration
- FR19: Epic 3 - Social Media Event Integration
- FR20: Epic 3 - Social Media Event Integration
- FR21: Epic 3 - Social Media Event Integration
- FR22: Epic 3 - Social Media Event Integration
- FR23: Epic 3 - Social Media Event Integration
- FR24: Epic 3 - Social Media Event Integration
- FR25: Epic 3 - Social Media Event Integration
- FR26: Epic 3 - Social Media Event Integration
- FR27: Epic 3 - Social Media Event Integration
- FR28: Epic 3 - Social Media Event Integration
- FR29: Epic 3 - Social Media Event Integration
- FR30: Epic 3 - Social Media Event Integration
- FR31: Epic 3 - Social Media Event Integration
- FR32: Epic 3 - Social Media Event Integration
- FR33: Epic 3 - Social Media Event Integration
- FR34: Epic 3 - Social Media Event Integration
- FR35: Epic 3 - Social Media Event Integration
- FR36: Epic 3 - Social Media Event Integration
- FR37: Epic 3 - Social Media Event Integration
- FR38: Epic 4 - Data Quality and Moderation
- FR39: Epic 4 - Data Quality and Moderation
- FR40: Epic 4 - Data Quality and Moderation
- FR41: Epic 4 - Data Quality and Moderation
- FR42: Epic 4 - Data Quality and Moderation
- FR43: Epic 4 - Data Quality and Moderation
- FR44: Epic 4 - Data Quality and Moderation
- FR45: Epic 4 - Data Quality and Moderation
- FR46: Epic 4 - Data Quality and Moderation
- FR47: Epic 4 - Data Quality and Moderation
- FR48: Epic 4 - Data Quality and Moderation
- FR49: Epic 4 - Data Quality and Moderation
- FR50: Epic 4 - Data Quality and Moderation
- FR51: Epic 5 - Onboarding and Manual Event Extraction
- FR52: Epic 5 - Onboarding and Manual Event Extraction
- FR53: Epic 5 - Onboarding and Manual Event Extraction
- FR54: Epic 5 - Onboarding and Manual Event Extraction
- FR55: Epic 5 - Onboarding and Manual Event Extraction
- FR56: Epic 5 - Onboarding and Manual Event Extraction
- FR57: Epic 5 - Onboarding and Manual Event Extraction
- FR58: Epic 5 - Onboarding and Manual Event Extraction
- FR59: Epic 5 - Onboarding and Manual Event Extraction
- FR60: Epic 5 - Onboarding and Manual Event Extraction
- FR61: Epic 5 - Onboarding and Manual Event Extraction
- FR62: Epic 5 - Onboarding and Manual Event Extraction
- FR63: Epic 1 - Core App and Event Discovery
- FR64: Epic 5 - Onboarding and Manual Event Extraction
- FR65: Epic 5 - Onboarding and Manual Event Extraction

## Epic List

### Epic 0: Project Setup & DevOps

The project is set up with a solid foundation and CI/CD pipeline.
**FRs covered:** N/A (Covers NFRs, ARs, and foundational UX-DRs)

### Story 0.1: Initialize pnpm monorepo

**As a** developer,
**I want** to initialize a pnpm monorepo with a Next.js frontend app and a shared-types package,
**So that** I can start building the FestGrid application with a scalable and maintainable codebase.

**Acceptance Criteria:**

*   **Given** I am in the project's root directory
*   **When** I run `pnpm install`
*   **Then** all dependencies for the frontend app and shared-types package are installed successfully.
*   **And** the Next.js application can be started in development mode without errors.
*   **And** the `shared-types` package can be imported into the Next.js application.

### Story 0.2: Configure TypeScript and ESLint for the monorepo

**As a** developer,
**I want** to have TypeScript and ESLint configured for the monorepo with strict rules, using a global configuration that is inherited by all packages,
**So that** I can ensure code quality and consistency across the project.

**Acceptance Criteria:**

*   **Given** the pnpm monorepo is initialized,
*   **When** I create a new TypeScript file in either the frontend app or the shared-types package,
*   **Then** the code is type-checked and linted according to the project's rules.
*   **And** running the `lint` script in the root of the monorepo checks all packages.
*   **And** the configuration enforces strict TypeScript settings.
*   **And** there is a global `tsconfig.base.json` and `.eslintrc.json` at the root of the monorepo that are extended by the individual packages.

### Story 0.3: Set up Shadcn/UI and configure themes

**As a** developer,
**I want** to set up Shadcn/UI in the Next.js app and configure it with the project's color palette and themes,
**So that** I can use a consistent and accessible component library for building the user interface.

**Acceptance Criteria:**

*   **Given** the Next.js app is initialized,
*   **When** I add a new Shadcn/UI component to the project,
*   **Then** the component is styled with the project's themes (e.g., primary, secondary, accent colors).
*   **And** the application supports both light and dark themes.

### Story 0.4: Set up Drizzle ORM for schema migrations

**As a** developer,
**I want** to set up Drizzle ORM and `drizzle-kit` in the monorepo,
**So that** I can define database schemas in TypeScript and generate SQL migrations from them.

**Acceptance Criteria:**

*   **Given** the pnpm monorepo is initialized,
*   **When** I define a new Drizzle schema for a table (e.g., a simple `users` table),
*   **Then** I can run a `pnpm` script to generate a new SQL migration file.
*   **And** the generated migration can be successfully applied to the database.

### Story 0.5: Set up CI/CD pipeline with GitHub Actions

**As a** developer,
**I want** to have a basic CI/CD pipeline set up with GitHub Actions,
**So that** I can automatically run tests, linting, and build checks on every push to the repository.

**Acceptance Criteria:**

*   **Given** a push is made to any branch in the GitHub repository,
*   **When** the GitHub Actions workflow is triggered,
*   **Then** the workflow installs dependencies, runs linting, and executes tests for all packages.
*   **And** the workflow fails if any of these steps fail.

### Story 0.6: Set up i18n foundation (next-intl)

**As a** developer,
**I want** the Next.js app wired up with `next-intl` for locale routing and message loading before any user-facing page is built,
**So that** i18n is a foundational capability every future story consumes, not something bolted on ad hoc per feature (AR: Core Principle — i18n is foundational, not an afterthought).

**Acceptance Criteria:**

*   **Given** the Next.js app is initialized (Story 0.1) and Shadcn/UI themes are configured (Story 0.3),
*   **When** the app boots,
*   **Then** `next-intl` is configured with locale routing/middleware and a dedicated `locales` directory containing separate JSON message files for `en` and `id` (NFR23).
*   **And** the root layout is wrapped with the i18n provider so any page/component can call `useTranslations` without additional setup.
*   **And** the layout/container structure supports both LTR and RTL rendering (NFR24) even though only LTR locales ship at MVP.
*   **And** at least one existing hardcoded string (e.g. on the placeholder home page) is migrated to a message key, proving the pipeline works end-to-end.

**Note:** This story resolves the i18n gap flagged in `deferred-work.md` (code review of 0-1, 2026-07-22) and Gate 3 (`story-split-gate.md`) — i18n must not be re-introduced ad hoc inside individual feature stories.

### Story 0.7: Build the global app shell & navigation layout

**As a** developer,
**I want** a shared, responsive app shell (header/nav, content region, footer as applicable) established once in `packages/ui`/`apps/web`,
**So that** every route in UX-DR9 (`/`, `/favorites`, `/my-calendar`, `/feed`, `/settings`, etc.) is built on a consistent, mobile-first layout instead of each feature story reinventing page chrome.

**Acceptance Criteria:**

*   **Given** Shadcn/UI themes (Story 0.3) and the i18n provider (Story 0.6) are set up,
*   **When** the root layout renders,
*   **Then** it composes a shared app shell (navigation, content region) that all routes render inside of.
*   **And** the shell is mobile-first and responsive per UX-DR8, and its containers are RTL/LTR-ready per NFR24.
*   **And** the shell exposes clear extension points for feature stories to register nav entries as new routes are added (Epics 1-5), without needing to modify shared layout code for every new page.
*   **And** the shell is where cross-cutting providers (i18n, analytics, theming) are composed, so feature stories only add their page content — they do not re-wire providers.

**Note:** This story exists because of Gate 3 (`story-split-gate.md`) — layout/navigation is shared across every future epic, and must not be defined incidentally while building the Story 1.3 main page.

### Story 0.8: Set up GraphQL server scaffold, Code Generator pipeline, and the optimized-select query utility

**As a** developer,
**I want** the GraphQL server foundation, the GraphQL Code Generator pipeline, and the mandated `buildOptimizedDrizzleSelect` utility built once as shared, generic infrastructure,
**So that** every future resolver (events now; schedules, users, locations, subscriptions later) reuses the same query-optimization and type-generation machinery instead of each feature reimplementing it.

**Acceptance Criteria:**

*   **Given** Drizzle ORM and the initial schema exist (Stories 0.4, 1.1),
*   **When** the backend app (`apps/backend`) starts,
*   **Then** a GraphQL server is running with query depth/complexity limits configured to prevent abuse.
*   **And** `GraphQL Code Generator` is configured against the GraphQL schema, generating end-to-end TypeScript types (and typed `graphql-request`/`react-query` hooks) consumed by `apps/web`, so client and server can never silently drift out of sync.
*   **And** a generic, strictly-typed `buildOptimizedDrizzleSelect` function exists in `packages/database`, translating GraphQL resolve-info/AST into an optimized Drizzle `select` that only fetches requested fields.
*   **And** `buildOptimizedDrizzleSelect` is table/schema-agnostic (not events-specific) so any future resolver can import and reuse it, and it has dedicated unit tests proving correct field-selection behavior.
*   **And** the codegen script runs as part of `pnpm build`/CI (Story 0.5) so type drift fails the build.

**Note:** This story exists because of Gate 3 (`story-split-gate.md`) — GraphQL scaffolding, codegen, and `buildOptimizedDrizzleSelect` are named as mandatory in `project-context.md` but had no owning story; Story 1.3a below builds the events-specific resolver on top of this foundation rather than re-deriving it.

### Story 0.9: Set up state management foundation (React Query, nuqs, Zustand)

**As a** developer,
**I want** to configure `@tanstack/react-query`, `nuqs`, and `zustand` strictly within the frontend application (`apps/web`),
**So that** all future features have a clear, type-safe pattern for managing server state, URL state, and client global state without creating unnecessary shared workspace packages.

**Acceptance Criteria:**

*   **Given** the Next.js app is initialized,
*   **When** I load a page,
*   **Then** a `QueryClientProvider` is configured at the root to handle server state fetching and caching.
*   **And** `nuqs` is configured for handling URL search parameters type-safely.
*   **And** a pattern for ephemeral global UI state using `zustand` is established with examples or documentation for future stories to follow.
*   **And** all these state dependencies remain isolated in `apps/web`.

### Story 0.10: Set up testing frameworks foundation (Vitest, MSW, Playwright)

**As a** developer,
**I want** to configure `Vitest`, `MSW` (Mock Service Worker), and `Playwright` in the monorepo,
**So that** all packages and applications have the necessary tools for the "testing trophy" approach.

**Acceptance Criteria:**

*   **Given** the monorepo is initialized,
*   **When** I run `pnpm test`,
*   **Then** a shared testing configuration workspace package (`@festgrid/testing-config`) is established to prevent duplicated setup code.
*   **And** `Vitest` runs unit/integration tests across all packages (`packages/domain`, `packages/ui`, etc.).
*   **And** `MSW` is configured to intercept and mock API calls for integration tests.
*   **And** `Playwright` is set up strictly in `apps/web` (or a dedicated e2e root) for running E2E tests against the Next.js app.

### Story 0.11: Set up runtime schema validation (Zod, AJV)

**As a** developer,
**I want** to establish `Zod` (for frontend) and `AJV` (for backend) validation patterns with strict package dependency isolation,
**So that** all data entering the system is strictly validated at the boundaries without bundle pollution.

**Acceptance Criteria:**

*   **Given** the frontend and backend apps are running,
*   **When** external data is received (e.g., via API request or scraping),
*   **Then** the project uses `AJV` strictly installed in `apps/backend` for fast JSON schema validation on the backend.
*   **And** the project uses `Zod` strictly installed in `apps/web` (or specific UI packages) for form validation and client-side data parsing.
*   **And** there is no shared validation package that mixes these dependencies.

### Story 0.12: Set up Firebase Cloud Messaging (FCM) foundation

**As a** developer,
**I want** to integrate the Firebase Admin SDK exclusively on the backend and the Firebase JS SDK exclusively on the frontend,
**So that** the project has the infrastructure ready for sending and receiving push notifications without leaking Node.js admin libraries into the browser bundle.

**Acceptance Criteria:**

*   **Given** the Firebase project is configured,
*   **When** the backend needs to send a notification,
*   **Then** it successfully interfaces with the `firebase-admin` SDK (installed strictly in `apps/backend`).
*   **And** the frontend is capable of requesting notification permissions and registering device tokens using the `firebase` JS SDK (installed strictly in `apps/web`).

### Story 0.13: Set up the AI Gateway adapter layer for Gemini

**As a** developer,
**I want** a dedicated AI Gateway layer that wraps all outbound Gemini API calls behind a single Adapter interface, with dynamic throttling, intelligent queuing, BYOK API key round-robin selection (Tier 1 user-specific / Tier 2 shared with fairness), and KMS-backed decryption of stored keys,
**So that** every feature that calls an external AI service (event extraction now; AI-assisted correction later) reuses the same rate-limiting, key-management, and modularity guarantees instead of each feature calling Gemini directly.

**Acceptance Criteria:**

*   **Given** a feature needs to extract or correct event data using Gemini,
*   **When** it needs to call the Gemini API,
*   **Then** it does so exclusively through this Adapter's exposed interface — never the raw Gemini SDK/HTTP API.
*   **And** the Adapter manages outgoing request rate (dynamic throttling/queuing) to prevent rate-limit violations and Google "suspicious activity" flags (PRD §3.8).
*   **And** the Adapter selects which user's API key to use per the quota-management algorithm (Tier 1: sole subscriber's key(s); Tier 2: round-robin across subscribers' keys, prioritizing users with fewer calls this billing cycle).
*   **And** the Adapter decrypts a user's BYOK key in memory only when needed, using AWS KMS, and never logs or persists the decrypted value.
*   **And** the Adapter skips a failed/rate-limited/invalid key and falls through to the next available key per the round-robin.
*   **And** internal per-key usage tracking is reset at the start of each billing cycle.

**Note:** This story exists because of Gate 3 (`story-split-gate.md`), surfaced while creating Story 3.6 — the Adapter pattern for external AI services is mandated project-wide (`project-context.md`, NFR11, PRD §3.8) but had no owning story. It is needed by both Epic 3 (Story 3.6, event extraction) and Epic 4 (Story 4.2, AI-assisted correction), so it is placed in Epic 0 rather than scoped to a single epic.

**Depends on:** Story 1.1 (`api_keys` table).

### Story 0.14: Set up AWS IaC for Lambda, SQS, EventBridge, and KMS

**As a** developer,
**I want** infrastructure-as-code provisioning the backend Lambda functions, SQS queues (`ScrapingQueue`, `AIProcessingQueue`, `DataIngestionQueue`), an EventBridge scheduled rule, API Gateway, and a KMS key for BYOK key encryption,
**So that** every backend pipeline story (scraping, queuing, AI processing, ingestion) deploys onto consistently provisioned, version-controlled infrastructure instead of each story inventing its own ad hoc AWS setup.

**Acceptance Criteria:**

*   **Given** the monorepo and CI/CD pipeline exist (Stories 0.1, 0.5),
*   **When** the IaC stack is applied,
*   **Then** the four backend Lambda functions (API, Scraper, AI Processor, Ingestor), the three SQS queues, an EventBridge scheduled rule, API Gateway, and a KMS key are provisioned and wired together per `docs/infrastructure/high-level-overview.md`.
*   **And** the stack deploys automatically as part of CI/CD (Story 0.5) on merge to the main branch.
*   **And** environment-specific configuration (dev/staging/prod) is supported without duplicating the stack definition.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced while creating Story 3.6 — no IaC/deploy story existed for any of the Lambdas/queues/KMS key that the Epic 3 processing pipeline (Stories 3.4-3.6, 3.6b) and the AI Gateway (Story 0.13) depend on.

### Epic 1: Core App and Event Discovery

Users can discover and browse events.
**FRs covered:** FR1, FR2, FR3, FR4, FR13, FR14, FR63
**Architecture & UX compliance:** All event retrieval in this epic must go through the backend GraphQL API using the Unified Query DSL (AD-1/AD-2) — never directly from the database or domain package. Shareable search/filter state must use URL state (AD-4, `nuqs`). `bmad-create-story` must run the Architecture/Infra Completeness, UI Complexity & Reusability, and Foundational/Cross-Cutting Dependency gates from `story-split-gate.md` for every story below; the splits already reflected here (1.3a/1.3b, 1.6a) — and the promotion of shared tooling into Epic 0 Stories 0.6-0.8 — are the result of applying those gates retroactively to this epic.

### Story 1.1: Create initial database tables

**As a** developer,
**I want** to create the initial database tables for Events, Schedules, Users, Locations, and Subscriptions,
**So that** the core features of the application can be built upon a solid data foundation.

**Acceptance Criteria:**

*   **Given** the Drizzle ORM migration tool is set up,
*   **When** I run the migration script,
*   **Then** the `events`, `schedules`, `users`, `user_locations`, `subscriptions`, and `api_keys` tables are created in the database with the correct columns and relationships.

### Story 1.2: Seed database with mock data

**As a** developer,
**I want** to have a script that seeds the database with mock event data,
**So that** I can develop and test the event discovery features with realistic data.

**Acceptance Criteria:**

*   **Given** the database schema is set up,
*   **And** we have a defined set of mock data including locations, Instagram post URLs, image URLs, and SocialMediaAccountProfile data,
*   **And** all foreign key relationships in the mock EventInfo data are populated with corresponding mock data,
*   **When** I run the seed script,
*   **Then** the database is populated with a set of mock events, including names, dates, locations, schedules, performers, and all related nested data.

### Story 1.3a: Build the events backend GraphQL API layer

**As a** developer,
**I want** a backend GraphQL API layer that resolves event queries using the Unified Query DSL (AD-1/AD-2) against the database,
**So that** every event discovery feature (list, search, filter, details, and later favorites/calendar views) retrieves data through one consistent, secure API instead of the frontend accessing the database directly.

**Acceptance Criteria:**

*   **Given** the GraphQL server scaffold, Code Generator pipeline, and `buildOptimizedDrizzleSelect` utility exist (Story 0.8), and the initial database tables and mock data exist (Stories 1.1, 1.2),
*   **When** a client sends a Unified Query DSL request (AD-1) to the backend GraphQL API,
*   **Then** the backend resolves it against the database via Drizzle, using `buildOptimizedDrizzleSelect` (Story 0.8) to fetch only requested fields, and returns matching events with pagination support.
*   **And** the API supports filtering by name/performer/location (`contains`), type/category (`in`), and combining conditions with `and`/`or`, per AD-1.
*   **And** the API supports fetching a single event by ID for the detail view.
*   **And** no package outside `apps/backend` imports the database/domain layer directly — `apps/web` only talks to events data through this API (e.g. via generated `graphql-request` types from Story 0.8).

**Depends on:** Story 0.8

### Story 1.3b: Build the reusable EventCard component

**As a** developer,
**I want** a reusable `EventCard` component in `packages/ui`,
**So that** the main event list (and future views like favorites/calendar) can display events consistently, including their image and loading/empty/error states.

**Acceptance Criteria:**

*   **Given** an event's data (name, date, main image, and metadata),
*   **When** `EventCard` renders,
*   **Then** it displays the event name, date, and main image.
*   **And** it displays a graceful fallback/placeholder when no image is available.
*   **And** it exposes a loading (skeleton) state and renders correctly with only the fields guaranteed by the API contract.
*   **And** the component is documented/exported from `packages/ui` for reuse across features.

### Story 1.3: Display a list of events on the main page

**As a** user,
**I want** to see a list of curated local events on the main page,
**So that** I can discover what's happening around me.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** the page loads,
*   **Then** I see a grid of `EventCard`s (Story 1.3b).
*   **And** the events displayed are ongoing or upcoming.
*   **And** the event data is fetched via the backend GraphQL API using the Unified Query DSL (Story 1.3a) — not directly from the database.
*   **And** the list implements infinite scrolling, seamlessly fetching and appending the next page of results as I scroll near the bottom.
*   **And** a localized non-blocking spinner is displayed at the bottom of the list while fetching subsequent pages.

**Depends on:** Story 0.6, Story 0.7, Story 1.3a, Story 1.3b

### Story 1.4: Search for events

**As a** user,
**I want** to be able to search for events by name, performer, and location,
**So that** I can find specific events I am interested in.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I type a search query in the search bar and press enter,
*   **Then** the list of events is filtered to show only events that match the search query, via a `contains` condition sent through the Unified Query DSL (Story 1.3a) — not a client-side filter of already-fetched data.
*   **And** the search is performed on the event name, performers, and location name.
*   **And** the search supports partial matching.
*   **And** the active search query is reflected in the URL as shareable/bookmarkable state (AD-4 URL State via `nuqs`).

### Story 1.5: Filter events by type and category

**As a** user,
**I want** to be able to filter events by type and category,
**So that** I can narrow down the list of events to my interests.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I select one or more event types or categories from the filter controls,
*   **Then** the list of events is filtered via `in` conditions sent through the Unified Query DSL (Story 1.3a) — not a client-side filter of already-fetched data.
*   **And** I can clear the filters to see all events again.
*   **And** the active filters are reflected in the URL as shareable/bookmarkable state (AD-4 URL State via `nuqs`), combinable with the search query from Story 1.4.

### Story 1.6a: Build the reusable event detail view component

**As a** developer,
**I want** a reusable event detail display component in `packages/ui`,
**So that** the event name, description, date/time, location, and performers can be presented consistently wherever event details are shown.

**Acceptance Criteria:**

*   **Given** a fully-loaded event's details,
*   **When** the component renders,
*   **Then** it displays the event name, description, date and time, location, performers, and image, with a graceful fallback for any missing optional field.
*   **And** it exposes loading and error states independent of how it is invoked (modal or full page).

### Story 1.6: View event details

**As a** user,
**I want** to be able to click on an event to see its full details,
**So that** I can get all the information I need about the event.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I click on an event card,
*   **Then** a modal or a new page appears, using the event detail component (Story 1.6a), with the full details of the event.
*   **And** the event details are fetched via the backend GraphQL API using the Unified Query DSL (Story 1.3a) — not directly from the database.
*   **And** the detail view provides "Next" and "Previous" navigation controls that respect the search, filter, and sort context of the list I navigated from.
*   **And** if I navigate to the end of the currently loaded page using the "Next" button, the system automatically fetches the next page of results in the background.

**Depends on:** Story 1.3a, Story 1.6a

### Story 1.7: User Signup and Login with Google

**As a** new user,
**I want** to be able to sign up and log in using my Google account,
**So that** I can easily and securely access the application.

**Acceptance Criteria:**

*   **Given** I am on the login page,
*   **When** I click the "Sign in with Google" button,
*   **Then** I am redirected to the Google authentication page.
*   **And** after successful authentication, a new user account is created in the system if it doesn't exist, persisted via the backend API layer — not a direct database write from `apps/web`.
*   **And** I am logged in to the application.
*   **And** I am redirected to the main page.

### Story 1.8: Setup PostHog Analytics

**As a** developer/system administrator,
**I want** to integrate PostHog into the application,
**So that** we can start tracking user interactions, page views, and core events across the whole app.

**Acceptance Criteria:**

*   **Given** I have a PostHog account and project API key,
*   **When** I configure the Next.js application,
*   **Then** a `PostHogProvider` is added to the root layout to initialize PostHog globally.
*   **And** the required environment variables (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`) are documented in the setup guide.
*   **And** PostHog automatically captures basic page views and interactions.

### Epic 2: User Personalization

Users can personalize their experience by saving favorite events and locations.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR15, FR16, FR17

### Story 2.1: Favorite an event

**As a** user,
**I want** to be able to favorite an event,
**So that** I can easily find it later.

**Acceptance Criteria:**

*   **Given** I am viewing the details of an event,
*   **When** I click the "Favorite" button,
*   **Then** the event is marked as a favorite.
*   **And** the "Favorite" button changes to an "Unfavorite" button.
*   **And** when I click the "Unfavorite" button, the event is no longer marked as a favorite.

### Story 2.2: View favorited events

**As a** user,
**I want** to have a dedicated page that shows all my favorited events,
**So that** I can easily keep track of them.

**Acceptance Criteria:**

*   **Given** I am logged in,
*   **When** I navigate to the "Favorites" page,
*   **Then** I see a list of all the events I have favorited.
*   **And** I can unfavorite an event directly from this page.

### Story 2.3: Manage saved locations

**As a** user,
**I want** to be able to save and manage a list of named locations,
**So that** I can easily find events near them.

**Acceptance Criteria:**

*   **Given** I am on the "My Locations" page,
*   **When** I add a new location by providing a name and address,
*   **Then** the location is saved to my list of locations.
*   **And** I can see a list of my saved locations.
*   **And** I can delete a location from the list.

### Story 2.4: Set location by current location or map

**As a** user,
**I want** to be able to set a location by using my current location or by picking a point on a map,
**So that** I can easily save locations without having to type in an address.

**Acceptance Criteria:**

*   **Given** I am on the "My Locations" page and adding a new location,
*   **When** I click the "Use my current location" button,
*   **Then** the location fields are pre-filled with my current location.
*   **And when** I click the "Pick on map" button,
*   **Then** a map is displayed, allowing me to select a location by clicking on it.

### Story 2.5: Find nearby events

**As a** user,
**I want** to be able to find events near my saved locations,
**So that** I can easily discover events happening close to me.

**Acceptance Criteria:**

*   **Given** I have at least one saved location,
*   **When** I am viewing the event list,
*   **Then** I can select one of my saved locations to see nearby events.
*   **And** I can specify a radius (e.g., 1km, 5km, 10km) to define "nearby".
*   **And** the list of events is filtered to show only events within the specified radius of the selected location.

### Story 2.6: View and manage events on a calendar

**As a** user,
**I want** to see my "favorited" and "added to calendar" events on a dedicated calendar page,
**So that** I can visualize my upcoming event schedule.

**Acceptance Criteria:**

*   **Given** I am on the "My Calendar" page,
*   **When** the page loads,
*   **Then** I see a calendar view with all my "favorited" and "added to calendar" events.
*   **And** "favorited" and "added to calendar" events have a distinct visual treatment.
*   **And** I can toggle the visibility of "favorited" and "added to calendar" events on the calendar.

### Story 2.7: Automatically hide past events

**As a** user,
**I want** past events in my personal lists to be automatically hidden after a configurable number of days,
**So that** my lists stay clean and relevant.

**Acceptance Criteria:**

*   **Given** I have events in my "Favorites" or "My Calendar" list that have passed,
*   **When** `N` days have passed since the event ended,
*   **Then** the event is no longer visible in the list.
*   **And** the value of `N` is configurable in the user settings.

### Story 2.8: User Menu

**As a** logged-in user,
**I want** to have a user menu,
**So that** I can easily navigate to my personalized sections of the application.

**Acceptance Criteria:**

*   **Given** I am logged in,
*   **When** I click on my profile icon,
*   **Then** a dropdown menu appears.
*   **And** the menu contains links to "My Favorites", "My Calendar", "My Locations", and "Settings".
*   **And** the menu also contains a "Logout" button.

### Story 2.9: Manage Push Notification Settings

**As a** user,
**I want** to be able to enable or disable push notifications for new events,
**So that** I have control over the notifications I receive.

**Acceptance Criteria:**

*   **Given** I am on the "Settings" page,
*   **When** I navigate to the "Notifications" section,
*   **Then** I see a toggle to enable or disable push notifications for new events.
*   **And** my choice is saved and respected by the system.

### Epic 3: Social Media Event Integration

Users can subscribe to social media accounts to import events into their feed.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37

### Story 3.1: Onboarding wizard for API key and subscriptions

**As a** new user,
**I want** to be guided through a wizard to add my Gemini API key and subscribe to my first social media account,
**So that** I can get started with the application easily.

**Acceptance Criteria:**

*   **Given** I am a new user,
*   **When** I first try to access a feature that requires an API key (e.g., "Manage Subscriptions"),
*   **Then** I am redirected to a wizard.
*   **And** the first step of the wizard prompts me to add my Gemini API key.
*   **And** the second step prompts me to subscribe to my first social media account.
*   **And** after completing the wizard, I am redirected back to the page I was trying to access.

### Story 3.2: Subscribe to a social media account

**As a** user,
**I want** to be able to subscribe to a social media account from the "My Subscriptions" page,
**So that** I can add new accounts to monitor for events.

**Acceptance Criteria:**

*   **Given** I am on the "My Subscriptions" page,
*   **And** I have at least one API key,
*   **When** I enter a social media account URL and click "Subscribe",
*   **Then** the subscription is saved to my account.
*   **And** I see the new subscription in my list of subscriptions.

### Story 3.3: Set a default location for a subscription

**As a** user,
**I want** to be able to set a default location when I subscribe to a social media account,
**So that** the system can use this location if it cannot find an explicit location in a post.

**Acceptance Criteria:**

*   **Given** I am subscribing to a new social media account,
*   **When** I am filling out the subscription form,
*   **Then** I have an optional field to set a default location for this subscription.
*   **And** if a default location is set, the AI agent will use it when it cannot find an explicit location in a post.

### Story 3.3a: Create posts table and persist scraped posts

**As a** developer,
**I want** a `posts` table (matching the PRD's `Post` interface: `id`, `content`, `imageUrl`, `postUrl`, `isExtracted`, plus a `subscriptionId` reference and `publishedAt` timestamp) and the persistence logic scraped posts are written to,
**So that** the scraping/queuing/extraction pipeline (Stories 3.4-3.6) and the manual post selection screens (Epic 5) share one consistent, queryable record of every scraped post and its extraction status.

**Acceptance Criteria:**

*   **Given** the initial database tables exist (Story 1.1),
*   **When** I run the migration script,
*   **Then** a `posts` table is created with columns for `id`, `subscription_id` (FK to `subscriptions`), `content`, `image_url`, `post_url`, `is_extracted` (default false), `published_at`, and standard timestamps.
*   **And** the table is indexed on `subscription_id` and `published_at` to support Epic 5's "20 most recent posts per account" and inactive-account (30-day) queries.
*   **And** a persistence function exists for writing a newly scraped post (used by Story 3.4) and for updating a post's `is_extracted` status (used by Stories 3.6/3.6b).

**Note:** This story exists because of Gate 3 (`story-split-gate.md`), surfaced while creating Story 3.6 — the PRD's `Post` interface implies a persisted entity with an extraction-status flag, but Story 1.1 only created `events`/`schedules`/`users`/`user_locations`/`subscriptions`/`api_keys`. This table is written by Epic 3 (Stories 3.4-3.6) and read by Epic 5 (Stories 5.1-5.4), so — following the precedent of Story 1.1 scoping core data tables to their originating epic rather than Epic 0 — it is placed here, before Story 3.4, rather than in Epic 0.

**Depends on:** Story 1.1.

### Story 3.4: Scrape new posts from subscribed accounts

**As a** system,
**I want** to periodically scrape new posts from the social media accounts that users have subscribed to,
**So that** I can begin the event extraction process.

**Acceptance Criteria:**

*   **Given** there are active subscriptions to social media accounts,
*   **When** the scraping process is triggered (e.g., on a schedule),
*   **Then** the system retrieves the latest posts from the subscribed accounts.
*   **And** the scraped posts are stored temporarily for the next step in the processing pipeline.

### Story 3.5: Add new posts to a processing queue

**As a** system,
**I want** to add the scraped posts to a processing queue,
**So that** I can reliably and asynchronously process them for event extraction.

**Acceptance Criteria:**

*   **Given** a new post has been scraped from a subscribed account,
*   **When** the post is ready to be processed,
*   **Then** the post is added as a message to an SQS queue.
*   **And** the message contains all the necessary information about the post (e.g., URL, content, metadata).

### Story 3.6: Process posts from the queue and extract event information

**As a** system,
**I want** to process posts from the queue, call the Gemini API (through the AI Gateway adapter) to extract event information, and enqueue the validated result for ingestion,
**So that** new events can be reliably added to the application without this Lambda also owning the database write.

**Acceptance Criteria:**

*   **Given** there is a message in the `AIProcessingQueue` containing a post to be processed,
*   **When** the message is consumed by the AI Processor Lambda,
*   **Then** the Lambda calls the Gemini API exclusively through the AI Gateway adapter (Story 0.13) to extract event information from the post content.
*   **And** the extracted information is validated (AJV) and transformed into a structured `EventInfo` object, including a populated `confidenceScore`.
*   **And** the validated `EventInfo` object is enqueued to the `DataIngestionQueue` — this Lambda does not write to the database directly (Story 3.6b handles ingestion).

**Note:** AC corrected by Gate 1 (`story-split-gate.md`) — the original draft had this Lambda both call Gemini and save directly to the database, bypassing the separate Ingestor Lambda shown in `docs/infrastructure/high-level-overview.md`.

**Depends on:** Story 0.13, Story 3.3a, Story 3.5.

### Story 3.6b: Ingest processed events into the database

**As a** system,
**I want** to consume a validated `EventInfo` message from the `DataIngestionQueue` and write it to the database,
**So that** the AI Processor Lambda (Story 3.6) stays decoupled from the database per the architecture's queue-based pipeline design.

**Acceptance Criteria:**

*   **Given** there is a message in the `DataIngestionQueue` containing a validated `EventInfo` object,
*   **When** the message is consumed by the Ingestor Lambda,
*   **Then** the `EventInfo` (and its `schedules`) is written to the database via Drizzle.
*   **And** duplicate/already-ingested events are handled gracefully (no duplicate rows for the same source post).

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — Story 3.6's original draft had the AI Processor Lambda both call Gemini and write to the database, bypassing the separate Ingestor Lambda (`L_Ingest`) shown in `docs/infrastructure/high-level-overview.md`. This story is that Ingestor Lambda.

**Depends on:** Story 3.6.

### Story 3.7: Display extracted events to the user

**As a** user,
**I want** to see the events that have been extracted from my subscribed social media accounts,
**So that** I can see the results of the event extraction process.

**Acceptance Criteria:**

*   **Given** I have subscribed to at least one social media account,
*   **And** the system has extracted events from that account,
*   **When** I navigate to my "Feed" page,
*   **Then** I see a list of events that have been extracted from my subscribed accounts.
*   **And** I can view the events in a calendar view or a card view.

### Story 3.8: Push notifications for extracted events

**As a** user,
**I want** to receive a push notification when a new event is extracted from one of my subscribed accounts,
**So that** I can be immediately informed about new events.

**Acceptance Criteria:**

*   **Given** I have subscribed to a social media account,
*   **And** I have enabled push notifications in my settings,
*   **When** a new event is successfully extracted from the account,
*   **Then** I receive a push notification on my registered devices.
*   **And** the push notification contains the event name and a short description.

### Story 3.9: Implement API key quota management

**As a** user who has subscribed to a popular account,
**I want** the system to fairly use the API keys from all subscribers,
**So that** event extraction is reliable and not dependent on a single user's quota.

**Acceptance Criteria:**

*   **Given** there are multiple users subscribed to the same social media account,
*   **When** the system needs to process a post from that account,
*   **Then** it uses a round-robin with fairness algorithm to select which user's API key to use.
*   **And** the system tracks the usage of each API key.
*   **And** the usage tracking is reset at the beginning of each billing cycle.

### Story 3.10: Email notifications for queued posts

**As a** user,
**I want** to receive an email notification when my subscribed posts are not being processed due to API quota issues,
**So that** I can take action to resolve the problem.

**Acceptance Criteria:**

*   **Given** a user's subscribed posts have been in the processing queue for a configurable number of days (default: 3),
*   **And** the number of queued posts exceeds a configurable threshold (default: 3),
*   **When** the system checks for long-queued posts,
*   **Then** an email notification is sent to the user.
*   **And** the email suggests contributing an additional API key.

### Epic 4: Data Quality and Moderation

Users can contribute to data quality by correcting event details and reporting issues.
**FRs covered:** FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50

### Story 4.1: Manually correct event data

**As a** user,
**I want** to be able to manually correct the details of an event,
**So that** I can fix any inaccuracies in the event information.

**Acceptance Criteria:**

*   **Given** I am viewing the details of an event,
*   **When** I click the "Correct Data" button,
*   **Then** a form is displayed with the current event data pre-filled.
*   **And** I can edit the fields and submit the corrections.
*   **And** the system performs data inconsistency checks before accepting the correction.

### Story 4.2: AI-assisted event data correction

**As a** user with a BYOK key,
**I want** the system to be able to automatically extract corrected event information from a URL I provide,
**So that** I can more easily correct event data.

**Acceptance Criteria:**

*   **Given** I am correcting the data for an event,
*   **And** I have provided my own Gemini API Key (BYOK),
*   **When** I provide a URL to a social media post and click "Extract",
*   **Then** the system uses the Gemini API to extract event information from the post.
*   **And** the correction form is pre-filled with the extracted information for my review.

### Story 4.3: Report an event

**As a** user,
**I want** to be able to report an event for various reasons,
**So that** I can help maintain the quality and accuracy of the event listings.

**Acceptance Criteria:**

*   **Given** I am viewing an event,
*   **When** I click the "Report" button,
*   **Then** if I am not logged in, I am prompted to log in.
*   **And** once logged in, I am presented with a form where I can select a reason for reporting (e.g., "Event Cancelled", "Dangerous Event", "Personal").
*   **And** I can provide additional details in a text field.
*   **And** when I submit the report, it is recorded in the system.
*   **And** the reported event is immediately hidden from my view.

### Story 4.4: Handle "Event Cancelled" reports

**As a** user,
**I want** events that are widely reported as "cancelled" to be removed from the public view,
**So that** I don't see inaccurate information.

**Acceptance Criteria:**

*   **Given** an event has been reported as "Cancelled" by a user,
*   **When** the number of unique users reporting the same event as cancelled reaches a configurable threshold (default: 3) within a configurable timeframe (default: 7 days),
*   **Then** the event is soft-deleted and no longer visible to regular users.
*   **And** a moderator can view the soft-deleted event and has the option to restore it.

### Story 4.5: Handle "Dangerous Event" reports

**As a** user who has reported a dangerous event,
**I want** moderators to be notified immediately,
**So that** they can take swift action to protect the community.

**Acceptance Criteria:**

*   **Given** a user reports an event as "Dangerous",
*   **When** the report is submitted,
*   **Then** an email notification is immediately sent to all moderators.
*   **And** when a moderator marks the event as safe, they have the option to ignore subsequent "Dangerous" reports from the same user for that same event.

### Story 4.6: User's Reports page

**As a** user,
**I want** to have a dedicated page where I can see the history and status of my submitted reports,
**So that** I can track the outcome of my reports.

**Acceptance Criteria:**

*   **Given** I am logged in,
*   **When** I navigate to the "My Reports" page from the user menu,
*   **Then** I see a list of all the reports I have submitted.
*   **And** for each report, I can see the reported event, the reason for the report, and the current status (e.g., "Pending", "Resolved").

### Story 4.7: Moderator Items page

**As a** moderator,
**I want** to have a dedicated page where I can see all reported events and take action on them,
**So that** I can effectively moderate the content on the platform.

**Acceptance Criteria:**

*   **Given** I am logged in as a moderator,
*   **When** I navigate to the "Moderator Items" page from the user menu,
*   **Then** I see a list of all reported events that require my attention.
*   **And** for each reported event, I can see the reason for the report and any additional details.
*   **And** I can take action on the report, such as marking an event as safe, restoring a soft-deleted event, or permanently deleting an event.

### Epic 5: Onboarding and Manual Event Extraction

Users are guided through the initial setup and can manually select posts for event extraction.
**FRs covered:** FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR64, FR65

### Story 5.1: Manual post selection screen

**As a** user,
**I want** a screen where I can see the most recent posts from my subscribed accounts,
**So that** I can choose which posts to process for event extraction.

**Acceptance Criteria:**

*   **Given** I am on any page in the application,
*   **When** I navigate to the "Manual Post Selection" screen from the user menu,
*   **Then** if I have not provided an API key or subscribed to any accounts, I am guided through the process of doing so.
*   **And** if I have at least one subscribed account, I see a tab for each of my subscribed accounts.
*   **And** each tab displays the 20 most recent posts from that account.
*   **And** posts are loaded lazily to improve performance.

### Story 5.2: Select posts for extraction

**As a** user,
**I want** to be able to select multiple posts from different subscribed accounts to be processed for event extraction,
**So that** I can efficiently choose which posts to process.

**Acceptance Criteria:**

*   **Given** I am on the "Manual Post Selection" screen,
*   **When** I click the checkbox on a post card,
*   **Then** the post is marked as selected.
*   **And** I can select multiple posts across different tabs.
*   **And** the selection state is preserved when I switch between tabs.
*   **And** there is a summary bar that shows the total number of selected posts.

### Story 5.3: Display and enforce API quota

**As a** user,
**I want** to see how many posts I can select for extraction based on my API quota, and see which posts have already been processed,
**So that** I can manage my API usage effectively and avoid redundant extractions.

**Acceptance Criteria:**

*   **Given** I am on the "Manual Post Selection" screen,
*   **When** I select posts for extraction,
*   **Then** a summary bar displays the number of selected posts against my remaining API quota.
*   **And** I am prevented from selecting more posts than my quota allows.
*   **And** posts that have already been processed are visually disabled and cannot be selected.

### Story 5.4: Inactive account warning

**As a** user,
**I want** to see a warning for my subscribed accounts that have become inactive,
**So that** I can manage my subscriptions effectively.

**Acceptance Criteria:**

*   **Given** I am on the "Manual Post Selection" screen,
*   **When** a subscribed account has not published any posts within a configurable period (e.g., 30 days),
*   **Then** a warning icon is displayed on the account's tab.
*   **And** the tab's content shows a warning message and a button to remove the inactive subscription.

### Story 5.5: Integrate manual post selection into the getting started wizard

**As a** new user,
**I want** to be prompted to select posts for extraction immediately after subscribing to new accounts in the getting started wizard,
**So that** I can get events into my feed right away.

**Acceptance Criteria:**

*   **Given** I am in the getting started wizard,
*   **And** I have just added a new subscription,
*   **When** I complete the subscription step,
*   **Then** I am taken to the "Manual Post Selection" screen.
*   **And** the tab for the newly added subscription is automatically activated.
