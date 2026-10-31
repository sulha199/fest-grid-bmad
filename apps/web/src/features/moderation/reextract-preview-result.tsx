'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BlockingLoader, ConfirmActionDialog } from '@festgrid/ui';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ReextractionDedupTier } from '@/generated/graphql';
import type { ReextractionApplyState, ReextractionApplySummary, ReextractionPreview } from './use-post-reextraction-preview';

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
  /** AD-40 Apply. Omit to show the preview read-only. */
  apply?: ReextractionApplyState;
}

function EventLinks({ events }: { events: Array<{ slug: string; eventName: string }> }) {
  return (
    <ul className="list-disc pl-5 text-sm">
      {events.map((event) => (
        <li key={event.slug}>
          <Link className="underline" href={`/events/${event.slug}`}>
            {event.eventName}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** What an apply did: counts first, then the events it touched, then anything it left alone. */
function ReextractApplySummary({ summary }: { summary: ReextractionApplySummary }) {
  const t = useTranslations('ReextractPreview');
  return (
    <div className="space-y-3 rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950" role="status" data-testid="reextract-apply-summary">
      <p className="font-medium">{t('applySuccessTitle')}</p>
      <ul className="space-y-1 text-sm">
        <li>{t('appliedReused', { count: summary.reused.length })}</li>
        <li>{t('appliedCreated', { count: summary.created.length })}</li>
        {summary.linkedToExisting.length > 0 && <li>{t('appliedLinked', { count: summary.linkedToExisting.length })}</li>}
        {summary.queuedForReview > 0 && <li>{t('appliedQueued', { count: summary.queuedForReview })}</li>}
        {summary.skippedDeleted > 0 && <li>{t('appliedSkippedDeleted', { count: summary.skippedDeleted })}</li>}
      </ul>
      <EventLinks events={[...summary.reused, ...summary.created, ...summary.linkedToExisting]} />
      {summary.orphans.length > 0 && (
        <div className="space-y-1" data-testid="reextract-apply-orphans">
          <p className="text-sm font-medium">{t('appliedOrphans')}</p>
          <EventLinks events={summary.orphans} />
        </div>
      )}
    </div>
  );
}

/** AD-40 -- what the current extraction and dedup logic would do with a post; with `apply`, a confirmed way to make it so. */
export function ReextractPreviewResult({ preview, apply }: ReextractPreviewResultProps) {
  const t = useTranslations('ReextractPreview');
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="space-y-4" data-testid="reextract-preview-result">
      <p className="text-sm text-muted-foreground">
        {preview.groupingReason ? t(GROUPING_LABEL_KEY[preview.groupingReason]) : t('groupingUnknown')}
        {preview.rescraped ? ` · ${t('rescrapedNote')}` : ''}
        {!preview.postStored ? ` · ${t('notStoredNote')}` : ''}
      </p>

      {preview.imagesSent < preview.imagesAvailable && (
        <p
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          role="status"
          data-testid="reextract-images-warning"
        >
          {t('imagesShortfall', { sent: preview.imagesSent, available: preview.imagesAvailable })}
        </p>
      )}

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

      {apply && apply.phase === 'done' && apply.summary && <ReextractApplySummary summary={apply.summary} />}

      {apply && apply.phase !== 'done' && preview.applicable && preview.events.length > 0 && (
        <div className="space-y-2 rounded-lg border p-3" data-testid="reextract-apply-panel">
          <p className="text-sm">{t('applyExplainer')}</p>
          {apply.phase === 'failed' && (
            <p role="alert" className="text-sm text-destructive">
              {apply.errorMessage || t('applyFailed')}
            </p>
          )}
          <Button disabled={apply.phase === 'applying'} onClick={() => setConfirmOpen(true)}>
            {t('applyButton')}
          </Button>
        </div>
      )}

      {apply && (
        <>
          <ConfirmActionDialog
            open={confirmOpen}
            title={t('applyConfirmTitle')}
            description={t('applyConfirmDescription')}
            confirmLabel={t('applyConfirmConfirm')}
            cancelLabel={t('applyConfirmCancel')}
            onConfirm={async () => {
              setConfirmOpen(false);
              await apply.apply();
            }}
            onCancel={() => setConfirmOpen(false)}
          />
          <BlockingLoader active={apply.phase === 'applying'} />
        </>
      )}

      <p className="text-xs text-muted-foreground">{t('previewOnlyNote')}</p>
    </div>
  );
}
