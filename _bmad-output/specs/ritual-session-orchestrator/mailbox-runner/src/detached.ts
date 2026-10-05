/**
 * Shared bits for running a child detached from whatever is watching it.
 *
 * Why this exists (found 2026-10-04, Wave 4A): a child launched *inside* a `Monitor` call
 * dies when that Monitor expires (30 minutes at most) -- the watch and the run share one
 * lifetime. Here the child runs under its own session (setsid) and writes to a log file;
 * the watcher only tails that file, so it can expire and be re-armed any number of times
 * without touching the child. See launch-detached.ts and watch-log.ts.
 *
 * Files, all under <mailbox>/logs/ and keyed by the sanitized label:
 *   <label>.log      combined stdout+stderr of the child, ending with "[exit code N]"
 *   <label>.pid      pid of the child's process group leader
 *   <label>.offset   byte offset the watcher has already delivered
 */

import path from "node:path";

/** The line the wrapper appends when the child exits; the watcher stops on it. */
export const EXIT_MARKER = /^\[exit code (-?\d+)\]$/;

/**
 * The lines worth waking the orchestrator for -- the same signal set the Monitor
 * grep used to carry. Anchored where it can be so a prompt that merely mentions
 * "Error" in its own text does not match.
 */
export const DEFAULT_SIGNAL =
  /writing mailbox request|request .* resolved|session ended|final result|\[run-act-with-checks\]|\[run-check|HALT|^\s*(Error|ERROR)\b|\[run-ritual\] (fatal|result subtype)|error TS[0-9]|Failed:|FAILED|Tasks:|\[exit code/;

export function safeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export interface LogPaths {
  dir: string;
  log: string;
  pid: string;
  offset: string;
}

export function logPaths(mailboxDir: string, label: string): LogPaths {
  const dir = path.join(mailboxDir, "logs");
  const safe = safeLabel(label);
  return {
    dir,
    log: path.join(dir, `${safe}.log`),
    pid: path.join(dir, `${safe}.pid`),
    offset: path.join(dir, `${safe}.offset`),
  };
}

/** True when a process with this pid is alive (signal 0 only probes). */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Splits freshly read text into complete lines, returning the unfinished tail so the
 * next read can complete it. Keeps a half-written line from being matched (or
 * missed) by the filter.
 */
export function splitComplete(buffered: string): { lines: string[]; rest: string } {
  const parts = buffered.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts, rest };
}
