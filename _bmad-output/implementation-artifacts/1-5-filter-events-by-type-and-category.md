---
baseline_commit: 4f9da635068ae5956013a7f4dfaf88c1c30dd2d0
---
# Story 1.5: Filter events by type and category

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.5
- Status: review

## Story

As a user,
I want to be able to filter events by type and category,
so that I can narrow down the list of events to my interests.

## Acceptance Criteria

1. **AC1 — Filter Hub controls:** Given I am on the main page (`/`), when I view the discovery page, then a Filter Hub is displayed offering `EventType` and `EventCategory` facets, each supporting multi-selection via tap-to-toggle (the `MultiSelect` component, Story 1.5a) — not a searchable popover/combobox, matching the authoritative UX interaction (`EXPERIENCE.md`, the Sarah discovery scenario).
2. **AC2 — Server-side DSL filtering, not client-side:** And selecting one or more values in a facet is expressed as an `in` condition (value = the array of selected enum strings for that facet) sent through the Unified Query DSL (AD-1) to the backend `events` query (Story 1.3a) — never a client-side filter applied to already-fetched results.
3. **AC3 — OR within a facet, AND across facets/search/default:** And multiple selections within one facet use OR semantics, expressed as a single `in` condition whose `value` array holds all selected values for that facet (not multiple `or`-joined conditions) — e.g. selecting "Festival" and "Concert" in the Type facet produces one `{ field: "types", operator: "in", value: ["FESTIVAL", "CONCERT"] }` condition. Selections across the Type facet, the Category facet, the active search query (Story 1.4), and Story 1.3's default list condition are combined via `and` (siblings in one flat `and` group — see Dev Notes).
4. **AC4 — URL state, shareable, combinable with search:** And the active filter selections are reflected in the URL as shareable/bookmarkable state via `nuqs` (AD-4 URL State), combinable with the `q` search parameter from Story 1.4 without either overwriting the other.
5. **AC5 — Clearing filters:** And a "Clear filters" action resets both facets to empty, removing the corresponding URL parameters entirely (not left as empty-array params) and returning to the default ongoing/upcoming list (Story 1.3) — while leaving any active search query (Story 1.4) and other unrelated URL parameters untouched.
6. **AC6 — i18n:** And all Filter Hub UI text (facet labels, the "Clear filters" action, and every `EventType`/`EventCategory` enum value's display label) is localized using `next-intl`, with message keys present in both `en` and `id` locale files (AD-6, NFR23).
7. **AC7 — Analytics:** And selecting or clearing a filter fires a `filter_applied` PostHog event (AD-5) whenever the resulting selection changes, carrying the full current selection for both facets.
8. **AC8 — Test coverage:** And integration tests cover the multi-select `in`-condition DSL semantics (single value, multiple values, combined with search via `and`, mocked at the GraphQL layer), URL-state sync, and clear-filter reset behavior; one E2E test covers selecting type/category filters, seeing the filtered results, and clearing them.

## Tasks / Subtasks

- [x] Task 1: Build `FilterHub` composing `MultiSelect` (AC1, AC6)
  - [x] Create `packages/ui/src/features/events/FilterHub.tsx`, importing `MultiSelect` from `packages/ui/src/core/multi-select.tsx` (Story 1.5a — **hard dependency, not yet built**, see Pre-Coding Approval Gate).
  - [x] Render two `MultiSelect` instances: one for `EventType` (facet label "Type"), one for `EventCategory` (facet label "Category"), each populated with the full enum value list from `packages/database/schema.ts`'s `eventTypeEnum`/`eventCategoryEnum` (12 values each — see Dev Notes for the exact list) via localized display labels, not raw enum strings.
  - [x] Render a single "Clear filters" action clearing both facets (AC5).
  - [x] Export `FilterHub` from `packages/ui/src/features/events/index.ts` (the barrel Story 1.3b/1.4/1.3c create/extend — check for conflicts, extend rather than duplicate).
- [x] Task 2: Wire filter selections into URL state (AC4, AC5)
  - [x] Use `nuqs`'s `useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]))` and the equivalent for `categories`, following the same "empty array removes the param" pattern Story 1.4 established for `q`.
  - [x] Ensure setting a facet to `[]` (via individual deselection or "Clear filters") removes that URL param entirely, not `?types=`.
- [x] Task 3: Extend the discovery page's DSL query-builder (AC2, AC3)
  - [x] In `apps/web/src/app/[locale]/page.tsx`'s `buildEventsQuery` helper (established by Story 1.4 — extend it, do not create a parallel one), add `types`/`categories` `in` conditions to the same flat `and`-group array as Story 1.3's base condition and Story 1.4's search `or`-group, only when the respective facet's selection is non-empty.
  - [x] Confirm at build time the exact GraphQL/DSL field names Story 1.3a's schema exposes for these facets (expected `types`/`categories`, mirroring the Drizzle column names — AD-1's `"category"` example is illustrative only, not an authoritative field list).
