---
baseline_commit: b97bb7b09a41994c811744ab52043aa0bebc4cd7
---
# Story 1.6: AUTO_FIX retry loop with shared, ceiling-enforced attempts

## Story Details

- Epic: 1
- Story ID: 1.6
- Status: ready-for-dev

## Story

As a developer running the orchestrator,
I want an \`AUTO_FIX\` verdict to trigger the reviewing node applying its own patch and looping back through Tester, bounded by a shared attempt ceiling,
So that a stuck story can't loop forever.

## Acceptance Criteria

1. **Given** a Tier-1 review verdict of \`AUTO_FIX\`, [epics.md AC1]
2. **When** the Complex Worker node (or relevant reviewing node) applies its own patch in the same call (i.e. generating and writing the corrective changes via \`ExecPort.writeIfUnchanged()\`), [epics.md AC2]
3. **Then** the \`story.autoFixAttempts\` counter increments, [epics.md AC3]
4. **And** the \`autoFixAttempts\` increment is tier-agnostic and occurs regardless of the following Tester outcome (this is the single authoritative retry counting rule), [epics.md AC3]
5. **And** the graph transitions or loops back to the Tester node to verify the applied patch, [epics.md AC3]
6. **And** given \`autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS\` (loaded from env config, default \`1\`) when entering any review node (Tier-1 or Tier-2), the node short-circuits straight to \`NEEDS_HUMAN\` with a clear reason (e.g. \`"auto-fix attempt ceiling reached"\`) with no further LLM call or patch generation, [epics.md AC4]
7. **And** given a story reaches \`NEEDS_HUMAN\` in Epic 1's scope (where no interactive HITL node exists yet), the orchestrator process exits cleanly with a non-zero exit code and prints a clear message identifying the story key and the failure reason, [epics.md AC5]
8. **And** a Vitest unit/integration test drives a simulated story through one failed AUTO_FIX round to confirm that reaching the attempt ceiling correctly halts and exits the process rather than initiating a second loop. [epics.md AC6]

## Tasks / Subtasks

- [ ] Task 1: Update the shared \`Story\` or \`GraphState\` types if necessary to ensure \`autoFixAttempts: number\` is tracked in the run state (it should be SQLite-only or ephemeral run state, not serialized into the real-world BMad story file). (AC: 3)
- [ ] Task 2: Implement logic in the reviewing node (Complex Worker) to check if \`state.autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS\` before calling the LLM. If reached, immediately transition to \`NEEDS_HUMAN\`. (AC: 6)
- [ ] Task 3: When a review node issues an \`AUTO_FIX\` verdict, ensure it generates and writes the corrective code changes via \`ExecPort\`, increments \`story.autoFixAttempts\`, and transitions state to the Tester node. (AC: 2, 3, 4, 5)
- [ ] Task 4: Ensure the retry increment occurs immediately when the patch is generated, independent of whether the subsequent test runs or passes/fails (tier-agnostic counter). (AC: 4)
- [ ] Task 5: Implement Epic 1's temporary exit handler: if the state machine transitions to a \`NEEDS_HUMAN\` verdict or terminal failure, output a descriptive error message naming the story and exit the process with a non-zero status code (e.g., \`process.exit(1)\`). (AC: 7)
- [ ] Task 6: Create or extend unit and integration tests inside \`ai-dev-orchestrator/src/core/nodes/\` (e.g., \`ai-dev-orchestrator/src/core/nodes/auto-fix.test.ts\` or similar test file) using Vitest. (AC: 8)
- [ ] Task 7: Write a test verifying that when \`MAX_AUTO_FIX_ATTEMPTS\` is set to \`1\` (or any configured ceiling), the machine correctly makes exactly that many attempts, increments the counter, and exits on the next failure when the ceiling is reached. (AC: 8)
- [ ] Task 8: Verify that TypeScript compilation and all unit tests pass cleanly. (AC: 8)

## Dev Notes

- **Architecture and Technical Constraints**:
  - Adheres to the hexagonal architecture spine (Ports & Adapters, AD-1) and utilizes the \`NodeContext\` pattern (Story 0.11) to access ports (\`llm\`, \`exec\`), paths, config, and audit logger.
  - The retry counter \`autoFixAttempts\` is kept in ephemeral state or SQLite run-state, not written to the real-world BMad story files (AD-5).
  - Config loading of \`MAX_AUTO_FIX_ATTEMPTS\` must support a default of \`1\` (or a user-defined positive value) and handle \`0\` as "never AUTO_FIX, escalate immediately" per Story 0.4.
- **File/Path Expectations**:
  - \`ai-dev-orchestrator/src/core/nodes/...\`
- **References to Source Artifacts**:
  - \`_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md\`
  - \`_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-1-readiness.md\`
  - \`_bmad-output/specs/spec-ai-dev-orchestrator/state-machines.md\`
  - \`_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-3\` (Shared attempt ceiling)
  - \`_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-5\` (Ephemeral SQLite state)
- **Package boundaries**: Standalone CLI application \`ai-dev-orchestrator/\`. No web, database, or UI elements apply.
- **Data Type Compatibility & Migration Requirements**: No changes required.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from \`epic-1-readiness.md\`. Verdict: No gaps found.
  - **Gate 2 (UI Complexity & Reusability)**: Backend node process with zero UI. No gaps.

## Global Rules References

- _bmad-output/planning-artifacts/story-content-structure.md
- _bmad-output/planning-artifacts/story-split-gate.md
- _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
- _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - Update or create node implementation files within \`ai-dev-orchestrator/src/core/nodes/\` to track loop state and ceiling enforcement.
  - Add associated tests.
- **Rule Mapping**:
  - Core Closure Mapping: Nodes close over \`NodeContext\` for dependencies (AD-1).
  - Attempt Budget: Track \`autoFixAttempts\` inside \`GraphState\` and respect the configured ceiling.
- **Verification Plan**: Run \`pnpm test\` with Vitest to verify both state loop transitions and retry-counter short-circuits.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Auto-fix loop with a shared, ceiling-enforced attempts budget.
- [ ] Architecture and boundary confirmation: Verification of tier-agnostic counter increment and short-circuit to exit on ceiling breach.
- [ ] Testing plan confirmation: Integration/unit test driving simulated runs with configured attempt ceilings.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Sourced from Epic 1 readiness sweep)

## Testing Requirements

- [ ] Unit tests: Validate that \`story.autoFixAttempts\` starts at 0, increments tier-agnostically on patch generation, transitions to Tester, and triggers exit when \`autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS\`.

## Deliverables Checklist

- [ ] \`ai-dev-orchestrator/src/core/nodes/...\` (Loop and retry logic)
- [ ] Associated unit/integration tests with simulated review loop.

## Out of Scope

- Epic 2's interactive readline and email-escalating HITL node (deferred to Epic 2).
- Tier-2 deep review nodes (deferred to Story 1.7).

## Definition of Done

- [ ] AC satisfaction (AC1-AC8)
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched files

## Completion Status

- ready-for-dev

## Dev Agent Record

- Initialized by: specialized bmad-create-story developer agent
  - Date: 2026-08-21
  - Notes: Completed story decomposition for Story 1.6 complying fully with the ai-dev-orchestrator spec and architecture spine.
