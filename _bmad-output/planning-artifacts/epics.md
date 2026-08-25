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
- **FR13:** Consolidate all relevant event information in one place, including attribution/links back to the source social media post the event was extracted from — both the original-platform post (when derivable) and the post as actually scraped, which may be a proxy/mirror site (PRD §3.3.3/§3.7).
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
- **FR66:** Users can edit an already-subscribed account's "Default Location"; the change applies immediately, with no pre-approval gate.
- **FR67:** Moderators are notified by email when an account's "Default Location" is changed, and can accept or revert the change from Moderator Tools.
- **FR68:** Each social media account has a public, unauthenticated page (`/{platform-slug}/{accountId}`) showing all events sourced from that account, with the same search/filter/view capabilities as the main discovery page.
- **FR69:** Any authenticated user can vote for a social media account, either by selecting an existing entry from the ranked list or submitting a new one.
- **FR70:** A submitted new account is validated against the scraper adapter registry and creates a real `SocialMediaAccountProfile` record.
- **FR71:** A global ranked list displays voted accounts by vote count.
- **FR72:** The vote list can be re-sorted to favor accounts popular among voters near the viewer, using the viewer's saved location as a query-time weight only, never stored on the account.
- **FR73:** Region-level vote breakdowns are bucketed at city/province granularity and suppressed below a 5-distinct-voter threshold.
- **FR74:** Voted accounts remain uncategorized until an actual subscription causes them to be scraped.
- **FR75:** Voted accounts appear as ranked autocomplete suggestions when a user adds a BYOK subscription.
- **FR76:** An account is removed from vote ranks once any user subscribes to it, and reappears with its prior vote count intact if that subscription is later removed.
- **FR77:** A widget is a persisted, independently-editable entity (not filters serialized into a URL) that can be configured with any combination of account, type, category, keyword, and location/radius filters; editing it later updates every existing embed automatically.
- **FR78:** The widget supports calendar and card display modes, reusing existing view components.
- **FR79:** The widget supports an explicit dark/light theme choice and renders with a transparent background.
- **FR80:** Clicking an event in the widget only allows adding it to the viewer's calendar via `.ics` export; no detail view or navigation occurs.
- **FR81:** The widget displays a "Powered by FestDaily" button that opens the main app.
- **FR82:** Users can generate a widget's embed snippet by configuring filters, mode, and theme, and registering permitted embedding domain pattern(s) for that specific widget.
- **FR83:** Embedding is restricted to a dynamically-checked, backend-maintained domain whitelist scoped per-widget and to the widget route only.
- **FR84:** The widget reports its content height to the host page via `postMessage` for auto-sizing.
- **FR85:** Users can withdraw their own vote for an account, decrementing its rank.
- **FR86:** Users can deregister an embed domain pattern they registered, immediately revoking its embedding access for that widget.
- **FR87:** A widget's domain whitelist entries are exact hostnames or explicit wildcard patterns (never implicit subdomain inclusion); wildcard patterns are validated against a Public Suffix List and rejected if they'd cover a shared-hosting domain.
- **FR88:** The embed snippet is a script tag plus a placeholder element (supporting multiple different widgets on one page from a single script include); a raw iframe URL is offered as a fallback for embedding contexts that strip script tags.
- **FR89 (added 2026-08-24):** Every scraped post's embedded account information is used to keep the source account's stored display name/username current when they differ from what is stored.
- **FR90 (added 2026-08-24):** If an account has no "Default Location" set, the system infers one automatically from the post's own scraped metadata (caption, attached location name) — never a subscriber's saved location preference — and resolves it into full location details via the existing geolocation lookup before saving it.
- **FR91 (added 2026-08-24):** The location-inference call prefers a contributing subscriber's own BYOK Gemini key, falling back to a platform-funded system key scoped exclusively to this inference use case when no subscriber key is available.
- **FR92 (added 2026-08-24):** Each `DefaultLocationChangeRequest` records whether a subscriber or the system produced the change, so Moderator Tools can distinguish an AI-inferred value from a human edit.
- **FR93 (added 2026-08-24):** A moderator may directly set an account's "Default Location" to a corrected value via the same mechanism a subscriber uses, rather than being limited to accepting or reverting a pending change as-is; a moderator-sourced change requires no further review and automatically supersedes any other still-pending change request for that account.

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
- **NFR13:** All API keys should be restricted at the provider level wherever supported (e.g. Google Cloud Console for Gemini; Geoapify's dashboard for the geolocation adapter).
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
- **NFR25:** The widget's `frame-ancestors` CSP is dynamically scoped to registered domains only, isolated to its own route.
- **NFR26:** A user's saved/current location must never be used to label or infer a social media account's location, even in aggregate; it may only be used as a non-persisted, per-viewer ranking weight.

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
- FR66: Epic 3 - Social Media Event Integration
- FR67: Epic 4 - Data Quality and Moderation
- FR68: Epic 3 - Social Media Event Integration
- FR69: Epic 6 - Community Voting and Embeddable Distribution
- FR70: Epic 6 - Community Voting and Embeddable Distribution
- FR71: Epic 6 - Community Voting and Embeddable Distribution
- FR72: Epic 6 - Community Voting and Embeddable Distribution
- FR73: Epic 6 - Community Voting and Embeddable Distribution
- FR74: Epic 6 - Community Voting and Embeddable Distribution
- FR75: Epic 6 - Community Voting and Embeddable Distribution
- FR76: Epic 6 - Community Voting and Embeddable Distribution
- FR77: Epic 6 - Community Voting and Embeddable Distribution
- FR78: Epic 6 - Community Voting and Embeddable Distribution
- FR79: Epic 6 - Community Voting and Embeddable Distribution
- FR80: Epic 6 - Community Voting and Embeddable Distribution
- FR81: Epic 6 - Community Voting and Embeddable Distribution
- FR82: Epic 6 - Community Voting and Embeddable Distribution
- FR83: Epic 6 - Community Voting and Embeddable Distribution
- FR84: Epic 6 - Community Voting and Embeddable Distribution
- FR85: Epic 6 - Community Voting and Embeddable Distribution
- FR86: Epic 6 - Community Voting and Embeddable Distribution
- FR87: Epic 6 - Community Voting and Embeddable Distribution
- FR88: Epic 6 - Community Voting and Embeddable Distribution
- FR89: Epic 3 - Social Media Event Integration (Story 3.4m, added 2026-08-24)
- FR90: Epic 3 - Social Media Event Integration (Story 3.4m, added 2026-08-24)
- FR91: Epic 3 - Social Media Event Integration (Story 3.4m, added 2026-08-24)
- FR92: Epic 4 - Data Quality and Moderation (surfaced in Moderator Tools per FR67's precedent, added 2026-08-24)
- FR93: Epic 4 - Data Quality and Moderation (implemented via a Story 3.3b amendment, surfaced in Moderator Tools/Story 4.7 per FR92's precedent, added 2026-08-24)

## Epic List

### Epic 0: Project Setup & DevOps

The project is set up with a solid foundation and CI/CD pipeline.
**FRs covered:** N/A (Covers NFRs, ARs, and foundational UX-DRs)

### Story 0.1: Initialize pnpm monorepo

**As a** developer,
**I want** to initialize a pnpm monorepo with a Next.js frontend app and a shared-types package,
**So that** I can start building the FestDaily application with a scalable and maintainable codebase.

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

### Story 0.7a: Build the NavRailItem primitive and its interaction hook

**As a** developer,
**I want** a single `NavRailItem` component (icon/label variant swap, active-indicator, focus ring, 44px hit area) and a paired interaction hook covering hover/focus/touch label-reveal timing, active-route detection, and reduced-motion handling,
**So that** Story 0.7's app shell composes one well-tested nav-item primitive across all three responsive tiers instead of hand-rolling this state machine inline inside the shell.

**Acceptance Criteria:**

*   **Given** the `nav_active_indicator` color token and `components.nav` tokens in `design-artifacts/UX-festgrid-run-1/DESIGN.md`,
*   **When** `NavRailItem` renders at the icon-only tier (768–1279px),
*   **Then** it shows the icon with an `aria-label` matching its full label text, a 44px-minimum hit area, and a tooltip that appears on both `:hover` and `:focus-visible`, stays visible while focused, and dismisses on `Escape` or focus-out.
*   **And** on touch input, a single tap both navigates and flashes the label for at least 2000ms before it fades, never shortened (only extended) under `prefers-reduced-motion`.
*   **And** at the expanded tier (≥1280px) and the mobile bottom-tab tier (<768px), the same component renders icon + visible label without needing the tooltip/flash behavior.
*   **And** the active item (matched via the current route) is indicated by the `nav_active_indicator`-colored leading bar **and** a filled-vs-outline icon-style swap, plus `aria-current="page"`, independent of any visual styling.
*   **And** every item exposes a visible focus ring in a color distinct from the active-indicator, satisfying WCAG 2.4.7.
*   **And** the component and hook stay framework-agnostic per `packages/ui`'s Core Primitives rule — no direct `next-intl` import; the active label text and current-route match are passed in as props (consuming code in `apps/web` resolves them via `useTranslations`/`usePathname`), consistent with the existing `useScopedLocale`/`useScopedTimezone` decoupling pattern.
*   **And** the fade/transition timing respects `prefers-reduced-motion` (instant show/hide fallback).
*   **And** `NavRailItem` supports two variants sharing the same rail-tier chrome (icon sizing, 44px hit area, tooltip, focus ring): a **`link` variant** (`href` + active-route matching, described above — used by the 4 primary nav items) and a **`trigger` variant** (`onActivate` callback + `aria-haspopup`/`aria-expanded` instead of `href`, no active-route matching) — used by the Profile nav item (Story 0.7/2.8), which navigates to `/login` or opens Story 2.8's User Menu rather than being a plain link. The `trigger` variant is excluded from the icon-only rail tier's generic tap-navigates-and-flashes-label behavior — activating it opens/navigates immediately, no flash step (per `EXPERIENCE.md` § Profile item — authentication states).
*   **And** unit/interaction tests cover: hover-only, focus-only, touch-tap-flash, active-state rendering, reduced-motion fallback, and the `trigger` variant's `onActivate`/`aria-haspopup`/`aria-expanded` behavior (testing-trophy approach; Vitest + Testing Library once Story 0.10 lands — see 0.10 sequencing note, same interim-manual-verification precedent as Story 0.7).

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while revising Story 0.7's nav pattern against the UX spec in `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`/`DESIGN.md` (2026-08-05). The nav-item's icon/label-variant + active-indicator + focus-ring + hit-area rendering, combined with a hover/focus/touch-flash timing hook with reduced-motion handling, is non-trivial complex-hook + multi-state-component work per Gate 2's trigger heuristics — not a subtask of 0.7's shell/container work. Story 0.7 depends on this story's output. **Amendment (2026-08-05):** added the `trigger` variant AC after discovering the Profile nav item is an auth-aware trigger (Story 2.8 "User Menu" / Story 1.7 "/login"), not a 5th plain link — it still needs the same rail-tier visual chrome as the other 4 items, just different activation semantics.

**Depends on:** None (pure presentation component + hook, no backend dependency). Story 0.7 depends on this story.

### Story 0.8: Set up GraphQL server scaffold, Code Generator pipeline, and the optimized-select query utility

**As a** developer,
**I want** the GraphQL server foundation, the GraphQL Code Generator pipeline, and the mandated `buildOptimizedDrizzleSelect` utility built once as shared, generic infrastructure,
**So that** every future resolver (events now; schedules, users, locations, subscriptions later) reuses the same query-optimization and type-generation machinery instead of each feature reimplementing it.

**Acceptance Criteria:**

*   **Given** Drizzle ORM and the initial schema exist (Stories 0.4, 1.1),
*   **When** the backend app (`apps/backend`) starts,
*   **Then** a GraphQL server is running with query depth/complexity limits configured to prevent abuse.
*   **And** `GraphQL Code Generator` is configured against the GraphQL schema, generating end-to-end TypeScript types (and typed `graphql-request`/`react-query` hooks) consumed by `apps/web`, so client and server can never silently drift out of sync.
*   **And** a generic, strictly-typed `buildOptimizedDrizzleSelect` function exists in `packages/graphql-select` (a dedicated package, kept separate from `packages/database`'s pure schema/migration/seed concerns so CI jobs like `db-migrate` never need to declare GraphQL dependencies), translating GraphQL resolve-info/AST into an optimized Drizzle `select` that only fetches requested fields.
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

### Story 0.14: Set up AWS IaC for Lambda, SQS, EventBridge, KMS, and SES

**As a** developer,
**I want** infrastructure-as-code provisioning the backend Lambda functions, SQS queues (`ScrapingQueue`, `AIProcessingQueue`, `DataIngestionQueue`), an EventBridge scheduled rule, API Gateway, a KMS key for BYOK key encryption, and AWS SES (Simple Email Service) identity/permissions,
**So that** every backend pipeline story (scraping, queuing, AI processing, ingestion, and email notifications) deploys onto consistently provisioned, version-controlled infrastructure instead of each story inventing its own ad hoc AWS setup.

**Acceptance Criteria:**

*   **Given** the monorepo and CI/CD pipeline exist (Stories 0.1, 0.5),
*   **When** the IaC stack is applied,
*   **Then** the four backend Lambda functions (API, Scraper, AI Processor, Ingestor), the three SQS queues, an EventBridge scheduled rule, API Gateway, a KMS key, and AWS SES configurations/IAM permissions are provisioned and wired together per `docs/infrastructure/high-level-overview.md`.
*   **And** the stack deploys automatically as part of CI/CD (Story 0.5) on merge to the main branch.
*   **And** environment-specific configuration (dev/staging/prod) is supported without duplicating the stack definition.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced while creating Story 3.6 — no IaC/deploy story existed for any of the Lambdas/queues/KMS key that the Epic 3 processing pipeline (Stories 3.4-3.6, 3.6b) and the AI Gateway (Story 0.13) depend on.

### Story 0.15: Set up outbound email adapter

**As a** developer,
**I want** a dedicated outbound email adapter that wraps a transactional email provider (e.g. AWS SES) behind a single interface, with templated messages and delivery via the backend only,
**So that** every feature that needs to notify a user or moderator by email (quota-exhaustion warnings, invalid-key-attempt alerts, dangerous-event moderator alerts) reuses the same sending mechanism instead of each feature integrating its own email client.

**Acceptance Criteria:**

*   **Given** the AWS IaC stack (Story 0.14) provisions the backend Lambdas,
*   **When** a backend Lambda needs to notify a user or moderator by email,
*   **Then** it does so exclusively through this adapter's exposed interface — never a raw SMTP/provider SDK call from feature code.
*   **And** the adapter's sending-service resource and IAM permissions are provisioned via IaC (Story 0.14).
*   **And** the adapter supports templated messages so each consumer supplies only a template key and variables, not raw markup.
*   **And** sending credentials/config are stored per the project's credential-management rules (`.env`, never hardcoded).

**Note:** This story exists because of Gate 1/Gate 3 (`story-split-gate.md`), surfaced by the Epic 0 readiness sweep (`bmad-epic-readiness-check`) — Story 3.10 (Epic 3, quota-exhaustion emails) and Story 4.5 (Epic 4, dangerous-event moderator emails) both require outbound email, and FR35's invalid-API-key-attempt email is a third consumer, but no story anywhere provisioned an email-sending service or adapter.

**Depends on:** Story 0.14.

### Story 0.15a: Add a local-dev stub to the outbound email adapter

**As a** developer,
**I want** `sendTemplatedEmail` (Story 0.15's outbound email adapter) to bypass the real Amazon SES call and instead log the rendered email to the console when SES is unconfigured or the code is running under tests,
**So that** I can develop and test any feature that sends email (quota warnings, invalid-key alerts, moderator alerts) fully AWS-free, without provisioning real SES credentials — mirroring the local/test bypass already established for the BYOK KMS adapter (`kms.ts`).

**Acceptance Criteria:**

*   **Given** Story 0.15's `sendTemplatedEmail(templateKey, to, variables)` adapter exists and normally dispatches a `SendEmailCommand` via `getSesClient()`,
*   **When** `SES_FROM_EMAIL_ADDRESS` is unset, **or** `NODE_ENV === 'test'`,
*   **Then** `sendTemplatedEmail` still renders the requested template but does not call `getSesClient()`/SES at all — it logs the recipient, template key, subject, and rendered body to the console and resolves with a locally-generated stub message ID (e.g. `local-dev-<uuid>`), never throwing.
*   **And** when `SES_FROM_EMAIL_ADDRESS` is set and `NODE_ENV !== 'test'`, behavior is unchanged from Story 0.15 — the real `SendEmailCommand` is dispatched via `SESv2Client`.
*   **And** `sendTemplatedEmail`'s exported signature and every existing call site are unchanged — only its internal local/no-credential branch changes.
*   **And** no local SMTP catcher (Mailpit/Maildev) or `nodemailer` dependency is introduced — this is a console/dev-log stub only, per the explicit scope decision recorded in this story's Dev Notes.

**Note:** This story is a developer-experience addendum to the already-`done` Story 0.15, requested directly by the user (not surfaced by a Gate 1/2/3 finding during another story's creation) — Story 0.15's adapter currently has no local bypass, unlike the BYOK KMS adapter (Story 0.13's `kms.ts`), which already no-ops (mocked encrypt/decrypt) when `BYOK_KMS_KEY_ID` is unset or `NODE_ENV === 'test'`. Classified as a single-story split off Story 0.15 (not a new Epic 0 tooling story) since it only touches that one adapter's internals and has exactly one consumer story.

**Depends on:** Story 0.15.

### Story 0.16: Set up Geolocation adapter with caching layer

**As a** developer,
**I want** a dedicated Geolocation adapter that wraps all outbound calls to the Geoapify Geocoding/Places/Reverse-Geocoding API behind a single interface, with a caching layer for repeated lookups and a restricted, backend-only API key,
**So that** every feature that resolves coordinates, addresses, or timezones (map-based location picking, nearby-event search, timezone inference for extracted events) reuses the same client and cache instead of each feature calling the Geoapify API directly and re-incurring cost/quota.

**Acceptance Criteria:**

*   **Given** a feature needs to resolve a location (address, place ID, or coordinates) or infer a timezone,
*   **When** it needs geolocation data,
*   **Then** it does so exclusively through this Adapter's exposed interface — never the raw Geoapify SDK/HTTP API from feature code.
*   **And** the Adapter caches lookups for the same location so repeated queries are served from cache rather than re-calling the external API (NFR14) — Geoapify's terms explicitly permit indefinite storage/caching of returned place data, so the cache has no forced TTL/expiry beyond what NFR14's cost-management goal requires.
*   **And** the Geoapify API key used by the Adapter is restricted in the Geoapify dashboard (domain/IP referrer restrictions) per the PRD's API key security requirements.
*   **And** the Adapter is backend-only — no direct Geoapify API calls are made from `apps/web`.
*   **And** timezone resolution reuses the same Geoapify geocode/reverse-geocode response (Geoapify returns an IANA `timezone.name` field inline) rather than requiring a separate Time-Zone-specific API call, unlike the Google-based design this story originally assumed.

**Note:** This story exists because of Gate 3 (`story-split-gate.md`), surfaced by the Epic 0 readiness sweep (`bmad-epic-readiness-check`) — Story 2.4 (Epic 2, map-based/current-location picking) and FR33 (Epic 3, timezone inference) both depend on a geolocation service, and NFR14 mandates a caching layer, but no story anywhere set up this adapter, mirroring the AI Gateway adapter (Story 0.13) built for Gemini. Provider changed from Google Geolocation/Places to Geoapify per Sprint Change Proposal 2026-08-03 — see that document for rationale (storage/caching ToS compliance, native timezone-in-response, single-key autocomplete+places+geocoding).

### Story 0.17: Set up GraphQL authenticated-context layer

**As a** developer,
**I want** the GraphQL server to verify a caller's Supabase Auth session/JWT on incoming requests and expose the authenticated user's identity and role via resolver context,
**So that** every mutation or query that requires "the current user" (favoriting, saved locations, subscriptions, reports, moderator actions) can enforce ownership/authorization consistently instead of each feature story inventing its own verification.

**Acceptance Criteria:**

*   **Given** the GraphQL server scaffold (Story 0.8) and Supabase Auth-based login (Story 1.7) exist,
*   **When** an authenticated client sends a GraphQL request carrying its Supabase session token,
*   **Then** the server verifies the token and populates resolver context with the caller's `userId` (matching the `users` table, Story 1.1) — never trusting a client-supplied user ID.
*   **And** requests without a valid session expose `context.user` as `null`, and resolvers/mutations that require authentication reject unauthenticated calls with a clear, consistent error.
*   **And** the `users` table (Story 1.1) gains a `role` column (default `user`, supporting a `moderator` value per the PRD's "moderator access levels are assigned manually via the database" MVP scope), so resolver context also exposes the caller's role.
*   **And** a reusable authorization helper (e.g. `requireAuth`/`requireModerator`) is exported for resolvers to import, rather than each resolver hand-rolling its own check.

**Note:** This story exists because of Gate 1/Gate 3 (`story-split-gate.md`), surfaced by the Epic 1 readiness sweep (`bmad-epic-readiness-check`) — Story 1.7 wires Supabase Auth into the frontend for identity/session only; no story defines how the backend GraphQL server verifies that session and exposes the caller's identity/role to resolvers. Story 2.1 (Epic 2, favorite/unfavorite), Story 3.2 (Epic 3, subscriptions), and Stories 4.1/4.3/4.6/4.7 (Epic 4, corrections/reports/moderation) all assume this layer exists. Placed in Epic 0 (despite originating from Epic 1's Story 1.7) following the Story 0.13 precedent — a foundation reusable/needed across ≥2 other epics belongs in Epic 0 even when it forward-depends on a later epic's story.

**Depends on:** Story 0.8, Story 1.1, Story 1.7.

### Story 0.18: Build the reusable Soft-Delete-with-Undo UI primitive

**As a** developer,
**I want** a reusable, generic UI primitive implementing `EXPERIENCE.md`'s "Soft Delete with Undo" state pattern (greyed-out/pending item, a toast with an "Undo" action, deferred commit-on-navigate-away),
**So that** any feature that lets a user reversibly remove/unfavorite/delete an item from a list (Favorites, Saved Locations, API Keys, Subscriptions) can reuse one consistent, tested mechanism instead of each feature story re-implementing the same commit-on-unmount plumbing and introducing its own toast handling ad hoc.

**Acceptance Criteria:**

*   **Given** `EXPERIENCE.md`'s "Soft Delete with Undo" State Pattern (Initial State → Trigger → Intermediate State → Undo Action → Final State/Commit),
*   **When** a consuming feature marks an item as "pending removal" via this primitive (e.g. `useSoftDeleteWithUndo`, `packages/ui/src/hooks/`),
*   **Then** the hook exposes a `pending` boolean/set per item so the consumer applies its own visual treatment (greyed-out card, strikethrough table row, etc.) — the primitive does not dictate item markup, since consumers render different shapes (event cards, table rows, list rows).
*   **And** marking an item pending surfaces a toast notification (introducing a toast library, e.g. `sonner` — none exists in the codebase today) with an "Undo" action.
*   **And** clicking "Undo" (in the toast or an equivalent in-row control the consumer renders) reverts the item to its normal state and cancels the pending removal; no backend call is ever made for that item.
*   **And** if the user navigates away from the page (component unmount) while one or more items are still "pending removal" (never undone), the primitive invokes a consumer-supplied async commit callback exactly once per still-pending item — the primitive itself has no knowledge of GraphQL/mutations; the consumer supplies the commit function.
*   **And** the primitive is exposed as `useSoftDeleteWithUndo` (`packages/ui/src/hooks/`) plus its toast-wiring component (`packages/ui/src/core/`), reusable across features with no feature-specific coupling.
*   **And** it has its own integration test suite (Vitest) covering: mark-pending → visual/toast state, Undo cancels with no commit call, unmount commits all still-pending items exactly once, multiple concurrent pending items are tracked independently.

**Note:** This story exists because of Gate 3 (`story-split-gate.md`), surfaced while creating Story 2.2 — `EXPERIENCE.md`'s "Soft Delete with Undo" pattern (State Patterns section) explicitly names "deleting a saved location, an API key, a subscription, or unfavoriting an event from a list" as its scope, but no story anywhere builds this reusable primitive, and no toast library exists in the codebase (confirmed absent from `packages/ui` and every `package.json`). Story 2.2 (Epic 2, favorites list) is the first concrete consumer; Stories 2.3/2.4 (saved locations) and future API-key/subscription-management stories (Epic 3/4) are anticipated consumers of the same pattern. Placed in Epic 0 as a new sequential story following the Story 0.13/0.17 precedent — a foundation reusable across ≥2 future features belongs in Epic 0 even though its first concrete need surfaces mid-Epic-2.

**Depends on:** Story 0.3, Story 0.9.

### Story 0.19: Build the reusable Swipe-to-Reveal-Action UI primitive

**As a** developer,
**I want** a reusable, generic UI primitive implementing `DESIGN.md`'s mobile swipe gesture (`UX-DR15`) — a swipeable list-item wrapper that reveals a consumer-supplied action button (e.g. "Delete") on horizontal swipe past a reveal threshold, with snap-back if released early,
**So that** any list item across the app (Favorites, Saved Locations, API Keys, Subscriptions) that needs a mobile delete/action affordance can reuse one consistent, tested, accessible gesture mechanism, and the revealed action can trigger any downstream mechanism (e.g. Story 0.18's Soft-Delete-with-Undo) without coupling the gesture itself to what it triggers.

**Acceptance Criteria:**

*   **Given** `DESIGN.md`'s `UX-DR15` ("On mobile, a swipe gesture on a list item reveals a 'Delete' button") and `EXPERIENCE.md`'s "Swipe-to-delete" interaction primitive,
*   **When** a user swipes a list item horizontally on a touch interface past a reveal threshold,
*   **Then** a consumer-supplied action button slides into view within the item's bounds, the item's content shifting to make room — the primitive does not dictate what the revealed button does or looks like beyond a generic action slot, since different consumers trigger different mechanisms (Story 0.18's `markPending`, a direct delete, etc.).
*   **And** releasing the swipe before the reveal threshold snaps the item back to its resting position with no action taken.
*   **And** clicking the revealed action button invokes a consumer-supplied `onAction` callback exactly once — the primitive has no knowledge of Soft-Delete-with-Undo, GraphQL, or any other downstream mechanism.
*   **And** the same action is reachable via an always-visible or hover-revealed control for non-touch (keyboard/mouse) input — never swipe-only — per WCAG 2.1 AA (`project-context.md`).
*   **And** swipe direction mirrors for RTL layouts, per `project-context.md`'s Component Design i18n rule.
*   **And** it is exposed as a reusable component (e.g. `SwipeToReveal`, `packages/ui/src/core/`) accepting the item's normal content as children plus an action slot, reusable across features with no feature-specific coupling.
*   **And** it has its own integration test suite (Vitest + Testing Library, simulated pointer/touch events) covering: swipe past threshold reveals the action, swipe below threshold snaps back, clicking the revealed action invokes `onAction` exactly once, the non-touch equivalent control is present and functional, RTL mirrors direction.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while creating Story 0.18 — `DESIGN.md`'s `UX-DR15` and `EXPERIENCE.md`'s "Swipe-to-delete" primitive are both explicitly named as generic across every list in the app, but no story anywhere builds this reusable gesture mechanism. Story 0.18 deliberately keeps its own hook trigger-agnostic (a button click or a swipe reveal both just call `markPending`) and explicitly excludes the swipe gesture itself from its scope. Placed in Epic 0 as a new sequential story following the Story 0.13/0.17/0.18 precedent — a foundation reusable across ≥2 future features belongs in Epic 0 even though no feature story currently consumes it yet (mirrors the "reserved slot, not implemented" pattern).

**Depends on:** Story 0.3.

### Story 0.20: Create geolocation cache database table

**As a** developer,
**I want** to create a `geolocation_cache` table in the database,
**So that** the Geolocation adapter (Story 0.16) has a persistence layer to cache coordinates, timezones, and address resolutions per NFR14, avoiding repeated external API calls and quota exhaustion.

**Acceptance Criteria:**

*   **Given** the Drizzle ORM migration tool is set up (Story 0.4),
*   **When** I run the migration script,
*   **Then** a `geolocation_cache` table is created with columns mapping to the `LocationDetails` interface (e.g. place ID, coordinates, formatted address, timezone), plus a primary key and created/updated timestamps.
*   **And** the table is optimized for lookups by place ID or address string.
*   **And** no direct GraphQL API is exposed for this table, as it is strictly backend-internal infrastructure for the Geolocation adapter.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 0 readiness sweep (`bmad-epic-readiness-check`) — Story 0.16 mandates a caching layer for Geoapify, but no storage infrastructure (table or ElastiCache) was provisioned anywhere to store it. Added to Epic 0 as it is foundational infrastructure.

**Depends on:** Story 0.4.

**SUPERSEDED (2026-08-04):** When Story 0.16 was fully regenerated for the Google→Geoapify provider swap (Sprint Change Proposal 2026-08-03), its regenerated Task 3 absorbed this exact table-creation scope directly (`geolocationQueryTypeEnum` + `geolocationCache` table — `id`, `cache_key` unique/indexed, `query_type`, `result jsonb`, timestamps — via a committed `drizzle-kit generate` migration, with its own cache-store round-trip tests), fully satisfying this story's three ACs. Confirmed with the user during `bmad-create-story 0-20` (2026-08-04) rather than drafting a duplicate story file. No independent implementation of Story 0.20 is needed — its scope is tracked to completion via Story 0.16 Task 3 instead. See `sprint-status.yaml`'s `0-20-*` entry.

### Story 0.21: Set up FCM device token registry

**As a** developer,
**I want** an `fcm_tokens` table and a GraphQL mutation resolver to register/unregister device tokens,
**So that** the backend can reliably map a user to their active devices when sending push notifications (Story 0.12) and clean up inactive tokens.

**Acceptance Criteria:**

*   **Given** the GraphQL server scaffold (Story 0.8) and FCM SDK setup (Story 0.12) exist,
*   **When** the migration script runs,
*   **Then** an `fcm_tokens` table is created (`token` PK, `user_id` FK, `created_at`, `updated_at`).
*   **And** a `registerFcmToken(token: String!)` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17), which upserts the token for the current user.
*   **And** a `unregisterFcmToken(token: String!)` mutation is exposed to allow clients to explicitly remove a token on logout.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 0 readiness sweep (`bmad-epic-readiness-check`) — Story 0.12 establishes the FCM SDKs but omits the actual database table and API surface needed to store device tokens, meaning notifications could not actually be routed to users. Added to Epic 0 as it completes the FCM foundation.

**Depends on:** Story 0.8, Story 0.12, Story 0.17.

### Story 0.22: Build the shared active-rows query-filter helper for AD-8

**As a** developer,
**I want** a single shared `activeOnly(table)` Drizzle where-fragment helper (`packages/graphql-select`) that every resolver imports instead of hand-writing `isNull(table.deletedAt)`,
**So that** AD-8 rule 2's "enforced once, never per-resolver" requirement is actually true, rather than the six independent hand-written call sites it is today.

**Acceptance Criteria:**

*   **Given** AD-8 rule 2 (Architecture Spine),
*   **When** a resolver needs to exclude soft-deleted rows,
*   **Then** it imports `activeOnly(table)` from `@festgrid/graphql-select` rather than writing `isNull(table.deletedAt)` inline.
*   **And** the six existing hand-written sites in `apps/backend/src/schema/resolvers.ts` (favorites/calendarAdditions filtering) are retrofitted to use the helper — behavior-preserving, no functional change, pure refactor.
*   **And** `myLocations` (Story 2-3a) uses the helper rather than a one-off inline filter, once sequenced against this story.
*   **And** the helper works both for resolvers going through the Unified Query DSL (`buildDrizzleWhere`/`buildOptimizedDrizzleSelect`, AD-1/AD-2) and hand-written Drizzle queries like `myLocations` that don't — a plain composable where-fragment, not DSL-coupled.

**Note:** This story exists because of the AD-8 extension recorded in `sprint-change-proposal-2026-08-06.md` (soft-delete-with-undo browser-tab-close bug fix) — the Reviewer Gate that vetted that AD-8 extension found rule 2's "enforced once" claim was never actually true in shipped code (six hand-written `isNull()` call sites, no shared enforcement point). Added to Epic 0 as cross-cutting query-layer infrastructure, not specific to any one feature.

**Depends on:** none (self-contained refactor + new helper). Story 2-3a benefits from sequencing after this story lands, but is not blocked by it (can ship its own inline filter now and be retrofitted later if sequencing runs the other way).

### Story 0.23: Build the system error reporting and alerting foundation

**As a** developer,
**I want** a generic, reusable backend mechanism — a `reportSystemError` GraphQL mutation and resolver — for reporting critical client-side errors (Service Worker registration failures, IndexedDB conflicts, or other unrecoverable frontend failures) that dispatches a developer/administrator alert email,
**So that** any current or future feature experiencing an unrecoverable client-side failure notifies the team through one shared, consistently-built pathway instead of each feature inventing its own error-alerting mutation and email template.

**Acceptance Criteria:**

*   **Given** Story 0.15's Outbound Email Adapter and its `EmailTemplateKey` enum (`QUOTA_EXHAUSTION_WARNING`, `INVALID_API_KEY_ALERT`, `DANGEROUS_EVENT_MODERATOR_ALERT`),
*   **When** this story ships,
*   **Then** a 4th key, `SYSTEM_ERROR_ALERT`, is added with its own template (subject/html/text) rendering the error's source, message, and timestamp to the configured developer/administrator email address.
*   **And** a `reportSystemError(input: ReportSystemErrorInput!): Boolean!` mutation is added to the backend GraphQL schema, where `ReportSystemErrorInput` carries `source: String!` (e.g. `"service-worker"`, `"indexeddb"`), `message: String!`, and an optional `context: String` (e.g. serialized error details), each validated with AJV per the project's runtime-schema-validation rule (length-capped to prevent abuse, since this endpoint is reachable by any client regardless of auth state).
*   **And** the resolver maps the validated input to the `SYSTEM_ERROR_ALERT` template and dispatches it exclusively through Story 0.15's Outbound Email Adapter interface — this story never calls a raw SMTP/provider SDK directly.
*   **And** the mutation does not require `requireAuth` (Story 0.17) — unlike billed/quota-limited queries such as `addressAutocomplete`/`reverseGeocodePreview` — since a client can hit a critical Service Worker/IndexedDB failure before or without ever authenticating (e.g. during background FCM token registration), and it is still protected by the project-wide GraphQL depth/complexity limits.
*   **And** a delivery failure inside the adapter (e.g. SES misconfiguration) is caught and logged server-side rather than thrown back to the caller, so a broken alerting path can never itself become a second client-facing failure.
*   **And** no product feature calls this mutation in this story — it is a reserved, ready-to-consume capability, mirroring the "reserved slot" pattern of Stories 0.7/0.8/0.9/0.12/0.13/0.15. Story 2.10 ("Service Worker Lifecycle Updates and Database Self-Healing") is its first consumer.

**Note:** This story exists because of Gate 1 and Gate 3 (`story-split-gate.md`), surfaced while drafting Story 2.10 — Story 2.10's self-healing flow needed to alert developers by email on critical failures, but (a) Story 0.15 (Gate 1: the adapter it would call) is unimplemented and its template registry has no generic system/developer-error concept, and (b) the `reportSystemError` mechanism itself is inherently cross-cutting (Gate 3: any future story with a critical client-side failure would reasonably reuse the same mutation, not each invent its own). Rather than let Story 2.10 build this ad hoc as a byproduct of its push-notification scope, it is split into its own Epic 0 foundation story, numbered sequentially after Story 0.22. See Story 2.10's Architecture & UX Gate Findings for the originating analysis.

**Depends on:** Story 0.15.

### Story 0.24: Build the reusable Wizard page primitive

**As a** developer,
**I want** a generic, reusable `/wizard/[wizardKey]/[stepSlug]` page mechanism — a typed wizard registry keyed by `wizardKey`, a `WizardStepSummary`/`WizardNavigation` chrome, and a `useWizardStep()` hook — driven by a per-wizard step configuration (not a URL-query-param-encoded steps array, so each wizard's step titles/descriptions can be sourced through next-intl and each step page can set its own locale-aware `generateMetadata`),
**So that** any current or future multi-step flow (Story 3.1's onboarding wizard now, Story 5.5's manual-post-selection step later, and the PRD §3.10 "guide the user through the wizard first" gate from the user menu) registers once and reuses the same generic chrome instead of each feature building its own step summary/navigation.

**Acceptance Criteria:**

*   **Given** `design-artifacts/UX-wizard-page-run-1/DESIGN.md`/`EXPERIENCE.md` (status: final), **when** a new wizard flow is needed, **then** it is added as one entry in a typed wizard registry (e.g. `apps/web/src/features/wizard/wizard-registry.ts`) keyed by a `wizardKey` string, each entry defining an ordered array of steps (`slug`, an i18n key path, `canSkipStep?`, and the step's content component) and a `defaultExitPath`.
*   **And** the route `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx` renders the wizard chrome (Step Summary + Navigation) around the matched step's content component, looked up from the registry; an unknown `wizardKey`/`stepSlug` renders `notFound()`.
*   **And** Step Summary visually distinguishes Completed (checkmark, solid blue background), Current (blue border), and Upcoming (disabled/grayed) states per `DESIGN.md`; Navigation renders `Previous Step` (secondary, disabled on the first step), `Next Step` (primary, disabled unless `isStepCompleted`), `Skip Step` (only when the current step's `canSkipStep` is true), and `Complete` (primary, final step only, disabled unless `isStepCompleted`), matching `DESIGN.md`'s button states.
*   **And** a `useWizardStep()` hook, backed by a `WizardStepProvider` the chrome wraps each step's content in, returns `{ isStepCompleted, setStepCompleted }` per `EXPERIENCE.md`'s contract — the step's own content component calls `setStepCompleted(true)` once its step's action succeeds, which is what enables the Next/Complete button.
*   **And** the page a user should return to after completing the wizard is carried via a `redirect` search param (e.g. `?redirect=/settings/subscriptions`) set by whichever feature redirects the user into the wizard; `Complete` navigates to that value if present, else the wizard's `defaultExitPath`. A redirecting feature that needs to skip an already-satisfied step links directly to that step's `[stepSlug]` segment (e.g. `/wizard/onboarding/subscribe`) rather than a numeric `currentStep` query param.
*   **And** every wizard-chrome string (Previous/Next/Skip/Complete labels) is sourced through a shared `WizardChrome` next-intl namespace, and every step's title/description through a `Wizards.<wizardKey>.steps.<stepSlug>` namespace — both present in `apps/web/locales/en.json` and `apps/web/locales/id.json` — no hardcoded strings.
*   **And** `page.tsx` sets the browser tab title/meta description via `generateMetadata` (next-intl server-side `getTranslations`, via `apps/web/src/lib/metadata.ts`'s `buildPageMetadata`) resolving `Metadata.wizard<WizardKeyPascalCase>Title`/`...Description` — never a client-side title mutation, per `project-context.md`'s Dynamic Page Title & Meta Tags rule.
*   **And** this story registers the chrome/hook/route mechanism only, with zero wizard entries wired to a real consumer yet — the first real registry entry (`onboarding`, its steps, its i18n content) is Story 3.1's scope, mirroring the "reserved slot" pattern already used by Stories 0.7/0.8/0.13/0.23.

**Note:** Classified as a Gate 3 gap surfaced by a lightweight, story-specific guard while drafting Story 3.1 (2026-08-07) — the swept `epic-3-readiness.md` (`swept: true`) did not evaluate this gap since it is UI/design-artifact-shaped rather than backend-architecture-shaped, outside that sweep's scope. `design-artifacts/UX-wizard-page-run-1/EXPERIENCE.md` (status: final) specifies a generic, dynamic `/wizard` page as its own dedicated page pattern, and Story 5.5 ("Integrate manual post selection into the getting started wizard," Epic 5) explicitly extends the *same* wizard instance Story 3.1 creates — confirmed cross-epic reuse, the same bar that promoted Stories 0.13/0.15/0.16/0.17 to Epic 0. A Gate 2 pass (persona Freya) confirmed the wizard chrome is non-trivial UI (three-state Step Summary, four-button Navigation, a stateful hook combining route-derived config with derived completion state) that would otherwise be built ad hoc inside Story 3.1's onboarding-specific scope — the exact failure mode `story-split-gate.md` exists to prevent. Per user decision (`AskUserQuestion`, 2026-08-07), the original `EXPERIENCE.md` design (a single global `/wizard` page configured entirely via a URL-query-param-encoded `steps` JSON array) was revised to a typed, code-defined wizard registry keyed by `wizardKey` instead — the query-param design cannot cleanly support per-step, per-locale `generateMetadata`/i18n (title/description strings would have to be embedded directly in the URL, unable to route through next-intl), which conflicts with `project-context.md`'s mandatory Dynamic Page Title & Meta Tags rule. Positioned as a new sequential Epic 0 story following the Story 0.23 precedent (foundational, reusable across ≥2 future features, reserved-slot until a real consumer registers).

**Depends on:** Story 0.6, Story 0.7.

### Story 0.25: Wire backend environment variables into the deployed API Lambda's IaC configuration

**As a** developer,
**I want** every `apps/backend` runtime environment variable (`DATABASE_URL`, `SES_FROM_EMAIL_ADDRESS`, `GEOAPIFY_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `BYOK_KMS_KEY_ID`, and `SYSTEM_ERROR_ALERT_EMAIL`) explicitly sourced and wired into the deployed `L_API` Lambda's CDK environment configuration — non-secret values as plain environment properties, secret values via AWS Secrets Manager/SSM `SecureString` references per the project's credential-management rule — with a single reconciled `L_API` execution role (folding Story 0.15's standalone `FestgridEmailStack` into `FestgridBackendStack`, or granting it verified cross-stack access) instead of two independently-deployed roles,
**so that** every backend feature that already reads its config via `apps/backend/src/env.ts`'s local-`.env`-loading convention also works correctly once actually deployed, instead of each story silently assuming "IaC will handle it" with no story ever owning that wiring.

**Acceptance Criteria:**

*   **Given** Story 0.14's CDK stack (`FestgridBackendStack`) defines the `L_API` Lambda, **when** the stack is synthesized, **then** its environment configuration explicitly includes every var currently read by `apps/backend/src/env.ts`'s `BackendEnv` (as of this story's creation: `DATABASE_URL`, `SES_FROM_EMAIL_ADDRESS`, `GEOAPIFY_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `BYOK_KMS_KEY_ID`, `SYSTEM_ERROR_ALERT_EMAIL`) — re-derive this list from `env.ts` at implementation time rather than trusting this static snapshot, since later Epic-0 stories may add more vars before this one is implemented.
*   **And** non-secret values (e.g. `SES_FROM_EMAIL_ADDRESS`, `SYSTEM_ERROR_ALERT_EMAIL`) are passed as plain CDK Lambda `environment` properties; secret values (`DATABASE_URL`, `FIREBASE_PRIVATE_KEY`, any API key) are sourced from AWS Secrets Manager or SSM `SecureString` parameters and injected via CDK's secret-reference mechanism — never a literal secret value in source or in a plain CDK environment property, per `project-context.md`'s Credential Management rule.
*   **And** this story reconciles Story 0.15's fallback standalone `apps/infrastructure/lib/email-identity-stack.ts` (`FestgridEmailStack`, created because Story 0.14 hadn't landed yet) with `FestgridBackendStack` — folding the SES `EmailIdentity` + IAM grant into the single backend stack (preferred) or explicitly granting `L_API`'s one real execution role verified cross-stack access — so exactly one deployed `L_API` execution role exists with every required grant (SES send, KMS decrypt, DB access), never two independently-deployed roles as today.
*   **And** a CDK assertion test (`aws-cdk-lib/assertions`) proves each declared var is present in `L_API`'s environment configuration or correctly references its Secrets Manager/SSM ARN, and that exactly one `L_API` execution role exists with the SES grant attached.
*   **And** `SETUP_WALKTHROUGH.md` is updated to document which vars are plain-environment vs. secret-sourced, and the one-time step of populating the corresponding Secrets Manager/SSM entries per environment (dev/staging/prod).

**Note:** Added 2026-08-07 via `bmad-create-story` Gate 1 finding while drafting Story 0.23 — Story 0.23's own new `SYSTEM_ERROR_ALERT_EMAIL` env var surfaced that **no** backend env var (not just this new one) is currently wired into a deployed Lambda's environment config, since Story 0.14 (which will define the `L_API` Lambda resource itself) hasn't landed yet; today every var only works via local `.env`/`dotenv.config()`. Presented to the user via `AskUserQuestion` as a real tradeoff (accept as an already-known, Story-0.14-owned forward dependency vs. split into its own story) — user chose to split it off explicitly rather than let it stay an implicit, unowned assumption. Scoped generically across every current backend env var (not just Story 0.23's own addition) since the gap is identical for all of them. See Story 0.23's Architecture & UX Gate Findings for the originating analysis.

**Depends on:** Story 0.14 (the `L_API` Lambda resource must exist before its environment configuration can be wired). Story 0.15 (reconciles its fallback `FestgridEmailStack`).

### Story 0.26: Build the reusable RouteLoader component and wire it into every route Suspense boundary

**As a** developer,
**I want** a shared, generic loading component used as the fallback for every route-page's top-level Suspense boundary,
**So that** navigating to any route (or opening the event-detail modal) shows a consistent, on-brand loading state instead of a blank flash, without each route building its own fallback (project-context.md's "Route-Level Suspense Fallback" rule, PRD §3.12 "Global UI & Navigation Patterns").

**Acceptance Criteria:**

*   **Given** the existing `Logo` component (`packages/ui/src/core/app-shell/Logo.tsx`), **when** this story is implemented, **then** its icon-only 2x2 grid logomark is extracted into a new `LogoMark` component (same package/folder) with no behavior change to `Logo`, which now composes `LogoMark` instead of duplicating its markup.
*   **And** a new `RouteLoader` component is added to `packages/ui/src/core/` that centers a `LogoMark` and fills its containing element (`w-full h-full flex items-center justify-center` sizing, driven by the parent — never `fixed`/viewport-locked), with a "beating" (pulse/scale) CSS animation applied to the mark — implemented as a new Tailwind keyframe (there is currently no custom pulse/heartbeat keyframe in `apps/web/tailwind.config.ts`, only Tailwind's default opacity `animate-pulse`).
*   **And** container-relative sizing is verified in both real usage contexts: (a) full-page routes, where it fills the content area beneath the persistent `AppShellWrapper` nav rail (the shell wraps `{children}` in the root `layout.tsx`, outside each page's own Suspense, so it never unmounts during route loads); and (b) the intercepted modal route (`@modal/(.)events/[slug]/page.tsx`), where the `Dialog`/`DialogContent` (`max-w-3xl max-h-[85vh]`) opens immediately and independent of data — `RouteLoader` must render within that bounded box, not break out to the full viewport.
*   **And** `RouteLoader` respects `prefers-reduced-motion` (renders the static `LogoMark` with no animation when the user's OS/browser signals reduced motion), consistent with the accessibility bar set by `BlockingLoader` (Story 1.7a).
*   **And** it is documented and exported from `packages/ui`'s public entry point for reuse across features.
*   **And** every existing route-page's top-level `<Suspense>` (currently fallback-less) is updated to pass `fallback={<RouteLoader />}`: `apps/web/src/app/[locale]/page.tsx`, `favorites/page.tsx`, `login/page.tsx`, `my-calendar/page.tsx`, `settings/locations/page.tsx`, `settings/notifications/page.tsx`, `events/[slug]/page.tsx`, and the modal-intercepted `@modal/(.)events/[slug]/page.tsx`. (`test-swipe/page.tsx` is a dev-only test harness, not a real route, and is out of scope.)
*   **And** any route-page created by a future story (Epics 3-5) follows the same rule per project-context.md — no further tracking needed here, enforced going forward by the rule itself.

**Note:** Added 2026-08-07 via `bmad-correct-course` (see `sprint-change-proposal-2026-08-07.md`). Positioned in Epic 0 alongside the project's other reusable-UI-primitive stories (0.7, 0.7a, 0.18, 0.19, 1.7a), but — unlike those — this story's own tasks also retrofit 8 already-built/in-review route files across Epics 1 and 2, since the Suspense boundaries it fills already exist in shipped code (Story 1.9). User confirmed via AskUserQuestion: Story 0.26 owns the full retrofit directly rather than reopening each of the 8 consuming stories individually. The container-relative (not viewport-fixed) sizing requirement was surfaced by the user specifically for the modal case and confirmed before finalizing this proposal.

**Depends on:** None (pure presentation component + mechanical wiring; no backend dependency).

### Story 0.27: Provision the notifier Lambda's infrastructure and SES send permission

**As a** developer,
**I want** a new `L_Notifier` Lambda function (a reserved slot, no business logic yet) wired to a daily EventBridge schedule rule, with `DATABASE_URL` environment access and `ses:SendEmail`/`ses:SendRawEmail` IAM permission scoped to the single SES `EmailIdentity` construct Story 0.25 establishes,
**So that** any future scheduled/batch notification story — starting with Story 3.10's quota-exhaustion warning emails — has a ready-to-consume, correctly-permissioned Lambda to implement its logic in, instead of each such story inventing its own IaC wiring or discovering mid-implementation that SES access was never actually granted to it.

**Acceptance Criteria:**

*   **Given** Story 0.14's `FestgridBackendStack` (existing `L_API`/`L_Scrape`/`L_AI`/`L_Ingest` Lambdas, SQS queues, and the `ScraperScheduleRule` EventBridge pattern) and Story 0.25's reconciled single SES `EmailIdentity` + IAM-grant construct,
*   **When** the stack is synthesized,
*   **Then** a new `L_Notifier` Lambda (`apps/backend/src/lambdas/notifier.ts`, a minimal reserved-slot handler that returns successfully with no real logic yet) is provisioned in `festgrid-backend-stack.ts`, mirroring the existing `sharedLambdaProps`/`NodejsFunction` pattern used by `L_Scrape`/`L_AI`/`L_Ingest`.
*   **And** a new EventBridge `events.Rule` (`NotifierScheduleRule-${stageName}`) triggers `L_Notifier` on a daily `events.Schedule.rate(cdk.Duration.days(1))` cadence, mirroring `ScraperScheduleRule`'s exact construct shape.
*   **And** `L_Notifier`'s environment includes `DATABASE_URL`, sourced the same way as the other Lambdas.
*   **And** `L_Notifier`'s execution role is granted `ses:SendEmail`/`ses:SendRawEmail`, scoped to Story 0.25's single `EmailIdentity` construct — not a second, independently-created SES identity.
*   **And** a CDK assertion test (`aws-cdk-lib/assertions`) proves: exactly one `L_Notifier` function exists, its EventBridge rule target is correctly wired to it, and its execution role's IAM policy includes the scoped SES send actions.
*   **And** this story ships zero real notification logic — `notifier.ts`'s handler is a reserved slot; Story 3.10 is its first and only consumer.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced while drafting Story 3.10 (Epic 3, quota-exhaustion emails) — that story needs a new scheduled Lambda with real SES send permission, but no story anywhere provisions one: Story 0.14 only provisioned the four Lambdas known at its own authoring time (API, Scraper, AI Processor, Ingestor), and Story 0.25's SES reconciliation is scoped only to `L_API`'s own execution role. Rather than let Story 3.10 silently invent its own ad hoc IaC changes, this is split into its own Epic 0 "reserved slot" foundation story, following the Story 0.13/0.15/0.23 precedent. User confirmed via `AskUserQuestion` during Story 3.10's creation to split this off narrowly (scoped only to the new Lambda's own resource/grant) rather than fold it into Story 3.10's own scope or rely solely on Story 0.25, since 0.25 already independently tracks the broader `L_API`-only SES reconciliation and doesn't anticipate a Lambda that doesn't exist yet.

**Depends on:** Story 0.14, Story 0.25.

### Story 0.28: Set up shadcn/ui component generation for packages/ui

**As a** developer,
**I want** `packages/ui` to have its own shadcn/ui `components.json` and the underlying Radix/date-picker dependencies it needs (`@radix-ui/react-popover`, `react-day-picker`, `date-fns` or equivalent),
**So that** reusable `packages/ui` components (Story 1.3g's `WeekPicker`, Story 1.5's `FilterHub` dropdown popovers) can be built on the shadcn-sanctioned `Button`+`Popover`(+`Calendar`) composition without either duplicating `apps/web`'s own shadcn setup ad hoc or, worse, having `packages/ui` import from `apps/web` (the wrong dependency direction — `packages/ui` is a dependency of `apps/web`, never the reverse).

**Acceptance Criteria:**

*   **Given** `apps/web/components.json` already configures shadcn CLI output into `apps/web/src/components/ui/` (with a `@/lib/utils` → `cn()` helper and a `@/*` → `./src/*` tsconfig path alias it relies on), and `packages/ui` currently has zero shadcn/Radix components, no `components.json`, no `cn()` utility, no `@/*` path alias, and no `@radix-ui/*`/`clsx`/`tailwind-merge`/`class-variance-authority` dependency — while `apps/web/tailwind.config.ts` already scans `packages/ui/src/**/*.{ts,tsx}` for Tailwind classes, so no separate Tailwind config is needed inside `packages/ui` itself,
*   **When** this story adds a `@/*` → `./src/*` path alias to `packages/ui/tsconfig.json` (mirroring `apps/web`'s exact convention) and creates `packages/ui/src/lib/utils.ts` with the same `cn()` helper (`clsx` + `tailwind-merge`) as `apps/web/src/lib/utils.ts`, then adds a new `packages/ui/components.json` targeting `packages/ui/src/core/ui/` as its primitive-output directory (matching `apps/web`'s convention of a dedicated `ui/` subfolder for CLI-generated files, separate from `packages/ui`'s existing hand-authored `core/` components) with `aliases.utils` pointing at `@/lib/utils`,
*   **Then** `packages/ui/src/core/ui/button.tsx`, `popover.tsx`, and `calendar.tsx` are generated via `pnpm --filter @festgrid/ui exec shadcn add button popover calendar` (all three, since AD-9's composition is `Button` (trigger) + `Popover` + `Calendar` — not just the latter two), and `packages/ui/package.json` gains the CLI's resulting dependencies as **direct** dependencies (not devDependencies, since `packages/ui` ships un-bundled — see below): `@radix-ui/react-popover`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `react-day-picker`, and whatever date-utility dependency the `calendar` component's generated code imports (commonly `date-fns` — confirm against the actual CLI output, do not assume a version ahead of time).
*   **And**, since `packages/ui` has **no separate build/bundle step** (`package.json`'s `main`/`types` point directly at `src/index.ts`; it ships as raw TypeScript source, transpiled by `apps/web`'s own Next.js/Turbopack build — confirmed via `packages/ui/package.json` and the absence of any `tsup`/`rollup`/bundler config), there is no build-config include/exclude pattern to update for the new files — this AC exists to document that fact, not to change a build config that doesn't exist.
*   **And** `packages/ui`'s existing hand-rolled `core/` primitives (`checkbox.tsx`, `multi-select.tsx`, `blocking-loader.tsx`, etc.) are left untouched — this story only adds the new CLI-generated `core/ui/` subfolder and the new `lib/utils.ts` alongside them, it does not migrate/replace any existing component to use the new primitives.
*   **And** `pnpm --filter @festgrid/ui test` and `pnpm --filter web build` (the actual consumer, since `packages/ui` has no build of its own) both pass with the new dependencies and files added.
*   **And** this story ships no consumer of the new primitives itself — Story 1.3g's `WeekPicker.tsx` and Story 1.5's `FilterHub` popover redesign are its first two consumers, built in their own stories.

**Note:** Added 2026-08-15 via `bmad-create-story` while reopening Story 1.3g for AC13 (`sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md` Section 4.4, AD-9). AD-9 mandates `packages/ui/src/core/WeekPicker.tsx` wrapping shadcn `Button`+`Popover`+`Calendar`, but no shadcn/Radix setup, `cn()` utility, or `@/*` path alias exists anywhere in `packages/ui` — only `apps/web` has these, and `packages/ui` cannot depend on `apps/web`. The same gap independently blocks Story 1.5's FilterHub popover redesign (Section 4.1 of the same proposal), so this is a tooling/infrastructure gap needed by ≥2 stories, not a single-story concern — split into a new Epic 0 story per `story-split-gate.md`'s numbering rule rather than absorbed into either 1.3g or 1.5. User confirmed via `AskUserQuestion` during Story 1.3g's reopening.

**Depends on:** None.

### Story 0.29: Build the reusable TabbedShell primitive

**As a** developer,
**I want** a generic, reusable `TabbedShell` component (`packages/ui/src/core/tabbed-shell/`) — a tab bar + content panel wrapping a shadcn/Radix `Tabs` primitive, driven entirely by props (`tabs`, `activeKey`, `onTabChange`) with **free navigation** (no completion-gating, unlike Story 0.24's wizard chrome),
**So that** the upcoming Account Settings shell (API Keys/Subscribed Accounts/Posts/Notifications tabs) and Moderator Tools shell (actor-runs/unprocessed-payloads tabs) each register their existing page-content components as tabs once, instead of hand-building their own tab chrome.

**Acceptance Criteria:**

*   **Given** no shadcn/Radix `Tabs` primitive exists yet in `packages/ui/src/core/ui/` (only `button.tsx`/`popover.tsx`/`calendar.tsx`/`badge.tsx` are generated there today, via Story 0.28's scaffold),
*   **When** this story generates `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` into `packages/ui/src/core/ui/tabs.tsx` via that same scaffold, and builds `TabbedShell` as a presentational wrapper around it (no `next/navigation`/`next-intl`/`nuqs` import — mirrors `WizardNavigation`'s framework-agnostic boundary),
*   **Then** clicking any tab calls `onTabChange(key)` immediately with no gating of any kind (no `useWizardStep()`/`WizardStepProvider` involvement), only the active tab's `Component` is mounted at a time (Radix's default no-`forceMount` behavior — required so inactive tabs' data-fetching hooks don't fire), and the tab bar exposes standard `tablist`/`tab`/`tabpanel` ARIA roles plus roving-tabindex arrow-key navigation via Radix's own defaults.
*   **And** this story ships zero real tab entries and no `apps/web`-level registry file (unlike Story 0.24's `wizardRegistry`) — each future consumer instantiates `<TabbedShell>` directly with its own local tabs array; `?tab=` URL-state wiring (`nuqs`) belongs to each consumer page, not this primitive (`NuqsAdapter` is already wired at `apps/web/src/app/[locale]/layout.tsx`, so no new foundational nuqs story is needed).
*   **And** active/inactive styling uses a 2-state model (not `WizardStepSummary`'s 3-state Completed/Current/Upcoming) since free-navigation tabs have no linear-progress concept.

**Note:** Added 2026-08-24 via `bmad-correct-course` (`sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.2, items #4/#5 settings-IA restructuring), full ACs backfilled 2026-08-25 via `bmad-create-story` (this section did not exist yet despite `sprint-status.yaml` carrying a `0-29` entry since 2026-08-24 — a tracking gap in the same family as Stories 3.3d/3.4m's, now corrected). During story creation, a further real gap was found and flagged (not fixed by this story): `EXPERIENCE.md`/`DESIGN.md`'s two-shell IA rewrite, which the correct-course proposal's own approved log claims was completed 2026-08-24, was never actually applied to either file — both still show the old flat six-route settings menu. See `0-29-build-the-reusable-tabbedshell-primitive.md` Dev Notes for the full finding; the actual rewrite is recommended before/alongside whichever story builds the Account Settings/Moderator Tools shells next.

**Depends on:** Story 0.28.

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

### Story 1.2a: Create posts table and link seeded events to their source post

**As a** developer,
**I want** a `posts` table (matching the PRD's `Post` interface plus a `subscriptionId` reference and `publishedAt` timestamp — the same shape Story 3.3a specifies for the social-media scraping pipeline) created now, and the `events` table extended with a nullable `postId` foreign key referencing it,
**So that** `EventCard` (Story 1.3b) and the events GraphQL API (Story 1.3a) can resolve an event's real image via its source post — matching the PRD's actual data model, where `EventInfo` (PRD §4.1) has no image field of its own because images travel via `Post.imageUrl` (PRD §4.7) — instead of Epic 3's scraping pipeline being the only story that ever populates this table.

**Acceptance Criteria:**

*   **Given** Story 1.1's tables exist, **when** the migration script runs, **then** a `posts` table is created with `id` (uuid pk), `subscription_id` (FK to `subscriptions`, nullable), `content` (text), `image_url` (text, nullable), `post_url` (text, nullable), `is_extracted` (boolean, default false), `published_at` (timestamp), and standard timestamps — exactly the shape Story 3.3a's original AC specified — indexed on `subscription_id` and `published_at`.
*   **And** the `events` table gains a nullable `post_id` column (FK to `posts.id`), via a new Drizzle-kit-generated migration (AD-3).
*   **And** `packages/shared-types`'s `EventInfo` interface gains an optional `postId?: string`; no direct image field is added to `EventInfo` — the image is a runtime-computed field resolved via the post relationship, mirroring how `isFavorited`/`isAddedToCalendar` are already documented as runtime-computed rather than stored on the base type.
*   **And** `packages/database/seed.ts` is updated to create one `posts` fixture row per existing fixture event (linked to that event's matching subscription, e.g. `FIXTURE_SUBSCRIPTIONS[0].id`), populated with the `image_url` currently embedded as text inside that event's `description` field, and each fixture event's `post_id` is set to reference its corresponding new post row; the `"Poster image: ..."` substring is removed from `description` once the URL lives in its proper structured column.
*   **And** the seed integration test (`packages/database/seed.integration.test.ts`, from Story 1.2) is extended to assert the new `posts` table's row count and that every fixture event's `post_id` resolves to a `posts` row with a non-null `image_url`.
*   **And** this story does not implement any of the actual scraping/persistence logic for real scraped posts (writing newly-scraped posts, updating `is_extracted`) — that remains Story 3.3a's scope, narrowed to build on top of the table this story creates rather than creating it from scratch (see the amendment note on Story 3.3a).

**Note:** This story exists because of a Data Type Compatibility gap surfaced while creating Story 1.3b (`EventCard`) — the PRD's `EventInfo` interface has no image field, because event images are meant to travel via the source `Post.imageUrl`, not a field on the event itself. Story 3.3a already defines the target `posts` table shape but scoped it to Epic 3's scraping pipeline, chronologically after Epic 1. Since Epic 1's `EventCard`/events API need real, non-placeholder images sooner, this story pulls the table-creation portion of Story 3.3a's scope earlier — following the Story 1.1 precedent of scoping originating tables to the epic that first needs them — and narrows Story 3.3a accordingly. Classified as a shared data-ownership gap per `story-split-gate.md`'s numbering rule, positioned immediately after Story 1.2 (which it extends) and before Story 1.3a (its first consumer).

**Amendment (2026-08-01, source-attribution requirement via `bmad-correct-course`):** Add a nullable `original_post_url` column to `posts` (new Drizzle-kit migration — this table is already implemented and this story is `review` status), populated by the scraper adapter when it can derive the canonical original-platform URL for a post (PRD §3.7). The existing `post_url` column keeps its current meaning unchanged (whatever URL the adapter actually scraped from, which may be a proxy/mirror site). `packages/shared-types`'s `Post` interface gains a matching optional `originalPostUrl?: string`. Surfaced while creating Story 1.6 ("View event details"), whose Gate 2 review found the previous draft's source-link requirement ungrounded, prompting a `bmad-correct-course` pass that confirmed it as a real requirement and traced it to this story's table. Consumers: Story 1.6/1.6a (display) and Story 3.4 (Scrape new posts — future story, responsible for populating `original_post_url` per its adapter's own derivation rules when implemented).

**Depends on:** Story 1.1, Story 1.2.

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
*   **And** the API supports filtering events by `sourceSocialMediaAccountId` scoped to the current authenticated user's subscriptions (Story 0.17), so Epic 3's Feed (Story 3.7) can retrieve only events extracted from the user's subscribed accounts by reusing this resolver rather than a separate one.
*   **And** the returned `Event` GraphQL type exposes a runtime-computed `imageUrl: String` field, resolved by joining `posts` through the `events.postId` FK (Story 1.2a) via `buildOptimizedDrizzleSelect`/a dedicated join — not a stored field on `EventInfo` itself, mirroring how `isFavorited`/`isAddedToCalendar` are already runtime-computed. Consumed directly by Story 1.3b's `EventCard`.

**Note:** Story 4.4a (Epic 4) will later extend this resolver to exclude soft-deleted (`deletedAt IS NOT NULL`) events by default via `activeOnly(events)` (with a moderator-scoped override, backing Story 4.7's moderation view). Not specified as an AC here because Story 1.1 does not create a `deletedAt` column and Story 4.4a — which does — is not built yet; implementation and ownership of that filter live entirely in Story 4.4a's own Acceptance Criteria. **(Added 2026-08-11, Epic 4 readiness re-sweep)** Story 4.8 (Epic 4) will later add an authenticated, owner-scoped opt-in argument to this resolver that bypasses the default visibility rule-list (Story 2.7's past-event rule, 4.3a's personal-hide, 4.4a's soft-delete) for the caller's own favorited/calendar-added/subscribed-sourced events — built as an AC within Story 4.8 itself (matching the precedent set by Story 3.7's `isFromSubscribedAccount` field, added directly to this resolver's fieldMap without a separate prerequisite story since it has a single consumer), not specified here.

**Depends on:** Story 0.8, Story 1.2a (for the `postId`/`imageUrl` resolution AC above)

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

### Story 1.3c: Build the reusable infinite-scroll hook

**As a** developer,
**I want** a generic, reusable `useInfiniteScroll` hook in `packages/ui/src/hooks/`,
**So that** every long list in the application (Main Discovery Feed, Favorites, My Calendar, Manual Post Selection tabs) fetches and appends subsequent pages the same way, instead of each feature story reimplementing its own IntersectionObserver/fetch/append logic.

**Acceptance Criteria:**

*   **Given** a list of items and a `fetchNextPage`/`hasNextPage` contract (matching the shape React Query's infinite-query APIs expose),
*   **When** the hook's returned sentinel ref enters the viewport (via `IntersectionObserver`),
*   **Then** it invokes the caller-supplied fetch-next-page callback, without replacing already-loaded items — the caller owns appending the new page's results to existing state (e.g. via React Query's `data.pages` accumulation).
*   **And** the hook does not re-trigger a fetch while a fetch is already in flight, and stops observing once `hasNextPage` is `false`.
*   **And** the hook cleans up its `IntersectionObserver` on unmount and on sentinel-ref change, leaving no dangling observers.
*   **And** if the fetch-next-page callback rejects/errors, the hook surfaces that error state (via its return value) rather than silently retrying in a loop; the caller decides how to render the error.
*   **And** the hook is documented and exported from `packages/ui`'s public entry point for reuse across features.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while creating Story 1.3 — `project-context.md`'s Code Organization rule already names `useInfiniteScroll` by name as the canonical example of a hook belonging in `packages/ui/src/hooks/`, but no story owned building it, and PRD §3.12 / `project-context.md`'s "List Navigation" rule mandate infinite scroll for every long list (Main Discovery Feed, Favorites, My Calendar, Manual Post Selection), not just Story 1.3's. Story 2.2 ("View favorited events") and Epic 5's manual post selection screen (Story 5.1/5.1a, FR52/FR53 lazy loading) both silently assume this mechanism exists with no story building it. Classified as a single-story-origin UI split (mirroring the 1.3a/1.3b/1.6a precedent — built once, reused across epics, homed off the first story that needs it rather than Epic 0, matching how Story 1.3b's cross-epic-reusable `EventCard` was scoped) — positioned immediately before Story 1.3, its first consumer.

**Depends on:** None (pure presentation/behavior hook, no backend dependency).

### Story 1.3d: Build the reusable EventListView component

**As a** developer,
**I want** a reusable `EventListView` presentational component in `packages/ui`,
**So that** the Discovery feed (Story 1.3) and Favorites page (Story 2.2) — and any future long event list — render the same loading/error/empty/grid/infinite-scroll shell instead of each page independently duplicating it.

**Acceptance Criteria:**

*   **Given** a `status` of `'loading'`, **when** `EventListView` renders, **then** it shows a skeleton grid of `EventCard`s with `loading={true}` (default 6, matching the existing `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` layout used identically by both `home-content.tsx` and `favorites-content.tsx` today).
*   **And** **given** a `status` of `'error'`, **when** it renders, **then** it shows the caller-supplied `errorMessage` (translated) and `errorDetail` (raw technical string, already resolved by the caller from whichever error object is relevant) in the existing `text-destructive`/`<pre>` layout.
*   **And** **given** a `status` of `'success'` with an empty `events` array, **when** it renders, **then** it renders the caller-supplied `emptyState` node verbatim — the shell does not encode empty-state branching logic itself, since Discovery's and Favorites' empty-state conditions differ (single search-vs-default ternary vs. a three-way search/filter/error-combined condition).
*   **And** **given** a `status` of `'success'` with a non-empty `events` array, **when** it renders, **then** it renders a grid of `EventCard`s, deriving each card's `startDate`/`priceFrom` internally from `event.schedules.find(s => s.isMainSchedule) || event.schedules[0]` (the identical derivation both pages duplicate today) and merging in the per-event props returned by a caller-supplied `getCardProps(event)` callback (e.g. `isFavorited`/`isGreyedOut`/`pendingRemoval`/`onFavoriteToggle`/`onClick`/`href` — the props that genuinely diverge between Discovery's immediate-optimistic-mutation pattern and Favorites' deferred soft-delete-with-undo pattern, per Story 2.2).
*   **And** it renders the `useInfiniteScroll` (Story 1.3c) sentinel at the bottom of the grid, showing a localized spinner + caller-supplied `loadingMoreLabel` while `isFetchingNextPage` is true — `EventListView` accepts `sentinelRef`/`isFetchingNextPage` as props (the caller still owns its own `useInfiniteScroll(...)` call and `fetchNextPage`/`hasNextPage` wiring; this component only renders the passthrough result).
*   **And** the component defines its own minimal event-shape type (`id`, `slug`, `eventName`, `imageUrl?`, `location?`, `categories?`, `types?`, `schedules: {isMainSchedule, eventStartDate, ticketPrice?}[]`, generic over `TEvent extends` that shape) — it does **not** import any `apps/web`-generated GraphQL type, matching how `EventCard` already stays decoupled from any specific query shape.
*   **And** all labels (`priceFrom`, `categoryLabels`, `typeLabels`, `favoriteToggle`) are passed in pre-translated via a `cardLabels` prop (mirroring `EventCard`'s existing `labels` prop pattern) — `packages/ui` does not import `next-intl` directly, per `project-context.md`'s framework-agnostic UI rule.
*   **And** `home-content.tsx` is refactored to consume `EventListView`, removing its duplicated skeleton/error/empty/grid/sentinel JSX, with **zero visible behavior change**: the Sign In/Sign Out header, the unauthenticated-favorite-click login modal, and the optimistic-mutation favorite toggle stay in `home-content.tsx`, wired through `getCardProps`.
*   **And** `favorites-content.tsx` is refactored to consume `EventListView` identically, with **zero visible behavior change**: its two-stage (`idSnapshotStatus`/`status`) loading gate is collapsed into the single `status` prop before calling `EventListView`; its three-branch empty-state condition and combined error condition are resolved into the `emptyState`/`errorMessage`/`errorDetail` props; the soft-delete-with-undo grey-out (`isGreyedOut`/`pendingRemoval`) and `?fromList=favorites&favoriteIds=...` click URL stay wired through `getCardProps`.
*   **And** View Toggles (Card/Calendar) and Filter-by-Location — both named in `design-artifacts/D-Design-System/01-event-list-view.md` but not implemented anywhere in the codebase today — are explicitly out of scope for this story (Calendar View is Epic 2 Story 2.6; Location filtering has no story yet). `EventListView` renders Card View only.
*   **And** the component is documented/exported from `packages/ui`'s public entry point (`packages/ui/src/features/events/index.ts`) for reuse across features.

**Note:** This is a retroactive extraction, not the usual "split before the first unbuilt consumer" pattern — both consumers (Story 1.3, Story 2.2) are already implemented and in `review`. Surfaced by the user directly (not a `bmad-create-story` gate finding mid-draft of another story) after noticing `home-content.tsx` and `favorites-content.tsx` duplicate an identical presentational shell below their `SearchBar`/`FilterHub` row. Positioned as a lettered suffix off Story 1.3 (matching the `1.3a`/`1.3b`/`1.3c` family and Story 1.3's status as the component's true first chronological consumer) rather than off Story 2.2, per user decision. Gate 2 (UI Complexity & Reusability, run via `bmad-create-story` against `design-artifacts/D-Design-System/01-event-list-view.md` and the current duplicated implementation) confirmed the split and recommended the prop contract above; Gate 1/Gate 3 were not re-run fresh — `epic-1-readiness.md` (`swept: true`) already covers Epic 1 and found no new architecture/infra/foundational gap applicable to a pure frontend presentational extraction with no new data or infra surface.

**Depends on:** Story 1.3b (`EventCard`), Story 1.3c (`useInfiniteScroll`). Touches (already-implemented) Story 1.3 and Story 2.2's page files as a refactor, not a functional change to either.

### Story 1.3e: Build the reusable EventDiscoveryPanel component

**As a** developer,
**I want** a reusable `EventDiscoveryPanel` presentational component in `packages/ui`,
**So that** the Discovery feed (Story 1.3) and Favorites page (Story 2.2) render the same `SearchBar` + `FilterHub` + result-view row instead of each page independently duplicating it, and future long event lists (Story 5.1's manual post selection, etc.) can compose the same shell.

**Acceptance Criteria:**

*   **Given** a `views` prop of one or more `{ id, content }` entries, **when** `EventDiscoveryPanel` renders, **then** it renders `SearchBar` (wired to `query`/`onSearchSubmit`/`onSearchEnter`/`searchPlaceholder`/`searchClearLabel`) and `FilterHub` (wired to `filterLabels`/`types`/`categories`/`onFilterChange`) inside the identical `<div className="flex flex-col gap-6">` wrapper both pages use today, immediately followed by the active view's `content`.
*   **And** it self-manages the active view via its own `useQueryState('view', ...)` — matching `FilterHub`'s existing internal pattern for `types`/`categories` — no `view` prop is required from the caller.
*   **And** if the URL's `view` param is absent or does not match any `views[].id`, it falls back to `views[0].id` rather than reaching a dead/undefined state, regardless of URL tampering.
*   **And** `SearchBar`'s `onChange` is wired to a no-op internally, matching both pages' existing "internal state only, URL updates on submit" behavior; `EventDiscoveryPanel` exposes no `onSearchChange` prop.
*   **And** `onSearchEnter`/`onFilterChange` are optional — when omitted (as `favorites-content.tsx` does today), no runtime error occurs.
*   **And** DOM tab order flows SearchBar → FilterHub → active view content, with no `tabIndex` override introduced by `EventDiscoveryPanel` itself (composition-level a11y check — each child previously only tested in isolation).
*   **And** `home-content.tsx` is refactored to consume `EventDiscoveryPanel`, passing a single-entry `views` array wrapping its existing `EventListView` invocation, removing its duplicated `SearchBar`/`FilterHub` JSX. `buildEnumLabels`/`typesOptions`/`categoriesOptions`/`filterLabels` construction stays in `home-content.tsx` — `EventDiscoveryPanel` does not absorb label-building. **Zero visible behavior change**: `onSearchEnter`/`onFilterChange` analytics wiring stays intact.
*   **And** `favorites-content.tsx` is refactored identically, passing a single-entry `views` array with no `onSearchEnter`/`onFilterChange` (unchanged). **Zero visible behavior change**.
*   **And** the component is documented/exported from `packages/ui`'s public entry point (`packages/ui/src/features/events/index.ts`).
*   **And** the ViewSwitcher control and any second (calendar) view are explicitly out of scope — no second view exists yet to switch to; see Story 1.3f.

**Note:** Retroactive extraction, same pattern as Story 1.3d — both consumers (Story 1.3, Story 2.2) are already implemented and in `review`. Surfaced by the user directly after Story 1.3d's own dedup left the `SearchBar`/`FilterHub` row above it still duplicated. Positioned as a lettered suffix off Story 1.3d/1.3, keeping the component family grouped. Scope explicitly excludes absorbing `buildEnumLabels`/option-building into the component (per user decision: pure layout wrapper only) and excludes building a visible view-switcher (per user decision, see Story 1.3f). Gate 2 (`wds-agent-freya-ux` lens, run fresh) confirmed the split and recommended two additions folded into the ACs above: (1) explicit fallback-to-`views[0]` behavior so no invalid URL state is reachable, (2) a composition-level tab-order check. Gate 2 also flagged a `aria-live` result-count announcement as a genuine WCAG AA gap in the *composed* search+filter+list unit, but it requires new data flow between the opaque `views[].content` slot and the panel that this pure-layout-wrapper contract doesn't have — deferred rather than forcing a prop-shape compromise into this dedup story (see `## Out of Scope` in the story file). Gate 1/3 sourced from `epic-1-readiness.md` (`swept: true`) for the ordinary architecture/infra check; however, this story's own research surfaced a gap the Epic 1 sweep did not anticipate — see Story 1.3f's Note.

**Depends on:** Story 1.3d (`EventListView`), Story 1.5a (`FilterHub`'s `MultiSelect`). Touches (already-implemented) Story 1.3 and Story 2.2's page files as a refactor, not a functional change to either.

### Story 1.3g: Build the reusable WeeklyCalendarView component

**As a** developer,
**I want** a reusable `WeeklyCalendarView` presentational component in `packages/ui`,
**So that** the Discovery feed's Calendar View (Story 1.3f) and the future "My Calendar" page (Story 2.6) render the same weekly-grid mechanics — navigation, day cells, compact schedule cards, main/sub-schedule formatting, multi-day spanning, per-day overflow capping — instead of each independently rebuilding it, matching `design-artifacts/UX-festgrid-run-1/DESIGN.md`'s `calendar` component tokens, which already define one shared component with `discovery_view`/`personal_view` `max_events_per_day` variants.

**Acceptance Criteria:**

*   **Given** a `weekStart` date and a `schedules` array (each with `isMainSchedule`, `eventStartDate`, `eventEndDate?`, `eventStartTime?`, `eventEndTime?`, plus enough event identity to navigate to it), **when** `WeeklyCalendarView` renders, **then** it shows a 7-column grid (`grid grid-cols-7 divide-x divide-gray-200` per `DESIGN.md`) with locale-aware day headers for the week starting at `weekStart`, and a header row with previous/next-week navigation buttons and a date-range label (`header`/`date_range`/`nav_button` tokens).
*   **And** a "Today" button is always present in the header; activating it calls a caller-supplied `onToday` callback — the component does not compute "today" itself, matching `EventListView`/`EventDiscoveryPanel`'s controlled-component pattern (the caller owns week state).
*   **And** each schedule occurring within the visible week renders in its day cell as a compact card (`event_card_compact` tokens), titled per `DESIGN.md`'s `title_formatting` (bold for a main schedule, normal weight for a sub-schedule).
*   **And** a schedule whose `eventEndDate` differs from `eventStartDate` renders with the `multi_day_event` visual treatment spanning the relevant day cells within the visible week, rather than being duplicated as unrelated per-day entries; a schedule with no `eventEndDate` (or `eventEndDate === eventStartDate`) renders as a single-day compact card.
*   **And** given a `maxEventsPerDay` prop (a positive integer, or `-1` for unlimited — matching `DESIGN.md`'s `discovery_view`/`personal_view` split), if a day cell's schedule count exceeds it, only the first `maxEventsPerDay` are shown plus a "+N more" affordance (`more_link` token); activating it reveals the remaining schedules for that day (e.g. inline expansion or popover), each independently activatable identically to a normally-rendered compact card.
*   **And** each compact schedule card is clickable/activatable, calling a caller-supplied `onScheduleClick(schedule)` callback — `WeeklyCalendarView` owns no navigation/routing logic itself, matching `EventListView`'s `getCardProps`-style caller-owns-navigation pattern.
*   **And** hovering or focusing a compact card shows a tooltip (`hover_tooltip` token) with the schedule's full title and time range; tooltip content is reachable via keyboard focus, not mouse-hover only (WCAG 2.1 AA).
*   **And** the day-cell grid supports roving-tabindex arrow-key navigation between schedule cards (Left/Right moves within a day's cards then into the adjacent day; Up/Down moves a row), with Enter/Space activating the focused card identically to a click.
*   **And** all labels (nav-button aria-labels, "Today" label, "+N more" label, tooltip/day-header copy needing translation) are passed in pre-resolved via a `labels` prop — `packages/ui` does not import `next-intl` directly; day-of-week/date formatting uses `useScopedLocale()`/`useScopedTimezone()` (`packages/ui/src/hooks/useScopedLocale.tsx`) rather than a hardcoded locale, matching `EventCard`'s existing pattern.
*   **And** the component defines its own minimal schedule-shape type (`id`, `eventSlug`, `eventName`, `isMainSchedule`, `eventStartDate`, `eventEndDate?`, `eventStartTime?`, `eventEndTime?`), generic over `TSchedule extends` that shape — it does not import any `apps/web`-generated GraphQL type, matching `EventListView`/`EventDiscoveryPanel`'s existing decoupling pattern.
*   **And** it exposes `loading`/`error` states (a skeleton grid / a caller-supplied error message+detail) for when the caller's data is still being fetched, matching `EventListView`'s `status` prop pattern.
*   **And** the component is documented and exported from `packages/ui`'s public entry point (`packages/ui/src/features/events/index.ts`).

**Note:** This story exists because of a Gate 2 finding (`story-split-gate.md`) surfaced while creating Story 1.3f. `DESIGN.md`'s `calendar` component tokens already define `event_rendering.discovery_view`/`event_rendering.personal_view` as two named variants of one shared component (differing only in `max_events_per_day`), and Story 2.6 ("View and manage events on a calendar", Epic 2, `backlog`) is a confirmed second, independently-scoped consumer — meeting Gate 2's reuse-across-≥2-places bar directly from the authoritative UX artifact rather than speculation. Story 2.6's current AC text does not yet explicitly commit to the weekly-grid/prev-next-nav/Today-button shape (only `DESIGN.md`'s token structure implies it) — this component's contract is derived from `DESIGN.md`/`EXPERIENCE.md` now, and Story 2.6 should confirm/adjust when it is actually drafted rather than assuming zero drift. Classified as a single-story-origin UI split (mirroring the `1.3a`/`1.3b`/`1.3d`/`1.3e` precedent), positioned as a lettered suffix directly off Story 1.3f, its first consumer, and placed immediately before it in this file despite sorting after it alphabetically (`g` > `f`) — split-discovery order, not alphabetical order, determines position, per `story-split-gate.md`'s "insert a new lettered story, never renumber" rule. Confirmed with the user via `AskUserQuestion` (2026-08-05).

**Amendment (2026-08-15, added via `bmad-create-story` while reopening this story for AC13):** Added AC13 (manual week-picker control, `sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md` Section 4.4, AD-9) — see the implementation-artifact story file for the full AC text and `WeekPicker.tsx`'s contract. `Depends on` updated to add Story 3.7a (boundary-resolution exports) and Story 0.28 (shadcn/Radix setup for `packages/ui` — new prerequisite, see that story's Note).

**Depends on:** Story 3.7a, Story 0.28 (added 2026-08-15; originally none).

### Story 1.3h: Extend the events GraphQL API with schedule-level date-range query support

**As a** developer,
**I want** the events GraphQL API's Unified Query DSL (AD-1) to support a schedule-level date-range overlap condition,
**So that** Story 1.3f's Discovery Calendar View (and any future date-bounded event query) can retrieve exactly the events with at least one schedule — main or sub — overlapping a given date range, without expanding the existing main-schedule-only join used for sorting.

**Acceptance Criteria:**

*   **Given** a DSL terminal condition with a new operator (e.g. `overlaps`) and a dedicated field (e.g. `scheduleDateRange`) whose value is `{ from: string; to: string }` (ISO dates), **when** the `events` resolver builds its `WHERE` clause, **then** it returns exactly the events having at least one schedule (main or sub) whose `[eventStartDate, eventEndDate ?? eventStartDate]` interval overlaps `[from, to]` inclusive — evaluated via an `EXISTS` subquery against the full `schedules` table scoped by `event_id` (mirroring the existing `isFavorited`/`isAddedToCalendar` `EXISTS`-subquery `fieldMap` pattern in `apps/backend/src/schema/resolvers.ts`), not the existing `mainSchedulesOnly` join (which only ever exposes one schedule per event and would silently miss sub-schedule-only matches).
*   **And** the overlap check uses Postgres native range support — a `daterange(event_start_date, COALESCE(event_end_date, event_start_date), '[]')` expression compared via the `&&` overlap operator against `daterange($from, $to, '[]')` — rather than two independently-compared inequality columns.
*   **And** a Drizzle-kit-generated SQL migration (checked into the repo per project-context.md's migration rule) adds a GiST index on `schedules` supporting that overlap expression.
*   **And** this new field/operator composes correctly with existing DSL conditions via `and`/`or` grouping (e.g. combined unchanged with the existing `q`/`types`/`categories` condition from `buildEventsQueryCondition`) — verified by an integration test combining a date-range condition with an existing `types`/`categories` condition.
*   **And** existing DSL behavior is unchanged and regression-verified: `eq`/`ne`/`contains`/`in`/`notIn` operators, and the existing `isFavorited`/`isAddedToCalendar`/`performers`/`scheduleLocation` `fieldMap` entries, all continue to behave exactly as before (existing `resolvers`/`drizzle-where` tests pass unmodified).
*   **And** unit tests explicitly cover the overlap boundary cases: schedule fully inside the range; schedule fully spanning/containing the range (starts before `from`, ends after `to`); schedule overlapping only the range's start edge; schedule overlapping only the range's end edge; schedule entirely outside the range (no match); and a schedule with `eventEndDate = null` (single-day, falls back to `eventStartDate`).
*   **And** the GraphQL schema (`events.graphql`) requires no changes — `EventQueryConditionInput.operator: String` already accepts the new operator value with no breaking change.

**Note:** This story exists because of a Gate 1 finding (`story-split-gate.md`) surfaced while creating Story 1.3f, after the user asked for the actual query-execution cost of a "dedicated week-scoped backend query" to be investigated rather than assumed. The `events` resolver's existing `mainSchedulesOnly` join (`apps/backend/src/schema/resolvers.ts`) only ever joins each event's main schedule, so a naive date-range filter on that joined column would silently miss any event whose *sub*-schedule (not main schedule) falls in the requested week — a real correctness gap, not a style preference. Fixing it correctly requires new backend surface area (an `EXISTS`-subquery DSL field, mirroring the existing `isFavorited`/`isAddedToCalendar` pattern, plus a new DSL operator and a GiST index migration) — this is new architecture, not an in-story task, matching Gate 1's "introduces a new API surface... that doesn't yet exist in `apps/backend`" trigger. Classified as a single-story-origin backend split (mirroring the `2.4b`/`2.5a` precedent of a focused backend-capability sub-story), positioned as a lettered suffix directly off Story 1.3f, its only consumer, and placed immediately before it in this file. An alternative (fetching up to the existing 1000-event cap in one request and filtering the date range client-side, avoiding all backend changes) was explicitly considered and rejected by the user in favor of exact per-week query correctness. Confirmed with the user via `AskUserQuestion` (2026-08-05), including a direct correctness review of the overlap-condition logic (interval-overlap AND-of-two-inequalities, verified complete — no OR branch needed) and a performance discussion (Postgres typically rewrites correlated `EXISTS` into a semi-join; `daterange`+GiST is the indexable, purpose-built form of this check; at FestDaily's current MVP scale this is not expected to be a bottleneck either way, but is the correct WHERE-hot-path indexing practice per project-context.md's existing indexing rule).

**Depends on:** None (extends the existing `events` query/resolver; no new schema surface).

### Story 1.3f: Build the Discovery weekly-calendar view and view-switcher

**As a** user,
**I want** to toggle the Discovery feed between a card grid and a weekly calendar, both reflecting my active search/filter,
**So that** I can browse events in whichever format suits me, per `design-artifacts/D-Design-System/01-event-list-view.md`'s "View Toggles" standard interaction.

**Acceptance Criteria:**

*   **Given** the Discovery page, **when** it renders, **then** a view-switcher control offers "Card View" (default) and "Calendar View" — rendered by `EventDiscoveryPanel` itself (its `views[]` contract, Story 1.3e, is extended with an optional `label`/`icon` per entry; `EventDiscoveryPanel` renders the switcher control whenever `views.length > 1`, using the active-view state it already owns) — not a separately state-managed sibling component.
*   **And** selecting "Calendar View" renders `WeeklyCalendarView` (Story 1.3g), populated from a dedicated week-scoped `events` query (Story 1.3h's `scheduleDateRange`/`overlaps` condition, combined via `and` with the page's existing `q`/`types`/`categories` condition), scoped to the currently visible week; `maxEventsPerDay` is `5`, matching `DESIGN.md`'s `discovery_view` token.
*   **And** switching between Card View and Calendar View preserves the active `q`/`types`/`categories` URL state — no lost filter context; the active view itself (`view=card`/`view=calendar`) and the visible week (`weekStart`, or equivalent) are both reflected in the URL via `nuqs` (AD-4), so both are shareable/deep-linkable and survive a page reload.
*   **And** activating a schedule's compact card in Calendar View opens the same event-detail modal as clicking a card in Card View — the existing `/events/[slug]?fromList=true&...` navigation and `@modal/(.)events/[slug]` intercepting route (unchanged) — with the current URL's query string (including `view=calendar` and the week state) carried through, so returning from the modal restores Calendar View at the same week; matching `EXPERIENCE.md`'s Event Discovery interaction. (`useListNavigationForEvent`'s Next/Previous context resolves by `eventId` against the flat `events` list already loaded for `fromList` context, independent of card vs. calendar layout — no change needed there.)
*   **And** switching views announces the change to assistive technology (an `aria-live="polite"` region reporting the newly active view), since the visual grid/layout changes entirely on switch.

**Note:** This story exists because of a Gate 3-shaped finding surfaced while creating Story 1.3e, not the epic-1-readiness sweep (which predates this discovery and does not mention it). Story 1.3d's own Out-of-Scope note (and this file's original Story 1.3d section) assumed "Calendar View is Epic 2 Story 2.6" — that assumption is incorrect; Story 2.6 builds a separate, dedicated `/my-calendar` page for the user's own favorited/added-to-calendar events, not a card/calendar toggle for the Discovery feed's full filtered event list. Two further gates fired while drafting this story itself (not epic-1-readiness, which predates both): **Gate 2** found the weekly-calendar grid mechanics reusable across this story and Story 2.6 (per `DESIGN.md`'s already-encoded `discovery_view`/`personal_view` token split) and split them into new Story 1.3g; **Gate 1** found the existing `events` resolver's main-schedule-only join insufficient for correct week-range filtering and split the fix into new Story 1.3h. This story is now scoped purely to integration: consuming 1.3g's primitive and 1.3h's query capability, extending 1.3e's `EventDiscoveryPanel` contract with switcher rendering, and wiring week/view state into the URL. All three splits were confirmed with the user via `AskUserQuestion` (2026-08-05), including two rounds of follow-up on 1.3h's technical approach (overlap-condition correctness and index performance) before the user chose the dedicated-backend-query path over a simpler client-side-filter alternative.

**Depends on:** Story 1.3e (`EventDiscoveryPanel`'s `views` seam — contract extended by this story), Story 1.3g (`WeeklyCalendarView`), Story 1.3h (schedule-level date-range query support).

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
*   **And** the list implements infinite scrolling, using the shared `useInfiniteScroll` hook (Story 1.3c), seamlessly fetching and appending the next page of results as I scroll near the bottom.
*   **And** a localized non-blocking spinner is displayed at the bottom of the list while fetching subsequent pages.

**Depends on:** Story 0.6, Story 0.7, Story 1.3a, Story 1.3b, Story 1.3c

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

### Story 1.5a: Build the reusable MultiSelect component

**As a** developer,
**I want** a generic, reusable `MultiSelect` faceted-filter component in `packages/ui/src/core/`,
**So that** Story 1.5's Filter Hub (and future filter surfaces, e.g. Epic 3's FR31 filtering of subscribed-account events by type/category) can offer consistent multi-value selection without each feature rebuilding its own popover/toggle/selection-state logic.

**Acceptance Criteria:**

*   **Given** a facet label (e.g. "Type", "Category") and a list of selectable options,
*   **When** `MultiSelect` renders,
*   **Then** it displays the facet label and the currently selected option(s), clearly indicating selection state, matching the authoritative UX interaction described in `EXPERIENCE.md`/the Sarah discovery scenario — tap-to-toggle options with the grid updating on each selection (not a searchable combobox/popover pattern, which is not specified in any authoritative FestDaily UX artifact).
*   **And** selecting or deselecting an option toggles its membership in the component's selected-values set, supporting zero, one, or many simultaneous selections.
*   **And** it exposes a "Clear" action that resets the facet's selection to empty.
*   **And** it is domain-agnostic (accepts options/labels/selection as props — no FestDaily-specific business logic) so it can be reused for any facet, not just `EventType`/`EventCategory`.
*   **And** it meets accessibility requirements for a multi-select control (keyboard operable, selection state exposed to assistive tech).
*   **And** it is documented and exported from `packages/ui`'s public entry point for reuse across features.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while creating Story 1.5 — the draft folded a Shadcn `Popover`+`Command` "faceted filter" combobox pattern (trigger button, badges, search-within-popover, checkmark list, clear footer) into Story 1.5 itself, but that pattern stacks the same category of independent state dimensions (open/close, internal search-filter, multi-toggle selection, keyboard nav, a11y) that triggered the Story 1.3b (`EventCard`)/1.3c (`useInfiniteScroll`) splits, and clears the reuse bar independently since Epic 3's FR31 is a near-certain second consumer beyond Story 1.5's `FilterHub`. Gate 2 also flagged that neither `DESIGN.md`/`EXPERIENCE.md` nor the Sarah discovery scenario (`01.1-event-discovery.md`) describes a searchable popover/combobox — both describe simple tap-to-toggle buttons/tags — so this story's ACs are scoped to that authoritative interaction rather than the richer combobox the draft had assumed. Classified as a single-story-origin UI split (mirroring the 1.3a/1.3b/1.3c/1.6a precedent) — positioned immediately before Story 1.5, its first consumer.

**Depends on:** None (pure presentation component, no backend dependency).

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

**Depends on:** Story 1.3a, Story 1.4, Story 1.5a

### Story 1.6a: Build the reusable event detail view component

**As a** developer,
**I want** a reusable event detail display component in `packages/ui`,
**So that** the event name, description, date/time, location, and performers can be presented consistently wherever event details are shown.

**Acceptance Criteria:**

*   **Given** a fully-loaded event's details,
*   **When** the component renders,
*   **Then** it displays the event name, description, date and time, location, performers, and image, with a graceful fallback for any missing optional field.
*   **And** it exposes loading and error states independent of how it is invoked (modal or full page).
*   **And** when a source-post original-platform URL and/or proxy/scraped-source URL is provided by the caller, it displays attribution link(s) back to the source post; whichever one is absent for a given event is simply omitted, not shown broken (mirrors the existing `mapUrl` decoupling pattern).
*   **And** when the event's source account data is available (Story 3.1a's `SocialMediaAccountProfile`, surfaced via the source post's account relation), it displays the account's platform icon and display name; clicking it navigates to that account's public event page (`/{platformSlug}/{accountId}`, Story 3.11, using `SocialMediaAccountProfile.accountId` — not the internal `id`). This is additive to — and independent of — the source-post attribution link above, which points to the original post rather than the account.

**Amendment (2026-08-02, added via bmad-correct-course):** Added the account name/platform-icon link, driven by new Story 3.11 (public per-account event page, FR68). This is additive to the existing AC — the account link and the source-post attribution link are shown independently, since they point to different destinations (account page vs. original post) and either may be absent (e.g. no source account data available) without affecting the other.

### Story 1.6b: Build the context-aware list navigation hook

**As a** developer,
**I want** a reusable, headless hook that resolves "Next"/"Previous" targets from a list's search/filter/sort context and triggers background pagination when the boundary of the currently loaded page is reached,
**So that** any detail view opened from any list (event discovery, favorites, calendar) can offer consistent context-aware navigation without re-deriving list-position and pagination logic per feature.

**Acceptance Criteria:**

*   **Given** a list's context (current query/filter/sort state and its currently-loaded items or an ID-ordered sequence),
*   **When** the hook is used from a detail view opened from that list,
*   **Then** it returns whether a "Next"/"Previous" target exists, the target's identifier, and loading/disabled state for each direction.
*   **And** when the user is at the last loaded item and requests "Next," it triggers the list's next-page fetch in the background and resolves to the newly-loaded next item once available, without blocking the UI.
*   **And** when the detail view is opened via a direct deep-link without any list context, the hook reports no Next/Previous targets (both hidden/disabled) rather than erroring.
*   **And** it exposes a strictly-typed, headless contract (no rendering) so it can be reused by Story 1.6 (event discovery detail) and future Epic 2 detail views (Favorites, Calendar).

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while creating Story 1.6 — the draft folded "Next/Previous navigation that reads list context (search/filter/sort), detects list-boundary, and triggers a background next-page fetch" directly into Story 1.6, but this combines the same independent state dimensions (fetch + derived state + side effects) that triggered the Story 1.3c (`useInfiniteScroll`) split, and clears the reuse bar independently since `project-context.md`'s "Context-Aware Detail Views" invariant explicitly generalizes this across "any list" and Epic 2's Story 2.2 (View favorited events) and Story 2.6 (View and manage events on a calendar) are near-term consumers of the same detail-view navigation pattern. Classified as a single-story-origin UI/mechanism split (mirroring the 1.3c/1.5a/1.6a precedent) — positioned immediately before Story 1.6, its first consumer.

**Depends on:** None (headless hook; consumes whatever list context/pagination state its caller passes in — no direct GraphQL/DSL dependency of its own).

### Story 1.6: View event details

**As a** user,
**I want** to be able to click on an event to see its full details,
**So that** I can get all the information I need about the event.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I click on an event card,
*   **Then** a modal or a new page appears, using the event detail component (Story 1.6a), with the full details of the event.
*   **And** the event details are fetched via the backend GraphQL API (Story 1.3a's layer) — not directly from the database. This is a single-item lookup by slug, not an event collection, so it does not go through the Unified Query DSL (AD-1/AD-2 scope collections only), mirroring the existing non-DSL `event(id)` query precedent.
*   **And** the detail view provides "Next" and "Previous" navigation controls, using the context-aware list navigation hook (Story 1.6b), that respect the search, filter, and sort context of the list I navigated from.
*   **And** if I navigate to the end of the currently loaded page using the "Next" button, the system automatically fetches the next page of results in the background.
*   **And** the event details include attribution/links back to the source social media post — `Post.originalPostUrl` (when derivable) and/or `Post.postUrl` (the post as actually scraped, which may be a proxy/mirror site) — via `EventInfo.postId`, fetched via the backend GraphQL API, when the event has a linked post (PRD §3.3.3/§3.7).
*   **And** (added 2026-08-01, `project-context.md`'s "Dynamic Page Title & Meta Tags" rule) both the full-page route (`/events/[slug]`) and the intercepted modal route set the browser tab title/meta description to the event's own name/description via a route-level `generateMetadata` export built with the shared `apps/web/src/lib/metadata.ts` helper (Story 1.9) and next-intl's server-side `getTranslations()` — never a static export or a client-side `document.title` mutation. Since both routes fetch event data client-side, each route's `page.tsx` follows Story 1.9's established split: a Server Component `page.tsx` (holding `generateMetadata`) rendering the client-fetching logic from a colocated file.

**Depends on:** Story 1.3a, Story 1.6a, Story 1.6b, Story 1.9 (for the `generateMetadata`/`buildPageMetadata` convention)

### Story 1.7a: Build the reusable BlockingLoader component

**As a** developer,
**I want** a reusable, full-screen blocking loader/overlay component in `packages/ui`,
**So that** any critical, in-flight async operation (OAuth redirect processing, submitting a report, saving a location, etc. — PRD §3.12 "Global UI & Navigation Patterns") can present a consistent, accessible overlay that prevents further interaction, instead of each feature story building its own one-off spinner.

**Acceptance Criteria:**

*   **Given** a boolean `active`/`visible` prop, **when** it is `true`, **then** the component renders a full-screen, semi-transparent overlay with a centered spinner that visually blocks the rest of the page.
*   **And** while active, the overlay prevents interaction with underlying page content (e.g. pointer-events disabled beneath it, keyboard focus contained within the overlay) and exposes `aria-busy="true"`/appropriate ARIA live-region semantics so assistive tech announces the busy state.
*   **And** the component accepts an optional label/message node (for localized status text, resolved by the caller via `next-intl` — the component itself hardcodes no FestDaily-specific copy and performs no date/number/enum formatting, so it has no need of `useScopedLocale`/`useScopedTimezone`).
*   **And** it renders nothing (no DOM overlay, no lingering focus trap) when inactive.
*   **And** it is documented and exported from `packages/ui`'s public entry point for reuse across features.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while creating Story 1.7 — `project-context.md`'s UI Patterns & UX Invariants section and PRD §3.12 both mandate a full-screen blocking overlay pattern for all critical mutations (report submission, saving a location, OAuth redirect processing), not just this story's login flow, but no story yet owns building it as the shared, reusable primitive the rule assumes (confirmed not built by Story 0.7's app shell). Classified as a single-story-origin UI split (mirroring the 1.3b/1.3c/1.5a/1.6a precedent) — positioned immediately before Story 1.7, its first consumer. Unrelated to, and unaffected by, the 2026-08-01 "Source Post Attribution" sprint change proposal (scoped to Stories 1.2a/1.6/1.6a/3.4 only).

**Depends on:** None (pure presentation component, no backend dependency).

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
*   **And** (added 2026-08-01, `project-context.md`'s "Dynamic Page Title & Meta Tags" rule) the `/login` route sets its own browser tab title/meta description via a route-level `generateMetadata` export, built with the shared `apps/web/src/lib/metadata.ts` helper (Story 1.9) and next-intl's server-side `getTranslations()` — not the root layout's generic default. Since the login page's own logic is a Client Component, `apps/web/src/app/[locale]/login/page.tsx` follows Story 1.9's established split: a Server Component `page.tsx` (holding `generateMetadata`) rendering the client login logic from a colocated file.

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

### Story 1.9: Dynamic browser title and meta tags on page navigation

**As a** user browsing FestGrid,
**I want** the browser tab title and page meta tags to reflect the page I'm currently on,
**So that** I can tell tabs apart, get an accurate preview when I share a link, and pages are indexable with correct titles/descriptions.

**Acceptance Criteria:**

*   **Given** the root layout currently hardcodes a static, English-only `metadata` object,
*   **When** a user visits any locale route,
*   **Then** the root/default title and description are resolved via `next-intl`'s server-side `getTranslations()` for the active locale.
*   **And** a route that defines its own page content (the Discovery/Home page today) resolves its own distinct title/description via a route-level `generateMetadata` export.
*   **And** client-side navigation between routes correctly re-resolves the destination route's metadata (Next.js App Router per-segment resolution).
*   **And** each route's metadata includes baseline Open Graph tags (`og:title`, `og:description`) mirroring the resolved title/description.
*   **And** a shared helper builds the `Metadata` object consistently across routes, with strings sourced from a new `Metadata` i18n namespace in both `en.json` and `id.json`.

Note: Added 2026-08-01 at user request, scoped to Epic 1 (the only route it can apply to today is the Discovery/Home page). Establishes the `generateMetadata` convention future page stories (e.g. Story 1.6's event detail page) must follow — see `_bmad-output/implementation-artifacts/1-9-dynamic-browser-title-and-meta-tags.md` for the full gate analysis (no Epic 0 split needed; reuses existing next-intl/Next.js foundations).

### Epic 2: User Personalization

Users can personalize their experience by saving favorite events and locations.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR15, FR16, FR17

### Story 2.1a: Build the favorites and calendar-additions backend GraphQL API layer

**As a** developer,
**I want** `favorites` and `calendar_additions` tables plus mutation/query resolvers that let a client toggle and read per-user favorite/calendar state on events,
**So that** Stories 2.1, 2.2, 2.6, and 2.7 have a real backend write/read path instead of each quietly inventing its own storage or bypassing the API.

**Acceptance Criteria:**

*   **Given** Story 0.17's auth context, Story 1.1's `events`/`schedules` tables, and Story 1.3a's events resolver exist,
*   **When** the migration script runs,
*   **Then** a `favorites` table (`user_id` FK, `event_id` FK, `created_at`, unique on `user_id`+`event_id`) and a `calendar_additions` table (`user_id` FK, `event_id` FK, `schedule_id` FK nullable, `created_at`, unique on `user_id`+`event_id`) are created.
*   **And** a `toggleFavorite(eventId)` mutation and a `toggleCalendarAddition(eventId, scheduleId)` mutation are exposed, both scoped to `context.user` via `requireAuth` (Story 0.17) — never trusting a client-supplied user ID.
*   **And** the events resolver (Story 1.3a) is extended to accept `isFavorited`/`isAddedToCalendar` `equals` conditions per AD-2, and to return them as per-user computed booleans, joined against the caller's `favorites`/`calendar_additions` rows using `buildOptimizedDrizzleSelect` (Story 0.8).
*   **And** no package outside `apps/backend` writes to these tables directly — `apps/web` only mutates favorite/calendar state through these two mutations.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 2 readiness sweep (`bmad-epic-readiness-check`) — Story 1.3a is query-only with no mutations, and no story anywhere creates the favorites/calendar-additions data AD-2 assumes already exists. Classified as a shared data-ownership gap (consumed by Stories 2.1, 2.2, 2.6, and 2.7, all within Epic 2), positioned immediately before Story 2.1, the first consumer — mirroring the Story 1.3/1.3a split.

**Depends on:** Story 0.8, Story 0.17, Story 1.1, Story 1.3a.

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

### Story 2.1b: Build the ICS route handler and generator utility

**As a** developer,
**I want** a Next.js Route Handler and a shared ICS generation utility,
**So that** the "Add to Calendar" MVP feature (FR11, FR12) has a backing API surface to generate and deliver standard `.ics` files using event and schedule data, rather than the frontend assembling it ad hoc.

**Acceptance Criteria:**

*   **Given** a client needs to export an event or specific schedules to an external calendar,
*   **When** a request is made to the new ICS Route Handler,
*   **Then** it dynamically builds an `.ics` string using a reusable generation utility (e.g., parsing `EventInfo` and `Schedule` into the standard format).
*   **And** the endpoint returns the data with the `text/calendar` content type so the browser/OS natively handles the file download or calendar opening.
*   **And** the generation utility is built as a portable function decoupled from the HTTP layer, allowing future backend paths (like Epic 3 reminders) to reuse it if needed.

**Note:** This story exists because of Gate 1 / Gate 3 (`story-split-gate.md`), surfaced by the Epic 2 readiness sweep re-run. FR11 and FR12 require one-way calendar integration, but no API surface or utility existed to safely assemble and deliver `.ics` files. Classified as a single-story-family architecture split, positioned before Epic 2's calendar features.

**Depends on:** Story 1.3a.

### Story 2.2: View favorited events

**As a** user,
**I want** to have a dedicated page that shows all my favorited events,
**So that** I can easily keep track of them.

**Acceptance Criteria:**

*   **Given** I am logged in,
*   **When** I navigate to the "Favorites" page,
*   **Then** I see a list of all the events I have favorited.
*   **And** I can unfavorite an event directly from this page.

### Story 2.3a: Build the saved-locations backend GraphQL API layer

**As a** developer,
**I want** GraphQL mutations and a query to create, update, delete, and list a user's saved locations,
**So that** Stories 2.3, 2.4, and 2.5 read and write saved locations through the backend API instead of the frontend calling the database directly.

**Acceptance Criteria:**

*   **Given** Story 0.17's auth context and Story 1.1's `user_locations` table exist,
*   **When** a client sends `createUserLocation(name, address, lat, lng)`, `updateUserLocation(id, ...)`, or `deleteUserLocation(id)` mutations,
*   **Then** the corresponding row is created/updated/deleted scoped to `context.user`'s ID, never trusting a client-supplied user ID.
*   **And** a `myLocations` query returns only the authenticated caller's saved locations.
*   **And** any address-to-coordinate resolution needed to populate `lat`/`lng` is performed backend-side, exclusively through the Geolocation adapter (Story 0.16) — never a direct Geoapify API call from `apps/web`.
*   **And** no package outside `apps/backend` imports the database/domain layer directly for locations data.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — Story 1.1 already created the `user_locations` table, but no story exposes it via GraphQL. Classified as a single-story-family architecture split (needed by Stories 2.3, 2.4, and 2.5), positioned immediately before Story 2.3, mirroring the Story 1.3/1.3a split.

**Depends on:** Story 0.16, Story 0.17, Story 1.1.

### Story 2.3b: Extend the Geolocation adapter and saved-locations API with address autocomplete support

**As a** developer,
**I want** the Geolocation adapter and the saved-locations GraphQL API extended with an address-autocomplete/predictions capability and a place-ID-based location input mode,
**So that** Story 2.3's "My Locations" add/edit form can offer a live typeahead search-and-select experience instead of a single blind geocode call on a raw address string.

**Acceptance Criteria:**

*   **Given** Story 0.16's Geolocation adapter exists but exposes no predictions/autocomplete capability,
*   **When** a client needs address suggestions for partial input,
*   **Then** a new adapter method (e.g. `getAddressPredictions(input: string): Promise<AddressPrediction[]>`) wraps Geoapify's Geocoding Autocomplete endpoint (`https://api.geoapify.com/v1/geocode/autocomplete`), returning candidate `{ placeId, description }` pairs, exclusively through this adapter — never a direct Geoapify call from `apps/web`.
*   **And** a new `addressAutocomplete(input: String!): [AddressSuggestion!]!` GraphQL query, `requireAuth`-scoped (this fronts a billed external API, unlike the public `events` query), exposes this capability to the frontend.
*   **And** `CreateUserLocationInput`/`UpdateUserLocationInput` (Story 2.3a) gain an optional `placeId: String` field as a third, mutually-exclusive input mode alongside the existing `address`/`latitude`+`longitude` modes, wired to the Geolocation adapter's already-built but previously-unused `PLACE_ID` `GeolocationQuery` variant (`getPlaceDetails`) — so selecting an autocomplete suggestion resolves to full `LocationDetails` via one Place Details call, not a redundant re-geocode of the suggestion's description text.
*   **And** the query is subject to the same GraphQL depth/complexity limits (Story 0.8) as the rest of the schema, given it fronts a paid, quota-limited external API.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — Story 2.3's own creation surfaced a genuine, user-directed decision to build live address-autocomplete/typeahead (rather than a plain single-geocode text field), which needs backend capability neither Story 0.16's adapter nor Story 2.3a's mutations expose (no predictions/autocomplete method, no `placeId` input mode wired to GraphQL). Classified as a single-story architecture split (needed only by Story 2.3 today), positioned immediately after Story 2.3a and before Story 2.3, mirroring the Story 1.3/1.3a/1.3b split.

**Depends on:** Story 0.16, Story 2.3a.

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

### Story 2.4a: Set up frontend map integration and reusable Map component

**As a** developer,
**I want** a reusable frontend map component integrated with a tile provider (e.g., MapLibre GL JS with Geoapify tiles) and a restricted frontend API key,
**So that** Story 2.4 has the infrastructure needed to render a map for location picking without directly calling unmanaged external services or exposing the backend API key.

**Acceptance Criteria:**

*   **Given** a feature needs to display an interactive map (e.g., location picking in Story 2.4),
*   **When** the Map component renders,
*   **Then** it successfully loads map tiles using a secure, restricted frontend API key specific to the tile provider (e.g., Geoapify Maps).
*   **And** it supports displaying a marker and emitting the selected coordinates back to its parent form.
*   **And** it is encapsulated in `packages/ui` so the raw mapping library is not leaked into feature pages.
*   **And** this client-side key is stored in `.env` and restricted by HTTP referrer in the provider's dashboard, completely separate from Story 0.16's backend geocoding key.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 2 readiness sweep re-run. Story 2.4 requires picking a location on a map, but the Geolocation adapter (Story 0.16) is strictly backend-only. A frontend map tile integration and component must be explicitly set up. Classified as a single-story UI/architecture split, positioned immediately before Story 2.5a.

**Depends on:** Story 0.3.

### Story 2.4b: Extend the Geolocation adapter with a reverse-geocode preview query

**As a** developer,
**I want** a new `previewLocation(latitude: Float!, longitude: Float!): LocationDetails!` GraphQL query that wraps Story 0.16's existing `resolveLocation` in its `{ kind: 'COORDINATES', coordinates }` mode without persisting anything,
**So that** Story 2.4's "Use my current location" and "Pick on map" flows can show the user the actual resolved, human-readable address before they commit to saving it, instead of only raw coordinates.

**Acceptance Criteria:**

*   **Given** Story 0.16's Geolocation adapter's `resolveLocation` already supports reverse-geocoding via a `{ kind: 'COORDINATES', coordinates }` query,
*   **When** a client sends `previewLocation(latitude, longitude)`,
*   **Then** the resolver calls `resolveLocation` with that mode and returns the resulting `LocationDetails` (`formattedAddress`, `placeName`, `coordinates`, `provider`) — a pure read, no database write.
*   **And** the query is `requireAuth`-scoped (Story 0.17), matching `addressAutocomplete`'s (Story 2.3b) treatment as a billed, quota-limited external-API-backed read, not a public query.
*   **And** the query is subject to the same GraphQL depth/complexity limits (Story 0.8) as the rest of the schema.
*   **And** repeated calls with the same coordinates reuse Story 0.16's existing Postgres-backed geolocation cache — no duplicate provider calls for the same coordinate pair within the cache's lifetime.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced during Story 2.4's creation (2026-08-04). Story 2.4a's own Out-of-Scope note assigns "reverse-geocoding a clicked point into a human-readable address" to Story 2.4, but no existing GraphQL query exposes reverse-geocoding as a standalone read — only as a side effect of the `createUserLocation`/`updateUserLocation` mutations (Story 2.3a), which persist a row. Story 2.4 needs to preview the resolved address before the user commits to Save, presented to and confirmed by the user as the preferred option over a coordinates-only preview (2026-08-04). Classified as a single-story architecture split (needed only by Story 2.4 today), positioned immediately after Story 2.4a and before Story 2.5a.

**Depends on:** Story 0.16, Story 0.17.

### Story 2.5a: Extend the events GraphQL API with geo-distance query support

**As a** developer,
**I want** a new radius/distance condition type in the Unified Query DSL and matching resolver logic in the events API,
**So that** Story 2.5 can filter events by proximity to a saved location without inventing a parallel, non-conforming query mechanism.

**Acceptance Criteria:**

*   **Given** Story 2.3a's saved locations and Story 1.3a's events resolver exist,
*   **When** a client sends a Unified Query DSL request (AD-1) containing a new `withinRadius` condition referencing a `locationPreferenceId` and a `radiusKm` value,
*   **Then** the backend resolves it by computing distance from that saved location's coordinates against each event's coordinates (e.g. `ST_DWithin`/haversine) and returns only events within the specified radius.
*   **And** the same `withinRadius` operator also accepts an ad-hoc `{ latitude, longitude, radiusKm }` value shape (no `locationPreferenceId`, no ownership check) for filtering directly against supplied coordinates, needed by Story 2.5's "no saved location -> use current browser location" fallback.
*   **And** the formal field/operator list maintained in the API docs (AD-1) is updated to document the `withinRadius` operator and both its value shapes.
*   **And** any indexing needed to keep radius filtering performant (e.g. a spatial index on event coordinates) is added, extending project-context.md's Database Indexing rule (currently silent on geo lookups).

**Note:** This story exists because of Gate 1 (`story-split-gate.md`) — AD-1's DSL as specified has no geo-distance operator, and Story 2.5 cannot be built against it as-is. Classified as a single-story architecture split (needed only by Story 2.5), positioned immediately before it. **Amended 2026-08-06** while drafting Story 2.5: added the ad-hoc-coordinate value shape (AC1a in the story file) since 2.5a had not yet started implementation — the user chose to broaden this story's contract in place rather than split a new prerequisite story or work around it client-side.

**Depends on:** Story 1.3a, Story 2.3a.

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

### Story 2.6b: Wire the Add-to-Calendar trigger — schedule-selection dialog, internal bookmark, and native export

**As a** user,
**I want** to tap "Add to Calendar" on an event's detail page, pick which of its schedules to add, and have those schedules bookmarked in the app and downloaded to my phone's calendar,
**So that** they show up on my "My Calendar" page (Story 2.6) and in my native calendar app, per `01.2-event-detail.md`'s "Adding to Calendar" scenario and FR11/FR12's one-way app-to-calendar integration.

**Acceptance Criteria:**

*   **Given** I am viewing an event's detail page with one or more schedules,
*   **When** I tap the existing "Add to Calendar" control,
*   **Then** a dialog opens listing each of the event's schedules as an independently checkable row, pre-checked for any schedule already added.
*   **And** tapping "Confirm" calls `toggleCalendarAddition` (Story 2.1a) once per schedule whose checked-state actually changed, and triggers Story 2.1b's ICS download for any schedule newly checked in this action.
*   **And** a success announcement confirms the action, and the "Add to Calendar" icon reflects an "added" state whenever at least one schedule is currently added.
*   **And** if I am not logged in, tapping "Add to Calendar" redirects me to `/login` instead of opening the dialog.

**Note:** This story exists because of a Gate 2/escape-hatch finding surfaced while creating Story 2.6 (2026-08-06). Story 2.1's Out-of-Scope note, Story 2.1b's Out-of-Scope note, and `epic-2-readiness.md`'s "Anticipated Gate 2 note" all independently flagged that no story builds the actual "Add to Calendar" trigger UI — without it, Story 2.6's My Calendar page would have no non-favorited data to ever display. Classified as a single-story UI/architecture split, lettered `2.6b` (directly off Story 2.6, since `2.6a` is already used by the user-settings story) and positioned immediately before Story 2.6. The user confirmed via `AskUserQuestion` that this should be a separate prerequisite story, and that "Add to Calendar" should implement the full per-schedule dialog from `01.2-event-detail.md` — firing both the internal bookmark mutation (Story 2.1a) and the native ICS export (Story 2.1b) — rather than a simpler single-icon-instant-toggle mirroring the Favorite heart.

**Depends on:** Story 1.6a, Story 2.1a, Story 2.1b.

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

### Story 2.6a: Create user-settings table and settings query/mutation resolvers

**As a** developer,
**I want** a `user_settings` table (holding at least `hidePastEventsAfterDays` and `pushNotificationsEnabled`, keyed to `users`) with a `mySettings` query and `updateUserSettings` mutation,
**So that** every feature needing a per-user preference — past-event auto-hide (Epic 2), notification toggle (Epic 2), and notification-gated delivery (Epic 3) — reads and writes through one consistent, owned settings store instead of each feature inventing its own.

**Acceptance Criteria:**

*   **Given** Story 1.1's `users` table and Story 0.17's auth context exist,
*   **When** the migration script runs,
*   **Then** a `user_settings` table is created with (at minimum) `user_id` FK (unique), `hide_past_events_after_days` (int, sensible default), and `push_notifications_enabled` (boolean, default per NFR/PRD), plus standard timestamps.
*   **And** an `updateUserSettings(...)` mutation and a `mySettings` query are exposed, scoped to `context.user` via `requireAuth` (Story 0.17) — never trusting a client-supplied user ID.
*   **And** Story 2.7's past-event hiding logic and Story 2.9's notification toggle both read/write through this single table rather than each defining its own storage.
*   **And** Epic 3's Story 3.8 reads `pushNotificationsEnabled` from this same table/query rather than a separate notification-preferences store, per the cross-epic dependency identified in this readiness sweep.

**Note:** This story exists because of Gate 3 (`story-split-gate.md`), surfaced by the Epic 2 readiness sweep (`bmad-epic-readiness-check`) — no story anywhere creates user-settings storage, and it is needed by both Epic 2 (Stories 2.7, 2.9) and Epic 3 (Story 3.8), making it a cross-epic shared-data-ownership gap rather than an Epic-2-only concern. Positioned immediately before Story 2.7, the first Epic 2 consumer, following the Story 1.1/3.3a precedent of scoping originating tables to the epic that first needs them rather than to Epic 0.

**Depends on:** Story 0.17, Story 1.1.

### Story 2.7: Automatically hide past events

**As a** user,
**I want** past events to be automatically hidden after a configurable number of days, everywhere I browse or manage events,
**So that** the main event feed and my personal lists stay clean and relevant.

**Acceptance Criteria:**

*   **Given** an event's schedules have all ended more than `N` days ago (no schedule's end date — or start date, if it has no end date — falls on/after `now - N days`),
*   **When** any event query resolves (Discovery/Feed, Favorites, My Calendar, search/filter results),
*   **Then** the event is excluded by default from the results, via a resolver-level default visibility condition AND'd with the caller's query (reusing Story 1.3h's `scheduleDateRange`/`overlaps` EXISTS mechanism against ALL of the event's schedules, not just the main one) — never a client-side/post-fetch filter.
*   **And** for authenticated users, `N` is read from `mySettings.hidePastEventsAfterDays` (Story 2.6a, default 7); for unauthenticated callers, `N` defaults to the same value (7), since no per-user setting exists.
*   **And** the default visibility condition is structured as an extensible, ordered list of rule-conditions — this story contributes the first entry (the past-event rule) — so that future rules (moderator soft-delete, personal report-hide) can each be added as one more list entry later without restructuring the resolver.
*   **And** past events remain reachable only via the dedicated future "Archive" page (Story 4.8, out of scope here) — this story introduces no bypass/opt-out of the default filter.

**Note:** AC broadened 2026-08-06 during `bmad-create-story`, confirmed with the user via `AskUserQuestion`. The original AC (pre-2026-08-06) scoped hiding to "Favorites"/"My Calendar" only, matching PRD §3.4.2's original personal-lists-only wording. The user redirected scope to a global default (every event view, not just personal lists) with a new dedicated Archive page (Story 4.8) as the escape hatch, and requested the hiding rule be built as a reusable, extensible mechanism so Epic 4's soft-delete/personal-hide rules (Stories 4.3a/4.4a) can plug into the same seam later instead of each inventing separate filtering. Two further implementation tradeoffs were confirmed with the user: (1) the SQL condition reuses Story 1.3h's `overlaps` operator, extended to accept an open-ended `to: null` bound, rather than a new dedicated operator; (2) the default-conditions composition is built as an explicit extensible list now, not a single hardcoded condition.

**Depends on:** Story 2.6a, Story 1.3a, Story 1.3h.

### Story 2.8: User Menu

**As a** logged-in user,
**I want** to have a user menu,
**So that** I can easily navigate to my personalized/account sections of the application without leaving the page I'm on.

**Acceptance Criteria:**

*   **Given** I am not logged in,
*   **When** I look at the Profile slot in the global nav (Story 0.7),
*   **Then** it renders as a "Log In" trigger (icon `LogIn`) that navigates to `/login` (Story 1.7) when activated — not a menu.
*   **Given** I am logged in,
*   **When** I click/tap my avatar in the Profile slot,
*   **Then** a menu opens **anchored to the nav item** — a dropdown at desktop/tablet rail widths (≥768px), a bottom sheet at mobile widths (<768px) — not a full-page navigation and not a blocking modal.
*   **And** the menu is a *disclosure of navigation links*, not an application command menu: the trigger is `aria-haspopup="true"`/`aria-expanded`; contents are a plain list of links (no `role="menu"`/`"menuitem"`); it does **not** trap focus (Tab past the last item closes it and moves on); `Escape`/outside-click close it and return focus to the trigger; activating a link instead moves focus to the destination page per normal route-change behavior. The bottom sheet has an explicit always-reachable Close control, not just outside-tap/Escape.
*   **And** the menu contains, top to bottom: a non-interactive avatar+display-name header; **Profile** (`/settings`); **Locations** (`/settings/locations`); **Subscribed Accounts** (`/settings/subscriptions`); **API Keys** (`/settings/api-keys`); **Notifications** (`/settings/notifications`); **Reports** (`/reports`); a divider; **Moderator Items** (`/moderator/items`), rendered (with its own leading and trailing divider) only when `role === MODERATOR` — otherwise fully absent, not disabled; **Log Out**.
*   **And** the menu is built as a typed, declarative **registry** (mirroring Story 0.7's primary nav-registry pattern), not a hardcoded list — Locations/Subscribed Accounts/API Keys/Notifications are registered by Stories 2.3/3.2/3.9/2.9 respectively, Reports/Moderator Items by Stories 4.6/4.7, so this story does not itself need those destination pages to exist yet — it only needs to define the registry shape and seed it with Profile and Log Out (the two entries this story does own).
*   **And** "Log Out" calls `useAuthSession().signOut()` (Story 1.7's `apps/web/src/components/providers/auth-session-provider.tsx`) and returns the user to the unauthenticated state (Profile slot reverts to the "Log In" trigger); focus returns to the trigger element (deliberate exception to the "focus follows destination" rule above, since the same DOM node persists, now relabeled).
*   **And** the Moderator Items link's visibility check (`role === MODERATOR`) reads from the generated `useMeQuery` (Story 1.7/0.8's GraphQL codegen — `Query.me` already resolves `role`), not from `useAuthSession()`'s context value, which exposes only `session`/`user`/`isLoading`/`signOut` today and has no `role` field.

**Note:** Original AC (pre-2026-08-05) listed "My Favorites", "My Calendar", "My Locations", "Settings" as the menu's links. "My Favorites"/"My Calendar" are removed here as redundant — both became first-class items in the primary 5-item nav via Story 0.7's UX formalization, so keeping them in this menu too would be duplicate navigation to the same destinations. "My Locations"/"Settings" are expanded into the full settings-registry set. This AC was formalized via a UX spec pass + accessibility review (`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` § Profile item — authentication states, `review-accessibility-profile-menu.md`) run while revising Story 0.7 — moved here on discovering this story already owns the feature (was initially, incorrectly, drafted as if Epic 0/0.7 owned it).

**Depends on:** Story 0.7 (Profile trigger slot in the global nav), Story 1.7 (`/login` route).

### Story 2.9: Manage Push Notification Settings

**As a** user,
**I want** to be able to enable or disable push notifications for new events,
**So that** I have control over the notifications I receive.

**Acceptance Criteria:**

*   **Given** I am on the "Settings" page,
*   **When** I navigate to the "Notifications" section,
*   **Then** I see a toggle to enable or disable push notifications for new events.
*   **And** my choice is saved and respected by the system.

### Story 2.10: Service Worker Lifecycle Updates and Database Self-Healing

**As a** developer,
**I want** the push notification service worker and storage layers to automatically update and self-heal from database conflicts, and proactively report failures to me via email and analytics,
**So that** the notification system remains functional and monitored without manual intervention.

**Acceptance Criteria:**

*   **Given** a new version of `firebase-messaging-sw.js` is deployed,
*   **When** the app registers it,
*   **Then** `skipWaiting` and `clients.claim` are triggered so the new SW takes active control immediately.
*   **Given** any background IndexedDB `VersionError` occurs during FCM registration/token request,
*   **When** caught,
*   **Then** the application programmatically deletes `firebase-messaging-database` to self-heal, triggers a retry, and captures a `push_notifications_sw_error` analytics event in PostHog.
*   **Given** the service worker registers successfully,
*   **When** a registration object is returned,
*   **Then** `.update()` is invoked programmatically to fetch any updated scripts.
*   **Given** a critical client-side Service Worker or IndexedDB error is caught,
*   **When** the self-healing occurs,
*   **Then** the application dispatches the backend `reportSystemError` GraphQL mutation (Story 0.23), which sends an alert email to the configured developer/administrator address via the Outbound Email Adapter (Story 0.15).

**Note:** Backfilled into epics.md on 2026-08-07 via `bmad-create-story` — this story's file and its `ready-for-dev` sprint-status entry already existed, but no corresponding epics.md section did, discovered while running `bmad-create-story 2-10`. Original AC4 ("dispatches a backend `reportSystemError` mutation... using the backend's Outbound Email Adapter (Story 0.15)") is revised here to point at Story 0.23 instead of Story 0.15 directly, reflecting that Gate 1/Gate 3 findings during this same run split the generic `reportSystemError` mutation and its email template into its own foundation story rather than having 2.10 build it ad hoc.

**Depends on:** Story 0.12 (FCM foundation), Story 0.23 (system error reporting foundation).

### Epic 3: Social Media Event Integration

Users can subscribe to social media accounts to import events into their feed.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR66

### Story 3.1a: Create social media account profiles table

**As a** developer,
**I want** a `social_media_account_profiles` table (matching the PRD's `SocialMediaAccountProfile` interface, PRD §4.5) that is shared across every subscriber of an account, with `subscriptions` narrowed to a pure per-user join (`id`, `userId`, `accountId` FK, `createdAt`, `deletedAt` — PRD §4.9) instead of duplicating platform/displayName/username/profileImageUrl/description/lastPostDate on every subscriber's row,
**So that** account-level data — starting with `defaultLocation` (FR66/FR67, Story 3.3/3.3b) — has exactly one row per account instead of being ambiguously duplicated per subscriber.

**Acceptance Criteria:**

*   **Given** Story 1.1's tables exist, **when** the migration script runs, **then** a `social_media_account_profiles` table is created with `id` (uuid pk), `account_id` (text, not null — the platform-native identifier, PRD §4.5's `accountId`, e.g. a Twitter User ID or Instagram account ID, unique per `platform`), `platform`, `username`, `displayName`, `profileImageUrl`, `description`, `lastPostDate`, and `defaultLocation` (jsonb, nullable, PRD §4.5) — the fields currently duplicated on `subscriptions` — plus standard timestamps.
*   **And** the `subscriptions` table is migrated to drop `accountId` (text), `platform`, `displayName`, `username`, `profileImageUrl`, `description`, `lastPostDate`, replacing them with a single `accountId` (uuid, FK to `social_media_account_profiles.id`, not null); `subscriptions` becomes the pure per-user join row described by the amended PRD §4.9. No production user data exists yet (Story 1.2's fixtures are dev/test-only per Story 1.2a's precedent), so this is a destructive schema change, not a backfill migration.
*   **And** `subscriptions.deletedAt` (timestamp, nullable) is added per AD-8 (Soft-Delete Convention) — the first consumer is Story 3.2's `removeSubscription` mutation.
*   **And** subscribing to an account that has no existing `social_media_account_profiles` row (matched by `platform` + `account_id`) creates one; subscribing to an already-profiled account only creates a new `subscriptions` join row — this lookup-or-create logic is exposed for Story 3.1/3.2's mutation to call, not reimplemented per-story.
*   **And** `packages/shared-types`'s `Subscription` and new `SocialMediaAccountProfile` interfaces are added/updated to match (PRD §4.5, §4.9).
*   **And** the `posts` table (Story 1.2a, Epic 1 — already exists by the time this story runs) is migrated: add `account_id` (uuid, FK to `social_media_account_profiles.id`), backfill it from each post's `subscription_id` via `subscriptions.accountId`, then drop `subscription_id` and make `account_id` not null, with an index on `account_id` replacing the old `subscription_id` index. Story 1.2a itself is intentionally left creating `posts.subscription_id` — Epic 1 must stay buildable without this story existing yet, the same reasoning that pulled `posts`'s creation into Epic 1 ahead of Epic 3 in the first place; this story evolves the column once it runs, rather than 1.2a depending forward on it.
*   **And** a new, unauthenticated `socialMediaAccountProfileByAccountId(platform, accountId)` query is exposed, returning the profile (including its internal `id`) — this is the lookup Story 3.11's public account page uses to resolve a URL's `platform`/`accountId` to the profile row, and it is deliberately not behind `requireAuth` (Story 0.17), since the account page itself is public.
*   **And** the lookup-or-create logic's check for an existing subscription join row (to decide "already subscribed" vs. "create new") excludes soft-deleted rows via `activeOnly(table)` (Story 0.22), not a hand-written `isNull(...)` clause.

**Note:** Classified as a shared data-ownership gap by the Epic 3 readiness re-sweep (`bmad-epic-readiness-check`, re-run 2026-08-01 following FR66/FR67 and Story 3.3b) — Gate 3 found `SocialMediaAccountProfile` (PRD §4.5, amended by the 2026-08-01 `defaultLocation` PRD change) has no owning story anywhere, while Story 1.1's `subscriptions` table (done) still duplicates account-profile fields per-subscriber, the exact ambiguity the `defaultLocation` amendment says it's moving away from. Needed by Epic 3 (Stories 3.1-3.3b) and read by Epic 4 (Story 4.7's `DefaultLocationChangeRequest.accountId`) — clears Gate 3's cross-epic reuse bar. Following the precedent of Story 1.1 scoping core tables to their originating epic, this is placed here, before Story 3.1, rather than in Epic 0. The `posts.account_id` migration AC above was added specifically to avoid making Epic 1's already-`ready-for-dev` Story 1.2a depend forward on this Epic 3 story — see that AC's own note.

**Amendment (2026-08-02, added via bmad-correct-course):** Added the `account_id` column, its uniqueness per `platform`, and the `socialMediaAccountProfileByAccountId` query. The PRD's `SocialMediaAccountProfile.accountId` (§4.5) — the platform-native identifier — was documented from the start but never actually persisted by this story's original AC, and the lookup-or-create match key incorrectly used `username` (which can be renamed) instead. Surfaced while adding new Story 3.11 (public per-account event page, FR68), which needs a stable, public-facing identifier to resolve URLs like `/{platformSlug}/{accountId}` to a profile row — `username` doesn't satisfy that, and the internal `id` (uuid) is deliberately kept out of URLs.

**Depends on:** Story 1.1, Story 1.2a (for the `posts` table this story migrates), Story 0.22.

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
*   **And** submitting the Gemini API key persists it by calling the same `createApiKey` mutation Story 3.1b builds and owns (Story 0.8 scaffold, Story 0.17 authenticated context) that encrypts the key using the KMS key (Story 0.14, via Story 0.13's `kms.ts`) before storage — never stored in plaintext and never encrypted client-side. **This wizard step does not reimplement key creation** — see Story 3.1b's Amendment note.
*   **And** subscribing to the first social media account persists the subscription by calling a `subscribeToAccount(input: SubscribeToAccountInput!): SubscribeToAccountResult!` mutation — **built and owned by this story** (Story 0.8 scaffold, Story 0.17 authenticated context) — that wraps Story 3.1a's `subscribeToAccount()` lib function; not a direct database write from `apps/web`. This is the canonical subscribe mutation Story 3.2's own "Subscribe" action reuses (see Story 3.2's Forward note) rather than each independently inventing one.
*   **And** the wizard is built on Story 0.24's generic `/wizard/[wizardKey]/[stepSlug]` primitive, registered as the `onboarding` wizard entry with steps `api-key` and `subscribe`; the triggering feature (e.g. the "Manage Subscriptions" entry point) captures the page the user was trying to reach as the `redirect` search param and links directly to the `api-key` step, or straight to the `subscribe` step if the user already has at least one active API key (skipping an already-satisfied prerequisite).
*   **And** the subscribe step is a simple manual-entry form (a small, hardcoded MVP platform selector — not blocked on Story 3.3c's future platform-slug registry — plus a text input for the account URL/handle used to derive `accountId`/`username`, with `displayName` defaulting to the handle); no live scrape-based account validation is performed at submit time in this story (Story 3.4's scraper is unbuilt/placeholder — see its Forward note) — accepted as an explicit gap, not silently dropped.

**Depends on:** Story 3.1a, Story 3.1b, Story 0.24.

**Amendment (2026-08-07, added via `bmad-create-story` while creating Story 3.1b):** Story 3.1b (originally scoped as view+revoke only) had its scope expanded, at user's request during its own story creation, to also own key *creation* — since the UX scenario doc (`design-artifacts/C-UX-Scenarios/04-alex-manages-keys/04.1-manage-api-keys.md`) shows an "Add New Key" row on the same `/settings/api-keys` page. Story 3.1b is now the sole owner of the `createApiKey` mutation; this wizard step must call that exact mutation rather than building its own. `Depends on` updated accordingly (previously only Story 3.1a).

**Amendment (2026-08-07, added via `bmad-create-story` during this story's own creation):** Three further decisions confirmed with the user via `AskUserQuestion`: (1) the generic `/wizard` mechanism implied by `design-artifacts/UX-wizard-page-run-1` and by `design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.1.1-entry-points.md`/`03.2-the-api-key-gate.md` (which describe a 3-step wizard shared with Story 5.5's later-added "Extract Events" step) has no owning story — split into new Story 0.24, this story now registers only its own 2 steps, leaving room for Story 5.5 to extend the registry later; (2) this story owns the `subscribeToAccount` mutation rather than Story 3.2 (mirroring, in reverse, the Story 3.1b precedent); (3) the richer subscribe UX described in `03.3-adding-a-subscription.md` (autocomplete for existing shared accounts, a live keyword-scan/API-quota-check confirmation dialog) is not reflected anywhere in this epic's ACs and is treated as a future refinement, not MVP scope — this story's subscribe step is a plain manual-entry form.

### Story 3.1b: Manage, add, and revoke API keys

**As a** user,
**I want** a dedicated page to view my saved Gemini API keys (masked), add a new one, and revoke ones I no longer want to use,
**So that** I can control which of my BYOK keys the system is allowed to use for event extraction, both during and after onboarding.

**Acceptance Criteria:**

*   **Given** I am logged in and navigate to the `/settings/api-keys` page (UX-DR9),
*   **When** the page loads,
*   **Then** I see my saved API keys, each shown masked (last 4 characters only, e.g. `••••1234` — never the decrypted value, never a key prefix), fetched via a `myApiKeys` query, scoped to `context.user` via `requireAuth` (Story 0.17) and filtered to active rows via `activeOnly(table)` (Story 0.22), not a hand-written `isNull(...)` clause.
*   **And** I can click an "Add API Key" action to open a modal (matching this app's established `/settings/*` add-item modal pattern, e.g. `LocationFormDialog`, rather than an inline editable table row) prompting for a provider (a single-option "Gemini" selector at MVP — no other provider is supported) and the raw key value, with a "How to get a Gemini API key?" help link.
*   **And** submitting the add-key form calls a `createApiKey(input: CreateApiKeyInput!): ApiKey!` mutation (Story 0.8 scaffold, Story 0.17 authenticated context) that encrypts the key server-side via AWS KMS (Story 0.13's `kms.ts`, Story 0.14's provisioned `BYOK_KMS_KEY_ID`) before persisting — never stored in plaintext, never encrypted client-side — and returns the new key already masked; a success toast confirms and the new key is prepended to the list. This is the **same** `createApiKey` mutation Story 3.1's onboarding wizard step 1 calls — not a separate/duplicate mutation (see Story 3.1's Amendment note).
*   **And** I can revoke a key, which calls a `deleteApiKey(id: ID!, action: SoftDeleteAction!)` mutation (AD-8 rule 4 — the `SoftDeleteAction` enum is reused from `apps/backend/src/schema/typeDefs.graphql`, never redeclared) that soft-deletes the key (never a hard delete) and returns the updated `ApiKey!`.
*   **And** attempting to revoke an already-revoked key (an invalid state transition) throws a `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` rather than silently no-op'ing.
*   **And** a revoked key is immediately excluded from the AI Gateway Adapter's (Story 0.13) key-selection pool for future extraction calls — `fetchCandidateKeys` must filter via `activeOnly(apiKeys)` (Story 0.22), a requirement added to Story 0.13's task list by this story's creation (see Story 0.13's Amendment note).
*   **And** the revoke interaction uses the reusable Soft-Delete-with-Undo primitive (`useSoftDeleteWithUndo`/`SoftDeleteToaster`, Story 0.18 — which explicitly named API Keys as an intended consumer): the `DELETE` mutation commits immediately, the row greys out with an "Undo" toast, clicking Undo calls `deleteApiKey(RESTORE)`, and letting the toast expire leaves the key revoked and splices it from the local list — matching `locations-content.tsx`'s reference implementation.
*   **And** the page is a `/settings/api-keys` route composed inside the app shell (Story 0.7), matching the pattern of the other `/settings/*` pages.

**Note:** Classified as a Gate 3 gap by the Epic 3 readiness re-sweep (`bmad-epic-readiness-check`, re-run 2026-08-07) — `/settings/api-keys` is a named route in UX-DR9, and Architecture Spine AD-8 explicitly anticipates an `ApiKey` delete mutation ("`ApiKey`/`Subscription` delete mutations (Epic 3/4) once built" must use the rule-4 soft-delete shape), but no story anywhere built the list/revoke surface — Story 3.1 only ever creates a key during onboarding, and Story 1.1 only creates the table. A prior sweep (2026-07-31/08-01) had flagged this as an FR-completeness note for the PM rather than an architecture gap; this re-sweep upgrades it because the gap is now also named directly in the Architecture Spine, not just implied by an unbuilt UX-DR9 route. Positioned directly after Story 3.1 (the only existing story that writes to `api_keys`), scoped to Epic 3 rather than Epic 0 since API-key management is a single-epic, user-facing feature with no cross-epic reuse — unlike the Gemini/email/geolocation adapters (Stories 0.13/0.15/0.16), which are genuinely consumed by multiple epics.

**Amendment (2026-08-07, added via `bmad-create-story`):** During this story's own creation, a UX scenario doc (`design-artifacts/C-UX-Scenarios/04-alex-manages-keys/04.1-manage-api-keys.md`, not previously cross-checked against this story's AC) was found to describe an "Add New Key" row on this same page — out of this story's original view+revoke-only scope. A Gate 2 (UI Complexity & Reusability) pass confirmed no new component split was needed either way (the add-flow reuses the existing modal pattern, not a novel primitive). Per user decision (AskUserQuestion during story creation), the add-flow was folded into this story rather than left as a documented gap, since it is the same page and the mutation it needs did not otherwise have an owning story. The UX doc's alternative masking convention ("first 5 characters, key-prefix style") was explicitly **not** adopted — this story keeps the AC's original "last 4 characters" convention as the more conservative, less-leaky default. Story title/User Story updated from "Manage and revoke" to "Manage, add, and revoke" to reflect the expanded scope.

**Depends on:** Story 1.1, Story 0.13, Story 0.14, Story 0.17, Story 0.22.

### Story 3.2: Subscribe to, view, and remove social media account subscriptions

**As a** user,
**I want** to view my list of subscribed accounts on the "My Subscriptions" page, subscribe to a new account, and remove ones I no longer want to monitor,
**So that** I can fully manage which accounts I'm monitoring for events, not just add to them.

**Acceptance Criteria:**

*   **Given** I am on the "My Subscriptions" page (`/settings/subscriptions`),
*   **When** the page loads,
*   **Then** I see a list of my active (non-removed) subscribed accounts, fetched via a `mySubscriptions` query (Story 0.8 scaffold, Story 0.17 authenticated context, `activeOnly(table)` per Story 0.22) — **built and owned by this story** (moved here from Story 5.1a's original scope; see this story's Ownership Note below).
*   **And**, given I have at least one API key, when I enter a social media account URL and click "Subscribe", then the subscription is saved to my account by calling the **same** `subscribeToAccount(input: SubscribeToAccountInput!): SubscribeToAccountResult!` mutation Story 3.1's onboarding wizard already builds and owns (wrapping Story 3.1a's `subscribeToAccount()` lib function) — this story does not add a duplicate mutation.
*   **And** I see the new subscription in my list of subscriptions without a full page reload (optimistic append or refetch).
*   **And** the subscription is created with `isNewlyAdded: true` (PRD §3.10) — consumed by Story 5.1a's extended `mySubscriptions` query/`markSubscriptionViewed` mutation to auto-activate and then clear the corresponding tab in Epic 5's Manual Post Selection screen. `subscriptions.is_newly_added` (`boolean`, default `true`) already exists in the DB (Story 3.1a's actual migration `0013_bizarre_midnight.sql`), even though Story 3.1a's own epics.md AC text never enumerated it — a documentation gap only, not a code gap; no migration is needed from this story.
*   **And** checking whether the user is already subscribed to this account filters via `activeOnly(table)` (Story 0.22), not a hand-written `isNull(...)` clause.
*   **And** I can remove a subscription I no longer want, which calls a `removeSubscription(id: ID!, action: SoftDeleteAction!): Subscription!` mutation — **built and owned by this story** — that soft-deletes the subscription (sets `deletedAt`, AD-8, never a hard delete, preserving history for quota/fairness accounting per PRD §4.9), matching the `deleteApiKey`/`deleteUserLocation` argument shape (AD-8 rule 4) so the existing Soft-Delete-with-Undo primitive (`useSoftDeleteWithUndo`/`SwipeToReveal`, Story 0.18) can drive it the same way `locations-content.tsx` does.
*   **And** attempting to remove an already-removed subscription (an invalid state transition) throws a `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` rather than silently no-op'ing, matching Story 3.1b's `deleteApiKey` precedent.

**Ownership Note (2026-08-07, resolved via `bmad-create-story`, `AskUserQuestion`):** The original Forward note left by Story 3.1's creation flagged that no story built `/settings/subscriptions`'s list/remove view, and that Story 5.1a (Epic 5) was slated to own `mySubscriptions`/`removeSubscription` — which would make Epic 3's own subscriptions page depend on Epic 5 existing first, a backward dependency. Confirmed with the user: this story now owns the base `mySubscriptions` query and `removeSubscription` mutation (the `Subscription`/`SocialMediaAccountProfile` tables both originate in this epic, Story 3.1a), matching the established `/settings/*` list+add+remove-in-one-story pattern (`locations-content.tsx`, Story 3.1b). Story 5.1a is narrowed to **extend** this story's `mySubscriptions` query with the `isInactive` field (which needs Story 3.3a's `posts` table, not available yet when this story ships) rather than rebuilding the query from scratch, and reuses this story's `removeSubscription` mutation as-is for Story 5.4's inactive-account removal flow. See Story 5.1a's own Amendment note for the corresponding change on that side.

**Depends on:** Story 3.1a, Story 3.1, Story 0.22.

### Story 3.3d: Build the reusable LocationPickerField component

**As a** developer,
**I want** the address-autocomplete-search, "use my current location", and "pick on map" location-acquisition flow — today implemented once, inline, inside `location-form-dialog.tsx` (Stories 2.3/2.3b/2.4/2.4a/2.4b) — extracted into reusable, presentational `packages/ui` components,
**So that** Story 3.3's "Set Default Location" action can offer the same location-acquisition experience as Saved Locations without duplicating ~250 lines of non-trivial async/stateful UI logic a second time.

**Acceptance Criteria:**

*   **Given** `location-form-dialog.tsx`'s existing address-search/current-location/map-pick logic (excluding the Saved-Locations-specific `name`/`radius` fields),
*   **When** this story extracts it,
*   **Then** a new `LocationPickerField` component exists in `packages/ui` (e.g. `packages/ui/src/features/locations/`): a controlled, presentational component that owns its own local UI state (typed search text, dropdown open/closed) but accepts suggestions/loading/preview data and all async behavior as props/callbacks (`suggestions`, `isSuggestionsLoading`, `onSearchInputChange`, `onSelectSuggestion`, `onUseCurrentLocation`, `onPickOnMap`, `resolvedPreview`, `error`, `labels` — see this story's 2026-08-08 Amendment) — it must not import `react-query` or any generated GraphQL hook directly, per `project-context.md`'s rule restricting Server State (React Query) to `apps/web` only; the consuming page owns all data-fetching and passes results in as props.
*   **And** a reusable map-picker-sheet equivalent (the bottom sheet combining an in-sheet search box with the map) is likewise extracted into `packages/ui`, following the same controlled-props pattern, also taking a `labels` prop (2026-08-08 Amendment).
*   **And** `MapView` (the raw MapLibre primitive, currently at `apps/web/src/components/ui/map.tsx`) is relocated into `packages/ui` — this closes a pre-existing gap in Story 2.4a's own AC ("it is encapsulated in `packages/ui` so the raw mapping library is not leaked into feature pages"), discovered during this story's creation, not new scope invented by this story. It is a forced consequence of extraction: a `packages/ui` component cannot import from `apps/web`.
*   **And** `location-form-dialog.tsx` and `map-picker-sheet.tsx` (Stories 2.3/2.4) are refactored to consume the new `packages/ui` components instead of their inline implementations, with no behavior change — their existing test suites continue to pass (only import/mock paths may need updating).
*   **And** the new components are exported from `packages/ui`'s public entry point, ready for Story 3.3 to consume.

**Note:** Classified as a Gate 2 gap (UI Complexity & Reusability) surfaced by `bmad-create-story` while drafting Story 3.3 — the user confirmed via `AskUserQuestion` that the default-location field should reuse the full autocomplete/current-location/map-pick experience (for consistency with Saved Locations) rather than a simpler plain-text/blind-geocode field, which would have avoided this split. Classified as a single-story architecture/UI split (needed by exactly Story 3.3 today), positioned immediately before it, matching the `1.3a`/`2.4a` precedent.

**Amendment (2026-08-08, added via `bmad-create-story` during this story's own creation):** A fresh Gate 2 pass (Freya) found the AC1/AC2 prop lists as originally written omitted a `labels` prop — every other extracted `packages/ui` component that renders its own copy (`MapView` itself, `EventCard`, `WizardNavigation`, `LocationRadiusFilter`, etc.) takes a `labels`/`labels?` object precisely because `packages/ui` cannot import `next-intl`. Without it, `LocationPickerField`/the map-picker-sheet equivalent would either hardcode English strings or leak `next-intl` into `packages/ui`, silently dropping existing localization for the address-search spinner/empty-state text, the current-location/pick-on-map button labels, and the map sheet's own title/search/footer copy. AC1 and AC2 below are corrected to require a `labels` prop, sourced by the `apps/web` consumer from its existing `SavedLocationsPage` i18n namespace — no new locale keys are introduced by this correction, since all the strings already exist.

**Depends on:** Story 2.3b, Story 2.4, Story 2.4a, Story 2.4b.

### Story 3.3: Set a default location for a subscription

**As a** user,
**I want** to be able to set a default location on an account I'm subscribed to, if it doesn't have one yet,
**So that** the system can use this location if it cannot find an explicit location in a post.

**Acceptance Criteria:**

1.  **Given** I am on `/settings/subscriptions` (Story 3.2) and one of my active subscriptions' account has no `SocialMediaAccountProfile.defaultLocation` set yet, **when** the row renders, **then** I see a "Set Default Location" action in place of a location value.
2.  **And** clicking it opens Story 3.3d's `LocationPickerField`/map-sheet (address-autocomplete search, "use my current location", "pick on map" — matching the Saved Locations experience for consistency), prefilled with nothing.
3.  **And** confirming a location persists it onto that account's `SocialMediaAccountProfile.defaultLocation` (never onto the `Subscription` row) via a new `setAccountDefaultLocation(accountId: ID!, input: SetAccountDefaultLocationInput!): SocialMediaAccountProfile!` mutation — **built and owned by this story**, backend-GraphQL-only (never a direct DB write from `apps/web`), reusing `packages/domain`'s `resolveLocationInputMode`/Story 0.16's Geolocation adapter exactly as `createUserLocation`/`updateUserLocation` already do (`SetAccountDefaultLocationInput` omits the blind-geocode `address` mode those mutations support, since this story's UI — Story 3.3d — always resolves through a selected `placeId` or explicit coordinates, never a raw typed address string).
4.  **And** once set, the AI extraction pipeline (Story 3.6, already implemented as an AC there) uses it as a fallback when a post has no explicit location — no change needed in this story.
5.  **And** if the account's `defaultLocation` is already set (by any previous subscriber, including this story's own prior write), the row shows the existing formatted value read-only instead of the "Set Default Location" action — surfaced via a small extension to Story 3.2's `getMySubscriptions` query, adding `defaultLocation` to its `account { ... }` selection; editing an already-set value is Story 3.3b, not this story.
6.  **And** calling `setAccountDefaultLocation` for an account whose `defaultLocation` is already set is rejected server-side with a `GraphQLError` (`extensions.code = 'INVALID_STATE_TRANSITION'`) — defense in depth, since the UI already hides the action once set; a real edit must go through Story 3.3b's moderation-gated path, not this mutation reused uncontrolled.
7.  **And** `setAccountDefaultLocation` requires the caller to be an active subscriber of the target account (`requireAuth`, Story 0.17, plus an `activeOnly(subscriptions)` check, Story 0.22) — an authenticated user cannot set another account's default location without being subscribed to it.
8.  **And** all user-facing strings (action label, picker labels, success/error toasts) are sourced through next-intl from Story 3.2's existing `SubscriptionsPage` namespace, with new entries added to both `apps/web/locales/en.json` and `apps/web/locales/id.json`.
9.  **And** the save action is wrapped in `BlockingLoader` (a critical, persisted mutation), per `project-context.md`'s Loaders rule.
10. **And** a `subscription_default_location_set` (`{ accountId }`) PostHog analytics event fires on successful save.

**Amendment (2026-08-01):** This story originally scoped `defaultLocation` as per-subscription, set once at signup. Architecture review found that AI extraction runs once per post for accounts with multiple subscribers (PRD §3.7 Tier 2 round-robin), so a per-subscriber default would be ambiguous about which value applies to the shared extracted event. `defaultLocation` moved to `SocialMediaAccountProfile` (PRD §4.5) — account-level, shared across all subscribers. This story is narrowed to the "no default exists yet" path (first subscriber sets it, no moderation needed since there's no prior value to protect); editing an existing default location is out of scope here and covered by the new Story 3.3b, which also adds moderator oversight since that path can silently change what every other subscriber sees.

**Amendment 2 (2026-08-08, added via `bmad-create-story` during this story's own creation):** The original AC's "an optional field... filling out the subscription form" was found to be technically unsatisfiable as written — its own last bullet ("if the account already has a `defaultLocation` set... this field is read-only, showing the existing value") requires knowing the account's pre-existing state *before* the field renders, but Story 3.1's wizard step and Story 3.2's subscribe dialog are both blind add-forms (platform + handle, submit) with no pre-submit account lookup; the account may not even exist as a row yet at that point. Cross-checked against `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s "Default Location for a Subscribed Account" user flow, which independently (and specifically) describes this exact feature as a separate "Set/Edit Default Location" action on each row of the already-subscribed accounts list (`/settings/subscriptions`) — a design that *can* satisfy the read-only-if-set condition, since the row already has the account's current data loaded. Presented to the user as a two-option tradeoff via `AskUserQuestion`; user confirmed relocating the field to the subscriptions-list row action (this rewrite) over extending Story 3.1/3.2's blind forms with a new pre-submission lookup step. A second `AskUserQuestion` confirmed reusing the full Saved-Locations-style autocomplete/current-location/map-pick experience (triggering the Story 3.3d Gate 2 split above) over a simpler plain-text/blind-geocode field. The AC's "via the same backend GraphQL mutation used by Story 3.2" line is superseded — Story 3.2 doesn't own a location-setting mutation; this story now builds and owns `setAccountDefaultLocation` itself, living on Story 3.2's page the same way Story 3.2's own `removeSubscription` lives alongside Story 3.1's reused `subscribeToAccount`.

**Depends on:** Story 3.1a, Story 3.2, Story 3.3d, Story 0.22.

### Story 3.3a: Create posts table and persist scraped posts

**As a** developer,
**I want** a `posts` table (matching the PRD's `Post` interface: `id`, `content`, `imageUrl`, `postUrl`, `isExtracted`, plus an `accountId` reference and `publishedAt` timestamp) and the persistence logic scraped posts are written to,
**So that** the scraping/queuing/extraction pipeline (Stories 3.4-3.6) and the manual post selection screens (Epic 5) share one consistent, queryable record of every scraped post and its extraction status.

**Acceptance Criteria:**

*   **Given** the initial database tables exist (Story 1.1), the `posts` table exists (Story 1.2a, with `subscription_id`), and `social_media_account_profiles` exists with `posts.account_id` migrated in (Story 3.1a),
*   **When** I run the migration script,
*   **Then** the `posts` table (already created by Story 1.2a, already migrated to `account_id` by Story 3.1a) has columns `id`, `account_id` (FK to `social_media_account_profiles`), `content`, `image_url`, `post_url`, `is_extracted` (default false), `published_at`, and standard timestamps — no further schema change is this story's responsibility.
*   **And** the table is indexed on `account_id` and `published_at` to support Epic 5's "20 most recent posts per account" and inactive-account (30-day) queries — index already added by Story 3.1a's migration.
*   **And** a persistence function exists for writing a newly scraped post (used by Story 3.4) and for updating a post's `is_extracted` status (used by Stories 3.6/3.6b).

**Note:** This story exists because of Gate 3 (`story-split-gate.md`), surfaced while creating Story 3.6 — the PRD's `Post` interface implies a persisted entity with an extraction-status flag, but Story 1.1 only created `events`/`schedules`/`users`/`user_locations`/`subscriptions`/`api_keys`. This table is written by Epic 3 (Stories 3.4-3.6) and read by Epic 5 (Stories 5.1-5.4), so — following the precedent of Story 1.1 scoping core data tables to their originating epic rather than Epic 0 — it is placed here, before Story 3.4, rather than in Epic 0.

**Amendment (2026-08-01):** This story's original scope included creating the `posts` table from scratch (first AC below). That table is now created earlier by Story 1.2a, surfaced by a Data Type Compatibility gap found while creating Story 1.3b (`EventCard`) — Epic 1 needs real event images sooner than Epic 3's scraping pipeline would otherwise exist to provide them. This story's remaining scope is narrowed to the actual scraping-persistence write path (Story 3.4's writes into the `posts` table) and the `is_extracted` status-update logic (Stories 3.6/3.6b) against the table Story 1.2a already created — the migration itself is no longer this story's deliverable. The AC below is left as-is to document the full target table shape; only the "who creates it" ownership changed.

**Amendment 2 (2026-08-01, Epic 3 readiness re-sweep):** The AC above was corrected from `subscription_id` to `account_id`. The PRD's amended `Post` interface (§4.7) now defines `Post.accountId` referencing `SocialMediaAccountProfile`, not `Subscription` — a post is published by the account, not by any one subscriber's subscription row, and an account can have multiple subscribers (PRD §3.7 Tier 2 round-robin). Story 1.2a keeps creating `posts.subscription_id` unchanged (Epic 1 must stay buildable without Epic 3 existing yet); Story 3.1a is the one that migrates it to `account_id` once Epic 3 runs. By the time this story (3.3a) executes, that migration has already happened.

**Depends on:** Story 1.1, Story 1.2a, Story 3.1a.

### Story 3.3b: Edit an account's default location

**As a** user,
**I want** to be able to view and edit the default location already set for a social media account I'm subscribed to,
**So that** I can correct or update it if it's wrong or outdated.

**Acceptance Criteria:**

*   **Given** I am subscribed to a social media account that already has a `defaultLocation` set (Story 3.3),
*   **When** I edit its default location and save,
*   **Then** the change is persisted to `SocialMediaAccountProfile.defaultLocation` immediately — there is no pre-approval gate blocking the save (FR66).
*   **And** the edit is performed via a backend GraphQL mutation, guarded by `requireAuth` (Story 0.17) — not a direct database write from `apps/web`.
*   **And** the mutation records a `DefaultLocationChangeRequest` row (PRD §4.14) capturing `accountId`, `changedByUserId`, `previousLocation`, `newLocation`, and `status: PENDING_REVIEW`.
*   **And** saving the change triggers an email notification to moderators, per FR67 — reusing this project's existing email notification infrastructure (Story 3.x quota-notification emails) rather than introducing a new email pathway.
*   **And** every subscriber of this account will see the new `defaultLocation` applied to subsequent extractions, since the field is account-level, not per-subscriber (Story 3.3's amendment).
*   **And** confirming the caller is an active subscriber of this account (to authorize the edit) uses `activeOnly(table)` (Story 0.22), not a hand-written `isNull(...)` clause.

**Depends on:** Story 3.3, Story 0.17, Story 0.22.

### Story 3.3c: Define the scraper adapter interface and platform-slug registry

**As a** developer,
**I want** a generic `ScraperAdapter` interface (given a subscribed account, returns its newest posts with platform-specific `post_url`/`original_post_url` derivation) and a single platform-enum-to-URL-slug registry,
**So that** Story 3.4's per-platform scraping implementations and Story 3.11's public account-page routing both consume one shared abstraction instead of each independently inventing platform identification and slug logic.

**Acceptance Criteria:**

*   **Given** the PRD's requirement (§3.7) that scraping go through "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation,"
*   **When** a new platform's scraper is added,
*   **Then** it implements one shared `ScraperAdapter` interface (input: subscribed account identifier; output: scraped posts, each with `post_url` set to whatever URL was actually scraped — which may be a proxy/mirror, e.g. `imginn.com` for Instagram — and `original_post_url` populated when that platform's own derivation rule can determine the canonical original-platform URL).
*   **And** a platform-enum-to-URL-slug registry (e.g. Instagram -> `ig`) is defined exactly once, in the same shared location as the `ScraperAdapter` interface, and is the single source Story 3.11's `/{platformSlug}/{accountId}` routing resolves against — not hardcoded per-component.
*   **And** this story builds the interface/registry scaffold only — the first concrete per-platform scraper implementation(s) remain Story 3.4's scope.
*   **And** the shared interface also exposes `lookupAccountProfile(platform, handleOrUrl): Promise<{ accountId: string; displayName: string; username: string; profileImageUrl?: string } | null>` — a lightweight, on-demand existence-check + public-profile-metadata fetch, distinct from `getNewestPosts` (no posts are scraped, no AI extraction runs). Returns `null` when the platform reports no such account. This story defines the interface method's signature and registry wiring only — the first concrete per-platform implementation(s) remain Story 3.4's scope, consistent with how `getNewestPosts`'s first concrete implementation is also Story 3.4's, not this story's.

**Note:** Classified as a Gate 3 gap by the Epic 3 readiness re-sweep (`bmad-epic-readiness-check`, re-run 2026-08-07) — Story 3.4 requires a "platform-specific scraper adapter" and Story 3.11 requires a "platform-to-slug mapping...defined once in a shared location alongside the platform-specific scraper adapters," but no story built either the adapter interface or the registry; left alone, Story 3.4 would build both ad hoc as a byproduct of its own scraping work — the exact failure mode this gate exists to catch. Kept inside Epic 3 (not promoted to Epic 0) since no other epic currently calls a social-media scraper or consumes the slug registry. Positioned after Story 3.3b and before Story 3.4, the first consumer.

**Amendment (Epic 6 readiness sweep, `bmad-epic-readiness-check`, 2026-08-08):** Added `lookupAccountProfile` to the shared interface. Story 3.4's 2026-08-07 Forward note flagged that Story 3.1/3.2's subscribe forms need a lightweight account-validation capability distinct from the scheduled bulk-scrape, but left open whether it belongs on the interface (this story) or the bulk-scrape story (3.4) itself. The Epic 6 sweep found a second, independent consumer — Story 6.1's vote-for-a-new-account path (PRD §3.13, FR70) needs the identical capability, at the same layer, before Story 6.1 can ship as specified. Two independent consumers across two epics clears Gate 3's cross-epic reuse bar. Placed on the interface (this story) rather than Story 3.4, since it is a synchronous, on-demand, single-account lookup with a different call shape than 3.4's scheduled, bulk, multi-account scrape job. Story 3.1/3.2's own subscribe-form retrofit remains out of scope/deferred as before (their "no live scrape-based validation... accepted gap" language is unchanged) — this amendment only unblocks Story 6.1, which does depend on this interface method plus at least one concrete per-platform implementation from Story 3.4.

**Amendment (2026-08-08, added via `bmad-create-story` while drafting Story 3.4):** `getNewestPosts`'s signature gains an optional second parameter: `getNewestPosts(account, options?: { newerThan?: string })`. This story is already implemented/`review` with the un-amended signature — Story 3.4 carries its own task to apply this small, additive, backward-compatible edit (a new optional parameter breaks no existing caller) rather than reopening this story. Motivation: Story 3.4's chosen scraping vendor (Apify) natively supports an "only posts newer than X" request parameter that avoids paying for posts already known to be stored; the interface needs a generic, vendor-agnostic way for a caller to express that cutoff.

**Amendment (2026-08-15, Sprint Change Proposal, triggered by Story 3.4d's confirmed not-found-detection bug):** Added a contract note, not a signature change — `getPostByUrl` and `lookupAccountProfile` (and any future per-item lookup method added to this interface) **must reliably distinguish "not found" from "found."** Concrete evidence forcing this: Story 3.4d's Task 1b found that Apify's own actors signal a nonexistent post/account as a *truthy* response shaped `{"error": "not_found", ...}`, not an empty/falsy result — the Instagram adapter's `items.length === 0` check alone missed this, and the consequence reached production (Story 6.1a, already `review` status, silently inserted a fabricated `SocialMediaAccountProfile` for an invalid handle). The concrete fix lives in Story 3.4e; this amendment exists so a *future* adapter (Twitter/X's still-unimplemented stub, or any later platform) doesn't have to rediscover the same failure mode independently — the interface's own documentation should say a caller is entitled to a genuine `null`, and an implementer must earn that guarantee, not assume the vendor SDK/API always returns an unambiguous empty result on failure.

**Depends on:** None.

### Story 3.4: Scrape new posts from subscribed accounts

**As a** system,
**I want** to periodically scrape new posts from the social media accounts that users have subscribed to, plus scrape a brand-new account immediately when someone subscribes to it,
**So that** I can begin the event extraction process without making a first-time subscriber wait up to a full day for any posts to appear.

**Acceptance Criteria:**

1.  **Given** there are active (non-soft-deleted, AD-8) subscriptions to social media accounts, **when** the scraping process is triggered on a recurring **once-daily** EventBridge schedule (replacing Story 0.14's placeholder `rate(6 hours)`), **then** the system determines the batch of accounts to scrape as the **distinct** set of accounts with at least one active subscriber (never once per subscription row — an account with 5 subscribers is scraped once, not 5 times), **excluding** any account whose `SocialMediaAccountProfile.lastScrapedAt` is within a configurable window (default 20 hours, env-configurable) of now — so an account that was just scraped on-demand (AC6) isn't redundantly re-scraped by the same day's batch.
2.  **And** each account in that batch is dispatched as a separate message onto the `ScrapingQueue` (SQS) rather than scraped synchronously in one Lambda invocation — matching the fan-out pattern already wired by Story 0.14 (EventBridge → `L_Scrape` "seed run" → enqueues per-account jobs onto `ScrapingQueue` → `ScrapingQueue` → `L_Scrape` "per-account processing").
3.  **And** each per-account job retrieves that account's newest posts via a platform-specific `ScraperAdapter` (Story 3.3c's registry, `getScraperAdapter(platform).getNewestPosts(account, options)`) — never a hardcoded, single-platform implementation — passing `options.newerThan` as the `MAX(posts.publishedAt)` already stored for that account (or, for an account with no posts stored yet, `now - <configurable lookback, default 7 days>`), and persists each returned post via Story 3.3a's `persistScrapedPost`, with `postUrl`/`originalPostUrl` set per the adapter's own resolution (Story 1.2a's amendment). After the attempt (success, a handled per-account failure, or a capacity-skip per AC5), `SocialMediaAccountProfile.lastScrapedAt` is stamped with the current time.
4.  **And** the concrete Instagram adapter calls **Apify**'s `apify/instagram-scraper` actor via its synchronous `run-sync-get-dataset-items` REST endpoint (one blocking HTTP call, real structured JSON response — not HTML scraping, not a raw third-party mirror site), app-funded (a single `APIFY_API_TOKEN` the application owns, not a per-user BYOK credential), passing `resultsType: "posts"`, a `resultsLimit` safety cap (default 10), and `onlyPostsNewerThan` (Apify's native cutoff-date filter, populated from AC3's `newerThan`) so a call for an account with nothing new returns (and bills) zero items.
5.  **And** every real Apify call increments a shared, provider-keyed usage counter (`SocialMediaAccountProfile`-independent — one row per vendor, reset on a configurable monthly cycle, mirroring Story 0.13's `usageCount`/`usageCycleResetAt` pattern for API keys). Before making a real call (from either the batch path or the on-demand path, AC6), the system checks this counter against a configurable fraction (default 90%) of Apify's known free-tier budget; if exhausted, the call is skipped (logged, `lastScrapedAt` still stamped) rather than silently incurring paid overage.
6.  **And**, distinct from the daily batch (AC1-3), when a user subscribes to an account and that subscription's lookup-or-create logic (Story 3.1a's `subscribeToAccount`) is about to create a **brand-new** `SocialMediaAccountProfile` row (i.e. no prior subscriber had ever subscribed to this account before — never triggered when subscribing to an already-known, already-profiled account), the system first checks AC5's capacity counter: if capacity remains, the new profile is created and an on-demand scrape job for that one account is enqueued onto `ScrapingQueue` **asynchronously** (`subscribeToAccount` enqueues and returns immediately, does not block on the scrape completing; a failure to enqueue, e.g. a transient SQS error, is logged and swallowed rather than failing the mutation); if capacity is exhausted, the subscription itself is rejected with a clear, user-facing error (PRD §3.8's existing "gracefully informed... cannot add more subscriptions at this time" pattern, reused here for scraper-API capacity rather than Gemini capacity) — subscribing to an **already-profiled** account is never blocked by this check, since it triggers no new scrape cost.
7.  **And** a failure processing any single account's job (adapter throw, parse error, etc.) is caught and logged without failing the Lambda invocation for other accounts in the same SQS batch — one broken account/adapter must not block or duplicate-redeliver other accounts' jobs.
8.  **And** the second registered adapter, for Twitter/X, is an explicit **not-yet-implemented stub** (both interface methods throw a clear error) — no vendor/technique was researched or chosen for this platform in this pass; it is registered now so the platform-slug/display-name registry (Story 3.3c) stays fully populated and Story 3.11's routing isn't blocked.

**Note (2026-08-01, added via `bmad-correct-course`):** This story's AC is still high-level/placeholder (Epic 3 has not had its own readiness/create-story pass yet) — the `original_post_url` line above records the requirement so it isn't lost, but the actual per-adapter derivation logic should be specified when this story is properly detailed.

**Forward note (2026-08-07, added via `bmad-create-story` while drafting Story 3.1):** The intended UX for subscribing (per user decision, `AskUserQuestion`) is to perform a lightweight scrape on submit to validate the account exists and warn if it has no recent posts — but no concrete per-platform scraper exists yet (Story 3.3c only builds the adapter *interface*; this story is the first concrete implementation and is still placeholder/undetailed per the note above). Story 3.1 ships without this validation for now (manual entry only, accepted gap, see Story 3.1's Out of Scope). When this story is properly detailed, consider whether it should also expose a lightweight "preview/validate account" capability (distinct from the scheduled bulk-scrape this story's AC currently describes) that Story 3.1/3.2's subscribe forms could then call.

**Amendment (2026-08-08, added via `bmad-create-story` during this story's own creation):** The AC list above supersedes the original 2-bullet placeholder, and itself supersedes an earlier same-day draft of this AC list that had chosen a DIY `cheerio`+`fetch` scrape of the `imginn.com` proxy (researched and explicitly rejected once a managed-vendor alternative was priced out and found viable — see below). Key decisions, made with the user via `AskUserQuestion`/direct research during this story's creation:
- **Cadence:** Story 0.14's `rate(6 hours)` placeholder is replaced with a daily schedule, both to reduce third-party scraping-API usage and because AC6's on-demand path now covers the "don't make a new subscriber wait" case a tighter polling interval would otherwise have been compensating for.
- **Scraping technique/vendor (Instagram):** A managed scraping-API vendor (Apify) was chosen over DIY HTML scraping (`cheerio`+`fetch` against `imginn.com`, the PRD's own named example) after live research during this story's creation found `imginn.com`, `picuki.com`, and `picnob.com` all return `403 Forbidden` to a plain request, and a captured real request to a fourth Instagram-viewer site (`storiesig.info`) returned `422 CAPTCHA_REQUIRED` even when replayed with its original signed payload — confirming that site is deliberately anti-bot-gated (its own Terms of Use explicitly prohibit automated/commercial access, confirmed directly). A headless-browser approach (Playwright + Chromium Lambda layer) was also researched and rejected: `imginn.com`'s flat `403` looks more consistent with IP-reputation/datacenter blocking than a "not a real browser" check, which a headless Chromium running from a Lambda's own AWS IP would not necessarily fix either, for a materially heavier ongoing-maintenance commitment. Apify's `apify/instagram-scraper` actor was chosen over Bright Data specifically because its posts-discovery capability is genuinely synchronous (`run-sync-get-dataset-items`, one blocking call, confirmed via Apify's own API docs), whereas Bright Data's equivalent ("discovery") capability is confirmed async-only (trigger-a-job + webhook/poll) — a materially bigger integration for this story to take on. See Story 3.4a (new, below) for Bright Data's deferred role.
- **BYOK-pooled scraper keys (considered, rejected for now):** Whether individual users could contribute their own scraper-vendor API key (mirroring the Gemini BYOK pool, Story 0.13) was considered and researched. No explicit ToS prohibition was found for either vendor, but real ambiguity was found for both (Apify's anti-sublicensing clause plausibly covers using one user's licensed access to serve data to other users; Bright Data mandates KYC vetting against a user's *declared* individual use case and actively monitors for use-case mismatches) — this is a legal/business question outside what automated ToS research can safely resolve, not an engineering one. Deferred pending the user's own direct confirmation with each vendor; this story uses a single, app-funded Apify account instead.
- **Multi-account/multi-vendor evasion (considered, explicitly rejected):** Using multiple free-tier signups on the same vendor (or spreading such signups across multiple AWS/Lambda setups to obscure them from a vendor's fraud detection) was raised and explicitly rejected as ToS-violating multi-accounting/evasion, not a legitimate architecture choice.
- **`onlyPostsNewerThan` cost optimization (AC3/AC4):** Chosen over both a fixed per-call post-count (e.g. always request the 3-5 most recent posts, regardless of whether anything is actually new) and a naive "probe post-by-post until we find an already-stored one" approach (confirmed via Apify's own input-schema docs that the actor supports **no** pagination/cursor/offset — each call is a fresh scrape from the top, so probing would mean re-paying for the same leading posts on every probe, strictly more expensive than a single bounded call). `onlyPostsNewerThan` is Apify's own native date-cutoff filter and achieves the same goal (don't pay for already-known posts) in one call, with zero waste on a day nothing new was posted.
- **First-time-scrape lookback (AC3):** For an account with no posts stored yet (no `MAX(publishedAt)` to anchor against), defaults to 7 days rather than 30 or 90 — a tighter, cheaper default; user-confirmed.
- **Capacity gating (AC5/AC6), two layers, not one:** (a) a hard backstop inside the actual scrape-calling code path, active for both the batch and on-demand triggers, that skips the real vendor call once the cycle's usage counter nears the free-tier ceiling — this is the actual cost-safety mechanism; (b) a proactive, user-facing gate at subscribe-time (AC6) that blocks a **brand-new** subscription outright when capacity is exhausted, reusing PRD §3.8's already-established "gracefully informed... cannot add more subscriptions" UX pattern (previously specified only for Gemini/AI-processing capacity) rather than silently letting the subscription through and never actually scraping it. Both layers check the same counter — no duplicated logic.
- **On-demand fallback design (informs Story 3.4a, not built in this story):** if Apify is unavailable at subscribe-time (exhausted or erroring), the intended behavior is to fall back to Bright Data's async job rather than fail outright, accepting a slower (non-instant) result — this requires Bright Data's adapter (Story 3.4a) to exist first; this story's on-demand path has no fallback vendor yet, only the capacity-block behavior above.
- **Twitter/X:** Deliberately shipped as a registered-but-stub adapter (AC8) — no vendor/technique researched for this platform in this pass.
- **`lastScrapedAt` skip-optimization (AC1):** New `SocialMediaAccountProfile.lastScrapedAt` column (distinct from the existing, currently-unused-by-any-story `lastPostDate` column) added specifically so the daily batch doesn't immediately re-scrape an account AC6 just scraped on-demand.
- This story also fixes two pre-existing infra gaps found while reading Story 0.14's CDK stack (`apps/infrastructure/lib/festgrid-backend-stack.ts`) during this story's creation: the Scraper Lambda's `environment` block was missing `DATABASE_URL` and a `ScrapingQueue` URL (it cannot run its actual logic without them), and it held a stale `AIProcessingQueue.grantSendMessages` IAM grant left over from before the Epic 3 readiness sweep corrected `docs/infrastructure/high-level-overview.md`'s diagram to remove the (never-actually-used) `L_Scrape → SQS_AI` edge.
- This story also carries a small, additive amendment to Story 3.3c's already-shipped `ScraperAdapter` interface (adding an optional `options?: { newerThan?: string }` parameter to `getNewestPosts`) — see Story 3.3c's own 2026-08-08 amendment note.

**Depends on:** Story 3.3c, Story 3.3a, Story 3.1a, Story 0.14.

---

### Story 3.4a: Add Bright Data as the priority scraping vendor for the scheduled batch, with async job handling

**As a** system,
**I want** the scheduled daily batch scrape (Story 3.4's AC1-3) to prefer Bright Data over Apify — since nothing is synchronously waiting on the batch's results, and Bright Data's per-record cost is cheaper at scale ($1.50/1,000 PAYG vs. Apify's $2.70-$2.30/1,000) — while keeping Apify as an on-demand-path primary and a batch-path fallback,
**So that** total free/cheap scraping headroom across both vendors is maximized before any real overage spend or subscription-capacity limiting (Story 3.4) kicks in.

**Acceptance Criteria (draft — to be fully detailed when this story is created):**

*   **Given** Story 3.4's daily batch dispatch, **when** a batch target is processed, **then** the system attempts Bright Data's async posts-discovery capability first: it triggers a discovery job (an immediate, synchronous "job accepted" response, distinct from the job's eventual async completion) and records a pending-job row correlating Bright Data's job ID to the target's `profileId`.
*   **And** a new webhook endpoint (API Gateway route, e.g. `POST /webhooks/brightdata`) receives Bright Data's completion callback, resolves it against the pending-job row, and performs the same `persistScrapedPost`/`lastScrapedAt`-stamping work Story 3.4's `processScrapeJob` does today for a synchronous adapter result.
*   **And** if Bright Data's job-trigger call itself fails synchronously (auth error, network error, Bright Data-side capacity exhaustion tracked the same way as Story 3.4's Apify counter), the system falls back to Apify for that target immediately, within the same batch pass.
*   **And** a pending Bright Data job that never receives a webhook callback within a configurable timeout (e.g. a few hours) is detected by a periodic sweep and retried via Apify as a fallback, so a lost/dropped webhook doesn't silently leave an account unscraped indefinitely.
*   **And** Story 3.4's on-demand (subscribe-time) path gains Bright Data as its fallback vendor (per Story 3.4's own Amendment): if Apify is unavailable at subscribe-time, the on-demand job is routed to Bright Data instead of being blocked, accepting a slower (non-instant) result via the same webhook mechanism above, rather than Story 3.4's current capacity-block-only behavior.

**Note (2026-08-08, added via `bmad-create-story` while drafting Story 3.4):** Classified as a Gate 1 (Architecture/Infrastructure Completeness) split — making Bright Data the scheduled-batch's *priority* vendor (not just a documented future option) requires a genuinely new architectural layer (an async job-tracking table, a new public webhook endpoint, and a stale-job fallback sweep), not an incremental addition to Story 3.4's adapter code. Per `story-split-gate.md`'s numbering rule, this is a single-story split off Story 3.4 (needed by exactly this scraping pipeline, not reused elsewhere), positioned directly after it. Only this epics.md section and a `sprint-status.yaml` backlog entry are created now; the full `bmad-create-story`-authored story file (Tasks/Dev Notes/Implementation Plan) is deferred to when `bmad-create-story 3-4a` is actually run, per this project's established pattern for gate-split prerequisite stories (e.g. Story 3.3c's own creation history).

**Warning (2026-08-10, added via `bmad-create-story` while updating Story 3.4b), RESOLVED (2026-08-10):** Direct outreach to Bright Data received an initial reply stating *"Bright Data no longer provides the IPs for Social media account management usecase..."*, which risked invalidating this story's entire premise. A sharper follow-up clarified the question was about their Web Scraper/Dataset API product, not raw proxy/IP access, and Bright Data confirmed: *"We can support you collecting Social media data from our Webscraper APIs and Filter APIs. If you have the post URL or Profile URL you can give those as an input and fetch the publicly available data."* This resolves the account-management exclusion as proxy-specific, not a blanket block on this story's premise — **the story is no longer blocked from proceeding to `bmad-create-story 3-4a` on legal/policy grounds.**

**Remaining open question before implementation (not a policy blocker, a capability question):** the confirmation describes providing a post or profile URL and fetching "publicly available data," but does not explicitly confirm whether a **profile URL** returns that account's **recent posts** (what `getNewestPosts`/this story's discovery use case needs) versus only **profile-level metadata** (bio, follower count) or requiring a **specific, already-known post URL** (their separate Posts-by-URL endpoint, confirmed earlier to need an exact URL, not a discovery-by-profile capability). Verify this distinction with a real test call once Bright Data account access exists, before committing to this story's async job-tracking/webhook design — if it turns out only single-post lookup or profile metadata is available (not posts-discovery), the story's actual technical approach may need to change even though the vendor-policy question is now resolved.

**ON HOLD (2026-08-10, added via `bmad-create-story`):** User decision — drop the Bright Data avenue entirely rather than send the clarifying follow-up (see Story 3.4b's own "drafted but not sent" record). Since this story's entire premise is Bright Data as the batch-priority vendor, it has no remaining basis to proceed and is parked on hold, not actively pursued. It is **not** cancelled/removed outright, in case Bright Data becomes worth reconsidering later (e.g. if Apify's own limitations or cost eventually make revisiting Bright Data worthwhile) — but do not run `bmad-create-story 3-4a` without a new, explicit decision to reopen this avenue.

**REOPENED (2026-08-15, added via `bmad-create-story` at the user's explicit confirmation):** This is the new, explicit decision the note above required. User confirmed proceeding with `bmad-create-story 3-4a` now, superseding the ON HOLD note. The stale `sprint-status.yaml` comment (2026-08-10, "Story is UNBLOCKED for bmad-create-story 3-4a") had drifted out of sync with this epics.md ON HOLD note and is what surfaced the conflict — this REOPENED note is the authoritative resolution. The remaining open capability question (does a Bright Data profile-URL input return recent posts/discovery, vs. only profile metadata or a specific already-known post URL) is still unverified and is addressed as part of this story's own creation pass below.

**Depends on:** Story 3.4.

---

### Story 3.4b: BYOK-pooled scraper-vendor keys (legally gated, optional)

**As a** system,
**I want** individual users to optionally contribute their own Apify/Bright Data account's API key — pooled and round-robined the same way Gemini BYOK keys already are (Story 0.13) — as an alternative or supplement to the single app-funded Apify account (Story 3.4),
**So that** total scraping headroom can scale with community contribution instead of being capped by one centrally-funded account's free tier.

**Status: legally gated — not implementation-ready.** This story must not be picked up by `bmad-create-story`/`dev-story` until written confirmation is received from both vendors per the outreach step below. See the full story file (`_bmad-output/implementation-artifacts/3-4b-byok-pooled-scraper-vendor-keys.md`) for the vendor-outreach email drafts and the conditional (post-confirmation) acceptance criteria.

**Note (2026-08-08, added via `bmad-create-story` while drafting Story 3.4):** Raised mid-session as a way to raise scraping capacity beyond a single app-funded account. Direct ToS research during Story 3.4's creation found genuine, unresolved ambiguity for both vendors: Apify's Section 5.2 prohibits sublicensing "to third parties," which plausibly (not explicitly) covers a pattern where one user's licensed access is used to serve data to other app users; Bright Data mandates KYC vetting against each account's individually *declared* use case and states it actively monitors for use-case mismatches, which a multi-tenant pooling pattern may not cleanly satisfy. Neither vendor's terms explicitly permit or explicitly forbid this specific pattern. This is a legal/business risk question, not an engineering one, and was not resolved by automated ToS-page research — the user must obtain explicit written confirmation from each vendor before this story can move to `ready-for-dev`. Positioned as a lettered suffix off Story 3.4 (this feature area's originating story) rather than Epic 0, since it is not yet a confirmed, buildable requirement.

**Amendment (2026-08-10, added via `bmad-create-story` at the user's request):** Refined the outreach to separate two distinct things that had been conflated: the **key's own scope** (a contributed key is only ever invoked for accounts the contributing user has personally subscribed to — never on another user's behalf) versus the **resulting data's sharing scope** (that data may still be shown to other users who independently subscribe to the same public account, since Story 3.1a's data model attaches posts to the account, not to whichever subscriber's key fetched them). Both outreach emails now ask this as an explicit either/or, plus whether a stricter "exclusive use, never shown to anyone but the key's owner" model would be unambiguously fine as a fallback design, and whether each vendor has an existing account/partner model built for many end-users each bringing their own key. Also added: a mutual-benefit point noting this model brings each vendor new individual signups (not just more usage on one existing account), and the app's free-for-users framing. Independent of what either vendor requires, Story 3.4b's AC4 now bakes in a baseline requirement that the contributing user must see explicit disclosure and affirmatively consent (not a pre-checked box) that their key's resulting data may be shown to other subscribers of the same account — this is a product decision, not conditional on vendor mandate.

**Depends on:** Story 3.4 (and, if pursued for Bright Data too, Story 3.4a).

---

### Story 3.4c: Explore sanctioned/whitelisted access with Instagram-viewer sites (exploratory, optional)

**As a** system,
**I want** to explore whether any of the Instagram-viewer/proxy sites identified during Story 3.4's research (storiesig.info, mollygram.com, imginn.com) would grant sanctioned API/whitelisted access — offering attribution/backlink exposure in exchange — as a possible lower-cost or higher-quality alternative or supplement to the app-funded Apify adapter (Story 3.4),
**So that** the scraping pipeline has another option evaluated, without committing engineering effort until a concrete offer is on the table.

**Status: exploratory outreach only — not implementation-ready.** Like Story 3.4b, this story's only in-scope deliverable today is sending outreach and recording what comes back; no adapter code should be written under this story until a concrete, workable offer exists. See the full story file (`_bmad-output/implementation-artifacts/3-4c-explore-whitelisted-access-with-instagram-viewer-sites.md`) for the outreach email drafts and the idea-protection guidance for what *not* to disclose.

**Note (2026-08-09, added via `bmad-create-story` while drafting Story 3.4b):** During Story 3.4's research, `storiesig.info`'s own API FAQ was found to explicitly invite contact for official API access ("To get access or get more information contact us at [email]") — a materially different, lower-risk path than the CAPTCHA-gated unauthorized access already rejected during Story 3.4's creation, since sanctioned access sidesteps that site's own anti-automation Terms of Use rather than violating them. `mollygram.com`'s Terms of Service were also found to contain no explicit scraping/API/commercial-use prohibition, but the site is a single-item story/post downloader, not a persistent per-account post feed — even fully sanctioned access likely doesn't fit this pipeline's actual need (confirmed during Story 3.4's own research). Positioned as a lettered suffix off Story 3.4 (this feature area's originating story), matching Story 3.4b's precedent, since it is exploratory and not yet a confirmed, buildable requirement — and specifically because pursuing it risks revealing the product's AI-extraction concept to a vendor who already sits on the raw data source, a competitive consideration the outreach draft is written to account for (see the story file's "What Not to Disclose" section).

**Amendment (2026-08-09, added via `bmad-create-story` at the user's request):** Added `imginn.com` as a third outreach candidate. A direct fetch during Story 3.4's creation returned `403 Forbidden`, but the user separately retrieved the site's public FAQ/About/Privacy Policy content directly. Findings: `imginn.com` is the correct shape (a per-username profile/post viewer, unlike `mollygram.com`), but has **no advertised developer/partnership channel** (unlike `storiesig.info`) — only a generic Privacy Policy contact address (`imginn.com@gmail.com`) scoped to privacy/content-removal requests. Their own "About" text states they operate by calling "the instagram public API" (Instagram's own unofficial/undocumented API), meaning even sanctioned access from them sits one layer removed from a fully clean source. Outreach to them is accordingly framed as a cold business inquiry with lower expected reply odds than `storiesig.info`'s explicit invitation, not an equally-likely-to-succeed third option.

**Depends on:** Story 3.4.

### Story 3.4d: Per-use-case Apify actor selection and sync-path timeout handling

**As a** system,
**I want** the on-demand (synchronous, user-facing) scraper paths to use whichever actor — official or third-party — gives the best real-world outcome for the current app-funded key, with an explicit bounded timeout, distinct from the batch path's actor choice,
**So that** a slow Apify run can't silently hang a GraphQL mutation or burn budget on a call the user has already given up on, and actor selection is driven by measured cost/reliability results rather than a single fixed choice.

**Note (2026-08-14, added via `bmad-help`/architect analysis of `docs/assets/Apify actor costing and facts.md`; corrected same day):** Two findings drove this story: (1) none of the four actors evaluated (the current `apify/instagram-api-scraper`, plus `apify/instagram-post-scraper`, `instagram-scraper/fast-instagram-post-scraper`, `sones/instagram-posts-scraper-lowcost`) publish a run-duration SLA — Apify's own store page for the current actor states runs can take "a few seconds to a few hours"; (2) two call sites are synchronous/user-facing today (`getPostByUrl` at `resolvers.ts:993`, `lookupAccountProfile` at `resolvers.ts:1429`) and only one has a local timeout (`getPostByUrl`'s hardcoded 20s). Recommendation is to pick the sync-path actor empirically (cost + latency + success rate) and add the missing timeout to `lookupAccountProfile` — the batch path (already async via Story 3.4a) is unaffected. Per user correction 2026-08-14: the app-funded key is the project owner's own account, and the owner is open to third-party/community actors there for the best available outcome, accepting Apify's Actor Terms §4.4 Creator-access exposure on their own account knowingly. This is the **inverse** of Story 3.4b's future BYOK path, which — because contributed keys would belong to individual community members, not the owner — is restricted to Apify-maintained actors only, a stricter default made on other people's behalf. See the full story file (`_bmad-output/implementation-artifacts/3-4d-per-use-case-actor-selection-and-sync-path-timeout.md`) for the cost comparison table and the Actor-Creator data-access research.

**Amendment (2026-08-14, user request):** Scope broadened to also cover `getNewestPosts`'s actor choice, since all three `ScraperAdapter` methods share one `callApifyActor` call today — a sync-path-only swap would silently change the batch path's actor too. Investigating confirmed duplicate posts are already prevented at the DB layer (`persist-scraped-post.ts`'s `onConflictDoNothing` on `postUrl`) regardless of actor, so the real batch-relevant question is cost-efficiency of each actor's newest-posts-only cutoff filter, not data correctness — does a cutoff matching zero new posts actually return/bill zero items (Story 3.4 AC4's requirement), or does the actor bill for filtered-out items like `fast-instagram-post-scraper`'s original sample hinted at? New Task 1c tests this directly across all four actors before `getNewestPosts` gets its own actor constant, decided independently from the sync-path pick.

**Amendment 2 (2026-08-14, real data — all 12 Task 1c runs complete and valid):** Two confirmed, evidence-backed bugs found, both via live Apify test calls against the real `pakuwonmall.jogja` account: (1) `apify/instagram-api-scraper` — the actor currently deployed for `getNewestPosts` in production — leaks all 3 of the account's pinned posts past its own `onlyPostsNewerThan` cutoff at every cutoff tested, including a true live zero-boundary cutoff (1 second after the account's actual newest post); (2) `sones/instagram-posts-scraper-lowcost` doesn't filter server-side at all — it returns items explicitly flagged `"is_newer_than_cutoff": false` in its own JSON regardless of cutoff. Both are disqualified for `getNewestPosts`. **`apify/instagram-post-scraper` passed every scenario cleanly (final confirmed pick)** — no pinned leak, `skipPinnedPosts: true` confirmed working, and its zero-boundary test (re-run after an initial attempt accidentally used the wrong cutoff) returned only genuinely-new posts, correctly billed. `instagram-scraper/fast-instagram-post-scraper` remains a validated fallback for any future re-evaluation — correct on returned data in every scenario, but bills a nonzero "Processing Fee" even when it correctly returns 0 items. Full breakdown in the story file's Dev Notes "Task 1c Conclusions" and the `3-4d-task1c-runs/` directory (one file per run, real pasted Apify output).

**Amendment 3 (2026-08-15, real data — all 8 Task 1b runs complete):** Task 1b was narrowed twice on user direction — first from a 4-actor sweep to the 2 actors actually capable of `getPostByUrl` (`sones`/`fast-instagram-post-scraper` explicitly reject post/reel/story URLs per their own input schemas), then from "3x-repeat the same valid input" to "test valid vs. invalid input" for both `getPostByUrl` and `lookupAccountProfile`. That second change surfaced a major, **actor-agnostic correctness bug**: querying a genuinely invalid post URL or a garbled account handle does not return an empty result from either `apify/instagram-api-scraper` or `apify/instagram-post-scraper` — it returns a truthy 1-item array shaped `{"error": "not_found", "errorDescription": "Post does not exist"}`, identical across both actors and both methods. The adapter's existing `items.length === 0` check never catches this. Traced the consequence directly: `getPostByUrl` silently returns an empty-content "post" instead of failing; `lookupAccountProfile` is worse, fabricating a fully plausible profile (`displayName`/`username` both equal to the invalid handle itself) that causes `castVote` to silently insert a real `SocialMediaAccountProfile` row for a nonexistent Instagram account, with the mutation reporting success. On the (secondary) actor-pick question itself: both actors work correctly on valid input; `apify/instagram-post-scraper` is faster and cheaper per item, consistent with Task 1c's direction. Full breakdown in the story file's Dev Notes "Task 1b Conclusions" and the `3-4d-task1b-runs/` directory.

**Amendment 4 (2026-08-15, Sprint Change Proposal):** Amendment 3's not-found-detection bug is confirmed to already affect production — Story 6.1a ships `review` status with the exact silent-fabrication failure mode (see Story 3.4e). Given its severity (live data-integrity defect) versus the rest of this story's scope (cost/reliability optimization, no urgency), the fix — originally scoped here as AC6/Task 6 — is **split out to a new Story 3.4e** so it can go through `bmad-create-story`/`bmad-dev-story` independently and fast, without waiting on this story's broader actor-selection work. AC6 and Task 6 are removed from this story's active scope; see Story 3.4e for the carried-forward AC/Task content. This story's remaining scope (AC1-5, Tasks 1-5) is unaffected.

**Depends on:** Story 3.4.

### Story 3.4e: Fix not-found detection in the Instagram scraper adapter

**As a** system,
**I want** `getPostByUrl` and `lookupAccountProfile` to correctly detect a nonexistent post/account instead of treating Apify's `{"error": "not_found", ...}` response as valid data,
**So that** `castVote`-by-handle (Story 6.1a) stops silently creating fake `SocialMediaAccountProfile` rows for garbage handles, and manual post-extraction stops passing empty-content posts into the Gemini extraction pipeline.

**Split off Story 3.4d (Sprint Change Proposal, 2026-08-15)** — see that story's Amendment 4. Carries forward 3.4d's AC6 and Task 6 verbatim as this story's own scope, plus Story 3.3c's companion contract-note amendment (same date) as supporting context, not additional scope here.

**Acceptance Criteria:**

1.  **Given** `getPostByUrl` calls the Instagram actor and receives a response, **when** the returned item is shaped `{"error": "...", "errorDescription": "..."}` (confirmed real shape: `{"url": ..., "username": ..., "error": "not_found", "errorDescription": "Post does not exist"}`, `3-4d-task1b-runs/run-02` and `run-04`), **then** the adapter treats this as not-found and returns `null` — in addition to, not instead of, the existing `items.length === 0` check — so [resolvers.ts:994](apps/backend/src/schema/resolvers.ts#L994)'s `if (!scrapedPost) return SCRAPE_FAILED` fires correctly instead of receiving a hollow `ScrapedPost` with empty content.
2.  **And** `lookupAccountProfile` applies the identical `item.error` check, returning `null` — confirmed real shape identical across both methods (`3-4d-task1b-runs/run-06`, `run-08`) — so [resolvers.ts:1434](apps/backend/src/schema/resolvers.ts#L1434)'s `if (!lookupResult) throw 'not found'` fires correctly instead of `castVote` silently inserting a fabricated `SocialMediaAccountProfile` row (`displayName`/`username`/`accountId` all resolving to the invalid handle itself, per the traced fallback-chain bug).
3.  **And**, as a fallback for the case where a future actor signals failure without an explicit `error` field, an item is also treated as not-found when it lacks the fields a real result must have: absence of both `item.caption` and `item.timestamp` for a post; absence of both `item.fullName` and `item.biography` for a profile.
4.  **And** `instagram-adapter.test.ts` gains fixture-based test cases using the exact real error shape captured in `3-4d-task1b-runs/run-02`, `-04`, `-06`, `-08`, asserting both `getPostByUrl` and `lookupAccountProfile` return `null` for this shape — not a truthy garbage result.
5.  **And** this story does not touch the Twitter/X stub adapter (still throws not-implemented) — Story 3.3c's companion amendment documents the expectation for whenever a real Twitter/X adapter is eventually built, this story only fixes the shipped Instagram adapter.

**Priority note:** elevated above normal backlog ordering — this is a confirmed, already-live data-integrity defect (Story 6.1a, `review` status), not a future risk. Small, well-scoped, already fully specified from real test evidence — a strong candidate for `bmad-quick-dev` ahead of, or instead of, the standard `bmad-create-story`/`bmad-dev-story` cycle, at the implementer's discretion.

**Depends on:** Story 3.4 (concrete `instagram-adapter.ts` this story fixes), Story 3.3c (contract-note amendment, informational).

### Story 3.4f: Fix missing Lambda timeouts and extend async job handling to Apify's long-running scrape paths

**As a** system,
**I want** (a) `apiLambda` and `scraperLambda` to have explicit, correctly-sized execution timeouts instead of silently inheriting AWS's 3-second default, and (b) Apify calls behind `getNewestPosts` (the scheduled-batch fallback path, Story 3.4a AC4, and the new-account-subscription backfill path, Story 3.4 AC6) to use the same async job-trigger + webhook + stale-job-sweep pattern Story 3.4a built for Bright Data — rather than blocking a Lambda invocation on a call Apify's own actor page states can take "a few seconds to a few hours",
**So that** neither Lambda is ever silently killed mid-scrape by an unconfigured default timeout, and a long Apify run for the batch-fallback or new-account-backfill role isn't also capped by Lambda's own hard 900-second ceiling.

**Acceptance Criteria (draft — to be fully detailed when this story is created):**

1.  **Given** `apps/infrastructure/lib/festgrid-backend-stack.ts`'s `sharedLambdaProps` (confirmed via direct read to set no `timeout` property, and no individual Lambda definition overrides it either — all four Lambdas, `apiLambda`/`scraperLambda`/`aiProcessorLambda`/`ingestorLambda`, currently inherit AWS Lambda's undocumented-in-CDK 3-second default), **when** this story ships, **then** `apiLambda` and `scraperLambda` each get an explicit, correctly-sized timeout — `apiLambda`'s bounded below API Gateway's own hard 29-second integration ceiling (matching Story 3.4d's already-bounded synchronous `getPostByUrl`/`lookupAccountProfile` timeouts); `scraperLambda`'s sized to comfortably cover its SQS-batch-processing work, up to (but never exceeding) Lambda's absolute 900-second ceiling.
2.  **And** a decision is made and recorded on whether `aiProcessorLambda`/`ingestorLambda`'s identical missing-timeout gap is folded into this story or tracked as a separate immediate fix — same root-cause bug, confirmed via the same direct read, but outside this story's own investigation trigger (the scraper/Apify pipeline).
3.  **And** `getNewestPosts` calls made via the Apify vendor path are triggered as an async Apify actor run with an ad-hoc webhook attached at trigger time (Apify's documented `webhooks` query parameter — a base64-encoded JSON array of `{eventTypes, requestUrl}` — confirmed directly against Apify's own API docs during this story's creation) rather than a single blocking call, mirroring Story 3.4a's Bright Data trigger-then-webhook shape as closely as the two vendors' actual APIs allow.
4.  **And** the existing `L_Webhook` Lambda/API Gateway route (Story 3.4a) gains a second sibling route, `POST /webhooks/apify`, whose handler resolves the incoming run against a pending-job record (schema approach — generalizing Story 3.4a's `brightdata_pending_jobs` table into a vendor-keyed shape vs. a new dedicated table — to be decided during this story's own creation) and, on a valid match, fetches the completed run's dataset (`GET /v2/actor-runs/{runId}` for `defaultDatasetId`, confirmed directly against Apify's API docs, then the existing dataset-items fetch already used elsewhere) and persists via the same shared processing path Story 3.4a's webhook handler uses.
5.  **And** the existing hourly stale-job sweep (Story 3.4a, Task 8) is extended to also recover an Apify job whose webhook was never received — polling `GET /v2/actor-runs/{runId}` directly (status values `READY`/`RUNNING`/`SUCCEEDED`/`FAILED`/`TIMING-OUT`/`TIMED-OUT`/`ABORTING`/`ABORTED`, confirmed via Apify's own API docs) rather than assuming a lost webhook means a lost job — consistent with Story 3.4a's own poll-before-fallback design.
6.  **And** `getPostByUrl` and `lookupAccountProfile` (the vote-check and manual-extraction sync paths, Story 3.4d) remain synchronous and unaffected by this story — the async treatment here applies only to the `getNewestPosts` role, matching the user's explicit scoping: Apify stays synchronous for account-check-at-vote-time and at subscribe-time's initial validation, and only gets "the same long process but different mechanism" treatment for the scheduled-batch/new-account-backfill role.
7.  **And** a failure in the Apify webhook path or sweep-recovery path is caught and logged per-job without failing the Lambda invocation for other jobs in the same run — matching Story 3.4/3.4a's established per-item isolation precedent.

**Note (2026-08-17, added via `bmad-correct-course`, discovered while investigating the user's scheduled-batch-duration question):** Confirmed directly against `apps/infrastructure/lib/festgrid-backend-stack.ts` that `sharedLambdaProps` (and every individual Lambda definition) sets no `timeout` property anywhere in the stack — all four Lambdas silently inherit AWS Lambda's 3-second default, since CDK's `NodejsFunctionProps` supplies no default of its own. This alone would already prevent any real Apify or downstream GraphQL call from completing successfully in production today, independent of the async-job-handling question below — the more urgent half of this story. Separately, confirmed directly against Apify's own API documentation that ad-hoc per-run webhooks are supported via a `webhooks` query parameter at actor-run-trigger time, and that a run's status/dataset can be polled independently via `GET /v2/actor-runs/{runId}` — establishing the same async-job-trigger + webhook + poll-based-sweep-recovery pattern Story 3.4a built for Bright Data is technically available for Apify too. This directly answers the user's question/decision: *"apify -> scheduled batch, check profile when doing vote, and when subscribing an account. for scheduled batch we would have same long process but different mechanism."* Exact Apify webhook payload field names (whether the default `{{resource}}` payload template directly exposes `runId`/`defaultDatasetId` without a custom `payloadTemplate`) were not verified against a live authenticated call during this story's creation — tracked as the same class of residual, accepted-low-risk unknown as Story 3.4a's own "Bright Data API Facts" caveat, to confirm during implementation.

**Depends on:** Story 3.4 (the `getNewestPosts` call site this modifies), Story 3.4a (the webhook Lambda/route, pending-jobs pattern, and stale-job sweep this story extends rather than duplicates), Story 3.4d (the sync-path timeout handling this story leaves unaffected, AC6).

### Story 3.4g: Validate scraped posts from Apify and Bright Data with an AJV schema

**As a** system,
**I want** every `ScrapedPost`-shaped object produced by both vendor paths (Apify's `mapApifyItemToScrapedPost`, and Bright Data's `processBrightDataResult` field-mapping) validated against a shared AJV schema before it reaches `persistScrapedPost`,
**So that** malformed or incomplete scraper output from either vendor is caught and dropped at the boundary instead of silently flowing into persistence and downstream AI extraction.

**Added 2026-08-18 via `bmad-create-story` (user-identified compliance gap, not a Gate 1/2/3 finding):** `project-context.md`'s "Runtime Schema Validation" rule ("All data entering the system from external sources (APIs, scrapers) must be validated at the point of entry with Zod (frontend) or AJV (backend)") is already honored for the Gemini AI-extraction path (`extracted-event.schema.ts`, `process-ai-job.ts`) but was never implemented for either scraper vendor path — `mapApifyItemToScrapedPost` (`instagram-adapter.ts:84-95`) and `processBrightDataResult` (`process-brightdata-result.ts:12-39`, Story 3.4a) both only do defensive `||`-fallback field extraction, no schema check. Originally scoped to Apify only; expanded to Bright Data during story creation once the same gap was confirmed there, alongside two pre-existing bugs on that path (a broken `persistScrapedPost` import in two files, confirmed via `tsc`, and a `Date`-vs-`string` mismatch on `publishedAt`) that this story's validation work directly surfaces and fixes. Full detail in the story file (`_bmad-output/implementation-artifacts/3-4g-validate-scraped-posts-from-apify-and-brightdata-with-ajv-schema.md`).

**Acceptance Criteria:**

1.  A new `apps/backend/src/validation/scraped-post.schema.ts` exports an AJV `JSONSchemaType<ScrapedPost>` schema (`content`/`postUrl`/`publishedAt` required; `imageUrl`/`originalPostUrl` optional `nullable: true`; `additionalProperties: false`), mirroring `extracted-event.schema.ts`'s convention.
2.  `mapApifyItemToScrapedPost` validates its constructed object against this schema before returning, and its return type changes to `ScrapedPost | null`, logging AJV `.errors` on failure.
3.  All three call sites of `mapApifyItemToScrapedPost` (`getPostByUrl`, `getNewestPosts`, and `processApifyAsyncResult`) correctly handle the new `null` outcome — passing it through, filtering it out of a batch, or explicitly skipping it, respectively — without otherwise changing control flow or `recordProviderUsage` semantics.
4.  `processBrightDataResult` validates its constructed candidate object against the same shared schema before calling `persistScrapedPost`, logging and skipping (matching its existing `if (!postUrl)` skip pattern) on failure.
5.  `instagram-adapter.test.ts` and `process-apify-async-result.test.ts` gain valid/invalid-item test cases; a new `process-brightdata-result.test.ts` (none exists today) covers a valid record and an AJV-invalid record.
6.  The broken `persistScrapedPost` relative import (`./persist-scraped-post.js`, which does not exist — confirmed via `tsc`'s `TS2307`) in both `process-apify-async-result.ts` and `process-brightdata-result.ts` is fixed to `../posts/persist-scraped-post.js`, matching `process-scrape-job.ts`'s already-correct import.
7.  `processBrightDataResult`'s `publishedAt` is passed to `persistScrapedPost` as an ISO string (not a `Date` object), matching `PersistScrapedPostParams.publishedAt: string` and the new schema's `publishedAt: string` check.

**Depends on:** Story 3.4 (the `instagram-adapter.ts` this story modifies), Story 3.4a (the Bright Data path this story modifies), Story 3.4f (`processApifyAsyncResult`, the third Apify call site this story updates), Story 0.11 (the `compileValidator`/AJV foundation this story reuses as-is).

### Story 3.4h: Capture and surface data format anomalies from scraper vendors

**As a** platform operator and content moderator,
**I want** AJV validation failures detected by Story 3-4g to be captured, persisted, and surfaced in a daily digest email with full context,
**So that** I can investigate data quality issues from scraper vendors, reprocess failed payloads with historical parser versions, and track data anomalies over time without losing context when validation gates drop invalid data.

**Acceptance Criteria:**

1.  When Story 3-4g's AJV validation fails in any scraper path (Apify, Bright Data, or Gemini extraction), the malformed payload is captured with full context — raw JSON, validation error, scraper vendor, account ID, post URL, timestamp, and parser version — and persisted to a new `unprocessed_scraper_payloads` table before being discarded.
2.  A new `parser_version_registry` table tracks all historical parser versions ever deployed, with semantic version strings, deployment timestamps, and active status flags.
3.  A user-configurable retention TTL (`UNPROCESSED_PAYLOAD_RETENTION_DAYS`, default 30 days) determines when payloads auto-delete via a daily Lambda (02:00 UTC).
4.  A GraphQL query `queryUnprocessedPayloads(filters: {source, vendor, createdAfter, createdBefore}, cursor, limit)` returns paginated, filterable payloads — raw JSON + error + context, untruncated — for Story 3-4i's moderator UI to consume.
5.  A GraphQL mutation `reprocessPayload(payloadId: ID!, parserVersion: String!): ReprocessResult!` enqueues a stored payload to the `AIProcessingQueue` with the selected parser version, returning a tracking ID or status — moderators can choose from any historical parser version available in `parser_version_registry`.
6.  A daily digest email (08:00 UTC) is sent to all moderators summarizing anomalies grouped by source (Apify, Bright Data, Gemini), with sample error messages and a link to the moderator dashboard (Story 3-4i).
7.  A GraphQL mutation `deleteUnprocessedPayload(payloadId: ID!)` allows moderators to manually soft-delete a payload from the retention queue.
8.  All mutations are `requireModerator`-gated; the query is also `requireModerator`-scoped.

**Note (2026-08-18, added via `bmad-create-story` as user-identified follow-up to Story 3-4g):** Story 3-4g detects validation failures and drops invalid payloads; this story captures those failures before they're lost, persists them with parser versioning infrastructure, and enables moderator-driven investigation and recovery. Separated from Story 3-4g to keep validation focused on detection, and from Story 3-4i to keep infrastructure separate from moderator UI. Full detail in the story file (`_bmad-output/implementation-artifacts/3-4h-capture-and-surface-data-format-anomalies.md`).

**Amendment (2026-08-18, user clarification during story creation):** Parser versioning is full-featured — moderators can select *any* historical parser version when re-processing, not just the current one. Re-processing enqueues asynchronously (does not block the moderator action). Retention TTL is user-configurable via environment variable.

**Depends on:** Story 3-4g (validation detection), Story 3.5 (AIProcessingQueue for enqueue), Story 0.15 (email adapter for daily digest), Story 4.7a (moderator auth).

### Story 3.4i: Moderator unprocessed-payload browser and re-processing UI

**As a** content moderator,
**I want** a dedicated page in the moderator tools to browse unprocessed payloads captured by Story 3-4h, filter by anomaly source and date, select a parser version, and trigger re-processing,
**So that** I can investigate data quality issues and recover failed extractions without developer intervention.

**Acceptance Criteria:**

1.  A new route `/moderator/unprocessed-payloads` displays a filterable, paginated list of unprocessed payloads (via the `queryUnprocessedPayloads` query from Story 3-4h).
2.  Filters include: source (Apify / Bright Data / Gemini), vendor (Instagram, etc.), date range (createdAfter/createdBefore), and sort order (newest/oldest).
3.  Each payload item in the list shows: timestamp, source/vendor, account ID, post URL, validation error message (one-line summary), and action buttons.
4.  Clicking an item expands to show the raw JSON payload (untruncated) and full error details in a monospace, read-only display.
5.  A dropdown on each payload allows selecting a parser version from all available historical versions in `parser_version_registry` (fetched via GraphQL).
6.  A "Reprocess" button triggers the `reprocessPayload` mutation (Story 3-4h) with the selected parser version, enqueuing the payload asynchronously and showing a toast confirmation.
7.  A "Delete" button soft-deletes the payload via `deleteUnprocessedPayload` (Story 3-4h).
8.  An empty state message is shown when no payloads exist or all are filtered out.
9.  This page is separate from Story 4.7's moderator-items-page (which owns reports and default-location changes).

**Note (2026-08-18, user decision during story creation):** This story owns the entire moderator page for unprocessed payloads, separate from Story 4.7. It consumes the GraphQL queries and mutations built by Story 3-4h. Positioned as a UI-only story, with no backend changes beyond Story 3-4h's infrastructure.

**Depends on:** Story 3-4h (backend mutations/queries), Story 4.7a (moderator route guard).

### Story 3.4j: Capture scraper actor-run audit trail and enable replay-by-run-ID

**As a** platform operator and content moderator,
**I want** every Apify/Bright Data actor run (sync or async, succeeded or failed) recorded with its raw input and raw output, and a way to replay a specific run by its run ID without re-scraping,
**So that** I can diagnose silent scraping failures (e.g. a run that reports success upstream but persists zero posts) and recover the lost data by re-processing the vendor's already-fetched output, instead of burning scraper quota on a redundant re-scrape.

**Acceptance Criteria:**

1.  Every Apify actor call — synchronous (`callApifyActor`, used by on-demand/batch `getNewestPosts`/`getPostByUrl`/`lookupAccountProfile`) or asynchronous (the webhook-polled tier) — writes a row to a new `scraper_actor_runs` table on completion, capturing vendor, trigger mode, account/profile, run ID, status, raw input, raw output, item count, and error message.
2.  The same capture applies to Bright Data, at both trigger time and result time (webhook and stale-job-sweep resolution).
3.  `rawInput`/`rawOutput` are stored as unconstrained JSONB with no fixed shape, since vendor actor output can change field names across versions outside this app's control — distinct from Story 3-4h's `parserVersionRegistry`, which versions FestGrid's own parsing code, not the vendor's wire format.
4.  Audit-row writes never fail or block the underlying scrape/webhook/sweep operation.
5.  A `requireModerator`-gated GraphQL query `queryActorRuns(filters, first, after): ActorRunConnection!` returns a cursor-paginated, filterable (vendor, status, account, date range) list of runs, reusing Story 3-4h's cursor/edge/pageInfo shape.
6.  A `requireModerator`-gated GraphQL mutation `replayActorRun(actorRunId: ID!): ReplayActorRunResult!` reuses the run's stored output when present (no vendor API call), or fetches it fresh by run ID when the run was recorded but never resolved, then re-persists through the existing (already idempotent) post-persistence pipeline — returning `{ success, postsPersisted, message }` synchronously, not a placeholder queue ID.
7.  Replaying a run twice is safe — persistence is dedup-on-`postUrl`, so a second replay reports `0` new posts rather than erroring.
8.  `scraper_actor_runs` is excluded from the AD-8 soft-delete convention (immutable audit log, same rationale as `Schedule`/`Post`/`GeolocationCache`).

**Note (2026-08-19, added via `bmad-create-story` as user-identified follow-up during investigation of a production scraping bug):** A `/bmad-help` investigation traced a "no posts appearing after a scrape run" report to a confirmed, separate bug (`persist-scraped-post.ts` never sets the NOT NULL `posts.platform` column — tracked outside BMad story ceremony as a `bmad-quick-dev` fix, not this story's deliverable). That investigation also found the codebase has **no record at all** of any scraper actor run's input/output today — neither vendor's sync or async tier persists anything beyond a bare `runId`/`snapshotId` in the narrowly-scoped `apifyPendingJobs`/`brightdataPendingJobs` webhook-coordination tables. This story (and its UI counterpart, 3-4k) closes that gap. A new unified table (rather than extending the two existing pending-job tables) was chosen deliberately: the synchronous Apify tier — the one actually implicated in the reported bug — never creates a row in `apifyPendingJobs` at all, so extending it would leave that tier uncovered; see the story file's Dev Notes for full evidence.

**Depends on:** Story 3.4 (existing scrape pipeline), Story 3-4a (Bright Data async tier), Story 3-4d (async job handling), Story 3-4h (precedent for JSON-payload capture pattern, not a hard dependency).

### Story 3.4k: Moderator actor-run browser and replay UI

**As a** content moderator,
**I want** a dedicated page in the moderator tools to browse every scraper actor run (Apify and Bright Data, sync and async, any status), inspect its raw input/output, and replay a specific run by ID,
**So that** I can investigate scraping failures — including runs that reported success but produced no posts — and recover the data without developer intervention or re-scraping.

**Acceptance Criteria:**

1.  A new route `/moderator/actor-runs` displays a filterable, paginated list of actor runs (via `queryActorRuns` from Story 3-4j), newest-first by default.
2.  Filters: vendor (Apify/Bright Data), status, date range, account/profile.
3.  Each run shows: timestamp, vendor badge, trigger-mode badge, account, run ID, status badge, item count.
4.  Clicking a run expands raw `rawInput`/`rawOutput` JSON in a new shared `RawJsonViewer` component (extracted to `packages/ui` — see Note) plus any error message.
5.  A "Replay" button calls `replayActorRun` (Story 3-4j) with a blocking loader and a success/error toast reporting `postsPersisted`. Available on any run regardless of stored status, since the primary recovery scenario (success reported, zero posts persisted) looks identical to a normal successful run at this table's level.
6.  An empty state is shown when no runs exist or all are filtered out.
7.  Gated by Story 4.7a's `useRequireModerator()`.
8.  A new entry is added to `profileMenuEntries` (`packages/ui`) so the page is reachable from the user menu.
9.  All copy sourced through next-intl (en/id).

**Note (2026-08-19, user decision during story creation):** Split from Story 3-4j following the exact 3-4h/3-4i backend/frontend precedent. A dedicated `RawJsonViewer` component is extracted to `packages/ui` in this story (not left inline as Story 3-4i's own raw-JSON display was) because this is now a second, independent consumer of the identical capability — genuine reuse evidence rather than speculative extraction. Full detail in the story file (`_bmad-output/implementation-artifacts/3-4k-moderator-actor-run-browser-and-replay-ui.md`).

**Depends on:** Story 3-4j (backend contracts), Story 4.7a (moderator route guard).

### Story 3.5: Add new posts to a processing queue

**As a** system,
**I want** to add the scraped posts to a processing queue,
**So that** I can reliably and asynchronously process them for event extraction.

**Acceptance Criteria:**

*   **Given** a new post has been scraped from a subscribed account and persisted (Story 3.3a),
*   **When** a post becomes "ready to be processed" — i.e. a user selects it for extraction via Story 5.1a's `selectPostsForExtraction` mutation (PRD §3.10) — not automatically for every scraped post, since Epic 5's manual selection is the deliberate entry point that lets users stay within their API quota,
*   **Then** the post is added as a message to the `AIProcessingQueue` SQS queue.
*   **And** the message contains all the necessary information about the post (e.g., URL, content, metadata).
*   **And** this story's queue-producer logic is the shared mechanism Story 5.1a's mutation calls into — Story 5.1a does not reimplement queueing.

**Note:** AC corrected by Gate 1 (`story-split-gate.md`), surfaced by the Epic 5 readiness sweep (`bmad-epic-readiness-check`) — the original draft implied posts are queued automatically right after scraping, which conflicts with PRD §3.10 (manual post selection is what "should be processed by the AI agent") and with Story 5.3's quota-enforcement requirement. Queueing is now explicitly tied to user selection.

**Amendment (2026-08-10, added via `bmad-create-story` during this story's own creation):** The AC list above adds AC4 (explicit message shape: `postId`/`accountId`/`content`/`imageUrl`/`postUrl`/`publishedAt`) and AC6 (a duplicate-enqueue guard) beyond the original 5-bullet draft. Two real tradeoffs, not resolvable from the AC text alone, were resolved with the user via `AskUserQuestion`: (1) the shared queue-producer function takes a single `postId` (mirroring Story 3.4's `enqueueScrapeJob`-per-target precedent), not a batch array, even though the future caller (`selectPostsForExtraction(postIds: [ID!])`) is batch-shaped — Story 5.1a will loop when it is built; (2) the producer itself guards against re-enqueueing an already-fully-processed post (`isExtracted: true`, throws `PostAlreadyExtractedError`) rather than deferring that check entirely to Story 5.1a's not-yet-built mutation/UI, to avoid wasting a paid Gemini/quota call on a stray duplicate selection — this does not catch the narrower "already queued, still pending" race, an accepted gap. Additionally, per this codebase's own precedent (Story 3.4 wired `SCRAPING_QUEUE_URL`/`grantSendMessages` onto the API Lambda only alongside its own real caller inside that Lambda), this story deliberately does **not** touch `apps/infrastructure/lib/festgrid-backend-stack.ts` — no caller of `enqueuePostForProcessing` exists inside any Lambda yet, so wiring `AI_PROCESSING_QUEUE_URL`/`aiProcessingQueue.grantSendMessages(apiLambda)` is left as Story 5.1a's responsibility when it adds the real `selectPostsForExtraction` resolver. See the full story file for the shared `send-sqs-message.ts` helper extraction (reused by `enqueue-scrape-job.ts` too) and complete rationale.

**Depends on:** Story 3.3a.

### Story 3.6: Process posts from the queue and extract event information

**As a** system,
**I want** to process posts from the queue, call the Gemini API (through the AI Gateway adapter) to extract event information, and enqueue the validated result for ingestion,
**So that** new events can be reliably added to the application without this Lambda also owning the database write.

**Acceptance Criteria:**

*   **Given** there is a message in the `AIProcessingQueue` containing a post to be processed,
*   **When** the message is consumed by the AI Processor Lambda,
*   **Then** the Lambda calls the Gemini API exclusively through the AI Gateway adapter (Story 0.13) to extract event information from the post content.
*   **And** the extracted information is validated (AJV) and transformed into a structured `EventInfo` object, including a populated `confidenceScore`.
*   **And** if the Gemini response does not include an explicit event location, the transform falls back to the source post's account's `SocialMediaAccountProfile.defaultLocation` (via `posts.accountId`, Story 3.1a/3.3a) when one is set (PRD §3.7); if no `defaultLocation` is set either, `EventInfo.location` is left absent rather than fabricated.
*   **And** the validated `EventInfo` object is enqueued to the `DataIngestionQueue` — this Lambda does not write to the database directly (Story 3.6b handles ingestion).

**Note:** AC corrected by Gate 1 (`story-split-gate.md`) — the original draft had this Lambda both call Gemini and save directly to the database, bypassing the separate Ingestor Lambda shown in `docs/infrastructure/high-level-overview.md`.

**Amendment (2026-08-01, PM pass following Epic 3 readiness re-sweep):** Added the `defaultLocation` fallback AC. PRD §3.7 has required this behavior since before Story 3.3 existed ("If the AI agent does not find an explicit location in a post, it will use this default location for the event"), but no AC in this story ever implemented it — a requirements-coverage gap, not an architecture gap, surfaced while reviewing the 2026-08-01 `defaultLocation`/`SocialMediaAccountProfile` PRD amendment.

**Depends on:** Story 0.13, Story 3.1a, Story 3.3a, Story 3.5.

### Story 3.6a: Infer event timezone from subscriber context and flag ambiguous cases for clarification

**As a** system,
**I want** to complete PRD FR33's timezone-inference strategy beyond location-based inference — falling back to the subscribing user's own timezone when a resolved location has no timezone, and flagging an event for manual clarification when neither is available with high confidence,
**So that** an extracted event's schedule always has the best available timezone information, and ambiguous cases are surfaced rather than silently defaulted.

**Acceptance Criteria:**

*   **Given** an event has been extracted and its schedule's location did not yield a resolvable timezone via Story 3.6's Tier-1 (location-based) inference,
*   **When** the account the event was extracted from has exactly one active subscriber,
*   **Then** that subscriber's own timezone (a concept not yet captured anywhere in the data model — this story must define where a user's timezone is sourced from, e.g. captured at signup/in settings, or inferred from their own location) is used as the schedule's timezone (PRD §3.7 Tier 2).
*   **And**, **given** the account has more than one active subscriber (Tier 2/shared subscription, ambiguous whose timezone should apply) or no user-timezone signal is available either,
*   **When** no timezone can be determined with high confidence,
*   **Then** the event/schedule is flagged for manual clarification — this story must define what that flagged state looks like (a new schema column, a moderator/user-facing surface, or reuse of an existing mechanism) and where it is surfaced, since no such state exists anywhere in the schema or any other story today.

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.6):** Story 3.6's own creation found that PRD FR33's full three-tier timezone-inference strategy had no owning story anywhere in Epic 3 — Story 0.16 (Geolocation adapter) explicitly named "timezone inference for extracted events" as an anticipated consumer, but no story ever built the consumption side, and `epic-3-readiness.md`'s Gate 1/3 sweep did not flag the gap either (it evaluated architecture/foundation completeness, not FR-level requirements coverage). User confirmed via `AskUserQuestion`: Story 3.6 absorbs Tier 1 (location-based inference, low incremental cost via the already-built Geolocation adapter) directly into its own AC6; this story absorbs the two genuinely ambiguous, product-decision-requiring tiers (2 and 3) that Story 3.6's own scope should not silently decide. Positioned as a lettered suffix directly off Story 3.6 (the story whose own creation surfaced the gap), per `story-split-gate.md`'s "single-story split" numbering rule.

**Depends on:** Story 3.6.

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

**Amendment (2026-08-10, added via `bmad-create-story` while drafting Story 3.6a):** This story's DB write must also persist the two new `schedules` columns Story 3.6a adds (`timezone: text`, `timezoneStatus: 'RESOLVED' | 'NEEDS_CLARIFICATION'`), sourced from `ExtractedScheduleMessage`'s corresponding new fields — not just the fields already listed above. Flagged via Gate 1's traceability recommendation during Story 3.6a's creation, so this dependency doesn't stay implicit.

**Depends on:** Story 3.6, Story 3.6a.

### Story 3.6c: Capture and store the subscribing user's timezone

**As a** system,
**I want** to capture and persist each user's IANA timezone,
**So that** PRD FR33 Tier 2 (subscriber-timezone fallback, Story 3.6a) has real data to resolve ambiguous event timezones instead of every case falling through to manual clarification.

**Acceptance Criteria:**

*   **Given** a user is authenticated and using the app,
*   **When** the client resolves the browser's IANA timezone (e.g. via `Intl.DateTimeFormat().resolvedOptions().timeZone`) at an appropriate point in the session (e.g. login, or settings page load),
*   **Then** the resolved timezone string is persisted to `users.timezone` (column added by Story 3.6a, matching PRD §4.8's `User.timezone` field) via a dedicated mutation, only writing when it differs from the currently stored value to avoid needless writes.
*   **And** existing users who have not yet had a session capture their timezone continue to have `users.timezone = NULL` until their next authenticated session captures one — this story does not backfill.

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.6a):** Story 3.6a's own creation found that `users.timezone` (needed for PRD FR33 Tier 2) has no capture mechanism anywhere in the codebase — without this story, Tier 2 can structurally never fire (every schedule falls through to Tier 3/flagged). Surfaced by Gate 3 (`story-split-gate.md`); user confirmed via `AskUserQuestion` to split this out as its own story rather than have 3.6a build the capture UI/mutation itself, keeping 3.6a's zero-`apps/web`-surface shape consistent with Story 3.5/3.6's own precedent. Positioned as a lettered suffix directly off Story 3.6, matching the existing 3.6a/3.6b sibling family.

**Depends on:** Story 3.6a.

### Story 3.6d: Surface schedules flagged as needing timezone clarification

**As a** user,
**I want** to see when one of my extracted events has an ambiguous, unresolved schedule timezone and be able to provide the correct one,
**So that** the event's displayed time is trustworthy rather than silently wrong or perpetually unresolved.

**Acceptance Criteria:**

*   **Given** a schedule has `timezoneStatus = 'NEEDS_CLARIFICATION'` (Story 3.6a's schema, written via Story 3.6b's DB ingestion),
*   **When** the user views that event's detail (Story 3.7),
*   **Then** the user sees an indicator that the schedule's timezone could not be automatically determined, with a way to select/provide the correct one.
*   **And** once the user provides a timezone, the schedule's `timezone` column is updated and `timezoneStatus` is set to `RESOLVED`.

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.6a):** Story 3.6a's own creation found that `schedules.timezoneStatus = 'NEEDS_CLARIFICATION'` is written by the pipeline but nothing in epics.md today displays or resolves it — flagged rows would otherwise accumulate with no path out. Surfaced by Gate 3 (`story-split-gate.md`); user confirmed via `AskUserQuestion` to defer this rather than have 3.6a build UI against a display layer (Story 3.6b/3.7) that doesn't exist yet. Positioned as a lettered suffix directly off Story 3.6, matching the existing 3.6a/3.6b/3.6c sibling family. Depends on Story 3.6b (DB write) and Story 3.7 (event display) both existing first.

**Depends on:** Story 3.6a, Story 3.6b, Story 3.7.

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
*   **And** the events are fetched via the backend GraphQL API using the Unified Query DSL (Story 1.3a), scoped to events sourced from the current user's subscribed accounts — not directly from the database.

**Amendment (2026-08-10, added via bmad-create-story during this story's own creation):** The single AC list above is expanded in the full story file with an explicit auth requirement (the /feed page requires a logged-in user, matching the /favorites and /my-calendar precedent - unauthenticated visitors are redirected to /login) and the UX scenario doc's (design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.1-alex-discovers-his-feed.md) exact zero-events empty-state copy and CTA ("Your feed is empty! Subscribe to social media accounts to see their events here." plus a "Manage Subscriptions" button). Two real design decisions were resolved with the user via AskUserQuestion: (1) the same UX scenario doc's softly-optional "Feed-Specific Filters: filter by specific subscriptions" (03.4-viewing-the-feed.md) is explicitly deferred out of this story's scope - epics.md's AC never required it, and it implies a new reusable subscription-picker component with no second consumer yet; (2) "events from my subscribed accounts" is expressed as a new server-side, auth-scoped Unified Query DSL field, isFromSubscribedAccount, added to the events resolver's fieldMap (apps/backend/src/schema/resolvers.ts:872-909) as an EXISTS subquery correlated on the server-known userId - mirroring the existing isFavorited/isAddedToCalendar pattern exactly - rather than a client-composed sourceSocialMediaAccountId in [...] list. The join is events.postId -> posts.id -> posts.accountId (uuid) -> socialMediaAccountProfiles.id -> subscriptions.accountId / subscriptions.userId (the user-suggested correction during this story's creation), not the fragile events.sourceSocialMediaAccountId (text, platform-native ID) path the initial analysis considered. Gate 2 (story-split-gate.md), run fresh during this story's creation (Epic 3's swept epic-3-readiness.md only covers Gate 1/3), additionally found that this story's planned calendar view would be a third near-duplicate of week-navigation/status-mapping/schedule-flattening logic already copy-pasted between Discovery's CalendarView.tsx and My Calendar's my-calendar-content.tsx - split into prerequisite **Story 3.7a** (see below) rather than landing a third copy.

**Depends on:** Story 3.2, Story 3.6b, Story 1.3a, Story 1.3b, Story 1.3c, Story 1.5, Story 1.5a, Story 2.6, Story 3.7a.

### Story 3.7a: Extract shared weekly-calendar-controller hook

**As a** developer,
**I want** the week-navigation, loading/error status mapping, and schedule-flattening logic that Discovery's calendar view and My Calendar already duplicate to live in a single shared hook,
**So that** Story 3.7's Feed calendar view doesn't become a third copy of the same ~60-80 lines, and future calendar-view consumers have one implementation to depend on.

**Acceptance Criteria:**

*   **Given** apps/web/src/features/events/CalendarView.tsx (Discovery) and apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx (My Calendar) each independently implement getSunday/getSaturday week-boundary math, weekStart/weekEnd derivation, handlePrevWeek/handleNextWeek/handleToday navigation (including their calendar_week_navigated PostHog events), a status === 'pending' ? 'loading' : status mapping, and schedule-flattening from GetEventsQuery-shaped data into WeeklyCalendarView's schedules prop,
*   **When** this story extracts that shared logic into a single hook (useWeeklyCalendarController) in packages/ui/src/hooks/,
*   **Then** the hook accepts whatever varies per caller (the query-condition builder/fetch function, translation label strings) as parameters, and returns { weekStart, weekEnd, schedules, status, errorMessage/errorDetail, handlePrevWeek, handleNextWeek, handleToday } for the consuming component to pass straight into WeeklyCalendarView.
*   **And** CalendarView.tsx and my-calendar-content.tsx are refactored to use the new hook, with no behavior change (same PostHog events fire, same week math, same rendered output) - verified by their existing tests continuing to pass unmodified in assertions (only setup/mocking may change).
*   **And** the hook itself has unit test coverage for week-boundary math, navigation, and schedule-flattening.

**Note (2026-08-10, added via bmad-create-story while drafting Story 3.7):** Story 3.7's own creation found that its planned calendar view (Feed) would be a third near-byte-for-byte duplicate of week-navigation/status-mapping/schedule-flattening logic already copied between Discovery's CalendarView.tsx and My Calendar's my-calendar-content.tsx (the latter currently in review status). Surfaced by Gate 2 (story-split-gate.md), run fresh via the Freya persona since Epic 3's swept epic-3-readiness.md only covers Gate 1/3. User confirmed via AskUserQuestion to split this out as its own prerequisite story rather than accept a third duplication or fold the two-file refactor into Story 3.7's own scope. Positioned as a lettered suffix directly off Story 3.7, per story-split-gate.md's "single-story split" numbering rule, since the trigger is specifically Story 3.7's addition of a third consumer.

**Depends on:** Story 1.5 (Discovery calendar view), Story 2.6 (My Calendar).

### Story 3.7b: Filter the Feed page by specific subscribed account

**As a** user with multiple social media account subscriptions,
**I want** to narrow my Feed to events from one or a few specific subscribed accounts,
**So that** I can focus on a subset of my subscriptions instead of always seeing everything at once.

**Acceptance Criteria:**

*   **Given** I have more than one active subscription,
*   **When** I open a subscription filter on the Feed page,
*   **Then** I can select one or more of my subscribed accounts to narrow the Feed's card/calendar results to just those accounts' events, combined with the existing search/type/category filters and the base subscribed-accounts-only scope.
*   **And** this uses a new reusable subscription-picker filter component (multi-select), since none exists yet.

**Note (2026-08-10, added via bmad-create-story while drafting Story 3.7):** design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.4-viewing-the-feed.md softly describes this as a possible "Feed-Specific Filter" ("there may be an option to filter by specific subscriptions"), but epics.md's original Story 3.7 AC never required it. User confirmed via AskUserQuestion during Story 3.7's creation to defer it as its own follow-up story rather than build it now or silently drop it, since it implies a new reusable filter component with no second consumer yet. Positioned as a lettered suffix directly off Story 3.7, matching the 3.7a sibling.

**Depends on:** Story 3.7.

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

**Depends on:** Story 0.12, Story 2.9.

### Story 3.9: Implement API key quota management

**As a** user who has subscribed to a popular account,
**I want** the system to fairly use the API keys from all subscribers,
**So that** event extraction is reliable and not dependent on a single user's quota.

**Acceptance Criteria:**

*   **Given** there are multiple users subscribed to the same social media account,
*   **When** the system needs to process a post from that account,
*   **Then** it uses the AI Gateway Adapter's (Story 0.13) Tier 1/Tier 2 quota-management algorithm to select which user's API key to use — this story does not reimplement key-selection or usage-tracking logic, which already lives in Story 0.13.
*   **And** end-to-end/integration tests confirm the observable behavior across ≥2 real subscribers: when Subscriber A's key is exhausted/invalid, extraction continues using Subscriber B's key, and per-key usage counters visibly reset at the start of a new billing cycle.

**Note:** AC corrected by Gate 1 (`story-split-gate.md`), surfaced by the Epic 3 readiness sweep (`bmad-epic-readiness-check`) — FR24's quota algorithm is already fully implemented by Story 0.13's AC. This story is narrowed from "implement the algorithm" to "verify its observable multi-subscriber behavior end-to-end," avoiding two stories independently owning the same logic.

**Depends on:** Story 0.13.

### Story 3.9a: Display in-app queue status and API key health

**As a** user who has subscribed to social media accounts,
**I want** a dedicated "Queue Status" section in my user menu showing how many of my subscribed posts are still pending extraction and whether my own API keys are healthy,
**So that** I understand extraction progress and can react if one of my keys needs attention.

**Acceptance Criteria:**

*   **Given** I have one or more active subscriptions, **when** I open "Queue Status" from my user menu, **then** I see, for each active subscription, the social media account's display name and the count of that account's posts still pending extraction (`posts.isExtracted = false`, scoped to that `accountId`).
*   **And** I see the status of each of my own API keys (`api_keys.isValid`) as "Active" or "Invalid" — a live "Rate-limited" state is explicitly out of scope for this story, since Story 0.13's adapter treats rate-limiting as a transient, in-request-only condition and persists nothing to `api_keys` for it (only `isValid`/`invalidAttempts` are durable); a future story may add a persisted rate-limit signal if needed.
*   **And** if any of my keys is `Invalid`, a warning is shown with a link to `/settings/api-keys` (Story 3.1b) to resolve it.
*   **And** this page requires authentication and shows only the signed-in user's own subscriptions/keys.

**Note (2026-08-11, added via `bmad-create-story` while drafting Story 3.9):** Surfaced by Gate 2 (`story-split-gate.md`), run fresh via the Freya persona since Story 3.9's own scope (backend verification tests only, per its Gate-1-corrected AC) has no UI. FR23 ("A dedicated section within the user menu will display the real-time queue status of posts pending extraction") is mapped to Epic 3 in the PRD's FR-to-epic table, and Story 0.13's own `Out of Scope` section explicitly anticipated "Story 3.9 (UI-facing aspects)" would own it — but Story 3.9's AC was later narrowed by the Epic 3 readiness sweep's Gate 1 correction to drop all UI, leaving FR23 mapped to Epic 3 with no story anywhere implementing it. Draft (non-authoritative) UX content already exists at `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.8-in-app-queue-status.md`, describing this exact screen, but was never promoted into the authoritative `DESIGN.md`/`EXPERIENCE.md`. User confirmed via `AskUserQuestion` during Story 3.9's creation to split this off as its own prerequisite story rather than silently re-absorb it into 3.9 or leave FR23 permanently orphaned. Positioned as a lettered suffix directly off Story 3.9 per `story-split-gate.md`'s "single-story split" numbering rule. (A related but distinct draft page, `04.6-quota-management-display.md` — a quota progress bar on the *manual post selection* screen — belongs to Epic 5's manual-extraction flow, not this story; not in scope here.)

**Depends on:** Story 0.13, Story 3.1a, Story 3.1b, Story 3.3a.

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

**Amendment (2026-08-11, added via `bmad-create-story` during this story's own creation):** `Depends on` updated to add Story 0.27. Full context-engine analysis found this story needs a new scheduled Lambda with a real SES send grant; the swept `epic-3-readiness.md` didn't anticipate this (its Gate 1/3 sweep predates this story's own creation and only covers already-drafted stories), and neither Story 0.14 (predates this story, only provisioned the Lambdas known at the time) nor Story 0.25 (scoped only to reconciling `L_API`'s own SES grant) covers a brand-new Lambda's grant. Split into new Story 0.27 per `AskUserQuestion` confirmation rather than built ad hoc inside this story. See Story 0.27's Note and this story's own implementation-artifact Dev Notes for the full analysis.

**Depends on:** Story 0.15, Story 0.27, Story 3.1a, Story 3.3a.

### Story 3.11: View events for a social media account

**As a** visitor,
**I want** a dedicated page showing all events sourced from a single social media account,
**So that** I can browse an account's events directly — e.g. via a shared link — without needing to log in or be subscribed to it.

**Acceptance Criteria:**

*   **Given** a `social_media_account_profiles` row exists (Story 3.1a) with at least one associated event,
*   **When** I navigate to `/{locale}/{platformSlug}/{accountId}` (e.g. `/en/ig/17841400000000000`), where `platformSlug` is a short, stable slug derived from `SocialMediaAccountProfile.platform` and `accountId` is `SocialMediaAccountProfile.accountId` (Story 3.1a's platform-native identifier — not the internal database `id`),
*   **Then** I see that account's events rendered with the same card view, calendar view, search, and filter behavior as the main discovery page (Stories 1.3, 1.3b, 1.3c, 1.5, 1.5a, 2.6) — reusing those components rather than re-implementing them.
*   **And** the page first resolves `platformSlug`+`accountId` to the account profile via Story 3.1a's `socialMediaAccountProfileByAccountId(platform, accountId)` query, then fetches events via the events GraphQL API (Story 1.3a) using the Unified Query DSL's existing `socialMediaAccountProfileId equals <profile.id>` condition (AD-1) — the profile's internal `id`, not its public `accountId`, is what the DSL condition takes; no new query mechanism is introduced for events themselves.
*   **And** this page requires no authentication and no subscription to the account — both the profile lookup and the events query are publicly accessible given a valid `platformSlug`/`accountId`.
*   **And** if `platformSlug` matches no known platform, or `socialMediaAccountProfileByAccountId` finds no matching profile, a not-found state is shown rather than an error.
*   **And** the page sets its title/meta description via `generateMetadata`, per the Dynamic Page Title invariant (project-context.md), using the account's `displayName`.
*   **And** the platform-to-slug mapping (e.g. Instagram -> `ig`) is defined once in a shared location alongside the platform-specific scraper adapters (PRD §3.7) and reused for routing — not hardcoded per-component.

**Note:** This story exists because of new user-driven scope (`bmad-correct-course`, 2026-08-02) — the PRD previously only described a logged-in user's personalized feed across their subscriptions (§3.7 "Display Subscribed Events"), not a public per-account page. Architecturally unblocked: AD-1 already names "subscribed account page" as a bound use case and already defines the `socialMediaAccountProfileId` DSL field this story's events query needs; the new `socialMediaAccountProfileByAccountId` query (Story 3.1a amendment) is the only new read path, needed because the DSL field takes the profile's internal `id`, not the public-facing `accountId` this story's URL exposes. Cross-referenced by an amendment to Story 1.6a, which links the event detail view's account attribution to this page. New FR68 covers this capability. Positioned at the end of Epic 3 rather than near Story 3.1a — it has no dependency on the scraping/quota pipeline stories (3.4-3.10) and only needs Story 3.1a's table/query plus already-built Epic 1 components.

**Depends on:** Story 3.1a, Story 1.3a, Story 1.3b, Story 1.3c, Story 1.5a, Story 2.6, Story 3.3c.

### Epic 4: Data Quality and Moderation

Users can contribute to data quality by correcting event details and reporting issues.
**FRs covered:** FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR67

### Story 4.1a: Build the corrections backend GraphQL API layer

**As a** developer,
**I want** a `corrections` table plus a `submitCorrection` mutation,
**So that** Stories 4.1 and 4.2 write event corrections through a real backend path instead of ad hoc storage.

**Acceptance Criteria:**

*   **Given** Story 0.17's auth context and Story 1.1's `events`/`schedules` tables exist,
*   **When** the migration script runs,
*   **Then** a `corrections` table is created (`id`, `event_id` FK, `submitted_by_user_id` FK, `proposed_data` JSONB matching the `EventInfo`/`Schedule` shape, `source` enum [`manual`, `ai_assisted`], `status` enum [`pending`,`applied`,`rejected`], `created_at`, `resolved_at` nullable).
*   **And** a `submitCorrection(eventId, proposedData, source)` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17).
*   **And** the mutation runs the data inconsistency checks server-side via AJV (Story 0.11) as the authoritative gate — any client-side Zod validation (Story 0.11) is a UX convenience only, never the sole check.
*   **And** corrections that pass validation are applied directly to `events`/`schedules` (`status='applied'`); corrections that fail validation are rejected (`status='rejected'`) and returned to the caller with the validation errors.
*   **And** no package outside `apps/backend` writes to `corrections` or `events` directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 4 readiness sweep (`bmad-epic-readiness-check`) — Stories 4.1 and 4.2 both submit event corrections but no table or backend mutation exists for them anywhere in `epics.md`. Classified as a shared data-ownership gap (consumed by both 4.1 and 4.2), positioned immediately before Story 4.1, the first consumer.

**Correction (2026-08-11, amended via `bmad-create-story` while drafting Story 4.1):** `Correction.validationErrors` is changed from a flat `[String!]` to a structured `[ValidationError!]` (`{ field: String!, message: String! }`), and the resolver's AC3-AC5 error collection is extended to attach a `field` key to every AJV/consistency/ownership error (AJV errors derive it from `error.instancePath`; `validateCorrectionConsistency`'s errors already carry a `field`; the schedule-ownership check attaches `schedules[<index>].id`). Reason: UX scenario 06.5 requires an inline error rendered next to the specific invalid field, which an unstructured string array cannot support without fragile substring-matching on message text. Confirmed via `AskUserQuestion` during Story 4.1's creation — Story 4.1a had not yet been implemented (`ready-for-dev`), so this is a shape correction, not a breaking change to shipped code. See Story 4.1a's Dev Notes for the full amendment detail.

**Depends on:** Story 0.8, Story 0.11, Story 0.17, Story 1.1.

### Story 4.1b: Build the reusable event correction form component

**As a** developer,
**I want** a presentation-only, reusable `CorrectionForm` component in `packages/ui`,
**So that** Stories 4.1 (manual entry) and 4.2 (AI-assisted pre-fill) both render and submit corrections through the same typed-input form instead of duplicating it.

**Acceptance Criteria:**

*   **Given** Story 4.1a's `ProposedEventCorrection`/`ProposedScheduleCorrection` shapes (event-level fields plus a `schedules` array, though this component edits only one schedule at a time — see the MVP scope note below),
*   **When** the component is rendered with an `initialValues` prop,
*   **Then** it displays typed inputs mirroring `EventInfo`'s correctable fields (`eventName`, `types`, `categories`, `location`, `organizerName`, `contactInfo`, `description`) pre-filled from `initialValues`, reusing the existing `MultiSelect` component (Story 1.5a) for `types`/`categories`.
*   **And** it displays typed inputs for exactly one editable `Schedule` (`eventStartDate`, `eventEndDate`, `eventStartTime`, `eventEndTime`, `title`, `performers`, `location`, `ticketPrice`), pre-filled from `initialValues.schedules`' `isMainSchedule: true` entry — full multi-schedule add/remove editing is explicitly out of scope for this story (no UX artifact depicts it; see Story 4.1's own MVP-scope note).
*   **And** it accepts a `validationErrors?: { field: string; message: string }[]` prop (Story 4.1a's amended shape) and renders each error inline next to its matching field, per UX scenario 06.5 — not a generic banner.
*   **And** it exposes an `onSubmit(data: ProposedEventCorrection)` callback (no GraphQL/network code inside the component — the caller owns the mutation, matching `EventDetailView`'s own presentation-only precedent) and an `onCancel` callback, plus an `isSubmitting` prop that disables the form's inputs/submit button (the caller owns any `BlockingLoader`, matching `SetDefaultLocationDialog`'s precedent of the loader living in the page-level wrapper, not the presentational form).
*   **And** it exposes an extension point (`headerActions?: React.ReactNode`, rendered above the form fields) that Story 4.2 will use to inject its "AI-Assisted Correction" URL-extraction trigger (per UX scenario 06.6) without forking this component — Story 4.1b itself implements no AI-assisted logic, only the slot.
*   **And** all microcopy (field labels, button labels, error fallback text) is supplied via a `labels` prop object (no embedded strings), matching `EventDetailViewLabels`/`LocationPickerField`'s i18n-decoupling precedent — the consuming `apps/web` code resolves `labels` via `next-intl`.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while drafting Story 4.1 — the correction form is confirmed-reused by two stories (Story 4.1's manual entry, Story 4.2's AI-assisted pre-fill extending the same form instance per UX scenario 06.6), with non-trivial states (pre-fill, per-field validation-error display, submit/loading, an extension slot for 4.2). Classified as a single-story-shape reusable-component split per `story-split-gate.md`'s numbering rule (needed by exactly Story 4.1/4.2, both within Epic 4), positioned as a lettered suffix immediately after Story 4.1a (which it depends on for the `ProposedEventCorrection` shape) and before Story 4.1, its first consumer. Confirmed via `AskUserQuestion` during Story 4.1's creation.

**Depends on:** Story 4.1a, Story 1.5a.

### Story 4.1: Manually correct event data

**As a** user,
**I want** to be able to manually correct the details of an event,
**So that** I can fix any inaccuracies in the event information.

**Acceptance Criteria:**

*   **Given** I am viewing the details of an event,
*   **When** I click the "Correct Data" action,
*   **Then** a form (Story 4.1b's `CorrectionForm`) is displayed in a dialog with the current event data pre-filled — including `organizerName`/`contactInfo`, which requires extending the `Event` GraphQL type/`eventBySlug` query to expose these two already-existing `events` table columns (see Dev Notes "Data Type Compatibility").
*   **And** I can edit the fields and submit the corrections.
*   **And** the system performs data inconsistency checks before accepting the correction, displayed inline next to the specific invalid field (Story 4.1a's amended structured `validationErrors`).
*   **And** the correction is submitted via the backend `submitCorrection` mutation (Story 4.1a) — not a direct database write from `apps/web` — with `source: manual`.
*   **And** the "Correct Data" trigger is added to `EventDetailView`'s (Story 1.6a) header as an entry in a new "more actions" overflow menu, not a fourth bare icon button alongside Favorite/Add-to-Calendar — introduced now in anticipation of Story 4.3's "Report" action joining the same menu shortly after, per `story-split-gate.md`'s Gate 2 finding and the user's `AskUserQuestion` decision (see Dev Notes "Action Menu Decision").
*   **And**, when the event being corrected has more than one `Schedule`, the form edits only the schedule with `isMainSchedule: true` — matching PRD 3.9.1's singular "Schedule" framing and the only UX scenario (06.5) that depicts the form, which shows exactly one schedule. Editing/adding non-main schedules is out of scope for this story.

**Depends on:** Story 4.1a, Story 4.1b.

### Story 4.2a: Build the on-demand AI-assisted correction extraction API layer

**As a** developer,
**I want** a synchronous `extractEventDataFromUrl` mutation that reuses the existing scraper/AI Gateway pipeline instead of the async, queue-driven one,
**So that** Story 4.2 can pre-fill a correction form from a pasted post URL in direct response to the user's own click.

**Acceptance Criteria:**

1.  **Given** an authenticated user (`requireAuth`, Story 0.17) calls `extractEventDataFromUrl(url: String!): ExtractEventDataFromUrlResult!`, **when** the resolver runs, **then** it first looks up `posts` via the same dual-lookup `persistScrapedPost` (Story 3.3a) already uses for dedup — `where(or(eq(posts.postUrl, url), eq(posts.originalPostUrl, url)))` — to decide between the "existing post" and "new post" paths below.
2.  **Given** a matching `posts` row is found (**existing post**), **when** selecting which Gemini API key to use, **then** the resolver first attempts `callGemini` (Story 0.13's AI Gateway adapter) with `subscriberUserIds: [context.user.id]` (`TIER_1_USER_SPECIFIC` — the caller's own key); **and** if that throws `AiGatewayExhaustedError` (caller has no valid key), it retries with `subscriberUserIds` set to every active subscriber of the post's `accountId` (via `getActiveSubscriberUserIds`, Story 3.5's existing helper — `TIER_2_SHARED_ROUND_ROBIN`, fair fallback across the account's subscriber pool); **and** if that also throws `AiGatewayExhaustedError`, the mutation returns `errorCode: QUOTA_EXHAUSTED`.
3.  **And**, for the existing-post path, the request sent to Gemini reuses `buildGeminiExtractionRequest` (Story 3.6, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`) built from the stored `posts.content`/`posts.imageUrl` — no new prompt/response-schema is authored; the response is parsed and AJV-validated with the same `extractedEventSchema` (Story 3.6) already used by the async pipeline.
4.  **Given** no matching `posts` row is found (**new post**), **when** the resolver determines which platform to scrape, **then** it detects the platform from the URL's domain (new `detectPlatformFromUrl` utility, `packages/domain/src/scraper/platform-registry.ts` — e.g. `instagram.com`/`instagr.am` → `instagram`, `twitter.com`/`x.com` → `twitter`); **and** if the domain matches no known platform, the mutation returns `errorCode: UNSUPPORTED_PLATFORM` without attempting extraction.
5.  **And**, for the new-post path, **when** the caller has no valid Gemini API key of their own, **then** the mutation returns `errorCode: NO_API_KEY` (message instructing the user to contribute their own key) **without** falling back to any other subscriber's key — unlike the existing-post path, a brand-new, never-scraped post has no associated account/subscriber pool to fall back to.
6.  **And**, for the new-post path, **when** the caller does have a valid key, **then** the resolver calls a new `ScraperAdapter.getPostByUrl(url: string): Promise<ScrapedPost | null>` method (extending Story 3.3c's interface; implemented for `instagramScraperAdapter` by reusing the existing `callApifyActor` pattern with `directUrls: [url]`, mirroring `lookupAccountProfile`'s exact structure; `twitterScraperAdapter` throws `'Twitter/X scraping is not yet implemented'`, matching its existing stub for `getNewestPosts`/`lookupAccountProfile`) under a hard timeout (20s, leaving headroom under API Gateway's 29s limit alongside the Gemini call itself); **and** if the scrape returns `null`/times out/throws, the mutation returns `errorCode: SCRAPE_FAILED`; **and** if the scrape succeeds, its `content`/`imageUrl` feed the same `buildGeminiExtractionRequest`/`extractedEventSchema` pipeline as AC3, called via `callGemini` with `subscriberUserIds: [context.user.id]` only (`TIER_1_USER_SPECIFIC`, no round-robin fallback per AC5's reasoning).
7.  **And**, once a validated `GeminiExtractionPayload` is obtained (either path), **when** `payload.isEvent === false`, **then** the mutation returns `errorCode: EXTRACTION_FAILED` (message indicating the linked post doesn't appear to describe an event); **and** when `payload.isEvent === true`, the payload is mapped 1:1 by a new pure `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` function (`eventName`, `types`, `categories`, `location`, `organizerName`, `contactInfo`, `description`, `schedules` — each schedule carrying no `id`, since this is freshly extracted data with no existing DB row) into `ProposedEventCorrectionData` (a new GraphQL output type mirroring Story 4.1a's `ProposedEventCorrectionInput` shape field-for-field — GraphQL forbids reusing an `input` type as an output type) and returned as `data`.
8.  **And** the newly-scraped "new post" content is **not** persisted into `posts` (no `accountId`/account-profile resolution is attempted here) — a one-off extraction only; see Out of Scope.
9.  **And** no package outside `apps/backend` calls the scraper adapter or the AI Gateway adapter directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced fresh during Story 4.2's own creation — the swept `epic-readiness/epic-4-readiness.md` confirmed the AI Gateway adapter (Story 0.13) exists but predates the implementation-detail-level discovery (made while drafting Story 4.2 itself) that no synchronous, single-arbitrary-URL, correction-shaped extraction capability exists anywhere: the AI Gateway adapter and `ScraperAdapter` (Story 3.3c) are real, reusable building blocks, but always invoked today only from the async, queue-driven Story 3.6 pipeline (account-centric batch scraping, `accountId`-scoped location/timezone resolution) — a fundamentally different shape than "extract from one pasted URL, synchronously, in response to a click." Confirmed via a Gate 1 subagent review (Winston persona) and four rounds of `AskUserQuestion` with the user during this story's creation: (1) split into this prerequisite story rather than build inline in 4.2, since the new capability spans a new `ScraperAdapter` method + platform detection + a new resolver + a new domain mapping — not the small, mechanical, single-consumer shape Story 4.1's Task 1 precedent covers; (2) detect platform from the URL's domain rather than require explicit user platform selection; (3) run synchronously with a hard timeout rather than build async job+polling infrastructure for a single bounded action; (4) reuse-first design — check `posts` (dual `postUrl`/`originalPostUrl` lookup, mirroring `persistScrapedPost`'s exact existing dedup logic) before ever attempting a live scrape, and only build the new live-scrape capability (AC6) for the not-found path, with the user's own key prioritized first and a round-robin fallback across the post's account subscribers only when a stored post's account is actually known (AC2) — a brand-new post has no such pool (AC5).

**Depends on:** Story 0.13, Story 0.17, Story 3.3a, Story 3.3c, Story 3.5, Story 3.6.

### Story 4.2: AI-assisted event data correction

**As a** user with a BYOK key,
**I want** the system to be able to automatically extract corrected event information from a URL I provide,
**So that** I can more easily correct event data.

**Acceptance Criteria:**

*   **Given** I am correcting the data for an event (Story 4.1's dialog, Story 4.1b's `CorrectionForm`),
*   **When** the dialog opens, **then** an "AI-Assisted Correction" button renders in `CorrectionForm`'s `headerActions` slot (Story 4.1b) — clicking it reveals a URL text input and an "Extract" button, matching UX scenario 06.6's on-page interaction sequence exactly.
*   **And** I have provided my own Gemini API Key (BYOK),
*   **When** I paste a URL to a social media post and click "Extract",
*   **Then** the system calls the `extractEventDataFromUrl` mutation (Story 4.2a) — never a raw Gemini SDK/HTTP call, and never a direct scraper call, from `apps/web` — while a non-blocking, localized loading indicator shows within this panel (mirroring Story 2.4's `previewLocation` "resolving address…" precedent, not a full-screen `BlockingLoader` — this call does not write any data, matching `project-context.md`'s Blocking-loader rule scoping that pattern to critical *mutations*).
*   **And**, on success, the correction form's current field values are overwritten with the extracted `ProposedEventCorrectionData`, **except** the main schedule's `id` (and any other schedule fields absent from the AI response) is preserved from the form's pre-extraction values — so approving the pre-fill still updates the event's existing main schedule row rather than inserting a duplicate one (Story 4.1a's `id`-present-means-update reconciliation).
*   **And**, on failure (`NOT_FOUND`/`UNSUPPORTED_PLATFORM`/`NO_API_KEY`/`SCRAPE_FAILED`/`EXTRACTION_FAILED`/`QUOTA_EXHAUSTED`), an inline error message specific to that `errorCode` is shown within this same panel (not a toast, not blocking the rest of the form) — the user may still edit the form manually and submit without a successful extraction.
*   **And** I review the pre-filled data, make any necessary adjustments, and submit — approving calls the same `submitCorrection` mutation (Story 4.1a) used by Story 4.1, with `source: 'ai_assisted'` — it is not written directly to the database.

**Depends on:** Story 0.13, Story 4.1, Story 4.1a, Story 4.1b, Story 4.2a.

### Story 4.3a: Build the reports backend GraphQL API layer and personal-visibility filtering

**As a** developer,
**I want** a `reports` table plus mutation/query resolvers, and a per-user "hidden" computed field on the events resolver,
**So that** Stories 4.3, 4.5, 4.6, and 4.7 share one real data path instead of each inventing storage or client-side filtering.

**Acceptance Criteria:**

*   **Given** Story 0.17's auth context and Story 1.3a's events resolver exist,
*   **When** the migration script runs,
*   **Then** a `reports` table is created (`id`, `event_id` FK, `reporter_user_id` FK, `reason` enum [`cancelled`,`dangerous`,`personal`], `details` text nullable, `status` enum [`pending`,`resolved`], `moderator_ignored` boolean default false, `created_at`, `resolved_at` nullable), indexed on `event_id` and `reason` to support Story 4.4's threshold check.
*   **And** a `submitReport(eventId, reason, details)` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17); submission is rejected server-side if the caller already has a `dangerous`-reason report on that event marked `moderator_ignored`.
*   **And** a `myReports` query returns the caller's own reports with the reported event, reason, and status (Story 4.6).
*   **And** a moderator-only `reportedEvents` query and a `resolveReport`/`ignoreSubsequentReports` mutation pair (guarded by `requireModerator`, Story 0.17) support Story 4.7 and Story 4.5's "ignore subsequent reports" action.
*   **And** the events resolver (Story 1.3a) is extended to return a per-user `isHiddenForCurrentUser` computed boolean, true when the caller has an active `personal`-reason report on that event, joined via `buildOptimizedDrizzleSelect` (Story 0.8) — Story 4.3's "immediately hidden from my view" behavior reads this field rather than filtering a client-side list.
*   **And** no package outside `apps/backend` writes to `reports` directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 4 readiness sweep (`bmad-epic-readiness-check`) — no `reports` table or backend layer exists anywhere in `epics.md`, though Stories 4.3, 4.5, 4.6, and 4.7 all assume one. Classified as a shared data-ownership gap, positioned immediately before Story 4.3, the first consumer.

**Correction (2026-08-11, amended via `bmad-create-story` while drafting this story):** Two shape changes, both confirmed with the user via `AskUserQuestion`: (1) `status` is expanded from a literal `[pending, resolved]` 2-value enum to `[pending, upheld, dismissed]` (3 values), and a `resolved_by_moderator_id` FK (nullable, no cascade) is added — aligning with PRD Section 4.12's `Report`/`ReportStatus` interface (the PRD's declared source of truth for data structures, per `project-context.md`) and mirroring the codebase's existing `defaultLocationChangeRequests.reviewedByModeratorId` moderator-audit-trail precedent, which this AC's original text omitted; `moderator_ignored` remains its own separate boolean (a distinct "suppress future dangerous-report submissions" mechanic, not a status value). (2) `isHiddenForCurrentUser` is broadened from "an active personal-reason report" to **any report the caller has filed on that event, of any reason, regardless of resolution status** — PRD 3.9.2 states "the reporting user will immediately no longer see the event" under all three reasons (Cancelled, Dangerous, Personal), not personal alone, and the Dangerous-reason bullet explicitly requires the event to "remain hidden for that user" even after a moderator dismisses/marks-it-safe (i.e. hiding must survive report resolution, which a status-scoped read would break). Story 4.8's own note is corrected below to match.

**Correction (2026-08-12, via `bmad-correct-course`):** `submitReport`'s insert (`resolvers.ts:1057-1063`) currently sets `status: 'pending'` unconditionally, regardless of `reason`. Per PRD 3.9.2, a `personal`-reason report never requires moderator action — the entire effect of the report (hiding the event from that user) already happens automatically via `isHiddenForCurrentUser`, so leaving it `pending` would incorrectly surface it in Story 4.7's moderator queue and misrepresent its status on Story 4.6's My Reports page. AC revised: `submitReport` sets `status: 'auto_resolved'` (new fourth `ReportStatus` enum value — DB enum migration + `reports.graphql` SDL update required) and `resolvedAt: now()` when `reason === 'personal'`; `resolvedByModeratorId` stays `null` since no moderator acted. `cancelled`/`dangerous` reports are unaffected and still insert as `pending`. Confirmed with the user via `AskUserQuestion` during `bmad-correct-course`: a new distinct status value (over reusing `dismissed`) so "auto-resolved, no review needed" reads unambiguously differently from "a moderator reviewed and dismissed this." See `sprint-change-proposal-2026-08-12.md`.

**Depends on:** Story 0.8, Story 0.17, Story 1.3a.

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
*   **And** when I submit the report, it is recorded via the backend `submitReport` mutation (Story 4.3a) — not a direct database write from `apps/web`.
*   **And** the reported event is immediately hidden from my view, implemented by reading the `isHiddenForCurrentUser` field (Story 4.3a) rather than a client-side list filter.

**Depends on:** Story 4.3a.

### Story 4.3b: Add a Report trigger to EventCard (list-view)

**As a** user,
**I want** to report an event directly from a list/grid card (Discovery, Favorites, Feed, My Calendar, etc.),
**So that** I don't have to open an event's full detail view just to report it, matching PRD 3.9.2's literal "list-view or detailed view" requirement.

**Acceptance Criteria:**

*   **Given** `EventCard.tsx` (`packages/ui`) currently exposes only a Favorite toggle and no "more actions" affordance,
*   **When** this story is implemented,
*   **Then** `EventCard` gains a "more actions" trigger (mirroring `EventDetailView`'s existing hand-rolled `MoreVertical` overflow-menu pattern from Story 4.1 Task 3 — same keyboard/focus-trap/outside-click behavior, no new Radix dependency) containing a "Report" item, rendered only when an `onReport` prop is passed.
*   **And** clicking "Report" opens the same reporting flow Story 4.3 built for the detail view (reason selection + optional details, `submitReport` mutation via Story 4.3a) — reusing that dialog/form logic rather than re-implementing it, which likely requires extracting Story 4.3's report-dialog content into a shared component at this point, since it will now have two real consumers (`EventDetailView` and `EventCard`), unlike Story 4.3's own single-consumer scope. Actual extraction shape is this story's own Gate 2 decision to make when created.
*   **And** unauthenticated users clicking "Report" are redirected to `/login`, mirroring Story 4.3/4.1's existing unauthenticated-redirect pattern.
*   **And**, since compact list/grid cards have limited horizontal space, the design must decide overflow-menu placement/sizing appropriate to `EventCard`'s existing layout (distinct from `EventDetailView`'s header-row placement) — a real, story-specific UI design decision, not a copy-paste of the detail-view menu.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while drafting Story 4.3. PRD 3.9.2 explicitly requires the Report trigger in both list-view and detail-view, but `EventCard.tsx` has no existing overflow-menu pattern (unlike `EventDetailView`, which Story 4.1 already built one into) and no UX artifact specifies the card-level design. The user confirmed via `AskUserQuestion` to scope Story 4.3 to detail-view only (mirroring Story 4.1's Correct-Data precedent) and split the list-view trigger off as its own focused design/implementation pass rather than absorb it into Story 4.3. Single-story UI split, lettered suffix directly off Story 4.3, matching the `1.3a`/`1.3b`/`1.6a` numbering precedent.

**Depends on:** Story 4.3, Story 4.3a.

### Story 4.3c: Extend default event-visibility rules to exclude self-reported events from list views

**As a** developer,
**I want** the events list resolver's default-visibility rule chain (Story 2.7) to exclude any event the requesting user has personally reported, of any reason and regardless of resolution status,
**So that** Discovery, Feed, Favorites, My Calendar, and search results stop surfacing events a user has already told the platform they don't want to see — closing the gap where `isHiddenForCurrentUser` (Story 4.3a) is computed correctly but only consumed by the event detail view.

**Acceptance Criteria:**

*   **Given** Story 2.7's `buildDefaultEventVisibilityConditions` (`packages/domain/src/events/buildDefaultEventVisibilityConditions.ts`) already returns an ordered list of rule-conditions AND'd into every plural `events` query (Discovery/Feed/Favorites/My Calendar/search, `resolvers.ts:1355`/`1436-1439`) — the exact extension point its own AC anticipated ("future rules... personal report-hide... can each be added as one more list entry"),
*   **When** the authenticated caller's user ID is known (unauthenticated callers have no reports and are unaffected),
*   **Then** a new rule-condition excludes any event with a `reports` row where `reporter_user_id` equals the caller's ID — any `reason` (cancelled/dangerous/personal), regardless of `status` — mirroring `isHiddenForCurrentUser`'s (Story 4.3a) existing "any report, any status" semantics exactly, implemented as a `NOT EXISTS` condition (new `QueryCondition` field/operator, or an equivalent addition to the Drizzle where-builder that consumes the DSL) rather than a post-fetch filter, consistent with Story 2.7's "never a client-side/post-fetch filter" rule.
*   **And** this rule applies only to the plural `events` list query — the singular `event(id)`/`eventBySlug(slug)` lookups (`resolvers.ts:1532`/`1548`) remain unfiltered by it, so Story 4.3's existing detail-view "you reported this" (`isHiddenForCurrentUser`) messaging keeps working for direct/deep-link access.
*   **And** no frontend change is required: list-view components already render whatever the `events` query returns, so hiding happens transparently once the resolver excludes the row.

**Note:** Added 2026-08-12 via `bmad-correct-course`. Story 2.7 built the extensible default-visibility mechanism explicitly anticipating this rule, and Story 4.3a already computes the correct "any reason, any status" hide condition as a per-event field — but no story ever connected the two for list queries, so a self-reported event kept appearing in every list view except the one page that reads `isHiddenForCurrentUser` directly. User-reported gap via `bmad-correct-course`, 2026-08-12 (see `sprint-change-proposal-2026-08-12.md`).

**Depends on:** Story 2.7, Story 4.3a.

### Story 4.4a: Add soft-delete to the events table and extend the events resolver and moderator mutations

**As a** developer,
**I want** a soft-delete column on `events` plus resolver/mutation support to exclude, restore, and permanently delete soft-deleted events,
**So that** Story 4.4's threshold-triggered removal and Story 4.7's moderator actions have real backend support, and every other epic's event queries stop surfacing removed events by default.

**Acceptance Criteria:**

*   **Given** Story 1.1's `events` table, Story 4.3a's `reports` table and `submitReport` mutation, and Story 0.22's shared `activeOnly(table)` helper exist,
*   **When** the migration script runs,
*   **Then** `events` gains only a `deletedAt: timestamp | null` column (AD-8 rule 1) — no separate `status` enum; `null`/absent means active, matching every other AD-8-bound table (`favorites`, `calendarAdditions`, `userLocations`).
*   **And** Story 1.3a's events resolver filters via `activeOnly(events)` (Story 0.22) by default on every query — not a hand-written `status`/`isNull` check; a moderator-only argument (guarded by `requireModerator`, Story 0.17) allows including soft-deleted rows, backing Story 4.7's list view.
*   **And** `submitReport` (Story 4.3a) is extended so that when a `cancelled`-reason report brings the count of unique reporters for an event to a configurable threshold (default 3) within a configurable window (default 7 days), the mutation sets that event's `deletedAt=now()` synchronously in the same call — no separate scheduled job is introduced, since the per-report check is cheap at write-time.
*   **And** a moderator-only `restoreEvent(id: ID!, action: SoftDeleteAction!): Event!` mutation is exposed per AD-8 rule 4's shared-enum shape (guarded by `requireModerator`, Story 0.17) — only the `RESTORE` direction has a live caller (Story 4.7), matching the `deleteUserLocation` precedent of an asymmetric-but-compliant mutation; the resolver still validates both transitions server-side and throws `INVALID_STATE_TRANSITION` on mismatch.
*   **And** a moderator-only `deleteEventPermanently(id: ID!): Boolean!` mutation is exposed (guarded by `requireModerator`, Story 0.17), backing Story 4.7 — this performs a genuine hard `DELETE` on the `events` row (and cascades to dependent `schedules`/`corrections`/`reports`/`favorites`/`calendarAdditions` rows), which is a **documented, named exception to AD-8's "no hard deletes on bound tables" rule** (see the Architecture Spine's AD-8 amendment, added by this sweep) rather than a soft-delete/restore-cycle mutation — it is irreversible and distinct from `restoreEvent`.

**Note:** This story exists because of Gate 1 and Gate 3 (`story-split-gate.md`), surfaced by the Epic 4 readiness sweep (`bmad-epic-readiness-check`). This is also a Gate 3 cross-epic finding: the new `deletedAt` column redefines what "visible" means for every epic that already reads events through Story 1.3a's resolver (Epic 1's listing/search/filter, Epic 2's favorites via Story 2.1a, Epic 3's feed via Story 3.7) — Story 1.3a carries a forward-reference `Note:` pointing here, since the filter itself can't be implemented until this story's migration exists. Classified as a shared data-ownership gap originating in Epic 4 (matching the Story 1.1/3.3a precedent of scoping originating tables to the epic that first needs them, not Epic 0), positioned immediately before Story 4.4.

**Correction (2026-08-11, Epic 4 readiness re-sweep):** The original AC invented a parallel `status` enum column and a bare-boolean `restoreEvent`/`deleteEventPermanently` pair, diverging from AD-8 rule 1 (single `deletedAt` field) and rule 4 (shared `SoftDeleteAction` enum shape) — re-forking the exact "each resource invents its own bespoke soft-delete mechanism" problem AD-8 rule 2 and Story 0.22's `activeOnly()` helper exist to close. Corrected to use `deletedAt` + `activeOnly(events)` and the rule-4 mutation shape for `restoreEvent`. `deleteEventPermanently` was confirmed (via `AskUserQuestion` with the user) to stay a genuine hard delete, now recorded as an explicit named AD-8 exception rather than an unremarked conflict.

**Depends on:** Story 0.17, Story 1.1, Story 1.3a, Story 4.3a.

### Story 4.4: Handle "Event Cancelled" reports

**As a** user,
**I want** events that are widely reported as "cancelled" to be removed from the public view,
**So that** I don't see inaccurate information.

**Acceptance Criteria:**

*   **Given** an event has been reported as "Cancelled" by a user,
*   **When** the number of unique users reporting the same event as cancelled reaches a configurable threshold (default: 3) within a configurable timeframe (default: 7 days),
*   **Then** the event is soft-deleted and no longer visible to regular users, via the threshold check running synchronously inside the `submitReport` mutation (Stories 4.3a, 4.4a) — no separate scheduled job.
*   **And** a moderator can view the soft-deleted event and has the option to restore it via the `restoreEvent` mutation (Story 4.4a).

**Depends on:** Story 4.3a, Story 4.4a.

### Story 4.5: Handle "Dangerous Event" reports

**As a** user who has reported a dangerous event,
**I want** moderators to be notified immediately,
**So that** they can take swift action to protect the community.

**Acceptance Criteria:**

*   **Given** a user reports an event as "Dangerous",
*   **When** the report is submitted,
*   **Then** an email notification is immediately sent to all moderators, exclusively through the outbound email adapter (Story 0.15) — never a raw SMTP/provider SDK call from feature code.
*   **And** when a moderator marks the event as safe, they have the option to ignore subsequent "Dangerous" reports from the same user for that same event, persisted via Story 4.3a's `ignoreSubsequentReports` mutation.

**Depends on:** Story 0.15, Story 4.3a.

### Story 4.6: User's Reports page

**As a** user,
**I want** to have a dedicated page where I can see the history and status of my submitted reports,
**So that** I can track the outcome of my reports.

**Acceptance Criteria:**

*   **Given** I am logged in,
*   **When** I navigate to the "My Reports" page from the user menu,
*   **Then** I see a list of all the reports I have submitted, fetched via the `myReports` query (Story 4.3a) — not directly from the database.
*   **And** for each report, I can see the reported event, the reason for the report, and the current status (e.g., "Pending", "Resolved").

**Correction (2026-08-12, via `bmad-correct-course`):** `packages/ui/src/core/status-badge.tsx`'s variant union (already extended by this story to `pending`/`upheld`/`dismissed`) must additionally support the new `auto_resolved` `ReportStatus` value (Story 4.3a's 2026-08-12 correction) so a personal report renders a real label (e.g. "Resolved") on the My Reports page instead of falling through to an unstyled/unknown badge. See `sprint-change-proposal-2026-08-12.md`.

**Depends on:** Story 4.3a.

### Story 4.7a: Build the reusable moderator route-guard

**As a** developer,
**I want** a reusable, shared guard that checks the authenticated caller's role before rendering a moderator-only page,
**So that** Story 4.7 (and any future moderator-gated page) enforces access control consistently instead of hand-rolling its own authorization check, and a non-moderator who navigates directly to a moderator URL (bypassing the already-hidden nav item) gets defined, tested behavior instead of an ad-hoc one-off check.

**Acceptance Criteria:**

*   **Given** the existing `Query.me.role` field (Story 0.17, backend) already flows to the frontend via the generated `useMeQuery` hook and is already used to hide the "Moderator Items" nav entry for non-moderators (Story 0.7/2.8), but no page anywhere in the codebase yet handles an *authenticated-but-wrong-role* visitor — every existing personal page (e.g. `/favorites`, `/reports`) only guards on `isAuthenticated`, redirecting unauthenticated visitors to `/login`,
*   **When** a moderator-gated route is visited,
*   **Then** a reusable hook (`useRequireModerator()`, `apps/web/src/features/auth/use-require-moderator.ts`) exposes a `status` of `loading` | `unauthenticated` | `unauthorized` | `authorized`, computed from `useAuthSession()` (`isLoading`, `user`) and `useMeQuery`'s `me.role`.
*   **And** consuming pages redirect on `unauthenticated` to `/login` (existing pattern, unchanged) and on `unauthorized` to `/` (home) — treating direct URL access the same as if the route did not exist for that user, consistent with the nav item already being invisible to them; no error is thrown or logged for the `unauthorized` case, since attempting the URL is not itself a client bug.
*   **And** while `status` is `loading`, `unauthenticated`, or `unauthorized`, the consuming page renders its normal route-level `<RouteLoader />` (Story 0.26) — or nothing — never the page's real content; only `status === 'authorized'` renders real content. (Revised 2026-08-12 via `bmad-create-story` Gate 2 finding: the original text only specified the `loading` render guard, leaving an unspecified render tick — after `status` flips to `unauthenticated`/`unauthorized` but before the hook's redirect effect completes navigation — where a literal `if (loading) return <RouteLoader/>; return <Content/>` consumer would flash real moderator content to a non-moderator, defeating this story's purpose. This is a one-line AC broadening, not new scope.)
*   **And** the hook has its own integration test suite (Vitest) covering all four states, independent of any one consuming page.
*   **And** Story 4.7's `/moderator/items` page is this hook's first consumer, calling it exactly once at the top of its content component. Story 4.7a's own test suite is Vitest-only (hook-level, provider-mocked) — it does **not** include a Playwright E2E, since its only consumer page doesn't exist at this story's creation/implementation time; the real end-to-end "non-moderator/unauthenticated visits `/moderator/items`" scenario is Story 4.7's own E2E scope instead (Correction, 2026-08-12: reverses Story 4.7's original assumption that 4.7a would own this E2E — confirmed via `AskUserQuestion`).
*   **And**, while implementing this story, the pre-existing role-casing bug this hook's logic would otherwise inherit is fixed: `packages/ui/src/core/app-shell/UserMenu.tsx`'s nav-visibility check compares `role === 'MODERATOR'` (uppercase), but the backend's real role values are lowercase (`userRoleEnum = pgEnum('user_role', ['user', 'moderator'])`, `packages/database/schema.ts`; `AuthenticatedUser.role: 'user' | 'moderator'`, `apps/backend/src/lib/auth/context.ts`), flowing unmodified through `Query.me.role` — meaning the "Moderator Items" nav link never actually shows for real moderators today. `UserMenu.test.tsx` masks this by testing with the literal string `'MODERATOR'` rather than a real backend value. Fixed as part of this story: `UserMenu.tsx`'s comparison corrected to lowercase `'moderator'`, and its test's mock role value corrected to match. (Found and confirmed via direct code read while drafting this story, 2026-08-12; user confirmed via `AskUserQuestion` to fix in-story rather than split off or leave noted-only, since it's the identical role-comparison concern this story's own hook implements correctly.)

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while drafting Story 4.7 via a fresh Freya-persona subagent review. No existing page in the codebase handles an authenticated-but-wrong-role visitor (only `isAuthenticated`→`/login` exists today), and this is a distinct, stateful piece of logic (loading/unauthenticated/unauthorized/authorized) that Story 4.7 would otherwise have to invent ad hoc as a byproduct of its own page — the exact failure mode this gate exists to catch, per the Story 1.3 retrospective this gate was written from. Presented to the user via `AskUserQuestion` alongside two other real Story 4.7 tradeoffs (2026-08-12): the Gate 2 subagent's own finding noted that, as of this pass, no *second* moderator-gated page exists anywhere in Epic 0-6, meaning the strict "≥2 places" reuse bar is not literally met today — the user was given the choice to build the guard inline in 4.7 instead (matching Story 4.6's precedent of declining a split without a second real consumer) or split it off now. **User chose to split it off**, prioritizing a tested, dedicated state machine for this security-relevant boundary over deferring it, even with only one current consumer. Single-story UI/architecture split, lettered suffix directly off Story 4.7, matching the `1.3a`/`1.3b`/`1.6a` numbering precedent.

**Depends on:** Story 0.17, Story 0.26, Story 2.8.

### Story 4.7: Moderator Items page

**As a** moderator,
**I want** to have a dedicated page where I can see all reported events and take action on them,
**So that** I can effectively moderate the content on the platform.

**Acceptance Criteria:**

*   **Given** I am logged in as a moderator,
*   **When** I navigate to the "Moderator Items" page from the user menu,
*   **Then** I see a list of all reported events that require my attention, fetched via the moderator-only `reportedEvents` query (Story 4.3a) — not directly from the database — and **grouped by event** (revised 2026-08-12 via `AskUserQuestion`; supersedes the query's flat per-`Report` shape for display purposes): each event with at least one `pending` report renders as one row/card, listing every report filed against it (reason, details, reporting user, status).
*   **And** for each reported event, I can see the reason(s) for the report(s) and any additional details.
*   **And** I take exactly one moderator action per event, which resolves every currently-`pending` report on that event at once, rather than resolving reports individually:
    *   **"Mark Safe" / "Restore"** (button label conditional on whether the event is currently soft-deleted) calls a new `resolveReportsForEvent(eventId: ID!): [Report!]!` mutation (guarded by `requireModerator`, this story's own new addition alongside Story 4.3a's existing `reports`-domain mutations) which, in one transaction: clears `events.deletedAt` if the event is currently soft-deleted (no separate call to Story 4.4a's `restoreEvent`), and sets every `pending` report on that event to `status: dismissed` with `resolvedByModeratorId`/`resolvedAt` stamped.
    *   **"Delete Permanently"** calls Story 4.4a's existing `deleteEventPermanently(id)` mutation as-is (unchanged) — its FK cascade (`reports.eventId` → `onDelete: cascade`) already removes all of that event's report rows in the same operation, so no separate report-resolution call is needed or meaningful.
    *   Confirmed 2026-08-12 via `AskUserQuestion`/direct code verification: `posts.isExtracted` (write-once, never reset to `false`) already prevents the deleted event's source post from being re-processed by the extraction pipeline, so `deleteEventPermanently` needs no further change to guard against re-extraction (see Story 5.1a's new Forward note for the one remaining, out-of-scope loose end).
*   **And**, independent of the event-level action above, for each *dangerous*-reason report I can additionally choose **"Ignore future reports from this user"** for that specific reporter (Story 4.3a's `ignoreSubsequentReports(reportId)` mutation) — shown once per distinct reporting user among an event's dangerous reports, since it suppresses future submissions from one user, not the event as a whole, and does not by itself resolve any report.
*   **And** I also see a separate list of pending `DefaultLocationChangeRequest` rows (status `PENDING_REVIEW`, PRD §4.14) awaiting my review, fetched via a moderator-only `pendingDefaultLocationChanges` query, gated by `requireModerator` (Story 0.17) per Architecture Spine AD-7 rule 5. Each entry also exposes the linked account's `displayName`/`platform`/`username`/`profileImageUrl` (via a new `account` field resolver on the returned type, mirroring `Report.event`'s field-resolver pattern) — added 2026-08-12 via `bmad-create-story`/`AskUserQuestion`, since the AC's literal `accountId` alone (an internal UUID) gives a moderator nothing recognizable to act on.
*   **And** for each pending change, I can see the `accountId`, `previousLocation`, and `newLocation`, and either **accept** it (setting `status: ACCEPTED`, leaving `SocialMediaAccountProfile.defaultLocation` as `newLocation`) or **revert** it (setting `status: REVERTED` and writing `SocialMediaAccountProfile.defaultLocation` back to `previousLocation`), via a `resolveDefaultLocationChange(id, action)` mutation guarded by `requireModerator`.
*   **And** the page is gated by Story 4.7a's `useRequireModerator()` guard, not a one-off check local to this page.

**Correction (2026-08-12, amended via `bmad-create-story` while drafting this story):** The reported-events list was initially decided (via `AskUserQuestion`) to render one row per individual `Report`, matching `reportedEvents`' flat per-Report return shape. The user reconsidered and requested event-grouped display instead, where a single moderator action resolves every pending report on that event at once — the AC above reflects this reconsidered, final shape; the flat per-Report decision never shipped.

**Correction (2026-08-12, via `bmad-correct-course`):** The moderator-attention `reportedEvents` query (Story 4.3a) accepts optional `status`/`reason` filters but has no enforced default. AC revised: this page's default (unfiltered-by-the-moderator) view must call `reportedEvents(status: PENDING)` explicitly, so `personal`-reason reports — which Story 4.3a's 2026-08-12 correction now auto-resolves to `auto_resolved` at submission — and any already-`upheld`/`dismissed` report never appear in the "requires my attention" list. A moderator may still explicitly filter by `reason: personal` or any `status` for audit/history purposes; only the default view is scoped. See `sprint-change-proposal-2026-08-12.md`.

**Depends on:** Story 4.3a, Story 4.4a, Story 3.3b, Story 0.17, Story 4.7a.

### Story 4.8: View archived (hidden) personal events

**As a** user,
**I want** a dedicated "Archive" page listing my favorited, calendar-added, and subscribed-account events that have been hidden by the platform's default visibility rules (expired past events, moderator soft-deletes, events I've reported for any reason — Story 4.3a's 2026-08-11 correction broadened this from personal-only, Story 4.3c wires it into list views on 2026-08-12),
**So that** I can still find and review events I have a personal connection to, even after they've dropped out of the main Feed, Discovery, Favorites, or My Calendar views.

**Acceptance Criteria:**

*   **Given** I am logged in and navigate to the "Archive" page from the user menu,
*   **When** the page loads,
*   **Then** I see events that are (a) excluded by at least one of the default visibility rules established by Story 2.7 (past-event auto-hide), Story 4.4a (moderator soft-delete), or Story 4.3a (`isHiddenForCurrentUser` — any report I've filed on the event, of any reason, per Story 4.3a's 2026-08-11 Correction) — retrieved via an explicit opt-in that bypasses the default visibility filter, scoped to authenticated owner-only access, never exposed to anonymous callers or usable to view other users' hidden events — **and** (b) are either favorited by me, added to my calendar, or sourced from a social media account I subscribe to (Epic 3).
*   **And** each entry indicates *why* it is hidden (expired / removed by moderation / hidden by me), using data already exposed by the Story 2.7/4.3a/4.4a resolvers — no new hide-reason storage is introduced by this story.
*   **And** the page reuses the existing list/infinite-scroll/card patterns (Stories 1.3b/1.3c/1.3d) rather than inventing new ones.

**Note:** Added 2026-08-06 during Story 2.7's creation, at the user's explicit request. Story 2.7 introduces the platform's first default event-visibility-hiding mechanism (built extensible for Story 4.3a/4.4a's later rules) and broadens "hide past events" from personal-lists-only to a global default across every event view, which makes a dedicated escape hatch necessary so users don't lose access to their own favorited/calendar-added/subscribed events entirely. Positioned as Epic 4's final story — after 4.3a/4.4a, which supply two of this page's three hide-reasons, and after Epic 3 (subscription data) — rather than Epic 2, since it depends on hide-reasons and subscription data neither Epic 2 nor Epic 0 have. Full UX/interaction design (empty state, "why hidden" iconography/copy, whether any unhide/restore action exists) is intentionally left to this story's own future `bmad-create-story` pass, not specified here.

**Depends on:** Story 2.7, Story 3.1a, Story 4.3a, Story 4.3c, Story 4.4a.

### Epic 5: Onboarding and Manual Event Extraction

Users are guided through the initial setup and can manually select posts for event extraction.
**FRs covered:** FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR64, FR65

### Story 5.1a: Build the manual post selection & extraction GraphQL API layer

**As a** developer,
**I want** GraphQL queries and mutations exposing a user's subscriptions (with inactive status), their subscribed accounts' posts, their remaining extraction quota, and the ability to submit selected posts for processing,
**So that** Stories 5.1-5.5 read and write manual-post-selection data through the backend API instead of the frontend querying the database or the AI Gateway adapter directly.

**Acceptance Criteria:**

*   **Given** Story 0.8's GraphQL scaffold, Story 0.17's auth context, Story 0.13's AI Gateway adapter, Story 3.1a's `social_media_account_profiles`/`subscriptions` tables, Story 3.2's `mySubscriptions` query/`removeSubscription` mutation, and Story 3.3a's `posts` table exist,
*   **When** a client requests `mySubscriptions`,
*   **Then** it returns Story 3.2's already-built active (`deletedAt IS NULL`, AD-8) subscriptions list (each including the `isNewlyAdded` flag, Story 3.2), **extended by this story** with a computed `isInactive` flag (true when no posts have been published within a configurable period, default 30 days, derived from the `posts` table's `published_at` column, Story 3.3a) — this story adds the field to Story 3.2's existing query/resolver, it does not redeclare `mySubscriptions` from scratch.
*   **And** a `postsByAccount(accountId, cursor, limit)` query returns that account's posts ordered by `publishedAt` descending (20 most recent, lazily paginated per FR52/FR53) with each post's `isExtracted` status (Story 3.3a), scoped so a caller can only query accounts they hold an active subscription to (Story 3.1a).
*   **And** a `myExtractionQuota` query returns the authenticated user's remaining extraction quota for the current billing cycle, read from the AI Gateway adapter's per-key usage tracking (Story 0.13) — this story does not reimplement usage tracking.
*   **And** a `selectPostsForExtraction(postIds: [ID!])` mutation validates server-side that the selection does not exceed `myExtractionQuota` (never trusting client-side enforcement alone, FR58), then enqueues the selected posts onto the `AIProcessingQueue` via Story 3.5's queue-producer logic — this mutation is the entry point Story 3.5 expects for manually-selected posts (PRD §3.10).
*   **And** a `markSubscriptionViewed(subscriptionId)` mutation clears that subscription's `isNewlyAdded` flag once its tab has been opened in the Manual Post Selection screen.
*   **And** Story 5.4's "remove this inactive subscription" action calls Story 3.2's already-built `removeSubscription(id, action: SoftDeleteAction!)` mutation directly — this story does not add a second/duplicate removal mutation.
*   **And** no package outside `apps/backend` writes to `subscriptions`, `social_media_account_profiles`, or `posts`, or reads AI Gateway usage-tracking state, directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 5 readiness sweep (`bmad-epic-readiness-check`) — none of Stories 5.1-5.5 had any backend API layer; each read as a pure frontend screen manipulating subscriptions/posts/quota data directly, and no mutation anywhere exposed a manual extraction-trigger endpoint. Classified as a shared data-ownership gap (consumed by Stories 5.1, 5.2, 5.3, 5.4, and 5.5), positioned immediately before Story 5.1, the first consumer — mirroring the Story 2.1a/2.3a precedent.

**Amendment (2026-08-01, Epic 3 readiness re-sweep):** `postsBySubscription(subscriptionId, ...)` renamed to `postsByAccount(accountId, ...)`. Follows from Story 3.1a: posts now belong to the shared `social_media_account_profiles` row (an account can have multiple subscribers), not to any one subscription.

**Amendment (2026-08-07, added via `bmad-create-story` while drafting Story 3.2):** `mySubscriptions` and `removeSubscription` ownership moved to Story 3.2 (resolved via `AskUserQuestion` during that story's creation) — building `/settings/subscriptions`'s list+remove view made Epic 3 need these regardless, and having Epic 5 own them would have made Epic 3's own page depend on Epic 5 existing first. This story now **extends** Story 3.2's `mySubscriptions` with `isInactive` (needs Story 3.3a's `posts` table, unavailable when Story 3.2 ships) instead of rebuilding the query, and reuses Story 3.2's `removeSubscription` mutation as-is rather than redeclaring it. Previously this story built both from scratch; the `postsBySubscription`→`postsByAccount` rename above and this ownership move are independent amendments from different sweeps.

**Forward note (2026-08-12, added via `bmad-create-story` while drafting Story 4.7):** Confirmed with the user that `posts.isExtracted` (write-once, never reset to `false` anywhere in the codebase — see `markPostExtracted()`) already prevents a permanently-deleted event's source post from ever being re-selected by the automated pipeline, since `enqueuePostForProcessing()` already throws `PostAlreadyExtractedError` server-side when `isExtracted` is true. When this story's `selectPostsForExtraction(postIds)` mutation is actually built, it must apply the identical server-side `isExtracted` guard (not merely rely on the UI disabling already-processed posts, per this AC's existing "visually disabled" language) — mirroring `enqueuePostForProcessing`'s existing precedent — so a client can't bypass the disabled checkbox and resubmit a post whose event a moderator has since permanently deleted (Story 4.7/4.4a's `deleteEventPermanently`). No schema or logic change needed in Story 4.7 itself; this is purely a heads-up for this story's own future `bmad-create-story` pass.

**Depends on:** Story 0.8, Story 0.13, Story 0.17, Story 3.1a, Story 3.2, Story 3.3a, Story 3.5.

### Story 5.1b: Build the reusable PostCard component

**As a** developer,
**I want** a reusable `PostCard` component in `packages/ui`,
**So that** we can render individual social media posts consistently with fallback images, skeletons, and selectable checkboxes across the Manual Post Selection screen and other social media-related pages.

**Acceptance Criteria:**

*   **Given** a post object conforming to the standard `Post` interface (Story 5.1a),
*   **When** the `PostCard` is rendered,
*   **Then** it displays the post's text content, publisher information (profile name/platform), and publication date formatted using the active locale.
*   **And** if a post has an image, it renders the image. If the image fails to load, it falls back to a stylized, brand-aligned visual placeholder using the `onError` image-fallback pattern (matching `EventCard`'s fallback pattern at `packages/ui/src/features/events/EventCard.tsx:155-164`).
*   **And** if no image is present, the layout adapts gracefully without leaving blank space or empty image boxes.
*   **And** the component accepts an `isSelected: boolean` prop and an `onSelectionChange: (selected: boolean) => void` callback. Renders a checkbox at the top-right corner; clicking the checkbox triggers `onSelectionChange`.
*   **And** the component accepts a `disabled` prop. If true, the card is visually greyed out, the checkbox is disabled, and clicking the card is a no-op (used for already-extracted posts, Story 5.3).
*   **And** a companion `PostCardSkeleton` component is provided to represent the loading state of the card, minimizing CLS during lazy load.
*   **And** the component is created inside `packages/ui/src/features/posts/PostCard.tsx` (not `apps/web`), ensuring it contains no React Query or GraphQL-client imports and is fully pure and reusable.

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced during drafting of Story 5.1 via a fresh Freya/Winston-persona subagent review. Splitting `PostCard` as a reusable component ensures dedicated focus on post rendering, image fallback robust error-handling, skeletons, and selectable checkbox interactions before the main screen is wired. Single-story UI split, lettered suffix off Story 5.1.

**Depends on:** Story 5.1a.

### Story 5.1: Manual post selection screen

**As a** user,
**I want** a screen where I can see the most recent posts from my subscribed accounts,
**So that** I can choose which posts to process for event extraction.

**Acceptance Criteria:**

*   **Given** I am on any page in the application,
*   **When** I navigate to the "Manual Post Selection" screen from the user menu,
*   **Then** if I have not provided an API key or subscribed to any accounts, I am guided through the process of doing so.
*   **And** if I have at least one subscribed account, I see a tab for each of my subscribed accounts, fetched via the `mySubscriptions` query (Story 5.1a) — not directly from the database.
*   **And** each tab displays the 20 most recent posts from that account, fetched via the `postsByAccount(accountId, cursor, limit)` query (Story 5.1a).
*   **And** posts are loaded lazily to improve performance.

**Depends on:** Story 5.1a, Story 5.1b.

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
*   **And** submitting my selection calls the `selectPostsForExtraction` mutation (Story 5.1a), which enqueues the chosen posts onto the `AIProcessingQueue` (Story 3.5) — not a direct database write or queue call from `apps/web`.

**Depends on:** Story 5.1a.

### Story 5.3: Display and enforce API quota

**As a** user,
**I want** to see how many posts I can select for extraction based on my API quota, and see which posts have already been processed,
**So that** I can manage my API usage effectively and avoid redundant extractions.

**Acceptance Criteria:**

*   **Given** I am on the "Manual Post Selection" screen,
*   **When** I select posts for extraction,
*   **Then** a summary bar displays the number of selected posts against my remaining API quota, read from the `myExtractionQuota` query (Story 5.1a).
*   **And** I am prevented from selecting more posts than my quota allows, enforced both client-side (UX) and authoritatively server-side by the `selectPostsForExtraction` mutation (Story 5.1a) — the client-side check is a convenience only.
*   **And** posts that have already been processed are visually disabled and cannot be selected, using each post's `isExtracted` field from the `postsByAccount` query (Story 5.1a).

**Depends on:** Story 5.1a.

### Story 5.4: Inactive account warning

**As a** user,
**I want** to see a warning for my subscribed accounts that have become inactive,
**So that** I can manage my subscriptions effectively.

**Acceptance Criteria:**

*   **Given** I am on the "Manual Post Selection" screen,
*   **When** a subscribed account has not published any posts within a configurable period (e.g., 30 days), read via the `isInactive` field on `mySubscriptions` (Story 3.2, extended by Story 5.1a),
*   **Then** a warning icon is displayed on the account's tab.
*   **And** the tab's content shows a warning message and a button to remove the inactive subscription, which calls the `removeSubscription` mutation (Story 3.2) — not a direct database write from `apps/web`.

**Depends on:** Story 5.1a.

### Story 5.5: Integrate manual post selection into the getting started wizard

**As a** new user,
**I want** to be prompted to select posts for extraction immediately after subscribing to new accounts in the getting started wizard,
**So that** I can get events into my feed right away.

**Acceptance Criteria:**

*   **Given** I am in the getting started wizard,
*   **And** I have just added a new subscription,
*   **When** I complete the subscription step,
*   **Then** I am taken to the "Manual Post Selection" screen.
*   **And** the tab for the newly added subscription is automatically activated, using the `isNewlyAdded` flag surfaced by the `mySubscriptions` query (Story 3.2, extended by Story 5.1a); the flag is cleared via `markSubscriptionViewed` (Story 5.1a) once the tab is opened.

**Depends on:** Story 3.2, Story 5.1a.

### Story 5.6: On-demand scraping trigger for manual post selection

**As a** user on the Manual Post Selection screen,
**I want** a "Scrape Posts" button that checks a subscribed account for new posts right now, instead of waiting for the once-daily batch,
**So that** I'm not stuck looking at an empty or stale post list for an account I specifically came here to extract events from.

**Acceptance Criteria:**

*   **Given** I am on the "Manual Post Selection" screen (`/posts/select`) viewing a subscribed account's tab,
*   **When** the active account has zero posts ever scraped,
*   **Then** I see a "Scrape Posts" call-to-action in the empty state, and clicking it triggers the same initial-scrape cascade Story 3.1/3.2's subscribe flow already uses for a brand-new account (Apify async trigger → Bright Data async trigger fallback (Instagram) → SQS enqueue fallback), extracted into a shared `triggerScrapeForAccount` function so it is not duplicated.
*   **And**, when the active account already has posts, a persistent "Scrape Posts" control (near the tab bar) triggers the same cascade, but scoped to only posts newer than that account's most recent scraped post (`MAX(posts.publishedAt)`), not a full re-scrape.
*   **And** both branches are decided and executed server-side by a new `triggerAccountScrape(accountId: ID!): TriggerAccountScrapeResult!` mutation (Story 5.1a's GraphQL layer is extended, not rebuilt) — scoped so a caller can only trigger a scrape for an account they hold an active subscription to, mirroring `postsByAccount`'s existing ownership check.
*   **And** while a triggered scrape is still in flight for that account (a new server-computed `SocialMediaAccountProfile.isScrapeInProgress` field, derived from a new `scrapeTriggeredAt` timestamp vs. the existing `lastScrapedAt`), the "Scrape Posts" control is disabled with a label explaining why, and the mutation itself rejects a redundant trigger server-side (`SCRAPE_ALREADY_IN_PROGRESS`) rather than relying on the disabled button alone.
*   **And** the page polls for completion (bounded, ~60s) and automatically refetches the account's posts as soon as `isScrapeInProgress` clears, rather than requiring a manual page reload; on timeout it stops polling and shows a "still processing" message instead of polling forever.
*   **And** if the shared Apify/Bright Data provider capacity is exhausted, the mutation surfaces the existing `SCRAPER_CAPACITY_EXCEEDED` error code (Story 3.4/3.2's existing pattern) rather than a new error shape.

**Note (2026-08-19, added via `bmad-create-story` at user request):** This story postdates `epic-5-readiness.md`'s 2026-08-12 sweep (`stories_covered: 5.1-5.5` only) and was not anticipated by it — Gate 1/2/3 were run fresh rather than cited from the sweep, per the project's lightweight escape-hatch guard. All three: **no gap** (see the story file's Architecture & UX Gate Findings for the full Winston/Freya verdicts) — this reuses 100% of the scraping infrastructure Stories 3.4/3.4a/3.4d/3.4f already built (no new external service, queue, Lambda, or webhook route), and the UI is a single low-complexity control with no second consumer, built inline rather than split into `packages/ui`. The trigger cascade currently inlined once in `subscribeToAccount` (Story 3.1a) is extracted into a shared `triggerScrapeForAccount` function so this story's mutation and the existing subscribe-time trigger share one implementation instead of duplicating it.

**Depends on:** Story 5.1a, Story 5.1, Story 5.2, Story 3.3a, Story 3.4, Story 3.4a.

### Epic 6: Community Voting and Embeddable Distribution

Users who can't or don't want to provide a BYOK API key can still register demand for a social media account, and any site can embed FestDaily's event discovery as a public widget.
**FRs covered:** FR69, FR70, FR71, FR72, FR73, FR74, FR75, FR76, FR77, FR78, FR79, FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR88

### Story 6.1a: Build the account-vote backend GraphQL API layer

**As a** developer,
**I want** an `account_votes` table plus GraphQL mutations/queries for casting, withdrawing, ranking, and autocomplete-suggesting voted social media accounts — including the account-creation path for a not-yet-profiled account,
**So that** Stories 6.1-6.4 read and write vote data through the backend API instead of the frontend querying the database or scraper adapters directly.

**Acceptance Criteria:**

*   **Given** Story 0.17's auth context, Story 3.1a's `social_media_account_profiles`/`subscriptions` tables, and Story 3.3c's `ScraperAdapter` interface (amended below to add `lookupAccountProfile`) exist, **when** the migration script runs, **then** an `account_votes` table (PRD §4.15) is created: `id` (uuid pk), `user_id` (FK to users), `account_id` (FK to `social_media_account_profiles`), `created_at`, `deleted_at` (nullable, AD-8), unique on (`user_id`, `account_id`) — re-voting after a withdrawal clears `deleted_at` on the existing row rather than inserting a new one, per PRD §4.15.
*   **And** a `castVote(input: CastVoteInput!): AccountVote!` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17). `CastVoteInput` accepts either an existing `accountId` (uuid) or a `{ platform, handleOrUrl }` pair for a not-yet-profiled account. For the latter path, the resolver: (a) confirms `platform` is scrapeable via Story 3.3c's registry — a local membership check, no adapter call; (b) calls Story 3.3c's (amended) `ScraperAdapter.lookupAccountProfile(platform, handleOrUrl)` to fetch the platform-native `accountId`/`displayName`/`username` (existence-check + public metadata only — never a post scrape or AI extraction, PRD §3.13); (c) passes the result through Story 3.1a's existing lookup-or-create logic to get-or-create the `social_media_account_profiles` row (matched by `platform`+`accountId`, never by handle text); (d) inserts/reactivates the caller's `account_votes` row against that profile's internal `id`. An unscrapeable platform or a failed lookup (account doesn't exist on the platform) returns a `GraphQLError` (`BAD_REQUEST`) rather than creating a placeholder profile.
*   **And** re-casting a vote for an account the caller already actively voted for is a no-op returning the existing `AccountVote` (idempotent), not a duplicate-key error.
*   **And** a `withdrawVote(id: ID!, action: SoftDeleteAction!): AccountVote!` mutation (AD-8 rule 4 shape) soft-deletes the caller's own vote — ownership is verified against `context.user`, never a client-supplied user ID — and an attempt to withdraw an already-withdrawn vote throws `INVALID_STATE_TRANSITION`, matching `removeSubscription`/`deleteApiKey` precedent.
*   **And** a `rankedVoteAccounts(nearMe: Boolean, locationPreferenceId: ID): [RankedAccountVote!]!` query returns every voted account ordered by active (non-soft-deleted) vote count descending, each entry carrying the account's `SocialMediaAccountProfile` fields and its vote count; accounts with at least one active `Subscription` (any tier, `activeOnly(subscriptions)`, Story 0.22) are excluded from the ranking (PRD §3.13 "Leaving the Vote List" / FR76) — this is a **read-time filter** joining `subscriptions`, not a write-time side effect on Story 3.1/3.2's `subscribeToAccount`/`removeSubscription` mutations, which remain unchanged.
*   **And** when `nearMe: true` and `locationPreferenceId` references one of the caller's own active `UserLocationPreference` rows (Story 2.3a, ownership-checked), the ranking is re-weighted to favor accounts with more votes from users whose own saved location is geographically close to the caller's, using the same `ST_DWithin`/haversine distance technique already established for AD-1's `withinRadius` operator (Story 2.5a) — reused directly in this hand-written query, not via the Unified Query DSL, since `AccountVote` is not an event-query resource. No voter's location is ever returned or attributable to a specific account in the response — only the resulting weighted order.
*   **And** a `voteRegionBreakdown(accountId: ID!): [RegionVoteBucket!]!` query returns that account's active voters bucketed by city/province (never raw coordinates), each bucket carrying a `label` and `voterCount`; any bucket with fewer than 5 distinct voters is **omitted from the response entirely** (never returned with a suppressed/zeroed count) rather than filtered client-side, so a small bucket's near-identifiable count never leaves the backend, per NFR26. Bucketing a voter's `UserLocationPreference` into a city/province label is resolved via a new `resolveAdminRegion(coordinates): { city, province }` export added to Story 0.16's Geolocation adapter, which extracts the city/state fields already present in Geoapify's cached geocode response (`geolocation_cache.result`, Story 0.16) rather than issuing a new external API call for a location already resolved once — scoped as an AC here rather than its own story since this story is its only consumer and the change is small/additive on an already-`review`-status adapter, mirroring the size/precedent of Story 2.4b's single-AC extension of the same adapter.
*   **And** a `votedAccountSuggestions(query: String): [RankedAccountVote!]!` query returns active, not-yet-subscribed voted accounts (same exclusion rule as `rankedVoteAccounts`) matching a partial `platform`/`username`/`displayName` search, ordered by vote count — this is the query Story 6.4's subscribe-form autocomplete consumes, `requireAuth`-scoped since it's only reachable from within the authenticated subscribe flow.
*   **And** no package outside `apps/backend` writes to `account_votes` or calls `ScraperAdapter.lookupAccountProfile` directly.

**Note:** Classified as a shared data-ownership gap by the Epic 6 readiness sweep (`bmad-epic-readiness-check`) — Gate 1 found none of Stories 6.1-6.4 had a backend API layer, mirroring the Story 2.1a/3.1a/4.1a/5.1a precedent of splitting a consolidated backend-layer story ahead of an epic's first feature area. Positioned as the first story in Epic 6, before Story 6.1 (first consumer). The `lookupAccountProfile` adapter method it depends on is a Gate 3 cross-epic-reuse finding — see the accompanying Amendment to Story 3.3c and `epic-readiness/epic-6-readiness.md` for the full analysis (the same capability was already flagged as needed-but-unbuilt by Story 3.4's 2026-08-07 Forward note, for Story 3.1/3.2's subscribe forms).

**Depends on:** Story 0.8, Story 0.16, Story 0.17, Story 0.22, Story 2.3a, Story 2.5a, Story 3.1a, Story 3.3c (amended), Story 3.4 (≥1 concrete `lookupAccountProfile` implementation).

### Story 6.1: Vote for a social media account

**As a** user,
**I want** to cast a vote for a social media account I'd like to see subscribed — either an existing entry or one I add myself,
**So that** I can register demand for it even without a BYOK Gemini API key.

**Acceptance Criteria:**

*   **Given** I am authenticated and viewing the ranked vote list (Story 6.2),
*   **When** I vote for an existing account,
*   **Then** my vote is recorded via the `castVote` mutation (Story 6.1a) and the account's rank updates to reflect the new count.
*   **And** when I instead enter a new account not yet in the system (selecting its platform and providing its handle/URL),
*   **Then** `castVote` (Story 6.1a) validates the platform against the scraper adapter registry (Story 3.3c), resolves the account's `accountId`/`displayName`/`username` via the registry's `lookupAccountProfile` method (Story 3.3c amendment, Story 3.4's concrete implementation) — never from placeholder handle text — and creates the `SocialMediaAccountProfile` record my vote is recorded against.
*   **And** if the platform is unsupported or the account can't be found on the platform, I see an error and no vote/profile is created.
*   **And** re-voting for an account I've already actively voted for does not create a duplicate vote or error — it's a no-op.
*   **And** casting a vote does not require or consume any BYOK API key quota.

**Depends on:** Story 6.1a.

### Story 6.2: View the ranked vote list

**As a** user,
**I want** to see social media accounts ranked by vote count, optionally weighted toward accounts popular near me,
**So that** I can see what's currently in demand.

**Acceptance Criteria:**

*   **Given** I navigate to the vote list,
*   **When** the page loads,
*   **Then** I see every voted, not-yet-subscribed account ranked by vote count descending, fetched via `rankedVoteAccounts` (Story 6.1a).
*   **And** I can toggle a "Near Me" view, which re-weights the ranking using one of my saved locations (Story 2.3a), without ever displaying or persisting any voter's individual location (PRD §3.13, NFR26).
*   **And** a per-account region breakdown, when I open it, shows vote counts bucketed by city/province (`voteRegionBreakdown`, Story 6.1a); any region with fewer than 5 distinct voters is simply absent from the results, not shown as a small/zeroed count.
*   **And** an account is not shown in this list once any user has an active subscription to it (Story 3.1/3.2) — it becomes visible again if that subscription is later removed, with its prior vote count intact.

**Depends on:** Story 6.1a.

### Story 6.3: Withdraw a vote

**As a** user,
**I want** to withdraw a vote I previously cast,
**So that** I can change my mind about which accounts I'm registering demand for.

**Acceptance Criteria:**

*   **Given** I have an active vote for an account,
*   **When** I choose to withdraw it,
*   **Then** `withdrawVote` (Story 6.1a) soft-deletes my vote (AD-8) and the account's rank decrements accordingly.
*   **And** attempting to withdraw an already-withdrawn vote returns an `INVALID_STATE_TRANSITION` error rather than silently no-op'ing.
*   **And** I can re-vote for the same account afterward (Story 6.1), which reactivates my existing vote row rather than creating a new one.

**Depends on:** Story 6.1a.

### Story 6.4: Autocomplete voted accounts when subscribing

**As a** user,
**I want** voted accounts to appear as suggestions when I'm adding a BYOK subscription,
**So that** I can easily subscribe to an account that's already in demand.

**Acceptance Criteria:**

*   **Given** I have at least one Gemini API key and am on the subscribe form (Story 3.1/3.2),
*   **When** I start typing a platform/handle/display name,
*   **Then** I see matching, not-yet-subscribed voted accounts as ranked suggestions, fetched via `votedAccountSuggestions` (Story 6.1a).
*   **And** selecting a suggestion pre-fills the subscribe form with that account's known details rather than requiring me to re-enter them.
*   **And** subscribing to a suggested account still goes through the existing `subscribeToAccount` mutation (Story 3.1/3.2) unchanged — this story only adds a suggestion source to an existing form, it does not alter how a subscription is created.

**Note:** This story reopens Story 3.1/3.2's subscribe form UI, which is already `review`/`ready-for-dev` — flagged by the Epic 6 readiness sweep as a real sequencing risk. Confirm Story 3.1/3.2's current status before starting this story.

**Depends on:** Story 6.1a, Story 3.1, Story 3.2.

### Story 6.5a: Build the widget-config backend GraphQL API layer

**As a** developer,
**I want** a `widgets` table plus GraphQL mutations to create/update/delete a widget configuration and a public query to read one for rendering,
**So that** a widget is a persisted, independently-editable entity with a stable id — not filters serialized into a URL — and Story 6.6a's `embed_domains` table has a table to reference instead of hanging a whitelist off the owning user directly.

**Acceptance Criteria:**

*   **Given** Story 0.17's auth context exists, **when** the migration script runs, **then** a `widgets` table (PRD §4.16) is created: `id` (uuid pk), `owner_user_id` (FK to users), `filters` (jsonb — the same filter shape the main discovery page's query params already express, Sections 3.1/3.5/3.7), `display_mode` (enum: `CARD`/`CALENDAR`), `theme` (enum: `DARK`/`LIGHT`), `created_at`, `deleted_at` (nullable, AD-8).
*   **And** a `createWidget(input: CreateWidgetInput!): Widget!` mutation is exposed, scoped to `context.user` via `requireAuth` — `filters` is validated (AJV) against the same filter shape the main discovery Unified Query DSL (AD-1) accepts, rejecting anything that wouldn't also be a valid discovery-page query.
*   **And** an `updateWidget(id: ID!, input: UpdateWidgetInput!): Widget!` mutation lets the owner change `filters`/`displayMode`/`theme` on an existing widget — ownership verified against `context.user` — and the change is reflected the next time the widget route (Story 6.7) is requested, with no action required from any site that already embedded it (PRD §3.14 "Editing a widget's configuration later updates every embed of it automatically").
*   **And** a `deleteWidget(id: ID!, action: SoftDeleteAction!): Widget!` mutation (AD-8 rule 4 shape) soft-deletes a widget the caller owns, with the same `INVALID_STATE_TRANSITION` handling as `removeSubscription`/`deleteApiKey` for an already-deleted widget.
*   **And** a `myWidgets` query returns the caller's active widgets for the generator screen (Story 6.5) and domain-management screen (Story 6.6).
*   **And** a **public, unauthenticated** `widgetById(id: ID!): Widget!` query returns an active widget's `filters`/`displayMode`/`theme` for the widget route (Story 6.7) to render — returns a "not found"-shaped result (not an error leaking existence/ownership details) for a soft-deleted or unknown id.
*   **And** no package outside `apps/backend` writes to `widgets` or reads it to decide what to render — Story 6.7's page reaches this data exclusively through `widgetById`.

**Note:** Added during PRD review (post-Epic-6-readiness-sweep) when the widget model changed from stateless query-param filters to a persisted entity — this is the shared data-ownership gap that decision creates: both Story 6.5 (the generator, writes) and Story 6.6a's `embed_domains` (which now FKs `widgetId` instead of `ownerUserId`) and Story 6.7 (reads for rendering) need a `widgets` table that no story built. Positioned before Story 6.5, the first consumer, mirroring the Story 2.1a/3.1a/4.1a/5.1a/6.1a/6.6a precedent.

**Depends on:** Story 0.8, Story 0.17, Story 0.22.

### Story 6.5: Configure and generate a widget embed

**As a** registered user,
**I want** to create and edit a widget by filters, display mode, and theme, and get a ready-to-use embed snippet,
**So that** I can embed FestDaily's event discovery on another site and update it later without re-embedding anywhere.

**Acceptance Criteria:**

*   **Given** I am on the embed generator screen,
*   **When** I choose any combination of filters (social media account, event type, category, keyword, location/coordinates + radius — Sections 3.1/3.5/3.7 filters), a display mode (card or calendar), and a theme (dark or light), and save,
*   **Then** a `Widget` is created via `createWidget` (Story 6.5a) and I see a live preview of the resulting widget.
*   **And** I can return later and edit any of my widgets (`myWidgets`/`updateWidget`, Story 6.5a) — the change takes effect on every existing embed of it without me having to re-paste anything anywhere.
*   **And** I receive two embed forms for a saved widget: (1) a **script + placeholder snippet** — `<div data-festdaily-widget-id="{id}"></div>` plus one shared `<script async src=".../embed.js"></script>` — presented as the recommended option; and (2) a **raw iframe URL** (`.../widget/{id}`) as a fallback for embedding contexts that strip `<script>` tags but allow iframes.
*   **And** `embed.js` (served as a static asset) waits for the DOM to be ready, then finds every element on the page carrying `data-festdaily-widget-id` (`querySelectorAll`, not a single lookup — supporting multiple different widgets embedded on one page from a single script include) and inserts an iframe pointing at `.../widget/{id}` into each, wiring up the `postMessage` height-reporting handshake (Story 6.7) so the iframe auto-resizes without the embedder writing any listener code themselves.
*   **And** generating a widget and its snippet does not require me to have already registered an embedding domain pattern (Story 6.6) for it — domain registration is enforced at render time (Story 6.7a), not at generation time, so I can build and preview a widget before deciding where to allow it.

**Depends on:** Story 6.5a.

### Story 6.6a: Build the embed-domain backend GraphQL API layer

**As a** developer,
**I want** an `embed_domains` table, scoped per-widget rather than per-owner, plus GraphQL mutations to register/deregister a domain pattern (validated against a Public Suffix List) and a public query to check whether a given widget may be embedded from a given origin,
**So that** Story 6.6's domain-management screen and Story 6.7a's widget CSP middleware both read/write embed-domain data through the backend API instead of the frontend (or Next.js Middleware) touching the database directly, and each widget carries independent embedding restrictions rather than sharing one whitelist across everything an owner creates.

**Acceptance Criteria:**

*   **Given** Story 6.5a's `widgets` table exists, **when** the migration script runs, **then** an `embed_domains` table (PRD §4.17) is created: `id` (uuid pk), `widget_id` (FK to `widgets`), `pattern` (text, not null), `created_at`, `deleted_at` (nullable, AD-8) — no `owner_user_id` column; ownership for management purposes flows through `widgets.owner_user_id` via the `widget_id` FK, matching PRD §4.17.
*   **And** a `registerEmbedDomain(widgetId: ID!, pattern: String!): EmbedDomain!` mutation is exposed, scoped to `context.user` via `requireAuth` — ownership of `widgetId` is verified against `context.user` before any write. `pattern` must be either an exact hostname or a wildcard of the exact shape `*.<hostname>` (rejected otherwise); both forms are normalized (lowercased, scheme/path/trailing-slash stripped) server-side before storage. When `pattern` is a wildcard, its suffix (everything after `*.`) is checked against a Public Suffix List (the `tldts` package — actively maintained, ships PSL data, no external API call per check) and the mutation throws a `GraphQLError` (`BAD_REQUEST`, with a message naming the offending suffix) if the suffix is itself a public suffix or one level above it (e.g. rejects `*.vercel.app`, `*.github.io`, `*.co.uk`) — this is the check that prevents whitelisting every unrelated tenant on a shared-hosting platform. Exact-hostname patterns (including `localhost:<port>` style dev entries) are never subject to the PSL check, since they don't expand to cover anything beyond themselves.
*   **And** a `deregisterEmbedDomain(id: ID!, action: SoftDeleteAction!): EmbedDomain!` mutation (AD-8 rule 4 shape) soft-deletes a pattern belonging to a widget the caller owns — ownership verified against `context.user` via the pattern's `widget_id`, never a client-supplied user ID — with the same `INVALID_STATE_TRANSITION` handling as `removeSubscription`/`deleteApiKey` for an already-deregistered pattern.
*   **And** an `embedDomainsForWidget(widgetId: ID!)` query returns a caller-owned widget's active (`activeOnly(table)`, Story 0.22) registered patterns for Story 6.6's management screen — ownership-scoped, not a global list.
*   **And** a **public, unauthenticated** `isOriginAllowedForWidget(widgetId: ID!, origin: String!): Boolean!` query normalizes `origin` to a bare hostname the same way `registerEmbedDomain` does, then returns whether that hostname matches any of the given widget's active patterns — an exact match against an exact-hostname pattern, or a suffix match (`origin` ends with the pattern's hostname, on a label boundary — i.e. `sub.acmecorp.com` matches `*.acmecorp.com` but `evilacmecorp.com` does not) against a wildcard pattern. This is the sole read Story 6.7a's widget CSP middleware calls; it never returns which patterns are registered or who registered them, only a boolean, since it is reachable by any unauthenticated request.
*   **And** `isOriginAllowedForWidget` carries negligible additional query-cost risk under the project-wide GraphQL depth/complexity limits (Story 0.8) despite being public, since it takes no nested selection.
*   **And** no package outside `apps/backend` writes to `embed_domains`, imports the PSL library, or reads this data to make a framing/security decision — Story 6.7a's middleware reaches it exclusively through `isOriginAllowedForWidget`, never a direct database query from `apps/web`.

**Note:** Classified as a shared data-ownership gap by the Epic 6 readiness sweep — Gate 1 found Story 6.6 (register/manage domains) and Story 6.7 (public widget page, via its CSP enforcement) both need `EmbedDomain` data, but no story builds the table or its API surface. Positioned before Story 6.6, the first consumer, mirroring the Story 2.1a/3.1a/4.1a/5.1a/6.1a precedent — split from Story 6.1a rather than combined with it, since `AccountVote` and `EmbedDomain` are unrelated data domains with disjoint consumer story sets (6.1-6.4 vs. 6.6-6.7) and disjoint technical shapes (authenticated CRUD+ranking vs. a public boolean check consumed from Next.js Middleware, not a React data-fetching hook) — bundling them would repeat the exact "two unrelated concerns forced into one story" failure this gate exists to prevent. Mirrors Epic 4's precedent of splitting backend-layer stories by data domain (4.1a/4.3a/4.4a) rather than one-per-epic.

**Amendment (PRD review, post-sweep):** Rescoped from per-owner (`ownerUserId` on `EmbedDomain` directly) to per-widget (`widgetId` FK into the new Story 6.5a `widgets` table), and domain matching changed from implicit subdomain inclusion to explicit wildcard patterns with Public Suffix List validation — see PRD §3.14/§4.17 for the full rationale (prevents one widget's whitelist bleeding into another's, and prevents whitelisting shared-hosting domains like `*.vercel.app`). `isEmbedDomainAllowed(domain)` renamed `isOriginAllowedForWidget(widgetId, origin)` accordingly — the check is now "may *this* widget render on this origin," not a global per-owner check.

**Depends on:** Story 0.8, Story 0.17, Story 0.22, Story 6.5a.

### Story 6.6: Register and manage embed domains

**As a** registered user,
**I want** to register the domain pattern(s) a specific widget of mine is allowed to be embedded on, and deregister ones I no longer use,
**So that** I control where each of my widgets is allowed to render, independently of any other widget I own.

**Acceptance Criteria:**

*   **Given** I am on a widget's domain management screen (reached from that widget in Story 6.5's generator — this is per-widget, not a single account-wide list),
*   **When** I register a new pattern — either an exact hostname or an explicit `*.hostname` wildcard,
*   **Then** it's saved via `registerEmbedDomain` (Story 6.6a) and appears in this widget's pattern list, normalized to a canonical form.
*   **And** if I submit a wildcard pattern that the backend rejects as covering a shared-hosting/public-suffix domain, I see a clear error naming the problem rather than a generic failure.
*   **And** I can deregister a pattern on this widget, which calls `deregisterEmbedDomain` (Story 6.6a, soft-delete, AD-8) and immediately revokes that pattern's embedding access for this widget only (Story 6.7a reads this on every widget request) — it has no effect on any other widget I own.
*   **And** I only ever see and manage patterns on widgets I own myself (`embedDomainsForWidget`, Story 6.6a, ownership-checked) — never another user's widget.

**Depends on:** Story 6.6a, Story 6.5a.

### Story 6.7a: Build the widget's dynamic frame-ancestors CSP middleware

**As a** developer,
**I want** `apps/web`'s existing Next.js Middleware extended to detect requests to the widget route and set a per-request `Content-Security-Policy: frame-ancestors` header scoped to that request's registered embedding domain, composed alongside (not replacing) the existing next-intl locale-routing middleware,
**So that** Story 6.7's public widget page can actually be embedded only by domains registered via Story 6.6, without any other route in the app inheriting a relaxed or dynamic framing policy.

**Acceptance Criteria:**

*   **Given** `apps/web/middleware.ts` currently runs only `next-intl`'s `createMiddleware(routing)` against a matcher excluding `api`/`_next`/`_vercel`/static-asset paths, **when** this story ships, **then** the matcher/handler is extended (not replaced) so that requests matching the widget route (`/[locale]/widget/[widgetId]`) run an additional, widget-specific step before or after the existing next-intl step, and all other routes' behavior is provably unchanged (existing locale-routing tests continue passing unmodified).
*   **And** for a widget-route request, the middleware extracts `widgetId` from the request path, reads the requesting page's `Origin` header (falling back to parsing `Referer` when `Origin` is absent), and calls the backend's `isOriginAllowedForWidget(widgetId, origin)` query (Story 6.6a) via an edge-compatible `fetch` to the GraphQL endpoint — this is the one sanctioned way this middleware learns which patterns are registered for *this specific widget*; it never queries the database directly (Gate 1) and never bundles/imports `apps/backend`'s Drizzle layer into `apps/web`.
*   **And** when the calling domain is registered and active, the response sets `Content-Security-Policy: frame-ancestors https://<domain>` (or omits/uses `'none'` when no `Origin`/`Referer` is present, e.g. a direct navigation to the widget URL, which is allowed to render standalone but not to be framed by an unlisted origin) — scoped via the response object this middleware step returns, never mutating global response headers applied to non-widget routes.
*   **And** when the calling domain is not registered (or the backend call fails/times out), the response sets `Content-Security-Policy: frame-ancestors 'none'` — a fail-closed default, so a backend outage narrows embedding access rather than silently widening it.
*   **And** every non-widget route's response is verified (integration test) to carry no `frame-ancestors` header from this mechanism at all — this story's change is provably isolated to the widget route, per the PRD's Security NFR ("the rest of the application's framing protection is unaffected").
*   **And** the backend call's failure characteristics are covered by a test asserting the fail-closed behavior under a simulated backend timeout/error.

**Note:** Classified as a Gate 1 finding by the Epic 6 readiness sweep, scoped as a single-story architecture split rather than an Epic 0 foundation — no other route or epic in this codebase has, or is expected to have, a per-request, DB-state-driven dynamic security-header requirement (the rest of the app's framing/CSP posture is static, per PRD §5 Security), so this does not clear Gate 3's ≥2-independent-consumers reuse bar the way Stories 0.13/0.15/0.16/0.17 did — it stays Epic-6-scoped. Still split into its own story (rather than folded into Story 6.7's page-building AC) because it is genuinely new infrastructure for this codebase (`apps/web/middleware.ts` today is a pure, local, zero-network-call locale router) and because Next.js supports exactly one middleware file per app, meaning this change necessarily touches and must compose cleanly with already-shipped next-intl routing logic. Positioned immediately before Story 6.7, its sole consumer.

**Depends on:** Story 6.6a, Story 6.5a.

### Story 6.7: Public widget rendering page

**As a** site visitor,
**I want** to see FestDaily events rendered inside an embedded widget on the site I'm visiting,
**So that** I can discover events without leaving that site.

**Acceptance Criteria:**

*   **Given** a widget embedded via Story 6.5's script+placeholder snippet (or its raw-iframe fallback) is loaded on a domain registered for that widget (Story 6.6, enforced by Story 6.7a's middleware),
*   **When** the `/widget/{widgetId}` route loads,
*   **Then** it fetches the widget's persisted configuration via the public `widgetById` query (Story 6.5a) and renders that filter combination using the existing `EventListView` (card mode, Story 1.3d) or `WeeklyCalendarView` (calendar mode, Story 1.3g) components as-is, in the widget's configured dark/light theme, with a fully transparent background — the page reads its config from `widgetId`, not from its own URL query parameters.
*   **And** an unknown or soft-deleted `widgetId` renders an empty/removed state, not an error page or a leak of whether the id ever existed.
*   **And** clicking an event does not open a detail view or navigate away — the only interaction available is adding it to my own calendar via one-way `.ics` export (Story 2.1b).
*   **And** a small "Powered by FestDaily" button is always visible and opens the main FestDaily app.
*   **And** the page posts its rendered content height to the parent frame via `postMessage` on load and on any subsequent height change — this is the message Story 6.5's `embed.js` listens for to auto-size the iframe it created; a visitor using the raw-iframe fallback snippet must wire this listener themselves.
*   **And** when loaded from a domain not registered for this `widgetId` (or not currently active), the request is refused per Story 6.7a's fail-closed CSP middleware — this page itself performs no separate domain check, since enforcement happens at the HTTP layer before this page's content is ever requested cross-origin.

**Depends on:** Story 6.5a, Story 6.6a, Story 6.7a, Story 1.3d, Story 1.3g, Story 2.1b.
