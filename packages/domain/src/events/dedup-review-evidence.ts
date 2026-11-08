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
/** `recentlyResolved` (decisions) and `recentlyExpiredCount` cover suggestions resolved within this many days. */
export const DEDUP_REVIEW_RECENT_DAYS = 14;
/** `recentlyResolved` holds at most this many decisions; `recentlyResolvedTruncated` says when more existed. Expiries are counted, not listed. */
export const DEDUP_REVIEW_RECENT_LIMIT = 200;

export type DedupReviewAccountType = 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | 'UNCLASSIFIED';

/**
 * `UNCLASSIFIED` stands for an account that has never been classified, or whose AI-proposed type is
 * still `AWAITING_APPROVAL` (a guess, not a decision, so it must not read as a fact).
 */
export function toDedupReviewAccountType(value: string | null | undefined, status?: string | null): DedupReviewAccountType {
  if (status === 'AWAITING_APPROVAL') {
    return 'UNCLASSIFIED';
  }
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

/** A decision a person or the reviewer made. Expiries are counted apart (`recentlyExpiredCount`), not listed. */
export interface DedupReviewResolvedSuggestion {
  suggestionId: string;
  status: 'accepted' | 'rejected';
  resolvedAt: string;
  resolvedBy: DedupReviewResolvedBy;
}

export type DedupReviewSkipStatus = 'accepted' | 'rejected' | 'expired' | 'missing';

/** What became of a suggestion the caller put in `skip_ids` that is no longer pending. */
export interface DedupReviewSkipResolution {
  suggestionId: string;
  /** `missing`: no such row (a suggestion is deleted with its event). */
  status: DedupReviewSkipStatus;
  /** Null for `missing`, and for a resolved row that has no `resolved_at`. */
  resolvedAt: string | null;
  /** Null only for `missing`. */
  resolvedBy: DedupReviewResolvedBy | null;
}

/**
 * Writer and reader of this report ship in one commit (the skill's preflight pins the checkout, the
 * workflow and the run to master's head), so adding fields and narrowing `recentlyResolved` do not bump
 * `schemaVersion`. A reader that needs a field this version lacks must refuse the report and name it.
 */
export interface DedupReviewExportReport {
  schemaVersion: 1;
  generatedAt: string;
  runTag: string | null;
  limit: number;
  /** Every pending suggestion, whether or not this run looked at it. */
  totalPending: number;
  /** Stale rows (an event deleted or merged away) among the rows this run scanned; the scan stops once the limit is filled. */
  staleCount: number;
  /** Pending suggestions named in `skip_ids`: queue-wide, and they never use up the scan cap. */
  skippedCount: number;
  /** How many distinct suggestion ids the caller sent in `skip_ids`. `skippedCount + skipResolved.length` equals it. */
  skipIdCount: number;
  /** The sent ids that are not pending (resolved, expired or missing), sorted by id, whatever the age and the 200 cap. */
  skipResolved: DedupReviewSkipResolution[];
  /** True when rows were left unscanned at the scan cap before the limit was filled. */
  scanLimited: boolean;
  /** The creation time of the oldest pending suggestion in the whole queue, or null when none is pending. */
  oldestPendingAt: string | null;
  /** The same, among pending suggestions not in `skip_ids` (the oldest nobody has escalated); null when there are none. */
  oldestUnskippedPendingAt: string | null;
  pairs: DedupReviewExportPair[];
  /** Decisions (accepted, rejected) of the last `DEDUP_REVIEW_RECENT_DAYS` days, newest first. */
  recentlyResolved: DedupReviewResolvedSuggestion[];
  /** True when more than `DEDUP_REVIEW_RECENT_LIMIT` decisions were made in the window. */
  recentlyResolvedTruncated: boolean;
  /** Suggestions that expired in the same window, uncapped. */
  recentlyExpiredCount: number;
}

/**
 * Who closed a suggestion, read from the `resolved_via` flag the shared resolve path writes:
 * `ai_skill` is the `reviewer`, `moderator` is a `human`. An expiry is the system's. An accepted or
 * rejected row without the flag predates it and cannot be told apart, so it is `unknown`.
 */
export function classifyDedupReviewResolvedBy(input: {
  status: 'accepted' | 'rejected' | 'expired';
  resolvedVia: 'moderator' | 'ai_skill' | null;
}): DedupReviewResolvedBy {
  if (input.status === 'expired') {
    return 'system';
  }
  if (input.resolvedVia === 'ai_skill') {
    return 'reviewer';
  }
  // Anything else, including a source added later that this version does not know, is not guessed at.
  return input.resolvedVia === 'moderator' ? 'human' : 'unknown';
}

/** A database timestamp as the report prints it, or null. */
export function toDedupReviewTimestamp(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** One suggestion row as read for the ids a caller sent in `skip_ids`. */
export interface DedupReviewSkipRow {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  resolvedAt: Date | null;
  resolvedVia: 'moderator' | 'ai_skill' | null;
}

/**
 * Splits the ids a caller sent in `skip_ids` by what the database holds for them: still pending
 * (counted), resolved or expired (listed with who and when), or not there at all (`missing`).
 *
 * Ids are lower-cased and deduplicated and the result is sorted by id, because the database returns rows
 * in no fixed order and this is exported through the builder, which is not only reached through
 * `parseDedupReviewOptions`. Every distinct id lands in exactly one of the three, so
 * `skippedCount + skipResolved.length === skipIdCount` holds by construction. A resolved row without a
 * `resolved_at` is listed with a null time and is never mistaken for `missing`: its status says which
 * it is.
 */
export function partitionDedupReviewSkipIds(
  skipIds: readonly string[],
  rows: readonly DedupReviewSkipRow[]
): { skipIdCount: number; skippedCount: number; skipResolved: DedupReviewSkipResolution[] } {
  const wanted = [...new Set(skipIds.map((id) => id.toLowerCase()))].sort();
  const byId = new Map(rows.map((row) => [row.id.toLowerCase(), row]));
  let skippedCount = 0;
  const skipResolved: DedupReviewSkipResolution[] = [];
  for (const id of wanted) {
    const row = byId.get(id);
    if (row === undefined) {
      skipResolved.push({ suggestionId: id, status: 'missing', resolvedAt: null, resolvedBy: null });
    } else if (row.status === 'pending') {
      skippedCount++;
    } else {
      skipResolved.push({
        suggestionId: id,
        status: row.status,
        resolvedAt: toDedupReviewTimestamp(row.resolvedAt),
        resolvedBy: classifyDedupReviewResolvedBy({ status: row.status, resolvedVia: row.resolvedVia }),
      });
    }
  }
  return { skipIdCount: wanted.length, skippedCount, skipResolved };
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
