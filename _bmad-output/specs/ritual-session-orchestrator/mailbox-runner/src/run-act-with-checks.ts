/**
 * Chains one act-mode ritual (bmad-dev-story or bmad-quick-dev) with a
 * post-run verification: dispatch the skill, then run lint, build, and test
 * in sequence (fail-fast, cheapest first) via run-check.ts. If any of the
 * three fails, automatically dispatch bmad-quick-dev with that check's
 * failure summary to fix it. Supersedes run-act-with-tests.ts, which only
 * verified test -- the user's own bar is "lint, build, test are not
 * catching error by the end of quick-dev or dev-story", so all three are
 * now checked, not just test.
 *
 * Usage:
 *   tsx src/run-act-with-checks.ts --skill bmad-dev-story --story 3.6h \
 *       --mailbox ../mailbox --cwd C:/projects/portfolio/festgrid/bmad \
 *       [--config <preset-name-or-path>] \
 *       [--lint-command "pnpm lint"] [--build-command "pnpm build"] [--test-command "pnpm test"] \
 *       [--check-timeout-ms 1200000] [--skip-quick-dev-on-failure]
 *
 * Flow:
 *   1. dispatch-ritual.ts --skill <skill> --story <story> ... (any
 *      AskUserQuestion still relays through the mailbox exactly as normal).
 *   2. On success, run-check.ts --kind lint, then --kind build, then
 *      --kind test, in that order, stopping at the first failure (cheapest
 *      checks first; test already implies a build via turbo's own
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
  commands: Record<CheckKind, string>;
  checkTimeoutMs: number;
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
    throw new Error(
      "Required: --skill <name> --story <id> --mailbox <dir> --cwd <repo-root> " +
        '[--config <preset>] [--lint-command "pnpm lint"] [--build-command "pnpm build"] [--test-command "pnpm test"] ' +
        "[--check-timeout-ms N] [--skip-quick-dev-on-failure]",
    );
  }
  return {
    skill,
    story,
    mailbox,
    cwd,
    config: get("--config"),
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

  console.log(`\n[run-act-with-checks] step 2/2: running checks in order (${CHECK_ORDER.join(" -> ")})`);

  for (const kind of CHECK_ORDER) {
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
        `Stopping here (fail-fast) -- ${CHECK_ORDER.slice(CHECK_ORDER.indexOf(kind) + 1).join(", ") || "no further checks"} not yet run.`,
    );
    process.exitCode = quickDevExit;
    return;
  }

  console.log(`\n[run-act-with-checks] lint, build, and test all passed -- done. (${args.skill} on ${args.story})`);
  process.exitCode = 0;
}

main().catch((err) => {
  console.error(`[run-act-with-checks] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
