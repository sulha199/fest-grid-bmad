---
epic: 2
swept: true
date: 2026-07-31T14:16:05Z
stories_covered:
  - 2.1
  - 2.2
  - 2.3
  - 2.4
  - 2.5
  - 2.6
  - 2.7
  - 2.8
  - 2.9
---

# Epic 2 Readiness Sweep — User Personalization

**Owner persona:** Winston (`bmad-agent-architect`)
**Gates run:** Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness), per `story-split-gate.md`'s Epic-Level Sweep Mode. Gate 2 (UI Complexity & Reusability) is intentionally NOT run here — it stays per-story in `bmad-create-story`.

## Gate 1 — Architecture / Infrastructure Completeness

**Finding 1 — No mutation/write surface exists anywhere for Epic 2's core actions.** Story 1.3a's events GraphQL layer is query-only (filtering, single-event fetch, pagination) — it defines zero mutations. No story defines a mutation for favoriting, calendar-adding, saved-location CRUD, or settings updates. Affects Stories 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.9 collectively (one gap, not seven).

**Finding 2 — Story 1.3a's read side cannot yet serve AD-2.** AD-2 mandates Favorites (2.2) and Added-to-Calendar (2.6) collections be fetched by adding `isFavorited`/`isAddedToCalendar` conditions to the existing events query (to avoid `/api/favorites`-style endpoints), but 1.3a's AC never mentions these fields, per-user joins, or the tables they'd join against. Resolved alongside Finding 1.

**Finding 3 — Story 2.5 ("nearby events within a radius") does not fit AD-1's DSL as specified.** AD-1's formal operator list (`contains`/`equals`/`notEquals`/`in`/`notIn`) has no geo-distance operator. Single-story gap, scoped to 2.5 only.

**Finding 4 — Story 2.3's saved-locations feature has no backend API layer, even though its table (`user_locations`, Story 1.1) already exists.** No story exposes it via GraphQL. Needed by 2.3, 2.4, 2.5.

**Not a gap:** Story 0.17 (GraphQL authenticated-context layer) already provides `requireAuth`/reusable identity context and explicitly anticipates Epic 2; reused directly by all new stories below, no new auth-layer story needed. Story 0.16 (Geolocation adapter) already anticipates Story 2.4; reused by 2.3a for address geocoding.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Finding — Cross-epic shared-data-ownership gap: no user-settings storage exists anywhere.** Story 1.1's table list has no settings table/columns. Story 2.7 needs a configurable "hide past events after N days" value (FR15); Story 2.9 needs a persisted notification-enabled toggle (FR16). Critically, Epic 3's Story 3.8 ("Given I have enabled push notifications in my settings...") independently reads the same flag Story 2.9 writes — this is a genuine cross-epic dependency, not an Epic-2-only concern.

**Checked, no gap found:** i18n (Story 0.6 — Epic 2 only adds locale keys), analytics (Story 1.8/PostHog — Epic 2 only adds tracked event names), GraphQL scaffold/codegen/`buildOptimizedDrizzleSelect` (Story 0.8 — reused), auth context (Story 0.17 — reused, already anticipates Epic 2), geolocation adapter (Story 0.16 — reused, already anticipates Story 2.4).

**Anticipated Gate 2 note (not raised as a finding here, flagged for `bmad-create-story` when 2.6 is drafted):** no Epic 2 story currently specifies the actual "Add to Calendar" trigger/button UI, and a shared calendar-view component may be reusable between Story 2.6 (My Calendar) and Epic 3's Story 3.7 (Feed calendar view) — this is a UI-complexity/reusability question, out of scope for this sweep.

## New Prerequisite Stories Added

| Story key | Title | Classification | Position in `epics.md` | Gate |
|---|---|---|---|---|
| `2.1a` | Build the favorites and calendar-additions backend GraphQL API layer | Shared data-ownership (within Epic 2; consumed by 2.1, 2.2, 2.6, 2.7) | Immediately before Story 2.1 | Gate 1 |
| `2.3a` | Build the saved-locations backend GraphQL API layer | Single-story-family architecture split (needed by 2.3, 2.4, 2.5) | Immediately before Story 2.3 | Gate 1 |
| `2.5a` | Extend the events GraphQL API with geo-distance query support | Single-story architecture split (needed only by 2.5) | Immediately before Story 2.5 | Gate 1 |
| `2.6a` | Create user-settings table and settings query/mutation resolvers | Shared data-ownership (cross-epic: Epic 2 Stories 2.7/2.9 + Epic 3 Story 3.8) | Immediately before Story 2.7 (after Story 2.6) | Gate 3 |

All four were written as full sections (As a/I want/So that + Acceptance Criteria + Note) directly into `epics.md`, and corresponding `backlog` entries were appended to `sprint-status.yaml` at matching positions. No Epic 0 stories were needed — every foundational tooling dependency Epic 2 touches (GraphQL scaffold, auth context, geolocation adapter, i18n, analytics) already has an owning Epic 0 story.

## AC Corrections Applied to Existing Stories

None. No existing story's Acceptance Criteria required direct correction; all gaps were additive (new prerequisite stories) rather than fixes to already-written scope.
