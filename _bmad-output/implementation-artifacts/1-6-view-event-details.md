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

## Developer Context

### Architecture & Technical Requirements
- **Next.js Parallel & Intercepting Routes:** To meet UX-DR14 ("Clicking on an event card or schedule opens a modal with full event details and updates the URL"), you **must** use Next.js parallel routes (`@modal`) combined with intercepting routes (`(.)events/[slug]`).
  - The direct route `/events/[slug]` must serve the full page view of the event.
  - The intercepted route `/@modal/(.)events/[slug]` must serve the event in a modal overlay over the current page.
- **URL Structure:** Use the event's `slug` for the URL (e.g., `/events/my-awesome-event`).
- **Data Fetching (GraphQL):** 
  - Define a new GraphQL query (e.g., `query GetEventBySlug($slug: String!)`) to fetch a single event.
  - The backend resolver must use a specific domain function `getEventBySlug` (or similar) from `packages/domain` to fetch the data.
  - You **must** utilize the generic `buildOptimizedDrizzleSelect` function in the resolver to ensure the Drizzle query only selects the fields requested by the GraphQL operation.
- **Component UI Requirements:**
  - Create an `EventDetails` UI component that accepts the fetched event data and displays `eventName`, `description`, `location`, `types`, `categories`, and `schedules` (including dates, times, and `performers`).
  - Use Shadcn/ui `Dialog` components for the modal implementation to ensure accessibility and consistent styling.
- **Internationalization (i18n):** All static labels in the event details view (e.g., "Location:", "Performers:", "Date & Time:") must be translated using `next-intl`.

### Previous Story Intelligence
- **From Story 1.3:** The `EventCard` component was created to display events on the main page. This component needs to be updated. You must wrap the entire card (or the primary clickable area) with a Next.js `<Link href={\`/events/${event.slug}\`}>` to trigger the route interception.
- **From Story 1.1 & 1.2:** The `slug` field is present in the `events` table and populated by the seed script. Ensure the GraphQL schema exposes the `slug`.

### Dev Notes (Custom Rules)
- **Analytics:** Because this story requires tracking user interactions or adding user-analytics, explicitly include adding PostHog analytics actions. Track an "Event Details Viewed" event containing the event ID and name when the details modal or page is opened.

### File Structure Requirements
- `apps/web/app/layout.tsx`: Update to accept `modal` as a React Node prop and render it alongside `children`.
- `apps/web/app/events/[slug]/page.tsx`: Create the full-page view for direct access.
- `apps/web/app/@modal/(.)events/[slug]/page.tsx`: Create the intercepted route view that renders the `Dialog` modal.
- `apps/web/components/events/EventDetails.tsx`: Create a shared UI component for displaying the event data, used by both the page and the modal.
- `apps/web/components/events/EventCard.tsx` (or wherever the card is defined): Update to include the Next.js `Link` to `/events/[slug]`.
- `packages/domain/src/events/`: Implement `getEventBySlug` business logic. It must be 100% unit-tested.
- `packages/database/src/schema/`: Ensure no schema changes are needed, but verify `slug` is uniquely queryable.
- GraphQL Schema and Resolvers: Update to include the new query for fetching an event by slug and ensure `buildOptimizedDrizzleSelect` is utilized.

### Project Context Reference
- **API Style (GraphQL):** All client-server data fetching must use GraphQL.
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **Pure Business Logic:** Any additions to the data fetching logic must live in `packages/domain` and be 100% unit tested.
- **Database Access:** Handled exclusively through Drizzle ORM.

## Completion Status
*   Status: ready-for-dev
*   Ultimate context engine analysis completed - comprehensive developer guide created.