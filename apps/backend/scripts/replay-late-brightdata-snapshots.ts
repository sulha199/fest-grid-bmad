/**
 * Replays Bright Data snapshots whose results arrived after the job had already expired.
 *
 * Why it exists (2026-10-29): 21 snapshots finished 5-6 hours after the 180-minute job expiry. The stale-job sweep
 * had marked each job EXPIRED and its run TIMED_OUT, and the webhook then dropped the late delivery. The webhook now
 * accepts such a delivery itself (PR #118), so this script is for the ones lost before that fix, and for any
 * snapshot that is still `ready` at Bright Data (kept 30 days) while its job is EXPIRED and its run TIMED_OUT.
 *
 * Does exactly what the webhook now does for a late delivery: record the run SUCCEEDED, then
 * processBrightDataResult (persist posts, enqueue new ones for extraction, stamp lastScrapedAt, complete the job).
 *
 * Default is a DRY RUN: it only reads (the vendor and the database) and reports what an apply would do.
 * `--apply` writes. Re-running is safe: processed jobs become COMPLETED and drop out of the selection.
 * `--from` and `--to` (UTC dates, `to` exclusive) are required: there is deliberately no default window.
 *
 * Usage (DATABASE_URL must point at the target database; see the app-admin-replay-late-brightdata-snapshots skill):
 *   tsx scripts/replay-late-brightdata-snapshots.ts --from 2026-10-29 --to 2026-10-30 [--apply]
 */
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { brightdataPendingJobs, posts, scraperActorRuns } from '@festgrid/database';
import { fetchBrightDataRunOutput } from '../src/lib/scraper/fetch-vendor-run-output.js';
import { recordActorRunResult } from '../src/lib/scraper/record-actor-run.js';
import { processBrightDataResult } from '../src/lib/scraper/process-brightdata-result.js';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
}

function parseUtcDate(flag: string): Date {
  const value = argValue(flag);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${flag} <YYYY-MM-DD> is required (UTC). Usage: tsx scripts/replay-late-brightdata-snapshots.ts --from 2026-10-29 --to 2026-10-30 [--apply]`);
  }
  return new Date(`${value}T00:00:00Z`);
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const from = parseUtcDate('--from');
  const to = parseUtcDate('--to');
  if (to <= from) {
    throw new Error('--to must be after --from');
  }

  const candidates = await db
    .select({ job: brightdataPendingJobs, run: scraperActorRuns })
    .from(brightdataPendingJobs)
    .innerJoin(scraperActorRuns, eq(scraperActorRuns.runId, brightdataPendingJobs.snapshotId))
    .where(
      and(
        eq(brightdataPendingJobs.status, 'EXPIRED'),
        eq(scraperActorRuns.vendor, 'BRIGHTDATA'),
        eq(scraperActorRuns.status, 'TIMED_OUT'),
        gte(scraperActorRuns.startedAt, from),
        lt(scraperActorRuns.startedAt, to)
      )
    );

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${candidates.length} expired Bright Data jobs with a TIMED_OUT run in [${from.toISOString()}, ${to.toISOString()})`);

  let totalItems = 0;
  let totalNew = 0;
  let processed = 0;
  for (const { job, run } of candidates) {
    const output = await fetchBrightDataRunOutput(job.snapshotId);
    if (output.status !== 'SUCCEEDED' || output.items.length === 0) {
      console.log(`  skip ${job.snapshotId}: vendor status ${output.status}, ${output.items.length} items`);
      continue;
    }

    const urls = output.items
      .map((item) => (item as { url?: unknown }).url)
      .filter((url): url is string => typeof url === 'string');
    const existing = urls.length > 0
      ? await db.select({ postUrl: posts.postUrl }).from(posts).where(inArray(posts.postUrl, urls))
      : [];
    const newCount = urls.length - existing.length;
    totalItems += output.items.length;
    totalNew += newCount;
    console.log(`  ${job.snapshotId}: ${output.items.length} items, ${newCount} not yet stored`);

    if (!apply) continue;

    await recordActorRunResult({
      vendor: 'BRIGHTDATA',
      runId: job.snapshotId,
      status: 'SUCCEEDED',
      rawOutput: output.items,
      itemCount: output.items.length,
    });
    await processBrightDataResult(job, output.items, job.scraperActorRunId ?? run.id);
    processed += 1;
  }

  console.log(`Total: ${totalItems} items across ${candidates.length} jobs, ${totalNew} not yet stored${apply ? `; ${processed} jobs processed` : ' (dry run, nothing written)'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Replay failed:', err);
    process.exit(1);
  });
