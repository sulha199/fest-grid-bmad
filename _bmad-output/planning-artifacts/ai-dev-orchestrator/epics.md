---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics"]
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
Establish the hexagonal core skeleton (ports, adapters, composition root), 9Router-routed LLM adapter, local exec adapter, config loading, and audit logging that every subsequent epic builds on. No end-user-observable behavior on its own — matches this repo's own Epic 0 precedent for irreducible technical setup on a greenfield project.
**Additional Requirements covered:** AD-1 (ports/adapters/composition root), AD-6 (alias-indirect model resolution), AD-7 (fail-fast centralized config), AD-8 (append-only audit log), Stack (Node 22, pnpm, TypeScript, ESLint, core dependencies)

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
