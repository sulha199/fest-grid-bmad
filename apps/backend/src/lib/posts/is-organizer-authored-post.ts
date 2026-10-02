import { and, eq, inArray } from 'drizzle-orm';
import { postAccountAssociations, posts, socialMediaAccountProfiles } from '@festgrid/database';
import { db } from '../../db/client.js';
import type { DbExecutor } from '../events/set-event-primary-post.js';

/**
 * AD-31 Rule 3's organizer-authored predicate -- the shared domain function every consumer
 * (AD-30 Rule 7's primary-post rule, the stub marker, and the first-organizer-post notification)
 * is required to call rather than re-deriving its own test. Built here as its first consumer
 * (Story 3.6r, AC4) -- confirmed by source search that no prior implementation exists, and that
 * Story 3.15 (AD-31's own text names as the predicate's likely first extender) never actually
 * built it either (its own "Out of Scope" section defers it to "whichever of Stories
 * 3.6s/3.6t/3.6v needs it first" -- this story is the one that needs it first, via AC4).
 *
 * A post is organizer-authored iff it has a PUBLISHER or COAUTHOR association whose account is
 * not curator-typed. Curator-typed means accountType = 'CURATOR_GUIDE', whether CONFIRMED or
 * AWAITING_APPROVAL (conservative: a misread curator must not become a primary or fire a
 * notification). A NULL accountType is NOT curator-typed -- `accountType !== 'CURATOR_GUIDE'`
 * already has the correct semantics in TypeScript (`null !== 'CURATOR_GUIDE'` is `true`), no
 * special-casing needed. SCRAPING_SOURCE never counts as authorship, and is excluded by the
 * role filter itself.
 *
 * Legacy fallback: if the post has no PUBLISHER/COAUTHOR row at all (only
 * PUBLISHER_UNKNOWN/SCRAPING_SOURCE, or genuinely none), falls back to `posts.accountId` joined
 * to `social_media_account_profiles`, with the same curator test.
 */
export async function isOrganizerAuthoredPost(postId: string, executor: DbExecutor = db): Promise<boolean> {
  const associationRows = await executor
    .select({ accountType: socialMediaAccountProfiles.accountType })
    .from(postAccountAssociations)
    .innerJoin(socialMediaAccountProfiles, eq(postAccountAssociations.accountId, socialMediaAccountProfiles.id))
    .where(and(eq(postAccountAssociations.postId, postId), inArray(postAccountAssociations.role, ['PUBLISHER', 'COAUTHOR'])));

  if (associationRows.length > 0) {
    return associationRows.some((row) => row.accountType !== 'CURATOR_GUIDE');
  }

  // Legacy fallback -- no PUBLISHER/COAUTHOR association row at all.
  const [fallbackRow] = await executor
    .select({ accountType: socialMediaAccountProfiles.accountType })
    .from(posts)
    .innerJoin(socialMediaAccountProfiles, eq(posts.accountId, socialMediaAccountProfiles.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!fallbackRow) {
    return false;
  }

  return fallbackRow.accountType !== 'CURATOR_GUIDE';
}
