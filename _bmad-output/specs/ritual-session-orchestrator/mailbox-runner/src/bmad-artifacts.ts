/**
 * Read-only parsing helpers for real BMad artifacts (epics.md,
 * sprint-status.yaml) -- shared by resolve-targets.ts and verify-story.ts.
 * Never writes to these files; that stays the job of the real bmad-* skills.
 *
 * Story-key formats are two different things, per the same fidelity gap
 * ai-dev-orchestrator's state-machines.md documents: epics.md section keys
 * are dotted ("3.6h", from "### Story 3.6h: ..."); sprint-status.yaml/story
 * filenames are dash-slugs ("3-6h-gate-image-re-hosting-..."), not a
 * mechanical transform of the title. Going dotted -> dash-prefix is
 * mechanical (join epic+story with "-", append "-"); going dash-key ->
 * dotted is ALSO mechanical in the reverse direction specifically because
 * the first two dash-segments are always the bare epic number and
 * story-number+letter-suffix (confirmed against every real key seen in this
 * project: "3-4n-filter-...", "3-6g-add-...", "0-7a-nav-item-...") -- only
 * the descriptive slug after that is a non-mechanical judgment call, and
 * neither helper here needs to produce or consume the slug.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export function dottedToDashPrefix(dotted: string): string {
  return dotted.replace(/\./g, "-") + "-";
}

/** Mechanical in this one direction only -- see file header. */
export function dashKeyToDotted(dashKey: string): string {
  const [epic, story] = dashKey.split("-");
  return `${epic}.${story}`;
}

export interface SprintStatus {
  devStatus: Record<string, string>;
  path: string;
}

export async function loadSprintStatus(implementationArtifactsDir: string): Promise<SprintStatus> {
  const filePath = path.join(implementationArtifactsDir, "sprint-status.yaml");
  const raw = await readFile(filePath, "utf-8");
  const doc = YAML.parse(raw) as { development_status?: Record<string, string> };
  if (!doc?.development_status) {
    throw new Error(`${filePath} has no top-level development_status map -- unexpected shape.`);
  }
  return { devStatus: doc.development_status, path: filePath };
}

export function findStatusEntry(devStatus: Record<string, string>, dottedKey: string): { key: string; status: string } | undefined {
  const prefix = dottedToDashPrefix(dottedKey);
  for (const key of Object.keys(devStatus)) {
    if (key.startsWith(prefix)) return { key, status: devStatus[key] };
  }
  return undefined;
}

/** Every "backlog" story key under a given epic number, in sprint-status.yaml's
 *  own file order (object key insertion order, which V8 preserves for
 *  string keys) -- excludes epic-level keys like "epic-3" / "epic-3-retrospective"
 *  and any story already past backlog. (Found by a real run against this
 *  epic's actual data: the status check was missing here entirely, so this
 *  returned all 51 stories under Epic 3 regardless of state, not just the
 *  handful still backlog -- fixed, not a design change.) */
export function listStoryKeysForEpic(devStatus: Record<string, string>, epicNumber: string): string[] {
  const prefix = `${epicNumber}-`;
  const storyKeyRe = /^\d+-\d+[a-z]?-/;
  return Object.keys(devStatus).filter((k) => k.startsWith(prefix) && storyKeyRe.test(k) && devStatus[k] === "backlog");
}

export interface EpicStorySection {
  dottedKey: string;
  title: string;
  dependsOn: string[]; // dotted keys this section's "Depends on:" line names
  bodyText: string; // full section text (heading to next heading), for --since-proposal matching
}

const STORY_HEADER_RE = /^#{2,4}\s+Story\s+(\d+\.\d+[a-z]?):\s*(.+)$/;
const HEADING_RE = /^#{2,4}\s+/;
const DEPENDS_ON_RE = /\*\*Depends on:\*\*\s*(.+)$/m;
const STORY_REF_RE = /Story\s+((?:\d+\.\d+[a-z]?)(?:\/\d+\.\d+[a-z]?)*)/g;

/**
 * Known limitation: dependency extraction is a regex match on the literal
 * "Depends on:" line's text for "Story X.Y" tokens. A parenthetical mention
 * on that same line (e.g. "...extended by sibling Story 4.7c for the review
 * UI...") reads as a dependency too, even though it's prose context, not a
 * real ordering constraint. Harmless when the mentioned story is already
 * `done` or is itself in the target set; only matters if it's an unrelated,
 * not-yet-done story that happens to be named in the same sentence -- rare
 * in practice given how these lines are actually written in this repo, but
 * not impossible. Not worth full prose parsing to close for a two-script
 * utility; re-visit if a real batch run hits a false-positive block.
 */
export async function loadEpicsSections(epicsPath: string): Promise<Map<string, EpicStorySection>> {
  const raw = await readFile(epicsPath, "utf-8");
  // epics.md is CRLF on this repo (confirmed via a real run: split("\n") alone
  // left a trailing "\r" on every line, and JS regex "." never matches "\r"
  // -- a LineTerminator, excluded from "." same as "\n" -- so `(.+)$` could
  // never complete and every header match silently failed). Strip it here.
  const lines = raw.split(/\r?\n/);
  const sections = new Map<string, EpicStorySection>();

  let current: { dottedKey: string; title: string; bodyLines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const bodyText = current.bodyLines.join("\n");
    const dependsMatch = DEPENDS_ON_RE.exec(bodyText);
    const dependsOn: string[] = [];
    if (dependsMatch) {
      STORY_REF_RE.lastIndex = 0;
      let refMatch: RegExpExecArray | null;
      while ((refMatch = STORY_REF_RE.exec(dependsMatch[1]))) {
        for (const k of refMatch[1].split("/")) dependsOn.push(k);
      }
    }
    sections.set(current.dottedKey, { dottedKey: current.dottedKey, title: current.title, dependsOn, bodyText });
  };

  for (const line of lines) {
    const headerMatch = STORY_HEADER_RE.exec(line);
    if (headerMatch) {
      flush();
      current = { dottedKey: headerMatch[1], title: headerMatch[2], bodyLines: [] };
    } else if (HEADING_RE.test(line)) {
      // A non-story heading (e.g. "## Epic 4") ends the current section without starting a new one.
      flush();
      current = null;
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  flush();

  return sections;
}

export async function findStoryFile(implementationArtifactsDir: string, dottedKey: string): Promise<string | undefined> {
  const prefix = dottedToDashPrefix(dottedKey);
  const files = await readdir(implementationArtifactsDir);
  return files.find((f) => f.startsWith(prefix) && f.endsWith(".md"));
}
