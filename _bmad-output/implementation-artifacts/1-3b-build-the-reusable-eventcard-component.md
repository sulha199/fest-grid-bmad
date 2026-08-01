# Story 1.3b: Build the reusable EventCard component

## Story Details

- Epic: 1
- Story ID: 1.3b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable `EventCard` component in `packages/ui`,
so that the main event list (and future views like favorites/calendar) can display events consistently, including their image and loading/empty/error states.

## Acceptance Criteria

1. **AC1 — Name & date:** Given event data (name, a primary schedule's start date/time, and optional metadata), when `EventCard` renders, then it displays the event name and a formatted date, computed via native `Intl.DateTimeFormat` (accepting an optional `locale` prop) — not `next-intl`, since `packages/ui` stays framework-agnostic (see Dev Notes).
2. **AC2 — Image (happy path):** When an `imageUrl` prop is provided and loads successfully, `EventCard` renders it in a plain `<img>` (not `next/image` — see Dev Notes) with a non-empty `alt` text, auto-derived from `eventName` unless an explicit `imageAlt` override is supplied.
3. **AC3 — Image fallback:** When `imageUrl` is absent, or the image fails to load (`onError`), `EventCard` renders a graceful placeholder visual instead of a broken-image icon or blank space.
4. **AC4 — Loading state:** `EventCard` exposes a `loading` boolean prop; when `true`, it renders a skeleton placeholder matching the card's real layout dimensions, with `aria-busy="true"`, and does not attempt to render partial/undefined data underneath the skeleton.
5. **AC5 — Minimal-data resilience:** `EventCard` renders correctly using only the fields guaranteed by the current API contract (`eventName`, a start date) — every other prop (`imageUrl`, `location`, `categories`/`types`, `priceFrom`, favorite state) is optional, and the component must not throw or produce broken layout when any subset of them is omitted.
6. **AC6 — Extended content slots:** `EventCard` accepts optional `location`, `categories`/`types` (rendered as badges), and `priceFrom` props so Stories 1.3, 1.4, and 1.5 can pass this data later without a breaking prop-shape change; each renders only when its value is provided.
7. **AC7 — Favorite slot (reserved, not wired):** `EventCard` accepts optional `isFavorited` and `onFavoriteToggle` props, reserving the "Quick Favorite" affordance mandated by the Event List View design doc. When `onFavoriteToggle` is not provided, no favorite control renders. The actual favorite/unfavorite mutation behavior is out of scope for this story (Story 2.1 / 2.1a).
8. **AC8 — Semantic, keyboard-navigable root:** The card's root is a semantic, keyboard-focusable interactive element (e.g. an `<article>` wrapping an anchor/button driven by an `href`/`onClick` prop) rather than a bare non-interactive `<div>` with a click handler, per WCAG 2.1 AA (UX-DR18).
9. **AC9 — i18n-ready microcopy:** Any internal microcopy the component renders itself (fallback `alt` text default, loading-state label, favorite-button `aria-label`) is exposed via an optional `labels` override prop with sensible English defaults, so the consuming app can localize it via `next-intl` at the call site (AD-6) without coupling `packages/ui` to `next-intl` directly.
10. **AC10 — Documented & exported for reuse:** `EventCard` (and its prop types) is exported from `packages/ui`'s public entry point with prop-level documentation (TSDoc), and has component tests proving the loading / image-success / image-fallback / minimal-data states, so it is discoverable and reusable across features.

## Tasks / Subtasks

- [x] 1. Create `packages/ui/src/features/events/EventCard.tsx` implementing the base structure, name, and date rendering (AC1, AC5).
- [x] 2. Define a strictly-typed `EventCardProps` interface (all fields beyond `eventName`/start date explicitly optional), co-located as `packages/ui/src/features/events/EventCard.types.ts` (AC5, AC6, AC7).
- [x] 3. Implement locale-aware date formatting via native `Intl.DateTimeFormat`, accepting an optional `locale` prop (AC1).
- [x] 4. Implement image rendering with state-based `onError` fallback swap using a plain `<img>` (no `next/image`) (AC2, AC3).
- [x] 5. Implement the `loading` skeleton state with `aria-busy="true"` and layout-matching placeholder blocks (AC4).
- [x] 6. Implement optional `location`, `categories`/`types` (as badges), and `priceFrom` rendering, each conditionally shown (AC6).
- [x] 7. Implement the reserved favorite slot: render an accessible toggle control only when `onFavoriteToggle` is provided, reflecting `isFavorited` (AC7).
- [x] 8. Wrap the card root in a semantic `<article>` containing an anchor/button driven by `href`/`onClick`, with visible focus styles (AC8).
- [x] 9. Add the `labels` override prop (with English defaults) for all internally-rendered microcopy (AC9).
- [x] 10. Export `EventCard`, `EventCardProps`, and any sub-types from `packages/ui/src/features/events/index.ts`, and re-export via `packages/ui/src/index.ts` (AC10).
- [x] 11. Add TSDoc comments to the component and its props documenting purpose, defaults, and reuse guidance (AC10).
- [x] 12. Write component tests (Vitest + `@testing-library/react`) covering: full data render, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy`, keyboard focus/activation of the card root, and favorite control hidden when `onFavoriteToggle` is absent (AC1–AC10; use `@festgrid/testing-config/vitest-react` per Testing Requirements).

## Dev Notes

- This is a net-new, presentation-only component story — no existing files needed to be read as "files being modified" beyond the `packages/ui` barrel export (`packages/ui/src/index.ts`, currently only re-exporting `./core/app-shell`).
- Previous story in sequence is 1.3a ("Build the events backend GraphQL API layer") — it is backend-only (`apps/backend`), not yet implemented (Completion Status: Incomplete), and has no code overlap with this UI-only story. No previous-story dev-notes/learnings carry over.
- Recent commit history (`0.16`, `0.17`, `0.9` implementation artifacts) shows a consistent pattern of small, tightly-scoped packages/adapters — no frontend-component precedent to reuse besides `packages/ui/src/core/app-shell/AppShell.tsx` (see below).

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-1-readiness.md` is marked `swept: true` and explicitly lists story `1.3b` in `stories_covered`. Its Gate 1 finding states: *"No other Gate 1 violations found: 1.1–1.6/1.3b/1.6a/1.8 all route data access through 1.3a's GraphQL API with no frontend→DB bypass, reusable components correctly scoped to `packages/ui`..."* — no gap applies to this story specifically. The report's one Gate 1/3 gap (missing GraphQL auth-context layer) was already resolved by promoting Story 0.17 into Epic 0; it does not affect this presentation-only component.
- **Gate 2 (run fresh, per-story as required):** Ran via subagent adopting the Freya (`wds-agent-freya-ux`) persona against the draft AC list and the authoritative UX sources (`design-artifacts/D-Design-System/01-event-list-view.md`, `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery/01.1-event-discovery.md`, `design-artifacts/UX-festgrid-run-1/DESIGN.md`). Findings, all folded into this story's AC rather than split further:
  - The Event List View doc mandates a "Quick Favorite" heart icon on every card, but Story 2.1/2.1a (the mutation + auth-gated toggle) don't exist yet — building it now would violate Gate 1 (calling a non-existent mutation). **Resolution:** AC7 reserves the prop slot (`isFavorited`, `onFavoriteToggle`) now so the icon can be wired in later without a breaking prop-shape change; the interactive behavior itself stays out of scope here.
  - Location, schedule date/time, performers, category/type badges, and price all appear in `EventInfo`/the discovery scenario as decision-relevant card content; shipping with only name/date/image risks a breaking prop-shape change when Stories 1.3/1.5 land. **Resolution:** AC6 adds them now as optional, conditionally-rendered props.
  - The image prop contract needed explicit specification given no structured image field exists yet (see Data Type Compatibility below): a decoupled `imageUrl?: string` plus a required-non-empty `alt`. **Resolution:** AC2/AC3.
  - Minor a11y/reuse gaps: skeleton needs `aria-busy` (AC4); the card root must be a semantic, keyboard-navigable element, not a bare `<div onClick>` (AC8); `EventCard` must not be confused with or reuse the separate `event_card_compact` design token (that token is styled for the calendar view's per-schedule compact cards — a different component, out of scope here).
- **Lightweight guard — gaps the epic-wide sweep did not anticipate (Gate 1/3 re-checked narrowly for this story only):**
  1. **Missing image data field (Data Type Compatibility gap, resolved as a new prerequisite story).** Neither the `events` Drizzle table nor the `EventInfo` shared type has any image field — confirmed by reading `packages/database/schema.ts`, `packages/shared-types/src/index.ts`, and `packages/database/seed.ts` (poster URLs are embedded as a substring of the free-text `description` field, e.g. `"Poster image: https://images.example.com/events/past-jazz-night.jpg"`). This is a genuine gap the epic-1 sweep's Gate 1/3 heuristics (layer-bypass, cross-cutting tooling) were not designed to catch, since it's a missing *column*, not a missing *layer*. Deeper investigation (prompted by user review of `packages/shared-types`) found the correct fix is **not** a direct image column on `events` — per the PRD's own data model (§4.1/§4.7), `EventInfo` has no image field because an event's image travels via its source `Post.imageUrl`. The real fix is a `postId` FK on `events` referencing a new `posts` table. Since Story 3.3a already defines that exact table shape but scopes it to Epic 3 (chronologically after Epic 1), a new prerequisite story, **Story 1.2a** (`1-2a-create-posts-table-and-link-seeded-events-to-their-source-post`), was added to `epics.md` and `sprint-status.yaml` (`backlog`, positioned after Story 1.2, before Story 1.3a) to pull that table's creation earlier and link the seeded events to it; Story 3.3a was amended accordingly. Full detail in the **Data Type Compatibility & Migration Requirements** section below. This does not block *this* story: per the Gate 2 review, `EventCard` is intentionally decoupled from any specific backing field via a generic `imageUrl?: string` prop, regardless of whether the underlying mechanism is a direct column or a joined `postId` relation.
  2. **Pre-existing Shadcn/ui location debt (not reopened here).** `project-context.md`'s "Core Primitives" rule requires reusable Shadcn/ui components in `packages/ui/src/core/`, but Story 0.3 installed them directly into `apps/web/src/components/ui/` (`button.tsx`, `card.tsx`, `dialog.tsx`) instead. `AppShell.tsx` (the only existing `packages/ui` component) already works around this by hand-rolling Tailwind markup rather than importing those primitives — `packages/ui` cannot import from `apps/web` anyway (wrong dependency direction in the workspace graph). **Resolution:** `EventCard` follows the same precedent — built with plain Tailwind + native elements, not a Shadcn `Card` import. This gap is flagged so the dev agent does not attempt an invalid cross-package import, and is **not** claimed as fixed by this story; a repo-wide relocation of the Shadcn primitives (which would also touch `Button`/`Dialog` usage across `apps/web`) is out of scope and would need its own story if ever prioritized.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No image field exists on the `events` Drizzle table (`packages/database/schema.ts`) or on the `EventInfo` shared TypeScript type (`packages/shared-types/src/index.ts`) — and per the PRD (§4.1), this is by design: `EventInfo` has no image field because an event's image is meant to travel via its source `Post.imageUrl` (PRD §4.7). Today, no `posts` table exists yet either, so the image URL is stuffed as unstructured text inside `events.description` in the seed fixtures (`packages/database/seed.ts`) as a stopgap.
- **Impacted fields/contracts:** `events` table (DB, needs a `postId` FK), a new `posts` table (DB), `EventInfo` interface (`packages/shared-types`, needs `postId?: string`), the not-yet-implemented Story 1.3a GraphQL resolver's `Event.imageUrl` computed field, and any future mapping from that field → `EventCardProps.imageUrl`.
- **Required DB migration changes:** A new `drizzle-kit`-generated migration (per AD-3) creating a `posts` table (`id`, `subscription_id` FK, `content`, `image_url`, `post_url`, `is_extracted`, `published_at`, timestamps — matching Story 3.3a's originally-specified shape) and adding a nullable `post_id` FK column to `events`, plus a seed-data update linking each of the 3 fixture events to a new fixture `posts` row populated with the URL currently embedded in `description`. **Not this story's responsibility** — `packages/ui` has no database access, and this is a shared-data-ownership concern spanning Epic 1 and Epic 3. Split into a new prerequisite story, **Story 1.2a** (`1-2a-create-posts-table-and-link-seeded-events-to-their-source-post`, `backlog`, added to `epics.md` positioned after Story 1.2 and before Story 1.3a; Story 3.3a amended to depend on it and narrowed to just the scraping-pipeline write path).
- **Required TypeScript type changes:** Add `postId?: string` to `EventInfo` in `packages/shared-types` (Story 1.2a). Story 1.3a's GraphQL `Event` type additionally exposes a runtime-computed `imageUrl: String` field resolved via a `posts` join through `postId` — not a field stored on `EventInfo` itself, mirroring how `isFavorited`/`isAddedToCalendar` are already runtime-computed.
- **Backward compatibility and rollout notes:** `EventCard` is deliberately decoupled from any specific backing field or mechanism — it accepts a generic `imageUrl?: string` prop that whichever caller integrates it is responsible for mapping, regardless of whether that value ultimately comes from a direct column or a joined `posts` relation. This story is therefore **not blocked** on Story 1.2a/1.3a landing. Until they do, real integrations (Story 1.3) will call `EventCard` with `imageUrl={undefined}`, which exercises the already-specified fallback/placeholder path (AC3) as the default real-world behavior — not a degraded/broken state.
- **Verification checks:** This story's own component tests cover both `imageUrl` present and absent (AC2/AC3). End-to-end verification against real event images is not possible until Story 1.2a's migration/seed update and Story 1.3a's AC6 (`imageUrl` resolver) both ship; track that separately when those stories are picked up.

### Project Structure Notes

- New files live under `packages/ui/src/features/events/`, per project-context.md's "Domain Features" convention (`packages/ui/src/features/<domain>/...`), mirroring the documented example `packages/ui/src/features/events/EventCard.tsx`.
- Only existing file touched: `packages/ui/src/index.ts` (add a barrel re-export) — everything else is additive/new. No conflicts with the in-flight `apps/backend` work from Story 1.3a (different package entirely).
- `packages/ui`'s existing component (`AppShell.tsx`) establishes the pattern this story must follow: plain Tailwind classes, native HTML elements (`<a>`, `<button>`), `lucide-react` for icons, no Next.js-specific APIs (`next/link`, `next/image`), no `next-intl` — labels/paths are passed in as already-resolved props by the consuming `apps/web` app.

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Domain vs UI), UI Patterns & UX Invariants (loaders), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-6] — i18n/locale strategy (labels-prop pattern).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3b] and neighboring Stories 1.2a, 1.3, 1.3a, 2.1, 2.1a, 3.3a.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report covering this story.
- [Source: packages/testing-config/] — shared Vitest/MSW config (Story 0.10), consumed via `@festgrid/testing-config/vitest-react`.
- [Source: design-artifacts/D-Design-System/01-event-list-view.md] — Quick Favorite requirement.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] — `card` and `event_card_compact` design tokens.
- [Source: design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery/01.1-event-discovery.md] — Quick Favorite user scenario.
- [Source: packages/database/schema.ts], [Source: packages/shared-types/src/index.ts], [Source: packages/database/seed.ts] — confirmed missing image field.
- [Source: packages/ui/src/core/app-shell/AppShell.tsx] — established `packages/ui` component conventions (plain Tailwind, no Next.js coupling).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain Features), UI Patterns & UX Invariants (skeleton/loading), i18n rules.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n/locale strategy).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/features/events/EventCard.tsx` — component implementation.
  - NEW `packages/ui/src/features/events/EventCard.types.ts` — `EventCardProps` and related types.
  - NEW `packages/ui/src/features/events/index.ts` — barrel export for the `events` feature folder.
  - NEW `packages/ui/src/features/events/EventCard.test.tsx` — component tests.
  - UPDATE `packages/ui/src/index.ts` — add `export * from './features/events';`.
  - NEW `packages/ui/vitest.config.ts` — `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`, matching the pattern already used by `packages/analytics/vitest.config.ts` and `apps/web/vitest.config.ts` (Story 0.10's `@festgrid/testing-config` package now exists with `vitest-react.ts`/`msw-handlers.ts` — `packages/ui` just needs to add its own config file, not bootstrap anything from scratch).
  - UPDATE `packages/ui/package.json` — add a `"test": "vitest run"` script and devDependencies `@festgrid/testing-config` (workspace), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` (mirroring `packages/analytics/package.json`'s shape; `@testing-library/react`/`jest-dom` are needed directly since pnpm workspaces don't transitively expose `@festgrid/testing-config`'s own devDependencies to consumers).
- **Rule Mapping:**
  - *UI Components & Scalability (Domain Features)* → component placed in `packages/ui/src/features/events/`.
  - *i18n foundational principle (AD-6)* → `labels` override prop pattern, no direct `next-intl` dependency inside `packages/ui`.
  - *UI Patterns & UX Invariants (Non-Blocking Initial Load)* → the `loading` skeleton state matches the project's mandated skeleton-for-initial-load pattern.
  - *Data Type Compatibility* → `imageUrl` kept generic/decoupled from `EventInfo`, per the section above.
  - *Testing Philosophy (testing trophy)* → integration-style component tests via Vitest + Testing Library, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: full-data render, minimal-guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy` attribute, keyboard focus/activation (Tab + Enter/Space) of the card root, favorite control absent when `onFavoriteToggle` is not passed.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing renders `EventCard` on a real page yet — that lands with Story 1.3).

## Pre-Coding Approval Gate

- [x] Scope confirmed: build `EventCard` as a standalone, presentation-only UI component in `packages/ui`; no backend work, no live-data wiring into any page (that is Story 1.3).
- [x] Architecture confirmed: component built with plain Tailwind + native HTML elements only (no `next/image`, no `next-intl`, no cross-boundary import of `apps/web`'s Shadcn primitives), placed under `packages/ui/src/features/events/`.
- [x] Testing plan confirmed: Vitest + `@testing-library/react` component tests via `packages/ui/vitest.config.ts` importing `@festgrid/testing-config/vitest-react` (Story 0.10's shared testing-config package exists and is already consumed by `packages/analytics`/`apps/web`; `packages/ui` just adds its own config file following that same pattern).
- [x] Data Type Compatibility gap accepted: user accepts that `EventCard` ships now with a generic, decoupled `imageUrl?: string` prop, and that the real image data (`posts` table + `events.postId` + Story 1.3a's `imageUrl` resolver) is deferred to new Story **1.2a** (`backlog`) rather than blocking this story.
- [x] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story); Gate 2 findings (Quick Favorite slot reserved but not wired, extended content props, image prop contract, a11y semantics) are folded into this story's AC rather than split further; the image-data-model gap is split into new Story 1.2a (see above).
- [x] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [x] Component tests (Vitest + `@testing-library/react`) for: full-data render, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton (`aria-busy`), keyboard focus/activation of the card root, and favorite control hidden when `onFavoriteToggle` is absent.
- [x] No E2E test required for this story (no live page consumes `EventCard` yet; E2E coverage arrives with Story 1.3's "happy path").
- [x] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per project-context.md; `packages/ui` follows the "testing trophy" integration-style approach.
- [x] Note: Use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [x] `EventCard` component implemented in `packages/ui/src/features/events/EventCard.tsx`.
- [x] Strictly-typed `EventCardProps` covering all guaranteed and optional fields (`EventCard.types.ts`).
- [x] Loading skeleton state with `aria-busy`.
- [x] Image success + fallback/placeholder handling (no-`imageUrl` and `onError` cases).
- [x] Optional content slots: `location`, `categories`/`types` badges, `priceFrom`.
- [x] Reserved (unwired) favorite slot: `isFavorited`, `onFavoriteToggle`.
- [x] Semantic, keyboard-navigable card root.
- [x] `labels` override prop for i18n-readiness.
- [x] Exported from `packages/ui`'s public entry point with TSDoc prop documentation.
- [x] Component tests written and passing.

## Out of Scope

- Wiring `EventCard` into the actual event list/grid page — handled by Story 1.3.
- Live GraphQL data fetching / real event data — handled by Story 1.3a.
- Interactive favorite/unfavorite mutation logic — handled by Story 2.1 and Story 2.1a; this story only reserves the prop slot (AC7).
- Creating the `posts` table, adding `events.postId`, and exposing the resolved `imageUrl` via the GraphQL resolver — split into new Story **1.2a** (schema/seed) and Story 1.3a's AC6 (resolver); not built here (see Data Type Compatibility & Migration Requirements).
- Relocating existing Shadcn/ui primitives from `apps/web/src/components/ui/` into `packages/ui/src/core/` — pre-existing Story 0.3 debt, not reopened by this story.
- Storybook, visual-regression, or design-token tooling — not set up anywhere in this project yet.

## Definition of Done

- [x] All Acceptance Criteria (AC1–AC10) are met.
- [x] Required component tests (see Testing Requirements) are written and passing.
- [x] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [x] `EventCard` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [x] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro

### Debug Log References

N/A

### Completion Notes List

- Implemented `EventCard` in `packages/ui` following the UI Patterns & UX Invariants (Skeleton loader).
- Component uses framework-agnostic native elements and plain Tailwind classes.
- Used `Intl.DateTimeFormat` for locale-aware date rendering.
- Fully exported via barrel files.
- Provided component testing via `vitest` + `testing-library/react` and configured `packages/ui` to properly load JSX using `@vitejs/plugin-react`.
- Verified typings and all 9 component tests pass.

### File List

- `packages/ui/src/features/events/EventCard.tsx`
- `packages/ui/src/features/events/EventCard.types.ts`
- `packages/ui/src/features/events/EventCard.test.tsx`
- `packages/ui/src/features/events/index.ts`
- `packages/ui/src/index.ts`
- `packages/ui/vitest.config.ts`
- `packages/ui/tsconfig.json`
- `packages/ui/package.json`
