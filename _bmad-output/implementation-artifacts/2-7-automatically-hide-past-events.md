# Story 2.7: Automatically hide past events

## Story Details

- Epic: 2
- Story ID: 2.7
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want past events to be automatically hidden after a configurable number of days, everywhere I browse or manage events,
so that the main event feed and my personal lists stay clean and relevant.

## Acceptance Criteria

1. **Given** any caller (authenticated or anonymous) queries `events` — Discovery/Feed, Favorites, My Calendar, search/filter results, the weekly calendar view — all of which funnel through the single `Query.events` resolver per AD-2, **when** the query resolves, **then** any event whose schedules have *all* ended more than `N` days ago (no schedule's `eventEndDate` — or `eventStartDate`, if it has no end date — falls on/after `now - N days`) is excluded from both `items` and `totalCount`, via a server-side default condition AND-composed with the caller's own query — never a post-fetch/client-side filter.
2. **Given** an authenticated caller, **when** `N` is resolved, **then** it is read from `mySettings.hidePastEventsAfterDays` (Story 2.6a) via the existing `getOrCreateUserSettings(userId)` helper — never a client-supplied value, and never re-implemented ad hoc.
3. **Given** an unauthenticated (anonymous) caller, **when** `N` is resolved, **then** a fixed default of `7` is used (matching `user_settings.hide_past_events_after_days`'s column default from Story 2.6a) with no DB lookup required.
4. **Given** an event has multiple schedules (a main schedule plus one or more sub-schedules), **when** at least one schedule of any kind has not yet crossed the `N`-days-passed threshold, **then** the event remains visible — mirroring Story 1.3h's EXISTS-across-all-schedules approach (`scheduleDateRange`), not a main-schedule-only check.
5. **Given** the caller also supplies their own DSL query (search/types/categories/nearby/date-range), **when** the default visibility condition is composed, **then** it is AND-combined with the caller's query, and existing composition behavior (Story 1.3h AC4's precedent) continues to work unchanged.
6. **Given** the default visibility condition is expressed as an entry in an explicit, ordered list (`buildDefaultEventVisibilityConditions`), **when** future stories (4.3a's personal report-hide, 4.4a's moderator soft-delete) need to add their own hide-rules, **then** they can append additional entries to that same list without restructuring the resolver — this story implements only the one entry (the past-event rule); rules 2/3 do not exist yet and are not built here.
7. **Given** Story 1.3h's `overlaps` DSL operator previously required both `from` and `to`, **when** this story's condition supplies `to: null`, **then** `buildDrizzleWhere`'s `overlaps` case treats `null` as an unbounded/open upper range (`daterange(from::date, NULL, '[]')`), and existing bounded `overlaps` usage (Story 1.3h, Story 1.3f's weekly calendar) is unaffected — full backward compatibility, no regression.
8. **Given** the single-event lookup (`Query.event`, used by event detail views) and direct deep-link access, **when** this story ships, **then** the default visibility filter is **not** applied there — consistent with the PRD's existing "may be bypassed via direct deep-link" allowance for detail views. Only the list/collection endpoint (`Query.events`) is affected.
9. **And** AD-1's "Fields and Operators" documentation (`festgrid-architecture-spine.md`) is updated to reflect `overlaps`'s new `to: string | null` capability, mirroring Story 1.3h's own doc-update precedent.

## Tasks / Subtasks

- [ ] **Task 1: Extend `overlaps` to accept an open-ended `to: null` bound** (AC: 7) — `packages/graphql-select`
  - [ ] In `packages/graphql-select/drizzle-where.ts`'s `overlaps` case, change the value cast from `{ from: string; to: string }` to `{ from: string; to: string | null }`.
  - [ ] Build the upper-bound SQL fragment conditionally: when `to === null`, pass a literal `NULL` into `daterange(...)` (Postgres treats a `NULL` bound as unbounded, ignoring the `'[]'` inclusivity flag for that side); when `to` is a string, keep the existing `${to}::date` behavior unchanged.
  - [ ] Add a unit test in `drizzle-where.test.ts`: an `overlaps` condition with `value: { from: '2026-08-01', to: null }` returns a defined `SQL` (mirroring the existing bounded-`overlaps` test's `assert.ok(res !== undefined)` style). Do not remove or modify the existing bounded-`overlaps` test — it must keep passing unchanged (regression check for Story 1.3h/1.3f's usage).

