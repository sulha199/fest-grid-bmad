import { ApifyApiError, ApifyClient } from 'apify-client';
import { ScraperAdapter, ScraperAccountRef, ScrapedPost, AccountProfileLookupResult, ApifyRequestTimeoutError } from '@festgrid/domain';
import { assertProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { loadBackendEnv } from '../../env.js';

const GET_POST_BY_URL_ACTOR = 'apify/instagram-post-scraper';
const LOOKUP_ACCOUNT_PROFILE_ACTOR = 'apify/instagram-post-scraper';
const GET_NEWEST_POSTS_ACTOR = 'apify/instagram-post-scraper';

function normalizeApifyError(err: unknown, context: string): Error {
  if (err instanceof ApifyApiError) {
    const detail = err.data && typeof err.data === 'object' && 'error' in err.data && err.data.error && typeof err.data.error === 'object' && 'message' in err.data.error
      ? String((err.data as any).error.message)
      : err.message;

    return new Error(`Apify request failed while ${context}: ${detail}`);
  }

  if (err instanceof Error) {
    return new Error(`Apify request failed while ${context}: ${err.message}`);
  }

  return new Error(`Apify request failed while ${context}`);
}

export function getApifyClient(): ApifyClient {
  const env = loadBackendEnv();
  if (!env.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }
  return new ApifyClient({ token: env.apifyApiToken });
}

export let callApifyActor = async (input: object, actorId: string): Promise<any[]> => {
  const client = getApifyClient();
  const run = await client.actor(actorId).call(input as Record<string, unknown>);

  const datasetId = run.defaultDatasetId;
  if (!datasetId) {
    return [];
  }

  const { items } = await client.dataset(datasetId).listItems({ clean: true, limit: 1000 });
  return items as any[];
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

function withTimeoutOrThrow<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ApifyRequestTimeoutError(message));
    }, ms);

    promise
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Maps an Apify item to a ScrapedPost.
 */
export function mapApifyItemToScrapedPost(item: any): ScrapedPost {
  const publishedAt = item.timestamp || item.pubDate || item.publishedAt || new Date().toISOString();
  const postUrl = item.url || item.postUrl || `https://www.instagram.com/p/${item.shortCode || item.id || ''}/`;

  return {
    content: item.caption || item.text || item.description || '',
    imageUrl: item.displayUrl || item.imageUrl || undefined,
    postUrl,
    originalPostUrl: item.url || item.postUrl || undefined,
    publishedAt,
  };
}

/**
 * Detects Apify 'not found' responses.
 * Returns true if the item represents a not‑found error based on response shape and kind.
 * Kind determines which fields are required for a valid response.
 */
function isNotFoundItem(item: any, kind: 'post' | 'profile'): boolean {
  if (!item) return false;

  // Primary check: Apify returns error as a string field for not-found cases.
  if (item.error === 'not_found') {
    return true;
  }

  // Fallback: item lacks the fields a real result must have.
  // For posts: must have both caption AND timestamp
  // For profiles: must have both fullName AND biography
  if (kind === 'post') {
    if (!item.caption && !item.timestamp) {
      return true;
    }
  } else if (kind === 'profile') {
    if (!item.fullName && !item.biography) {
      return true;
    }
  }

  return false;
}

export const instagramScraperAdapter: ScraperAdapter = {
  async getPostByUrl(url: string): Promise<ScrapedPost | null> {
    await assertProviderCapacityAvailable('apify', `URL ${url}`);

    const runCall = async (): Promise<ScrapedPost | null> => {
      try {
        const items = await callApifyActor({
          directUrls: [url],
          resultsType: 'posts',
          resultsLimit: 1,
        }, GET_POST_BY_URL_ACTOR);

        if (!items || items.length === 0) {
          return null;
        }

        const item = items[0];
        if (isNotFoundItem(item, 'post')) {
          return null;
        }

        const mapped = mapApifyItemToScrapedPost(item);
        await recordProviderUsage('apify', 1);
        return mapped;
      } catch (err) {
        throw normalizeApifyError(err, `fetching post by URL ${url}`);
      }
    };

    return withTimeout(runCall(), 20000);
  },

  async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
    const env = loadBackendEnv();
    await assertProviderCapacityAvailable('apify', `account ${account.username}`);

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

      const items = await callApifyActor(input, GET_NEWEST_POSTS_ACTOR);
      const mappedPosts = items.map(mapApifyItemToScrapedPost);

      if (items.length > 0) {
        await recordProviderUsage('apify', items.length);
      }

      return mappedPosts;
    } catch (err) {
      console.error(`Instagram Scraper Adapter error fetching posts for ${account.username}:`, err);
      throw normalizeApifyError(err, `fetching newest posts for ${account.username}`);
    }
  },

  async lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null> {
    await assertProviderCapacityAvailable('apify', `profile ${handleOrUrl}`);

    const runLookup = async (): Promise<AccountProfileLookupResult | null> => {
      try {
        const url = handleOrUrl.startsWith('http') ? handleOrUrl : `https://www.instagram.com/${handleOrUrl}/`;
        const items = await callApifyActor({
          directUrls: [url],
          resultsType: 'details',
          resultsLimit: 1,
        }, LOOKUP_ACCOUNT_PROFILE_ACTOR);

        if (!items || items.length === 0) {
          return null;
        }

        const item = items[0];
        if (isNotFoundItem(item, 'profile')) {
          return null;
        }
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
        throw normalizeApifyError(err, `looking up profile ${handleOrUrl}`);
      }
    };

    return withTimeoutOrThrow(runLookup(), 20000, 'Account profile lookup timed out');
  },
};
