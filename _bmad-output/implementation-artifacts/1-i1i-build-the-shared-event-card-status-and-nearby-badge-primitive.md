# Story 1.i1i: Build the shared event-card status/nearby badge primitive

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1i
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the event/schedule status badge (`formatEventStatus`'s 8 states, including DESIGN.md's `happeningNow` emerald-accent exception) and the nearby-distance badge (`<8km` gated) extracted into a shared `packages/ui/src/features/events/` component rather than duplicated inline per card family,
so that a third and future card surface (Story 1.i1f's `EventCardCalendarGridItem`, Story 1.i1j's compact row) stop re-implementing the same computation/markup independently, and DESIGN.md's `happeningNow` emerald correction has exactly one place to apply.

## Acceptance Criteria

1. **Given** `EventCard.tsx`'s masonry variant today computes `formatEventStatus` and renders both badges as inline JSX (`EventCard.tsx` lines ~202-215 for the computation, ~355-368 for the JSX), gated on `distanceKm <= 5`, **when** this story ships, **then** two new shared components exist in `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — `EventCardStatusBadge` and `EventCardNearbyBadge` — encoding: all 8 `formatEventStatus` states with DESIGN.md's neutral `bg-muted text-muted-foreground` base style, EXCEPT `happeningNow` which renders `bg-emerald-600 text-white`; and the nearby badge (`Navigation` icon + label) gated at `distanceKm < 8` (the corrected threshold, not the shipped `<= 5` bug), rendering nothing when `distanceKm` is null/undefined or `>= 8`.
2. **And** `EventCard.tsx`'s masonry branch is migrated to consume these two shared components instead of its own inline computation/JSX, fixing the `<=5` → `<8` threshold bug and adding the `happeningNow` emerald treatment as a byproduct of the migration — not a separately-scoped bug fix.
3. **And** the components accept label overrides matching `EventCard.tsx`'s existing `defaultLabels` values exactly (`nearbyBadge: 'Nearby'`, all 8 `status*` keys unchanged) so no visual/text regression occurs for the existing consumer.
4. **And** `formatEventStatus` (`format-event-date.ts`) is extended to expose a `happeningNow` discriminant alongside its existing display-string output (its only current call site, `EventCard.tsx`, is updated in this same story) — the function must not gain a second, independently-derived copy of the `started && endDayDiff > 0` boolean it already computes internally.
5. **And** `EventCardStatusBadge` and `EventCardNearbyBadge` are two independently composable components, NOT a combined "badge row" primitive — `EventCard.tsx` keeps owning its existing flex badge-row wrapper `<div>` and renders each badge as a sibling child. This preserves the insertion point EXPERIENCE.md's "Day-of-Week Recurring Schedules" section already specifies (badge_row order: status → repeat → nearby) for the not-yet-drafted `EventCardRepeatBadge` (Story 1.3k, `epics.md`), which must be able to slot in between these two without modifying either.
6. **And** neither badge is independently focusable, has an `aria-label`, or triggers a tooltip — both remain non-interactive supplementary metadata inside `EventCard`'s single existing focusable card region, per EXPERIENCE.md's Accessibility Floor (this requirement is reserved for the future repeat badge only). Both keep the existing ≥11px text-size floor (`text-xs`, 12px) unchanged.
7. **And** this primitive is **not** wired into `WeeklyCalendarView.tsx` or the not-yet-built `EventCardCalendarGridItem` in this story — adoption is deferred to Story 1.i1j (compact row) and Story 1.i1f's `EventCardCalendarGridItem` (once implemented), matching this epic's own build-then-adopt precedent.
8. **And** `EventCard.test.tsx`'s existing "Status badge (masonry, AC15) and Nearby badge (AC16)" test block, which currently encodes the shipped `<=5` boundary as expected behavior (`distanceKm={5}` shows the badge, `distanceKm={5.01}` hides it), is rewritten (not just supplemented) to assert the corrected `<8` boundary (`distanceKm={7.99}` shows, `distanceKm={8}` hides).

**Depends on:** Story 1.i1a (the `EventCardMediaPrimitives.tsx` file/pattern this story extends).

