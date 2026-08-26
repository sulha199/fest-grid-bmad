export interface ScraperAccountRef {
  accountId: string;
  username: string;
}

export interface ScrapedPost {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  postUrl: string;
  originalPostUrl?: string;
  publishedAt: string;
  locationName?: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
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

export class ApifyRequestTimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ApifyRequestTimeoutError';
  }
}

export interface ScraperAdapter {
  getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]>;
  lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null>;
  getPostByUrl(url: string): Promise<ScrapedPost | null>;
  /**
   * True when the underlying scraper actor reliably filters `getNewestPosts` server-side by
   * both `newerThan` and a result-count limit in a single call. Callers use this to decide
   * whether the new-subscribe path can fetch once with the widest lookback window, or must
   * fall back to retrying with progressively wider windows to accumulate enough posts.
   */
  supportsNewerThanAndLimitFiltering: boolean;
}
