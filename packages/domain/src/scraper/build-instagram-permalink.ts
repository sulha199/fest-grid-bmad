/**
 * Reconstructs the canonical Instagram permalink from a post's type/id segments alone -- the
 * mirror image of `parse-platform-post-identity.ts` (URL -> id/type; this goes id/type -> URL).
 *
 * Uses the same canonical `www.instagram.com` + trailing-slash form already used by
 * `resolveInstagramOEmbed`'s own test fixtures and `build-gemini-request.live-carousel.test.ts`'s
 * real captured permalink (e.g. `https://www.instagram.com/p/DcntzF0mB7z/`).
 */
export function buildInstagramPermalink(platformPostType: string, platformPostId: string): string {
  return `https://www.instagram.com/${platformPostType}/${platformPostId}/`;
}
