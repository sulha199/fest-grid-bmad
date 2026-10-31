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
 * fill the limit every day. `DEDUP_REVIEW_MODERATOR_EMAIL` (optional) lets `recentlyResolved` tell
 * the reviewer's resolutions from a human moderator's; the address is never printed.
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
import { DedupReviewReviewerError, DedupReviewRoleError } from './lib/events/dedup-review-errors.js';

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

/**
 * Fixed hints for the database error codes this export can plausibly hit. They are keyed by the
 * SQLSTATE code only, so they never carry the error's own text (which can hold a host, a user name
 * or a bound parameter) into a public log.
 */
const DATABASE_ERROR_HINTS: Record<string, string> = {
  '42883': 'a database function was not found; the usual cause is pg_trgm similarity() not being resolvable for this role (the export puts the `extensions` schema on the search path, so check pg_trgm is installed and the role may use it)',
  '42501': 'the role lacks a privilege on a table or function the export reads; use a read-only role with BYPASSRLS and pg_read_all_data (docs/infrastructure/3-database.md)',
  '42P01': 'a table was not found; check DEDUP_REVIEW_READONLY_DATABASE_URL points at the production database',
  '28P01': 'authentication failed; check the DEDUP_REVIEW_READONLY_DATABASE_URL secret',
  '28000': 'the role was refused; check the DEDUP_REVIEW_READONLY_DATABASE_URL secret',
  '25006': 'the database refused a write in a read-only transaction; the export must not write, so this is a bug in the export',
};

/** What to print when the export fails: the typed errors' fixed messages, and for anything else only the class, the code and a fixed hint for that code. */
export function describeFailure(err: unknown): string {
  if (err instanceof DedupReviewOptionsError) return `Invalid input: ${err.message}`;
  if (err instanceof DedupReviewRoleError || err instanceof DedupReviewReviewerError) return `Export refused: ${err.message}`;
  const name = err instanceof Error ? err.name : 'Error';
  const rawCode = (err as { code?: unknown } | null)?.code;
  const code = typeof rawCode === 'string' ? rawCode : null;
  const hint = code !== null && Object.hasOwn(DATABASE_ERROR_HINTS, code) ? ` Likely cause: ${DATABASE_ERROR_HINTS[code]}.` : '';
  return `Export failed: ${name}${code ? ` (${code})` : ''}.${hint} The error's own text is not printed because this log is public; run the same command locally to see it.`;
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  const { db } = await import('./db/client.js');
  const { buildDedupReviewExport, resolveReviewerUserId, runInReadOnlyTransaction } = await import('./lib/events/dedup-review-export.js');

  const reviewerEmail = process.env.DEDUP_REVIEW_MODERATOR_EMAIL?.trim();
  const report = await runInReadOnlyTransaction(db, async (tx) => {
    const reviewerUserId = reviewerEmail ? await resolveReviewerUserId(tx, reviewerEmail) : null;
    return buildDedupReviewExport(tx, { ...options, reviewerUserId });
  });

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
