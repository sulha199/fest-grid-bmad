export interface ScraperAccountRef {
  accountId: string;
  username: string;
}

export interface ScrapedPost {
  content: string;
  imageUrl?: string;
  postUrl: string;
  originalPostUrl?: string;
  publishedAt: string;
}

export interface AccountProfileLookupResult {
  accountId: string;
  displayName: string;
  username: string;
  profileImageUrl?: string;
}

export class ScraperCapacityExceededError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ScraperCapacityExceededError';
  }
}

export interface ScraperAdapter {
  getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]>;
  lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null>;
  getPostByUrl(url: string): Promise<ScrapedPost | null>;
}
