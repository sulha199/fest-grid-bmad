'use client';

import { useCallback } from 'react';
import { isJobOpen, type JobProgressJob } from '@festgrid/ui';
import { useJobDetailQuery, type JobDetailQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { toJobProgressJob } from './job-model';
import { getJobPollInterval } from './poll-schedule';
import { useOnReturnToVisible, usePageVisible } from './use-page-visible';
import { useConsecutiveErrors, type Failing, type JobReadState } from './use-jobs';

export type JobDetailRaw = NonNullable<JobDetailQuery['job']>;

export interface UseJobDetailResult {
  job: JobProgressJob | undefined;
  /** The whole answer: subject, trigger, deadline and, for a moderator only, owner and moderatorDetails. */
  raw: JobDetailRaw | undefined;
  state: JobReadState;
  reconnecting: boolean;
  refetch: () => void;
}

/**
 * Story 10.4 Part C -- the job of the detail page. Same polling policy as `useJob` (2 s for a panel that holds an open job, none once it
 * ended or is gone, paused while the tab is hidden, back-off after errors); the only difference is the wider read for a moderator.
 */
export function useJobDetail(id: string | null | undefined): UseJobDetailResult {
  const visible = usePageVisible();
  const errors = useConsecutiveErrors();
  const active = !!id;
  const query = useJobDetailQuery(
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
        const hasOpenJob = q.state.data === undefined ? true : !!job && isJobOpen({ status: job.status });
        return getJobPollInterval({ surface: 'dialog', hasOpenJob, consecutiveErrors: errors(q as unknown as Failing), hidden: !visible });
      },
    }
  );
  const refetch = useCallback(() => void query.refetch(), [query]);
  useOnReturnToVisible(visible, () => {
    if (active) refetch();
  });

  const raw = query.data?.job ?? undefined;
  let state: JobReadState = 'idle';
  if (active) {
    if (query.data !== undefined) state = raw ? 'ready' : 'not-found';
    else if (query.isError) state = 'error';
    else state = 'loading';
  }
  return { job: raw ? toJobProgressJob(raw) : undefined, raw, state, reconnecting: query.isError && query.data !== undefined, refetch };
}
