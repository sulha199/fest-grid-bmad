export interface EvalOutcome {
  /** Fixtures that got a live answer. */
  evaluated: number;
  driftedFixtures: number;
  driftedVariants: number;
  /** Set when the run ended early (call budget spent, per-day quota); the rest stays pending. */
  stoppedReason?: string;
  /** GOLDEN_EVAL_FAIL_ON_DRIFT=true: make drift itself fail the run. */
  failOnDrift?: boolean;
}

/**
 * Exit code for the live golden-prompt eval. Drift is the signal this eval exists to report, not a
 * malfunction of the eval, so it surfaces as `::warning::` annotations and leaves the run green:
 * the live model drifts on most nights, and a run that is always red hides the failures that need
 * action (a rejected request, a crash, a key that stopped working). A crash never gets here: it
 * propagates out of `main()` and fails the run on its own.
 *
 * What does fail the run: stopping before a single fixture was answered (a quota stop after some
 * answers is routine, one before the first leaves no signal at all), or `failOnDrift`.
 */
export function evalExitCode(outcome: EvalOutcome): 0 | 1 {
  if (outcome.stoppedReason !== undefined && outcome.evaluated === 0) return 1;
  if (outcome.failOnDrift && outcome.driftedFixtures + outcome.driftedVariants > 0) return 1;
  return 0;
}
