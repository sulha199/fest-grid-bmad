/**
 * Tails a detached child's log and prints only the lines worth waking for. Built to be the
 * command of a `Monitor` call: it can expire and be re-armed freely because it holds no part
 * of the child's lifetime, and it remembers how far it has read so a re-armed watch resumes
 * instead of replaying (or losing) events.
 *
 *   tsx src/watch-log.ts --mailbox ../mailbox --label "3.6u/bmad-dev-story" \
 *       [--from-start] [--filter <regex>] [--poll-ms 1000]
 *
 * Exits when the child's "[exit code N]" line arrives (printed even if the filter would hide it),
 * or when the child's process is gone without writing one (killed, container restarted). Delivery
 * is at-least-once: lines are printed before the offset is saved, so a watcher killed between the
 * two repeats a line rather than dropping it.
 */

import { open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { DEFAULT_SIGNAL, EXIT_MARKER, isAlive, logPaths, splitComplete } from "./detached.js";

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };
  const mailbox = get("--mailbox");
  const label = get("--label");
  if (!mailbox || !label) throw new Error("Usage: watch-log.ts --mailbox <dir> --label <label> [--from-start] [--filter <regex>] [--poll-ms N]");
  const filter = get("--filter");
  return {
    mailbox,
    label,
    fromStart: argv.includes("--from-start"),
    filter: filter ? new RegExp(filter) : DEFAULT_SIGNAL,
    pollMs: Number.parseInt(get("--poll-ms") ?? "1000", 10),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readOffset(file: string): Promise<number> {
  const n = await readFile(file, "utf-8").then(
    (raw) => Number.parseInt(raw, 10),
    () => 0,
  );
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function main() {
  const { mailbox, label, fromStart, filter, pollMs } = parseArgs(process.argv.slice(2));
  const paths = logPaths(mailbox, label);

  if (fromStart) await rm(paths.offset, { force: true });
  let offset = await readOffset(paths.offset);
  let carry = "";

  for (;;) {
    const size = await stat(paths.log).then(
      (s) => s.size,
      () => -1,
    );
    if (size < 0) {
      console.log(`[watch-log] no log yet at ${paths.log}; was the child launched with launch-detached.ts?`);
      process.exitCode = 3;
      return;
    }
    if (size < offset) offset = 0; // log was recreated by a fresh launch

    if (size > offset) {
      const handle = await open(paths.log, "r");
      try {
        const buf = Buffer.alloc(size - offset);
        const { bytesRead } = await handle.read(buf, 0, buf.length, offset);
        offset += bytesRead;
        const { lines, rest } = splitComplete(carry + buf.subarray(0, bytesRead).toString("utf-8"));
        carry = rest;
        for (const line of lines) {
          const exit = EXIT_MARKER.exec(line);
          if (exit || filter.test(line)) console.log(line);
          if (exit) {
            await writeFile(paths.offset, String(offset), "utf-8");
            return;
          }
        }
      } finally {
        await handle.close();
      }
      // The carried tail is already counted in `offset`; persist only what was fully consumed.
      await writeFile(paths.offset, String(offset - Buffer.byteLength(carry, "utf-8")), "utf-8");
      continue; // more may have arrived while reading
    }

    const pid = await readFile(paths.pid, "utf-8").then(
      (raw) => Number.parseInt(raw, 10),
      () => NaN,
    );
    if (Number.isFinite(pid) && !isAlive(pid)) {
      // One last look: the exit line may have landed between our read and the liveness probe.
      const after = await stat(paths.log).then((s) => s.size, () => size);
      if (after === size) {
        console.log(`[watch-log] child pid ${pid} is gone and wrote no exit code; it was killed or the container restarted.`);
        process.exitCode = 4;
        return;
      }
      continue;
    }
    await sleep(pollMs);
  }
}

main().catch((err) => {
  console.error(`[watch-log] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
