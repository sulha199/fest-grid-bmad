/**
 * Story 10.4 Part B -- the one polling policy of every job read (EXPERIENCE.md, Polling). Pure, so the numbers are
 * tested without a timer: 2 s while a dialog (or the detail panel) is watching, 5 s for a chip, 10 s for a list that
 * holds an open job, none when every job has ended, nothing while the tab is hidden, and the interval doubles after
 * an error up to 30 s.
 */
export const JOB_POLL_MS = { dialog: 2000, chip: 5000, list: 10_000 } as const;
export const JOB_POLL_MAX_BACKOFF_MS = 30_000;

export type JobPollSurface = keyof typeof JOB_POLL_MS;

export interface JobPollInput {
  surface: JobPollSurface;
  /** False when every job read has ended (or the job is gone): nothing more can change. */
  hasOpenJob: boolean;
  /** Failed fetches in a row; 0 after a success. */
  consecutiveErrors: number;
  hidden: boolean;
}

/** The delay to the next fetch in ms, or `false` for no polling. */
export function getJobPollInterval({ surface, hasOpenJob, consecutiveErrors, hidden }: JobPollInput): number | false {
  if (hidden || !hasOpenJob) return false;
  const base = JOB_POLL_MS[surface];
  if (consecutiveErrors <= 0) return base;
  return Math.min(base * 2 ** consecutiveErrors, JOB_POLL_MAX_BACKOFF_MS);
}
