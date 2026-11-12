import type { JobStatus } from "./job-engine.js";

// Story 10.5 -- the pure rules of a late vendor result (PRD 3.18 FR119; Architecture Spine AD-53). No DB, Node-only or AWS import:
// `apps/backend/src/lib/job-engine/late-results.ts` reads the vendor and the rows and applies these rules.

/** What Bright Data reports for a snapshot (`getBrightDataProgress`). */
export type SnapshotProgressStatus = "scheduled" | "starting" | "building" | "running" | "ready" | "failed";

export type SnapshotWaitDecision = "COLLECT" | "GIVE_UP_FAILED" | "WAIT" | "GIVE_UP_TOO_LONG";

/**
 * What to do about a vendor snapshot that outlived its job's budget. A `ready` snapshot is collected and a `failed` one given
 * up on whatever its age (the bound never delays either). One still in flight (`scheduled`, `building`, `running`) is waited for
 * until `maxWaitMs` after it started (`starting` counts as in flight) (`BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES`), then given up on; this replaces sending it to a
 * paid fallback at once (IDEA-102).
 */
export function decideSnapshotWait(input: {
  progressStatus: SnapshotProgressStatus;
  ageMs: number;
  maxWaitMs: number;
}): SnapshotWaitDecision {
  if (input.progressStatus === "ready") return "COLLECT";
  if (input.progressStatus === "failed") return "GIVE_UP_FAILED";
  return input.ageMs >= input.maxWaitMs ? "GIVE_UP_TOO_LONG" : "WAIT";
}

/**
 * Which job endings a late result may settle (FR119, FR117): a job still WAITING for the snapshot, RUNNING, or QUEUED (it was
 * re-admitted between the snapshot being linked and its result arriving), and one that ended EXPIRED because it ran out of time
 * (`TIMED_OUT`), which becomes SUCCEEDED "completed after deadline". Any other ending (FAILED, CANCELLED, EXPIRED for another
 * reason, an ending that already succeeded) is never revised.
 */
export function canSettleFromLateResult(job: { status: JobStatus; reasonCode: string | null | undefined }): boolean {
  if (job.status === "WAITING" || job.status === "RUNNING" || job.status === "QUEUED") return true;
  return job.status === "EXPIRED" && job.reasonCode === "TIMED_OUT";
}

/** FR119 "completed after deadline": the job finished strictly later than its whole-job bound. */
export function isCompletedAfterDeadline(deadlineAt: Date, finishedAt: Date): boolean {
  return finishedAt.getTime() > deadlineAt.getTime();
}

/** What a job type's late-result handler returns: how the job ends, with the same meaning as a handler's own result. */
export interface LateResultOutcome {
  outcome: "SUCCEEDED" | "SUCCEEDED_WITH_LIMITS";
  reasonCode?: string;
  resultData?: unknown;
}

/**
 * A job type's handler for a vendor result that arrived after the job's own run ended (registered only in the host Lambda). It
 * must be idempotent: a job that cannot be settled (it ended another way) still gets its records handed to the handler, which
 * persists them by its own unique keys.
 */
export type JobLateResultHandler = (input: { jobId: string; input: unknown; records: unknown[] }) => Promise<LateResultOutcome>;
