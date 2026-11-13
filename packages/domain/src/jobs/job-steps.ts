import { isTerminalJobStatus, type JobStatus } from "./job-engine.js";
import type { JobStepFacts, JobTypePresentation } from "./job-presentation.js";

// Story 10.4 (Part A; graphql-read-shape.md note 1) -- the server builds the ordered steps from the type's phase list and the job's `phase`,
// so the client holds no per-type phase logic.

export type JobStepState = "DONE" | "CURRENT" | "PENDING" | "SKIPPED";

export interface JobStepView {
  key: string;
  state: JobStepState;
  /** A counting step ("3 of 8 finished"); null when the step does not count. */
  done: number | null;
  total: number | null;
}

/**
 * The steps of a job. A skipped step is SKIPPED whatever else is true. While the job is open the step named by `phase` is CURRENT, the
 * ones before it DONE and the ones after PENDING (a QUEUED job has started nothing: all PENDING). A SUCCEEDED job shows every step DONE.
 * A job that ended unhappily keeps the step it stopped at as CURRENT (the enum has no failed-step state; the client draws a stopped
 * marker from the job's status); one that never started (`hasStarted` false, for example dropped from the queue) shows all PENDING.
 */
export function deriveJobSteps(input: {
  presentation: Pick<JobTypePresentation, "phases" | "skippedPhases">;
  status: JobStatus;
  phase: string | null;
  hasStarted: boolean;
  facts: JobStepFacts;
}): JobStepView[] {
  const { phases } = input.presentation;
  const skipped = new Set(input.presentation.skippedPhases?.(input.facts) ?? []);
  const step = (key: string, state: JobStepState): JobStepView => ({ key, state: skipped.has(key) ? "SKIPPED" : state, done: null, total: null });

  if (input.status === "SUCCEEDED" || input.status === "SUCCEEDED_WITH_LIMITS") {
    return phases.map((key) => step(key, "DONE"));
  }
  const open = !isTerminalJobStatus(input.status);
  const started = open ? input.status !== "QUEUED" : input.hasStarted;
  if (!started) {
    return phases.map((key) => step(key, "PENDING"));
  }
  const phaseIndex = input.phase === null ? -1 : phases.indexOf(input.phase);
  // A started job with no (or an unknown) phase is at its first step that was not skipped.
  const currentIndex = phaseIndex !== -1 ? phaseIndex : Math.max(0, phases.findIndex((key) => !skipped.has(key)));
  return phases.map((key, index) => step(key, index < currentIndex ? "DONE" : index === currentIndex ? "CURRENT" : "PENDING"));
}
