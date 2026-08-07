export function isCycleElapsed(usageCycleResetAt: string, cycleDays: number, now: Date): boolean {
  const resetDate = new Date(usageCycleResetAt);
  const elapsedMs = now.getTime() - resetDate.getTime();
  const cycleMs = cycleDays * 24 * 60 * 60 * 1000;
  return elapsedMs >= cycleMs;
}

export function nextCycleReset(now: Date, cycleDays: number): string {
  const nextReset = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);
  return nextReset.toISOString();
}
