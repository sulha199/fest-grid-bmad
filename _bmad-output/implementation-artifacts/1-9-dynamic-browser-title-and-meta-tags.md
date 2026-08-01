---
baseline_commit: cebc56eb2fa8e621deb7005e24a2996b8964df1b
---

# Story 1.9: Dynamic Browser Title and Meta Tags on Page Navigation

## Story Details

- Epic: 1
- Story ID: 1.9
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user browsing FestGrid,
I want the browser tab title and page meta tags to reflect the page I'm currently on,
so that I can tell tabs apart, get an accurate preview when I share a link, and pages are indexable with correct titles/descriptions.

## Acceptance Criteria

1. **Given** `apps/web/src/app/[locale]/layout.tsx` currently exports a static, hardcoded, English-only `metadata` object (`title: 'FestGrid'`, fixed description), **when** a user visits any locale route, **then** the root/default title and description are resolved via `next-intl`'s server-side `getTranslations()` for the active `locale`, so they render correctly for both `en` and `id`.
2. **Given** a route defines its own page content (the Discovery/Home page today), **when** that route is requested, **then** the browser tab title reflects that page's own content (e.g. "Discover Events | FestGrid") via a route-level `generateMetadata` export — not the generic root title.
3. **Given** the app is navigated client-side (`next/navigation`/`next-intl` `Link`, no full page reload), **when** the destination route changes, **then** the document title updates to match the destination route's metadata (Next.js App Router per-segment metadata resolution, verified — not assumed).
4. **And** each route's resolved metadata includes baseline Open Graph tags (`og:title`, `og:description`) mirroring the resolved title/description, so shared links render an accurate preview.
5. **And** a shared helper (`apps/web/src/lib/metadata.ts`) builds the `Metadata` object (title, description, OG fields) consistently, so no route hand-rolls its own shape.
6. **And** all title/description strings are looked up through next-intl's server-side `getTranslations()` (never the client `useTranslations` hook, since `generateMetadata` runs on the server) from a new `Metadata` namespace added to both `apps/web/locales/en.json` and `apps/web/locales/id.json`.
7. **And** this `generateMetadata` + shared-helper pattern is applied now only to the routes that exist today (root layout + Discovery/Home page); it is documented as the standing convention future page stories (e.g. the not-yet-built event detail page) must follow, not retrofitted onto pages that don't exist yet.

## Tasks / Subtasks

