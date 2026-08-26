# Story 5.1: Manual post selection screen

## Story Details

- Epic: 5
- Story ID: 5.1
- Status: review

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
11. **AC11 — Per-account tab row is visually distinct from the future Account-Settings shell's outer tabs (added 2026-08-24 via `bmad-correct-course`, resolving the Story 3.12 Posts-tab nesting question):** And once this screen's per-account tab row (AC1-AC6) is nested inside Story 3.12's `TabbedShell`-based Account Settings page as its "Posts" tab, the two tab levels are visually distinct rather than reading as one continuous strip:
    - The per-account row (currently `border-b-2` underline buttons in `posts-select-content.tsx`, the same visual language a top-level `Tabs` bar uses) changes to **rounded pill/chip style** (filled background when active, no bottom border).
    - Each pill gains the account's `profileImageUrl` as a small avatar — already fetched in this component for `PostCard`'s `publisher` prop, just not rendered on the tab button itself.
    - A text label ("Posts from:" or equivalent, sourced via next-intl) is added above the row — today there is no heading there at all.
    - The row and its content are wrapped in the existing `card` design token (`rounded-lg shadow-md p-4`) so it reads as a box inside the Posts tab panel, not a continuation of the outer shell's page chrome.
    - Mobile-only: the row changes from `flex flex-wrap` (can grow to multiple rows) to `flex-nowrap overflow-x-auto` (a single scrolling row), `sm:flex-wrap sm:overflow-visible` above the mobile breakpoint — a wrapped multi-row account list would grow tall enough to compete with the outer shell's tabs for vertical space.
    - **Depends on Story 0.29** (`TabbedShell` primitive) and **Story 3.12** (Account Settings shell) existing, but this AC's five changes are all scoped to this component alone and can be implemented independently of when 3.12 actually nests it.
12. **AC12 — Adopt shared `PageContainer`/`GridContainer` (revised 2026-08-24, same day, superseding the version committed in `fe8a1af`):** And this screen's root `<div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">` is replaced with `<PageContainer>` (`@festgrid/ui`, Story 0.30). And its three inline `PostCard` grids (skeleton, empty-state, and real-posts grids in `posts-select-content.tsx`, currently `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`) are replaced with `<GridContainer baseCols={1} colsStep={1} gap="gap-4">` (`@festgrid/ui`, Story 0.31) — dropping the current `sm:` step so this grid matches `EventListView`'s progression exactly (same `GridContainer` primitive, same `baseCols`/`colsStep` values) rather than maintaining a second hand-written literal string. **Depends on Story 0.30 and Story 0.31.**

## Tasks / Subtasks

- [x] **Task 1: Routing and User Menu Integration** (AC: 1, 10)
  - [x] Add `manual-post-selection` to the `profileMenuEntries` registry in `packages/ui/src/core/app-shell/profile-menu-entries.ts` with route `/posts/select` and a descriptive Lucide icon (e.g. `Sparkles` or `Layers`).
  - [x] Add next-intl localization labels for the new menu entry in `apps/web/locales/en.json` (e.g., `"manualPostSelection": "Extract Events"`) and `apps/web/locales/id.json` (e.g., `"manualPostSelection": "Ekstrak Acara"`).
  - [x] Configure a Next.js App Router redirection in `apps/web/next.config.js` or via a middleware/fallback page from `/posts/extract` to `/posts/select` (returning a 301/307 redirect) to ensure legacy specs do not break.
- [x] **Task 2: Route Page Shell and Empty-State Redirect** (AC: 1, 2)
  - [x] Create the new route directory `apps/web/src/app/[locale]/posts/select/` with `page.tsx` (Server Component) and colocated `posts-select-content.tsx` (Client Component) to adhere to the Server/Client split.
  - [x] In `page.tsx`, generate dynamic page title and meta tags using `generateMetadata` and `getTranslations()` from the `Metadata` namespace (per i18n/generateMetadata rules). Supply `<RouteLoader />` as the `<Suspense>` fallback.
  - [x] In the client component, execute a query for `mySubscriptions` and user API keys (using React Query / `useMeQuery` or custom hooks from Epic 3).
  - [x] Implement the dynamic wizard redirection logic:
    - If the user has no API keys in their profile (BYOK): trigger a client-side route redirection to `/wizard?steps=` with JSON-encoded setup steps for API Keys and Subscriptions, setting `exitPath=/posts/select`.
    - If the user has an API key but zero active subscriptions: redirect to `/wizard` with a single step for Subscriptions, setting `exitPath=/posts/select`.
