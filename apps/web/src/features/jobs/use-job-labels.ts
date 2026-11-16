'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { formatJobDuration, formatJobTime, useScopedLocale, useScopedTimezone, type JobChipLabels, type JobFormatters, type JobProgressLabels } from '@festgrid/ui';
import { buildJobAnnouncement, buildJobTitle, phaseText, reasonText, subjectText, type JobSubjectLike, type JobTranslator } from './job-copy';
import type { JobProgressJob } from '@festgrid/ui';

export interface UseJobLabelsResult {
  labels: JobProgressLabels;
  chipLabels: JobChipLabels;
  format: JobFormatters;
  tr: JobTranslator;
  titleOf: (type: string, subject?: JobSubjectLike | null) => string;
  announcementOf: (job: JobProgressJob, title: string, first?: boolean) => string;
  /** "{n} jobs updated" for the announcer. */
  listUpdated: (count: number) => string;
}

/** apps/web resolves the `Jobs` copy and the locale formatting; `packages/ui` only receives the results. */
export function useJobLabels(): UseJobLabelsResult {
  const t = useTranslations('Jobs');
  const locale = useScopedLocale();
  const timeZone = useScopedTimezone();

  return useMemo(() => {
    const tr = t as unknown as JobTranslator;
    const format: JobFormatters = {
      time: (iso) => formatJobTime(iso, locale, new Date(), timeZone),
      duration: (ms) => formatJobDuration(ms, locale),
    };
    const labels: JobProgressLabels = {
      status: {
        QUEUED: t('status.QUEUED'),
        RUNNING: t('status.RUNNING'),
        WAITING: t('status.WAITING'),
        SUCCEEDED: t('status.SUCCEEDED'),
        SUCCEEDED_WITH_LIMITS: t('status.SUCCEEDED_WITH_LIMITS'),
        FAILED: t('status.FAILED'),
        EXPIRED: t('status.EXPIRED'),
        CANCELLED: t('status.CANCELLED'),
      },
      stepsLabel: t('dialog.stepsLabel'),
      stepOf: (current, total) => t('dialog.stepOf', { current, total }),
      stepState: { done: t('dialog.stepStateDone'), current: t('dialog.stepStateCurrent'), pending: t('dialog.stepStatePending'), skipped: t('dialog.stepStateSkipped'), stopped: t('status.FAILED') },
      countDetail: (done, total) => t('dialog.countDetail', { done, total }),
      phase: (type, key) => phaseText(tr, type, key),
      leavingNote: t('dialog.leavingNote'),
      elapsed: (duration) => t('dialog.elapsed', { duration }),
      queued: {
        title: t('queued.title'),
        body: (limit) => t('queued.body', { limit }),
        position: (position) => t('row.queuePosition', { position }),
        expires: (time) => t('queued.expires', { time }),
      },
      waiting: {
        title: t('waiting.title'),
        retryAt: (time) => t('waiting.retryAt', { time }),
        result: t('waiting.result'),
        extraction: (done, total) => t('waiting.extraction', { done, total }),
        extractionRetryAt: (time) => t('waiting.extractionRetryAt', { time }),
        noPlaceHeld: t('waiting.noPlaceHeld'),
      },
      outcome: {
        succeededTitle: t('outcome.succeededTitle'),
        limitsTitle: t('outcome.limitsTitle'),
        failedTitle: t('outcome.failedTitle'),
        expiredTitle: t('outcome.expiredTitle'),
        cancelledTitle: t('outcome.cancelledTitle'),
        lateResult: t('outcome.lateResult'),
        took: (duration) => t('outcome.took', { duration }),
        eventsFromPosts: (events, posts) => t('outcome.eventsFromPosts', { events, posts }),
      },
      reason: (code, params) => reasonText(tr, code, params),
      retry: t('actions.retry'),
      retryAt: (time) => t('actions.retryAt', { time }),
      loadError: t('jobLoadError'),
      tryAgain: t('tryAgain'),
      notFound: t('notFound'),
      reconnecting: t('reconnecting'),
    };
    const chipLabels: JobChipLabels = {
      ariaLabel: (title, status) => t('chip.ariaLabel', { title, status }),
      queued: (position) => t('chip.queued', { position }),
      running: (current, total) => t('chip.running', { current, total }),
      runningNoSteps: t('chip.runningNoSteps'),
      waiting: t('chip.waiting'),
      waitingUntil: (time) => t('chip.waitingUntil', { time }),
      done: t('chip.done'),
      doneWithLimits: t('chip.doneWithLimits'),
      failed: t('chip.failed'),
      expired: t('chip.expired'),
      cancelled: t('chip.cancelled'),
    };
    return {
      labels,
      chipLabels,
      format,
      tr,
      titleOf: (type, subject) => buildJobTitle(tr, type, subject),
      announcementOf: (job, title, first) => buildJobAnnouncement(tr, job, title, format.time, first),
      listUpdated: (count) => t('announce.listUpdated', { count }),
    };
  }, [t, locale, timeZone]);
}

export { subjectText };
