import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { posts, events } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { db } from '../../db/client.js';
import { parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { buildPlatformPrefixedSlug } from '@festgrid/domain/events';
import { reslugEventAndRecordAlias, type DbExecutor } from './set-event-primary-post.js';

/**
 * Story 3.22 -- these two functions need their own nested transaction per row/per event (Task
 * 3/4), on top of whatever the caller's own transaction is (the script's dry-run mode wraps the
 * whole pass in one outer transaction it always rolls back, Task 5). `DbExecutor` (set-event-
 * primary-post.ts) deliberately omits `.transaction` since its two existing callers never needed
 * nested transactions -- this story's functions do, so they take this slightly wider type
 * instead of broadening `DbExecutor` itself for every caller. Both `db` and a `tx` passed into
 * `db.transaction(async (tx) => ...)` satisfy it (drizzle-orm nests a `tx.transaction()` call as
 * a SAVEPOINT, so this works whether `executor` is the top-level `db` or an outer `tx`).
 */
export type TransactionCapableExecutor = DbExecutor & Pick<typeof db, 'transaction'>;

const BATCH_SIZE = 500;

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

/**
 * Story 3.22 Task 3 (AC1, AC2) -- batch-oriented variant of `processIngestionJob`'s inline
 * per-post identity healing (apps/backend/src/lib/ingestor/process-ingestion-job.ts, commit
 * 8320a81, 2026-10-05). Deliberately NOT extracted into one shared function with that inline
 * call site: the two have genuinely different shapes -- that one heals exactly the one post a
 * new ingestion job just happened to touch, inline, with no batching concern; this one scans and
 * heals every unhealed post in the whole table, paginated by a cursor on `posts.id` (never one
 * unbounded `SELECT *`). Same derivation (`parsePlatformPostIdentity`), same outcome either way
 * -- this is a deliberate, reasoned non-duplication, not an oversight.
 *
 * Each row's write is its own small transaction (AC6 -- never one transaction for the whole
 * run). A row already healed, or genuinely unparseable, is left alone (idempotent re-run, AC2).
 *
 * Story 3.6x / AD-30 Rule 11's partial unique index on `posts (platform, platformPostType,
 * platformPostId)` (migration 0073) now covers any row with non-null identity. A healing write
 * that would resolve to an identity another post already carries hits that constraint -- a
 * genuine (if rare) duplicate-scrape-row case, not a bug in this script. Never force it through:
 * catch exactly that unique-violation (Postgres code 23505) and count the row unresolvable,
 * exactly as AC2 already contracts for a genuinely-unparseable URL. Any other error propagates.
 */
export async function healPostPlatformIdentity(
  executor: TransactionCapableExecutor
): Promise<{ healed: number; stillUnresolvable: number }> {
  let healed = 0;
  let stillUnresolvable = 0;
  let cursor: string | null = null;

  for (;;) {
    const unhealedCondition = or(isNull(posts.platformPostId), isNull(posts.platformPostType));
    const rows = await executor
      .select({ id: posts.id, postUrl: posts.postUrl, originalPostUrl: posts.originalPostUrl })
      .from(posts)
      .where(cursor ? and(unhealedCondition, gt(posts.id, cursor)) : unhealedCondition)
      .orderBy(posts.id)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      const derived = parsePlatformPostIdentity({ postUrl: row.postUrl, originalPostUrl: row.originalPostUrl });
      if (derived.platformPostId === null || derived.platformPostType === null) {
        stillUnresolvable++;
        continue;
      }

      try {
        await executor.transaction(async (tx) => {
          await tx
            .update(posts)
            .set({ platformPostId: derived.platformPostId, platformPostType: derived.platformPostType })
            .where(eq(posts.id, row.id));
        });
        healed++;
      } catch (err) {
        if (isUniqueViolation(err)) {
          stillUnresolvable++;
        } else {
          throw err;
        }
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return { healed, stillUnresolvable };
}

const LEGACY_HEX_SLUG_REGEX = /^[0-9a-f]{12}$/;

/**
 * Story 3.22 Task 4 (AC3, AC4) -- re-keys every eligible legacy-hex-slugged event to its
 * platform-prefixed slug, through the exact same shared re-slug+alias-write helper
 * (`reslugEventAndRecordAlias`, Task 2) `enrichAndPromoteEvent` uses for its own (different-
 * trigger) re-slug case -- never a second, independently-maintained implementation of that
 * write.
 *
 * Selection predicate matches AC3/AC4 exactly: `deletedAt IS NULL AND mergedIntoEventId IS NULL
 * AND postId IS NOT NULL AND slug ~ '^[0-9a-f]{12}$'`, paginated the same cursor-on-`id` way as
 * Task 3. For each candidate, this function looks up its primary post's (post-Task-3) identity
 * and computes the new slug via the now-exported `buildPlatformPrefixedSlug`, passing the
 * event's own already-stored `extractionOrdinal` through unchanged (AD-16 Rule 9) -- never
 * recomputed.
 *
 * Concurrency note (documented per Task 4's own requirement): the event's current `slug` is
 * re-read *inside* the per-event write transaction, not reused from this function's own earlier
 * batch-select -- this is this story's concurrency safeguard. It guarantees the alias written is
 * always for whatever slug is canonical *at write time*: a vanishingly-rare concurrent
 * `enrichAndPromoteEvent` promotion racing the same event either commits first (this transaction
 * then correctly aliases the post-promotion slug, not a stale one) or second (this transaction's
 * alias/slug write simply becomes the new current state, and `enrichAndPromoteEvent`'s own prior
 * alias write for its own old-slug is untouched and still a valid redirect). In neither ordering
 * does any `event_slug_aliases` row become incorrect or a user-visible link break, because every
 * write either path ever makes is append-an-alias-then-swap-canonical, never a destructive edit.
 * No explicit row lock is taken -- that absence is intentional, not an oversight, for the reason
 * above.
 */
export async function reslugLegacyEvents(
  executor: TransactionCapableExecutor
): Promise<{ reslugged: number; stillUnresolvable: number }> {
  let reslugged = 0;
  let stillUnresolvable = 0;
  let cursor: string | null = null;

  for (;;) {
    const rows = await executor
      .select({
        id: events.id,
        slug: events.slug,
        postId: events.postId,
        extractionOrdinal: events.extractionOrdinal,
      })
      .from(events)
      .where(
        and(
          activeOnly(events),
          isNull(events.mergedIntoEventId),
          isNotNull(events.postId),
          sql`${events.slug} ~ '^[0-9a-f]{12}$'`,
          cursor ? gt(events.id, cursor) : undefined
        )
      )
      .orderBy(events.id)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      // Belt-and-suspenders: the WHERE clause above already enforces both, but `postId`'s
      // static type is still nullable here (Drizzle can't encode "isNotNull in WHERE" into the
      // select's inferred type), and re-checking the hex shape costs nothing.
      if (!row.postId || !LEGACY_HEX_SLUG_REGEX.test(row.slug)) {
        continue;
      }

      const [sourcePost] = await executor
        .select({
          platform: posts.platform,
          platformPostId: posts.platformPostId,
          platformPostType: posts.platformPostType,
        })
        .from(posts)
        .where(eq(posts.id, row.postId))
        .limit(1);

      const newSlug = sourcePost
        ? buildPlatformPrefixedSlug(sourcePost, row.extractionOrdinal ?? undefined)
        : undefined;

      if (newSlug === undefined) {
        stillUnresolvable++;
        continue;
      }

      await executor.transaction(async (tx) => {
        const [current] = await tx
          .select({ id: events.id, slug: events.slug })
          .from(events)
          .where(eq(events.id, row.id))
          .limit(1);

        if (!current || !LEGACY_HEX_SLUG_REGEX.test(current.slug)) {
          // Idempotent re-run / race already handled this event between the batch-select above
          // and this transaction -- nothing to do.
          return;
        }

        await reslugEventAndRecordAlias(tx, current, newSlug);
      });
      reslugged++;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return { reslugged, stillUnresolvable };
}
