# Story 1.i1i: Build the shared event-card status/nearby badge primitive

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1i
- Status: review

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

- [x] Task 1 — Extend `formatEventStatus` to expose the `happeningNow` discriminant (AC4)
  - [x] 1.1 Change `formatEventStatus`'s return type (`packages/ui/src/features/events/format-event-date.ts`) from a bare `string` to `{ text: string; isHappeningNow: boolean }`. `isHappeningNow` is `true` only for the existing `started && endDayDiff > 0` branch — do not add a second, independently-derived computation of this condition.
  - [x] 1.2 Update the function's JSDoc to describe the new return shape.
  - [x] 1.3 Update `EventCard.tsx`'s sole call site (~line 203-212) to destructure `{ text: statusText, isHappeningNow }` from the new return value.
  - [x] 1.4 Update `format-event-date.test.ts` for the new return shape across all 8 branches — assert `isHappeningNow: true` only for the "started, ends later" branch and `isHappeningNow: false` for the other 7 (ended / endsToday / inHours / tomorrow / weekday / inDays / upcoming).

- [x] Task 2 — Build `EventCardStatusBadge` and `EventCardNearbyBadge` primitives (AC1, AC5, AC6)
  - [x] 2.1 Add `EventCardStatusBadge` to `EventCardMediaPrimitives.tsx`. Props: `{ text: string; isHappeningNow?: boolean; className?: string }`. Renders the exact existing base classes (`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-muted text-muted-foreground`), swapping to `bg-emerald-600 text-white` (dropping `bg-muted text-muted-foreground`) only when `isHappeningNow` is `true`. No icon, no `aria-label`, no independent focus stop.
  - [x] 2.2 Add `EventCardNearbyBadge` to `EventCardMediaPrimitives.tsx`. Props: `{ distanceKm?: number | null; thresholdKm?: number; labels?: EventCardNearbyBadgeLabels; className?: string }`. Self-gating (matching `EventCardFavoriteBadge`'s existing guard-clause convention): returns `null` unless `distanceKm != null && distanceKm < (thresholdKm ?? 8)` — the caller no longer needs to precompute a `showNearbyBadge` boolean. (`thresholdKm` is the one sanctioned caller override, added during implementation so Story 1.i1f's already-shipped `EventCardProps.nearbyBadgeThreshold` prop — and its two pinning tests — keep working instead of breaking; default remains `8`, so AC1/AC8 behavior is unchanged. Recorded in Completion Notes and sanctioned in Architecture Spine AD-24 Rule 2.) Renders the exact existing classes (`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground`) plus `<Navigation className="w-3 h-3" />` and the label (default `'Nearby'`, matching `EventCardLabels.nearbyBadge`'s existing default).
  - [x] 2.3 Add `EventCardStatusBadgeProps`, `EventCardNearbyBadgeProps`, and `EventCardNearbyBadgeLabels` to `EventCardMediaPrimitives.types.ts`, following the file's existing per-primitive narrow-interface convention (see `EventCardFavoriteBadgeLabels`) rather than importing the full `EventCardLabels`.
  - [x] 2.4 Do NOT build a combined "badge row" wrapper component (AC5) — keep both badges independently importable so the not-yet-drafted Story 1.3k can later insert its own `EventCardRepeatBadge` between them.
  - [x] 2.5 Give each root a `data-event-card-status-badge`/`data-event-card-nearby-badge` attribute, matching this file's existing test-query convention.

- [x] Task 3 — Migrate `EventCard.tsx`'s masonry branch (AC2, AC3, AC8)
  - [x] 3.1 Extend the existing `EventCardMediaPrimitives` import with `EventCardStatusBadge, EventCardNearbyBadge`. Remove the now-unused `Navigation` import from `lucide-react` (its only use moves into `EventCardNearbyBadge`) — confirm via grep that `Navigation` is not referenced anywhere else in the file before removing.
  - [x] 3.2 Update the status computation call site per Task 1.3.
  - [x] 3.3 Remove the local `showNearbyBadge` boolean (~line 215) — now owned by `EventCardNearbyBadge`'s self-gating.
  - [x] 3.4 Replace the inline `<span>` JSX (~lines 355-368) with `<EventCardStatusBadge text={statusText} isHappeningNow={isHappeningNow} />` and `<EventCardNearbyBadge distanceKm={distanceKm} thresholdKm={nearbyBadgeThreshold} labels={{ nearbyBadge: defaultLabels.nearbyBadge }} />` (the `thresholdKm` forward is the Story 1.i1f `nearbyBadgeThreshold` prop kept intact — see 2.2), preserving the existing badge-row wrapper `<div>` and its classes unchanged.
  - [x] 3.5 Correct `EventCard.types.ts`'s stale `distanceKm <= 5` JSDoc comments (the `distanceKm` prop doc, and `EventCardLabels.nearbyBadge`'s doc) to `< 8`.

