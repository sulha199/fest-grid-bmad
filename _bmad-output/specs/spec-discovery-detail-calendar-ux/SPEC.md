---
id: SPEC-discovery-detail-calendar-ux
companions: ['brownfield.md', '../../project-context.md']
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Discovery, Event Detail & Calendar UI Refinements

## Why

**A pain to solve.** Three already-shipped Epic 1 surfaces (FilterHub, event detail navigation, weekly calendar) work but have accumulated friction the user wants closed now: the FilterHub is bulkier than it needs to be, the event-detail prev/next affordance is plain buttons instead of the desired carousel treatment (with a modal-close button that shows a redundant visible label), and the calendar view has no way to jump straight to an arbitrary week and uses a Sunday-first week that the user has decided should become Monday-first (ISO-8601 style). This is presentation-layer refinement of existing, working features — not new product scope.

## Capabilities

- **CAP-1**
  - **intent:** User operates the Type and Category filters as compact, closed-by-default dropdowns that visually indicate selection (primary color) and selection count, instead of always-expanded pill rows.
  - **success:** Each trigger renders `variant="default"` with a small floating count badge when that facet's selection count > 0, and `variant="outline"` with no badge when empty; clicking a trigger opens a popover containing the existing toggle-list plus its own per-facet Clear action; the filter bar lays out as a single flex-wrap row (type + category + location triggers, inline top-level Clear-all) instead of a vertical stack.

- **CAP-2**
  - **intent:** User moves to the next/previous event in list context via carousel-style visual navigation (arrows, optional swipe) wrapping the currently-open event detail, replacing the plain prev/next buttons.
  - **success:** The carousel's prev/next controls invoke the existing async slug-navigation flow unchanged (same disabled/loading states as today); at no point is more than one event's data mounted at once.

- **CAP-3**
  - **intent:** User closes the event-detail modal via an icon-only control, with no visible text label, matching the existing shadcn dialog-close pattern elsewhere in the app.
  - **success:** The modal close button renders only an icon; an `aria-label` and screen-reader-only text remain for accessibility; no visible "Close" text renders.

- **CAP-4**
  - **intent:** User can jump the weekly calendar directly to an arbitrary week via a manual date-selection control, alongside the existing prev/next week buttons.
  - **success:** Selecting any date in the picker resolves to that date's week start using the same week-start rule as prev/next/today, and drives the view through the existing week-change plumbing — no second, divergent boundary calculation exists anywhere in the feature.

- **CAP-5**
  - **intent:** The weekly calendar's week boundary changes from Sunday–Saturday to Monday–Sunday, uniformly across prev/next, manual pick, and "today".
  - **success:** The week-start calculation returns Monday for any given date; all navigation paths (prev/next/manual-pick/today) agree on the same boundary; existing Sunday-based test assertions are updated to match.

## Constraints

- The carousel treatment (CAP-2) must not preload or mount more than one event's data at a time — event data is fetched per-slug on demand, so this rules out a true multi-slide carousel; only its visual/gesture chrome is reused over the existing single-item async navigation.
- The shadcn primitives this work depends on (popover, badge, carousel, calendar) are not yet installed in the app's UI component directory and must be added before use. See `brownfield.md`.
- Manual week-picker date selection (CAP-4) must resolve to a week boundary using the *same* week-start calculation as prev/next/today (CAP-5) — never a second, independently-computed boundary.
- Any visible string added, changed, or removed by this work must route through the app's i18n system; no new hardcoded user-facing text.
- New reusable pieces follow the existing split between domain-feature components and framework-agnostic core primitives. See `brownfield.md`.
- FilterHub's dropdown must be built on a non-auto-closing popover pattern, not a menu component whose item-click semantics assume single-select, one-shot actions.

## Non-goals

- A true multi-slide carousel that preloads adjacent events' data.
- In-popover search inside the FilterHub dropdowns — current option-list sizes don't justify it.
- Any change to the backend data model, GraphQL API, or server-side logic — this is presentation-layer only.
- Reopening or renegotiating any other epic's scope (e.g. the concurrent Epic 3 change proposal, or in-flight Epic 6 work).

## Success signal

A user filtering the Discovery page sees compact, primary-colored dropdown triggers with a count badge instead of expanded pill rows; a user browsing event detail pages moves between events with carousel-style controls and closes the modal via an icon with no visible label; a user on the calendar view can jump to any week via a date-picker popover, and the displayed week always starts on Monday.

## Assumptions

- Assumed the calendar view's existing prev/next week buttons are wired directly to the shared weekly-calendar controller hook's navigation handlers; not verified line-by-line during this spec pass — confirm at implementation time.
- Assumed the FilterHub Type/Category option lists stay small enough that a plain toggle/checkbox list inside a popover (no search) remains usable; revisit if list length grows substantially.

