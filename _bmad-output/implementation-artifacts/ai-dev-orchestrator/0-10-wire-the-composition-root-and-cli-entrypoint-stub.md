# Story 0.10: Wire the composition root and CLI entrypoint stub

## Story Details

- Epic: 0
- Story ID: 0.10
- Status: ready-for-dev

## Story

As a developer running the orchestrator for the first time,
I want a `bootstrap.ts` that assembles real adapters into core and a minimal `cli.ts` entrypoint,
So that `node cli.js` actually starts something, even before any graph nodes exist.

## Acceptance Criteria

1. **Given** `bootstrap.ts` and `cli.ts` exist, **when** the orchestrator is invoked with no subcommand, **then** `bootstrap.ts` loads config (Story 0.4), validates and resolves the target project (Story 0.9), constructs the real `NineRouterLLMAdapter`/`LocalExecAdapter`, assembles them into a `NodeContext` (Story 0.11), and exits cleanly with a "no command given, nothing to run yet" message — since no graph exists until Epic 1. [epics.md AC1]
2. **And** given an unset required env var, **then** the same fail-fast behavior from Story 0.4 surfaces before any adapter is constructed. [epics.md AC2]
3. **And** this is the first point where Stories 0.1–0.9 are exercised together as one process, not just in isolated unit tests. [epics.md AC3]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/bootstrap.ts` containing the composition root function (`bootstrapNodeContext()`). (AC: 1, 2)
- [ ] Task 2: Create `ai-dev-orchestrator/src/cli.ts` containing the process entry point. (AC: 1, 2, 3)
- [ ] Task 3: In `bootstrap.ts`, load environment configurations (Story 0.4), run target BMad project validation and resolution (Story 0.9), construct real LLM (`NineRouterLLMAdapter`, Story 0.6) and Exec (`LocalExecAdapter`, Story 0.7) adapters, and bundle them into a mock/stub/initial `NodeContext` structure (Story 0.11). (AC: 1, 2)
- [ ] Task 4: In `cli.ts`, call the bootstrap function. If no arguments are provided to the process, print "no command given, nothing to run yet" to console and exit cleanly with code 0. (AC: 1, 3)
- [ ] Task 5: Handle initialization errors and ensure any missing/unset required environment variables trigger fail-fast behavior by throwing a non-recoverable `OrchestratorError` and exiting the process with code 1 before constructing any adapters. (AC: 2)
- [ ] Task 6: Write unit and integration tests in `ai-dev-orchestrator/src/bootstrap.test.ts` using Vitest to verify successful boots and fail-fast configurations. (AC: 3)
- [ ] Task 7: Verify compilation (`pnpm build`), tests (`pnpm test`), and formatting/type checks. (AC: 3)

## Dev Notes

- **Architecture and Technical Constraints**: Pure Node.js/TypeScript code using only standard modules and workspace dependencies. No React or frontend dependencies are allowed. Ensure any thrown error is handled gracefully or fail-fasted as a non-recoverable `OrchestratorError` wrapping the cause.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/bootstrap.ts`
  - `ai-dev-orchestrator/src/cli.ts`
  - `ai-dev-orchestrator/src/bootstrap.test.ts`
- **Data/API Boundary Constraints**: Handled errors must map to standard errors or custom `OrchestratorError` with `recoverable: false`.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`.
- **Package Boundaries**: State management is strictly isolated. State management (react-query, nuqs, zustand) must be isolated strictly within apps/web if present, but since this project is backend-only CLI, ensure absolutely no React/frontend or frontend state management is included.
- **Data Type Compatibility & Migration Requirements**: No changes required. No database schema or types are touched by this story.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-0-readiness.md` (`swept: true` report or equivalent). Findings: No gaps found. Story 0.10 correctly implements the composition root and CLI entrypoint, laying down the fundamental bootstrap layer for all future command-line executions.
  - **Gate 2 (UI Complexity & Reusability)**: This story has **zero UI surface** (pure CLI/backend bootstrap logic). Verdict: No gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/implementation-readiness-report-2026-08-21.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/bootstrap.ts` (NEW)
- `ai-dev-orchestrator/src/cli.ts` (NEW)
- `ai-dev-orchestrator/src/bootstrap.test.ts` (NEW)

### Rule Mapping
- Centralized Composition Root: Wires adapters (`NineRouterLLMAdapter`, `LocalExecAdapter`) to core ports at start.
- Fail-Fast Environment Validation: Config verification runs before process bootstrap.

### Verification Plan
- Verify compilation: `pnpm build` (tsc)
- Run unit/integration tests: `pnpm test` (Vitest)

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Implementing composition root and CLI entry point.
- [ ] Architecture and boundary confirmation: Verification that bootstrap compiles, loads envs, and validates the target project, with stubs for remaining ports.
- [ ] Testing plan confirmation: Test suite verifying successful boots and proper fail-fast on missing configuration.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Write a Vitest test suite in `bootstrap.test.ts` covering:
  - Valid boot returning a valid `NodeContext` when envs are correct.
  - Fail-fast throwing when required config is missing.
  - Verification of the message when invoking CLI with no arguments.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/bootstrap.ts`
- [ ] `ai-dev-orchestrator/src/cli.ts`
- [ ] `ai-dev-orchestrator/src/bootstrap.test.ts`

## Out of Scope

- Setting up state graphs or running epics (handled in Epic 1/3).
- Setting up NotifyPort and HITLPort real adapters (handled in Epic 2).
- Adding complex subcommands to CLI.

## Definition of Done

- Satisfy all Acceptance Criteria (AC1-AC3).
- 100% unit test coverage for `bootstrap.ts` with passing Vitest tests.

## Completion Status

- Status: ready-for-dev

## Dev Agent Record

- Initialized by: specialized bmad-create-story developer subagent
