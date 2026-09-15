# Event Detail & Event List — Follow-Through Plan

**Created:** 2026-09-15
**Status:** working doc, not a Sprint Change Proposal — tracks the phased plan for turning the
event-detail/event-list backlog triage (2026-09-15 sessions) into stories, so a later session
can verify nothing was dropped. Update the checkboxes as each phase completes; do not let this
doc's own status drift from `backlog.yaml`'s real state — it is a plan, not a source of truth.

## Why this doc exists

Two triage passes (2026-09-15) moved 32 event-detail/event-list `backlog.yaml` rows to
`triaged`. A follow-up read of `epic-formation-gate.md` and `epics.md` established:

- **Epic 1 (Core App and Event Discovery)** already owns *both* event-list (Discovery/
  EventCard/EventListView/WeeklyCalendarView/getEvents) and event-detail (1.6/EventDetailView) —
  so two of the strongest clusters don't need a new improvement epic at all, they need
  `bmad-correct-course` amending Epic 1 directly (same pattern as CC-010/CC-012/CC-019).
- `bmad-correct-course` does not auto-invoke `bmad-architecture`/`bmad-ux` — open design/
  mechanism questions must be resolved *before* it runs, or it will improvise them at a
  lighter weight than those rituals.
- Everything below only ever writes to `backlog.yaml` until a `bmad-correct-course` or
  `bmad-create-story` step actually runs — no epics.md/PRD/sprint-status.yaml edits yet.

## Phase 0 — Carve IDEA-032

IDEA-032 bundles two surfaces that belong to different epics:
- Item 1 (Moderator Tools accounts-tab card: location edit/clear icons) → **Epic 4** (Data
  Quality and Moderation).
- Item 2 (reusable account element: swap `accountId` for a location link) → **Epic 1** (event
  pages) / possibly Epic 3 (Social Media Event Integration, where the account element itself
  lives) — same cluster as IDEA-029/033 either way.

**Action:** split IDEA-032 into `parent: IDEA-032` + a new child id for the moderator-card half,
per backlog-spec.md §6. Re-run `backlog-check.py` after.

- [x] IDEA-032 carved — child id assigned: `IDEA-034` (moderator-card half; IDEA-032 kept as
      the reusable-account-element half, effort re-scored m→s on both sides of the split)
- [x] Checker clean after carve (119 rows, `idea` count 33→34)

## Phase 1 — Pre-`correct-course` sharpening (resolve before drafting proposals)

| Item(s) | Needs | Open question |
|---|---|---|
| BUG-030, BUG-033, BUG-034, BUG-035, FIND-027, FIND-028 | `bmad-architecture` | Batching mechanism for computed Event/Schedule fields: reuse the `events` resolver's existing EXISTS-subquery `fieldMap`, or add a per-request DataLoader? Governs all 6 rows' actual fix shape. |
| FIND-030 | none | Fix direction already stated in its own note (gate on `sourceSocialMediaAccountProfile` presence, or lift to shell level) — no architecture call needed, can go straight into the Epic 1 correct-course pass as a small item. |
| IDEA-029, IDEA-033, IDEA-032 (Epic-1/3 half) | none | Already fully spec'd via tier-1 notes — no sharpening needed. |

- [x] `bmad-architecture` run for the batching-mechanism decision
- [x] Decision recorded (which mechanism, and why): extend the existing `fieldMap`
      `EXISTS`-subquery mechanism (not DataLoader) — scalar/boolean fields (`isFavorited`,
      `isAddedToCalendar`, new `favoriteCount`) batch via a `virtualFields` param on
      `buildOptimizedDrizzleSelect`, reusing the exact `fieldMap` expressions already built for
      `WHERE`; the one-to-many `schedules` relation (and `Schedule.isAddedToCalendar`, BUG-033)
      batches via one `IN (...)` query attached onto the parent row before return. Two stories in
      one sequence: Story A = BUG-030 + FIND-027 + BUG-034 + FIND-028 (`Query.events`); Story B =
      BUG-033 + BUG-035 (`eventBySlug`/event-detail), sequenced after A since it reuses A's
      mechanism. See `festgrid-architecture-spine.md`'s **AD-17**.

## Phase 2 — `bmad-correct-course` against Epic 1

Two proposals (can be one session, two documents, or combined — decide when drafting):

**2a. getEvents/eventBySlug performance hardening**
Rows: BUG-030, BUG-033, BUG-034, BUG-035, FIND-027, FIND-028, FIND-030
Depends on: Phase 1's architecture decision.

- [x] Sprint Change Proposal drafted —
      `sprint-change-proposal-2026-09-15-getevents-eventbyslug-perf-hardening.md`
