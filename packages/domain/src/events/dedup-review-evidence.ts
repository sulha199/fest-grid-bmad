import type { MatchTier, PromotionRule } from './match-scoring.js';

/**
 * AI-assisted dedup review, export side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B1).
 *
 * The evidence contract between the read-only export (`apps/backend/src/dedup-review-export.ts`) and
 * whatever reads its output, plus the pure parts around it: input validation, the canonical form
 * the evidence hash is taken over, and the output format. Pure and dependency-free (project-context:
 * `packages/domain` has no Node-only modules), so the hash itself is computed in the backend.
 *
 * The repo is public and so are Actions logs: nothing here carries a username, an account id, a
 * caption or an email. A posting account is reduced to its type, and "same account" to a boolean.
 */

export const DEDUP_REVIEW_EXPORT_BEGIN = 'DEDUP_REVIEW_EXPORT_BEGIN';
export const DEDUP_REVIEW_EXPORT_END = 'DEDUP_REVIEW_EXPORT_END';
export const DEDUP_REVIEW_DEFAULT_LIMIT = 30;
export const DEDUP_REVIEW_MAX_LIMIT = 50;
export const DEDUP_REVIEW_MAX_SKIP_IDS = 200;
/** How many pending rows one export looks at before giving up on filling the limit. */
export const DEDUP_REVIEW_SCAN_CAP = 300;
/** `recentlyResolved` covers suggestions resolved within this many days. */
export const DEDUP_REVIEW_RECENT_DAYS = 14;

export type DedupReviewAccountType = 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | 'UNCLASSIFIED';

/** `UNCLASSIFIED` stands for an account that has never been classified. */
export function toDedupReviewAccountType(value: string | null | undefined): DedupReviewAccountType {
  return value === 'ORGANIZER_VENUE_EVENT' || value === 'PERSONAL' || value === 'CURATOR_GUIDE' ? value : 'UNCLASSIFIED';
}

/** `Infinity` ("no usable date pair") is not valid JSON, so it is exported as `null`. */
export function toDedupReviewDayDiff(minDayDiff: number): number | null {
  return Number.isFinite(minDayDiff) ? minDayDiff : null;
}

export interface DedupReviewScheduleEvidence {
  isMain: boolean;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  title: string | null;
  location: string | null;
}

export interface DedupReviewSourcePost {
  isPrimary: boolean;
  accountType: DedupReviewAccountType;
  publishedAt: string | null;
}

export interface DedupReviewEventEvidence {
  name: string;
  slug: string;
  location: string | null;
  /** Normalized event links (lower-cased, query string and trailing slash removed). */
  links: string[];
  detailLevel: 'stub' | 'full';
  categories: string[];
  types: string[];
  schedules: DedupReviewScheduleEvidence[];
  sourcePosts: DedupReviewSourcePost[];
}

export interface DedupReviewSignals {
  tier: MatchTier;
  scoredTier: MatchTier;
  score: number;
  promotedByRule: boolean;
  promotionRule: PromotionRule;
  stubRepeat: boolean;
  venueMatch: boolean;
  nameSimilarity: number;
  minDayDiff: number | null;
  organizerMatch: boolean;
  sharedLink: boolean;
}

/** Everything a reviewer sees about one pending suggestion; the evidence hash is taken over all of it. */
export interface DedupReviewPairEvidence {
  suggestionId: string;
  status: 'pending';
  storedScore: number;
  signals: DedupReviewSignals;
  /** True when a post of the new event and a post of the candidate were published by one account. */
  sameAccount: boolean;
  /** How many merges driven by this suggestion were later undone (a human disagreed). */
  undoneMergeCount: number;
  /** The existing event; a merge keeps it. */
  candidate: DedupReviewEventEvidence;
  /** The newly ingested event; a merge folds it into the candidate. */
  newEvent: DedupReviewEventEvidence;
}

export interface DedupReviewExportPair extends DedupReviewPairEvidence {
  evidenceHash: string;
}

export type DedupReviewResolvedBy = 'reviewer' | 'human' | 'system' | 'unknown';

