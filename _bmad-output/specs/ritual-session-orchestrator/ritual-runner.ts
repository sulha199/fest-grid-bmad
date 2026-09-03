/**
 * Ritual Session Orchestrator — PARKED reference template (2026-09-03)
 *
 * NOT the current plan. Read README.md's "Parked: the Claude Agent SDK approach"
 * section first — the accepted design instead runs each ritual as an ordinary
 * interactive Claude Code session (local changes, Remote Control for mobile
 * monitoring/HIL), not a spawned process driving this file. This template stays
 * relevant only for a future fully-unattended run with no human watching at all
 * (auto-with-escalation/auto-only HIL levels actually deciding things via a
 * second LLM call) — don't build this out further for the interactive workflow.
 *
 * Not wired into any package.json/build in this monorepo (needs
 * `@anthropic-ai/claude-agent-sdk` and `@anthropic-ai/sdk` as dependencies if
 * ever adopted). Confirmed against the real Agent SDK docs
 * (code.claude.com/docs/en/agent-sdk) — canUseTool signature, AskUserQuestion's
 * questions/answers shape, and session-id capture are copied from documented
 * examples, not recalled from training.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline/promises";

// ---------------------------------------------------------------------------
// The seam: today only ClaudeSdkRitualDriver implements this. A future
// ClineRitualDriver (or anything else) would implement the same shape via
// Cline's `requestToolApproval` + a hand-built question tool — see README.md's
// "Cline SDK" section for why that adapter is a real build, not a copy-paste.
// ---------------------------------------------------------------------------

export interface PendingQuestion {
  toolName: string; // "AskUserQuestion" for a clarifying question; anything else is a tool-approval request
  questions?: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
  rawInput: Record<string, unknown>; // the tool's raw input, for tool-approval requests that aren't AskUserQuestion
}

export interface QuestionAnswer {
  // For AskUserQuestion: map each question's `question` text to the chosen label
  // (or an array of labels for multiSelect). For a plain tool-approval request,
  // leave answers empty and use `approve`/`denyMessage` instead.
  answers?: Record<string, string | string[]>;
  approve?: boolean; // tool-approval requests only
  denyMessage?: string; // tool-approval requests only, when approve === false
}

export interface RitualSessionDriver {
  /** Runs one ritual prompt (e.g. "/bmad-create-story 3.6g") to completion, calling
   *  `onQuestion` every time the underlying session needs input. Resolves with the
   *  final session id (for later `resume`, if you add that path) once the ritual
   *  finishes or is deferred. */
  run(ritualPrompt: string, onQuestion: (q: PendingQuestion) => Promise<QuestionAnswer>): Promise<{ sessionId: string | undefined; finalText: string }>;
}

// ---------------------------------------------------------------------------
// Configurable HIL level — this is the actual "template" the user asked for.
// The level lives here, not inside the driver: swap HIL policy without
// touching how the child session is actually driven.
// ---------------------------------------------------------------------------

export type HilLevel = "always-human" | "auto-with-escalation" | "auto-only";

export interface HumanChannel {
  /** Present a question (already flattened to plain text + options) and return
   *  the human's answer. Default implementation below is a terminal prompt;
   *  swap for Slack/a web form/email without touching the policy code. */
  ask(prompt: string, options?: string[]): Promise<string>;
}

export class TerminalHumanChannel implements HumanChannel {
  async ask(prompt: string, options?: string[]): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (options?.length) {
        console.log(`\n${prompt}`);
        options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
        const raw = await rl.question("Your choice (number or free text): ");
        const idx = parseInt(raw.trim(), 10) - 1;
        return idx >= 0 && idx < options.length ? options[idx] : raw.trim();
      }
      return (await rl.question(`\n${prompt}\n> `)).trim();
    } finally {
      rl.close();
    }
  }
}

// High-stakes keyword gate — same spirit as the real bmad-* skills' own Gate 1/3
// language ("legal/minimization-critical", "architecture-changing", "security").
// This is intentionally crude; replace with something better once you have real
// escalation-vs-auto-answer outcomes to tune against.
const HIGH_STAKES_MARKERS = [
  /legal|minimi[sz]ation|privacy|gdpr|compliance/i,
  /architecture|schema migration|breaking change/i,
  /security|auth|secret|credential|encrypt/i,
  /cost|pricing|billing/i,
];

