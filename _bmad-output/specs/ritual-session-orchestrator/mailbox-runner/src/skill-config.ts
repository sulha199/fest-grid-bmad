/**
 * Per-skill defaults for Cline-driven ("act" mode) ritual children -- see
 * ../README.md's "Model/provider per mode" section. All Vertex-mode (no
 * apiKey, ambient GCP ADC) per the user's confirmed local setup: cline-cli/
 * gemini-cli already authenticate this way against GOOGLE_CLOUD_PROJECT
 * (.env), so run-ritual-cline.ts needs no separate credentials for these.
 *
 * Not a hard permission boundary (see README: neither runtime exposes a
 * per-skill allow/deny list) -- this is a convenience lookup so a caller
 * doesn't have to remember/retype region/model/reasoning per skill. Explicit
 * CLI flags on run-ritual-cline.ts always override whatever's looked up here.
 */

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface SkillDefaults {
  gcpRegion: string;
  modelId: string;
  reasoningEffort: ReasoningEffort;
}

export const SKILL_DEFAULTS: Record<string, SkillDefaults> = {
  "bmad-dev-story": {
    gcpRegion: "asia-southeast1",
    modelId: "gemini-3.5-flash",
    reasoningEffort: "medium",
  },
  "bmad-code-review": {
    gcpRegion: "global",
    modelId: "gemini-3.1-pro-preview",
    reasoningEffort: "high",
  },
};
