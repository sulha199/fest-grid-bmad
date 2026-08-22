---
baseline_commit: 38186acfef0d4ed2bfa208443a925d1d5db48b6e
---
# Story 1.3: Speed Worker implements a story's task checklist

## Story Details

- Epic: 1
- Story ID: 1.3
- Status: ready-for-dev

## Story

As a developer running the orchestrator,
I want the Speed Worker node to implement a story's standard/boilerplate tasks from its real story file,
So that simple stories can be built without invoking the heavier Complex Worker.

## Acceptance Criteria

1. **Given** a materialized story file with an unchecked task list, tagged 'standard' (e.g. tag: 'standard' or similar in parsed Story model representation), [epics.md AC1]
2. **When** the Speed Worker node runs, [epics.md AC2]
3. **Then** it parses the story file to retrieve acceptance criteria and the unchecked task list, [epics.md AC3]
4. **And** it calls 'LLMPort.complete({ role: "speed", ... })' to prompt the speed model to generate code implementations for the unchecked tasks, [epics.md AC3]
5. **And** it applies the resulting code changes via 'ExecPort.writeIfUnchanged()' or standard file updates, [epics.md AC3]
6. **And** it checks off completed tasks in the story file and writes the serialized story file back via 'ExecPort.writeIfUnchanged()', [epics.md AC3]
7. **And** it never calls 'LLMPort' with 'role: "complex"', [epics.md AC4]
8. **And** a Vitest unit test using the Epic 0 fakes (such as 'FakeLLMPort', 'FakeExecPort') drives the node from a sample story file to checked-off tasks with predictable fake LLM output. [epics.md AC5]

## Tasks / Subtasks

- [ ] Task 1: Create directory 'ai-dev-orchestrator/src/core/nodes/' if it does not exist. (AC: 8)
- [ ] Task 2: Implement 'createSpeedWorkerNode' node factory inside 'ai-dev-orchestrator/src/core/nodes/speed-worker.ts' conforming to the 'NodeFactory' pattern. (AC: 2)
- [ ] Task 3: Load the target story file using 'ExecPort.readFile' and parse it using 'parseStoryFile' from Story 1.1. (AC: 1, 3)
- [ ] Task 4: Construct the system and user prompts for the 'speed' role LLM containing story content, ACs, and unchecked tasks. (AC: 4)
- [ ] Task 5: Call 'LLMPort.complete({ role: "speed", ... })' and never invoke 'complex'. (AC: 4, 7)
- [ ] Task 6: Parse the LLM's suggested code modifications and apply them to target files in the workspace via 'ExecPort.writeIfUnchanged()'. (AC: 5)
- [ ] Task 7: Update the checked-off tasks in the story file using 'checkOffTask()' and write back the updated story markdown string via 'ExecPort.writeIfUnchanged()'. (AC: 6)
- [ ] Task 8: Write unit and integration tests inside 'ai-dev-orchestrator/src/core/nodes/speed-worker.test.ts' utilizing Vitest and Fake adapters to verify full checklist resolution. (AC: 8)
- [ ] Task 9: Verify that TypeScript compilation and all unit tests pass cleanly. (AC: 8)

## Dev Notes

- **Architecture and Technical Constraints**:
  - Resides inside the 'nodes/' package space of 'ai-dev-orchestrator' core.
  - Follows Ports & Adapters core separation (AD-1) and utilizes 'NodeContext' pattern (Story 0.11) to resolve all ports, path configurations, and logger instances.
  - Must use only the 'speed' role for LLM completions via 'LLMPort' (never 'complex' per AC).
  - Must write all target workspace file modifications and updated story checklist files using 'ExecPort.writeIfUnchanged' to avoid concurrency clobbering.
- **File/Path Expectations**:
  - 'ai-dev-orchestrator/src/core/nodes/speed-worker.ts'
  - 'ai-dev-orchestrator/src/core/nodes/speed-worker.test.ts'
- **Data/API Boundary Constraints**:
  - Standard/boilerplate story identification relies on checking the 'tag: "standard"' attribute of parsed 'Story' structures from the story-file parser/serializer (Story 1.1).
  - State Graph integration/routing is handled sequentially; this node operates on single standard stories queued in GraphState.
- **References to Source Artifacts**:
  - '_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md'
  - '_bmad-output/specs/spec-ai-dev-orchestrator/state-machines.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-1'
- **Package boundaries**: standalone initiative targets 'ai-dev-orchestrator/'. No frontend/React, database migrations, or GraphQL schemas apply. Remains 100% pure Node.js CLI project.
- **Data Type Compatibility & Migration Requirements**: No changes required. No database migrations or DDL schema adjustments are involved.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from 'epic-1-readiness.md' ('swept: true' report). Findings: No architectural gaps or cross-cutting dependency gaps found for Story 1.3.
  - **Gate 2 (UI Complexity & Reusability)**: Pure backend/CLI node process. Zero UI components or hooks are involved. Verdict: No gap found.

## Global Rules References

- _bmad-output/planning-artifacts/story-content-structure.md
- _bmad-output/planning-artifacts/story-split-gate.md
- _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
- _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - 'ai-dev-orchestrator/src/core/nodes/speed-worker.ts' (NEW)
  - 'ai-dev-orchestrator/src/core/nodes/speed-worker.test.ts' (NEW)
- **Rule Mapping**:
  - Core Closure Mapping: Nodes close over 'NodeContext' for dependencies (AD-1).
  - Tracked Writing Protocol: Writes to workspace target files and story checkpoints must exclusively route through 'ExecPort.writeIfUnchanged()' (AD-1, AD-4).
- **Verification Plan**:
  - Run the test suite: 'pnpm test' (with Vitest) to check and confirm fake adapter integration executes successfully.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Speed Worker node for autonomous standard story resolution.
- [ ] Architecture and boundary confirmation: Ensuring Hexagonal Port compliance with zero direct 'fs' calls or side effects inside node logic.
- [ ] Testing plan confirmation: Mocking and checking state transitions using Fake LLM and Exec adapters with predictable task-checking outputs.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Sourced from Epic 1 readiness sweep)

## Testing Requirements

- [ ] Unit tests: Write standard tests verifying parsing story, running speed completion, writing modifications, and updating story markdown checking off tasks.

## Deliverables Checklist

- [ ] 'ai-dev-orchestrator/src/core/nodes/speed-worker.ts'
- [ ] 'ai-dev-orchestrator/src/core/nodes/speed-worker.test.ts'

## Out of Scope

- Implementing the 'complex' worker node (Story 1.4).
- Integrating the full LangGraph composition flow (Story 1.9).
- Modifying PRD or architecture spine assets directly.

## Definition of Done

- [ ] AC satisfaction (AC1-AC8)
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched files

## Completion Status

- ready-for-dev

## Dev Agent Record

- Initialized by: specialized bmad-create-story developer agent
  - Date: 2026-08-21
  - Notes: Completed story decomposition for Story 1.3 complying fully with the ai-dev-orchestrator spec and architecture spine.
