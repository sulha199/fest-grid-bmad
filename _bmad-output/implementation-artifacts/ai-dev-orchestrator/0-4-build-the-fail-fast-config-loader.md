# Story 0.4: Build the fail-fast config loader

## Story Details

- Epic: 0
- Story ID: 0.4
- Status: ready-for-dev

## Story

As a developer running the orchestrator,
I want every required env var validated once at process start,
So that a misconfiguration fails immediately instead of mid-epic.

## Acceptance Criteria

1. **Given** `config/env.ts`, **when** the orchestrator process starts with a missing or invalid required env var (e.g. `NINE_ROUTER_API_KEY` unset), **then** the process throws and exits before any graph is built, with a message naming the specific missing/invalid variable. [epics.md AC1]
2. **And** given all required env vars are present and valid, `env.ts` exports a single parsed, typed config object every other module reads from. [epics.md AC2]
3. **And** the full validated env surface includes `RESEND_API_KEY` (required, Story 2.1) and `EXEC_TIMEOUT_MS` (optional, default 600000/10min, Story 0.7's bounded-timeout value) — every env var any later story's port/adapter reads is named here, not introduced ad hoc in that later story. [epics.md AC3]
4. **And** given `MAX_AUTO_FIX_ATTEMPTS` is `0`, that's a valid value meaning "never AUTO_FIX, the first non-`APPROVE` verdict always escalates" — it is not a config error; given it's negative, that **is** rejected as a config error. [epics.md AC4]
5. **And** a Vitest suite covers at least: missing required var, invalid `HITL_TIMEOUT_MS` (non-numeric), `MAX_AUTO_FIX_ATTEMPTS` at `0` (valid) and negative (rejected), and the all-valid success path. [epics.md AC5]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/config/env.ts` defining and validating the environment variables. (AC: 1, 2, 3, 4)
- [ ] Task 2: Implement validation logic using typed parsed values, fail-fast throws, and correct defaults. (AC: 1, 3, 4)
- [ ] Task 3: Export a structured, read-only `OrchestratorConfig` type and the parsed configuration instance. (AC: 2)
- [ ] Task 4: Create a unit test file `ai-dev-orchestrator/src/config/env.test.ts` covering the all-valid path, missing variables, non-numeric values, and invalid edge cases like negative auto-fix attempts. (AC: 5)
- [ ] Task 5: Verify that the environment config loader compiles perfectly and passes all Vitest assertions. (AC: 5)

## Dev Notes

- **Architecture and Technical Constraints**: The configuration loader must validate parameters synchronously on process load/import. It should fail fast and throw a descriptive error when required parameters are missing or invalid, preventing the LangGraph engine or adapters from initializing with incorrect state. It must have zero runtime UI or serverless-web-specific dependencies.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/config/env.ts`
  - `ai-dev-orchestrator/src/config/env.test.ts`
- **Data/API Boundary Constraints**: Env surface must strictly cover:
  - `NINE_ROUTER_BASE_URL` (optional, default: `http://localhost:20128/v1`)
  - `NINE_ROUTER_API_KEY` (required)
  - `ORCH_MODEL_PLANNER` (required)
  - `ORCH_MODEL_COMPLEX` (required)
  - `ORCH_MODEL_SPEED` (required)
  - `ORCH_MODEL_TESTER` (required)
  - `TARGET_REPO_PATH` (required)
  - `HITL_NOTIFY_EMAIL` (required)
  - `HITL_TIMEOUT_MS` (optional, default: `300000`)
  - `MAX_AUTO_FIX_ATTEMPTS` (optional, default: `1`)
  - `RESEND_API_KEY` (required)
  - `EXEC_TIMEOUT_MS` (optional, default: `600000`)
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/specs/spec-ai-dev-orchestrator/stack.md`, `_bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md`.
- **Package Boundaries**: State management (react-query, nuqs, zustand) must be isolated strictly within apps/web. Testing frameworks (vitest, msw) should use a shared config package (@festgrid/testing-config) or standalone configuration, but playwright must stay in apps/web. Schema validation must be strictly isolated: zod only in apps/web and ajv only in apps/backend.
- **Architecture and UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-0-readiness.md` (`swept: true`). Findings: validated centrally that `RESEND_API_KEY` and `EXEC_TIMEOUT_MS` belong in Story 0.4's env surface to align with Story 2.1 and 0.7 requirements. No new Gate 1 or Gate 3 sweep was necessary because of the pre-swept readiness report.
  - **Gate 2 (UI Complexity and Reusability)**: This story has **zero UI surface** (pure configuration loader with no user interface components, layout, styling, or hooks). Verdict: No gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epic-readiness/epic-0-readiness.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/config/env.ts` (NEW)
- `ai-dev-orchestrator/src/config/env.test.ts` (NEW)

### Rule Mapping
- Centralized config parsing: Centralized in env.ts, exporting single OrchestratorConfig instance. Fail-fast error throwing.
- Zero external leakage: Node-only environment variables parsed synchronously.

### Verification Plan
- Run Vitest: `pnpm test env.test.ts`
- Run compiler: `pnpm build`
- Verify missing env var behavior manually.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: The scope is limited strictly to environment variables definition, parsing, fail-fast validation, and test suite verification.
- [ ] Architecture and boundary confirmation: Zero leak of web/frontend libraries, pure node configuration.
- [ ] Testing plan confirmation: Comprehensive unit tests in env.test.ts testing various positive/negative config validation paths.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Covered positive case (all valid values, correct defaults applied).
- Covered missing required variables (NINE_ROUTER_API_KEY, RESEND_API_KEY, etc.).
- Covered non-numeric input for numeric variables (HITL_TIMEOUT_MS, EXEC_TIMEOUT_MS).
- Covered negative number edge case for MAX_AUTO_FIX_ATTEMPTS.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/config/env.ts`
- [ ] `ai-dev-orchestrator/src/config/env.test.ts`

## Out of Scope

- Loading target BMad project metadata or files (Story 0.9's scope).
- Setting up LangGraph runner or routing.
- Setting up or parsing command line options inside `cli.ts` (Story 0.10's scope).

## Definition of Done

- Centralized config loader written in `env.ts` and compiles successfully.
- 100% test coverage on environment validation paths.
- Lint checks pass cleanly.

## Completion Status

- ready-for-dev

## Dev Agent Record

- (leave blank or standard placeholders)