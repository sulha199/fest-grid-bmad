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
