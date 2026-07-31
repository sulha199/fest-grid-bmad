---
date: 2026-07-31
author: Winston (bmad-agent-architect)
based_on:
  - _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md
  - _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md
  - _bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md
  - _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md
  - _bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md
  - _bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md
sprint_status_snapshot: _bmad-output/implementation-artifacts/sprint-status.yaml
---

# Critical-Path Report — Cross-Epic Dependencies

## Purpose

Synthesizes all six epic-readiness reports (Epics 0-5) into a single ranked view of which stories are true cross-epic bottlenecks — i.e. required by an epic *later* than the one they live in — versus stories that are only prerequisites within their own epic. Ranking is by `epic+n` (the story's home epic plus how many epics forward a consumer sits): breadth of consumer epics first, maximum reach second.

## Critical-path stories (required by a later epic)

| Rank | Story | Home Epic | Status (sprint-status.yaml) | Required by | Breadth | Max reach |
|---|---|---|---|---|---|---|
| 1 | **0.17** — GraphQL authenticated-context layer | Epic 0 | backlog | Epic 2 (+2), Epic 3 (+3), Epic 4 (+4), Epic 5 (+5) | 4 epics | +5 |
| 2 | **0.13** — AI Gateway adapter (Gemini) | Epic 0 | ready-for-dev | Epic 3 (+3, calls + quota algorithm), Epic 4 (+4, AI-assisted correction), Epic 5 (+5, reads quota) | 3 epics | +5 |
| 3 | **1.3a** — Events GraphQL API layer | Epic 1 | ready-for-dev | Epic 2 (+1, Story 2.1a extends), Epic 3 (+2, Story 3.7 extends filter), Epic 4 (+3, Story 4.4a/4.7 extend) | 3 epics | +3 |
| 4 | **0.15** — Outbound email adapter | Epic 0 | backlog | Epic 3 (+3, Story 3.10 / FR35), Epic 4 (+4, Story 4.5) | 2 epics | +4 |
| 5 | **0.16** — Geolocation adapter + caching layer | Epic 0 | backlog | Epic 2 (+2, Stories 2.3a/2.4), Epic 3 (+3, FR33 timezone inference) | 2 epics | +3 |
| 6 | **0.14** — AWS IaC (Lambda/SQS/EventBridge/KMS) | Epic 0 | backlog | Epic 3 (+3, scraper/AI-processor/ingestor pipeline) | 1 epic | +3 |
| 7 | **3.3a** — Posts table | Epic 3 | backlog | Epic 5 (+2, reads posts for manual selection) | 1 epic | +2 |
| 8 | **2.6a** — User-settings table + resolvers | Epic 2 | backlog | Epic 3 (+1, Story 3.8 reads the push-notification toggle) | 1 epic | +1 |

**Reading order:** #1 and #2 gate the widest swath of remaining work (Epics 2 through 5) and are both un-started — nothing in Epic 2+ can be built to spec without Story 0.17; Epics 3-5 all lean on Story 0.13.

## Special case: backward-direction criticality

**Story 4.4a** (Epic 4, soft-delete schema) does not fit the forward `epic+n` model — it runs in reverse. Once it ships, Story 1.3a's shared resolver (already built in Epic 1) must start excluding `status='soft_deleted'` rows by default, and Epic 2's Story 2.1a / Epic 3's Story 3.7 inherit that exclusion automatically since both extend 1.3a. So 4.4a is a **regression risk against already-delivered epics**, not a forward enabler, and won't be caught by ordinary "what blocks the next epic" tracking — it's what could silently break a *previous* one if its resolver change is missed at implementation time.

Story 1.3a's AC list (`epics.md`) carries a forward-reference `Note:` for this rather than a testable AC bullet, since Story 1.1 doesn't create a `status` column and Story 4.4a — which does — isn't built yet. Ownership of the actual filter implementation lives entirely in Story 4.4a's own Acceptance Criteria (see `epics.md`, Story 4.4a).

## Epic-local prerequisite stories (not cross-epic)

These block only their own epic's sibling stories, not anything later, so they rank below the cross-epic list above: `2.1a`, `2.3a`, `2.5a` (Epic 2), `4.1a`, `4.3a` (Epic 4), `5.1a` (Epic 5). Still first-in-line within their own epic's delivery order, just not a bottleneck for any other epic.
