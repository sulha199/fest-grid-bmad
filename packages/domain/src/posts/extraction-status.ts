import { computeClaimCutoff } from "../shared/claim-ttl.js";

/**
 * Where a post is in extraction, as shown on the manual extract screen (PRD 3.10, 2026-10-16).
 * Derived, never stored: the database holds only the facts below.
 */
export const POST_EXTRACTION_STATUSES = [
  "PENDING",
  "QUEUED",
  "EXTRACTING",
  "ATTEMPT_FAILED",
  "PROMOTED",
  "NOT_EVENT",
] as const;
export type PostExtractionStatus = (typeof POST_EXTRACTION_STATUSES)[number];

export interface PostExtractionFacts {
  isExtracted: boolean;
  /** `posts.queued_for_extraction_at`: the live-claim marker set when the post is enqueued. */
  queuedForExtractionAt: Date | null;
  /** `posts.extraction_started_at`: set when the AI processor begins the post. */
  extractionStartedAt: Date | null;
  /** The extraction produced at least one event (counted from extractedEventCount or an event link). */
  hasEvent: boolean;
  /**
   * `posts.extraction_failure_reason` (AD-52 Rule 4): the situation of the last failed attempt; null when the
   * post never failed or has since succeeded. Required, so a caller cannot silently derive PENDING where the
   * SQL filter says ATTEMPT_FAILED.
   */
  extractionFailureReason: string | null;
  /**
   * `posts.extraction_cursor IS NOT NULL` (AD-47 Rule 5a): a stepped extraction is in flight. A cursor is a claim of
   * any age, so such a post is EXTRACTING whatever the claim timestamp says.
   */
  hasExtractionCursor: boolean;
}

/**
 * - extracted: PROMOTED if it produced an event, else NOT_EVENT;
 * - not extracted with a persisted cursor (a stepped extraction in flight): EXTRACTING, regardless of the claim age;
 * - not extracted, no live claim and a recorded failure reason (AD-52 Rule 6): ATTEMPT_FAILED, whether a
 *   retry is still pending or the attempts are spent. Selectable, like PENDING;
 * - not extracted and no live claim (never queued, or the claim outlived its TTL): PENDING, selectable. A post
 *   whose extraction cannot finish and recorded no failure therefore returns to PENDING once its claim expires;
 * - live claim and processing has begun since the claim was made: EXTRACTING;
 * - live claim otherwise: QUEUED.
 *
 * The comparison with `claimTtlMinutes` mirrors enqueuePostForProcessing's `< cutoff` reclaim test:
 * a claim exactly `ttl` old is still live.
 */
export function derivePostExtractionStatus(
  facts: PostExtractionFacts,
  claimTtlMinutes: number,
  now: Date
): PostExtractionStatus {
  if (facts.isExtracted) {
    return facts.hasEvent ? "PROMOTED" : "NOT_EVENT";
  }

  if (facts.hasExtractionCursor) {
    return "EXTRACTING";
  }

  const claimedAt = facts.queuedForExtractionAt;
  const noLiveClaim = (): PostExtractionStatus =>
    facts.extractionFailureReason != null ? "ATTEMPT_FAILED" : "PENDING";
  if (claimedAt === null) {
    return noLiveClaim();
  }
  const cutoff = computeClaimCutoff(claimTtlMinutes, now);
  if (claimedAt.getTime() < cutoff.getTime()) {
    return noLiveClaim();
  }

  const startedAt = facts.extractionStartedAt;
  if (startedAt !== null && startedAt.getTime() >= claimedAt.getTime()) {
    return "EXTRACTING";
  }
  return "QUEUED";
}
