import type { JobOutcomeKind } from "./job-presentation.js";
import { JOB_PREVIEW_APPLY_WINDOW_MS } from "./job-presentation.js";
import type { JobStatus } from "./job-engine.js";

// Story 10.4 (Part A; FR123, owner override 2026-11-13: hide-only) -- retention of the Jobs list, and what a finished job produced.

export const DEFAULT_JOBS_HISTORY_RETENTION_DAYS = 30;

/** A finished job whose `finished_at` is before this instant is no longer listed (nothing is deleted). */
export function jobHistoryCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export interface JobOutcomeView {
  kind: JobOutcomeKind;
  eventCount: number | null;
  postCount: number | null;
  previewApplyUntil: Date | null;
  previewApplied: boolean | null;
}

/**
 * What a job that ended with a result produced (a link target for the page). Only SUCCEEDED and SUCCEEDED_WITH_LIMITS have one. A preview
 * (Re-extract) can be applied until `finishedAt` plus the Apply window and says whether it was; counts are the adopters' to fill.
 */
export function deriveJobOutcome(input: {
  outcomeKind: JobOutcomeKind;
  status: JobStatus;
  finishedAt: Date | null;
  previewApplied: boolean;
}): JobOutcomeView | null {
  if ((input.status !== "SUCCEEDED" && input.status !== "SUCCEEDED_WITH_LIMITS") || input.outcomeKind === "NONE") {
    return null;
  }
  const isPreview = input.outcomeKind === "PREVIEW";
  return {
    kind: input.outcomeKind,
    eventCount: null,
    postCount: null,
    previewApplyUntil: isPreview && input.finishedAt !== null ? new Date(input.finishedAt.getTime() + JOB_PREVIEW_APPLY_WINDOW_MS) : null,
    previewApplied: isPreview ? input.previewApplied : null,
  };
}
