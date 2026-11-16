'use client';

import React, { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { buildAccountHref } from '@festgrid/domain/scraper';
import { JobChip, JobProgressDialog, JobProgressView, useJobClock, isJobOpen, type JobChipLabels, type JobProgressJob } from '@festgrid/ui';
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
  /** An override seam only: a Retry refused with SUBSCRIPTION_CAP_REACHED renders the real cap notice of Story 10.3a (show the subscription cap refusal and the upgrade call to action) by default. */
  renderCapNotice?: (failure: Extract<JobStartFailure, { kind: 'cap' }>) => React.ReactNode;
  /**
   * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): a non-null node replaces the progress view in the dialog
   * body of an ENDED job (Re-extract draws its preview result here). Return null to keep the shared view (Failed, Expired and Cancelled keep
   * their box and Retry). Never called while the job is open. A host that passes none behaves as in Story 10.4.
   */
  renderEndedBody?: (job: JobProgressJob, subject: JobSubjectView | undefined) => React.ReactNode | null;
  /** `wide` makes the dialog `sm:max-w-2xl` (a result that needs room). Default: the narrow progress dialog. */
  dialogSize?: 'default' | 'wide';
  /** Overrides of single chip texts (Re-extract: "Preview ready" for the ended chip). Anything not given keeps the shared Jobs copy. */
  chipLabels?: Partial<JobChipLabels>;
  className?: string;
}

/**
 * Story 10.4 Part B -- renders the chip (in flow, where the host is mounted) and the progress dialog for one
 * controller. apps/web owns data and copy; packages/ui owns the pictures.
 */
export function JobProgressHost({ controller, returnFocusRef, renderResultAction, renderCapNotice, renderEndedBody, dialogSize = 'default', chipLabels: chipLabelOverrides, className }: JobProgressHostProps) {
  const t = useTranslations('Jobs');
  const { labels, chipLabels: sharedChipLabels, format } = useJobLabels();
  const chipLabels = chipLabelOverrides ? { ...sharedChipLabels, ...chipLabelOverrides } : sharedChipLabels;
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
  const notice = failure ? <JobRetryFailureNotice failure={failure} renderCapNotice={renderCapNotice} accountId={subject?.accountId} username={subject?.username} /> : null;

  const endedBody = job && ended && state === 'ready' && renderEndedBody ? renderEndedBody(job, subject) : null;
  const viewState = state === 'idle' ? 'loading' : state;
  const body = endedBody ?? (
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
  );
  return (
    <>
      {/* min-w-0 and max-w-full: as a flex item the chip's box may shrink to its row and the label truncates, so a long label never widens a 320 px dialog. */}
      {controller.chipVisible && job && (
        <span className={className ? `min-w-0 max-w-full ${className}` : 'min-w-0 max-w-full'}>
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
        size={dialogSize}
        footerLinks={
          <Link href="/jobs" className="inline-flex min-h-11 items-center justify-center text-sm font-medium underline" data-testid="job-see-all">
            {t('dialog.seeAllInJobs')}
          </Link>
        }
      >
        {body}
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
