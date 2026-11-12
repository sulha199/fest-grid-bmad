import type { ReextractRefreshReport } from "../posts/reextract-image-refresh.js";
import type { PostScraperAdapterName } from "../scraper/post-scraper-adapter.js";
import { parsePlatformPostIdentity } from "../scraper/parse-platform-post-identity.js";
import { detectPlatformFromUrl } from "../scraper/platform-registry.js";
import {
  getJobTypeDefinition,
  isTerminalJobStatus,
  registerJobTypeDefinition,
  type JobStatus,
  type JobTypeDefinition,
} from "./job-engine.js";

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

/**
 * One RUN of either phase may use this long (design review of Story 10.6). Phase 2's face blur needs `FACE_BLUR_MIN_REMAINING_TIME_MS`
 * (60 s) left at each image, and the handler's remaining time is the run's budget, so the engine's 150 s default would let the blur
 * work only in the first 90 s and drop slides after it (the manual job gave the blur the Lambda's whole remaining time). Both host
 * Lambdas (Scraper and AI-processor) have a 300 s timeout in `festgrid-backend-stack.ts`; 270 s leaves 30 s for the engine's final
 * writes and a hand-off, and `festgrid-backend-stack.test.ts` fails if either timeout drops to this number or below.
 */
export const REEXTRACT_POST_ATTEMPT_CAP_MS = 270 * 1000;

export const reextractPostJobType: JobTypeDefinition = {
  type: REEXTRACT_POST_JOB_TYPE,
  host: "scraper",
  maxDurationMs: REEXTRACT_POST_MAX_DURATION_MS,
  attemptCapMs: REEXTRACT_POST_ATTEMPT_CAP_MS,
};

// Idempotent: a Lambda bundle that evaluates this module twice (two entry paths to one package) must start, not throw "already registered".
if (!getJobTypeDefinition(reextractPostJobType.type)) {
  registerJobTypeDefinition(reextractPostJobType);
}

/**
 * What the job stores as its input: the stored post, or (for a post that is not in the database) the URL. Never a token. The
 * post's caption is NEVER part of the identity of the job: while a fetched caption is needed between the two phases it is held in
 * `held` and blanked as soon as phase 2 ends (see `ReextractHeldPost`).
 */
export type ReextractPostJobInput = { postId: string } | { url: string };

/**
 * A post as fetched in phase 1 for a re-extract whose caption is not stored (a curator post, or a URL not in the database), held on
 * the job (`jobs.input.held`) ONLY for the minutes between the two phases. Phase 2 blanks it in its `finally`, the job-engine sweep
 * blanks any that outlived the job or the 30-minute window, and it never reaches `result_data`, `job_attempts`, an error message,
 * a log or the GraphQL output (PRD 5: a job keeps no caption once it ends; owner decision 2026-11-12, AD-40 Rule 9).
 */
export interface ReextractHeldPost {
  content: string;
  imageUrl?: string;
  additionalImageUrls?: string[];
  postUrl: string;
  publishedAt: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The key for reuse (FR120): one open re-extract per moderator and post. */
export function reextractPostInputKey(postId: string): string {
  return postId.toLowerCase();
}

/**
 * The reuse key of a re-extract of a URL that is not in the database: the platform's own post identity when the URL has one (every
 * spelling of one post shares it), else the trimmed URL. A different prefix from a post id, so the two never collide.
 */
export function reextractUrlInputKey(url: string): string {
  const identity = parsePlatformPostIdentity({ postUrl: url, originalPostUrl: null });
  if (identity.platformPostId !== null) {
    return `url:${detectPlatformFromUrl(url) ?? "unknown"}:${identity.platformPostId}`;
  }
  return `url:${url.trim()}`;
}

/** Reads a job's stored input; null when it is neither a post id nor a URL (a handler then fails the job rather than guessing). */
export function parseReextractPostInput(input: unknown): ReextractPostJobInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { postId, url } = input as { postId?: unknown; url?: unknown };
  if (typeof postId === "string" && UUID_PATTERN.test(postId)) return { postId };
  if (typeof url === "string" && url.trim() !== "") return { url };
  return null;
}

/** The held post of a job input, or null when none is held (or what is there is not a held post). */
export function readHeldPost(input: unknown): ReextractHeldPost | null {
  if (typeof input !== "object" || input === null) return null;
  const held = (input as { held?: unknown }).held;
  if (typeof held !== "object" || held === null) return null;
  const { content, postUrl, publishedAt } = held as Partial<ReextractHeldPost>;
  return typeof content === "string" && typeof postUrl === "string" && typeof publishedAt === "string" ? (held as ReextractHeldPost) : null;
}

/** The input with its held post removed: what is left is the identity of the job and nothing else. */
export function withoutHeldPost(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const rest = { ...(input as Record<string, unknown>) };
  delete rest.held;
  return rest;
}

/** The input with a post held on it. */
export function withHeldPost(input: unknown, held: ReextractHeldPost): Record<string, unknown> {
  return { ...(withoutHeldPost(input) as Record<string, unknown>), held };
}

/** An open job with no progress for this long is treated as stuck: a new click replaces it (owner decision 2026-11-12). */
export const REEXTRACT_STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Whether an open re-extract job is stuck: it has no ending, it was admitted (a job still waiting for a place is in a queue, not
 * stuck: replacing it would send it to the back) and nothing wrote to it (`updatedAt`: claim, phase, report) for five minutes.
 */
export function isReextractJobStale(job: { status: JobStatus; admittedAt: Date | null; updatedAt: Date }, now: Date): boolean {
  if (isTerminalJobStatus(job.status) || job.admittedAt === null) return false;
  return now.getTime() - job.updatedAt.getTime() > REEXTRACT_STALE_AFTER_MS;
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
export function decideReextractEnding(report: Pick<ReextractRefreshReport, "outcome" | "saved" | "expiredLinks">): ReextractEnding {
  if (report.outcome === "REFRESHED" && !report.saved && report.expiredLinks > 0) {
    // A provider answered but nothing healed: the stored links are still dead, and a success with no reason would show 0 of N images
    // with no explanation (FR117: every ending other than Succeeded carries a reason).
    return {
      outcome: "SUCCEEDED_WITH_LIMITS",
      reasonCode: "REFRESH_DID_NOT_HEAL_IMAGES",
      message: "The provider answered but returned no usable fresh images, so the preview used the stored images, some of whose links have expired.",
    };
  }
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
export type ReextractExtractionErrorCode =
  | "EXTRACTION_FAILED"
  | "QUOTA_EXHAUSTED"
  | "NOT_FOUND"
  | "CHAIN_IN_FLIGHT"
  | "ACCOUNT_NOT_SCRAPABLE"
  | "RATE_LIMITED"
  | "SCRAPE_IN_PROGRESS"
  | "SCRAPE_FAILED";

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
    // A re-extract whose caption had to come from a fetch fails with the refusal itself (the screen already reads these codes).
    case "ACCOUNT_TYPE_NOT_SCRAPED":
      return { errorCode: "ACCOUNT_NOT_SCRAPABLE", errorMessage };
    case "COOLDOWN":
      return { errorCode: "RATE_LIMITED", errorMessage };
    case "REFRESH_IN_PROGRESS":
      return { errorCode: "SCRAPE_IN_PROGRESS", errorMessage };
    case "POST_UNAVAILABLE":
    case "NO_PROVIDER_REACHABLE":
    case "PROVIDER_OVER_QUOTA":
      return { errorCode: "SCRAPE_FAILED", errorMessage };
    default:
      return { errorCode: "EXTRACTION_FAILED", errorMessage };
  }
}
