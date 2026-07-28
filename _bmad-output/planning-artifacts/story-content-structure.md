# Story Content Structure Standard (BMad)

Date: 2026-07-28
Scope: Applies to newly created stories for upcoming epics.

## Purpose

Standardize story files so BMad workflows remain predictable, auditable, and implementation-ready.

## Required Section Order

1. `# Story <epic>.<story>: <title>`
2. `## Story Details`
3. `## Story`
4. `## Acceptance Criteria`
5. `## Tasks / Subtasks`
6. `## Dev Notes`
7. `## Global Rules References`
8. `## Implementation Plan (Rule-Compliant)`
9. `## Pre-Coding Approval Gate`
10. `## Testing Requirements`
11. `## Deliverables Checklist`
12. `## Out of Scope`
13. `## Definition of Done`
14. `## Completion Status`
15. `## Dev Agent Record`

## Required Story Details Fields

- Epic
- Story ID
- Status

## Status Vocabulary

Use only statuses aligned with sprint tracking:
- backlog
- ready-for-dev
- in-progress
- review
- done

Store one authoritative story status in `## Story Details`.

## Acceptance Criteria Rules

- ACs must be testable and unambiguous.
- User-facing stories must include explicit i18n ACs when applicable.
- ACs must include key behavior semantics (for example, filter semantics, fallback behavior) where relevant.

## Task Rules

- Every task must reference AC IDs.
- Include explicit testing tasks (integration and/or E2E as appropriate).
- Include architecture boundary tasks when required by project context.

## Dev Notes Rules

Dev Notes must include:
- Architecture and technical constraints
- File/path expectations
- Data/API boundary constraints
- References to source artifacts

## Implementation Plan Rules

Implementation Plan must include concise, concrete planning with:
- File Change Plan: exact files or modules expected to be touched
- Rule Mapping: story decisions mapped to referenced global rules
- Verification Plan: tests and runtime checks to prove compliance

The implementation plan must be specific enough for user verification before coding begins.

## Pre-Coding Approval Gate Rules

Pre-Coding Approval Gate must include a checklist with:
- Scope confirmation
- Architecture and boundary confirmation
- Testing plan confirmation
- Explicit human approval state

Default state for newly created stories should be pending approval.

## Definition of Done Rules

Definition of Done must include:
- AC satisfaction
- Required tests passing
- Lint and type checks passing for touched packages

## Agent Enforcement

- `bmad-create-story` must generate stories using this structure.
- `bmad-dev-story` must treat this structure as implementation contract.
- If a story is materially non-compliant, run `bmad-create-story validate` before continued implementation.
