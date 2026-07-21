
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

### NonFunctional Requirements

NFR1: Event discovery page should load in under 2 seconds on a standard 4G connection.
NFR2: Key interactive elements, like the search bar and filters, should be interactive within 1.5 seconds.
NFR3: 95% of API calls should complete in under 500ms.
NFR4: The system should be able to handle 100 concurrent users with a response time degradation of no more than 15%.
NFR5: The event ingestion pipeline should be able to process 100 events per hour.
NFR6: The architecture should be designed to be horizontally scalable to accommodate future growth.
NFR7: The service should have 99.9% uptime (max ~43 minutes of downtime per month).
NFR8: Server-side error rate should be below 0.5%.
NFR9: At least 90% of users should be able to add an event to their calendar in their first session without assistance.
NFR10: Target a SUS score of 75 or higher.
NFR11: All API keys must be stored securely in environment variables and must not be committed to the source code repository.
NFR12: All API keys should be restricted in the Google Cloud Console.
NFR13: A caching mechanism will be implemented for Google Geolocation API.
NFR14: All AI-driven event extractions must produce a `confidenceScore`.
NFR15: User data and privacy must be protected with industry-standard security measures.
NFR16: The platform will use a web analytics service to collect anonymous data on page views and user engagement.
NFR17: The system must gracefully inform users when they encounter temporary limitations.
NFR18: The layout must be designed to support both Left-to-Right (LTR) and Right-to-Left (RTL) languages.

### Additional Requirements

AR1: All event queries sent from a client to the backend will conform to a unified JSON-based Domain Specific Language (DSL).
AR2: All event collections must be retrieved through the primary event query endpoint using the Unified Query DSL.

### UX Design Requirements

UX-DR1: The primary experience is mobile-first, but the application will be a responsive web app accessible on desktop.
UX-DR2: A filter hub will be prominently displayed at the top of the discovery view, containing controls for filtering events by `EventType` and `EventCategory` with multi-selection.
UX-DR3: The event grid (both card and calendar view) dynamically updates as filters are applied.
UX-DR4: The weekly calendar includes a header with previous/next week navigation and a "Today" button.
UX-DR5: Clicking on an event card in the main grid view opens a modal with the full event details.
UX-DR6: On mobile touch interfaces, a swipe gesture on a list item can reveal a "Delete" button, which triggers the "Soft Delete with Undo" state.
UX-DR7: The system will use notifications to keep users informed about events and other relevant updates.
UX-DR8: All components will be designed and built to meet WCAG 2.1 AA standards.
UX-DR9: Components will be responsive and adapt their layout and density for optimal viewing on both mobile and desktop platforms.
UX-DR10: Subtle animations will be used on interactive elements.
UX-DR11: For managing lists of items (e.g., API Keys, Subscriptions), the mechanism for adding a new item is an always-present, editable row at the bottom of the table.
UX-DR12: The "Soft Delete with Undo" pattern is used for any destructive action on a user-created item.
UX-DR13: A dynamic, global page (`/wizard`) that handles multi-step flows, configured via URL query parameters.
UX-DR14: A `useWizardStep()` hook that provides the state of the current step.
UX-DR15: A visual representation of the steps in the wizard, displayed at the top of the page.
UX-DR16: Navigation buttons at the bottom of the page (`Previous Step`, `Next Step`, `Skip Step`, `Complete`).

### FR Coverage Map

### FR Coverage Map

FR1: Epic 1
FR2: Epic 1
FR3: Epic 1
FR4: Epic 1
FR5: Epic 2
FR6: Epic 2
FR7: Epic 2
FR8: Epic 3
FR9: Epic 3
FR10: Epic 3
FR11: Epic 2
FR12: Epic 2
FR13: Epic 1
FR14: Epic 1
FR15: Epic 2
FR16: Epic 2
FR17: Epic 2
FR18: Epic 4
FR19: Epic 4
FR20: Epic 4
FR21: Epic 4
FR22: Epic 4
FR23: Epic 4
FR24: Epic 4
FR25: Epic 4
FR26: Epic 4
FR27: Epic 6
FR28: Epic 6
FR29: Epic 4
FR30: Epic 5
FR31: Epic 5
FR32: Epic 1, 2, 3, 4, 5, 6

## Epic List

## Epic List

### Epic 1: Core Event Discovery
Users can discover, search, and filter local events.
**FRs covered:** FR1, FR2, FR3, FR4, FR13, FR14

### Story 1.1: Display Curated Events

As a user,
I want to see a curated list of local events,
So that I can easily discover what's happening around me.

**Acceptance Criteria:**

**Given** I am on the event discovery page
**When** the page loads
**Then** I should see a grid of event cards.
**And** each event card should display the event's name, image, and date.
**And** only ongoing and upcoming events are displayed by default.

### Story 1.2: Search and Filter Events

As a user,
I want to search and filter events,
So that I can find specific events I'm interested in.

**Acceptance Criteria:**

