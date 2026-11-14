'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getJobSignature, isJobOpen, type JobProgressJob } from '@festgrid/ui';
import { JobStatus, useRetryJobMutation, type JobSubjectInput } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { trackJobProgressMinimized, trackJobProgressReopened, trackJobRetryClicked } from './job-analytics';
import { useJobAnnouncer } from './job-announcer-provider';
import { mapJobStartError, type JobStartFailure } from './job-start-error';
import { useActiveJobs, useJob, type JobReadState, type JobSubjectView } from './use-jobs';
import { useJobLabels } from './use-job-labels';
import { useAnnounceReconnecting } from './use-announce-reconnecting';

export interface UseJobProgressOptions {
  /** What the action is about. On mount the server is asked for an open job for it, so the chip returns after a reload. */
  subject?: JobSubjectInput;
  /** Also find jobs that ended in this window (Re-extract: 30). Others pass 0. */
  endedWithinMinutes?: number;
  enabled?: boolean;
}

export interface AttachOptions {
  /** The user's own start in THIS tab: the dialog opens by itself. Any other discovery shows the chip. */
  open?: boolean;
  /** The start returned an existing job (REUSED): announce "This is already running." */
  reused?: boolean;
}

export interface JobProgressController {
  jobId: string | null;
  job: JobProgressJob | undefined;
  state: JobReadState;
  reconnecting: boolean;
  dialogOpen: boolean;
  /** True while a chip or the dialog stands for a job: the start point can hide its own button. */
  hasJob: boolean;
  /** The chip is shown: a job is known, the dialog is closed, and the user has not dismissed an ended one. */
  chipVisible: boolean;
  attach: (jobId: string, options?: AttachOptions) => void;
  openDialog: (source?: 'chip' | 'jobs_page') => void;
  minimize: () => void;
  /** Close after the job ended: the dialog closes and the chip is dropped. */
  closeEnded: () => void;
  retry: () => Promise<void>;
  retryPending: boolean;
  /** The last refusal of Retry (queue full, cap, generic), shown in the dialog's notice slot. */
  retryFailure: JobStartFailure | null;
  refetch: () => void;
  title: string;
  subject: JobSubjectView | undefined;
}

/**
 * Story 10.4 Part B -- the minimize and re-open controller. A job is never stored in the browser: `jobId` is attached from the
 * start call's result or found again from the server (key the host by its subject so another subject starts clean) (`activeJobs(subject, endedWithinMinutes)`), and the only view state kept
 * here is "is the dialog open" and which ended jobs the user already dismissed (memory only, gone on reload by design).
 */
export function useJobProgress({ subject, endedWithinMinutes = 0, enabled = true }: UseJobProgressOptions = {}): JobProgressController {
  const [jobId, setJobId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [retryFailure, setRetryFailure] = useState<JobStartFailure | null>(null);
  const firstRef = useRef(false);
  const announcer = useJobAnnouncer();
  const { tr, titleOf, announcementOf } = useJobLabels();
  const retryMutation = useRetryJobMutation(graphqlClient);

  // Re-attach from server state. Only while no job is attached; polling stops once we hold an id (useJob polls it).
  const active = useActiveJobs({ subject, endedWithinMinutes, enabled: enabled && !!subject && jobId === null, surface: 'chip', poll: false });
  useEffect(() => {
    if (jobId !== null || active.state !== 'ready') return;
    const found = active.jobs.find((j) => !dismissed.has(j.id));
    if (found) setJobId(found.id);
  }, [active.state, active.jobs, jobId, dismissed]);

  const read = useJob(jobId, { surface: dialogOpen ? 'dialog' : 'chip', enabled });
  useAnnounceReconnecting(read.reconnecting);
  const retryingRef = useRef(false);
  const job = read.job;
  const title = job ? titleOf(job.type, read.subject) : '';

  // Announce a status or step change, never an unchanged poll.
  useEffect(() => {
    if (!job) return;
    const first = firstRef.current;
    firstRef.current = false;
    const watching = dialogOpen && job.status === JobStatus.Failed && !job.isCancelled;
    announcer.observe(
      [{ id: job.id, signature: getJobSignature(job), text: announcementOf(job, title, first), urgent: watching }],
      { announceFirst: first }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job ? getJobSignature(job) : null]);

  const attach = useCallback(
    (id: string, options?: AttachOptions) => {
      setJobId(id);
      setRetryFailure(null);
      if (options?.open) {
        setDialogOpen(true);
        setDismissed((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (options.reused) announcer.announce(tr('actions.retryReused'));
        else firstRef.current = true;
      }
    },
    [announcer, tr]
  );

  const openDialog = useCallback(
    (source: 'chip' | 'jobs_page' = 'chip') => {
      setDialogOpen(true);
      if (job) trackJobProgressReopened({ jobType: job.type, status: job.status, source });
      announcer.announce(tr('announce.reopened'));
    },
    [announcer, job, tr]
  );

  const minimize = useCallback(() => {
    setDialogOpen(false);
    if (job) trackJobProgressMinimized({ jobType: job.type, status: job.status });
    announcer.announce(tr('announce.minimized'));
  }, [announcer, job, tr]);

  const closeEnded = useCallback(() => {
    setDialogOpen(false);
    if (jobId) setDismissed((prev) => new Set(prev).add(jobId));
  }, [jobId]);

  const retry = useCallback(async () => {
    // A ref set synchronously: two quick taps in one render would both read a stale isPending.
    if (!job || retryingRef.current) return;
    retryingRef.current = true;
    trackJobRetryClicked({ jobType: job.type, reasonCode: job.reasonCode ?? null });
    setRetryFailure(null);
    try {
      const result = (await retryMutation.mutateAsync({ jobId: job.id })).retryJob;
      if (result.outcome === 'REFUSED' || !result.job) {
        setRetryFailure(mapJobStartError(result));
        return;
      }
      setJobId(result.job.id);
      announcer.announce(tr(result.outcome === 'REUSED' ? 'actions.retryReused' : 'actions.retryStarted'));
    } catch (error) {
      setRetryFailure(mapJobStartError(error));
    } finally {
      retryingRef.current = false;
    }
  }, [announcer, job, retryMutation, tr]);

  const ended = job ? !isJobOpen(job) : false;
  const chipVisible = !!job && !dialogOpen && !(ended && dismissed.has(job.id));
  return {
    jobId,
    job,
    state: read.state,
    reconnecting: read.reconnecting,
    dialogOpen,
    hasJob: chipVisible || dialogOpen,
    chipVisible,
    attach,
    openDialog,
    minimize,
    closeEnded,
    retry,
    retryPending: retryMutation.isPending,
    retryFailure,
    refetch: read.refetch,
    title,
    subject: read.subject,
  };
}
