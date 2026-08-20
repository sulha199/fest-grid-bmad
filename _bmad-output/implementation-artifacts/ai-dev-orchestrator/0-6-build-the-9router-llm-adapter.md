# Story 0.6: Build the 9Router LLM adapter

## Story Details

- Epic: 0
- Story ID: 0.6
- Status: ready-for-dev

## Story

As a developer running any orchestrator node,
I want an `LLMPort` implementation that calls 9Router via the `openai` SDK with the role resolved to a configured model alias,
So that node LLM calls actually work end to end.

## Acceptance Criteria

1. **Given** `adapters/nine-router-llm-adapter.ts` and `ORCH_MODEL_PLANNER`/`_COMPLEX`/`_SPEED`/`_TESTER` set in config, **when** `complete({ role, systemPrompt, messages })` is called, **then** the adapter issues an `openai` SDK call with `baseURL` set to `NINE_ROUTER_BASE_URL`, `Authorization: Bearer <NINE_ROUTER_API_KEY>`, and `model` set to the alias resolved from `ORCH_MODEL_<ROLE>` (e.g. `ORCH_MODEL_PLANNER`) — never a literal model name in the adapter's source. [epics.md AC1]
2. **And** given the underlying HTTP call fails, the adapter throws `OrchestratorError` with `recoverable: true` for a network/5xx failure and `recoverable: false` for a 401/auth failure. [epics.md AC2]
3. **And** a Vitest suite mocks the `openai` client and covers: correct alias-per-role resolution, and both error-recoverability paths. [epics.md AC3]

## Tasks / Subtasks

- [ ] Task 1: Add `openai` as a dependency in the project if it is not already present. (AC: 1)
- [ ] Task 2: Create the `NineRouterLLMAdapter` in `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.ts` implementing `LLMPort` interface from `core/ports/llm-port`. (AC: 1)
- [ ] Task 3: Map incoming roles `'planner'`, `'complex'`, `'speed'`, and `'tester'` to their configured model aliases dynamically from the central configuration. (AC: 1)
- [ ] Task 4: Construct the `openai` client using `NINE_ROUTER_BASE_URL` and `NINE_ROUTER_API_KEY` loaded via the Centralized Config. (AC: 1)
- [ ] Task 5: Handle errors thrown by the `openai` client. Map network or HTTP 5xx errors to `OrchestratorError` with `recoverable: true`, and map 401, 403, and invalid API key errors to `OrchestratorError` with `recoverable: false`. (AC: 2)
- [ ] Task 6: Create unit/integration tests in `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.test.ts` using Vitest to assert correct model mapping, successful response formatting, and error category classification. (AC: 3)
- [ ] Task 7: Verify lint, formatting, and type-checks for the newly created files. (AC: 3)

## Dev Notes

- **Architecture and Technical Constraints**: Hexagonal Architecture. The adapter must implement the `LLMPort` interface from `core/ports/llm-port.ts`. It must use the `openai` SDK to talk to decolua/9router on its standard base path (`v1`) and default port (`20128`). No hardcoded model names in the source code — model names must always be resolved from config aliases.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.ts`
  - `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.test.ts`
- **Data/API Boundary Constraints**: Error wrapping must strictly use `OrchestratorError` with native error attached as `cause`, preserving context.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`.
- **Package Boundaries**: Strictly isolated package. No React, UI components, state management, or frontend dependencies are allowed in the adapters layer.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-0-readiness.md` (`swept: true`). Findings: No new Gate 1/3 findings were necessary. The readiness sweep covers the ports and adapters setup. Centralized environment variables (`NINE_ROUTER_BASE_URL` and `NINE_ROUTER_API_KEY`) are already planned for Story 0.4.
  - **Gate 2 (UI Complexity & Reusability)**: This story has **zero UI surface** (pure backend/local LLM adapter, no frontend component, layout, page, hook, or CSS token). Verdict: No gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/implementation-readiness-report-2026-08-21.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.test.ts` (NEW)

### Rule Mapping
- Hexagonal Boundary: Implement LLMPort interface from core, ensuring core logic is decoupled from `openai` SDK.
- Centralized Config: Sourced `baseURL` and `apiKey` from centralized config, ensuring no hardcoded credential fallback in source.
- Package Boundaries: No UI or Frontend libraries inside `src/adapters/`.

### Verification Plan
- Verify compilation: `pnpm build` (tsc)
- Run unit tests: `pnpm test` (Vitest)

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Implementing LLMPort wrapper for 9Router using the `openai` SDK.
- [ ] Architecture and boundary confirmation: Decoupled adapter mapping to core ports, no credential leak.
- [ ] Testing plan confirmation: Mocking `openai` network responses to test model alias mapping and error recoverability in Vitest.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Write a Vitest unit test in `nine-router-llm-adapter.test.ts` that mocks the `openai` SDK. Test role-to-alias mapping (e.g. calling with role `'planner'` uses the configured alias for planner). Assert error status categorization (recoverable for 5xx/network issues, non-recoverable for auth/invalid key issues).

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.ts`
- [ ] `ai-dev-orchestrator/src/adapters/nine-router-llm-adapter.test.ts`

## Out of Scope

- Implementing any other adapters (local exec, resend email, readline HITL).
- Implementing the core state machine, nodes, or audit logger.

## Definition of Done

- Satisfy all Acceptance Criteria (AC1-AC3).
- 100% unit test coverage for `nine-router-llm-adapter.ts` with passing Vitest tests.
- Code complies with strict TypeScript 6 strict mode, lint (ESLint), and formatting rules.