**Given** I am on the event discovery page
**When** I enter a search term in the search bar and/or select one or more event types or categories from the filter hub
**Then** the event grid should update to show only events that match both the search term and the selected filters.
**And** the search should be case-insensitive and support partial matching.
**And** I should be able to select multiple types and categories at the same time.
**And** the search and filters should work independently and in combination.

### Story 1.3: View Event Details

As a user,
I want to view the full details of an event,
So that I can get all the information I need.

**Acceptance Criteria:**

**Given** I am on the event discovery page
**When** I click on an event card
**Then** a modal should open with the full event details, including name, description, schedules, location, and any other available information.

### Epic 2: Personalized Event Management
Users can save events they are interested in and manage their personal event lists.
**FRs covered:** FR5, FR6, FR7, FR11, FR12, FR15, FR16, FR17

### Story 2.1: Favorite an Event

As a user,
I want to favorite an event,
So that I can easily find it later.

**Acceptance Criteria:**

**Given** I am viewing an event's details
**When** I click the "Favorite" button
**Then** the event should be marked as a favorite.
**And** the "Favorite" button should change to an "Unfavorite" button.

### Story 2.2: View Favorite Events

As a user,
I want to view a list of all my favorited events,
So that I can see all the events I'm interested in in one place.

**Acceptance Criteria:**

**Given** I am on the "Favorites" page
**When** the page loads
**Then** I should see a list of all my favorited events.
**And** events that have passed more than 7 days ago should be hidden.

### Story 2.3: Add an Event to Calendar

As a user,
I want to add an event to my personal calendar,
So that I don't forget about it.

**Acceptance Criteria:**

**Given** I am viewing an event's details
**When** I click the "Add to Calendar" button
**Then** I should be prompted to select which schedules of the event to add.
**And** after confirming, the selected schedules should be added to my external calendar.

### Story 2.4: View Added Events

As a user,
I want to view a list of all the events I've added to my calendar,
So that I can see all my planned events in one place.

**Acceptance Criteria:**

**Given** I am on the "My Calendar" page
**When** the page loads
**Then** I should see a list of all the events I have added to my calendar.
**And** events that have passed more than 7 days ago should be hidden.

### Story 2.5: Visual Distinction for Personalized Events

As a user,
I want to see a visual distinction for my favorited and added events on the main calendar view,
So that I can easily identify them.

**Acceptance Criteria:**

**Given** I am on the main calendar view
**When** there are events that I have favorited or added to my calendar
**Then** those events should have a distinct visual treatment (e.g., a different color or icon).

### Story 2.6: Toggle Personalized Events on Calendar

As a user,
I want to be able to show or hide my favorited and added events on the main calendar view,
So that I can focus on discovering new events or on my planned events.

**Acceptance Criteria:**

**Given** I am on the main calendar view
**When** I toggle the "Show Favorites" switch
**Then** all my favorited events should be shown or hidden on the calendar.
**When** I toggle the "Show Added to Calendar" switch
**Then** all my added events should be shown or hidden on the calendar.

### Epic 3: Location-Based Features
Users can save locations and find events nearby.
**FRs covered:** FR8, FR9, FR10

### Story 3.1: Save a Named Location

As a user,
I want to save a named location,
So that I can easily reuse it for searching nearby events.

**Acceptance Criteria:**

**Given** I am on the "Manage Locations" page
**When** I click "Add Location"
**Then** I should be able to enter a name for the location (e.g., "Home", "Work").
**And** I should be able to set the location by using my current location or by picking a point on a map.
**And** the new location should be saved to my list of named locations.

### Story 3.2: View and Manage Saved Locations

As a user,
I want to view and manage my saved locations,
So that I can keep my location preferences up to date.

**Acceptance Criteria:**

**Given** I am on the "Manage Locations" page
**When** the page loads
**Then** I should see a list of all my saved locations.
**And** I should be able to edit the name and address of a saved location.
**And** I should be able to delete a saved location.

### Story 3.3: Find Nearby Events

As a user,
I want to find events near my saved locations,
So that I can discover events that are convenient for me to attend.

**Acceptance Criteria:**

**Given** I am on the event discovery page
**When** I select one of my saved locations
**Then** the event grid should update to show events within a defined radius of that location.
**And** I should be able to adjust the search radius (e.g., between 1km and 50km).

### Epic 4: Social Media Integration & Event Extraction
Users can subscribe to social media accounts and have events automatically extracted and displayed.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR29

### Story 4.1: Subscribe to a Social Media Account

As a user,
I want to subscribe to a social media account,
So that I can get events from that account.

**Acceptance Criteria:**

**Given** I am on the "Manage Subscriptions" page
**When** I click "Add Subscription"
**Then** I should be able to enter the URL of a social media account.
**And** I should be able to provide my Gemini API Key.
**And** I should be able to optionally set a default location for the subscription.

### Story 4.2: View Subscribed Events

As a user,
I want to view the events extracted from my subscribed social media accounts,
So that I can see the events I'm interested in.

**Acceptance Criteria:**

