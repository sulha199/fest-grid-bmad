// Story 10.1a -- the pure contract of the background-job engine (PRD 3.18 and 4.21; Architecture Spine AD-53).
// No DB, Node-only or AWS import: `apps/backend` wires the real writes and Lambda invokes into the context below,
// mirroring the `ProfileScraperAdapter` split (a pure interface here, the registry and wiring in the backend).

/** PRD 4.21 `JobStatus`. */
export const JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING",
  "SUCCEEDED",
  "SUCCEEDED_WITH_LIMITS",
  "FAILED",
  "EXPIRED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** FR130: a user job is started by a person and has an owner; a system job is started by the platform and has none. */
export const JOB_TRIGGERS = ["USER", "SYSTEM"] as const;
export type JobTrigger = (typeof JOB_TRIGGERS)[number];

/** The four endings of FR117. */
export const JOB_TERMINAL_STATUSES = ["SUCCEEDED", "SUCCEEDED_WITH_LIMITS", "FAILED", "EXPIRED"] as const;

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (JOB_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** The Lambda that starts a job type's work (decided with the owner 2026-11-08). */
export type JobHost = "scraper" | "ai-processor";

/**
 * What the API Lambda needs to start a job without importing its handler (the AI-processor's `sharp`/`face-api`
 * bundle and the scraper's vendor adapters must not reach the API bundle). Handlers are registered only inside
 * their own host Lambda (`apps/backend/src/lib/job-engine/job-registry.ts`).
 */
export interface JobTypeDefinition {
  type: string;
  host: JobHost;
  /** The bound on the WHOLE job (FR117), set as `deadlineAt` at admission. One run of a handler is capped separately. */
  maxDurationMs: number;
  /**
   * Story 10.3, FR120: when true, a job of this type started by a second user for the same input joins the first user's
   * job as a follower instead of doing the work again. The type's `resultData` is then PUBLIC by contract (it is copied to
   * every follower). Default false: a type is private to its owner unless it opts in.
   */
  sharedAcrossUsers?: boolean;
  /**
   * Story 10.3, FR122: when true, a non-terminal job of this type counts against its owner's subscription cap (the
   * account is being added and will become a subscription). Default false.
   */
  reservesSubscriptionSlot?: boolean;
  /**
   * Story 10.6: the time ONE run of this type's handler may use, instead of the environment default `JOB_ATTEMPT_DEADLINE_MS`
   * (150 s). It is still capped by the time left to the job's own deadline and by the Lambda's remaining time. A type whose run
   * needs the Lambda's whole time (the re-extract preview's face blur needs 60 s left at each image) declares it; every type that
   * declares none keeps the default.
   */
  attemptCapMs?: number;
}

const definitions = new Map<string, JobTypeDefinition>();

export function registerJobTypeDefinition(definition: JobTypeDefinition): void {
  if (definition.type.trim() === "") {
    throw new Error("A job type definition needs a non-empty type");
  }
  if (!Number.isFinite(definition.maxDurationMs) || definition.maxDurationMs <= 0) {
    throw new Error(`Job type ${definition.type}: maxDurationMs must be a positive number`);
  }
  if (definition.attemptCapMs !== undefined && (!Number.isFinite(definition.attemptCapMs) || definition.attemptCapMs <= 0)) {
    throw new Error(`Job type ${definition.type}: attemptCapMs must be a positive number`);
  }
  if (definitions.has(definition.type)) {
    throw new Error(`Job type ${definition.type} is already registered`);
  }
  definitions.set(definition.type, definition);
}

export function getJobTypeDefinition(type: string): JobTypeDefinition | undefined {
  return definitions.get(type);
}

/** Every registered definition (the backend asks which types reserve a subscription slot). */
export function listJobTypeDefinitions(): JobTypeDefinition[] {
  return [...definitions.values()];
}

/** The per-run cap for a job: the type's own `attemptCapMs`, else the default (`JOB_ATTEMPT_DEADLINE_MS`). */
export function resolveAttemptCapMs(definition: Pick<JobTypeDefinition, "attemptCapMs"> | undefined, defaultCapMs: number): number {
  return definition?.attemptCapMs ?? defaultCapMs;
}

/** The whole-job bound from the moment the job may run (`admittedAt`). */
export function computeJobDeadline(admittedAt: Date, definition: JobTypeDefinition): Date {
  return new Date(admittedAt.getTime() + definition.maxDurationMs);
}

/**
 * The time one run of a handler may use: the smallest of the per-attempt cap, the time left to the job's own
 * `deadlineAt` and, when known, the Lambda's remaining time. Never negative.
 */
export function resolveAttemptBudgetMs(input: {
  attemptCapMs: number;
  msToDeadline: number;
  lambdaRemainingMs?: number;
}): number {
  const candidates = [input.attemptCapMs, input.msToDeadline];
  if (input.lambdaRemainingMs !== undefined) {
    candidates.push(input.lambdaRemainingMs);
  }
  return Math.max(0, Math.min(...candidates));
}

/**
 * The product-visible shape of a job (PRD 4.21), the pure counterpart of a `jobs` row. Provider attempts are Story 10.2's.
 * Dates are ISO strings here; the database row carries `Date`s.
 */
export interface Job {
  id: string;
  type: string;
  /** Who started it (FR130). */
  trigger: JobTrigger;
  /** Set for a USER job, absent for a SYSTEM job. */
  ownerUserId?: string;
  /** Normalized identity of the work; the key for reuse (Story 10.3). */
  inputKey: string;
  status: JobStatus;
  /** The step the job is at while it runs (FR117). */
  phase?: string;
  reasonCode?: string;
  createdAt: string;
  finishedAt?: string;
  /** The bound on the whole job (FR117). */
  deadlineAt: string;
  /** True when a vendor result arrived after the deadline and was still used (FR119). */
  completedAfterDeadline: boolean;
}

/**
 * FR130: a USER job needs an owner, a SYSTEM job needs none. The same rule as the database CHECK
 * `jobs_user_job_has_owner`, so application code can refuse before the insert does.
 */
export function jobHasValidOwner(job: Pick<Job, 'trigger' | 'ownerUserId'>): boolean {
  return job.trigger === 'SYSTEM' || (job.ownerUserId !== undefined && job.ownerUserId !== '');
}

/** What a running handler can do. The backend supplies the real implementations. */
export interface JobHandlerContext {
  jobId: string;
  /** The job's stored input (type-specific); never a vendor token or a caption. */
  input: unknown;
  /** The phase the job was last at (a receiving Lambda resumes from it), or null on the first run. */
  phase: string | null;
  /** Time this run may still use, already capped by the attempt cap, the job deadline and the Lambda's own clock. */
  getRemainingTimeInMillis(): number;
  /**
   * Aborted when this run's time budget is used up. The job is already ended by then, so a handler must stop: pass it to
   * every vendor call and wait, or it keeps running in a frozen Lambda and resumes on the next warm invocation.
   */
  signal: AbortSignal;
  /** Records the step the job is at (FR117 "which step it is at"). */
  setPhase(phase: string): Promise<void>;
  /** Hands the job to another Lambda carrying only `{ jobId }` (AD-53 cross-Lambda hand-off). */
  handOffToLambda(functionName: string): Promise<void>;
}

export type JobHandlerResult =
  | {
      outcome: "SUCCEEDED" | "SUCCEEDED_WITH_LIMITS" | "FAILED";
      reasonCode?: string;
      /** Plain words for the Jobs page and the moderator, written by the handler (never a raw error). Story 10.6. */
      errorMessage?: string;
      resultData?: unknown;
    }
  /** Started, now waiting for a later time or for a result from elsewhere; holds no place (FR117, FR121). */
  | { outcome: "WAITING"; phase: string; waitingFor: string; resumeAt?: Date }
  /** The job continues in another Lambda; this run writes no terminal status. */
  | { outcome: "HANDED_OFF" };

export interface JobHandler {
  run(context: JobHandlerContext): Promise<JobHandlerResult>;
}
