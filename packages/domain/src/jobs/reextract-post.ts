import type { ReextractRefreshReport } from "../posts/reextract-image-refresh.js";
import type { PostScraperAdapterName } from "../scraper/post-scraper-adapter.js";
import { getJobTypeDefinition, registerJobTypeDefinition, type JobStatus, type JobTypeDefinition } from "./job-engine.js";

// Story 10.6 (PRD 3.9.3 FR125, 3.18; Architecture Spine AD-53 Rule 17) -- the moderator re-extract as an engine job. This file is
// the PURE half of the type (Rule 2): its definition, input, phases and the rules that map a refresh outcome to a job ending and a
// job status to the existing extraction states. It imports no handler, so the API Lambda can read it; it registers the definition
// when the `jobs` barrel is imported, so every Lambda that admits, promotes or sweeps jobs knows the type (Rule 12).

export const REEXTRACT_POST_JOB_TYPE = "reextract-post";

/** Phase 1, the refresh, runs in the Scraper Lambda. */
export const REEXTRACT_PHASE_REFRESH = "refresh";
/** Phase 2, the preview, runs in the AI-processor Lambda after a hand-off (AD-53 Rule 8). */
export const REEXTRACT_PHASE_PREVIEW = "preview";

/** The whole-job bound: a refresh of up to about two minutes, then a Gemini call, with room for a queue wait inside the engine. */
export const REEXTRACT_POST_MAX_DURATION_MS = 10 * 60 * 1000;

/**
 * This type's own provider order (design decision 22): a moderator is waiting, Apify answers in seconds with full-size images and
 * Bright Data needs about 90 seconds and returns 640 px, so Apify goes first. The default post order stays `brightdata,apify`.
 */
export const REEXTRACT_POST_PROVIDER_ORDER: readonly PostScraperAdapterName[] = ["apify", "brightdata"];

export const reextractPostJobType: JobTypeDefinition = {
  type: REEXTRACT_POST_JOB_TYPE,
  host: "scraper",
  maxDurationMs: REEXTRACT_POST_MAX_DURATION_MS,
};

// Idempotent: a Lambda bundle that evaluates this module twice (two entry paths to one package) must start, not throw "already registered".
if (!getJobTypeDefinition(reextractPostJobType.type)) {
  registerJobTypeDefinition(reextractPostJobType);
}

/** What the job stores as its input: the post, nothing else (never a caption, a URL or a token). */
export interface ReextractPostJobInput {
  postId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The key for reuse (FR120): one open re-extract per moderator and post. */
export function reextractPostInputKey(postId: string): string {
  return postId.toLowerCase();
}

/** Reads a job's stored input; null when it is not a post id (a handler then fails the job rather than guessing). */
export function parseReextractPostInput(input: unknown): ReextractPostJobInput | null {
  if (typeof input !== "object" || input === null) return null;
  const postId = (input as { postId?: unknown }).postId;
  return typeof postId === "string" && UUID_PATTERN.test(postId) ? { postId } : null;
}

export interface ReextractEnding {
  outcome: "SUCCEEDED" | "SUCCEEDED_WITH_LIMITS";
  reasonCode?: string;
  /** Plain words, set when the job ends with limits (FR117). */
  message?: string;
}

const REFRESH_ENDINGS: Record<Exclude<ReextractRefreshReport["outcome"], "NOT_NEEDED" | "REFRESHED">, { reasonCode: string; message: string }> = {
  COOLDOWN: {
    reasonCode: "COOLDOWN",
    message: "The images of this post were refreshed less than 10 minutes ago, so the preview used the stored images.",
  },
  NOT_SCRAPED: {
    reasonCode: "ACCOUNT_TYPE_NOT_SCRAPED",
    message: "This post belongs to an account that is not scraped, so its images were not refreshed and the preview used the stored images.",
  },
  IN_FLIGHT: {
    reasonCode: "REFRESH_IN_PROGRESS",
    message: "Another request is fetching this post right now, so the preview used the stored images.",
  },
  POST_UNAVAILABLE: {
    reasonCode: "POST_UNAVAILABLE",
    message: "The post is no longer available at the platform, so the preview used the stored images.",
  },
  NO_PROVIDER_REACHABLE: {
    reasonCode: "NO_PROVIDER_REACHABLE",
    message: "No provider could be reached to refresh the images, so the preview used the stored images.",
  },
  PROVIDER_OVER_QUOTA: {
    reasonCode: "PROVIDER_OVER_QUOTA",
    message: "Every provider has used up its quota, so the images were not refreshed and the preview used the stored images.",
  },
  TIMED_OUT: {
    reasonCode: "TIMED_OUT",
    message: "Refreshing the images took too long, so the preview used the stored images.",
  },
};

/**
 * How the job ends once its preview ran, from what the refresh phase did (FR117, FR125): a refresh that was not needed or that
 * delivered ends SUCCEEDED; any refresh that was due but did not happen ends SUCCEEDED_WITH_LIMITS with its reason, because the
 * preview continued on the stored images.
 */
export function decideReextractEnding(report: Pick<ReextractRefreshReport, "outcome">): ReextractEnding {
  if (report.outcome === "NOT_NEEDED" || report.outcome === "REFRESHED") {
    return { outcome: "SUCCEEDED" };
  }
  const { reasonCode, message } = REFRESH_ENDINGS[report.outcome];
  return { outcome: "SUCCEEDED_WITH_LIMITS", reasonCode, message };
}

/** The existing `ExtractionJobState` of the GraphQL schema, which the moderator screen already polls. */
export type ExtractionJobStateName = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export function toExtractionJobState(status: JobStatus): ExtractionJobStateName {
  switch (status) {
    case "QUEUED":
      return "PENDING";
    case "RUNNING":
    case "WAITING":
      return "PROCESSING";
    case "SUCCEEDED":
    case "SUCCEEDED_WITH_LIMITS":
      return "SUCCEEDED";
    case "FAILED":
    case "EXPIRED":
      return "FAILED";
  }
}

/** The subset of the GraphQL `ExtractionErrorCode` a re-extract job can end with. */
export type ReextractExtractionErrorCode = "EXTRACTION_FAILED" | "QUOTA_EXHAUSTED" | "NOT_FOUND" | "CHAIN_IN_FLIGHT";

const TIMED_OUT_MESSAGE = "The extraction timed out. Please try again.";
const DEFAULT_FAILURE_MESSAGE = "The extraction could not be completed.";

/**
 * A failed or expired job in the shape the moderator screen already reads (`errorCode`, `errorMessage`). The engine's own endings
 * (the job's code threw, it ran out of time, it never started) all read as the generic `EXTRACTION_FAILED`; the job's stored plain
 * message is used when it has one.
 */
export function toExtractionError(
  reasonCode: string | null | undefined,
  message: string | null | undefined
): { errorCode: ReextractExtractionErrorCode; errorMessage: string } {
  const timedOut = reasonCode === "TIMED_OUT" || reasonCode === "WAITED_TOO_LONG";
  const errorMessage = message || (timedOut ? TIMED_OUT_MESSAGE : DEFAULT_FAILURE_MESSAGE);
  switch (reasonCode) {
    case "QUOTA_EXHAUSTED":
      return { errorCode: "QUOTA_EXHAUSTED", errorMessage };
    case "POST_NOT_FOUND":
      return { errorCode: "NOT_FOUND", errorMessage };
    case "CHAIN_IN_FLIGHT":
      return { errorCode: "CHAIN_IN_FLIGHT", errorMessage };
    default:
      return { errorCode: "EXTRACTION_FAILED", errorMessage };
  }
}
