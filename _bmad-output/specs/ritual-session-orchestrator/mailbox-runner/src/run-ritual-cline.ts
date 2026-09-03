/**
 * Cline-driven counterpart to run-ritual.ts, for "act" mode (bmad-dev-story,
 * bmad-code-review, bmad-quick-dev) -- see ../README.md's "act mode" section.
 *
 * Design note (why this exists): Cline's SDK has no built-in clarifying-question
 * tool like Claude's AskUserQuestion, and its own approval hook
 * (`requestToolApproval`) is boolean-only (`{approved: boolean}`) -- it cannot
 * carry an answer payload back into the model's tool result. So the design here
 * is deliberately NOT "route AskUserQuestion-shaped calls through
 * requestToolApproval" (that hook can't return an answer, only yes/no). Instead:
 *
 *   - A custom tool, `ask_user_question`, is defined via `createTool` with the
 *     same question/options/multiSelect shape Claude's AskUserQuestion uses.
 *     Its OWN execute() handler -- not the approval callback -- writes the
 *     pending mailbox request, polls for an answer, and returns the answer as
 *     the tool's result. This works because createTool's execute() is
 *     documented as async-capable, explicitly for awaiting external events.
 *   - `toolPolicies: { ask_user_question: { autoApprove: true } }` skips the
 *     approval round-trip for this specific tool (asking a question has no
 *     destructive side effect); requestToolApproval auto-approves everything
 *     else by default, matching the "acceptEdits"-equivalent automation level
 *     used for the Claude side's act-mode-adjacent work.
 *   - The ritual prompt is automatically prefixed with an explicit instruction
 *     to use ask_user_question for genuine ambiguity, since Cline's model has
 *     no native tool it would otherwise reach for -- unlike Claude, this is not
 *     optional context, it's load-bearing for the whole mechanism to fire at all.
 *
 * All field names here (providerId/modelId/apiKey/cwd, ToolApprovalRequest/
 * Result, createTool's signature, the CoreSessionEvent "ended" shape) are
 * copied directly from the installed @cline/sdk's own .d.ts files, not guessed
 * or taken only from doc-site prose -- see the file-by-file trail in this
 * script's accompanying design notes. One piece remains genuinely uncertain
 * and UNTESTED (no provider API key was available in this environment to run
 * a live session the way run-ritual.ts's Claude path was verified): the exact
 * way to retrieve the final AgentResult.text after a session's "ended" event
 * fires. Code below tries `startResult.result` first (populated if the SDK
 * fills it in before start() resolves for a fast task) and falls back to
 * `cline.get(sessionId)` -- verify this path on first real run and adjust if
 * the actual session record shape differs from what's assumed here.
 *
 * Usage (bare API key):
 *   tsx src/run-ritual-cline.ts --mailbox ../mailbox --label "3.6h/bmad-dev-story" \
 *       --cwd C:/projects/portfolio/festgrid/bmad --provider gemini \
 *       --model gemini-3.1-pro-preview --api-key-env GEMINI_API_KEY \
 *       --prompt "/bmad-dev-story 3.6h"
 *
 * Usage (Vertex AI via ambient GCP ADC -- no key, no --provider):
 *   tsx src/run-ritual-cline.ts --mailbox ../mailbox --label "3.6h/bmad-dev-story" \
 *       --cwd C:/projects/portfolio/festgrid/bmad --model gemini-3.1-pro-preview \
 *       --gcp-project <your-gcp-project-id> --gcp-region us-central1 \
 *       --prompt "/bmad-dev-story 3.6h"
 *
 * Verified 2026-09-03, API-key path (no valid key available in this
 * environment, so this stops short of a live model turn): provider "gemini"
 * is the correct id (not "google" -- confirmed by trial against the real
 * "Unknown or disabled provider" check); systemPrompt, enableTools,
 * enableSpawnAgent, and enableAgentTeams are all required at runtime even
 * though the public StartSessionConfig type doesn't mark them that way --
 * omitting any of them throws before any network call. With a fake key, the
 * full lifecycle ran correctly end-to-end (session start -> tool/config
 * registration -> a real call to Google's API -> "ended" event -> final text
 * retrieval all worked; it failed only on "API key not valid", i.e. the
 * credential itself, not this script).
 *
 * Verified 2026-09-03, Vertex ADC path, with REAL credentials (this
 * environment already had `gcloud auth application-default login` state from
 * this machine's existing cline-cli/gemini-cli usage): providerId must be
 * "vertex" specifically, not "gemini" with a clientType override -- that
 * combination reaches the direct Generative AI API client instead and demands
 * GOOGLE_GENERATIVE_AI_API_KEY, defeating the point (confirmed by trial: this
 * exact wrong combination produced that exact error). providerId "vertex" is
 * now derived automatically from --gcp-project/--gcp-region, so this mistake
 * isn't reachable from the CLI surface below. With that fixed, project/region
 * flow correctly into GcpConfig (@cline/llms's providers/config.d.ts,
 * `{projectId, region}`, deliberately no key/credential field of its own) and
 * the call reaches real Vertex AI, authenticated via ambient ADC alone --
 * confirmed by a project-specific "billing not enabled" response naming the
 * exact --gcp-project value passed, i.e. a real, authenticated GCP round trip
 * with zero credentials supplied by this script. **This directly answers "do
 * I need to supply auth info given cline-cli/gemini-cli already use Vertex
 * auth locally": no -- point this script at the same GCP project/region and
 * it reuses the same ADC state, nothing extra to configure.**
 *
 * Verified 2026-09-03, full live round-trip against the user's REAL
 * GOOGLE_CLOUD_PROJECT (billing-enabled, unlike the earlier test project):
 * `--skill bmad-dev-story --story 3.6i` with a harmless prompt completed
 * end-to-end with reason="completed" and a real, coherent model response --
 * every piece (config resolution, auth, session lifecycle, result retrieval)
 * fully proven, not just reaching-the-API-and-failing as before.
 *
 * Also tested: a prompt designed to force ask_user_question, with
 * gemini-3.5-flash (bmad-dev-story's configured default -- a lighter/faster
 * model). First attempt: the tool fired with an EMPTY input (`{}`, no
 * `questions`) and the SDK's own validation did not reject the call before
 * execute() ran -- it then asked its real question as plain final-response
 * text instead of through the tool. Fixed by adding an explicit runtime
 * `askUserQuestionInputSchema.safeParse()` re-check inside execute() itself
 * (see below) that fails closed with a structured `{isError: true}` result
 * on a bad call, rather than trusting the declared TypeScript type or the
 * SDK's own validation.
 *
 * Re-tested with the guard in place: the model called the tool wrong
 * repeatedly (options as bare strings instead of {label, description},
 * missing multiSelect, `questions` as a plain string) across ~10 retries,
 * self-correcting each time off the structured error message, until it
 * produced a fully valid call. The mailbox round-trip then completed
 * end-to-end exactly like the Claude side: request written, this script
 * polled and blocked, the main session (a real person, via its own
 * AskUserQuestion) answered, the answer flowed back, and the session ended
 * with reason="completed" and a correct acknowledgement of the relayed
 * answer. Both failure-recovery (the guard) and the happy path are now
 * proven, not just the happy path -- untested whether gemini-3.1-pro-preview
 * (bmad-code-review's configured default, a stronger model) needs as many
 * retries; likely fewer, not verified.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ClineCore, createTool } from "@cline/sdk";
import type { CoreSessionEvent, AgentToolContext } from "@cline/core";
import { ensureMailboxDirs, writePendingRequest, pollForAnswer, markResolved } from "./mailbox.js";
import { getSkillConfig, knownSkills, type ReasoningEffort } from "./skill-config.js";

interface Args {
  prompt: string;
  mailbox: string;
  label: string;
  cwd: string;
  providerId: string;
  modelId: string;
  reasoningEffort?: ReasoningEffort;
  // Exactly one of these two auth modes is used -- see the file-header note
  // on why Vertex mode carries no key at all (relies on ambient GCP ADC, the
  // same credentials `gcloud`/cline-cli/gemini-cli already use locally).
  apiKeyEnv?: string;
  vertex?: { gcpProject: string; gcpRegion: string };
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  // --skill looks up ../ritual-config.json (routing/region/model/reasoning)
  // and, combined with --story, auto-composes --prompt/--label so a caller
  // driving a batch doesn't retype the same skill invocation shape per
  // story. Any explicit flag below still wins over what --skill supplied.
  const skill = get("--skill");
  const story = get("--story");
  const skillConfig = skill ? getSkillConfig(skill) : undefined;
  if (skill && !skillConfig) {
    throw new Error(`Unknown --skill "${skill}" -- no entry in ritual-config.json. Known skills: ${knownSkills().join(", ")}`);
  }
  if (skillConfig && skillConfig.runtime !== "cline") {
    throw new Error(`--skill "${skill}" is configured for runtime "${skillConfig.runtime}" in ritual-config.json, not "cline" -- use run-ritual.ts instead (or dispatch-ritual.ts, which reads this automatically).`);
  }

  const prompt = get("--prompt") ?? (skill && story ? `/${skill} ${story}` : undefined);
  const mailbox = get("--mailbox");
  const label = get("--label") ?? (skill && story ? `${story}/${skill}` : undefined);
  const cwd = get("--cwd") ?? process.cwd();
  const explicitProviderId = get("--provider");
  const modelId = get("--model") ?? skillConfig?.model;
  const reasoningEffort = (get("--reasoning") as ReasoningEffort | undefined) ?? skillConfig?.reasoningEffort;
  const apiKeyEnv = get("--api-key-env");
  const gcpProject = get("--gcp-project") ?? process.env.GOOGLE_CLOUD_PROJECT;
  const gcpRegion = get("--gcp-region") ?? skillConfig?.gcpRegion;
  const vertex = !apiKeyEnv && gcpProject && gcpRegion ? { gcpProject, gcpRegion } : undefined;

  // Confirmed by a real run against live GCP credentials: Vertex mode needs
  // providerId "vertex" specifically -- NOT "gemini" with a clientType
  // override (that combination reached the direct Generative AI API client
  // instead and demanded GOOGLE_GENERATIVE_AI_API_KEY, defeating the point of
  // using ambient ADC at all). Forcing it here means --provider is simply
  // wrong to pass in Vertex mode rather than a footgun to get wrong.
  const providerId = vertex ? "vertex" : explicitProviderId;

  if (!prompt || !mailbox || !label || !modelId) {
    throw new Error(
      "Required: --mailbox <dir> --model <id> (or --skill <name> to look it up) [--cwd <path>], and either " +
        "(--prompt <text> --label <string>) or (--skill <name> --story <id>), and exactly one auth mode: " +
        "--provider <id> --api-key-env <ENV_VAR_NAME>  |  --gcp-project <id> --gcp-region <region> (Vertex ADC mode, no --provider; " +
        "--gcp-project defaults to $GOOGLE_CLOUD_PROJECT, --gcp-region defaults from --skill if known)"
    );
  }
  if (!providerId) {
    throw new Error("Missing --provider (required unless using Vertex ADC mode via --gcp-project/--gcp-region).");
  }
  if (explicitProviderId && vertex) {
    throw new Error("Vertex ADC mode derives --provider automatically (\"vertex\") -- don't pass --provider alongside --gcp-project/--gcp-region.");
  }
  if (apiKeyEnv && gcpProject && gcpRegion) {
    throw new Error("Pass either --api-key-env or --gcp-project/--gcp-region, not both.");
  }
  if (!apiKeyEnv && !vertex) {
    throw new Error("Missing auth: pass --api-key-env <ENV_VAR_NAME>, or both --gcp-project <id> and --gcp-region <region> (or a --skill with a known gcpRegion default plus $GOOGLE_CLOUD_PROJECT set).");
  }
  if (apiKeyEnv && !process.env[apiKeyEnv]) {
    throw new Error(`Environment variable ${apiKeyEnv} is not set -- required as this Cline session's API key.`);
  }
  return { prompt, mailbox, label, cwd, providerId, modelId, reasoningEffort, apiKeyEnv, vertex };
}

const askUserQuestionInputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().describe("The full question text to show the user"),
        header: z.string().describe("Short label for the question, max 12 characters"),
        options: z
          .array(
            z.object({
              label: z.string().describe("The option's short label"),
              description: z.string().describe("One sentence explaining this option"),
            })
          )
          .min(2)
          .max(4)
          .describe("2-4 choices"),
        multiSelect: z.boolean().describe("Whether the user may select more than one option"),
      })
    )
    .min(1)
    .max(4)
    .describe("1-4 questions to ask the user, same shape as Claude's AskUserQuestion tool"),
});

const ASK_USER_QUESTION_PROMPT_PREAMBLE =
  "You have access to an `ask_user_question` tool. If you hit a genuine design ambiguity you cannot " +
  "safely resolve from the story file / epics.md / project-context.md alone, call it with 1-4 " +
  "questions (2-4 options each) rather than guessing. Do not use it for routine implementation choices " +
  "with no real tradeoff -- only for decisions a human should actually make.\n\n";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureMailboxDirs(args.mailbox);

  console.log(
    `[run-ritual-cline] label="${args.label}" provider=${args.providerId} model=${args.modelId} ` +
      `reasoning=${args.reasoningEffort ?? "(default)"} region=${args.vertex?.gcpRegion ?? "n/a"} cwd=${args.cwd}`
  );

  const askUserQuestionTool = createTool({
    name: "ask_user_question",
    description:
      "Ask the user 1-4 clarifying multiple-choice questions and get their answers back. Use this " +
      "when a design decision is genuinely ambiguous and the wrong guess would be costly to unwind -- " +
      "not for routine implementation choices. Blocks until the user (relayed through a separate main " +
      "session) answers; there is no timeout on your side.",
    inputSchema: askUserQuestionInputSchema,
    timeoutMs: 24 * 60 * 60 * 1000, // must exceed the mailbox's own poll timeout, or the SDK kills the call first
    execute: async (input: unknown, _context: AgentToolContext) => {
      // Runtime re-validation, not just the declared type: confirmed by a real
      // run that the model can invoke this tool with an empty/malformed input
      // ({} -- no `questions` array) despite the schema requiring one, and the
      // SDK's own Zod validation did not reject the call before execute() ran.
      // Bothering a human with a blank question is worse than making the
      // model retry, so this fails closed with a structured error instead of
      // writing to the mailbox on a bad call.
      const parsed = askUserQuestionInputSchema.safeParse(input);
      if (!parsed.success) {
        console.log(`[run-ritual-cline] ask_user_question called with invalid input, asking model to retry: ${parsed.error.message}`);
        return {
          output: {
            error:
              "Invalid input -- `questions` (1-4 items, each with question/header/options[2-4]/multiSelect) is required " +
              "and was missing or malformed. Retry the call with a properly structured `questions` array.",
          },
          isError: true,
        };
      }
      const { questions } = parsed.data;

      const requestId = randomUUID();
      console.log(`[run-ritual-cline] ask_user_question -> writing mailbox request ${requestId}`);

      await writePendingRequest(args.mailbox, {
        requestId,
        childLabel: args.label,
        toolName: "AskUserQuestion", // kept identical to the Claude side's naming so the main session's relay procedure doesn't need to branch on which runtime raised it
        questions,
        rawInput: parsed.data,
        createdAt: new Date().toISOString(),
      });

      const answer = await pollForAnswer(args.mailbox, requestId);
      await markResolved(args.mailbox, requestId);
      console.log(`[run-ritual-cline] request ${requestId} resolved`);

      return { answers: answer.answers ?? {} };
    },
  });

  const cline = await ClineCore.create({ clientName: "mailbox-runner" });

  let sessionId: string | undefined;
  let endedReason: string | undefined;
  const ended = new Promise<void>((resolve) => {
    const unsubscribe = cline.subscribe((event: CoreSessionEvent) => {
      if (event.type === "ended" && (!sessionId || event.payload.sessionId === sessionId)) {
        endedReason = event.payload.reason;
        unsubscribe();
        resolve();
      }
    });
  });

  const startResult = await cline.start({
    prompt: ASK_USER_QUESTION_PROMPT_PREAMBLE + args.prompt,
    config: {
      providerId: args.providerId,
      modelId: args.modelId,
      // Exactly one of these two is populated (parseArgs already enforced
      // that). Vertex mode passes NO apiKey at all -- GcpConfig
      // (@cline/llms's providers/config.d.ts) has no key/credential field of
      // its own, meaning it defers entirely to ambient GCP Application
      // Default Credentials (the same `gcloud auth application-default
      // login` state, or GOOGLE_APPLICATION_CREDENTIALS, that a local
      // cline-cli/gemini-cli install already relies on) -- confirmed present
      // and usable in this environment via `gcloud auth application-default
      // print-access-token` before this mode was built.
      ...(args.apiKeyEnv ? { apiKey: process.env[args.apiKeyEnv] } : {}),
      ...(args.vertex
        ? {
            providerConfig: {
              providerId: args.providerId,
              clientType: "vertex" as const,
              gcp: { projectId: args.vertex.gcpProject, region: args.vertex.gcpRegion },
            },
          }
        : {}),
      ...(args.reasoningEffort ? { reasoningEffort: args.reasoningEffort, thinking: true } : {}),
      cwd: args.cwd,
      // Required, no defaults (confirmed via a real run: omitting these fails
      // Zod validation on enable_tools/enable_spawn/enable_teams before any
      // network call is even attempted). enableTools must be true -- a ritual
      // with no tool access can't read/write files at all.
      enableTools: true,
      enableSpawnAgent: false,
      enableAgentTeams: false,
      // Also confirmed required at runtime (composeSystemPrompt crashes calling
      // .trim() on this if it's undefined) even though TypeScript itself didn't
      // flag it missing -- the public StartSessionConfig type is more lenient
      // than what the actual runtime enforces.
      systemPrompt: "You are Cline, an autonomous coding agent executing one bmad ritual task in this repository.",
    },
    localRuntime: {
      extraTools: [askUserQuestionTool],
    },
    toolPolicies: {
      ask_user_question: { autoApprove: true },
    },
    capabilities: {
      // Auto-approve everything else (matches the Claude side's `permissionMode:
      // "acceptEdits"` automation level for act-mode work). Tighten this to
      // relay genuinely risky calls (e.g. destructive Bash) through the mailbox
      // as a boolean approve/deny if that turns out to be needed in practice --
      // not built here since it's speculative until there's a real case for it.
      requestToolApproval: async () => ({ approved: true }),
    },
  });

  sessionId = startResult.sessionId;
  console.log(`[run-ritual-cline] session started, session_id=${sessionId}`);

  await ended;

  console.log(`[run-ritual-cline] session ended, reason=${endedReason}`);

  // Best-effort final-text retrieval -- see the file-header note on why this
  // part is unverified. startResult.result is checked first since it's typed
  // as already-optionally-present on StartSessionResult; cline.get() is the
  // documented fallback for fetching session state after the fact.
  let finalText = startResult.result?.text;
  if (!finalText) {
    const record = await cline.get(sessionId);
    finalText = (record as { result?: { text?: string } } | undefined)?.result?.text;
  }

  console.log(`[run-ritual-cline] final result:\n${finalText ?? "(unavailable -- see file-header note on this retrieval path being unverified)"}`);

  await cline.dispose();
  process.exitCode = endedReason === "completed" || !endedReason ? 0 : 1;
}

main().catch((err) => {
  console.error("[run-ritual-cline] fatal error:", err);
  process.exitCode = 1;
});
