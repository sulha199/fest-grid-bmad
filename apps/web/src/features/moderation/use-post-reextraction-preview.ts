'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ExtractionJobState,
  useApplyPostReextractionMutation,
  usePostReextractionPreviewQuery,
  usePreviewPostReextractionMutation,
  type ApplyReextractionSummaryFieldsFragment,
  type ExtractionErrorCode,
  type PostReextractionPreviewQuery,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

const POLL_INTERVAL_MS = 2000;

export type ReextractionPreview = NonNullable<PostReextractionPreviewQuery['postReextractionPreview']['preview']>;

export type ReextractionApplySummary = ApplyReextractionSummaryFieldsFragment;

export interface ReextractionApplyState {
  /** Apply the previewed extraction (AD-40 Apply). A no-op unless a preview is on screen. */
  apply: () => Promise<void>;
  /** idle -> applying -> done | failed. `done` also when the server says this preview was already applied. */
  phase: 'idle' | 'applying' | 'done' | 'failed';
  summary: ReextractionApplySummary | null;
  errorMessage: string | null;
  /** False after a refusal a second click cannot fix (too old, not stored, nothing to apply): the Apply button is hidden. */
  retryable: boolean;
}

/** Apply refusals that no retry can fix; only `APPLY_FAILED` (rolled back) and a thrown/network error can be retried. */
const NON_RETRYABLE_APPLY_CODES: ReadonlySet<ExtractionErrorCode | null> = new Set(['EXPIRED', 'NOT_FOUND', 'NOT_STORED', 'NOTHING_TO_APPLY'] as ExtractionErrorCode[]);

export interface UsePostReextractionPreviewResult {
  /** Start a preview for exactly one of a stored post id or a post URL. */
  start: (target: { postId: string } | { url: string }) => Promise<void>;
  reset: () => void;
  /** idle -> starting -> running -> done | failed */
  phase: 'idle' | 'starting' | 'running' | 'done' | 'failed';
  preview: ReextractionPreview | null;
  errorCode: ExtractionErrorCode | null;
  errorMessage: string | null;
  /** AD-40 Apply: the explicit, confirmed write that turns the preview into events. */
  applyState: ReextractionApplyState;
}

/**
 * AD-40 -- drives the moderator re-extract preview: starts the job, then polls it until it reaches
 * a terminal state. Previewing writes nothing; `applyState.apply()` is the one write, and only a
 * moderator's confirmed click calls it.
 */
export function usePostReextractionPreview(): UsePostReextractionPreviewResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ code: ExtractionErrorCode | null; message: string } | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { mutateAsync: startPreviewJob } = usePreviewPostReextractionMutation(graphqlClient);
  const { mutateAsync: applyPreviewJob } = useApplyPostReextractionMutation(graphqlClient);
  const [applyPhase, setApplyPhase] = useState<ReextractionApplyState['phase']>('idle');
  const [applyResult, setApplyResult] = useState<{ summary: ReextractionApplySummary | null; message: string | null; code: ExtractionErrorCode | null }>({ summary: null, message: null, code: null });
  // A ref, not state: two clicks in one tick must not both start an apply.
  const applyingRef = useRef(false);
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
      setApplyPhase('idle');
      setApplyResult({ summary: null, message: null, code: null });
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
    setApplyPhase('idle');
    setApplyResult({ summary: null, message: null, code: null });
  }, []);

  const apply = useCallback(async () => {
    if (jobId === null || applyingRef.current) return;
    applyingRef.current = true;
    const run = runRef.current;
    setApplyPhase('applying');
    try {
      const result = (await applyPreviewJob({ jobId })).applyPostReextraction;
      if (run !== runRef.current) return;
      if (result.summary) {
        setApplyResult({ summary: result.summary, message: null, code: null });
        setApplyPhase('done');
      } else {
        setApplyResult({ summary: null, message: result.errorMessage ?? null, code: result.errorCode ?? null });
        setApplyPhase('failed');
      }
    } catch (err) {
      if (run !== runRef.current) return;
      setApplyResult({ summary: null, message: err instanceof Error ? err.message : null, code: null });
      setApplyPhase('failed');
    } finally {
      applyingRef.current = false;
    }
  }, [jobId, applyPreviewJob]);

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
    applyState: {
      apply,
      // A preview the server already shows as applied (a reload, a second moderator tab) is `done`.
      phase: applyPhase === 'idle' && job?.preview?.applied ? 'done' : applyPhase,
      summary: applyResult.summary ?? job?.preview?.applied ?? null,
      errorMessage: applyResult.message,
      retryable: !NON_RETRYABLE_APPLY_CODES.has(applyResult.code),
    },
  };
}