**Note:** Implements backlog.yaml `IDEA-041` (child of `IDEA-025`). Split via Gate 2 (`bmad-create-story`, 2026-09-17) while drafting Story 1.i1j — the status/nearby badge markup was about to become a third independent inline duplicate (`EventCard.tsx`'s shipped masonry branch, Story 1.i1f's not-yet-implemented `EventCardCalendarGridItem`, and Story 1.i1j's compact row), the exact drift pattern (BUG-023/FIND-023) that already motivated this epic's own `EventCardMediaPrimitives` extraction (Story 1.i1a). **Coordination flag (from Story 1.i1f's own Out of Scope addendum):** whichever of this story or Story 1.i1f is implemented first should check the other's implementation status before touching `EventCard.tsx`'s nearby-badge gate again — if Story 1.i1f's `bmad-dev-story` runs first, its own Task 2 (`distanceKm <=5` → `<8`) will already be satisfied by this story's migration (verify, don't re-edit); if this story runs first, its migration must ship the corrected `<8` threshold so Story 1.i1f's later Task 2 is a no-op verification, not a re-introduction of `<=5`.

## Tasks / Subtasks

- [ ] Task 1 — Extend `formatEventStatus` to expose the `happeningNow` discriminant (AC4)
  - [ ] 1.1 Change `formatEventStatus`'s return type (`packages/ui/src/features/events/format-event-date.ts`) from a bare `string` to `{ text: string; isHappeningNow: boolean }`. `isHappeningNow` is `true` only for the existing `started && endDayDiff > 0` branch — do not add a second, independently-derived computation of this condition.
  - [ ] 1.2 Update the function's JSDoc to describe the new return shape.
  - [ ] 1.3 Update `EventCard.tsx`'s sole call site (~line 203-212) to destructure `{ text: statusText, isHappeningNow }` from the new return value.
  - [ ] 1.4 Update `format-event-date.test.ts` for the new return shape across all 8 branches — assert `isHappeningNow: true` only for the "started, ends later" branch and `isHappeningNow: false` for the other 7 (ended / endsToday / inHours / tomorrow / weekday / inDays / upcoming).

- [ ] Task 2 — Build `EventCardStatusBadge` and `EventCardNearbyBadge` primitives (AC1, AC5, AC6)
  - [ ] 2.1 Add `EventCardStatusBadge` to `EventCardMediaPrimitives.tsx`. Props: `{ text: string; isHappeningNow?: boolean; className?: string }`. Renders the exact existing base classes (`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-muted text-muted-foreground`), swapping to `bg-emerald-600 text-white` (dropping `bg-muted text-muted-foreground`) only when `isHappeningNow` is `true`. No icon, no `aria-label`, no independent focus stop.
  - [ ] 2.2 Add `EventCardNearbyBadge` to `EventCardMediaPrimitives.tsx`. Props: `{ distanceKm?: number | null; labels?: EventCardNearbyBadgeLabels; className?: string }`. Self-gating (matching `EventCardFavoriteBadge`'s existing guard-clause convention): returns `null` unless `distanceKm != null && distanceKm < 8` — the caller no longer needs to precompute a `showNearbyBadge` boolean. Renders the exact existing classes (`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground`) plus `<Navigation className="w-3 h-3" />` and the label (default `'Nearby'`, matching `EventCardLabels.nearbyBadge`'s existing default).
  - [ ] 2.3 Add `EventCardStatusBadgeProps`, `EventCardNearbyBadgeProps`, and `EventCardNearbyBadgeLabels` to `EventCardMediaPrimitives.types.ts`, following the file's existing per-primitive narrow-interface convention (see `EventCardFavoriteBadgeLabels`) rather than importing the full `EventCardLabels`.
  - [ ] 2.4 Do NOT build a combined "badge row" wrapper component (AC5) — keep both badges independently importable so the not-yet-drafted Story 1.3k can later insert its own `EventCardRepeatBadge` between them.
  - [ ] 2.5 Give each root a `data-event-card-status-badge`/`data-event-card-nearby-badge` attribute, matching this file's existing test-query convention.

- [ ] Task 3 — Migrate `EventCard.tsx`'s masonry branch (AC2, AC3, AC8)
  - [ ] 3.1 Extend the existing `EventCardMediaPrimitives` import with `EventCardStatusBadge, EventCardNearbyBadge`. Remove the now-unused `Navigation` import from `lucide-react` (its only use moves into `EventCardNearbyBadge`) — confirm via grep that `Navigation` is not referenced anywhere else in the file before removing.
  - [ ] 3.2 Update the status computation call site per Task 1.3.
  - [ ] 3.3 Remove the local `showNearbyBadge` boolean (~line 215) — now owned by `EventCardNearbyBadge`'s self-gating.
  - [ ] 3.4 Replace the inline `<span>` JSX (~lines 355-368) with `<EventCardStatusBadge text={statusText} isHappeningNow={isHappeningNow} />` and `<EventCardNearbyBadge distanceKm={distanceKm} labels={{ nearbyBadge: defaultLabels.nearbyBadge }} />`, preserving the existing badge-row wrapper `<div>` and its classes unchanged.
  - [ ] 3.5 Correct `EventCard.types.ts`'s stale `distanceKm <= 5` JSDoc comments (the `distanceKm` prop doc, and `EventCardLabels.nearbyBadge`'s doc) to `< 8`.

