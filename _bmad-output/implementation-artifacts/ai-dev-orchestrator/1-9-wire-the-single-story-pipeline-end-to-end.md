---
baseline_commit: f394329dff8b08d8084b199fbfa0741a70f6ae09
---
# Story 1.9: Wire the single-story pipeline end to end

## Story Details

- Epic: 1
- Story ID: 1.9
- Status: ready-for-dev

## Story

As a developer,
I want a runnable command that drives Stories 1.1-1.8 together against one real, already-materialized story,
So that Epic 1's value is actually usable, not just unit-tested in isolation.

## Acceptance Criteria

1. **Given** a target BMad repo with one story already at `ready-for-dev` in `sprint-status.yaml`
   **When** the orchestrator is invoked against that specific story
   **Then** before dispatching to any node, it makes one trivial smoke-test `LLMPort.complete()` call per configured model role (`ORCH_MODEL_PLANNER`/`_COMPLEX`/`_SPEED`/`_TESTER`) and fails fast with a clear "alias X failed to resolve" message if any one of them errors — surfacing a misconfigured or unconfirmed Vertex AI provider (SPEC.md's open question) immediately, not mid-run on whichever node happens to need it first.
2. **And** given `TARGET_REPO_PATH` has no `node_modules` (a fresh clone), this same pre-flight step runs the project's install command once before Tester ever runs, rather than Tester failing confusingly on a missing-dependency error it was never meant to diagnose.
3. **Then** `core/graph.ts` uses `@langchain/langgraph`'s `StateGraph` to wire the nodes from Stories 1.3–1.8 as real graph nodes and edges (not ad hoc function calls) — each built from its node-factory function called with the single `NodeContext` `bootstrap.ts` assembled (Story 0.11), never reaching for a port/path/logger any other way — routing to Speed or Complex Worker by the story's tag, through Tester, Tier-1 review, Tier-2 review, and GitCheckpoint.
4. **And** running it against a small real fixture BMad repo produces one real commit for a real trivial story, end to end, with no mocks.
5. **And** the audit logger (Story 0.5) captures every step of this real run as JSONL, including the smoke-test calls.
6. **And** the smoke testing confirms the correct validation of the new shared `parseReviewVerdict` utility.

## Tasks / Subtasks

- [ ] Task 1: Add pre-flight model alias smoke tests in `bootstrap.ts` (or the runner flow).
  - [ ] Invoke `LLMPort.complete()` with a trivial prompt for each of the configured roles: `ORCH_MODEL_PLANNER`, `_COMPLEX`, `_SPEED`, `_TESTER`.
  - [ ] Throw a clear `OrchestratorError` if any call fails, identifying which model alias failed to resolve.
- [ ] Task 2: Implement pre-flight dependency check / package installation in `bootstrap.ts`.
  - [ ] Check if `node_modules` exists under `TARGET_REPO_PATH`.
  - [ ] If it does not exist, run the package manager's installation command (e.g., `pnpm install` or `npm install` based on lockfile/project structure) once using `ExecPort`.
- [ ] Task 3: Build the LangGraph StateGraph pipeline in `ai-dev-orchestrator/src/core/graph.ts`.
  - [ ] Import and use `@langchain/langgraph`'s `StateGraph`.
  - [ ] Register all nodes from Stories 1.3–1.8 (SpeedWorker, ComplexWorker, Tester, Tier-1 Review, Tier-2 Review, GitCheckpoint).
  - [ ] Build each node using its dedicated factory function, passing the single `NodeContext` assembled at bootstrap.
  - [ ] Wire the edges according to the single-story workflow: route to Speed or Complex Worker based on story tag, then to Tester, Tier-1 review, Tier-2 review, and GitCheckpoint.
- [ ] Task 4: Integrate the centralized review verdict parser and ensure smoke testing validates it.
  - [ ] Verify that Tier-1 and Tier-2 nodes cleanly leverage `parseReviewVerdict` (Story 0.12) to handle outcomes.
- [ ] Task 5: Set up audit logging for the end-to-end execution.
  - [ ] Ensure `AuditLogger` records all state transitions and outputs (including the smoke-test calls) as JSONL.
- [ ] Task 6: Write end-to-end integration tests in `ai-dev-orchestrator/src/core/graph.test.ts`.
  - [ ] Run the graph against a local, small, real scratch BMad repo fixture.
  - [ ] Confirm a successful single-story run creates a real commit, updates the story file, and flips `sprint-status.yaml` to `done` end-to-end with no mocks.

## Dev Notes

- **Architecture and Technical Constraints**:
  - Resides under `core/` and uses `@langchain/langgraph` for flow orchestration.
  - Strictly adheres to the dependency-injection pattern (Story 0.11) with `NodeContext` passed to every factory.
  - All external execution (installation, git operations) must go through `ExecPort`, and all LLM interactions through `LLMPort`.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/graph.ts` (NEW)
  - `ai-dev-orchestrator/src/core/graph.test.ts` (NEW)
  - `ai-dev-orchestrator/src/bootstrap.ts` (UPDATE to add smoke-test/installation logic)
- **References to Source Artifacts**:
  - `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md#Story 1.9`
  - `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
  - `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-1-readiness.md`
- **Package boundaries**: Standalone Node CLI application `ai-dev-orchestrator/`. No frontend/UI/DB dependencies.
- **Data Type Compatibility & Migration Requirements**: No changes required.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-1-readiness.md`. Verdict: No gaps found. Cross-cutting shared review-verdict parser was split to Story 0.12 and is integrated. Pre-flight model-alias smoke testing and setup-validation run at process bootstrap.
  - **Gate 2 (UI Complexity & Reusability)**: CLI-only orchestrator has no UI components. No gaps.

## Global Rules References

- _bmad-output/planning-artifacts/story-content-structure.md
- _bmad-output/planning-artifacts/story-split-gate.md
- _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
- _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - `ai-dev-orchestrator/src/core/graph.ts` (NEW)
  - `ai-dev-orchestrator/src/core/graph.test.ts` (NEW)
  - `ai-dev-orchestrator/src/bootstrap.ts` (UPDATE to add smoke testing and pre-flight installation)
- **Rule Mapping**:
  - Configures model aliases via environment-resolved variables (using `ORCH_MODEL_PLANNER`/`_COMPLEX`/`_SPEED`/`_TESTER` maps).
  - Uses `@langchain/langgraph` to explicitly model the single-story development state machine.
- **Verification Plan**: Execute end-to-end integration tests with Vitest using a local scratch repository fixture to verify a successful run outputs a correct git commit and audit log.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: End-to-end single-story execution via LangGraph with pre-flight smoke tests and auto-install.
- [ ] Architecture and boundary confirmation: Ensuring Hexagonal Port compliance with zero direct `fs` or `child_process` calls in the graph nodes.
- [ ] Testing plan confirmation: Integration test suite utilizing a small scratch git repository.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Sourced from Epic 1 readiness sweep)

## Testing Requirements

- [ ] Integration tests: End-to-end graph flow execution using a test-fixture repository with a real/mocked git and LLM provider to ensure correct transitions, logging, and outcomes.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/graph.ts`
- [ ] `ai-dev-orchestrator/src/core/graph.test.ts`

## Out of Scope

- Epic orchestration or running multiple stories sequentially.
- Resumability or SQLite checkpointing (deferred to Epic 3).
- Direct user-interaction prompts or readline loop (deferred to Epic 2).

## Definition of Done

- [ ] AC satisfaction (AC1-AC6)
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched files

## Completion Status

- ready-for-dev

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

### Completion Notes List

- Initialized by: specialized bmad-create-story developer subagent
- Date: 2026-08-21
- Notes: Completed story decomposition for Story 1.9 complying fully with the ai-dev-orchestrator spec and architecture spine.

### File List

- `_bmad-output/implementation-artifacts/ai-dev-orchestrator/1-9-wire-the-single-story-pipeline-end-to-end.md`
