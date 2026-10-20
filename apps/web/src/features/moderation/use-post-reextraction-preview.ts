'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ExtractionJobState,
  usePostReextractionPreviewQuery,
  usePreviewPostReextractionMutation,
  type ExtractionErrorCode,
  type PostReextractionPreviewQuery,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

const POLL_INTERVAL_MS = 2000;

export type ReextractionPreview = NonNullable<PostReextractionPreviewQuery['postReextractionPreview']['preview']>;

export interface UsePostReextractionPreviewResult {
  /** Start a preview for exactly one of a stored post id or a post URL. */
  start: (target: { postId: string } | { url: string }) => Promise<void>;
  reset: () => void;
  /** idle -> starting -> running -> done | failed */
  phase: 'idle' | 'starting' | 'running' | 'done' | 'failed';
  preview: ReextractionPreview | null;
  errorCode: ExtractionErrorCode | null;
  errorMessage: string | null;
}

/**
 * AD-40 -- drives the moderator re-extract preview: starts the job, then polls it until it reaches
 * a terminal state. Preview only; nothing here (or on the server) writes events or posts.
 */
export function usePostReextractionPreview(): UsePostReextractionPreviewResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ code: ExtractionErrorCode | null; message: string } | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { mutateAsync: startPreviewJob } = usePreviewPostReextractionMutation(graphqlClient);
  // Bumped by every start()/reset(); a response from an older run is ignored, so closing the dialog
  // or switching posts while a start is in flight cannot show the old post's preview.
  const runRef = useRef(0);

  const query = usePostReextractionPreviewQuery(
    graphqlClient,
    { id: jobId ?? '' },
    {
      enabled: jobId !== null,
      staleTime: 0,
      gcTime: 0,
      refetchInterval: (q) => {
        // An errored query (e.g. NOT_FOUND) has no data and would otherwise be polled forever.
        if (q.state.status === 'error') return false;
        const state = q.state.data?.postReextractionPreview.status;
        return state === ExtractionJobState.Succeeded || state === ExtractionJobState.Failed ? false : POLL_INTERVAL_MS;
      },
    }
  );

  const start = useCallback(
    async (target: { postId: string } | { url: string }) => {
      const run = ++runRef.current;
      setJobId(null);
      setStartError(null);
      setIsStarting(true);
      try {
        const result = (await startPreviewJob(target)).previewPostReextraction;
        if (run !== runRef.current) return;
        if (result.jobId) {
          setJobId(result.jobId);
        } else {
          setStartError({ code: result.errorCode ?? null, message: result.errorMessage ?? '' });
        }
      } catch (err) {
        if (run !== runRef.current) return;
        setStartError({ code: null, message: err instanceof Error ? err.message : '' });
      } finally {
        if (run === runRef.current) setIsStarting(false);
      }
    },
    [startPreviewJob]
  );

  const reset = useCallback(() => {
    runRef.current++;
    setJobId(null);
    setStartError(null);
    setIsStarting(false);
  }, []);

  const job = query.data?.postReextractionPreview;
  const polledFailure = job?.status === ExtractionJobState.Failed || query.isError;

  let phase: UsePostReextractionPreviewResult['phase'] = 'idle';
  if (isStarting) phase = 'starting';
  else if (startError || polledFailure) phase = 'failed';
  else if (job?.status === ExtractionJobState.Succeeded) phase = 'done';
  else if (jobId !== null) phase = 'running';

  return {
    start,
    reset,
    phase,
    preview: job?.status === ExtractionJobState.Succeeded ? (job.preview ?? null) : null,
    errorCode: startError?.code ?? job?.errorCode ?? null,
    errorMessage: startError?.message || job?.errorMessage || (query.isError ? (query.error as Error).message : null),
  };
}
