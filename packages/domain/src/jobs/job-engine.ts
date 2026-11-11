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

/**
 * FR121: only a RUNNING job holds one of a user's places. A QUEUED job (waiting for a place) and a WAITING job
 * (waiting for a later time or for a result from elsewhere) hold none.
 */
export function isPlaceHoldingJobStatus(status: JobStatus): boolean {
  return status === "RUNNING";
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
}

const definitions = new Map<string, JobTypeDefinition>();

export function registerJobTypeDefinition(definition: JobTypeDefinition): void {
  if (definition.type.trim() === "") {
    throw new Error("A job type definition needs a non-empty type");
  }
  if (!Number.isFinite(definition.maxDurationMs) || definition.maxDurationMs <= 0) {
    throw new Error(`Job type ${definition.type}: maxDurationMs must be a positive number`);
  }
  if (definitions.has(definition.type)) {
    throw new Error(`Job type ${definition.type} is already registered`);
  }
  definitions.set(definition.type, definition);
}

export function getJobTypeDefinition(type: string): JobTypeDefinition | undefined {
  return definitions.get(type);
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

/** What a running handler can do. The backend supplies the real implementations. */
export interface JobHandlerContext {
  jobId: string;
  /** The job's stored input (type-specific); never a vendor token or a caption. */
  input: unknown;
  /** The phase the job was last at (a receiving Lambda resumes from it), or null on the first run. */
  phase: string | null;
  /** Time this run may still use, already capped by the attempt cap, the job deadline and the Lambda's own clock. */
  getRemainingTimeInMillis(): number;
  /** Records the step the job is at (FR117 "which step it is at"). */
  setPhase(phase: string): Promise<void>;
  /** Hands the job to another Lambda carrying only `{ jobId }` (AD-53 cross-Lambda hand-off). */
  handOffToLambda(functionName: string): Promise<void>;
}

export type JobHandlerResult =
  | {
      outcome: "SUCCEEDED" | "SUCCEEDED_WITH_LIMITS" | "FAILED";
      reasonCode?: string;
      resultData?: unknown;
    }
  /** Started, now waiting for a later time or for a result from elsewhere; holds no place (FR117, FR121). */
  | { outcome: "WAITING"; phase: string; waitingFor: string; resumeAt?: Date }
  /** The job continues in another Lambda; this run writes no terminal status. */
  | { outcome: "HANDED_OFF" };

export interface JobHandler {
  run(context: JobHandlerContext): Promise<JobHandlerResult>;
}
