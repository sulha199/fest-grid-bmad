'use client';

import { useReextractJobReportQuery, type ReextractJobReportQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export type ReextractRefreshReport = NonNullable<NonNullable<ReextractJobReportQuery['job']>['refresh']>;

export interface UseReextractRefreshReportResult {
  state: 'loading' | 'ready' | 'error';
  /** Null for a job that has no report (finished before the report existed, or another job type) and when the read failed: the banner then falls back to the preview's counts. */
  report: ReextractRefreshReport | null;
  /** When the preview stops being applicable (30 minutes after the job ended) and whether it was already applied. */
  applyUntil: string | null;
  applied: boolean;
}

/**
 * Story 10.6a -- the moderator-only refresh report of an ENDED Re-extract job (`Job.refresh`). Read once, never polled: an ended job's report does
 * not change. A failed read never blocks the preview (state `error`, no report).
 */
export function useReextractRefreshReport(jobId: string | null, { enabled = true }: { enabled?: boolean } = {}): UseReextractRefreshReportResult {
  const query = useReextractJobReportQuery(
    graphqlClient,
    { id: jobId ?? '' },
    { enabled: enabled && jobId !== null, staleTime: Infinity, gcTime: 0, retry: false, refetchOnWindowFocus: false }
  );
  const job = query.data?.job ?? null;
  return {
    state: query.isError ? 'error' : query.data !== undefined ? 'ready' : 'loading',
    report: job?.refresh ?? null,
    applyUntil: job?.outcome?.previewApplyUntil ? String(job.outcome.previewApplyUntil) : null,
    applied: job?.outcome?.previewApplied === true,
  };
}
