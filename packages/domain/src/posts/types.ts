export interface ProcessingJobMessage {
  postId: string;
  accountId: string;
  content: string;
  imageUrl?: string;
  postUrl: string;
  publishedAt: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
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
