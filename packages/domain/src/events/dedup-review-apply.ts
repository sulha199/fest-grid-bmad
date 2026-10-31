import type { DedupReviewExportPair } from './dedup-review-evidence.js';
import { MID_PROMOTION_MAX_DAY_DIFF, SHARED_LINK_DATE_WINDOW_DAYS, namesContradict } from './match-scoring.js';

/**
 * AI-assisted dedup review, apply side (`_bmad-output/specs/ai-dedup-review/DESIGN.md`, Piece B2b-1).
 *
 * The pure parts of acting on a reviewer's decisions: input validation, the deterministic floor, the
 * per-decision verdict (caps and shared events included) and the output format. Pure and
 * dependency-free, so the hash comparison's inputs and every database action stay in
 * `apps/backend`. The repo is public and so are Actions logs: nothing here carries event text,
 * the reviewer's `reasons`, an email or the invoker hash.
 */

export const DEDUP_REVIEW_APPLY_BEGIN = 'DEDUP_REVIEW_APPLY_BEGIN';
export const DEDUP_REVIEW_APPLY_END = 'DEDUP_REVIEW_APPLY_END';
export const DEDUP_REVIEW_APPLY_SCHEMA_VERSION = 1;
export const DEDUP_REVIEW_MAX_DECISIONS = 50;
export const DEDUP_REVIEW_MAX_DECISIONS_BYTES = 65_535;
export const DEDUP_REVIEW_MAX_REASONS = 5;
export const DEDUP_REVIEW_MAX_REASON_LENGTH = 200;
/** How many pairs one run may merge. */
export const DEDUP_REVIEW_PER_RUN_CAP = 10;
/** How many AI decisions (merges, including undone ones, and rejections) the last 24 hours may hold. */
export const DEDUP_REVIEW_PER_DAY_CAP = 25;

/** A bad input. The message names the field and never echoes a value, which is untrusted text. */
export class DedupReviewApplyInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const RUN_TAG = /^[A-Za-z0-9._-]{1,64}$/;

/** The one reviewer-chosen thing apply acts on; `reasons` are validated and then dropped. */
export interface DedupReviewDecision {
  suggestionId: string;
  evidenceHash: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/**
 * Parses the decisions file: `{"schemaVersion":1,"decisions":[{suggestionId, evidenceHash, reasons}]}`.
 * Every failure throws the same kind of fixed message (a JSON syntax error can quote its input), and
 * `reasons` never leaves this function.
 */
export function parseDedupReviewDecisions(raw: string): DedupReviewDecision[] {
  if (new TextEncoder().encode(raw).length > DEDUP_REVIEW_MAX_DECISIONS_BYTES) {
    throw new DedupReviewApplyInputError(`the decisions file must be at most ${DEDUP_REVIEW_MAX_DECISIONS_BYTES} bytes`);
  }
  let parsed: unknown;
  try {
    // Some editors and tools put a byte order mark in front of a UTF-8 file.
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw new DedupReviewApplyInputError('the decisions file is not valid JSON');
  }
  if (!isPlainObject(parsed) || !hasExactlyKeys(parsed, ['schemaVersion', 'decisions']) || parsed.schemaVersion !== DEDUP_REVIEW_APPLY_SCHEMA_VERSION) {
    throw new DedupReviewApplyInputError(`the decisions file must be {"schemaVersion":${DEDUP_REVIEW_APPLY_SCHEMA_VERSION},"decisions":[...]} and nothing else`);
  }
  const entries = parsed.decisions;
  if (!Array.isArray(entries) || entries.length > DEDUP_REVIEW_MAX_DECISIONS) {
    throw new DedupReviewApplyInputError(`decisions must be an array of at most ${DEDUP_REVIEW_MAX_DECISIONS}`);
  }

  const seen = new Set<string>();
  return entries.map((entry): DedupReviewDecision => {
    if (!isPlainObject(entry) || !hasExactlyKeys(entry, ['suggestionId', 'evidenceHash', 'reasons'])) {
      throw new DedupReviewApplyInputError('each decision must hold exactly suggestionId, evidenceHash and reasons');
    }
    const suggestionId = typeof entry.suggestionId === 'string' ? entry.suggestionId.toLowerCase() : '';
    if (!UUID.test(suggestionId)) {
      throw new DedupReviewApplyInputError('suggestionId must be a uuid');
    }
    if (seen.has(suggestionId)) {
      throw new DedupReviewApplyInputError('a suggestion may appear in decisions only once');
    }
    seen.add(suggestionId);
    const evidenceHash = typeof entry.evidenceHash === 'string' ? entry.evidenceHash.toLowerCase() : '';
    if (!SHA256_HEX.test(evidenceHash)) {
      throw new DedupReviewApplyInputError('evidenceHash must be 64 hex characters');
    }
    const reasons = entry.reasons;
    if (
      !Array.isArray(reasons) ||
      reasons.length > DEDUP_REVIEW_MAX_REASONS ||
      reasons.some((reason) => typeof reason !== 'string' || reason.length > DEDUP_REVIEW_MAX_REASON_LENGTH)
    ) {
      throw new DedupReviewApplyInputError(`reasons must be at most ${DEDUP_REVIEW_MAX_REASONS} strings of at most ${DEDUP_REVIEW_MAX_REASON_LENGTH} characters`);
    }
    return { suggestionId, evidenceHash };
  });
}

/** The invoker's hash (SHA-256 hex of the lowercased, trimmed account email), as the environment hands it over. */
export function parseDedupReviewInvokerHash(raw: string | undefined): string {
  const hash = raw?.trim().toLowerCase() ?? '';
  if (!SHA256_HEX.test(hash)) {
    throw new DedupReviewApplyInputError('the invoker hash must be 64 hex characters');
  }
  return hash;
}

export type DedupReviewApplyMode = 'validate' | 'apply';

export interface DedupReviewApplyOptions {
  mode: DedupReviewApplyMode;
  live: boolean;
  runTag: string | null;
}

export function parseDedupReviewApplyOptions(input: { mode?: string | null; live?: boolean; runTag?: string | null }): DedupReviewApplyOptions {
  if (input.mode !== 'validate' && input.mode !== 'apply') {
    throw new DedupReviewApplyInputError('mode must be "validate" or "apply"');
  }
  const live = input.live === true;
  if (live && input.mode === 'validate') {
    throw new DedupReviewApplyInputError('--live is only valid with mode "apply"');
  }
  const rawTag = input.runTag?.trim() ?? '';
  if (rawTag && !RUN_TAG.test(rawTag)) {
    throw new DedupReviewApplyInputError('run_tag must be 1 to 64 letters, digits, ".", "_" or "-"');
  }
  return { mode: input.mode, live, runTag: rawTag || null };
}

/**
 * The kill switch fails closed: apply is only enabled when the variable is unset, empty, `0` or `false`
 * (any case). Every other value, `1` and `true` included but also `yes`, `on` or a typo, turns it off,
 * because a safety switch must not read an unrecognised value as "carry on".
 */
export function isDedupReviewApplyDisabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase() ?? '';
  return !(value === '' || value === '0' || value === 'false');
}

