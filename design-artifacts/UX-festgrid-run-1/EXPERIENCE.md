---
title: "EXPERIENCE.md: festgrid"
status: "draft"
created: "2026-07-13T22:33:00Z"
updated: "2026-07-14T09:56:00Z"
sources:
  - "_bmad-output/planning-artifacts/prfaq-festgrid.md"
  - "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md"
---

# Information Architecture

The main view is centered around a filterable, dynamic grid of events that can be viewed as either a card-grid or a weekly calendar. This provides flexibility for users to discover events in their preferred format.

- **Filter Hub**: Prominently displayed at the top of the discovery view, the Filter Hub contains controls for filtering events by `EventType` and `EventCategory`. These controls will support multi-selection, allowing users to combine filters (e.g., `FESTIVAL` + `MUSIC` + `FAMILY_AND_KIDS`).
- **Dynamic Event Grid**: The event grid (both card and calendar view) dynamically updates as filters are applied, showing only the events that match the user's criteria.
- **Calendar View**: The weekly calendar includes a header with previous/next week navigation and a "Today" button. Each schedule of an event is displayed as a separate compact card. The title of the card is formatted to distinguish between main and sub-schedules.

# Interaction Primitives

- **Filtering**: Users can tap on `EventType` or `EventCategory` buttons/tags in the Filter Hub. The event grid below will update in real-time with each selection. Selected filters are clearly indicated.
- **Event Discovery**: Clicking on an event card in the main grid view opens a modal with the full event details, including a clear display of its types and categories as tags. Clicking on a specific schedule in the calendar view also opens the modal with the full event details. The URL is updated for deep-linking in both cases.

# User Flows

- **Default Location for Subscriptions:**
  1. User navigates to the "Manage Subscriptions" page.
  2. For each subscription, there is an option to "Set Default Location".
  3. Clicking this option reveals a text input field.
  4. The user types a location (e.g., "Grand Indonesia Mall, Jakarta").
  5. The system saves this location and associates it with the subscription.

# Voice and Tone

The feeling of using FestGrid should be one of exciting discovery.

# Component Patterns

- **Notifications:** The system will use notifications to keep users informed about events and other relevant updates.
- **Accessibility:** All components will be designed and built to meet WCAG 2.1 AA standards, ensuring they are usable by people with a wide range of disabilities.
- **Platform Adaptability:** Components will be responsive and adapt their layout and density for optimal viewing on both mobile and desktop platforms.
- **Motion & Animation:** Subtle animations will be used on interactive elements (like button presses or card selection) to provide feedback and enhance the sense of discovery.
- **Content Density:** Components will adjust their information density based on the screen size, showing more detailed information on larger screens and a more concise version on smaller screens.
