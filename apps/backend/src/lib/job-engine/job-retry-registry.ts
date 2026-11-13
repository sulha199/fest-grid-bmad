import type { StartJobResult } from './start-job.js';

// Story 10.4 (AC8, Dev Notes decision 6; AD-53) -- the per-type retry-starter registry, API Lambda side. A Retry starts a NEW job for the
// same input through that type's OWN start path, so reuse, admission, cooldown, the subscription cap and the slot rules stay exactly
// as they are and are never re-derived here. Each adoption story registers its own starter next to its start function; a type with
// none is not retryable (`canRetry` false), so the button never shows for a type whose start path is unknown. This file imports no
// handler (the AI-processor's image runtime and the scraper's vendor adapters must not reach the API bundle).

export type JobRetryStartResult =
  | { outcome: 'STARTED' | 'REUSED'; jobId: string }
  | {
      outcome: 'REFUSED';
      errorCode: 'JOB_QUEUE_FULL' | 'SUBSCRIPTION_CAP_REACHED' | 'JOB_START_FAILED';
      details?: { activeCount: number; reservedCount: number; cap: number };
    };

export interface JobRetryStarterContext {
  ownerUserId: string;
  /** The old job's stored input, held caption (`held`) already removed. */
  input: unknown;
  inputKey: string;
}

export interface JobRetryStarter {
  /** True when the type's own start path is moderator-only: retry then needs the owner to still be a moderator. */
  moderatorOnly?: boolean;
  start(context: JobRetryStarterContext): Promise<JobRetryStartResult>;
}

const starters = new Map<string, JobRetryStarter>();

/** Registering a type twice replaces nothing and is a no-op (a bundle that evaluates its registration twice must not throw). */
export function registerJobRetryStarter(type: string, starter: JobRetryStarter): boolean {
  if (starters.has(type)) return false;
  starters.set(type, starter);
  return true;
}

export function getJobRetryStarter(type: string): JobRetryStarter | undefined {
  return starters.get(type);
}

/** Whether a user with this role could retry a job of this type at all (a starter exists and its start path admits the role). */
export function hasJobRetryStarter(type: string, role: 'user' | 'moderator'): boolean {
  const starter = starters.get(type);
  return starter !== undefined && (!starter.moderatorOnly || role === 'moderator');
}

/** The shared mapping from the engine's start answer: QUEUED and SHARED are a started job, REUSED is the one re-attached to. */
export function toJobRetryStartResult(result: StartJobResult): JobRetryStartResult {
  if ('errorCode' in result) {
    return { outcome: 'REFUSED', errorCode: result.errorCode, details: result.details };
  }
  return { outcome: result.outcome === 'REUSED' ? 'REUSED' : 'STARTED', jobId: result.jobId };
}
