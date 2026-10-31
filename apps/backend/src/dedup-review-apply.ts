#!/usr/bin/env tsx
/**
 * AI-assisted dedup review, apply side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B2b-1):
 * applies the reviewer's ACCEPT decisions that still hold and prints one JSON line between
 * `DEDUP_REVIEW_APPLY_BEGIN` and `DEDUP_REVIEW_APPLY_END`.
 *
 *   tsx src/dedup-review-apply.ts --mode <validate|apply> --decisions-file <path> [--live] [--run-tag <tag>]
 *
 * Environment: `DATABASE_URL`; `DEDUP_REVIEW_INVOKER_HASH` (SHA-256 hex of the lowercased, trimmed
 * Claude account email, matched to exactly one active moderator; never an argument, so it does not
 * sit in a process list); `DEDUP_REVIEW_APPLY_DISABLED` (`1` or `true` is the kill switch).
 *
 * - `validate` runs every check in a read-only snapshot and merges nothing; use a read-only role that
 *   bypasses row level security.
 * - `apply` runs the real merges and rolls them back unless `--live` is passed; it needs a role that
 *   can write.
 *
 * The kill switch is checked before anything else: before arguments, the decisions file and the
 * database client. Everything else is validated before the client is imported, so a bad value fails
 * without a connection.
 *
 * The workflow's log is public, so nothing here prints event text, a reason, the invoker hash or an
 * email, and an unexpected error prints only its class, its code and a fixed hint.
 */
import { readFileSync } from 'node:fs';
import {
  DEDUP_REVIEW_PER_DAY_CAP,
  DEDUP_REVIEW_PER_RUN_CAP,
  DEDUP_REVIEW_APPLY_SCHEMA_VERSION,
  DedupReviewApplyInputError,
  formatDedupReviewApplyReport,
  isDedupReviewApplyDisabled,
  parseDedupReviewApplyOptions,
  parseDedupReviewDecisions,
  parseDedupReviewInvokerHash,
  type DedupReviewApplyOptions,
  type DedupReviewApplyReport,
} from '@festgrid/domain/events';
import { DedupReviewInvokerError, DedupReviewRoleError } from './lib/events/dedup-review-errors.js';
import { describeUnexpectedFailure } from './lib/events/dedup-review-failure.js';

export interface DedupReviewApplyCliArgs {
  options: DedupReviewApplyOptions;
  decisionsFile: string;
}

export function parseCliArgs(argv: string[]): DedupReviewApplyCliArgs {
  const raw: { mode?: string; runTag?: string; decisionsFile?: string; live?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--live') {
      raw.live = true;
      continue;
    }
    if (arg !== '--mode' && arg !== '--run-tag' && arg !== '--decisions-file') {
      throw new DedupReviewApplyInputError('Unknown argument. Usage: --mode <validate|apply> --decisions-file <path> [--live] [--run-tag <tag>]');
    }
    const value = argv[++i];
    if (value === undefined) {
      throw new DedupReviewApplyInputError(`${arg} needs a value`);
    }
    if (arg === '--mode') raw.mode = value;
    else if (arg === '--run-tag') raw.runTag = value;
    else raw.decisionsFile = value;
  }
  const options = parseDedupReviewApplyOptions(raw);
  if (!raw.decisionsFile) {
    throw new DedupReviewApplyInputError('--decisions-file is required');
  }
  return { options, decisionsFile: raw.decisionsFile };
}

/** What to print when apply fails: the typed errors' fixed messages, and for anything else only the class, the code and a fixed hint for that code. */
export function describeFailure(err: unknown): string {
  if (err instanceof DedupReviewApplyInputError) return `Invalid input: ${err.message}`;
  if (err instanceof DedupReviewRoleError || err instanceof DedupReviewInvokerError) return `Apply refused: ${err.message}`;
  return describeUnexpectedFailure(err, 'Apply');
}

function readDecisionsFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    // The path and the system's message are not echoed.
    throw new DedupReviewApplyInputError('the decisions file could not be read');
  }
}

/** One write, and wait for it: exiting right after a large write to a pipe can cut the line short. */
function print(report: DedupReviewApplyReport): Promise<void> {
  const output = formatDedupReviewApplyReport(report).join('\n') + '\n';
  return new Promise<void>((resolve, reject) => process.stdout.write(output, (err) => (err ? reject(err) : resolve())));
}

async function main(): Promise<void> {
  if (isDedupReviewApplyDisabled(process.env.DEDUP_REVIEW_APPLY_DISABLED)) {
    await print({
      schemaVersion: DEDUP_REVIEW_APPLY_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      runTag: null,
      mode: 'disabled',
      killSwitch: true,
      usedLast24h: null,
      caps: { perRun: DEDUP_REVIEW_PER_RUN_CAP, perDay: DEDUP_REVIEW_PER_DAY_CAP },
      counts: { eligible: 0, merged: 0, skipped: 0 },
      results: [],
    });
    return;
  }

  const { options, decisionsFile } = parseCliArgs(process.argv.slice(2));
  const decisions = parseDedupReviewDecisions(readDecisionsFile(decisionsFile));
  const invokerHash = parseDedupReviewInvokerHash(process.env.DEDUP_REVIEW_INVOKER_HASH);

  const { db } = await import('./db/client.js');
  const { runDedupReviewApply } = await import('./lib/events/dedup-review-apply.js');
  const report = await runDedupReviewApply(db, { decisions, invokerHash, runTag: options.runTag, mode: options.mode, live: options.live });
  await print(report);
}

if (process.argv[1] && /dedup-review-apply\.[tj]s$/.test(process.argv[1])) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(describeFailure(err));
      process.exit(1);
    }
  );
}
