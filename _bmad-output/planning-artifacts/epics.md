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
  "docs/infrastructure.md"
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

- FR1: Epic 2 - Core App and Event Discovery
- FR2: Epic 2 - Core App and Event Discovery
- FR3: Epic 2 - Core App and Event Discovery
- FR4: Epic 2 - Core App and Event Discovery
- FR5: Epic 3 - User Personalization
- FR6: Epic 3 - User Personalization
- FR7: Epic 3 - User Personalization
- FR8: Epic 3 - User Personalization
- FR9: Epic 3 - User Personalization
- FR10: Epic 3 - User Personalization
- FR11: Epic 3 - User Personalization
- FR12: Epic 3 - User Personalization
- FR13: Epic 2 - Core App and Event Discovery
- FR14: Epic 2 - Core App and Event Discovery
- FR15: Epic 3 - User Personalization
- FR16: Epic 3 - User Personalization
- FR17: Epic 3 - User Personalization
- FR18: Epic 4 - Social Media Event Integration
- FR19: Epic 4 - Social Media Event Integration
- FR20: Epic 4 - Social Media Event Integration
- FR21: Epic 4 - Social Media Event Integration
- FR22: Epic 4 - Social Media Event Integration
- FR23: Epic 4 - Social Media Event Integration
- FR24: Epic 4 - Social Media Event Integration
- FR25: Epic 4 - Social Media Event Integration
- FR26: Epic 4 - Social Media Event Integration
- FR27: Epic 4 - Social Media Event Integration
- FR28: Epic 4 - Social Media Event Integration
- FR29: Epic 4 - Social Media Event Integration
- FR30: Epic 4 - Social Media Event Integration
- FR31: Epic 4 - Social Media Event Integration
- FR32: Epic 4 - Social Media Event Integration
- FR33: Epic 4 - Social Media Event Integration
- FR34: Epic 4 - Social Media Event Integration
- FR35: Epic 4 - Social Media Event Integration
- FR36: Epic 4 - Social Media Event Integration
- FR37: Epic 4 - Social Media Event Integration
- FR38: Epic 5 - Data Quality and Moderation
- FR39: Epic 5 - Data Quality and Moderation
- FR40: Epic 5 - Data Quality and Moderation
- FR41: Epic 5 - Data Quality and Moderation
- FR42: Epic 5 - Data Quality and Moderation
- FR43: Epic 5 - Data Quality and Moderation
- FR44: Epic 5 - Data Quality and Moderation
- FR45: Epic 5 - Data Quality and Moderation
- FR46: Epic 5 - Data Quality and Moderation
- FR47: Epic 5 - Data Quality and Moderation
- FR48: Epic 5 - Data Quality and Moderation
- FR49: Epic 5 - Data Quality and Moderation
- FR50: Epic 5 - Data Quality and Moderation
- FR51: Epic 6 - Onboarding and Manual Event Extraction
- FR52: Epic 6 - Onboarding and Manual Event Extraction
- FR53: Epic 6 - Onboarding and Manual Event Extraction
- FR54: Epic 6 - Onboarding and Manual Event Extraction
- FR55: Epic 6 - Onboarding and Manual Event Extraction
- FR56: Epic 6 - Onboarding and Manual Event Extraction
- FR57: Epic 6 - Onboarding and Manual Event Extraction
- FR58: Epic 6 - Onboarding and Manual Event Extraction
- FR59: Epic 6 - Onboarding and Manual Event Extraction
- FR60: Epic 6 - Onboarding and Manual Event Extraction
- FR61: Epic 6 - Onboarding and Manual Event Extraction
- FR62: Epic 6 - Onboarding and Manual Event Extraction
- FR63: Epic 2 - Core App and Event Discovery
- FR64: Epic 6 - Onboarding and Manual Event Extraction
- FR65: Epic 6 - Onboarding and Manual Event Extraction

## Epic List

### Epic 1: Project Setup & DevOps

The project is set up with a solid foundation and CI/CD pipeline.
**FRs covered:** N/A (Covers NFRs, ARs, and foundational UX-DRs)

