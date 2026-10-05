import { hasAvailableApiKeyForAccount } from './has-available-api-key-for-account.js';
import { enqueuePostForProcessing } from './enqueue-post-for-processing.js';

/**
 * Story 3.6z (AC1) — automatically enqueue a genuinely new post for extraction, subject to a
 * read-only pre-flight key-availability check. Shared by every scrape-result persister
 * (the SQS-fallback `processScrapeJob` and the Bright Data / Apify async webhook processors,
 * which the stale-job sweep also reuses) so no ingestion path can persist a post without
 * considering it for extraction. The async paths were missed when Story 3.6z wired this only
 * into `processScrapeJob`, and prod's daily batch uses the async paths almost exclusively.
 *
 * Never throws: one post's failure here must never stop the caller's loop or fail its job.
 *
 * `post.accountId` is the persisted row's resolved account, not the scraping target:
 * `persistScrapedPost` can attribute a post to a different canonical publisher account for
 * coauthor/repost cases (Stories 3.13/3.14), so the key-availability check must ask about the
 * account the post actually ended up attributed to.
 */
export async function autoEnqueueNewPostForExtraction(
  { post, alreadyExisted }: { post: { id: string; accountId: string }; alreadyExisted: boolean },
  source: string
): Promise<void> {
  if (alreadyExisted) {
    return;
  }

  try {
    const hasKey = await hasAvailableApiKeyForAccount(post.accountId);
    if (hasKey) {
      await enqueuePostForProcessing(post.id);
    }
  } catch (autoEnqueueErr) {
    console.error(
      `[${source}] auto-enqueue failed for post ${post.id} (account ${post.accountId}):`,
      autoEnqueueErr
    );
  }
}
