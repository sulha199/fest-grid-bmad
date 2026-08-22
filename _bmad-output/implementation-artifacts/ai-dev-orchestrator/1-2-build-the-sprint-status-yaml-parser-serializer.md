---
baseline_commit: 809eacea61be648e19b0676ab4deb662837a1aac
---
# Story 1.2: Build the sprint-status.yaml parser/serializer

## Story Details

- Epic: 1
- Story ID: 1.2
- Status: ready-for-dev

## Story

As a developer building any node that transitions a story's status,
I want a comment-preserving `parse-sprint-status.ts` module,
so that the orchestrator can read and write real status transitions without destroying this repo's real inline comments.

## Acceptance Criteria

1. **Given** a real `sprint-status.yaml` (e.g. this repo's own, with its inline comment above the `0-7` entry), **when** `parseSprintStatus()` reads it and `setStoryStatus()` writes a new status for one key, **then** the `yaml` package's Document API is used (not a parse-then-stringify round trip), and re-serializing preserves every existing comment and key order untouched except the one status value that changed. [epics.md AC1]
2. **And** given `setStoryStatus()` is called with a value outside BMad's real enum (`backlog`/`ready-for-dev`/`in-progress`/`review`/`done` for stories), it throws rather than writing an invented status. [epics.md AC2]
3. **And** callers write the serialized result back via `ExecPort.writeIfUnchanged()` (Story 0.7), never a bare write — a human hand-editing `sprint-status.yaml` mid-run is detected, not clobbered. [epics.md AC3]
4. **And** a Vitest test round-trips this repo's real `sprint-status.yaml` through parse → change one story's status → serialize, asserting the file's comments and every other entry are byte-identical. [epics.md AC4]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.ts` with `parseSprintStatus()`, and methods returned like `setStoryStatus(storyKey, status)` and `toString()`. (AC: 1, 2)
- [ ] Task 2: Implement the parsing and mutation using the `yaml` library's comment-preserving Document API (`import { parseDocument } from 'yaml'`) to ensure that modifying a single story status doesn't drop inline comments, keys, or re-order elements. (AC: 1)
- [ ] Task 3: Validate the story status value before saving. If it's not one of `'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done'`, throw an `OrchestratorError` or standard Error. (AC: 2)
- [ ] Task 4: Ensure the module has no I/O of its own (operates on strings representing the YAML content). (AC: 3)
- [ ] Task 5: Create a Vitest unit test suite under `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.test.ts`. (AC: 4)
- [ ] Task 6: Write unit tests verifying round-trip parsing, modification, serialization, comment-preservation, and error-handling for invalid status values. (AC: 4)
- [ ] Task 7: Run tests and lint checks (`pnpm test` and `pnpm lint`) to verify correct execution and high quality. (AC: 4)

## Dev Notes

- **Architecture and Technical Constraints**: Standalone Node.js project under `ai-dev-orchestrator/`. Follows Ports & Adapters core separation (AD-1) and canonical state guidelines (AD-5). The module is pure and has no direct file I/O; callers read the files via `ExecPort.readFile` and write back using `ExecPort.writeIfUnchanged`.
- **Library Constraint**: Must use the `yaml` package's comment-preserving Document API (e.g., `parseDocument` / `Document.get()` / `Document.set()`). Standard parsing libraries like `js-yaml` do not preserve comments and are rejected.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.ts`
  - `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.test.ts`
- **Data/API Boundary Constraints**: Values written to `sprint-status.yaml` must strictly conform to the BMad enum: `'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done'`.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-5`.

### Architecture & UX Gate Findings

- Sourced from Epic 1 Readiness Sweep (`_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-1-readiness.md`).
- Gate 1: No gap found.
- Gate 2: Not applicable (Orchestrator has no GUI).
- Gate 3: No gap found for this story.
- Verdict: No gaps found.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: BMad status enum mapping in `sprint-status.yaml`.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: None for database; type declarations for `StoryStatus` must match `'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done'`.
- Backward compatibility and rollout notes: Enforces standard comment-preserving YAML format for compatibility with external human editing.
- Verification checks: Vitest tests asserting byte-identical preservation of unchanged fields and comments.

### Project Structure Notes

- The parser/serializer lives under `ai-dev-orchestrator/src/core/bmad-artifacts/` alongside other parser/serializer modules (e.g., `parse-story-file.ts`, `parse-epics.ts`).

### References

- `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-5`
- `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] epics.md

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.ts` (NEW)
  - `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.test.ts` (NEW)
- **Rule Mapping**:
  - Comment-preserving YAML Document API ensures AD-5 and user-override support.
  - Non-destructive updates prevent clobbering manual developer notes and annotations in the status file.
- **Verification Plan**:
  - Create a test fixture reflecting actual `sprint-status.yaml`.
  - Validate that parsing, editing, and stringifying does not drop comments or reorder fields.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Comment-preserving sprint-status YAML parser/serializer.
- [ ] Architecture and boundary confirmation: Zero raw file I/O inside the core utility.
- [ ] Testing plan confirmation: Ensure inline comments are fully preserved after round-trip.
- [ ] Explicit human approval state: Pending approval
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Confirmed swept and complete.

## Testing Requirements

- [ ] Unit tests verifying comments are kept in place.
- [ ] Unit tests ensuring invalid status values throw error.
- [ ] Round-trip verification on a mock YAML content string.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.ts`
- [ ] `ai-dev-orchestrator/src/core/bmad-artifacts/parse-sprint-status.test.ts`

## Out of Scope

- Reading/writing file system directly (responsibility of the adapters/ports).

## Definition of Done

- [ ] AC satisfaction
- [ ] Required tests passing
- [ ] Lint and type checks passing
- [ ] Code formatted correctly

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

### Completion Notes List

### File List
