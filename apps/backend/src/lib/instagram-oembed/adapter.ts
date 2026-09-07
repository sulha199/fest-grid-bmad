import { getCachedEmbed, setCachedEmbed } from './cache-store.js';
import { InstagramOEmbedAdapterResult } from './types.js';

// Chosen because oEmbed content for a given Instagram post is effectively static day-to-day
// and even a single request per event-detail view stays trivially under Meta's ~1,000
// req/hour tokenless budget. Not mandated by any AC; safe to tune later.
export const INSTAGRAM_OEMBED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const INSTAGRAM_OEMBED_ENDPOINT = 'https://graph.facebook.com/v25.0/instagram_oembed';

/**
 * Resolves a post URL to its Instagram oEmbed HTML via Meta's tokenless oEmbed endpoint
 * (Meta reversed the access-token requirement 2026-06-15). Best-effort, non-throwing:
 * any non-2xx response, malformed JSON, missing/empty `html`, network error, or thrown
 * exception resolves to `{ status: 'UNAVAILABLE' }` rather than propagating -- mirroring
 * rehostPostImage's failure-handling pattern (log via console.error, never throw).
 */
export async function resolveInstagramOEmbed(postUrl: string): Promise<InstagramOEmbedAdapterResult> {
  const cached = await getCachedEmbed(postUrl);
  if (cached) {
    return cached;
  }

  let result: InstagramOEmbedAdapterResult;
  try {
    const url = `${INSTAGRAM_OEMBED_ENDPOINT}?url=${encodeURIComponent(postUrl)}`;
    const response = await fetch(url);

    if (!response.ok) {
      result = { status: 'UNAVAILABLE' };
    } else {
      const body = await response.json();
      const html = body?.html;
      result = typeof html === 'string' && html.length > 0
        ? { status: 'AVAILABLE', html }
        : { status: 'UNAVAILABLE' };
    }
  } catch (error) {
    console.error(`Instagram oEmbed resolution failed for post URL ${postUrl}:`, error);
    result = { status: 'UNAVAILABLE' };
  }

  await setCachedEmbed(postUrl, result, INSTAGRAM_OEMBED_CACHE_TTL_MS);

  return result;
}
