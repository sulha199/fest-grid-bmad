'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { JobProgressView, PageContainer, PageHeader, useJobClock } from '@festgrid/ui';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { Link, useRouter } from '@/i18n/navigation';
import { useRetryJobMutation } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useJobAnnouncer } from '@/features/jobs/job-announcer-provider';
import { trackJobRetryClicked } from '@/features/jobs/job-analytics';
import { defaultResultAction } from '@/features/jobs/job-progress-host';
import { JobRetryFailureNotice } from '@/features/jobs/job-retry-failure-notice';
import { mapJobStartError, type JobStartFailure } from '@/features/jobs/job-start-error';
import { useJobDetail } from '@/features/jobs/use-job-detail';
import { useJobLabels } from '@/features/jobs/use-job-labels';
import { JobTechnicalDetails } from './job-technical-details';

/**
 * Story 10.4 Part C -- `/jobs/{id}`: its own route so a Jobs row (and later a push notification, Story 10.13) can link to one job. The same
 * `JobProgressView` in its panel form, then timing and, for a moderator, the technical details. A missing, retained-out or someone else's job
 * reads "This job was not found." with a link to Jobs.
 */
export function JobDetailContent({ jobId }: { jobId: string }) {
  const t = useTranslations('Jobs');
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuthSession();
  const announcer = useJobAnnouncer();
  const { labels, format, tr, titleOf } = useJobLabels();
  const retryMutation = useRetryJobMutation(graphqlClient);
  const [retryFailure, setRetryFailure] = useState<JobStartFailure | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.push('/login');
  }, [authLoading, session, router]);

  const detail = useJobDetail(session ? jobId : null);
  const { job, raw, state } = detail;
  const now = useJobClock(job?.status === 'RUNNING');

  const retry = useCallback(async () => {
    if (!job || retryMutation.isPending) return;
    trackJobRetryClicked({ jobType: job.type, reasonCode: job.reasonCode ?? null });
    setRetryFailure(null);
    try {
      const result = (await retryMutation.mutateAsync({ jobId: job.id })).retryJob;
      if (result.outcome === 'REFUSED' || !result.job) {
        setRetryFailure(mapJobStartError(result));
        return;
      }
      announcer.announce(tr(result.outcome === 'REUSED' ? 'actions.retryReused' : 'actions.retryStarted'));
      // The old job stays in the list as history; this page moves to the new one.
      router.replace(`/jobs/${result.job.id}`);
    } catch (error) {
      setRetryFailure(mapJobStartError(error));
    }
  }, [announcer, job, retryMutation, router, tr]);

  if (!session) return null;

  const title = raw ? titleOf(raw.type, raw.subject) : t('pageTitle');
  const viewState = state === 'idle' ? 'loading' : state;
  const showLateNote = !!job && job.completedAfterDeadline && job.status !== 'SUCCEEDED' && job.status !== 'SUCCEEDED_WITH_LIMITS';
  const startMs = job?.startedAt ? new Date(job.startedAt).getTime() : NaN;
  const endMs = job?.finishedAt ? new Date(job.finishedAt).getTime() : NaN;
  const tookMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : null;

  return (
    <PageContainer fullWidth={false}>
      <Link href="/jobs" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline" data-testid="job-back-link">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t('backToJobs')}
      </Link>
      <PageHeader title={title} />

      <JobProgressView
        state={viewState}
        job={job}
        labels={labels}
        format={format}
        form="panel"
        now={now}
        reconnecting={detail.reconnecting}
        onRetryLoad={detail.refetch}
        onRetry={retry}
        retryPending={retryMutation.isPending}
        // SLOT (Story 10.6a, Re-extract progress, missing-images banner and Retry): "Open the preview" for a Re-extract job joins the result link here.
        resultAction={job && raw ? defaultResultAction(job, raw.subject, t('outcome.openAccount')) : null}
        // SLOT (Story 10.3a, show the subscription cap refusal and the upgrade call to action): the cap notice renders inside the failure notice.
        notice={retryFailure ? <JobRetryFailureNotice failure={retryFailure} /> : null}
        notFoundAction={
          <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm font-medium underline">
            {t('backToJobs')}
          </Link>
        }
      />

      {job && (
        <section className="min-w-0 space-y-1 text-sm" data-testid="job-timing">
          <p>{t('outcome.started', { time: format.time(job.startedAt ?? job.createdAt) })}</p>
          {job.finishedAt && <p>{t('outcome.finished', { time: format.time(job.finishedAt) })}</p>}
          {tookMs !== null && <p>{t('outcome.took', { duration: format.duration(tookMs) })}</p>}
          {showLateNote && <p>{t('outcome.lateResult')}</p>}
        </section>
      )}

      {raw && <JobTechnicalDetails job={raw} format={format} tr={tr} />}
    </PageContainer>
  );
}
