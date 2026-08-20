---
id: SPEC-ai-dev-orchestrator
companions: [stack.md, state-machines.md]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# AI Dev Orchestrator (Spec-Driven Development Orchestrator)

## Why

A vision to realize: the user wants a locally-run, autonomous agent system that carries out spec-driven software development — decomposing a spec into epics and stories, implementing them, testing them, and reviewing them — without a human manually invoking each step, while still keeping a human in the loop for judgment calls the system cannot safely make alone. This is a standalone dev-tooling project, separate from the festgrid product, built to prove out a LangGraph-based multi-model orchestration pattern before any integration with real project artifacts is considered.

## Capabilities

- **CAP-1**
  - **intent:** The Planner/Architect node can read a spec.md and decompose it into architecture notes, constraints, epics, and user stories.
  - **success:** Given a spec.md, the tasks_queue is populated with a structured set of epics and stories traceable back to the spec's capabilities.

- **CAP-2**
  - **intent:** The Complex Worker/Reviewer node can implement complex algorithmic work and Drizzle database schema migrations, and can review any node's output for alignment with spec.md.
  - **success:** A queued story tagged complex is implemented by this node, and a review pass returns exactly one of APPROVE, AUTO_FIX, or NEEDS_HUMAN.

- **CAP-3**
  - **intent:** The Speed Worker node can implement standard boilerplate, UI components, and API routes from a queued story quickly.
  - **success:** A queued story tagged standard/boilerplate is implemented by this node without invoking the Complex Worker.

- **CAP-4**
  - **intent:** The Tester/Utility node can run build and test shell commands against the target repo, parse terminal output, classify failures, auto-fix basic lint issues, and prepare a report.
  - **success:** After any implementation step, running the Tester node yields a pass/fail report with failures classified rather than raw log dumps, and trivial lint failures are fixed without escalation.

- **CAP-5**
  - **intent:** A user can invoke "dev an epic" and have the system autonomously drive the full loop — create story, implement, test, review — across every story in that epic without a manual invocation per story.
  - **success:** Running "dev an epic \<name\>" against a spec.md with N stories in that epic completes all N stories (or halts at a HITL pause) without the user re-invoking the command between stories.

- **CAP-6**
  - **intent:** A user can manually trigger a review pass over an already-implemented epic and its stories, independent of the dev-an-epic loop, and have the system apply patches implementing the review's recommendations.
  - **success:** Invoking manual review against a completed epic runs the Reviewer node over every story; any AUTO_FIX verdict results in the corresponding worker node applying the recommended patch and re-running the Tester node, without a separate dev-an-epic invocation.

- **CAP-7**
  - **intent:** The system can pause and prompt for terminal input whenever a Reviewer verdict is NEEDS_HUMAN or the Tester hits a blocking, unclassifiable failure.
  - **success:** A NEEDS_HUMAN verdict or blocking Tester failure halts graph progression at a terminal prompt and resumes only once a response is given.

- **CAP-8**
  - **intent:** If a terminal HITL prompt goes unanswered within a configurable timeout, the system can escalate by sending a notification email to an env-configured address, while the terminal prompt keeps waiting.
  - **success:** Leaving a HITL prompt unanswered past the configured timeout (default 5 minutes) triggers exactly one email to the configured address, and the terminal prompt still accepts a response afterward.

- **CAP-9**
  - **intent:** Every node's LLM calls can be routed through the user's self-hosted 9Router gateway, with each node's model resolved from a configured alias rather than a hardcoded model name.
  - **success:** Changing a node's configured alias changes which model actually serves that node's calls, with no code change required.

- **CAP-10**
  - **intent:** The orchestrator can read/write files and execute shell commands against a single, config-pointed local target repository.
  - **success:** Setting TARGET_REPO_PATH to a local git repo causes all file and command operations for a run to occur only inside that repo.

- **CAP-11**
  - **intent:** The system can create a local git checkpoint commit after a story reaches an APPROVE verdict.
  - **success:** After a story's Reviewer verdict is APPROVE, TARGET_REPO_PATH has exactly one new commit containing that story's changes, created before the next story starts or the run ends.

## Constraints

- Must run entirely locally in a Node.js/VS Code environment — no cloud orchestration service or hosted multi-tenant deployment.
- All LLM calls must go through 9Router's OpenAI-compatible endpoint with Bearer auth; model IDs are resolved from configured aliases only, never hardcoded literal model names (see `stack.md`).
- v1 must not read or write this project's real `_bmad-output` artifacts (epics, story files, `sprint-status.yaml`) — it operates only against `TARGET_REPO_PATH`.
- `GraphState` fields are fixed to: `spec`, `tasks_queue`, `current_code`, `terminal_output`, `error_status`, `human_feedback` — no ad hoc state additions without revising this contract.
- HITL timeout escalation is email-only via one env-configured address — no other notification channel in v1.
- Reviewer verdict is constrained to exactly `APPROVE`, `AUTO_FIX`, or `NEEDS_HUMAN` — no free-form review outcomes (rubric in `state-machines.md`).
- Checkpoint commits are automatic per completed story (triggered only by APPROVE, not by every node/state transition, to avoid noisy commits from AUTO_FIX churn); the orchestrator must never push or force-push automatically — all remote git operations stay manual.
- AUTO_FIX retry ceiling is configurable via `MAX_AUTO_FIX_ATTEMPTS` (default 1, fail-fast); exceeding it forces a NEEDS_HUMAN verdict regardless of what the rubric would otherwise say.

## Non-goals

- Not a festgrid product feature; does not touch this repo's real BMad artifacts in v1.
- Not a hosted or multi-user service — single local user, one target repo per run.
- Does not build or host 9Router itself — assumes it is already running and configured.
- No Telegram or other chat-app notification channel in v1.
- No web/GUI HITL interface — terminal-only interaction in v1.

## Success signal

Given a `spec.md` placed at `TARGET_REPO_PATH`'s root and 9Router running with configured model aliases, running `dev an epic <name>` autonomously creates and implements every story in that epic, runs build/test after each story, and either completes the epic with all Tester checks green or pauses at a terminal HITL prompt on a `NEEDS_HUMAN` verdict or a blocking test failure — escalating to the configured email if unanswered past the configured timeout.

## Assumptions

- Assumed Node.js 20+ and TypeScript, matching 9Router's own requirements and the stated stack.
- Assumed a single target repo and session at a time — no concurrent multi-repo orchestration, since nothing in the input mentions parallelism.
- Assumed email escalation uses a simple SMTP or HTTP transactional-email mechanism configured via env vars; exact provider is unspecified and left to the architecture phase.
- Assumed `tasks_queue` is epic-and-story shaped rather than a flat task list, matching the "epics and user stories" language in the input.
- Assumed "current stacks" in the original brief refers to whatever `TARGET_REPO_PATH`'s codebase already uses (detected, not fixed), consistent with the standalone-sandbox v1 scope.
- Assumed Gemini 3.5 Flash Lite (available via Vertex AI alongside 3.5 Flash) is left unassigned by default — the same `ORCH_MODEL_TESTER` env var can point Tester/Utility at it instead of 3.5 Flash for lower cost.

## Open Questions

- Is Vertex AI already configured as a provider in the user's 9Router instance (GCP project + service account)? CAP-9's Gemini-routed nodes (Complex Worker/Reviewer, Tester/Utility) depend on this being set up; unconfirmed, so treat as a prerequisite to verify before or during the architecture phase.
- Graduation criteria for moving from standalone-sandbox mode to real BMad-artifact integration (phase 2) are deliberately left fully open — explicitly out of v1 scope, to be defined only after the sandbox version has actually been used.
