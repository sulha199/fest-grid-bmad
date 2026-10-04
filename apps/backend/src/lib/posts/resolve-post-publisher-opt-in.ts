import { and, eq } from 'drizzle-orm';
import { postAccountAssociations, socialMediaAccountProfiles } from '@festgrid/database';
import { db } from '../../db/client.js';
import type { DbExecutor } from '../events/set-event-primary-post.js';

/**
 * Story 3.20 (AC2, Task 2) -- whether the post's PUBLISHER account (`post_account_associations`,
 * AD-31) has opted in to image storage, read via a fresh, dedicated query. **Never** `PUBLISHER_UNKNOWN`
 * -- an unverified publisher counts as NOT opted in. A co-author's own opt-in is never consulted:
 * only the row whose `role = 'PUBLISHER'` matters.
 *
 * This is a **deliberately different, stricter** read than `processAiJob`'s existing
 * `isOptedIntoImageStorage` check (sourced from `message.accountId` = `posts.accountId`, used for
 * the pre-existing Story 3.6e rehost gate). `persist-scraped-post.ts` writes
 * `posts.accountId = publisherProfileId ?? accountId`, falling back to the **scraping** account
 * when no publisher resolved -- so `posts.accountId` is not reliably the PUBLISHER. Reusing that
 * read here would let a scraping account's own opt-in unblur a post it did not actually publish,
 * a privacy regression this story must not introduce. The two reads are intentionally not unified.
 *
 * The partial unique index `idx_post_account_associations_one_publisher_per_post`
 * (`role IN ('PUBLISHER', 'PUBLISHER_UNKNOWN')`, `packages/database/schema.ts`) guarantees at most
 * one `PUBLISHER` row can exist per post, so no `.limit(1)` disambiguation is needed beyond what
 * that index already enforces.
 *
 * Fails safe: no `PUBLISHER` row (co-author-only, `PUBLISHER_UNKNOWN`, or no association rows at
 * all) or a thrown query error both resolve to `false` (not opted in -> blurred).
 */
export async function resolvePostPublisherOptIn(postId: string, executor: DbExecutor = db): Promise<boolean> {
  try {
    const [row] = await executor
      .select({ isImageStorageOptedIn: socialMediaAccountProfiles.isImageStorageOptedIn })
      .from(postAccountAssociations)
      .innerJoin(socialMediaAccountProfiles, eq(postAccountAssociations.accountId, socialMediaAccountProfiles.id))
      .where(and(eq(postAccountAssociations.postId, postId), eq(postAccountAssociations.role, 'PUBLISHER')))
      .limit(1);

    return row?.isImageStorageOptedIn ?? false;
  } catch (error) {
    // Fail safe (blur) but never silently: a persistent DB fault would otherwise blur every
    // post, including opted-in publishers', with no operator signal.
    console.error(`[resolvePostPublisherOptIn] opt-in lookup failed for post ${postId}; treating as not opted in:`, error);
    return false;
  }
}
