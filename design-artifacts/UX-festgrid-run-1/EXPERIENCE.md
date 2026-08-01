---
title: "EXPERIENCE.md: festgrid"
status: "draft"
created: "2026-07-20T10:59:00Z"
updated: "2026-08-01T07:45:00Z"
sources:
  - "design-artifacts/UX-festgrid-run-1/DESIGN.md"
  - "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md"
---

# EXPERIENCE.md: FestDaily

This document defines the information architecture, behavior, states, and interactions for the FestDaily application. It is the authority on *how the app works*.

## Foundation

*   **Form-factor:** The primary experience is mobile-first, but the application will be a responsive web app accessible on desktop.
*   **Visual Identity:** All visual styling is defined in `{design-artifacts/UX-festgrid-run-1/DESIGN.md}`.

## Information Architecture

The application's structure is as follows:

*   **/ (Event Discovery):** The main landing page for authenticated users.
*   **/favorites:** A dedicated page showing the user's favorited events.
*   **/my-calendar:** A dedicated page showing events the user has added to their calendar.
*   **/feed:** The page where a user views events from their subscribed accounts.
*   **/settings:** A parent page for all user settings.
*   **/settings/locations:** The "Manage Locations" screen.
*   **/settings/subscriptions:** The "Manage Subscribed Accounts" screen.
*   **/settings/api-keys:** The "Manage API Keys" screen.
*   **/settings/notifications:** The screen for configuring push notifications.

The main view is centered around a filterable, dynamic grid of events that can be viewed as either a card-grid or a weekly calendar. This provides flexibility for users to discover events in their preferred format.

- **Filter Hub**: Prominently displayed at the top of the discovery view, the Filter Hub contains controls for filtering events by `EventType` and `EventCategory`. These controls will support multi-selection, allowing users to combine filters (e.g., `FESTIVAL` + `MUSIC` + `FAMILY_AND_KIDS`).
- **Dynamic Event Grid**: The event grid (both card and calendar view) dynamically updates as filters are applied, showing only the events that match the user's criteria.
- **Calendar View**: The weekly calendar includes a header with previous/next week navigation and a "Today" button. Each schedule of an event is displayed as a separate compact card. The title of the card is formatted to distinguish between main and sub-schedules.

## Interaction Primitives

- **Filtering**: Users can tap on `EventType` or `EventCategory` buttons/tags in the Filter Hub. The event grid below will update in real-time with each selection. Selected filters are clearly indicated.
- **Event Discovery**: Clicking on an event card in the main grid view opens a modal with the full event details, including a clear display of its types and categories as tags. Clicking on a specific schedule in the calendar view also opens the modal with the full event details. The URL is updated for deep-linking in both cases.
- **Swipe-to-delete:** On mobile touch interfaces, a swipe gesture on a list item can reveal a "Delete" button. This will trigger the "Soft Delete with Undo" state.

## User Flows

- **Default Location for a Subscribed Account:**
  1. User navigates to the "Manage Subscribed Accounts" page (`/settings/subscriptions`).
  2. Each subscribed account's row shows its current default location, if any, and a "Set/Edit Default Location" action, following the In-Table Add Form pattern.
  3. **First time set (no default location on the account yet):** clicking the action reveals a text input field; the user types a location (e.g., "Grand Indonesia Mall, Jakarta") and saves. The location is persisted immediately and associated with the *account* — not the individual subscription — so every other subscriber to that account inherits it too.
  4. **Editing an already-set default location:** the field shows the existing value, editable. Saving is never blocked — the change applies immediately — but it triggers the "Default Location Pending Review" state (see State Patterns), since an edit here silently changes what every other subscriber of the account sees.

## Voice and Tone

The feeling of using FestDaily should be one of exciting discovery. Microcopy should be clear, concise, and helpful. Avoid technical jargon where possible. Provide immediate and clear feedback for user actions (e.g., "Event favorited", "API Key saved").

## Component Patterns

- **Notifications:** The system will use notifications to keep users informed about events and other relevant updates.
- **Accessibility:** All components will be designed and built to meet WCAG 2.1 AA standards, ensuring they are usable by people with a wide range of disabilities.
- **Platform Adaptability:** Components will be responsive and adapt their layout and density for optimal viewing on both mobile and desktop platforms.
- **Motion & Animation:** Subtle animations will be used on interactive elements (like button presses or card selection) to provide feedback and enhance the sense of discovery.
- **Content Density:** Components will adjust their information density based on the screen size, showing more detailed information on larger screens and a more concise version on smaller screens.
- **In-Table Add Form:** For managing lists of items (e.g., API Keys, Subscriptions), the mechanism for adding a new item is an always-present, editable row at the bottom of the table. This row contains the necessary input fields and an "Add" (`+`) action button.

## State Patterns

### Soft Delete with Undo

This pattern is used for any destructive action on a user-created item (e.g., deleting a saved location, an API key, a subscription, or unfavoriting an event from a list).

*   **Initial State:** The item is visible in a list.
*   **Trigger:** User clicks a "Delete" or "Unfavorite" button.
*   **Intermediate State:**
    *   The item is not immediately removed from the list in the UI.
    *   The item's appearance changes to indicate it is "marked for deletion" (e.g., it becomes greyed out or has a strikethrough).
    *   An "Undo" button appears next to or within the item's row.
    *   A temporary confirmation message (e.g., a toast notification) appears, saying "Item deleted" with an "Undo" action.
*   **"Undo" Action:** If the user clicks "Undo", the item returns to its initial state. The deletion is cancelled.
*   **Final State (Commit):** The deletion is committed (i.e., the backend call is made and the item is permanently removed from the user's view) when the user navigates away from the current page. The next time the user visits the page, the item will be gone.

### Default Location Pending Review

This pattern applies only when a user edits an *already-set* default location on a shared subscribed account — not the first-time-set case, which has no prior value to protect and needs no review.

*   **Initial State:** The account row shows its current default location value.
*   **Trigger:** User edits the value and saves.
*   **Immediate State:**
    *   The new value saves and displays right away — the save is never blocked waiting on a moderator.
    *   A confirmation message acknowledges the save and briefly notes that the change affects every subscriber to this account and has been sent for moderator review — informative, not alarming (Voice and Tone).
    *   The row shows a "Pending Review" badge until a moderator resolves it.
*   **Resolution (external):** A moderator accepts or reverts the change from Moderator Tools (Epic 4). On revert, the row's value reverts to the prior location and the badge clears; on accept, the badge simply clears.
