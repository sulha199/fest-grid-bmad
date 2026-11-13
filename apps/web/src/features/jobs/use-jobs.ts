'use client';

import { useCallback, useRef } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import type { JobProgressJob } from '@festgrid/ui';
import { isJobOpen } from '@festgrid/ui';
import {
  useActiveJobsQuery,
  useJobByIdQuery,
  useMyJobsQuery,
  type ActiveJobsQueryVariables,
  type JobsFilter,
  type JobSubjectInput,
  type MyJobsQueryVariables,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { toJobListItem, toJobProgressJob, type JobListItem } from './job-model';
import { getJobPollInterval, type JobPollSurface } from './poll-schedule';
import { useOnReturnToVisible, usePageVisible } from './use-page-visible';

/**
 * Story 10.4 Part B -- the shared read hooks. One policy (poll-schedule.ts), no per-job-type loop, and no browser
 * storage: a job is only ever what the server says. React Query keeps the response in memory only.
 */

export type JobReadState = 'idle' | 'loading' | 'error' | 'not-found' | 'ready';

export type Failing = { state: { status: string; errorUpdatedAt: number } };

/**
 * Consecutive failed fetches of a query (0 after a success), the back-off input. React Query resets its own failure
 * counter at the start of every fetch, so the run of errors is counted here, once per distinct error timestamp.
 */
export function useConsecutiveErrors(): (q: Failing) => number {
  const count = useRef(0);
  const lastErrorAt = useRef(0);
  return useCallback((q: Failing) => {
    if (q.state.status !== 'error') {
      count.current = 0;
    } else if (q.state.errorUpdatedAt !== lastErrorAt.current) {
      lastErrorAt.current = q.state.errorUpdatedAt;
      count.current += 1;
    }
    return count.current;
  }, []);
}

export interface UseJobOptions {
  /** `dialog`: 2 s (also the detail panel). `chip`: 5 s. */
  surface?: Extract<JobPollSurface, 'dialog' | 'chip'>;
  enabled?: boolean;
}

export type JobSubjectView = {
  kind: string;
  accountId?: string | null;
  platform?: string | null;
  username?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
  postCount?: number | null;
  postCode?: string | null;
  postId?: string | null;
};

export interface UseJobResult {
  job: JobProgressJob | undefined;
  /** What the job is about, for the title and the result link (kept beside the ui-shaped job). */
  subject: JobSubjectView | undefined;
  state: JobReadState;
  /** The poll is failing but a last known state is shown. */
  reconnecting: boolean;
  refetch: () => void;
}

export function useJob(id: string | null | undefined, { surface = 'chip', enabled = true }: UseJobOptions = {}): UseJobResult {
  const visible = usePageVisible();
  const errors = useConsecutiveErrors();
  const active = enabled && !!id;
  const query = useJobByIdQuery(
    graphqlClient,
    { id: id ?? '' },
    {
      enabled: active,
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: (q) => {
        const job = q.state.data?.job;
        // A job that is gone (null) or ended can no longer change: no poll. A failed read keeps polling with back-off.
        const hasOpenJob = q.state.data === undefined ? true : !!job && isJobOpen({ status: job.status });
        return getJobPollInterval({ surface, hasOpenJob, consecutiveErrors: errors(q as unknown as Failing), hidden: !visible });
      },
    }
  );
  const refetch = useCallback(() => void query.refetch(), [query]);
  useOnReturnToVisible(visible, () => {
    if (active) refetch();
  });

  const raw = query.data?.job;
  let state: JobReadState = 'idle';
  if (active) {
    if (query.data !== undefined) state = raw ? 'ready' : 'not-found';
    else if (query.isError) state = 'error';
    else state = 'loading';
  }
  return { job: raw ? toJobProgressJob(raw) : undefined, subject: raw?.subject, state, reconnecting: query.isError && query.data !== undefined, refetch };
}

export interface UseActiveJobsOptions {
  filter?: JobsFilter;
  /** What the action is about, so a start point finds its own open job again (after a reload, on another device). */
  subject?: JobSubjectInput;
  /** Also return jobs that ended inside this window (the Re-extract panel asks 30). */
  endedWithinMinutes?: number;
  enabled?: boolean;
  /** `chip` 5 s (a start point) or `list` 10 s (the Jobs page). Polls only while a returned job is open. */
  surface?: Extract<JobPollSurface, 'chip' | 'list'>;
  /** False: read once (and on return to the tab), never on a timer. */
  poll?: boolean;
}

export interface UseActiveJobsResult {
  jobs: JobListItem[];
  state: JobReadState;
  reconnecting: boolean;
  refetch: () => void;
}

export function useActiveJobs({ filter, subject, endedWithinMinutes = 0, enabled = true, surface = 'chip', poll = true }: UseActiveJobsOptions = {}): UseActiveJobsResult {
  const visible = usePageVisible();
  const errors = useConsecutiveErrors();
  const variables: ActiveJobsQueryVariables = { filter, subject, endedWithinMinutes };
  const query = useActiveJobsQuery(graphqlClient, variables, {
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const jobs = q.state.data?.activeJobs;
      const hasOpenJob = poll && (jobs === undefined ? false : jobs.some((j) => isJobOpen({ status: j.status })));
      return getJobPollInterval({ surface, hasOpenJob, consecutiveErrors: errors(q as unknown as Failing), hidden: !visible });
    },
  });
  const refetch = useCallback(() => void query.refetch(), [query]);
  useOnReturnToVisible(visible, () => {
    if (enabled) refetch();
  });
  let state: JobReadState = 'idle';
  if (enabled) state = query.data !== undefined ? 'ready' : query.isError ? 'error' : 'loading';
  return {
    jobs: (query.data?.activeJobs ?? []).map(toJobListItem),
    state,
    reconnecting: query.isError && query.data !== undefined,
    refetch,
  };
}

export interface UseMyJobsOptions {
  filter?: JobsFilter;
  onlyEnded?: boolean;
  first?: number;
  /** From `useListPaginationController` (`pagination.cursor`), never local state. */
  after?: string | null;
  enabled?: boolean;
  /** Keep the page on screen (dimmed by the caller) while the next one loads, so Previous/Next never flash an empty list. */
  keepPreviousPage?: boolean;
}

export function useMyJobs({ filter, onlyEnded = false, first = 20, after, enabled = true, keepPreviousPage = false }: UseMyJobsOptions = {}) {
  const visible = usePageVisible();
  const errors = useConsecutiveErrors();
  const variables: MyJobsQueryVariables = { filter, onlyEnded, first, after: after ?? undefined };
  const query = useMyJobsQuery(graphqlClient, variables, {
    enabled,
    placeholderData: keepPreviousPage ? keepPreviousData : undefined,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const edges = q.state.data?.myJobs.edges;
      const hasOpenJob = !!edges && edges.some((e) => isJobOpen({ status: e.node.status }));
      return getJobPollInterval({ surface: 'list', hasOpenJob, consecutiveErrors: errors(q as unknown as Failing), hidden: !visible });
    },
  });
  const refetch = useCallback(() => void query.refetch(), [query]);
  useOnReturnToVisible(visible, () => {
    if (enabled) refetch();
  });
  return { query, connection: query.data?.myJobs, refetch };
}
