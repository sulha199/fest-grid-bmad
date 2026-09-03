/**
 * Invokes and monitors the repo's real test suite (`pnpm test` by default --
 * turbo running every package's test task, confirmed a genuinely long task
 * against this repo: apps/backend's node:test suite + every packages/*
 * Vitest suite). Prints a heartbeat while it runs (so a long silent wait
 * doesn't look hung), enforces a timeout, then summarizes the result via
 * test-output-summary.ts.
 *
 * Usage:
 *   tsx src/run-tests.ts --cwd C:/projects/portfolio/festgrid/bmad \
 *       [--command "pnpm test"] [--timeout-ms 1200000] [--heartbeat-ms 30000] \
 *       [--log-file <path to save the full raw output>]
 *
 * Prints the summary to stdout and exits 0 if all tests passed, 1 if any
 * failed or the run timed out. The full raw output is always available via
 * --log-file if the summary needs cross-checking against the real log.
 */

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { summarizeTestOutput, formatSummary } from "./test-output-summary.js";

interface Args {
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
  if (!cwd) {
    throw new Error("Required: --cwd <repo-root> [--command \"pnpm test\"] [--timeout-ms N] [--heartbeat-ms N] [--log-file <path>]");
  }
  return {
    cwd,
    command: get("--command") ?? "pnpm test",
    timeoutMs: Number(get("--timeout-ms") ?? 20 * 60 * 1000), // 20 min default -- a full monorepo run is a genuinely long task
    heartbeatMs: Number(get("--heartbeat-ms") ?? 30 * 1000),
    logFile: get("--log-file"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`[run-tests] running "${args.command}" in ${args.cwd} (timeout ${Math.round(args.timeoutMs / 1000)}s)`);

  let output = "";
  const startedAt = Date.now();

  const child = spawn(args.command, {
    cwd: args.cwd,
    shell: true, // pnpm is a .cmd shim on Windows; the command itself is fixed/simple ("pnpm test"), not a caller-supplied multi-word argument, so this doesn't hit the argv-re-tokenization bug found in dispatch-ritual.ts
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
    console.log(`[run-tests] still running (${elapsedS}s elapsed) -- last output: ${lastLine.slice(0, 160)}`);
  }, args.heartbeatMs);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    console.error(`[run-tests] exceeded ${args.timeoutMs}ms -- killing`);
    child.kill("SIGKILL");
  }, args.timeoutMs);

  const exitCode = await new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      console.error(`[run-tests] failed to spawn: ${err.message}`);
      resolve(1);
    });
  });

  clearInterval(heartbeat);
  clearTimeout(timeout);

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[run-tests] finished in ${elapsedS}s, exit code ${exitCode}${timedOut ? " (TIMED OUT, process killed)" : ""}`);

  if (args.logFile) {
    await writeFile(args.logFile, output, "utf-8");
    console.log(`[run-tests] full raw output saved to ${args.logFile}`);
  }

  if (timedOut) {
    console.log("\nTIMED OUT before completing -- no summary available; check the raw log.");
    process.exitCode = 1;
    return;
  }

  const summary = summarizeTestOutput(output);
  console.log(`\n${formatSummary(summary)}`);

  process.exitCode = summary.overallPass === false || (summary.overallPass === undefined && exitCode !== 0) ? 1 : 0;
}

main().catch((err) => {
  console.error(`[run-tests] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