- [ ] Task 4 — Testing (all ACs)
  - [ ] 4.1 `EventCardMediaPrimitives.test.tsx`: add component tests for `EventCardStatusBadge` (all 8-state neutral rendering; `happeningNow` emerald override) and `EventCardNearbyBadge` (renders at `distanceKm=7.99`; omits at `8` and above; omits on `null`/`undefined`; default label vs. override).
  - [ ] 4.2 `format-event-date.test.ts`: extend per Task 1.4.
  - [ ] 4.3 `EventCard.test.tsx`: rewrite the "Status badge (masonry, AC15) and Nearby badge (AC16)" describe block's boundary test from the old `5`/`5.01` pair to `7.99`/`8` (AC8); add a test asserting the `happeningNow` state renders the emerald classes and the other 7 states keep the neutral classes.
  - [ ] 4.4 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) and record results in Dev Agent Record.

- [x] Task 5 — Architecture spine (new invariant)
  - [x] 5.1 Append a new `### AD-24: Shared Event-Card Status/Nearby Badge Primitives` entry to `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (current highest is AD-23), following the existing Binds/Prevents/Rule format (see AD-15 for the closest precedent — a sibling `event_card_*` primitive invariant, but scoped to a different concern: image/media/favorite-badge, not status/nearby). Document: the two independently-composable primitives and their consumers (this story's `EventCard.tsx` migration; future consumers Story 1.i1f's `EventCardCalendarGridItem` and Story 1.i1j's compact row; the reserved insertion point for Story 1.3k's `EventCardRepeatBadge`); the `happeningNow` emerald exception; the `<8km` nearby threshold as the one sanctioned gate (never a second inline copy); and the non-interactive/no-tooltip a11y rule. This is deliberately a NEW AD, not an amendment to AD-15 — AD-15's own "Binds" list is scoped specifically to the media slot/favorite badge/date box, a different concern from status/nearby badge content.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** Cited from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13): no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules in frontend code, no infra requiring IaC. **Lightweight guard (this story's `stories_covered` postdates the sweep, same situation Story 1.i1f already handled):** confirmed fresh via this story's own source-code research — `EventCard.tsx` and the target primitives file only render already-computed props (`distanceKm`, dates/times), no resolver/query/mutation is touched anywhere, and `formatEventStatus`'s signature extension is a pure-function internal change with a single call site. This matches exactly what the epic-wide sweep anticipated; no fresh Gate 1 subagent run was warranted beyond this citation + guard.
- **Gate 2 (UI Complexity & Reusability) — run fresh via subagent (Freya-lens), verdict: No gap found.** Dispatched against this story's own draft scope (not the epic-wide sweep, which predates this story and doesn't cover it). Findings: (a) two small, independently-gated presentational components in one story is the right granularity — neither has media/loading/error states or a11y requirements (EXPERIENCE.md's Accessibility Floor explicitly excludes both from focus/aria requirements), and bundling them matches Story 1.i1a's own precedent of bundling three primitives in one story; a further split would just force two nearly-trivial stories. (b) Bundling the `formatEventStatus` signature change into this same story is correct, not a Gate 2 trigger — the `isHappeningNow` boolean already exists internally (this only surfaces it), and the function has exactly one call site both before and after this story, so it's a mechanical prerequisite fix belonging with its only consumer's migration, not a multi-consumer utility extraction (unlike `combineDateTime`'s prior extraction, which had two genuinely independent consumers). (c) No DESIGN.md/EXPERIENCE.md-specified detail is missing from the draft scope — the badge_row ordering, the one-neutral-style/`happeningNow` exception, the `<8km` threshold, and the accessibility floor are all faithfully reflected.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Cited from `epic-1-i1-readiness.md`'s sweep: the primitive's home is confirmed `packages/ui/src/features/events/`, not `packages/ui/src/core/` (event-domain-specific content). No i18n/analytics/global-shell/codegen dependency is implicated — these badges follow the pre-existing `labels`/`defaultLabels` prop-override convention (English-only defaults, no `next-intl` integration), matching the same deliberate, already-documented i18n gap Stories 1.i1d/1.i1j both shipped with; not this story's to close.
- **Forward coordination note (not a gate finding, documentation only):** Story 1.3k (`epics.md`, "Render day-of-week recurring schedules and the repeat badge across calendar and card surfaces" — not yet drafted via `bmad-create-story`) will need its own `EventCardRepeatBadge` to slot into `EventCard.tsx`'s masonry `badge_row` between the two components this story builds (EXPERIENCE.md's ordering: status → repeat → nearby). AC5/Task 2.4 above (independently composable, no combined row wrapper) is written specifically so 1.3k's later insertion requires no rework of this story's output. 1.3k's own `epics.md` dependency list (currently "Story 1.3b, Story 1.3g, Story 1.i1a-e") predates this story's creation and should be updated to add Story 1.i1i once 1.3k is drafted — left as-is here since editing another story's section is outside this story's own Gate-mandated scope.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found. This story touches no database schema, no GraphQL type/resolver, and no persisted data — it is a `packages/ui`-only presentational refactor plus a threshold-constant correction.
- Impacted fields/contracts: `formatEventStatus`'s TypeScript return type (`string` → `{ text: string; isHappeningNow: boolean }`) — an internal, non-persisted, non-serialized type with exactly one call site (`EventCard.tsx`), updated in this same story. `EventCard.types.ts`'s `distanceKm`/`nearbyBadge` JSDoc comments are corrected to match the new `<8` threshold (doc-only, no type shape change — `distanceKm?: number | null` is unchanged).
- Required DB migration changes: No changes required.
- Required TypeScript type changes: `formatEventStatus`'s return type as above; two new additive prop/label interfaces in `EventCardMediaPrimitives.types.ts` (`EventCardStatusBadgeProps`, `EventCardNearbyBadgeProps`, `EventCardNearbyBadgeLabels`). No existing exported type's public shape narrows or breaks for any consumer outside this story's own scope.
- Backward compatibility and rollout notes: The only currently-shipped consumer of the migrated JSX is `EventCard.tsx`'s masonry variant — this story updates it directly in the same pass, so there is no intermediate state where the old and new badge markup coexist. The `<8` threshold change is a visible, intentional bugfix (DESIGN.md's 2026-09-14 correction), not a silent behavior change — no production caller has ever passed a real, non-test `distanceKm` yet (confirmed: `distanceKm` is not computed anywhere in this codebase today, per Architecture Spine AD-22's own finding), so this fix has zero live-traffic blast radius until Story 1.i1f wires a real `distanceKm` value in.
- Verification checks: `EventCardMediaPrimitives.test.tsx`'s new component tests (Task 4.1), `format-event-date.test.ts`'s updated branch coverage (Task 4.2), and `EventCard.test.tsx`'s rewritten boundary test (Task 4.3) together prove the threshold correction and the `happeningNow` treatment end-to-end; `tsc --noEmit` on `packages/ui` proves the `formatEventStatus` signature change has no unaccounted-for call site.

### Project Structure Notes

- Alignment with unified project structure: extends the existing `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`/`.types.ts` files (Story 1.i1a's Domain Features placement, already confirmed correct by the Epic 1.i1 readiness sweep) — no new files, no new package.
- No `packages/domain` involvement: pure presentation (text/icon rendering from already-computed props), not business logic.
- `packages/ui/src/features/events/index.ts` already re-exports `EventCardMediaPrimitives`/`EventCardMediaPrimitives.types` in full (`export * from`), so no `index.ts` change is needed for the two new components.
- Detected conflicts or variances: None.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1i] (this story's own AC set) and #Story 1.i1f, #Story 1.i1j (coordination/dependency context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true; `stories_covered` predates this story — lightweight guard applied per Dev Notes above)
- [Source: _bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md] (file/naming/testing conventions this story extends; AD-15 precedent)
- [Source: _bmad-output/implementation-artifacts/1-i1f-wire-nearby-distance-badges-and-build-the-calendar-grid-item-card.md] (coordination flag on the `<=5`→`<8` threshold; `EventCardCalendarGridItem`'s own status/nearby badge composition requirements)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15, #AD-22] (media-primitive precedent format; existing distance-computation binding)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_status_badge, #event_card_nearby_badge, #event_card_masonry.badge_row, #event_card_repeat_badge]
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row, #Accessibility Floor > Masonry EventCard Badge Row, #Day-of-Week Recurring Schedules]
- [Source: packages/ui/src/features/events/EventCard.tsx] (current inline computation ~lines 202-215, current inline JSX ~lines 355-368, `defaultLabels` ~lines 86-104)
- [Source: packages/ui/src/features/events/format-event-date.ts] (`formatEventStatus`, lines 116-193 — 8-branch implementation, no existing state discriminant)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx, EventCardMediaPrimitives.types.ts, event-card-media-tokens.ts] (file/naming/typing conventions to match)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features → `packages/ui/src/features/<domain>/`, already the file's home); Locale-Sensitive Data Rendering (not newly triggered — badges keep the pre-existing unwired `labels` convention, no new `next-intl` integration this story).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — this story adds `### AD-24` (Task 5); format follows AD-15's precedent.
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modify: `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` (add `EventCardStatusBadge`, `EventCardNearbyBadge`)
  - Modify: `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` (add the two new prop interfaces + `EventCardNearbyBadgeLabels`)
  - Modify: `packages/ui/src/features/events/format-event-date.ts` (`formatEventStatus` return-shape extension)
  - Modify: `packages/ui/src/features/events/EventCard.tsx` (migrate masonry branch; remove now-unused `Navigation` import)
  - Modify: `packages/ui/src/features/events/EventCard.types.ts` (stale JSDoc correction, doc-only)
  - Modify: `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` (new component tests)
  - Modify: `packages/ui/src/features/events/format-event-date.test.ts` (updated return-shape assertions)
  - Modify: `packages/ui/src/features/events/EventCard.test.tsx` (rewritten threshold boundary test + new `happeningNow` test)
  - Modify: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (new `### AD-24` section)
  - **Not touched:** `packages/ui/src/features/events/index.ts` (already re-exports the target file in full); `WeeklyCalendarView.tsx`/`.types.ts` (reserved for Story 1.i1j); `EventCardCalendarGridItem` (does not exist yet — Story 1.i1f).
