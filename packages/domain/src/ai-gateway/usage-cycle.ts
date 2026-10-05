export function isCycleElapsed(usageCycleResetAt: string, cycleDays: number, now: Date): boolean {
  const resetDate = new Date(usageCycleResetAt);
  const elapsedMs = now.getTime() - resetDate.getTime();
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
