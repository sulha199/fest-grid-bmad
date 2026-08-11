import { ScraperAdapter, ScraperAccountRef, ScrapedPost, AccountProfileLookupResult } from '@festgrid/domain';

export const twitterScraperAdapter: ScraperAdapter = {
  async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
    throw new Error('Twitter/X scraping is not yet implemented');
  },

  async lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null> {
    throw new Error('Twitter/X scraping is not yet implemented');
  },

  async getPostByUrl(url: string): Promise<ScrapedPost | null> {
    throw new Error('Twitter/X scraping is not yet implemented');
  },
};
