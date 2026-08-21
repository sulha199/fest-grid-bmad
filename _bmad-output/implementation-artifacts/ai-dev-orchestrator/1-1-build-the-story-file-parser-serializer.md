---
baseline_commit: 13e6e54946f1f37b2d1abf2cb77f2a629ec69c5d
---
# Story 1.1: Build the story-file parser/serializer

## Story Details

- Epic: 1
- Story ID: 1.1
- Status: ready-for-dev

## Story

As a developer building any node that touches a story file,
I want a pure `parse-story-file.ts` module that reads a real story file's acceptance criteria and task checklist, toggles task checkboxes, and appends a review-findings section,
So that every node reads and writes story files through one consistent, tested module instead of ad hoc string manipulation.

## Acceptance Criteria

1. **Given** a real story file matching this repo's actual format (frontmatter-free markdown with `**Acceptance Criteria:**` and `- [ ] Task N:` checklist lines), **when** `parseStoryFile()` reads it, **then** it returns the story's acceptance criteria list and task list (each with its checked/unchecked state) as structured data. [epics.md AC1]
2. **And** `checkOffTask()`/`appendReviewFinding()` write back only the targeted line(s), leaving the rest of the file byte-identical. [epics.md AC1]
3. **And** this module lives in `core/bmad-artifacts/`, has no I/O of its own (it operates on strings `ExecPort` already fetched/will write, per AD-1) — callers write the serialized result back via `ExecPort.writeIfUnchanged()` (Story 0.7), never a bare write, so a concurrent external edit to the story file is never silently lost. [epics.md AC2]
4. **And** a Vitest test round-trips a real story file from this repo through parse → check off one task → serialize, asserting only that one line changed. [epics.md AC3]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.ts` with pure functions: `parseStoryFile()`, `checkOffTask()`, and `appendReviewFinding()`. (AC: 1, 2, 3)
- [ ] Task 2: Ensure functions perform parsing/serialization using pure string/regex manipulation, completely free of any direct file I/O (no `node:fs` calls). (AC: 3)
- [ ] Task 3: Create a unit test file `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.test.ts` utilizing Vitest. (AC: 4)
- [ ] Task 4: Write tests that parse a story file, toggle a specific task checkmark, re-serialize, and assert that only the target line has been modified while keeping the rest byte-identical. (AC: 4)
- [ ] Task 5: Run tests and lint checks (`pnpm test` and `pnpm lint`) to verify correct execution and high quality. (AC: 4)

## Dev Notes

- **Architecture and Technical Constraints**: Standalone Node.js project under `ai-dev-orchestrator/`. Functions must be pure to adhere to Ports & Adapters core separation (AD-1). They do not call file system APIs; instead, they receive raw markdown strings and return structured data or modified strings.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.ts`
  - `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.test.ts`
- **Data/API Boundary Constraints**: Handled as raw strings. Callers of this module in the LangGraph workflow are responsible for fetching files via `ExecPort` and writing back serialized outputs using `writeIfUnchanged` (preventing concurrent write conflicts).
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/story-content-structure.md`.
- **Architecture & UX Gate Findings**: Cites findings from `epic-1-readiness.md` (`swept: true`). Gate 1 and Gate 3 are clean. Gate 2 (UI) is not applicable because the Orchestrator has no GUI. Verdict: No gaps found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Epic 1 Readiness Sweep: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-1-readiness.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.ts` (NEW)
- `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.test.ts` (NEW)

### Rule Mapping
- Ports & Adapters boundary: Core domain utilities are purely functional, decoupled from side effects.
- Clean Code & ESLint flat config compliance.

### Verification Plan
- Create a test fixture reflecting standard story structure.
- Assert exact line-preserving round-trips for checklist edits and review findings.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: String-based parser/serializer for BMad story files.
- [ ] Architecture and boundary confirmation: Zero React/web-related imports, zero `fs` dependencies inside core.
- [ ] Testing plan confirmation: Precise character-for-character modification testing.
- [ ] Human approval state: [ ] Approved

## Testing Requirements

- Unit test covering both empty, populated, and malformed story formats.
- Verify byte-identical preservation of unchanged lines after `checkOffTask()` and `appendReviewFinding()`.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.ts`
- [ ] `ai-dev-orchestrator/src/core/bmad-artifacts/parse-story-file.test.ts`

## Out of Scope

- Writing to the real file system from within `parse-story-file.ts`.
- Implementing `sprint-status.yaml` or `epics.md` parser/serializer.

## Definition of Done

- Type files and source compile cleanly.
- Vitest unit tests achieve high coverage and pass without errors.
- ESLint and Prettier runs show zero errors.

## Completion Status

- ready-for-dev

## Dev Agent Record

### Implementation Plan
Pure string-based parser/serializer for BMad story markdown files, maintaining strict non-destructive edits and zero direct side-effects.
