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
 * Usage (OpenAI-compatible endpoint, e.g. DeepInfra -- bare API key + baseUrl):
 *   tsx src/run-ritual-cline.ts --mailbox ../mailbox --label "3.6h/bmad-dev-story" \
 *       --cwd C:/projects/portfolio/festgrid/bmad --provider openai-compatible \
 *       --model deepseek-ai/DeepSeek-V4-Flash-0731 --api-key-env DEEPINFRA_API_KEY \
 *       --base-url https://api.deepinfra.com/v1/openai --prompt "/bmad-dev-story 3.6h"
 * Verified 2026-09-12, live round-trip against a real DeepInfra key, both as
 * raw --provider/--api-key-env/--base-url flags and via --config
 * all-claude-deepseek-medium --skill bmad-quick-dev (config-driven
 * ClineProviderSkillConfig resolution): session started, reached
 * reason="completed", and returned the exact expected model text for a
 * harmless no-tool-use prompt. Confirms providerId "openai-compatible" +
 * baseUrl is a valid combination and that skill-config.ts's provider/
 * apiKeyEnv/baseUrl fields flow through correctly. Only a benign SDK
 * deprecation warning appeared ("providerOptions key 'openai-compatible',
 * use 'openaiCompatible' instead") -- internal to the AI SDK's own model
 * resolution, not something this script sets, no action needed.
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
 *
 * Whole-session retry on transient network death (added 2026-09-12): two
 * consecutive real bmad-dev-story runs against DeepInfra (openai-compatible)
 * died 9-16 minutes in with raw undici transport errors -- `SocketError:
 * other side closed (UND_ERR_SOCKET)` and `read ECONNRESET` -- surfacing as
 * "Failed to process successful response" (DeepInfra returned 200 and
 * started streaming; the connection died while the SDK was still consuming
 * it). This is a known undici keep-alive/pooling issue (nodejs/undici
 * #3300, #2400, #1923), not a DeepInfra outage or a bad key (both verified
 * live via plain curl against the same endpoint/key: a non-streaming call
 * and an 18s/550-token streaming call both completed cleanly). `@cline/llms`
 * already wraps every vendor model in a transient-network retry middleware,
 * but its own doc comment scopes it to interruptions *before* any model
 * output for that turn -- a death after content has started streaming
 * (likely for a long dev-story turn) falls outside that coverage.
 *
 * True mid-conversation resume was investigated and ruled out as the fix:
 * `@cline/sdk` has no resume field at all, and the standalone `cline` CLI's
 * `--id <session-id>` (which does exist) hard-requires an interactive TTY --
 * it fails even with `--json` and a supplied prompt (see
 * ../README.md's Resume section for the full verification trail). So the
 * mitigation here is a coarser one: `runOneAttempt` wraps a single full
 * session (create/start/wait-for-ended/dispose), and `main` retries the
 * *whole attempt from scratch* (fresh session, same prompt) up to
 * `--max-attempts` times (default 3) when `isTransientNetworkError` matches
 * the thrown error, with doubling backoff. This is restart, not resume --
 * but for bmad-dev-story specifically that gap is narrow in practice: the
 * skill's own Step 1 re-parses the story file and jumps to "first incomplete
 * task (unchecked [ ])" on every fresh start, and it checks off tasks one at
 * a time as it finishes them (not all at the end), so a restart only re-does
 * the in-flight task's reasoning, not the whole story -- already-written
 * files and already-checked-off tasks are not redone.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ClineCore, createTool } from "@cline/sdk";
import type { CoreSessionEvent, AgentToolContext } from "@cline/core";
import { ensureMailboxDirs, writePendingRequest, pollForAnswer, markResolved } from "./mailbox.js";
import { getSkillConfig, knownSkills, setConfigOverride, activeConfigPath, type ReasoningEffort } from "./skill-config.js";

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
  baseUrl?: string;
  vertex?: { gcpProject: string; gcpRegion: string };
  idleTimeoutMs?: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  // --config selects a preset (bare name -> config-presets/<name>.json) or
  // literal path in place of the default ../ritual-config.json. Must be
  // applied before the --skill lookup below.
  const configFlag = get("--config");
  if (configFlag) setConfigOverride(configFlag);

  // --skill looks up the active config (routing/region/model/reasoning) and,
  // combined with --story, auto-composes --prompt/--label so a caller
  // driving a batch doesn't retype the same skill invocation shape per
  // story. Any explicit flag below still wins over what --skill supplied.
  const skill = get("--skill");
  const story = get("--story");
  const skillConfig = skill ? getSkillConfig(skill) : undefined;
  if (skill && !skillConfig) {
    throw new Error(`Unknown --skill "${skill}" -- no entry in ${activeConfigPath()}. Known skills: ${knownSkills().join(", ")}`);
  }
  if (skillConfig && skillConfig.runtime !== "cline") {
    throw new Error(`--skill "${skill}" is configured for runtime "${skillConfig.runtime}" in ${activeConfigPath()}, not "cline" -- use run-ritual.ts instead (or dispatch-ritual.ts, which reads this automatically).`);
  }

  const prompt = get("--prompt") ?? (skill && story ? `/${skill} ${story}` : undefined);
  const mailbox = get("--mailbox");
  const label = get("--label") ?? (skill && story ? `${story}/${skill}` : undefined);
  const cwd = get("--cwd") ?? process.cwd();
  // skillConfig is a ClineVertexSkillConfig (gcpRegion) or a
  // ClineProviderSkillConfig (provider/apiKeyEnv/baseUrl) -- narrow by field
  // presence rather than a discriminant tag, since both share runtime:"cline".
  const skillProviderId = skillConfig && "provider" in skillConfig ? skillConfig.provider : undefined;
  const skillApiKeyEnv = skillConfig && "apiKeyEnv" in skillConfig ? skillConfig.apiKeyEnv : undefined;
  const skillBaseUrl = skillConfig && "baseUrl" in skillConfig ? skillConfig.baseUrl : undefined;
  const skillGcpRegion = skillConfig && "gcpRegion" in skillConfig ? skillConfig.gcpRegion : undefined;

  const explicitProviderId = get("--provider") ?? skillProviderId;
  const modelId = get("--model") ?? skillConfig?.model;
  const reasoningEffort = (get("--reasoning") as ReasoningEffort | undefined) ?? skillConfig?.reasoningEffort;
  const apiKeyEnv = get("--api-key-env") ?? skillApiKeyEnv;
  const baseUrl = get("--base-url") ?? skillBaseUrl;
  const gcpProject = get("--gcp-project") ?? process.env.GOOGLE_CLOUD_PROJECT;
  const gcpRegion = get("--gcp-region") ?? skillGcpRegion;
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
        "--provider <id> --api-key-env <ENV_VAR_NAME> [--base-url <url>]  |  --gcp-project <id> --gcp-region <region> (Vertex ADC mode, no --provider; " +
        "--gcp-project defaults to $GOOGLE_CLOUD_PROJECT, --gcp-region defaults from --skill if known). " +
        "--provider/--api-key-env/--base-url also default from a --skill's ClineProviderSkillConfig entry."
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
  const idleTimeoutMsArg = get("--idle-timeout-ms");
  const idleTimeoutMs = idleTimeoutMsArg ? Number(idleTimeoutMsArg) : undefined;

  return { prompt, mailbox, label, cwd, providerId, modelId, reasoningEffort, apiKeyEnv, baseUrl, vertex, idleTimeoutMs };
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

const DEFAULT_MAX_ATTEMPTS = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 5000;
// Idle (no-SDK-event) watchdog, not a wall-clock session limit -- a real
// dev-story turn or a genuine pending ask_user_question human-answer wait
// (up to 24h, per that tool's own timeoutMs) must not trip this, only total
// silence should. Added 2026-09-12 after a live smoke test hung 20+ minutes
// past "session started" with zero further SDK events and no error -- the
// original code had no bound on `await ended` at all, so a stall like that
// blocked forever instead of ever reaching the retry loop.
const DEFAULT_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const IDLE_WATCHDOG_POLL_MS = 15000;
// Shared between the idle watchdog's rejection message and
// isTransientNetworkError's matcher below, so a stall (no recognizable
// network error, just total silence -- the exact failure mode a live smoke
// test hit with zero further output past "session started") is retried the
// same way a recognized transport error is, instead of going straight to a
// hard failure and defeating the point of adding the watchdog at all.
const STALLED_SESSION_MARKER = "stalled session";

/**
 * Whether an error (anywhere in its `cause` chain) looks like a transient
 * transport interruption rather than a real business/content failure --
 * same vocabulary `@cline/llms`'s own internal retry middleware uses
 * (SocketError/UND_ERR_SOCKET, ECONNRESET, timeouts), confirmed against the
 * two real failures this was built for: "TypeError: terminated: SocketError:
 * other side closed (UND_ERR_SOCKET)" and "TypeError: terminated: read
 * ECONNRESET (ECONNRESET)" -- plus the idle watchdog's own
 * STALLED_SESSION_MARKER. An abort anywhere in the chain vetoes the match
 * (a deliberate cancel must never trigger a retry-from-scratch).
 */
function isTransientNetworkError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  let matched = false;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as { message?: unknown; code?: unknown; name?: unknown; cause?: unknown };
    const text = `${String(e.name ?? "")} ${String(e.message ?? "")} ${String(e.code ?? "")}`;
    if (/abort/i.test(text)) return false;
    if (
      new RegExp(
        `ECONNRESET|UND_ERR_SOCKET|SocketError|other side closed|ETIMEDOUT|EPIPE|socket hang up|network socket disconnected|terminated|${STALLED_SESSION_MARKER}`,
        "i"
      ).test(text)
    ) {
      matched = true;
    }
    current = e.cause;
  }
  return matched;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs one full Cline session start-to-finish. Throws on any hard failure
 *  (including a transient network death) -- the caller in main() decides
 *  whether that's worth retrying from scratch. */
