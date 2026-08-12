# Story 5.1: Manual post selection screen

## Story Details

- Epic: 5
- Story ID: 5.1
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a screen where I can see the most recent posts from my subscribed accounts,
so that I can choose which posts to process for event extraction.

## Acceptance Criteria

1.  **Given** I am on any page in the application,
    **When** I navigate to the "Manual Post Selection" screen from the user menu (registered under id `manual-post-selection`, route `/posts/select`),
    **Then** if I have not provided a Gemini API key or subscribed to any accounts, I am guided through the process of doing so using the wizard redirection logic.
2.  **And** the empty-state wizard redirection constructs a dynamic set of steps:
    - If API key is missing: `step 1: API Keys (/settings/api-keys)`, `step 2: Manage Subscriptions (/settings/subscriptions)`.
    - If only subscriptions are missing: `step 1: Manage Subscriptions (/settings/subscriptions)`.
    - Redirects to `/wizard` with these steps and `exitPath: "/posts/select"`.
3.  **And** if I have at least one subscribed account, I see a tab view at the top of the screen representing each of my subscribed accounts, fetched via the `mySubscriptions` query (Story 5.1a) — not directly from the database.
4.  **And** each tab title displays the `displayName` of the `SocialMediaAccountProfile` (e.g. "@WeekendWarriors").
5.  **And** if an account is newly added (`isNewlyAdded` is `true`), its tab is automatically activated on first visit. The `isNewlyAdded` flag is cleared via a call to the `markSubscriptionViewed` mutation (Story 5.1a) once that tab is opened.
6.  **And** if an account has become inactive (computed `isInactive` is `true`, i.e., no posts in the last 30 days), an alert icon is displayed next to the tab title.
7.  **And** the active tab displays the 20 most recent posts from that account, fetched via the `postsByAccount(accountId, cursor, limit)` query (Story 5.1a).
8.  **And** posts are displayed in a modern card-based grid layout, utilizing the reusable `PostCard` component (Story 5.1b, `packages/ui/src/features/posts/PostCard.tsx`).
9.  **And** posts are loaded lazily using a non-blocking skeleton loader (`PostCardSkeleton` from Story 5.1b) to minimize Cumulative Layout Shift (CLS) during transitions and initial load.
10. **And** the canonical route for this screen is `/posts/select`, and a redirection is configured from `/posts/extract` (used in older specs like Story 3.3) to `/posts/select` to prevent broken links.

## Tasks / Subtasks

- [ ] **Task 1: Routing and User Menu Integration** (AC: 1, 10)
  - [ ] Add `manual-post-selection` to the `profileMenuEntries` registry in `packages/ui/src/core/app-shell/profile-menu-entries.ts` with route `/posts/select` and a descriptive Lucide icon (e.g. `Sparkles` or `Layers`).
  - [ ] Add next-intl localization labels for the new menu entry in `apps/web/locales/en.json` (e.g., `"manualPostSelection": "Extract Events"`) and `apps/web/locales/id.json` (e.g., `"manualPostSelection": "Ekstrak Acara"`).
  - [ ] Configure a Next.js App Router redirection in `apps/web/next.config.js` or via a middleware/fallback page from `/posts/extract` to `/posts/select` (returning a 301/307 redirect) to ensure legacy specs do not break.
- [ ] **Task 2: Route Page Shell and Empty-State Redirect** (AC: 1, 2)
  - [ ] Create the new route directory `apps/web/src/app/[locale]/posts/select/` with `page.tsx` (Server Component) and colocated `posts-select-content.tsx` (Client Component) to adhere to the Server/Client split.
  - [ ] In `page.tsx`, generate dynamic page title and meta tags using `generateMetadata` and `getTranslations()` from the `Metadata` namespace (per i18n/generateMetadata rules). Supply `<RouteLoader />` as the `<Suspense>` fallback.
  - [ ] In the client component, execute a query for `mySubscriptions` and user API keys (using React Query / `useMeQuery` or custom hooks from Epic 3).
  - [ ] Implement the dynamic wizard redirection logic:
    - If the user has no API keys in their profile (BYOK): trigger a client-side route redirection to `/wizard?steps=` with JSON-encoded setup steps for API Keys and Subscriptions, setting `exitPath=/posts/select`.
    - If the user has an API key but zero active subscriptions: redirect to `/wizard` with a single step for Subscriptions, setting `exitPath=/posts/select`.
