/**
 * Closed role vocabulary for `post_account_associations` rows (Story 3.15, PRD §4.7a,
 * Architecture Spine AD-25/AD-31). Declared once per AD-31 Rule 2.
 */
export const POST_ACCOUNT_ROLES = ['PUBLISHER', 'COAUTHOR', 'SCRAPING_SOURCE', 'PUBLISHER_UNKNOWN'] as const;
export type PostAccountRole = (typeof POST_ACCOUNT_ROLES)[number];

/**
 * Closed set for posts.grouping_reason (Architecture Spine AD-30 Rule 1/5, Story 3.6r). Set by
 * the multi-event extraction payload's post-level `groupingReason` (Story 3.6s) -- this story
 * only adds the persisted column/enum the field will eventually populate.
 */
export const POST_GROUPING_REASONS = ['single-event', 'program-lineup', 'dependent-stages', 'separate-events', 'roundup'] as const;
export type PostGroupingReason = (typeof POST_GROUPING_REASONS)[number];

export interface ProcessingJobMessage {
  postId: string;
  accountId: string;
  content: string;
  imageUrl?: string;
  postUrl: string;
  publishedAt: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
  /**
   * Image URLs of every slide in a multi-image (carousel/Sidecar) Instagram post, in slide order
   * (excluding the cover, which is `imageUrl`). Purely an extraction-time input for the AI
   * processing step; never displayed in any UI. Story 3.6l consumes this to build a multi-image
   * Gemini request.
   */
  additionalImageUrls?: string[];
}

export class PostNotFoundError extends Error {
  constructor(message?: string) {
    super(message || 'Post not found');
    this.name = 'PostNotFoundError';
  }
}

export class PostAlreadyExtractedError extends Error {
  constructor(message?: string) {
    super(message || 'Post has already been extracted');
    this.name = 'PostAlreadyExtractedError';
  }
}
