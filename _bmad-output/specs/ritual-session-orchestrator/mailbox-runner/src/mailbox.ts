import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface PendingRequest {
  requestId: string;
  childLabel: string; // human-friendly context, e.g. "3.6h / bmad-create-story"
  toolName: string; // "AskUserQuestion" for a clarifying question; anything else is a tool-approval request
  questions?: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
  rawInput: Record<string, unknown>;
  createdAt: string;
}

export interface MailboxAnswer {
  requestId: string;
  answers?: Record<string, string | string[]>; // AskUserQuestion responses
  approve?: boolean; // plain tool-approval responses
  denyMessage?: string;
  answeredAt: string;
}

function dirs(mailboxDir: string) {
  return {
    pending: path.join(mailboxDir, "pending"),
    answers: path.join(mailboxDir, "answers"),
    resolved: path.join(mailboxDir, "resolved"),
  };
}

export async function ensureMailboxDirs(mailboxDir: string): Promise<void> {
  const d = dirs(mailboxDir);
  await mkdir(d.pending, { recursive: true });
  await mkdir(d.answers, { recursive: true });
  await mkdir(d.resolved, { recursive: true });
}

export async function writePendingRequest(mailboxDir: string, req: PendingRequest): Promise<void> {
  const d = dirs(mailboxDir);
  await writeFile(path.join(d.pending, `${req.requestId}.json`), JSON.stringify(req, null, 2), "utf-8");
}

/**
 * Waits for a matching answer file to appear. The SDK's canUseTool callback can
 * await indefinitely (confirmed against the real Agent SDK docs), so the default
 * timeout here is a safety net against a truly abandoned run, not a real
 * constraint on how long a human may take to answer -- 24h default.
 */
export async function pollForAnswer(
  mailboxDir: string,
  requestId: string,
  opts: { pollIntervalMs?: number; timeoutMs?: number } = {}
): Promise<MailboxAnswer> {
  const pollIntervalMs = opts.pollIntervalMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 24 * 60 * 60 * 1000;
  const d = dirs(mailboxDir);
  const answerPath = path.join(d.answers, `${requestId}.json`);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (existsSync(answerPath)) {
      const raw = await readFile(answerPath, "utf-8");
      return JSON.parse(raw) as MailboxAnswer;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for an answer to request ${requestId}`);
}

/** Moves both files into resolved/ for an audit trail, best-effort (never throws). */
export async function markResolved(mailboxDir: string, requestId: string): Promise<void> {
  const d = dirs(mailboxDir);
  try {
    const pendingPath = path.join(d.pending, `${requestId}.json`);
    const answerPath = path.join(d.answers, `${requestId}.json`);
    if (existsSync(pendingPath)) {
      const content = await readFile(pendingPath, "utf-8");
      await writeFile(path.join(d.resolved, `${requestId}.pending.json`), content, "utf-8");
      await rm(pendingPath, { force: true });
    }
    if (existsSync(answerPath)) {
      const content = await readFile(answerPath, "utf-8");
      await writeFile(path.join(d.resolved, `${requestId}.answer.json`), content, "utf-8");
      await rm(answerPath, { force: true });
    }
  } catch (err) {
    console.error(`[mailbox] non-fatal: failed to archive request ${requestId}:`, err);
  }
}
