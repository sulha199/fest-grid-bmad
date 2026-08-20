# Story 0.9: Resolve and validate the target BMad project

## Story Details

- Epic: 0
- Story ID: 0.9
- Status: ready-for-dev

## Story

As a developer pointing the orchestrator at a target repo,
I want it to validate that `TARGET_REPO_PATH` is a real BMad-managed project and resolve its real artifact paths, before anything else runs,
So that every later story can rely on `planning_artifacts`/`implementation_artifacts`/the PRD-architecture reference being correctly known, and a wrong path fails immediately with a clear reason.

## Acceptance Criteria

1. **Given** `TARGET_REPO_PATH` does not contain a `_bmad/` or `_bmad-output/` directory, **when** the orchestrator starts, **then** it refuses to start (hard error) naming exactly what's missing — before any graph or adapter is touched. [epics.md AC1]
2. **And** given `TARGET_REPO_PATH` is BMad-managed, **when** the orchestrator starts, **then** this step reads `_bmad/bmm/config.yaml` (not `_bmad/core/config.yaml`) and resolves `planning_artifacts`/`implementation_artifacts` to absolute paths under `TARGET_REPO_PATH`. [epics.md AC2]
3. **And** it locates the PRD/architecture reference via `_bmad-output/project-context.md`'s "Reference Documents" section, falling back to scanning `planning_artifacts` for `*architecture-spine.md` or `specs/*/SPEC.md` if that section is absent. [epics.md AC3]
4. **And** this is raw `node:fs` usage at bootstrap time, not through `ExecPort` — the graph doesn't exist yet, matching how the dirty-tree gate (Story 1.8) also runs outside any graph node. [epics.md AC4]
5. **And** a Vitest test runs this against this repo's own real `_bmad/bmm/config.yaml` and `project-context.md`, asserting the resolved paths match what's actually on disk, and a second test asserts a non-BMad directory is rejected with a clear message. [epics.md AC5]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.ts` containing the validation and resolution functions. (AC: 1, 2, 3, 4)
- [ ] Task 2: Implement validation that checks for the existence of `_bmad/` and `_bmad-output/` under the target repository path using `node:fs`. (AC: 1)
- [ ] Task 3: Implement parsing of `_bmad/bmm/config.yaml` using the `yaml` library to retrieve and resolve `planning_artifacts` and `implementation_artifacts` as absolute paths. (AC: 2)
- [ ] Task 4: Implement locating the PRD/architecture reference by parsing `_bmad-output/project-context.md`'s "Reference Documents" section (using regex or lines) and falling back to a directory scan of `planning_artifacts` for `*architecture-spine.md` or `specs/*/SPEC.md` if the section is not found. (AC: 3)
- [ ] Task 5: Write unit tests in `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.test.ts` using Vitest to assert successful validation/resolution against the current workspace, and failure cases when pointing to an invalid non-BMad path. (AC: 5)
- [ ] Task 6: Verify lint, build, formatting, and type-checks for the newly created files. (AC: 5)

## Dev Notes

- **Architecture and Technical Constraints**: Pure Node.js/TypeScript code using `node:fs` and `node:path`. Since this code runs at bootstrap time before any ports or state graph are constructed, it is executed directly outside of any `ExecPort` adapter, ensuring decoupling from the runtime execution graph.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.ts`
  - `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.test.ts`
- **Data/API Boundary Constraints**: Handled errors must map to standard errors or custom `OrchestratorError` with `recoverable: false` indicating fail-fast initialization failure.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`.
- **Package Boundaries**: Strictly isolated core package code under `ai-dev-orchestrator`. No React or frontend dependencies are allowed.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-0-readiness.md` (`swept: true`, which covers Epic 0's planned stories including 0.9). Findings: No gaps found. Story 0.9 correctly uses raw `node:fs` at bootstrap, which is structurally correct since no graph exists yet.
  - **Gate 2 (UI Complexity & Reusability)**: This story has **zero UI surface** (pure CLI/backend validation logic). Verdict: No gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/implementation-readiness-report-2026-08-21.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.ts` (NEW)
- `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.test.ts` (NEW)

### Rule Mapping
- Bootstrap Validation: Runs at process startup to ensure path-validity fast-failure (fail-fast rule) before constructing any LLM/Exec port instances.
- Core Parsing: Uses pure TypeScript/Node.js files functions, avoiding importing any DB/ORM or React dependencies (complying with core/adapters boundary rule).

### Verification Plan
- Verify compilation: `pnpm build` (tsc)
- Run unit/integration tests: `pnpm test` (Vitest)

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Implementing target BMad project validation and config-based path resolution.
- [ ] Architecture and boundary confirmation: Verification runs outside ExecPort at bootstrap time, parsing yaml and markdown using lightweight regex/libs.
- [ ] Testing plan confirmation: Test suite verifying both success paths against the current repo and fail-fast failure paths against fake directories.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Write a Vitest test suite in `project-resolver.test.ts` covering:
  - Validation of a valid target project (the active repo itself) resolving planning, implementation, and config paths correctly.
  - Verification that an invalid target path (e.g., an empty directory) fails fast and throws.
  - Parsing and extraction of the PRD/architecture reference from `project-context.md`.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.ts`
- [ ] `ai-dev-orchestrator/src/core/bmad-artifacts/project-resolver.test.ts`

## Out of Scope

- Setting up state management or LLM adapters.
- Initializing the composition root (handled in Story 0.10).
- Building the `ExecPort` or `LLMPort` adapters.

## Definition of Done

- Satisfy all Acceptance Criteria (AC1-AC5).
- 100% unit test coverage for `project-resolver.ts` with passing Vitest tests.

## Completion Status

- Status: ready-for-dev

## Dev Agent Record

- Initialized by: specialized bmad-create-story developer subagent

