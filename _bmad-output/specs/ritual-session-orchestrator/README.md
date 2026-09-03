# Ritual Session Orchestrator (built + verified)

Status: **working, tested end-to-end 2026-09-03.** Separate from `_bmad-output/specs/spec-ai-dev-orchestrator/` by design — that SPEC reimplements each BMad ritual as a direct-LLM-call LangGraph node with no Claude Code session involved anywhere; this is the opposite approach: run the *real* `bmad-*` skill inside a real agentic session, as an independent child process, and relay whatever question it raises to a human through the mailbox mechanism below.

## Why this exists

Running `bmad-create-story` for a batch of stories by hand (2026-09-03, Story 3.4n) hit a real failure mode: a backgrounded `claude -p ... --output-format text` process blocked silently on an `AskUserQuestion` tool call. Cross-session text messaging into that process could not answer it. That's structural: a detached process's stdin/stdout has no shared channel for "here is a pending question, here is its answer."

Two earlier directions were explored and rejected before landing here — recorded so they aren't re-derived:

1. *Cloud routines* (`RemoteTrigger`/`/schedule`) — rejected: a routine clones from a GitHub URL into an isolated cloud sandbox, never touching the local working tree. Wrong fit for "I want local changes."
2. *Just run everything inline in one interactive session, sequentially* — technically sound (this is literally how 3.4n itself got created) and still a fine fallback, but doesn't give independent per-skill child processes with their own model/provider, which is what was actually asked for.

## The mechanism: a file-based mailbox between an independent child and the session you're watching

`mailbox-runner/` is a small standalone Node/TS tool (outside the pnpm workspace on purpose — see its `package.json` — this is orchestrator tooling, not FestGrid app code). `run-ritual.ts` drives one ritual as its own Claude Agent SDK `query()` session — a genuinely separate process, its own model/provider config, its own git-visible working directory (`--cwd`). When that session calls `AskUserQuestion` (or needs any other tool approved), its `canUseTool` callback doesn't prompt a local terminal — it writes a structured request to `<mailbox>/pending/<id>.json` and **polls indefinitely** for `<mailbox>/answers/<id>.json` to appear (confirmed against the real Agent SDK docs: the callback can await as long as it needs to; the SDK never times it out itself).

The **main session** — the real, interactive, Remote-Control-paired Claude Code session you're actually watching from your desktop/phone — watches that `pending/` directory. When a new request shows up, it relays the question through **its own native `AskUserQuestion`** (so you see and answer it exactly like any other question in that session, including from mobile via Remote Control), then writes the answer file, which unblocks the waiting child.

**Verified live, 2026-09-03:** ran `run-ritual.ts` as a real background process, it called `AskUserQuestion`, wrote a pending request; the main session (this one) read it, asked the real question via its own `AskUserQuestion`, got a real answer, wrote it back; the child picked it up, resolved the tool call, and completed normally with a captured `session_id`. Full transcript of that run is not kept (test data), but the mechanism is confirmed working end to end, not just designed.

### Usage

```bash
cd _bmad-output/specs/ritual-session-orchestrator/mailbox-runner
npm install   # already done once; needed again only after a dependency bump

npx tsx src/run-ritual.ts \
  --mailbox ../mailbox \
  --label "3.6h/bmad-create-story" \
  --cwd "c:/projects/portfolio/festgrid/bmad" \
  --model claude-opus-5 \
  --prompt "/bmad-create-story 3.6h"
```

Run it in the background (the main session needs to keep watching the mailbox, not block on this call), then:

1. Poll/watch `<mailbox>/pending/` for new `*.json` files.
2. Read each one — it has `childLabel`, `toolName`, and (for `AskUserQuestion`) the full `questions` array in the SDK's own documented shape.
3. Relay it through the main session's own `AskUserQuestion` call, prefixed with the `childLabel` so you know which story/skill it's from.
4. Write `<mailbox>/answers/<id>.json` with `{requestId, answers: {...}}` (or `{requestId, approve: boolean, denyMessage?}` for a plain tool-approval request).
5. Confirm the child's log shows `request <id> resolved` and it exits 0.

No batching/dependency-ordering/verify-before-advance loop is built into `run-ritual.ts` itself — it runs exactly one ritual prompt per invocation, same division of responsibility as the manual batch this replaces. The ordering/verification procedure below still applies; `run-ritual.ts` is the thing invoked once per story in that procedure.

**Act-mode (Cline) child — same mailbox, same relay procedure. Fully verified live, both the happy path and the failure-recovery path:**

`--skill` looks up `skill-config.ts`'s `SKILL_DEFAULTS` (region/model/reasoning per bmad skill) and, with `--story`, auto-composes `--prompt`/`--label` — this is the real per-skill model/provider routing the earlier design discussion asked for:

