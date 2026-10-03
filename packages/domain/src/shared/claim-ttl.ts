/**
 * Pure helpers for an atomic, TTL-bounded DB claim column -- generic, cross-entity
 * date math with no entity-specific type in either signature. Originally built for
 * `enqueuePostForProcessing`'s claim on `posts.queued_for_extraction_at` (Story 3.6z,
 * AC3); relocated here from `packages/domain/src/posts/claim-ttl.ts` (Story 3.16, Task 2)
 * once a second entity (`social_media_account_profiles.classification_claimed_at`) needed
 * the identical mechanism, per project-context.md's rule that a generic, cross-entity
 * mechanism belongs in a generic subfolder, not nested under one entity's folder. Mirrors
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
 * Precondition: callers only invoke this when a claim actually exists (i.e. the claim
 * column is non-null) -- a not-yet-claimed row is out of scope for this function and is
 * never passed in.
 */
export function isClaimExpired(claimedAt: string, ttlMinutes: number, now: Date): boolean {
  const cutoff = computeClaimCutoff(ttlMinutes, now);
  const claimedAtDate = new Date(claimedAt);
  return claimedAtDate.getTime() < cutoff.getTime();
}
