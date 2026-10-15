// A cycle start further in the future than this can only come from a bad write (the pre-2026-10-05
// code stored `now + cycleDays` here). It is tolerated up to a few minutes so that clock skew between
// Lambdas -- one reading a start another just wrote as `now` -- never triggers a spurious reset.
export const CYCLE_START_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function isCycleElapsed(usageCycleResetAt: string, cycleDays: number, now: Date): boolean {
  const resetDate = new Date(usageCycleResetAt);
  const elapsedMs = now.getTime() - resetDate.getTime();
  // A start implausibly far in the future is corrupt: treat the cycle as elapsed so the next
  // usage write re-anchors it to `now` instead of the quota staying stuck until that date passes.
  if (elapsedMs < -CYCLE_START_FUTURE_TOLERANCE_MS) return true;
  const cycleMs = cycleDays * 24 * 60 * 60 * 1000;
  return elapsedMs >= cycleMs;
}

/**
 * Returns `now + cycleDays` -- a FUTURE "next reset" time. Do NOT store this in a column that
 * `isCycleElapsed` reads: that function treats the stored value as the cycle START, so storing
 * a future time here makes the following cycle last 2x `cycleDays`. Store `now` instead.
 */
export function nextCycleReset(now: Date, cycleDays: number): string {
  const nextReset = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);
  return nextReset.toISOString();
}
