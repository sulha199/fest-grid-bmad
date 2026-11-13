'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, PageContainer, PageHeader, PaginationControls, getJobSignature, useJobClock, useListPaginationController } from '@festgrid/ui';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useRouter } from '@/i18n/navigation';
import { JobsScope, useMeQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useJobAnnouncer } from '@/features/jobs/job-announcer-provider';
import { trackJobProgressReopened, trackJobsFilterChanged } from '@/features/jobs/job-analytics';
import { toJobListItem, type JobListItem } from '@/features/jobs/job-model';
import { useJobLabels } from '@/features/jobs/use-job-labels';
import { useAnnounceReconnecting } from '@/features/jobs/use-announce-reconnecting';
import { useActiveJobs, useMyJobs } from '@/features/jobs/use-jobs';
import { EmptyPageNotice } from '@/features/pagination/empty-page-notice';
import { usePaginationLabels } from '@/features/pagination/use-pagination-labels';
import { useReportConnectionPageMeta } from '@/features/pagination/use-report-connection-page-meta';
import { JobRow, JobRowSkeletons } from './job-row';

const PAGE_SIZE = 20;

type FilterKey = { scope: JobsScope; includeSystem: boolean };

/**
 * Story 10.4 Part C -- the Jobs page (PRD 3.18, FR123): "In progress" (not paged) above "Finished" (paged with Previous and Next, the owner's
 * choice over infinite scroll). The Finished list owns its paging only through `useListPaginationController` (AD-18 rule 4): no cursor state,
 * no page number state, a clear-filters control that also resets to page 1, and filter handlers that never call `refetch()`.
 */