/** Why a decision was not applied. The first group is the pair's state, the second the floor, the third run limits and the live run. */
export type DedupReviewSkipReason =
  | 'unknown-suggestion'
  | 'not-pending'
  | 'stale-pair'
  | 'stale-evidence'
  | 'already-high'
  | 'low-tier'
  | 'undone-before'
  | 'no-anchor'
  | 'venue-conflict'
  | 'outside-window'
  | 'schedule-uncovered'
  | 'name-mismatch'
  | 'event-already-in-run'
  | 'per-run-cap'
  | 'per-day-cap'
  | 'concurrent-change'
  | 'merge-failed';

export interface DedupReviewFreshPair {
  /** The pair as the export builds it, recomputed now. */
  pair: DedupReviewExportPair;
  candidateEventId: string;
  newEventId: string;
  /** From the live scoring, not the evidence: two stated venues that disagree. */
  venueConflict: boolean;
}

export type DedupReviewFreshLookup = ({ kind: 'pair' } & DedupReviewFreshPair) | { kind: 'unknown-suggestion' | 'not-pending' | 'stale-pair' };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayNumber(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY : Number.NaN;
}

/**
 * The deterministic floor: what must hold before the reviewer's word is enough. It is deliberately
 * weaker than the tier thresholds (otherwise the reviewer adds nothing: it may accept names a trigram
 * cannot match) and strict where an injected or mistaken reviewer could do damage. Returns the first
 * failing reason, or null.
 *
 * - tier `mid` only: `high` belongs to the drain, `low` was never queued.
 * - an anchor a public post cannot fake on its own: the organizer, or a shared link together with a
 *   venue match. `sameAccount` is not used: it ignores the stub and curator discount.
 * - the day gap is 0 (the promotion rule's own limit) unless a link is shared (then up to 90 days),
 *   and every schedule of the new event must have a counterpart inside that window, because a merge
 *   copies the new event's schedules onto the winner.
 */
