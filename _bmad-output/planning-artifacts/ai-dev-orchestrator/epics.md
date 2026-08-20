---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments: [
  "_bmad-output/specs/spec-ai-dev-orchestrator/SPEC.md",
  "_bmad-output/specs/spec-ai-dev-orchestrator/stack.md",
  "_bmad-output/specs/spec-ai-dev-orchestrator/state-machines.md",
  "_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md"
]
---

# AI Dev Orchestrator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the AI Dev Orchestrator, decomposing the requirements from SPEC-ai-dev-orchestrator (acting as the PRD-equivalent input) and its architecture spine into implementable stories. This is a standalone initiative, separate from the festgrid product — its planning and implementation artifacts are deliberately kept under dedicated `ai-dev-orchestrator/` subfolders rather than the shared `_bmad-output/planning-artifacts/`/`implementation-artifacts/` roots, to avoid any collision with festgrid's own real epics/stories/sprint tracking.

## Requirements Inventory

### Functional Requirements

- **FR1:** The Planner can draft a coarse epic/story breakdown from the target project's PRD and architecture reference when no `epics.md` entry exists for a named epic, pausing for a HITL confirmation before writing it (CAP-1 Phase A).
- **FR2:** The Planner can materialize a story's full file (acceptance criteria, tasks, dev notes, including a Gate 2 UI Complexity & Reusability check) immediately before dispatching it, flipping its `sprint-status.yaml` entry from `backlog` to `ready-for-dev` (CAP-1 Phase B).
- **FR3:** The Planner never dispatches foreign work — a story already `in-progress`/`review`/`done` with no record in the current run — and instead skips to the next available `backlog`/`ready-for-dev` story.
- **FR4:** The Complex Worker/Reviewer node can implement complex algorithmic work and Drizzle database schema migrations per a story's real acceptance criteria, and review any node's output, returning exactly one of `APPROVE`/`AUTO_FIX`/`NEEDS_HUMAN`.
- **FR5:** The Speed Worker node can implement standard boilerplate, UI components, and API routes from a story's real task checklist, checking off tasks in the story file as they complete.
- **FR6:** The Tester/Utility node can run the target project's actual build and test commands, parse terminal output, classify failures, and auto-fix trivial lint issues without escalation.
- **FR7:** A user can invoke `dev an epic <name>` to autonomously drive the full ritual — readiness sweep, story materialization, implementation, test, two-tier review, checkpoint — across every story in that epic.
- **FR8:** A user can manually trigger a review pass over an already-implemented epic/stories, independent of the dev-an-epic loop, with `AUTO_FIX` patches applied directly to the real story files.
- **FR9:** The system pauses at a terminal HITL prompt on a `NEEDS_HUMAN` verdict, a blocking Tester failure, an out-of-epic-scope readiness finding, or a Phase A confirmation awaiting the human before a new epic decomposition is committed.
- **FR10:** On a HITL timeout, the system sends exactly one escalation email via a transactional email API, while the terminal prompt keeps waiting and still accepts a response afterward.
- **FR11:** Every node's LLM calls route through the user's self-hosted 9Router gateway, with the model resolved from a per-node configured alias, never a hardcoded model name.
- **FR12:** The orchestrator reads/writes files and executes shell commands against a single, config-pointed `TARGET_REPO_PATH` — which may be this repo itself.
- **FR13:** The system creates exactly one local git checkpoint commit per story once both review tiers return `APPROVE`, containing the story's code changes, its updated story file, and its `sprint-status.yaml` entry together.
- **FR14:** The system runs an epic readiness sweep (Gate 1 Architecture/Infrastructure Completeness + Gate 3 Foundational/Cross-cutting Dependency Completeness) once per epic — mandatory the first time, optional and cached thereafter via the readiness report's `swept` field — inserting any missing prerequisite stories into `epics.md`/`sprint-status.yaml`.
- **FR15:** When the Tier-1 Reviewer verdict is `APPROVE`, the system runs a Tier-2 deep adversarial review (three parallel lenses) against the finished diff, which can downgrade the verdict before the story is checkpointed.
- **FR16:** A HITL response flagged `correct-course:` forces a re-sweep of the epic's remaining not-yet-approved stories, seeded with the human's stated change; if that re-sweep finds an out-of-epic-scope (PRD/architecture-level) gap, the system halts at a second HITL pause recommending the real BMad planning skills, rather than autonomously editing those documents.

### NonFunctional Requirements

- **NFR1:** Must run entirely locally in a Node.js/VS Code environment — no cloud orchestration service or hosted multi-tenant deployment.
- **NFR2:** All LLM calls go through 9Router's OpenAI-compatible endpoint with Bearer auth; model IDs are resolved from configured aliases only, never hardcoded.
- **NFR3:** `TARGET_REPO_PATH` must be a BMad-managed project (has `_bmad/` and `_bmad-output/`) — there is no standalone-sandbox mode.
- **NFR4:** `GraphState` is fixed to exactly six named fields; `tasks_queue` is a fresh in-memory parse of the real BMad artifacts, never itself the durable copy.
- **NFR5:** `sprint-status.yaml` story/epic status values are constrained to BMad's real enum only — the orchestrator never invents a new status value.
- **NFR6:** Write ownership over real artifacts is scoped per file and per real-BMad-skill-equivalent, enforced by the graph's sequential per-story/epic execution.
- **NFR7:** HITL timeout escalation is email-only via one env-configured address.
- **NFR8:** Reviewer verdict is constrained to exactly `APPROVE`, `AUTO_FIX`, or `NEEDS_HUMAN` — no free-form outcomes.
- **NFR9:** Checkpoint commits never push or force-push automatically — all remote git operations stay manual.
- **NFR10:** The AUTO_FIX retry ceiling is configurable via `MAX_AUTO_FIX_ATTEMPTS` (default 1), shared across both review tiers.
- **NFR11:** The Tier-2 deep code review runs only on a Tier-1 `APPROVE`, never on every AUTO_FIX iteration.
- **NFR12:** The orchestrator never autonomously edits a target project's PRD or architecture reference.
- **NFR13:** The orchestrator refuses to start a run against a `TARGET_REPO_PATH` with any pre-existing uncommitted or untracked change (hard error).
- **NFR14:** The orchestrator never touches a foreign-work story without an explicit user opt-in naming it.
- **NFR15:** A brand-new epic decomposition (CAP-1 Phase A) is never written without a HITL confirmation first.
- **NFR16:** A correction to an already-swept epic readiness report appends a new `addenda` entry — it never wholesale-overwrites a prior report.

### Additional Requirements

