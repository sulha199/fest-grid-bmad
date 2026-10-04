---
name: ritual-orchestrator
description: 'Invoke and drive one or more bmad-* ritual skills (bmad-create-story, bmad-dev-story, bmad-quick-dev, bmad-code-review, etc.) as independent child sessions via the mailbox-runner tooling in _bmad-output/specs/ritual-session-orchestrator/, relaying any human-in-the-loop question back to this session efficiently instead of blocking silently. Use when the user says "run the ritual orchestrator", "dispatch story X", "run this batch of stories", "orchestrate the epic", or "resume the batch".'
---

# Ritual Orchestrator

**Goal:** Run one or more `bmad-*` rituals as independent child processes (their own model/provider, their own git-visible working directory), without blocking this session and without either silently hanging on a child's `AskUserQuestion` or flooding this conversation with raw child output.

**Full design rationale, verified findings, and rejected alternatives:** `_bmad-output/specs/ritual-session-orchestrator/README.md`. This skill packages that document's "batch procedure" section into a runnable workflow — read the README if something here is ambiguous or if a script's flags appear to have changed; do not re-derive the mechanism from scratch.

**Mailbox-runner location:** `_bmad-output/specs/ritual-session-orchestrator/mailbox-runner/` (its own `package.json`, outside the pnpm workspace on purpose). Run `npm install` there once if `node_modules/` doesn't exist yet; all commands below assume that directory as cwd unless stated otherwise.

## Step 1: Gather batch parameters (ask once, up front)

Before dispatching anything, resolve these — ask the user in a single consolidated question if any are ambiguous, don't trickle questions out one at a time:

- **Target scope**: one of `--stories a,b,c` | `--epic N` | `--since-proposal <file>` | a single `--story <id>`.
- **Skill(s) to run** per target (usually one skill across the whole batch, e.g. `bmad-dev-story`; occasionally the user wants `bmad-create-story` first).
- **Config preset** (optional) — a name from `mailbox-runner/config-presets/` (e.g. `all-claude-low`) or omit to use the active `ritual-config.json` default. Ask only if the user hasn't already said which cost tier they want.
- **Repo root** (`--cwd`) — defaults to this project's root; only ask if the user is targeting a worktree (`.claude/worktrees/<name>`) instead. **This orchestrator session itself must stay in the main repo checkout — never call `EnterWorktree` on itself to "isolate" the batch.** Isolation for dispatched children is handled per-story via each script's own `--cwd`/worktree flags, not by relocating the orchestrator. Relocating this session has broken Remote Control resumability in practice (2026-09-13, job `fc1ef1c8`: the session called `EnterWorktree` mid-batch unprompted, VS Code never attached a terminal to it afterward, and the session became permanently unreachable from claude.ai).
- **Fresh batch or resume** — if the user references a prior run or a `.batch-state.json`-style file exists that looks relevant, ask whether to resume it via `resume-batch.ts` instead of re-resolving from scratch.

Pick a `--mailbox` dir once for the whole batch (default `../mailbox`, i.e. `_bmad-output/specs/ritual-session-orchestrator/mailbox`) and a state file path (default `.batch-state.json` inside `mailbox-runner/`) — reuse both for every step below.

## Step 2: Resolve targets (or resume)

**Fresh batch:**
```bash
npx tsx src/resolve-targets.ts <scope-flags> \
    --epics-file <path/to/epics.md> --implementation-artifacts <path/to/implementation-artifacts> \
    --save-state .batch-state.json
```
This topologically sorts by `epics.md`'s `**Depends on:**` lines and refuses on a cycle or an unmet (`backlog`-status) out-of-set dependency. Read its stdout for the resolved, ordered list before proceeding — do not assume the input order is the dispatch order.

