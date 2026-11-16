import React from 'react';
import { Ban, Check, CircleAlert, Clock, Hourglass, Loader2, OctagonX, TriangleAlert } from 'lucide-react';
import { StatusBadge, type StatusBadgeProps } from '../../core/status-badge';
import type { JobDisplayStatus } from './job-progress.types';

/** The mapping of a job status onto the existing StatusBadge variants (no new colour tokens). */
export const JOB_STATUS_VARIANT: Record<JobDisplayStatus, StatusBadgeProps['variant']> = {
  QUEUED: 'queued',
  RUNNING: 'extracting',
  WAITING: 'pending',
  SUCCEEDED: 'active',
  SUCCEEDED_WITH_LIMITS: 'lowConfidence',
  FAILED: 'attemptFailed',
  EXPIRED: 'expired',
  CANCELLED: 'notEvent',
};

const ICONS = {
  QUEUED: Clock,
  RUNNING: Loader2,
  WAITING: Hourglass,
  SUCCEEDED: Check,
  SUCCEEDED_WITH_LIMITS: TriangleAlert,
  FAILED: OctagonX,
  EXPIRED: CircleAlert,
  CANCELLED: Ban,
} as const;

export interface JobStatusBadgeProps {
  status: JobDisplayStatus;
  /** The visible text. Colour and icon are never the only cue. */
  label: string;
}

export function JobStatusBadge({ status, label }: JobStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <span className="inline-flex items-center gap-1" data-testid="job-status-badge" data-status={status}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <StatusBadge variant={JOB_STATUS_VARIANT[status]} label={label} />
    </span>
  );
}
