# Story 1.8: Git Checkpoint commits a completed story

## Story Details

- Epic: 1
- Story ID: 1.8
- Status: ready-for-dev

## Story

As a developer trusting the orchestrator with a live repo,
I want it to refuse to start on a dirty working tree and commit exactly once per completed story,
So that its autonomous commits are safe and traceable.

## Acceptance Criteria

1. **Given** `TARGET_REPO_PATH` has any pre-existing uncommitted or untracked change
   **When** the orchestrator starts a run
   **Then** it refuses to start (hard error), naming the dirty paths, before touching anything.
2. **And** given both review tiers (Tier-1 and Tier-2) return `APPROVE` for a story
   **When** `GitCheckpoint` runs
   **Then** it calls `ExecPort.getWrittenPaths()` and issues `git add <those paths>` — never `git add -A` — then `git commit` (message references the story's dotted key from `epics.md`, e.g. `1.8`) via `ExecPort`, covering the code changes, the updated story file, and the `sprint-status.yaml` entry flipped to `done`, and never `git push`.
3. **And** staging only the tracked paths (not the whole tree) means a human editing an unrelated file elsewhere in `TARGET_REPO_PATH` at any point during a long-running multi-story epic is never swept into the commit.
4. **And** after a successful commit, it calls `ExecPort.resetWrittenPaths()` so the next story starts tracking from empty.
5. **And** given `git commit` itself exits non-zero (e.g. due to a rejecting pre-commit hook or full disk), `GitCheckpoint` does not retry or guess at a resolution: it routes to `NEEDS_HUMAN` (preserving the staged-but-uncommitted state exactly as git left it for human inspection).
6. **And** a Vitest test against a real scratch git repo confirms exactly one commit is created containing only the tracked paths — asserting a file manually added to the repo outside the tracked set is NOT included — and a second test with a rejecting pre-commit hook confirms the `NEEDS_HUMAN` route instead of a silent failure or a retry loop.

## Tasks / Subtasks

- [ ] Task 1: Implement startup dirty-tree gate in `bootstrap.ts` (or process startup flow).
  - [ ] Invoke `git status --porcelain` on `TARGET_REPO_PATH` at startup.
  - [ ] If any output is produced (pre-existing uncommitted or untracked changes), throw a hard error detailing the dirty paths and refuse to start.
- [ ] Task 2: Create the `GitCheckpointNode` factory function in `src/core/nodes/git-checkpoint.ts` following the standard `NodeFactory` closure pattern.
  - [ ] Conform to the `NodeFactory` signature, closing over `NodeContext` to get access to `ExecPort` and paths.
- [ ] Task 3: Implement git add/commit pipeline in the `GitCheckpointNode` function.
  - [ ] Retrieve list of modified files via `ExecPort.getWrittenPaths()`.
  - [ ] Execute `git add <file1> <file2> ...` via `ExecPort.run` for only the tracked written paths. Ensure it never does `git add -A`.
  - [ ] Execute `git commit -m "feat: implement Story 1.8"` (using the correct dotted key e.g. `1.8` as reference) via `ExecPort.run`.
  - [ ] Verify that code changes, the updated story file, and `sprint-status.yaml` are successfully staged and committed.
- [ ] Task 4: Call `ExecPort.resetWrittenPaths()` immediately after a successful commit so the next story starts tracking with an empty set.
- [ ] Task 5: Handle git commit non-zero exit failures.
  - [ ] Catch failures where `git commit` fails (e.g. from pre-commit hooks or full disk).
  - [ ] Do not retry or attempt recovery; transition the story's state to `NEEDS_HUMAN` and leave the staged-but-uncommitted files as-is for the developer.
- [ ] Task 6: Write Vitest tests in `src/core/nodes/git-checkpoint.test.ts` using a temporary scratch git repository.
  - [ ] Test 1: Verify exactly one commit containing only the tracked written paths is created.
  - [ ] Test 2: Assert an untracked file added manually outside of `getWrittenPaths()` is NOT committed.
  - [ ] Test 3: Verify that a failing pre-commit hook correctly triggers routing to `NEEDS_HUMAN` and leaves the staging area intact.
- [ ] Task 7: Run TypeScript verification and test runner to ensure all tests pass.

## Dev Notes

- **Architecture and Technical Constraints**:
  - Part of `nodes/` core namespace of `ai-dev-orchestrator`.
  - Follows Ports & Adapters separation (AD-1) and utilizes the `NodeContext` pattern (Story 0.11) to access `exec` port and paths.
  - Operates sequentially in the LangGraph graph (Story 1.9).
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/nodes/git-checkpoint.ts`
  - `ai-dev-orchestrator/src/core/nodes/git-checkpoint.test.ts`
- **References to Source Artifacts**:
  - `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md#Story 1.8`
  - `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-4` (Git Checkpoint and dirty-tree validation)
  - `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-1-readiness.md`
- **Package boundaries**: Standalone Node CLI application `ai-dev-orchestrator/`. No dependencies on `@festgrid/` web, UI, or database packages apply.
- **Data Type Compatibility & Migration Requirements**: No changes required.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-1-readiness.md`. Verdict: No gaps found. Clean startup dirty-tree validation runs in `bootstrap.ts` outside the graph.
  - **Gate 2 (UI Complexity & Reusability)**: CLI application with zero UI. No gaps.

## Global Rules References

- _bmad-output/planning-artifacts/story-content-structure.md
- _bmad-output/planning-artifacts/story-split-gate.md
- _bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md
- _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - `ai-dev-orchestrator/src/core/nodes/git-checkpoint.ts` (NEW)
  - `ai-dev-orchestrator/src/core/nodes/git-checkpoint.test.ts` (NEW)
  - `ai-dev-orchestrator/src/bootstrap.ts` (UPDATE to add startup dirty-tree gate)
- **Rule Mapping**:
  - Dependency Injection: Nodes receive `NodeContext` containing ports and configuration (Story 0.11).
  - Git Staging: Stages only paths from `ExecPort.getWrittenPaths()` (AD-4).
- **Verification Plan**: Run `pnpm test` with Vitest to verify dirty-tree checks, scoped commits, and pre-commit hook failures behave as expected.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: GitCheckpoint commits completed story and checks dirty-tree at startup.
- [ ] Architecture and boundary confirmation: Ensuring Hexagonal Port compliance with zero direct `fs` or `child_process` calls in the graph nodes.
- [ ] Testing plan confirmation: Scratch git repo integration test suite.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Sourced from Epic 1 readiness sweep)

## Testing Requirements

- [ ] Integration tests: Write tests executing actual `git` commands against a temporary git repo to verify scoped staging and commit failure escalation.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/nodes/git-checkpoint.ts`
- [ ] `ai-dev-orchestrator/src/core/nodes/git-checkpoint.test.ts`

## Out of Scope

- Implementing full graph orchestration or other nodes.
- Real push (`git push`).

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
- Notes: Completed story decomposition for Story 1.8 complying fully with the ai-dev-orchestrator spec and architecture spine.

### File List

- `_bmad-output/implementation-artifacts/ai-dev-orchestrator/1-8-git-checkpoint-commits-a-completed-story.md`
