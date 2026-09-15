# Event Detail & Event List — Remaining Backlog Plan

**Created:** 2026-09-15
**Status:** working doc, companion to `event-pages-followthrough-plan.md` (which only covered
the Epic-1-correct-course cluster: BUG-030/033/034/035/FIND-027/028/030, IDEA-029/032/033).
This doc picks up everything else that same 2026-09-15 triage identified as event-detail/
event-list-related but explicitly out of that plan's scope. Same rule applies: update
checkboxes live, don't let this drift from `backlog.yaml`'s real state.

## Why these are split from the other plan

Unlike the Epic-1 cluster, these rows don't share one mechanism or one epic-routing question.
They're grouped here only because they're the *rest* of the event-detail/event-list triage —
each cluster below still needs its own, different next step.

## Cluster A — Ready now, no blocker (direct `bmad-create-story`/`bmad-quick-dev`)

No architecture, UX, or investigation gap. Group by theme when picking up, don't need to be
one session:

- **BUG-019 + IDEA-011** — IDEA-011's apply-on-change-vs-apply-button rule fixes BUG-019 as its
  concrete case. One story/quick-dev covers both; note BUG-019 as covered by IDEA-011's fix in
  its own row rather than a separate one, or carve if the rule alone doesn't reach BUG-019's
  specific call site.
- **FIND-010's DW-009 slice + IDEA-031** — both touch the event-detail subscribe element
  (loading flash + toggle redesign). One story.
- **BUG-005, BUG-007, BUG-008 (+ FIND-006's test-gap coverage folded in), BUG-009** —
  independent EventDetailWrapper hardening fixes. FIND-006 is not its own story — its test-gap
  closes as part of BUG-008/009's story.
- **FIND-011, FIND-016, FIND-029** — independent hardening/cleanup findings, each already fully
  scoped.
- **IDEA-012** — event links extraction + display, fully scoped via file/line refs already in
  its own note.
- **IDEA-030** — event-detail UI batch (7 items). Depends on BUG-032 (hashtag data, Cluster B)
  for item 3 only and IDEA-029 (already shipping via CC-021) for its location-line items — the
  rest can proceed independently. May fan into multiple stories per its own note.

- [ ] BUG-019 + IDEA-011 story/quick-dev
- [ ] FIND-010(DW-009) + IDEA-031 story
- [ ] BUG-005 quick-dev
- [ ] BUG-007 quick-dev
- [ ] BUG-008 + FIND-006 story
- [x] BUG-009 quick-dev
- [x] FIND-011 quick-dev
- [ ] FIND-016 story (scope: 5 bundled DW items — confirm during drafting whether it stays one
      story or splits)
- [ ] FIND-029 story (4 bundled findings)
- [ ] IDEA-012 story
- [ ] IDEA-030 story/stories (sequence item 3 after BUG-032 lands)

## Cluster B — Needs a diagnosis spike before scoping

- **BUG-018 + BUG-031** — likely the *same* infinite-scroll defect (scroll-anchor / sentinel
  handling in `useInfiniteScroll.ts`), reported 8 days apart with different symptoms. Spike
  first: confirm single root cause or two, then one (or two) story.
- **BUG-032 + FIND-024** — BUG-032's own note says to confirm whether it's FIND-024's Bright
  Data gap or a separate Apify-path issue before scoping. Spike first (small — root cause is
  probably a one-line mapper fix once confirmed), then `bmad-quick-dev`.

- [ ] BUG-018/BUG-031 diagnosis spike run, root cause confirmed
- [ ] BUG-018/BUG-031 story/quick-dev
- [ ] BUG-032/FIND-024 root-cause check run
- [ ] BUG-032/FIND-024 quick-dev

## Cluster C — Needs `bmad-ux` first

- **IDEA-003** — mobile calendar multi-day-span rendering. Own note: "no UX design exists yet."
- **IDEA-019** — happening-now/upcoming/all temporal filter, card view only. FilterHub's row is
  already tight on mobile per its own note — needs a real layout pass, not just a toggle
  dropped in.
- **FIND-025** — EventCard favorite-badge clamp, coupled to an open `DESIGN.md`
  `event_card_date_box.base_default` sizing decision. Not an architecture call — needs whoever
  next runs a `bmad-ux`/`bmad-png-to-html` pass on that surface to resolve both together.

- [ ] IDEA-003 UX pass
- [ ] IDEA-019 UX pass
- [ ] FIND-025 resolved alongside the next DESIGN.md date-box pass (opportunistic, not a
      dedicated session — flag to whoever picks up IDEA-003/019 or the next card-surface pass)

## Cluster D — Needs `bmad-architecture` + `bmad-ux` (large, separate initiative)

- **IDEA-020** — Instagram embed load speed: CDN/embed.js caching, PWA install path, iOS UX.
  Own note: "breadth ... suggests this needs bmad-architecture and/or bmad-ux before a story
  can be drafted." Not scoped further here — treat as its own initiative, not bundled with the
  event-pages work.

- [ ] IDEA-020 architecture pass
- [ ] IDEA-020 UX pass

## Cluster E — WeeklyCalendarView badge data-plumbing (internal tension, resolve before acting)

**Flagging this explicitly:** IDEA-026's own note says it's "SPEC COMPLETE... needs
bmad-create-story" — but IDEA-026 *also* says (same note) it "shares data-plumbing needs with
IDEA-025," and IDEA-025's own note says that exact plumbing (`distanceKm`/computed-status
fields on `WeeklyCalendarViewScheduleShape`) still "needs its own scoping pass" — i.e. is *not*
resolved. So IDEA-026 isn't actually create-story-ready without either (a) resolving IDEA-025's
plumbing question first, or (b) deliberately scoping IDEA-026's story to ship without status/
nearby badges and treating IDEA-025 as a strict follow-on. FIND-026 (max_events_per_day
reconsideration) is IDEA-026's own child and needs a product/UX call either way.

