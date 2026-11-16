// Story 10.3 -- the pure admission rules of the job engine (PRD 3.18 FR121; Architecture Spine AD-53).
// No DB, Node-only or AWS import: `apps/backend/src/lib/job-engine/admit-job.ts` counts the rows and applies these rules.

import type { JobStatus } from "./job-engine.js";

/**
 * FR120: the `phase` of a follower (a job that joined another user's job instead of doing the work). The database row
 * keeps `leader_job_id` while the leader exists; this phase also tells the sweep "this WAITING job has no work of its own"
 * after the leader's row was deleted (`leader_job_id` set null), so it is settled rather than re-admitted as a real job.
 */
export const FOLLOWER_PHASE = "following-leader";

/**
 * FR121: a job holds one of its owner's places from ADMISSION until it ends or goes WAITING. An admitted job that no
 * worker has claimed yet counts, otherwise simultaneous starts would all see zero running. A QUEUED job that has not
 * been admitted (it is waiting for a place) and a WAITING job hold none.
 */
export function holdsPlace(job: { status: JobStatus; admittedAt: Date | null | undefined }): boolean {
  return (job.status === "QUEUED" || job.status === "RUNNING") && job.admittedAt != null;
}

/** Places still free for a user; never negative (a lowered limit can leave a user above it). */
export function freePlaces(input: { placesHeld: number; maxPlaces: number }): number {
  return Math.max(0, input.maxPlaces - input.placesHeld);
}

export type AdmissionDecision =
  | { decision: "ADMIT" }
  | { decision: "QUEUE"; position: number }
  | { decision: "REFUSE_QUEUE_FULL" };

/**
 * What happens to a NEW start. It is admitted only when a place is free AND nobody is waiting (the queue is oldest
 * first, a newcomer never jumps it); otherwise it joins the queue, unless the queue is full. `position` is 1-based.
 */
export function decideAdmission(input: {
  placesHeld: number;
  queued: number;
  maxPlaces: number;
  maxQueued: number;
}): AdmissionDecision {
  if (freePlaces(input) > 0 && input.queued === 0) {
    return { decision: "ADMIT" };
  }
  if (input.queued >= input.maxQueued) {
    return { decision: "REFUSE_QUEUE_FULL" };
  }
  return { decision: "QUEUE", position: input.queued + 1 };
}

export interface QueuedJobRef {
  id: string;
  queuedSince: Date;
}

/** Queue order: oldest `queuedSince` first, then the smaller id (a stable tie-break). */
export function compareQueueOrder(a: QueuedJobRef, b: QueuedJobRef): number {
  const byTime = a.queuedSince.getTime() - b.queuedSince.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

/** 1-based place of a job in its owner's queue, or null when it is not queued. Story 10.4 shows it to the user. */
export function queuePosition(jobId: string, queued: readonly QueuedJobRef[]): number | null {
  const ordered = [...queued].sort(compareQueueOrder);
  const index = ordered.findIndex((job) => job.id === jobId);
  return index === -1 ? null : index + 1;
}
