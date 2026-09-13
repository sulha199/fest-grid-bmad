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

**Resuming a paused batch:** skip straight to:
```bash
npx tsx src/resume-batch.ts --state .batch-state.json
```
This re-checks each story's *real*, current `sprint-status.yaml` status (never trusts the saved snapshot — this repo's batches drift from parallel activity between checks) and prints only what's still `backlog`, in original order. Use that as the remaining target list.

## Step 3: Dispatch each target, one at a time (sequential only — see README's Concurrency section for why)

For each target story, in resolved order:

1. **Pick the right entry point**: if the skill is `bmad-dev-story` or `bmad-quick-dev` (the "act" bucket), use `run-act-with-checks.ts` (it dispatches, then gates on lint+build+test, auto-dispatching a `bmad-quick-dev` fix on the first failing check). For every other skill (`bmad-create-story`, `bmad-epic-readiness-check`, `bmad-correct-course`, `bmad-architecture`, `bmad-prd`, `bmad-code-review`), use `dispatch-ritual.ts` directly.

   **cline-cli delegation is unreliable in this project, even under an all-Claude `--config`** (found 2026-09-07, Story 3.6k): a `bmad-dev-story` session picking up the repo's own `scripts/cline-worktree.ps1` convention will try to sub-delegate to cline-cli on its own initiative — that's a repo-level habit the inner agent follows, not something `--config`/`ritual-config.json` controls (those only pick the *outer* dispatch's runtime). This matches an already-tracked, still-open finding in `_bmad-output/implementation-artifacts/backlog.yaml` ("cline-cli hang saga"). If a dispatch comes back with an empty `[run-ritual] final result:` and no code changes, check for a `C:\wt\<story-slug>` worktree containing only a `.cline-story-prompt.md` (or a `cline-worktree.ps1` tool-approval request) before assuming it's an unrelated no-op — then resume the session (see 4a below) with an explicit instruction to bypass cline-cli and implement directly in the main repo instead.

2. **Launch it under `Monitor`, not a bare foreground call and not raw `run_in_background`** — a batch story can run for many minutes and needs to both (a) not block this session so a HIL question can be relayed the moment it's raised, and (b) not dump its full raw log into the conversation. Use `persistent: true` (duration is unpredictable) and filter to the signal lines, not the firehose:

   ```
   command: cd "_bmad-output/specs/ritual-session-orchestrator/mailbox-runner" && \
       npx tsx src/<run-act-with-checks.ts|dispatch-ritual.ts> --skill <skill> --story <id> \
       --mailbox <mailbox-dir> --cwd <repo-root> [--config <preset>] 2>&1 | \
       grep -E --line-buffered "writing mailbox request|resolved|session ended|final result|\[run-act-with-checks\]|\[run-check|HALT|Error|ERROR|error TS[0-9]|Failed:|FAILED|Tasks:|exit code"
   description: "<story-id>/<skill> dispatch"
   ```

   This one filter works for both Claude-side (`run-ritual.ts`) and Cline-side (`run-ritual-cline.ts`) children — both log `"... -> writing mailbox request <id>"` and `"request <id> resolved"` verbatim; `run-act-with-checks.ts` additionally surfaces its own lint/build/test verdict lines through the same inherited stdio chain. Monitor also always reports the exit code when the command ends, even if nothing matched the filter right at the end — a silent hang still surfaces as "still running" (no notification), so if a story goes far longer than its usual runtime with zero notifications, check on it rather than assuming it's fine.

3. **On a `writing mailbox request <id>` notification** — relay it:
   - Read `<mailbox-dir>/pending/<id>.json`. Its `questions` array (for `toolName: "AskUserQuestion"`) is already in this session's own `AskUserQuestion` shape (`question`/`header`/`options`/`multiSelect`) — pass it through directly, prefixed with the file's `childLabel` so the real user knows which story/skill is asking. For any other `toolName` (a plain tool-approval request), summarize `rawInput` and ask the user a simple approve/deny question instead.
   - Write the answer to `<mailbox-dir>/answers/<id>.json`:
     - `AskUserQuestion` case: `{"requestId": "<id>", "answers": {...}, "answeredAt": "<ISO timestamp>"}` — `answers` keyed exactly like the tool's own response shape.
     - Approval case: `{"requestId": "<id>", "approve": true|false, "denyMessage": "<reason, if denied>", "answeredAt": "<ISO timestamp>"}`.
   - Do not touch `<mailbox-dir>/resolved/` — the child moves both files there itself once it picks up the answer (polls every 3s by default).
   - Keep watching; the same Monitor call continues after you write the answer, no need to restart it.

4. **On watch end**, read the exit code and the last matched summary line(s) (already in this conversation from the notifications — don't re-fetch the raw log unless something's unclear). A non-zero exit that wasn't already handled by `run-act-with-checks.ts`'s own auto-quick-dev-dispatch means STOP the batch and surface it to the user rather than continuing to the next story — same principle as the underlying scripts' own "does not loop" design.

4a. **A dispatch can complete with exit 0 yet do nothing** — seen twice in practice (2026-09-07, Stories 3.4p/3.4q under `all-claude-low`): `run-ritual.ts`'s own `[run-ritual] final result:` line came back empty, no commit landed, and the story file's Dev Agent Record was untouched. Don't trust exit code or the checks alone — before treating any dev-story dispatch as real work, confirm at least one of: a new commit (`git log`), the story file's Completion Status/Dev Agent Record actually filled in (not template placeholders), or a real `git diff`/`git status` change. If it's an empty no-op, resume the exact same session and re-prompt it (`run-ritual.ts --resume-label "<story>/<skill>" --prompt "..."`, going around `dispatch-ritual.ts`) rather than starting a fresh dispatch from scratch — this has reliably produced the real implementation both times it was tried. If a dispatch instead HALTs on its own approval gate despite an answer already being written to `<mailbox-dir>/answers/`, don't assume the relay silently worked from `request <id> resolved` alone — if the child's own final text says it never got the approval, the answer's key format likely didn't match what it expected; resume the session again with the approval stated explicitly and unambiguously in the prompt text itself, not just in the mailbox answer file.

4b. **After any out-of-band resume** (`run-ritual.ts --resume`/`--resume-label` invoked directly, as in 4a) — `run-act-with-checks.ts`'s automatic lint→build→test gate did NOT run, since that resume bypassed `dispatch-ritual.ts` entirely. Re-verify manually using `run-check.ts --kind lint|build|test` for each check — never a bare `pnpm lint`/`pnpm build`/`pnpm test`. This isn't just style: `run-check.ts` gives heartbeat/timeout safety, saves the full raw log to the mailbox dir, and (for test) parses output through `test-output-summary.ts` into a real pass/fail breakdown instead of an ad-hoc grep on ambiguous summary lines.

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

## Step 5: Summarize, don't dump

At the end of the batch (or when stopping early), report concisely per story: dispatched skill, outcome (done/review/failed/needs-attention), whether a quick-dev auto-fix was triggered and for which check, and the final `sprint-status.yaml` status from `verify-story.ts`. Point to the saved state file (`.batch-state.json`) so the user knows `resume-batch.ts --state <path>` picks this batch back up later if it's paused or the session ends mid-run. Do not paste raw script stdout — the Monitor notifications and this summary are the record; the full logs stay on disk (mailbox dir, `run-check.ts --log-file` outputs) if deeper inspection is ever needed.

## Efficiency rules (why this skill exists, not just the raw scripts)

- **Never poll by sleeping in a loop** — that burns turns for no signal. `Monitor` is the mechanism; it notifies on its own schedule.
- **Never print a full child log into the conversation.** Filter at the source (the `grep` in the Monitor command) — the raw log is always still on disk if truly needed.
- **One consolidated question per batch for parameters**, not a back-and-forth — the user is very likely watching from mobile via Remote Control, where round-trips are more costly.
- **One story in flight at a time** (see README's "Concurrency: sequential only in v1") — do not launch a second Monitor for the next story before the current one's dispatch, verification, and state save are done. `sprint-status.yaml`/`epics.md` are shared-write hazards, and a downstream story drafted against an upstream story's stale state is a correctness bug.
- **Persist state after every story**, not just at batch start/end, so an interruption anywhere mid-batch is resumable with zero lost progress via `resume-batch.ts`.
