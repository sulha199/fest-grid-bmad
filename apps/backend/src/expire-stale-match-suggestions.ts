#!/usr/bin/env tsx
/**
 * IDEA-107 -- operator tool that closes the pending `event_match_candidates` suggestions nobody can
 * act on: an event of the pair was deleted or merged since it was queued, or both events are over.
 * They get the status `expired` (never `rejected`, which means "not a duplicate"), so they leave the
 * moderator queue and the "pending" count tells the truth. The rule is
 * `getSuggestionExpiryReason` (`packages/domain`); the work is `expireStaleMatchSuggestions`.
 *
 *   tsx src/expire-stale-match-suggestions.ts [--evaluate-only | --apply] [--today YYYY-MM-DD] [--list]
 *
 * Default (dry run): runs the real update inside one transaction that is always rolled back, then
 * prints the counts. `--apply` commits it. `--evaluate-only` never updates, so it needs only SELECT.
 * `--today` overrides the run's UTC date (a test or a replay); "over" means the last day any
 * schedule covers lies strictly before it. `--list` also prints every suggestion id with its reason.
 *
 * Point DATABASE_URL at the database to change; closing a suggestion needs a role that can UPDATE
 * `event_match_candidates`. No moderator id is recorded: this is a system action.
 */
import { TransactionRollbackError } from 'drizzle-orm';
import { db } from './db/client.js';
import { expireStaleMatchSuggestions, type ExpireSuggestionsReport } from './lib/events/expire-match-suggestions.js';

export interface ExpireArgs {
  evaluateOnly: boolean;
  apply: boolean;
  /** `YYYY-MM-DD`; undefined = today in UTC. */
  today: string | undefined;
  list: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const USAGE = 'Usage: [--evaluate-only | --apply] [--today YYYY-MM-DD] [--list]';

export function parseArgs(argv: string[]): ExpireArgs {
  let evaluateOnly = false;
  let apply = false;
  let list = false;
  let today: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') apply = true;
    else if (arg === '--evaluate-only') evaluateOnly = true;
    else if (arg === '--list') list = true;
    else if (arg === '--today') today = argv[++i] ?? '';
    else throw new Error(`Unknown argument: ${arg}\n${USAGE}`);
  }
  if (apply && evaluateOnly) throw new Error('--apply and --evaluate-only cannot be combined.');
  if (today !== undefined && (!DAY.test(today) || Number.isNaN(Date.parse(today)))) throw new Error('--today must be a date as YYYY-MM-DD.');
  return { evaluateOnly, apply, today, list };
}

export function formatReport(report: ExpireSuggestionsReport, args: ExpireArgs, today: string): string[] {
  const mode = args.apply ? 'APPLIED' : args.evaluateOnly ? 'EVALUATE ONLY (nothing updated)' : 'DRY RUN (rolled back)';
  const lines = [
    `${mode} (run date ${today}):`,
    `  pending suggestions:           ${report.pending}`,
    `  expired / updated:             ${report.expired.length} / ${report.closed}`,
    `    an event deleted:            ${report.byReason['event-deleted']}`,
    `    an event merged away:        ${report.byReason['event-merged']}`,
    `    both events over:            ${report.byReason['both-over']}`,
    `  kept for a moderator:          ${report.kept}`,
  ];
  if (args.list && report.expired.length > 0) {
    lines.push('', 'Expired suggestions:');
    for (const e of report.expired) lines.push(`  ${e.suggestionId} [${e.reason}]`);
  }
  if (!args.apply) lines.push('', args.evaluateOnly ? 'Re-run without --evaluate-only for a dry run of the update.' : 'Re-run with --apply to commit.');
  return lines;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const today = args.today ?? new Date().toISOString().slice(0, 10);
  const result: { report?: ExpireSuggestionsReport } = {};
  try {
    await db.transaction(async (tx) => {
      result.report = await expireStaleMatchSuggestions(tx, { today, apply: !args.evaluateOnly });
      if (!args.apply) await tx.rollback();
    });
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err;
  }
  for (const line of formatReport(result.report!, args, today)) console.log(line);
}

if (process.argv[1] && /expire-stale-match-suggestions\.[tj]s$/.test(process.argv[1])) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
