# Story Rule Centralization Matrix (Low-Risk Rollout)

Date: 2026-07-28
Scope: Upcoming stories (starting next epic), with optional backfill to existing stories.
Objective: Reduce repeated global text while preserving implementation clarity for developers and BMad agents.

## Decision Model

- Keep local when omission would risk incorrect implementation for that story.
- Centralize when text is invariant across most stories and can be safely referenced.
- Hybrid for critical global rules: keep a one-line local reminder plus canonical reference.

## Keep Local vs Centralize

| Story Section | Keep Local | Centralize | Rationale |
|---|---|---|---|
| Story Details | Yes | No | Story-specific metadata and status must remain local. |
| Story (As/I want/So that) | Yes | No | Core requirement context is unique per story. |
| Acceptance Criteria | Yes | No | Must be local, testable, and directly auditable. |
| Tasks / Subtasks | Yes | No | Execution plan must be story-specific and AC-linked. |
| Dev Notes: feature-specific architecture constraints | Yes | No | High risk if abstracted away. |
| Dev Notes: repeated global platform rules | No | Yes | Repetition source; safe to reference canonical doc. |
| Testing Requirements: story-specific cases | Yes | No | Must reflect this story's behavior. |
| Testing Requirements: global quality policy | No | Yes | Stable policy, better as shared source. |
| Deliverables Checklist | Yes | No | Per-story output contract. |
| Out of Scope | Yes | No | Scope control is story-dependent. |
| Definition of Done: story-specific checks | Yes | No | Keeps completion criteria explicit. |
| Definition of Done: global checks (lint/type/test baseline) | Hybrid | Yes | Keep one-line reminder + central reference. |
| Dev Agent Record | Yes | No | Runtime implementation history must remain local. |

## Canonical Shared Sources

Use these as single source of truth for global rules:

1. _bmad-output/project-context.md
2. _bmad-output/planning-artifacts/story-content-structure.md
3. docs/infrastructure/index.md (sharded — read the relevant section file under docs/infrastructure/ only when relevant)
4. _bmad-output/planning-artifacts/festgrid-architecture-spine.md

## What Must Stay as Local One-Liners (Hybrid Guardrails)

Keep these concise local reminders in each story even after centralization:

1. API boundary: identity/auth provider vs GraphQL/Drizzle app data.
2. Domain/UI layering boundary for this story's feature.
3. Required loader behavior category (blocking/non-blocking) when relevant.
4. i18n requirement for user-facing UI in this story.
5. Required test type for this story (integration/E2E/unit where applicable).

## Minimal Story Reference Block (Recommended)

Add this short section to each new story:

## Global Rules References

- Shared implementation rules: _bmad-output/project-context.md
- Story structure contract: _bmad-output/planning-artifacts/story-content-structure.md
- System architecture spine: _bmad-output/planning-artifacts/festgrid-architecture-spine.md
- Infrastructure constraints: docs/infrastructure/index.md

## Rollout Plan (Low Risk)

1. Phase 1 (next epic only): apply matrix to newly created stories.
2. Phase 2: run create-story validate on those stories and confirm no missing local context.
3. Phase 3: optional backfill to older stories only when touched.

## BMad Enforcement Rules

For create-story:
- Generate full local ACs/tasks/dev notes for story-unique behavior.
- Replace duplicated global prose with concise one-liners + Global Rules References block.
- Keep hybrid guardrails local.

For dev-story:
- Treat local story content as primary execution contract.
- Follow Global Rules References for shared constraints.
- If missing local guardrails for high-risk behavior, request create-story validate before implementation.

## Non-Goals

- Do not remove AC detail from stories.
- Do not force migration of all old stories in one pass.
- Do not change sprint status workflow semantics.
