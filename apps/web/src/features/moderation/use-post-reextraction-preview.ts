'use client';

import { useCallback, useRef, useState } from 'react';
import {
  useApplyPostReextractionMutation,
  usePostReextractionPreviewQuery,
  usePreviewPostReextractionMutation,
  type ApplyReextractionSummaryFieldsFragment,
  type ExtractionErrorCode,
  type PostReextractionPreviewQuery,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { mapJobStartError, type JobStartFailure } from '@/features/jobs/job-start-error';

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
const NON_RETRYABLE_APPLY_CODES: ReadonlySet<ExtractionErrorCode | null> = new Set(['EXPIRED', 'NOT_FOUND', 'NOT_STORED', 'NOTHING_TO_APPLY', 'CHAIN_IN_FLIGHT'] as ExtractionErrorCode[]);

/** What the start call answered: the id of the engine job (a new one, or the open one it re-attached to), or a refusal. */
export type ReextractStartResult = { ok: true; jobId: string } | { ok: false; failure: JobStartFailure; message: string | null };

export interface UseStartReextractionResult {
  /** Start a preview for exactly one of a stored post id or a post URL (`previewPostReextraction`). Never throws. */
  start: (target: { postId: string } | { url: string }) => Promise<ReextractStartResult>;
  starting: boolean;
}

/**
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry) -- the start call alone. The job itself is followed by the shared
 * progress controller (`useJobProgress().attach`), never here: a start only says which job to follow.
 */
export function useStartReextraction(): UseStartReextractionResult {
  const { mutateAsync } = usePreviewPostReextractionMutation(graphqlClient);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  const start = useCallback(
    async (target: { postId: string } | { url: string }): Promise<ReextractStartResult> => {
      // A ref set synchronously: two taps in one render must not start two jobs.
      if (startingRef.current) return { ok: false, failure: { kind: 'generic' }, message: null };
      startingRef.current = true;
      setStarting(true);
      try {
        const result = (await mutateAsync(target)).previewPostReextraction;
        if (result.jobId) return { ok: true, jobId: result.jobId };
        return { ok: false, failure: mapJobStartError(result), message: result.errorMessage ?? null };
      } catch (error) {
        return { ok: false, failure: mapJobStartError(error), message: null };
      } finally {
        startingRef.current = false;
        setStarting(false);
      }
    },
    [mutateAsync]
  );

  return { start, starting };
}

export type ReextractionPreviewReadState = 'loading' | 'ready' | 'not-available' | 'error';

export interface UsePostReextractionPreviewResult {
  state: ReextractionPreviewReadState;
  preview: ReextractionPreview | null;
  refetch: () => void;
  /** AD-40 Apply: the explicit, confirmed write that turns the preview into events. */
  applyState: ReextractionApplyState;
}

function errorCodeOf(error: unknown): string | null {
  const response = (error as { response?: { errors?: Array<{ extensions?: { code?: unknown } }> } } | null)?.response;
  const code = response?.errors?.[0]?.extensions?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * AD-40 -- reads the preview of ONE ended re-extract job and holds its Apply. Mounted only once the job has ended with a result (the shared
 * `useJob` supplies the steps and status while it runs, so there is one poll, not two): a single read, no timer. Previewing writes nothing;
 * `applyState.apply()` is the one write, and only a moderator's confirmed click calls it. A preview of another moderator's job reads as
 * `not-available` (the read is owner-scoped and answers NOT_FOUND).
 */
export function usePostReextractionPreview(jobId: string | null, { enabled = true }: { enabled?: boolean } = {}): UsePostReextractionPreviewResult {
  const { mutateAsync: applyPreviewJob } = useApplyPostReextractionMutation(graphqlClient);
  const [applyPhase, setApplyPhase] = useState<ReextractionApplyState['phase']>('idle');
  const [applyResult, setApplyResult] = useState<{ summary: ReextractionApplySummary | null; message: string | null; code: ExtractionErrorCode | null }>({ summary: null, message: null, code: null });
  // A ref, not state: two clicks in one tick must not both start an apply.
  const applyingRef = useRef(false);

  const query = usePostReextractionPreviewQuery(
    graphqlClient,
    { id: jobId ?? '' },
    { enabled: enabled && jobId !== null, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false }
  );

  const apply = useCallback(async () => {
    if (jobId === null || applyingRef.current) return;
    applyingRef.current = true;
    setApplyPhase('applying');
    try {
      const result = (await applyPreviewJob({ jobId })).applyPostReextraction;
      if (result.summary) {
        setApplyResult({ summary: result.summary, message: null, code: null });
        setApplyPhase('done');
      } else {
        setApplyResult({ summary: null, message: result.errorMessage ?? null, code: result.errorCode ?? null });
        setApplyPhase('failed');
      }
    } catch (err) {
      setApplyResult({ summary: null, message: err instanceof Error ? err.message : null, code: null });
      setApplyPhase('failed');
    } finally {
      applyingRef.current = false;
    }
  }, [jobId, applyPreviewJob]);

  const data = query.data?.postReextractionPreview;
  const preview = data?.preview ?? null;
  let state: ReextractionPreviewReadState = 'loading';
  if (query.isError) state = errorCodeOf(query.error) === 'NOT_FOUND' ? 'not-available' : 'error';
  else if (data) state = preview ? 'ready' : 'error';

  return {
    state,
    preview,
    refetch: () => void query.refetch(),
    applyState: {
      apply,
      // A preview the server already shows as applied (a reload, a second moderator tab) is `done`.
      phase: applyPhase === 'idle' && preview?.applied ? 'done' : applyPhase,
      summary: applyResult.summary ?? preview?.applied ?? null,
      errorMessage: applyResult.message,
      retryable: !NON_RETRYABLE_APPLY_CODES.has(applyResult.code),
    },
  };
}
