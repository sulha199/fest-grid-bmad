# 01-event-list-view

## Component Name

Event List View

## Purpose

To provide a consistent, powerful, and user-friendly interface for browsing, searching, and filtering lists of events across the application.

## Standard Interactions

Any page or component that implements the Event List View must include the following features:

### 1. View Toggles
- A view switcher with options for **Card View** and **Calendar View**.
- The **Card View** is the default selection.

### 2. Filtering and Searching
- **Free-Text Search:** A prominent search bar allowing users to type in keywords to find specific events.
- **Filter Hub:** A collection of filter options, including:
    - **Filter by Location:** Allows users to select from their list of saved locations.
    - **Filter by Category:** Allows users to select from a predefined list of event categories (e.g., "Music", "Family & Kids", "Arts & Culture").
    - **Filter by Type:** Allows users to select from a predefined list of event types (e.g., "Concert", "Workshop", "Festival").
- The event list updates in real-time as filters are applied.

### 3. Default State
- **Defaults to "Nearby":** Upon loading, the view attempts to show events near the user's primary saved location.
- **Fallback:** If the user has no saved locations, or if no events are found nearby, the view defaults to showing all upcoming events to ensure the page is never empty.

### 4. Quick Actions
- **Quick Favorite:** Each event card in the list must feature a heart icon or a similar control that allows the user to save the event to their favorites without leaving the current view.

## Implementation Note

Specific pages can have their own context-specific default filters that override the standard "Nearby" default. For example, a user's personalized feed might default to showing events only from their subscriptions.