```bash
npx tsx src/run-ritual-cline.ts \
  --mailbox ../mailbox --cwd "c:/projects/portfolio/festgrid/bmad" \
  --skill bmad-dev-story --story 3.6i
# resolves to: region=asia-southeast1, model=gemini-3.5-flash, reasoning=medium,
# providerId=vertex (ambient GCP ADC, $GOOGLE_CLOUD_PROJECT from .env, no key),
# prompt="/bmad-dev-story 3.6i", label="3.6i/bmad-dev-story"

npx tsx src/run-ritual-cline.ts \
  --mailbox ../mailbox --cwd "c:/projects/portfolio/festgrid/bmad" \
  --skill bmad-code-review --story 3.6i
# resolves to: region=global, model=gemini-3.1-pro-preview, reasoning=high
```

Any explicit flag (`--model`, `--gcp-region`, `--reasoning`, `--prompt`, `--label`) overrides what `--skill` would have supplied. A bare API key mode also exists (`--provider gemini --api-key-env GEMINI_API_KEY`) for when Vertex/GCP isn't wanted at all.

**Verified live, 2026-09-03, against the real `GOOGLE_CLOUD_PROJECT`:**
- A harmless `--skill bmad-dev-story --story 3.6i` prompt completed end-to-end (`reason="completed"`, correct response) — config resolution, ambient-ADC auth, session lifecycle, and result retrieval all proven, not just "reached the API."
- A prompt forcing `ask_user_question`: **first attempt exposed a real bug** — `gemini-3.5-flash` called the tool with empty/malformed input and the SDK's own validation didn't catch it, so it asked its real question as plain text instead. Fixed by adding an explicit `safeParse()` re-check inside the tool's own `execute()` that fails closed with a structured retryable error rather than trusting the declared type. Re-tested: the model got the schema wrong ~10 times in a row (bare-string options, missing `multiSelect`) and self-corrected off the structured errors each time, then completed a full, correct mailbox round-trip — a real person answered via a real `AskUserQuestion` relay, the answer flowed back, and the session ended correctly acknowledging it. Both the happy path and the model-gets-it-wrong-then-recovers path are now proven for Cline, matching the Claude side.

Vertex mode derives `providerId: "vertex"` automatically — passing `--provider` alongside `--gcp-project`/`--gcp-region` is rejected, since `"gemini"` + a Vertex clientType override reaches the *direct* Generative AI API client instead and demands a `GOOGLE_GENERATIVE_AI_API_KEY`, defeating the whole point (found by trial, now made structurally unreachable). Writes to the exact same mailbox files either way, with `toolName: "AskUserQuestion"` regardless of which child, skill, or auth mode raised it — the main session's relay steps above don't need to know or care.

## The batch procedure

Steps 1, 3, and 4 are now real, tested scripts (`resolve-targets.ts`, `verify-story.ts`, `detect-new-stories.ts`) — not prose to re-derive by hand each time. Step 2 (dispatch) stays this session's own job (see "Superseded" below for why that's deliberate, not a gap).

1. **Resolve targets + order by dependency** — `resolve-targets.ts`:
   ```bash
   npx tsx src/resolve-targets.ts --stories 3.6h,3.6i,3.6j,3.6k,3.7c,3.7d \
     --epics-file <path/to/epics.md> --implementation-artifacts <path/to/implementation-artifacts>
   # or: --epic 3   |   --since-proposal sprint-change-proposal-2026-09-02.md
   ```
   Reads `epics.md`'s `**Depends on:**` lines, topologically sorts the target set (ties broken by file/input order), and refuses with a specific error on a cycle or an out-of-set dependency that hasn't even been *created* yet (status `backlog` — not "done": found via a real run that requiring strict `done` false-positive-blocks on the common case of a dependency sitting at `review`, which already has everything a create-story pass needs to read). `--epic`/`--since-proposal` verified against this repo's real data: `--epic 3` correctly returns only the genuinely-`backlog` stories (a real bug — the status filter was silently missing entirely — was caught and fixed doing this); `--since-proposal sprint-change-proposal-2026-09-02.md` independently reproduces the exact 8-story list and order this conversation derived by hand at the very start, purely from epics.md's own filename citations.
