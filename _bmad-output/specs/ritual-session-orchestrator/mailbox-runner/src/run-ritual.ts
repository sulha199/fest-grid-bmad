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
 *
 * Session resume: this session's own `session_id` (confirmed present on the
 * real init `SDKSystemMessage`, required field) is captured and persisted to
 * `<mailbox>/sessions/<sanitized-label>.json` as soon as it's known -- before
 * the ritual does any real work -- specifically so it survives this process
 * being killed mid-flight (machine restart, an accidental kill, a crash while
 * genuinely waiting on a mailbox answer). Pass `--resume <session-id>` (or
 * `--resume-label <label>` to look it up from that file instead of requiring
 * the caller to already have the raw ID) to continue that exact conversation
 * via the SDK's documented `resume` option, rather than starting over. No
 * equivalent exists for run-ritual-cline.ts -- confirmed by reading @cline/sdk's
 * actual types that it has no session-resume-by-ID capability at all.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ensureMailboxDirs, writePendingRequest, pollForAnswer, markResolved } from "./mailbox.js";
import { getSkillConfig, knownSkills, type ClaudeEffort } from "./skill-config.js";

interface Args {
  prompt: string;
  mailbox: string;
  label: string;
  cwd: string;
  model?: string;
  effort?: ClaudeEffort;
  resume?: string;
  resumeLabel?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  // --skill looks up ../ritual-config.json (routing/model/effort) and, with
  // --story, auto-composes --prompt/--label -- same convenience as the Cline
  // side. Any explicit flag below still wins over what --skill supplied.
  const skill = get("--skill");
  const story = get("--story");
  const skillConfig = skill ? getSkillConfig(skill) : undefined;
  if (skill && !skillConfig) {
    throw new Error(`Unknown --skill "${skill}" -- no entry in ritual-config.json. Known skills: ${knownSkills().join(", ")}`);
  }
  if (skillConfig && skillConfig.runtime !== "claude") {
    throw new Error(`--skill "${skill}" is configured for runtime "${skillConfig.runtime}" in ritual-config.json, not "claude" -- use run-ritual-cline.ts instead (or dispatch-ritual.ts, which reads this automatically).`);
  }

  const prompt = get("--prompt") ?? (skill && story ? `/${skill} ${story}` : undefined);
  const mailbox = get("--mailbox");
  const label = get("--label") ?? (skill && story ? `${story}/${skill}` : undefined);
  const cwd = get("--cwd") ?? process.cwd();
  const model = get("--model") ?? skillConfig?.model;
  const effort = (get("--effort") as ClaudeEffort | undefined) ?? skillConfig?.effort;
  const resume = get("--resume");
  const resumeLabel = get("--resume-label");
  if (!prompt || !mailbox || !label) {
    throw new Error(
      "Required: --mailbox <dir> --label <string> (or --skill <name> --story <id> to derive prompt/label), " +
        "[--cwd <path>] [--model <id>] [--effort <level>] " +
        "[--resume <session-id> | --resume-label <label, looked up from <mailbox>/sessions/>]"
    );
  }
  if (resume && resumeLabel) {
    throw new Error("Pass either --resume <session-id> or --resume-label <label>, not both.");
  }
  return { prompt, mailbox, label, cwd, model, effort, resume, resumeLabel };
}

function sessionFilePath(mailboxDir: string, label: string): string {
  const safe = label.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(mailboxDir, "sessions", `${safe}.json`);
}

async function loadSessionId(mailboxDir: string, label: string): Promise<string> {
  const filePath = sessionFilePath(mailboxDir, label);
  const raw = await readFile(filePath, "utf-8").catch(() => {
    throw new Error(`No saved session found for --resume-label "${label}" (expected ${filePath}). Use --resume <session-id> directly if you have it from the run's own log output.`);
  });
  const { sessionId } = JSON.parse(raw) as { sessionId: string };
  return sessionId;
}

async function saveSessionId(mailboxDir: string, label: string, sessionId: string): Promise<void> {
  const filePath = sessionFilePath(mailboxDir, label);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ label, sessionId, savedAt: new Date().toISOString() }, null, 2), "utf-8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureMailboxDirs(args.mailbox);

  const resumeSessionId = args.resume ?? (args.resumeLabel ? await loadSessionId(args.mailbox, args.resumeLabel) : undefined);

  console.log(`[run-ritual] label="${args.label}" model=${args.model ?? "(session default)"} effort=${args.effort ?? "(default)"} cwd=${args.cwd}`);
  console.log(`[run-ritual] prompt: ${args.prompt}`);
  if (resumeSessionId) console.log(`[run-ritual] resuming session_id=${resumeSessionId}`);

  let sessionId: string | undefined;
  let finalText = "";
  let exitedCleanly = false;

  try {
    for await (const message of query({
      prompt: args.prompt,
      options: {
        cwd: args.cwd,
        ...(args.model ? { model: args.model } : {}),
        ...(args.effort ? { effort: args.effort } : {}),
        ...(resumeSessionId ? { resume: resumeSessionId } : {}),
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
      // Captured from the init message, not just the final result: this is
      // what makes resume actually useful for a process that gets killed
      // mid-flight -- by the time a "result" message would arrive, it's too
      // late to have saved anything.
      if (message.type === "system" && message.subtype === "init" && !sessionId) {
        sessionId = message.session_id;
        console.log(`[run-ritual] session_id=${sessionId} (saved for --resume-label "${args.label}")`);
        await saveSessionId(args.mailbox, args.label, sessionId);
      }
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
