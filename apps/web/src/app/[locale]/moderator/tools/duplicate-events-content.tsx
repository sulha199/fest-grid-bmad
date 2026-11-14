'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { usePostHog } from '@festgrid/analytics';
import {
  RouteLoader,
  BlockingLoader,
  Button,
  ConfirmActionDialog,
  PaginationControls,
  useListPaginationController,
  useSoftDeleteWithUndo,
  formatEventCardDateBoxLine,
  combineDateTime,
} from '@festgrid/ui';
import type { DedupDecisionClue } from '@festgrid/domain/events';
import { useRequireModerator } from '@/features/auth/use-require-moderator';
import { usePaginationLabels } from '@/features/pagination/use-pagination-labels';
import { useReportConnectionPageMeta } from '@/features/pagination/use-report-connection-page-meta';
import { EmptyPageNotice } from '@/features/pagination/empty-page-notice';
import { ResolutionClueChecklist, type ClueEventFacts } from './resolution-clue-checklist';
import {
  useQuerySuggestedEventMatches,
  useResolveSuggestedEventMatchMutation,
  useUndoEventMergeMutation,
  SuggestedEventMatchAction,
} from './duplicate-events-hooks';

const PAGE_SIZE = 10;

// This queue has no filters, so the controller's filter key never changes and it never resets itself.
const NO_FILTERS = {};

type SuggestedEvent = {
  id: string;
  slug: string;
  eventName: string;
  location?: string | null;
  imageUrl?: string | null;
  durableImageUrl?: string | null;
  schedules: Array<{
    id: string;
    isMainSchedule: boolean;
    eventStartDate: string;
    eventEndDate?: string | null;
    eventStartTime?: string | null;
    eventEndTime?: string | null;
    timezone?: string | null;
  }>;
};

export interface SuggestedMatch {
  id: string;
  score: number;
  status: string;
  event: SuggestedEvent;
  candidateEvent: SuggestedEvent;
}

/** What the checklist shows beside each aspect: the event's own name, venue and main start date. */
function clueFacts(event: SuggestedEvent | undefined): ClueEventFacts {
  if (!event) return { name: '' };
  const schedule = event.schedules.find((s) => s.isMainSchedule) ?? event.schedules[0];
  return { name: event.eventName, location: event.location, startDate: schedule?.eventStartDate };
}

function EventSummary({ event, label, locale, viewEventLabel }: { event: SuggestedEvent; label: string; locale: string; viewEventLabel: string }) {
  const thumbnailUrl = event.durableImageUrl || event.imageUrl || null;
  const schedule = event.schedules.find((s) => s.isMainSchedule) ?? event.schedules[0];

  let dateLabel: string | null = null;
  if (schedule) {
    const startDateTime = combineDateTime(schedule.eventStartDate, schedule.eventStartTime, schedule.timezone ?? undefined);
    const effectiveEndDate = schedule.eventEndDate ?? schedule.eventStartDate;
    const endDateTime = combineDateTime(effectiveEndDate, schedule.eventEndTime, schedule.timezone ?? undefined);
    dateLabel = formatEventCardDateBoxLine(locale, schedule.timezone ?? undefined, new Date(), startDateTime, endDateTime, schedule.eventEndTime);
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <div className="flex-1 space-y-2 rounded-md bg-muted/50 p-3">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <div className="flex items-start gap-3">
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={event.eventName} onError={handleImageError} className="h-12 w-12 rounded object-cover border bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <a
            href={`/events/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${viewEventLabel}: ${event.eventName}`}
            className="font-semibold text-foreground hover:underline"
          >
            {event.eventName}
          </a>
          {dateLabel && <p className="text-sm text-muted-foreground">{dateLabel}</p>}
          {event.location && <p className="text-sm text-muted-foreground">{event.location}</p>}
        </div>
      </div>
    </div>
  );
}

