# Story 1.4: Search for events

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.4
- **Status:** ready-for-dev

## User Story
**As a** user,
**I want** to be able to search for events by name, performer, and location,
**So that** I can find specific events I am interested in.

## Acceptance Criteria
*   **Given** I am on the main page of the application,
*   **When** I type a search query in the search bar and press enter,
*   **Then** the list of events is filtered to show only events that match the search query.
*   **And** the search is performed on the event name, performers, and location name.
*   **And** the search supports partial matching.

## Developer Context

### Architecture & Technical Requirements
- **Unified Query DSL (AD-1):** The search functionality **must** leverage the Unified Query DSL. The search input should translate to a nested `"or"` condition checking for partial matches (`"contains"`) on `eventName`, `performers`, and `locationName` fields.
- **Combined Queries:** The search condition **must** be combined with the default "ongoing or upcoming" filter (from Story 1.3) using an `"and"` operator.
- **URL State Management:** In Next.js 15+, search state should be managed via URL query parameters (e.g., `?q=search_term`). This allows for shareable links, server-side data fetching, and native browser navigation.
- **Database Performance:** According to `project-context.md`, columns frequently used in `WHERE` clauses **must** be indexed. Ensure database migrations add indexes for `eventName`, `performers`, and `location` columns to ensure fast search queries.
- **Internationalization (i18n):** The search bar placeholder and any related text must be localized using `next-intl`.
- **UI Components:** Use `Shadcn/ui` for the search input. Following UX-DR17, microcopy should be clear and concise.

### Previous Story Intelligence
- **From Story 1.3:** The main page `page.tsx` was set up to fetch ongoing events using the Unified Query DSL. The new search functionality should hook into this existing data fetching logic, extending the DSL payload to include the search term.

### File Structure Requirements
- `apps/web/app/page.tsx`: Read URL search parameters and pass them to the GraphQL query.
- `packages/ui/src/components/events/SearchBar.tsx`: A new client component that updates the URL search params when the user types and presses enter. (Reusable UI Component)
- `packages/domain/src/events/`: Ensure the GraphQL query resolver and the DSL parser fully support the `"or"` operator and the `"contains"` operator across the required fields. (Reusable Domain Logic)
- `packages/database/`: Check or add a migration script via `drizzle-kit` to ensure indexes are present for `eventName`, `performers`, and `locationName`.

### Dev Notes (Custom Rules)
- **UI Components:** Because this story requires UI components that should be reusable (e.g. SearchBar), these components must be created inside `packages/ui` as per project rules.
- **Domain Logic:** Because this story requires a function/mechanism that should be reusable (e.g. GraphQL resolver, DSL parser logic), explicitly create them inside `packages/domain`.

### Project Context Reference
- **API Style (GraphQL):** All client-server data fetching must use GraphQL.
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **Pure Business Logic:** Any additions to the DSL parser must live in `packages/domain` and be 100% unit tested.
- **Database Access:** Handled exclusively through Drizzle ORM.

## Completion Status
*   Status: ready-for-dev
*   Ultimate context engine analysis completed - comprehensive developer guide created.
