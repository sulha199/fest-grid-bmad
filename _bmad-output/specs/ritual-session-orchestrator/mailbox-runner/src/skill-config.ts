/**
 * Loader for ../ritual-config.json -- the single, plain-JSON, human-editable
 * file that decides both AI/CLI routing (which runtime a skill runs under)
 * and its model/reasoning settings. Previously this was a hardcoded object
 * in this very file (TypeScript source, not something you'd want to hand-edit
 * to change a model) -- moved to real config specifically so routing/model/
 * reasoning can be changed without touching code.
 *
 * Not a hard permission boundary (see README: neither Claude Code nor Cline
 * exposes a per-skill allow/deny list) -- this is what decides which script
 * dispatch-ritual.ts invokes and what it passes it, not an enforced sandbox.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeSkillConfig {
  runtime: "claude";
  model: string;
  effort?: ClaudeEffort;
}

export interface ClineSkillConfig {
  runtime: "cline";
  gcpRegion: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
}

export type SkillConfig = ClaudeSkillConfig | ClineSkillConfig;

const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ritual-config.json");

let cache: Record<string, SkillConfig> | undefined;

/** Reads ritual-config.json from disk once and caches per-process -- a long
 *  batch run doesn't need to notice a config edit mid-run, but each new
 *  run-ritual.ts/run-ritual-cline.ts/dispatch-ritual.ts invocation is a fresh
 *  process, so an edit always takes effect on the next story dispatched. */
export function loadSkillConfigs(): Record<string, SkillConfig> {
  if (!cache) {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    cache = JSON.parse(raw) as Record<string, SkillConfig>;
  }
  return cache;
}

export function getSkillConfig(skill: string): SkillConfig | undefined {
  return loadSkillConfigs()[skill];
}

export function knownSkills(): string[] {
  return Object.keys(loadSkillConfigs());
}
