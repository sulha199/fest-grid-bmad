import { eq, or } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { selectApiKey } from '@festgrid/domain/ai-gateway';
import { reextractPostInputKey, reextractUrlInputKey } from '@festgrid/domain/jobs';
import { detectPlatformFromUrl } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';
import { fetchCandidateKeys } from '../ai-gateway/usage-store.js';
import { startReextractPostJob } from './start-reextract-post-job.js';

// AD-40 -- starts a moderator re-extract preview. The caller (the resolver) has already enforced `requireModerator`. Nothing here
// writes to `posts` or `events`.
//
// Story 10.6: EVERY re-extract is the engine job `reextract-post` (image refresh and caption fetch in the Scraper Lambda, then the
// preview in the AI-processor Lambda; `start-reextract-post-job.ts`): a stored post with its caption, a stored post whose caption is
// not stored (a curator post's is cleared on purpose) and a URL that is not in the database. The caption a fetch has to supply is held
// on the job only between the two phases (`held-post.ts`). This function only validates and finds the target; the old direct rescrape
// and its `manual_extraction_jobs` row are gone (rows written before this story are still read and applied, see `reextract-preview-job.ts`).

export type PreviewStartErrorCode =
  | 'NOT_FOUND'
  | 'UNSUPPORTED_PLATFORM'
  | 'NO_API_KEY'
  | 'SCRAPE_FAILED'
  | 'RATE_LIMITED'
  | 'ACCOUNT_NOT_SCRAPABLE'
  | 'SCRAPE_IN_PROGRESS'
  | 'CHAIN_IN_FLIGHT'
  | 'EXTRACTION_FAILED';

export type StartPostReextractionPreviewResult =
  | { jobId: string }
  | { errorCode: PreviewStartErrorCode; errorMessage: string };

export interface StartPostReextractionPreviewInput {
  postId?: string | null;
  url?: string | null;
  now?: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startPostReextractionPreview(
  userId: string,
  input: StartPostReextractionPreviewInput
): Promise<StartPostReextractionPreviewResult> {
  if (input.postId && !UUID_PATTERN.test(input.postId)) {
    return { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' };
  }

  const [post] = input.postId
    ? await db.select().from(posts).where(eq(posts.id, input.postId)).limit(1)
    : await db
        .select()
        .from(posts)
        .where(or(eq(posts.postUrl, input.url!), eq(posts.originalPostUrl, input.url!)))
        .limit(1);

  if (input.postId && !post) {
    return { errorCode: 'NOT_FOUND', errorMessage: 'Post not found.' };
  }

  // AD-51 Rule 4: a post whose stepped extraction is still running (it holds a cursor) is refused, so a preview cannot race
  // the chain for the post's images, ordinals and scrape budget.
  if (post && post.extractionCursor !== null) {
    return { errorCode: 'CHAIN_IN_FLIGHT', errorMessage: 'This post is still being extracted in steps. Try again when that has finished.' };
  }

  if (post) {
    return startReextractPostJob(
      userId,
      { inputKey: reextractPostInputKey(post.id), payload: { postId: post.id } },
      input.now
    );
  }

  // A URL that is not in the database: the job fetches the post (caption included), previews it with no account signal and stores nothing.
  const url = input.url!;
  if (!detectPlatformFromUrl(url)) {
    return { errorCode: 'UNSUPPORTED_PLATFORM', errorMessage: 'This URL is not from a supported platform.' };
  }
  // No subscriber fallback for a post we do not know: the moderator needs a Gemini key of their own (same pre-check as the correction flow).
  const candidates = await fetchCandidateKeys('gemini', [userId]);
  if (!selectApiKey(candidates, 'TIER_1_USER_SPECIFIC')) {
    return { errorCode: 'NO_API_KEY', errorMessage: 'Contribute your own Gemini API key to use this feature.' };
  }
  return startReextractPostJob(userId, { inputKey: reextractUrlInputKey(url), payload: { url } }, input.now);
}
