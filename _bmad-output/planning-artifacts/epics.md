---
stepsCompleted: []
inputDocuments:
  - c:\projects\portfolio\festgrid\bmad\_bmad-output\planning-artifacts\prds\festgrid-prd-2026-07-10-2047\prd.md
  - c:\projects\portfolio\festgrid\bmad\_bmad-output\planning-artifacts\festgrid-architecture-spine.md
  - c:\projects\portfolio\festgrid\bmad\design-artifacts\UX-festgrid-run-1\DESIGN.md
  - c:\projects\portfolio\festgrid\bmad\design-artifacts\UX-festgrid-run-1\EXPERIENCE.md
  - c:\projects\portfolio\festgrid\bmad\design-artifacts\UX-wizard-page-run-1\DESIGN.md
  - c:\projects\portfolio\festgrid\bmad\design-artifacts\UX-wizard-page-run-1\EXPERIENCE.md
---

# festgrid - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for festgrid, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Display a curated selection of local events.
FR2: Users can search by event-name, performers, and location name, using partial matching.
FR3: Users can filter events by type and category.
FR4: The event discovery page will only display ongoing and upcoming events by default.
FR5: Users can "favorite" events they are interested in.
FR6: A dedicated page will show all favorited events.
FR7: A dedicated page will show all events the user has added to their calendar.
FR8: Users can save multiple named locations (e.g., "Home", "Work").
FR9: A location can be set by using the user's current location or by picking a point on a map.
FR10: These saved locations can be used to find "nearby events" within a user-defined radius (e.g., between 1km and 50km).
FR11: When adding an event to a calendar, users can select which specific schedules to add.
FR12: For MVP, this is a one-way integration (app to calendar).
FR13: Consolidate all relevant event information in one place.
FR14: All event discovery pages (main discovery, subscribed events) will by default only show ongoing and upcoming events.
FR15: Events in a user's personal lists ('favorited' or 'added to calendar') will be hidden `N` days after they have passed. `N` is configurable via an environment variable with a default value of 7.
FR16: "Favorited" and "Added to Calendar" events will have a distinct visual treatment on the calendar.
FR17: The calendar will have toggles to show/hide all "favorited" events and all "added" events.
FR18: Users can subscribe to desired social media accounts by providing their own Gemini API Key (BYOK).
FR19: Users can optionally set a "Default Location" when subscribing to an account.
FR20: Users will receive email notifications if `X` of their subscribed posts have been queued for `Y` days due to Gemini API quota exhaustion.
FR21: A dedicated section within the user menu will display the real-time queue status of posts pending extraction for each user.
FR22: Events extracted from a user's social media accounts will be displayed to the user.
FR23: Users can view these events in a calendar-view (default) or a card-view.
FR24: A free-text search bar will allow users to search events from their subscribed accounts by event name, performers, and location name. Users can also filter events by type, category, and the specific social media account source.
FR25: Event data processed from subscribed accounts will be used to generate personalized event reminders.
FR26: API keys are validated reactively.
FR27: Users can submit corrections through a structured form with typed inputs for each field of the `EventInfo` and `Schedule` interfaces.
FR28: A 'Report' button will be available for all events.
FR29: Users can select which specific social media posts should be processed by the AI agent.
FR30: The manual post selection screen is integrated as a new step in the getting started wizard.
FR31: Users can also access this feature via an "Extract event from post(s)" item in the user menu.
FR32: The platform will support Indonesian and English.
FR33: Proactive Throttling and Queuing for Gemini API.
FR34: User Notification for Capacity Limits.
FR35: Manual Event Data Correction with Typed Inputs.
FR36: Data Inconsistency Checks for corrections.
FR37: AI-Assisted Correction.
FR38: User Reporting and Event Moderation.
FR39: User and Moderator Interfaces.
FR40: Manual Post Selection for Event Extraction.
FR41: Manual Post Selection - Wizard Integration.
FR42: Manual Post Selection - Menu Access.
FR43: Getting Started and Onboarding.

## Epic List

### Epic 0: Project Setup & DevOps
Establish the foundation of the project, including the monorepo structure, development environment, and CI/CD pipeline.

**Stories:**
*   **Story 0.1: Initial Project Scaffolding:** Set up the monorepo with pnpm, turbo, and the initial application structure (frontend, backend, shared packages).
*   **Story 0.2: Development Environment Configuration:** Configure local development environment with scripts to run the applications, linting, and formatting.
*   **Story 0.3: CI/CD Pipeline Setup:** Set up a basic CI/CD pipeline for automated testing, linting, and building of the applications.
*   **Story 0.4: Internationalization (i18n) Foundation:** Set up the `next-intl` library and create the initial locale structure for English and Indonesian.

### Epic 1: Core Event Discovery & Personalization
Users can discover, search, filter, and personalize their event experience.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR11, FR12, FR13, FR14, FR15, FR16, FR17

### Epic 2: Location-Based Features
Users can save locations and find events nearby.
**FRs covered:** FR8, FR9, FR10

### Epic 3: Social Media Integration & Event Extraction
Users can subscribe to social media accounts and have events automatically extracted and displayed.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26

### Epic 4: Data Quality & Moderation
Users can contribute to the accuracy of event data by reporting issues and suggesting corrections.
**FRs covered:** FR27, FR28, FR35, FR36, FR37, FR38, FR39

### Epic 5: Manual Post Selection & Onboarding
Users are guided through the initial setup and can manually select posts for extraction.
**FRs covered:** FR29, FR30, FR31, FR40, FR41, FR42, FR43

### Epic 6: API Management and Capacity
To ensure reliable and stable operation while adhering to Google Gemini API usage policies.
**FRs covered:** FR33, FR34

### Epic 7: Add New Languages (Post-MVP)
Add support for additional languages post-MVP.
**FRs covered:** FR32 (foundation laid in Epic 0)
