import type { JobProgressJob } from '@festgrid/ui';
import type { JobListFieldsFragment, JobProgressFieldsFragment } from '@/generated/graphql';

const iso = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** The generated fragment (DateTime is `unknown`) as the plain-string shape `packages/ui` takes. */
export function toJobProgressJob(job: JobProgressFieldsFragment): JobProgressJob {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    isCancelled: job.isCancelled,
    reasonCode: job.reasonCode,
    reasonRetryAfter: iso(job.reasonRetryAfter),
    reasonQueueMaxWaitMinutes: job.reasonQueueMaxWaitMinutes,
    startedAt: iso(job.startedAt),
    finishedAt: iso(job.finishedAt),
    createdAt: String(job.createdAt),
    completedAfterDeadline: job.completedAfterDeadline,
    steps: job.steps.map((s) => ({ key: s.key, state: s.state, done: s.done, total: s.total })),
    queue: job.queue ? { position: job.queue.position, maxConcurrent: job.queue.maxConcurrent, expiresAt: String(job.queue.expiresAt) } : null,
    waiting: job.waiting ? { waitingFor: job.waiting.waitingFor, resumeAt: iso(job.waiting.resumeAt), done: job.waiting.done, total: job.waiting.total } : null,
    outcome: job.outcome ? { kind: job.outcome.kind, eventCount: job.outcome.eventCount, postCount: job.outcome.postCount } : null,
    canRetry: job.canRetry,
    retryNotBefore: iso(job.retryNotBefore),
  };
}

/** What a Jobs list row needs beside the progress shape: who started it (moderators only) and how, plus what it is about. */
export interface JobListItem extends JobProgressJob {
  trigger: string;
  owner: { displayName: string | null } | null;
  subject: JobListFieldsFragment['subject'];
}

/** The list fragment as a row item. `owner` is null for everyone but a moderator (the server does no owner work otherwise). */
export function toJobListItem(job: JobListFieldsFragment): JobListItem {
  return { ...toJobProgressJob(job), trigger: job.trigger, owner: job.owner ?? null, subject: job.subject };
}
