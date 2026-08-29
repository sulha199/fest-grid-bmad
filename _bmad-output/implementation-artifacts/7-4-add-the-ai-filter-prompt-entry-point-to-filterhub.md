# Story 7.4: Add the AI filter prompt entry point to FilterHub

## 1. Story Requirements

**As a** user with a saved Gemini API key,
**I want** to see an AI prompt entry point in FilterHub that accepts natural language queries,
**So that** I can describe what I'm looking for and instantly see matching events without manually adjusting multiple filters.

**Acceptance Criteria:**
* **Given** a user has a saved Gemini API key (checked via the existing `useHasApiKey()`/`useApiKeyStatus()` hook, `apps/web/src/features/onboarding/use-has-api-key.ts` — not a client-side "onboardingState" object, which doesn't exist; that hook already queries `myApiKeys` via the generated `useGetMyApiKeysQuery`) and is viewing the Discovery Feed/Map,
* **When** they look at FilterHub, **then** an AI "magic wand" icon/button (matching the visual prominence of PRD §3.15's mockups) is present.
* **And** clicking it opens a full-screen overlay for prompt entry, matching PRD §3.15's "no inline input, always a focused overlay" constraint — no inline text fields in the main FilterHub row.
* **And** a user *without* a saved key never sees this entry point or the overlay.
* **And** submitting a prompt calls `resolvePromptToEventFilter` (Story 7.2a) synchronously; while awaiting the response, the overlay uses the existing `BlockingLoader` (Story 1.7a) full-screen pattern — the same one Section 3.12's other data-extraction actions already use — not a lighter-weight inline spinner.
* **And** on a successful resolve, the resolved `EventFilterInput` (Story 7.1a) is applied to Discovery's query state (reusing the existing URL-state mechanism, AD-4/`nuqs`, that FilterHub's manual controls already use) and FilterHub's manual controls are replaced by a single collapsed row showing Story 7.3's rendered summary plus clear/expand actions — the manual controls and the collapsed AI-filter row are never shown stacked together.
* **And** clicking "clear" on the collapsed row discards the active AI filter and restores FilterHub's manual controls in their prior state (not a full page reset).
* **And** clicking "expand" (or otherwise adjusting a manual control while an AI filter's collapsed row is showing) changes only the current browsing session's query state — it never mutates a saved `AIEventFilter` record (Story 7.2a), matching PRD §3.15's "Saving and Reuse" bullet.
* **And** a resolution error (including `NO_API_KEY`, which should be unreachable given the entry point is hidden without a key, but is still handled defensively) surfaces inline in the overlay, not a silent failure or an uncaught rejection.

**Note:** The two rejected alternatives from PRD §3.15 (a general open-dialogue chatbot; a dedicated "AI mode" toggle hiding FilterHub entirely) are explicitly out of scope — this story implements only the icon-trigger-plus-overlay design the PRD already settled on.

**Depends on:** Story 7.1a, Story 7.2a, Story 7.3, Story 1.5, Story 1.7a.

## 2. Developer Context Section

### Technical Requirements
- Implement the AI entry point's *presentational* shell (trigger button, full-screen overlay, loading/error display) as prop-driven components in `packages/ui` — matching `FilterHub.tsx`'s own existing split (it takes `FilterHubProps`, no direct data-fetching). Visibility (`hasApiKey`), the mutation call, and URL-state wiring belong in the `apps/web` call site(s) that already render `FilterHub` (`packages/ui/src/features/events/FilterHub.tsx` is consumed by `home-content.tsx` and similar `apps/web/src/app/[locale]/*-content.tsx` files) — mirroring Story 1.3i's precedent, where a new toggle's *behavior* was wired at the `apps/web` call site, not built into the `packages/ui` primitive itself. Do not call `useHasApiKey()` or any GraphQL hook from inside `packages/ui`.
- Use a full-screen overlay for the prompt input, avoiding inline text fields.
- Call the generated `resolvePromptToEventFilter` mutation hook (from `apps/web/src/generated/graphql.ts`, react-query-based — see Architecture Compliance) on submission, from the `apps/web` call site.
- Use the existing `BlockingLoader` component during the mutation request.
- Apply the resolved `EventFilterInput` to the URL state via `nuqs`.
- Replace manual filter controls with `renderAIFilterSummary` (from Story 7.3) when an AI filter is active, providing `clear` and `expand` actions.
- Ensure state transitions correctly restore manual controls upon clearing the AI filter.
- Handle mutation errors gracefully within the overlay.

### Architecture Compliance
- State must be managed through URL (`nuqs`) for Discovery query state, keeping it strictly compatible with manual filter controls.
- UI components should align with Shadcn/ui standards and exist in the `@festgrid/ui` workspace where reusable — but `packages/ui` stays presentational/prop-driven only, per its established split from `apps/web`'s data-fetching layer.
- **The GraphQL client is `graphql-request` + TanStack React Query (`typescript-react-query` codegen plugin, see `apps/web/codegen.ts`), not Apollo Client** — this project doesn't use Apollo anywhere. Consume the mutation via its generated hook (e.g. `useResolvePromptToEventFilterMutation`) and `graphqlClient` from `apps/web/src/lib/graphql-client`, the same way `use-has-api-key.ts` consumes `useGetMyApiKeysQuery`.

### Library & Framework Requirements
- React 19 / Next.js 15+ App Router
- Shadcn/ui & Tailwind CSS
- `nuqs` for URL search parameter state management
- GraphQL Code Generator (`graphql-request` + TanStack React Query) for strictly typed queries/mutations — no Apollo Client.

### File Structure Requirements
- Update `packages/ui/src/features/events/FilterHub.tsx` (or where FilterHub lives).
- Introduce a new overlay component in `@festgrid/ui` (e.g., `packages/ui/src/features/events/AIFilterOverlay.tsx`) if not existing.
- Utilize the `BlockingLoader` component in the frontend app.
- Ensure GraphQL queries/mutations are added to the frontend `.graphql` operations files to generate hooks.

### Testing Requirements
- E2E happy path using Playwright for opening the overlay, entering a prompt, and seeing the summary replace manual controls.
- Integration tests simulating the `resolvePromptToEventFilter` response and verifying URL state update.
- Verify error handling (e.g., network failure, validation failure) is surfaced correctly in the overlay.
- Maintain existing overall project test coverage.

### Data Type Compatibility Requirements
- Input to `resolvePromptToEventFilter` must strictly match the GraphQL schema.
- Ensure `EventFilterInput` structure applied to URL state aligns with `nuqs` parsers.
- Any manual control adjustments modifying the AI filter state must decouple from any `AIEventFilter` entity ID to prevent mutating saved records.

## 3. Project Context Reference
- Ensure all styling strictly adheres to the established Tailwind CSS and Shadcn/ui rules.
- Review `_bmad-output/project-context.md` if further clarification is needed regarding the codebase's strict workspace segregation.

## 4. Story Completion Status
Status: ready-for-dev
Ultimate context engine analysis completed - comprehensive developer guide created