- [x] Task 4: Analytics (AC7)
  - [x] Call `usePostHog().capture('filter_applied', { types: string[], categories: string[] })` (from `@festgrid/analytics`) whenever the resulting selection changes (on each toggle/clear that changes the effective filter state), following the `noun_verb` naming convention (AD-5.1).
- [x] Task 5: Localize copy (AC6)
  - [x] Add message keys to `apps/web/locales/en.json` and `apps/web/locales/id.json`: `FilterHub.typeLabel`, `FilterHub.categoryLabel`, `FilterHub.clearLabel`, and one key per enum value under `EventType.*`/`EventCategory.*` — see Dev Notes for the exact key list (24 enum keys + 3 Filter Hub keys = 27 new keys total).
- [x] Task 6: Tests (AC8)
  - [x] Integration tests (Vitest + MSW, `@festgrid/testing-config`) covering: a single-facet, single-value selection produces the correct `in` condition; a single-facet, multi-value selection produces one `in` condition with all selected values (not multiple conditions); selections across both facets plus an active search query combine via one flat `and` group; clearing filters removes the URL params and restores the default query.
  - [x] One E2E happy-path test (`apps/web/e2e/filter.spec.ts`, Playwright, alongside `apps/web/e2e/home.spec.ts` and Story 1.4's `search.spec.ts`) covering: selecting a type and a category, seeing the filtered grid and URL update, then clearing filters and seeing the full list return.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, `1.5` explicitly listed in `stories_covered`). The sweep's one finding — no GraphQL authenticated-context layer (Story 0.17) — does not apply: type/category filtering is an unauthenticated/public discovery-page feature with no per-user data and no `context.user` dependency. No new Gate 1/3 gap for this story.
- **Gate 2 (UI Complexity & Reusability) — run fresh via subagent persona Freya (2026-08-01): gap found.** The originally-drafted `MultiSelect` (a Shadcn `Popover`+`Command` faceted-filter combobox — trigger button, badges, search-within-popover, checkmark list, "Clear filters" footer) stacks the same category of independent state dimensions (open/close, internal search-filter, multi-toggle selection, keyboard nav, combobox a11y) that triggered the Story 1.3b (`EventCard`)/1.3c (`useInfiniteScroll`) splits, and clears the reuse bar independently of that (Epic 3's FR31 — filtering subscribed-account events by type/category — is a near-certain second consumer beyond this story's `FilterHub`). **Resolution: split into Story 1.5a** (`packages/ui/src/core/multi-select.tsx`), positioned immediately before this story as its prerequisite. `FilterHub` itself does **not** independently trigger Gate 2 — it is thin composition (two `MultiSelect` instances + `nuqs` wiring), comparable to how the discovery page's own composition logic stayed in Stories 1.3/1.4 rather than being split further.
  - **Documentation-consistency correction (drives AC1's scope, not just a flagged discrepancy):** Neither `DESIGN.md` nor `EXPERIENCE.md` nor the Sarah discovery scenario (`design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery/01.1-event-discovery.md`) describes a searchable popover/combobox for type/category filtering — both describe simple **tap-to-toggle buttons/tags** with the grid updating in real time ("Taps on 'Family & Kids' category from the Filter Hub" / "Taps on 'Workshop' type from the Filter Hub"). The original draft's Shadcn "faceted filter" combobox pattern was an unsourced embellishment, not authoritative FestGrid UX. Story 1.5a's ACs (and therefore this story's AC1) are scoped to the tap-to-toggle interaction actually specified in the UX artifacts.
- **Lightweight escape-hatch guard (no subagent):** Checked this story's specific scope for anything neither the epic-1 sweep nor the fresh Gate 2 pass anticipated — filtering introduces no new external service, no new data entity, and no new infra dependency; the `in`-condition DSL shape for `types`/`categories` was explicitly designed into Story 1.3a's resolver scope (epics.md Story 1.3a AC: "supports filtering by ... type/category (`in`)"). Nothing new found.

### Data Type Compatibility & Migration Requirements

- **No database migration required by this story.** `packages/database/schema.ts` (confirmed as of 2026-08-01) already carries GIN-eligible btree indexes on both columns this story filters — `event_types_idx` (`events.types`) and `event_categories_idx` (`events.categories`) — both added by Story 1.1, satisfying `project-context.md`'s "columns frequently used in WHERE clauses must be indexed" rule. This story adds no new column, table, or type.
  - **Architecture caveat for Story 1.3a's resolver (not this story's action item, but a correctness note the dev/architect should not miss):** `types`/`categories` are Postgres array columns (`text[]`), not scalar enum columns. A DSL `in` condition against an array column semantically means "the event's array overlaps the selected values" (Postgres `&&`/`ANY` array-overlap semantics), not a plain scalar `IN (...)`. This story only constructs the DSL JSON fragment (`{ field: "types", operator: "in", value: [...] }`); how Story 1.3a's DSL-to-Drizzle mapper interprets `in` against an array-typed field is entirely that story's own resolver-implementation responsibility.
