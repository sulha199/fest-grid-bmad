---
epic: 0
swept: true
date: 2026-08-03
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
  - 0.15
  - 0.16
  - 0.17
  - 0.18
  - 0.19
---

# Epic 0 Readiness Report — Project Setup & DevOps

## Scope

Epic 0 is unusual among the epics: it is itself the destination epic for foundational/cross-cutting gaps surfaced by other epics' gate runs (Stories 0.6-0.19 were all added retroactively via that mechanism or previous Epic 0 sweeps). This sweep re-evaluates Epic 0's *own* current story list (0.1–0.19) to ensure all infrastructural foundations are fully complete before they are actively implemented.

## Gate 1 — Architecture / Infrastructure Completeness

Three gaps found:

1. **AWS SES missing in IaC:** Story 0.15 explicitly requires the outbound email adapter's sending-service resource and IAM permissions to be provisioned via IaC (Story 0.14). However, Story 0.14's Acceptance Criteria only mentioned Lambda functions, SQS queues, EventBridge, API Gateway, and KMS, completely omitting AWS SES.
2. **Missing Storage Infrastructure for Geolocation Cache:** Story 0.16 (Geolocation adapter) mandates a caching layer for Geoapify to prevent quota exhaustion and reduce cost (NFR14). However, no table was created in the database initialization to store this cache, nor was any ElastiCache instance provisioned.
3. **Missing DB Table and API for FCM Device Tokens:** Story 0.12 establishes the FCM SDKs (backend admin SDK and frontend JS SDK) but provides no database table or API mutation to store device tokens. Without this, notifications cannot actually be routed to specific users.

Everything else checked clean: the GraphQL authenticated-context layer is sound, and all UI primitives (soft-delete, swipe-to-reveal) are well-scoped.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

The same infrastructural gaps apply cross-epic:

1. **Geolocation cache storage** — required by the Geolocation adapter, which serves map-picking (Epic 2) and timezone inference (Epic 3). The cache table needs to exist as a foundation.
2. **FCM Device Token Registry** — push notifications are triggered by Epic 3 (FR32/Story 3.8) and governed by user settings (Epic 2/Story 2.9). The mechanism to link a user to their push devices must be established in Epic 0.

## New Prerequisite Stories Added

| Story | Title | Classification | Position |
|---|---|---|---|
| **0.20** | Create geolocation cache database table | Tooling/infrastructure gap → new Epic 0 story | Appended after Story 0.19 |
| **0.21** | Set up FCM device token registry | Tooling/infrastructure gap → new Epic 0 story | Appended after Story 0.20 |

Both written as full sections (As a/I want/So that + Acceptance Criteria + `Note:`) into `epics.md`, and added as `backlog` entries to `sprint-status.yaml` immediately before `epic-0-retrospective`.

## AC Corrections Applied to Existing Stories

1. **Story 0.14 (Set up AWS IaC for Lambda, SQS, EventBridge, and KMS):** Appended AWS SES (Simple Email Service) identity and IAM permissions to the required infrastructure provisioning list to fulfill Story 0.15's dependencies.
