'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { RouteLoader, BlockingLoader, RawJsonViewer } from '@festgrid/ui';
import { useRequireModerator } from '@/features/auth/use-require-moderator';
import { toast } from 'sonner';
import { useQueryActorRuns, useReplayActorRunMutation } from './actor-runs-hooks';
import type { ActorRunFilters } from '@/gql/graphql';
import { Button } from '@festgrid/ui';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FilterState {
  vendor: string | null;
  status: string | null;
  createdAfter: string | null;
  createdBefore: string | null;
  profileId: string | null;
}

interface ExpandedRunId {
  [key: string]: boolean;
}

interface ReplayingState {
  [key: string]: boolean;
}

export function ActorRunsContent() {
  const t = useTranslations('ActorRunsPage');
  const locale = useLocale();
  const { status: authStatus } = useRequireModerator();

  const [filters, setFilters] = useState<FilterState>({
    vendor: null,
    status: null,
    createdAfter: null,
    createdBefore: null,
    profileId: null,
  });

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [expandedRuns, setExpandedRuns] = useState<ExpandedRunId>({});
  const [replayingRuns, setReplayingRuns] = useState<ReplayingState>({});

  const graphqlFilters: ActorRunFilters = {
    vendor: (filters.vendor as any) || undefined,
    status: (filters.status as any) || undefined,
    createdAfter: filters.createdAfter || undefined,
    createdBefore: filters.createdBefore || undefined,
    profileId: filters.profileId || undefined,
  };

  const { data: runsData, isLoading: isLoadingRuns, error: runsError, refetch: refetchRuns } = useQueryActorRuns(
    graphqlFilters,
    cursor,
    20,
    authStatus === 'authorized'
  );

  const profileOptions = Array.from(
    new Set((runsData?.queryActorRuns?.edges ?? []).map((edge) => edge.node.profileId).filter((value): value is string => Boolean(value)))
  );

  const { mutateAsync: replayRun } = useReplayActorRunMutation();

  if (authStatus === 'loading' || authStatus === 'unauthenticated' || authStatus === 'unauthorized') {
    return <RouteLoader />;
  }

  if (isLoadingRuns) {
    return <RouteLoader />;
  }

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCursor(undefined);
  };

  const handleReplay = async (runId: string) => {
    setReplayingRuns((prev) => ({ ...prev, [runId]: true }));
    try {
      const result = await replayRun({ actorRunId: runId });
      if (result.success) {
        const count = result.postsPersisted;
        toast.success(t('replaySuccessToast', { count }));
      } else {
        toast.error(t('replayErrorToast', { message: result.message || t('unknownError') }));
      }
    } catch (error) {
      toast.error(t('replayErrorToast', { message: error instanceof Error ? error.message : t('unknownError') }));
    } finally {
      setReplayingRuns((prev) => ({ ...prev, [runId]: false }));
    }
  };

  const toggleExpanded = (runId: string) => {
    setExpandedRuns((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }));
  };

  const queryResult = runsData?.queryActorRuns;
  const edges = queryResult?.edges || [];
  const hasNextPage = queryResult?.pageInfo?.hasNextPage || false;
  const isEmpty = edges.length === 0 && !cursor;

  const getVendorLabel = (vendor: string) => {
    return vendor === 'APIFY' ? t('apifyBadge') : t('brightdataBadge');
  };

  const getTriggerModeLabel = (mode: string) => {
    return mode === 'SYNC' ? t('syncBadge') : t('asyncBadge');
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      PENDING: t('pendingStatus'),
      SUCCEEDED: t('succeededStatus'),
      FAILED: t('failedStatus'),
      TIMED_OUT: t('timedOutStatus'),
      ABORTED: t('abortedStatus'),
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return 'bg-green-100 text-green-900';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-900';
      case 'FAILED':
      case 'TIMED_OUT':
      case 'ABORTED':
        return 'bg-red-100 text-red-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;

      const localeTag = locale === 'id' ? 'id-ID' : 'en-US';
      return new Intl.DateTimeFormat(localeTag, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
    } catch {
      return timestamp;
    }
  };

  const isAnyReplayInProgress = Object.values(replayingRuns).some((v) => v);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('pageHeading')}</h1>
          <p className="mt-2 text-muted-foreground">{t('pageDescription')}</p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4 rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium">{t('vendorFilterLabel')}</label>
              <select
                value={filters.vendor || ''}
                onChange={(e) => handleFilterChange({ vendor: e.target.value || null })}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('allVendorsOption')}</option>
                <option value="APIFY">{t('apifyBadge')}</option>
                <option value="BRIGHTDATA">{t('brightdataBadge')}</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">{t('statusFilterLabel')}</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange({ status: e.target.value || null })}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('allStatusesOption')}</option>
                <option value="PENDING">{t('pendingStatus')}</option>
                <option value="SUCCEEDED">{t('succeededStatus')}</option>
                <option value="FAILED">{t('failedStatus')}</option>
                <option value="TIMED_OUT">{t('timedOutStatus')}</option>
                <option value="ABORTED">{t('abortedStatus')}</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">{t('profileFilterLabel')}</label>
              <select
                value={filters.profileId || ''}
                onChange={(e) => handleFilterChange({ profileId: e.target.value || null })}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('allProfilesOption')}</option>
                {profileOptions.map((profileId) => (
                  <option key={profileId} value={profileId}>
                    {profileId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">{t('dateFromLabel')}</label>
              <input
                type="date"
                value={filters.createdAfter || ''}
                onChange={(e) => handleFilterChange({ createdAfter: e.target.value || null })}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('dateToLabel')}</label>
              <input
                type="date"
                value={filters.createdBefore || ''}
                onChange={(e) => handleFilterChange({ createdBefore: e.target.value || null })}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setFilters({
                  vendor: null,
                  status: null,
                  createdAfter: null,
                  createdBefore: null,
                  profileId: null,
                });
                setCursor(undefined);
              }}
              variant="outline"
              size="sm"
            >
              {t('filterClearButton')}
            </Button>
          </div>
        </div>

        {!!runsError && (
          <div className="mt-8 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-3">
              <div className="text-destructive">✕</div>
              <div>
                <h3 className="font-semibold">{t('errorHeadline')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{(runsError as any)?.message || 'An error occurred'}</p>
              </div>
            </div>
            <button onClick={() => refetchRuns()} className="mt-4 text-sm font-medium text-primary hover:underline">
              {t('errorTryAgain')}
            </button>
          </div>
        )}

        {isEmpty && !runsError && (
          <div className="mt-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">{t('emptyHeadline')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t('emptyMessage')}</p>
          </div>
        )}

        {!isEmpty && (
          <div className="mt-8 space-y-4">
            {edges.map((edge) => {
              const run = edge.node;
              const isExpanded = expandedRuns[run.id];
              const isRun = run as any;

              return (
                <div key={run.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-900">{getVendorLabel(isRun.vendor)}</span>
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-900">{getTriggerModeLabel(isRun.triggerMode)}</span>
                        <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusBadgeColor(isRun.status)}`}>
                          {getStatusLabel(isRun.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('runIdLabel')}: {isRun.runId} • {isRun.itemCount || 0} {t('itemCountLabel')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('accountProfileLabel')}: {isRun.profileId}
                      </p>
                      {isRun.startedAt && (
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(isRun.startedAt)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleExpanded(run.id)}
                      className="ml-4 rounded p-2 hover:bg-muted"
                      aria-label={isExpanded ? t('collapseButtonLabel') : t('expandButtonLabel')}
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      <div>
                        <h4 className="mb-2 text-sm font-medium">{t('rawInputLabel')}</h4>
                        <RawJsonViewer value={isRun.rawInput} label={t('rawInputLabel')} />
                      </div>

                      {isRun.rawOutput && (
                        <div>
                          <h4 className="mb-2 text-sm font-medium">{t('rawOutputLabel')}</h4>
                          <RawJsonViewer value={isRun.rawOutput} label={t('rawOutputLabel')} />
                        </div>
                      )}

                      {isRun.errorMessage && (
                        <div>
                          <h4 className="mb-2 text-sm font-medium">{t('errorMessageLabel')}</h4>
                          <p className="rounded bg-destructive/10 p-3 text-sm text-destructive">{isRun.errorMessage}</p>
                        </div>
                      )}

                      <Button
                        onClick={() => handleReplay(run.id)}
                        disabled={replayingRuns[run.id] || false}
                        className="w-full"
                      >
                        {replayingRuns[run.id] ? t('replayingLabel') : t('replayButtonLabel')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {hasNextPage && (
              <button
                onClick={() => {
                  setCursor(queryResult?.pageInfo?.endCursor || undefined);
                }}
                className="w-full py-3 text-center text-sm font-medium text-primary hover:underline"
              >
                {t('loadMoreButton')}
              </button>
            )}
          </div>
        )}
      </div>

      <BlockingLoader active={isAnyReplayInProgress} />
    </div>
  );
}
