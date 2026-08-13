# Sprint Change Proposal — Discovery, Event Detail & Calendar UI Refinements — 2026-08-13

**Trigger:** Three user-requested UI/UX refinements to already-shipped Epic 1 surfaces (FilterHub, event detail navigation, weekly calendar), distilled via `bmad-spec` into [`_bmad-output/specs/spec-discovery-detail-calendar-ux/`](../specs/spec-discovery-detail-calendar-ux/SPEC.md), then routed through `bmad-correct-course` at the user's explicit choice so the change is tracked with revised ACs and `sprint-status.yaml` updates (matching the pattern already used for the same-day Epic 3 proposal).
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`

---

## Section 1: Issue Summary

The user requested three UI refinements, captured as capabilities CAP-1 through CAP-5 in the source spec:

1. **FilterHub compactness** (CAP-1) — the Type/Category filters become closed-by-default dropdown triggers, primary-colored with a floating count badge when selected, plus a per-facet Clear action, laid out as a single compact row instead of a vertical stack of always-expanded pill rows.
2. **Event detail navigation** (CAP-2, CAP-3) — Next/Previous becomes shadcn `Carousel` chrome over the existing single-item async navigation (not a true multi-slide carousel), and the modal close control drops its visible text label in favor of icon-only (matching the existing `DialogClose` pattern already used elsewhere).
3. **Calendar week navigation** (CAP-4, CAP-5) — a new manual week-picker (popover + date picker) alongside the existing prev/next buttons, and the week boundary changes from Sunday–Saturday to Monday–Sunday (user-confirmed, ISO-8601 style).

**A UX-source conflict was found and resolved with the user during this proposal's drafting** (not present in the original spec pass): `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` describes the Filter Hub as "prominently displayed... users tap on `EventType`/`EventCategory` buttons/tags" — the same authoritative source that already forced one correction in Story 1.5's history (rejecting a searchable popover/combobox in favor of always-visible tap-to-toggle pills). The user confirmed via `AskUserQuestion`: proceed with the compact-dropdown redesign as an intentional UX evolution, and amend `EXPERIENCE.md` alongside the story ACs so the UX source doesn't drift from shipped reality — the same discipline this project applied the first time this exact tension surfaced.

**A scoping correction was also found during impact analysis** (see Section 2): the calendar week-boundary math (`getSunday`/`getSaturday`, prev/next/today navigation) does not live in Story 1.3f or 1.3g as initially assumed when this proposal was requested — it was extracted into a separate shared hook by **Story 3.7a** (`useWeeklyCalendarController`, `packages/ui/src/hooks/`), consumed by both Discovery's `CalendarView.tsx` (Story 1.3f) and My Calendar's `my-calendar-content.tsx` (Story 2.6). The calendar-navigation change therefore touches four stories, not two.

### Mandatory references used
- [_bmad-output/project-context.md](../project-context.md)
- [_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md](../planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md)
- Source spec: [_bmad-output/specs/spec-discovery-detail-calendar-ux/SPEC.md](../specs/spec-discovery-detail-calendar-ux/SPEC.md) + [brownfield.md](../specs/spec-discovery-detail-calendar-ux/brownfield.md)
- Story files reviewed in full before drafting this proposal:
  - [_bmad-output/implementation-artifacts/1-5-filter-events-by-type-and-category.md](../../_bmad-output/implementation-artifacts/1-5-filter-events-by-type-and-category.md)
  - [_bmad-output/implementation-artifacts/1-6-view-event-details.md](../../_bmad-output/implementation-artifacts/1-6-view-event-details.md)
  - [_bmad-output/implementation-artifacts/1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md](../../_bmad-output/implementation-artifacts/1-3f-build-the-discovery-weekly-calendar-view-and-view-switcher.md)
  - [_bmad-output/implementation-artifacts/1-3g-build-the-reusable-weeklycalendarview-component.md](../../_bmad-output/implementation-artifacts/1-3g-build-the-reusable-weeklycalendarview-component.md)
  - [_bmad-output/implementation-artifacts/3-7a-extract-shared-weekly-calendar-controller-hook.md](../../_bmad-output/implementation-artifacts/3-7a-extract-shared-weekly-calendar-controller-hook.md)
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (Filter Hub description, line 86/92)

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 1** (Core App and Event Discovery) is affected in a contained way: Stories 1.5, 1.6, 1.3f, 1.3g are reopened with additive ACs. No epic re-plan, no MVP goal change.
- **Epic 3** (Story 3.7a) and **Epic 2** (Story 2.6) are each touched by exactly one additive AC — both are already-shared-hook consumers, not scope changes to their own epics' goals.
- No epic is resequenced, added, or removed.

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **1.5** — Filter events by type and category | `done` | Reopened: FilterHub becomes a compact dropdown (CAP-1) |
| **1.6** — View event details | `done` | Reopened: carousel-chrome navigation + icon-only modal close (CAP-2, CAP-3) |
| **3.7a** — Extract shared weekly-calendar-controller hook | `review` | Reopened: week-start boundary math changes to Monday, new "jump to arbitrary week" navigation path added (CAP-4, CAP-5) |
| **1.3g** — Build the reusable `WeeklyCalendarView` component | `review` | Reopened: new manual week-picker control added to the component's header row (CAP-4) |
| **1.3f** — Build the Discovery weekly-calendar view and view-switcher | `review` | Reopened: pass-through wiring of the new week-picker callback/labels; no independent behavior change beyond what 3.7a/1.3g already provide |
| **2.6** — View and manage events on a calendar (My Calendar) | `review` | Reopened: same pass-through wiring as 1.3f, since it shares Story 3.7a's hook and Story 1.3g's component |

No other stories are invalidated. Existing shipped behavior for DSL filtering (AC2/AC3), server-side query semantics, and the async single-item detail-view fetch (AC4) remains intact — every change here is presentation-layer.

### Artifact Conflicts
- **PRD:** No conflict. All three changes are presentation refinements to already-specified features; no requirement is added, removed, or reduced.
- **Architecture:** No structural conflict. No new GraphQL operations, resolvers, database changes, or state-management category shifts — everything stays within existing URL-state/server-state/client-state boundaries (AD-4).
- **UI/UX:** One real conflict found and resolved (Section 1) — `EXPERIENCE.md`'s Filter Hub description will be amended alongside the story ACs (Section 4.5) rather than left to drift.
- **Technical Impact:** Frontend-only across `packages/ui` and `apps/web`; four new shadcn primitives (`popover`, `badge`, `carousel`, `calendar`) need adding via the shadcn CLI before implementation starts — a one-time setup step, not a recurring cost.

### Technical Impact
- **Story 1.5:** `FilterHub.tsx`'s two `MultiSelect` instances move behind `Popover` triggers with primary-color active state, a count badge, and a per-facet Clear action; layout changes from vertical stack to a single flex-wrap row.
- **Story 1.6:** `EventDetailWrapper.tsx`'s hand-built prev/next buttons get `Carousel` chrome wired to the existing `handlePrevious`/`handleNext` (no change to `useListNavigationForEvent`'s contract); the modal-mode close button drops its visible text for an icon, matching `dialog.tsx`'s existing `DialogClose` pattern.
- **Story 3.7a:** `useWeeklyCalendarController.ts`'s `getSunday`/`getSaturday` boundary math changes to a Monday-start equivalent (rename for accuracy); a new navigation path resolves an arbitrary picked date to its (Monday-start) week and calls `setWeek`/`onNavigate` exactly as `handlePrevWeek`/`handleNextWeek`/`handleToday` already do.
- **Story 1.3g:** `WeeklyCalendarView.tsx`'s header row gains a new `Popover`+`Calendar` week-picker trigger alongside the existing prev/next/Today buttons, via a new caller-supplied callback prop.
- **Stories 1.3f & 2.6:** Both wrappers pass the new callback/labels through to `WeeklyCalendarView` and `useWeeklyCalendarController`'s new arbitrary-week-selection path — mechanical wiring, no independent logic.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment.**

- Effort: **Medium** (six stories touched, though four of them — 3.7a/1.3g/1.3f/2.6 — are one shared change propagated through a hook and its two thin consumers, not six independent efforts).
- Risk: **Low-Medium**. All changes are additive/presentational; the one genuine risk is the `EXPERIENCE.md` UX-source conflict, which is being resolved explicitly (Section 4.5) rather than silently overridden.
- Rollback is not warranted — no destructive or irreversible change is introduced.
- MVP review is not warranted — no requirement is reduced or reinterpreted; this is UI polish on already-specified features.

---

## Section 4: Detailed Change Proposals

### 4.1 — Story 1.5: Compact dropdown FilterHub

**New ACs:**

```
**AC9 — Compact dropdown presentation (added 2026-08-13 via bmad-correct-course):**
And each facet (Type, Category) is presented as a closed-by-default trigger button
(shadcn Popover, not a searchable combobox — AC1's tap-to-toggle pill list renders
unchanged inside the popover's content, preserving AC1's interaction model) rather
than an always-expanded row. The trigger shows the facet label, switches to a
primary-colored (variant="default") style when that facet has any selection
(variant="outline" when empty), and displays a small floating count badge only
when selection count > 0. This AC changes only the collapsed/expanded presentation,
not the underlying tap-to-toggle interaction, and does not reintroduce the
searchable-combobox pattern AC1 explicitly rejected.

