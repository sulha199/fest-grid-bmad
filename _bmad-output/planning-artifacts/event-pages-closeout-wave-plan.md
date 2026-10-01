# Event Detail & Event List — Closeout Wave Plan

**Created:** 2026-09-30
**Status:** working doc, companion to `event-pages-remaining-backlog-plan.md`,
`event-pages-followthrough-plan.md`, and `event-pages-dev-story-tracking.md` (all three now audited
against the current source-of-truth design docs — `design-artifacts/UX-festgrid-run-1/
EVENT-CARD-DESIGN.md` and `MASONRY-CARD-SESSION-CHANGES-2026-09-27.md`). This doc merges two
previously-separate tails into one dispatch order: (1) the 8 already-storied `ready-for-dev` rows
the three source docs left undispatched, and (2) a fresh batch of event-page backlog rows found
during a 2026-09-29/30 spec-conflict audit that never made it into any of the three docs at all.
Same rule as its predecessors: update checkboxes live, don't let this drift from `backlog.yaml`'s
real state.

## Why this doc exists

A 2026-09-29 audit (prompted by the user asking whether the backlog still matched the finalized
`EVENT-CARD-DESIGN.md`/`MASONRY-CARD-SESSION-CHANGES-2026-09-27.md` spec) found:

- Two backlog notes (`IDEA-016`, `IDEA-017`) were stale — claiming unresolved prototyping work that
  Story 1.i1l had already closed out a week earlier.
