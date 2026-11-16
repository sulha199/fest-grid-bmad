'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { JobProgressJob } from '@festgrid/ui';
import { JobProgressHost } from '@/features/jobs/job-progress-host';
import { JobRetryFailureNotice } from '@/features/jobs/job-retry-failure-notice';
import type { JobStartFailure } from '@/features/jobs/job-start-error';
import { useJobProgress } from '@/features/jobs/use-job-progress';
import type { JobSubjectView } from '@/features/jobs/use-jobs';
import type { JobSubjectInput } from '@/generated/graphql';
import { ReextractJobResult } from './reextract-job-result';
import { useStartReextraction } from './use-post-reextraction-preview';

export type ReextractTarget = { postId: string } | { url: string };

export interface ReextractJobHostApi {
  /** Start a Re-extract and follow it: the dialog opens on the progress view of the job the server answers with (new, or the open one it re-attached to). */
  start: (target: ReextractTarget) => Promise<void>;
  /** The start call is in flight (under a second): the trigger shows it is busy. */
  starting: boolean;
  /** A chip or the dialog stands for a job: the trigger hides, the chip takes its place. */
  hasJob: boolean;
  /** Focus returns here when an ended job's dialog closes. Attach it to the trigger. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export interface ReextractJobHostProps {
  /** What the host asks the server about on mount, so the chip returns after a reload (`activeJobs`, 30 minutes of ended jobs). Omit when there is nothing to find it by (the Post URL tab). */
  subject?: JobSubjectInput;
  /** The trigger (the Re-extract button or the form's Preview button), drawn by the caller. */
  children: (api: ReextractJobHostApi) => React.ReactNode;
  className?: string;
}

interface Refusal {
  failure: JobStartFailure;
  message: string | null;
}

/** What a refused start says, in plain words: queue full has its own notice with a link to Jobs; anything else the generic line plus the server's note when it sent one. */
function StartRefusal({ refusal }: { refusal: Refusal }) {
  const t = useTranslations('ReextractPreview');
  if (refusal.failure.kind === 'queue-full') return <JobRetryFailureNotice failure={refusal.failure} />;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert" data-testid="reextract-start-refused">
      <p>{t('startRefused')}</p>
      {refusal.message && <p className="mt-1 break-words text-xs">{refusal.message}</p>}
    </div>
  );
}

/**
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry) -- ONE host per source-post row (and one for the Post URL tab): it owns the
 * shared progress controller for that post, the start call, the chip and the dialog. The job is never stored in the browser: it is attached from the start
 * result or found again from the server on mount. Closing or minimizing never drops a job, and an ended job's dialog is the preview with the banner and Apply.
 */
export function ReextractJobHost({ subject, children, className }: ReextractJobHostProps) {
  const t = useTranslations('ReextractPreview');
  const controller = useJobProgress({ subject, endedWithinMinutes: 30 });
  const { start: startCall, starting } = useStartReextraction();
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { attach } = controller;

  const start = useCallback(
    async (target: ReextractTarget) => {
      setRefusal(null);
      const result = await startCall(target);
      if (result.ok) attach(result.jobId, { open: true });
      else setRefusal({ failure: result.failure, message: result.message });
    },
    [startCall, attach]
  );

  const renderEndedBody = (job: JobProgressJob, jobSubject: JobSubjectView | undefined): React.ReactNode | null => {
    if (job.status !== 'SUCCEEDED' && job.status !== 'SUCCEEDED_WITH_LIMITS') return null;
    const postId = jobSubject?.postId;
    return (
      <ReextractJobResult
        key={job.id}
        job={job}
        onRetry={() => void controller.retry()}
        retryPending={controller.retryPending}
        notice={controller.retryFailure ? <JobRetryFailureNotice failure={controller.retryFailure} /> : null}
        onStartNew={postId ? () => void start({ postId }) : undefined}
        startNewPending={starting}
        startFailure={refusal ? <StartRefusal refusal={refusal} /> : null}
      />
    );
  };

  return (
    <>
      {children({ start, starting, hasJob: controller.hasJob, triggerRef })}
      <JobProgressHost
        controller={controller}
        returnFocusRef={triggerRef}
        renderEndedBody={renderEndedBody}
        dialogSize="wide"
        chipLabels={{ done: t('chipPreviewReady'), doneWithLimits: t('chipPreviewLimits') }}
        className={className}
      />
      {refusal && !controller.dialogOpen && (
        <div className="basis-full">
          <StartRefusal refusal={refusal} />
        </div>
      )}
    </>
  );
}