- **Paradigm:** Hexagonal / Ports & Adapters — core (LangGraph state machine + node decision logic) depends only on port interfaces (`LLMPort`, `ExecPort`, `NotifyPort`, `HITLPort`) it defines; concrete adapters implement them; a single composition root wires adapters into core at startup (AD-1).
- Port method signatures are fixed, not just named: `LLMPort.complete` is role-scoped (not model-pre-bound); `ExecPort.run` takes an argv array, never an interpolated shell string; every port throws a typed `OrchestratorError { message, recoverable, cause }` that the calling node — never the adapter — decides how to handle (AD-1).
- `ReviewVerdict` is a single shared enum produced by both the Tier-1 Reviewer and the Tier-2 Deep Code Review node; Tier-2 only runs on a Tier-1 `APPROVE` (AD-2).
- The `AUTO_FIX` retry counter increments on every applied patch, tier-agnostic, regardless of the following Tester outcome — a single authoritative rule shared verbatim between the architecture spine and `state-machines.md` (AD-3).
- Checkpoint commit staging (`git add -A`) is only safe because of the dirty-tree pre-flight gate that refuses to start a run on an unclean working tree (AD-4).
- Real BMad artifacts (`epics.md`, story files, `sprint-status.yaml`, readiness reports) are canonical; the SQLite checkpointer holds only ephemeral run-state (`autoFixAttempts`, which story was mid-flight) (AD-5).
- Model resolution is alias-indirect via env vars per node role: `ORCH_MODEL_PLANNER`/`_COMPLEX`/`_SPEED`/`_TESTER` (AD-6).
- Config is fail-fast and centralized via a single `env.ts`, validated once at process start (AD-7).
- The audit log is append-only JSONL, one file per run, written only by core nodes — never by adapters (AD-8).
- HITL directive parsing (`correct-course:`) lives in the HITL node, not the port, with a fixed case-insensitive/whitespace-tolerant match rule (AD-9).
- No autonomous PRD/architecture edits; out-of-scope findings and CAP-1 Phase A both halt at a HITL confirmation (AD-10).
- **Stack (verified against this actual repo/machine):** Node.js 22, pnpm 9.15.4, TypeScript 6.0.3, ESLint 9.x (own flat config), `@langchain/langgraph` 1.4.12, `@langchain/langgraph-checkpoint-sqlite` 1.0.4, `openai` SDK 7.5.0 (pointed at 9Router), `resend` 6.21.0, `vitest` 4.1.11, `yaml` 2.9.0 (comment-preserving, required for `sprint-status.yaml` round-trips).
- **Structural seed:** `src/core/` (graph, state, types, `bmad-artifacts/` parsers, `nodes/`, `ports/`), `src/adapters/` (+ `fakes/`), `src/config/env.ts`, `src/logging/audit-logger.ts`, `src/bootstrap.ts` (composition root), `src/cli.ts`.
- No deployment target in v1 — local-only, single machine, single process, invoked directly via `node`/`tsx`.

### UX Design Requirements

Not applicable — the AI Dev Orchestrator is a terminal/CLI tool with no graphical UI. No UX design contract exists or is needed for this initiative.

### FR Coverage Map

FR1: Epic 4 - Draft a brand-new epic decomposition with HITL confirmation before writing
FR2: Epic 3 - JIT-materialize a story's full file immediately before dispatch
FR3: Epic 3 - Skip foreign-work stories with no record in the current run
FR4: Epic 1 - Complex Worker/Reviewer implements complex work and reviews
FR5: Epic 1 - Speed Worker implements boilerplate/UI/API routes
FR6: Epic 1 - Tester runs real build/test commands and classifies failures
FR7: Epic 3 - `dev an epic <name>` autonomous multi-story loop
FR8: Epic 5 - Manual review pass with direct patch application
FR9: Epic 2 - HITL pause on NEEDS_HUMAN/blocking failure/out-of-scope/Phase A
FR10: Epic 2 - Timeout escalation email
FR11: Epic 1 - 9Router-routed model aliases per node
FR12: Epic 1 - File/shell exec scoped to TARGET_REPO_PATH
FR13: Epic 1 - Git checkpoint commit once review approves
FR14: Epic 4 - Epic readiness sweep (Gate 1 + Gate 3), cached via swept
FR15: Epic 1 - Tier-2 deep review can downgrade Tier-1's verdict
FR16: Epic 4 - correct-course: flagged HITL response forces a re-sweep

## Epic List

### Epic 0: Orchestrator Project Foundation
Establish the hexagonal core skeleton (ports, adapters, composition root), 9Router-routed LLM adapter, local exec adapter, config loading, audit logging, and target-project validation/path-resolution that every subsequent epic builds on. No end-user-observable behavior on its own — matches this repo's own Epic 0 precedent for irreducible technical setup on a greenfield project.
**Additional Requirements covered:** AD-1 (ports/adapters/composition root), AD-6 (alias-indirect model resolution), AD-7 (fail-fast centralized config), AD-8 (append-only audit log), `stack.md`'s Target repo assumptions (BMad-managed validation, `_bmad/bmm/config.yaml` path resolution), Stack (Node 22, pnpm, TypeScript, ESLint, `@langchain/langgraph`, core dependencies)

### Epic 1: Autonomous Single-Story Pipeline
A user can point the orchestrator at one already-materialized story in a target BMad project and watch it autonomously implement, test, run both review tiers, retry within a bounded budget, and checkpoint that story — the first time the tool does real unattended work end to end.
**FRs covered:** FR4, FR5, FR6, FR11, FR12, FR13, FR15

### Epic 2: Human-in-the-Loop Safety Net
The orchestrator recognizes when it shouldn't guess — it pauses at a terminal prompt on a risky or ambiguous verdict or a blocking failure, and escalates by email if the user doesn't respond in time, without ever giving up on the pause.
**FRs covered:** FR9, FR10

### Epic 3: Full Epic Autonomy
A user can hand the orchestrator a whole named epic and have it materialize and drive every story in that epic to completion on its own, correctly leaving any pre-existing foreign work untouched.
**FRs covered:** FR2, FR3, FR7

### Epic 4: Epic Readiness & Course Correction
The orchestrator can safely take on a brand-new epic that hasn't been broken down yet (pausing for the user's sign-off before committing a plan) and react to a mid-epic course correction the user explicitly flags, without ever silently overstepping into PRD/architecture territory.
**FRs covered:** FR1, FR14, FR16

### Epic 5: Manual Review & Patch Mode
A user can ask the orchestrator to review and fix an already-implemented epic's stories directly, reusing the same review/patch machinery without re-running the full autonomous dev loop.
**FRs covered:** FR8