**Per-(story, skill) extra prose, auto-resolved batches**: if the user wants extra context/prose for specific (story, skill) combinations (same mechanism as a hand-authored batch-plan's `context` field — see Step 3), write it to a small JSON file first and pass `--context-file`:
```json
{ "3.6h": { "bmad-create-story": "...", "bmad-dev-story": "..." }, "3.6i": { "bmad-dev-story": "..." } }
```
```bash
npx tsx src/resolve-targets.ts <scope-flags> --epics-file <path> --implementation-artifacts <path> \
    --context-file <path/to/context.json> --save-state .batch-state.json
```
Only meaningful together with `--save-state` (it has nothing to attach to otherwise — the tool warns and drops it if `--save-state` is missing). Keyed by dotted story key, then by skill name, so the same story can carry different prose for `bmad-create-story` vs. `bmad-dev-story`. Persisted verbatim into the saved state file's `context` field.

**Resuming a paused batch:** skip straight to:
```bash
npx tsx src/resume-batch.ts --state .batch-state.json
```
This re-checks each story's *real*, current `sprint-status.yaml` status (never trusts the saved snapshot — this repo's batches drift from parallel activity between checks) and prints only what's still `backlog`, in original order. Use that as the remaining target list. If the saved state has a `context` field, `resume-batch.ts` says so on stderr — read it directly from the `--state` file (it's carried through unchanged) when building `--prompt` in Step 3.

## Step 3: Dispatch each target, one at a time (sequential only — see README's Concurrency section for why)

For each target story, in resolved order:

