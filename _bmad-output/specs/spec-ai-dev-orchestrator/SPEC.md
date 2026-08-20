---
id: SPEC-ai-dev-orchestrator
companions: [stack.md, state-machines.md, ../../planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# AI Dev Orchestrator (BMad-Native Development Automation)

## Why

A vision to realize: an autonomous, locally-run system that carries out BMad's own development ritual — epic readiness, story creation, implementation, testing, two-tier review, and checkpointing — without a human manually invoking each `bmad-*` skill in turn, while keeping a human in the loop for judgment calls the system cannot safely make alone. This is **BMad-native**, not a parallel invented format: it reads and writes the exact real artifacts BMad's own skills use (`epics.md`, individual story files, `sprint-status.yaml`, epic readiness reports), so a human can pick up mid-epic with the real `bmad-*` skills at any point and vice versa. It targets any BMad-managed project, including this repo.

## Capabilities

- **CAP-1**
  - **intent:** The Planner can, for a named epic: (Phase A) draft that epic's coarse breakdown from the target project's PRD and architecture reference if no `epics.md` entry exists yet (matching `bmad-create-epics-and-stories`), pausing for a HITL confirmation before the draft is committed to `epics.md` — since it's itself a planning document a human hasn't reviewed yet — and (Phase B) immediately before dispatching a specific story, materialize that story's full file — acceptance criteria, tasks, dev notes, including a Gate 2 (UI Complexity & Reusability) check — into the project's implementation artifacts (matching `bmad-create-story`), flipping that story's `sprint-status.yaml` entry from `backlog` to `ready-for-dev`. Planner never dispatches a story already at `in-progress`/`review`/`done` with no record in the current run (foreign work) — it skips to the next `backlog`/`ready-for-dev` story instead.
  - **success:** Given a target project whose `epics.md` has no entry for the named epic, running `dev an epic <name>` drafts a coarse epic/story breakdown, pauses for human confirmation, and only then writes it into `epics.md`; immediately before each story is dispatched, its full story file exists in `implementation_artifacts` and `sprint-status.yaml` shows `ready-for-dev` for that story key. A story already `in-progress`/`review`/`done` from outside this run is left untouched, not silently resumed or reprocessed.

- **CAP-2**
  - **intent:** The Complex Worker/Reviewer node can implement complex algorithmic work and Drizzle database schema migrations per a story's real acceptance criteria, and can review any node's output for alignment with the story file and the architecture reference.
  - **success:** A queued story tagged complex is implemented against its real story file's tasks/ACs by this node, and a review pass returns exactly one of `APPROVE`, `AUTO_FIX`, or `NEEDS_HUMAN`.

- **CAP-3**
  - **intent:** The Speed Worker node can implement standard boilerplate, UI components, and API routes from a story's real task checklist quickly, checking off tasks in the story file as they complete.
  - **success:** A queued story tagged standard/boilerplate is implemented by this node without invoking the Complex Worker, and its story file's task checkboxes reflect completed work.

- **CAP-4**
  - **intent:** The Tester/Utility node can run the target project's actual build and test commands, parse terminal output, classify failures, auto-fix basic lint issues, and prepare a report.
  - **success:** After any implementation step, running the Tester node yields a pass/fail report with failures classified rather than raw log dumps, and trivial lint failures are fixed without escalation.

- **CAP-5**
  - **intent:** A user can invoke "dev an epic" and have the system autonomously drive the full BMad ritual — epic readiness (once), story materialization, implementation, test, two-tier review, checkpoint — across every story in that epic without a manual invocation per story.
  - **success:** Running `dev an epic <name>` against a target project with N stories in that epic (existing or newly decomposed) completes all N stories (or halts at a HITL pause) without the user re-invoking the command between stories, with `sprint-status.yaml` reflecting real progress throughout.

- **CAP-6**
  - **intent:** A user can manually trigger a review pass over an already-implemented epic and its stories, independent of the dev-an-epic loop, and have the system apply patches implementing the review's recommendations directly to the real story files.
  - **success:** Invoking manual review against a completed epic runs the Reviewer node over every story; any `AUTO_FIX` verdict results in the Complex Worker/Reviewer node itself applying the recommended patch and re-running Tester, without a separate `dev an epic` invocation.

- **CAP-7**
  - **intent:** The system can pause and prompt for terminal input whenever a Reviewer verdict is `NEEDS_HUMAN`, the Tester hits a blocking, unclassifiable failure, a readiness sweep determines the fix requires a PRD/architecture change beyond epic scope, or Planner has drafted a brand-new epic decomposition awaiting confirmation before it's written to `epics.md` (CAP-1 Phase A).
  - **success:** Any of those triggers halts graph progression at a terminal prompt and resumes only once a response is given; `sprint-status.yaml` is never written with an invented status to represent this pause.

- **CAP-8**
  - **intent:** If a terminal HITL prompt goes unanswered within a configurable timeout, the system can escalate by sending a notification email to an env-configured address, while the terminal prompt keeps waiting.
  - **success:** Leaving a HITL prompt unanswered past the configured timeout (default 5 minutes) triggers exactly one email to the configured address, and the terminal prompt still accepts a response afterward.

- **CAP-9**
  - **intent:** Every node's LLM calls can be routed through the user's self-hosted 9Router gateway, with each node's model resolved from a configured alias rather than a hardcoded model name.
  - **success:** Changing a node's configured alias changes which model actually serves that node's calls, with no code change required.

- **CAP-10**
  - **intent:** The orchestrator can read/write files and execute shell commands against a single, config-pointed local target repository — which may be this repo itself.
  - **success:** Setting `TARGET_REPO_PATH` to any local BMad-managed git repo (including this one) causes all file and command operations for a run to occur only inside that repo, using that repo's own real `_bmad-output` artifacts.

- **CAP-11**
  - **intent:** The system can create a local git checkpoint commit after a story reaches an `APPROVE` verdict from both review tiers.
  - **success:** After a story clears both tiers, `TARGET_REPO_PATH` has exactly one new commit containing that story's code changes plus its updated story file and `sprint-status.yaml` entry, created before the next story starts or the run ends.

- **CAP-12**
  - **intent:** Matching real `bmad-epic-readiness-check` exactly: before starting the per-story dev loop on an epic, the system can run Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-cutting Dependency Completeness, including cross-epic reuse scan) once against that epic's full story set, write the epic's readiness report (with a `swept` field; a later correction appends an `addenda` entry rather than overwriting, see Constraints), and insert any new prerequisite stories as full sections into `epics.md` at the correct position plus corresponding `backlog` entries into `sprint-status.yaml`. Mandatory the first time an epic is touched (no readiness report exists, or its `swept` field is false); optional thereafter (skipped by default, re-runnable on request).
  - **success:** Given an epic whose stories assume a dependency `TARGET_REPO_PATH` doesn't yet have, the first `dev an epic <name>` run inserts a prerequisite story into `epics.md`/`sprint-status.yaml` before the dependent story runs. A second invocation on the same epic skips the sweep by default since `readiness_report`'s `swept` field is already true, unless the user forces a re-check.

