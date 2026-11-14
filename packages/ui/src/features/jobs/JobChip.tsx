'use client';

import React from 'react';
import { Check, CircleAlert, Clock, Hourglass, OctagonX, TriangleAlert, Ban } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { getDisplayStatus, getStepProgress } from './job-display';
import type { JobChipLabels, JobFormatters, JobProgressJob, JobProgressLabels } from './job-progress.types';

export interface JobChipProps {
  job: JobProgressJob;
  /** The job's title ("Adding @handle"), part of the accessible name. */
  title: string;
  labels: JobChipLabels;
  statusLabels: Pick<JobProgressLabels, 'status'>['status'];
  format: Pick<JobFormatters, 'time'>;
  onOpen: () => void;
  className?: string;
}

export function getChipText(job: JobProgressJob, labels: JobChipLabels, format: Pick<JobFormatters, 'time'>): string {
  const status = getDisplayStatus(job);
  switch (status) {
    case 'QUEUED':
      return job.queue ? labels.queued(job.queue.position) : labels.waiting;
    case 'RUNNING': {
      const p = getStepProgress(job);
      return p ? labels.running(p.current, p.total) : labels.runningNoSteps;
    }
    case 'WAITING':
      return job.waiting?.resumeAt ? labels.waitingUntil(format.time(job.waiting.resumeAt)) : labels.waiting;
    case 'SUCCEEDED':
      return labels.done;
    case 'SUCCEEDED_WITH_LIMITS':
      return labels.doneWithLimits;
    case 'FAILED':
      return labels.failed;
    case 'EXPIRED':
      return labels.expired;
    case 'CANCELLED':
      return labels.cancelled;
  }
}

const ICONS = { QUEUED: Clock, WAITING: Hourglass, SUCCEEDED: Check, SUCCEEDED_WITH_LIMITS: TriangleAlert, FAILED: OctagonX, EXPIRED: CircleAlert, CANCELLED: Ban } as const;

/** The minimized indicator, in flow where the action started (never fixed or floating). */
export const JobChip = React.forwardRef<HTMLButtonElement, JobChipProps>(function JobChip({ job, title, labels, statusLabels, format, onOpen, className }, ref) {
  const reduced = usePrefersReducedMotion();
  const status = getDisplayStatus(job);
  const text = getChipText(job, labels, format);
  const Icon = status === 'RUNNING' ? null : ICONS[status];
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label={labels.ariaLabel(title, statusLabels[status])}
      data-testid="job-chip"
      data-status={status}
      className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${className ?? ''}`}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : reduced ? (
        <span aria-hidden="true" data-testid="job-chip-static-dot" className="h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
      ) : (
        <span aria-hidden="true" data-testid="job-chip-spinner" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      )}
      <span className="min-w-0 truncate">{text}</span>
    </button>
  );
});
