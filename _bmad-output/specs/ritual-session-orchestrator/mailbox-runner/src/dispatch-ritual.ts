/**
 * Single entry point for dispatching one ritual -- reads ../ritual-config.json
 * to decide which runtime (Claude via run-ritual.ts, or Cline via
 * run-ritual-cline.ts) a given --skill routes to, then re-execs that script
 * with the same arguments. The caller driving a batch shouldn't need to know
 * or remember which of the two underlying scripts a given skill maps to --
 * that's exactly what the config file is for.
 *
 * Usage:
 *   tsx src/dispatch-ritual.ts --skill bmad-create-story --story 3.6k \
 *       --mailbox ../mailbox --cwd C:/projects/portfolio/festgrid/bmad
 *
 *   tsx src/dispatch-ritual.ts --skill bmad-dev-story --story 3.6h \
 *       --mailbox ../mailbox --cwd C:/projects/portfolio/festgrid/bmad
 *
 * Both resolve model/region/reasoning/routing purely from the active config
 * -- change routing, model, or reasoning level there, not in code. Pass
 * --config <preset-name-or-path> to select a preset for this invocation
 * instead of ../ritual-config.json's default -- e.g.
 * --config all-claude-max, or --config mixed-low. Forwarded automatically to
 * whichever underlying script gets dispatched, since it's part of the passed-
 * through argv; this file also applies it to its own routing decision.
 *
 * All other flags (--prompt/--label overrides, --resume/--resume-label for
 * the Claude side, --api-key-env instead of Vertex ADC for the Cline side,
 * etc.) pass straight through to whichever underlying script gets
 * dispatched -- this file does no argument validation of its own beyond
 * requiring --skill.
 *
 * Exits with the dispatched child's own exit code; stdio is inherited, so
 * all of that script's existing logging (including mailbox request/resolve
 * lines) appears exactly as if it had been invoked directly.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSkillConfig, knownSkills, setConfigOverride, activeConfigPath } from "./skill-config.js";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const skill = getArg(argv, "--skill");
  if (!skill) {
    throw new Error(`Required: --skill <name> [--story <id>] [--config <preset-name-or-path>] [...other flags, passed through]. Known skills: ${knownSkills().join(", ")}`);
  }

  const configFlag = getArg(argv, "--config");
  if (configFlag) setConfigOverride(configFlag);
  console.log(`[dispatch-ritual] using config: ${activeConfigPath()}`);

  const config = getSkillConfig(skill);
  if (!config) {
    throw new Error(`Unknown --skill "${skill}" -- no entry in ${activeConfigPath()}. Known skills: ${knownSkills().join(", ")}`);
  }

  const targetScript = config.runtime === "claude" ? "run-ritual.ts" : "run-ritual-cline.ts";
  const targetPath = path.join(SRC_DIR, targetScript);
  // Invoke tsx's own CLI entry point directly via this same node executable,
  // rather than shelling out to `npx tsx ...` -- found by a real run that
  // spawn(..., {shell: true}) re-tokenizes the argv array on Windows (cmd.exe
  // re-splits it on whitespace), silently truncating any multi-word quoted
  // argument like --prompt "..." down to its first word. Spawning node.exe
  // directly with an explicit argv array needs no shell at all, so nothing
  // re-tokenizes it.
  const tsxCliPath = path.join(SRC_DIR, "..", "node_modules", "tsx", "dist", "cli.mjs");

  console.log(`[dispatch-ritual] --skill "${skill}" -> runtime="${config.runtime}" (${targetScript}), model=${config.model}`);

  const child = spawn(process.execPath, [tsxCliPath, targetPath, ...argv], {
    stdio: "inherit",
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      console.error(`[dispatch-ritual] failed to spawn ${targetScript}:`, err);
      resolve(1);
    });
  });

  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error(`[dispatch-ritual] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