- **CAP-13**
  - **intent:** When a story's Tier-1 Reviewer verdict is `APPROVE`, the system can run a second, deeper adversarial review of the finished diff against the story file's real acceptance criteria before committing, append its findings to the story file, and downgrade the verdict if it finds something the first pass missed.
  - **success:** A story whose Tier-1 verdict is `APPROVE` but whose Tier-2 review finds an uncovered edge case or an acceptance-criteria gap does not get checkpointed — it downgrades to `AUTO_FIX` or `NEEDS_HUMAN`, and only a story clearing both passes is committed and marked `done` in `sprint-status.yaml`.

- **CAP-14**
  - **intent:** A human resolving a HITL pause can flag their response as requiring a course correction rather than a simple unblock, triggering a forced re-run of CAP-12's readiness sweep against the epic's remaining not-yet-approved stories (seeded with the stated change), re-scoping/reordering real `epics.md`/`sprint-status.yaml` entries before the loop resumes. The system never autonomously edits the PRD or architecture reference; if the re-sweep itself determines the fix needs to go beyond epic scope, it halts at a second HITL pause recommending the user run the real `bmad-correct-course`/`bmad-prd`/`bmad-architecture` skills manually.
  - **success:** A HITL response flagged as a correction (e.g. a `correct-course:` prefix) re-runs CAP-12 against the epic's remaining stories with the new constraint applied; an unflagged response just unblocks the current story as before. A re-sweep that finds an architecture/PRD-level gap halts at HITL rather than silently proceeding or silently editing planning documents.

## Constraints

