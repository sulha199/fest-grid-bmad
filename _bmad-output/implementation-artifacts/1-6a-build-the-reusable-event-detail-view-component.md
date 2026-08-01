# Story 1.6a: Build the reusable event detail view component

## Story Details

- Epic: 1
- Story ID: 1.6a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, presentation-only event detail display component in `packages/ui`,
so that the event name, description, all schedules (date/time/performers/price/location), category/type tags, and image can be presented consistently whether the caller renders it inside a modal or a full page.

## Acceptance Criteria

1. **AC1 — Core fields:** Given a fully-loaded event's details, when `EventDetailView` renders, then it displays the event name and description, with the description section omitted entirely (not an empty block) when `description` is absent.
2. **AC2 — All schedules rendered, not just one:** Given an event with one or more `schedules` (each with `eventStartDate`, optional `eventEndDate`/`eventStartTime`/`eventEndTime`, and an optional `title`), when `EventDetailView` renders, then it renders **every** schedule as a distinct, labeled entry (using each schedule's `title` when present, else a positional fallback label) — not only a single primary schedule — formatted via native `Intl.DateTimeFormat` (accepting an optional `locale` prop), not `next-intl`, since `packages/ui` stays framework-agnostic (see Dev Notes, mirrors `EventCard`'s AC1 in Story 1.3b).
3. **AC3 — Per-schedule performers, location, and price with event-level fallback:** For each rendered schedule, when that schedule provides its own `performers`, `location`, and/or `ticketPrice`, then those per-schedule values are displayed under that schedule's entry; when a schedule omits `location`, the component falls back to the event-level `location` value instead of rendering nothing.
4. **AC4 — Optional map link:** When a schedule (or the event-level fallback) provides an already-constructed `mapUrl` string, then `EventDetailView` renders the location as a tappable/clickable link to that URL; when `mapUrl` is absent, the location renders as plain text with no broken/dead link. `packages/ui` does not construct map URLs itself (no maps SDK dependency) — the caller resolves `mapUrl` and passes it in, mirroring how `EventCard` (Story 1.3b) receives an already-resolved `imageUrl` rather than constructing one.
5. **AC5 — Category and type tags:** When `types` and/or `categories` (arrays of display-ready label strings) are provided, then `EventDetailView` renders them as tags/badges; when either array is empty or absent, that tag group is omitted, not rendered empty.
6. **AC6 — Image (happy path):** When an `imageUrl` prop is provided and loads successfully, `EventDetailView` renders it in a plain `<img>` (not `next/image` — see Dev Notes) with a non-empty `alt` text, auto-derived from `eventName` unless an explicit `imageAlt` override is supplied.
7. **AC7 — Image fallback:** When `imageUrl` is absent, or the image fails to load (`onError`), `EventDetailView` renders a graceful placeholder visual instead of a broken-image icon or blank space.
8. **AC8 — Loading state:** `EventDetailView` exposes a `loading` boolean prop; when `true`, it renders a skeleton placeholder matching the component's real layout dimensions, with `aria-busy="true"`, and does not attempt to render partial/undefined event data underneath the skeleton.
9. **AC9 — Error state, invocation-agnostic:** `EventDetailView` exposes an `error` prop (an object with at least a `message: string`, or `null`); when set, it renders an error state (not the event content, not the loading skeleton) with the message. The component itself never fetches data or knows whether it is rendered inside a modal or a full page — the `loading`/`error`/event-data props fully determine what renders, so both the modal route and the full-page route (Story 1.6) can drive the identical component with an identical prop contract.
10. **AC10 — Minimal-data resilience:** `EventDetailView` renders correctly using only the fields guaranteed by the current API contract (`eventName`, at least one schedule with `eventStartDate`, `location`) — every other prop (`description`, `imageUrl`, `types`, `categories`, per-schedule `performers`/`ticketPrice`/`mapUrl`, favorite/calendar state) is optional, and the component must not throw or produce broken layout when any subset of them is omitted.
11. **AC11 — Reserved favorite and add-to-calendar slots (not wired):** `EventDetailView` accepts optional `isFavorited`/`onFavoriteToggle` and `isAddedToCalendar`/`onAddToCalendar` props, reserving the affordances the event-detail UX scenario (`01.2-event-detail.md`) places on this page. When a given `on*` handler is not provided, its corresponding control does not render. The actual favorite/unfavorite and add-to-calendar mutation behavior is out of scope for this story (Story 1.6 / Story 2.1 / Story 2.1a — see Out of Scope), matching the precedent set by `EventCard`'s reserved-but-unwired favorite slot (Story 1.3b AC7).
12. **AC12 — Semantic, accessible structure:** The component's root and section structure use semantic HTML (headings, `<address>`/appropriate landmarks as suited, lists for multi-schedule and tag content) rather than an undifferentiated stack of `<div>`s, and interactive elements (map link, reserved favorite/calendar controls when wired) are keyboard-focusable per WCAG 2.1 AA (UX-DR18, consistent with `EventCard`'s AC8).
13. **AC13 — i18n-ready microcopy:** Any internal microcopy the component renders itself (fallback `alt` text default, loading-state label, error-state label, empty-schedule-list fallback, section headings like "Performers"/"Location") is exposed via an optional `labels` override prop with sensible English defaults, so the consuming app can localize it via `next-intl` at the call site (AD-6) without coupling `packages/ui` to `next-intl` directly — same pattern as `EventCard` AC9.
14. **AC14 — Documented & exported for reuse:** `EventDetailView` (and its prop types) is exported from `packages/ui`'s public entry point with prop-level documentation (TSDoc), and has component tests proving the loading / error / image-success / image-fallback / multi-schedule / minimal-data states, so it is discoverable and reusable across both the modal and full-page consumers in Story 1.6.
15. **AC15 — Source-post attribution links (added 2026-08-01 via `bmad-correct-course`):** `EventDetailView` accepts two independent, optional caller-supplied URL props — `originalPostUrl` (the canonical original-platform post, e.g. Instagram, when the caller was able to derive it) and `sourcePostUrl` (the post as actually scraped, which may be a proxy/mirror site, e.g. `imginn.com`) — and renders an attribution link for whichever is present; when both are absent, no attribution section renders (not an empty block); when only one is present, only that one renders. `packages/ui` does not construct or validate these URLs itself (same decoupling as `mapUrl`, AC4) — the caller resolves and passes them in.
16. **AC16 — Account attribution link (added 2026-08-02 via `bmad-correct-course`):** `EventDetailView` accepts optional caller-supplied `accountName`, `accountPlatformIconUrl` (or equivalent platform-icon identifier), and `accountHref` props (a pre-built `/{platformSlug}/{accountId}` URL, Story 3.11 — the caller resolves this, mirroring the `mapUrl`/AC4 and attribution-link/AC15 decoupling pattern); when all three are present, it renders the account's platform icon and display name as a link to `accountHref`; when any are absent, the account-attribution section is omitted entirely (not a broken/partial render). This is independent of, and renders alongside, the AC15 source-post attribution links — the two point to different destinations (account page vs. original post) and either may be present without the other.

