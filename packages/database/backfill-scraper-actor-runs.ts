/**
 * Backfill tool for the scraper audit-trail gap (docs/infrastructure/incidents/2026-09-05-scraper-audit-trail-gap.md).
 *
 * Two modes:
 *   tsx backfill-scraper-actor-runs.ts sizing
 *     Read-only. Counts orphaned (scraper_actor_run_id IS NULL) rows across every table
 *     that references scraper_actor_runs, so the size of the gap can be measured before
 *     asking anyone to gather backfill data.
 *
 *   tsx backfill-scraper-actor-runs.ts backfill --input <file.json> [--apply] [--window-hours N]
 *     Reads a JSON array of run records (see the docs above for the exact shape), inserts
 *     one scraper_actor_runs row per record (idempotent -- onConflictDoNothing on
 *     (vendor, run_id), safe to re-run), then re-links orphaned child rows:
 *       - apify_pending_jobs / brightdata_pending_jobs: exact match on their own run id
 *         column, always safe, always applied.
 *       - unprocessed_scraper_payloads / posts: no exact key exists, so these are matched
 *         by (resolved profile + a time window around started_at) and are DRY-RUN ONLY
 *         by default -- printed as candidates, never written, until --apply is passed.
 *
 *   Without --apply, backfill mode never writes anything -- it only reports what it would do.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, isNull, gte, lte, sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import {
  scraperActorRuns,
  socialMediaAccountProfiles,
  unprocessedScraperPayloads,
  posts,
  apifyPendingJobs,
  brightdataPendingJobs,
} from './schema';
import { loadDatabaseEnv } from './env';

interface BackfillRunRecord {
  vendor: 'APIFY' | 'BRIGHTDATA';
  vendor_run_id: string;
  instagram_profile_id: string;
  started_at: string;
  trigger_mode?: 'SYNC' | 'ASYNC';
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  raw_input?: unknown;
  raw_output?: unknown;
}

const DEFAULT_WINDOW_HOURS = 2;

function connect() {
  const { databaseUrl: connectionString } = loadDatabaseEnv(__dirname);
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || !connectionString.includes('supabase');
  const client = postgres(connectionString, { max: 1, ssl: isLocal ? false : 'require' });
  return { client, db: drizzle(client) };
}

async function runSizing() {
  const { client, db } = connect();
  try {
    const [payloadOrphans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unprocessedScraperPayloads)
      .where(isNull(unprocessedScraperPayloads.scraperActorRunId));

    const [postOrphans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(isNull(posts.scraperActorRunId));

    const [apifyOrphans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apifyPendingJobs)
      .where(isNull(apifyPendingJobs.scraperActorRunId));

    const [brightdataOrphans] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brightdataPendingJobs)
      .where(isNull(brightdataPendingJobs.scraperActorRunId));

    const [payloadsWithPreservedId] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unprocessedScraperPayloads)
      .where(
        and(
          isNull(unprocessedScraperPayloads.scraperActorRunId),
          sql`${unprocessedScraperPayloads.context} ? 'orphanedScraperActorRunId'`
        )
      );

    console.log('Scraper audit-trail orphan counts (scraper_actor_run_id IS NULL):');
    console.log(`  unprocessed_scraper_payloads: ${payloadOrphans.count} (of which ${payloadsWithPreservedId.count} carry a preserved orphanedScraperActorRunId in context)`);
    console.log(`  posts:                        ${postOrphans.count}`);
    console.log(`  apify_pending_jobs:           ${apifyOrphans.count}`);
    console.log(`  brightdata_pending_jobs:      ${brightdataOrphans.count}`);
    console.log('');
    console.log('posts/unprocessed_scraper_payloads rows have no exact key back to a run -- backfilling');
    console.log('them requires the per-run data described in the incident doc (vendor, vendor_run_id,');
    console.log('the Instagram profile, and started_at), fed to: tsx backfill-scraper-actor-runs.ts backfill --input <file.json>');
  } finally {
    await client.end();
  }
}

async function resolveProfileId(db: ReturnType<typeof connect>['db'], instagramProfileId: string): Promise<string | null> {
  const matches = await db
    .select({ id: socialMediaAccountProfiles.id })
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, 'instagram'),
        sql`(${socialMediaAccountProfiles.accountId} = ${instagramProfileId} OR ${socialMediaAccountProfiles.username} = ${instagramProfileId})`
      )
    );
  if (matches.length !== 1) return null;
  return matches[0].id;
}

async function runBackfill(inputPath: string, apply: boolean, windowHours: number) {
  const records: BackfillRunRecord[] = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(records) || records.length === 0) {
    console.error(`No records found in ${inputPath} (expected a non-empty JSON array).`);
    process.exit(1);
  }

  const { client, db } = connect();
  const unresolved: string[] = [];
  let inserted = 0;
  let alreadyPresent = 0;
  let pendingJobsRelinked = 0;
  const payloadCandidates: { runIndex: number; count: number }[] = [];
  const postCandidates: { runIndex: number; count: number }[] = [];

  try {
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const label = `#${i} (${rec.vendor} ${rec.vendor_run_id})`;

      const profileId = await resolveProfileId(db, rec.instagram_profile_id);
      if (!profileId) {
        unresolved.push(`${label}: could not uniquely resolve instagram_profile_id "${rec.instagram_profile_id}" against social_media_account_profiles (platform='instagram', accountId or username match)`);
        continue;
      }

      const rawOutputArray = Array.isArray(rec.raw_output) ? rec.raw_output : undefined;
      const status = rec.status ?? (rawOutputArray && rawOutputArray.length > 0 ? 'SUCCEEDED' : 'FAILED');
      const triggerMode = rec.trigger_mode ?? 'ASYNC';
      const startedAt = new Date(rec.started_at);
      if (isNaN(startedAt.getTime())) {
        unresolved.push(`${label}: started_at "${rec.started_at}" is not a valid date`);
        continue;
      }

      const existing = await db
        .select({ id: scraperActorRuns.id })
        .from(scraperActorRuns)
        .where(and(eq(scraperActorRuns.vendor, rec.vendor), eq(scraperActorRuns.runId, rec.vendor_run_id)));

      let runId: string;
      if (existing.length > 0) {
        runId = existing[0].id;
        alreadyPresent++;
        console.log(`${label}: scraper_actor_runs row already exists (${runId}), reusing it`);
      } else {
        if (!apply) {
          console.log(`${label}: [DRY RUN] would insert scraper_actor_runs row (profile ${profileId}, status ${status})`);
          continue;
        }
        const [row] = await db
          .insert(scraperActorRuns)
          .values({
            vendor: rec.vendor,
            triggerMode,
            profileId,
            runId: rec.vendor_run_id,
            rawInput: rec.raw_input ?? {},
            rawOutput: rec.raw_output,
            status,
            itemCount: rawOutputArray?.length,
            startedAt,
            completedAt: startedAt,
          })
          .onConflictDoNothing({ target: [scraperActorRuns.vendor, scraperActorRuns.runId] })
          .returning({ id: scraperActorRuns.id });
        if (!row) {
          unresolved.push(`${label}: insert raced with a concurrent writer -- re-run to pick it up`);
          continue;
        }
        runId = row.id;
        inserted++;
        console.log(`${label}: inserted scraper_actor_runs row ${runId}`);
      }

      // Exact-key relink: pending-job tables carry the vendor run id directly, so this is
      // always safe to apply regardless of --apply (it can only ever match the one true row).
      if (apply) {
        if (rec.vendor === 'APIFY') {
          const result = await db
            .update(apifyPendingJobs)
            .set({ scraperActorRunId: runId })
            .where(and(eq(apifyPendingJobs.runId, rec.vendor_run_id), isNull(apifyPendingJobs.scraperActorRunId)))
            .returning({ id: apifyPendingJobs.id });
          pendingJobsRelinked += result.length;
        } else {
          const result = await db
            .update(brightdataPendingJobs)
            .set({ scraperActorRunId: runId })
            .where(and(eq(brightdataPendingJobs.snapshotId, rec.vendor_run_id), isNull(brightdataPendingJobs.scraperActorRunId)))
            .returning({ id: brightdataPendingJobs.id });
          pendingJobsRelinked += result.length;
        }
      }

      // Fuzzy relink candidates (profile + time window): reported always, only written with --apply.
      const windowStart = new Date(startedAt.getTime() - windowHours * 60 * 60 * 1000);
      const windowEnd = new Date(startedAt.getTime() + windowHours * 60 * 60 * 1000);

      const payloadMatches = await db
        .select({ id: unprocessedScraperPayloads.id })
        .from(unprocessedScraperPayloads)
        .where(
          and(
            isNull(unprocessedScraperPayloads.scraperActorRunId),
            gte(unprocessedScraperPayloads.createdAt, windowStart),
            lte(unprocessedScraperPayloads.createdAt, windowEnd)
          )
        );
      if (payloadMatches.length > 0) {
        payloadCandidates.push({ runIndex: i, count: payloadMatches.length });
        console.log(`${label}: ${payloadMatches.length} candidate unprocessed_scraper_payloads row(s) within +/-${windowHours}h of started_at${apply ? ' -- linking' : ' (dry run, not linked)'}`);
        if (apply) {
          await db
            .update(unprocessedScraperPayloads)
            .set({ scraperActorRunId: runId })
            .where(
              and(
                isNull(unprocessedScraperPayloads.scraperActorRunId),
                gte(unprocessedScraperPayloads.createdAt, windowStart),
                lte(unprocessedScraperPayloads.createdAt, windowEnd)
              )
            );
        }
      }

      const postMatches = await db
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.accountId, profileId),
            isNull(posts.scraperActorRunId),
            gte(posts.createdAt, windowStart),
            lte(posts.createdAt, windowEnd)
          )
        );
      if (postMatches.length > 0) {
        postCandidates.push({ runIndex: i, count: postMatches.length });
        console.log(`${label}: ${postMatches.length} candidate posts row(s) for this profile within +/-${windowHours}h of started_at${apply ? ' -- linking' : ' (dry run, not linked)'}`);
        if (apply) {
          await db
            .update(posts)
            .set({ scraperActorRunId: runId })
            .where(
              and(
                eq(posts.accountId, profileId),
                isNull(posts.scraperActorRunId),
                gte(posts.createdAt, windowStart),
                lte(posts.createdAt, windowEnd)
              )
            );
        }
      }
    }

    console.log('');
    console.log('--- Summary ---');
    console.log(`Records processed:            ${records.length}`);
    console.log(`scraper_actor_runs inserted:  ${inserted}`);
    console.log(`scraper_actor_runs reused:    ${alreadyPresent}`);
    console.log(`pending_jobs relinked:        ${apply ? pendingJobsRelinked : '(dry run -- re-run with --apply)'}`);
    console.log(`payload-candidate runs:       ${payloadCandidates.length} of ${records.length} runs had candidates`);
    console.log(`post-candidate runs:          ${postCandidates.length} of ${records.length} runs had candidates`);
    if (unresolved.length > 0) {
      console.log('');
      console.log('Unresolved records (skipped):');
      for (const line of unresolved) console.log(`  - ${line}`);
    }
    if (!apply) {
      console.log('');
      console.log('This was a DRY RUN -- nothing was written. Re-run with --apply to commit.');
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'sizing') {
    await runSizing();
    return;
  }

  if (mode === 'backfill') {
    const inputFlagIndex = rest.indexOf('--input');
    if (inputFlagIndex === -1 || !rest[inputFlagIndex + 1]) {
      console.error('Usage: tsx backfill-scraper-actor-runs.ts backfill --input <file.json> [--apply] [--window-hours N]');
      process.exit(1);
    }
    const inputPath = rest[inputFlagIndex + 1];
    const apply = rest.includes('--apply');
    const windowHoursFlagIndex = rest.indexOf('--window-hours');
    const windowHours = windowHoursFlagIndex !== -1 ? parseInt(rest[windowHoursFlagIndex + 1], 10) : DEFAULT_WINDOW_HOURS;
    await runBackfill(inputPath, apply, windowHours);
    return;
  }

  console.error('Usage:');
  console.error('  tsx backfill-scraper-actor-runs.ts sizing');
  console.error('  tsx backfill-scraper-actor-runs.ts backfill --input <file.json> [--apply] [--window-hours N]');
  process.exit(1);
}

main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
