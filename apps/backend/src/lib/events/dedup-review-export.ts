import { createHash } from 'node:crypto';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, ne, notInArray, sql } from 'drizzle-orm';
import { eventMatchCandidates, eventMerges, eventPosts, events, posts, schedules, socialMediaAccountProfiles } from '@festgrid/database';
import {
  DEDUP_REVIEW_RECENT_DAYS,
  DEDUP_REVIEW_RECENT_LIMIT,
  DEDUP_REVIEW_SCAN_CAP,
  canonicalizeDedupEvidence,
  classifyDedupReviewResolvedBy,
  normalizeEventLinkUrl,
  toDedupReviewAccountType,
  toDedupReviewDayDiff,
  type DedupReviewEventEvidence,
  type DedupReviewExportPair,
  type DedupReviewExportReport,
  type DedupReviewPairEvidence,
} from '@festgrid/domain/events';
import type { db as appDb } from '../../db/client.js';
import { DedupReviewRoleError } from './dedup-review-errors.js';
import { evaluateBacklogRow, type BacklogEvaluation } from './drain-match-backlog.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AI-assisted dedup review, export side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B1).
 *
 * Builds the evidence a reviewer needs for the oldest pending `event_match_candidates` rows, without
 * writing anything. The tier signals come from `evaluateBacklogRow` (so they are exactly what
 * ingestion's `decideMatchTier` says); this file adds the event, schedule and source-post facts and
 * the evidence hash.
 *
 * The repo is public and so are Actions logs. Nothing from an account row (username, account id) or
 * a caption is read into the output; a posting account becomes its type and "same account" a
 * boolean. Event text (names, locations, schedule titles, link paths) is passed through as stored:
 * it is already public on the event pages.
 */

const SCAN_BATCH = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BuildDedupReviewExportOptions {
  limit: number;
  skipIds: string[];
  runTag: string | null;
  now?: Date;
  /** Tests only: how many pending rows one export may look at (default `DEDUP_REVIEW_SCAN_CAP`). */
  scanCap?: number;
  /** Tests only: how many resolved suggestions to list (default `DEDUP_REVIEW_RECENT_LIMIT`). */
  recentLimit?: number;
  /** Restricts the scan to these suggestions (tests: the shared dev DB holds others). */
  onlySuggestionIds?: string[];
}

/**
 * Runs `work` in one snapshot that cannot write: `REPEATABLE READ, READ ONLY`. Read only means that
 * even a write-capable credential changes nothing if the secret is ever pointed at one by mistake;
 * repeatable read means the whole export, its paging included, sees one consistent state while
 * moderators and ingestion keep working.
 *
 * It also puts `extensions` on the search path. On Supabase `pg_trgm` is installed in the
 * `extensions` schema, and a role that is not the app's own (the read-only role the export runs as)
 * does not necessarily have that schema on its path, so the unqualified `similarity()` the evidence
 * query uses fails with SQLSTATE 42883 ("function does not exist"), which is what the first run did.
 * A schema that does not exist (a local database with `pg_trgm` in `public`) is ignored by Postgres.
 */
export async function runInReadOnlyTransaction<T>(database: Pick<typeof appDb, 'transaction'>, work: (executor: DbExecutor) => Promise<T>): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
    await tx.execute(sql`SET LOCAL search_path TO public, extensions`);
    return work(tx);
  });
}

/**
 * Runs `work` in a transaction that may write (the apply script's `apply` mode), at the isolation
 * level the moderator's own mutation uses, `READ COMMITTED`: a merge reads and repoints rows that other
 * writers keep changing, and a long snapshot would hide their newest rows from it (see the apply
 * spec). It sets the same search path as the read-only wrapper, for the same reason.
 */
export async function runInWriteTransaction<T>(database: Pick<typeof appDb, 'transaction'>, work: (tx: Parameters<Parameters<typeof appDb.transaction>[0]>[0]) => Promise<T>): Promise<T> {
  return database.transaction(
    async (tx) => {
      await tx.execute(sql`SET LOCAL search_path TO public, extensions`);
      // A run that waits on a stuck moderator transaction or on another apply run must fail, not hang
      // holding locks until the job's own timeout.
      await tx.execute(sql`SET LOCAL lock_timeout = '15s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '120s'`);
      return work(tx);
    },
    { isolationLevel: 'read committed' }
  );
}

/**
 * Every table the export reads has row level security, so a role that cannot bypass it sees no rows
 * and the export would read as an empty queue, which a daily reviewer would trust. Refuse instead.
 */
