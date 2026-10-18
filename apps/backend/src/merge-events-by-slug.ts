#!/usr/bin/env tsx
/**
 * BUG-063 -- operator tool to merge duplicate events that dedup missed, when no pending
 * `event_match_candidates` suggestion exists for the pair (so the moderator accept button is not
 * available). It calls the same `mergeEvents()` the moderator mutation calls (AD-30 Rule 9), so the
 * result is journaled in `event_merges` and reversible with `undoEventMerge`.
 *
 *   tsx src/merge-events-by-slug.ts --winner <slug> --loser <slug> [--loser <slug> ...] \
 *       --moderator-id <users.id uuid> [--apply]
 *
 * Without `--apply` it runs the real merges inside one transaction that is always rolled back and
 * prints what would change (the technique `backfill-legacy-event-slugs.ts` uses). With `--apply`
 * it commits all losers in one transaction: either every loser merges or none does.
 *
 * A slug may be the event's current slug or one of its `event_slug_aliases`. Losers merge into the
 * winner one after another, so a loser's own schedules (registration deadline, ...) are copied onto
 * the winner as non-main schedules and its posts are linked to the winner.
 *
 * Point DATABASE_URL at the database to change. The `PROD_READONLY_DATABASE_URL` role cannot run
 * this: even a dry run needs write privileges inside its rolled-back transaction.
 */
import { eq } from 'drizzle-orm';
import { TransactionRollbackError } from 'drizzle-orm';
import { events, eventSlugAliases } from '@festgrid/database';
import { db } from './db/client.js';
import { mergeEvents } from './lib/events/merge-events.js';
import type { DbExecutor } from './lib/events/set-event-primary-post.js';

export interface MergeBySlugArgs {
  winnerSlug: string;
  loserSlugs: string[];
  moderatorId: string;
  apply: boolean;
}

export function parseArgs(argv: string[]): MergeBySlugArgs {
  const loserSlugs: string[] = [];
  let winnerSlug: string | undefined;
  let moderatorId: string | undefined;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') apply = true;
    else if (arg === '--winner') winnerSlug = argv[++i];
    else if (arg === '--loser') loserSlugs.push(argv[++i]);
    else if (arg === '--moderator-id') moderatorId = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!winnerSlug || loserSlugs.length === 0 || !moderatorId || loserSlugs.some((s) => !s)) {
    throw new Error('Usage: --winner <slug> --loser <slug> [--loser <slug> ...] --moderator-id <uuid> [--apply]');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(moderatorId)) {
    throw new Error('--moderator-id must be a users.id uuid.');
  }
  return { winnerSlug, loserSlugs, moderatorId, apply };
}

async function resolveEventId(executor: DbExecutor, slug: string): Promise<string> {
  const [event] = await executor.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  if (event) return event.id;
  const [alias] = await executor.select({ eventId: eventSlugAliases.eventId }).from(eventSlugAliases).where(eq(eventSlugAliases.slug, slug)).limit(1);
  if (alias) return alias.eventId;
  throw new Error(`No event or slug alias found for "${slug}".`);
}

export async function mergeBySlug(executor: DbExecutor, args: MergeBySlugArgs): Promise<string[]> {
  const winnerId = await resolveEventId(executor, args.winnerSlug);
  const lines: string[] = [];
  for (const loserSlug of args.loserSlugs) {
    const loserId = await resolveEventId(executor, loserSlug);
    const { merge } = await mergeEvents(executor, winnerId, loserId, args.moderatorId, null);
    lines.push(
      `${loserSlug} -> ${args.winnerSlug}: journal ${merge.id} (posts ${merge.repointedEventPostIds?.length ?? 0}, favorites ${merge.repointedFavoriteIds?.length ?? 0}, calendar ${merge.repointedCalendarAdditionIds?.length ?? 0}, reports ${merge.repointedReportIds?.length ?? 0})`
    );
  }
  return lines;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let lines: string[] = [];
  try {
    await db.transaction(async (tx) => {
      lines = await mergeBySlug(tx, args);
      if (!args.apply) await tx.rollback();
    });
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err;
  }
  console.log(args.apply ? 'APPLIED:' : 'DRY RUN (rolled back):');
  for (const line of lines) console.log(`  ${line}`);
  if (!args.apply) console.log('Re-run with --apply to commit.');
}

if (process.argv[1] && /merge-events-by-slug\.[tj]s$/.test(process.argv[1])) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
