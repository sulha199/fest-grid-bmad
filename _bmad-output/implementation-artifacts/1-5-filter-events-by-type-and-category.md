# Story 1.5: Filter events by type and category

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.5
- **Status:** ready-for-dev

## User Story
**As a** user,
**I want** to be able to filter events by type and category,
**So that** I can narrow down the list of events to my interests.

## Acceptance Criteria
*   **Given** I am on the main page of the application,
*   **When** I select one or more event types or categories from the filter controls,
*   **Then** the list of events is filtered to show only events that match the selected types and categories.
*   **And** I can clear the filters to see all events again.

## Developer Context

### Architecture & Technical Requirements
- **Unified Query DSL (AR1):** The filter functionality **must** leverage the Unified Query DSL. Selecting types or categories should translate into `"in"` or `"contains"` conditions within the DSL payload.
- **Combined Queries:** The filter conditions **must** be combined with the default "ongoing or upcoming" filter (Story 1.3) and any active search queries (Story 1.4) using an `"and"` operator.
- **URL State Management:** In Next.js 15+, filter state **must** be managed via URL query parameters (e.g., `?type=festival,concert&category=music`). This ensures that filters are shareable, bookmarkable, and compatible with server-side data fetching. Use `useSearchParams`, `usePathname`, and `useRouter` from `next/navigation` to update the URL dynamically.
- **UX Requirements:** 
  - **UX-DR10:** Implement a Filter Hub at the top of the discovery view for filtering events by `EventType` and `EventCategory` with multi-selection.
  - **Multi-Select Component Details:** Create a reusable `MultiSelect` component that acts as a faceted filter. The component should feature:
    - **Trigger Button:** A bordered button containing a plus icon (+), a dynamic title (e.g., "Type" or "Category"), a vertical separator line (|), and badges displaying the currently selected options (e.g., "Music", "Festival").
    - **Popover/Dropdown Menu:** Opens on click, built using Shadcn/ui `Popover` and `Command` components.
    - **Search & Selection:** Inside the popover, a search input (e.g., "Search type...") followed by a list of selectable items. Selected items display a checkmark icon.
    - **Clear Action:** A "Clear filters" action at the bottom of the popover menu.
  - **UX-DR11:** The event grid should update dynamically as filters are applied.
- **Database Performance:** According to `project-context.md`, columns frequently used in `WHERE` clauses **must** be indexed. Ensure the `types` and `categories` columns in the Drizzle schema are indexed.
- **Internationalization (i18n):** The Filter Hub labels, event types, and category names must be localized using `next-intl`.

### Previous Story Intelligence
- **From Story 1.4:** URL state management was established for the search query. The new filter parameters must cleanly integrate with the existing search parameter without overwriting it.
- **From Story 1.3:** The main page `page.tsx` fetches events server-side based on the search params passed to the GraphQL query. The DSL parser in `packages/domain` must correctly handle the addition of array-based or multi-select filters.

### File Structure Requirements
- `packages/ui/`: Create a new workspace package for shared UI components if it doesn't exist yet, exporting the Shadcn/ui elements.
- `packages/ui/src/core/multi-select.tsx`: Create the reusable generic multi-select faceted filter component described above. (Reusable UI Component)
- `apps/web/app/page.tsx`: Update to extract `type` and `category` from `searchParams` and include them in the GraphQL DSL payload.
- `packages/ui/src/features/events/FilterHub.tsx`: Create a new client component for the filter UI that uses the `MultiSelect` from `@festgrid/ui` and updates URL query parameters dynamically on selection changes. (Reusable UI Component)
- `packages/domain/src/events/`: Verify and update the DSL parser to support multi-value filtering (e.g., the `in` operator) for `type` and `category` fields, and ensure 100% unit test coverage for any new logic. (Reusable Domain Logic)
- `packages/database/`: Verify or add Drizzle migrations to ensure indexes exist for `type` and `category` columns.

### Dev Notes (Custom Rules)
- **State Management:** Because this story requires state management, explicitly categorize the state into URL State (nuqs) to manage the selected event types and categories in the URL..
- **UI Components:** Because this story requires UI components that should be reusable (e.g. MultiSelect, FilterHub), these components must be created inside `packages/ui` as per project rules.
- **Domain Logic:** Because this story requires a function/mechanism that should be reusable (e.g. multi-value DSL parser extension), explicitly create them inside `packages/domain`.
- **Analytics:** Because this story requires tracking user interactions or adding user-analytics, explicitly include adding PostHog analytics actions. Track a "Filter Applied" event containing the selected types and categories.

### Project Context Reference
- **API Style (GraphQL):** All client-server data fetching must use GraphQL.
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **Pure Business Logic:** Any additions to the DSL parser must live in `packages/domain` and be 100% unit tested.
- **Database Access:** Handled exclusively through Drizzle ORM.

## Completion Status
*   Status: ready-for-dev
*   Ultimate context engine analysis completed - comprehensive developer guide created.
