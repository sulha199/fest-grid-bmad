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
  **ALREADY STORIED, verified 2026-09-17** (`ritual-orchestrator` batch, pre-dispatch check) —
  both rows were `promoted` in `backlog.yaml` on 2026-09-15, well before this batch was written:
  IDEA-011 → Story 0.i5a (the AD-18 rule itself), BUG-019 → Story 0.i5b (adopts the controller
  into Discovery, the concrete fix for BUG-019's exact symptom). Both stories are already at
  `sprint-status.yaml` status `review` (past `bmad-create-story`, already dev'd). No dispatch
  needed — this row's checkbox below was simply never updated after the 2026-09-15 work landed.
- **FIND-010's DW-009 slice + IDEA-031** — both touch the event-detail subscribe element
  (loading flash + toggle redesign). One story.
- **BUG-005, BUG-007, BUG-008 (+ FIND-006's test-gap coverage folded in), BUG-009** —
  independent EventDetailWrapper hardening fixes. FIND-006 is not its own story — its test-gap
  closes as part of BUG-008/009's story.
  **ALREADY STORIED, verified 2026-09-17** (`ritual-orchestrator` batch, pre-dispatch check) —
  BUG-005 is covered by Story 0.i6a (epic-0-i6; its epics.md AC and Dev Agent Record both cite
  BUG-005 by name; all 6 tasks complete, tests/lint/build green). BUG-007 and BUG-008 (and
  FIND-006's folded-in test gap) are both covered by the same existing Story 2.i1a
  (`2-i1a-fix-eventdetailwrappers-four-onsuccess-handlers`, epic-2-i1). All three stories are at
  `sprint-status.yaml` status `review`. No dispatch needed for any of BUG-005/007/008/FIND-006 —
  same stale-checkbox situation as the BUG-019/IDEA-011 row above.
- **FIND-011, FIND-016, FIND-029** — independent hardening/cleanup findings, each already fully
  scoped.
- **IDEA-012** — event links extraction + display, fully scoped via file/line refs already in
  its own note.
  **ALREADY STORIED, verified 2026-09-17** (`ritual-orchestrator` batch, pre-dispatch check) —
  `backlog.yaml` shows IDEA-012 `promoted` 2026-09-16 to Story 0.37
  (`0-37-extract-and-display-event-links`), status `review`. A follow-on child row (IDEA-036,
  manual link editing in the Correct Data dialog) was carved out separately and is not part of
  this batch. No dispatch needed.
- **IDEA-030** — event-detail UI batch (7 items). Depends on BUG-032 (hashtag data, Cluster B)
  for item 3 only — **now unblocked, BUG-032 fixed 2026-09-17** — and IDEA-029 for its
  location-line items. **STALE CLAIM CORRECTED, 2026-09-17**: IDEA-029 is NOT "already shipping
  via CC-021" — checked `event-pages-followthrough-plan.md` directly, which owns IDEA-029/CC-021:
  its Phase 3 (`bmad-create-story`) is entirely unchecked, and IDEA-029's own `backlog.yaml`
  status is still `triaged`, not `promoted`. IDEA-030's location-line items remain genuinely
  blocked on IDEA-029 until that plan's Phase 3 runs — the rest of IDEA-030's 7 items can proceed
  independently.

- [x] BUG-019 + IDEA-011 story/quick-dev — already covered by Stories 0.i5a/0.i5b (created
      2026-09-15, both `review`); confirmed already-done 2026-09-17 during `ritual-orchestrator`
      batch pre-dispatch check, no new dispatch run
- [x] FIND-010(DW-009) + IDEA-031 story — Story 0.i6f (2026-09-16, homed under Epic 0.i6 rather than "no epic", see its own note)
- [x] BUG-005 quick-dev — already covered by Story 0.i6a (`review`; Dev Agent Record cites
      BUG-005 by name, tasks/tests/lint/build all complete); confirmed already-done 2026-09-17
      during `ritual-orchestrator` batch pre-dispatch check, no new dispatch run
- [x] BUG-007 quick-dev — already covered by Story 2.i1a (`review`); confirmed already-done
      2026-09-17 during `ritual-orchestrator` batch pre-dispatch check, no new dispatch run
- [x] BUG-008 + FIND-006 story — already covered by the same Story 2.i1a (`review`) as BUG-007;
      confirmed already-done 2026-09-17 during `ritual-orchestrator` batch pre-dispatch check,
      no new dispatch run
- [x] BUG-009 quick-dev
- [x] FIND-011 quick-dev
- [x] FIND-016 story — split into Story 0.34 (DW-044/046/047/050) + Story 0.35 (DW-048) on
      2026-09-16, both standalone Epic 0 stories (no formed epic exists for FIND-016) per a
      confirmed AskUserQuestion answer — see Story 0.34's Dev Notes "Epic homing & scope
      decision" for the full record
- [x] FIND-029 story (4 bundled findings) — bundled as-is into Story 0.36
      (0-36-harden-past-events-visibility-mechanism) on 2026-09-16, standalone Epic 0 story
      (no formed epic exists for FIND-029), matching the FIND-016/0.34/0.35 precedent. Gained
      a 5th AC (isMainSchedule ingestion-time normalization) surfaced only while scoping the
      schedule-uniqueness migration — see Story 0.36's Dev Notes for the full record.
- [x] IDEA-012 story — already covered by Story 0.37 (`0-37-extract-and-display-event-links`,
      `review`; follow-on child IDEA-036 carved separately); confirmed already-done 2026-09-17
      during `ritual-orchestrator` batch pre-dispatch check, no new dispatch run
- [ ] IDEA-030 story/stories (sequence item 3 after BUG-032 lands)

## Cluster B — Needs a diagnosis spike before scoping

- **BUG-018 + BUG-031** — turned out **not** to be a single "spike first, then one story" case;
  they were already two separately-tracked rows with a documented relationship. **BUG-018 was
  already `promoted`→Story 0.i5b before this cluster's own framing was written** — but 0.i5b's own
  dev notes explicitly caution that its fix (via `useListPaginationController`) targeted a
  filter-driven-remount hypothesis that turned out **not** to be present in the code, so BUG-018's
  actual scroll-anchor symptom was never independently verified fixed by that story — its notes
  named **BUG-031** as the live tracking item for whatever the real symptom turns out to be.
  **RESOLVED, 2026-09-17** (`bmad-quick-dev`, dispatched via a spawned child session): real root
  cause confirmed for BUG-031 — the infinite-scroll sentinel's height collapsed once its loading
  spinner disappeared between page loads, and that collapse is what triggered the browser's native
  scroll-anchoring to jump (not the user's own original "reused/stale anchor" hypothesis, though a
  plausible-sounding one — investigation found a different, simpler mechanism instead). Fix: a
  stable `min-h-16` on `EventListView.tsx`'s sentinel (`packages/ui`), plus a "You've reached the
  end of the list" indicator wired through `hasNextPage` (already available from `useInfiniteQuery`,
  just not previously threaded through) across all 5 consumers (Discovery/Feed/Favorites/Archive/
  Account). Lint/build green; the `@festgrid/ui` test suite passes in isolation (74 unrelated,
  pre-existing `[backend]` test failures found during verification — confirmed unrelated, since
  this change touches zero backend files). **This plausibly also closes BUG-018's original
  symptom** (a collapsing sentinel losing viewport visibility matches "sentinel no longer in view,
  must scroll up then down to re-trigger" almost exactly) — but per 0.i5b's own standing caution,
  this has not been independently re-verified against BUG-018's exact original repro steps. See
  backlog.yaml's BUG-018/BUG-031 notes (2026-09-17) for the full record.
- **BUG-032 + FIND-024** — BUG-032's own note says to confirm whether it's FIND-024's Bright
  Data gap or a separate Apify-path issue before scoping. Spike first (small — root cause is
  probably a one-line mapper fix once confirmed), then `bmad-quick-dev`.
  **DIAGNOSED & FIXED, 2026-09-17** (multiple sessions: diagnosis-only, then hashtags fix, then
  continuation with locationName/ownerUsername). Confirmed: Apify path works correctly end-to-end;
  Bright Data path is the sole broken one (two-layer gap — mapper never extracted metadata,
  call site never forwarded it), so BUG-032 is a duplicate confirmation of FIND-024, not a
  separate Apify issue. Schema questions resolved by user-supplied real Bright Data records:
  `hashtags` exists with leading `#` (fixed with strip-and-lowercase); `location_details.name`
  present as locationName source; `user_posted` present as ownerUsername source. All three extracted
  + forwarded via mapper + call site with regression tests (21 mapper + 6 result tests, lint/build
  green). `ownerDisplayName` intentionally left untouched — no confirmed source field in schema yet
  (`tagged_users[].full_name` is not the poster's own displayName). Carousel/multi-image capture
  (`childPosts`-equivalent) left open — separate vendor-schema research required. See backlog.yaml's
  BUG-032/FIND-024 notes and `backlog/BUG-032-hashtags-not-persisted-into-post-table.md` for the
  full record.

- [x] BUG-018/BUG-031 diagnosis spike run, root cause confirmed (2026-09-17, see own note above —
      BUG-031's own real root cause; BUG-018's original 0.i5b fix separately left unverified)
- [x] BUG-018/BUG-031 fix applied (2026-09-17, `min-h-16` sentinel + end-of-list indicator) —
      not yet re-verified against BUG-018's own exact original repro steps
- [x] BUG-032/FIND-024 root-cause check run (2026-09-17, see own note above — Bright Data only,
      Apify confirmed working end-to-end)
- [x] BUG-032/FIND-024 quick-dev session 1 (2026-09-17, hashtags fixed)
- [x] BUG-032/FIND-024 quick-dev continuation session (2026-09-17, locationName + ownerUsername
      also fixed; ownerDisplayName + carousel-equivalent still open, no confirming evidence)

## Cluster C — Needs `bmad-ux` first

- **IDEA-003** — mobile calendar multi-day-span rendering. Own note: "no UX design exists yet."
  **PARTIALLY STALE, 2026-09-16** — the mobile-spanning design this note refers to already
  shipped (EXPERIENCE.md "Mobile Multi-Day Calendar Spanning", 2026-08-24 pass); this pass
  extended it to cover the previously-undesigned `Schedule.applicableDaysOfWeek` day-of-week
  recurrence case (BUG-026) instead — see EXPERIENCE.md "Day-of-Week Recurring Schedules" and
  this run's `.memlog.md`.
- **IDEA-019** — happening-now/upcoming/all temporal filter, card view only. FilterHub's row is
  already tight on mobile per its own note — needs a real layout pass, not just a toggle
  dropped in. **DESIGNED, 2026-09-17** — see EXPERIENCE.md "Temporal Filter: Today /
  Upcoming / All (Card View Only)" and DESIGN.md `components.temporal_filter`.
  **ARCHITECTURE DONE, 2026-09-17** (Architecture Spine AD-20) — `EventFilterInput.temporalFilter`
  enum + new `drizzle-where.ts` DSL extension point, decided; not yet implemented in code (that's
  now a normal `bmad-create-story` task, not an open architecture question).
  **AMENDED same day, user-directed** — first bucket renamed "Happening Now" → "Today", redefined
  from `started && !ended` to just `!ended` (a later-today not-yet-started event now qualifies —
  the point is "what's on today," not "in progress this instant"); "Upcoming" redefined from
  `!started` to "starts on a genuinely future day," keeping the two a clean non-overlapping
  partition. Per-card status badge explicitly unchanged. This shrank AD-20's own mechanism —
  `UPCOMING` now needs zero new backend code at all, only `TODAY`'s `!ended` check remains new.
- **FIND-025** — EventCard favorite-badge clamp, coupled to an open `DESIGN.md`
  `event_card_date_box.base_default` sizing decision. Not an architecture call — needs whoever
  next runs a `bmad-ux`/`bmad-png-to-html` pass on that surface to resolve both together.
  **RESOLVED as a UX question, 2026-09-16** — the sizing decision this row was waiting on
  turned out to already be closed by DESIGN.md's own 2026-09-14 `base_default` correction
  (large two-tier box clears the 44px touch-target min on its own). No UX work remains;
  re-scoped in `backlog.yaml` to an implementation task (migrate `EventCardDateBox` to render
  both `base`/`base_default` as distinct variants, kept in source, not collapsed to one) —
  routes to `bmad-quick-dev`, not this cluster.

- [x] IDEA-003 UX pass (2026-09-16, scope extended to day-of-week recurrence, see own note above)
- [x] IDEA-003 story (day-of-week recurrence rendering) — Story 1.3k created 2026-09-17
      (`ritual-orchestrator` batch), status `ready-for-dev`, no HIL raised (Gate 1/2/3 findings all
      resolved in-story). Covers getDays export/generalization, the GraphQL/domain enum mapping,
      the `Schedule.applicableDaysOfWeek` field addition, and `event_card_repeat_badge` across all
      3 card families.
- [x] IDEA-019 UX pass (2026-09-17, see own note above; backend query-condition work still pending)
- [ ] IDEA-019 story (temporal filter, backend + frontend) — UX + architecture (AD-20) both done,
      ready for `bmad-create-story`; implementation story must also run AD-20's own deferred
      `EXPLAIN ANALYZE` check (research prompt in backlog.yaml's IDEA-019 note) before deciding on
      a new DB index
- [x] FIND-025 UX question resolved (2026-09-16, no design work needed — see backlog.yaml note);
      remaining migration work re-routed to `bmad-quick-dev`, not part of this UX cluster

## Cluster D — Needs `bmad-architecture` + `bmad-ux` (large, separate initiative)

- **IDEA-020** — Instagram embed load speed: CDN/embed.js caching, PWA install path, iOS UX.
  Own note: "breadth ... suggests this needs bmad-architecture and/or bmad-ux before a story
  can be drafted." Not scoped further here — treat as its own initiative, not bundled with the
  event-pages work.
  **ARCHITECTURE DONE, 2026-09-17** (Architecture Spine AD-21) — re-scoped after web-verifying a
  page's service worker cannot cache a cross-origin iframe's own internal fetches, so "cache
  Instagram CDN media" is infeasible for the current oEmbed+iframe approach. Decided: cache
  `embed.js` itself (SW stale-while-revalidate) + `preconnect`/`dns-prefetch` resource hints; a
  separate dedicated SW registered per-locale-scoped paths. PWA installability + iOS install UX
  still need their own `bmad-ux` pass — not decided by AD-21.
  **UX DONE, 2026-09-17** — see EXPERIENCE.md "PWA Install Prompt" and DESIGN.md
  `pwa_install_banner`/`pwa_install_ios_modal`. Persistent dismissible banner, two dismiss
  actions (permanent / 2-week cooldown), `localStorage`-based state, Settings fallback,
  platform-split primary action (native prompt on Android/Chrome, step-by-step modal on iOS).

- [x] IDEA-020 architecture pass (2026-09-17, see AD-21)
- [x] IDEA-020 UX pass (2026-09-17, see own note above)
- [ ] IDEA-020 story (embed.js caching SW + preconnect hints + install banner/iOS modal) —
      architecture + UX both done, ready for `bmad-create-story`; must keep
      `event-details-instagram-csp.spec.ts` green (AD-21's own regression constraint)

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

**RESOLVED, 2026-09-17** (Architecture Spine AD-22) — computed-status needs no new plumbing at
all (`WeeklyCalendarViewScheduleShape` already has the needed date/time fields). `distanceKm`
turned out bigger than either item's own note suggested: verified it isn't computed *anywhere*
in this codebase today — `EventCard`'s own nearby badge has never actually rendered in
production for lack of a real caller ever populating it. Decided: build one shared
`computeDistanceKm` utility now, wire it into both the new desktop calendar card *and* fix
masonry's pre-existing dead badge in the same story (IDEA-026's first story), not a
ship-without-badges deferral.

**FIND-026 RESOLVED, 2026-09-17** (`bmad-ux`) — turned into a bigger, cross-surface correction:
mobile's day-list previously rendered a day's full schedule list uncapped by design (2026-08-24);
user flagged this as a real scalability risk at production scale, not just a desktop-vs-mobile
layout question. Both surfaces now cap (sized from real card dimensions, not a fixed number —
20-per-day flat fetch as an acceptable fallback shape), multi-day segments are exempt from the
cap on both surfaces (mirroring desktop's existing spanning-bar exemption), and "+N more" now
opens one shared, responsive infinite-scroll dialog/sheet instead of desktop's old static
`max-h-56` popover. See EXPERIENCE.md "Calendar Overflow: Scalable Cap + Infinite-Scroll Popup"
(supersedes the old no-cap mobile rule) and DESIGN.md `calendar_overflow_dialog`. Per-day
pagination's actual data-fetch mechanism flagged for `bmad-architecture` — doesn't exist at all
today (`WeeklyCalendarView` gets one fully-loaded week batch, no per-day cursor).

- [x] Resolve the IDEA-025/026 data-plumbing question (2026-09-17, see AD-22 — shared
      `computeDistanceKm` utility, wired to both surfaces in one story)
- [x] FIND-026's max_events_per_day product/UX call (2026-09-17, see own note above)
- [x] Per-day pagination architecture follow-up (2026-09-17, Architecture Spine AD-23) — fair
      per-day windowed fetch + reuse of `Query.events` for the dialog's own pagination. Also
      surfaced a real, pre-existing bug (BUG-036): the current flat `ORDER BY ... LIMIT 1000`
      week-level fetch can silently starve a later day in the same week — tracked as its own
      backlog row, sequenced into the same implementation story as this work.
- [ ] IDEA-026 story (desktop calendar grid + calendar-overflow dialog + BUG-036's per-day
      windowing fix, per AD-23's sequencing) — plumbing decision now unblocks this; implementation
      story must also confirm `Schedule.latitude`/`longitude` GraphQL exposure (research prompt in
      backlog.yaml's IDEA-025 note) before wiring `computeDistanceKm`
- [ ] IDEA-025 story (mobile compact-row badges, fixes masonry's pre-existing dead nearby badge
      per AD-22) — after the plumbing decision, or as IDEA-026's explicit follow-on if scoped
      that way

## Full row checklist (verification)

- [x] BUG-005 — Story 0.i6a (`review`)
- [x] BUG-007 — Story 2.i1a (`review`)
- [x] BUG-008 — Story 2.i1a (`review`)
- [x] BUG-009
- [ ] BUG-018
- [x] BUG-019 — Story 0.i5b (`review`)
- [ ] BUG-031
- [ ] BUG-032
- [ ] BUG-036 (new, 2026-09-17 — folds into IDEA-026's story per AD-23's sequencing)
- [x] FIND-006 (closes via Story 2.i1a's BUG-008 coverage, not independently)
- [ ] FIND-010
- [x] FIND-011
- [ ] FIND-016
- [ ] FIND-024
- [ ] FIND-025
- [ ] FIND-026
- [ ] FIND-029
- [x] IDEA-003 — Story 1.3k (`ready-for-dev`)
- [x] IDEA-011 — Story 0.i5a (`review`)
- [x] IDEA-012 — Story 0.37 (`review`)
- [ ] IDEA-019
- [ ] IDEA-020
- [ ] IDEA-025
- [ ] IDEA-026
- [ ] IDEA-030
- [x] IDEA-031 — Story 0.i6f (2026-09-16)

## Explicitly not in this doc

- **IDEA-034** (carved from IDEA-032, Epic 4 moderator-card half) — separate follow-up under
  Data Quality and Moderation, not an event-detail/event-list row.
- Everything in `event-pages-followthrough-plan.md` (BUG-030/033/034/035/FIND-027/028/030,
  IDEA-029/032/033, CC-020/CC-021) — that plan's Phase 3 (`bmad-create-story`) is still pending
  but tracked there, not here.