---

## Epic 0: Orchestrator Project Foundation

Establish the hexagonal core skeleton (ports, adapters, composition root), 9Router-routed LLM adapter, local exec adapter, config loading, and audit logging that every subsequent epic builds on. No end-user-observable behavior on its own — matches this repo's own Epic 0 precedent for irreducible technical setup on a greenfield project.

### Story 0.1: Initialize the orchestrator project scaffold

As a developer setting up the orchestrator,
I want a working TypeScript project with pnpm, the pinned dependency set, and the structural-seed directory layout in place,
So that every subsequent story has somewhere correct to add code.

**Acceptance Criteria:**

**Given** an empty project directory
**When** the scaffold story is complete
**Then** `package.json` pins `packageManager: "pnpm@9.15.4"` and `engines.node: ">=22.0.0"`, `tsconfig.json` targets TypeScript 6.0.3 in strict mode, and `eslint.config.js` is a standalone flat config (not `@festgrid/eslint-config`)
**And** the `src/core/`, `src/adapters/`, `src/config/`, `src/logging/` directory skeleton from the architecture spine's Structural Seed exists with empty/placeholder files
**And** `pnpm install` and `pnpm build` both succeed with zero source files beyond placeholders

### Story 0.2: Define core types and GraphState

As a developer building any orchestrator node,
I want `Epic`, `Story`, `ReviewVerdict`, and `GraphState` defined once in `core/types.ts`/`core/state.ts`,
So that every node references the same shapes instead of inventing its own.

**Acceptance Criteria:**

**Given** `core/types.ts`
**When** it's implemented
**Then** `ReviewVerdict` is exactly `'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN'` and `Story` includes `autoFixAttempts: number` (SQLite-only, no real-file counterpart) alongside the fields parsed from real BMad artifacts
**And** `core/state.ts` defines `GraphState` with exactly the six fixed fields (`spec`, `tasks_queue`, `current_code`, `terminal_output`, `error_status`, `human_feedback`) per SPEC.md's Constraints
**And** a Vitest type-level test confirms `GraphState` has no extra or missing top-level keys

### Story 0.3: Define the four port interfaces and the shared error type

As a developer building core node logic,
I want `LLMPort`, `ExecPort`, `NotifyPort`, and `HITLPort` defined with their exact fixed method signatures plus a shared `OrchestratorError` type,
So that core never depends on anything but these interfaces (AD-1).

**Acceptance Criteria:**

**Given** `core/ports/`
**When** all four interface files are implemented
**Then** `LLMPort.complete` takes `{ role, systemPrompt, messages }` (role-scoped, no pre-bound model), `ExecPort.run` takes `{ cmd, args: string[], cwd? }` (argv array, never a shell string) for build/test/git commands, `ExecPort.readFile`/`writeFile` take a path relative to `TARGET_REPO_PATH` and content, using `node:fs` directly (not shelling out through `run()`) for every parser's actual file I/O, `NotifyPort.send` takes `{ to, subject, body }`, and `HITLPort.prompt` takes `{ summary, expand }` and resolves with a string
**And** `OrchestratorError { message, recoverable: boolean, cause }` is defined once and is the only error type any port signature declares as thrown
**And** the shared retry policy is documented here as the canonical rule every node story references rather than re-defining: a node's own top-level port call (not a review verdict) that throws `recoverable: true` gets exactly one retry; a second failure, or any `recoverable: false` failure, routes to HITL with the error as the reason — never an invisible retry loop, a crash, or silent continuation
**And** nothing outside `core/ports/` is imported by these files — they have zero runtime dependencies

### Story 0.4: Build the fail-fast config loader

As a developer running the orchestrator,
I want every required env var validated once at process start,
So that a misconfiguration fails immediately instead of mid-epic.

**Acceptance Criteria:**

**Given** `config/env.ts`
**When** the orchestrator process starts with a missing or invalid required env var (e.g. `NINE_ROUTER_API_KEY` unset)
**Then** the process throws and exits before any graph is built, with a message naming the specific missing/invalid variable
**And** given all required env vars are present and valid, `env.ts` exports a single parsed, typed config object every other module reads from
**And** given `MAX_AUTO_FIX_ATTEMPTS` is `0`, that's a valid value meaning "never AUTO_FIX, the first non-`APPROVE` verdict always escalates" — it is not a config error; given it's negative, that **is** rejected as a config error
**And** a Vitest suite covers at least: missing required var, invalid `HITL_TIMEOUT_MS` (non-numeric), `MAX_AUTO_FIX_ATTEMPTS` at `0` (valid) and negative (rejected), and the all-valid success path

### Story 0.5: Build the audit logger

As a developer debugging an orchestrator run,
I want every LLM call, shell command, verdict, and HITL event appended to a per-run JSONL log,
So that I can reconstruct exactly what happened after the fact (AD-8).

**Acceptance Criteria:**

**Given** `logging/audit-logger.ts`
**When** a node logs an event during a run
**Then** one JSONL line `{ ts, runId, event, ... }` is appended to `logs/<run-id>.jsonl`
**And** the logger exposes no method an adapter would call — only nodes call it, matching AD-8's core-only ownership rule
**And** a Vitest test confirms two sequential log calls produce two valid, independently-parseable JSON lines in file order

### Story 0.6: Build the 9Router LLM adapter

As a developer running any orchestrator node,
I want an `LLMPort` implementation that calls 9Router via the `openai` SDK with the role resolved to a configured model alias,
So that node LLM calls actually work end to end.

**Acceptance Criteria:**

**Given** `adapters/nine-router-llm-adapter.ts` and `ORCH_MODEL_PLANNER`/`_COMPLEX`/`_SPEED`/`_TESTER` set in config
**When** `complete({ role: 'planner', ... })` is called
**Then** the adapter issues an `openai` SDK call with `baseURL` set to `NINE_ROUTER_BASE_URL`, `Authorization: Bearer <NINE_ROUTER_API_KEY>`, and `model` set to the alias resolved from `ORCH_MODEL_PLANNER` — never a literal model name in the adapter's source
**And** given the underlying HTTP call fails, the adapter throws `OrchestratorError` with `recoverable: true` for a network/5xx failure and `recoverable: false` for a 401/auth failure
**And** a Vitest suite mocks the `openai` client and covers: correct alias-per-role resolution, and both error-recoverability paths

### Story 0.7: Build the local exec adapter

As a developer running any node that touches the target repo,
I want an `ExecPort` implementation that reads/writes file content directly, runs shell commands, and detects a stale read-modify-write, all scoped to `TARGET_REPO_PATH`,
So that node file/shell operations actually touch the target repo safely and never silently clobber a concurrent external edit.

