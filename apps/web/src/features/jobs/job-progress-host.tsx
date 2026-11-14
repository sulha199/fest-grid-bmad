'use client';

import React, { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { buildAccountHref } from '@festgrid/domain/scraper';
import { JobChip, JobProgressDialog, JobProgressView, useJobClock, isJobOpen, type JobProgressJob } from '@festgrid/ui';
import { Link } from '@/i18n/navigation';
import type { JobProgressController } from './use-job-progress';
import type { JobSubjectView } from './use-jobs';
import type { JobStartFailure } from './job-start-error';
import { JobRetryFailureNotice } from './job-retry-failure-notice';
import { useJobLabels } from './use-job-labels';

export interface JobProgressHostProps {
  controller: JobProgressController;
  /** Focus goes here when an ENDED job's dialog closes (the control that started the action). Falls back to the page's h1. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** The result link of a finished job. Default: "Open the account" for an account result. A slot for the "Open the preview" link of Story 10.6a (Re-extract progress, missing-images banner and Retry). */
  renderResultAction?: (job: JobProgressJob, subject: JobSubjectView | undefined) => React.ReactNode;
  /** The cap notice of Story 10.3a (show the subscription cap refusal and the upgrade call to action) renders here when a Retry is refused with SUBSCRIPTION_CAP_REACHED. */
  renderCapNotice?: (failure: Extract<JobStartFailure, { kind: 'cap' }>) => React.ReactNode;
  className?: string;
}

/**
 * Story 10.4 Part B -- renders the chip (in flow, where the host is mounted) and the progress dialog for one
 * controller. apps/web owns data and copy; packages/ui owns the pictures.
 */
export function JobProgressHost({ controller, returnFocusRef, renderResultAction, renderCapNotice, className }: JobProgressHostProps) {
  const t = useTranslations('Jobs');
  const { labels, chipLabels, format } = useJobLabels();
  const chipRef = useRef<HTMLButtonElement>(null);
  const { job, subject, state, dialogOpen } = controller;
  const ended = job ? !isJobOpen(job) : false;
  const now = useJobClock(dialogOpen && job?.status === 'RUNNING');

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      // Minimize: the chip is rendered in the same step, so focus follows the work. Close: back to the control that started it.
      const target = chipRef.current ?? returnFocusRef?.current ?? (document.querySelector('h1') as HTMLElement | null);
      if (target) {
        if (!target.hasAttribute('tabindex') && target.tagName === 'H1') target.setAttribute('tabindex', '-1');
        target.focus();
      }
    },
    [returnFocusRef]
  );

  const resultAction = job ? (renderResultAction ? renderResultAction(job, subject) : defaultResultAction(job, subject, t('outcome.openAccount'))) : null;
  const failure = controller.retryFailure;
  const notice = failure ? <JobRetryFailureNotice failure={failure} renderCapNotice={renderCapNotice} /> : null;

  const viewState = state === 'idle' ? 'loading' : state;
  return (
    <>
      {controller.chipVisible && job && (
        <span className={className}>
          <JobChip ref={chipRef} job={job} title={controller.title} labels={chipLabels} statusLabels={labels.status} format={format} onOpen={() => controller.openDialog('chip')} />
        </span>
      )}
      <JobProgressDialog
        open={dialogOpen}
        ended={ended}
        title={controller.title || t('pageTitle')}
        labels={{ description: t('dialog.description'), minimize: t('dialog.minimize'), close: t('dialog.close') }}
        onMinimize={controller.minimize}
        onClose={controller.closeEnded}
        onCloseAutoFocus={onCloseAutoFocus}
        footerLinks={
          <Link href="/jobs" className="inline-flex min-h-11 items-center justify-center text-sm font-medium underline" data-testid="job-see-all">
            {t('dialog.seeAllInJobs')}
          </Link>
        }
      >
        <JobProgressView
          state={viewState}
          job={job}
          labels={labels}
          format={format}
          form="dialog"
          now={now}
          reconnecting={controller.reconnecting}
          onRetryLoad={controller.refetch}
          onRetry={controller.retry}
          retryPending={controller.retryPending}
          resultAction={resultAction}
          notice={notice}
          notFoundAction={
            <Link href="/jobs" className="text-sm font-medium underline">
              {t('backToJobs')}
            </Link>
          }
        />
      </JobProgressDialog>
    </>
  );
}

export function defaultResultAction(job: JobProgressJob, subject: JobSubjectView | undefined, label: string): React.ReactNode {
  if (job.outcome?.kind !== 'ACCOUNT' || !subject?.platform || !subject.username) return null;
  const href = buildAccountHref(subject.platform as Parameters<typeof buildAccountHref>[0], subject.username);
  if (!href) return null;
  return (
    <Link href={href} className="inline-flex min-h-11 items-center justify-center text-sm font-medium underline" data-testid="job-result-link">
      {label}
    </Link>
  );
}
