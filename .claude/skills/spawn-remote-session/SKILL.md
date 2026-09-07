---
name: spawn-remote-session
description: 'Spawn a brand-new, empty-context Claude Code background session with Remote Control enabled from the start, so it is immediately available to open/drive from Claude Code on mobile or claude.ai/code. Use when the user says "invoke a blank session", "start a new mobile session", "spawn a remote-control session", "give me a session I can continue on my phone", or similar.'
---

# Spawn Remote-Control Session

**Goal:** Give the user a fresh, empty-context Claude Code session that is immediately reachable from their phone (or any browser), without them having to type `/remote-control` themselves.

**Why this needs a script, not just telling the user to run `/remote-control`:** `/remote-control` only works inside an already-running *interactive* session and requires that process to keep running — it cannot be triggered from a one-shot/headless invocation (confirmed by testing: the Claude Agent SDK's `query()`, used by this repo's `_bmad-output/specs/ritual-session-orchestrator/mailbox-runner/src/run-ritual.ts` for one-shot bmad ritual dispatches, exits after one response and cannot sustain a pairing). The actual mechanism (verified live, 2026-09-08, CLI v2.1.259) is a **startup flag**, not a slash command typed after the fact: `claude --bg --remote-control "<name>"` starts a real background process (listable via `claude agents`, controllable via `claude attach/logs/stop/rm`) with Remote Control active before the first prompt is ever sent — no slash command injection needed at all.

## Usage

Run the script at `scripts/spawn-remote-control-session.ps1`:

```powershell
./scripts/spawn-remote-control-session.ps1 -Cwd "<working directory>" -Name "<session name>" [-PermissionMode <mode>] [-InitialPrompt "<prompt>"]
```

- **`-Cwd`**: the project/directory the new session should start in. Ask the user if it's not obvious from context (e.g. "same repo as this one" vs. somewhere else) — default to the current repo root if they don't care.
- **`-Name`**: what the session is called in the mobile/web picker. Ask for a short descriptive name if the user wants one; otherwise the script defaults to a timestamped slug.
- **`-PermissionMode`** (optional): pass `acceptEdits` if the user wants the mobile session to skip local edit-approval prompts (useful since there's no one at the keyboard to approve them) — one of `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`. Ask if unsure; don't default to `bypassPermissions` without the user explicitly asking for it (that's a real permission-scope decision, not a default).
- **`-InitialPrompt`** (optional): if the user gives the skill invocation arguments (e.g. `/spawn-remote-session say "hello"`), pass that text through as `-InitialPrompt` so the session starts working on it immediately instead of sitting idle — verified live that a trailing prompt argument works alongside `--bg --remote-control`. If the user didn't give a task, leave this unset (a genuinely blank, idle session waiting for them on their phone).

The script polls `claude logs <id>` for up to 20s (`-TimeoutSeconds` to change) for the pairing URL to appear — pairing takes a few seconds after the process starts, it is not instant. It returns/prints:
- The session's short id (for `claude attach/logs/stop/rm <id>` later)
- The Remote Control pairing URL (`https://claude.ai/code/session_...`) — **give this to the user directly**, it's what they open on their phone or in a browser to start driving the session
- A one-line reminder of the management commands

## After spawning

Report back to the user plainly: the session id, the pairing URL, and that opening the URL (on their phone's browser or in the Claude Code mobile app) lets them continue that session from there. Mention that the underlying process must keep running on this machine for the session to stay reachable (closing the terminal / shutting down the machine takes it offline until restarted) — this is a real Remote Control limitation, not a bug in the script.

Do not run `claude stop`/`claude rm` on a session you just spawned for the user unless they ask you to — it's theirs to use, not a scratch artifact to clean up after yourself.
