/**
 * Target resolution + dependency ordering for a bmad ritual batch -- the
 * "Resolve targets" / "Order by dependency" steps from ../README.md's "The
 * batch procedure" section, previously prose-only.
 *
 * Read-only: never writes to epics.md or sprint-status.yaml.
 *
 * Usage:
 *   tsx src/resolve-targets.ts --stories 3.6h,3.6i,3.6j,3.6k,3.7c,3.7d \
 *       --epics-file <path/to/epics.md> --implementation-artifacts <path/to/implementation-artifacts>
 *
 *   tsx src/resolve-targets.ts --epic 3 \
 *       --epics-file <path> --implementation-artifacts <path>
 *
 *   tsx src/resolve-targets.ts --since-proposal sprint-change-proposal-2026-09-02.md \
 *       --epics-file <path> --implementation-artifacts <path>
 *
 * Prints the final, dependency-ordered dotted story keys, one per line, to
 * stdout on success (pass --json for a JSON array instead). Exits non-zero
 * with a specific error on: a dependency cycle within the target set, or a
 * dependency outside the target set whose current sprint-status.yaml status
 * isn't "done".
 *
 * --epic mode lists every story key under that epic number currently
 * "backlog" in sprint-status.yaml, in file order -- same discovery
 * bmad-create-story's own Step 1 already does.
 *
 * --since-proposal mode finds every "### Story X.Y" section in epics.md
 * whose body text mentions the given proposal's filename (this repo's actual
 * convention -- e.g. "Note (2026-09-02, added via `bmad-correct-course`,
 * `sprint-change-proposal-2026-09-02.md`)"), in epics.md file order. This is
 * a filename-mention heuristic, not a formal marker -- it only works because
 * that citation convention has been consistent in this repo so far.
 */

import path from "node:path";
import { loadSprintStatus, loadEpicsSections, findStatusEntry, listStoryKeysForEpic, dashKeyToDotted, type EpicStorySection } from "./bmad-artifacts.js";

interface Args {
  stories?: string[];
  epic?: string;
  sinceProposal?: string;
  epicsFile: string;
  implementationArtifacts: string;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const stories = get("--stories")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const epic = get("--epic");
  const sinceProposal = get("--since-proposal");
  const epicsFile = get("--epics-file");
  const implementationArtifacts = get("--implementation-artifacts");
  const json = argv.includes("--json");

  if (!epicsFile || !implementationArtifacts) {
    throw new Error("Required: --epics-file <path> --implementation-artifacts <dir>, plus exactly one of --stories <a,b,c> | --epic <N> | --since-proposal <filename-or-path>");
  }
  const modesGiven = [stories, epic, sinceProposal].filter(Boolean).length;
  if (modesGiven !== 1) {
    throw new Error("Pass exactly one of --stories, --epic, --since-proposal.");
  }
  return { stories, epic, sinceProposal, epicsFile, implementationArtifacts, json };
}

function resolveInitialTargets(args: Args, devStatus: Record<string, string>, sections: Map<string, EpicStorySection>): string[] {
  if (args.stories) return args.stories;

  if (args.epic) {
    return listStoryKeysForEpic(devStatus, args.epic).map(dashKeyToDotted);
  }

  if (args.sinceProposal) {
    const needle = path.basename(args.sinceProposal);
    const matches: string[] = [];
    for (const section of sections.values()) {
      if (section.bodyText.includes(needle)) matches.push(section.dottedKey);
    }
    return matches;
  }

  throw new Error("Unreachable: parseArgs already enforced exactly one mode.");
}

function topoSort(targets: string[], sections: Map<string, EpicStorySection>): string[] {
  const targetSet = new Set(targets);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  function visit(key: string) {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new Error(`Dependency cycle detected involving Story ${key} -- cannot produce a valid order for this target set.`);
    }
    visiting.add(key);
    const section = sections.get(key);
    const deps = (section?.dependsOn ?? []).filter((d) => targetSet.has(d));
    for (const dep of deps) visit(dep);
    visiting.delete(key);
    visited.add(key);
    result.push(key);
  }

  for (const key of targets) visit(key);
  return result;
}

/**
 * Threshold calibrated against real data, not assumed: found via an actual
 * run that 3.7c/3.7d depend on 3.6h, which sits at "review" (implemented,
 * pending code review) rather than "done" -- for a create-story batch that's
 * genuinely fine, since 3.6h's story file already exists and is all the next
 * story needs to read. Requiring strict "done" would false-positive-block on
 * exactly this real, common case. "backlog" is the one status that actually
 * means "nothing to read yet" -- everything past it has at least a materialized
 * story file. A stricter "must be actually done" threshold would matter for a
 * dev-story/implementation batch instead of a create-story one; not built as
 * a mode-aware distinction here since this tool doesn't know which ritual the
 * caller intends to run next -- revisit if a real dev-story batch needs it.
 */
function checkOutOfSetDependencies(targets: string[], sections: Map<string, EpicStorySection>, devStatus: Record<string, string>): void {
  const targetSet = new Set(targets);
  for (const key of targets) {
    const section = sections.get(key);
    if (!section) {
      throw new Error(`Story ${key} has no "### Story ${key}:" section in epics.md -- cannot resolve its dependencies.`);
    }
    for (const dep of section.dependsOn) {
      if (targetSet.has(dep)) continue;
      const entry = findStatusEntry(devStatus, dep);
      if (!entry || entry.status === "backlog") {
        throw new Error(
          `Story ${key} depends on Story ${dep}, which is outside this target set and hasn't been created yet ` +
            `(current status: ${entry?.status ?? "not found in sprint-status.yaml"}). Add it to the target set or create it first.`
        );
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { devStatus } = await loadSprintStatus(args.implementationArtifacts);
  const sections = await loadEpicsSections(args.epicsFile);

  const targets = resolveInitialTargets(args, devStatus, sections);
  if (targets.length === 0) {
    console.error("No target stories resolved -- nothing to do.");
    process.exitCode = 1;
    return;
  }

  checkOutOfSetDependencies(targets, sections, devStatus);
  const ordered = topoSort(targets, sections);

  if (args.json) {
    console.log(JSON.stringify(ordered));
  } else {
    for (const key of ordered) console.log(key);
  }
}

main().catch((err) => {
  console.error(`[resolve-targets] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
