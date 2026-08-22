---
baseline_commit: 1713f6a996a9cbcbe2b3172d99955f1ade36b
---
# Story 1.7: Tier-2 Deep Code Review gates checkpoint

## Story Details

- Epic: 1
- Story ID: 1.7
- Status: ready-for-dev

## Story

As a developer trusting the orchestrator's commits,
I want a second, deeper adversarial review to run whenever Tier-1 approves,
So that a story isn't checkpointed on a shallow first pass.

## Acceptance Criteria

1. *Given* a Tier-1 review verdict of `APPROVE_, [epics.md AC1]
2. *When* the `DeepCodeReviewNode` runs, it evaluates `current_code` (representing the story's cumulative diff so far, verbatim from `GraphState`, never re-derived via `ExecPort`) through three parallel review lenses: `correctness`, `edge-case coverage`, and `acceptance-criteria coverage`, [epics.md AC2]
3. *And* each lens is driven by a distinct adversarial persona/prompt layout, all calling the LLM configured for `_COMPLEX` model alias (e.g. Gemini 3.1 Pro) per the model configuration, [epics.md AC2]
4.  *And* the verdict for each lens is parsed using the centralized `parseReviewVerdict` utility (from Story 0.12), [epics.md AC5%
5. *And* given any of the three lenses' responses cannot be successfully parsed, that lens is treated as returning `NEEDS_HUMAN` with a structured reason (matching Story 1.4/0.12 error handling) rather than being silently excluded, [epics.md AC5]
6. *Dhen* the aggregated findings from all three lenses are formatted and appended to the story file using the `appendReviewFinding` method from `parse-story-file.ts` (from Story 1.1), [epics.md AC3]
7. *And* the node returns a final aggregated `ReviewVerdict` (combining the results: if any lens is `NEEDS_HUMAN
 or unparseable, the aggregate is `NEEDS_HUMAN`; else if any lens is `AUTO_FIX`, the aggregate is `AUTO_FIX`; only if all three lenses are `APPROVE` is the aggregate `APPROVE`), [epics.md AC3]
8. *And* given the aggregated verdict is `AUTO_FIX`, the node generates and applies its own corrective patch in the same call (writing via `ExecPort.writeIfUnchanged() `), increments the shared `story.autoFixAttempts` budget, and transitions the graph to `Tester` (Story 1.6), [epics.md AC4	]
9. *And* given the aggregated verdict is `APPROVE`, the graph transitions directly to `GitCheckpoint` (Story 1.8), [epics.md AC4]
10. *And* given the aggregated verdict is `NEEDS_HUMAN`, the graph transitions to `HITL` (exiting cleanly with a non-zero exit code in Epic 1 standalone context before Epic 2 is wired), [epics.md AC4]
11. *And* a Vitest unit/integration test suite validates that:
    - Tier-2 deep review does NOT execute if Tier-1 returned `AUTO_FIX` or `NEEDS_HUMAN`, [epics.md AC6]
    - An unparseable response from one of the lenses correctly falls back to `NEEDS_HUMAN` for that lens and propagates to the aggregate verdict, [epics.md AC6]
    - Reaching the attempt ceiling short-circuits Tier-2 straight to `NEEDS_HUMAN` with no further LLM call or patch generation (integrated with Story 1.6 budget rules). [epics.md AC6]


## Tasks / Subtasks

- [ ] Task 1: Create the `DeepCodeReviewNode` implementation under `ai-dev-orchestrator/src/core/nodes/deep-code-review.ts`. (AC: 2)
- [ ] Task 2: Define and implement the three parallel lenses (`correctness`, `edge-case coverage`, `acceptance-criteria coverage`) using distinct adversarial system prompts / personas, calling `LLMPort` with the `_COMPLEX` role. (AC: 2, 3)
- [ ] Task 3: Use the centralized `parseReviewVerdict` (from Story 0.12) to parse each lens's output, and implement robust error fallback where unparseable responses resolve to `NEEDS_HUMAN`. (AC: 4, 5)
- [ ] Task 4: Implement the verdict aggregation logic: if any lens is `NEEDS_HUMAN`, aggregate is `NEEDS_HUMAN`; else if any lens is `AUTO_FIX`, aggregate is `AUTO_FIX`; else `APPROVE`. (AC: 7)
- [ ] Task 5: Integrate findings-formatting and use `parseStoryFile` / `appendReviewFinding` (from Story 1.1) to persist Tier-2 findings directly to the story file. (AC: 6)
- [ ] Task 6: Implement `AUTO_FIX` handling for Tier-2: generate a corrective patch within the node, apply it via `ExecPort.writeIfUnchanged()`, increment `story.autoFixAttempts`, and transition to `Tester` (respecting the shared attempt budget). (AC: 8)
- [ ] Task 7: Implement transition gating: routing `APPROVE` to `GitCheckpoint` and `NEEDS_HUMAN` to `HITL`/process exit. (AC: 9, 10)
- [ ] Task 8: Write a comprehensive Vitest suite in `ai-dev-orchestrator/src/core/nodes/deep-code-review.test.ts` to test all review outcomes, parallel execution of lenses, unparseable response fallbacks, and integration with the auto-fix attempts ceiling. (AC: 11)

