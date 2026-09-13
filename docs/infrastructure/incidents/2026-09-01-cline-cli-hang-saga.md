# Incident: Cline-CLI Hang Saga (stale hub manifest + later unexplained recurrences)

**Date:** 2026-09-01 (verification batches 9/10/11) — consolidated 2026-09-14 by FIND-007 (quick-dev)
**Status:** One root cause (stale hub daemon manifest) fixed and verified at the time; two later
recurrences (batch-10, batch-11) remain **unexplained**. No speculative fix has been attempted for
the unexplained recurrences — this document is the single, de-duplicated record of the timeline,
the one known cause, and the diagnostics story, so the *next* recurrence is actually debuggable.

> **Backlog linkage:** evidence records `DW-002`, `DW-004`, `DW-007` in
> `_bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml`; finding `FIND-007` in
> `_bmad-output/implementation-artifacts/backlog.yaml`. Chronological order is **DW-007 → DW-004 →
> DW-002** (the dwarf IDs are not in chronological order; batch numbers identify each occurrence).

## Summary

`cline-cli` hung repeatedly across three consecutive verification batches (batch-9, batch-10,
batch-11). The batch-9 hang (**DW-007**) was root-caused to a stale hub daemon manifest and the fix
was verified working at the time. Two later recurrences — batch-10 happening twice
(**DW-004**) and batch-11 happening a third consecutive time (**DW-002**, including with a `--timeout`
that did not reliably cap the run) — were **separate, later, still-unexplained** failure modes.

Because the later recurrences have no established root cause, this finding deliberately does **not**
fabricate a "fix" for them. The actionable half of the work here is record consolidation plus
recording what diagnostics already exist and what a productive next diagnostic would look like.

## Timeline

| Ref | Batch | When | What happened |
|---|---|---|---|
| **DW-007** | batch-9 | 2026-09-01 | 4/4 cline-cli invocations hung. `cline doctor` reported `hub healthy: no (dead pid)`. Deleting `~/.cline/data/locks/hub/production.json*` **and** its sidecars fixed it; two subsequent invocations worked. |
| **DW-004** | batch-10 | 2026-09-01 | cline-cli hung **twice** with a different, unexplained failure mode (distinct from DW-007's stale-manifest issue — see evidence note). |
| **DW-002** | batch-11 | 2026-09-01 | cline-cli hung a **third consecutive** time (per the evidence, "3/3 real hangs" in that window), including with a `--timeout` that was not reliably enforced/logged. |

## Investigation (DW-007 only — the one root-caused incident)

- `cline doctor` showed the hub daemon was **not** healthy (`no` / a dead pid) while the hub lock
  manifest still existed on disk.
- The stale manifest + sidecar files were deleted from
  `~/.cline/data/locks/hub/production.json*` (local machine state under `~/.cline`, **outside this
  repo** — not mechanically checkable via repo grep; the evidence records it verified fixed at the
  time).
- After deletion, the hub came back up and the next two invocations ran to completion.

## Root Cause (known — DW-007 only)

A **stale hub daemon manifest** — the hub lock file (`~/.cline/data/locks/hub/production.json`)
referenced a hub process that was already dead, so subsequent cline-cli invocations hung waiting on
a hub that would never respond. Cleaning `production.json*` and its sidecars restored the hub and
fixed the batch-9 hang.

## Later recurrences (DW-004, DW-002) — still unexplained

- **DW-004 (batch-10)** and **DW-002 (batch-11)** are explicitly recorded as **separate, later,
  still-unexplained** recurrences. The DW-007 fix was verified working at the time, so these are
  **not** the same root cause.
- **DW-002** additionally flagged that `--timeout` was not reliably enforcing a cap — an invocation
  can sit near-idle for ~40 min without the timeout firing. That is a *diagnostics* gap, not yet a
  proven root cause.
- This drove the creation of `scripts/cline-worktree.ps1`, which decouples worktree creation/install
  from cline's own agent loop (so those mechanical steps can't share fate with a hang), and tells
  downstream invokers to call `cline --cwd <path> --auto-approve true --timeout 600` **without**
  `--worktree`.

## Diagnostics already present (SDK "act" path)

The current **SDK-based** cline runner used by this batch's orchestration
(`_bmad-output/specs/ritual-session-orchestrator/mailbox-runner/src/run-ritual-cline.ts`) already
contains meaningful hang detection:

- An **idle watchdog**: a `setInterval` polling loop (poll period `IDLE_WATCHDOG_POLL_MS`) that
  rejects with `STALLED_SESSION_MARKER` when there is no SDK activity past `idleTimeoutMs`, raced
  against the session "ended" promise via `Promise.race([ended, idleWatchdog])`.
- **Per-attempt logging** with `session_id`, `attempt N/maxAttempts`, and the ended reason.
- **Transient-network retry** with exponential backoff, and a `finally` block that clears the
  watchdog and disposes the `ClineCore` instance so a stalled attempt never leaks into the next
  retry.

So the act-mode (SDK) invocation path already has a hang-detection heartbeat. The DW-002/DW-004
hangs were on the **command-line** (`cline --cwd ... --timeout`) path, which did **not** have this
guarantee.

## Recommended next diagnostic (recorded, NOT implemented — see below)

For the next recurrence on the **CLI** invocation path, the highest-value, lowest-risk addition is a
**hang-detection heartbeat / robust timeout wrapper** around the `cline --cwd ...` call that:
1. starts a wall-clock timer with a deadline;
2. emits a timestamped "alive" line at a fixed interval (e.g. every N seconds) and, on deadline
   expiry, captures CPU/process state (`tasklist`/WMI) plus a dump of
   `~/.cline/data/locks/hub/*` before killing, so the *next* hang is debuggable the way DW-007 was.

**Deliberately deferred here:** wiring the watchdog into the live batch runner
(`mailbox-runner/run-ritual-cline.ts` or a new wrapper) is a genuine architecture-level change to
tooling a batch is currently running through, and there is no known root cause to target — making
it now would be speculative. It is tracked at `FIND-007` (status `documented`) to be picked up as a
real story once the next recurrence (or a deliberate decision) identifies a concrete, low-risk site.

## Follow-ups (not yet done / recommendations)

- If cline-cli hangs again, capture `cline doctor` output **before** any cleanup, and snapshot
  `~/.cline/data/locks/hub/` so the stale-manifest class vs. a new class can be distinguished.
- Add the CLI-path hang-detection heartbeat (above) in a dedicated story once a site is agreed, with
  an explicit decision recorded on touching `mailbox-runner/`.
- Consider whether `--timeout` enforcement can be verified directly (DW-002 noted it was not
  reliably enforced).