### Story 1.1: Initialize pnpm monorepo

**As a** developer,
**I want** to initialize a pnpm monorepo with a Next.js frontend app and a shared-types package,
**So that** I can start building the FestGrid application with a scalable and maintainable codebase.

**Acceptance Criteria:**

*   **Given** I am in the project's root directory
*   **When** I run `pnpm install`
*   **Then** all dependencies for the frontend app and shared-types package are installed successfully.
*   **And** the Next.js application can be started in development mode without errors.
*   **And** the `shared-types` package can be imported into the Next.js application.

### Story 1.2: Configure TypeScript and ESLint for the monorepo

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

### Story 1.3: Set up Shadcn/UI and configure themes

**As a** developer,
**I want** to set up Shadcn/UI in the Next.js app and configure it with the project's color palette and themes,
**So that** I can use a consistent and accessible component library for building the user interface.

**Acceptance Criteria:**

*   **Given** the Next.js app is initialized,
*   **When** I add a new Shadcn/UI component to the project,
*   **Then** the component is styled with the project's themes (e.g., primary, secondary, accent colors).
*   **And** the application supports both light and dark themes.

### Story 1.4: Set up Drizzle ORM and generate the initial database schema

**As a** developer,
**I want** to set up Drizzle ORM in the monorepo and generate the initial database schema based on the entities defined in `shared-types`,
**So that** I can interact with the database in a type-safe way.

**Acceptance Criteria:**

*   **Given** the pnpm monorepo is initialized,
*   **When** I define a new entity in the `shared-types` package,
*   **Then** I can use `drizzle-kit` to generate a database migration.
*   **And** the generated migration can be applied to the Supabase (PostgreSQL) database.

### Story 1.5: Set up CI/CD pipeline with GitHub Actions

**As a** developer,
**I want** to have a basic CI/CD pipeline set up with GitHub Actions,
**So that** I can automatically run tests, linting, and build checks on every push to the repository.

**Acceptance Criteria:**

*   **Given** a push is made to any branch in the GitHub repository,
*   **When** the GitHub Actions workflow is triggered,
*   **Then** the workflow installs dependencies, runs linting, and executes tests for all packages.
*   **And** the workflow fails if any of these steps fail.

### Epic 2: Core App and Event Discovery

Users can discover and browse events.
**FRs covered:** FR1, FR2, FR3, FR4, FR13, FR14, FR63

### Story 2.1: Display a list of events on the main page

**As a** user,
**I want** to see a list of curated local events on the main page,
**So that** I can discover what's happening around me.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** the page loads,
*   **Then** I see a grid of event cards.
*   **And** each event card displays the event name, date, and main image.
*   **And** the events displayed are ongoing or upcoming.
*   **And** the event data is fetched from a mock API endpoint.

### Story 2.2: Search for events

**As a** user,
**I want** to be able to search for events by name, performer, and location,
**So that** I can find specific events I am interested in.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I type a search query in the search bar and press enter,
*   **Then** the list of events is filtered to show only events that match the search query.
*   **And** the search is performed on the event name, performers, and location name.
*   **And** the search supports partial matching.

### Story 2.3: Filter events by type and category

**As a** user,
**I want** to be able to filter events by type and category,
**So that** I can narrow down the list of events to my interests.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I select one or more event types or categories from the filter controls,
*   **Then** the list of events is filtered to show only events that match the selected types and categories.
*   **And** I can clear the filters to see all events again.

### Story 2.4: View event details

**As a** user,
**I want** to be able to click on an event to see its full details,
**So that** I can get all the information I need about the event.

**Acceptance Criteria:**

*   **Given** I am on the main page of the application,
*   **When** I click on an event card,
*   **Then** a modal or a new page appears with the full details of the event.
*   **And** the details include the event name, description, date and time, location, performers, and any other relevant information.
*   **And** the event details are fetched from a mock API endpoint.

### Story 2.5: User Signup and Login with Google

**As a** new user,
**I want** to be able to sign up and log in using my Google account,
**So that** I can easily and securely access the application.

