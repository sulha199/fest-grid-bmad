#!/usr/bin/env tsx
/**
 * AI-assisted dedup review, export side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B1):
 * prints the evidence for the oldest pending `event_match_candidates` rows as one JSON line between
 * `DEDUP_REVIEW_EXPORT_BEGIN` and `DEDUP_REVIEW_EXPORT_END`. It never writes: everything runs in a
 * `REPEATABLE READ, READ ONLY` transaction, so even a write-capable DATABASE_URL cannot change a row.
 *
 *   tsx src/dedup-review-export.ts [--limit <1-50>] [--skip-ids <uuid,uuid,...>] [--run-tag <tag>]
 *
 * `--skip-ids` leaves out suggestions the reviewer already escalated, so the same stuck pairs do not
 * fill the limit every day. `recentlyResolved` tells the reviewer's resolutions from a moderator's by
 * the `resolved_via` flag the shared resolve path writes, so no account or email is involved.
 *
 * Point DATABASE_URL at a READ-ONLY role that bypasses row level security (the `dedup-review-export`
 * workflow reads the secret `DEDUP_REVIEW_READONLY_DATABASE_URL`); the export refuses a role that
 * cannot, because every table would look empty. Arguments are validated before the database client
 * is even imported, so a bad value fails without a connection.
 *
 * The workflow's log is public, so an unexpected error prints only its class and code, never its
 * message (a database error can carry a host, a user name or a bound parameter).
 */
import { DedupReviewOptionsError, formatDedupReviewExport, parseDedupReviewOptions, type DedupReviewOptions } from '@festgrid/domain/events';
import { DedupReviewRoleError } from './lib/events/dedup-review-errors.js';
import { describeUnexpectedFailure } from './lib/events/dedup-review-failure.js';

export function parseCliArgs(argv: string[]): DedupReviewOptions {
  const raw: { limit?: string; skipIds?: string; runTag?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg !== '--limit' && arg !== '--skip-ids' && arg !== '--run-tag') {
      throw new DedupReviewOptionsError('Unknown argument. Usage: [--limit <1-50>] [--skip-ids <uuid,...>] [--run-tag <tag>]');
    }
    const value = argv[++i];
    if (value === undefined) {
      throw new DedupReviewOptionsError(`${arg} needs a value`);
    }
    if (arg === '--limit') raw.limit = value;
    else if (arg === '--skip-ids') raw.skipIds = value;
    else raw.runTag = value;
  }
  return parseDedupReviewOptions(raw);
}

/** What to print when the export fails: the typed errors' fixed messages, and for anything else only the class, the code and a fixed hint for that code. */
export function describeFailure(err: unknown): string {
  if (err instanceof DedupReviewOptionsError) return `Invalid input: ${err.message}`;
  if (err instanceof DedupReviewRoleError) return `Export refused: ${err.message}`;
  return describeUnexpectedFailure(err, 'Export');
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  const { db } = await import('./db/client.js');
  const { buildDedupReviewExport, runInReadOnlyTransaction } = await import('./lib/events/dedup-review-export.js');

  const report = await runInReadOnlyTransaction(db, (tx) => buildDedupReviewExport(tx, options));

  // One write, and wait for it: exiting right after a large write to a pipe can cut the line short.
  const output = formatDedupReviewExport(report).join('\n') + '\n';
  await new Promise<void>((resolve, reject) => process.stdout.write(output, (err) => (err ? reject(err) : resolve())));
}

if (process.argv[1] && /dedup-review-export\.[tj]s$/.test(process.argv[1])) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(describeFailure(err));
      process.exit(1);
    }
  );
}