export function checkDedupReviewFloor(fresh: DedupReviewFreshPair): DedupReviewSkipReason | null {
  const { pair, venueConflict } = fresh;
  const { signals } = pair;
  if (signals.tier === 'high') return 'already-high';
  if (signals.tier === 'low') return 'low-tier';
  if (pair.undoneMergeCount > 0) return 'undone-before';
  if (!(signals.organizerMatch || (signals.sharedLink && signals.venueMatch))) return 'no-anchor';
  if (venueConflict) return 'venue-conflict';

  const window = signals.sharedLink ? SHARED_LINK_DATE_WINDOW_DAYS : MID_PROMOTION_MAX_DAY_DIFF;
  if (signals.minDayDiff === null || signals.minDayDiff > window) return 'outside-window';
  const candidateDays = pair.candidate.schedules.map((schedule) => dayNumber(schedule.startDate));
  const covered = pair.newEvent.schedules.every((schedule) => {
    const day = dayNumber(schedule.startDate);
    return candidateDays.some((other) => Math.abs(day - other) <= window);
  });
  if (!covered) return 'schedule-uncovered';
  if (namesContradict(pair.newEvent.name, pair.candidate.name)) return 'name-mismatch';
  return null;
}

export interface DedupReviewRunState {
  /** Events already claimed by an eligible decision in this run. */
  claimedEventIds: ReadonlySet<string>;
  /** Decisions already judged eligible in this run. */
  eligibleInRun: number;
  /** AI merges (including undone) and AI rejections in the last 24 hours, before this run. */
  usedLast24h: number;
}

export interface DedupReviewCaps {
  perRun: number;
  perDay: number;
}

export type DedupReviewVerdict = { outcome: 'eligible' } | { outcome: 'skipped'; reason: DedupReviewSkipReason };

/**
 * One decision's verdict, in a fixed order: the pair's state, the evidence hash, the floor, a shared
 * event, the per-run cap, the per-day cap. The caller adds an eligible decision's events and count to
 * the state; a skipped decision claims and consumes nothing.
 */
export function judgeDedupReviewDecision(input: {
  decision: DedupReviewDecision;
  fresh: DedupReviewFreshLookup;
  state: DedupReviewRunState;
  caps: DedupReviewCaps;
}): DedupReviewVerdict {
  const { decision, fresh, state, caps } = input;
  if (fresh.kind !== 'pair') return { outcome: 'skipped', reason: fresh.kind };
  if (fresh.pair.evidenceHash !== decision.evidenceHash) return { outcome: 'skipped', reason: 'stale-evidence' };
  const floor = checkDedupReviewFloor(fresh);
  if (floor !== null) return { outcome: 'skipped', reason: floor };
  if (state.claimedEventIds.has(fresh.candidateEventId) || state.claimedEventIds.has(fresh.newEventId)) {
    return { outcome: 'skipped', reason: 'event-already-in-run' };
  }
  if (state.eligibleInRun >= caps.perRun) return { outcome: 'skipped', reason: 'per-run-cap' };
  if (state.usedLast24h + state.eligibleInRun >= caps.perDay) return { outcome: 'skipped', reason: 'per-day-cap' };
  return { outcome: 'eligible' };
}

/** `disabled`: the kill switch stopped the run before it read anything. */
export type DedupReviewApplyRunMode = 'validate' | 'dry-run' | 'live' | 'disabled';

export interface DedupReviewApplyResult {
  suggestionId: string;
  outcome: 'eligible' | 'merged' | 'skipped';
  reason?: DedupReviewSkipReason;
  /** Only on a merge that was committed (live). */
  mergeId?: string;
}

export interface DedupReviewApplyReport {
  schemaVersion: typeof DEDUP_REVIEW_APPLY_SCHEMA_VERSION;
  generatedAt: string;
  runTag: string | null;
  mode: DedupReviewApplyRunMode;
  killSwitch: boolean;
  /** Null when the run stopped before counting (kill switch). */
  usedLast24h: number | null;
  caps: DedupReviewCaps;
  counts: { eligible: number; merged: number; skipped: number };
  results: DedupReviewApplyResult[];
}

export function countDedupReviewResults(results: DedupReviewApplyResult[]): DedupReviewApplyReport['counts'] {
  return {
    eligible: results.filter((r) => r.outcome === 'eligible').length,
    merged: results.filter((r) => r.outcome === 'merged').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
  };
}

/** The lines to print: the report as one JSON line between the markers, so a reader finds it in a noisy log. */
export function formatDedupReviewApplyReport(report: DedupReviewApplyReport): string[] {
  return [DEDUP_REVIEW_APPLY_BEGIN, JSON.stringify(report), DEDUP_REVIEW_APPLY_END];
}
