'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { summarizeMissingImages, pickReextractBannerCauses, type ReextractImageEntry, type ReextractBannerInput } from '@festgrid/domain/posts';
import { JobRetryButton } from '@festgrid/ui';
import { useJobLabels } from '@/features/jobs/use-job-labels';
import type { ReextractRefreshReport } from './use-reextract-refresh-report';

export interface ReextractImagesBannerProps {
  /** The moderator-only refresh report; null for a job that has none (an old job): the banner then shows the counts only. */
  report: ReextractRefreshReport | null;
  /** The preview's own counts, used when there is no report. */
  imagesAvailable: number;
  imagesRead: number;
  /** The server's Retry rule for this job (`canRetry`, `retryNotBefore`): never re-derived here. */
  canRetry: boolean;
  retryNotBefore?: string | null;
  onRetry: () => void;
  retryPending?: boolean;
}

/**
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry; PRD 3.9.3 FR125) -- the banner above a preview that did not read
 * every image. It names what is missing ("Not read: the cover and slides 3 to 5."), why, that Apply still works, and offers Retry where the server
 * says so. A carousel longer than the preview cap gets its own line and no Retry; when that is the ONLY shortfall the banner is that one line.
 * The grouping, ranges and cause choice are the pure domain rules (`summarizeMissingImages`, `pickReextractBannerCauses`); nothing is re-derived here.
 */
export function ReextractImagesBanner({ report, imagesAvailable, imagesRead, canRetry, retryNotBefore, onRetry, retryPending = false }: ReextractImagesBannerProps) {
  const t = useTranslations('ReextractPreview');
  const locale = useLocale();
  const { format } = useJobLabels();
  const focusRef = useRef<HTMLElement | null>(null);

  const images = useMemo<ReextractImageEntry[]>(() => (report?.images ?? []).map((image) => ({ position: image.position, role: image.role as ReextractImageEntry['role'], state: image.state as ReextractImageEntry['state'] })), [report]);
  const available = report?.imagesAvailable ?? imagesAvailable;
  const read = report?.imagesRead ?? imagesRead;
  const summary = useMemo(() => summarizeMissingImages(images), [images]);
  const hasImages = images.length > 0;
  const shortfall = read < available || summary.failedCount > 0 || summary.overCapCount > 0;
  // Only slides beyond the preview cap are missing: that is not a failure, so no title, no cause, no Retry (choice 12 of the UX spec).
  const overCapOnly = hasImages && summary.failedCount === 0 && summary.overCapCount > 0;
  const showCap = hasImages && summary.overCapCount > 0 && !!report;

  useEffect(() => {
    if (shortfall) focusRef.current?.focus();
    // Once per showing: the banner mounts when the result opens, so the screen reader hears the shortfall before the events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shortfall) return null;

  const missingList = (() => {
    if (!hasImages || summary.failedCount === 0) return null;
    const parts: string[] = [];
    if (summary.coverMissing) parts.push(t('imageCover'));
    for (const range of summary.slideRanges) {
      parts.push(range.from === range.to ? t('imageSlideSingle', { n: range.from }) : t('imageSlideRange', { from: range.from, to: range.to }));
    }
    try {
      return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts);
    } catch {
      return parts.join(', ');
    }
  })();

  const causeInput: ReextractBannerInput | null = report
    ? {
        outcome: report.outcome as ReextractBannerInput['outcome'],
        saved: report.saved,
        lateResultPending: report.lateResultPending,
        expiredLinks: report.expiredLinks,
        images,
        imagesAvailable: report.imagesAvailable,
        imagesRead: report.imagesRead,
      }
    : null;
  const causes = overCapOnly || !causeInput ? [] : pickReextractBannerCauses(causeInput);
  const causeTime = report?.retryAfter ? format.time(String(report.retryAfter)) : retryNotBefore ? format.time(retryNotBefore) : '';
  const showRetry = canRetry && !overCapOnly;

  return (
    <div
      className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
      role="status"
      data-testid="reextract-images-warning"
    >
      {!overCapOnly && (
        <p ref={focusRef as React.RefObject<HTMLParagraphElement>} tabIndex={-1} className="font-semibold outline-none" data-testid="reextract-banner-title">
          {t('bannerTitle', { read, available })}
        </p>
      )}
      {missingList && <p data-testid="reextract-banner-missing">{t('bannerMissing', { list: missingList })}</p>}
      {showCap && (
        <p
          ref={overCapOnly ? (focusRef as React.RefObject<HTMLParagraphElement>) : undefined}
          tabIndex={overCapOnly ? -1 : undefined}
          className={overCapOnly ? 'font-semibold outline-none' : undefined}
          data-testid="reextract-banner-over-cap"
        >
          {t('bannerOverCap', { cap: report!.previewImageCap })}
        </p>
      )}
      {causes.map((cause) => (
        <p key={cause} data-testid="reextract-banner-cause" data-cause={cause}>
          {t(cause, { time: causeTime })}
        </p>
      ))}
      {!overCapOnly && <p>{t('bannerApplyNote')}</p>}
      {showRetry && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <JobRetryButton
            retryNotBefore={retryNotBefore}
            labels={{ retry: t('bannerRetry'), retryAt: (time) => t('bannerRetryAt', { time }) }}
            formatTime={format.time}
            onRetry={onRetry}
            pending={retryPending}
            hint={t('bannerRetryHint')}
          />
        </div>
      )}
    </div>
  );
}
