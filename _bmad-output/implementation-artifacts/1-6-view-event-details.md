# Story 1.6: View event details

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.6
- **Status:** ready-for-dev

## User Story
**As a** user,
**I want** to be able to click on an event to see its full details,
**So that** I can get all the information I need about the event.

## Acceptance Criteria
*   **Given** I am on the main page of the application,
*   **When** I click on an event card,
*   **Then** a modal or a new page appears with the full details of the event.
*   **And** the details include the event name, description, date and time, location, performers, and any other relevant information.
*   **And** the event details are fetched from the database.
*   **And** when source post metadata exists, the event details display:
    *   A link to the original social media post, constructed from `postId`, `platformId` (social media platform), and scraper source data.
    *   A link to the proxy-platform post URL, constructed from `postId`, `platformId` (social media platform), and scraper source data.
*   **And** full source URLs are **not** stored in the database; URL generation happens at read/render time from stored metadata.
*   **And** when opened from a list context, Next/Previous navigation respects current search/filter/sort context.
*   **And** when accessed via direct deep-link without list context, details render correctly without requiring Next/Previous context navigation.
*   **And** modal route and full-page route render the same event detail data shape and error/loading states.
*   **And** all static labels in the detail view are localized via `next-intl`.
*   **And** integration tests validate the GraphQL by-slug query behavior and E2E tests validate modal open and deep-link fallback behavior.

## Developer Context

### Architecture & Technical Requirements
- **Next.js Parallel & Intercepting Routes:** To meet UX-DR14 ("Clicking on an event card or schedule opens a modal with full event details and updates the URL"), you **must** use Next.js parallel routes (`@modal`) combined with intercepting routes (`(.)events/[slug]`).
  - The direct route `/events/[slug]` must serve the full page view of the event.
  - The intercepted route `/@modal/(.)events/[slug]` must serve the event in a modal overlay over the current page.
- **URL Structure:** Use the event's `slug` for the URL (e.g., `/events/my-awesome-event`).
- **Data Fetching (GraphQL):** 
  - Define a new GraphQL query (e.g., `query GetEventBySlug($slug: String!)`) to fetch a single event.
  - The backend resolver (in `apps/backend`) fetches the event by slug directly via Drizzle, using the generic `buildOptimizedDrizzleSelect` function so the query only selects the fields requested by the GraphQL operation. Do **not** put this DB fetch in `packages/domain` — per `project-context.md`'s domain-purity rule, a Drizzle-coupled query belongs in `apps/backend` (or `packages/graphql-select`), not `packages/domain`.
  - Ensure the event details payload includes source-link construction metadata (`postId`, `platformId`, scraper source data). Do **not** rely on persisted full URLs in the database.
  - Implement deterministic URL builders for original social post and proxy-platform post URLs as pure functions in `packages/domain/src/events/`; if required metadata is missing, return `null`.
- **Component UI Requirements:**
  - Create an `EventDetails` UI component that accepts the fetched event data and displays `eventName`, `description`, `location`, `types`, `categories`, and `schedules` (including dates, times, and `performers`).
  - Use Shadcn/ui `Dialog` components for the modal implementation to ensure accessibility and consistent styling.
  - Ensure shared rendering parity: the same core `EventDetails` component shape is used for both direct page and intercepted modal routes.
  - Render both source links ("Original Post" and "Proxy Post") when available, and hide each link when its constructed URL is `null`.
- **Internationalization (i18n):** All static labels in the event details view (e.g., "Location:", "Performers:", "Date & Time:") must be translated using `next-intl`.

### Previous Story Intelligence
- **From Story 1.3:** The `EventCard` component was created to display events on the main page. This component needs to be updated. You must wrap the entire card (or the primary clickable area) with a Next.js `<Link href={\`/events/${event.slug}\`}>` to trigger the route interception.
- **From Story 1.1 & 1.2:** The `slug` field is present in the `events` table and populated by the seed script. Ensure the GraphQL schema exposes the `slug`.