**Acceptance Criteria:**

**Given** `adapters/local-exec-adapter.ts` and `TARGET_REPO_PATH` set
**When** `run({ cmd: 'npm', args: ['test'], cwd })` is called
**Then** the command executes via `child_process` with `args` passed as an argv array (never string-interpolated into a shell), `cwd` defaulting to `TARGET_REPO_PATH`, and `{ stdout, stderr, exitCode }` is returned
**And** given the command doesn't exist or the process fails to spawn, the adapter throws `OrchestratorError` with `recoverable: false`
**And** given `cwd` (or a resolved file-path argument) would resolve outside `TARGET_REPO_PATH` (e.g. via `../` traversal or an absolute path elsewhere), the adapter rejects the call with `OrchestratorError { recoverable: false }` before spawning anything — no command ever runs outside the target repo boundary
**And** given the command doesn't exit within a bounded timeout (default e.g. 10 minutes, configurable), the adapter kills the process and throws `OrchestratorError { recoverable: true }` rather than hanging forever — a hung `npm test` cannot block an unattended run indefinitely
**And** `readFile(path)` returns the file's content plus a fingerprint (mtime + content hash) via `node:fs`, scoped to and boundary-checked against `TARGET_REPO_PATH` the same way `run()` is
**And** `writeIfUnchanged(path, content, fingerprint)` re-reads the file's current fingerprint immediately before writing; given it no longer matches the fingerprint from the original `readFile()` call, it throws `OrchestratorError { recoverable: false, message: 'external change detected' }` instead of overwriting — every node that reads-then-writes a real BMad artifact (Stories 1.1, 1.2, 3.1, 4.1's callers) uses this pair, never a bare write, so a human hand-editing the same file mid-run is never silently clobbered
**And** every successful `writeIfUnchanged()`/`writeFile()` call records its path into an in-memory written-paths set; `getWrittenPaths()` returns the current set and `resetWrittenPaths()` clears it — this is what lets `GitCheckpoint` (Story 1.8) stage only what the orchestrator itself actually wrote for the current story, instead of trusting the whole working tree to be clean for the run's entire duration
**And** a Vitest suite covers: a real trivial command and a real failing one, a hung command hitting the timeout, a path-escape rejection, a `writeIfUnchanged` call that correctly detects a file changed by another process between read and write, and `getWrittenPaths()`/`resetWrittenPaths()` correctly scoping writes across two sequential "stories" in one test — no mocking of `child_process` itself for the command-execution assertions, since this adapter's whole job is real execution

### Story 0.8: Build fake LLMPort and ExecPort adapters for testing

As a developer testing core node logic,
I want fake implementations of `LLMPort` and `ExecPort`,
So that node decision logic can be tested without a real 9Router call or a real shell command.

**Acceptance Criteria:**

**Given** `adapters/fakes/fake-llm-port.ts` and `adapters/fakes/fake-exec-port.ts`
**When** a test configures a fake's canned response (or a queue of responses) and calls it
**Then** the fake returns the configured response without any real network/process call, and records every call it received for assertion
**And** both fakes implement their port interface exactly (type-checked against `core/ports/`) — a node under test cannot tell it's talking to a fake versus the real adapter
**And** a Vitest test demonstrates using both fakes together to drive one node function to a deterministic outcome

### Story 0.9: Resolve and validate the target BMad project

As a developer pointing the orchestrator at a target repo,
I want it to validate that `TARGET_REPO_PATH` is a real BMad-managed project and resolve its real artifact paths, before anything else runs,
So that every later story can rely on `planning_artifacts`/`implementation_artifacts`/the PRD-architecture reference being correctly known, and a wrong path fails immediately with a clear reason.

**Acceptance Criteria:**

**Given** `TARGET_REPO_PATH` does not contain a `_bmad/` or `_bmad-output/` directory
**When** the orchestrator starts
**Then** it refuses to start (hard error) naming exactly what's missing — before any graph or adapter is touched
**And** given `TARGET_REPO_PATH` is BMad-managed, this step reads `_bmad/bmm/config.yaml` (not `_bmad/core/config.yaml` — confirmed wrong file, see `stack.md`) and resolves `planning_artifacts`/`implementation_artifacts` to absolute paths under `TARGET_REPO_PATH`
**And** it locates the PRD/architecture reference via `_bmad-output/project-context.md`'s "Reference Documents" section, falling back to scanning `planning_artifacts` for `*architecture-spine.md` or `specs/*/SPEC.md` if that section is absent
**And** this is raw `node:fs` usage at bootstrap time, not through `ExecPort` — the graph doesn't exist yet, matching how the dirty-tree gate (Story 1.8) also runs outside any graph node
**And** a Vitest test runs this against this repo's own real `_bmad/bmm/config.yaml` and `project-context.md`, asserting the resolved paths match what's actually on disk, and a second test asserts a non-BMad directory is rejected with a clear message

### Story 0.10: Wire the composition root and CLI entrypoint stub

As a developer running the orchestrator for the first time,
I want a `bootstrap.ts` that assembles real adapters into core and a minimal `cli.ts` entrypoint,
So that `node cli.js` actually starts something, even before any graph nodes exist.

**Acceptance Criteria:**

**Given** `bootstrap.ts` and `cli.ts`
**When** the orchestrator is invoked with no subcommand
**Then** `bootstrap.ts` loads config (Story 0.4), validates and resolves the target project (Story 0.9), constructs the real `NineRouterLLMAdapter`/`LocalExecAdapter`, and exits cleanly with a "no command given, nothing to run yet" message — since no graph exists until Epic 1
**And** given an unset required env var, the same fail-fast behavior from Story 0.4 surfaces before any adapter is constructed
**And** this is the first point where Stories 0.1–0.9 are exercised together as one process, not just in isolated unit tests

---

## Epic 1: Autonomous Single-Story Pipeline

A user can point the orchestrator at one already-materialized story in a target BMad project and watch it autonomously implement, test, run both review tiers, retry within a bounded budget, and checkpoint that story — the first time the tool does real unattended work end to end. Epic 2 (HITL) doesn't exist yet at this point in the build, so a `NEEDS_HUMAN` verdict gets a crude stand-in here — the process exits with a clear message and non-zero code — which Epic 2 upgrades into a real interactive pause.

### Story 1.1: Build the story-file parser/serializer

As a developer building any node that touches a story file,
I want a pure `parse-story-file.ts` module that reads a real story file's acceptance criteria and task checklist, toggles task checkboxes, and appends a review-findings section,
So that every node reads and writes story files through one consistent, tested module instead of ad hoc string manipulation.

