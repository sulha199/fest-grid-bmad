# Story 0.8: Build fake adapters for all four ports

## Story Details

- Epic: 0
- Story ID: 0.8
- Status: ready-for-dev

## Story

As a developer testing core node logic,
I want fake implementations of `LLMPort`, `ExecPort`, `NotifyPort`, and `HITLPort`,
So that node decision logic — including HITL/escalation logic in later epics — can be tested without a real 9Router call, shell command, email send, or terminal prompt.

## Acceptance Criteria

1. **Given** `adapters/fakes/fake-llm-port.ts`, `fake-exec-port.ts`, `fake-notify-port.ts`, and `fake-hitl-port.ts`, **when** a test configures a fake's canned response (or a queue of responses, or a scripted failure) and calls it, **then** the fake returns the configured response without any real network/process/terminal call, and records every call it received for assertion. [epics.md AC1]
2. **And** `fake-notify-port.ts` can be configured to fail (throw `OrchestratorError`) a specified number of times before succeeding — Story 2.3 needs this to test "escalation send fails twice" without a real Resend call. [epics.md AC2]
3. **And** all four fakes implement their port interface exactly (type-checked against `core/ports/`) — a node under test cannot tell it's talking to a fake versus the real adapter. [epics.md AC3]
4. **And** a Vitest test demonstrates using all four fakes together to drive one node function to a deterministic outcome. [epics.md AC4]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/adapters/fakes/fake-llm-port.ts` implementing `LLMPort` interface with configurable mock/canned outputs, response queues, and call-history recording. (AC: 1, 3)
- [ ] Task 2: Create `ai-dev-orchestrator/src/adapters/fakes/fake-exec-port.ts` implementing `ExecPort` interface with mocked filesystem states, command execution simulation, call-history recording, and written paths tracking. (AC: 1, 3)
- [ ] Task 3: Create `ai-dev-orchestrator/src/adapters/fakes/fake-notify-port.ts` implementing `NotifyPort` interface with configurable failure count (throw `OrchestratorError`) before success, and call-history recording. (AC: 1, 2, 3)
- [ ] Task 4: Create `ai-dev-orchestrator/src/adapters/fakes/fake-hitl-port.ts` implementing `HITLPort` interface with canned inputs or scripted responses, and call-history recording. (AC: 1, 3)
- [ ] Task 5: Create a Vitest integration test `ai-dev-orchestrator/src/adapters/fakes/fakes.test.ts` driving a dummy node function through all four fakes to verify type correctness, configuration/queuing behaviors, failure injection, and deterministic execution. (AC: 4)

## Dev Notes

- **Architecture and Technical Constraints**: All code lives in `ai-dev-orchestrator/src/adapters/fakes/`. Fakes must import and implement their respective port interfaces under `src/core/ports/`. They must match the type signatures exactly and throw `OrchestratorError` when simulated errors are requested.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/adapters/fakes/fake-llm-port.ts`
  - `ai-dev-orchestrator/src/adapters/fakes/fake-exec-port.ts`
  - `ai-dev-orchestrator/src/adapters/fakes/fake-notify-port.ts`
  - `ai-dev-orchestrator/src/adapters/fakes/fake-hitl-port.ts`
  - `ai-dev-orchestrator/src/adapters/fakes/fakes.test.ts`
- **Data/API Boundary Constraints**: Port contracts from `src/core/ports/` are the authoritative constraints.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-0-readiness.md` (specifically Gate 3 finding 3 confirming Story 0.8 must cover all four ports).
- **Architecture and UX Gate Findings**: Sourced from `epic-0-readiness.md` (`swept: true`). Gate 1 and Gate 3 findings are already covered in the readiness sweep. Under Gate 3 finding 3, Story 0.8 was updated to cover all four ports (FakeLLMPort, FakeExecPort, FakeNotifyPort, FakeHITLPort) instead of only 2, which has been incorporated directly into this story file. Gate 2 (UI) is not applicable because it's a CLI tool. Verdict: No UI gap found.
- **Data Type Compatibility and Migration Requirements**: No changes required. Fakes strictly match in-memory TypeScript port interfaces. No DB migration or external API schemas are involved.
- **State Management**: No changes required. Ephemeral mock state (calls history, response queues) is managed entirely in-memory within each class/instance.
- **Loaders**: No changes required. This is a CLI testing/adapter utility with zero UI and zero loaders.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-0-readiness.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/adapters/fakes/fake-llm-port.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/fakes/fake-exec-port.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/fakes/fake-notify-port.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/fakes/fake-hitl-port.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/fakes/fakes.test.ts` (NEW)

### Rule Mapping
- Hexagonal Boundary Enforcement: Ensures that unit tests can verify core nodes without any real side effects (9Router, real fs writes, terminal input, emails).
- Package isolation: All dependencies of fakes are core type interfaces; zero external or third-party web dependencies.

### Verification Plan
- Use `vitest` to run `fakes.test.ts`, asserting that all four fake adapters behave deterministically, record history, and conform to the port interfaces.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Scope is limited to the four fake adapters inside `adapters/fakes/` and their unit tests.
- [ ] Architecture and boundary confirmation: Fake implementations must implement the port interfaces exactly and compile cleanly with strict TypeScript.
- [ ] Testing plan confirmation: Integration/unit tests verifying fakes' scriptability and error simulation.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Unit/integration test `fakes.test.ts` using Vitest.
- Complete coverage of queue behavior, failure counts, and input tracking.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/adapters/fakes/fake-llm-port.ts`
- [ ] `ai-dev-orchestrator/src/adapters/fakes/fake-exec-port.ts`
- [ ] `ai-dev-orchestrator/src/adapters/fakes/fake-notify-port.ts`
- [ ] `ai-dev-orchestrator/src/adapters/fakes/fake-hitl-port.ts`
- [ ] `ai-dev-orchestrator/src/adapters/fakes/fakes.test.ts`

## Out of Scope

- Implementing real adapters (NineRouterLLMAdapter, LocalExecAdapter, etc.).
- Wring real core graph state.

## Definition of Done

- Code compiles cleanly with no strict TypeScript errors.
- Vitest tests for fakes pass successfully.
- No ESLint warnings/errors in the added files.

## Completion Status

- ready-for-dev

## Dev Agent Record

- (blank)