function looksHighStakes(questionText: string): boolean {
  return HIGH_STAKES_MARKERS.some((re) => re.test(questionText));
}

/** The auto-answer attempt for `auto-with-escalation` / `auto-only`. Uses a
 *  plain Messages API call (not the Agent SDK) — this is a single classification/
 *  judgment call, not an agentic task, so the lighter surface is the right tier
 *  (see claude-api skill's "Which Surface Should I Use?"). Returns null if the
 *  model itself reports low confidence — treat that as "could not auto-answer",
 *  never as "answered null". */
async function attemptAutoAnswer(
  anthropic: Anthropic,
  question: string,
  options: Array<{ label: string; description: string }>,
  ritualContext: string
): Promise<{ label: string; confidence: number; reasoning: string } | null> {
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    system:
      "You are helping resolve a design-clarification question raised mid-task by another AI agent. " +
      "Answer only from the given context — never invent project facts you were not given. " +
      "If the context genuinely doesn't settle the question, say so honestly with low confidence " +
      "rather than guessing to look decisive.",
    messages: [
      {
        role: "user",
        content:
          `Ritual context so far:\n${ritualContext}\n\n` +
          `Question: ${question}\n` +
          `Options:\n${options.map((o, i) => `${i + 1}. ${o.label} — ${o.description}`).join("\n")}\n\n` +
          `Reply with exactly this JSON shape, nothing else: ` +
          `{"chosenLabel": "<one of the option labels, verbatim>", "confidence": <0-1>, "reasoning": "<one sentence>"}`,
      },
    ],
  });
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.chosenLabel === "string" && typeof parsed.confidence === "number") {
      return { label: parsed.chosenLabel, confidence: parsed.confidence, reasoning: parsed.reasoning ?? "" };
    }
  } catch {
    // fall through to null — malformed auto-answer is treated as "could not answer", not a crash
  }
  return null;
}

const AUTO_ANSWER_CONFIDENCE_THRESHOLD = 0.75;

/** Builds the onQuestion handler for a given HIL level. Pass this to
 *  ClaudeSdkRitualDriver.run(). `ritualContext` is whatever project context you
 *  want the auto-answer tier to reason from (e.g. the epics.md AC text for the
 *  story in play) — pass real content, not a file path; the auto-answer call
 *  never reads files itself. */
export function makeQuestionHandler(
  hilLevel: HilLevel,
  ritualContext: string,
  humanChannel: HumanChannel = new TerminalHumanChannel(),
  anthropic: Anthropic = new Anthropic(),
  onDecisionLogged?: (log: { question: string; decidedBy: "human" | "auto"; answer: string; confidence?: number; reasoning?: string }) => void
) {
  return async function onQuestion(pending: PendingQuestion): Promise<QuestionAnswer> {
    // Plain tool-approval request (not a clarifying question) — always relay to
    // the human channel regardless of hilLevel; auto-answering "should this Bash
    // command run" is a different, much riskier problem than auto-answering a
    // design-clarification multiple-choice question, and out of scope here.
    if (pending.toolName !== "AskUserQuestion" || !pending.questions) {
      const decision = await humanChannel.ask(
        `Approve tool "${pending.toolName}"? Input: ${JSON.stringify(pending.rawInput)} (y/n)`
      );
      const approve = decision.trim().toLowerCase().startsWith("y");
      return { approve, denyMessage: approve ? undefined : "User denied this action" };
    }

    const answers: Record<string, string | string[]> = {};

    for (const q of pending.questions) {
      const optionLabels = q.options.map((o) => o.label);

      if (hilLevel === "always-human") {
        answers[q.question] = await humanChannel.ask(q.question, optionLabels);
        onDecisionLogged?.({ question: q.question, decidedBy: "human", answer: String(answers[q.question]) });
        continue;
      }

      const highStakes = looksHighStakes(q.question);
      const auto = highStakes && hilLevel === "auto-with-escalation" ? null : await attemptAutoAnswer(anthropic, q.question, q.options, ritualContext);

      const shouldAutoAnswer =
        hilLevel === "auto-only" ||
        (hilLevel === "auto-with-escalation" && !highStakes && auto !== null && auto.confidence >= AUTO_ANSWER_CONFIDENCE_THRESHOLD);

      if (shouldAutoAnswer && auto !== null) {
        answers[q.question] = auto.label;
        onDecisionLogged?.({
          question: q.question,
          decidedBy: "auto",
          answer: auto.label,
          confidence: auto.confidence,
          reasoning: auto.reasoning,
        });
        continue;
      }

      // Escalate: auto-only with a failed auto-answer still escalates rather than
      // guessing blind — "never" escalating only applies to a *successful*
      // auto-answer at that level, not to inventing an answer from nothing.
      const humanAnswer = await humanChannel.ask(
        highStakes ? `[flagged high-stakes] ${q.question}` : q.question,
        optionLabels
      );
      answers[q.question] = humanAnswer;
      onDecisionLogged?.({ question: q.question, decidedBy: "human", answer: humanAnswer });
    }

    return { answers };
  };
}