- **Rule Mapping:**
  - Domain Features placement rule (project-context.md) → extends existing `features/events/` files, confirmed by Gate 3 citation.
  - Anti-duplication convention (this codebase's own stated precedent, e.g. `combineDateTime`'s extraction comment) → Task 1 (surface `isHappeningNow` from existing logic rather than re-deriving it).
  - Non-interactive/no-tooltip a11y floor (EXPERIENCE.md) → AC6, Task 2.1/2.2 (no `aria-label`, no focus handling added).
  - Composability for future consumers (EXPERIENCE.md badge_row ordering; Story 1.3k) → AC5, Task 2.4.
  - Threshold-fix correctness (DESIGN.md `<8km`) → AC1, AC8, Task 3.3-3.5, Task 4.3.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new/updated tests in `EventCardMediaPrimitives.test.tsx`, `format-event-date.test.ts`, `EventCard.test.tsx` all pass; no other existing test in the package regresses.
  - `pnpm --filter @festgrid/ui lint` — 0 errors.
  - `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) — clean, strict-mode compliant; confirms `formatEventStatus`'s signature change has no unaccounted-for call site.
  - Manual/visual spot-check: render `EventCard` masonry variant with a `happeningNow`-state event and confirm the emerald badge visually reads as more prominent than the neutral 7 states, matching DESIGN.md's reference intent (no automated visual-regression tool exists in this repo, per Story 1.i1a's own precedent note).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — extracts `EventCard.tsx`'s masonry status/nearby badge markup into two new shared, independently-composable `packages/ui/src/features/events/` primitives, migrates the masonry branch onto them, and fixes the `<=5`→`<8` threshold bug as part of the same migration; does not wire into `WeeklyCalendarView.tsx` or `EventCardCalendarGridItem` (deferred to Stories 1.i1j/1.i1f).
- [ ] Architecture and boundary confirmation — stays inside the existing `EventCardMediaPrimitives.tsx`/`.types.ts` files (no new files, no `packages/domain` involvement); adds `### AD-24` to the architecture spine.
- [ ] Testing plan confirmation — component tests (Task 4.1), updated unit tests for `formatEventStatus` (Task 4.2), rewritten/extended `EventCard.test.tsx` boundary + `happeningNow` tests (Task 4.3), plus lint/build (Task 4.4).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap (cited from `epic-1-i1-readiness.md`, confirmed still valid via this story's own fresh source-code guard). Gate 2: no gap (run fresh via subagent against this story's own scope — see Dev Notes). Coordination flag with Story 1.i1f (the `<=5`→`<8` threshold, whichever ships first) explicitly acknowledged.