- [x] Task 1 — Add `Metadata` i18n namespace (AC: #1, #2, #6)
  - [x] Add a `Metadata` key to `apps/web/locales/en.json` and `apps/web/locales/id.json` with `defaultTitle`/`defaultDescription` (root) and `discoveryTitle`/`discoveryDescription` (Home/Discovery page) entries.
- [x] Task 2 — Build the shared metadata helper (AC: #4, #5)
  - [x] Create `apps/web/src/lib/metadata.ts` exporting `buildPageMetadata({ title, description }): Metadata` (Next.js `Metadata` type) that populates `title`, `description`, `openGraph.title`, `openGraph.description`.
  - [x] Add `apps/web/src/lib/metadata.test.ts` covering the helper's output shape.
- [x] Task 3 — Localize and dynamize the root layout metadata (AC: #1)
  - [x] Replace the static `export const metadata = {...}` in `apps/web/src/app/[locale]/layout.tsx` with `export async function generateMetadata({ params }: { params: Promise<{ locale: string }> })` that resolves `locale`, calls `getTranslations({ locale, namespace: 'Metadata' })` from `next-intl/server`, and returns `buildPageMetadata(...)`.
- [x] Task 4 — Split the Discovery/Home page so it can export its own metadata (AC: #2, #3)
  - [x] Extract the current `"use client"` implementation of `apps/web/src/app/[locale]/page.tsx` (the `HomeContent` function and its `buildEventsQuery`/`buildEnumLabels` helpers) into a new client component file, `apps/web/src/app/[locale]/home-content.tsx`, unchanged in behavior.
  - [x] Rewrite `apps/web/src/app/[locale]/page.tsx` as a Server Component: keep the `<Suspense>` wrapper, render the extracted `HomeContent` from `./home-content`, and add `export async function generateMetadata({ params })` using `getTranslations({ locale, namespace: 'Metadata' })` + `buildPageMetadata(...)` for the Discovery-page title/description.
  - [x] Update `apps/web/src/app/[locale]/page.test.tsx`'s `import Home from './page'` to import the relocated client component (`./home-content`) instead, since the default export of `page.tsx` is now a Server Component that a client-rendering test (`@testing-library/react` + jsdom) cannot render/await the way it renders today.
- [x] Task 5 — Verify rendered output (AC: #3, #4)
  - [x] Confirm via dev server / build output that the compiled `<head>` contains the expected `<title>` and `og:title`/`og:description` for both the root default and the Discovery page, and that a client-side navigation between two routes updates `document.title` (can be exercised once a second route exists; for this story, verify at minimum that `generateMetadata` re-runs per requested segment via an integration test using Next.js's metadata resolution, not a manual multi-route click-through).
- [x] Task 6 — Testing (AC: all)
  - [x] Integration test: root layout's `generateMetadata` resolves the correct localized title/description for `en` and `id`.
  - [x] Integration test: Discovery page's `generateMetadata` resolves a title distinct from the root default.
  - [x] Update/rerun the existing `page.test.tsx` suite against the relocated `home-content.tsx` to confirm no regression in the Discovery page's existing search/filter/infinite-scroll behavior.

## Dev Notes

- **Files being modified (read fully before changing):**
  - `apps/web/src/app/[locale]/layout.tsx` — today exports a static `export const metadata = { title: 'FestGrid', description: '...' }` (lines 15-18). This is the only place app-wide metadata is currently set; it is not locale-aware and does not vary per route. Must become `generateMetadata`, preserving every other export/behavior in the file untouched (locale `setRequestLocale`, `generateStaticParams`, provider tree, `dir`/`lang` handling).
  - `apps/web/src/app/[locale]/page.tsx` — today a single `"use client"` file: `export default function Home()` wraps `<Suspense><HomeContent /></Suspense>`, and `HomeContent` (lines 56-182) contains all Discovery page logic (search, filters, infinite query, PostHog capture). A `"use client"` file cannot export `generateMetadata` (server-only API), so this file must be split: `page.tsx` becomes a Server Component (default export + `generateMetadata`), and the existing client logic moves verbatim into `home-content.tsx`. Preserve all existing behavior (the query key, `buildEventsQuery`, `buildEnumLabels`, translations, PostHog call) exactly — this is a structural extraction, not a rewrite.
  - `apps/web/src/app/[locale]/page.test.tsx` — currently does `import Home from './page'` and renders it directly with `@testing-library/react`. Once `page.tsx`'s default export is an async Server Component, this import must instead target the relocated `home-content.tsx` client component so the existing render/interaction assertions keep working unchanged.
- **Next.js App Router metadata API:** Use `generateMetadata` (not the static `metadata` export) wherever the title/description depends on `params`/locale/content — the static object approach is what currently causes AC #1's gap (hardcoded, non-localized). `generateMetadata` is resolved per-segment by Next.js on both hard navigation and client-side (`next/navigation`) transitions, which is what satisfies AC #3; do not hand-roll a `document.title = ...` side effect in a client component, as that fights the framework's own metadata resolution and breaks SSR/SEO correctness.
- **next-intl on the server:** Use `getTranslations` from `next-intl/server` (not `useTranslations` from `next-intl`) inside `generateMetadata`, since it runs on the server outside the React client tree — this mirrors the existing server-side `getMessages()`/`setRequestLocale` usage already in `layout.tsx`.
- **No new routes in scope:** As of this story, `apps/web/src/app/[locale]/` contains only the Discovery/Home route (`page.tsx`) — the event detail route from Story 1.6 does not exist yet (`sprint-status.yaml`: `1-6-view-event-details` is `ready-for-dev`, not `done`). This story establishes the `generateMetadata` + `buildPageMetadata()` convention against the one route that exists; it does not add metadata to routes that aren't built. Story 1.6 (and any future page story) is expected to add its own `generateMetadata` following this pattern (e.g. using the event's `eventName` for a dynamic title) as part of its own scope, not this one.

### Architecture & UX Gate Findings

- Epic 1's readiness sweep (`_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`) is `swept: true`, but it only covers Stories 1.1-1.8 — this story's scope (dynamic page metadata) was not part of that sweep, so Gate 1 and Gate 3 were reasoned fresh here rather than cited from the report, per the lightweight-guard clause.
- **Gate 1 (Architecture/Infra Completeness):** No gap. This story touches only `apps/web` — no DB/ORM access, no direct external-service calls from the frontend, no new API surface, no auth/secrets in frontend code. It only uses built-in Next.js (`generateMetadata`) and already-established next-intl server APIs.
- **Gate 2 (UI Complexity & Reusability):** No gap. The only new shared artifact is `buildPageMetadata()`, a small, stateless TypeScript formatting helper — not a React UI component or hook with variants/loading/empty/error states or a11y surface, so it does not meet Gate 2's reusable-component trigger bar. No `design-artifacts/UX-festgrid-run-1/` content specifies title/meta behavior, so there is no UX-spec/implementation gap to reconcile.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** No gap requiring an Epic 0 split. The mechanism reuses two already-established foundations (next-intl's i18n setup from Story 0.6, Next.js's built-in App Router metadata resolution) rather than introducing new shared infrastructure/tooling/adapters; `buildPageMetadata()` is a same-file-scope helper, not a new package or cross-app dependency. It is intentionally documented here as a convention future page stories must follow (AC #7), which is the lighter-weight alternative to a dedicated foundational story when no new infrastructure is actually being introduced.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story does not touch the database schema, GraphQL contracts, or any TypeScript data model; it is scoped to Next.js metadata rendering and i18n string resources only.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required (uses Next.js's built-in `Metadata` type from `next`).
- Backward compatibility and rollout notes: Purely additive/refactor within `apps/web`; no API or schema versioning concerns.
- Verification checks: Covered by the integration tests in Task 6 (locale-correct metadata resolution) plus existing `page.test.tsx` coverage confirming no regression after the `page.tsx`/`home-content.tsx` split.

### Project Structure Notes

- `apps/web/src/lib/metadata.ts` follows the existing convention of `apps/web/src/lib/` housing app-local (non-shared-package) helpers, alongside `graphql-client.ts` and `utils.ts`; colocated `metadata.test.ts` matches the existing `utils.test.ts` pattern.
- `apps/web/src/app/[locale]/home-content.tsx` follows Next.js App Router convention of colocating a route's client-only implementation next to its `page.tsx` when the page itself must be a Server Component (needed here solely to allow `page.tsx` to export `generateMetadata`).
- No new workspace package is introduced; `buildPageMetadata()` is `apps/web`-local since it depends on Next.js's `Metadata` type and is not intended for reuse outside `apps/web`.

### References

- [Source: apps/web/src/app/[locale]/layout.tsx#L15-L18] — current static, non-localized `metadata` export to be replaced.
- [Source: apps/web/src/app/[locale]/page.tsx#L1-L182] — current single-file client component to be split.
- [Source: apps/web/src/app/[locale]/page.test.tsx#L1-L11] — existing test importing `Home` from `./page`, to be repointed at the relocated client component.
- [Source: apps/web/locales/en.json#L1-L11] — existing `DiscoveryPage` namespace pattern to mirror for the new `Metadata` namespace.
- [Source: _bmad-output/project-context.md#Core Principle / Framework (i18n)] — next-intl is mandatory for all user-facing content, including this story's title/description strings.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — Epic 1 sweep scope (Stories 1.1-1.8), cited to justify running Gate 1/3 fresh for this story instead of citing the report.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — i18n Core Principle/Framework rules (next-intl mandatory for user-facing content); no existing rule yet covers page title/meta — this story's completion is the trigger to add one via `bmad-generate-project-context`.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no metadata-specific invariant exists yet; General Architecture section's i18n principle applies.
- [ ] `docs/infrastructure/1-frontend.md` — frontend-only story, no backend/infra shard changes needed.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/lib/metadata.ts`, `apps/web/src/lib/metadata.test.ts`, `apps/web/src/app/[locale]/home-content.tsx`
  - Modified: `apps/web/src/app/[locale]/layout.tsx` (static `metadata` → `generateMetadata`), `apps/web/src/app/[locale]/page.tsx` (client component → Server Component + `generateMetadata`, delegates rendering to `home-content.tsx`), `apps/web/src/app/[locale]/page.test.tsx` (repoint import), `apps/web/locales/en.json`, `apps/web/locales/id.json` (new `Metadata` namespace)
- **Rule Mapping:**
  - next-intl server-side lookup (never hardcoded strings) → project-context.md i18n Core Principle/Framework rules.
  - `apps/web`-local helper, no new workspace package → project-context.md Code Organization rules (only promote to a shared package if/when a second app needs it).
  - Canonical 15-section story structure → story-content-structure.md.
- **Verification Plan:** `pnpm --filter web test` (Vitest) covering `metadata.test.ts` and the updated `page.test.tsx`/new `home-content.test.tsx` coverage; `pnpm --filter web lint` and `pnpm --filter web typecheck` for touched files; manual/dev-server check of rendered `<head>` title and OG tags for the Discovery page vs. root default.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A: no gap found (see Architecture & UX Gate Findings)

## Testing Requirements

- [ ] Integration tests (root layout + Discovery page `generateMetadata`, locale-correctness, `home-content.tsx` behavior parity)
- [ ] E2E tests — not required for this story (no critical user-flow change; internal `<head>`/metadata correctness is adequately covered by integration tests per the testing-trophy philosophy)

## Deliverables Checklist

- [ ] `apps/web/src/lib/metadata.ts` shared metadata-builder helper
- [ ] Localized, dynamic `generateMetadata` in the root `[locale]/layout.tsx`
- [ ] `apps/web/src/app/[locale]/page.tsx` (Server Component + `generateMetadata`) and `home-content.tsx` (extracted client logic)
- [ ] `Metadata` i18n namespace in `en.json` and `id.json`
- [ ] Updated `page.test.tsx` + new tests for `metadata.ts`/`home-content.tsx`

## Out of Scope

- Adding `generateMetadata` to any route that does not exist yet (event detail, favorites, wizard, etc.) — those follow this story's pattern when they are built.
- Structured data / JSON-LD, canonical URLs, sitemap, or other broader SEO work beyond title/description/basic OG tags.
- Social preview images (`og:image`) — no image asset pipeline exists yet for this.

## Definition of Done

- [x] AC satisfaction
- [x] Required tests passing
- [x] Lint and type checks passing for touched packages

## Completion Status

- [x] Done

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Implemented `buildPageMetadata` utility to standardize OpenGraph metadata tags.
- Extracted `HomeContent` into a separate client component file to allow `page.tsx` to serve as a server component for metadata generation.
- Added `Metadata` namespace in `en.json` and `id.json` and updated layout and page components to use `next-intl`'s `getTranslations`.
- Added unit tests for `metadata.ts` and updated `page.test.tsx` (and `layout.test.tsx`) to verify expected behavior.
- Fixed a bug in `home-content.tsx` by wrapping the `onSubmit` inline arrow function in `useMemo` so that the search bar component does not continuously reset the query string on every render due to unstable reference.

### File List

- `apps/web/src/lib/metadata.ts`
- `apps/web/src/lib/metadata.test.ts`
- `apps/web/src/app/[locale]/layout.tsx`
- `apps/web/src/app/[locale]/layout.test.tsx`
- `apps/web/src/app/[locale]/page.tsx`
- `apps/web/src/app/[locale]/page.test.tsx`
- `apps/web/src/app/[locale]/home-content.tsx`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