- **No backend/domain code changes required by this story.** Story 1.3a's own AC explicitly names type/category `in` filtering as part of its scope; this story is a pure consumer constructing DSL JSON client-side and passing it as a GraphQL variable to the existing `events` query.
- **No changes required to `packages/shared-types`.** This story introduces no new field or type and reuses the existing `EventQueryConditionInput`/enum shapes from Story 1.3a.

### Combining with Story 1.3's base query and Story 1.4's search

As of this story's creation (2026-08-01), Stories 1.3, 1.3a, 1.3b, 1.3c, and 1.4 are all `ready-for-dev` but **not yet implemented** (`apps/web/src/app/[locale]/page.tsx` is still Story 0.3's theme-verification demo content; no `buildEventsQuery` helper exists on disk yet). This story's query-builder extension therefore depends on inspecting whatever concrete shape Stories 1.3/1.4 land with:

1. Inspect how `buildEventsQuery` (or equivalent, per Story 1.4's Dev Notes) currently combines Story 1.3's base "ongoing or upcoming" condition with Story 1.4's search `or`-group.
2. Push this story's `types`/`categories` `in` conditions into that **same flat `and`-group array** as additional sibling conditions — do not nest an extra `and`/`or` layer per facet. The resulting shape when all three are active is: `{ operator: "and", conditions: [<1.3's base condition>, <1.4's search or-group>, <this story's types in-condition>, <this story's categories in-condition>] }`, omitting whichever conditions are inactive (no search text, no facet selections).
3. If Story 1.3 sends no explicit base condition (relying on a resolver-side default), this story's `in` conditions combine only with Story 1.4's search group (if active), or stand alone as the sole `query` value.

### Architecture and technical constraints

- **API access:** Exclusively via the backend GraphQL `events` query (AD-1, AD-2) — this story adds no new GraphQL operation document, it only extends the `query` variable's `conditions` array passed to Story 1.3's existing generated hook.
- **State management categorization (AD-4):**
  - **URL State:** Both facet selections (`types`, `categories` params) → `nuqs`'s `useQueryState` with `parseAsArrayOf(parseAsString).withDefault([])`, typed/parsed, shareable, SSR-compatible (AC4).
  - **Server State:** No change from Stories 1.3/1.4 — the events list remains `@tanstack/react-query`'s `useInfiniteQuery`; changing `types`/`categories` changes the query key/variables, which react-query naturally refetches from page 1.
  - **Client Global State:** None introduced by this story.
- **Reusable component callout:** `FilterHub` → `packages/ui/src/features/events/FilterHub.tsx` (this story), composing `MultiSelect` → `packages/ui/src/core/multi-select.tsx` (Story 1.5a, prerequisite, per Gate 2 finding above).
- **Analytics (AD-5):** New tracked event — **`filter_applied`**, payload `{ types: string[], categories: string[] }`, fired whenever the resulting selection changes (toggle or clear). Call `usePostHog().capture('filter_applied', { types, categories })` directly (no dedicated typed analytics helper exists yet beyond `usePostHog`/`PostHogProvider`, matching Story 1.4's same approach), following the `noun_verb` naming convention (AD-5.1).
- **i18n (AD-6):** New message keys required in both `en.json` and `id.json`:
  - `FilterHub.typeLabel`, `FilterHub.categoryLabel`, `FilterHub.clearLabel`
  - `EventType.EXHIBITION`, `EventType.COMPETITION`, `EventType.FESTIVAL`, `EventType.PERFORMANCE`, `EventType.WORKSHOP`, `EventType.SEMINAR`, `EventType.MARKET`, `EventType.GATHERING`, `EventType.PROMOTION`, `EventType.FUNDRAISER`, `EventType.CIVIC`, `EventType.OTHER`
  - `EventCategory.MUSIC`, `EventCategory.ARTS_AND_CULTURE`, `EventCategory.FOOD_AND_DRINK`, `EventCategory.SPORTS_AND_FITNESS`, `EventCategory.FAMILY_AND_KIDS`, `EventCategory.HOBBIES_AND_INTERESTS`, `EventCategory.BUSINESS_AND_NETWORKING`, `EventCategory.HEALTH_AND_WELLNESS`, `EventCategory.HOLIDAY`, `EventCategory.CHARITY_AND_CAUSES`, `EventCategory.CIVIC_AND_COMMUNITY`, `EventCategory.OTHER`
  - (Enum key lists sourced directly from `packages/database/schema.ts`'s `eventTypeEnum`/`eventCategoryEnum` as of 2026-08-01 — confirm no new enum values were added by a later migration before finalizing copy.)
- **File/path expectations:**
  - Page route: `apps/web/src/app/[locale]/page.tsx` (confirmed still Story 0.3's demo content as of this story's creation).
  - `FilterHub`: new, `packages/ui/src/features/events/FilterHub.tsx`, exported via the `packages/ui/src/features/events/index.ts` barrel (created/extended by whichever of Story 1.3b/1.3c/1.4 lands first — extend, don't duplicate).
  - `MultiSelect`: consumed from `packages/ui/src/core/multi-select.tsx` — **not built by this story**, see Story 1.5a.
  - `nuqs` (`^2.9.4`) is already installed in `apps/web`; `NuqsAdapter` is already composed once in `apps/web/src/app/[locale]/layout.tsx` — this story only consumes `useQueryState`/`parseAsArrayOf`.
  - Locale message files: `apps/web/locales/en.json`, `apps/web/locales/id.json`.

### Previous Story Intelligence

- **Story 1.4 (same session, 2026-08-01):** Established the `buildEventsQuery` page-level query-builder pattern this story must extend (not duplicate), the "empty value removes the URL param" convention for `nuqs`, and confirmed the identical hard-dependency situation (Stories 1.3/1.3a/1.3b/1.3c ready-for-dev but unimplemented). Also confirmed `apps/web` has Vitest + MSW fully wired.
- **Story 1.3a:** Its AC explicitly names "filtering by ... type/category (`in`)" as in-scope — this story's `in`-condition shape is backed by already-planned (though not yet implemented) resolver capability, not a new backend requirement this story must build.
- **Story 1.5a (new, this session):** Prerequisite for `MultiSelect` — see Pre-Coding Approval Gate. Its ACs were scoped to a tap-to-toggle interaction (not a searchable combobox) based on the same Gate 2 UX-source review performed for this story.
- **Story 1.1's seed data (Story 1.2, 3 fixture events):** Too few events/type-category combinations to meaningfully exercise multi-value filter scenarios via manual/local testing — prefer MSW-mocked fixtures with distinct type/category combinations for integration tests, consistent with Stories 1.3/1.4's same recommendation.

### Git Intelligence Summary

- Recent commits (`ac70779` "refine implementation artifacts for Epic 1 stories", `81f76dd` "mark story 1.2a as complete", `2a77fa0` "update Gate 2 findings for story 1.3 artifact", `85c2a9d` "set up runtime schema validation with AJV and Zod") touch planning artifacts and validation tooling, not the discovery page or this story's direct dependencies. `sprint-status.yaml` shows Story `0-17-set-up-graphql-authenticated-context-layer` moved to `in-progress` concurrently with this story's creation — unrelated to this story's scope (public, unauthenticated filtering). No in-flight application-code pattern exists yet for `packages/ui/src/features/events/` beyond what Story 1.4's Dev Notes already describe.

### Latest Tech Information

- `nuqs` v2 (`^2.9.4`): `parseAsArrayOf(parseAsString).withDefault([])` serializes/deserializes comma-separated URL values (e.g. `?types=FESTIVAL,CONCERT`) and treats an empty array as "absent," matching AC5's clear-and-remove-param behavior with no extra logic needed.
- `graphql-codegen`'s `typescript-react-query` plugin (already a devDependency per Story 1.3a's Dev Notes) generates a typed hook whose `query` variable accepts `EventQueryConditionInput` — no codegen changes needed for this story since it only supplies additional variable values to the existing generated hook.

## Global Rules References

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-4, AD-5, AD-6)
- `_bmad-output/planning-artifacts/epics.md` (Stories 1.3, 1.3a, 1.4, 1.5, 1.5a)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/1-frontend.md`, `docs/infrastructure/2-backend.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- NEW `packages/ui/src/features/events/FilterHub.tsx`: composes two `MultiSelect` instances (Story 1.5a) for `EventType`/`EventCategory`, wires selections to `nuqs` URL state, renders "Clear filters."
- UPDATE `packages/ui/src/features/events/index.ts` (barrel): export `FilterHub`.
- UPDATE `apps/web/src/app/[locale]/page.tsx`: read `types`/`categories` URL params via `nuqs`, render `FilterHub`, extend the `buildEventsQuery` builder (Story 1.4) with `in` conditions for both facets in the shared flat `and` group.
- UPDATE `apps/web/locales/en.json`, `apps/web/locales/id.json`: add the 27 new message keys listed in Dev Notes.
- NEW integration test(s) (Vitest + MSW): single-value `in` condition, multi-value `in` condition (single condition, not multiple), combination with search via `and`, clear-filter URL/query reset.
- NEW `apps/web/e2e/filter.spec.ts` (Playwright): select type + category, see filtered grid and URL, clear filters, see full list return.
- **Consumed, not modified by this story:** `packages/ui/src/core/multi-select.tsx` (Story 1.5a — prerequisite), `apps/backend` (Story 1.3a's resolver/DSL mapper), Story 1.3's `EventCard`/infinite-scroll wiring, Story 1.4's `SearchBar`/query-builder.

### Rule Mapping

- Server-side DSL filtering, never client-side (AC2, AD-1/AD-2) → facet selections compiled to `in` conditions, combined via `and` with Story 1.3's base condition and Story 1.4's search group, sent as the existing `events` query's `query` variable.
- OR-within-facet via `in` array, not nested `or` (AC3) → one `in` condition per facet, value = array of selected enum strings.
- URL State (AC4, AC5, AD-4) → `nuqs`'s `useQueryState('types'/'categories', parseAsArrayOf(parseAsString).withDefault([]))`; no new Zustand/React state duplicating this value.
- Reuse boundary (Gate 2 finding) → `MultiSelect` split into Story 1.5a (`packages/ui/src/core/`); `FilterHub` built in this story at `packages/ui/src/features/events/` for reuse by future Event List View consumers (e.g. Epic 3's FR31).
- i18n-first (AC6, AD-6) → all new copy (facet labels, clear action, 24 enum value labels) sourced via `useTranslations`; keys added to both `en.json`/`id.json`.
- Analytics (AD-5) → `filter_applied` event via `usePostHog().capture(...)`, `noun_verb` naming, fired on any selection-changing toggle/clear.
- Extensibility (epics.md Story 1.5 AC) → query-builder extension keeps the flat `and`-group shape Story 1.4 established, so later stories can add further sibling conditions without restructuring.

### Verification Plan

- Integration test: a single selected value in one facet produces the correct single-value `in` condition.
- Integration test: multiple selected values in one facet produce one `in` condition with all values (not multiple `or`-joined conditions) — asserts AC3's OR-within-facet semantics.
- Integration test: active facet selections combine with an active search query via one flat `and` group (assert request shape via MSW, not resolver behavior).
- Integration test: "Clear filters" removes both URL params and restores the default (or search-only) query.
- E2E happy-path (`apps/web/e2e/filter.spec.ts`): select a type and a category, see the filtered list and URL reflect both, clear filters, see the full list return.
- `pnpm --filter web lint`, `pnpm --filter web build` (type-check), `pnpm --filter web test`, and `pnpm --filter web test:e2e` all clean; `pnpm --filter @festgrid/ui lint`/build clean for `FilterHub`.

## Pre-Coding Approval Gate

- [x] Scope confirmed: frontend-only (`apps/web`, `packages/ui`) — no changes to `apps/backend`/`packages/domain`/`packages/database` (Story 1.3a's DSL mapper already scoped to support type/category `in` filtering per its own AC).
- [x] **Prerequisite `1-5a-build-the-reusable-multiselect-component` accepted:** Gate 2 found `MultiSelect` must be split into its own story (see Dev Notes — Architecture & UX Gate Findings). Story 1.5a is `backlog` in `sprint-status.yaml` and **not yet built**. Confirm Story 1.5a will be implemented first (recommended, so `FilterHub` consumes a real component), or explicitly accept building `FilterHub` against a stub/placeholder `MultiSelect` now, with real integration following once 1.5a ships.
- [x] **Hard dependency sequencing accepted:** Stories `1-3`, `1-3a`, `1-3b`, `1-3c`, and `1-4` are all `ready-for-dev` but **not yet implemented** as of this story's creation (page still Story 0.3 demo content; backend GraphQL schema not yet extended; no `buildEventsQuery` helper on disk). This story extends Story 1.4's query-builder and cannot functionally complete until 1.3/1.4 (and their own dependencies) land. Confirm implementation order, or explicitly accept building against mocked data now.
- [x] **Base-query combination ambiguity accepted:** As documented in Dev Notes ("Combining with Story 1.3's base query and Story 1.4's search"), the exact mechanism is not yet settled in code. Confirm the dev agent will inspect the actual implementation at build time and combine accordingly.
- [x] Architecture and API/data boundaries confirmed (GraphQL-only via the existing `events` query; AD-1/AD-2/AD-4).
- [x] Testing plan reviewed (Vitest/MSW integration tests + one Playwright E2E happy path).
- [x] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from swept `epic-1-readiness.md` (no new gap for this story); Gate 2 run fresh via subagent persona Freya, found a gap (`MultiSelect` split to Story 1.5a) and a UX-documentation correction (tap-to-toggle, not a searchable combobox).
- [x] Human approval to start coding granted

## Testing Requirements

- Integration coverage (Vitest + MSW) for single-value and multi-value `in`-condition DSL shapes per facet.
- Integration coverage for combining facet selections with the active search query via one flat `and` group.
- Integration coverage for clear-filter URL/query reset behavior.
- One E2E happy-path flow (Playwright) for selecting type/category filters, seeing filtered results, and clearing them.

## Deliverables Checklist

- [x] `FilterHub` component (`packages/ui/src/features/events/FilterHub.tsx`) built and exported, consuming `MultiSelect` from Story 1.5a.
- [x] Facet selections wired to URL state via `nuqs` (`types`/`categories` params), shareable and clearable.
- [x] Discovery page's DSL query-builder (`buildEventsQuery`) extended with `in` conditions for both facets, combined correctly with Story 1.3's base query and Story 1.4's search.
- [x] All 27 new `en`/`id` message keys added (Filter Hub labels + `EventType`/`EventCategory` enum labels).
- [x] `filter_applied` PostHog event instrumented.
- [x] Integration and E2E tests written and passing.

## Out of Scope

- The `MultiSelect` component itself (Story 1.5a — prerequisite, not built here; this story only consumes it).
- Filter by Location (mentioned in `EXPERIENCE.md`'s Filter Hub description but scoped to saved locations, which don't exist until Epic 2 — `epics.md`'s Story 1.5 AC covers type/category only).
- Event details navigation (Story 1.6/1.6a).
- Search input itself (Story 1.4 — already built, only consumed/extended here).
- Filtering subscribed-account events by type/category/source (Epic 3, FR31) — a future consumer of `MultiSelect`/`FilterHub`, not this story's scope.

## Definition of Done

- Acceptance criteria (AC1-AC8) satisfied.
- Required integration and E2E tests pass.
- Lint and type checks pass for `apps/web` and `packages/ui`.
- `en`/`id` locale files updated with all 27 new message keys (AD-6).

## Completion Status

Completed.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented FilterHub integrating MultiSelect logic
- Extended query DSL to handle arrays and types/categories IN clauses
- Wrote integration tests for search and filtering behaviour
- Wrote E2E tests validating filtering UI
- Exposed MultiSelect's clear option via FilterHub's global clear mechanism

### File List

- `packages/ui/src/features/events/FilterHub.tsx`
- `packages/ui/src/features/events/index.ts`
- `packages/ui/src/core/multi-select.types.ts`
- `packages/ui/src/core/multi-select.tsx`
- `packages/ui/package.json`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/src/app/[locale]/home-content.tsx`
- `apps/web/src/app/[locale]/page.test.tsx`
- `apps/web/e2e/filter.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-5-filter-events-by-type-and-category.md`
