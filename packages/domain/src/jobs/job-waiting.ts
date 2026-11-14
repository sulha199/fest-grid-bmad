import type { JobStatus } from "./job-engine.js";

// Story 10.4 (Part A; decision 16) -- what a WAITING job waits for. The engine does not store which kind of wait a handler asked for, so
// the read side tells them apart by `resume_at`: a scheduled retry has one, a result on its way (a follower of another user's job, a
// vendor snapshot still running) has none. `EXTRACTION_QUEUE` is in the enum for Story 10.12a and is not produced here.

export type JobWaitingFor = "RETRY_AT" | "RESULT_FROM_PROVIDER" | "EXTRACTION_QUEUE";

export interface JobWaitingView {
  waitingFor: JobWaitingFor;
  resumeAt: Date | null;
  done: number | null;
  total: number | null;
}

export function deriveJobWaiting(input: { status: JobStatus; resumeAt: Date | null }): JobWaitingView | null {
  if (input.status !== "WAITING") {
    return null;
  }
  return input.resumeAt === null
    ? { waitingFor: "RESULT_FROM_PROVIDER", resumeAt: null, done: null, total: null }
    : { waitingFor: "RETRY_AT", resumeAt: input.resumeAt, done: null, total: null };
}