- A handful of event-page rows (`FIND-031`, `IDEA-028`, `IDEA-035`, `FIND-032`, plus the
  2026-09-22→27 "Event-Card family consolidation" cluster's own leftover findings) were never
  captured in any of the three source docs — genuinely new, unincluded backlog items.
- Three of those rows (`BUG-043`, `FIND-058`, `IDEA-048`) turned out to need live re-verification
  against real code/prod rather than trusting the backlog note at face value — see their own
  entries below for what changed.
- Separately, re-reading the three source docs end to end surfaced 8 stories that reached
  `ready-for-dev` (via `bmad-create-story`) but were **never dispatched to `bmad-dev-story`** —
  confirmed still true via a direct `sprint-status.yaml` check on 2026-09-30, not a stale-checkbox
  situation.
- `BUG-018`'s own standing caution ("fix applied, never independently re-verified against this
  row's exact repro") was closed out using evidence gathered while re-verifying BUG-043 — see its
  entry below.

## Wave A — dispatch now, prerequisites already `review`/`done` (`bmad-dev-story`)

Highest priority: these are fully scoped story files sitting idle, further along than anything else
in this plan. Confirmed via `sprint-status.yaml` on 2026-09-30 that every listed prerequisite is at
least `review`.

- [ ] **1.6d** (`1-6d-build-the-reusable-locationlink-component`, row: IDEA-029) — Build the
      reusable LocationLink component. Unlocks Wave B below.
- [ ] **1.6c** (`1-6c-batch-isaddedtocalendar-dedupe-eventbyslug-fetch-and-gate-subscriptions-query`,
      rows: BUG-033, BUG-035, FIND-030) — Batch `isAddedToCalendar`, dedupe the `eventBySlug`
      fetch, gate the subscriptions query. Prerequisite Story 1.3j is `review`.
- [ ] **1.3k** (`1-3k-render-day-of-week-recurring-schedules-and-repeat-badge`, row: IDEA-003) —
      Render day-of-week recurring schedules + repeat badge. Prerequisite Story 1.i1n is `done`.
- [ ] **0.i5d** (`0-i5d-sweep-add-the-temporal-filter-to-the-filterhub`, row: IDEA-019) — Add the
      Today/Upcoming/All temporal filter to FilterHub. Standalone.
- [ ] **0.i5e** (`0-i5e-adopt-the-controller-in-feed-and-favorites`, unblocks IDEA-038) — Adopt
      `useListPaginationController` in Feed/Favorites. Prerequisite Story 1.3l is `review`.
- [ ] **0.38** (`0-38-cache-embedjs-preconnect-and-pwa-install-prompt`, row: IDEA-020) — Cache
      embed.js, preconnect hints, PWA install prompt. Prerequisites 0.38a and 0.42 are both `review`.

## Wave B — dependents (only after 1.6d lands)

- [ ] **1.6e** (`1-6e-event-detail-schedule-refinements-smaller-name-bigger-add-to-calendar-action-location-link`,
      row: IDEA-033) — Event-detail schedule refinements. Needs 1.6d.
- [ ] **0.i6e** (`0-i6e-replace-the-cards-raw-account-identifier-line-with-a-location-link-when-confirmed`,
      row: IDEA-032) — Replace the account card's raw identifier with a location link. Needs 1.6d.

## Wave C — re-invoke create-story (only after 0.i5e reaches at least `review`)

- [ ] **IDEA-038** — Re-run `bmad-create-story IDEA-038` (extend the Today/Upcoming/All temporal
      filter to Feed/Favorites). Its prior dispatch (2026-09-19) declined and carved 0.i5e as a
      missing prerequisite instead — see `event-pages-dev-story-tracking.md`'s own "IDEA-038's own
      unblock chain" section for the full history.

## Wave 0 — doc correction (no backlog ID, do this first so nothing downstream cites the wrong spec)

- [ ] Fix `EVENT-CARD-DESIGN.md`'s `event_card_masonry.max_width` token/comment — still asserts
      `max-w-[230px]` applies to all masonry states, but Story **0.45** (done) removed it entirely
      per its own AC7 (confirmed 2026-09-29 against the shipped story file and `EventCard.tsx`).

## Wave 1 — trivial, independent cleanup (`bmad-quick-dev`, bundle in one pass)

- [ ] **FIND-053** — `EventCard.tsx`'s `variant='standard'` branch is dead code; delete it and its
      dedicated tests.
- [ ] **FIND-059** — Story 1.i1o code review: card-list page `/id` integration tests only assert
      `favoriteToggle`, missing till/status/nearby assertions.
- [ ] **FIND-054** — `PageContainer`'s `fullWidth=false` variant has the same latent
      min-w-floor-vs-nav-rail-inset overflow bug BUG-045 already fixed on the other variant.

## Wave 2 — needs scoping before dispatch, not pure quick-dev

- [ ] **FIND-052** — Masonry reflow remounts items crossing columns (ref churn + keyboard focus
      loss). Needs a mount-stable engine change, not a one-line fix; scope at pickup.

## Wave 3 — event-detail & process hygiene (independent, slot anywhere)

- [ ] **FIND-031** — Event-detail page client-side hygiene: unmemoized prop mapper, raw `<img>` on
      hero/carousel-peek images.
- [ ] **FIND-032** — No lint/test guardrail enforces key parity between label interfaces (e.g.
      `EventDetailViewLabels`) and `en.json`/`id.json`.
- [ ] **IDEA-035** — Formalize scroll-to-top-on-filter-reset as a cross-surface EXPERIENCE.md
      convention (currently a single-surface Discovery-only implementation).
- [ ] **IDEA-048** — Mobile Vertical Day List's favorite pill still corner-overlays the thumbnail
      (`EventCardMediaPrimitives.tsx:265`, `absolute top-1 right-1`); user-directed fix (2026-09-29)
      mirrors the till badge's floating-corner treatment onto the opposite corner
      (`-top-1.5 -right-1.5`) — will need the same "pull out of the clipped `EventCardMediaSlot`"
      treatment masonry VM1's till tag got, not a plain class swap. Venue-line half of this row is
      already closed (shipped 2026-09-27).

## Wave 4 — large standalone feature (own wave, likely splits into multiple stories)

- [ ] **IDEA-028** — Platform-prefixed event slugs (Architecture Spine AD-16), DB-free
      truly-parallel Instagram oEmbed resolution for the event-detail page. Architecture already
      done; ready for `bmad-create-story` directly.

## Resolved during this audit (no dispatch needed — recorded here for the checklist trail)

- [x] **BUG-043** — Discovery infinite scroll stopping after one page. CLOSED 2026-09-29:
      independently re-verified live against `https://fest-grid.vercel.app/id` via a scripted
      Playwright run (8 scrolls, cards grew 20->30->...->100, one `getEvents` request per scroll,
      no stall). The backlog note's own masonry-absolute-positioning hypothesis was checked and
      found wrong (Story 0.45's engine uses plain flex columns, never `position: absolute`), but
      the underlying symptom is confirmed gone regardless.
- [x] **BUG-018** — Infinite-scroll scroll-position-preservation caution. CLOSED 2026-09-30: the
      same BUG-043 re-test doubles as this row's own repro check — 8 consecutive scroll-to-bottom
      calls with zero manual up/down correction between them kept loading pages continuously,
      which is exactly the behavior this row said was broken.
- [x] **IDEA-016 / IDEA-017** — stale notes corrected 2026-09-29: both claimed unresolved
      prototyping corrections/refinements that Story 1.i1l had already closed a week earlier (per
      that story's own opening paragraph, which names both rows explicitly).
- [x] **FIND-058 (partial)** — nearby-badge half confirmed shipped and working (estimated-distance
      badge, matches AC-NEARBY-1/2/3). `isAddedToCalendar` half found to be a cross-family gap
      (masonry `EventCard.tsx` has zero references to `isAddedToCalendar` either, not just
      MultiDaySpanningBar) — **deferred by user decision 2026-09-30** pending a product call on
      which card families should show this indicator at all. Not in any wave above.

## Deferred — not in any wave, needs a product decision first

| ID | Why deferred |
|---|---|
| **FIND-058** | `isAddedToCalendar` treatment gap spans masonry + calendar-grid — needs a cross-family decision before any fix, not a contained patch. A ready-made layout answer exists when this is picked back up: reuse the sibling single-day grid card's own already-shipped corner-icon pattern (`WeeklyCalendarView.tsx:1373-1379`) verbatim. |

## How to use this doc

1. Dispatch Wave A first via `ritual-orchestrator` (`bmad-dev-story`) — these are the most
   fully-scoped, highest-fan-out items left in the whole event-pages backlog.
2. Wave B only after 1.6d reaches at least `review`.
3. Wave C only after 0.i5e reaches at least `review`.
4. Waves 0–4 can interleave with A/B/C on business priority — none of them block or are blocked by
   the ready-for-dev queue.
5. Re-run `verify-story.ts`/`backlog-check.py` after each dispatch, same convention as
   `event-pages-dev-story-tracking.md`.
