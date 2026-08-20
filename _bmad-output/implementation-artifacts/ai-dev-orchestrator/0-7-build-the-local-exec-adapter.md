# Story 0.7: Build the local exec adapter

## Story Details

- Epic: 0
- Story ID: 0.7
- Status: ready-for-dev

## Story

As a developer running any node that touches the target repo,
I want an `ExecPort` implementation that reads/writes file content directly, runs shell commands, and detects a stale read-modify-write, all scoped to `TARGET_REPO_PATH`,
So that node file/shell operations actually touch the target repo safely and never silently clobber a concurrent external edit.

## Acceptance Criteria

1. **Given** `adapters/local-exec-adapter.ts` and `TARGET_REPO_PATH` set, **when** `run({ cmd: 'npm', args: ['test'], cwd })` is called, **then** the command executes via `child_process` with `args` passed as an argv array (never string-interpolated into a shell), `cwd` defaulting to `TARGET_REPO_PATH`, and `{ stdout, stderr, exitCode }` is returned. [epics.md AC1]
2. **And** given the command doesn't exist or the process fails to spawn, the adapter throws `OrchestratorError` with `recoverable: false`. [epics.md AC2]
3. **And** given `cwd` (or a resolved file-path argument) would resolve outside `TARGET_REPO_PATH` (e.g. via `../` traversal or an absolute path elsewhere), the adapter rejects the call with `OrchestratorError { recoverable: false }` before spawning anything — no command ever runs outside the target repo boundary. [epics.md AC3]
4. **And** given the command doesn't exit within `EXEC_TIMEOUT_MS` (Story 0.4, default 600000/10min), the adapter kills the process and throws `OrchestratorError { recoverable: true }` rather than hanging forever — a hung `npm test` cannot block an unattended run indefinitely. [epics.md AC4]
5. **And** `readFile(path)` returns the file's content plus a fingerprint (mtime + content hash) via `node:fs`, scoped to and boundary-checked against `TARGET_REPO_PATH` the same way `run()` is. [epics.md AC5]
6. **And** `writeIfUnchanged(path, content, fingerprint)` re-reads the file's current fingerprint immediately before writing; given it no longer matches the fingerprint from the original `readFile()` call, it throws `OrchestratorError { recoverable: false, message: 'external change detected' }` instead of overwriting — every node that reads-then-writes a real BMad artifact (Stories 1.1, 1.2, 3.1, 4.1's callers) uses this pair, never a bare write, so a human hand-editing the same file mid-run is never silently clobbered. [epics.md AC6]
7. **And** every successful `writeIfUnchanged()`/`writeFile()` call records its path into an in-memory written-paths set; `getWrittenPaths()` returns the current set and `resetWrittenPaths()` clears it — this is what lets `GitCheckpoint` (Story 1.8) stage only what the orchestrator itself actually wrote for the current story, instead of trusting the whole working tree to be clean for the run's entire duration. [epics.md AC7]
8. **And** a Vitest suite covers: a real trivial command and a real failing one, a hung command hitting the timeout, a path-escape rejection, a `writeIfUnchanged` call that correctly detects a file changed by another process between read and write, and `getWrittenPaths()`/`resetWrittenPaths()` correctly scoping writes across two sequential "stories" in one test — no mocking of `child_process` itself for the command-execution assertions, since this adapter's whole job is real execution. [epics.md AC8]

## Tasks / Subtasks

- [ ] Task 1: Create `ai-dev-orchestrator/src/adapters/local-exec-adapter.ts` implementing `ExecPort` interface from `core/ports/exec-port.ts`. (AC: 1, 5, 6, 7)
- [ ] Task 2: Implement `run` with absolute path and escape-check resolution against `TARGET_REPO_PATH`. Ensure args are array, shell is false, and timeout is handled by `EXEC_TIMEOUT_MS`. (AC: 1, 2, 3, 4)
- [ ] Task 3: Implement `readFile(path)` using `node:fs`. Return content and fingerprint computed as `mtime` + SHA256 content hash. Perform escape-check resolution. (AC: 5)
- [ ] Task 4: Implement `writeIfUnchanged(path, content, fingerprint)` to check current fingerprint and write via `node:fs` or throw `OrchestratorError` with `recoverable: false`. Support `writeFile(path, content)` as needed, and ensure all writes record their paths. (AC: 6, 7)
- [ ] Task 5: Implement `getWrittenPaths()` and `resetWrittenPaths()` for path-tracking. (AC: 7)
- [ ] Task 6: Create unit/integration tests in `ai-dev-orchestrator/src/adapters/local-exec-adapter.test.ts` to assert command execution, failures, escaping boundary checks, timeout killing, file tracking, and fingerprint mismatch detection. (AC: 8)
- [ ] Task 7: Verify lint, build, formatting, and type-checks for the newly created files. (AC: 8)

