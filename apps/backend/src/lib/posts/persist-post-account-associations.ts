import { db } from '../../db/client.js';
import { postAccountAssociations } from '@festgrid/database';
import type { PostAccountRole } from '@festgrid/domain/posts';

interface PersistPostAccountAssociationsParams {
  postId: string;
  scrapingAccountId: string;
  publisherAccountId?: string;
  coauthorAccountIds?: string[];
  scraperActorRunId?: string;
}

interface AssociationCandidate {
  accountId: string;
  role: PostAccountRole;
}

/**
 * Writes `post_account_associations` rows for a persisted post (Story 3.15 AC2/AC4).
 *
 * Always writes one `SCRAPING_SOURCE` row (the account the scrape ran under -- always
 * knowable, every vendor); additionally writes one `PUBLISHER` row and one `COAUTHOR`
 * row per coauthor when the corresponding resolved profile id is given. A
 * `SCRAPING_SOURCE` row and a `PUBLISHER` row may legitimately name the same account
 * (two independent rows, two roles) -- the base 3-column unique constraint is keyed on
 * role, not just (post, account).
 *
 * Each row is inserted independently via a **bare** `onConflictDoNothing()` (no
 * `target`), which is deliberate: a conflicting second `PUBLISHER` row violates the partial unique index
 * `idx_post_account_associations_one_publisher_per_post`, not the 3-column `(post_id, account_id, role)`
 * unique, and a `target`-scoped call would not suppress it. A bare `onConflictDoNothing()` suppresses a
 * conflict on *any* unique constraint, which makes that case a silent no-op rather than a thrown error.
 *
 * Every account whose scrape returned the post gets its own `SCRAPING_SOURCE` row (AD-25 Rule 2, amended
 * 2026-11-26): the one-scraping-source-per-post index was dropped, so a second account's scrape of a stored post
 * links it to that account (its cursor advances, its subscribers see the post). A repeat by the same account
 * is a no-op through the 3-column unique.
 *
 * Each insert is additionally wrapped in its own try/catch (log, don't rethrow), matching
 * Story 3.14's established per-identity resilience pattern (`processDiscoveredIdentities`)
 * -- so one row's unexpected failure never blocks the others or the caller. No transaction
 * wrapping, matching this file's sibling `persist-scraped-post.ts`'s existing
 * non-transactional, idempotent-by-constraint style.
 */
export async function persistPostAccountAssociations({
  postId,
  scrapingAccountId,
  publisherAccountId,
  coauthorAccountIds,
  scraperActorRunId,
}: PersistPostAccountAssociationsParams): Promise<void> {
  const candidates: AssociationCandidate[] = [{ accountId: scrapingAccountId, role: 'SCRAPING_SOURCE' }];

  if (publisherAccountId) {
    candidates.push({ accountId: publisherAccountId, role: 'PUBLISHER' });
  }

  if (coauthorAccountIds && coauthorAccountIds.length > 0) {
    for (const coauthorAccountId of coauthorAccountIds) {
      candidates.push({ accountId: coauthorAccountId, role: 'COAUTHOR' });
    }
  }

  for (const candidate of candidates) {
    try {
      await db
        .insert(postAccountAssociations)
        .values({
          postId,
          accountId: candidate.accountId,
          role: candidate.role,
          scraperActorRunId,
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error(
        `Failed to persist post_account_associations row for post ${postId}, account ${candidate.accountId}, role ${candidate.role}`,
        err
      );
    }
  }
}
