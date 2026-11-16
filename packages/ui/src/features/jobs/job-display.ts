import type { JobDisplayStatus, JobProgressJob, JobProgressStep } from './job-progress.types';

export const JOB_OPEN_STATUSES = ['QUEUED', 'RUNNING', 'WAITING'] as const;

export function isJobOpen(job: Pick<JobProgressJob, 'status'>): boolean {
  return job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'WAITING';
}

export function getDisplayStatus(job: Pick<JobProgressJob, 'status' | 'isCancelled'>): JobDisplayStatus {
  return job.status === 'FAILED' && job.isCancelled ? 'CANCELLED' : job.status;
}

/**
 * The steps to draw. A job type that declares none shows one generic step ("working") so the stepper never
 * disappears; its state follows the job's status.
 */
export function resolveSteps(job: Pick<JobProgressJob, 'status' | 'steps'>): JobProgressStep[] {
  if (job.steps.length > 0) return [...job.steps];
  const state: JobProgressStep['state'] =
    job.status === 'QUEUED' ? 'PENDING' : job.status === 'SUCCEEDED' || job.status === 'SUCCEEDED_WITH_LIMITS' ? 'DONE' : 'CURRENT';
  return [{ key: 'working', state }];
}

/** "Step 2 of 3": the 1-based position of the current step and the step count; null when no step is current. */
export function getStepProgress(job: Pick<JobProgressJob, 'status' | 'steps'>): { current: number; total: number } | null {
  const steps = resolveSteps(job);
  const index = steps.findIndex((s) => s.state === 'CURRENT');
  if (index === -1) return null;
  return { current: index + 1, total: steps.length };
}

/** The signature the announcer compares: it changes with the status and, while running, with the current step. */
export function getJobSignature(job: Pick<JobProgressJob, 'status' | 'isCancelled' | 'steps'>): string {
  const current = job.steps.find((s) => s.state === 'CURRENT');
  return `${getDisplayStatus(job)}|${job.status === 'RUNNING' ? (current?.key ?? '') : ''}`;
}

/** True when a step stopped the job: an unhappy ending keeps its stopped step as CURRENT (the enum has no failed state). */
export function isStoppedStep(job: Pick<JobProgressJob, 'status'>, step: JobProgressStep): boolean {
  return step.state === 'CURRENT' && (job.status === 'FAILED' || job.status === 'EXPIRED');
}