**Acceptance Criteria:**

**Given** a real story file matching this repo's actual format (frontmatter-free markdown with `**Acceptance Criteria:**` and `- [ ] Task N:` checklist lines, e.g. as seen in `_bmad-output/implementation-artifacts/0-15-set-up-outbound-email-adapter.md`)
**When** `parseStoryFile()` reads it
**Then** it returns the story's acceptance criteria list and task list (each with its checked/unchecked state) as structured data, and `checkOffTask()`/`appendReviewFinding()` write back only the targeted line(s), leaving the rest of the file byte-identical
**And** this module lives in `core/bmad-artifacts/`, has no I/O of its own (it operates on strings `ExecPort` already fetched/will write, per AD-1) — callers write the serialized result back via `ExecPort.writeIfUnchanged()` (Story 0.7), never a bare write, so a concurrent external edit to the story file is never silently lost
**And** a Vitest test round-trips a real story file from this repo through parse → check off one task → serialize, asserting only that one line changed

### Story 1.2: Build the sprint-status.yaml parser/serializer

As a developer building any node that transitions a story's status,
I want a comment-preserving `parse-sprint-status.ts` module,
So that the orchestrator can read and write real status transitions without destroying this repo's real inline comments.

**Acceptance Criteria:**

**Given** a real `sprint-status.yaml` (e.g. this repo's own, with its inline comment above the `0-7` entry)
**When** `parseSprintStatus()` reads it and `setStoryStatus()` writes a new status for one key
**Then** the `yaml` package's Document API is used (not a parse-then-stringify round trip), and re-serializing preserves every existing comment and key order untouched except the one status value that changed
**And** given `setStoryStatus()` is called with a value outside BMad's real enum (`backlog`/`ready-for-dev`/`in-progress`/`review`/`done` for stories), it throws rather than writing an invented status
**And** callers write the serialized result back via `ExecPort.writeIfUnchanged()` (Story 0.7), never a bare write — a human hand-editing `sprint-status.yaml` mid-run is detected, not clobbered
**And** a Vitest test round-trips this repo's real `sprint-status.yaml` through parse → change one story's status → serialize, asserting the file's comments and every other entry are byte-identical

### Story 1.3: Speed Worker implements a story's task checklist

As a developer running the orchestrator,
I want the Speed Worker node to implement a story's standard/boilerplate tasks from its real story file,
So that simple stories can be built without invoking the heavier Complex Worker.

**Acceptance Criteria:**

**Given** a materialized story file with an unchecked task list, tagged `standard`
**When** the Speed Worker node runs
**Then** it calls `LLMPort.complete({ role: 'speed', ... })`, writes the resulting code changes via `ExecPort`, and checks off completed tasks in the story file
**And** it never calls `LLMPort` with `role: 'complex'`
**And** a Vitest test using the Epic 0 fakes drives the node from a sample story file to checked-off tasks with predictable fake LLM output

### Story 1.4: Complex Worker implements complex work and performs Tier-1 review

As a developer running the orchestrator,
I want the Complex Worker node to implement complex/DB-migration stories and act as the Tier-1 Reviewer for any story,
So that both roles share the deepest-reasoning model.

**Acceptance Criteria:**

**Given** a materialized story file tagged `complex`
**When** the Complex Worker node runs in implementation mode
**Then** it calls `LLMPort.complete({ role: 'complex', ... })` and writes code changes via `ExecPort`
**And** given it runs in review mode against a finished diff, it returns exactly one of `APPROVE`/`AUTO_FIX`/`NEEDS_HUMAN` per the Tier-1 rubric (architecture deviation, ambiguous ACs, security-sensitive surface, or attempt-ceiling reached)
**And** given the LLM's response can't be parsed into exactly one of those three values (hallucinated wording, truncated output, extra prose around the verdict), the node treats it as `NEEDS_HUMAN` with a reason of "could not parse review verdict" — never silently defaults to `APPROVE`, retries invisibly, or crashes the run
**And** a Vitest suite covers all three verdict paths plus the unparseable-response path, using the fake LLM adapter

### Story 1.5: Tester runs real build/test and classifies failures

As a developer running the orchestrator,
I want the Tester node to run the target project's actual build/test commands and classify the results,
So that a failure is understood, not just dumped as raw logs.

**Acceptance Criteria:**

**Given** `TARGET_REPO_PATH` has a real `package.json` with `build`/`test` scripts and dependencies already installed (fresh-clone dependency install is a pre-flight concern, see Story 1.9 — Tester assumes a ready-to-run repo, it doesn't install anything itself)
**When** the Tester node runs after an implementation step
**Then** it invokes those scripts via `ExecPort.run`, and given the run fails, calls `LLMPort.complete({ role: 'tester', ... })` with the raw output to classify it into a structured report (`pass`, or `fail` with the specific failing test/lint rule identified — never a raw log dump handed upstream)
**And** given the failure is a trivial lint issue, it auto-fixes it (e.g. via the project's own lint `--fix`) and re-runs without escalation, without necessarily needing the LLM call for that mechanical case
**And** a Vitest test runs against a small real fixture project with one intentionally failing test, using the fake LLM adapter (Story 0.8) for the classification call, asserting the resulting structured report

### Story 1.6: AUTO_FIX retry loop with shared, ceiling-enforced attempts

As a developer running the orchestrator,
I want an `AUTO_FIX` verdict to trigger the reviewing node applying its own patch and looping back through Tester, bounded by a shared attempt ceiling,
So that a stuck story can't loop forever.

**Acceptance Criteria:**

**Given** a Tier-1 verdict of `AUTO_FIX`
**When** the Complex Worker node applies its own patch in the same call
**Then** `story.autoFixAttempts` increments (tier-agnostic, regardless of the following Tester outcome — the single authoritative rule) and the graph transitions to Tester
**And** given `autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS` (env, default 1) on the next review call, the node short-circuits straight to `NEEDS_HUMAN` with no further LLM call
**And** given a story reaches `NEEDS_HUMAN` in Epic 1's scope (no HITL node yet), the process exits with a clear message identifying the story and reason, non-zero exit code
**And** a Vitest test drives a story through one failed AUTO_FIX round to confirm the ceiling forces exit rather than a second attempt at the default

### Story 1.7: Tier-2 Deep Code Review gates checkpoint

As a developer trusting the orchestrator's commits,
I want a second, deeper adversarial review to run whenever Tier-1 approves,
So that a story isn't checkpointed on a shallow first pass.

**Acceptance Criteria:**

**Given** a Tier-1 verdict of `APPROVE`
**When** the `DeepCodeReviewNode` runs its three parallel lenses (correctness, edge-case coverage, acceptance-criteria coverage) against `current_code` — deliberately the same `ORCH_MODEL_COMPLEX` model as Tier-1/implementation for complex stories (confirmed decision, not an oversight: independence comes from differentiated adversarial prompts/personas per lens, matching real `bmad-code-review`'s approach, not from a different model; revisit only if complex-story reviews prove to rubber-stamp in practice)
**Then** it returns one of the same `APPROVE`/`AUTO_FIX`/`NEEDS_HUMAN` values, appending its findings to the story file
**And** given it returns `AUTO_FIX`, it applies its own patch in the same call and the graph transitions to Tester, consuming the same shared `autoFixAttempts` budget as Tier-1 (Story 1.6)
**And** given it returns `APPROVE`, the graph transitions to `GitCheckpoint`
**And** given any of the three lenses' responses can't be parsed into a valid verdict, that lens is treated as `NEEDS_HUMAN` (same handling as Story 1.4's Tier-1 parse failure) rather than silently excluded from the aggregate
**And** a Vitest test confirms Tier-2 never runs when Tier-1 returned `AUTO_FIX` or `NEEDS_HUMAN`, and a second test covers one lens returning an unparseable response

### Story 1.8: Git Checkpoint commits a completed story

As a developer trusting the orchestrator with a live repo,
I want it to refuse to start on a dirty working tree and commit exactly once per completed story,
So that its autonomous commits are safe and traceable.

**Acceptance Criteria:**

**Given** `TARGET_REPO_PATH` has any pre-existing uncommitted or untracked change
**When** the orchestrator starts a run
**Then** it refuses to start (hard error), naming the dirty paths, before touching anything
**And** given both review tiers return `APPROVE` for a story
**When** `GitCheckpoint` runs
**Then** it calls `ExecPort.getWrittenPaths()` (Story 0.7) and issues `git add <those paths>` — never `git add -A` — then `git commit` (message references the story's `epics.md` key) via `ExecPort`, covering the code changes, the updated story file, and the `sprint-status.yaml` entry flipped to `done`, and never `git push`
**And** staging only the tracked paths (not the whole tree) means a human editing an unrelated file elsewhere in `TARGET_REPO_PATH` at any point during a long-running multi-story epic is never swept into the commit — the dirty-tree gate (Story 1.9) only needs to hold at run start, not for the run's entire duration
**And** after a successful commit, it calls `ExecPort.resetWrittenPaths()` so the next story starts tracking from empty
**And** given `git commit` itself exits non-zero (a pre-commit hook rejects it, disk full — distinct from `ExecPort`'s spawn-failure case), `GitCheckpoint` does not retry or guess at a resolution: it routes to `NEEDS_HUMAN`, leaving the staged-but-uncommitted state exactly as git left it for the human to inspect
**And** a Vitest test against a real scratch git repo confirms exactly one commit is created containing only the tracked paths — asserting a file manually added to the repo outside the tracked set is **not** included — and a second test with a rejecting pre-commit hook confirms the `NEEDS_HUMAN` route instead of a silent failure or a retry loop

### Story 1.9: Wire the single-story pipeline end to end

As a developer,
I want a runnable command that drives Stories 1.1–1.8 together against one real, already-materialized story,
So that Epic 1's value is actually usable, not just unit-tested in isolation.

**Acceptance Criteria:**

**Given** a target BMad repo with one story already at `ready-for-dev` in `sprint-status.yaml`
**When** the orchestrator is invoked against that specific story
**Then** before dispatching to any node, it makes one trivial smoke-test `LLMPort.complete()` call per configured model role (`ORCH_MODEL_PLANNER`/`_COMPLEX`/`_SPEED`/`_TESTER`) and fails fast with a clear "alias X failed to resolve" message if any one of them errors — surfacing a misconfigured or unconfirmed Vertex AI provider (SPEC.md's open question) immediately, not mid-run on whichever node happens to need it first
**And** given `TARGET_REPO_PATH` has no `node_modules` (a fresh clone), this same pre-flight step runs the project's install command once before Tester ever runs, rather than Tester failing confusingly on a missing-dependency error it was never meant to diagnose
**Then** `core/graph.ts` uses `@langchain/langgraph`'s `StateGraph` to wire the nodes from Stories 1.3–1.8 as real graph nodes and edges (not ad hoc function calls), routing to Speed or Complex Worker by the story's tag, through Tester, Tier-1 review, Tier-2 review, and GitCheckpoint
**And** running it against a small real fixture BMad repo produces one real commit for a real trivial story, end to end, with no mocks
**And** the audit logger (Story 0.5) captures every step of this real run as JSONL, including the smoke-test calls

---

## Epic 2: Human-in-the-Loop Safety Net

The orchestrator recognizes when it shouldn't guess — it pauses at a terminal prompt on a risky or ambiguous verdict or a blocking failure, and escalates by email if the user doesn't respond in time, without ever giving up on the pause.

### Story 2.1: Build the Resend NotifyPort adapter

As a developer relying on HITL escalation,
I want a `NotifyPort` implementation that sends one email via Resend,
So that a stalled pause actually reaches me.

**Acceptance Criteria:**

**Given** `adapters/resend-notify-adapter.ts` and `RESEND_API_KEY`/`HITL_NOTIFY_EMAIL` configured
**When** `send({ to, subject, body })` is called
**Then** it issues a Resend API call with those fields, returning once the send succeeds
**And** given the Resend API call fails, it throws `OrchestratorError` with `recoverable: true`
**And** a Vitest suite mocks the Resend client and confirms the correct payload and both success/failure paths

### Story 2.2: Build the readline HITLPort adapter

As a developer being asked for input,
I want a terminal prompt that shows a short summary with an expand command,
So that I'm not buried in context I didn't ask for.

**Acceptance Criteria:**

**Given** `adapters/readline-hitl-adapter.ts`
**When** `prompt({ summary, expand })` is called
**Then** it prints `summary` via `readline` and waits for terminal input
**And** given the user types `show diff` or `show output`, it prints `expand()`'s return value and re-prompts, without resolving the promise
**And** given the user types anything else, `prompt()` resolves with that raw text unmodified — no parsing happens in the adapter
**And** a Vitest test drives the readline interface with scripted input, confirming expand doesn't resolve and a normal response does

### Story 2.3: Build the HITL node — timeout race and single escalation

As a developer who might be away from the terminal,
I want the HITL node to race the prompt against a timeout and send exactly one escalation email if I don't respond in time,
So that I find out even if I'm not watching.

**Acceptance Criteria:**

**Given** the HITL node is invoked with a reason and summary
**When** it runs
**Then** it calls `HITLPort.prompt()` and starts a `setTimeout(HITL_TIMEOUT_MS)` (default 300000ms) in parallel
**And** given the terminal responds before the timeout, the timer is cleared, `human_feedback` is populated, and the node resolves — no email is sent
**And** given the timeout fires first, exactly one `NotifyPort.send()` call goes out describing the pending decision, and the terminal prompt remains open and still resolves normally whenever answered afterward (no repeating alarm)
**And** given that `NotifyPort.send()` call itself throws, it is retried exactly once (Story 0.3's shared retry policy); if the retry also fails, the failure is logged prominently via the audit logger (Story 0.5) so it's visible after the fact — the terminal prompt keeps waiting regardless, this failure never crashes the run or silently vanishes
**And** a Vitest test uses fake timers to drive both the fast-response and timeout-then-late-response paths, plus a third test where the escalation send fails twice and asserts the audit log captures it

### Story 2.4: Wire HITL as the real NEEDS_HUMAN/blocking-failure destination

As a developer,
I want Epic 1's crude exit-on-NEEDS_HUMAN stand-in replaced by a real interactive pause,
So that the orchestrator actually waits for me instead of just quitting.

**Acceptance Criteria:**

**Given** a Tier-1 or Tier-2 verdict of `NEEDS_HUMAN`, or a Tester failure classified as blocking/unclassifiable (Story 1.5)
**When** that condition occurs
**Then** the graph routes to the HITL node (Story 2.3) instead of exiting the process
**And** given the human's response is unflagged plain text, the graph resumes at Planner with `human_feedback` populated (no `correct-course:` handling yet — that's Epic 4)
**And** a Vitest test replays Story 1.6's ceiling-breach scenario and confirms it now reaches an interactive HITL pause rather than `process.exit`

---

## Epic 3: Full Epic Autonomy

A user can hand the orchestrator a whole named epic and have it materialize and drive every story in that epic to completion on its own, correctly leaving any pre-existing foreign work untouched. This also needs a real `epics.md` parser and the SQLite checkpointer — Epic 1 only ever handled one story, so resumability was never needed until now.

### Story 3.1: Build the epics.md parser (read)

As a developer building the Planner's story-materialization logic,
I want a `parse-epics.ts` module that reads a real `epics.md`'s epic/story sections,
So that Planner can find a story's coarse entry before drafting its full file.

**Acceptance Criteria:**

**Given** a real `epics.md` (e.g. this repo's own)
**When** `parseEpics()` reads it
**Then** it returns each epic's dotted-key sections (`0.7a`, `1.3`, etc.) with their title and body text as structured data
**And** this module lives in `core/bmad-artifacts/`, has no I/O of its own (AD-1) — write/positional-insert capability is deliberately deferred to Epic 4, where it's first needed
**And** a Vitest test parses this repo's real `epics.md` and asserts the known Epic 0/Epic 1 section titles come back correctly

### Story 3.2: Planner materializes a story file just-in-time (Phase B)

As a developer running `dev an epic`,
I want Planner to draft a story's full file from its coarse `epics.md` entry immediately before dispatching it, including a Gate 2 (UI Complexity & Reusability) check,
So that I don't have to pre-write every story by hand.

**Acceptance Criteria:**

**Given** an epic's coarse entry (from Story 3.1) for a story with no story file yet
**When** Planner materializes it
**Then** it calls `LLMPort.complete({ role: 'planner', ... })` to draft acceptance criteria, tasks, and dev notes, runs a Gate 2 check as part of that same call, and writes the result via `parse-story-file.ts` (Story 1.1)
**And** `sprint-status.yaml`'s entry for that story flips from `backlog` to `ready-for-dev` (Story 1.2)
**And** Planner chooses the story's dash-slug filename itself (LLM judgment, not a mechanical title transform) — see `state-machines.md`'s story-key-format note
**And** given the chosen slug collides with an existing filename in `implementation_artifacts`, Planner disambiguates (e.g. appends a numeric suffix) rather than silently overwriting an unrelated file
**And** a Vitest test drives this against a fake LLM and asserts the resulting story file and `sprint-status.yaml` entry, plus a second test asserts a colliding slug is disambiguated, not overwritten

### Story 3.3: SQLite checkpointer for crash-resume

As a developer running a multi-story epic,
I want the orchestrator to persist ephemeral run-state (which story is mid-flight, its attempt count) to a local SQLite checkpoint,
So that a killed process resumes instead of restarting the whole epic.

**Acceptance Criteria:**

**Given** `@langchain/langgraph-checkpoint-sqlite` wired into the graph, keyed by a thread id derived from `TARGET_REPO_PATH` + epic name
**When** the process is killed mid-story and `dev an epic <name>` is re-invoked
**Then** it resumes from the last checkpoint (correct mid-flight story and `autoFixAttempts`) rather than restarting the epic
**And** the checkpoint never stores epic/story content itself — only `autoFixAttempts` and which story was mid-flight (AD-5)
**And** given a second `dev an epic <name>` invocation starts against the same `TARGET_REPO_PATH` + epic while a first one is still actively running, the second refuses to start (hard error naming the conflicting run) rather than racing the first on the same checkpoint and the same git commits — a lock file (or equivalent) alongside `.checkpoints/` records an active run and is cleared on clean exit
**And** a Vitest test simulates a kill-and-resume cycle against a real `.checkpoints/` SQLite file, and a second test asserts a concurrent second invocation is refused while the lock is held

### Story 3.4: Wire the dev-an-epic multi-story loop

As a developer,
I want `dev an epic <name>` to drive every story in that epic to completion on its own,
So that I don't invoke the orchestrator once per story.

**Acceptance Criteria:**

**Given** a named epic with multiple stories at various `sprint-status.yaml` states
**When** `dev an epic <name>` runs
**Then** Planner iterates the epic's stories in `epics.md` order, materializing (Story 3.2) and driving each through the Epic 1 pipeline in sequence, checkpointing resume state (Story 3.3) as it goes, until every story is `done` or the run halts at HITL
**And** given a story is already `in-progress`/`review`/`done` with no record in the current run's checkpoint, Planner leaves it untouched and advances to the next `backlog`/`ready-for-dev` story instead of reprocessing it
**And** given an epic has zero stories, or every story is foreign work with nothing left to dispatch, the run completes cleanly with a clear "nothing to do" message — not an error, and not a hang
**And** a Vitest test drives a 3-story fake epic end to end, asserting story order and that a pre-seeded foreign-work story is skipped, not touched; a second test drives an all-foreign-work epic to a clean no-op completion

---

## Epic 4: Epic Readiness & Course Correction

The orchestrator can safely take on a brand-new epic that hasn't been broken down yet (pausing for the user's sign-off before committing a plan) and react to a mid-epic course correction the user explicitly flags, without ever silently overstepping into PRD/architecture territory.

### Story 4.1: Extend epics.md parser with positional insert; build the readiness-report parser

As a developer building the readiness sweep,
I want `parse-epics.ts` to gain positional-insert write capability and a `parse-readiness-report.ts` module matching the real report shape,
So that prerequisite stories and readiness findings can actually be persisted correctly.

**Acceptance Criteria:**

**Given** `parse-epics.ts` (read-only from Story 3.1)
**When** `insertStory()` is called with a new story section and its anchor position
**Then** it inserts the full section immediately adjacent to its anchor story (never blind-appended to the end), preserving every other existing section byte-identical
**And** the caller writes the result back via `ExecPort.writeIfUnchanged()` (Story 0.7), never a bare write — a human hand-editing `epics.md` mid-run (e.g. running the real `bmad-create-epics-and-stories` in parallel) is detected, not clobbered
**And** given `parse-readiness-report.ts`
**When** it reads a real report (e.g. this repo's own `epic-1-readiness.md`)
**Then** it returns `{ epic, swept, date, addenda[], stories_covered, findings }` matching the real shape, and a write call **appends** a new `addenda` entry rather than overwriting `date`/`stories_covered`/prior findings
**And** a Vitest test round-trips this repo's real `epic-1-readiness.md`, asserting an appended addenda entry leaves everything else byte-identical

### Story 4.2: Epic Readiness Check — Gate 1 + Gate 3 sweep

As a developer starting a new epic,
I want a one-time readiness sweep before Planner dispatches its first story,
So that missing dependencies surface as a prerequisite story instead of a mid-loop Tester failure.

**Acceptance Criteria:**

**Given** an epic with no `readiness_report`, or one with `swept: false`
**When** `EpicReadinessCheckNode` runs
**Then** it calls `LLMPort.complete({ role: 'planner', ... })` to evaluate Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-cutting Dependency Completeness, including a cross-epic reuse scan of `epics.md`) against the epic's stories, the architecture reference, and `TARGET_REPO_PATH`'s actual state
**And** it writes the findings via `parse-readiness-report.ts` (Story 4.1) with `swept: true`, and inserts any new prerequisite stories into `epics.md`/`sprint-status.yaml` via Story 4.1's insert capability — never through Planner
**And** given `readiness_report.swept` is already `true` for this epic, `dev an epic <name>` skips the sweep by default; passing `--recheck-readiness` forces it anyway
**And** a Vitest test drives a fake epic missing a dependency and asserts a prerequisite story is inserted at the correct position, not appended

### Story 4.3: Planner drafts a brand-new epic decomposition with HITL confirmation (Phase A)

As a developer pointing the orchestrator at a not-yet-broken-down epic,
I want Planner to draft a coarse breakdown and pause for my confirmation before committing it,
So that an autonomous system never writes a planning document I haven't seen.

**Acceptance Criteria:**

**Given** a named epic with no entry in `epics.md` at all
**When** `dev an epic <name>` runs
**Then** Planner calls `LLMPort.complete({ role: 'planner', ... })` against the PRD and architecture reference to draft a coarse epic/story breakdown, then calls the Epic 2 HITL node with that draft as the summary — it does **not** write to `epics.md` yet
**And** given the human confirms, Planner writes the draft via Story 4.1's insert capability and proceeds to the normal per-story loop (Story 3.4)
**And** given the human's response is a rejection or edit request, Planner does not write anything and surfaces the feedback back to the human rather than guessing
**And** a Vitest test using the fake HITL adapter confirms no `epics.md` write occurs before confirmation, and one occurs immediately after

### Story 4.4: Correct-course escalation on a flagged HITL response

As a developer resolving a HITL pause,
I want to flag my response as a course correction and have the orchestrator re-sweep the epic's remaining stories instead of just unblocking one,
So that a plan-level problem doesn't get treated as a one-story fix.

**Acceptance Criteria:**

**Given** a HITL response starting with `correct-course:` (case-insensitive, whitespace-trimmed match)
**When** the HITL node inspects the resolved response
**Then** it routes to `CorrectCourseNode`, which forces `EpicReadinessCheckNode` (Story 4.2) to re-run against the epic's remaining not-yet-approved stories, seeded with the flagged text, ignoring `swept`
**And** given that forced re-sweep's own Gate 1 finds the fix needs a PRD/architecture change beyond epic scope, the node does not write anywhere — it appends the finding to the readiness report (addenda) and routes to a **second** HITL pause recommending the user run the real `bmad-correct-course`/`bmad-prd`/`bmad-architecture` skills manually
**And** given an unflagged response, this path is never triggered — Story 2.4's plain resume behavior is unchanged
**And** a Vitest test drives a flagged response through to a forced re-sweep, and a separate test drives an out-of-scope finding to the second-HITL pause without any file write beyond the addenda entry

---

## Epic 5: Manual Review & Patch Mode

A user can ask the orchestrator to review and fix an already-implemented epic's stories directly, reusing the same review/patch machinery without re-running the full autonomous dev loop.

### Story 5.1: Wire the manual review command

As a developer,
I want to trigger a review pass over an already-implemented epic's stories directly, without re-running the full autonomous dev loop,
So that I can get a second look and automatic fixes without redoing work that's already done.

**Acceptance Criteria:**

**Given** an epic whose stories are already at `review`/`done` in `sprint-status.yaml`
**When** the manual review command is invoked against that epic
**Then** each story is run through Tier-1 review (Story 1.4) and, on `APPROVE`, Tier-2 review (Story 1.7) — starting directly at review, not re-running Speed/Complex Worker's initial implementation
**And** given a verdict of `AUTO_FIX` (from either tier), the same node applies its own patch and re-runs Tester (Story 1.5) and review, exactly as in the autonomous loop — no separate patch mechanism
**And** given a story already has a checkpoint commit from an earlier `dev an epic` run, a new `AUTO_FIX`-triggered commit still fires (Story 1.8) since the code changed; a story that stays `APPROVE` on first pass with no changes does not get a redundant empty commit
**And** given a verdict of `NEEDS_HUMAN`, it routes to the same HITL node (Story 2.3/2.4) as the autonomous loop
**And** a Vitest test drives manual review against a 2-story fake epic — one story needing an `AUTO_FIX` patch, one already clean — asserting exactly one new commit for the patched story and zero for the clean one
