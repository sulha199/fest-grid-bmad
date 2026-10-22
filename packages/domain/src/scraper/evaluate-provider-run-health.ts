export type ProviderRunStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';

/** The slice of a `scraper_actor_runs` row that provider health reads. */
export interface ProviderRunSample {
  status: ProviderRunStatus;
  itemCount: number | null;
  completedAt: Date | null;
}

/**
 * What one finished run amounted to, as far as provider health is concerned:
 * - `ok`: it returned posts (or a success that never recorded a count, given the benefit of the doubt);
 * - `empty`: a success that returned nothing, which on its own is normal (an account with nothing new);
 * - `failed`: the vendor reported the run failed, timed out or was aborted, or Bright Data's zero-record
 *   result was classified a vendor failure and stored as `FAILED` (BUG-074).
 */
export type ProviderRunOutcome = 'ok' | 'empty' | 'failed';

/** `null` while the run is unfinished: those say nothing about the provider yet. */
export function classifyProviderRun(run: ProviderRunSample): ProviderRunOutcome | null {
  if (run.status === 'PENDING' || run.completedAt === null) {
    return null;
  }
  if (run.status !== 'SUCCEEDED') {
    return 'failed';
  }
  return run.itemCount === 0 ? 'empty' : 'ok';
}

export interface ProviderRunHealthOptions {
  /** How many of the newest finished runs are looked at. */
  sampleSize: number;
  /** Fewer finished runs than this prove nothing either way. */
  minRuns: number;
  /** Share of the sample (0 to 1) that must have failed to call the provider failing. */
  failedShare: number;
}

/**
 * Thresholds are provisional (IDEA-095 leaves them to the owner): the fleet is about 40 profiles, so a
 * sample of 20 is roughly half a day of runs, and 10 is the smallest sample that cannot be produced by
 * a handful of unlucky accounts.
 */
export const DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS: ProviderRunHealthOptions = {
  sampleSize: 20,
  minRuns: 10,
  failedShare: 0.8,
};

/**
 * - `VENDOR_FAILURE`: at least `failedShare` of the sample failed;
 * - `ALL_EMPTY`: nothing in the sample returned a post. An account with nothing new is normal (about half
 *   the runs before the 2026-10-21 outage), a whole sample of them is not. This also catches an outage
 *   whose failure signature is not the one the Bright Data classifier knows.
 */
export type ProviderDegradedReason = 'VENDOR_FAILURE' | 'ALL_EMPTY';

export interface ProviderRunHealth {
  degraded: boolean;
  reason: ProviderDegradedReason | null;
  sampled: number;
  ok: number;
  empty: number;
  failed: number;
}

/**
 * Whether a provider is currently failing, judged from its newest finished runs across all profiles
 * (IDEA-095, BUG-074 section 5). Unfinished runs are ignored.
 *
 * The newest finished run decides first: one that returned posts proves the vendor is alive and clears
 * the flag at once. That is the way back, because a degraded provider is only ever sent a probe (see the
 * backend's `provider-run-health-store`), and the probe's own result must be able to reopen it.
 */
export function evaluateProviderRunHealth(
  runs: ProviderRunSample[],
  options: ProviderRunHealthOptions = DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS
): ProviderRunHealth {
  const finished = runs
    .flatMap((run) => {
      const outcome = classifyProviderRun(run);
      return outcome === null || run.completedAt === null ? [] : [{ outcome, completedAt: run.completedAt }];
    })
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, options.sampleSize);

  const count = (outcome: ProviderRunOutcome) => finished.filter((run) => run.outcome === outcome).length;
  const ok = count('ok');
  const empty = count('empty');
  const failed = count('failed');
  const summary = { sampled: finished.length, ok, empty, failed };

  if (finished.length === 0 || finished.length < options.minRuns || finished[0].outcome === 'ok') {
    return { degraded: false, reason: null, ...summary };
  }
  if (failed / finished.length >= options.failedShare) {
    return { degraded: true, reason: 'VENDOR_FAILURE', ...summary };
  }
  if (ok === 0) {
    return { degraded: true, reason: 'ALL_EMPTY', ...summary };
  }
  return { degraded: false, reason: null, ...summary };
}
