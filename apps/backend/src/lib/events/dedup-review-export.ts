import { createHash } from 'node:crypto';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { eventMatchCandidates, eventMerges, eventPosts, events, posts, schedules, socialMediaAccountProfiles, users } from '@festgrid/database';
import {
  DEDUP_REVIEW_RECENT_DAYS,
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
import { evaluateBacklogRow, type BacklogEvaluation } from './drain-match-backlog.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AI-assisted dedup review, export side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B1).
 *
 * Builds the evidence a reviewer needs for the oldest pending `event_match_candidates` rows, without
 * writing anything. The tier signals come from `evaluateBacklogRow` (so they are exactly what
 * ingestion's `decideMatchTier` says); this file adds the event, schedule and source-post facts and
 * the evidence hash. The repo is public and so are Actions logs: no username, account id, caption or
 * email is read into the output (a posting account becomes its type, "same account" a boolean).
 */

const SCAN_BATCH = 50;
const RECENTLY_RESOLVED_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BuildDedupReviewExportOptions {
  limit: number;
  skipIds: string[];
  runTag: string | null;
  /** `users.id` of the dedicated reviewer moderator, so its resolutions are told apart from a human's. */
  reviewerUserId: string | null;
  now?: Date;
  /** Tests only: how many pending rows one export may look at (default `DEDUP_REVIEW_SCAN_CAP`). */
  scanCap?: number;
  /** Tests only: restricts the scan to these suggestions (the shared dev DB holds others). */
  onlySuggestionIds?: string[];
}

/**
 * Runs `work` inside a transaction set `READ ONLY`, whatever credential the connection uses: if the
 * secret is ever pointed at a write-capable role by mistake, the export still cannot change a row.
 */
export async function runInReadOnlyTransaction<T>(database: Pick<typeof appDb, 'transaction'>, work: (executor: DbExecutor) => Promise<T>): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return work(tx);
  });
}

/** Resolves the reviewer's `users.id` from its email; the email itself is never printed. */
export async function resolveReviewerUserId(executor: DbExecutor, email: string): Promise<string> {
  const [reviewer] = await executor
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, 'moderator')))
    .limit(1);
  if (!reviewer) {
    throw new Error('The dedup reviewer account was not found among moderators. Check the DEDUP_REVIEW_MODERATOR_EMAIL repository variable.');
  }
  return reviewer.id;
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
    })
    .from(eventPosts)
    .innerJoin(posts, eq(posts.id, eventPosts.postId))
    .leftJoin(socialMediaAccountProfiles, eq(socialMediaAccountProfiles.id, posts.accountId))
    .where(eq(eventPosts.eventId, eventId));

  const links = [...new Set((event.links ?? []).map((link) => normalizeEventLinkUrl(link.url)).filter((url) => url.length > 0))];

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
        accountType: toDedupReviewAccountType(p.accountType),
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      })),
    },
    accountIds: new Set(linkedPosts.map((p) => p.accountId).filter((id): id is string => typeof id === 'string')),
  };
}

async function buildPair(executor: DbExecutor, evaluation: BacklogEvaluation): Promise<DedupReviewExportPair> {
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

  return { ...evidence, evidenceHash: createHash('sha256').update(canonicalizeDedupEvidence(evidence)).digest('hex') };
}

/** Looks at pending suggestions oldest first, dropping stale and skipped ones, until `limit` pairs are built or the scan cap is reached. */
export async function buildDedupReviewExport(executor: DbExecutor, options: BuildDedupReviewExportOptions): Promise<DedupReviewExportReport> {
  const now = options.now ?? new Date();
  const scanCap = options.scanCap ?? DEDUP_REVIEW_SCAN_CAP;
  const skip = new Set(options.skipIds);
  const only = options.onlySuggestionIds;

  const [{ total }] = await executor
    .select({ total: count() })
    .from(eventMatchCandidates)
    .where(eq(eventMatchCandidates.status, 'pending'));

  const pairs: DedupReviewExportPair[] = [];
  let scanned = 0;
  let staleCount = 0;
  let skippedCount = 0;
  let offset = 0;
  let exhausted = false;
  let unscanned = false;

  while (pairs.length < options.limit && scanned < scanCap && !exhausted) {
    const batch = await executor
      .select({
        id: eventMatchCandidates.id,
        eventId: eventMatchCandidates.eventId,
        candidateEventId: eventMatchCandidates.candidateEventId,
        postId: eventMatchCandidates.postId,
        score: eventMatchCandidates.score,
      })
      .from(eventMatchCandidates)
      .where(and(eq(eventMatchCandidates.status, 'pending'), only ? inArray(eventMatchCandidates.id, only) : undefined))
      .orderBy(asc(eventMatchCandidates.createdAt), asc(eventMatchCandidates.id))
      .limit(SCAN_BATCH)
      .offset(offset);
    exhausted = batch.length < SCAN_BATCH;
    offset += batch.length;

    for (const row of batch) {
      if (pairs.length >= options.limit || scanned >= scanCap) {
        unscanned = true;
        break;
      }
      scanned++;
      if (skip.has(row.id)) {
        skippedCount++;
        continue;
      }
      const evaluation = await evaluateBacklogRow(executor, row);
      if (evaluation.kind === 'stale') {
        staleCount++;
        continue;
      }
      pairs.push(await buildPair(executor, evaluation));
    }
  }

  const cutoff = new Date(now.getTime() - DEDUP_REVIEW_RECENT_DAYS * DAY_MS);
  const resolved = await executor
    .select({
      id: eventMatchCandidates.id,
      status: eventMatchCandidates.status,
      resolvedAt: eventMatchCandidates.resolvedAt,
      resolvedByModeratorId: eventMatchCandidates.resolvedByModeratorId,
    })
    .from(eventMatchCandidates)
    .where(and(ne(eventMatchCandidates.status, 'pending'), isNotNull(eventMatchCandidates.resolvedAt), gte(eventMatchCandidates.resolvedAt, cutoff)))
    .orderBy(desc(eventMatchCandidates.resolvedAt))
    .limit(RECENTLY_RESOLVED_LIMIT);

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    runTag: options.runTag,
    limit: options.limit,
    totalPending: Number(total),
    staleCount,
    skippedCount,
    scanLimited: pairs.length < options.limit && (unscanned || !exhausted),
    pairs,
    recentlyResolved: resolved.flatMap((row) =>
      row.status === 'pending' || row.resolvedAt === null
        ? []
        : [
            {
              suggestionId: row.id,
              status: row.status,
              resolvedAt: row.resolvedAt.toISOString(),
              resolvedBy: classifyDedupReviewResolvedBy({
                status: row.status,
                resolvedByModeratorId: row.resolvedByModeratorId,
                reviewerUserId: options.reviewerUserId,
              }),
            },
          ]
    ),
  };
}
