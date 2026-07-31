---
epic: 0
swept: true
date: 2026-07-31
stories_covered:
  - 0.1
  - 0.2
  - 0.3
  - 0.4
  - 0.5
  - 0.6
  - 0.7
  - 0.8
  - 0.9
  - 0.10
  - 0.11
  - 0.12
  - 0.13
  - 0.14
---

# Epic 0 Readiness Report — Project Setup & DevOps

## Scope

Epic 0 is unusual among the epics: it is itself the destination epic for foundational/cross-cutting gaps surfaced by other epics' `bmad-create-story` gate runs (Stories 0.6-0.14 were all added retroactively via that mechanism). This sweep asks whether Epic 0's *own* current story list (0.1–0.14) is still incomplete — i.e. whether the pattern that produced 0.6-0.14 has more instances left to find.

## Gate 1 — Architecture / Infrastructure Completeness

Two gaps found, both independently confirmed by the Gate 1 and Gate 3 subagent passes:

1. **No outbound email infrastructure.** `docs/infrastructure/4-push-notifications.md` covers FCM only; the `high-level-overview.md` architecture diagram and Story 0.14's IaC list (4 Lambdas, 3 SQS queues, EventBridge, API Gateway, KMS) contain no email-sending resource. Story 3.10 (Epic 3) and Story 4.5 (Epic 4) both have hard AC-level dependencies on outbound email with no owning infrastructure.
2. **No Geolocation API adapter or caching layer.** Story 0.13 built the Adapter pattern for Gemini only. The PRD (NFR14, `LocationDetails`/timezone fields) mandates the same treatment — including a caching layer — for the Google Geolocation service, but no story anywhere provisions it.

Everything else checked clean: no `apps/web` → DB/domain bypass, no un-backed resolver/mutation, no auth/secrets/business-rules leakage to frontend, and Story 0.14's 4-Lambda IaC list is complete for the architecture diagram as drawn (push notifications are sent from Lambda:API, not a separate Lambda).

One non-blocking observation (not a violation): Story 0.13 has `Depends on: Story 1.1`, a forward dependency from Epic 0 into Epic 1. This is an existing, already-documented pattern (same shape as 0.16 having no forward dependency) and does not require action here.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

Same two gaps, confirmed cross-epic (Gate 3's bar of ≥2 independent consumers):

1. **Outbound email adapter** — needed by Epic 3 (Story 3.10, and FR35 inside Epic 3 itself) and Epic 4 (Story 4.5). Two independent epics, same unbuilt capability → qualifies for Epic 0.
2. **Geolocation/Places adapter + cache** — needed by Epic 2 (Story 2.4, map/current-location picking) and Epic 3 (FR33, timezone inference). Two independent epics, mandated caching layer (NFR14) → qualifies for Epic 0, mirroring the Gemini AI Gateway adapter (0.13) precedent.

**Non-gap checked and rejected:** PostHog analytics being scoped to Story 1.8 (Epic 1) rather than Epic 0. Story 0.7 (app shell) already reserves the composition slot for cross-cutting providers, and no other epic's stories have an AC-level dependency on analytics being live before Epic 1. Only one confirmed consumer exists today, so Gate 3's single-consumer exception applies — left as-is. Flagged as a watch item if Epic 3/5 later gain explicit analytics ACs.

All other project-context.md-mandated foundations (`buildOptimizedDrizzleSelect`, GraphQL Code Generator, shared testing-config package, Zod/AJV isolation, FCM) already have direct, unambiguous Epic 0 stories (0.8, 0.10, 0.11, 0.12) — no gap.

## New Prerequisite Stories Added

| Story | Title | Classification | Position |
|---|---|---|---|
| **0.15** | Set up outbound email adapter | Tooling/infrastructure gap → new Epic 0 story | Appended after Story 0.14 |
| **0.16** | Set up Geolocation adapter with caching layer | Tooling/infrastructure gap → new Epic 0 story | Appended after Story 0.15 |

Both written as full sections (As a/I want/So that + Acceptance Criteria + `Note:`) into `epics.md`, and added as `backlog` entries to `sprint-status.yaml` immediately before `epic-0-retrospective`.

## AC Corrections Applied to Existing Stories

None. No existing Epic 0 story's AC required narrowing or correction.