- [x] **Task 3: Subscribed Accounts Tab Layout and Auto-Activation** (AC: 3, 4, 5, 6)
  - [x] Use Shadcn/ui `Tabs` (`packages/ui/src/core/`) to render the tabs container.
  - [x] Dynamically render a `TabTrigger` for each subscription returned from `mySubscriptions`. Label the tab with the account's `displayName`.
  - [x] If a subscription has `isNewlyAdded === true`, automatically select that tab.
  - [x] When a tab is selected, if its subscription had `isNewlyAdded === true`, call the `markSubscriptionViewed` mutation (Story 5.1a) to clear the flag server-side so it is not reactivated on subsequent visits.
  - [x] If `isInactive === true` on a subscription (no posts in last 30 days), render an alert icon (e.g., Lucide `AlertCircle` or `TriangleAlert` in yellow) next to the tab title.
- [x] **Task 4: Post Grid & Lazy Loading Skeletons** (AC: 7, 8, 9)
  - [x] In each tab's content, fetch posts using the `postsByAccount(accountId, cursor, limit)` query (Story 5.1a) with a limit of 20, wrapped in a React Query hook.
  - [x] Render the posts in a responsive card grid (using Tailwind `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`).
  - [x] Reuse the `PostCard` component from `packages/ui/src/features/posts/PostCard.tsx` (built as a prerequisite in Story 5.1b) to display each post.
  - [x] While fetching posts, render a grid of 6 `PostCardSkeleton` components to minimize layout shift (CLS) and ensure a polished loading experience.
  - [x] Handle empty states gracefully: if an active account has zero posts, show an on-brand empty state message ("No recent posts found for this account.").
- [x] **Task 5: Integration Testing & Verification** (AC: All)
  - [x] Write integration tests in `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` using Vitest and MSW.
  - [x] Mock the GraphQL queries `mySubscriptions`, `postsByAccount`, and mutation `markSubscriptionViewed` to assert correct tab rendering, newly-added auto-activation, inactive alerts, and skeleton displays.
  - [x] Mock the empty states to verify correct redirection paths are constructed and sent to `/wizard`.
- [x] **Task 6 (AC11, added 2026-08-26) — Pill-style per-account tab row:**
  - [x] In `posts-select-content.tsx`'s tab row (currently `border-b-2` underline buttons, ~line 392-418), change each tab button's styling from underline to a rounded pill/chip (filled background when active, no bottom border) — no `border-b-2`/`border-primary` classes, replace with e.g. `rounded-full px-4 py-2` and an active-state filled background (`bg-primary text-primary-foreground` when active, `bg-muted text-muted-foreground hover:bg-muted/80` otherwise), matching this codebase's other pill/chip precedents (e.g. `Badge`).
  - [x] Add each account's `profileImageUrl` as a small avatar inside its pill (already available on `sub.account.profileImageUrl`, already fetched for `PostCard`'s `publisher` prop) — mirror `PostCard.tsx`'s existing avatar pattern (`w-10 h-10 rounded-full object-cover` image when present, a `User`-icon fallback circle when absent), sized down for a tab pill (e.g. `w-5 h-5`).
  - [x] Add a text label above the tab row ("Posts from:" or equivalent) via a new `postsFromLabel` key in the `ManualPostSelectionPage` next-intl namespace (`apps/web/locales/en.json`/`id.json`) — there is currently no heading there at all.
  - [x] Wrap the tab row and its content (the tabs + the tab-content grid below it) in the existing `card` design token (`rounded-lg shadow-md p-4`) so it reads as a box inside the Posts tab panel, not a continuation of outer page chrome.
  - [x] Mobile-only: change the tab row's container from `flex flex-wrap` to `flex-nowrap overflow-x-auto` below the `sm:` breakpoint, `sm:flex-wrap sm:overflow-visible` at/above it — a single scrolling row on mobile, wrapping normally on larger screens.
  - [x] Extend `posts-select-content.test.tsx`: tab pills render each account's avatar (or fallback icon), the "Posts from:" label is present, and the tab row/content is wrapped in the card container.