- [x] Registered on backlog board as **CC-020**
- [x] Story key(s) declared in the proposal, under Epic 1 plain numbering — **Story 1.3j**
      (`Query.events` batching: BUG-030, FIND-027, BUG-034, FIND-028) and **Story 1.6c**
      (`eventBySlug`/event-detail hardening: BUG-033, BUG-035, FIND-030), both added to
      `epics.md`'s Epic 1 section. BUG-035's fix shape (left open by AD-17) resolved via a live
      `AskUserQuestion` during drafting: HydrationBoundary + `dehydrate` cache seeding.

**2b. Reusable location-link mechanism**
Rows: IDEA-029, IDEA-033, IDEA-032 (Epic-1/3 half, post-carve)
Depends on: Phase 0's carve only (no architecture/UX gap).

- [x] Sprint Change Proposal drafted —
      `sprint-change-proposal-2026-09-15-reusable-location-link.md`
- [x] Registered on backlog board as **CC-021**
- [x] Story key(s) declared in the proposal — **Story 1.6d** (`LocationLink` mechanism, Epic 1)
      and **Story 1.6e** (event-detail-schedule adoption incl. IDEA-033's other two items, Epic 1)
      and **Story 0.i6e** (`SubscribedAccountCard` adoption, IDEA-032). The reusable account
      element (`SubscribedAccountCard`) turned out to be owned by neither Epic 1 nor Epic 3 as
      this table assumed — direct code inspection found it governed by Epic 0's own improvement
      epic **0.i6** ("One SubscribedAccountCard for every subscribed-account display"), so
      Story 0.i6e amends that epic directly instead (see the proposal's Section 2 for the full
      reasoning and the recorded assumption).

## Phase 3 — `bmad-create-story`

- [ ] Story file(s) created for 2a
- [ ] Story file(s) created for 2b
- [ ] `sprint-status.yaml` updated (derived — via create-story, never by hand)
- [ ] Each source row's `stories:` populated and `status` re-derives to `promoted`
      (backlog-spec.md §5/§13) — re-run `backlog-check.py` to confirm no stale-target hits

## Full row checklist (verification — every row must end up ticked)

- [ ] BUG-030
- [ ] BUG-033
- [ ] BUG-034
- [ ] BUG-035
- [ ] FIND-027
- [ ] FIND-028
- [ ] FIND-030
- [ ] IDEA-029
- [ ] IDEA-032 (post-carve, Epic 1/3 half)
- [ ] IDEA-034 (carved-out Epic 4 half — separate follow-up, not tracked further in this plan)
- [ ] IDEA-033

## Explicitly out of scope for this plan (tracked elsewhere / no epic action needed)

These were part of the same triage/intersection analysis but resolve differently — listed here
only so a later verification pass doesn't mistake their absence above for an oversight:

| Row(s) | Disposition | Why not in this plan |
|---|---|---|
| IDEA-025, IDEA-026, FIND-026 | Already `epic: epic-1-i1` | Already correctly nested under Epic 1's existing improvement epic — no new action from this plan. |
| BUG-018, BUG-031 | Direct `bmad-create-story`/quick-dev after a scroll-anchor diagnosis spike | Only 2 rows, same likely root cause — below the ≥3-row epic threshold. |
| BUG-019, IDEA-011 | Direct `bmad-create-story` (IDEA-011's rule fixes BUG-019 as its case) | Only 2 rows. |
| BUG-032, FIND-024 | Direct `bmad-create-story`/quick-dev after root-cause confirmation | Only 2 rows, same fix. |
| FIND-010 (DW-009 slice), FIND-030's... | — | Note: FIND-030 is claimed above in Phase 2a; FIND-010's DW-009 (subscribe-flash) + IDEA-031 (toggle redesign) is a separate small 2-row bundle, direct to `bmad-create-story`, no epic. |
| FIND-006 | Folded into BUG-008/BUG-009's story as test coverage | Not an independent story. |
| BUG-005, BUG-007, BUG-008, BUG-009, FIND-011, FIND-016, FIND-029, IDEA-012, IDEA-030, IDEA-031 | Standalone, already scoped, no cluster/sharpening blocker | Go straight to `bmad-create-story`/`bmad-quick-dev` whenever picked up; not part of this Epic-1 correct-course plan since each is independently complete. |
| IDEA-020 | Needs its own `bmad-architecture`+`bmad-ux` pass (SW/PWA/CDN caching) | Separate, larger initiative — not part of the getEvents/location-link plan. |
| IDEA-003, IDEA-019 | Needs `bmad-ux` first | Design not yet done; revisit once a UX pass exists. |
| FIND-025 | Coupled to an open DESIGN.md date-box sizing decision | Needs that decision (via whoever owns DESIGN.md next), not architecture. |

## Verification method for a later session

1. `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` — confirm clean.
2. Grep this file's row lists against `backlog.yaml`'s current `status:` for each id — any id
   still `triaged` here but not reflected in a phase checkbox above is a miss.
3. Cross-check `epics.md`'s Epic 1 section for the two new CC-declared stories once Phase 2
   completes.