All three already carry `epic: epic-1-i1` — correctly epic-routed already, no
`bmad-correct-course`/epic-formation action needed. What's missing is the plumbing decision
itself.

- [ ] Resolve the IDEA-025/026 data-plumbing question (bmad-architecture: thread
      `distanceKm`/status fields through `useWeeklyCalendarController`, or explicitly scope
      IDEA-026's first story to ship without badges) — decide which before drafting either story
- [ ] FIND-026's max_events_per_day product/UX call (can run alongside the above)
- [ ] IDEA-026 story (desktop calendar grid) — after the plumbing decision
- [ ] IDEA-025 story (mobile compact-row badges) — after the plumbing decision, or as
      IDEA-026's explicit follow-on if scoped that way

## Full row checklist (verification)

- [ ] BUG-005
- [ ] BUG-007
- [ ] BUG-008
- [x] BUG-009
- [ ] BUG-018
- [ ] BUG-019
- [ ] BUG-031
- [ ] BUG-032
- [ ] FIND-006 (closes via BUG-008/009, not independently)
- [ ] FIND-010
- [x] FIND-011
- [ ] FIND-016
- [ ] FIND-024
- [ ] FIND-025
- [ ] FIND-026
- [ ] FIND-029
- [ ] IDEA-003
- [ ] IDEA-011
- [ ] IDEA-012
- [ ] IDEA-019
- [ ] IDEA-020
- [ ] IDEA-025
- [ ] IDEA-026
- [ ] IDEA-030
- [ ] IDEA-031

## Explicitly not in this doc

- **IDEA-034** (carved from IDEA-032, Epic 4 moderator-card half) — separate follow-up under
  Data Quality and Moderation, not an event-detail/event-list row.
- Everything in `event-pages-followthrough-plan.md` (BUG-030/033/034/035/FIND-027/028/030,
  IDEA-029/032/033, CC-020/CC-021) — that plan's Phase 3 (`bmad-create-story`) is still pending
  but tracked there, not here.