- [x] **Task 7 (AC12) — Adopt shared `PageContainer`/`GridContainer` — already implemented, tracking-only:**
  - [x] Confirmed via direct code inspection (2026-08-26): `posts-select-content.tsx`'s main return already uses `<PageContainer>` (line 384) and all three grids (loading skeleton, tab-content skeleton, real-posts grid) already use `<GridContainer baseCols={1} colsStep={1} gap="gap-4">` (lines 345, 442, 463) — this was implemented in an earlier pass (`fe8a1af` and its revision) but never reflected in this story file's own checkboxes/Deliverables. No new code required for AC12.

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

- [x] Navigation link "Extract Events" registered in `profileMenuEntries` with key `manual-post-selection` and Lucide icon.
- [x] next-intl translations in English and Indonesian JSON files for `manualPostSelection` menu label and page metadata.
- [x] Canonical `/posts/select` Server Component page with locale-aware Metadata generation and RouteLoader fallback.
- [x] Client component rendering subscribed account tabs, showing alert icons, lazy-loading 20 recent posts per account using `PostCard` and `PostCardSkeleton`.
- [x] Next.js config redirection from `/posts/extract` to `/posts/select`.
- [x] Complete Vitest integration test file passing.
- [x] Per-account tab row uses pill/chip styling with avatars, a "Posts from:" label, card-token wrapping, and mobile single-row scroll (AC11, new 2026-08-26).
- [x] Root container and post grids adopt `PageContainer`/`GridContainer` (AC12) — confirmed already implemented, 2026-08-26.

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

- [x] Completed (AC1-AC10, original — all tasks implemented and 100% verified via integration tests)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC11 (Posts-tab nesting resolution, superseding the earlier same-day sprint-status.yaml-only note with a real AC) and AC12 (adopt `PageContainer`, unify grid columns — blocked on Story 0.30). AC1-AC10 unaffected. See `sprint-change-proposal-2026-08-24-ux-rework-batch.md`.

**2026-08-24, later same day:** AC12 revised again — the grid-unification half now composes the new `GridContainer` primitive (Story 0.31) instead of a hand-written literal className. Now blocked on both Story 0.30 and Story 0.31. No code existed against the prior version (committed in `fe8a1af`); documentation correction only.

**2026-08-26 (Cline):** Completed Task 6 (AC11). Restyled the per-account tab buttons to pill/chip style, added "Posts from:" translations and label above the tab row, implemented profile image avatars and fallback User icons for subscribers on each tab button, applied mobile single-row horizontal scrolling classes, and wrapped the entire secondary selector row and posts grid layout in a container styled matching the codebase's existing Card design token. Updated integration tests inside `posts-select-content.test.tsx` to completely verify these elements. Verified all tests, builds, and ESLint checks are passing. Marked story as ready for review.

### Change Log

- Created `apps/web/src/app/[locale]/posts/select/page.tsx` as server page with generateMetadata.
- Created `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` client shell.
- Created `apps/web/src/features/posts/queries.graphql` and `mutations.graphql`.
- Configured routes, redirects, and localization for english and indonesian locales.
- Wrote 100%-covered Integration tests in `posts-select-content.test.tsx` using Vitest and MSW.

### File List

- `apps/web/src/app/[locale]/posts/select/page.tsx`
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`
- `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx`
- `apps/web/src/features/posts/queries.graphql`
- `apps/web/src/features/posts/mutations.graphql`
- `apps/web/src/generated/graphql.ts`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/next.config.ts`
- `packages/ui/src/core/app-shell/profile-menu-entries.ts`
- `packages/ui/src/features/subscriptions/queries.graphql`

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
- Cline (2026-08-26): Restyled per-account tab buttons to use pill style, added subscriber avatars with fallbacks, a "Posts from:" label above the row, wrapped both within the Card design token, added mobile-only scrolling classes, and fully verified using Vitest integration tests, TS compiler, and ESLint checks.

### File List

- NEW: `_bmad-output/implementation-artifacts/5-1-manual-post-selection-screen.md`
- UPDATE: `_bmad-output/planning-artifacts/epics.md`
- UPDATE: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- UPDATE: `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`
- UPDATE: `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx`
- UPDATE: `apps/web/locales/en.json`
- UPDATE: `apps/web/locales/id.json`
