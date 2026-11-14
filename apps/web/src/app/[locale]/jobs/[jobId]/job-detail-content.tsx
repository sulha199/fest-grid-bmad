'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { JobProgressView, PageContainer, PageHeader, getJobSignature, useJobClock } from '@festgrid/ui';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { Link, useRouter } from '@/i18n/navigation';
import { JobType, useRetryJobMutation } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useJobAnnouncer } from '@/features/jobs/job-announcer-provider';
import { trackJobRetryClicked } from '@/features/jobs/job-analytics';
import { defaultResultAction } from '@/features/jobs/job-progress-host';
import { JobRetryFailureNotice } from '@/features/jobs/job-retry-failure-notice';
import { mapJobStartError, type JobStartFailure } from '@/features/jobs/job-start-error';
import { useJobDetail } from '@/features/jobs/use-job-detail';
import { useJobLabels } from '@/features/jobs/use-job-labels';
import { useAnnounceReconnecting } from '@/features/jobs/use-announce-reconnecting';
import { OpenReextractPreview } from '@/features/moderation/reextract-open-preview';
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
  const { labels, format, tr, titleOf, announcementOf } = useJobLabels();
  const retryMutation = useRetryJobMutation(graphqlClient);
  const [retryFailure, setRetryFailure] = useState<JobStartFailure | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.push('/login');
  }, [authLoading, session, router]);

  const detail = useJobDetail(session ? jobId : null);
  const { job, raw, state } = detail;
  const now = useJobClock(job?.status === 'RUNNING');
  useAnnounceReconnecting(detail.reconnecting);
  const retryingRef = useRef(false);

  // Spoken channel (AC 12): a status or step change of the job on this page is announced; an unchanged poll is not. The page is watched, so
  // a failure is urgent (role="alert"). The first sighting is recorded silently by the announcer.
  const title = raw ? titleOf(raw.type, raw.subject) : t('pageTitle');
  const signature = job ? getJobSignature(job) : null;
  useEffect(() => {
    if (!job) return;
    announcer.observe([{ id: job.id, signature: getJobSignature(job), text: announcementOf(job, title), urgent: job.status === 'FAILED' && !job.isCancelled }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, signature]);

  const retry = useCallback(async () => {
    if (!job || retryingRef.current) return;
    retryingRef.current = true;
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
    } finally {
      retryingRef.current = false;
    }
  }, [announcer, job, retryMutation, router, tr]);

  if (!session) return null;

  const viewState = state === 'idle' ? 'loading' : state;
  const canOpenReextractPreview =
    !!job && !!raw && raw.type === JobType.ReextractRefresh && !!raw.moderatorDetails && job.outcome?.kind === 'PREVIEW' && (job.status === 'SUCCEEDED' || job.status === 'SUCCEEDED_WITH_LIMITS');
  const accountAction = job && raw ? defaultResultAction(job, raw.subject, t('outcome.openAccount')) : null;
  const resultAction =
    job && (accountAction || canOpenReextractPreview) ? (
      <>
        {accountAction}
        {canOpenReextractPreview && <OpenReextractPreview jobId={job.id} />}
      </>
    ) : null;
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
        // Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): "Open the preview" for an ended Re-extract job that has a preview, seen by a
        // moderator (the server sends `moderatorDetails` only to one), joins the result link here. Another moderator's preview reads "not available to you" in the dialog.
        resultAction={resultAction}
        // Story 10.3a (show the subscription cap refusal and the upgrade call to action): a cap refusal renders the real notice inside the failure notice.
        notice={retryFailure ? <JobRetryFailureNotice failure={retryFailure} accountId={raw?.subject?.accountId} username={raw?.subject?.username} /> : null}
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
