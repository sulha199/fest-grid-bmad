---
epic: 2
swept: true
date: 2026-08-02T08:23:00Z
stories_covered:
  - 2.1a
  - 2.1
  - 2.2
  - 2.3a
  - 2.3
  - 2.4
  - 2.5a
  - 2.5
  - 2.6
  - 2.6a
  - 2.7
  - 2.8
  - 2.9
---

# Epic 2 Readiness Sweep — User Personalization

**Owner persona:** Winston (`bmad-agent-architect`)
**Gates run:** Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness), per `story-split-gate.md`'s Epic-Level Sweep Mode. Gate 2 (UI Complexity & Reusability) is intentionally NOT run here — it stays per-story in `bmad-create-story`.

## Gate 1 — Architecture / Infrastructure Completeness

**Checked, no new gaps found.** 
All required architectural and infrastructure layers for Epic 2 have been established.
Previously identified gaps have been addressed by the following existing prerequisite stories:
- **Story 2.1a:** Build the favorites and calendar-additions backend GraphQL API layer (Supports 2.1, 2.2, 2.6, 2.7).
- **Story 2.3a:** Build the saved-locations backend GraphQL API layer (Supports 2.3, 2.4, 2.5).
- **Story 2.5a:** Extend the events GraphQL API with geo-distance query support (Supports 2.5).

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Checked, no new gaps found.** 
All foundational and cross-cutting dependencies are accounted for.
- **Cross-epic shared-data-ownership:** User-settings storage for past-event auto-hide (Story 2.7) and push notifications (Story 2.9, 3.8) is addressed by **Story 2.6a**.
- **Existing tooling dependencies:** i18n (Story 0.6), analytics (Story 1.8), GraphQL scaffold/codegen (Story 0.8), auth context (Story 0.17), and geolocation adapter (Story 0.16) are already established in earlier epics.

**Anticipated Gate 2 note (not raised as a finding here, flagged for `bmad-create-story` when 2.6 is drafted):** No Epic 2 story currently specifies the actual "Add to Calendar" trigger/button UI. A shared calendar-view component may be reusable between Story 2.6 (My Calendar) and Epic 3's Story 3.7 (Feed calendar view). This UI-complexity/reusability question remains out of scope for this sweep.

## New Prerequisite Stories Added

None in this run. 

The following prerequisite stories were previously added and remain correctly integrated in `epics.md` and `sprint-status.yaml`:

| Story key | Title | Classification | Position in `epics.md` | Gate |
|---|---|---|---|---|
| `2.1a` | Build the favorites and calendar-additions backend GraphQL API layer | Shared data-ownership (within Epic 2; consumed by 2.1, 2.2, 2.6, 2.7) | Immediately before Story 2.1 | Gate 1 |
| `2.3a` | Build the saved-locations backend GraphQL API layer | Single-story-family architecture split (needed by 2.3, 2.4, 2.5) | Immediately before Story 2.3 | Gate 1 |
| `2.5a` | Extend the events GraphQL API with geo-distance query support | Single-story architecture split (needed only by 2.5) | Immediately before Story 2.5 | Gate 1 |
| `2.6a` | Create user-settings table and settings query/mutation resolvers | Shared data-ownership (cross-epic: Epic 2 Stories 2.7/2.9 + Epic 3 Story 3.8) | Immediately before Story 2.7 (after Story 2.6) | Gate 3 |

## AC Corrections Applied to Existing Stories

None required.

## Addendum (post-sweep, added during Story 2.3's creation, 2026-08-03)

`bmad-create-story`'s per-story escape-hatch guard found a Gate 1 gap this epic-wide sweep could not have anticipated: during Story 2.3's creation, the user directed that saved-location address input use live autocomplete/typeahead rather than a plain single-geocode field. Neither Story 0.16's Geolocation adapter nor Story 2.3a's mutations expose an autocomplete/predictions capability or a `placeId` input mode. Split into new **Story 2.3b** ("Extend the Geolocation adapter and saved-locations API with address autocomplete support"), added to `epics.md` (immediately after Story 2.3a) and `sprint-status.yaml` (`backlog`). This is a single-story gap (Story 2.3 only), not a re-opening of this sweep's own Gate 1/3 conclusions above.