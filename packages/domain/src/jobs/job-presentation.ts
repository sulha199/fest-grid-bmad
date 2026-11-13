import { REEXTRACT_APPLY_WINDOW_MS } from "../posts/types.js";
import { REEXTRACT_PHASE_PREVIEW, REEXTRACT_PHASE_REFRESH, REEXTRACT_POST_JOB_TYPE } from "./reextract-post.js";

// Story 10.4 (Part A; PRD 3.18 FR117, FR123; Architecture Spine AD-53) -- the one per-type knowledge the Jobs read API needs: what a job
// type is called at the GraphQL boundary, the ordered steps it goes through and what kind of thing it is about. The client holds no
// per-type logic except labels. Each adoption story (10.7, 10.9 to 10.12a) registers its own entry next to its job type definition.

/** The GraphQL `JobType` enum (`OTHER` is for an engine type this registry does not know, so an unknown job never breaks a page). */
export const JOB_GRAPHQL_TYPES = [
  "SUBSCRIBE",
  "PROFILE_LOOKUP",
  "ACCOUNT_REFRESH",
  "CORRECTION",
  "EXTRACT_FROM_URL",
  "EXTRACT_SELECTED_POSTS",
  "REEXTRACT_REFRESH",
  "ADMIN_OPERATION",
  "OTHER",
] as const;
export type JobGraphqlType = (typeof JOB_GRAPHQL_TYPES)[number];

/** What a job is about: an account, a set of posts, one post, or nothing the page can name. */
export type JobSubjectKind = "ACCOUNT" | "POSTS" | "POST" | "NONE";

/** What a finished job produced, for the page's result link. */
export type JobOutcomeKind = "ACCOUNT" | "PREVIEW" | "EVENTS" | "NONE";

/**
 * The input keys a subject reader looks at, as a convention a job type follows when it stores its input (decision 13 of Story 10.4):
 * ACCOUNT jobs store `accountId`, POSTS jobs store `postIds` (an array), POST jobs store `postId` or, for a post not in the database, `url`.
 */
export const JOB_INPUT_ACCOUNT_ID_KEY = "accountId";
export const JOB_INPUT_POST_IDS_KEY = "postIds";
export const JOB_INPUT_POST_ID_KEY = "postId";
export const JOB_INPUT_URL_KEY = "url";

/** Facts read from a job's stored report that decide which steps were skipped. Only named, safe values. */
export interface JobStepFacts {
  /** `result_data.refresh.outcome` of a re-extract job, when the report exists. */
  refreshOutcome: string | null;
}

export interface JobTypePresentation {
  /** The engine's job type string (`jobs.type`). */
  engineType: string;
  graphqlType: JobGraphqlType;
  /** The ordered phases (step keys). Empty: the page shows one generic step. */
  phases: readonly string[];
  subjectKind: JobSubjectKind;
  outcomeKind: JobOutcomeKind;
  /** Phases that did not run for this job, given what the report says (a skipped step reads SKIPPED). */
  skippedPhases?: (facts: JobStepFacts) => readonly string[];
}

const presentations = new Map<string, JobTypePresentation>();

/** Registering a type twice is a no-op (a Lambda bundle that evaluates this module twice must not throw). Returns whether it registered. */
export function registerJobTypePresentation(presentation: JobTypePresentation): boolean {
  if (presentation.engineType.trim() === "") {
    throw new Error("A job type presentation needs a non-empty engineType");
  }
  if (presentations.has(presentation.engineType)) {
    return false;
  }
  presentations.set(presentation.engineType, presentation);
  return true;
}

const OTHER_PRESENTATION: Omit<JobTypePresentation, "engineType"> = {
  graphqlType: "OTHER",
  phases: [],
  subjectKind: "NONE",
  outcomeKind: "NONE",
};

/** The presentation of an engine type; an unknown type reads as `OTHER` with no steps and no subject. */
export function getJobTypePresentation(engineType: string): JobTypePresentation {
  return presentations.get(engineType) ?? { engineType, ...OTHER_PRESENTATION };
}

/** The engine types registered for one GraphQL type (the reverse lookup `activeJobs(subject)` needs). */
export function listEngineTypesForGraphqlType(graphqlType: JobGraphqlType): string[] {
  return [...presentations.values()].filter((p) => p.graphqlType === graphqlType).map((p) => p.engineType);
}

/** Every engine type with a registered presentation (what `OTHER` is the complement of). */
export function listRegisteredPresentationTypes(): string[] {
  return [...presentations.keys()];
}

registerJobTypePresentation({
  engineType: REEXTRACT_POST_JOB_TYPE,
  graphqlType: "REEXTRACT_REFRESH",
  phases: [REEXTRACT_PHASE_REFRESH, REEXTRACT_PHASE_PREVIEW],
  subjectKind: "POST",
  outcomeKind: "PREVIEW",
  skippedPhases: (facts) => (facts.refreshOutcome === "NOT_NEEDED" ? [REEXTRACT_PHASE_REFRESH] : []),
});

/** A re-extract preview can be applied this long after the job finished (re-exported so the read layer has one source). */
export const JOB_PREVIEW_APPLY_WINDOW_MS = REEXTRACT_APPLY_WINDOW_MS;