function SuggestedMatchRow({
  suggestion,
  locale,
  isPending,
  isMutating,
  t,
  onAccept,
  onReject,
}: {
  suggestion: SuggestedMatch;
  locale: string;
  isPending: boolean;
  isMutating: boolean;
  t: (key: string) => string;
  onAccept: (suggestion: SuggestedMatch) => void;
  onReject: (suggestion: SuggestedMatch) => void;
}) {
  return (
    <div className={`space-y-3 border rounded-lg bg-card p-4 ${isPending ? 'opacity-50' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <EventSummary event={suggestion.candidateEvent} label={t('candidateLabel')} locale={locale} viewEventLabel={t('viewEventLabel')} />
        <EventSummary event={suggestion.event} label={t('newItemLabel')} locale={locale} viewEventLabel={t('viewEventLabel')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onReject(suggestion)} disabled={isPending || isMutating}>
          {t('rejectButton')}
        </Button>
        <Button onClick={() => onAccept(suggestion)} disabled={isPending || isMutating}>
          {t('acceptButton')}
        </Button>
      </div>
    </div>
  );
}

export function DuplicateEventsContent() {
  const t = useTranslations('DuplicateEventsPage');
  const locale = useLocale();
  const posthog = usePostHog();
  const { status: authStatus } = useRequireModerator();

  const [actionInFlight, setActionInFlight] = useState<Record<string, boolean>>({});
  const [confirmSuggestion, setConfirmSuggestion] = useState<SuggestedMatch | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Both resolutions open the same dialog; the checklist is the "why" (optional) and is cleared each time it opens.
  const [resolveAction, setResolveAction] = useState<'accept' | 'reject'>('accept');
  const [clues, setClues] = useState<DedupDecisionClue[]>([]);
  const [note, setNote] = useState('');

  const pagination = useListPaginationController<typeof NO_FILTERS, string | undefined>({ filterKey: NO_FILTERS, initialCursor: undefined });
  const { data, isLoading, isPlaceholderData, error, refetch } = useQuerySuggestedEventMatches(PAGE_SIZE, pagination.cursor, authStatus === 'authorized');
  const queryResult = data?.suggestedEventMatches;
  // The connection has no totalCount, so the readout is "Page N" without a total.
  // While the previous page is still on screen as placeholder data its numbers must not be reported for the new one.
  useReportConnectionPageMeta(pagination, isPlaceholderData ? undefined : queryResult);
  const paginationLabels = usePaginationLabels(pagination.pageIndex, pagination.totalCount, PAGE_SIZE);
  const { mutateAsync: resolveSuggestedEventMatch } = useResolveSuggestedEventMatchMutation();
  const { mutateAsync: undoEventMerge } = useUndoEventMergeMutation();

  const { isPending, markPending } = useSoftDeleteWithUndo<string>({
    onExpire: () => {
      // The undo window simply expired -- the suggestion already left the pending list on
      // Accept (AC1/AC3), so there is nothing further to splice from any cache here.
    },
  });

  if (authStatus === 'loading' || authStatus === 'unauthenticated' || authStatus === 'unauthorized') return <RouteLoader />;
  if (isLoading) return <RouteLoader />;

  const edges = queryResult?.edges || [];
  const isEmpty = edges.length === 0 && !pagination.hasPrevPage;
  const endCursor = queryResult?.pageInfo?.endCursor;
  const isAnyActionInFlight = Object.values(actionInFlight).some(Boolean);

  const openResolve = (suggestion: SuggestedMatch, action: 'accept' | 'reject') => {
    setConfirmSuggestion(suggestion);
    setResolveAction(action);
    setClues([]);
    setNote('');
    setConfirmOpen(true);
  };
  const handleAcceptClick = (suggestion: SuggestedMatch) => openResolve(suggestion, 'accept');
  const handleRejectClick = (suggestion: SuggestedMatch) => openResolve(suggestion, 'reject');

  // The note goes to the mutation only: never to analytics, a toast or the console.
  const resolutionReason = () => ({ clues: clues.length > 0 ? clues : null, note: note.trim() === '' ? null : note.trim() });

  const handleConfirmAccept = async () => {
    if (!confirmSuggestion) return;
    const suggestion = confirmSuggestion;
    const reason = resolutionReason();
    setActionInFlight((prev) => ({ ...prev, [suggestion.id]: true }));
    try {
      const result = await resolveSuggestedEventMatch({ id: suggestion.id, action: SuggestedEventMatchAction.Accept, ...reason });
      posthog.capture('moderator_event_merge_committed', { suggestionId: suggestion.id, mergeId: result.mergeId, clues: reason.clues });
      const mergeId = result.mergeId;
      // AC6 -- commit, then close the dialog (returning focus to the row's Accept button via
      // ConfirmActionDialog's own onCloseAutoFocus), and only then does the undo toast appear.
      setConfirmOpen(false);
      refetch();
      if (mergeId) {
        markPending(
          suggestion.id,
          async () => {
            await undoEventMerge({ mergeId });
            posthog.capture('moderator_event_merge_undone', { suggestionId: suggestion.id, mergeId });
            refetch();
          },
          { message: t('mergedToast'), undoLabel: t('undoLabel') }
        );
      }
    } catch (err) {
      console.error('Failed to resolve suggested event match (ACCEPT)', err);
      toast.error(t('mergeErrorToast'));
    } finally {
      setActionInFlight((prev) => ({ ...prev, [suggestion.id]: false }));
    }
  };

  const handleConfirmReject = async () => {
    if (!confirmSuggestion) return;
    const suggestion = confirmSuggestion;
    const reason = resolutionReason();
    setActionInFlight((prev) => ({ ...prev, [suggestion.id]: true }));
    try {
      await resolveSuggestedEventMatch({ id: suggestion.id, action: SuggestedEventMatchAction.Reject, ...reason });
      posthog.capture('moderator_suggested_event_match_rejected', { suggestionId: suggestion.id, clues: reason.clues });
      setConfirmOpen(false);
      toast.success(t('rejectSuccessToast'));
      refetch();
    } catch (err) {
      console.error('Failed to resolve suggested event match (REJECT)', err);
      toast.error(t('rejectErrorToast'));
    } finally {
      setActionInFlight((prev) => ({ ...prev, [suggestion.id]: false }));
    }
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>

      {!!error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <div className="text-destructive">✕</div>
            <div>
              <h3 className="font-semibold">{t('errorHeadline')}</h3>
            </div>
          </div>
          <button onClick={() => refetch()} className="mt-4 text-sm font-medium text-primary hover:underline focus:outline-none">
            {t('errorTryAgain')}
          </button>
        </div>
      )}

      {isEmpty && !error && (
        <div className="py-12 text-center">
          <h3 className="text-lg font-semibold">{t('emptyHeadline')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t('emptyMessage')}</p>
        </div>
      )}

      {!isEmpty && (
        <div className={`space-y-4${isPlaceholderData ? ' opacity-60 transition-opacity' : ''}`}>
          {edges.length === 0 && !error && <EmptyPageNotice />}
          <div className="space-y-4">
            {edges.map((edge) => {
              const suggestion = edge.node as SuggestedMatch;
              return (
                <SuggestedMatchRow
                  key={suggestion.id}
                  suggestion={suggestion}
                  locale={locale}
                  isPending={isPending(suggestion.id)}
                  isMutating={!!actionInFlight[suggestion.id]}
                  t={t}
                  onAccept={handleAcceptClick}
                  onReject={handleRejectClick}
                />
              );
            })}
          </div>
          <PaginationControls
            hasPrevPage={pagination.hasPrevPage}
            hasNextPage={pagination.hasNextPage && Boolean(endCursor)}
            onPrev={pagination.goToPrevPage}
            onNext={() => { if (endCursor) pagination.goToNextPage(endCursor); }}
            disabled={isPlaceholderData}
            labels={paginationLabels}
          />
        </div>
      )}

      <ConfirmActionDialog
        open={confirmOpen}
        title={resolveAction === 'accept' ? t('mergeConfirmTitle') : t('rejectConfirmTitle')}
        description={resolveAction === 'accept' ? t('mergeConfirmDescription') : t('rejectConfirmDescription')}
        confirmLabel={resolveAction === 'accept' ? t('mergeConfirmConfirmLabel') : t('rejectConfirmConfirmLabel')}
        cancelLabel={t('mergeConfirmCancelLabel')}
        confirmVariant="destructive"
        className="max-h-[90vh] overflow-y-auto"
        onConfirm={resolveAction === 'accept' ? handleConfirmAccept : handleConfirmReject}
        onCancel={handleCancelConfirm}
      >
        <ResolutionClueChecklist decision={resolveAction} existing={clueFacts(confirmSuggestion?.candidateEvent)} incoming={clueFacts(confirmSuggestion?.event)} clues={clues} note={note} onCluesChange={setClues} onNoteChange={setNote} disabled={isAnyActionInFlight} />
      </ConfirmActionDialog>

      <BlockingLoader active={isAnyActionInFlight} />
    </div>
  );
}
