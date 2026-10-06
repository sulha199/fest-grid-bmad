/**
 * Story 3.6v's `mergeSchedules` (set-event-primary-post.ts) and Story 3.6w's `mergeEvents`
 * (merge-events.ts) both need to answer the exact same question -- "does one of these existing
 * schedules already cover this date" -- before deciding to update/repoint an existing schedule
 * vs. insert a new one. Extracted here once (Story 3.6w Dev Notes, "Reuse, not duplicate")
 * instead of two divergent implementations.
 */
export function findScheduleByStartDate<T extends { id: string; eventStartDate: string }>(
  candidates: T[],
  eventStartDate: string,
  excludeIds: Set<string> = new Set()
): T | undefined {
  return candidates.find((s) => s.eventStartDate === eventStartDate && !excludeIds.has(s.id));
}
