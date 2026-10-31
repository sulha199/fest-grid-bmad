#!/usr/bin/env tsx
/**
 * AI-assisted dedup review, export side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B1):
 * prints the evidence for the oldest pending `event_match_candidates` rows as one JSON line between
 * `DEDUP_REVIEW_EXPORT_BEGIN` and `DEDUP_REVIEW_EXPORT_END`. It never writes: everything runs in a
 * transaction set READ ONLY, so even a write-capable DATABASE_URL cannot change a row.
 *
 *   tsx src/dedup-review-export.ts [--limit <1-50>] [--skip-ids <uuid,uuid,...>] [--run-tag <tag>]
 *
 * `--skip-ids` leaves out suggestions the reviewer already escalated, so the same stuck pairs do not
 * fill the limit every day. `DEDUP_REVIEW_MODERATOR_EMAIL` (optional) lets `recentlyResolved` tell
 * the reviewer's resolutions from a human moderator's; the address is never printed.
 *
 * Point DATABASE_URL at a READ-ONLY role (the `dedup-review-export` workflow reads the secret
 * `DEDUP_REVIEW_READONLY_DATABASE_URL`). Arguments are validated before the database client is even
 * imported, so a bad value fails without a connection.
 */
import { DedupReviewOptionsError, formatDedupReviewExport, parseDedupReviewOptions, type DedupReviewOptions } from '@festgrid/domain/events';

export function parseCliArgs(argv: string[]): DedupReviewOptions {
  const raw: { limit?: string; skipIds?: string; runTag?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') raw.limit = argv[++i];
    else if (arg === '--skip-ids') raw.skipIds = argv[++i];
    else if (arg === '--run-tag') raw.runTag = argv[++i];
    else throw new DedupReviewOptionsError('Unknown argument. Usage: [--limit <1-50>] [--skip-ids <uuid,...>] [--run-tag <tag>]');
  }
  return parseDedupReviewOptions(raw);
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

  for (const line of formatDedupReviewExport(report)) console.log(line);
}

if (process.argv[1] && /dedup-review-export\.[tj]s$/.test(process.argv[1])) {
  main().then(
    () => process.exit(0),
    (err) => {
      if (err instanceof DedupReviewOptionsError) {
        console.error(`Invalid input: ${err.message}`);
      } else {
        console.error(err);
      }
      process.exit(1);
    }
  );
}