- Must run entirely locally in a Node.js/VS Code environment — no cloud orchestration service or hosted multi-tenant deployment.
- All LLM calls must go through 9Router's OpenAI-compatible endpoint with Bearer auth; model IDs are resolved from configured aliases only, never hardcoded literal model names (see `stack.md`).
- `TARGET_REPO_PATH` must be a BMad-managed project (has `_bmad/` and `_bmad-output/`) — it may be this repo. There is no separate standalone-sandbox mode; real BMad artifacts are the only supported target.
- `GraphState` fields are fixed to: `spec`, `tasks_queue`, `current_code`, `terminal_output`, `error_status`, `human_feedback` — no ad hoc state additions without revising this contract. `tasks_queue` is a fresh in-memory parse of `epics.md`/`sprint-status.yaml`/materialized story files, re-read as needed — never itself the durable copy; the real files are.
- `sprint-status.yaml` story/epic status values are constrained to BMad's real enum only (`backlog`, `ready-for-dev`, `in-progress`, `review`, `done` for stories; `backlog`, `in-progress`, `done` for epics). The orchestrator never invents a new status value; a HITL pause is tracked only in ephemeral run-state, never written into this file.
- Write ownership over real artifacts is scoped per file and per real-BMad-skill-equivalent (see `state-machines.md`) — no two nodes write the same file range for the same reason; enforced by the graph's sequential per-story/epic execution, not by a single blanket writer.
- HITL timeout escalation is email-only via one env-configured address — no other notification channel in v1.
- Reviewer verdict is constrained to exactly `APPROVE`, `AUTO_FIX`, or `NEEDS_HUMAN` — no free-form review outcomes (rubric in `state-machines.md`).
- Checkpoint commits are automatic per completed story (triggered only once both review tiers return APPROVE, not by every node/state transition, to avoid noisy commits from AUTO_FIX churn); the orchestrator must never push or force-push automatically — all remote git operations stay manual.
- AUTO_FIX retry ceiling is configurable via `MAX_AUTO_FIX_ATTEMPTS` (default 1, fail-fast), shared across both review tiers; exceeding it forces a NEEDS_HUMAN verdict regardless of what the rubric would otherwise say.
- The deep code review (CAP-13) runs only when the Tier-1 Reviewer verdict is APPROVE, never on every AUTO_FIX iteration — cost stays proportionate to a story actually finishing, not to every retry.
- The orchestrator never autonomously edits a target project's PRD or architecture reference — CAP-14's correct-course action is scoped to `epics.md`/`sprint-status.yaml`/readiness reports; anything beyond that halts at HITL with a recommendation to run the real `bmad-*` planning skills.
- The orchestrator refuses to start a run against a `TARGET_REPO_PATH` with any pre-existing uncommitted or untracked change (hard error, not a warning) — required for `git add -A` checkpointing (CAP-11) to be safe, and required specifically because this repo is a valid target that a human may actively be working in.
- The orchestrator never touches a story already `in-progress`/`review`/`done` that has no record in the current run (foreign work produced outside the orchestrator) without an explicit user opt-in naming that story.
- A brand-new epic decomposition (CAP-1 Phase A, when `epics.md` has no entry for the named epic yet) is never written without a HITL confirmation first — `epics.md` is itself a planning document.
- A correction to an already-swept epic readiness report (CAP-14) appends a new `addenda` entry — it never wholesale-overwrites a prior report's findings/`stories_covered`.

## Non-goals

- Not a hosted or multi-user service — single local user, one target repo per run.
- Does not build or host 9Router itself — assumes it is already running and configured.
- No Telegram or other chat-app notification channel in v1.
- No web/GUI HITL interface — terminal-only interaction in v1.
- Does not autonomously rewrite a PRD or architecture document — see Constraints.
- Does not manage multiple epics or target repos concurrently in one run.

## Success signal

Given a target BMad project at `TARGET_REPO_PATH` (which may be this repo) with 9Router running and configured model aliases, running `dev an epic <name>` runs the epic readiness sweep if needed, materializes and implements every story in that epic against the project's real conventions, runs the project's real build/test commands after each story, passes both review tiers, and either completes the epic with `sprint-status.yaml` showing every story `done` or pauses at a terminal HITL prompt on a `NEEDS_HUMAN` verdict, a blocking test failure, or an out-of-epic-scope readiness finding — escalating to the configured email if unanswered past the configured timeout. A human could resume any paused or completed epic using the real `bmad-*` skills without any translation step.

## Assumptions

- Assumed Node.js 22 (validated against this repo's `engines` field and the actual installed version, not 24) and TypeScript, matching 9Router's own requirements and the stated stack.
- Assumed a single target repo and session at a time — no concurrent multi-repo orchestration, since nothing in the input mentions parallelism.
- Assumed email escalation uses a transactional email API (Resend) configured via env vars.
- Assumed the target project's own `_bmad/bmm/config.yaml` (confirmed the correct file — `_bmad/core/config.yaml` lacks these keys) and `_bmad-output/project-context.md` are the source of truth for resolving `planning_artifacts`/`implementation_artifacts` paths and the PRD/architecture reference locations, generalizing beyond festgrid specifically to any BMad-managed target.
- Assumed Gemini 3.5 Flash Lite (available via Vertex AI alongside 3.5 Flash) is left unassigned by default — the same `ORCH_MODEL_TESTER` env var can point Tester/Utility at it instead of 3.5 Flash for lower cost.
- Assumed the real story-file template's exact section layout (frontmatter, ACs, Tasks, Dev Notes) is read from the target project's own `bmad-create-story` skill assets at run time rather than hardcoded, so the orchestrator stays correct if that template evolves.

## Open Questions

- Is Vertex AI already configured as a provider in the user's 9Router instance (GCP project + service account)? CAP-9's Gemini-routed nodes (Complex Worker/Reviewer, Tester/Utility) depend on it. Unconfirmed — a prerequisite to verify before or during the architecture phase.