- [ ] **Task 2: Build the default event-visibility condition (domain, pure)** (AC: 1, 4, 6) — `packages/domain`
  - [ ] Create `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts`:
    - Export `DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS = 7` (must be kept in sync with `user_settings.hide_past_events_after_days`'s column default, Story 2.6a — documented via a comment, not re-derived from the DB for the anonymous-caller path).
    - Export `buildDefaultEventVisibilityConditions({ hidePastEventsAfterDays, now = new Date() }): QueryCondition[]`: computes `threshold = UTC-midnight(now) - hidePastEventsAfterDays days`, formats it as an ISO date string (`YYYY-MM-DD`, matching `schedules.eventStartDate`/`eventEndDate`'s `date` column type and the existing `weekStart`/`weekEnd` string convention in `buildWeeklyCalendarQueryCondition.ts`), and returns a single-element array: `[{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: threshold, to: null } }]`. Use UTC date methods explicitly (`Date.UTC`, `setUTCDate`) to avoid local-timezone drift in a server process.
    - Return type is an array (not a single `QueryCondition`) precisely so the resolver can `and`-compose it with future entries (AC6) without restructuring — this story returns exactly one entry.
  - [ ] Add `export * from './buildDefaultEventVisibilityConditions.js';` to `packages/domain/src/events/index.ts` (the `./events` subpath export already exists in `packages/domain/package.json` — no `package.json` change needed).
  - [ ] Unit tests (`buildDefaultEventVisibilityConditions.test.ts`), 100% coverage per Testing Rules: default `N=7` threshold date math against an injected fixed `now`; a custom `N` (e.g. 14); the `N=0` boundary (threshold === today); confirms the returned array has exactly one entry with `to: null`.

- [ ] **Task 3: Wire the default visibility condition into `Query.events`** (AC: 1, 2, 3, 4, 5, 8) — `apps/backend`
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `Query.events` resolver (~line 336), after the existing `userId` resolution block: if `userId` is truthy, call the already-imported `getOrCreateUserSettings(userId)` and read `.hidePastEventsAfterDays`; otherwise use `DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS` (imported from `@festgrid/domain/events`) with no DB call.
  - [ ] Call `buildDefaultEventVisibilityConditions({ hidePastEventsAfterDays })` to get the default-conditions list.
  - [ ] Compose the final query condition passed to `buildDrizzleWhere` as `{ operator: 'and', conditions: [...(resolvedQuery ? [resolvedQuery] : []), ...defaultVisibilityConditions] }` — replacing the current `buildDrizzleWhere(resolvedQuery as QueryCondition, fieldMap)` call. The existing `totalCount` query already reuses the same `whereClause` variable — no separate change needed there, just confirm it still does after this edit.
  - [ ] Explicitly confirm (do not silently skip) that `Query.event` (single-event-by-id lookup, ~line 502) is **not** modified — AC8 requires deep-link/detail-view access to bypass this filter, matching the PRD's existing exemption for direct deep-links.
  - [ ] Explicitly confirm no other resolver needs a matching change — `buildWeeklyCalendarQueryCondition` (used by the future Story 1.3f discovery calendar view) composes its own DSL query client-side and sends it through the same `Query.events` resolver, so it inherits this default automatically with no resolver-specific work.

- [ ] **Task 4: Integration tests** (AC: 1, 2, 3, 4, 5, 8) — `apps/backend`
  - [ ] In `resolvers.test.ts`, new test block `'events - default past-event visibility filter (Story 2.7)'` (Yoga + real local test DB, matching the existing `'events - scheduleDateRange overlaps filtering (Story 1.3h)'` block's `createEventWithSchedule` helper pattern):
    - Anonymous caller: an event whose only schedule ended more than 7 days ago is excluded from `events(query: null)`; an event whose schedule ended within the last 7 days remains included.
    - Authenticated caller with a custom `hidePastEventsAfterDays` (set via `updateUserSettings`, Story 2.6a): confirms the threshold actually changes per-user (e.g., set to `1`, confirm an event 3 days past is now hidden where it wasn't at the default `7`).
    - Multi-schedule event: main schedule ended long ago, a sub-schedule is still within the threshold window — event remains visible (proves the EXISTS-across-all-schedules approach, not main-schedule-only — mirrors Story 1.3h's `subScheduleOnlyEvent` precedent).
    - Composition: the past-event filter combines correctly (via `and`) with an existing `types`/search condition supplied by the caller.
    - The `isFavorited`-sort path (`sortByFavoritedAt`) still applies the default visibility filter — a favorited-but-expired event is excluded even when querying `isFavorited: true`.
    - `Query.event` (single lookup by id) still returns a past/expired event directly by ID — confirms AC8's deep-link exemption is not accidentally broken by this story's resolver change.
  - [ ] Full regression pass: existing `'events - scheduleDateRange overlaps filtering (Story 1.3h)'` tests must still pass unchanged (the bounded-`overlaps` code path is untouched by Task 1's addition).

- [ ] **Task 5: Documentation** (AC: 9)
  - [ ] In `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, AD-1's "Fields and Operators" list, update the `scheduleDateRange` bullet from `overlaps (value: { from: string; to: string } ISO dates)` to `overlaps (value: { from: string; to: string | null } ISO dates — a null to means an open/unbounded upper range, added by Story 2.7)`.

- [ ] **Task 6: Manual verification**
  - [ ] `pnpm build` / `pnpm lint` clean at the repo root for touched packages (`packages/domain`, `packages/graphql-select`, `apps/backend`).
  - [ ] GraphiQL/`curl` smoke test: query `events` as both an anonymous and an authenticated caller against real seeded data (including at least one clearly past event), confirm the past event is excluded by default and confirm `updateUserSettings(hidePastEventsAfterDays: ...)` changes the authenticated caller's cutoff.
  - [ ] Confirm no codegen re-run is needed in either `apps/backend` or `apps/web` — `EventQueryConditionInput.value` is already untyped `JSON` (`apps/backend/src/schema/events.graphql:97`), so the `to: null` shape change requires no `.graphql`/SDL change (AC7 does not touch generated types).

## Dev Notes

### Architecture & UX Gate Findings

This story's scope changed substantially during creation (see Design Decisions below), well beyond what the swept `epic-2-readiness.md` (`swept: true`, 2026-08-04) anticipated for Story 2.7 — that report's only Gate 1/3 finding touching this story was "user-settings storage... addressed by Story 2.6a," with no mention of a global (not just personal-list) default filter, a reusable extensible mechanism, or a new Archive page. Per this workflow's escape-hatch guidance, all three gates were re-run fresh for this story rather than trusting the sweep as-is:

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona):** **PASS.** Extending the existing `overlaps` DSL operator (Story 1.3h) with an open-ended `to: null` bound is a legitimate in-bounds capability extension, not a new coupling or layer bypass — DSL operators are generic query primitives, and `packages/graphql-select` is already Drizzle/DB-coupled by design. Computing the per-caller threshold and composing the default condition entirely inside the `Query.events` resolver is correct backend business logic, not a frontend leak. No new infra, endpoint, or deploy target is introduced. Deferring Story 4.8's opt-in bypass entirely (not even stubbing it) is correct — no consumer needs it yet.
- **Gate 2 (UI Complexity & Reusability, Freya persona):** **PASS.** `design-artifacts/UX-festgrid-run-1/DESIGN.md` and `EXPERIENCE.md` contain no references to past-event hiding, an "N days" setting control, empty-state copy tied to hiding, or any notice/toast/banner concept for a disappearing event. This story ships zero UI (a pure server-side default filter), so there is nothing to split off, and nothing specified in the UX docs is being silently absorbed or dropped.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona):** **CONDITIONAL PASS — one doc-only action item, no story split.** The "extensible default-visibility-conditions list" is *not* a Gate 3 violation (a dependency with no consuming story) — epics.md already names Stories 4.3a/4.4a as the intended future extenders of this exact resolver-level pattern, and their condition shapes (report-based, status-based) aren't known yet, so building a generic multi-rule framework now would be guessing at an interface Epic 4 hasn't defined — YAGNI correctly favors building just the one rule, structured as a list of one. Distinct from (not a collision with) Story 0.22's `activeOnly(table)` AD-8 helper: 0.22 is a single-column `deletedAt IS NULL` fragment for user-owned join tables (`favorites`, `calendarAdditions`, `userLocations`, `subscriptions`, `apiKeys`); this story's mechanism composes heterogeneous hide-reasons directly on `events` itself. **Action taken:** Task 5 adds the AD-1 doc update Story 1.3h set precedent for, closing the one real gap found. **Flagged for later, not this story's problem:** AD-8 already binds `EventInfo` for a plain `deletedAt` column, while Story 4.4a's planned mechanism is a different shape (`status` enum + `deleted_at`, threshold-driven) — reconciling those two is Story 4.4a's own story-creation concern.

### Design Decisions Confirmed With User (2026-08-06)

Three rounds of real, non-mechanical tradeoffs were surfaced via `AskUserQuestion` before this story was drafted, since the user redirected scope mid-creation and neither `epics.md` (pre-2026-08-06) nor the PRD specified the broadened approach:

1. **Hide scope — global default vs. personal-lists-only.** Chosen: hide past events everywhere (Discovery/Feed, Favorites, My Calendar), not just personal lists as the original AC/PRD §3.4.2 wording said. Reasoning (user-directed): a global default keeps the whole app clean, with a future dedicated Archive page as the escape hatch rather than leaving stale events visible on Discovery.
2. **Archive page placement.** Chosen: reserve a full new story now — **Story 4.8** (Epic 4, after 4.3a/4.4a supply two of its three hide-reasons and after Epic 3 supplies subscription data) — over leaving only a loose note, or placing it in Epic 3/5. See epics.md's Story 4.8 section and its Note for the full reasoning.
3. **Filter mechanism.** Chosen: (a) reuse and extend Story 1.3h's `overlaps` operator with an open-ended `to: null`, over introducing a brand-new dedicated operator that would duplicate most of `overlaps`'s EXISTS-subquery logic; (b) structure the resolver's default-conditions composition as an explicit, ordered list now (this story populates its first and only entry), over a single hardcoded condition, so Epic 4's future rules have a documented, non-restructuring extension seam — without building those future rules speculatively (they don't exist yet; see Gate 3 above).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no schema/column mismatch found.** This story adds no new table or column. The one type-level change is additive and backward-compatible: `overlaps`'s value shape narrows from `{ from: string; to: string }` to `{ from: string; to: string | null }` (Task 1) — existing callers (Story 1.3h, Story 1.3f's weekly calendar) that always pass a concrete `to` string are unaffected; only the new `to: null` case is new behavior.
- **Impacted contracts:** `packages/graphql-select/drizzle-where.ts` (`overlaps` case); `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts` (new) + `index.ts` barrel; `apps/backend/src/schema/resolvers.ts` (`Query.events`); `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1 doc bullet, Task 5).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** Additive only — the inline `overlaps` value cast in `drizzle-where.ts` gains `| null` on `to`. No `packages/shared-types` change (the DSL's `value: any` / GraphQL `value: JSON` already accommodates this without a named interface, matching Story 1.3h's identical precedent).
- **Backward compatibility and rollout notes:** Purely additive at the type/operator level. The behavioral change (events now excluded by default) is intentional and epic-wide by design (this story's entire purpose) — not a regression to guard against, but worth calling out plainly: any existing manual testing, seed-data expectations, or E2E fixtures that assume *all* seeded events are always visible in `events()` results must be re-checked once this story ships, since events dated further than 7 days in the past will now disappear from default queries.
- **Verification checks:** Task 1/Task 2's unit tests (100% coverage on the new domain function; regression + new-case coverage on `overlaps`); Task 4's integration tests (default/custom thresholds, multi-schedule EXISTS correctness, composition, favorited-sort path, deep-link exemption).

### Architecture / technical constraints

- **AD-1 (Unified Query DSL) / AD-2 (Unified Event Querying):** This story's entire mechanism stays inside the existing `overlaps` operator and the single `Query.events` endpoint — no new operator, no new endpoint, matching both ADs' explicit "prevents separate/incompatible query mechanisms" rule. Task 5 keeps AD-1's own documentation current, per Story 1.3h's precedent.
- **Package boundaries:** SQL-building for the `to: null` case lives in `packages/graphql-select` (already Drizzle/ORM-coupled by design, matching where `overlaps`'s other logic already lives). The pure default-conditions composition (`buildDefaultEventVisibilityConditions`) lives in `packages/domain/src/events/`, dependency-free of DB/ORM/Node-only imports, mirroring `buildEventsQueryCondition.ts`'s existing pattern — the one difference being it is composed **server-side** in the resolver (not sent by the client), since it must be authoritative and not client-bypassable.
- **AD-7 (Authenticated Context):** `Query.events` remains "auth-tolerant" (works for both authenticated and anonymous callers, per its existing `try { requireAuth } catch {}` pattern) — this story does not change that; it only adds one more conditional, userId-gated DB read (`getOrCreateUserSettings`), consistent with the existing conditional `userLocations` read already in this resolver for `withinRadius`.
- **AD-8 (Soft-Delete Convention):** Not applicable to this story's own scope — `events` is not yet AD-8-bound (per AD-8's own text, `EventInfo`'s binding is "pre-existing, still not implemented in schema.ts"), and this story does not implement or touch that binding. The future moderator soft-delete rule (Story 4.4a) is a documented, deferred extension point (AC6), not built here.
- **General Architecture / Adapter Pattern:** No external service call is introduced. All new logic is either pure (`packages/domain`) or already-established backend DB access (`getOrCreateUserSettings`, unchanged from Story 2.6a).
- **State Management / Loader categorization: not applicable** — backend-only change, no `apps/web`/`packages/ui` code ships in this story, no async UI state is introduced.
- **AD-5 (Analytics) / AD-6 (i18n): not applicable** — no user-facing interaction, text, or UI ships from this story (matching Story 2.6a/2.5a/2.3b's identical zero-UI precedent).

### Previous/Sibling Story Intelligence (Stories 2.6a, 1.3h)

- **Story 2.6a (`review`, fully implemented in code)** — confirmed via direct reads of `apps/backend/src/schema/resolvers.ts` (imports `getOrCreateUserSettings`, `validateHidePastEventsAfterDays`) and `apps/backend/src/schema/resolvers.test.ts` (full `mySettings`/`updateUserSettings` integration test coverage already present, including default-value and get-or-create-idempotency assertions) that this dependency is real and complete, not just planned. `getOrCreateUserSettings(userId)` is the single sanctioned call site this story reuses (Task 3) — no ad hoc `db.select()` against `userSettings` is written here.
- **Story 1.3h (`review`, fully implemented in code)** — confirmed via direct reads of `packages/graphql-select/drizzle-where.ts` and its test file that the `overlaps` EXISTS-subquery mechanism (checking ALL of an event's schedules via `${eventIdCol} = ${correlateCol}`, not a `mainSchedulesOnly` join) is real, tested, and exactly the mechanism this story's Task 1 extends rather than duplicates. `buildWeeklyCalendarQueryCondition.ts` confirms the weekly-calendar view (future Story 1.3f) composes its own `scheduleDateRange`/`overlaps` condition client-side and sends it through the same `Query.events` resolver — meaning it inherits this story's default filter automatically, with no resolver-specific work needed for it.

### Git Intelligence Summary

Recent commits (`26b0fca` "add user menu story", `6cdcab0`, `5702673` "add user settings management", `baf6139` "add nearby filter functionality", `5db3f7a` "add withinRadius condition handling") confirm Stories 2.5a (`withinRadius`) and 2.6a (user settings) landed in code recently and are the direct, already-shipped precedents this story builds on. No commit touches `overlaps`'s value shape, `packages/domain/src/events/`, or any past-event/visibility-named file — confirms this story's scope genuinely has not started implementation. Note: `sprint-status.yaml` and `apps/backend`'s resolver/test files reflect some story statuses (`2-6a`, `2-8`) that advanced mid-session from a concurrent working session outside this story-creation pass — read as current, informational context, not something this story needs to reconcile.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Database & Performance; Code Quality & Style Rules → Code Organization; Testing Rules; General Architecture → Adapter Pattern)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.7, Story 2.6a, Story 1.3h, Story 1.3f, Story 4.3a, Story 4.4a, Story 4.8)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/3-database.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `packages/graphql-select/drizzle-where.ts` (`overlaps` case: nullable `to`); `drizzle-where.test.ts` (new `to: null` test case, existing bounded test preserved).
- New: `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts` (+ `.test.ts`).
- Modified: `packages/domain/src/events/index.ts` (barrel export addition — no `package.json` change, `./events` subpath already exported).
- Modified: `apps/backend/src/schema/resolvers.ts` (`Query.events`: conditional `hidePastEventsAfterDays` resolution + default-conditions composition into `whereClause`); `resolvers.test.ts` (new integration test block + full regression of the existing 1.3h block).
- Modified: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1 `overlaps` bullet updated for `to: string | null`).
- **Not modified:** `apps/backend/src/schema/events.graphql` / `apps/backend/src/generated/resolvers-types.ts` (no SDL/codegen change — `value: JSON` already opaque); `apps/web` (no source or generated-output change — this story is entirely server-side); `packages/ui` (no UI in this story); `packages/shared-types` (no new named interface needed); `Query.event` (single-event lookup, deliberately unchanged per AC8).

### Rule Mapping

- *AD-1/AD-2* → the default visibility rule stays inside the existing `overlaps` operator and the single `Query.events` endpoint; no new operator or endpoint (Tasks 1, 3).
- *AD-7* → `Query.events` remains auth-tolerant; the new `getOrCreateUserSettings` read is conditional on `userId`, matching the existing `withinRadius`/`userLocations` conditional-read pattern (Task 3).
- *Code Organization (packages/domain)* → the pure condition-builder lives in `packages/domain/src/events/`, DB/Node-dependency-free (Task 2); the DB-coupled `getOrCreateUserSettings` call stays in `apps/backend` (already built, Story 2.6a).
- *Testing Rules* → 100% unit coverage for the new `packages/domain` function (Task 2); integration tests for the resolver change, including a full regression pass of Story 1.3h's existing tests (Task 4).
- *Story-split-gate Gate 1/2/3* → all three gates re-run fresh for this story (not solely relying on the swept `epic-2-readiness.md`, since this story's scope changed substantially during creation); Gate 1/2 passed clean, Gate 3's one action item (AD-1 doc update) is Task 5.

### Verification Plan

- `packages/graphql-select`: `tsx --test` — new `to: null` unit test plus the existing bounded-`overlaps` test (regression).
- `packages/domain`: `tsx --test` — 100%-covered unit tests for `buildDefaultEventVisibilityConditions` (default/custom `N`, `N=0` boundary, deterministic via injected `now`).
- `apps/backend`: integration tests (Yoga + real local test DB, `resolvers.test.ts`) — anonymous default-threshold exclusion/inclusion; authenticated custom-threshold behavior via `updateUserSettings`; multi-schedule EXISTS correctness (sub-schedule keeps an event visible); composition with an existing `types`/search condition; `isFavorited`-sort path still filtered; `Query.event` deep-link exemption (AC8); full regression of Story 1.3h's existing `scheduleDateRange`/`overlaps` tests.
- Manual: GraphiQL/`curl` smoke test against real seeded data as both an anonymous and authenticated caller; confirm `pnpm build`/`pnpm lint` clean at the repo root; confirm no codegen re-run occurred/was needed in either `apps/backend` or `apps/web`.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: backend-only (`packages/graphql-select`, `packages/domain`, `apps/backend`) plus one architecture-doc update — no `apps/web`/`packages/ui` changes.
- [ ] **No blocking dependency:** confirmed via direct reads that Story 2.6a (`review`, fully implemented) and Story 1.3h (`review`, fully implemented) are both real and complete in code, not just planned.
- [ ] **Scope-correction design decisions accepted:** (1) global hide scope (not personal-lists-only) with Story 4.8 (Archive page) as the escape hatch; (2) Story 4.8 reserved now as a full Epic 4 story; (3) `overlaps` extended with `to: null` rather than a new operator; (4) an explicit extensible default-conditions list built now, populated with only this story's one rule — all four confirmed with the user via `AskUserQuestion` before drafting (see Dev Notes → Design Decisions Confirmed With User).
- [ ] **Gate 1/2/3 prerequisites confirmed:** all three gates re-run fresh for this story (the swept `epic-2-readiness.md` did not anticipate this story's revised scope). Gate 1 PASS, Gate 2 PASS, Gate 3 CONDITIONAL PASS (one doc-only action item, folded into Task 5 — no story split required).
- [ ] Architecture and data/API boundaries confirmed: SQL-building in `packages/graphql-select`; pure condition composition in `packages/domain`; server-side-only composition in the resolver (never client-supplied); `Query.event` explicitly left unchanged.
- [ ] Testing plan confirmed: 100%-covered `packages/domain` unit tests; `packages/graphql-select` unit test (new + regression); `apps/backend` integration tests including a full regression pass of Story 1.3h's existing tests.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/graphql-select`: `tsx --test` unit tests for `overlaps`'s new `to: null` case, plus the pre-existing bounded-`overlaps` test kept passing unchanged.
- `packages/domain`: `tsx --test` unit tests, 100% coverage, for `buildDefaultEventVisibilityConditions` (Testing Rules — the only place unit tests are required in this repo).
- `apps/backend`: integration tests (`tsx --test`, Yoga + real local test Postgres DB, matching `resolvers.test.ts`'s established pattern) covering default/custom thresholds, multi-schedule EXISTS correctness, query composition, the favorited-sort path, and the `Query.event` deep-link exemption — plus a full regression pass of Story 1.3h's existing `scheduleDateRange`/`overlaps` tests.
- No new E2E test in this story — no UI ships; existing E2E flows that browse Discovery/Favorites should be spot-checked manually (Task 6) to confirm they don't depend on now-hidden past seed events, but no new Playwright spec is required.

## Deliverables Checklist

- [ ] `overlaps` in `packages/graphql-select` accepts `to: string | null`, unbounded-range SQL confirmed correct, existing bounded behavior unchanged.
- [ ] `buildDefaultEventVisibilityConditions` implemented and 100%-covered in `packages/domain/src/events/`, exported via the barrel and existing `./events` subpath.
- [ ] `Query.events` resolver applies the default visibility condition for both authenticated (per-user `N`) and anonymous (fixed `N=7`) callers, AND-composed with the caller's own query; `Query.event` confirmed unchanged.
- [ ] Integration tests passing for all AC1-AC8 scenarios, plus full regression of Story 1.3h's existing tests.
- [ ] AD-1 documentation updated (Task 5).
- [ ] `pnpm build`/`pnpm lint` clean at the repo root for touched packages.

## Out of Scope

- Building Story 4.3a's (personal report-hide) or Story 4.4a's (moderator soft-delete) actual hide-rules, or any bypass/opt-in mechanism for the future Archive page (Story 4.8) — neither exists yet; this story only leaves the documented, non-restructuring extension seam (AC6) for them to use later.
- Any frontend UI, empty-state copy, or "why was this hidden" messaging — confirmed via Gate 2 that no such element exists anywhere in the current UX artifacts for this story to build or omit.
- Modifying `Query.event` (single-event-by-id lookup) or any other resolver besides `Query.events` — deep-link/detail-view access is explicitly exempted (AC8); the weekly-calendar view (future Story 1.3f) inherits this story's default automatically with no resolver-specific work, since it already funnels through `Query.events`.
- Reconciling AD-8's `EventInfo`/`deletedAt` binding against Story 4.4a's differently-shaped `status`/`deleted_at` plan — flagged in Dev Notes as Story 4.4a's own concern, not addressed here.
- A migration or backfill of any kind — no schema/column changes ship in this story.

## Definition of Done

- [ ] AC1-AC9 satisfied.
- [ ] Required tests passing: `packages/graphql-select` (new + regression), `packages/domain` (100% coverage), `apps/backend` integration tests (new + full 1.3h regression).
- [ ] Lint and type checks passing for `packages/graphql-select`, `packages/domain`, `apps/backend`.
- [ ] AD-1 documentation updated; `pnpm build`/`pnpm lint` clean at the repo root.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. The user substantially corrected Story 2.7's scope mid-creation (three rounds of `AskUserQuestion`): broadened past-event hiding from personal-lists-only to a global default across every event view, requested a reusable/extensible hiding mechanism ahead of Epic 4's future soft-delete/personal-hide rules, and requested a new Archive page (Story 4.8) as the escape hatch. `epics.md` and `sprint-status.yaml` were updated accordingly before this story file was drafted (revised Story 2.7 AC/Note, new Story 4.8 section + backlog entry).
- All three Story Split Gates were re-run fresh for this story rather than relying solely on the swept `epic-2-readiness.md` (2026-08-04), since that sweep predates and did not anticipate this story's revised scope — per this workflow's escape-hatch guidance. Gate 1 (Winston, architecture) and Gate 2 (Freya, UX) both passed clean. Gate 3 (Winston, foundational dependency) returned a conditional pass: no story split needed (the extensible-list design is correctly right-sized/YAGNI-respecting given Epic 4's rule shapes aren't known yet), but flagged one real doc-only gap — AD-1's "Fields and Operators" list needs the `overlaps` `to: null` capability documented, mirroring Story 1.3h's own precedent — folded into Task 5.
- Confirmed via direct reads of shipped code (not just epics.md descriptions) that both Story 2.6a (`getOrCreateUserSettings`, `mySettings`/`updateUserSettings`) and Story 1.3h (`overlaps`'s EXISTS-across-all-schedules mechanism) are real, tested, and complete — this story reuses both directly rather than re-deriving or duplicating either.

### Completion Notes List

### File List
