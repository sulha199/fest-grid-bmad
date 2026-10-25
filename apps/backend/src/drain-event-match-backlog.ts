#!/usr/bin/env tsx
/**
 * AD-30 Rule 7 (amended 2026-10-25) -- operator tool that drains the pending
 * `event_match_candidates` backlog: it re-evaluates every pending suggestion with the same
 * decision ingestion now uses and accepts the pairs that would auto-link today. Accepting calls
 * `mergeEvents()` (existing event wins, the suggested event is the loser), exactly what the
 * moderator's accept button does, so every merge is journaled in `event_merges` and reversible
 * with `undoEventMerge`.
 *
 *   tsx src/drain-event-match-backlog.ts --moderator-id <users.id uuid> \
 *       [--exclude <suggestion id> ...] [--evaluate-only | --apply]
 *
 * Default (dry run): runs the real merges inside one transaction that is always rolled back, then
 * prints the counts and every qualifying pair so a moderator can spot-check them.
 * `--evaluate-only`: does not merge at all, so it needs only SELECT (the read-only prod role works).
 * `--apply`: commits every qualifying merge in one transaction (all or none), minus any
 * `--exclude`d suggestion. Spot-check the dry-run output before using it.
 *
 * Point DATABASE_URL at the database to change. The `PROD_READONLY_DATABASE_URL` role can only run
 * `--evaluate-only`.
 */
import { TransactionRollbackError } from 'drizzle-orm';
import { db } from './db/client.js';
import { drainMatchBacklog, formatBacklogEvaluation, type DrainReport } from './lib/events/drain-match-backlog.js';

export interface DrainArgs {
  moderatorId: string;
  excludeSuggestionIds: string[];
  evaluateOnly: boolean;
  apply: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USAGE = 'Usage: --moderator-id <uuid> [--exclude <suggestion uuid> ...] [--evaluate-only | --apply]';

export function parseArgs(argv: string[]): DrainArgs {
  const excludeSuggestionIds: string[] = [];
  let moderatorId: string | undefined;
  let evaluateOnly = false;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') apply = true;
    else if (arg === '--evaluate-only') evaluateOnly = true;
    else if (arg === '--moderator-id') moderatorId = argv[++i];
    else if (arg === '--exclude') excludeSuggestionIds.push(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!moderatorId) throw new Error(USAGE);
  if (!UUID.test(moderatorId)) throw new Error('--moderator-id must be a users.id uuid.');
  if (excludeSuggestionIds.some((id) => !id || !UUID.test(id))) throw new Error('--exclude must be a suggestion uuid.');
  if (apply && evaluateOnly) throw new Error('--apply and --evaluate-only cannot be combined.');
  return { moderatorId, excludeSuggestionIds, evaluateOnly, apply };
}

export function formatReport(report: DrainReport, args: DrainArgs): string[] {
  const mode = args.apply ? 'APPLIED' : args.evaluateOnly ? 'EVALUATE ONLY (nothing merged)' : 'DRY RUN (rolled back)';
  const lines = [
    `${mode}:`,
    `  pending suggestions:        ${report.pending}`,
    `  would auto-link / merged:   ${report.qualifying.length} / ${report.merged}`,
    `    promoted by the new rule: ${report.qualifying.filter((q) => q.decision.promotedByRule).length}`,
    `  stay for a moderator:       ${report.remaining}${report.excluded.length ? ` (${report.excluded.length} excluded by --exclude)` : ''}`,
    `  stale (skipped):            ${report.stale.length}`,
  ];
  if (report.qualifying.length > 0) lines.push('', 'Qualifying pairs (suggested event -> existing event):');
  for (const q of report.qualifying) {
    lines.push(`  ${formatBacklogEvaluation(q)}`);
  }
  if (report.stale.length > 0) lines.push('', 'Stale:');
  for (const s of report.stale) lines.push(`  ${s.suggestionId}: ${s.reason}`);
  if (report.mergeIds.length > 0) lines.push('', `event_merges journal ids (undoEventMerge): ${report.mergeIds.join(', ')}`);
  if (!args.apply) lines.push('', args.evaluateOnly ? 'Re-run without --evaluate-only for a dry run of the merges.' : 'Re-run with --apply to commit.');
  return lines;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result: { report?: DrainReport } = {};
  try {
    await db.transaction(async (tx) => {
      result.report = await drainMatchBacklog(tx, {
        moderatorId: args.moderatorId,
        merge: !args.evaluateOnly,
        excludeSuggestionIds: args.excludeSuggestionIds,
      });
      if (!args.apply) await tx.rollback();
    });
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err;
  }
  for (const line of formatReport(result.report!, args)) console.log(line);
}

if (process.argv[1] && /drain-event-match-backlog\.[tj]s$/.test(process.argv[1])) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