export function JobsContent() {
  const t = useTranslations('Jobs');
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuthSession();
  const announcer = useJobAnnouncer();
  const { labels, format, tr, titleOf, announcementOf } = useJobLabels();

  // Redirect to login when signed out.
  useEffect(() => {
    if (!authLoading && !session) router.push('/login');
  }, [authLoading, session, router]);

  const me = useMeQuery(graphqlClient, undefined, { enabled: !!session && !authLoading });
  const isModerator = me.data?.me?.role?.toLowerCase() === 'moderator';
  // The jobs reads wait for the role: a moderator's filter must be in the first request, and an ordinary user never sends one (FORBIDDEN).
  const ready = !!session && !authLoading && me.status !== 'pending';

  // The moderator's filters are ordinary state: they are the controller's filterKey. Defaults: My jobs, system jobs off.
  const [scope, setScope] = React.useState<JobsScope>(JobsScope.Mine);
  const [includeSystem, setIncludeSystem] = React.useState(false);
  const filterKey: FilterKey = { scope: isModerator ? scope : JobsScope.Mine, includeSystem: isModerator ? includeSystem : false };
  const filter = isModerator ? filterKey : undefined;
  const filtersActive = filterKey.scope !== JobsScope.Mine || filterKey.includeSystem;

  const pagination = useListPaginationController<FilterKey, string | undefined>({ filterKey, initialCursor: undefined });

  const active = useActiveJobs({ filter, enabled: ready, surface: 'list' });
  const history = useMyJobs({ filter, onlyEnded: true, first: PAGE_SIZE, after: pagination.cursor, enabled: ready, keepPreviousPage: true });
  const { query, connection } = history;
  // While the previous page is still on screen as placeholder data its numbers must not be reported for the new one.
  useReportConnectionPageMeta(pagination, query.isPlaceholderData ? undefined : connection);
  const paginationLabels = usePaginationLabels(pagination.pageIndex, pagination.totalCount, PAGE_SIZE);

  const finished: JobListItem[] = useMemo(() => (connection?.edges ?? []).map((edge) => toJobListItem(edge.node)), [connection]);
  const endCursor = connection?.pageInfo.endCursor;

  const hasOpenJob = active.jobs.length > 0;
  const now = useJobClock(hasOpenJob);

  // A job that left "In progress" has just ended: read the Finished page again (an effect on the data, not a filter handler). Only while the
  // filter is unchanged: a filter change swaps the active list as well, and those jobs did not end, so refetching then would cancel the
  // fetch already running for the new filter.
  const activeKey = active.jobs.map((j) => j.id).join(',');
  const filterId = `${filterKey.scope}|${filterKey.includeSystem}`;
  const previousActive = useRef<{ filterId: string; ids: string[] }>({ filterId, ids: [] });
  const { refetch: refetchHistory } = history;
  useEffect(() => {
    if (active.state !== 'ready') return;
    const ids = activeKey === '' ? [] : activeKey.split(',');
    const before = previousActive.current;
    previousActive.current = { filterId, ids };
    if (before.filterId !== filterId) return;
    if (before.ids.some((id) => !ids.includes(id))) refetchHistory();
  }, [activeKey, active.state, filterId, refetchHistory]);

  useAnnounceReconnecting(active.reconnecting || (query.isError && query.data !== undefined));

  // Spoken channel: one announcer for the page (mounted in the layout). Only a status or step change is announced, never an unchanged poll.
  const observed = [...active.jobs, ...finished];
  const observedKey = observed.map((j) => `${j.id}:${getJobSignature(j)}`).join('|');
  useEffect(() => {
    if (observed.length === 0) return;
    announcer.observe(observed.map((job) => ({ id: job.id, signature: getJobSignature(job), text: announcementOf(job, titleOf(job.type, job.subject)), urgent: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observedKey]);

  if (!session) return null;

  const onScopeChange = (value: string) => {
    const next = value === JobsScope.AllUsers ? JobsScope.AllUsers : JobsScope.Mine;
    setScope(next);
    trackJobsFilterChanged({ scope: next, includeSystem });
  };
  const onIncludeSystemChange = (checked: boolean) => {
    setIncludeSystem(checked);
    trackJobsFilterChanged({ scope, includeSystem: checked });
  };
  const clearFilters = () => {
    setScope(JobsScope.Mine);
    setIncludeSystem(false);
    // With no filter set the controller's filterKey did not change, so it would stay on page 3 without this.
    pagination.resetToFirstPage();
  };

  const renderRow = (job: JobListItem) => (
    <li key={job.id}>
      <JobRow
        job={job}
        title={titleOf(job.type, job.subject)}
        typeLabel={tr.has(`type.${job.type}`) ? tr(`type.${job.type}`) : tr('type.OTHER')}
        statusLabels={labels.status}
        format={format}
        tr={tr}
        now={now}
        showOwner={isModerator}
        onOpen={(opened) => trackJobProgressReopened({ jobType: opened.type, status: opened.status, source: 'jobs_page' })}
      />
    </li>
  );

  const activeLoading = !ready || active.state === 'loading' || active.state === 'idle';
  const historyLoading = !ready || (query.isPending && !query.isError);
  const historyError = query.isError;
  const isPlaceholder = query.isPlaceholderData;
  // An empty first page is the list's own empty state; an empty later page (rows were hidden or removed) is the notice.
  const firstPageEmpty = !historyLoading && !historyError && finished.length === 0 && !pagination.hasPrevPage;
  const laterPageEmpty = !historyLoading && !historyError && finished.length === 0 && pagination.hasPrevPage;
  const nothingAtAll = firstPageEmpty && !activeLoading && active.state !== 'error' && active.jobs.length === 0;

  return (
    <PageContainer fullWidth={false}>
      <PageHeader title={t('pageTitle')} description={t('pageDescription')} />

      {isModerator && (
        <section aria-label={t('filters.scopeLabel')} className="space-y-3 rounded-xl border border-border p-4" data-testid="jobs-filters">
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">{t('filters.scopeLabel')}</legend>
            <RadioGroup value={filterKey.scope} onValueChange={onScopeChange} aria-label={t('filters.scopeLabel')} className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label htmlFor="jobs-scope-mine" className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value={JobsScope.Mine} id="jobs-scope-mine" />
                {t('filters.scopeMine')}
              </label>
              <label htmlFor="jobs-scope-all" className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value={JobsScope.AllUsers} id="jobs-scope-all" />
                {t('filters.scopeAll')}
              </label>
            </RadioGroup>
          </fieldset>
          <Checkbox id="jobs-include-system" label={t('filters.includeSystem')} checked={filterKey.includeSystem} onChange={onIncludeSystemChange} className="min-h-11" />
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="min-h-11 rounded-md border px-3 text-sm font-medium" data-testid="jobs-clear-filters">
              {t('clearFilters')}
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="jobs-active-heading" className="space-y-3" data-testid="jobs-active">
        <h2 id="jobs-active-heading" className="text-xl font-semibold">
          {t('activeHeading')}
        </h2>
        {activeLoading ? (
          <JobRowSkeletons count={1} />
        ) : active.state === 'error' ? (
          <ListError message={t('loadError')} retryLabel={t('tryAgain')} onRetry={active.refetch} />
        ) : active.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('activeEmpty')}</p>
        ) : (
          <>
            {active.reconnecting && (
              <p className="text-xs text-muted-foreground" data-testid="jobs-reconnecting">
                {t('reconnecting')}
              </p>
            )}
            <ul className="space-y-3">{active.jobs.map(renderRow)}</ul>
          </>
        )}
      </section>

      <section aria-labelledby="jobs-finished-heading" className="space-y-3" data-testid="jobs-finished">
        <h2 id="jobs-finished-heading" className="text-xl font-semibold">
          {t('historyHeading')}
        </h2>
        {historyLoading ? (
          <JobRowSkeletons count={3} />
        ) : historyError && finished.length === 0 ? (
          // A later page that fails shows its error, never the "nothing left" notice.
          <ListError message={t('loadError')} retryLabel={t('tryAgain')} onRetry={() => void query.refetch()} />
        ) : nothingAtAll ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center" data-testid="jobs-empty">
            <p className="font-semibold">{filtersActive ? t('filteredEmptyTitle') : t('emptyTitle')}</p>
            {!filtersActive && <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>}
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="mt-3 min-h-11 rounded-md border px-3 text-sm font-medium">
                {t('clearFilters')}
              </button>
            )}
          </div>
        ) : firstPageEmpty ? (
          // Something is open but nothing has finished yet (or the filters hide it all).
          <p className="text-sm text-muted-foreground" data-testid="jobs-finished-empty">
            {filtersActive ? t('filteredEmptyTitle') : t('emptyTitle')}
          </p>
        ) : (
          <div className={isPlaceholder ? 'opacity-60 transition-opacity' : undefined}>
            {laterPageEmpty && <EmptyPageNotice />}
            {finished.length > 0 && <ul className="space-y-3">{finished.map(renderRow)}</ul>}
          </div>
        )}
        {!historyLoading && !firstPageEmpty && (
          <PaginationControls
            className="p-3"
            hasPrevPage={pagination.hasPrevPage}
            hasNextPage={pagination.hasNextPage && Boolean(endCursor)}
            onPrev={pagination.goToPrevPage}
            onNext={() => {
              if (endCursor) pagination.goToNextPage(endCursor);
            }}
            disabled={isPlaceholder}
            labels={paginationLabels}
          />
        )}
      </section>
    </PageContainer>
  );
}

function ListError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert" data-testid="jobs-load-error">
      <p>{message}</p>
      <button type="button" className="min-h-11 rounded-md border px-3 text-sm font-medium" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}
