/**
 * Invokes and monitors one of this repo's real turbo checks -- test, build,
 * or lint -- picking the summarizer that matches the requested kind.
 * Same invoke/monitor approach as run-tests.ts (spawn, heartbeat every 30s
 * so a long silent stretch doesn't read as hung, enforce a timeout), applied
 * generically across all three check kinds rather than duplicated per kind.
 *
 * Usage:
 *   tsx src/run-check.ts --kind test|build|lint --cwd C:/projects/portfolio/festgrid/bmad \
 *       [--command "pnpm build"] [--timeout-ms 1200000] [--heartbeat-ms 30000] \
 *       [--log-file <path to save the full raw output>]
 *
 * If --command is omitted, defaults to "pnpm <kind>". Prints the summary to
 * stdout and exits 0 if the check passed, 1 if it failed or timed out. The
 * full raw output is always available via --log-file if the summary needs
 * cross-checking against the real log.
 */

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { summarizeTestOutput, formatSummary } from "./test-output-summary.js";
import { summarizeBuildOrLintOutput, formatBuildLintSummary } from "./build-lint-output-summary.js";

type CheckKind = "test" | "build" | "lint";

interface Args {
  kind: CheckKind;
  cwd: string;
  command: string;
  timeoutMs: number;
  heartbeatMs: number;
  logFile?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const cwd = get("--cwd");
  const kind = get("--kind");
  if (!cwd || (kind !== "test" && kind !== "build" && kind !== "lint")) {
    throw new Error(`Required: --kind test|build|lint --cwd <repo-root> [--command "pnpm <kind>"] [--timeout-ms N] [--heartbeat-ms N] [--log-file <path>]`);
  }
  return {
    kind,
    cwd,
    command: get("--command") ?? `pnpm ${kind}`,
    timeoutMs: Number(get("--timeout-ms") ?? 20 * 60 * 1000), // 20 min default -- a full monorepo run is a genuinely long task
    heartbeatMs: Number(get("--heartbeat-ms") ?? 30 * 1000),
    logFile: get("--log-file"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`[run-check:${args.kind}] running "${args.command}" in ${args.cwd} (timeout ${Math.round(args.timeoutMs / 1000)}s)`);

  let output = "";
  const startedAt = Date.now();

  const child = spawn(args.command, {
    cwd: args.cwd,
    shell: true, // pnpm is a .cmd shim on Windows; the command itself is fixed/simple, not a caller-supplied multi-word argument, so this doesn't hit the argv-re-tokenization bug found in dispatch-ritual.ts
  });

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const heartbeat = setInterval(() => {
    const elapsedS = Math.round((Date.now() - startedAt) / 1000);
    const lastLine = output.trim().split(/\r?\n/).pop() ?? "";
    console.log(`[run-check:${args.kind}] still running (${elapsedS}s elapsed) -- last output: ${lastLine.slice(0, 160)}`);
  }, args.heartbeatMs);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    console.error(`[run-check:${args.kind}] exceeded ${args.timeoutMs}ms -- killing`);
    child.kill("SIGKILL");
  }, args.timeoutMs);

  const exitCode = await new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      console.error(`[run-check:${args.kind}] failed to spawn: ${err.message}`);
      resolve(1);
    });
  });

  clearInterval(heartbeat);
  clearTimeout(timeout);

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[run-check:${args.kind}] finished in ${elapsedS}s, exit code ${exitCode}${timedOut ? " (TIMED OUT, process killed)" : ""}`);

  if (args.logFile) {
    await writeFile(args.logFile, output, "utf-8");
    console.log(`[run-check:${args.kind}] full raw output saved to ${args.logFile}`);
  }

  if (timedOut) {
    console.log("\nTIMED OUT before completing -- no summary available; check the raw log.");
    process.exitCode = 1;
    return;
  }

  if (args.kind === "test") {
    const summary = summarizeTestOutput(output);
    console.log(`\n${formatSummary(summary)}`);
    process.exitCode = summary.overallPass === false || (summary.overallPass === undefined && exitCode !== 0) ? 1 : 0;
  } else {
    const summary = summarizeBuildOrLintOutput(output);
    console.log(`\n${formatBuildLintSummary(args.kind, summary)}`);
    process.exitCode = summary.overallPass === false || (summary.overallPass === undefined && exitCode !== 0) ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(`[run-check] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