export async function assertRoleBypassesRls(executor: DbExecutor): Promise<void> {
  const rows = (await executor.execute(sql`SELECT (rolbypassrls OR rolsuper) AS bypass FROM pg_roles WHERE rolname = current_user`)) as unknown as Array<{
    bypass: boolean;
  }>;
  if (rows[0]?.bypass !== true) {
    throw new DedupReviewRoleError(
      'The database role cannot bypass row level security, so every table would look empty and the export would pass for an empty queue. Put the URL of a read-only role with BYPASSRLS in DEDUP_REVIEW_READONLY_DATABASE_URL (docs/infrastructure/3-database.md).'
    );
  }
}

/** The hash the apply side recomputes: SHA-256 (hex) of the canonical evidence string built in `packages/domain`. */
export function hashDedupReviewEvidence(evidence: DedupReviewPairEvidence): string {
  return createHash('sha256').update(canonicalizeDedupEvidence(evidence)).digest('hex');
}

async function loadEventEvidence(executor: DbExecutor, eventId: string): Promise<{ evidence: DedupReviewEventEvidence; accountIds: Set<string> }> {
  const [event] = await executor.select().from(events).where(eq(events.id, eventId)).limit(1);
  const scheduleRows = await executor
    .select()
    .from(schedules)
    .where(eq(schedules.eventId, eventId))
    .orderBy(asc(schedules.eventStartDate), asc(schedules.id));
  const linkedPosts = await executor
    .select({
      postId: eventPosts.postId,
      accountId: posts.accountId,
      publishedAt: posts.publishedAt,
      accountType: socialMediaAccountProfiles.accountType,
      accountTypeStatus: socialMediaAccountProfiles.accountTypeStatus,
    })
    .from(eventPosts)
    .innerJoin(posts, eq(posts.id, eventPosts.postId))
    .leftJoin(socialMediaAccountProfiles, eq(socialMediaAccountProfiles.id, posts.accountId))
    .where(eq(eventPosts.eventId, eventId));

  // A link row in production can lack a usable `url` (the match scoring tolerates that too), so each
  // entry is checked instead of trusting the declared type.
  const links = [
    ...new Set(
      (event.links ?? [])
        .flatMap((link) => (typeof link?.url === 'string' ? [normalizeEventLinkUrl(link.url)] : []))
        .filter((url) => url.length > 0)
    ),
  ];

  return {
    evidence: {
      name: event.eventName,
      slug: event.slug,
      location: event.location ?? null,
      links,
      detailLevel: event.detailLevel,
      categories: (event.categories ?? []).map(String),
      types: (event.types ?? []).map(String),
      schedules: scheduleRows.map((s) => ({
        isMain: s.isMainSchedule,
        startDate: String(s.eventStartDate),
        endDate: s.eventEndDate === null ? null : String(s.eventEndDate),
        startTime: s.eventStartTime ?? null,
        endTime: s.eventEndTime ?? null,
        timezone: s.timezone ?? null,
        title: s.title ?? null,
        location: s.location ?? null,
      })),
      sourcePosts: linkedPosts.map((p) => ({
        isPrimary: p.postId === event.postId,
        accountType: toDedupReviewAccountType(p.accountType, p.accountTypeStatus),
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      })),
    },
    accountIds: new Set(linkedPosts.map((p) => p.accountId).filter((id): id is string => typeof id === 'string')),
  };
}

/**
 * One pair's evidence as the export prints it, plus what the apply side needs and the evidence does
 * not carry: both event ids (to claim them for one run) and the live scoring's venue conflict (the
 * evidence has no coordinates, so it cannot be derived from it).
 */
export async function buildDedupReviewPair(
  executor: DbExecutor,
  evaluation: BacklogEvaluation
): Promise<{ pair: DedupReviewExportPair; candidateEventId: string; newEventId: string; venueConflict: boolean }> {
  const candidate = await loadEventEvidence(executor, evaluation.candidate.id);
  const newEvent = await loadEventEvidence(executor, evaluation.newEvent.id);
  const [{ undone }] = await executor
    .select({ undone: count() })
    .from(eventMerges)
    .where(and(eq(eventMerges.suggestionId, evaluation.suggestionId), isNotNull(eventMerges.undoneAt)));

  const d = evaluation.decision;
  const evidence: DedupReviewPairEvidence = {
    suggestionId: evaluation.suggestionId,
    status: 'pending',
    storedScore: evaluation.storedScore,
    signals: {
      tier: d.tier,
      scoredTier: d.scoredTier,
      score: d.score,
      promotedByRule: d.promotedByRule,
      promotionRule: d.promotionRule,
      stubRepeat: d.stubRepeat,
      venueMatch: d.venueMatch,
      nameSimilarity: evaluation.nameSimilarity,
      minDayDiff: toDedupReviewDayDiff(evaluation.minDayDiff),
      organizerMatch: evaluation.organizerMatch,
      sharedLink: evaluation.sharedLink,
    },
    sameAccount: [...candidate.accountIds].some((id) => newEvent.accountIds.has(id)),
    undoneMergeCount: Number(undone),
    candidate: candidate.evidence,
    newEvent: newEvent.evidence,
  };

  return {
    pair: { ...evidence, evidenceHash: hashDedupReviewEvidence(evidence) },
    candidateEventId: evaluation.candidate.id,
    newEventId: evaluation.newEvent.id,
    venueConflict: d.venueConflict,
  };
}

