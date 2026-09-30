/**
 * Chains one act-mode ritual (originally both bmad-dev-story and
 * bmad-quick-dev, now bmad-dev-story only -- see below) with a post-run
 * verification: dispatch the skill, then run a caller-selected subset of
 * lint/build/test in sequence (fail-fast, cheapest first) via run-check.ts.
 * If a selected check fails, automatically dispatch bmad-quick-dev with that
 * check's failure summary to fix it. Supersedes run-act-with-tests.ts, which
 * only verified test.
 *
 * Cost/time-efficiency note (2026-09-30): originally ran all three checks
 * for both bmad-dev-story and bmad-quick-dev. Per-item lint+build on every
 * dispatch was the dominant per-story cost in a multi-story batch for
 * marginal extra safety over a single end-of-batch pass, so the
 * ritual-orchestrator skill now calls this with `--checks test` for
 * bmad-dev-story and bypasses this script entirely for bmad-quick-dev
 * (dispatched via dispatch-ritual.ts directly, no per-item check). The
 * deferred lint/build/test coverage runs once at the end of the batch
 * instead -- see that skill's Step 4.5.
 *
 * Usage:
 *   tsx src/run-act-with-checks.ts --skill bmad-dev-story --story 3.6h \
 *       --mailbox ../mailbox --cwd C:/projects/portfolio/festgrid/bmad \
 *       [--config <preset-name-or-path>] [--checks lint,build,test] \
 *       [--lint-command "pnpm lint"] [--build-command "pnpm build"] [--test-command "pnpm test"] \
 *       [--check-timeout-ms 1200000] [--skip-quick-dev-on-failure]
 *
 * --checks selects the subset (and order) of lint/build/test to run this
 * invocation -- default is all three. The ritual-orchestrator skill's batch
 * procedure calls this with `--checks test` for bmad-dev-story (lint/build
 * are deferred to a single end-of-batch pass instead of repeating them per
 * story) and skips this script entirely for bmad-quick-dev (dispatches via
 * dispatch-ritual.ts directly, no per-item check at all -- also deferred to
 * the batch-end pass). See that skill's Step 4.5 for the deferred pass.
 *
 * Flow:
 *   1. dispatch-ritual.ts --skill <skill> --story <story> ... (any
 *      AskUserQuestion still relays through the mailbox exactly as normal).
 *   2. On success, run-check.ts for each kind in --checks, in order,
 *      stopping at the first failure (default order is lint, build, test --
 *      cheapest first; test already implies a build via turbo's own
 *      dependsOn graph, but running build explicitly first attributes a
 *      compile error to "build" instead of burying it inside a "test"
 *      failure).
 *   3. If any check fails (and --skip-quick-dev-on-failure isn't set),
 *      dispatch-ritual.ts --skill bmad-quick-dev with a prompt built from
 *      that check's failure summary, asking it to fix it. Does NOT loop --
 *      it dispatches quick-dev once and reports; it does not re-run the
 *      checks again afterward or retry indefinitely. Re-running this whole
 *      script is how you'd verify the fix, same as re-running any other
 *      story step.
 *
 * Exits 0 only if the act ritual succeeded AND lint+build+test all passed
 * (or quick-dev was dispatched and this script's job -- getting a fix
 * attempt started -- is done; it does not wait for quick-dev's own fix to
 * be verified).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { summarizeTestOutput, formatSummary } from "./test-output-summary.js";
import { summarizeBuildOrLintOutput, formatBuildLintSummary } from "./build-lint-output-summary.js";
import { loadDotEnv } from "./load-env.js";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const TSX_CLI_PATH = path.join(SRC_DIR, "..", "node_modules", "tsx", "dist", "cli.mjs");

type CheckKind = "lint" | "build" | "test";
const CHECK_ORDER: CheckKind[] = ["lint", "build", "test"];

interface Args {
  skill: string;
  story: string;
  mailbox: string;
  cwd: string;
  config?: string;
  checks: CheckKind[];
  commands: Record<CheckKind, string>;
  checkTimeoutMs: number;
  skipQuickDevOnFailure: boolean;
}

function parseChecks(raw: string | undefined): CheckKind[] {
  if (!raw) return CHECK_ORDER;
  const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const kind of requested) {
    if (!CHECK_ORDER.includes(kind as CheckKind)) {
      throw new Error(`--checks: unknown kind "${kind}" (expected a comma-separated subset of ${CHECK_ORDER.join(",")})`);
    }
  }
  // Preserve the canonical cheapest-first order regardless of input order.
  return CHECK_ORDER.filter((kind) => requested.includes(kind));
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const skill = get("--skill");
  const story = get("--story");
  const mailbox = get("--mailbox");
  const cwd = get("--cwd");
  if (!skill || !story || !mailbox || !cwd) {
    throw new Error(
      "Required: --skill <name> --story <id> --mailbox <dir> --cwd <repo-root> " +
        '[--config <preset>] [--checks lint,build,test] [--lint-command "pnpm lint"] [--build-command "pnpm build"] [--test-command "pnpm test"] ' +
        "[--check-timeout-ms N] [--skip-quick-dev-on-failure]",
    );
  }
  const checks = parseChecks(get("--checks"));
  if (checks.length === 0) {
    throw new Error("--checks resolved to an empty set -- pass at least one of lint,build,test, or omit the flag entirely.");
  }
  return {
    skill,
    story,
    mailbox,
    cwd,
    config: get("--config"),
    checks,
    commands: {
      lint: get("--lint-command") ?? "pnpm lint",
      build: get("--build-command") ?? "pnpm build",
      test: get("--test-command") ?? "pnpm test",
    },
    checkTimeoutMs: Number(get("--check-timeout-ms") ?? 20 * 60 * 1000),
    skipQuickDevOnFailure: argv.includes("--skip-quick-dev-on-failure"),
  };
}

/** Runs a src/*.ts script via this same node executable's tsx, inheriting
 *  stdio (so AskUserQuestion relays and progress logging all pass through
 *  live) -- same no-shell approach dispatch-ritual.ts uses, for the same
 *  reason (a shell re-tokenizes multi-word quoted args). */
