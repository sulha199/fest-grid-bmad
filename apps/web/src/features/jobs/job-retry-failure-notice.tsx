'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { JobStartFailure } from './job-start-error';
import { reasonText } from './job-copy';
import { useJobLabels } from './use-job-labels';
import { SubscriptionCapNoticeConnected } from '@/features/subscriptions/SubscriptionCapNoticeConnected';

export interface JobRetryFailureNoticeProps {
  failure: JobStartFailure;
  /** An override seam only: by default a cap refusal renders the real `SubscriptionCapNotice` of Story 10.3a (show the subscription cap refusal and the upgrade call to action). */
  renderCapNotice?: (failure: Extract<JobStartFailure, { kind: 'cap' }>) => React.ReactNode;
  /** The platform account id of the job's subject, when it has one (analytics only; never a handle). */
  accountId?: string | null;
  /** The subject's handle, only used so a handle-keyed id is never sent as `accountId`. */
  username?: string | null;
}

/** What a refused Retry says, in the dialog and on the detail page alike: queue full (with a link to Jobs), cooldown, generic; the cap is a slot. */
export function JobRetryFailureNotice({ failure, renderCapNotice, accountId, username }: JobRetryFailureNoticeProps) {
  const t = useTranslations('Jobs');
  const { tr, format } = useJobLabels();
  if (failure.kind === 'cap') {
    if (renderCapNotice) return <>{renderCapNotice(failure)}</>;
    const own = accountId && accountId.toLowerCase() !== (username ?? '').toLowerCase() ? accountId : undefined;
    return (
      <SubscriptionCapNoticeConnected
        state={{ refusal: { activeCount: failure.activeCount, reservedCount: failure.reservedCount, cap: failure.cap }, surface: 'job_retry', accountId: own, refusalId: 0 }}
        variant="inline"
        showManageLink
      />
    );
  }
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert" data-testid="job-retry-failure">
      {failure.kind === 'queue-full' ? (
        <>
          <p>{failure.maxQueued === null ? t('actions.startQueueFullNoCount') : t('actions.startQueueFull', { max: failure.maxQueued })}</p>
          <Link href="/jobs" className="font-medium underline">
            {t('actions.startQueueFullLink')}
          </Link>
        </>
      ) : (
        <p>{reasonText(tr, failure.kind === 'cooldown' ? 'COOLDOWN' : 'GENERIC', { time: failure.kind === 'cooldown' && failure.retryNotBefore ? format.time(failure.retryNotBefore) : undefined })}</p>
      )}
    </div>
  );
}