**AC10 — Per-facet clear + compact row layout (added 2026-08-13 via bmad-correct-course):**
And each facet's popover includes its own "Clear" action in addition to the existing
"Clear filters" action (AC5) covering both facets. The Type/Category triggers plus any
existing Location filter trigger lay out in a single horizontally-wrapping row instead
of a vertical stack, with "Clear filters" inline at the row's end.
```

**Dev Notes addendum:** shadcn `popover` and `badge` are not yet installed in `apps/web/src/components/ui/` — add via the shadcn CLI before starting.

**Rationale:** Resolves the user's compactness/visual-state request while explicitly preserving AC1's UX-sourced tap-to-toggle interaction — the popover is a presentation wrapper, not a reintroduction of the rejected combobox pattern.

---

### 4.2 — Story 1.6: Carousel-chrome navigation + icon-only modal close

**New ACs:**

```
**AC13 — Carousel-chrome Next/Previous navigation (added 2026-08-13 via bmad-correct-course):**
And the Next/Previous controls specified in AC5 are presented using shadcn Carousel
visual/gesture chrome (arrow controls, optional swipe) wrapping the single
currently-loaded EventDetailView, rather than plain buttons. This is a presentation
change only: the underlying async, single-item, list-context-aware navigation (AC5,
AC6) and existing disabled/loading states are preserved unchanged. This is explicitly
not a multi-slide carousel — no more than one event's data is ever mounted at a time.