- [x] Task 4 — Testing (all ACs)
  - [x] 4.1 `EventCardMediaPrimitives.test.tsx`: add component tests for `EventCardStatusBadge` (all 8-state neutral rendering; `happeningNow` emerald override) and `EventCardNearbyBadge` (renders at `distanceKm=7.99`; omits at `8` and above; omits on `null`/`undefined`; default label vs. override).
  - [x] 4.2 `format-event-date.test.ts`: extend per Task 1.4.
  - [x] 4.3 `EventCard.test.tsx`: rewrite the "Status badge (masonry, AC15) and Nearby badge (AC16)" describe block's boundary test from the old `5`/`5.01` pair to `7.99`/`8` (AC8); add a test asserting the `happeningNow` state renders the emerald classes and the other 7 states keep the neutral classes.
  - [x] 4.4 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) and record results in Dev Agent Record.

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

### Backlog row history (IDEA-041, verbatim, moved from backlog.yaml 2026-09-18)

Carved out of IDEA-025 via `bmad-create-story` (Story 1.i1j's own Gate 2 finding, 2026-09-17):
no `EventCardStatusBadge`/`EventCardNearbyBadge` component exists anywhere — `EventCard.tsx`'s
masonry branch computes `formatEventStatus` and renders both badges as inline JSX
(bg-muted/bg-secondary spans, gated `distanceKm<=5`, the shipped un-fixed threshold), and Story
1.i1f's not-yet-built `EventCardCalendarGridItem` will need the same markup again. Story
1.i1j's own compact-row badges would have been a third independent copy — the same drift
pattern (BUG-023/FIND-023) that already forced this epic's `EventCardMediaPrimitives`
extraction (Story 1.i1a). This story (1.i1i) builds the shared component (centralizing the
corrected `<8km` threshold and DESIGN.md's `happeningNow` emerald treatment as its own default)
and migrates `EventCard.tsx`'s masonry branch onto it. Story 1.i1j depends on this story.

**STORY DRAFTED, 2026-09-18 (bmad-create-story, ritual-orchestrator batch):** this story fully
drafted, sprint-status.yaml flipped to `ready-for-dev`. Architecture Spine AD-24 added,
documenting the two independently-composable primitives, the `happeningNow` emerald exception,
the `<8km` sanctioned threshold, and the non-interactive a11y rule. Story 1.i1j's dependency on
this story is now satisfiable once this story's own `bmad-dev-story` lands.

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

- [x] Scope confirmation — extracts `EventCard.tsx`'s masonry status/nearby badge markup into two new shared, independently-composable `packages/ui/src/features/events/` primitives, migrates the masonry branch onto them, and fixes the `<=5`→`<8` threshold bug as part of the same migration; does not wire into `WeeklyCalendarView.tsx` or `EventCardCalendarGridItem` (deferred to Stories 1.i1j/1.i1f).
- [x] Architecture and boundary confirmation — stays inside the existing `EventCardMediaPrimitives.tsx`/`.types.ts` files (no new files, no `packages/domain` involvement); adds `### AD-24` to the architecture spine.
- [x] Testing plan confirmation — component tests (Task 4.1), updated unit tests for `formatEventStatus` (Task 4.2), rewritten/extended `EventCard.test.tsx` boundary + `happeningNow` tests (Task 4.3), plus lint/build (Task 4.4).
- [x] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap (cited from `epic-1-i1-readiness.md`, confirmed still valid via this story's own fresh source-code guard). Gate 2: no gap (run fresh via subagent against this story's own scope — see Dev Notes). Coordination flag with Story 1.i1f (the `<=5`→`<8` threshold, whichever ships first) explicitly acknowledged.

## Testing Requirements

- [x] Integration/component tests (Vitest + Testing Library) — `EventCardMediaPrimitives.test.tsx` (new `EventCardStatusBadge`/`EventCardNearbyBadge` coverage, Task 4.1), `format-event-date.test.ts` (Task 4.2), `EventCard.test.tsx` (Task 4.3).
- [x] E2E tests — Not applicable. This is a visual/text badge-treatment fix on an already-rendered, already-E2E-covered card surface (masonry `EventCard` on the Discovery page); it introduces no new user flow, route, or interactive control. Component-level coverage is the appropriate testing-trophy tier per project-context.md.

## Deliverables Checklist

- [x] `formatEventStatus` extended with the `isHappeningNow` discriminant (`format-event-date.ts`)
- [x] `EventCardStatusBadge` and `EventCardNearbyBadge` added to `EventCardMediaPrimitives.tsx`
- [x] `EventCardStatusBadgeProps`, `EventCardNearbyBadgeProps`, `EventCardNearbyBadgeLabels` added to `EventCardMediaPrimitives.types.ts`
- [x] `EventCard.tsx`'s masonry branch migrated; `distanceKm <=5` → `<8` fixed; unused `Navigation` import removed
- [x] `EventCard.types.ts`'s stale threshold JSDoc corrected
- [x] `EventCardMediaPrimitives.test.tsx`, `format-event-date.test.ts`, `EventCard.test.tsx` updated/extended
- [x] `festgrid-architecture-spine.md` updated with `### AD-24`

## Out of Scope

- Wiring these badges into `WeeklyCalendarView.tsx`'s compact row (Story 1.i1j, already drafted, depends on this story).
- Wiring these badges into the not-yet-built `EventCardCalendarGridItem` (Story 1.i1f, already drafted).
- Building `EventCardRepeatBadge` or any other insertion into the badge_row beyond preserving the composability this story's AC5 requires (Story 1.3k, not yet drafted).
- Computing a real, non-test `distanceKm` value for any production caller (Story 1.i1f's own scope — `home-content.tsx`, etc.).
- Any change to `WeeklyCalendarViewScheduleShape` or `useWeeklyCalendarController` (untouched by this story; zero shared code exists yet between `EventCard.tsx` and `WeeklyCalendarView.tsx`).
- No Gate-1/2/3-deferred scope exists for this story (all three reported no gap).

## Definition of Done

- [x] AC1-AC8 satisfied.
- [x] `EventCardMediaPrimitives.test.tsx`, `format-event-date.test.ts`, `EventCard.test.tsx` passing; no other `packages/ui` test regresses.
- [x] Lint and type checks passing for `packages/ui` — eslint clean on all 8 touched files (`pnpm exec eslint <files>` exit 0); `tsc --noEmit` reports only the pre-existing `packages/ui` baseline (78 errors in `src/core/map.tsx`, `EventDetailView.test.tsx`, `EventDiscoveryPanel.test.tsx`, `FilterHub.test.tsx`, `useCurrentLocationCapture.test.ts` — **0 in any file this story touches**), plus the repo-wide `tsconfig.json(5,5) TS5101` `baseUrl`/TypeScript-6 config error that predates this story. See Debug Log References.
- [x] `festgrid-architecture-spine.md`'s `AD-24` entry added, following the AD-15 format.

## Completion Status

- [x] Complete — ready for code review.

## Dev Agent Record

### Agent Model Used

Cline agent running the `bmad-dev-story` workflow in VS Code (2026-09-21). The underlying model name/version is not surfaced to this workflow's own tooling, so it is recorded by harness rather than guessed (sibling `1.i1*` stories dispatched through this same harness record `claude-sonnet-5`).

### Debug Log References

- Resumed session: the production edits (Tasks 1-3) and test edits (Task 4) were produced earlier in this same session; this pass re-derived the story's contract from this file and verified every claim against the actual source before completing the bookkeeping (status, checkboxes, Dev Agent Record).
- `pnpm --filter @festgrid/ui exec vitest run src/features/events/format-event-date.test.ts src/features/events/EventCardMediaPrimitives.test.tsx src/features/events/EventCard.test.tsx` → **3 files / 140 tests passed** (`format-event-date` 36, `EventCardMediaPrimitives` 41, `EventCard` 63).
- Full `@festgrid/ui` suite (`pnpm --filter @festgrid/ui test`) → **55 files / 577 tests passed, zero `FAIL` lines** — no regression anywhere in the package, not just in the 3 touched files.
- `pnpm exec eslint` over all 8 touched files → **exit 0**, zero findings.
- `pnpm --filter @festgrid/ui exec tsc --noEmit` → aborts before type-checking on a pre-existing repo-wide config error, `tsconfig.json(5,5): error TS5101: Option 'baseUrl' is deprecated` (this workspace has TypeScript 6). Re-run as `tsc --noEmit --ignoreDeprecations 6.0` → 78 pre-existing errors in `packages/ui`, **0 in any file this story touches**. Error-bearing files (`src/core/map.tsx`, `EventDetailView.test.tsx`, `EventDiscoveryPanel.test.tsx`, `FilterHub.test.tsx`, `useCurrentLocationCapture.test.ts`) are all untouched by this story; the only error text matching "status" is `instagramEmbedStatus`/`isSubscriptionStatusLoading` prop-shape noise in `EventDetailView.test.tsx`. `packages/ui` declares only a `test` script (no `build`/`typecheck`), so `tsc --noEmit` is Task 4.4's own sanctioned alternative.
- Repo-wide grep + source read confirmed `formatEventStatus` has exactly one production call site — `EventCard.tsx:205`, now destructuring `{ text: statusText, isHappeningNow }`. All other grep hits are story docs, so the return-shape change has no unaccounted-for consumer (Task 4.4's stated purpose for this check).
- Threshold path verified end-to-end in source, not only in tests: `EventCard.tsx:87` (`nearbyBadgeThreshold = 8`) → `EventCard.tsx:369` (`thresholdKm={nearbyBadgeThreshold}`) → `EventCardMediaPrimitives.tsx`'s `distanceKm == null || distanceKm >= thresholdKm` guard. Pinned by `EventCard.test.tsx`'s rewritten `7.99`/`8` boundary test, its two `nearbyBadgeThreshold`-override tests, and `EventCardMediaPrimitives.test.tsx`'s `thresholdKm` override test.
- Confirmed **no stale `<= 5` / `5.01` threshold references remain** anywhere in `packages/ui/src/features/events` (Task 3.5): the only surviving `<=5` string is `EventCardMediaPrimitives.types.ts`'s JSDoc naming the *fixed* bug.
- Confirmed AC7's deferral was honored by reading the file: `EventCardCalendarGridItem.tsx` still renders its own inline status/nearby markup and was deliberately not migrated here (Story 1.i1f/1.i1j own adoption).
- Confirmed no barrel change was needed: `packages/ui/src/features/events/index.ts` already does `export * from './EventCardMediaPrimitives'` and `export * from './EventCardMediaPrimitives.types'`.
- One deviation from the story's literal Task 2.2/3.4 prop list (adding `thresholdKm`) — reconciled in those tasks' own text above rather than left silent, sanctioned in the architecture spine (AD-24 Rule 2), and detailed in Completion Notes.

### Completion Notes List

- **AC1/AC2 —** `EventCardStatusBadge` and `EventCardNearbyBadge` now exist as separate exports in `EventCardMediaPrimitives.tsx`, and `EventCard.tsx`'s masonry branch consumes them (its inline `<span>` pair is deleted); the `<= 5` → `< 8` threshold fix shipped inside the same migration rather than as a separately-scoped bug fix.
- **AC3 —** label wiring is unchanged in effect: `EventCardNearbyBadge` merges `{ nearbyBadge: 'Nearby', ...labels }` (the exact pre-existing key and default) and `EventCard.tsx` keeps passing `defaultLabels.nearbyBadge`; all 8 `status*` keys/text flow through untouched because the badge renders `formatEventStatus(...).text` verbatim. The only intended visual delta for the existing consumer is the sanctioned emerald treatment on the `happeningNow` state.
- **AC4 —** `formatEventStatus` now returns `EventStatusResult` (`{ text, isHappeningNow }`); `isHappeningNow: true` is emitted from the *existing* `started && endDayDiff > 0` branch only — no second, independently-derived copy of that boolean was introduced. JSDoc updated per Task 1.2.
- **AC5 —** two independently composable components; no combined "badge row" wrapper was built, and `EventCard.tsx` still owns its flex badge-row `<div>` so Story 1.3k's `EventCardRepeatBadge` can slot in between them.
- **AC6 —** both roots are plain non-interactive `<span>`s: no `aria-label`, no `tabIndex`/focus handling, no tooltip, text size remains `text-xs` (12px, above the ≥11px floor).
- **AC7 —** adoption deferred as specified: `WeeklyCalendarView.tsx` was not touched, and `EventCardCalendarGridItem.tsx`'s own inline badges were deliberately left unmigrated (Story 1.i1f/1.i1j own that work).
- **AC8 —** `EventCard.test.tsx`'s "Status badge (masonry, AC15) and Nearby badge (AC16)" block was **rewritten** (not supplemented) from the shipped `5`/`5.01` pair to `7.99` shows / `8` hides, plus a new assertion that `happeningNow` renders `bg-emerald-600 text-white` while the other states keep the neutral `bg-muted text-muted-foreground`, plus a badge-row order assertion (status then nearby). `EventCard.types.ts`'s stale `<= 5` JSDoc was corrected.
- **Deliberate deviation (human-approved during implementation):** the story's literal Task 2.2 wording has `EventCardNearbyBadge` hard-code `< 8`. Instead the primitive takes an optional `thresholdKm` (defaulting to `8`). Reason: Story 1.i1f already shipped `EventCardProps.nearbyBadgeThreshold` (default 8, sourced from `NEXT_PUBLIC_NEARBY_BADGE_DISTANCE_KM` in `apps/web`) and two tests pinning a caller-level override; hard-coding would have deleted a shipped public prop and 2 green tests. Default behavior is byte-identical to AC1/AC8, and the comparison itself still lives inside the primitive (no consumer re-derives it) — which is exactly why Architecture Spine AD-24 Rule 2 was amended to name `thresholdKm` as the one sanctioned caller override. Tasks 2.2/3.4 above were updated to match the shipped API rather than left stale.
- **Architecture:** `### AD-24: Shared Event-Card Status/Nearby Badge Primitives` was added to `festgrid-architecture-spine.md` (Task 5), following AD-15's Binds/Prevents/Rule format, and its Rule 2 carries the `thresholdKm` sanction.
- **Testing tier:** component/unit tests only (Vitest + Testing Library) per project-context.md — this is a text/color treatment + threshold fix on an already-E2E-covered card surface, introducing no new route, flow, or interactive control (see Testing Requirements).
- Status: `review` — implementation complete; the separate `bmad-code-review` pass (fresh context) is the next step.

### File List

**New:** none — this story deliberately adds no new files; both primitives extend the existing Story 1.i1a files (no new package, no `packages/domain` involvement).

**Modified:**
- `packages/ui/src/features/events/format-event-date.ts` (Task 1: `EventStatusResult` + `isHappeningNow` discriminant, JSDoc)
- `packages/ui/src/features/events/EventCard.tsx` (Task 3: masonry branch migrated; `Navigation` import removed; local `showNearbyBadge` removed; status call site destructured)
- `packages/ui/src/features/events/EventCard.types.ts` (Tasks 3.5: stale `<= 5` JSDoc corrected — doc-only, no prop-shape change)
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` (Task 2: `EventCardStatusBadge`, `EventCardNearbyBadge`; `Navigation` imported here; file-header doc updated)
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` (Task 2.3: `EventCardStatusBadgeProps`, `EventCardNearbyBadgeProps`, `EventCardNearbyBadgeLabels`)
- `packages/ui/src/features/events/format-event-date.test.ts` (Task 4.2: 8-branch `isHappeningNow` assertions)
- `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` (Task 4.1: new `EventCardStatusBadge` + `EventCardNearbyBadge` describe blocks)
- `packages/ui/src/features/events/EventCard.test.tsx` (Task 4.3: rewritten `7.99`/`8` boundary test, new `happeningNow` emerald test, badge-row order test)
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (Task 5: new `### AD-24`, Rule 2 amended for the sanctioned `thresholdKm` override)
- `_bmad-output/implementation-artifacts/1-i1i-build-the-shared-event-card-status-and-nearby-badge-primitive.md` (this file — status, checkboxes, Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status → `review`)

**Deliberately NOT modified (verified):**
- `packages/ui/src/features/events/index.ts` — already `export * from './EventCardMediaPrimitives'` / `'./EventCardMediaPrimitives.types'`, so both new components are exported with no barrel change.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` / `.types.ts` — adoption is Story 1.i1j's scope.
- `packages/ui/src/features/events/EventCardCalendarGridItem.tsx` — AC7 deferral; its inline status/nearby markup is intentionally left for Story 1.i1f/1.i1j.

## Change Log

- 2026-09-17: Story created via `bmad-create-story` (`IDEA-041`, child of `IDEA-025`) — split via Gate 2 while drafting Story 1.i1j, because the status/nearby badge markup was about to become a third independent inline duplicate (the BUG-023/FIND-023 drift pattern that motivated Story 1.i1a). Gate 1/Gate 3 cited from `epic-1-i1-readiness.md`; coordination flag with Story 1.i1f recorded on the `<=5` → `<8` threshold.
- 2026-09-21: Implementation completed via `bmad-dev-story`. `formatEventStatus` extended to return `EventStatusResult` (`{ text, isHappeningNow }`) with the discriminant surfaced from its existing branch; `EventCardStatusBadge` + `EventCardNearbyBadge` added to the existing Story 1.i1a primitive files; `EventCard.tsx`'s masonry branch migrated onto them (inline spans + `showNearbyBadge` + the now-unused `Navigation` import removed) and the `<= 5` → `< 8` threshold bug fixed as part of that migration, so Story 1.i1f's own Task 2 is now a verify-only no-op rather than a re-introduction risk. `EventCard.types.ts`'s stale threshold JSDoc corrected. One human-approved deviation from the story's literal prop list: `EventCardNearbyBadge` takes an optional `thresholdKm` (default `8`) so Story 1.i1f's already-shipped `EventCardProps.nearbyBadgeThreshold` and its two override tests keep working — default behavior unchanged, comparison still owned by the primitive, and sanction recorded in the newly added Architecture Spine AD-24 Rule 2. Tests: 140/140 in the 3 touched files (`format-event-date` 36, `EventCardMediaPrimitives` 41, `EventCard` 63) and 577/577 across the full `packages/ui` suite (55 files), zero failures; eslint clean on all 8 touched files; `tsc --noEmit` shows only the pre-existing `packages/ui` baseline (0 errors in any touched file). Status set to `review`.
- 2026-09-21: Implementation + bookkeeping committed as `b6ee723` (`feat(ui): implement Story 1.i1i - shared event-card status/nearby badge primitives`), scoped to this story's 11 files only (unrelated in-flight working-tree changes were left unstaged). Story is now fully handed off to the `bmad-code-review` pass.
