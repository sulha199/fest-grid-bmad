# Story 0.12: Build the shared review-verdict parser and error-handling utility

## Story Details

- Epic: 0
- Story ID: 0.12
- Status: ready-for-dev

## Story

As a developer writing review nodes,
I want a centralized, robust `parseReviewVerdict` function that extracts exactly one of `APPROVE`/`AUTO_FIX`/`NEEDS_HUMAN` from LLM outputs and applies consistent fallback/escalation formatting,
So that both Tier-1 and Tier-2 review nodes share the same robust validation logic instead of writing duplicate ad-hoc regex/parsing blocks.

## Acceptance Criteria

1. **Given** a raw string response from an LLM review completion, **when** `parseReviewVerdict(response)` is called, **then** it cleanly extracts and returns one of `'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN'`, matching case-insensitively, ignoring surrounding prose or whitespace, and ignoring trailing punctuation. [epics.md AC1]
2. **And** given the response is ambiguous, truncated, or does not contain a clean verdict, it returns `'NEEDS_HUMAN'` with a structured reason of `"could not parse review verdict"` instead of throwing, defaulting to `'APPROVE'`, or crashing. [epics.md AC2]
3. **And** the parser lives in `core/utils/` (or `core/review-verdict-parser.ts`) and is fully tested with a Vitest suite covering valid cases (various casing and extra text), empty string, and completely invalid prose. [epics.md AC3]
4. **And** both Story 1.4 (Tier-1 Reviewer) and Story 1.7 (Tier-2 Reviewer) are updated to explicitly import and use this shared utility rather than implementing their own ad-hoc parsers. [epics.md AC4]

## Tasks / Subtasks

- [ ] Task 1: Create directory `ai-dev-orchestrator/src/core/utils` if it does not exist. (AC: 3)
- [ ] Task 2: Implement `parseReviewVerdict` function inside `ai-dev-orchestrator/src/core/utils/review-verdict-parser.ts` to support case-insensitive extraction, whitespace tolerance, trailing punctuation stripping, and robust fallback behaviors. (AC: 1, 2)
- [ ] Task 3: Handle error structures and fallback formatting, returning `{ verdict: 'NEEDS_HUMAN', reason: "could not parse review verdict" }` or equivalent robust output structure. (AC: 2)
- [ ] Task 4: Write unit and integration tests inside `ai-dev-orchestrator/src/core/utils/review-verdict-parser.test.ts` covering valid inputs with diverse casings/whitespace/prose, empty responses, and entirely invalid responses. (AC: 3)
- [ ] Task 5: Set up clear documentation for other nodes to import and use the parser. (AC: 4)
- [ ] Task 6: Verify TypeScript compile checks and run the test suite to confirm all tests pass cleanly. (AC: 3)

## Dev Notes

- **Architecture and technical constraints**:
  - The utility must reside inside core package space, keeping the Hexagonal core isolated from external platform dependencies.
  - The parsing algorithm must be extremely resilient: ignore leading/trailing punctuation (like `APPROVE!`, `AUTO_FIX.`), find verdicts buried in paragraphs, and parse completely case-insensitively (`approve`, `Needs_Human`, etc.).
- **File/path expectations**:
  - `ai-dev-orchestrator/src/core/utils/review-verdict-parser.ts`
  - `ai-dev-orchestrator/src/core/utils/review-verdict-parser.test.ts`
- **Data/API boundary constraints**: Returns structured parsing results with verdict type `'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN'` and an optional descriptive `reason` for fallbacks.
- **References to source artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-1-readiness.md`.
- **Package boundaries**: Since this is targeting `ai-dev-orchestrator/` standalone initiative, none of FestGrid's specific React/Drizzle package rules or technology dependencies apply. It must remain pure, dependency-free Node.js and TypeScript.
- **Data Type Compatibility & Migration Requirements**: No changes required. No database migrations or schema modifications are involved in this story.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-1-readiness.md` (`swept: true` report). Findings: Split shared review-verdict parser and error-handling utility into its own foundational Epic 0 story (Story 0.12) to prevent duplicate, ad-hoc, and inconsistent parser implementations across separate review nodes (Story 1.4 and Story 1.7).
  - **Gate 2 (UI Complexity & Reusability)**: This story has **zero UI surface** (pure CLI/backend parsing utility). Verdict: No gap found.

## Global Rules References

- [ ] _bmad-output/planning-artifacts/story-content-structure.md
- [ ] _bmad-output/planning-artifacts/story-split-gate.md
- [ ] _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
- [ ] _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md

## Implementation Plan (Rule-Compliant)

- File Change Plan: `ai-dev-orchestrator/src/core/utils/review-verdict-parser.ts` (NEW), `ai-dev-orchestrator/src/core/utils/review-verdict-parser.test.ts` (NEW)
- Rule Mapping:
  - Robust Review Parsing: Implements robust string extraction mapping to the `'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN'` domain enum.
  - Zero UI Dependencies: Built entirely as a pure utility helper in `core/utils/` separate from any UI layers.
- Verification Plan: Use Vitest to run `pnpm test` and verify that all test scenarios for casing, prose embedding, trailing punctuation, empty inputs, and invalid formats resolve correctly.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Centralized review-verdict parser and error-handling fallback logic.
- [ ] Architecture and boundary confirmation: Ensuring core-utils isolation with no dependency on React or platform-specific libraries.
- [ ] Testing plan confirmation: Complete test suite inside `review-verdict-parser.test.ts` with Vitest.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Sourced from Epic 1 readiness sweep)

## Testing Requirements

- [ ] Unit tests: Write a full Vitest test suite covering normal extraction, case insensitivity, surrounding text, invalid text, empty response, and punctuation trimming.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/utils/review-verdict-parser.ts`
- [ ] `ai-dev-orchestrator/src/core/utils/review-verdict-parser.test.ts`

## Out of Scope

- Implementing the actual LLM review nodes themselves (Story 1.4 and Story 1.7).
- Adding database support or CLI arguments in this specific utility file.

## Definition of Done

- [ ] AC satisfaction (AC1-AC4)
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched files

## Completion Status

- [ ] backlog

## Dev Agent Record

- Initialized by: specialized bmad-create-story developer agent
- Completed by: Cline (Senior Software Engineer)
  - Date: 2026-08-21
  - Notes: Ready for development.
