import { and, eq, ne, sql } from 'drizzle-orm';
import { eventPosts, events, posts } from '@festgrid/database';
import { isOrganizerAuthoredPost } from '../posts/is-organizer-authored-post.js';
import { setEventPrimaryPost, type DbExecutor } from './set-event-primary-post.js';

/**
 * AD-30 Rule 8 — deleting a post (including profile/account erasure) promotes the next linked
 * post to primary by the primary rule, else sets `events.postId` null.
 *
 * **No caller of this function exists yet.** There is no post-deletion or account-erasure
 * mutation/script anywhere in this codebase today (confirmed by source search: no
 * `delete(posts)`, no account-erasure code path). This story builds the promotion mechanism per
 * AD-30 Rule 8/AC4 so it exists and is fully tested *before* a future story (not yet scheduled)
 * wires an actual post-deletion caller that must invoke it, in the same transaction, strictly
 * **before** issuing `tx.delete(posts).where(eq(posts.id, postId))` — `events.postId` is
 * `ON DELETE SET NULL`, so an un-promoted event would otherwise simply lose its primary post
 * silently once that future delete runs.
 *
 * **Scope decision (decided by the user, not re-asked):** this function implements AD-30 Rule 7's
 * legs 1, 3 and 4 only — (1) organizer-authored (AD-31 Rule 3) beats a non-organizer-authored
 * candidate; (3) otherwise the earlier post (`posts.publishedAt` ascending); (4) otherwise the
 * lower post id (`ORDER BY id ASC`, deterministic final tie-break). Leg 2 ("the post whose
 * extraction has more schedules with a complete date and location") is explicitly NOT
 * implemented here — it is match-time-only (Story 3.6v), and has no meaning when choosing among
 * posts already linked to the same event.
 */
export async function promotePrimaryPostBeforePostDeletion(tx: DbExecutor, postId: string): Promise<void> {
  const affectedEvents = await tx.select({ id: events.id }).from(events).where(eq(events.postId, postId));

  for (const { id: eventId } of affectedEvents) {
    const candidates = await tx
      .select({
        postId: eventPosts.postId,
        extractionOrdinal: eventPosts.extractionOrdinal,
        publishedAt: posts.publishedAt,
      })
      .from(eventPosts)
      .innerJoin(posts, eq(eventPosts.postId, posts.id))
      .where(and(eq(eventPosts.eventId, eventId), ne(eventPosts.postId, postId)));

    if (candidates.length === 0) {
      await setEventPrimaryPost(tx, { eventId, postId: null, extractionOrdinal: null });
      continue;
    }

    const winner = await selectPromotionWinner(tx, candidates);

    const resolvedOrdinal =
      winner.extractionOrdinal != null
        ? winner.extractionOrdinal
        : await nextFreeOrdinalForPost(tx, winner.postId);

    await setEventPrimaryPost(tx, { eventId, postId: winner.postId, extractionOrdinal: resolvedOrdinal });
  }
}

interface PromotionCandidate {
  postId: string;
  extractionOrdinal: number | null;
  publishedAt: Date;
}

/**
 * AD-30 Rule 7 legs 1/3/4, evaluated in order: (1) organizer-authored beats non-organizer-
 * authored; (3) earlier `publishedAt` wins; (4) lower post id wins (deterministic final
 * tie-break). Leg 2 (schedule completeness) is deliberately not implemented — see header comment.
 */
async function selectPromotionWinner(tx: DbExecutor, candidates: PromotionCandidate[]): Promise<PromotionCandidate> {
  const withAuthorship = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      // Pass `tx` explicitly -- the default `db`-level connection pool (max: 1) would otherwise
      // deadlock against this very transaction, which is still holding the pool's one connection.
      organizerAuthored: await isOrganizerAuthoredPost(candidate.postId, tx),
    }))
  );

  withAuthorship.sort((a, b) => {
    // Leg 1: organizer-authored beats non-organizer-authored.
    if (a.organizerAuthored !== b.organizerAuthored) {
      return a.organizerAuthored ? -1 : 1;
    }
    // Leg 3: earlier publishedAt wins.
    const publishedDiff = a.candidate.publishedAt.getTime() - b.candidate.publishedAt.getTime();
    if (publishedDiff !== 0) {
      return publishedDiff;
    }
    // Leg 4: lower post id wins (deterministic final tie-break).
    return a.candidate.postId < b.candidate.postId ? -1 : a.candidate.postId > b.candidate.postId ? 1 : 0;
  });

  return withAuthorship[0].candidate;
}

/** The given post's next free `extraction_ordinal` across every event it's linked to. */
async function nextFreeOrdinalForPost(tx: DbExecutor, postId: string): Promise<number> {
  const [{ maxOrdinal }] = (await tx.execute(sql`
    SELECT COALESCE(MAX(extraction_ordinal), -1) AS "maxOrdinal"
    FROM event_posts
    WHERE post_id = ${postId}
  `)) as unknown as Array<{ maxOrdinal: number }>;

  return Number(maxOrdinal) + 1;
}
