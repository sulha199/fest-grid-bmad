---
epic: 4
swept: true
date: 2026-08-11
stories_covered:
  - 4.1a
  - 4.1
  - 4.2
  - 4.3a
  - 4.3
  - 4.4a
  - 4.4
  - 4.5
  - 4.6
  - 4.7
  - 4.8
---

# Epic 4 Readiness Report — Data Quality and Moderation

## Scope

This is a **re-sweep** of Epic 4, superseding the 2026-07-31 report. Trigger: Story 4.8 ("View archived (hidden) personal events") was added to `epics.md` on 2026-08-06 — after the prior sweep — and had never had Gate 1/Gate 3 run against it at the epic level. This re-sweep re-ran Gate 1 and Gate 3 against Epic 4's full current story list (4.1a–4.8), re-verified the prior sweep's three prerequisite stories are still sound, and evaluated 4.8 plus two architecture-consistency issues discovered in Story 4.4a while re-reading it against the current (2026-08-06-revised) AD-8.

## Gate 1 — Architecture / Infrastructure Completeness

**No new prerequisite stories required.** Two AC corrections applied directly to `epics.md`, both to Story 4.4a:

1. **Story 4.4a diverged from AD-8 rule 1/rule 4, re-forking a problem already solved elsewhere in the project.** The original AC invented a parallel `status` enum (`active`/`soft_deleted`) alongside `deleted_at`, and had the resolver filter on `status='active'` by hand — instead of AD-8 rule 1's single mandated `deletedAt: timestamp | null` field and Story 0.22's already-built shared `activeOnly(table)` helper (built specifically to stop resources from hand-rolling this). It also exposed `restoreEvent(eventId)`/`deleteEventPermanently(eventId)` as bare-argument mutations instead of `restoreEvent`'s `action: SoftDeleteAction!` shape mandated by AD-8 rule 4 — which explicitly names Epic 3/4's soft-delete mutations as required to comply (only `toggleFavorite`/`toggleCalendarAddition` are documented legacy exceptions). **Corrected:** `events` now gains only `deletedAt`; the resolver uses `activeOnly(events)`; `restoreEvent` is reshaped to `restoreEvent(id: ID!, action: SoftDeleteAction!): Event!` (only `RESTORE` has a live caller today, matching the `deleteUserLocation` asymmetric-but-compliant precedent).
2. **`deleteEventPermanently` is a genuine hard delete on an AD-8-bound table, which AD-8's "Prevents" clause forbade outright with no documented carve-out.** Raised to the user via `AskUserQuestion`; resolved as **Option A — document a new named AD-8 exception** (rather than redesigning it into a non-destructive marker, or deferring the decision). The Architecture Spine's AD-8 now carries an explicit "Accepted hard-delete exception" entry for `deleteEventPermanently`, mirroring how the `toggleFavorite`/`toggleCalendarAddition` exception is documented. `restoreEvent` and `deleteEventPermanently` remain two separate mutations (soft-delete/undo vs. irreversible hard delete are legitimately different actions), not one `action`-based mutation.

**Story 4.8 does not need a `4.8a` prerequisite story.** It needs a resolver-level, owner-scoped bypass of the default visibility rule-list (Stories 2.7/4.3a/4.4a) combined with a favorited/calendar-added/subscribed-sourced OR condition, on the one existing events resolver (AD-2 forbids a second endpoint). This is architecturally the same shape as Story 3.7's `isFromSubscribedAccount` field — a genuinely new resolver capability with exactly one consumer — which was built directly as an AC/implementation-detail inside Story 3.7 itself rather than split into a separate backend story. Story 4.8 follows the same precedent: no split, build it in 4.8's own scope when created. Story 1.3a now carries a forward-reference `Note:` pointing at Story 4.8 (mirroring its existing 4.4a note), for discoverability only.

Re-verified from the prior sweep, still holding: every adapter/context Epic 4 needs (AI Gateway/Story 0.13, outbound email/Story 0.15, auth-role/Story 0.17) was already built in Epic 0 in explicit anticipation of it; the corrections/reports backend layers (4.1a, 4.3a) and the soft-delete layer (4.4a) remain correctly positioned as prerequisites to their respective first consumers.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**No gap found**, confirmed on re-check including Story 4.8:

- `corrections` and `reports` are referenced nowhere outside Epic 4 in `epics.md` — they stay feature-scoped under 4.1a/4.3a (below Gate 3's ≥2-epic promotion bar), unchanged from the prior sweep.
- No new AWS infrastructure (Lambda/queue/IaC) is implied by any Epic 4 story, including 4.8 — Epic 4 is entirely synchronous request/response GraphQL, not a pipeline.
- Story 4.8 introduces no new shared table and no new cross-epic tooling dependency — it only reads fields already exposed (or to be added within its own scope) by Epic 1–4 resolvers via the existing Unified Query DSL. It creates no dependency any *other* epic would need.
- The cross-epic soft-delete visibility correction to Story 1.3a from the prior sweep remains valid and unchanged (Epic 1's listing/search/filter, Epic 2's favorites via 2.1a, Epic 3's feed via 3.7 all inherit the `activeOnly(events)` exclusion automatically via 1.3a).

## AC Corrections Applied Directly to `epics.md` (this re-sweep)

- **Story 4.4a:** replaced the `status` enum + hand-written filter with `deletedAt` + `activeOnly(events)` (Story 0.22); reshaped `restoreEvent` to the AD-8 rule-4 `action: SoftDeleteAction!` shape; added a `Correction (2026-08-11, Epic 4 readiness re-sweep)` note explaining the divergence and its fix.
- **Story 1.3a:** extended its existing forward-reference `Note:` to also point at Story 4.8's future owner-scoped bypass argument.
- **Architecture Spine, AD-8:** added an "Accepted hard-delete exception" entry documenting `deleteEventPermanently` as a deliberate, named exception to the "no hard deletes on bound tables" rule — decision confirmed with the user via `AskUserQuestion` (chose to document the exception rather than redesign away from a hard delete, or defer the decision to `bmad-create-story`).

## New Prerequisite Stories Added

None this re-sweep. The three from the prior sweep (4.1a, 4.3a, 4.4a) remain unchanged in position and count; no `4.8a` was warranted (see Gate 1 above).

## `sprint-status.yaml` Changes

None — no new backlog entries required this re-sweep (all three existing Epic 4 backlog entries from the prior sweep, plus `4-8-view-archived-hidden-personal-events`, already present and untouched; no story's status was changed).
