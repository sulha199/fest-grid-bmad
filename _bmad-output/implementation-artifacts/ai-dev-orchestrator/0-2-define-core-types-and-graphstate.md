# Story 0.2: Define core types and GraphState

## Story Details

- Epic: 0
- Story ID: 0.2
- Status: ready-for-dev

## Story

As a developer building any orchestrator node,
I want `Epic`, `Story`, `ReviewVerdict`, and `GraphState` defined once in `core/types.ts`/`core/state.ts`,
So that every node references the same shapes instead of inventing its own.

## Acceptance Criteria

1. **Given** `core/types.ts`, **when** it's implemented, **then** `ReviewVerdict` is exactly `'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN'`. [epics.md AC1]
2. **And** `Story` includes `autoFixAttempts: number` (SQLite-only, no real-file counterpart) alongside the fields parsed from real BMad artifacts (e.g. key, title, status, tasks, devNotes). [epics.md AC1]
3. **And** `core/state.ts` defines `GraphState` with exactly the six fixed fields (`spec`, `tasks_queue`, `current_code`, `terminal_output`, `error_status`, `human_feedback`) per SPEC.md's Constraints. [epics.md AC2]
4. **And** a Vitest type-level test confirms `GraphState` has no extra or missing top-level keys. [epics.md AC3]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/core/types.ts` defining `Epic`, `Story` (with `autoFixAttempts`), and `ReviewVerdict` enums/types. (AC: 1, 2)
- [ ] Task 2: Create `ai-dev-orchestrator/src/core/state.ts` defining `GraphState` with exactly the six required fields. (AC: 3)
- [ ] Task 3: Create a type-level unit test file `ai-dev-orchestrator/src/core/state.test.ts` or `ai-dev-orchestrator/src/core/types.test.ts` utilizing Vitest to assert type safety and key invariants. (AC: 4)
- [ ] Task 4: Run type checks (`pnpm build` or `tsc`) and test suites (`pnpm test`) to verify type definitions and compilation. (AC: 4)

## Dev Notes

- **Architecture and Technical Constraints**: Standalone Node.js project under `ai-dev-orchestrator/`. LangGraph state is strictly defined in-memory. State management in this CLI tool uses standard TypeScript object shapes passed via LangGraph, completely independent of apps/web UI state management tools like zustand, nuqs, or react-query.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/types.ts`
  - `ai-dev-orchestrator/src/core/state.ts`
  - `ai-dev-orchestrator/src/core/state.test.ts`
- **Data/API Boundary Constraints**: `GraphState` fields are fixed and immutable. Any state passing between nodes must adhere strictly to these six fields.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md`, `_bmad-output/specs/spec-ai-dev-orchestrator/state-machines.md`.
- **Architecture & UX Gate Findings**: Cites findings from `epic-0-readiness.md` (`swept: true`). Gate 1 and Gate 3 findings are already covered in the readiness sweep. Gate 2 (UI) is not applicable because it's a CLI tool. Verdict: No UI gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/implementation-readiness-report-2026-08-21.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/core/types.ts` (NEW)
- `ai-dev-orchestrator/src/core/state.ts` (NEW)
- `ai-dev-orchestrator/src/core/state.test.ts` (NEW)

### Rule Mapping
- LangGraph compatibility: Strict definition of `GraphState` keys prevents runtime state errors.
- Monorepo package boundaries: Kept entirely isolated within the CLI tool, not leaking any dependencies to web components or backend Lambda environments.

### Verification Plan
- Use `vitest` to run type checks and execute the `state.test.ts` test verifying that exactly the six fields exist in `GraphState`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Defining pure data types and the LangGraph state interface.
- [ ] Architecture and boundary confirmation: Verification of zero React or Web SDK leakage.
- [ ] Testing plan confirmation: Type assertions inside Vitest.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Write a Vitest type-level test (or test asserting object properties) to ensure `GraphState` possesses exactly the six required fields.
- Run `pnpm test` to verify.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/types.ts`
- [ ] `ai-dev-orchestrator/src/core/state.ts`
- [ ] `ai-dev-orchestrator/src/core/state.test.ts`

## Out of Scope

- Implementing the state machine runtime or LangGraph graph compile code.
- Implementing any node logic or ports/adapters.

## Definition of Done

- Type files compile without errors.
- Vitest unit tests pass.
- No ESLint warnings or errors in the newly created files.

## Completion Status

- ready-for-dev

## Dev Agent Record

- (blank)