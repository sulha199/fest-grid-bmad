'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { JobStatusBadge, SubscribedAccountCard, getDisplayStatus, type JobFormatters, type JobProgressLabels } from '@festgrid/ui';
import { Link } from '@/i18n/navigation';
import { subjectText, type JobTranslator } from '@/features/jobs/job-copy';
import type { JobListItem } from '@/features/jobs/job-model';

export interface JobRowProps {
  job: JobListItem;
  /** "Adding an account: @handle", built by the page so the row's link name and the dialog title read the same. */
  title: string;
  typeLabel: string;
  statusLabels: JobProgressLabels['status'];
  format: JobFormatters;
  tr: JobTranslator;
  /** `Date.now()` for "Running for". */
  now: number;
  /** Moderators see "Started by {name}" or "System job"; ordinary users never. */
  showOwner: boolean;
  onOpen?: (job: JobListItem) => void;
}

/** The row's fixed height class: the skeleton row uses the same one so the page does not jump when data arrives. */
export const JOB_ROW_MIN_HEIGHT = 'min-h-[7.5rem]';

/**
 * One job as a link to its page. The whole row is the link (no nested control), so an account row's `SubscribedAccountCard` gets no
 * `accountHref` and no subscribe toggle.
 */
export function JobRow({ job, title, typeLabel, statusLabels, format, tr, now, showOwner, onOpen }: JobRowProps) {
  const t = useTranslations('Jobs');
  const status = getDisplayStatus(job);
  const subject = job.subject;
  const startMs = job.startedAt ? new Date(job.startedAt).getTime() : NaN;
  const endMs = job.finishedAt ? new Date(job.finishedAt).getTime() : NaN;
  const tookMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : null;
  const runningMs = job.status === 'RUNNING' && Number.isFinite(startMs) ? Math.max(0, now - startMs) : null;

  const meta: string[] = [t('row.startedAt', { time: format.time(job.startedAt ?? job.createdAt) })];
  if (runningMs !== null) meta.push(t('row.runningFor', { duration: format.duration(runningMs) }));
  if (tookMs !== null) meta.push(t('row.tookDuration', { duration: format.duration(tookMs) }));
  if (job.status === 'QUEUED' && job.queue) meta.push(t('row.queuePosition', { position: job.queue.position }));
  if (job.status === 'WAITING' && job.waiting?.resumeAt) meta.push(t('row.nextTry', { time: format.time(job.waiting.resumeAt) }));

  let ownerLine: string | null = null;
  if (showOwner) {
    if (job.trigger === 'SYSTEM') ownerLine = t('row.systemJob');
    else if (job.owner?.displayName) ownerLine = t('row.startedBy', { name: job.owner.displayName });
  }

  const isAccount = subject.kind === 'ACCOUNT' && !!subject.accountId;
  const plainSubject = isAccount ? null : subjectText(tr, subject);

  return (
    <Link
      href={`/jobs/${job.id}`}
      aria-label={t('row.openDetails', { title, status: statusLabels[status] })}
      onClick={() => onOpen?.(job)}
      data-testid="job-row"
      data-job-id={job.id}
      data-status={status}
      className={`block min-w-0 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${JOB_ROW_MIN_HEIGHT}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <JobStatusBadge status={status} label={statusLabels[status]} />
        <span className="min-w-0 break-words font-medium">{typeLabel}</span>
      </div>
      {isAccount && (
        <div className="mt-2 min-w-0">
          <SubscribedAccountCard
            account={{
              accountId: subject.accountId as string,
              platform: subject.platform,
              displayName: subject.displayName,
              username: subject.username,
              profileImageUrl: subject.profileImageUrl,
            }}
            labels={{ unknownAccountLabel: t('subject.unknown') }}
            isSubscribed={false}
            variant="list"
            showPlatformBadge
            size="sm"
          />
        </div>
      )}
      {plainSubject && <p className="mt-2 min-w-0 break-words text-sm">{plainSubject}</p>}
      <p className="mt-2 min-w-0 break-words text-xs text-muted-foreground">{meta.join(' · ')}</p>
      {ownerLine && <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">{ownerLine}</p>}
    </Link>
  );
}

/** Loading rows with the real row's minimum height, so the page does not jump when the data arrives. */
export function JobRowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true" data-testid="jobs-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`animate-pulse space-y-3 rounded-xl border border-border bg-card p-4 ${JOB_ROW_MIN_HEIGHT}`}>
          <div className="flex items-center gap-2">
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="h-5 w-1/3 rounded bg-muted" />
          </div>
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
