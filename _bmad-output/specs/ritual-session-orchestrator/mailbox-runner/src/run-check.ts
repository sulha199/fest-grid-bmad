/**
 * Invokes and monitors one of this repo's real turbo checks -- test, build,
 * or lint -- picking the summarizer that matches the requested kind.
 * Same invoke/monitor approach as run-tests.ts (spawn, heartbeat every 30s
 * so a long silent stretch doesn't read as hung, enforce a timeout), applied
 * generically across all three check kinds rather than duplicated per kind.
 *
 * Usage:
 *   tsx src/run-check.ts --kind test|build|lint [--cwd C:/projects/portfolio/festgrid/bmad] \
 *       [--command "pnpm build"] [--timeout-ms 1200000] [--heartbeat-ms 30000] \
 *       [--log-file <path to save the full raw output>]
 *
 * --cwd defaults to the repo root (derived from this file's location). If
 * --command is omitted, defaults to "pnpm <kind>". Prints the summary to
 * stdout and exits 0 if the check passed, 1 if it failed or timed out. The
 * full raw output is always available via --log-file if the summary needs
 * cross-checking against the real log.
 */

import { spawn, execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { summarizeTestOutput, formatSummary } from "./test-output-summary.js";
import { summarizeBuildOrLintOutput, formatBuildLintSummary } from "./build-lint-output-summary.js";
import { checkPreflight, formatPreflightFailure } from "./preflight-check.js";

/**
 * Kills the whole process tree rooted at `pid`, not just that one PID.
 *
 * Why this exists: this script spawns with `shell: true` (pnpm is a .cmd
 * shim on Windows), so the PID we hold is cmd.exe's -- pnpm, turbo, and
 * whatever per-package test runner turbo fans out to (vitest, node:test)
 * all run as *its* children, i.e. our grandchildren. On Windows,
 * `child.kill("SIGKILL")` maps to TerminateProcess on that one PID only --
 * there is no POSIX process-group signal semantics to fall back on, so
 * descendants are never touched and keep running after we've already
 * reported a timeout.
 *
 * Verified live (2026-09-13, tree-kill-verify2.mjs): spawning a real
 * grandchild node.exe through a shell and calling `child.kill("SIGKILL")` on
 * the top-level PID left the grandchild alive a full second later (confirmed
 * via `Get-CimInstance Win32_Process`, filtered to the real grandchild by
 * ProcessName+CommandLine, not a self-matching artifact of the query itself).
 * `taskkill /pid <pid> /T /F` against the identical setup killed it cleanly.
 * This is the most likely mechanism behind this session's own "hung check,
 * human had to manually taskkill and re-run via run-check.ts directly"
 * mitigation: the timeout path believed it had killed the check, but a
 * grandchild (plausibly still holding a DB connection or a file handle)
 * kept running underneath it.
 */
function killTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => resolve());
    } else {
      // No shell/process-group was requested at spawn time on this path
      // either, so there's no negative-PID process-group kill available here
      // -- SIGKILL on the direct child is the best available without
      // restructuring the spawn call. Windows is this project's actual
      // environment (see README's Postgres notes), so that's where the fix
      // above matters; this branch is a safe no-worse-than-before fallback.
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already dead
      }
      resolve();
    }
  });
}

// src/ -> mailbox-runner -> ritual-session-orchestrator -> specs -> _bmad-output -> repo root
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

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
  const kind = get("--kind");
  if (kind !== "test" && kind !== "build" && kind !== "lint") {
    throw new Error(`Required: --kind test|build|lint [--cwd <repo-root>] [--command "pnpm <kind>"] [--timeout-ms N] [--heartbeat-ms N] [--log-file <path>]`);
  }
  return {
    kind,
    cwd: get("--cwd") ?? DEFAULT_REPO_ROOT,
    command: get("--command") ?? `pnpm ${kind}`,
    timeoutMs: Number(get("--timeout-ms") ?? 20 * 60 * 1000), // 20 min default -- a full monorepo run is a genuinely long task
    heartbeatMs: Number(get("--heartbeat-ms") ?? 30 * 1000),
    logFile: get("--log-file"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // A "test" run is the one kind that actually talks to the local Postgres
  // service and writes real WAL/checkpoint data (see ../README.md's Resume
  // section: two real crashes of postgresql-x64-18 this session, correlated
  // with the C: drive sitting at 92-95% full) -- lint/build don't touch the
  // DB at all, so there's nothing useful to preflight for them. Failing here
  // is deliberately fast and specific instead of letting a 300+ test
  // ECONNREFUSED cascade (or a mid-suite Postgres crash) be the first signal.
  if (args.kind === "test") {
    const preflight = await checkPreflight(args.cwd);
    if (!preflight.ok) {
      console.error(formatPreflightFailure(preflight));
      process.exitCode = 1;
      return;
    }
    console.log(`[run-check:test] preflight OK -- ${preflight.checks.map((c) => c.detail).join("; ")}`);
  }

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
    console.error(`[run-check:${args.kind}] exceeded ${args.timeoutMs}ms -- killing process tree`);
    // Not child.kill() -- see killTree()'s doc comment: this spawns through a
    // shell, so child.pid is cmd.exe, and a bare SIGKILL on that PID alone
    // leaves pnpm/turbo/the actual test runner (our grandchildren) running.
    void killTree(child.pid!);
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
