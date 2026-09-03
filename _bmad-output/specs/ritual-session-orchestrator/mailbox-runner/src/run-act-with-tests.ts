/**
 * Chains one act-mode ritual (bmad-dev-story, typically) with a post-run
 * verification: dispatch the skill, run the real test suite, and if it
 * finds failures, automatically dispatch bmad-quick-dev with the failure
 * summary to fix them. Reuses dispatch-ritual.ts and run-tests.ts rather
 * than reimplementing either -- this file is purely the sequencing.
 *
 * Usage:
 *   tsx src/run-act-with-tests.ts --skill bmad-dev-story --story 3.6h \
 *       --mailbox ../mailbox --cwd C:/projects/portfolio/festgrid/bmad \
 *       [--config <preset-name-or-path>] [--test-command "pnpm test"] \
 *       [--test-timeout-ms 1200000] [--skip-quick-dev-on-failure]
 *
 * Flow:
 *   1. dispatch-ritual.ts --skill <skill> --story <story> ... (any
 *      AskUserQuestion still relays through the mailbox exactly as normal --
 *      this script doesn't change that mechanism, just sequences around it).
 *   2. On success, run-tests.ts runs the real suite (long task -- see that
 *      file for the heartbeat/timeout/summary approach, grounded in a real
 *      full run of this repo's actual suite).
 *   3. If tests fail (and --skip-quick-dev-on-failure isn't set),
 *      dispatch-ritual.ts --skill bmad-quick-dev --story <story> with a
 *      prompt built from the failure summary, asking it to fix them. This
 *      does NOT loop -- it dispatches quick-dev once and reports; it does
 *      not re-run tests again afterward or retry indefinitely. Re-running
 *      this whole script is how you'd verify the fix, same as re-running
 *      any other story step.
 *
 * Exits 0 only if the act ritual succeeded AND tests passed (or quick-dev
 * was dispatched and this script's job -- getting a fix attempt started --
 * is done; it does not wait for quick-dev's own fix to be verified).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { summarizeTestOutput, formatSummary } from "./test-output-summary.js";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const TSX_CLI_PATH = path.join(SRC_DIR, "..", "node_modules", "tsx", "dist", "cli.mjs");

interface Args {
  skill: string;
  story: string;
  mailbox: string;
  cwd: string;
  config?: string;
  testCommand: string;
  testTimeoutMs: number;
  skipQuickDevOnFailure: boolean;
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
    throw new Error("Required: --skill <name> --story <id> --mailbox <dir> --cwd <repo-root> [--config <preset>] [--test-command \"pnpm test\"] [--test-timeout-ms N] [--skip-quick-dev-on-failure]");
  }
  return {
    skill,
    story,
    mailbox,
    cwd,
    config: get("--config"),
    testCommand: get("--test-command") ?? "pnpm test",
    testTimeoutMs: Number(get("--test-timeout-ms") ?? 20 * 60 * 1000),
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
      console.error(`[run-act-with-tests] failed to spawn ${scriptName}:`, err);
      resolve(1);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configFlags = args.config ? ["--config", args.config] : [];

  console.log(`[run-act-with-tests] step 1/3: dispatching --skill ${args.skill} --story ${args.story}`);
  const dispatchExit = await runScript("dispatch-ritual.ts", [
    "--skill", args.skill,
    "--story", args.story,
    "--mailbox", args.mailbox,
    "--cwd", args.cwd,
    ...configFlags,
  ]);

  if (dispatchExit !== 0) {
    console.error(`[run-act-with-tests] ${args.skill} on ${args.story} did not complete successfully (exit ${dispatchExit}) -- stopping before running tests.`);
    process.exitCode = dispatchExit;
    return;
  }

  console.log(`\n[run-act-with-tests] step 2/3: running tests ("${args.testCommand}")`);
  const testLogFile = path.join(args.mailbox, `test-run-${args.story}-${Date.now()}.log`);
  const testExit = await runScript("run-tests.ts", [
    "--cwd", args.cwd,
    "--command", args.testCommand,
    "--timeout-ms", String(args.testTimeoutMs),
    "--log-file", testLogFile,
  ]);

  if (testExit === 0) {
    console.log(`\n[run-act-with-tests] tests passed -- done. (${args.skill} on ${args.story})`);
    process.exitCode = 0;
    return;
  }

  console.error(`\n[run-act-with-tests] tests failed after ${args.skill} on ${args.story}.`);

  if (args.skipQuickDevOnFailure) {
    console.error("[run-act-with-tests] --skip-quick-dev-on-failure set -- not dispatching bmad-quick-dev. Full log: " + testLogFile);
    process.exitCode = 1;
    return;
  }

  const rawOutput = await readFile(testLogFile, "utf-8").catch(() => "");
  const summary = summarizeTestOutput(rawOutput);
  const summaryText = formatSummary(summary);

  console.log(`\n[run-act-with-tests] step 3/3: dispatching bmad-quick-dev with the failure summary`);

  const quickDevPrompt =
    `Story ${args.story}'s implementation (via ${args.skill}) just completed, but running "${args.testCommand}" afterward found failures. ` +
    `Fix them:\n\n${summaryText}\n\nFull raw test output: ${testLogFile}`;

  const quickDevExit = await runScript("dispatch-ritual.ts", [
    "--skill", "bmad-quick-dev",
    "--label", `${args.story}/bmad-quick-dev(test-fix)`,
    "--prompt", quickDevPrompt,
    "--mailbox", args.mailbox,
    "--cwd", args.cwd,
    ...configFlags,
  ]);

  console.log(`\n[run-act-with-tests] bmad-quick-dev dispatched (exit ${quickDevExit}) -- this script does not re-run tests after the fix; re-run this script (or run-tests.ts directly) to verify.`);
  process.exitCode = quickDevExit;
}

main().catch((err) => {
  console.error(`[run-act-with-tests] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
