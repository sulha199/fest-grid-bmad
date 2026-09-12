/**
 * Loads KEY=VALUE pairs from <cwd>/.env into process.env, without adding a
 * dotenv dependency. Existing process.env values always win (a real shell
 * export should never be silently overridden by a stale .env value).
 *
 * Why this exists: found 2026-09-12 when a fresh orchestrator invocation
 * failed fast with "Environment variable DEEPINFRA_API_KEY is not set" even
 * though the repo's root .env has it -- these scripts read process.env
 * directly and were never loading .env themselves, so whether a run worked
 * depended on whether the *calling shell* happened to have sourced .env
 * first. Every entry point below takes --cwd already, so loading from
 * <cwd>/.env there makes auth config-driven like everything else this
 * orchestrator does, instead of shell-session-dependent.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export function loadDotEnv(cwd: string): void {
  const envPath = path.join(cwd, ".env");
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq === -1) continue;

    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
