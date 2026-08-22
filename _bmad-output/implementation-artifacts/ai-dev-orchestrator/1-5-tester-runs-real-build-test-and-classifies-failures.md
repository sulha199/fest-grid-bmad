---
baseline_commit: 81eb51e51d59d4257f099f6286f5cf5a1d6fa1e5
---
# Story 1.5: Tester runs real build/test and classifies failures

## Story Details

- Epic: 1
- Story ID: 1.5
- Status: ready-for-dev

## Story

As a developer running the orchestrator,
I want the Tester node to run the target project's actual build/test commands and classify the results,
So that a failure is understood, not just dumped as raw logs.

## Acceptance Criteria

1. **Given** TARGET_REPO_PATH has a real package.json with build/test scripts and dependencies already installed (fresh-clone dependency install is a pre-flight concern, see Story 1.9 — Tester assumes a ready-to-run repo, it doesn't install anything itself), [epics.md AC1]
2. **When** the Tester node runs after an implementation step, [epics.md AC2]
3. **Then** it invokes those scripts via ExecPort.run, [epics.md AC3]
4. **And** given the run fails, it calls LLMPort.complete({ role: "tester", ... }) with the raw output to classify it into a structured report (pass, or fail with the specific failing test/lint rule identified — never a raw log dump handed upstream), [epics.md AC3]
5. **And** given the failure is a trivial lint issue, it auto-fixes it (e.g. via the project's own lint --fix script or command) and re-runs without escalation and without needing the LLM call for that mechanical case, [epics.md AC4]
6. **And** a Vitest unit test runs against a small real fixture project with one intentionally failing test, using the fake LLM adapter (Story 0.8) for the classification call, asserting the resulting structured report. [epics.md AC5]

## Tasks / Subtasks

- [ ] Task 1: Create directory ai-dev-orchestrator/src/core/nodes/ if it does not exist. (AC: 6)
- [ ] Task 2: Implement the createTesterNode node factory inside ai-dev-orchestrator/src/core/nodes/tester.ts conforming to the NodeFactory pattern, closing over NodeContext. (AC: 2)
- [ ] Task 3: Invoke the target repository's build/test scripts (such as pnpm build and pnpm test) via ExecPort.run. (AC: 1, 3)
- [ ] Task 4: Parse execution results. If build or test fails, detect if the failure is a trivial lint issue that can be auto-fixed. (AC: 4, 5)
- [ ] Task 5: If it is a trivial lint/formatting issue, trigger the auto-fix command (such as pnpm lint --fix or equivalent) via ExecPort.run and re-run build/test commands before deciding to escalate or prompt the LLM. (AC: 5)
- [ ] Task 6: For non-trivial or non-lint failures, construct system and user prompts for the tester role LLM containing command output (stdout/stderr). (AC: 4)
- [ ] Task 7: Call LLMPort.complete({ role: "tester", ... }) to prompt the LLM to classify the failure into a structured report. (AC: 4)
- [ ] Task 8: Return a structured report indicating either a pass or a fail with specific identified failing tests or lint rules. (AC: 4)
- [ ] Task 9: Create unit tests inside ai-dev-orchestrator/src/core/nodes/tester.test.ts utilizing Vitest. Set up a real small fixture project with an intentionally failing test to assert the classification output, using the fake LLM adapter. (AC: 6)
- [ ] Task 10: Verify that TypeScript compilation and all unit tests pass cleanly. (AC: 6)

## Dev Notes

- **Architecture and Technical Constraints**:
  - Resides inside the nodes/ core namespace of ai-dev-orchestrator.
  - Adheres to Ports & Adapters separation (AD-1) and utilizes the NodeContext pattern (Story 0.11) to access ports (llm, exec), paths, config, and audit logger.
  - Must use only the tester role for LLM completions via LLMPort (never complex or speed per AC/spec).
  - Executes external CLI commands only via ExecPort.run({ cmd, args, cwd }).
- **File/Path Expectations**:
  - ai-dev-orchestrator/src/core/nodes/tester.ts
  - ai-dev-orchestrator/src/core/nodes/tester.test.ts
- **Data/API Boundary Constraints**:
  - The tester LLM role maps to the model alias configured under ORCH_MODEL_TESTER (such as Gemini 3.5 Flash per stack.md model aliases).
  - Returns a structured report format of the failure, identifying specific rules or failing files.
- **References to Source Artifacts**:
  - _bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md
  - _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
  - _bmad-output/specs/spec-ai-dev-orchestrator/stack.md
  - _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-1
- **Package boundaries**: Standalone CLI application ai-dev-orchestrator/. No web, database, or UI elements apply.
- **Data Type Compatibility & Migration Requirements**: No changes required.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from epic-1-readiness.md. Verdict: No gaps found.
  - **Gate 2 (UI Complexity & Reusability)**: Backend node process with zero UI. No gaps.

## Global Rules References

- _bmad-output/planning-artifacts/story-content-structure.md
- _bmad-output/planning-artifacts/story-split-gate.md
- _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
- _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - ai-dev-orchestrator/src/core/nodes/tester.ts (NEW)
  - ai-dev-orchestrator/src/core/nodes/tester.test.ts (NEW)
- **Rule Mapping**:
  - Core Closure Mapping: Nodes close over NodeContext for dependencies (AD-1).
  - Process Boundaries: Build and test execution delegates entirely to ExecPort.run (AD-1).
- **Verification Plan**: Run pnpm test with Vitest to verify both workers and parsing utilities behave as expected.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Tester node for autonomous build/test verification and failure classification.
- [ ] Architecture and boundary confirmation: Ensuring Hexagonal Port compliance with zero direct fs or child_process calls.
- [ ] Testing plan confirmation: Mocking and checking state transitions using Fake LLM and Exec adapters with predictable failure-classification outputs.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Sourced from Epic 1 readiness sweep)

## Testing Requirements

- [ ] Unit tests: Write standard tests verifying build/test script execution, auto-fix of linting errors, classification of non-trivial failures using the tester role, and structured report assertions.

## Deliverables Checklist

- [ ] ai-dev-orchestrator/src/core/nodes/tester.ts
- [ ] ai-dev-orchestrator/src/core/nodes/tester.test.ts

## Out of Scope

- Installing project dependencies (e.g. running pnpm install or npm install — this is a pre-flight concern of the single-story runner/pipeline, not this node's responsibility).
- Implementing the retry loop context or review-gating nodes (Story 1.6 / 1.7).

## Definition of Done

- [ ] AC satisfaction (AC1-AC6)
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched files

## Completion Status

- ready-for-dev

## Dev Agent Record

- Initialized by: specialized bmad-create-story developer agent
  - Date: 2026-08-21
  - Notes: Completed story decomposition for Story 1.5 complying fully with the ai-dev-orchestrator spec and architecture spine.