1. **Pick the right entry point and per-item check scope** — tuned for time/token efficiency (2026-09-30): run only the cheapest per-item check that's actually useful, and push the rest to a single end-of-batch pass (Step 4.5) instead of repeating lint+build on every dispatch.
   - `bmad-dev-story`: `run-act-with-checks.ts --checks test` — test only per story (it already implies a build via turbo's `dependsOn` graph, so a real compile error still surfaces immediately). Still auto-dispatches a `bmad-quick-dev` fix on a test failure. Lint and the standalone build check are deferred to Step 4.5.
   - `bmad-quick-dev`: `dispatch-ritual.ts` directly, same as the non-act skills below — **no per-item check at all**. Its fixes are typically small and get caught by the Step 4.5 pass; gating every quick-dev dispatch on a full lint+build+test cycle was the most expensive per-item cost in a batch for the least marginal safety.
   - `bmad-create-story` and every other non-act skill (`bmad-epic-readiness-check`, `bmad-correct-course`, `bmad-architecture`, `bmad-prd`, `bmad-code-review`): `dispatch-ritual.ts` directly, unchanged — these are document-only changes with nothing to lint/build/test.
   - Keep a running note of whether the batch has dispatched any `bmad-dev-story` or `bmad-quick-dev` target — Step 4.5 needs that to know what's still owed at the end.

   **Per-(story, skill) extra prose**: two sources, same shape once resolved down to a `(story, skill) -> prose` lookup:
   - **Hand-authored batch plan**: a step may carry an optional `context` string alongside `skill`/`story` — e.g. `{ "skill": "bmad-dev-story", "story": "3.7e", "context": "Cross-reference the 3.4p migration fix before touching parser_version_registry." }`. The same story can carry different `context` for different skills (its `bmad-create-story` step and its `bmad-dev-story` step are separate steps/objects, each with its own `context`).
   - **Auto-resolved batch** (`resolve-targets.ts`/`resume-batch.ts`): if `--context-file` was passed at resolve time (Step 2), the saved state file's `context` field holds the same lookup, keyed `context[<story>][<skill>]`. Read it directly from the `--state`/`--save-state` JSON file — neither `resolve-targets.ts` nor `resume-batch.ts` prints it to stdout, it's meant to be read once per batch, not per dispatch.

   When the target story/skill has a matching entry from either source, build `--prompt` explicitly instead of letting `--skill`/`--story` auto-compose it (both `dispatch-ritual.ts` and `run-ritual.ts` already support `--prompt` as a full override — see `run-ritual.ts`'s `parseArgs`):
   ```
   --prompt "/<skill> <story>

   <context>"
   ```
   Omit `--prompt` entirely (fall back to the bare `/<skill> <story>` default) when there's no matching context.

   **cline-cli delegation is unreliable in this project, even under an all-Claude `--config`** (found 2026-09-07, Story 3.6k): a `bmad-dev-story` session picking up the repo's own `scripts/cline-worktree.ps1` convention will try to sub-delegate to cline-cli on its own initiative — that's a repo-level habit the inner agent follows, not something `--config`/`ritual-config.json` controls (those only pick the *outer* dispatch's runtime). This matches an already-tracked, still-open finding in `_bmad-output/implementation-artifacts/backlog.yaml` ("cline-cli hang saga"). If a dispatch comes back with an empty `[run-ritual] final result:` and no code changes, check for a `C:\wt\<story-slug>` worktree containing only a `.cline-story-prompt.md` (or a `cline-worktree.ps1` tool-approval request) before assuming it's an unrelated no-op — then resume the session (see 4a below) with an explicit instruction to bypass cline-cli and implement directly in the main repo instead.

2. **Launch it detached, then watch its log with `Monitor`** — a batch story can run for hours, but a `Monitor` lives at most 30 minutes and **kills whatever runs inside it** (found 2026-10-04, Wave 4A: a child launched inside a Monitor was killed mid-story at every expiry). So the run and the watch are separate. First launch the child detached; it returns at once and the child keeps running whatever happens to any Monitor:

   ```
   cd "_bmad-output/specs/ritual-session-orchestrator/mailbox-runner" && \
       npx tsx src/launch-detached.ts --mailbox <mailbox-dir> --label "<story-id>/<skill>" -- \
       npx tsx src/<run-act-with-checks.ts|dispatch-ritual.ts> --skill <skill> --story <id> \
       --mailbox <mailbox-dir> --cwd <repo-root> [--config <preset>] [--checks test] [--prompt "/<skill> <story>

<context>"]
   ```
   Everything after the lone `--` is the child command, passed verbatim (it runs from the `mailbox-runner` directory, so its `src/...` paths resolve; do **not** give `launch-detached.ts` the repo root as `--cwd`, the repo root is the child's own `--cwd`) (quotes and newlines in `--prompt` are safe). Its combined output goes to `<mailbox-dir>/logs/<label>.log`, ending with an `[exit code N]` line. Launching a label whose child is still alive is refused, so a re-issued launch cannot double-dispatch a story. (Include `--prompt` only when this (story, skill) has a matching `context` entry; `--checks test` only for a `run-act-with-checks.ts`/`bmad-dev-story` dispatch.)

   Then watch it with `Monitor` (`timeout_ms` 1800000, the maximum):

   ```
   command: cd "_bmad-output/specs/ritual-session-orchestrator/mailbox-runner" && \
       npx tsx src/watch-log.ts --mailbox <mailbox-dir> --label "<story-id>/<skill>"
   description: "<story-id>/<skill> dispatch"
   ```
   `watch-log.ts` prints only the signal lines (mailbox requests, resolutions, final result, check verdicts, errors, the exit code) and ignores the rest, including the child's own prompt echo. It saves how far it has read, so **when the Monitor expires, simply start the same watch command again**: it resumes where it stopped, with no replay and no loss (`--from-start` replays everything). It exits when the child's `[exit code N]` line arrives, or with a `[watch-log] child pid ... is gone` message (exit 4) if the child was killed without writing one: treat that as a dead child, not a finished one. Both Claude-side (`run-ritual.ts`) and Cline-side (`run-ritual-cline.ts`) children work through the same log, and `run-act-with-checks.ts` surfaces its own check verdict lines through it. A story that goes far longer than usual with no notification deserves a look at the log file, not an assumption.

3. **On a `writing mailbox request <id>` notification** — relay it:
   - Read `<mailbox-dir>/pending/<id>.json`. Its `questions` array (for `toolName: "AskUserQuestion"`) is already in this session's own `AskUserQuestion` shape (`question`/`header`/`options`/`multiSelect`) — pass it through directly, prefixed with the file's `childLabel` so the real user knows which story/skill is asking. For any other `toolName` (a plain tool-approval request), summarize `rawInput` and ask the user a simple approve/deny question instead.
   - Write the answer to `<mailbox-dir>/answers/<id>.json`:
     - `AskUserQuestion` case: `{"requestId": "<id>", "answers": {...}, "answeredAt": "<ISO timestamp>"}` — `answers` keyed exactly like the tool's own response shape.
     - Approval case: `{"requestId": "<id>", "approve": true|false, "denyMessage": "<reason, if denied>", "answeredAt": "<ISO timestamp>"}`.
   - Do not touch `<mailbox-dir>/resolved/` — the child moves both files there itself once it picks up the answer (polls every 3s by default).
   - Keep watching; the same Monitor call continues after you write the answer, no need to restart it.

4. **On watch end**, read the exit code and the last matched summary line(s) (already in this conversation from the notifications — don't re-fetch the raw log unless something's unclear). A non-zero exit that wasn't already handled by `run-act-with-checks.ts`'s own auto-quick-dev-dispatch means STOP the batch and surface it to the user rather than continuing to the next story — same principle as the underlying scripts' own "does not loop" design.

4a. **A dispatch can complete with exit 0 yet do nothing** — seen twice in practice (2026-09-07, Stories 3.4p/3.4q under `all-claude-low`): `run-ritual.ts`'s own `[run-ritual] final result:` line came back empty, no commit landed, and the story file's Dev Agent Record was untouched. Don't trust exit code or the checks alone — before treating any dev-story dispatch as real work, confirm at least one of: a new commit (`git log`), the story file's Completion Status/Dev Agent Record actually filled in (not template placeholders), or a real `git diff`/`git status` change. If it's an empty no-op, resume the exact same session and re-prompt it (`run-ritual.ts --resume-label "<story>/<skill>" --prompt "..."`, going around `dispatch-ritual.ts`) rather than starting a fresh dispatch from scratch — this has reliably produced the real implementation both times it was tried. If a dispatch instead HALTs on its own approval gate despite an answer already being written to `<mailbox-dir>/answers/`, don't assume the relay silently worked from `request <id> resolved` alone — if the child's own final text says it never got the approval, the answer's key format likely didn't match what it expected; resume the session again with the approval stated explicitly and unambiguously in the prompt text itself, not just in the mailbox answer file. **`--resume-label` is reliable since 2026-10-04**: every fresh dispatch now names its own session id and saves it before the child does any work, and a saved file that carries the orchestrator's own id is refused (before then, children inside a Claude Code session reported the orchestrator's id, so a resume reloaded the orchestrator's conversation). If a resume ever refuses with "carries the orchestrator's own session id", delete that `<mailbox-dir>/sessions/<label>.json` and dispatch fresh from the last WIP commit.

4b. **After any out-of-band resume** (`run-ritual.ts --resume`/`--resume-label` invoked directly, as in 4a) for a `bmad-dev-story` target — `run-act-with-checks.ts`'s automatic test gate did NOT run, since that resume bypassed `dispatch-ritual.ts` entirely. Re-verify manually using `run-check.ts --kind test` — never a bare `pnpm test`. This isn't just style: `run-check.ts` gives heartbeat/timeout safety, saves the full raw log to the mailbox dir, and parses output through `test-output-summary.ts` into a real pass/fail breakdown instead of an ad-hoc grep on ambiguous summary lines. (Lint/build stay deferred to Step 4.5 regardless, same as the normal path. For a `bmad-quick-dev` resume, there is no per-item check to re-run at all — its coverage lives entirely in Step 4.5.)

5. **Verify before advancing**:
   ```bash
   npx tsx src/verify-story.ts --story <id> --implementation-artifacts <path> [--expect-status <status>]
   ```
   If it didn't move the way expected, stop and report — don't guess why and don't silently retry.

## Step 4: After each target, detect newly-surfaced stories (create-story batches only)

`bmad-create-story`'s Gate 1/2/3 sweep can spawn new prerequisite/sibling stories mid-run. After each dispatch:
```bash
npx tsx src/detect-new-stories.ts --implementation-artifacts <path> --snapshot <path> \
    [--epics-file <path> --remaining <comma-list-of-not-yet-dispatched-ids>]
```
First call in a batch creates the baseline snapshot (no `--remaining` needed). Every later call prints what's newly appeared, tagged PREREQUISITE (must sort before something still remaining) or STANDALONE. Feed anything found back into `resolve-targets.ts` (same `--stories` set plus the new ones, re-run with `--save-state` to update the persisted order) rather than hand-sorting it.

## Step 4.5: Batch-end checks (once, after every target has been dispatched and verified)

Run this **once**, after the whole batch loop finishes — not per story. This is what Step 3's narrowed per-item checks (`--checks test` for `bmad-dev-story`, nothing at all for `bmad-quick-dev`) were deferring: the missing lint/build/test coverage lands here as a single pass instead of repeated `pnpm` invocations per story.

- If the batch dispatched **any** `bmad-dev-story` target: run `npx tsx src/run-check.ts --kind lint --cwd <repo-root>`, then `--kind build`.
- If the batch dispatched **any** `bmad-quick-dev` target: also run `npx tsx src/run-check.ts --kind test --cwd <repo-root>` (`bmad-dev-story` targets already ran test per-item in Step 3; `bmad-quick-dev` targets never ran anything, so lint/build/test are all still owed for them).
- If the batch dispatched **only** `bmad-create-story` or other plan/review-bucket skills (no `bmad-dev-story`/`bmad-quick-dev` targets at all): skip this step entirely — no code changed, nothing to check.
- Run each needed check exactly once regardless of how many stories in the batch would have owed it — lint/build/test are whole-repo checks, not per-story ones.
- On a failure here, don't guess which story caused it and don't auto-dispatch a fix the way `run-act-with-checks.ts` does per-story — report the failing check's summary (`test-output-summary.ts`/`build-lint-output-summary.ts` against the `--log-file` output, same parsers `run-act-with-checks.ts` uses) to the user and let them decide which story to target with a `bmad-quick-dev` fix. Attribution across a multi-story batch isn't reliable the way it is for a single dispatch.

## Step 5: Summarize, don't dump

At the end of the batch (or when stopping early), report concisely per story: dispatched skill, outcome (done/review/failed/needs-attention), whether a quick-dev auto-fix was triggered and for which check, and the final `sprint-status.yaml` status from `verify-story.ts`. Include the Step 4.5 batch-end check results (which checks ran, pass/fail) — that's the only place lint/build coverage for `bmad-dev-story` and all coverage for `bmad-quick-dev` shows up. Point to the saved state file (`.batch-state.json`) so the user knows `resume-batch.ts --state <path>` picks this batch back up later if it's paused or the session ends mid-run. Do not paste raw script stdout — the Monitor notifications and this summary are the record; the full logs stay on disk (mailbox dir, `run-check.ts --log-file` outputs) if deeper inspection is ever needed.

## Efficiency rules (why this skill exists, not just the raw scripts)

- **Never poll by sleeping in a loop** — that burns turns for no signal. `Monitor` on `watch-log.ts` is the mechanism; it notifies on its own schedule, and its expiry never touches the child (re-arm it).
- **Never print a full child log into the conversation.** Filter at the source (`watch-log.ts`'s signal filter) — the raw log is always still on disk if truly needed.
- **One consolidated question per batch for parameters**, not a back-and-forth — the user is very likely watching from mobile via Remote Control, where round-trips are more costly.
- **One story in flight at a time** (see README's "Concurrency: sequential only in v1") — do not launch a second Monitor for the next story before the current one's dispatch, verification, and state save are done. `sprint-status.yaml`/`epics.md` are shared-write hazards, and a downstream story drafted against an upstream story's stale state is a correctness bug.
- **Persist state after every story**, not just at batch start/end, so an interruption anywhere mid-batch is resumable with zero lost progress via `resume-batch.ts`.
- **Defer redundant lint/build/test to one end-of-batch pass instead of repeating it per story** (2026-09-30) — `bmad-dev-story` runs test only per item (lint+build deferred), `bmad-quick-dev` runs no per-item check at all (all three deferred), and `bmad-create-story`/other plan-bucket skills never needed a check (document-only). See Step 3's per-skill breakdown and Step 4.5's batch-end pass. This trades a small window of "who broke lint/build" attribution ambiguity (fine — Step 4.5 punts that to the user instead of guessing) for not re-running the full monorepo lint/build after every single dispatch in a batch that can be many stories long.