**AC14 — Icon-only modal close (added 2026-08-13 via bmad-correct-course):**
And the modal-mode close control (rendered when accessed via the intercepted route)
displays only an icon (no visible text label), with an aria-label and screen-reader-only
text retained for accessibility — matching the existing icon-only pattern already used
by apps/web/src/components/ui/dialog.tsx's DialogClose.
```

**Dev Notes addendum:** shadcn `carousel` is not yet installed (brings `embla-carousel-react`); add via the shadcn CLI. Check `apps/web/locales/{en,id}.json`'s `EventDetailsPage.closeModal`/`.previous`/`.next` keys — `closeModal` becomes aria/sr-only-only text; `previous`/`next` may still be needed as `aria-label`s on the carousel's arrow controls even though their visible text goes away.

**Rationale:** Delivers the requested carousel treatment without regressing the async list-navigation contract Story 1.6b built and `project-context.md`'s "Context-Aware Detail Views" invariant requires; brings the modal close control in line with the icon-only pattern already established elsewhere in the codebase.

---

### 4.3 — Story 3.7a: Monday week start + arbitrary-week navigation path

**New ACs:**

```
**AC6 — Monday-start week boundary (added 2026-08-13 via bmad-correct-course, user-confirmed):**
And the hook's week-boundary calculation (currently getSunday/getSaturday) changes to a
Monday-start, Sunday-end week (ISO-8601 style) — renamed for accuracy (e.g.
getWeekStart/getWeekEnd) — applied uniformly across handlePrevWeek, handleNextWeek,
handleToday, and the new AC7 navigation path. Existing Sunday-start test assertions in
the hook's test file are updated to match; no other consumer of the hook may retain a
divergent boundary calculation.

