'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAcknowledgeJobEndedMutation,
  useJobsFinishedSinceLastOpenedQuery,
  useMarkJobsOpenedMutation,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { getJobsBadgePollInterval } from './poll-schedule';
import { useConsecutiveErrors, type Failing } from './use-jobs';
import { useOnReturnToVisible, usePageVisible } from './use-page-visible';

/**
 * Story 10.13 (notify when a job finishes) -- the web half of the in-app notice. The state is the server's
 * (`user_settings.jobs_last_opened_at`, `jobs.owner_notified_at`), never browser storage, so the badge clears on every
 * device and a second tab agrees.
 */

/** The number on the Jobs menu entry. A load error (or signed out) is 0: never a wrong number. */
export function useJobsFinishedCount(enabled: boolean): number {
  const visible = usePageVisible();
  const errors = useConsecutiveErrors();
  const query = useJobsFinishedSinceLastOpenedQuery(graphqlClient, undefined, {
    enabled,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => getJobsBadgePollInterval({ consecutiveErrors: errors(q as unknown as Failing), hidden: !visible }),
  });
  useOnReturnToVisible(visible, () => {
    if (enabled) void query.refetch();
  });
  if (!enabled || query.isError) return 0;
  return Math.max(0, query.data?.jobsFinishedSinceLastOpened ?? 0);
}

/** Tells the server the Jobs page is being looked at and zeroes the cached badge. Fire and forget: a failure leaves the badge for the next poll. */
export function useMarkJobsOpened(): () => void {
  const queryClient = useQueryClient();
  const mutation = useMarkJobsOpenedMutation(graphqlClient, {
    onSuccess: () => {
      queryClient.setQueryData(['jobsFinishedSinceLastOpened'], { jobsFinishedSinceLastOpened: 0 });
    },
  });
  const mutate = mutation.mutate;
  return useCallback(() => mutate({}), [mutate]);
}

/**
 * Marks the Jobs page opened while it is visible: on mount, on return to a visible tab and whenever `changeKey` changes (a job ended
 * while the page was open, which the owner saw, so it must not turn into a badge at the next poll).
 */
export function useMarkJobsOpenedWhileVisible(enabled: boolean, changeKey: string): void {
  const visible = usePageVisible();
  const markOpened = useMarkJobsOpened();
  useEffect(() => {
    // `visible` starts true before its first effect, so a tab opened in the background is checked directly as well.
    if (enabled && visible && document.visibilityState !== 'hidden') markOpened();
  }, [enabled, visible, changeKey, markOpened]);
}

// Module-level so every surface (dialog, panel, detail page, list) shares one "already said" set for the page's life.
const acknowledged = new Set<string>();

/** Test seam: forget what was acknowledged. */
export function resetAcknowledgedJobs(): void {
  acknowledged.clear();
}

/**
 * The client saw jobs end: says so once per job, from a visible tab only (a hidden tab, a closed app and an offline phone never
 * acknowledge, so they are pushed). Fire and forget: a failure only means the owner may also get a push, and the job is tried again.
 */
export function useAcknowledgeEndedJobs(): (jobs: ReadonlyArray<{ id: string; status: string }>) => void {
  const mutation = useAcknowledgeJobEndedMutation(graphqlClient);
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  return useCallback((jobs) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    for (const job of jobs) {
      if (job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'WAITING') continue;
      if (acknowledged.has(job.id)) continue;
      acknowledged.add(job.id);
      mutateRef.current({ jobId: job.id }, { onError: () => acknowledged.delete(job.id) });
    }
  }, []);
}
