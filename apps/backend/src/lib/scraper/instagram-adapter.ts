import { ScraperAdapter, ScraperAccountRef, ScrapedPost, AccountProfileLookupResult } from '@festgrid/domain';
import { isProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { loadBackendEnv } from '../../env.js';

export let callApifyActor = async (input: object): Promise<any[]> => {
  const env = loadBackendEnv();
  if (!env.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }

  const response = await fetch(
    `https://api.apify.com/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items?token=${env.apifyApiToken}&timeout=120&format=json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    throw new Error(`Apify API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<any[]>;
};

export function setCallApifyActor(fn: typeof callApifyActor) {
  callApifyActor = fn;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const instagramScraperAdapter: ScraperAdapter = {
  async getPostByUrl(url: string): Promise<ScrapedPost | null> {
    const isAvailable = await isProviderCapacityAvailable('apify');
    if (!isAvailable) {
      console.warn(`Apify capacity threshold ratio reached. Skipping scrape for URL: ${url}`);
      return null;
    }

    const runCall = async (): Promise<ScrapedPost | null> => {
      const items = await callApifyActor({
        directUrls: [url],
        resultsType: 'posts',
        resultsLimit: 1,
      });

      if (!items || items.length === 0) {
        return null;
      }

      const item = items[0];
      const publishedAt = item.timestamp || item.pubDate || item.publishedAt || new Date().toISOString();
      const postUrl = item.url || item.postUrl || `https://www.instagram.com/p/${item.shortCode || item.id || ''}/`;

      const mapped: ScrapedPost = {
        content: item.caption || item.text || item.description || '',
        imageUrl: item.displayUrl || item.imageUrl || undefined,
        postUrl,
        originalPostUrl: item.url || item.postUrl || undefined,
        publishedAt,
      };

      await recordProviderUsage('apify', 1);
      return mapped;
    };

    return withTimeout(runCall(), 20000);
  },

  async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
    const env = loadBackendEnv();
    const isAvailable = await isProviderCapacityAvailable('apify');
    if (!isAvailable) {
      console.warn(`Apify capacity threshold ratio reached. Skipping scrape batch for account: ${account.username}`);
      return [];
    }

    try {
      const url = `https://www.instagram.com/${account.username}/`;
      const input: any = {
        directUrls: [url],
        resultsType: 'posts',
        resultsLimit: env.scrapeResultsLimit,
      };

      if (options?.newerThan) {
        input.onlyPostsNewerThan = options.newerThan;
      }

      const items = await callApifyActor(input);

      const mappedPosts: ScrapedPost[] = items.map((item: any) => {
        const publishedAt = item.timestamp || item.pubDate || item.publishedAt || new Date().toISOString();
        const postUrl = item.url || item.postUrl || `https://www.instagram.com/p/${item.shortCode || item.id || ''}/`;
        return {
          content: item.caption || item.text || item.description || '',
          imageUrl: item.displayUrl || item.imageUrl || undefined,
          postUrl,
          originalPostUrl: item.url || item.postUrl || undefined,
          publishedAt,
        };
      });

      if (items.length > 0) {
        await recordProviderUsage('apify', items.length);
      }

      return mappedPosts;
    } catch (err) {
      console.error(`Instagram Scraper Adapter error fetching posts for ${account.username}:`, err);
      throw err;
    }
  },

  async lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null> {
    const isAvailable = await isProviderCapacityAvailable('apify');
    if (!isAvailable) {
      console.warn(`Apify capacity threshold ratio reached. Skipping profile lookup for: ${handleOrUrl}`);
      return null;
    }

    try {
      const url = handleOrUrl.startsWith('http') ? handleOrUrl : `https://www.instagram.com/${handleOrUrl}/`;
      const items = await callApifyActor({
        directUrls: [url],
        resultsType: 'details',
        resultsLimit: 1,
      });

      if (!items || items.length === 0) {
        return null;
      }

      const item = items[0];
      const result: AccountProfileLookupResult = {
        accountId: item.id || item.username || '',
        displayName: item.fullName || item.displayName || item.name || item.username || '',
        username: item.username || '',
        profileImageUrl: item.profilePicUrl || item.profileImageUrl || undefined,
      };

      await recordProviderUsage('apify', 1);

      return result;
    } catch (err) {
      console.error(`Instagram Scraper Adapter error looking up profile for ${handleOrUrl}:`, err);
      throw err;
    }
  },
};