export interface DedupReviewResolvedSuggestion {
  suggestionId: string;
  status: 'accepted' | 'rejected' | 'expired';
  resolvedAt: string;
  resolvedBy: DedupReviewResolvedBy;
}

export interface DedupReviewExportReport {
  schemaVersion: 1;
  generatedAt: string;
  runTag: string | null;
  limit: number;
  /** Every pending suggestion, whether or not this run looked at it. */
  totalPending: number;
  /** Looked at and dropped because an event was deleted or merged away. */
  staleCount: number;
  /** Looked at and dropped because the caller asked to skip it. */
  skippedCount: number;
  /** True when the scan cap was reached before the limit was filled. */
  scanLimited: boolean;
  pairs: DedupReviewExportPair[];
  recentlyResolved: DedupReviewResolvedSuggestion[];
}

/**
 * Who closed a suggestion. `reviewer` needs the reviewer's user id; without it a moderator's
 * resolution cannot be told from the reviewer's and is `unknown`. An expiry is the system's.
 */
export function classifyDedupReviewResolvedBy(input: {
  status: 'accepted' | 'rejected' | 'expired';
  resolvedByModeratorId: string | null;
  reviewerUserId: string | null;
}): DedupReviewResolvedBy {
  if (input.resolvedByModeratorId === null) {
    return input.status === 'expired' ? 'system' : 'unknown';
  }
  if (input.reviewerUserId === null) {
    return 'unknown';
  }
  return input.resolvedByModeratorId === input.reviewerUserId ? 'reviewer' : 'human';
}

function compareJson(a: unknown, b: unknown): number {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Objects get sorted keys and arrays a sorted order, so the result does not depend on how the evidence was assembled. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical).sort(compareJson);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])])
    );
  }
  return value;
}

/** The string the evidence hash is taken over. Every field of the evidence is in it, so any change to what a reviewer saw changes the hash. */
export function canonicalizeDedupEvidence(evidence: DedupReviewPairEvidence): string {
  return JSON.stringify(canonical(evidence));
}

export class DedupReviewOptionsError extends Error {}

export interface DedupReviewOptions {
  limit: number;
  skipIds: string[];
  runTag: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RUN_TAG = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Validates the export's inputs (workflow inputs arrive as strings). A bad value throws an error
 * that names the field and never echoes the value, which is untrusted text.
 */
export function parseDedupReviewOptions(input: { limit?: string | null; skipIds?: string | null; runTag?: string | null }): DedupReviewOptions {
  let limit = DEDUP_REVIEW_DEFAULT_LIMIT;
  const rawLimit = input.limit?.trim();
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!/^\d+$/.test(rawLimit) || parsed < 1 || parsed > DEDUP_REVIEW_MAX_LIMIT) {
      throw new DedupReviewOptionsError(`limit must be an integer from 1 to ${DEDUP_REVIEW_MAX_LIMIT}`);
    }
    limit = parsed;
  }

  const skipIds = [
    ...new Set(
      (input.skipIds ?? '')
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter((id) => id.length > 0)
    ),
  ];
  if (skipIds.length > DEDUP_REVIEW_MAX_SKIP_IDS) {
    throw new DedupReviewOptionsError(`skip_ids must hold at most ${DEDUP_REVIEW_MAX_SKIP_IDS} ids`);
  }
  if (skipIds.some((id) => !UUID.test(id))) {
    throw new DedupReviewOptionsError('skip_ids must be comma-separated suggestion uuids');
  }

  const rawTag = input.runTag?.trim() ?? '';
  if (rawTag && !RUN_TAG.test(rawTag)) {
    throw new DedupReviewOptionsError('run_tag must be 1 to 64 letters, digits, ".", "_" or "-"');
  }

  return { limit, skipIds, runTag: rawTag || null };
}

/**
 * The lines the export prints. The JSON is one `JSON.stringify` line, so no event name can start a
 * log line with `::` (a workflow command) or break out of it.
 */
export function formatDedupReviewExport(report: DedupReviewExportReport): string[] {
  return [DEDUP_REVIEW_EXPORT_BEGIN, JSON.stringify(report), DEDUP_REVIEW_EXPORT_END];
}
