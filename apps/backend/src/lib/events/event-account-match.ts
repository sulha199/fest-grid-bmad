import { sql, SQL, SQLWrapper } from 'drizzle-orm';
import { events } from '@festgrid/database';

/**
 * AD-31 Rule 4's shared event-level account-match helper -- "does this event have a linked post
 * authored/published by this account?" Every consumer (the `Query.events` account filter, the
 * `isFromSubscribedAccount` fieldMap entry, and the `event`/`eventBySlug` `includeMyArchived`
 * personal-connection check, all in `apps/backend/src/schema/resolvers.ts`) is required to call
 * this rather than re-deriving its own join, enforced by `event-account-match-ratchet.test.ts`.
 *
 * As of Story 3.18, this is association-table-only -- a single `EXISTS`: any
 * `post_account_associations` row (any of the four roles: `PUBLISHER`, `COAUTHOR`,
 * `SCRAPING_SOURCE`, `PUBLISHER_UNKNOWN`) on a post linked to this event via `event_posts`.
 *
 * Story 3.6v originally shipped a second, OR'd leg here -- a pre-3.15 legacy fallback matching
 * the bare `posts.account_id` column directly, with no association row required. Story 3.18
 * removed it: Story 3.15's migration backfilled a `PUBLISHER_UNKNOWN` association row for every
 * pre-existing post (verified 81/81), and the only post-insert path in the codebase
 * (`persistScrapedPost` -> `persistPostAccountAssociations`) unconditionally writes at least a
 * `SCRAPING_SOURCE` association row for every new post, plus a matching `PUBLISHER` row whenever
 * `posts.accountId` itself resolves to the publisher profile. So every value that could ever land
 * in `posts.accountId` already has an equal-or-better association row covering it -- the legacy
 * leg could not match anything the association leg didn't already match, and keeping it only
 * risked silently masking a future missing-association-row bug instead of surfacing it loudly.
 *
 * The join still goes through `event_posts` -- not just the event's primary `postId` -- so an
 * event promoted from a roundup stays matched against every account that posted about it, not
 * only its current primary post's account.
 *
 * `accountId` accepts either a literal id (string) or any Drizzle SQL-embeddable expression
 * (e.g. a correlated column like `subscriptions.accountId`) -- the `sql` template below embeds
 * either correctly (a literal becomes a bound parameter, a column/SQL expression is rendered as
 * an identifier/sub-expression), letting the same helper serve a fixed-value filter (the account
 * filter) and a per-row-correlated check (`isFromSubscribedAccount`, the personal-connection
 * check) without separate implementations.
 */
export function buildEventAccountMatchCondition(accountId: string | SQLWrapper): SQL {
  return sql`(
    EXISTS (
      SELECT 1 FROM event_posts ep
      JOIN post_account_associations paa ON paa.post_id = ep.post_id
      WHERE ep.event_id = ${events.id}
        AND paa.account_id = ${accountId}
    )
  )`;
}
