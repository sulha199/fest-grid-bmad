'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { JobProgressJob } from '@festgrid/ui';
import { Button } from '@/components/ui/button';
import { ReextractImagesBanner } from './reextract-images-banner';
import { ReextractPreviewResult } from './reextract-preview-result';
import { usePostReextractionPreview } from './use-post-reextraction-preview';
import { useReextractRefreshReport } from './use-reextract-refresh-report';

export interface ReextractJobResultProps {
  job: JobProgressJob;
  /** Retry through the shared controller (`retryJob`): the dialog goes back to the progress view of the new job. */
  onRetry: () => void;
  retryPending?: boolean;
  /** The shared notice of a refused Retry (queue full, cap, generic). */
  notice?: React.ReactNode;
  /** "Re-extract again" for a preview that is too old to apply; omitted when the job has no stored post to start again from. */
  onStartNew?: () => void;
  startNewPending?: boolean;
  /** The line of a refused start of that new job. */
  startFailure?: React.ReactNode;
}

function ResultSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-busy="true" data-testid="reextract-result-skeleton">
      <div className="space-y-2" aria-hidden="true">
        <div className="h-16 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

/**
 * Story 10.6a -- the body of the Re-extract dialog for a job that ended with a preview (Succeeded, or Succeeded with limits): the missing-images
 * banner and the preview result with Apply exactly as before. Mounted only once the job has ended, so the preview is read once and never polled.
 * A preview that is not this moderator's is "not available to you"; one older than the Apply window says so and offers a new Re-extract.
 */
export function ReextractJobResult({ job, onRetry, retryPending = false, notice, onStartNew, startNewPending = false, startFailure }: ReextractJobResultProps) {
  const t = useTranslations('ReextractPreview');
  const read = usePostReextractionPreview(job.id);
  const refresh = useReextractRefreshReport(job.id);

  if (read.state === 'not-available') {
    return (
      <p className="rounded-md border bg-muted p-3 text-sm" role="status" data-testid="reextract-preview-unavailable">
        {t('previewNotAvailable')}
      </p>
    );
  }
  if (read.state === 'error') {
    return (
      <div className="space-y-3" role="alert" data-testid="reextract-preview-error">
        <p className="text-sm text-destructive">{t('genericError')}</p>
        <Button variant="outline" className="min-h-11" onClick={read.refetch}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  const preview = read.preview;
  // Both reads start together; a FAILED report read never blocks the preview (the banner then shows the counts).
  if (read.state === 'loading' || !preview || refresh.state === 'loading') return <ResultSkeleton />;

  const tooOld = !!refresh.applyUntil && Date.now() > new Date(refresh.applyUntil).getTime() && !preview.applied && preview.postStored && preview.events.length > 0;

  return (
    <div className="min-w-0 space-y-4">
      {tooOld && (
        <div className="space-y-2 rounded-md border bg-muted p-3 text-sm" role="status" data-testid="reextract-preview-too-old">
          <p>{t('attachTooOld')}</p>
          {onStartNew && (
            <Button variant="outline" className="min-h-11 w-full sm:w-auto" aria-disabled={startNewPending || undefined} onClick={() => !startNewPending && onStartNew()} data-testid="reextract-start-new">
              {t('startNew')}
            </Button>
          )}
          {startFailure}
        </div>
      )}
      <ReextractPreviewResult
        preview={preview}
        apply={read.applyState}
        banner={
          <ReextractImagesBanner
            report={refresh.report}
            imagesAvailable={preview.imagesAvailable}
            imagesRead={preview.imagesSent}
            canRetry={job.canRetry}
            retryNotBefore={job.retryNotBefore}
            onRetry={onRetry}
            retryPending={retryPending}
          />
        }
      />
      {notice}
    </div>
  );
}
