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
  /**
   * Runs finished longer ago than this are not "fresh": they are left out of the normal judgement, which
   * therefore needs `minRuns` runs of its own inside this window.
   */
  maxAgeHours: number;
  /**
   * The age cap of the carry-over (see `evaluateProviderRunHealth`): when fewer than `minRuns` runs are
   * fresh, the provider is judged on its newest runs up to this old instead of being trusted again. It
   * must outlast the probe cadence of a degraded provider, which only gets a few runs a day, or the
   * fresh window empties out and the next batch is sent to a provider that is still down (2026-10-26,
   * Bright Data). It is also the age cap: a provider with no run at all for this long, so never probed
   * again, is trusted again and gets work.
   */
  carryOverMaxAgeHours: number;
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
  maxAgeHours: 72,
  // 14 days: a degraded provider is probed about 3 times a day, so the 20-run sample spans about a week
  // and 14 days leaves a 4x margin over the 10 runs needed. A longer cap would judge a rarely used
  // fallback provider on weeks-old runs.
  carryOverMaxAgeHours: 14 * 24,
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

/** A finished run that is inside the age window, with what it amounted to. */
interface FinishedRun {
  outcome: ProviderRunOutcome;
  completedAt: Date;
}

/** The newest `sampleSize` finished runs no older than `maxAgeHours`, newest first. */
function sampleFinishedRuns(
  runs: ProviderRunSample[],
  options: ProviderRunHealthOptions,
  maxAgeHours: number,
  now: Date
): FinishedRun[] {
  const oldestCounted = now.getTime() - maxAgeHours * 60 * 60 * 1000;
  return runs
    .flatMap((run) => {
      const outcome = classifyProviderRun(run);
      return outcome === null || run.completedAt === null || run.completedAt.getTime() < oldestCounted
        ? []
        : [{ outcome, completedAt: run.completedAt }];
    })
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, options.sampleSize);
}

function judgeSample(finished: FinishedRun[], options: ProviderRunHealthOptions): ProviderRunHealth {
  const count = (outcome: ProviderRunOutcome) => finished.filter((run) => run.outcome === outcome).length;
  const ok = count('ok');
  const empty = count('empty');
  const failed = count('failed');
  const summary = { sampled: finished.length, ok, empty, failed };
  const healthy = { degraded: false, reason: null, ...summary };

  if (finished.length === 0 || finished.length < options.minRuns || finished[0].outcome === 'ok') {
    return healthy;
  }
  if (failed / finished.length >= options.failedShare) {
    return finished[0].outcome === 'empty' ? healthy : { degraded: true, reason: 'VENDOR_FAILURE', ...summary };
  }
  if (ok === 0) {
    return { degraded: true, reason: 'ALL_EMPTY', ...summary };
  }
  return healthy;
}

/**
 * Whether a provider is currently failing, judged from its newest finished runs across all profiles
 * (IDEA-095, BUG-074 section 5). Unfinished runs are ignored.
 *
 * The newest finished run decides first, because a degraded provider is only ever sent a few probes (see
 * the backend's `provider-run-health-store`) and a probe's own result must be able to reopen it:
 * - a run that returned posts clears any degradation;
 * - a run the vendor did not fail (a success that found nothing new) clears a `VENDOR_FAILURE`: the
 *   vendor is answering, and a probe is as likely to land on a quiet account as on a busy one;
 * - only a run with posts clears `ALL_EMPTY`, since an empty run is exactly what that state is made of.
 *
 * Which runs are judged: the fresh ones (finished within `maxAgeHours`) when there are at least `minRuns`
 * of them. With fewer, the evidence is not thin, it is just spread out: a degraded provider only gets
 * its probes, about 3 a day, so after 3 days of probing the 72 hour window holds under `minRuns` runs
 * and a plain "too few runs, healthy" would trust the provider again and send it a whole batch while the
 * vendor is still down (2026-10-26). So the judgement then carries over to the newest runs up to
 * `carryOverMaxAgeHours` old, by the same rules, and a provider that was degraded stays degraded until a
 * probe clears it. A healthy provider with few runs still counts as healthy: the carry-over sample needs
 * `minRuns` runs too, and only a degraded verdict replaces the fresh one.
 */
export function evaluateProviderRunHealth(
  runs: ProviderRunSample[],
  options: ProviderRunHealthOptions = DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS,
  now: Date = new Date()
): ProviderRunHealth {
  const fresh = judgeSample(sampleFinishedRuns(runs, options, options.maxAgeHours, now), options);
  if (fresh.sampled >= options.minRuns || options.carryOverMaxAgeHours <= options.maxAgeHours) {
    return fresh;
  }
  const carriedOver = judgeSample(sampleFinishedRuns(runs, options, options.carryOverMaxAgeHours, now), options);
  return carriedOver.degraded ? carriedOver : fresh;
}
