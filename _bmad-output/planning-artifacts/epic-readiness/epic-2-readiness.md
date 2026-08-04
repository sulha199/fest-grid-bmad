---
epic: 2
swept: true
date: 2026-08-04T00:00:00Z
stories_covered:
  - 2.1a
  - 2.1
  - 2.1b
  - 2.2
  - 2.3a
  - 2.3b
  - 2.3
  - 2.4
  - 2.4a
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

**Gaps Found:**
- **Frontend Map Tile Integration:** Story 2.4 requires displaying a map for location picking. Because the existing Geolocation adapter (Story 0.16) is strictly backend-only, rendering map tiles on the client requires calling an external tile provider directly from the frontend. This needs an explicit infrastructure setup for a restricted frontend API key and tile provider configuration; otherwise, Story 2.4 will introduce an unmanaged external service call. Addressed via **Story 2.4a**.
- **ICS Download API Surface:** FR12 requires one-way calendar integration (app to calendar) via `.ics` file delivery. Currently, no story provisions a backend endpoint or route handler to serve these files with the correct `text/calendar` content type. Addressed via **Story 2.1b**.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Gaps Found:**
- **ICS Generator Utility:** To support FR11 and FR12, a shared utility function is required to parse `EventInfo` and `Schedule` data into the standard ICS format. This utility should be built once and decoupled from the HTTP layer so it can be reused across other features that deal with calendar data (e.g., Epic 3's reminders). Addressed via **Story 2.1b**.

*Previous sweep findings remaining applicable:*
- **Cross-epic shared-data-ownership:** User-settings storage for past-event auto-hide (Story 2.7) and push notifications (Story 2.9, 3.8) is addressed by **Story 2.6a**.
- **Existing tooling dependencies:** i18n (Story 0.6), analytics (Story 1.8), GraphQL scaffold/codegen (Story 0.8), auth context (Story 0.17), and geolocation adapter (Story 0.16) are already established in earlier epics.

**Anticipated Gate 2 note (not raised as a finding here, flagged for `bmad-create-story` when 2.6 is drafted):** No Epic 2 story currently specifies the actual "Add to Calendar" trigger/button UI. A shared calendar-view component may be reusable between Story 2.6 (My Calendar) and Epic 3's Story 3.7 (Feed calendar view). This UI-complexity/reusability question remains out of scope for this sweep.

## New Prerequisite Stories Added

The following prerequisite stories were added in this run to resolve the gaps above:

| Story key | Title | Classification | Position in `epics.md` | Gate |
|---|---|---|---|---|
| `2.1b` | Build the ICS route handler and generator utility | Single-story-family architecture split | Immediately after Story 2.1 | Gate 1 & 3 |
| `2.4a` | Set up frontend map integration and reusable Map component | Single-story UI/architecture split | Immediately after Story 2.4 | Gate 1 |

*Note: Stories 2.1a, 2.3a, 2.3b, 2.5a, and 2.6a were added in previous sweep runs and are preserved in `epics.md`.*

## AC Corrections Applied to Existing Stories

None required in this run.

## Addendum (post-sweep, added during Story 2.3's creation, 2026-08-03)

`bmad-create-story`'s per-story escape-hatch guard found a Gate 1 gap this epic-wide sweep could not have anticipated: during Story 2.3's creation, the user directed that saved-location address input use live autocomplete/typeahead rather than a plain single-geocode field. Neither Story 0.16's Geolocation adapter nor Story 2.3a's mutations expose an autocomplete/predictions capability or a `placeId` input mode. Split into new **Story 2.3b** ("Extend the Geolocation adapter and saved-locations API with address autocomplete support"), added to `epics.md` (immediately after Story 2.3a) and `sprint-status.yaml` (`backlog`). This is a single-story gap (Story 2.3 only), not a re-opening of this sweep's own Gate 1/3 conclusions above.