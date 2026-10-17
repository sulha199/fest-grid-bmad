/**
 * Story 3.6o / Architecture Spine AD-28 Rule 2 -- the one-time relevance gate for building a
 * face-blurred durable thumbnail. A thumbnail is only worth building when the event is still
 * relevant after the original hotlinked image expires: if the latest schedule ends before
 * `posts.imageUrlExpiresAt`, the original is served until the event is over and a thumbnail
 * would never be shown.
 *
 * Fails open (AD-12 Rule 3's "null is already-expired" convention): an unknown expiry or an
 * unknown/unparseable schedule end can never prove the thumbnail is unnecessary, so the answer is
 * `true`. Shared by the extraction pipeline (`processAiJob`) and the thumbnail backfill so the two
 * can never drift on what "relevant" means.
 */
export function isThumbnailStillRelevant(imageUrlExpiresAt: Date | null, latestScheduleEnd: Date | null): boolean {
  return imageUrlExpiresAt === null || latestScheduleEnd === null || latestScheduleEnd > imageUrlExpiresAt;
}