/**
 * Looks at pending suggestions oldest first, dropping stale ones, until `limit` pairs are built or
 * the scan cap is reached. Ids in `skipIds` are filtered out in the query, so they never use up the
 * scan cap, and are counted separately so the count is queue-wide.
 */
export async function buildDedupReviewExport(executor: DbExecutor, options: BuildDedupReviewExportOptions): Promise<DedupReviewExportReport> {
  await assertRoleBypassesRls(executor);

  const now = options.now ?? new Date();
  const scanCap = options.scanCap ?? DEDUP_REVIEW_SCAN_CAP;
  const recentLimit = options.recentLimit ?? DEDUP_REVIEW_RECENT_LIMIT;
  const only = options.onlySuggestionIds;
  const pendingScope = and(eq(eventMatchCandidates.status, 'pending'), only ? inArray(eventMatchCandidates.id, only) : undefined);

  const [{ total }] = await executor.select({ total: count() }).from(eventMatchCandidates).where(eq(eventMatchCandidates.status, 'pending'));

  let skippedCount = 0;
  if (options.skipIds.length > 0) {
    const [{ skipped }] = await executor
      .select({ skipped: count() })
      .from(eventMatchCandidates)
      .where(and(pendingScope, inArray(eventMatchCandidates.id, options.skipIds)));
    skippedCount = Number(skipped);
  }
  const scanScope = and(pendingScope, options.skipIds.length > 0 ? notInArray(eventMatchCandidates.id, options.skipIds) : undefined);
  const scanPage = (offset: number, pageSize: number) =>
    executor
      .select({
        id: eventMatchCandidates.id,
        eventId: eventMatchCandidates.eventId,
        candidateEventId: eventMatchCandidates.candidateEventId,
        postId: eventMatchCandidates.postId,
        score: eventMatchCandidates.score,
      })
      .from(eventMatchCandidates)
      .where(scanScope)
      .orderBy(asc(eventMatchCandidates.createdAt), asc(eventMatchCandidates.id))
      .limit(pageSize)
      .offset(offset);

  const pairs: DedupReviewExportPair[] = [];
  let scanned = 0;
  let staleCount = 0;
  let offset = 0;
  let exhausted = false;
  let unscanned = false;

  while (pairs.length < options.limit && scanned < scanCap && !exhausted) {
    const batch = await scanPage(offset, SCAN_BATCH);
    exhausted = batch.length < SCAN_BATCH;
    offset += batch.length;

    for (const row of batch) {
      if (pairs.length >= options.limit || scanned >= scanCap) {
        unscanned = true;
        break;
      }
      scanned++;
      const evaluation = await evaluateBacklogRow(executor, row);
      if (evaluation.kind === 'stale') {
        staleCount++;
        continue;
      }
      pairs.push((await buildDedupReviewPair(executor, evaluation)).pair);
    }
  }

  // The scan can stop on a full page with nothing after it, so ask whether a next row really exists.
  if (pairs.length < options.limit && !unscanned && !exhausted) {
    unscanned = (await scanPage(offset, 1)).length > 0;
  }

  const cutoff = new Date(now.getTime() - DEDUP_REVIEW_RECENT_DAYS * DAY_MS);
  const resolved = await executor
    .select({
      id: eventMatchCandidates.id,
      status: eventMatchCandidates.status,
      resolvedAt: eventMatchCandidates.resolvedAt,
      resolvedVia: eventMatchCandidates.resolvedVia,
    })
    .from(eventMatchCandidates)
    .where(and(ne(eventMatchCandidates.status, 'pending'), isNotNull(eventMatchCandidates.resolvedAt), gte(eventMatchCandidates.resolvedAt, cutoff)))
    .orderBy(desc(eventMatchCandidates.resolvedAt))
    .limit(recentLimit + 1);

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    runTag: options.runTag,
    limit: options.limit,
    totalPending: Number(total),
    staleCount,
    skippedCount,
    scanLimited: pairs.length < options.limit && unscanned,
    pairs,
    recentlyResolved: resolved.slice(0, recentLimit).flatMap((row) =>
      row.status === 'pending' || row.resolvedAt === null
        ? []
        : [
            {
              suggestionId: row.id,
              status: row.status,
              resolvedAt: row.resolvedAt.toISOString(),
              resolvedBy: classifyDedupReviewResolvedBy({
                status: row.status,
                resolvedVia: row.resolvedVia,
              }),
            },
          ]
    ),
    recentlyResolvedTruncated: resolved.length > recentLimit,
  };
}
