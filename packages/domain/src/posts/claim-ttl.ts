/**
 * Pure helpers for `enqueuePostForProcessing`'s atomic, TTL-bounded claim on
 * `posts.queued_for_extraction_at` (Story 3.6z, AC3). Mirrors
 * `packages/domain/src/ai-gateway/usage-cycle.ts`'s `nextCycleReset`/`isCycleElapsed`
 * pair in shape and style.
 */

/**
 * The threshold a stored claim timestamp must be *older than* to count as expired.
 */
export function computeClaimCutoff(ttlMinutes: number, now: Date): Date {
  return new Date(now.getTime() - ttlMinutes * 60 * 1000);
}

/**
 * `true` when the claim is older than the TTL cutoff (i.e. reclaimable).
 *
 * Precondition: callers only invoke this when a claim actually exists (i.e.
 * `queuedForExtractionAt` is non-null) -- a not-yet-claimed post is out of scope for this
 * function and is never passed in.
 */
export function isClaimExpired(queuedForExtractionAt: string, ttlMinutes: number, now: Date): boolean {
  const cutoff = computeClaimCutoff(ttlMinutes, now);
  const claimedAt = new Date(queuedForExtractionAt);
  return claimedAt.getTime() < cutoff.getTime();
}
