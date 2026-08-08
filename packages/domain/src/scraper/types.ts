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

export interface ScraperAdapter {
  getNewestPosts(account: ScraperAccountRef): Promise<ScrapedPost[]>;
  lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null>;
}