function runScript(scriptName: string, args: string[]): Promise<number> {
  const scriptPath = path.join(SRC_DIR, scriptName);
  const child = spawn(process.execPath, [TSX_CLI_PATH, scriptPath, ...args], { stdio: "inherit" });
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      console.error(`[run-act-with-checks] failed to spawn ${scriptName}:`, err);
      resolve(1);
    });
  });
}

function formatFailureSummary(kind: CheckKind, rawOutput: string): string {
  if (kind === "test") {
    return formatSummary(summarizeTestOutput(rawOutput));
  }
  return formatBuildLintSummary(kind, summarizeBuildOrLintOutput(rawOutput));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotEnv(args.cwd);
  const configFlags = args.config ? ["--config", args.config] : [];

  console.log(`[run-act-with-checks] step 1/2: dispatching --skill ${args.skill} --story ${args.story}`);
  const dispatchExit = await runScript("dispatch-ritual.ts", [
    "--skill", args.skill,
    "--story", args.story,
    "--mailbox", args.mailbox,
    "--cwd", args.cwd,
    ...configFlags,
  ]);

  if (dispatchExit !== 0) {
    console.error(`[run-act-with-checks] ${args.skill} on ${args.story} did not complete successfully (exit ${dispatchExit}) -- stopping before running checks.`);
    process.exitCode = dispatchExit;
    return;
  }

  console.log(`\n[run-act-with-checks] step 2/2: running checks in order (${args.checks.join(" -> ")})`);

  for (const kind of args.checks) {
    console.log(`\n[run-act-with-checks] running ${kind} ("${args.commands[kind]}")`);
    const logFile = path.join(args.mailbox, `${kind}-run-${args.story}-${Date.now()}.log`);
    const checkExit = await runScript("run-check.ts", [
      "--kind", kind,
      "--cwd", args.cwd,
      "--command", args.commands[kind],
      "--timeout-ms", String(args.checkTimeoutMs),
      "--log-file", logFile,
    ]);

    if (checkExit === 0) {
      console.log(`[run-act-with-checks] ${kind} passed.`);
      continue;
    }

    console.error(`\n[run-act-with-checks] ${kind} failed after ${args.skill} on ${args.story}.`);

    if (args.skipQuickDevOnFailure) {
      console.error(`[run-act-with-checks] --skip-quick-dev-on-failure set -- not dispatching bmad-quick-dev. Full log: ${logFile}`);
      process.exitCode = 1;
      return;
    }

    const rawOutput = await readFile(logFile, "utf-8").catch(() => "");
    const summaryText = formatFailureSummary(kind, rawOutput);

    console.log(`\n[run-act-with-checks] dispatching bmad-quick-dev with the ${kind} failure summary`);

    const quickDevPrompt =
      `Story ${args.story}'s implementation (via ${args.skill}) just completed, but running "${args.commands[kind]}" afterward found failures. ` +
      `Fix them:\n\n${summaryText}\n\nFull raw output: ${logFile}`;

    const quickDevExit = await runScript("dispatch-ritual.ts", [
      "--skill", "bmad-quick-dev",
      "--label", `${args.story}/bmad-quick-dev(${kind}-fix)`,
      "--prompt", quickDevPrompt,
      "--mailbox", args.mailbox,
      "--cwd", args.cwd,
      ...configFlags,
    ]);

    console.log(
      `\n[run-act-with-checks] bmad-quick-dev dispatched (exit ${quickDevExit}) -- this script does not re-run checks after the fix; re-run this script (or run-check.ts directly) to verify. ` +
        `Stopping here (fail-fast) -- ${args.checks.slice(args.checks.indexOf(kind) + 1).join(", ") || "no further checks"} not yet run.`,
    );
    process.exitCode = quickDevExit;
    return;
  }

  console.log(`\n[run-act-with-checks] ${args.checks.join(", ")} all passed -- done. (${args.skill} on ${args.story})`);
  process.exitCode = 0;
}

main().catch((err) => {
  console.error(`[run-act-with-checks] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