**Given** I am on the "Subscribed Events" page
**When** the page loads
**Then** I should see a calendar or card view of the events extracted from my subscribed accounts.
**And** I should be able to switch between calendar and card view.

### Story 4.3: Search and Filter Subscribed Events

As a user,
I want to search and filter my subscribed events,
So that I can easily find specific events.

**Acceptance Criteria:**

**Given** I am on the "Subscribed Events" page
**When** I use the search bar or filters
**Then** the event view should update to show only events that match my criteria.
**And** I should be able to filter by event type, category, and social media account source.

### Story 4.4: Manual Post Selection for Extraction

As a user,
I want to manually select which posts to extract events from,
So that I can control my API quota usage.

**Acceptance Criteria:**

**Given** I am on the "Extract from Posts" page
**When** I select a subscribed account
**Then** I should see a list of recent posts from that account.
**And** I should be able to select one or more posts to extract events from.
**And** the system should show my remaining API quota.

### Story 4.5: Quota and API Key Notifications

As a user,
I want to be notified about issues with my API key or quota,
So that I can take action to resolve them.

**Acceptance Criteria:**

**Given** my API key is invalid or my quota is exhausted
**When** the system tries to extract events using my key
**Then** I should receive an email notification after a configurable number of failures.
**And** I should be able to see the real-time queue status of my pending extractions in the app.

### Epic 5: Onboarding and Wizard Framework
Users are guided through the initial setup of the application.
**FRs covered:** FR30, FR31

### Story 5.1: Implement a Generic Wizard Component

As a developer,
I want a generic wizard component,
So that I can easily create multi-step flows for various features.

**Acceptance Criteria:**

**Given** I have a set of steps defined as an array of objects
**When** I render the wizard component with the steps
**Then** a step summary should be displayed at the top of the page.
**And** navigation buttons (Previous, Next, Skip, Complete) should be displayed at the bottom.
**And** the wizard should handle the flow between steps.

### Story 5.2: Create a Getting Started Wizard

As a new user,
I want to be guided through the initial setup of the application,
So that I can quickly start using the key features.

**Acceptance Criteria:**

**Given** I am a new user
**When** I first log in
**Then** I should be presented with a "Getting Started" wizard.
**And** the wizard should guide me through adding my first subscription and selecting posts for extraction.

### Story 5.3: Access "Extract from Post(s)" from User Menu

As a user,
I want to be able to access the "Extract event from post(s)" feature from the user menu,
So that I can manually extract events at any time.

**Acceptance Criteria:**

**Given** I am a logged-in user
**When** I open the user menu
**Then** I should see an "Extract event from post(s)" option.
**And** if I haven't added a subscription or API key yet, I should be guided through the wizard to do so.

### Epic 6: Data Quality and Moderation
Users can contribute to the accuracy of event data by reporting issues and suggesting corrections.
**FRs covered:** FR27, FR28

### Story 6.1: Manually Correct Event Data

As a user,
I want to manually correct the data for an event,
So that the information is accurate.

**Acceptance Criteria:**

**Given** I am viewing an event's details
**When** I click the "Correct Data" button
**Then** I should be presented with a form where I can edit the event's information.
**And** the form should have typed inputs for each field (e.g., date picker for dates).
**And** the system should perform basic validation on the corrected data (e.g., end date is after start date).

### Story 6.2: Report an Event

As a user,
I want to report an event for various reasons (e.g., cancelled, dangerous),
So that the platform can maintain high-quality and safe content.

**Acceptance Criteria:**

**Given** I am viewing an event
**When** I click the "Report" button
**Then** I should be able to select a reason for reporting (e.g., "Event Cancelled", "Dangerous Content", "Personal").
**And** the event should be hidden from my view immediately.
**And** the report should be submitted for moderation.

### Story 6.3: View and Manage User Reports

As a user,
I want to view the status of my submitted reports,
So that I can track their resolution.

**Acceptance Criteria:**

**Given** I am on the "My Reports" page
**When** the page loads
**Then** I should see a list of all the reports I have submitted.
**And** I should be able to see the status of each report (e.g., "Pending", "Resolved").

### Story 6.4: Moderator Tools

As a moderator,
I want to have a dedicated page to review and manage user reports,
So that I can maintain the quality and safety of the platform.

**Acceptance Criteria:**

**Given** I am a moderator and on the "Moderator Items" page
**When** the page loads
**Then** I should see a list of all user reports.
**And** I should be able to filter reports by type and status.
**And** I should be able to take action on each report (e.g., soft-delete an event, mark as safe).

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic {{N}}: {{epic_title_N}}

{{epic_goal_N}}

<!-- Repeat for each story (M = 1, 2, 3...) within epic N -->

### Story {{N}}.{{M}}: {{story_title_N_M}}

As a {{user_type}},
I want {{capability}},
So that {{value_benefit}}.

**Acceptance Criteria:**

<!-- for each AC on this story -->

**Given** {{precondition}}
**When** {{action}}
**Then** {{expected_outcome}}
**And** {{additional_criteria}}

<!-- End story repeat -->
