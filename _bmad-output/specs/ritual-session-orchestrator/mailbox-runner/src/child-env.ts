/**
 * Keeps a dispatched child's Claude session separate from the orchestrator's.
 *
 * Why this exists (found 2026-10-04, Wave 4A): when the orchestrator is itself a
 * Claude Code session, every child it spawned reported the ORCHESTRATOR's session id
 * in its init message and wrote into the orchestrator's transcript, so
 * `--resume-label` saved and later reloaded that id -- resuming the orchestrator's
 * own conversation instead of the dev child's.
 *
 * What fixes it (verified by experiment, not assumed):
 *   - Passing an explicit `sessionId` (a fresh UUID) to query() -- the child then uses it. This is the fix;
 *     see run-ritual.ts.
 *   - Dropping CLAUDE_CODE_SESSION_ID from the child's env (childProcessEnv) is NOT sufficient on its own,
 *     and neither is also dropping CLAUDE_CODE_CHILD_SESSION / CLAUDE_CODE_MESSAGING_SOCKET. It is kept as
 *     hygiene so the child is not told it belongs to the parent's session.
 *
 * `assertNotParentSession` is the safety net: if a child ever reports (or a saved file carries) the
 * orchestrator's id again, fail loudly rather than let a later resume misread it.
 */

/** Variables that bind a process to one specific Claude Code session. */
export const SESSION_BINDING_ENV_VARS = ["CLAUDE_CODE_SESSION_ID"] as const;

type Env = Record<string, string | undefined>;

/** A copy of `base` with every session-binding variable removed. */
export function childProcessEnv(base: Env = process.env): Env {
  const env: Env = { ...base };
  for (const name of SESSION_BINDING_ENV_VARS) delete env[name];
  return env;
}

/** The session id of the Claude Code session running this orchestrator, if any. */
export function parentSessionId(base: Env = process.env): string | undefined {
  return base.CLAUDE_CODE_SESSION_ID || undefined;
}

/**
 * Throws when `sessionId` is the orchestrator's own. `where` says which step noticed
 * (e.g. "init message", "saved session file") so the message points at the fix.
 */
export function assertNotParentSession(sessionId: string, where: string, base: Env = process.env): void {
  const parent = parentSessionId(base);
  if (parent && sessionId === parent) {
    throw new Error(
      `${where} carries the orchestrator's own session id (${sessionId}). A resume would load the orchestrator's ` +
        `conversation, not the dev child's. Delete the stale <mailbox>/sessions/<label>.json and dispatch fresh; ` +
        `dispatch children with an explicit sessionId (see run-ritual.ts).`,
    );
  }
}