async function runOneAttempt(args: Args, attempt: number): Promise<{ endedReason: string | undefined; finalText: string | undefined }> {
  console.log(
    `[run-ritual-cline] attempt ${attempt}: label="${args.label}" provider=${args.providerId} model=${args.modelId} ` +
      `reasoning=${args.reasoningEffort ?? "(default)"} region=${args.vertex?.gcpRegion ?? "n/a"} ` +
      `baseUrl=${args.baseUrl ?? "(provider default)"} cwd=${args.cwd}`
  );

  const idleTimeoutMs = args.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  let lastActivityAt = Date.now();
  // Suppresses the idle watchdog while genuinely (and correctly) blocked on a
  // human answer -- that wait is expected to be silent from the SDK's side
  // for as long as it takes a person to respond, which is not a stall.
  let awaitingHumanAnswer = false;

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

      awaitingHumanAnswer = true;
      try {
        const answer = await pollForAnswer(args.mailbox, requestId);
        await markResolved(args.mailbox, requestId);
        console.log(`[run-ritual-cline] request ${requestId} resolved`);
        return { answers: answer.answers ?? {} };
      } finally {
        awaitingHumanAnswer = false;
        lastActivityAt = Date.now();
      }
    },
  });

  const cline = await ClineCore.create({ clientName: "mailbox-runner" });

  let sessionId: string | undefined;
  let endedReason: string | undefined;
  const ended = new Promise<void>((resolve) => {
    const unsubscribe = cline.subscribe((event: CoreSessionEvent) => {
      lastActivityAt = Date.now();
      if (event.type === "ended" && (!sessionId || event.payload.sessionId === sessionId)) {
        endedReason = event.payload.reason;
        unsubscribe();
        resolve();
      }
    });
  });

  let watchdogInterval: ReturnType<typeof setInterval> | undefined;
  const idleWatchdog = new Promise<never>((_resolve, reject) => {
    watchdogInterval = setInterval(() => {
      if (awaitingHumanAnswer) return;
      const idleFor = Date.now() - lastActivityAt;
      if (idleFor > idleTimeoutMs) {
        reject(
          new Error(
            `[run-ritual-cline] attempt ${attempt}: no SDK activity for ${idleFor}ms (session_id=${sessionId ?? "not yet assigned"}) -- treating as a ${STALLED_SESSION_MARKER}, not a graceful end`
          )
        );
      }
    }, IDLE_WATCHDOG_POLL_MS);
  });

  try {
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
      // Flat CoreModelConfig field (@cline/core's types/config.d.ts) -- no
      // nested providerConfig wrapper needed here, unlike Vertex below, since
      // baseUrl/providerId/modelId/apiKey are all top-level on CoreModelConfig.
      ...(args.baseUrl ? { baseUrl: args.baseUrl } : {}),
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
    console.log(`[run-ritual-cline] attempt ${attempt}: session started, session_id=${sessionId}`);

    await Promise.race([ended, idleWatchdog]);

    console.log(`[run-ritual-cline] attempt ${attempt}: session ended, reason=${endedReason}`);

    // Best-effort final-text retrieval -- see the file-header note on why this
    // part is unverified. startResult.result is checked first since it's typed
    // as already-optionally-present on StartSessionResult; cline.get() is the
    // documented fallback for fetching session state after the fact.
    let finalText = startResult.result?.text;
    if (!finalText) {
      const record = await cline.get(sessionId);
      finalText = (record as { result?: { text?: string } } | undefined)?.result?.text;
    }

    console.log(`[run-ritual-cline] attempt ${attempt}: final result:\n${finalText ?? "(unavailable -- see file-header note on this retrieval path being unverified)"}`);

    return { endedReason, finalText };
  } finally {
    // Always runs -- on a clean end, an idle-watchdog timeout, or any other
    // thrown error -- so a stalled or failed attempt never leaks a live
    // ClineCore instance/subscription into the next retry.
    clearInterval(watchdogInterval);
    await cline.dispose().catch((err: unknown) => {
      console.error(`[run-ritual-cline] attempt ${attempt}: non-fatal: cline.dispose() failed:`, err);
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureMailboxDirs(args.mailbox);

  const maxAttemptsArg = process.argv.slice(2).indexOf("--max-attempts");
  const maxAttempts = maxAttemptsArg >= 0 ? Number(process.argv.slice(2)[maxAttemptsArg + 1]) : DEFAULT_MAX_ATTEMPTS;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { endedReason } = await runOneAttempt(args, attempt);
      process.exitCode = endedReason === "completed" || !endedReason ? 0 : 1;
      return;
    } catch (err) {
      lastError = err;
      const transient = isTransientNetworkError(err);
      console.error(
        `[run-ritual-cline] attempt ${attempt}/${maxAttempts} failed${transient ? " (transient network error)" : ""}:`,
        err
      );
      if (!transient || attempt === maxAttempts) break;
      const delayMs = NETWORK_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.log(`[run-ritual-cline] retrying from scratch (fresh session, same prompt) in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

main().catch((err) => {
  console.error("[run-ritual-cline] fatal error:", err);
  process.exitCode = 1;
});
