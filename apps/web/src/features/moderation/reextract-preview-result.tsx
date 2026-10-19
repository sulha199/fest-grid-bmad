'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ReextractionDedupTier } from '@/generated/graphql';
import type { ReextractionPreview } from './use-post-reextraction-preview';

const TIER_CLASS: Record<ReextractionDedupTier, string> = {
  [ReextractionDedupTier.High]: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  [ReextractionDedupTier.Mid]: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  [ReextractionDedupTier.Low]: 'bg-muted text-muted-foreground',
  [ReextractionDedupTier.None]: 'bg-muted text-muted-foreground',
};

const TIER_LABEL_KEY = {
  [ReextractionDedupTier.High]: 'tierHigh',
  [ReextractionDedupTier.Mid]: 'tierMid',
  [ReextractionDedupTier.Low]: 'tierLow',
  [ReextractionDedupTier.None]: 'tierNone',
} as const;

const GROUPING_LABEL_KEY = {
  SINGLE_EVENT: 'groupingSingleEvent',
  PROGRAM_LINEUP: 'groupingProgramLineup',
  DEPENDENT_STAGES: 'groupingDependentStages',
  SEPARATE_EVENTS: 'groupingSeparateEvents',
  ROUNDUP: 'groupingRoundup',
} as const;

interface ReextractPreviewResultProps {
  preview: ReextractionPreview;
}

/** AD-36 -- what the current extraction and dedup logic would do with a post. Read-only. */
export function ReextractPreviewResult({ preview }: ReextractPreviewResultProps) {
  const t = useTranslations('ReextractPreview');

  return (
    <div className="space-y-4" data-testid="reextract-preview-result">
      <p className="text-sm text-muted-foreground">
        {preview.groupingReason ? t(GROUPING_LABEL_KEY[preview.groupingReason]) : t('groupingUnknown')}
        {preview.rescraped ? ` · ${t('rescrapedNote')}` : ''}
        {!preview.postStored ? ` · ${t('notStoredNote')}` : ''}
      </p>

      {preview.events.length === 0 ? (
        <p className="text-sm">{t('noEvents')}</p>
      ) : (
        <ul className="space-y-3">
          {preview.events.map((event) => (
            <li key={event.extractionOrdinal} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{event.eventName}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${TIER_CLASS[event.dedup.tier]}`}
                  data-testid="reextract-tier"
                >
                  {t(TIER_LABEL_KEY[event.dedup.tier])}
                  {event.dedup.score !== null ? ` ${event.dedup.score.toFixed(2)}` : ''}
                </span>
                {event.isStub && <span className="rounded bg-muted px-2 py-0.5 text-xs">{t('stubBadge')}</span>}
              </div>

              {event.alreadyRepresentedBySlug && (
                <p className="text-sm">
                  {t('alreadyRepresented')}{' '}
                  <Link className="underline" href={`/events/${event.alreadyRepresentedBySlug}`}>
                    {event.alreadyRepresentedBySlug}
                  </Link>
                </p>
              )}

              {event.dedup.candidateSlug && (
                <p className="text-sm">
                  {t('matchesCandidate')}{' '}
                  <Link className="underline" href={`/events/${event.dedup.candidateSlug}`}>
                    {event.dedup.candidateName ?? event.dedup.candidateSlug}
                  </Link>
                </p>
              )}

              <ul className="text-sm text-muted-foreground">
                {event.schedules.map((s, i) => (
                  <li key={i}>
                    {s.isMain ? '★ ' : ''}
                    {s.title ? `${s.title}: ` : ''}
                    {s.startDate ?? t('noDate')}
                    {s.endDate ? ` → ${s.endDate}` : ''}
                  </li>
                ))}
              </ul>

              {event.links.length > 0 && (
                <p className="text-xs text-muted-foreground break-all">{event.links.map((l) => l.url).join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('previewOnlyNote')}</p>
    </div>
  );
}
