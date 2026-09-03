/**
 * Detects story keys that appeared in sprint-status.yaml since the last
 * check -- for growing a batch mid-run when a ritual (most commonly
 * bmad-create-story's own Gate 1/2/3 sweep, per this exact conversation's
 * 3.4n run spawning 3.4o and 4.7c) surfaces a new prerequisite or sibling
 * story that didn't exist when the batch started.
 *
 * Deliberately does NOT implement its own ordering logic -- see README's
 * "Handling newly-surfaced stories mid-batch" section. A newly detected key
 * just needs to be added to resolve-targets.ts's --stories input; its
 * existing topo-sort (dependency graph from epics.md's own "Depends on:"
 * lines) already places a genuine prerequisite before whatever in the
 * remaining batch depends on it, and leaves a standalone new story wherever
 * it lands. Duplicating that logic here would be two places to keep in sync
 * for the same computation.
 *
 * Usage:
 *   tsx src/detect-new-stories.ts --implementation-artifacts <dir> --snapshot <path>
 *   tsx src/detect-new-stories.ts --implementation-artifacts <dir> --snapshot <path> \
 *       --epics-file <path> --remaining 3.6i,3.6j,3.6k,3.7c,3.7d
 *
 * First run (snapshot file doesn't exist): creates it with every current
 * story key as the baseline. Nothing is "new" relative to a baseline just
 * captured, so nothing is printed.
 *
 * Later runs: diffs current sprint-status.yaml keys against the snapshot,
 * prints every story key that appeared since (one dotted key per line, for
 * piping straight into resolve-targets.ts's --stories), and updates the
 * snapshot so the same key isn't re-reported next time.
 *
 * With --epics-file and --remaining, also reports (stderr, so stdout stays a
 * clean pipeable list) whether each new key is a PREREQUISITE for something
 * still pending in the batch (must be inserted before that dependent -- the
 * merge-and-re-sort step below handles this automatically once it's in the
 * target set) or STANDALONE (nothing currently remaining depends on it --
 * safe to append, or to hold for a separate future batch instead).
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadSprintStatus, loadEpicsSections, dashKeyToDotted } from "./bmad-artifacts.js";

interface Args {
  implementationArtifacts: string;
  epicsFile?: string;
  snapshot: string;
  remaining?: string[];
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const implementationArtifacts = get("--implementation-artifacts");
  const snapshot = get("--snapshot");
  const epicsFile = get("--epics-file");
  const remaining = get("--remaining")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!implementationArtifacts || !snapshot) {
    throw new Error("Required: --implementation-artifacts <dir> --snapshot <path> [--epics-file <path> --remaining <a,b,c>]");
  }
  return { implementationArtifacts, epicsFile, snapshot, remaining };
}

const STORY_KEY_RE = /^\d+-\d+[a-z]?-/;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { devStatus } = await loadSprintStatus(args.implementationArtifacts);
  const currentKeys = new Set(Object.keys(devStatus).filter((k) => STORY_KEY_RE.test(k)));

  const isFirstRun = !existsSync(args.snapshot);
  const previousKeys: Set<string> = isFirstRun ? new Set() : new Set(JSON.parse(await readFile(args.snapshot, "utf-8")) as string[]);

  const newKeys = [...currentKeys].filter((k) => !previousKeys.has(k));

  // Snapshot always reflects everything seen as of this run, so a key is
  // only ever reported "new" once across successive calls.
  await writeFile(args.snapshot, JSON.stringify([...currentKeys], null, 2), "utf-8");

  if (isFirstRun) {
    console.error(`[detect-new-stories] Baseline snapshot created at ${args.snapshot} (${currentKeys.size} story keys). Nothing to report this run.`);
    return;
  }

  if (newKeys.length === 0) {
    console.error("[detect-new-stories] No new stories since the last check.");
    return;
  }

  const dottedNew = newKeys.map(dashKeyToDotted);

  if (args.remaining?.length && args.epicsFile) {
    const sections = await loadEpicsSections(args.epicsFile);
    for (const dotted of dottedNew) {
      const dependents = args.remaining.filter((r) => sections.get(r)?.dependsOn.includes(dotted));
      console.error(
        dependents.length > 0
          ? `[detect-new-stories] ${dotted}: PREREQUISITE for ${dependents.join(", ")} -- add to the target set and re-run resolve-targets.ts; it will sort before them.`
          : `[detect-new-stories] ${dotted}: STANDALONE -- nothing currently remaining depends on it in this batch.`
      );
    }
  } else {
    console.error(`[detect-new-stories] ${dottedNew.length} new stor${dottedNew.length === 1 ? "y" : "ies"} found (pass --epics-file/--remaining for prerequisite-vs-standalone categorization).`);
  }

  for (const dotted of dottedNew) console.log(dotted);
}

main().catch((err) => {
  console.error(`[detect-new-stories] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