2. **Dispatch one story at a time** (see Concurrency below) via `run-ritual.ts`/`run-ritual-cline.ts`, relaying any question through the mailbox as described above.
3. **Verify before advancing** — `verify-story.ts`:
   ```bash
   npx tsx src/verify-story.ts --story 3.6h --implementation-artifacts <path> [--expect-status ready-for-dev]
   ```
   Checks the story file exists and reports its real `sprint-status.yaml` status; without `--expect-status`, PASS just requires it moved off `backlog` (this repeated batch's own actual failure mode was stories advancing *further* than expected from outside this conversation, not not-advancing, so this check reports reality rather than assuming who moved it). Verified against real, live data for 3.4n/3.6h/3.6i.
4. **Detect newly-surfaced stories, merge, re-sort** — `detect-new-stories.ts`, after each story completes:
   ```bash
   npx tsx src/detect-new-stories.ts --implementation-artifacts <path> --snapshot .batch-snapshot.json \
     --epics-file <path> --remaining 3.7c,3.7d
   ```
   `bmad-create-story`'s own Gate 1/2/3 sweep routinely spawns new prerequisite/sibling stories mid-run — this exact conversation's 3.4n run produced 3.4o and 4.7c that way. First call creates a baseline snapshot of every current story key; every later call diffs against it and prints only what's appeared since (one dotted key per line, piped straight into step 1's `--stories`), reporting to stderr whether each is a **PREREQUISITE** for something still in `--remaining` (must sort before it) or **STANDALONE** (no current dependent). It deliberately doesn't compute its own order — feeding its output into `resolve-targets.ts`'s existing topo-sort is the actual reordering step, so there's one dependency-graph implementation, not two to keep in sync. Verified live with a real dependency (`3.6h`, prerequisite for `3.7c`/`3.7d`) and a real standalone (`3.4o`): remaining `[3.7c, 3.7d]` + detected `[3.4o, 3.6h]` → `resolve-targets.ts` correctly re-sorted to `3.6h, 3.7c, 3.7d, 3.4o`.

Both scripts are read-only against `epics.md`/`sprint-status.yaml` — writing them stays the real `bmad-*` skills' job, same separation of concerns as everywhere else in this design. `bmad-artifacts.ts` (shared by both) also had a real CRLF-line-ending bug found and fixed doing this: `epics.md` is CRLF, and JS regex `.` never matches `\r` (a LineTerminator), so a naive `split("\n")` silently failed to match a single story header until this was found by testing against the real file, not assumed from the design.

## Plan/Act mode and model routing

Maps onto the distinction the project already enforces in `CLAUDE.md` ("Planning Isolation": planning skills write only to `_bmad-output/`; implementation skills touch `apps/`/`packages/`).

| Mode | Skills | Runtime today |
|---|---|---|
| **plan** | `bmad-create-story`, `bmad-epic-readiness-check`, `bmad-correct-course`, `bmad-architecture`, `bmad-prd` | `run-ritual.ts` (Claude Agent SDK) — `--model` flag routes per story/skill; mailbox relay handles any question. **Built and verified.** |
| **act** | `bmad-dev-story`, `bmad-code-review`, `bmad-quick-dev` | **Built and fully verified live**, both the happy path and the model-gets-it-wrong-then-recovers path — see `run-ritual-cline.ts`'s file header for the full trail (correct provider id, the runtime-required-but-undeclared config fields, the `ask_user_question` schema-validation guard, and the real ~10-retry self-correction observed from `gemini-3.5-flash`). `--skill bmad-dev-story` / `--skill bmad-code-review` resolve region/model/reasoning automatically via `skill-config.ts`. |

No per-skill allow/deny list exists at the runtime level in either Claude Code or Cline (checked) — mode selection is about *which runtime/child you invoke*, not a permission boundary within one.

## Concurrency: sequential only in v1

See `spec-ai-dev-orchestrator/state-machines.md`'s "Concurrency Policy (v1)" section (2026-09-03) for the full reasoning — this effort inherits the same rule rather than re-deriving it: a downstream story drafted against an upstream story's stale state is a correctness bug regardless of execution substrate, and `sprint-status.yaml`/`epics.md` are shared-write hazards either way. The mailbox mechanism itself doesn't structurally prevent running several children at once (the main session would just relay whichever one raises a question first — its own `AskUserQuestion` calls are naturally serialized anyway), but dispatch stays one-story-at-a-time until the dependency-graph-eligible-parallelism work described in that section exists.

## Superseded: `ritual-runner.ts`

The original template (still in this directory) explored the same `canUseTool` idea but with a local-terminal `HumanChannel` and an in-process auto-answer HIL-level policy. `run-ritual.ts` is the evolution of it — same core mechanism, mailbox instead of a local terminal, no in-process auto-answer logic (the main session's own judgment handles that role now, same as it did throughout this whole design process). Kept for its HIL-level auto-answer sketch, which remains relevant if a fully-unattended (no human watching at all) mode is ever wanted; not otherwise in use.
