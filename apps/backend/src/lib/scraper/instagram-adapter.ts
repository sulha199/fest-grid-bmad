import { ApifyApiError, ApifyClient } from 'apify-client';
import { ScraperAdapter, ScraperAccountRef, ScrapedPost, AccountProfileLookupResult, ApifyRequestTimeoutError } from '@festgrid/domain';
import { assertProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { loadBackendEnv } from '../../env.js';
import { compileValidator } from '../../validation/validate.js';
import { scrapedPostSchema } from '../../validation/scraped-post.schema.js';
import { persistUnprocessedPayload } from '../posts/persist-unprocessed-payload.js';
import { recordSyncActorRun } from './record-actor-run.js';

// ============================================================================
// ACTOR INPUT TYPES
// ============================================================================

interface GetPostByUrlActorInput {
  directUrls: string[];
  resultsType: 'posts';
  resultsLimit: 1;
}

interface LookupAccountProfileActorInput {
  directUrls: string[];
  resultsType: 'details';
  resultsLimit: 1;
}

interface GetNewestPostsActorInput {
  username: string[];
  resultsType: 'posts';
  resultsLimit: number;
  onlyPostsNewerThan?: string;
}

// ============================================================================
// ACTOR OUTPUT TYPES — Raw responses from Apify
// ============================================================================

// Raw post item from Apify (multiple possible field names from different actor versions)
interface ApifyPostItem {
  url?: string;
  postUrl?: string;
  id?: string;
  shortCode?: string;
  caption?: string;
  text?: string;
  description?: string;
  timestamp?: string;
  pubDate?: string;
  publishedAt?: string;
  displayUrl?: string;
  imageUrl?: string;
  // Error response fields
  error?: string;
  errorDescription?: string;
}

// Raw profile item from Apify
interface ApifyProfileItem {
  id?: string;
  username?: string;
  fullName?: string;
  displayName?: string;
  name?: string;
  biography?: string;
  profilePicUrl?: string;
  profileImageUrl?: string;
  // Error response fields
  error?: string;
  errorDescription?: string;
}

// Use-case specific output types
type GetPostByUrlActorOutput = ApifyPostItem[];
type LookupAccountProfileActorOutput = ApifyProfileItem[];
type GetNewestPostsActorOutput = ApifyPostItem[];

// ============================================================================
// ACTOR REGISTRY — Maps actor ID to both input and output types
// ============================================================================

interface ActorRegistry {
  'apify/instagram-post-scraper': {
    input: GetPostByUrlActorInput | LookupAccountProfileActorInput | GetNewestPostsActorInput;
    output: GetPostByUrlActorOutput | LookupAccountProfileActorOutput | GetNewestPostsActorOutput;
  };
}

// Strict type extractors
type ActorId = keyof ActorRegistry;
type ActorInputFor<T extends ActorId> = ActorRegistry[T]['input'];
type ActorOutputFor<T extends ActorId> = ActorRegistry[T]['output'];

// Parser version — increment when output types change (tracks data schema evolution)
const APIFY_PARSER_VERSION = '3.4g';

const GET_POST_BY_URL_ACTOR = 'apify/instagram-post-scraper';
const LOOKUP_ACCOUNT_PROFILE_ACTOR = 'apify/instagram-post-scraper';
const GET_NEWEST_POSTS_ACTOR = 'apify/instagram-post-scraper';

// Compile validator once at module scope to avoid recompilation per item
const validateScrapedPost = compileValidator<ScrapedPost>(scrapedPostSchema);

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

export let getApifyClient = (): ApifyClient => {
  const env = loadBackendEnv();
  if (!env.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }
  return new ApifyClient({ token: env.apifyApiToken });
};

export function setGetApifyClient(fn: typeof getApifyClient) {
  getApifyClient = fn;
}

// Context for audit recording and run ID threading (set by callers that have profileId)
export let apifyAuditContext: { profileId: string; triggerMode: 'SYNC' | 'ASYNC'; runId?: string } | undefined;

export let callApifyActor = async <T extends ActorId>(actorId: T, input: ActorInputFor<T>): Promise<ActorOutputFor<T>> => {
  const client = getApifyClient();
  const run = await client.actor(actorId).call(input as unknown as Record<string, unknown>);

  const datasetId = run.defaultDatasetId;
  const items = datasetId
    ? (await client.dataset(datasetId).listItems({ clean: true, limit: 1000 })).items as ActorOutputFor<T>
    : ([] as ActorOutputFor<T>);

  // Record audit trail if context is set (sync path with profileId available)
  if (apifyAuditContext?.profileId) {
    const auditRunId = await recordSyncActorRun({
      vendor: 'APIFY',
      profileId: apifyAuditContext.profileId,
      runId: run.id,
      rawInput: input,
      status: run.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      rawOutput: items,
      itemCount: items.length,
      errorMessage: run.status === 'SUCCEEDED' ? undefined : `Run status: ${run.status}`,
    });
    // Store the recorded run ID in context for callers to thread to persist functions
    if (auditRunId && apifyAuditContext) {
      apifyAuditContext.runId = auditRunId;
    }
  }

  return items;
};

export function setCallApifyActor(fn: typeof callApifyActor) {
  callApifyActor = fn;
}

export function setApifyAuditContext(profileId: string, triggerMode: 'SYNC' | 'ASYNC'): void {
  apifyAuditContext = { profileId, triggerMode };
}

export function clearApifyAuditContext(): void {
  apifyAuditContext = undefined;
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
 * Maps an Apify item to a ScrapedPost and validates against schema.
 * Returns null if validation fails (after capturing the unprocessed payload).
 */
export async function mapApifyItemToScrapedPost(item: any): Promise<ScrapedPost | null> {
  const publishedAt = item.timestamp || item.pubDate || item.publishedAt || new Date().toISOString();
  const postUrl = item.url || item.postUrl || `https://www.instagram.com/p/${item.shortCode || item.id || ''}/`;
  const imageUrl = item.displayUrl || item.imageUrl;
  const originalPostUrl = item.url || item.postUrl;

  const candidate: ScrapedPost = {
    content: item.caption || item.text || item.description || '',
    postUrl,
    publishedAt,
    // Only include optional fields if they have values (avoid undefined, which fails nullable check)
    ...(imageUrl && { imageUrl }),
    ...(originalPostUrl && { originalPostUrl }),
  };

  const isValid = validateScrapedPost(candidate);
  if (!isValid) {
    console.error(`Apify item failed AJV validation:`, validateScrapedPost.errors);
    // Capture unprocessed payload before discarding
    try {
      await persistUnprocessedPayload({
        rawPayload: candidate,
        validationError: validateScrapedPost.errors,
        context: {
          source: 'apify',
          scraperVendor: 'instagram',
          accountId: null,
          postUrl,
          timestamp: new Date().toISOString(),
          parserVersion: APIFY_PARSER_VERSION,
        },
        scraperActorRunId: apifyAuditContext?.runId,
      });
    } catch (err) {
      console.error('Failed to persist unprocessed Apify payload:', err);
    }
    return null;
  }

  return candidate;
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
  // apify/instagram-post-scraper filters server-side on both onlyPostsNewerThan and
  // resultsLimit, so the new-subscribe path can fetch once instead of retrying windows.
  supportsNewerThanAndLimitFiltering: true,

  async getPostByUrl(url: string): Promise<ScrapedPost | null> {
    await assertProviderCapacityAvailable('apify', `URL ${url}`);

    const runCall = async (): Promise<ScrapedPost | null> => {
      try {
        const input: GetPostByUrlActorInput = {
          directUrls: [url],
          resultsType: 'posts',
          resultsLimit: 1,
        };
        const items = (await callApifyActor(GET_POST_BY_URL_ACTOR, input)) as GetPostByUrlActorOutput;

        if (!items || items.length === 0) {
          return null;
        }

        const item = items[0];
        if (isNotFoundItem(item, 'post')) {
          return null;
        }

        const post = await mapApifyItemToScrapedPost(item);
        if (!post) {
          return null;
        }

        await recordProviderUsage('apify', 1);
        return post;
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
      const input: GetNewestPostsActorInput = {
        username: [account.username],
        resultsType: 'posts',
        resultsLimit: env.scrapeResultsLimit,
        ...(options?.newerThan && { onlyPostsNewerThan: options.newerThan }),
      };

      const items = (await callApifyActor(GET_NEWEST_POSTS_ACTOR, input)) as GetNewestPostsActorOutput;
      const mappedResults = await Promise.all(items.map(mapApifyItemToScrapedPost));
      const mappedPosts = mappedResults.filter((post): post is ScrapedPost => post !== null);

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
        const input: LookupAccountProfileActorInput = {
          directUrls: [url],
          resultsType: 'details',
          resultsLimit: 1,
        };
        const items = (await callApifyActor(LOOKUP_ACCOUNT_PROFILE_ACTOR, input)) as LookupAccountProfileActorOutput;

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