**Acceptance Criteria:**

*   **Given** I am on the login page,
*   **When** I click the "Sign in with Google" button,
*   **Then** I am redirected to the Google authentication page.
*   **And** after successful authentication, a new user account is created in the system if it doesn't exist.
*   **And** I am logged in to the application.
*   **And** I am redirected to the main page.

### Epic 3: User Personalization

Users can personalize their experience by saving favorite events and locations.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR15, FR16, FR17

### Story 3.1: Favorite an event

**As a** user,
**I want** to be able to favorite an event,
**So that** I can easily find it later.

**Acceptance Criteria:**

*   **Given** I am viewing the details of an event,
*   **When** I click the "Favorite" button,
*   **Then** the event is marked as a favorite.
*   **And** the "Favorite" button changes to an "Unfavorite" button.
*   **And** when I click the "Unfavorite" button, the event is no longer marked as a favorite.

### Story 3.2: View favorited events

**As a** user,
**I want** to have a dedicated page that shows all my favorited events,
**So that** I can easily keep track of them.

**Acceptance Criteria:**

*   **Given** I am logged in,
*   **When** I navigate to the "Favorites" page,
*   **Then** I see a list of all the events I have favorited.
*   **And** I can unfavorite an event directly from this page.

### Story 3.3: Manage saved locations

**As a** user,
**I want** to be able to save and manage a list of named locations,
**So that** I can easily find events near them.

**Acceptance Criteria:**

*   **Given** I am on the "My Locations" page,
*   **When** I add a new location by providing a name and address,
*   **Then** the location is saved to my list of locations.
*   **And** I can see a list of my saved locations.
*   **And** I can delete a location from the list.

### Story 3.4: Set location by current location or map

**As a** user,
**I want** to be able to set a location by using my current location or by picking a point on a map,
**So that** I can easily save locations without having to type in an address.

**Acceptance Criteria:**

*   **Given** I am on the "My Locations" page and adding a new location,
*   **When** I click the "Use my current location" button,
*   **Then** the location fields are pre-filled with my current location.
*   **And when** I click the "Pick on map" button,
*   **Then** a map is displayed, allowing me to select a location by clicking on it.

### Story 3.5: Find nearby events

**As a** user,
**I want** to be able to find events near my saved locations,
**So that** I can easily discover events happening close to me.

**Acceptance Criteria:**

*   **Given** I have at least one saved location,
*   **When** I am viewing the event list,
*   **Then** I can select one of my saved locations to see nearby events.
*   **And** I can specify a radius (e.g., 1km, 5km, 10km) to define "nearby".
*   **And** the list of events is filtered to show only events within the specified radius of the selected location.

### Story 3.6: View and manage events on a calendar

**As a** user,
**I want** to see my "favorited" and "added to calendar" events on a dedicated calendar page,
**So that** I can visualize my upcoming event schedule.

**Acceptance Criteria:**

*   **Given** I am on the "My Calendar" page,
*   **When** the page loads,
*   **Then** I see a calendar view with all my "favorited" and "added to calendar" events.
*   **And** "favorited" and "added to calendar" events have a distinct visual treatment.
*   **And** I can toggle the visibility of "favorited" and "added to calendar" events on the calendar.

### Story 3.7: Automatically hide past events

**As a** user,
**I want** past events in my personal lists to be automatically hidden after a configurable number of days,
**So that** my lists stay clean and relevant.

**Acceptance Criteria:**

*   **Given** I have events in my "Favorites" or "My Calendar" list that have passed,
*   **When** `N` days have passed since the event ended,
*   **Then** the event is no longer visible in the list.
*   **And** the value of `N` is configurable in the user settings.

### Epic 4: Social Media Event Integration

Users can subscribe to social media accounts to import events into their feed.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37

### Epic 5: Data Quality and Moderation

Users can contribute to data quality by correcting event details and reporting issues.
**FRs covered:** FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50

### Epic 6: Onboarding and Manual Event Extraction

Users are guided through the initial setup and can manually select posts for event extraction.
**FRs covered:** FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR64, FR65
