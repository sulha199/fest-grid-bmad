/**
 * Loader for the ritual routing/model/reasoning config -- the single,
 * plain-JSON, human-editable source that decides AI/CLI routing per bmad-*
 * skill. Two layers:
 *
 *   - ../ritual-config.json -- the active default, loaded when nothing else
 *     is specified.
 *   - ../config-presets/<name>.json -- named alternatives (e.g.
 *     "mixed-low", "mixed-medium", "mixed-max", "all-claude-low",
 *     "all-claude-medium", "all-claude-max") selectable per invocation via
 *     each entry script's --config <name-or-path> flag, without overwriting
 *     the active default file.
 *
 * Call setConfigOverride() (from a --config flag) before the first
 * getSkillConfig()/knownSkills() call in a process; omit it to use
 * ritual-config.json. A bare name (no "/", no ".json") resolves against
 * config-presets/<name>.json; anything else is treated as a literal path
 * (absolute, or relative to the current working directory).
 *
 * Metadata keys (any key starting with "_", e.g. "_preset"/"_description" --
 * every preset file self-documents this way) are filtered out of what
 * getSkillConfig()/knownSkills() return, so they never leak into a "Known
 * skills:" error message or get treated as an actual skill entry.
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

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CONFIG_PATH = path.join(PACKAGE_ROOT, "ritual-config.json");

let overridePath: string | undefined;
let cache: Record<string, SkillConfig> | undefined;
let cachedPath: string | undefined;

/** Resolves a --config value to a real file path. A bare name (no path
 *  separator, no .json extension) is looked up under config-presets/;
 *  anything else is used as-is (absolute or cwd-relative). */
export function resolveConfigPath(nameOrPath: string): string {
  const looksLikeBareName = !nameOrPath.includes("/") && !nameOrPath.includes("\\") && !nameOrPath.endsWith(".json");
  return looksLikeBareName ? path.join(PACKAGE_ROOT, "config-presets", `${nameOrPath}.json`) : nameOrPath;
}

/** Call once, early, from a --config flag. Must be called before the first
 *  loadSkillConfigs()/getSkillConfig()/knownSkills() call to take effect --
 *  the config is cached per-process once loaded. */
export function setConfigOverride(nameOrPath: string): void {
  overridePath = resolveConfigPath(nameOrPath);
  cache = undefined; // invalidate in case something already loaded the default
}

export function activeConfigPath(): string {
  return overridePath ?? DEFAULT_CONFIG_PATH;
}

export function loadSkillConfigs(): Record<string, SkillConfig> {
  const targetPath = activeConfigPath();
  if (cache && cachedPath === targetPath) return cache;

  const raw = readFileSync(targetPath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const skills: Record<string, SkillConfig> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith("_")) continue;
    skills[key] = value as SkillConfig;
  }
  cache = skills;
  cachedPath = targetPath;
  return cache;
}

export function getSkillConfig(skill: string): SkillConfig | undefined {
  return loadSkillConfigs()[skill];
}

export function knownSkills(): string[] {
  return Object.keys(loadSkillConfigs());
}
