# Stack & Integration Notes

Companion to [SPEC.md](SPEC.md). Holds HOW-level detail the kernel intentionally omits — implementation prescription, not intent.

## Runtime

- Node.js 22 (matches this repo's `engines: {node: ">=22.0.0"}` and the actual installed version — not 24), TypeScript, run locally (VS Code terminal or standalone CLI). Package manager: pnpm (matches this repo's pinned `packageManager`). Own standalone ESLint 9.x flat config for linting the orchestrator's own source.
- Core dependency: `@langchain/langgraph` for the state machine; `openai` SDK (or any OpenAI-SDK-compatible client) pointed at 9Router.
- Local capabilities: `node:fs` for spec/code read-write, `node:child_process` for shell command execution (build/test/lint), `node:readline` (or similar) for terminal HITL prompts, `fetch`/`http`-based email send for timeout escalation.
- A YAML parser/serializer (e.g. `yaml`) is required to read and write `sprint-status.yaml` in place — the parse/write round-trip must preserve the file's existing comments and key order (this repo's real `sprint-status.yaml` carries inline comments like `# reset from review to ready-for-dev 2026-08-05 — ...`), so a comment-preserving YAML library is required, not a naive parse-then-stringify that would silently drop them. Exact library choice (`yaml` package's document/CST API vs. an alternative) is left to the architecture phase.

## 9Router integration

- Base URL: `http://localhost:20128/v1` (self-hosted, [decolua/9router](https://github.com/decolua/9router)).
- Auth: `Authorization: Bearer <API_KEY>` — key generated in the 9Router dashboard, supplied via env var (e.g. `NINE_ROUTER_API_KEY`).
- Model IDs are provider-prefixed or user-defined combo aliases — **never hardcode a bare model name in code**; resolve each node's model through a configured alias instead.
- Confirmed real providers/models available through 9Router: **Claude** (Sonnet, Haiku) and **Gemini via Vertex AI** (3.1 Pro, 3.5 Flash, 3.5 Flash Lite). Vertex AI access typically requires GCP project/service-account auth configured on the 9Router side (not a bare API key) — **unconfirmed whether this is already set up** (see SPEC.md Open Questions); verify before relying on Gemini-routed nodes.
- **Decided:** each of the 4 node roles resolves its model via one env var per node (not a config file) — fallback-chain behavior is left to 9Router's own combo aliases rather than duplicated here:

  | Node role | Alias env var | Assigned model | Rationale |
  |---|---|---|---|
  | Planner/Architect | `ORCH_MODEL_PLANNER` | Claude Sonnet | strong reasoning, large context for spec decomposition |
  | Complex Worker/Reviewer | `ORCH_MODEL_COMPLEX` | Gemini 3.1 Pro (Vertex AI) | strongest reasoning/coding available for complex implementation + review |
  | Speed Worker | `ORCH_MODEL_SPEED` | Claude Haiku | fast, cheap, good at boilerplate |
  | Tester/Utility | `ORCH_MODEL_TESTER` | Gemini 3.5 Flash (Vertex AI) | fast, cheap, good at structured log parsing; 3.5 Flash Lite available as an even cheaper swap via the same env var |

## Environment variables (known so far)

- `NINE_ROUTER_BASE_URL` (default `http://localhost:20128/v1`)
- `NINE_ROUTER_API_KEY`
- `ORCH_MODEL_PLANNER`, `ORCH_MODEL_COMPLEX`, `ORCH_MODEL_SPEED`, `ORCH_MODEL_TESTER` (or equivalent single config file — TBD)
- `TARGET_REPO_PATH` — local git repo the orchestrator reads/writes/executes against
- `HITL_NOTIFY_EMAIL` — destination address for timeout escalation
- `HITL_TIMEOUT_MS` (default 300000 / 5 minutes)
- `MAX_AUTO_FIX_ATTEMPTS` (default 1) — AUTO_FIX retries on a story before forcing NEEDS_HUMAN
- Transactional email API key (e.g. Resend/Postmark/SES) — **decided**: HITL timeout escalation sends via a transactional email API (HTTP POST + API key), not raw SMTP

## Target repo assumptions

- `TARGET_REPO_PATH` points at an existing local git repository the user chooses per run (config-pointed) that is **BMad-managed** (has `_bmad/` and `_bmad-output/`) — this is now a hard requirement, not an assumption, since the orchestrator reads/writes real BMad artifacts. It may be this repo (`festgrid/bmad`) itself.
- The orchestrator reads whatever stack that repo already uses rather than assuming a fixed tech stack — "current stacks" in the original brief means the target repo's stack, detected at runtime, not a stack fixed by this spec.
- Path resolution (`planning_artifacts`, `implementation_artifacts`, the PRD/architecture reference) is read from the target project's own **`_bmad/bmm/config.yaml`** (not `_bmad/core/config.yaml` — that file lacks these keys; confirmed against the real `bmad-epic-readiness-check` skill's own path resolution) and `_bmad-output/project-context.md` at run start, not hardcoded — so the orchestrator works against any BMad project, not only festgrid.
- **Decided (previously open):** the orchestrator refuses to run when `TARGET_REPO_PATH` has uncommitted changes at run start (`git status --porcelain` pre-flight gate) — see `state-machines.md`'s Dirty-tree pre-flight gate section. This directly protects a live repo (this one included) from having unrelated human work folded into an autonomous commit.
