# Story 1.3: Display a list of events on the main page

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.3
- **Status:** ready-for-dev

## User Story
**As a** user,
**I want** to see a list of curated local events on the main page,
**So that** I can discover what's happening around me.

## Acceptance Criteria
*   **Given** I am on the main page of the application,
*   **When** the page loads,
*   **Then** I see a grid of event cards.
*   **And** each event card displays the event name, date, and main image.
*   **And** the events displayed are ongoing or upcoming.
*   **And** the event data is fetched from the database.

## Developer Context

### Architecture & Technical Requirements
- **API Style (GraphQL):** The backend API **must** use GraphQL for all client-server data fetching. Implement or use the primary GraphQL event query endpoint.
- **Unified Query DSL (AD-1 & AD-2):** All event collections must be retrieved through the primary event query endpoint using the Unified Query DSL. To fetch "ongoing or upcoming" events, the DSL query should filter events based on their end date being greater than or equal to the current date.
- **Drizzle ORM Queries:** GraphQL resolvers running in AWS Lambda **must** dynamically build Drizzle queries to select only the specific fields requested in the GraphQL operation to prevent over-fetching. Ensure we implement a generic strictly-typed function named `buildOptimizedDrizzleSelect` that translates GraphQL resolvers into an optimized Drizzle query. This function should be reused when reading data. Reference `C:\projects\portfolio\meta-api-benchmarker\packages\adapter-drizzle\src\adapters\DrizzleAdapter.ts` for an example implementation (only copy the AST optimization part for the select query, not the whole adapter structure).
- **Frontend Framework:** Use Next.js 15+ and React 19 features (like Server Components) for fetching and rendering data where appropriate to optimize performance (NFR1: Load in under 2 seconds).
- **Internationalization (i18n):** All user-facing components must use `next-intl` from the start.
- **UI Components:** Use `Shadcn/ui` components (Card, Grid, Event Card Compact) and follow the color palette (primary: "#1E293B", secondary: "#6366F1", accent: "#FF5A5F", neutral: "#FAFAFC", success: "#10B981", error: "#EF4444"). Base corner radius of 0.5rem.
- **Date Handling:** Display dates correctly according to the user's timezone or event timezone.
- **Code Organization:** Pure, framework-agnostic business logic **must** live in a dedicated `packages/domain` package (e.g., `/events`). UI components and API handlers should be lean.

### Previous Story Intelligence
- **From Story 1.2:** The database is seeded with mock event data containing various scenarios (ongoing, upcoming, past events). Ensure the GraphQL query properly filters out past events using the Unified Query DSL.

### File Structure Requirements
- `apps/web/app/page.tsx` (or similar main page route): The main Next.js page component.
- `apps/web/components/events/EventGrid.tsx`: Component for displaying the grid of events.
- `apps/web/components/events/EventCard.tsx`: Component for a single event card.
- `packages/domain/src/events/`: Pure business logic for fetching events via GraphQL and processing DSL queries.

### Project Context Reference
- Ensure all code strictly follows the TypeScript configurations from `@festgrid/typescript-config`.
- Pure business logic **must** live in `packages/domain` and be 100% unit tested.
- All new data structures entering from GraphQL must be validated with Zod on the frontend.
- Utilize PostgreSQL-specific data types directly imported from `drizzle-orm/pg-core`.

## Completion Status
*   Status: ready-for-dev
*   Ultimate context engine analysis completed - comprehensive developer guide created.