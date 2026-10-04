import { sql, SQL, SQLWrapper } from 'drizzle-orm';
import { events } from '@festgrid/database';

/**
 * AD-31 Rule 4's shared event-level account-match helper -- "does this event have a linked post
 * authored/published by this account?" Every consumer (the `Query.events` account filter and the
 * `isFromSubscribedAccount` fieldMap entry, both in `apps/backend/src/schema/resolvers.ts`) is
 * required to call this rather than re-deriving its own join, enforced by
 * `event-account-match-ratchet.test.ts`.
 *
 * This story (3.6v) ships the `posts.accountId` leg (AD-31 Rule 4's own ownership split with
 * Story 3.18, which adds the `post_account_associations` leg's second consumer elsewhere). Two
 * legs, OR'd:
 *   1. Any `post_account_associations` row (any role) on a post linked to this event via
 *      `event_posts` (the post-3.15 association signal).
 *   2. The pre-3.15 legacy fallback: any post linked to this event via `event_posts` whose bare
 *      `posts.account_id` matches (no association row needed).
 *
 * Both legs go through `event_posts` -- not just the event's primary `postId` -- so an event
 * promoted from a roundup (this story's own promotion path) stays matched against every account
 * that posted about it, not only its current primary post's account.
 *
 * `accountId` accepts either a literal id (string) or any Drizzle SQL-embeddable expression
 * (e.g. a correlated column like `subscriptions.accountId`) -- the `sql` template below embeds
 * either correctly (a literal becomes a bound parameter, a column/SQL expression is rendered as
 * an identifier/sub-expression), letting the same helper serve a fixed-value filter (the account
 * filter) and a per-row-correlated check (`isFromSubscribedAccount`) without two implementations.
 */
export function buildEventAccountMatchCondition(accountId: string | SQLWrapper): SQL {
  return sql`(
    EXISTS (
      SELECT 1 FROM event_posts ep
      JOIN post_account_associations paa ON paa.post_id = ep.post_id
      WHERE ep.event_id = ${events.id}
        AND paa.account_id = ${accountId}
    )
    OR EXISTS (
      SELECT 1 FROM event_posts ep
      JOIN posts p ON p.id = ep.post_id
      WHERE ep.event_id = ${events.id}
        AND p.account_id = ${accountId}
    )
  )`;
}