// ---------------------------------------------------------------------------
// The driver: only adapter implemented today. See README.md for the Cline gap.
// ---------------------------------------------------------------------------

export class ClaudeSdkRitualDriver implements RitualSessionDriver {
  constructor(private readonly cwd: string) {}

  async run(
    ritualPrompt: string,
    onQuestion: (q: PendingQuestion) => Promise<QuestionAnswer>
  ): Promise<{ sessionId: string | undefined; finalText: string }> {
    let sessionId: string | undefined;
    let finalText = "";

    for await (const message of query({
      prompt: ritualPrompt,
      options: {
        cwd: this.cwd,
        permissionMode: "acceptEdits", // matches how the 3.4n batch was originally invoked; tighten per-ritual if a ritual should never touch app source
        canUseTool: async (toolName, input) => {
          if (toolName === "AskUserQuestion") {
            const answer = await onQuestion({
              toolName,
              questions: (input as any).questions,
              rawInput: input as Record<string, unknown>,
            });
            return {
              behavior: "allow",
              updatedInput: { questions: (input as any).questions, answers: answer.answers ?? {} },
            };
          }
          const answer = await onQuestion({ toolName, rawInput: input as Record<string, unknown> });
          return answer.approve
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: answer.denyMessage ?? "Denied by orchestrator policy" };
        },
      },
    })) {
      if (message.type === "result") {
        sessionId = message.session_id;
        if (message.subtype === "success") finalText = message.result;
      }
    }

    return { sessionId, finalText };
  }
}

// ---------------------------------------------------------------------------
// Example: running the 3.6g-3.7d batch with this template instead of by hand.
// (Illustrative only — story-dependency ordering, verification-after-each-story,
// and stopping on an unresolved escalation are the caller's responsibility, same
// as they were when this batch was run manually.)
// ---------------------------------------------------------------------------

async function exampleBatchRun() {
  const driver = new ClaudeSdkRitualDriver(process.cwd());
  const storyIds = ["3.6g", "3.6h", "3.6i", "3.6j", "3.6k", "3.7c", "3.7d"];

  for (const storyId of storyIds) {
    const onQuestion = makeQuestionHandler(
      "auto-with-escalation",
      `Batch: creating BMad stories ${storyIds.join(", ")}. Current story: ${storyId}.`,
      new TerminalHumanChannel(),
      new Anthropic(),
      (log) => console.log(`[${storyId}] decided by ${log.decidedBy}: ${log.question} -> ${log.answer}`)
    );

    const { finalText } = await driver.run(`/bmad-create-story ${storyId}`, onQuestion);
    console.log(`[${storyId}] done:\n${finalText}\n`);

    // Same verification the manual batch used: confirm the story file exists and
    // sprint-status.yaml moved off backlog before continuing — left to the caller
    // to implement against this monorepo's real paths, not hardcoded here.
  }
}
