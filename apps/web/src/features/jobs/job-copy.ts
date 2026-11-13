import { getDisplayStatus, getJobSignature, getStepProgress, type JobProgressJob } from '@festgrid/ui';

/** A next-intl-like translator reduced to what the pure copy helpers need (so they are tested without React). */
export interface JobTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

export interface JobSubjectLike {
  kind: string;
  username?: string | null;
  postCount?: number | null;
  postCode?: string | null;
}

export const REASON_FALLBACK = 'GENERIC';
const DEFAULT_QUEUE_MAX_WAIT_MINUTES = 30;

/** Reason text from the reason CODE; an unknown code reads as GENERIC. Never the engine's message. */
export function reasonText(tr: JobTranslator, code: string | null | undefined, params: { time?: string; minutes?: number }): string {
  const key = code && tr.has(`reason.${code}`) ? code : REASON_FALLBACK;
  return tr(`reason.${key}`, { time: params.time ?? '', minutes: params.minutes ?? DEFAULT_QUEUE_MAX_WAIT_MINUTES });
}

/** The label of a step: `phase.<TYPE>.<key>`; a type or key not in the copy reads as the generic "Working on it". */
export function phaseText(tr: JobTranslator, jobType: string, key: string): string {
  const specific = `phase.${jobType}.${key}`;
  return tr.has(specific) ? tr(specific) : tr('phase.generic.working');
}

export function subjectText(tr: JobTranslator, subject: JobSubjectLike | null | undefined): string | null {
  if (!subject) return null;
  if (subject.kind === 'ACCOUNT' && subject.username) return tr('subject.account', { handle: subject.username });
  if (subject.kind === 'POSTS' && typeof subject.postCount === 'number') return tr('subject.posts', { count: subject.postCount });
  if (subject.kind === 'POST' && subject.postCode) return tr('subject.post', { code: subject.postCode });
  return null;
}

/** "Adding an account: @handle". A type with no label (OTHER, or one not yet in the copy) reads as the generic "Working on it". */
export function buildJobTitle(tr: JobTranslator, type: string, subject?: JobSubjectLike | null): string {
  const typeLabel = tr.has(`type.${type}`) ? tr(`type.${type}`) : tr('type.OTHER');
  const subjectLabel = subjectText(tr, subject);
  return subjectLabel ? `${typeLabel}: ${subjectLabel}` : typeLabel;
}

/**
 * The sentence the announcer speaks for a job's current state. `first` is the user's own start (a RUNNING job then
 * reads "started"). The queue position is spoken only on entering the queue; later changes are not signatures.
 */
export function buildJobAnnouncement(tr: JobTranslator, job: JobProgressJob, title: string, formatTime: (iso: string) => string, first = false): string {
  const status = getDisplayStatus(job);
  const reason = () => reasonText(tr, job.reasonCode, { time: (job.reasonRetryAfter ?? job.retryNotBefore) ? formatTime((job.reasonRetryAfter ?? job.retryNotBefore) as string) : undefined, minutes: job.reasonQueueMaxWaitMinutes ?? undefined });
  switch (status) {
    case 'QUEUED':
      return tr('announce.queued', { title, position: job.queue ? tr('row.queuePosition', { position: job.queue.position }) : '' }).trim();
    case 'RUNNING': {
      const p = getStepProgress(job);
      const current = job.steps.find((s) => s.state === 'CURRENT');
      if (first || !p || !current) return tr(first ? 'announce.started' : 'announce.running', { title });
      return tr('announce.step', { title, current: p.current, total: p.total, step: phaseText(tr, job.type, current.key) });
    }
    case 'WAITING':
      return tr('announce.waiting', { title, reason: waitingReason(tr, job, formatTime) }).trim();
    case 'SUCCEEDED':
      return tr('announce.succeeded', { title });
    case 'SUCCEEDED_WITH_LIMITS':
      return tr('announce.limits', { title, reason: reason() });
    case 'FAILED':
      return tr('announce.failed', { title, reason: reason() });
    case 'EXPIRED':
      return tr('announce.expired', { title, reason: reason() });
    case 'CANCELLED':
      return tr('announce.cancelled', { title });
  }
}

function waitingReason(tr: JobTranslator, job: JobProgressJob, formatTime: (iso: string) => string): string {
  const w = job.waiting;
  if (w?.waitingFor === 'RETRY_AT' && w.resumeAt) return tr('waiting.retryAt', { time: formatTime(w.resumeAt) });
  if (w?.waitingFor === 'EXTRACTION_QUEUE' && typeof w.total === 'number') return tr('waiting.extraction', { done: w.done ?? 0, total: w.total });
  return tr('waiting.result');
}

export { getJobSignature };
