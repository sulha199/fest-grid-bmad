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

// Module-level so every surface (dialog, panel, detail page, list) shares one "already said" set and one queue for the page's life.
const acknowledged = new Set<string>();
const failedAttempts = new Map<string, number>();
const MAX_ACK_ATTEMPTS = 3;
let ackQueue: Promise<void> = Promise.resolve();

/** Test seam: forget what was acknowledged (and wait for what is in flight). */
export async function resetAcknowledgedJobs(): Promise<void> {
  await ackQueue;
  acknowledged.clear();
  failedAttempts.clear();
}

/**
 * The client saw jobs end: says so once per job, from a visible tab only (a hidden tab, a closed app and an offline phone never
 * acknowledge, so they are pushed). Fire and forget: a failure only means the owner may also get a push. The requests go out one after
 * the other (a page of ended jobs is not a burst of parallel calls), a failed job is un-marked so the next call offers it again, and
 * after `MAX_ACK_ATTEMPTS` failures it is left alone (no loop, no storm against a failing server). `mutateAsync` is used because
 * TanStack Query v5 runs a per-call `onError` only for the LAST `mutate` call of an observer.
 */
export function useAcknowledgeEndedJobs(): (jobs: ReadonlyArray<{ id: string; status: string }>) => void {
  const mutation = useAcknowledgeJobEndedMutation(graphqlClient);
  const mutateRef = useRef(mutation.mutateAsync);
  mutateRef.current = mutation.mutateAsync;
  return useCallback((jobs) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const todo: string[] = [];
    for (const job of jobs) {
      if (job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'WAITING') continue;
      if (acknowledged.has(job.id) || (failedAttempts.get(job.id) ?? 0) >= MAX_ACK_ATTEMPTS) continue;
      acknowledged.add(job.id);
      todo.push(job.id);
    }
    if (todo.length === 0) return;
    const send = mutateRef.current;
    ackQueue = ackQueue.then(async () => {
      for (const jobId of todo) {
        try {
          await send({ jobId });
        } catch {
          acknowledged.delete(jobId);
          failedAttempts.set(jobId, (failedAttempts.get(jobId) ?? 0) + 1);
        }
      }
    });
  }, []);
}
