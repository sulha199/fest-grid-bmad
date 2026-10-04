/**
 * Starts a child command detached from the caller, logging to a file, and returns at once.
 *
 *   tsx src/launch-detached.ts --mailbox ../mailbox --label "3.6u/bmad-dev-story" \
 *       [--cwd /repo] -- npx tsx src/dispatch-ritual.ts --skill bmad-dev-story --story 3.6u ...
 *
 * Everything after `--` is the command, run verbatim (no shell parsing, so prompts with quotes
 * and newlines pass through untouched). The child gets its own session (detached) so neither the
 * caller's exit nor a Monitor expiring takes it down. Its combined output goes to
 * <mailbox>/logs/<label>.log, ending with an "[exit code N]" line.
 *
 * Refuses to start a second child under a label whose first is still alive, so a re-issued
 * launch cannot double-dispatch a story. Watch it with watch-log.ts.
 */

import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAlive, logPaths } from "./detached.js";

function parseArgs(argv: string[]): { mailbox: string; label: string; cwd: string; command: string[] } {
  const sep = argv.indexOf("--");
  if (sep === -1 || sep === argv.length - 1) {
    throw new Error("Usage: launch-detached.ts --mailbox <dir> --label <label> [--cwd <dir>] -- <command> [args...]");
  }
  const flags = argv.slice(0, sep);
  const command = argv.slice(sep + 1);
  const get = (name: string): string | undefined => {
    const i = flags.indexOf(name);
    return i === -1 ? undefined : flags[i + 1];
  };
  const mailbox = get("--mailbox");
  const label = get("--label");
  if (!mailbox || !label) throw new Error("--mailbox and --label are required.");
  return { mailbox: path.resolve(mailbox), label, cwd: path.resolve(get("--cwd") ?? process.cwd()), command };
}

async function main() {
  const { mailbox, label, cwd, command } = parseArgs(process.argv.slice(2));
  const paths = logPaths(mailbox, label);
  await mkdir(paths.dir, { recursive: true });

  const previous = await readFile(paths.pid, "utf-8").then(
    (raw) => Number.parseInt(raw, 10),
    () => NaN,
  );
  if (Number.isFinite(previous) && isAlive(previous)) {
    console.error(`[launch-detached] "${label}" is already running (pid ${previous}); not starting a second one. Watch it with watch-log.ts.`);
    process.exitCode = 2;
    return;
  }

  // A fresh launch starts a fresh log and a fresh watch position.
  await rm(paths.offset, { force: true });
  const out = openSync(paths.log, "w");

  // The wrapper records the child's real exit status in the log, which is what the watcher stops on.
  const wrapper = '"$@"; code=$?; printf "\\n[exit code %s]\\n" "$code"; exit "$code"';
  // `detached` makes node call setsid for us: the shell becomes the leader of a new session, so its pid is
  // the one that stays alive for the whole run (a separate `setsid` binary would fork and exit at once).
  const child = spawn("sh", ["-c", wrapper, "sh", ...command], {
    cwd,
    detached: true,
    stdio: ["ignore", out, out],
  });
  closeSync(out);
  child.unref();

  if (child.pid === undefined) throw new Error("Failed to start the child process.");
  await writeFile(paths.pid, String(child.pid), "utf-8");
  console.log(`[launch-detached] started "${label}" pid=${child.pid}`);
  console.log(`[launch-detached] log: ${paths.log}`);
  console.log(`[launch-detached] watch: tsx src/watch-log.ts --mailbox ${mailbox} --label "${label}"`);
}

main().catch((err) => {
  console.error(`[launch-detached] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