- [ ] **Task 3: Subscribed Accounts Tab Layout and Auto-Activation** (AC: 3, 4, 5, 6)
  - [ ] Use Shadcn/ui `Tabs` (`packages/ui/src/core/`) to render the tabs container.
  - [ ] Dynamically render a `TabTrigger` for each subscription returned from `mySubscriptions`. Label the tab with the account's `displayName`.
  - [ ] If a subscription has `isNewlyAdded === true`, automatically select that tab.
  - [ ] When a tab is selected, if its subscription had `isNewlyAdded === true`, call the `markSubscriptionViewed` mutation (Story 5.1a) to clear the flag server-side so it is not reactivated on subsequent visits.
  - [ ] If `isInactive === true` on a subscription (no posts in last 30 days), render an alert icon (e.g., Lucide `AlertCircle` or `TriangleAlert` in yellow) next to the tab title.
- [ ] **Task 4: Post Grid & Lazy Loading Skeletons** (AC: 7, 8, 9)
  - [ ] In each tab's content, fetch posts using the `postsByAccount(accountId, cursor, limit)` query (Story 5.1a) with a limit of 20, wrapped in a React Query hook.
  - [ ] Render the posts in a responsive card grid (using Tailwind `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`).
  - [ ] Reuse the `PostCard` component from `packages/ui/src/features/posts/PostCard.tsx` (built as a prerequisite in Story 5.1b) to display each post.
  - [ ] While fetching posts, render a grid of 6 `PostCardSkeleton` components to minimize layout shift (CLS) and ensure a polished loading experience.
  - [ ] Handle empty states gracefully: if an active account has zero posts, show an on-brand empty state message ("No recent posts found for this account.").
- [ ] **Task 5: Integration Testing & Verification** (AC: All)
  - [ ] Write integration tests in `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` using Vitest and MSW.
  - [ ] Mock the GraphQL queries `mySubscriptions`, `postsByAccount`, and mutation `markSubscriptionViewed` to assert correct tab rendering, newly-added auto-activation, inactive alerts, and skeleton displays.
  - [ ] Mock the empty states to verify correct redirection paths are constructed and sent to `/wizard`.

## Dev Notes

- **URL State & Navigation:** Navigation to this page must support passing a custom `subscriptionId` or similar parameter via the URL if redirected from elsewhere, which can also be used to pre-select a tab.
- **Packages & Dependencies:**
  - UI components (tabs, alert icons, loaders) must be imported from `@festgrid/ui`.
  - Client state management must be handled with React Query and `@tanstack/react-query` strictly within `apps/web`.
  - Do not let backend ORM/Drizzle types leak into the frontend components. Use generated types from GraphQL Code Generator.
- **Loader Invariant Alignment:** Initial tab and grid loading must utilize a skeleton grid matching the card structure, not a monolithic spinner. Global route transitions are covered by `<RouteLoader />` via route-level Suspense fallback.

### Architecture & UX Gate Findings

- **Gate 1 — Architecture/Infrastructure Completeness:** Cited from the swept `epic-5-readiness.md` report. The backend API layer is completely missing for Epic 5. This was split off into Story `5.1a` ("Build the manual post selection & extraction GraphQL API layer") as a mandatory backend prerequisite. This story depends entirely on `5.1a`'s query contracts.
- **Gate 2 — UI Complexity & Reusability:** Run fresh. The `PostCard` component is a complex, reusable UI card with text, image, fallbacks, skeletons, and selection checkboxes. To ensure focused refinement on its loading, image error-handling, and interactive states, it was split off into prerequisite Story `5.1b` ("Build the reusable PostCard component") rather than being built inline. Story `5.1` will import and consume `PostCard` and `PostCardSkeleton` directly from `packages/ui/src/features/posts/`.
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness:** Cited from the swept `epic-5-readiness.md` report. No new cross-cutting foundation gaps were found. Reuses Epic 0's existing structures.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No changes required for this story.
- **Rationale:** This is a pure frontend feature story that only reads from the GraphQL queries and mutations established in Story `5.1a` and renders them using the component built in Story `5.1b`. It introduces no database schemas or new backend contracts itself. All data types are fully aligned with the standard `Subscription` and `Post` entities.

### Project Structure Notes

- **Alignment with unified project structure:**
  - Route folder: `apps/web/src/app/[locale]/posts/select/`
  - Client view logic: `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`
  - Reusable `PostCard` (from Story 5.1b): `packages/ui/src/features/posts/PostCard.tsx`
- **Detected conflicts or variances:** None. Follows established Next.js App Router and `@festgrid/ui` split patterns.

### References

