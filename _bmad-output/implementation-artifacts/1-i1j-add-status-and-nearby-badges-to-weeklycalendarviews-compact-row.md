---
baseline_commit: 7109e344a1a5db3b5bb552658204f148a2216745
---

# Story 1.i1j: Add status and nearby-distance badges to WeeklyCalendarView's compact row

## Story Details

- Epic: 1.i1
- Story ID: 1.i1j
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the mobile compact-row card (`WeeklyCalendarView.tsx`'s `CalendarCard` `variant='list'`, the Vertical Day List, `md:hidden`) to show the same computed status badge ("Ended"/"Happening Now"/etc.) and nearby-distance badge that masonry's `EventCard` already shows, reusing a shared badge component rather than a third independent copy,
so that the calendar surface stops being the one card family with no status/nearby information at all (backlog.yaml IDEA-025), matching DESIGN.md's `event_card_compact.content` token spec ("reuses `event_card_status_badge`/`event_card_nearby_badge` as-is, no new badge design needed").

## Acceptance Criteria

1. **Given** `WeeklyCalendarViewScheduleShape` already carries `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime` (unchanged since Story 1.i1d) and Story 1.i1f adds `distanceKm?: number` to the same shape, **when** `CalendarCard`'s `variant='list'` branch renders, **then** it computes a status via `formatEventStatus(locale, timezone, new Date(), schedule.eventStartDate, schedule.eventStartTime, schedule.eventEndDate, schedule.eventEndTime, statusLabels)` per card — no new fields, no new plumbing (Architecture Spine AD-22 Rule 1).
2. **And** this status text renders via **Story 1.i1i's** shared status-badge component (not a third inline copy), including its `happeningNow` → emerald `bg-emerald-600 text-white` treatment (DESIGN.md, 2026-09-14), inside the row's existing content column — the `<span className="flex min-w-0 w-full flex-col text-left">` block that today holds the favorited-heart icon, added-to-calendar icon, event-name title, favorite-count line, and multi-day badge.
3. **And** a nearby badge renders via the same shared component when `schedule.distanceKm` is a number `< 8`, omitted entirely (no placeholder, no error) when `distanceKm` is `undefined`/`null` or `>= 8` — matching Story 1.i1f's own AC8 "active filter location only" pattern: Story 1.i1f's calendar wiring only populates `distanceKm` when a nearby filter is active on the Discovery page's calendar view (`CalendarView.tsx`), so this badge correctly and silently never shows on `FeedCalendarView`/`AccountCalendarView`/`my-calendar-content.tsx` (no nearby-filter plumbing there) or on `CalendarView.tsx` itself when no filter is selected. This is accepted, matching precedent, not a defect to fix here — the "else, viewer's current location" branch remains Story 0.39's job (IDEA-040).
4. **And** both badges render as a new row appended as the **last child** of the content column (after the existing multi-day-badge line, when present), using `flex items-center gap-1.5 flex-wrap` (mirroring `EventCard.tsx`'s own masonry `badge_row` classes) — DESIGN.md's `event_card_compact.content` token gives no explicit ordering/gap sub-token of its own for this row, so this placement is this story's own recorded implementation decision (see Dev Notes). Never inserted between the title and the existing heart/count/multi-day lines.
5. **And** when a multi-day schedule renders as N per-day `CalendarCard` instances (today's existing per-segment behavior, unchanged by this story), each day-segment's card computes and shows its own status independently from the same schedule-level start/end fields — every segment of the same multi-day schedule may show identical status text in the same render, which is expected/accepted (AD-22 Rule 1 computes status relative to real "now," not the rendering day-cell; collapsing multi-day segments into one spanning card is Story 1.i1g's future scope, out of scope here).
6. **And** new label props — matching `EventStatusLabels`'s exact field names/defaults plus a `nearbyBadgeLabel` — are threaded through `WeeklyCalendarViewProps`/`WeeklyCalendarViewLabels`, with the exact same English defaults `EventCard.tsx`'s own `defaultLabels` already uses ("Ended"/"Happening Now"/"Ends Today"/"In {n} hour(s)"/"Tomorrow"/"In {n} days"/"Upcoming"/"Nearby"). Matches Story 1.i1d's own precedent (`tillLabel`/`favoriteToggleLabel`, neither wired to `next-intl` by any of the 4 consumer pages today) of shipping translatable prop slots with English fallbacks, without wiring `next-intl` in `apps/web` in this same story — a pre-existing, cross-cutting i18n gap spanning this whole card-label family, not introduced or required to be closed by this story (see Dev Notes).
7. **And** `variant='grid'`'s existing test suite (desktop day cells, popover, roving tabindex) is unaffected — zero regressions, matching Story 1.i1d's own AC8 precedent.
8. **And** `useWeeklyCalendarController`/`CalendarView.tsx`'s existing `distanceKm`/`viewerCoord` wiring (built by Story 1.i1f) is consumed as-is — this story adds zero new data-fetching, zero new GraphQL fields, and does not touch `use-nearby-filter.ts` or any resolver.

## Tasks / Subtasks

- [x] Task 1: Confirm prerequisites are actually implemented, not just drafted (AC1, AC3, AC8)
  - [x] 1.1 Confirm Story 1.i1f has shipped: `WeeklyCalendarViewScheduleShape.distanceKm?: number` exists and is populated by `useWeeklyCalendarController`/`CalendarView.tsx`.
  - [x] 1.2 Confirm Story 1.i1i has shipped: the shared status/nearby badge component(s) exist in `packages/ui/src/features/events/` and are exported.
  - [x] 1.3 If either is not yet implemented, STOP and flag it rather than re-deriving/duplicating their scope locally — do not build `computeDistanceKm`, do not build a second inline badge copy. See Pre-Coding Approval Gate.
- [x] Task 2: Wire the badges into `CalendarCard`'s `variant='list'` branch (AC1, AC2, AC3, AC4, AC5)
  - [x] 2.1 Call `formatEventStatus`/render Story 1.i1i's shared status-badge component inside the `variant === 'list'` branch (`WeeklyCalendarView.tsx`), passing `schedule.eventStartDate`/`eventStartTime`/`eventEndDate`/`eventEndTime`, `locale`, `timezone`, and the new `statusLabels`.
  - [x] 2.2 Render Story 1.i1i's shared nearby-badge component gated on `schedule.distanceKm != null && schedule.distanceKm < 8`.
  - [x] 2.3 Append both as a new `flex items-center gap-1.5 flex-wrap` row, last child of the existing content `<span>` column, after the multi-day-badge line.
  - [x] 2.4 Confirm the `variant === 'grid'` branch is completely untouched.
- [x] Task 3: Thread new label props (AC6)
  - [x] 3.1 Add label fields to `WeeklyCalendarView.types.ts`'s `WeeklyCalendarViewLabels` matching `EventCardLabels`'s status/nearby field names verbatim (`statusEnded`, `statusHappeningNow`, `statusEndsToday`, `statusInHours`, `statusInDays`, `statusUpcoming`, `tomorrow`, `nearbyBadge`), with in-code English defaults copied verbatim from `EventCard.tsx`'s `defaultLabels`.
  - [x] 3.2 Leave all 4 consumer pages' calls unchanged (no `next-intl` wiring in this story) — add a code comment at the new fields' definition, mirroring `tillLabel`'s existing precedent, noting this is a known/accepted gap.
- [x] Task 4: Testing (AC1-AC8)
  - [x] 4.1 Extend `WeeklyCalendarView.test.tsx`: status badge renders for representative `formatEventStatus` states via mocked `now`/dates (at minimum Ended, Happening Now — asserting the emerald class — and Upcoming); nearby badge renders at `distanceKm=7.9`, is omitted at exactly `8` and at `undefined`; badge-row position (after the multi-day-badge line, inside the content column) is asserted; the full `variant='grid'` test suite still passes unmodified (AC7).
  - [x] 4.2 Add a multi-day case confirming each day-segment card independently computes/shows its own status text (AC5).
  - [x] 4.3 Run `pnpm --filter @festgrid/ui test`, `eslint`, `tsc --noEmit`; confirm zero regressions in `EventCard.test.tsx`/`useWeeklyCalendarController.test.tsx`/`CalendarView.test.tsx`.
- [x] Task 5: Full verification and record-keeping
  - [x] 5.1 Confirm (via `git diff`) that no `packages/domain`, GraphQL, or `apps/backend` files were touched by this story.
  - [x] 5.2 Record Dev Agent Record (File List, test results, lint/build status).

## Dev Notes

- **Files read in full before drafting this story** (current-state summary, so `bmad-dev-story` does not need to re-derive these from scratch):
  - `packages/ui/src/features/events/WeeklyCalendarView.tsx` — `CalendarCard`'s `variant === 'list'` branch (lines ~874-935) already ships Story 1.i1d's structure: an outer non-interactive `<div>`, a sibling `<button>` (schedule-click target, holding `EventCardDateBox` + the content `<span>` column with title/heart/added-to-calendar/favorite-count/multi-day-badge lines) and `EventCardMediaSlot` (thumbnail, sibling not nested). This story only adds a new badge row as the content column's last child; the `variant === 'grid'` branch (lines ~937-983) is untouched.
  - `packages/ui/src/features/events/WeeklyCalendarView.types.ts` — `WeeklyCalendarViewScheduleShape` (lines 1-17) confirmed today carries `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime`/`isFavorited`/`isAddedToCalendar`/`favoriteCount`/`eventId`/`imageUrl` — **no `distanceKm` field exists yet** (added by Story 1.i1f). `WeeklyCalendarViewLabels` (lines 19-63) already follows the "optional prop with English in-code default, no next-intl wiring" pattern this story extends (`tillLabel`, `favoriteToggleLabel`, both still unwired to `next-intl` by any of the 4 consumer pages).
  - `packages/ui/src/hooks/useWeeklyCalendarController.ts` — the `schedules` flatMap (lines 55-74) has **no distance/coordinate logic today**; Story 1.i1f adds a `viewerCoord` option and computes `distanceKm` here. This story reads the resulting field only.
  - `packages/ui/src/features/events/EventCard.tsx` — masonry's status/nearby computation (lines ~202-215) and JSX (lines ~356-367) are **inline in the component body**, not an extracted component: `formatEventStatus(...)` is called directly, and the nearby gate is `distanceKm != null && distanceKm <= 5` (line ~215; this is the shipped, un-fixed threshold — Story 1.i1f corrects it to `< 8` for masonry, and Story 1.i1i's new shared component ships `< 8` as its own default from the start). `defaultLabels` (line ~86) holds the exact English defaults this story's new label props must mirror.
  - `packages/ui/src/features/events/EventCard.types.ts` — `EventCardLabels` (lines 3-31) is the exact field-name/doc-comment source this story's new `WeeklyCalendarViewLabels` fields are copied from.
  - `packages/ui/src/features/events/format-event-date.ts` — `formatEventStatus` (lines 138-193), full signature `(locale, timezone, now, startDate, startTime, endDate, endTime, labels?) => string`. Always returns one of 8 states: Ended / Happening Now / Ends Today / "In {n} hour(s)" / Tomorrow / a locale weekday name / "In {n} days" / Upcoming. `EventStatusLabels` (lines 116-124) is the labels shape.
  - `_bmad-output/implementation-artifacts/1-i1d-adopt-the-primitive-into-weeklycalendarview-compact-row.md` — confirms the compact row's current post-implementation structure and explicitly flagged this exact gap in its own Out of Scope: *"Adding `event_card_status_badge`/`event_card_nearby_badge` to the calendar row — DESIGN.md's `event_card_compact.content` composition mentions reusing these, but epics.md's own AC set for 1.i1d does not require them and `WeeklyCalendarViewScheduleShape` has no status/distance data plumbed in today... Tracked as a possible future story."* This story is that future story.
  - `_bmad-output/implementation-artifacts/1-i1f-wire-nearby-distance-badges-and-build-the-calendar-grid-item-card.md` — plans `computeDistanceKm` (`packages/domain/src/query/computeDistanceKm.ts`), the `<8km` threshold correction, GraphQL coordinate exposure on `getEventsForCalendar`/`getEventsForMyCalendar`, and `WeeklyCalendarViewScheduleShape.distanceKm?: number` populated by `useWeeklyCalendarController` from `CalendarView.tsx`'s own resolved nearby-filter coordinate. Its own Out of Scope explicitly names this story: *"IDEA-025 ... will reuse this story's `computeDistanceKm` utility rather than rebuilding it, but its own badge-content wiring into `event_card_compact` is not part of this story."*
  - `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `event_card_compact.content` token: `"flex-1 min-w-0 flex flex-col gap-1 justify-center"`, comment: *"reuses `event_card_status_badge` (happeningNow now labeled "Now") / `event_card_nearby_badge` (now REPLACES the category/type badge in this row, `<8km` gated) as-is, no new badge tokens needed."* `event_card_status_badge.happening_now`: `"inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-emerald-600 text-white"` (all other 7 states use `base`: `bg-muted text-muted-foreground`). `event_card_nearby_badge.base`: `"inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground"`, icon `Navigation` (`w-3 h-3`), gated `<8km`.
  - `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` AD-22 — Rule 1: "Computed status ... needs no new plumbing and no adaptation" (confirmed above). Rule 2/3: the shared `computeDistanceKm` utility and `WeeklyCalendarViewScheduleShape.distanceKm` field (Story 1.i1f's scope, consumed here).

- **HARD DEPENDENCY, NOT YET IMPLEMENTED — read before starting `bmad-dev-story` on this story.** Confirmed via direct repo search (2026-09-17): `computeDistanceKm` does not exist anywhere in the codebase, `WeeklyCalendarViewScheduleShape` has no `distanceKm` field, and no `EventCardStatusBadge`/`EventCardNearbyBadge` (or equivalently named) component exists anywhere — DESIGN.md only names these as design-token identifiers, never as code symbols. Story 1.i1f (status `ready-for-dev`, not started — its own commit `b8c2c06` only added its *story file*, not implementation code) and the new Story 1.i1i (status `backlog`, not yet drafted via its own `bmad-create-story` pass) are both real, unbuilt prerequisites this story depends on, not already-shipped code. **Do not begin implementing this story until both are confirmed `done` in `sprint-status.yaml`.**

- **Badge-row placement is this story's own implementation decision, not a DESIGN.md-specified detail.** `event_card_compact.content`'s token comment says the badges reuse `event_card_status_badge`/`event_card_nearby_badge` "as-is," but gives no explicit ordering/gap sub-token for this row the way masonry's own `badge_row: "flex items-center gap-1.5 flex-wrap"` does. AC4 resolves this: append as the content column's last child (after the multi-day badge, when present), reusing masonry's exact classes for visual family consistency. Recorded here per this dispatch's HIL threshold (a minor, non-architectural layout judgment call) rather than raised via `AskUserQuestion`.

- **i18n gap, pre-existing, not this story's to close.** `EventCard.tsx`'s own `defaultLabels` (masonry's status/nearby labels) are hardcoded English with an unused `labels?: EventCardLabels` escape hatch — no caller in `apps/web` passes translated values through it today. `WeeklyCalendarView.tsx`'s existing `tillLabel`/`favoriteToggleLabel` (Story 1.i1d) are equally unwired to `next-intl` in all 4 consumer pages (`CalendarView.tsx`, `FeedCalendarView.tsx`, `AccountCalendarView.tsx`, `my-calendar-content.tsx`). This story's new label props follow the exact same established, accepted pattern (translatable prop slot + English default, no `next-intl` wiring in this story) rather than introducing or being scoped to fix a cross-cutting i18n gap that spans the whole card-label family and predates this story.

### Architecture & UX Gate Findings

`epic-1-i1-readiness.md` (swept 2026-09-13, `swept: true`, covers Stories 1.i1a-e/1.i1z) concluded "no resolver, query, or mutation is touched anywhere in this epic." This story's own scope (consuming already-exposed `distanceKm`/date fields, pure `packages/ui` presentational wiring, zero new data fetching) introduces nothing the sweep didn't anticipate — no new external service, no new data entity, no new infra dependency — so per the workflow's lightweight escape-hatch guard, **Gate 1 and Gate 3 are cited from the sweep rather than re-run fresh.**

- **Gate 1 (Architecture/Infrastructure Completeness) — NO GAP**, cited from `epic-1-i1-readiness.md`. Independently reconfirmed: this story adds no resolver/query/mutation, calls no DB/domain package or external service directly from `apps/web`/`packages/ui`, and depends only on data Story 1.i1f already plans to expose.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — NO GAP**, cited from `epic-1-i1-readiness.md`; independently reconfirmed no new global-shell/i18n-foundation/analytics/codegen dependency is introduced by this story.
- **Gate 2 (UI Complexity & Reusability, Freya persona, run fresh per the swept-epic branch's own requirement) — GAP FOUND, split applied (two findings):**
  1. **Shared badge primitive.** This story's status/nearby badges would have been a third independent inline duplicate of the exact markup/computation `EventCard.tsx`'s masonry branch already ships and Story 1.i1f's not-yet-built `EventCardCalendarGridItem` will also need — the same drift pattern (BUG-023/FIND-023) that already forced this epic's own `EventCardMediaPrimitives` extraction (Story 1.i1a). It also directly matches Gate 2's second trigger heuristic: DESIGN.md's `happeningNow` emerald-badge treatment is "specified in the authoritative UX artifact but not reflected in current [shipped] scope," and would be a third place to independently forget it. Split into **Story 1.i1i** (new prerequisite, backlog.yaml `IDEA-041`, child of `IDEA-025`): builds a shared `packages/ui/src/features/events/` badge component and migrates `EventCard.tsx`'s existing masonry branch onto it (fixing its `<=5`→`<8` threshold bug and adding the `happeningNow` emerald treatment as a byproduct of the migration, not a separately-scoped bug fix). **This story (1.i1j) depends on Story 1.i1i.**
  2. **`EventCardDateBox` two-tier chrome gap (adjacent, deliberately not folded in).** DESIGN.md's 2026-09-14 pass documents, in two separate token comments (`event_card_date_box.base_default` and `event_card_compact.date_box`), that the shared `EventCardDateBox` primitive — used by both masonry's date box and this exact compact row's date box — still renders the old single-line shape, not the two-tier month/day + amber `till_label` chrome the doc now specifies, and explicitly calls this "the same follow-up story," owned nowhere in `epics.md`/`backlog.yaml` as of this story's creation. Not folded into this story since it changes a shared primitive's own shape (needed by masonry too — a shared-primitive fix with its own consumer set) rather than a local detail of this row's badge content, which is this story's actual, unrelated scope. Split into **Story 1.i1k** (new sibling, backlog.yaml `IDEA-042`, child of `IDEA-025`). **This story (1.i1j) does NOT depend on Story 1.i1k** — independent, unrelated scope.

Per the escape hatch in `story-split-gate.md`: neither finding required user override — both splits mirror this epic's own established build-then-adopt precedent (1.i1a → 1.i1c/d/e; 1.i1f → 1.i1g/1.i1h) and this dispatch's own explicit HIL threshold (routine, mechanically-resolved Gate 2 splits, not an architectural/product ambiguity). No `AskUserQuestion` was used for either finding.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None new — this story consumes `WeeklyCalendarViewScheduleShape.distanceKm?: number` exactly as Story 1.i1f's own AC13 defines it (nullable-safe, already-planned type), plus `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime`, unchanged since Story 1.i1d.
- Required DB migration changes: No changes required — no DB/GraphQL schema touched by this story.
- Required TypeScript type changes: Only new optional label fields (matching `EventCardLabels`'s status/nearby field names) added to `WeeklyCalendarViewLabels` — additive, optional, no breaking change to any existing consumer or generated type.
- Backward compatibility and rollout notes: Purely additive; all 4 consumer pages continue to compile/render unchanged if they don't pass the new label props (English defaults apply).
- Verification checks: New/extended `WeeklyCalendarView.test.tsx` cases (Task 4) plus the full existing suite green.

### Project Structure Notes

- Modifies `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx` only — no new files.
- No `packages/domain` involvement (matches Story 1.i1d's own precedent — this is pure `packages/ui` UI wiring).
- Depends on two components/fields owned by other stories (Story 1.i1f: `distanceKm`; Story 1.i1i: the shared badge component) — no local reimplementation of either is permitted.

### References

- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md `components.event_card_compact.content`, `event_card_status_badge`, `event_card_nearby_badge`]
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md § "Calendar Row Card: Thumbnail and Fallback", § "Calendar View Cards: Attachment and Composition"]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md AD-22]
- [Source: _bmad-output/implementation-artifacts/1-i1d-adopt-the-primitive-into-weeklycalendarview-compact-row.md] (compact row's current structure and this story's own origin flag)
- [Source: _bmad-output/implementation-artifacts/1-i1f-wire-nearby-distance-badges-and-build-the-calendar-grid-item-card.md] (distanceKm/threshold plumbing this story consumes)
- [Source: packages/ui/src/features/events/EventCard.tsx, EventCard.types.ts] (status/nearby badge computation/labels this story mirrors)
- [Source: packages/ui/src/features/events/format-event-date.ts] (`formatEventStatus`)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml IDEA-025 (this story), IDEA-041/IDEA-042 (child findings), IDEA-026/AD-22 (sibling desktop work)]

### Backlog row history (IDEA-025, verbatim, moved from backlog.yaml 2026-09-18)

Carved out of IDEA-016 via `bmad-create-story` (Story 1.i1d) — the child scope IDEA-016's own
reference screenshots showed (status/nearby badges in the row's title/venue column) but Story
1.i1d's actual epics.md AC set never required. DESIGN.md's `event_card_compact.content` token
block says this composition should reuse `event_card_status_badge`/`event_card_nearby_badge`
"as-is, no new badge design needed", but `WeeklyCalendarViewScheduleShape` had no computed
status (relative-time state) or `distanceKm` data plumbed into it — EventCard's own
status/nearby badges are masonry-variant-only and computed from data EventCard already
receives, none of which WeeklyCalendarView's schedule shape carried.

**AMENDED (2026-09-13, user via ritual HIL on epic-1-i1):** confirmed this badge treatment
should also apply to the DESKTOP calendar surface, not just this row's mobile/list-variant
scope — see sibling item IDEA-026 for the desktop half, since desktop's `CalendarCard
variant='grid'` had no thumbnail/badge infrastructure at all and needed its own design pass.

**ARCHITECTURE RESOLVED (bmad-architecture, 2026-09-17, Architecture Spine AD-22):**
computed-status needed no new plumbing at all — `WeeklyCalendarViewScheduleShape` already
carries `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime`, exactly what
`formatEventStatus` needs. `distanceKm` turned out to be a bigger, pre-existing gap, not
calendar-specific: verified it is not computed anywhere in this codebase — `EventCard`'s own
nearby badge had never actually rendered in production for lack of a real caller ever
populating it. Decided: one shared `computeDistanceKm` utility (`packages/domain`, mirrors the
existing SQL haversine's formula), wired into both surfaces (this item + IDEA-026) in the same
story, fixing masonry's dead badge as part of the same work.

**PROMOTED (2026-09-17 via bmad-create-story, row id named directly by the user as the
explicit follow-on to Story 1.i1f/IDEA-026, dispatched the same session):** this story (1.i1j)
delivers this row's full scope — status + nearby badges wired into WeeklyCalendarView's
compact-row content column, reusing `formatEventStatus` (no new plumbing, AD-22 Rule 1) and
consuming Story 1.i1f's `distanceKm`/`<8km` threshold as-is. Gate 2 found the badge markup was
about to become a third independent inline duplicate (EventCard.tsx masonry, Story 1.i1f's
undrafted EventCardCalendarGridItem, this row's compact row) — the same drift pattern
(BUG-023/FIND-023) that forced this epic's own EventCardMediaPrimitives extraction — carved
into child row IDEA-041 (→ Story 1.i1i, a new prerequisite this story depends on). Gate 2 also
found an adjacent, previously-orphaned gap: DESIGN.md's 2026-09-14 pass twice calls out that
the shared EventCardDateBox primitive still ships the old single-line shape instead of the
now-specified two-tier month/day chrome — carved into child row IDEA-042 (→ Story 1.i1k,
independent of this story, not a dependency). This story was NOT yet implementable as of
promotion: neither Story 1.i1f nor the new Story 1.i1i existed in code yet — its own
Pre-Coding Approval Gate blocks `bmad-dev-story` on both landing first.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — UI Components rule (`packages/ui/src/features/events` placement, consumes Story 1.i1i's component rather than a local copy), Locale-Sensitive Data Rendering rule (i18n gap flagged, not fixed here — see Dev Notes), Testing Rules (testing-trophy integration tests; no `packages/domain` touched)
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` AD-22 — status/distance computation source-of-truth
- [ ] `docs/infrastructure/index.md` — not applicable; no infra/backend layer touched by this story

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** Modified only: `packages/ui/src/features/events/WeeklyCalendarView.tsx`, `WeeklyCalendarView.types.ts`, `WeeklyCalendarView.test.tsx`. No new files.
- **Rule Mapping:** AD-22 Rule 1 (status needs no new plumbing) → Task 2.1; AD-22's coordinate-priority rule (consumed, not rebuilt) → Task 1/AC3; project-context.md UI Components rule → consumes Story 1.i1i's `packages/ui/src/features/events/` component rather than a local copy; project-context.md Testing Rules → Task 4 (Vitest integration tests, testing-trophy).
- **Verification Plan:** Task 4's full `WeeklyCalendarView.test.tsx` suite (new + regression) green; `pnpm --filter @festgrid/ui test`/`eslint`/`tsc --noEmit` clean; manual `git diff` confirmation that zero `packages/domain`/GraphQL/`apps/backend` files were touched.

## Pre-Coding Approval Gate

- [x] Scope confirmation: badges-only wiring into the compact row's content column, per IDEA-025 — no date-box changes (Story 1.i1k), no shared-primitive authoring (Story 1.i1i), no distanceKm/GraphQL plumbing (Story 1.i1f).
- [x] Architecture and boundary confirmation: no `packages/domain`/GraphQL/`apps/backend` changes; consumes Story 1.i1f's `distanceKm` field and Story 1.i1i's shared badge component only.
- [x] Testing plan confirmation: Task 4's `WeeklyCalendarView.test.tsx` extension plan reviewed.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: verified at dev-story start (2026-09-21) via `sprint-status.yaml`: Story 1.i1f is `done`. Story 1.i1i is `review` (code committed, its own tests/lint/build green per its sprint-status notes) — per standing project rule, a `review`-status prerequisite with green tests/lint/build is safe to build against without pausing for its formal `bmad-code-review` pass. Independently reconfirmed in code: `EventCardStatusBadge`/`EventCardNearbyBadge` exist and are exported from `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`, and `WeeklyCalendarViewScheduleShape.distanceKm?: number` exists in `WeeklyCalendarView.types.ts`.
- [x] Explicit human approval state: proceeding under the same standing rule above (review-status prerequisite with verified green tests/lint/build) — no separate human approval blocker remained once both prerequisites were confirmed implemented in code.

## Testing Requirements

- [x] Integration/component tests (Vitest + Testing Library) — `WeeklyCalendarView.test.tsx` (Task 4.1-4.2).
- [x] E2E tests — Not introduced by this story, matching Story 1.i1d's own testing-trophy precedent: component-level coverage on the shared `WeeklyCalendarView` behavior is the testing-trophy-appropriate level for this additive change; the calendar route's existing E2E coverage, if any, is unaffected.

## Deliverables Checklist

- [x] Status badge renders in the compact row's content column for all 8 `formatEventStatus` states, with `happeningNow`'s emerald treatment.
- [x] Nearby badge renders only when `distanceKm < 8`, omitted otherwise.
- [x] New label props threaded with English defaults matching `EventCard.tsx` verbatim.
- [x] `variant='grid'` unaffected, zero regressions.
- [x] Full `packages/ui` test/lint/typecheck green.

## Out of Scope

- Building `computeDistanceKm` or any distance-data plumbing (`WeeklyCalendarViewScheduleShape.distanceKm`, GraphQL coordinate exposure on `getEventsForCalendar`/`getEventsForMyCalendar`) — Story 1.i1f's scope, consumed here as-is.
- Building the shared `EventCardStatusBadge`/`EventCardNearbyBadge` component — split into **Story 1.i1i** (backlog.yaml `IDEA-041`, child of `IDEA-025`) via this story's own Gate 2 finding.
- Correcting `EventCardDateBox`'s shape to DESIGN.md's two-tier chrome — split into **Story 1.i1k** (backlog.yaml `IDEA-042`, child of `IDEA-025`) via this story's own Gate 2 finding.
- Wiring `next-intl` translations for the new (or any existing calendar-row) label props — a pre-existing, cross-cutting gap across this whole card-label family, not this story's scope (see Dev Notes).
- The desktop calendar-grid badge work (`EventCardCalendarGridItem`, Stories 1.i1f/1.i1g/1.i1h) — separate surface (`variant='grid'`), backlog.yaml IDEA-026.
- Collapsing multi-day per-day-segment cards into one spanning card — Story 1.i1g's scope; this story's multi-day behavior (each segment shows its own status independently) is unchanged/accepted as-is (AC5).
- The ambient/passive "viewer's current location" fallback branch of AD-22's coordinate-priority rule — Story 0.39's scope (IDEA-040).

## Definition of Done

- [x] AC1-AC8 satisfied.
- [x] `pnpm --filter @festgrid/ui test` green, no regressions.
- [x] `eslint`/`tsc --noEmit` clean for touched files.
- [x] Stories 1.i1f and 1.i1i confirmed `done`/`review`-with-green-checks before/at start of implementation (Pre-Coding Approval Gate).

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter @festgrid/ui test -- WeeklyCalendarView` — 46/46 passed (after fixing one new test's "now" fixture to avoid the mobile view's own past-day auto-collapse behavior hiding a day-segment).
- `pnpm --filter @festgrid/ui test` (full, unfiltered within the package) — 56 files / 614 tests passed, zero regressions.
- `pnpm lint` (repo root, unfiltered) — 0 errors; pre-existing `apps/web`/`apps/backend` warnings only, none in touched files.
- `pnpm build` (repo root, unfiltered) — 7/7 tasks successful.
- `git diff --name-only` confirmed only `packages/ui/src/features/events/WeeklyCalendarView.tsx`/`.types.ts`/`.test.tsx` touched by this story (plus pre-existing unrelated working-tree changes present before this session started).

### Completion Notes List

- Confirmed both prerequisites in code before starting: Story 1.i1f's `WeeklyCalendarViewScheduleShape.distanceKm?: number` (already present) and Story 1.i1i's `EventCardStatusBadge`/`EventCardNearbyBadge` (`packages/ui/src/features/events/EventCardMediaPrimitives.tsx`, exported). `sprint-status.yaml`: `1-i1f` = `done`, `1-i1i` = `review` (its own tests/lint/build green per its sprint-status notes) — proceeded per this project's standing rule that a `review`-status prerequisite with green checks is safe to build against.
- Wired `formatEventStatus`/`EventCardStatusBadge`/`EventCardNearbyBadge` into `CalendarCard`'s `variant === 'list'` branch only; `variant === 'grid'` is byte-for-byte unmodified (verified by a dedicated new test and the full existing grid-variant test suite passing unmodified).
- New badge row appended as the content column's last child (after the multi-day-badge line when present), reusing masonry's exact `flex items-center gap-1.5 flex-wrap` classes per AC4/Dev Notes' recorded implementation decision.
- Added 8 new optional `WeeklyCalendarViewLabels` fields (`statusEnded`, `statusHappeningNow`, `statusEndsToday`, `statusInHours`, `statusInDays`, `statusUpcoming`, `tomorrow`, `nearbyBadge`) with English defaults copied verbatim from `EventCard.tsx`'s `defaultLabels`; all 4 existing consumer pages are unaffected (no new required props, no `next-intl` wiring in this story, matching `tillLabel`'s established precedent).
- Nearby-badge label/threshold are resolved from the component's own already-merged `defaultLabels`/`nearbyBadgeThreshold` before being threaded down to `CalendarCard`/`EventCardNearbyBadge`, avoiding `EventCardNearbyBadge`'s internal `{ nearbyBadge: 'Nearby', ...labels }` spread silently overriding its default with an explicit `undefined` if an unresolved prop were passed straight through.
- Extended `WeeklyCalendarView.test.tsx` with 6 new tests covering: happeningNow emerald treatment + identical status across a multi-day schedule's day-segments (AC1/AC2/AC5), Ended state (neutral, never emerald), Upcoming state (14+ days out), nearby-badge threshold boundary (`7.9` shows, `8` and `undefined` omitted, AC3), badge-row DOM position after the multi-day-badge line (AC4), and confirmation that `variant='grid'` renders no status/nearby badge markup at all (AC7).

### File List

- `packages/ui/src/features/events/WeeklyCalendarView.tsx` (modified)
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` (modified)
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` (modified)
- `_bmad-output/implementation-artifacts/1-i1j-add-status-and-nearby-badges-to-weeklycalendarviews-compact-row.md` (modified) — this story file: baseline_commit frontmatter, task checkboxes, Pre-Coding Approval Gate, Deliverables Checklist, Definition of Done, Completion Status, Dev Agent Record, Change Log, Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — `1-i1j-add-status-and-nearby-badges-to-weeklycalendarviews-compact-row` status `ready-for-dev` → `in-progress` → `review`

## Change Log

- 2026-09-21: Confirmed prerequisites Story 1.i1f (`done`) and Story 1.i1i (`review`, green tests/lint/build) in `sprint-status.yaml` and in code; proceeded per this project's standing rule for `review`-status prerequisites. Wired `formatEventStatus`/`EventCardStatusBadge`/`EventCardNearbyBadge` into `WeeklyCalendarView.tsx`'s `CalendarCard` `variant='list'` branch (AC1-AC5); added 8 new optional label fields to `WeeklyCalendarViewLabels` (AC6); `variant='grid'` untouched (AC7); no `distanceKm`/GraphQL/`packages/domain` plumbing added (AC8). Added 6 new Vitest cases to `WeeklyCalendarView.test.tsx`. Verified `pnpm --filter @festgrid/ui test` (56 files / 614 tests), `pnpm lint` (0 errors), `pnpm build` (7/7 tasks) all green. Status moved `ready-for-dev` → `in-progress` → `review`.
