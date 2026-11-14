'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { JobStartFailure } from './job-start-error';
import { reasonText } from './job-copy';
import { useJobLabels } from './use-job-labels';

export interface JobRetryFailureNoticeProps {
  failure: JobStartFailure;
  /** The cap notice of Story 10.3a (show the subscription cap refusal and the upgrade call to action) renders here. Empty until it exists. */
  renderCapNotice?: (failure: Extract<JobStartFailure, { kind: 'cap' }>) => React.ReactNode;
}

/** What a refused Retry says, in the dialog and on the detail page alike: queue full (with a link to Jobs), cooldown, generic; the cap is a slot. */
export function JobRetryFailureNotice({ failure, renderCapNotice }: JobRetryFailureNoticeProps) {
  const t = useTranslations('Jobs');
  const { tr, format } = useJobLabels();
  // The cap notice is Story 10.3a's slot; until it is filled a cap refusal reads as the generic message, never as nothing.
  if (failure.kind === 'cap' && renderCapNotice) return <>{renderCapNotice(failure)}</>;
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