**AC7 — Arbitrary-week selection (added 2026-08-13 via bmad-correct-course):**
And the hook exposes a new navigation path (e.g. handleSelectWeek(date: string)) that
resolves any given date to its containing week using the same (Monday-start) boundary
calculation as AC6, then calls setWeek/onNavigate exactly as handlePrevWeek/
handleNextWeek/handleToday already do — no second, divergent boundary calculation
anywhere in the hook or its consumers.
```

**Rationale:** This is the correct, single point of change for both the Monday-start requirement and the new manual week-picker's date-to-week resolution — consistent with this story's own reason for existing (one shared implementation instead of per-consumer duplication).

---

### 4.4 — Story 1.3g: Manual week-picker control

**New AC:**

```
**AC13 — Manual week-picker control (added 2026-08-13 via bmad-correct-course):**
And the header row (AC1, AC2) gains a new week-picker trigger — a Button opening a
Popover containing a Calendar (shadcn date picker) — alongside the existing prev/next/
Today controls. Selecting a date calls a new caller-supplied onSelectWeek(date)
callback (the component computes no boundary itself, matching AC2's controlled-component
pattern — the caller's Story 3.7a hook resolves the actual week via its own AC7).
```

**Dev Notes addendum:** shadcn `popover` (shared with Story 1.5) and `calendar` are not yet installed; add via the shadcn CLI.

**Rationale:** Keeps `WeeklyCalendarView` a pure controlled presentational component — it renders the trigger and reports the picked date, exactly as it already does for prev/next/Today, while Story 3.7a's hook (AC7) owns resolving that date into a week boundary.

---

### 4.5 — Stories 1.3f & 2.6: Pass-through wiring

**New AC (added identically to both stories):**

```
**AC (added 2026-08-13 via bmad-correct-course):**
And this story's wrapper passes Story 1.3g's new onSelectWeek callback through to
Story 3.7a's handleSelectWeek, and supplies the corresponding translated label(s) for
the new week-picker control, with no independent week-boundary logic introduced at
this layer.
```

**Rationale:** Both wrappers are thin consumers of the shared hook and component (per Story 3.7a's own stated purpose) — the only work at this layer is mechanical prop threading and i18n keys, not new logic.

---

### 4.6 — UX source amendment: `EXPERIENCE.md`

**Proposed edit to `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`, Filter Hub description:**

```
OLD:
"Filter Hub: Prominently displayed at the top of the discovery view, the Filter Hub
contains controls for filtering events by EventType and EventCategory. These controls
will support multi-selection..."
...
"Filtering: Users can tap on EventType or EventCategory buttons/tags in the Filter Hub.
The event grid below will update in real-time with each selection."

NEW:
"Filter Hub: Prominently displayed at the top of the discovery view, the Filter Hub
offers EventType and EventCategory filtering via compact dropdown triggers. These
controls support multi-selection..."
...
"Filtering: Users open the EventType or EventCategory dropdown trigger and tap
buttons/tags within it to select; the trigger reflects selection state (color, count
badge). The event grid below updates in real-time with each selection."
```

**Rationale (user-confirmed via `AskUserQuestion`):** Treats the compact-dropdown redesign as an intentional UX evolution rather than a silent departure from the authoritative source — the same discipline this project applied the first time a Filter Hub UX-source conflict surfaced (Story 1.5's original Gate 2 finding).

---

## Section 5: Implementation Handoff

**Change scope classification: Moderate** — six stories reopened with additive ACs, one UX-source document amended; no epic re-plan, no architecture change.

### Handoff recipients
- **Developer agent:** implement the reopened AC changes for Stories 1.5, 1.6, 3.7a, 1.3g, 1.3f, 2.6, in that dependency order (3.7a and 1.3g before 1.3f/2.6, since the latter two only wire through what the former two provide).
- **UX/Product check:** optional pass on the `EXPERIENCE.md` wording (Section 4.6) if a final look is desired before it's committed — not required to unblock implementation, since the user already confirmed the direction.

### Deliverables
- Updated acceptance criteria for Stories 1.5, 1.6, 3.7a, 1.3g, 1.3f, 2.6 as listed above.
- Four new shadcn primitives installed (`popover`, `badge`, `carousel`, `calendar`).
- `EXPERIENCE.md`'s Filter Hub description amended to match the shipped dropdown pattern.
- `en`/`id` locale key updates for the new/changed labels (FilterHub per-facet clear, carousel arrow aria-labels, week-picker labels).

### Success criteria
- FilterHub renders as compact, primary-colored dropdown triggers with count badges and per-facet Clear, in a single-row layout.
- Event detail Next/Previous uses Carousel chrome over the unchanged async navigation; the modal close control is icon-only.
- The calendar view offers a working week-picker popover, and every navigation path (prev/next/today/picker) agrees on a Monday-start week.
- `EXPERIENCE.md` reflects the shipped Filter Hub interaction.

---

## Section 6: Workflow Completion Summary

- **Issue addressed:** FilterHub compactness, event-detail carousel navigation + icon-only close, calendar week-picker + Monday week start.
- **Change scope:** Moderate.
- **Artifacts affected:** Stories 1.5, 1.6, 3.7a, 1.3g, 1.3f, 2.6; `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`; no PRD rewrite required.
- **Routed to:** Developer agent for implementation, in dependency order, followed by a focused review pass.

This proposal resolves the one open UX-source conflict found during drafting via `AskUserQuestion`, corrects an initial scoping assumption (calendar logic ownership traced to Story 3.7a rather than 1.3f/1.3g alone) after reading all affected story files in full, and keeps the implementation grounded in the confirmed spec at `_bmad-output/specs/spec-discovery-detail-calendar-ux/`.