- [Source: design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.5-manual-post-selection.md] — Page purpose, tab view, isNewlyAdded auto-activation, and inactive warnings.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md] — Epic-level sweep, backend layer requirements, and AC corrections.
- [Source: design-artifacts/UX-wizard-page-run-1/EXPERIENCE.md] — Onboarding wizard flow and useWizardStep integration details.

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Create `apps/web/src/app/[locale]/posts/select/page.tsx` (Route Server component + metadata)
  - Create `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (Client component logic)
  - Create `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` (Vitest integration tests)
  - Update `packages/ui/src/core/app-shell/profile-menu-entries.ts` (Add manual-post-selection to registry)
  - Update `apps/web/locales/en.json` & `id.json` (Add navigation translations)
  - Update `apps/web/next.config.js` (Configure `/posts/extract` -> `/posts/select` redirect)
- **Rule Mapping:**
  - Loader Invariant Rule -> Grid uses `PostCardSkeleton` (Story 5.1b) for non-blocking card loads. Route page Suspense fallback uses `<RouteLoader />` (Story 0.26).
  - Dynamic Page Title & Meta Tags -> Implemented in Server Component `page.tsx` via Next.js `generateMetadata` fetching from next-intl `Metadata` namespace.
  - State Management -> Ephemeral UI tabs and selection state managed natively / Zustand if crossed, queries fetched via `@tanstack/react-query`.
- **Verification Plan:**
  - Run type checks in `apps/web` and `packages/ui` via `pnpm tsc --noEmit`.
  - Execute the integration test file: `pnpm --filter web test src/app/[locale]/posts/select/posts-select-content.test.tsx`.
  - Verify that navigating to `/posts/select` without an API key or subscriptions triggers the router to push to `/wizard` with correct steps.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: The screen only displays subscribed accounts, shows alert icons, and retrieves 20 recent posts. Selection mechanics, quota bar, and extraction execution are deferred to Story 5.2 and 5.3.
- [ ] Architecture and boundary confirmation: Backend data is fetched exclusively via GraphQL Queries `mySubscriptions` and `postsByAccount` and Mutation `markSubscriptionViewed`. No direct DB calls.
- [ ] Testing plan confirmation: MSW intercepts established for GraphQL mocks. Integration tests assert redirection and tab rendering.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Story 5.1a (backend API) and Story 5.1b (PostCard primitive) are in-progress or backlog; they must reach an implemented/satisfactory state before coding Story 5.1.

## Testing Requirements

- [ ] Integration tests
- [ ] E2E tests

## Deliverables Checklist

- [ ] Navigation link "Extract Events" registered in `profileMenuEntries` with key `manual-post-selection` and Lucide icon.
- [ ] next-intl translations in English and Indonesian JSON files for `manualPostSelection` menu label and page metadata.
- [ ] Canonical `/posts/select` Server Component page with locale-aware Metadata generation and RouteLoader fallback.
- [ ] Client component rendering subscribed account tabs, showing alert icons, lazy-loading 20 recent posts per account using `PostCard` and `PostCardSkeleton`.
- [ ] Next.js config redirection from `/posts/extract` to `/posts/select`.
- [ ] Complete Vitest integration test file passing.

## Out of Scope

- **Selection Mechanics & summary bar:** Selecting posts (checkbox checks, Zustand store for multi-tab selection preservation) and rendering the summary bar are fully deferred to Story `5.2` (Select posts for extraction) and Story `5.3` (Display and enforce API quota).
- **Quota Enforcements:** Disabling checkboxes for processed posts (`isExtracted === true`) and remaining quota checking are deferred to Story `5.3`.
- **Inactive Tab Actions:** The "Remove Subscription" action and soft-delete/Undo dialogs inside the inactive tab content are deferred to Story `5.4` (Inactive account warning).
- **Wizard Page Chrome:** Building the global `/wizard` primitive itself (Story `0.24`) is out of scope.

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched packages

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro (Auto-Edit Specialization)

### Debug Log References

- Topic: "Initializing Story 5-1 Creation" (BMad workflow)
- Date of Analysis: Wednesday, 12 August 2026

### Completion Notes List

- Comprehensive ultimate context engine analysis completed.
- Reusable `PostCard` split off into prerequisite Story `5.1b` in strict compliance with Gate 2.
- Wizard redirection and `/posts/select` routing tradeoffs successfully resolved with the user.

### File List

- NEW: `_bmad-output/implementation-artifacts/5-1-manual-post-selection-screen.md`
- UPDATE: `_bmad-output/planning-artifacts/epics.md`
- UPDATE: `_bmad-output/implementation-artifacts/sprint-status.yaml`