## Dev Notes

- **Architecture and Technical Constraints**:
  - Complies with Ports & Adapters (AD-1) using `NodeContext` to access `ports.llm`, `ports.exec`, paths, config, and audit logger.
  - Lenses run in parallel (e.g., using `Promise.all` for the `LLMPort` completions) to minimize latency while maintaining distinct prompt personalities.
  - Reviews `current_code` (cumulative diff) verbatim. It does NOT use `ExecPort` to re-derive the diff (consistent with `state-machines.md`).
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/core/nodes/deep-code-review.ts`
  - `ai-dev-orchestrator/src/core/nodes/deep-code-review.test.ts`
- **References to Source Artifacts**:
  - `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md#Story 1.7`
  - `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-2` (Sole state-transition signal across two tiers)
  - `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md#AD-3` (Shared attempt budget)
  - `_bmad-output/specs/spec-ai-dev-orchestrator/state-machines.md#Tier 2 — Deep Code Review`
- **Package boundaries**: Standalone Node CLI under `ai-dev-orchestrator/`. No dependencies on `@festgrid/` web, UI, or database packages apply.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness)**: Sourced from `epic-1-readiness.md`. Verdict: No gap found. The implementation cleanly leverages existing ports and context-driven dependency injection.
- **Gate 2 (UI Complexity & Reusability)**: Sourced from `epic-1-readiness.md`. Verdict: No UI component required. Backend CLI logic only.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-1-readiness.md`. Verdict: One gap found. Resolved via the creation of Story 0.12 (`parseReviewVerdict` shared utility), which Story 1.7 relies on.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding**: No mismatch found.
- **Impacted fields/contracts**: No changes required. `ReviewVerdict` matches the existing 'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN' type defined in Epic 0.
- **Required DB migration changes**: No changes required. No database schema is affected.
- **Required TypeScript type changes**: No changes required.
- **Backward compatibility and rollout notes**: Fits directly into the Epic 1 state graph.

### Project Structure Notes

- New files must be placed strictly in `src/core/nodes/`. Tests must reside beside the code under test using the `.test.ts` extension.

### References

- [Source: _bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md]
- [Source: _bmad-output/specs/spec-ai-dev-orchestrator/state-machines.md]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md]

## Global Rules References

- [x] project-context.md
- [x] story-content-structure.md
- [x] architecture spine
- [x] infrastructure docs

## Implementation Plan (Rule-Compliant)

- **File Change Plan**:
  - Create `ai-dev-orchestrator/src/core/nodes/deep-code-review.ts`
  - Create `ai-dev-orchestrator/src/core/nodes/deep-code-review.test.ts`
- **Rule Mapping**:
  - Shared attempt ceiling: Shares `story.autoFixAttempts` from `GraphState` and budget check before/after execution with Story 1.6 logic.
  - Output parser: Uses `parseReviewVerdict` to parse LLM outputs.
- **Verification Plan**:
  - Run `pnpm test` in the `ai-dev-orchestrator/` folder to run all unit tests.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Tier-2 Deep Code Review with three parallel lenses, formatting findings, verdict aggregation, and AUTO_FIX/APPROVE routing.
- [ ] Architecture and boundary confirmation: Hexagonal boundary, no direct git/shell execution, NodeContext closure, and shared attempt ceiling.
- [ ] Testing plan confirmation: Unit tests mocking `LLMPort` and `ExecPort` verifying all verdict paths and parsing fallbacks.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted (Verified via Epic 1 readiness sweep)

## Testing Requirements

- [ ] Unit tests: Verify `DeepCodeReviewNode` correct execution of the correctness, edge-case, and acceptance-criteria lenses in parallel, correct parse of each, correct aggregation, appending findings, and appropriate graph routing.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/core/nodes/deep-code-review.ts`
- [ ] `ai-dev-orchestrator/src/core/nodes/deep-code-review.test.ts`

## Out of Scope

- Real interactive readline or email sending adapters (handled in Epic 2).
- Full graph wiring of the single-story pipeline (handled in Story 1.9).

## Definition of Done

- [ ] AC satisfaction (AC1-AC11)
- [ ] Required tests passing
- [ ] Lint and type checks passing for touched files

## Completion Status

- ready-for-dev

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

### Completion Notes List

### File List