## Testing Requirements

- [ ] Integration/component tests (Vitest + Testing Library) — `EventCardMediaPrimitives.test.tsx` (new `EventCardStatusBadge`/`EventCardNearbyBadge` coverage, Task 4.1), `format-event-date.test.ts` (Task 4.2), `EventCard.test.tsx` (Task 4.3).
- [ ] E2E tests — Not applicable. This is a visual/text badge-treatment fix on an already-rendered, already-E2E-covered card surface (masonry `EventCard` on the Discovery page); it introduces no new user flow, route, or interactive control. Component-level coverage is the appropriate testing-trophy tier per project-context.md.

## Deliverables Checklist

- [ ] `formatEventStatus` extended with the `isHappeningNow` discriminant (`format-event-date.ts`)
- [ ] `EventCardStatusBadge` and `EventCardNearbyBadge` added to `EventCardMediaPrimitives.tsx`
- [ ] `EventCardStatusBadgeProps`, `EventCardNearbyBadgeProps`, `EventCardNearbyBadgeLabels` added to `EventCardMediaPrimitives.types.ts`
- [ ] `EventCard.tsx`'s masonry branch migrated; `distanceKm <=5` → `<8` fixed; unused `Navigation` import removed
- [ ] `EventCard.types.ts`'s stale threshold JSDoc corrected
- [ ] `EventCardMediaPrimitives.test.tsx`, `format-event-date.test.ts`, `EventCard.test.tsx` updated/extended
- [x] `festgrid-architecture-spine.md` updated with `### AD-24`

## Out of Scope

- Wiring these badges into `WeeklyCalendarView.tsx`'s compact row (Story 1.i1j, already drafted, depends on this story).
- Wiring these badges into the not-yet-built `EventCardCalendarGridItem` (Story 1.i1f, already drafted).
- Building `EventCardRepeatBadge` or any other insertion into the badge_row beyond preserving the composability this story's AC5 requires (Story 1.3k, not yet drafted).
- Computing a real, non-test `distanceKm` value for any production caller (Story 1.i1f's own scope — `home-content.tsx`, etc.).
- Any change to `WeeklyCalendarViewScheduleShape` or `useWeeklyCalendarController` (untouched by this story; zero shared code exists yet between `EventCard.tsx` and `WeeklyCalendarView.tsx`).
- No Gate-1/2/3-deferred scope exists for this story (all three reported no gap).

## Definition of Done

- [ ] AC1-AC8 satisfied.
- [ ] `EventCardMediaPrimitives.test.tsx`, `format-event-date.test.ts`, `EventCard.test.tsx` passing; no other `packages/ui` test regresses.
- [ ] Lint and type checks passing for `packages/ui`.
- [ ] `festgrid-architecture-spine.md`'s `AD-24` entry added, following the AD-15 format.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