## Tasks / Subtasks

- [ ] 1. Create `packages/ui/src/features/events/EventDetailView.tsx` implementing the base structure, name, and description rendering (AC1, AC10).
- [ ] 2. Define a strictly-typed `EventDetailViewProps` interface (all fields beyond `eventName`/one schedule/`location` explicitly optional), co-located as `packages/ui/src/features/events/EventDetailView.types.ts`, including a `ScheduleDetail` sub-type mirroring `Schedule`'s relevant fields (AC10, AC2, AC3).
- [ ] 3. Implement multi-schedule rendering: iterate `schedules`, render each with locale-aware `Intl.DateTimeFormat` formatting (optional `locale` prop) and a `title`-or-positional-fallback label (AC2).
- [ ] 4. Implement per-schedule `performers`/`location`/`ticketPrice` rendering with event-level `location` fallback when a schedule omits its own (AC3).
- [ ] 5. Implement the optional `mapUrl` link rendering for location, falling back to plain text when absent (AC4).
- [ ] 6. Implement `types`/`categories` tag rendering, omitted when empty/absent (AC5).
- [ ] 7. Implement image rendering with state-based `onError` fallback swap using a plain `<img>` (no `next/image`) (AC6, AC7).
- [ ] 8. Implement the `loading` skeleton state with `aria-busy="true"` and layout-matching placeholder blocks (AC8).
- [ ] 9. Implement the `error` state rendering, mutually exclusive with `loading` and the normal event-data render path (AC9).
- [ ] 10. Implement the reserved favorite and add-to-calendar slots: render each accessible toggle/button control only when its respective `on*` handler prop is provided (AC11).
- [ ] 11. Structure markup with semantic HTML and keyboard-focusable interactive elements (AC12).
- [ ] 12. Add the `labels` override prop (with English defaults) for all internally-rendered microcopy (AC13).
- [ ] 13. Export `EventDetailView`, `EventDetailViewProps`, `ScheduleDetail`, and any sub-types from `packages/ui/src/features/events/index.ts` (create the file if Story 1.3b/1.3c/1.4/1.5a haven't already; otherwise extend it — check for naming conflicts before adding), and re-export via `packages/ui/src/index.ts` (AC14).
- [ ] 14. Add TSDoc comments to the component and its props documenting purpose, defaults, and reuse guidance (AC14).
- [ ] 15. Write component tests (Vitest + `@testing-library/react`) covering: full-data render with multiple schedules, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy`, error state, map link present/absent, tag rendering present/absent, and favorite/calendar controls hidden when their handlers are absent (AC1–AC14; use `@festgrid/testing-config/vitest-react` per Testing Requirements).
- [ ] 16. **(Added 2026-08-01, source-attribution amendment, AC15):** Implement the `originalPostUrl`/`sourcePostUrl` optional props on `EventDetailViewProps`; render an attribution link for each one present, omit the section entirely when both are absent. Add component tests: both links present, only `originalPostUrl` present, only `sourcePostUrl` present, neither present (no broken/empty section rendered).
- [ ] 17. **(Added 2026-08-02, account-attribution amendment, AC16):** Implement the `accountName`/`accountPlatformIconUrl`/`accountHref` optional props on `EventDetailViewProps`; render the account's platform icon + name as a link to `accountHref` when all three are present, omit the section entirely otherwise. Add component tests: all three present (renders link), any one missing (section omitted), and confirm this section renders independently alongside AC15's source-post attribution links (both present simultaneously).

## Dev Notes

- This is a net-new, presentation-only component story — no existing files needed to be read as "files being modified" beyond `packages/ui`'s barrel exports (`packages/ui/src/index.ts`, and `packages/ui/src/features/events/index.ts` if Story 1.3b/1.3c/1.4/1.5a already created it — confirmed by directory listing that today only `packages/ui/src/core/app-shell/` exists; no `packages/ui/src/features/` folder exists yet, so this story may be the one that creates it, or may extend it if a sibling events-feature story lands first).
- Previous story in sequence (by story-number ordering within Epic 1, `1-5-filter-events-by-type-and-category.md`) is `apps/web`-side (Filter Hub wiring, `nuqs` URL state, DSL query-building) with zero file overlap with this `packages/ui`-only story — no dev-notes/learnings carry over, matching the same "no overlap" conclusion Story 1.3b reached against its own predecessor.
- The stale, pre-split `1-6-view-event-details.md` story file (written before this Gate-2 split existed) still describes building an `EventDetails` component directly at `apps/web/components/events/EventDetails.tsx`. That plan is now superseded by this story: the reusable display component belongs in `packages/ui/src/features/events/EventDetailView.tsx` per `project-context.md`'s "Domain Features" rule, and Story 1.6 (not this story) is responsible for wiring `EventDetailView` into the modal/full-page routes, GraphQL data fetching, and `ContextAwareNavigation`. This story does not update `1-6-view-event-details.md` — that reconciliation happens if/when Story 1.6 is next touched.
- Recent commit history (`0.16`, `0.17`, `0.9`, `1.2a` implementation artifacts) shows a consistent pattern of small, tightly-scoped packages/adapters — the only frontend-component precedent to reuse is `packages/ui/src/core/app-shell/AppShell.tsx` and, by convention, the (not-yet-implemented) `EventCard` plan from Story 1.3b.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-1-readiness.md` is marked `swept: true` and explicitly lists story `1.6a` in `stories_covered`. Its Gate 1 finding states: *"No other Gate 1 violations found: 1.1–1.6/1.3b/1.6a/1.8 all route data access through 1.3a's GraphQL API with no frontend→DB bypass, reusable components correctly scoped to `packages/ui`..."* — no gap applies to this story specifically. The report's one Gate 1/3 gap (missing GraphQL auth-context layer, resolved by Story 0.17) does not affect this presentation-only component, which has zero data-fetching responsibility.
- **Gate 2 (run fresh, per-story as required):** Ran via subagent adopting the Freya (`wds-agent-freya-ux`) persona against the draft AC (verbatim from `epics.md`'s terser "### Story 1.6a" entry) and the authoritative UX sources (`design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md`, `design-artifacts/UX-festgrid-run-1/DESIGN.md`, `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`, PRD §4.1/§4.4). Findings, all folded into this story's expanded AC list rather than split further:
  - The epics.md draft AC's field list ("name, description, date and time, location, performers, image") omitted **ticket price** and **category/type tags**, both explicitly mandated by the scenario (line 37: "Ticket Price"; line 38: "Category and Type tags") and `EXPERIENCE.md` ("...opens a modal with the full event details, including a clear display of its types and categories as tags"). **Resolution:** AC3 (ticket price) and AC5 (type/category tags).
  - "Date and time" was singular in the draft AC, but the scenario shows one event with **two distinct schedules** ("Saturday Session," "Sunday Session") both requiring display, and the PRD's `EventInfo.schedules: Schedule[]` is inherently an array. **Resolution:** AC2 explicitly requires rendering every schedule, not just a primary one — a materially different requirement from `EventCard` (Story 1.3b AC1), which correctly only needs a single primary schedule's start date for a compact list card.
  - PRD §4.4 places `performers`, `ticketPrice`, and `location` on `Schedule`, not on top-level `EventInfo` (`EventInfo.location` is the general/fallback location only). **Resolution:** AC3 renders these per-schedule with an event-level `location` fallback, rather than assuming one flat set of fields for the whole event.
  - The scenario mandates "Location (with a tappable map link)," but `packages/ui` has no maps SDK/config dependency (same decoupling principle as `EventCard`'s `imageUrl`). **Resolution:** AC4 accepts an already-constructed `mapUrl` string from the caller; the component only renders the link when present.
  - The scenario places the Favorite toggle and Add-to-Calendar action on this exact page, but wiring the actual mutations here would violate Gate 1 (Story 1.6's data-fetching/mutation wiring, Story 2.1/2.1a's favorite mutation, and calendar-add logic don't exist yet). **Resolution:** AC11 reserves `isFavorited`/`onFavoriteToggle` and `isAddedToCalendar`/`onAddToCalendar` prop slots now (unwired), mirroring `EventCard`'s AC7 precedent, so Story 1.6/2.1/2.1a can wire real behavior later without a breaking prop-shape change.
  - Consistency requirements carried over from `EventCard` (Story 1.3b) apply equally here since both live in the same framework-agnostic `packages/ui` package: native `Intl.DateTimeFormat` instead of `next-intl` (AC2), a `labels` override prop for internal microcopy (AC13), a plain `<img>` instead of `next/image` (AC6/AC7), and a semantic/keyboard-accessible root structure (AC12).
  - **No further splitting warranted:** every addition above is still purely presentational/read-only content (or a reserved-but-unwired prop slot, per the established `EventCard` pattern) — none introduces new interactive/mutation behavior or a new backend dependency, so Gate 2 concluded this stays one story rather than splitting further.
- **Lightweight guard — gaps the epic-wide sweep did not anticipate:** None found. This story introduces no new external service, no new data entity, and no cross-cutting tooling gap beyond what Gate 1/3's swept report already covers; it consumes the same `EventInfo`/`Schedule` shape already fully modeled in `packages/shared-types` and the PRD.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. `packages/shared-types/src/index.ts`'s `EventInfo` and `Schedule` interfaces already carry every field this component needs to render (`eventName`, `description`, `schedules[]` with `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime`/`title`/`performers`/`location`/`ticketPrice`/`locationDetails`, top-level `location`, and — via Story 1.2a/1.3a's already-planned `postId` → `posts` join — a runtime-computed `imageUrl`). No DB schema or shared-type changes are required for this story.
- **Impacted fields/contracts:** None new. This component only consumes props; it has no direct dependency on the database, GraphQL schema, or resolvers. `imageUrl` and `mapUrl` are both accepted as already-resolved strings from the caller (same decoupling as `EventCard`'s `imageUrl`, established in Story 1.3b's Data Type Compatibility section) — this story does not depend on Story 1.2a/1.3a landing first.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required to `packages/shared-types`. This story defines its own local, decoupled `EventDetailViewProps`/`ScheduleDetail` prop types in `packages/ui` (not a re-export of `EventInfo`/`Schedule`), so `packages/ui` never takes a compile-time dependency on `@festgrid/shared-types`' backend-oriented shape — consistent with `EventCard`'s approach.
- **Backward compatibility and rollout notes:** Not applicable — net-new component, no existing consumers to break. Story 1.6 will be the first real caller and is responsible for mapping fetched `EventInfo`/`Schedule` GraphQL data onto this component's prop shape (including resolving `mapUrl` from `Schedule.locationDetails.coordinates` if/when that mapping is implemented — out of scope here, see Out of Scope).
- **Verification checks:** This story's own component tests cover both the full data shape (multiple schedules, all optional fields present) and the minimal guaranteed shape (AC10). End-to-end verification against real event/schedule data is not possible until Story 1.6 wires live GraphQL data into this component; track that separately when Story 1.6 is picked up.

### Project Structure Notes

- New files live under `packages/ui/src/features/events/`, per `project-context.md`'s "Domain Features" convention (`packages/ui/src/features/<domain>/...`), alongside the (not-yet-implemented) `EventCard.tsx` from Story 1.3b.
- Only existing files potentially touched: `packages/ui/src/index.ts` (barrel re-export) and, if it already exists from a sibling events-feature story, `packages/ui/src/features/events/index.ts` — otherwise this story creates it. No conflicts with `apps/backend` or `apps/web` work (different package entirely).
- `packages/ui`'s existing component (`AppShell.tsx`) establishes the pattern this story must follow: plain Tailwind classes, native HTML elements, `lucide-react` for icons, no Next.js-specific APIs (`next/link`, `next/image`), no `next-intl` — labels/URLs are passed in as already-resolved props by the consuming `apps/web` app. `EventCard` (Story 1.3b, not yet implemented but already specced) establishes the same pattern for event-domain components specifically and should be treated as the closest sibling precedent when Story 1.3b lands.

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Domain vs UI), UI Patterns & UX Invariants (loaders), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-6] — i18n/locale strategy (labels-prop pattern).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6a] and neighboring Stories 1.3b, 1.5a, 1.6.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report covering this story.
- [Source: _bmad-output/implementation-artifacts/1-3b-build-the-reusable-eventcard-component.md] — sibling reusable-component precedent (framework-agnostic patterns, reserved-favorite-slot pattern, decoupled `imageUrl`).
- [Source: packages/testing-config/] — shared Vitest/MSW config (Story 0.10), consumed via `@festgrid/testing-config/vitest-react`.
- [Source: design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md] — authoritative event-detail-page scenario (field list, Favorite/Add-to-Calendar placement).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md], [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — design tokens (`modal` component) and interaction patterns (type/category tag display).
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.1] (`EventInfo`), [#4.4] (`Schedule`), [#4.3] (`LocationDetails`), [#3.12] (Context-Aware Detail Views, loaders).
- [Source: packages/shared-types/src/index.ts] — confirmed current `EventInfo`/`Schedule` field shapes, no mismatch.
- [Source: packages/ui/src/core/app-shell/AppShell.tsx] — established `packages/ui` component conventions (plain Tailwind, no Next.js coupling).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1a] and [#Story-3.11] — `SocialMediaAccountProfile.accountId`/`platform` fields and the public account page (`/{platformSlug}/{accountId}`) this story's AC16 links to, added via `bmad-correct-course` (2026-08-02).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain Features), UI Patterns & UX Invariants (skeleton/loading, Context-Aware Detail Views), i18n rules.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n/locale strategy).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/features/events/EventDetailView.tsx` — component implementation.
  - NEW `packages/ui/src/features/events/EventDetailView.types.ts` — `EventDetailViewProps`, `ScheduleDetail`, and related types.
  - NEW `packages/ui/src/features/events/EventDetailView.test.tsx` — component tests.
  - **(Amendment, AC15)** `EventDetailView.tsx`/`.types.ts`/`.test.tsx` above also cover the new `originalPostUrl`/`sourcePostUrl` optional props — no additional new files.
  - **(Amendment, AC16)** `EventDetailView.tsx`/`.types.ts`/`.test.tsx` above also cover the new `accountName`/`accountPlatformIconUrl`/`accountHref` optional props — no additional new files. `accountHref` is a fully-resolved `/{platformSlug}/{accountId}` URL string (Story 3.11) built by the caller; this component does not construct it.
  - NEW-OR-UPDATE `packages/ui/src/features/events/index.ts` — barrel export for the `events` feature folder; create it if no sibling events-feature story has landed yet, otherwise extend it (check for naming conflicts with `EventCard`/`FilterHub` exports first).
  - UPDATE `packages/ui/src/index.ts` — add `export * from './features/events';` if not already present.
  - NEW-OR-VERIFY `packages/ui/vitest.config.ts` — `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`, matching the pattern already used by `packages/analytics/vitest.config.ts` and `apps/web/vitest.config.ts` (Story 0.10's `@festgrid/testing-config` package exists with `vitest-react.ts`/`msw-handlers.ts`); create only if Story 1.3b/1.3c/1.4/1.5a hasn't already added it.
  - NEW-OR-VERIFY `packages/ui/package.json` — `"test": "vitest run"` script and devDependencies `@festgrid/testing-config` (workspace), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`; add only if not already present from a sibling `packages/ui` story.
- **Rule Mapping:**
  - *UI Components & Scalability (Domain Features)* → component placed in `packages/ui/src/features/events/`.
  - *i18n foundational principle (AD-6)* → `labels` override prop pattern, no direct `next-intl` dependency inside `packages/ui`.
  - *UI Patterns & UX Invariants (Context-Aware Detail Views / loaders)* → `loading` skeleton and `error` state props give Story 1.6's modal and full-page routes an identical, invocation-agnostic contract.
  - *Data Type Compatibility* → `imageUrl`/`mapUrl` kept generic/decoupled from `EventInfo`/`LocationDetails`, per the section above.
  - *Testing Philosophy (testing trophy)* → integration-style component tests via Vitest + Testing Library, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: full-data render with multiple schedules, minimal-guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy` attribute, error-state render, map link present/absent, type/category tag rendering present/absent, and favorite/calendar controls absent when their handler props are not passed.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing renders `EventDetailView` on a real page or in a real modal yet — that lands with Story 1.6).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `EventDetailView` as a standalone, presentation-only UI component in `packages/ui`; no backend work, no live-data wiring into any page/modal route, no Favorite/Add-to-Calendar mutation logic, no Next/Previous navigation (all handled by Story 1.6 and Epic 2 stories).
- [ ] Architecture confirmed: component built with plain Tailwind + native HTML elements only (no `next/image`, no `next-intl`, no maps SDK), placed under `packages/ui/src/features/events/`.
- [ ] Testing plan confirmed: Vitest + `@testing-library/react` component tests via `packages/ui/vitest.config.ts` importing `@festgrid/testing-config/vitest-react`.
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story); Gate 2 findings (missing ticket-price/type-category-tag fields, per-schedule vs top-level field ownership, multi-schedule rendering, map-link decoupling, reserved favorite/calendar slots) are folded into this story's expanded AC1–AC14 rather than split further — no new prerequisite story required.
- [ ] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [ ] Component tests (Vitest + `@testing-library/react`) for: full-data render with multiple schedules, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton (`aria-busy`), error state, map link present/absent, type/category tag rendering present/absent, and favorite/calendar controls hidden when their handler props are absent.
- [ ] No E2E test required for this story (no live page or modal consumes `EventDetailView` yet; E2E coverage arrives with Story 1.6's modal-open and deep-link fallback flows).
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per project-context.md; `packages/ui` follows the "testing trophy" integration-style approach.
- [ ] Note: Use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [ ] `EventDetailView` component implemented in `packages/ui/src/features/events/EventDetailView.tsx`.
- [ ] Strictly-typed `EventDetailViewProps`/`ScheduleDetail` covering all guaranteed and optional fields (`EventDetailView.types.ts`).
- [ ] Multi-schedule rendering (date/time/performers/location/price per schedule, event-level location fallback).
- [ ] Optional map link rendering, decoupled from any maps SDK.
- [ ] Type/category tag rendering, omitted when absent.
- [ ] Loading skeleton state with `aria-busy`.
- [ ] Error state rendering.
- [ ] Image success + fallback/placeholder handling (no-`imageUrl` and `onError` cases).
- [ ] Reserved (unwired) favorite and add-to-calendar slots.
- [ ] Semantic, keyboard-navigable structure.
- [ ] `labels` override prop for i18n-readiness.
- [ ] Exported from `packages/ui`'s public entry point with TSDoc prop documentation.
- [ ] Component tests written and passing.
- [ ] **(Amendment, AC15)** Optional `originalPostUrl`/`sourcePostUrl` attribution links, each independently omittable, with component tests for all four presence/absence combinations.
- [ ] **(Amendment, AC16)** Optional `accountName`/`accountPlatformIconUrl`/`accountHref` account-attribution link (all-or-nothing), rendering independently alongside the AC15 source-post links, with component tests covering both present-together and each-missing cases.

## Out of Scope

- Wiring `EventDetailView` into the actual modal route (`@modal/(.)events/[slug]`) or full-page route (`/events/[slug]`) — handled by Story 1.6.
- Live GraphQL data fetching / real event data, and mapping fetched `EventInfo`/`Schedule` data onto this component's props — handled by Story 1.6.
- Interactive favorite/unfavorite mutation logic — handled by Story 2.1 and Story 2.1a; this story only reserves the prop slot (AC11).
- Interactive add-to-calendar mutation/dialog logic — handled by a future Epic 2 story; this story only reserves the prop slot (AC11).
- Constructing `mapUrl` from `LocationDetails.coordinates` (e.g. building a Google Maps deep link) — the caller's responsibility (Story 1.6); this component only renders an already-constructed URL if provided.
- Next/Previous context-aware navigation (`ContextAwareNavigation`) — handled by Story 1.6 per its own Dev Notes.
- Reconciling or rewriting the stale `1-6-view-event-details.md` story file's outdated component-location plan — not this story's responsibility; noted for awareness only.
- Storybook, visual-regression, or design-token tooling — not set up anywhere in this project yet.

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC16) are met.
- [ ] Required component tests (see Testing Requirements) are written and passing.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [ ] `EventDetailView` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
