# Story 0.5: Build the audit logger

## Story Details

- Epic: 0
- Story ID: 0.5
- Status: ready-for-dev

## Story

As a developer debugging an orchestrator run,
I want every LLM call, shell command, verdict, and HITL event appended to a per-run JSONL log,
So that I can reconstruct exactly what happened after the fact (AD-8).

## Acceptance Criteria

1. **Given** `logging/audit-logger.ts`, **when** a node logs an event during a run, **then** one JSONL line `{ ts, runId, event, ... }` is appended to `logs/<run-id>.jsonl`. [epics.md AC1]
2. **And** the logger exposes no method an adapter would call - only nodes call it, matching AD-8's core-only ownership rule. [epics.md AC2]
3. **And** a Vitest test confirms two sequential log calls produce two valid, independently-parseable JSON lines in file order. [epics.md AC3]

## Tasks / Subtasks

- [ ] Task 1: Create the audit logger interface and implementation in `ai-dev-orchestrator/src/logging/audit-logger.ts`. (AC: 1, 2)
- [ ] Task 2: Implement append-only JSONL writing to `logs/<run-id>.jsonl` using `node:fs` or `node:fs/promises`, ensuring parent directories are created automatically if they do not exist. (AC: 1)
- [ ] Task 3: Create a unit test suite in `ai-dev-orchestrator/src/logging/audit-logger.test.ts` using Vitest to assert that log entries are written correctly and sequentially in valid JSONL format. (AC: 3)
- [ ] Task 4: Verify lint, formatting, and type-checks for the newly created files. (AC: 3)

## Dev Notes

- **Architecture and Technical Constraints**: The audit logger must be append-only and safe for a single-threaded node process context. It must strictly exist inside the `core/logging` layer and only be callable by core nodes, not by adapters (per AD-8 core-only ownership). It must have zero frontend or browser dependencies.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/logging/audit-logger.ts`
  - `ai-dev-orchestrator/src/logging/audit-logger.test.ts`
- **Data/API Boundary Constraints**: No public database schema changes are introduced. The log file format is JSONL where each line has `{ ts: string, runId: string, event: string, ...extra }`.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md` (AD-8).
- **Package Boundaries**: Ensure strict isolation of packages. No UI, React, state management, or frontend libraries. Testing is done via Vitest.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-0-readiness.md` (`swept: true`). Findings: No new Gate 1/3 findings were necessary because of the pre-swept readiness report.
  - **Gate 2 (UI Complexity and Reusability)**: This story has **zero UI surface** (pure logging utility with no user interface components, layouts, or hooks). Verdict: No gap found.

## Data Type Compatibility & Migration Requirements

- **Analysis**: No changes required. This story implements a local audit logger appending JSONL lines to files under a `logs/` folder. It does not introduce a database table or public API contract, so no DB/API schema migrations or synchronizations are required. All interfaces are local TypeScript interfaces.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-0-readiness.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/logging/audit-logger.ts` (NEW)
- `ai-dev-orchestrator/src/logging/audit-logger.test.ts` (NEW)

### Rule Mapping
- Core-only ownership: Only nodes can import/call the audit logger; adapters do not have access to it (AD-8).
- JSONL schema: Append-only lines with `{ ts, runId, event, ... }`.

### Verification Plan
- Run Vitest: `pnpm test audit-logger.test.ts`
- Run compiler: `pnpm build`

## Pre-Coding Approval Gate

- [ ] Scope confirmation: The scope is strictly limited to an append-only JSONL logger and its unit test suite.
- [ ] Architecture and boundary confirmation: Confirmed that the audit logger is purely core-level and not accessible to adapters.
- [ ] Testing plan confirmation: Unit tests checking sequential execution and parsing verification.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Covered sequential writing (sequential calls to log are appended in file-order).
- Covered JSONL parsing (each line is a standalone, valid JSON string).
- Covered directory creation (logs/ directory is auto-created if it does not exist).

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/logging/audit-logger.ts`
- [ ] `ai-dev-orchestrator/src/logging/audit-logger.test.ts`

## Out of Scope

- Implementing any graph node or graph runner logic.
- CLI options parsing.

## Definition of Done

- Audit logger written in `audit-logger.ts` and compiles successfully.
- 100% test coverage on logging paths via Vitest.
- Lint and type checks pass.

## Completion Status

- ready-for-dev

## Dev Agent Record

- (leave blank or standard placeholders)