### Dev Notes (Custom Rules)
- **UI Components (Navigation):** Create a reusable `ContextAwareNavigation` (Next/Prev) component inside `packages/ui` that reads the list context.
- **UI Components (Loaders):** Create a reusable `Skeleton` loader component for the detail view to use during initial load or when transitioning between next/previous items.
- **Hooks (List Context):** Create a reusable hook (e.g., `useListContext`) strictly inside `packages/ui/src/hooks/` (NO React code is allowed in `packages/domain`) to easily pass and retrieve list context (search, filters, sort) for the detail view navigation.
- **State Management:** Because this story requires state management, explicitly categorize the state into URL State (nuqs) to capture the previous list context, and Server State (React Query) to fetch specific event details from the cache or backend..
- **Analytics:** Because this story requires tracking user interactions or adding user-analytics, explicitly include adding PostHog analytics actions. Track an "Event Details Viewed" event containing the event ID and name when the details modal or page is opened.

### File Structure Requirements
- `apps/web/app/layout.tsx`: Update to accept `modal` as a React Node prop and render it alongside `children`.
- `apps/web/app/events/[slug]/page.tsx`: Create the full-page view for direct access.
- `apps/web/app/@modal/(.)events/[slug]/page.tsx`: Create the intercepted route view that renders the `Dialog` modal.
- `apps/web/components/events/EventDetails.tsx`: Create a shared UI component for displaying the event data, used by both the page and the modal.
- `apps/web/components/events/EventCard.tsx` (or wherever the card is defined): Update to include the Next.js `Link` to `/events/[slug]`.
- `packages/shared-types/src/index.ts` and GraphQL event types: include `postId`, `platformId`, and scraper source metadata plus optional constructed URLs used by the UI.
- `packages/domain/src/events/`: Implement the pure source-link URL-builder helpers (original post / proxy post). No DB/ORM access — these must be 100% unit-tested and dependency-free of `drizzle-orm`/`@festgrid/database`.
- `apps/backend`: Implement the by-slug fetch (Drizzle query via `buildOptimizedDrizzleSelect`) and the resolver that fetches the event and calls the `packages/domain` URL builders to populate the source links.
- `packages/database/src/schema/`: Ensure no schema changes are needed, but verify `slug` is uniquely queryable.
- GraphQL Schema and Resolvers: Update to include the new query for fetching an event by slug and ensure `buildOptimizedDrizzleSelect` is utilized.

### Project Context Reference
- **API Style (GraphQL):** All client-server data fetching must use GraphQL.
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **Pure Business Logic:** Any pure, framework-agnostic logic (e.g. the source-link URL builders) must live in `packages/domain` and be 100% unit tested. The actual DB fetch is Drizzle/ORM-coupled and must live in `apps/backend`, not `packages/domain`, per `project-context.md`'s domain-purity rule.
- **Database Access:** Handled exclusively through Drizzle ORM.

## Testing Requirements
- Add integration tests for `GetEventBySlug` resolver behavior and field selection compatibility.
- Add integration/UI tests for source links: both shown when constructible, only one shown when partial metadata exists, none shown when metadata is missing.
- Add unit tests for URL-construction helpers to verify both URLs are derived from `postId` + `platformId` + scraper source data (without DB-stored full URLs).
- Add E2E tests for:
  - opening detail modal from list,
  - direct navigation to `/events/[slug]`,
  - deep-link fallback without list context.

## Deliverables Checklist
- Shared `EventDetails` rendering component.
- Full-page route and intercepted modal route.
- By-slug GraphQL query and resolver using optimized select logic.
- Context-aware navigation behavior with safe deep-link fallback.
- Integration and E2E coverage for core detail flows.

## Out of Scope
- Editing/correcting event data (Epic 4).
- Favorites and calendar-add flows (Epic 2).

## Definition of Done
- Detail route works for modal and full-page access.
- Context-aware navigation works when context exists; deep-link fallback works when it does not.
- Localization and analytics hooks are implemented.
- Lint and type checks pass for touched packages.

## Completion Status
*   Ultimate context engine analysis completed - comprehensive developer guide created.