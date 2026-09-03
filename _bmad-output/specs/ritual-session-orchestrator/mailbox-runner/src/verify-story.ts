/**
 * Post-ritual verification -- the "Verify before advancing" step from
 * ../README.md's "The batch procedure", previously a manual grep-and-eyeball
 * check repeated by hand after each story in this conversation's earlier
 * batches. Read-only: never writes to any artifact.
 *
 * Usage:
 *   tsx src/verify-story.ts --story 3.6h --implementation-artifacts <path> [--expect-status ready-for-dev]
 *
 * Checks: a story file exists under --implementation-artifacts matching the
 * naming convention, and sprint-status.yaml has an entry for it. Without
 * --expect-status, PASS requires only that its status isn't still "backlog"
 * (moved forward by *something*, per this repeated batches' actual failure
 * mode of stories advancing further than expected without this session
 * driving it -- exact status is reported either way, this script doesn't
 * assume who or what moved it). With --expect-status, PASS requires an exact
 * match.
 *
 * Prints a human-readable report to stdout; exits 0 on PASS, 1 on FAIL.
 */

import { loadSprintStatus, findStatusEntry, findStoryFile } from "./bmad-artifacts.js";

interface Args {
  story: string;
  implementationArtifacts: string;
  expectStatus?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const story = get("--story");
  const implementationArtifacts = get("--implementation-artifacts");
  const expectStatus = get("--expect-status");
  if (!story || !implementationArtifacts) {
    throw new Error("Required: --story <dotted-key, e.g. 3.6h> --implementation-artifacts <dir> [--expect-status <status>]");
  }
  return { story, implementationArtifacts, expectStatus };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { devStatus } = await loadSprintStatus(args.implementationArtifacts);
  const entry = findStatusEntry(devStatus, args.story);
  const file = await findStoryFile(args.implementationArtifacts, args.story);

  const fileOk = !!file;
  const statusOk = args.expectStatus ? entry?.status === args.expectStatus : !!entry && entry.status !== "backlog";
  const pass = fileOk && statusOk;

  console.log(`Story ${args.story}:`);
  console.log(`  Story file:          ${file ? `FOUND (${file})` : "MISSING"}`);
  console.log(`  sprint-status.yaml:  ${entry ? `${entry.key} = ${entry.status}` : "NOT FOUND"}`);
  if (args.expectStatus) {
    console.log(`  Expected status:     "${args.expectStatus}" -- ${statusOk ? "MATCH" : "MISMATCH"}`);
  } else {
    console.log(`  Moved off backlog:   ${statusOk ? "YES" : "NO"}`);
  }
  console.log(pass ? "PASS" : "FAIL");

  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(`[verify-story] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
