'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { JobProgressHost } from '@/features/jobs/job-progress-host';
import { useJobProgress } from '@/features/jobs/use-job-progress';
import { ReextractJobResult } from './reextract-job-result';
import { JobRetryFailureNotice } from '@/features/jobs/job-retry-failure-notice';
import type { JobProgressJob } from '@festgrid/ui';

/**
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry) -- "Open the preview" on a Re-extract job's detail page: the same
 * dialog as the source-post row, attached to THIS job id (no new job, no restart), opened at the result. Moderator-only caller; a preview that is not
 * the moderator's own reads "This preview is not available to you." in the dialog (the read is owner-scoped).
 */
export function OpenReextractPreview({ jobId }: { jobId: string }) {
  const t = useTranslations('Jobs');
  const controller = useJobProgress();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { attach } = controller;

  // Follow the job by its id (the shared read; an ended job is read once), so the first tap can open the dialog with the job in hand.
  useEffect(() => {
    attach(jobId);
  }, [attach, jobId]);

  const renderEndedBody = (job: JobProgressJob) =>
    job.status === 'SUCCEEDED' || job.status === 'SUCCEEDED_WITH_LIMITS' ? (
      <ReextractJobResult
        key={job.id}
        job={job}
        onRetry={() => void controller.retry()}
        retryPending={controller.retryPending}
        notice={controller.retryFailure ? <JobRetryFailureNotice failure={controller.retryFailure} /> : null}
      />
    ) : null;

  return (
    <>
      <Button ref={triggerRef} type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => controller.openDialog('jobs_page')} data-testid="job-open-preview">
        {t('outcome.openPreview')}
      </Button>
      {/* The chip is the source-post row's way back to a job; this page has the button, so no chip here. */}
      <JobProgressHost controller={{ ...controller, chipVisible: false }} returnFocusRef={triggerRef} renderEndedBody={renderEndedBody} dialogSize="wide" />
    </>
  );
}