## Dev Notes

- **Architecture and Technical Constraints**: Hexagonal Architecture. The adapter must implement the `ExecPort` interface from `core/ports/exec-port.ts`. All methods must validate that paths do not escape `TARGET_REPO_PATH`.
- **File/Path Expectations**:
  - `ai-dev-orchestrator/src/adapters/local-exec-adapter.ts`
  - `ai-dev-orchestrator/src/adapters/local-exec-adapter.test.ts`
- **Data/API Boundary Constraints**: Handled errors must map to `OrchestratorError`. Use `node:child_process` for shell/commands and `node:fs` for files.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`.
- **Package Boundaries**: Strictly isolated CLI/backend package. No React, UI components, state management, or frontend dependencies are allowed in the adapters layer.
- **Architecture & UX Gate Findings**:
  - **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness)**: Sourced from `epic-0-readiness.md` (`swept: true`, which covers Epic 0's planned stories including 0.7). Findings: The `ExecPort` interface has been synchronized (e.g. `readFile` returning content and fingerprint, `writeIfUnchanged` throwing on stale fingerprints, and scoped written paths tracking methods). Centralized environment variables (`TARGET_REPO_PATH` and optional `EXEC_TIMEOUT_MS` defaulting to 10 min) are already planned for Story 0.4.
  - **Gate 2 (UI Complexity & Reusability)**: This story has **zero UI surface** (pure CLI local command execution, no frontend component, layout, page, hook, or CSS token). Verdict: No gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/implementation-readiness-report-2026-08-21.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/src/adapters/local-exec-adapter.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/local-exec-adapter.test.ts` (NEW)

### Rule Mapping
- Hexagonal Boundary: Implement ExecPort interface from core, ensuring core logic is decoupled from real process/file operations.
- Target Repo Escape Check: Every path must be resolved absolute against TARGET_REPO_PATH and throw on escape attempts (no traversal).
- Centralized Config: Sourced `TARGET_REPO_PATH` and `EXEC_TIMEOUT_MS` from centralized config.

### Verification Plan
- Verify compilation: `pnpm build` (tsc)
- Run unit/integration tests: `pnpm test` (Vitest)

## Pre-Coding Approval Gate

- [ ] Scope confirmation: Implementing ExecPort wrapper for target repo file/shell operations using child_process and node:fs.
- [ ] Architecture and boundary confirmation: Decoupled adapter mapping to core ports, path-escape validation.
- [ ] Testing plan confirmation: Writing real integration tests running trivial/failing/long-running commands and file updates.
- [ ] Human approval state: [ ] Pending Approval

## Testing Requirements

- Write a Vitest unit/integration test suite in `local-exec-adapter.test.ts` covering:
  - Execution of a real trivial command and a real failing one.
  - A hung command hitting the timeout (`EXEC_TIMEOUT_MS` config check) and throwing recoverable OrchestratorError.
  - Traversal escape attempts (e.g. relative or absolute escape paths) throwing OrchestratorError.
  - Fingerprint mismatch detection in `writeIfUnchanged` by writing to file externally before committing write.
  - `getWrittenPaths()` and `resetWrittenPaths()` tracking and resetting written paths list properly.

## Deliverables Checklist

- [ ] `ai-dev-orchestrator/src/adapters/local-exec-adapter.ts`
- [ ] `ai-dev-orchestrator/src/adapters/local-exec-adapter.test.ts`

## Out of Scope

- Implementing any other adapters (9Router LLM, Resend email, readline HITL).
- Implementing the core state machine, nodes, or audit logger.

## Definition of Done

- Satisfy all Acceptance Criteria (AC1-AC8).
- 100% unit test coverage for `local-exec-adapter.ts` with passing Vitest tests.
- Code complies with strict TypeScript 6 strict mode, lint (ESLint), and formatting rules.

## Completion Status

- ready-for-dev

## Dev Agent Record

- (leave blank or standard placeholders)
