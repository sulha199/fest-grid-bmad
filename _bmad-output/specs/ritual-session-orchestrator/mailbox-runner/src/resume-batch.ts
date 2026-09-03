/**
 * Batch-level resume -- for when an entire multi-story batch gets paused or
 * interrupted (not a single child process dying mid-flight; see
 * run-ritual.ts's --resume/--resume-label for that narrower, Claude-only
 * case -- confirmed by reading @cline/sdk's actual types that Cline has no
 * equivalent session-resume-by-ID capability at all).
 *
 * Loads a state file saved by resolve-targets.ts's --save-state, then
 * re-checks each story's REAL current sprint-status.yaml status rather than
 * trusting anything cached. This project's own batches have repeatedly
 * drifted from parallel activity between checks (3.4n/3.6g/3.6h all
 * advanced further than expected from outside whatever session was
 * watching) -- ground truth is always sprint-status.yaml, never a
 * locally-remembered "done" flag from when the batch started.
 *
 * Read-only: never writes to epics.md or sprint-status.yaml.
 *
 * Usage:
 *   tsx src/resolve-targets.ts --stories 3.6h,3.6i,3.6j,3.6k,3.7c,3.7d \
 *       --epics-file <path> --implementation-artifacts <path> --save-state .batch-state.json
 *   ... (batch runs, gets paused) ...
 *   tsx src/resume-batch.ts --state .batch-state.json
 *
 * Prints (stdout) just the dotted keys still `backlog`, in the original
 * saved order -- the actual resume point, ready to feed straight into the
 * dispatch loop, or back into resolve-targets.ts's --stories if you also
 * want to merge in anything detect-new-stories.ts found in the meantime.
 * Reports (stderr) the full picture: what's already done (by this batch
 * or by something else entirely) and what's still pending, so resuming
 * never silently skips a story without saying so.
 */

import { readFile } from "node:fs/promises";
import { loadSprintStatus, findStatusEntry } from "./bmad-artifacts.js";

interface BatchState {
  createdAt: string;
  mode: string;
  modeValue: string | string[];
  epicsFile: string;
  implementationArtifacts: string;
  order: string[];
}

interface Args {
  state: string;
  implementationArtifacts?: string; // override; defaults to the path saved in state
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const state = get("--state");
  const implementationArtifacts = get("--implementation-artifacts");
  if (!state) {
    throw new Error("Required: --state <path-saved-by-resolve-targets---save-state> [--implementation-artifacts <dir>, overrides the path saved in state]");
  }
  return { state, implementationArtifacts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchState = JSON.parse(await readFile(args.state, "utf-8")) as BatchState;
  const implementationArtifacts = args.implementationArtifacts ?? batchState.implementationArtifacts;

  const { devStatus } = await loadSprintStatus(implementationArtifacts);

  console.error(
    `[resume-batch] Batch saved ${batchState.createdAt} (mode=${batchState.mode}), ${batchState.order.length} stories originally targeted.`
  );

  const stillPending: string[] = [];
  for (const key of batchState.order) {
    const entry = findStatusEntry(devStatus, key);
    if (!entry || entry.status === "backlog") {
      stillPending.push(key);
      console.error(`[resume-batch]   ${key}: still backlog -- PENDING`);
    } else {
      console.error(`[resume-batch]   ${key}: ${entry.status} -- already done (by this batch or otherwise)`);
    }
  }

  if (stillPending.length === 0) {
    console.error("[resume-batch] Every story in this batch has moved past backlog -- nothing left to resume.");
    return;
  }

  console.error(`[resume-batch] ${stillPending.length} of ${batchState.order.length} still pending -- printing to stdout, original order preserved.`);
  for (const key of stillPending) console.log(key);
}

main().catch((err) => {
  console.error(`[resume-batch] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
