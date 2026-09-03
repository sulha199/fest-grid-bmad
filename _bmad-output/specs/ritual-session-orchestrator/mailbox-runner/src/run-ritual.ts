/**
 * Runs one ritual prompt as a child Claude Agent SDK session. Any
 * AskUserQuestion or tool-approval request is relayed through a file-based
 * mailbox instead of a local terminal prompt, so a separate main Claude Code
 * session (a real, interactive, Remote-Control-paired session) can watch the
 * mailbox and relay the question through its own native AskUserQuestion --
 * see ../README.md's "Workaround: file-mailbox relay" section for the full
 * design and why this exists.
 *
 * Usage:
 *   tsx src/run-ritual.ts --mailbox ../mailbox --label "3.6h/bmad-create-story" \
 *       --cwd C:/projects/portfolio/festgrid/bmad --model claude-opus-5 \
 *       --prompt "/bmad-create-story 3.6h"
 *
 * Exits 0 with the final result printed on success; non-zero on failure or
 * mailbox timeout. Does not implement any dependency ordering, batching, or
 * verify-before-advance logic -- that's the caller's job, one invocation per
 * story, same division of responsibility as the manual batch this replaces.
 */

import { randomUUID } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ensureMailboxDirs, writePendingRequest, pollForAnswer, markResolved } from "./mailbox.js";

interface Args {
  prompt: string;
  mailbox: string;
  label: string;
  cwd: string;
  model?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const prompt = get("--prompt");
  const mailbox = get("--mailbox");
  const label = get("--label");
  const cwd = get("--cwd") ?? process.cwd();
  const model = get("--model");
  if (!prompt || !mailbox || !label) {
    throw new Error("Required: --prompt <text> --mailbox <dir> --label <string> [--cwd <path>] [--model <id>]");
  }
  return { prompt, mailbox, label, cwd, model };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureMailboxDirs(args.mailbox);

  console.log(`[run-ritual] label="${args.label}" model=${args.model ?? "(session default)"} cwd=${args.cwd}`);
  console.log(`[run-ritual] prompt: ${args.prompt}`);

  let sessionId: string | undefined;
  let finalText = "";
  let exitedCleanly = false;

  try {
    for await (const message of query({
      prompt: args.prompt,
      options: {
        cwd: args.cwd,
        ...(args.model ? { model: args.model } : {}),
        permissionMode: "acceptEdits",
        canUseTool: async (toolName, input) => {
          const requestId = randomUUID();
          const isQuestion = toolName === "AskUserQuestion";

          console.log(`[run-ritual] canUseTool: ${toolName} -> writing mailbox request ${requestId}`);

          await writePendingRequest(args.mailbox, {
            requestId,
            childLabel: args.label,
            toolName,
            questions: isQuestion ? (input as any).questions : undefined,
            rawInput: input as Record<string, unknown>,
            createdAt: new Date().toISOString(),
          });

          const answer = await pollForAnswer(args.mailbox, requestId);
          await markResolved(args.mailbox, requestId);

          console.log(`[run-ritual] request ${requestId} resolved`);

          if (isQuestion) {
            return {
              behavior: "allow" as const,
              updatedInput: { questions: (input as any).questions, answers: answer.answers ?? {} },
            };
          }
          return answer.approve
            ? { behavior: "allow" as const, updatedInput: input }
            : { behavior: "deny" as const, message: answer.denyMessage ?? "Denied via mailbox relay" };
        },
      },
    })) {
      if (message.type === "result") {
        sessionId = message.session_id;
        if (message.subtype === "success") {
          finalText = message.result;
          exitedCleanly = true;
        } else {
          console.error(`[run-ritual] result subtype: ${message.subtype}`);
        }
      }
    }
  } catch (err) {
    console.error(`[run-ritual] fatal error:`, err);
    process.exitCode = 1;
    return;
  }

  console.log(`\n[run-ritual] session_id=${sessionId}`);
  console.log(`[run-ritual] final result:\n${finalText}`);
  process.exitCode = exitedCleanly ? 0 : 1;
}

main();
