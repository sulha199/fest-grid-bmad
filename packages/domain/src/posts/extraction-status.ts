import { computeClaimCutoff } from "../shared/claim-ttl.js";

/**
 * Where a post is in extraction, as shown on the manual extract screen (PRD 3.10, 2026-10-16).
 * Derived, never stored: the database holds only the facts below.
 */
export const POST_EXTRACTION_STATUSES = ["PENDING", "QUEUED", "EXTRACTING", "PROMOTED", "NOT_EVENT"] as const;
export type PostExtractionStatus = (typeof POST_EXTRACTION_STATUSES)[number];

export interface PostExtractionFacts {
  isExtracted: boolean;
  /** `posts.queued_for_extraction_at`: the live-claim marker set when the post is enqueued. */
  queuedForExtractionAt: Date | null;
  /** `posts.extraction_started_at`: set when the AI processor begins the post. */
  extractionStartedAt: Date | null;
  /** The extraction produced at least one event (counted from extractedEventCount or an event link). */
  hasEvent: boolean;
}

/**
 * - extracted: PROMOTED if it produced an event, else NOT_EVENT;
 * - not extracted and no live claim (never queued, or the claim outlived its TTL): PENDING, the only
 *   selectable status. A post whose extraction cannot finish therefore returns to PENDING once its
 *   claim expires;
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

  const claimedAt = facts.queuedForExtractionAt;
  if (claimedAt === null) {
    return "PENDING";
  }
  const cutoff = computeClaimCutoff(claimTtlMinutes, now);
  if (claimedAt.getTime() < cutoff.getTime()) {
    return "PENDING";
  }

  const startedAt = facts.extractionStartedAt;
  if (startedAt !== null && startedAt.getTime() >= claimedAt.getTime()) {
    return "EXTRACTING";
  }
  return "QUEUED";
}
