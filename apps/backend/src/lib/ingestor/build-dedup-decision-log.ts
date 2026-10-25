import type { MatchResult } from '../events/match-event-to-existing.js';

/** The `event` value that marks a dedup decision line; the CloudWatch Logs Insights queries in
 * `docs/infrastructure/7-event-dedup.md` filter on it. */
export const DEDUP_DECISION_LOG_EVENT = 'event_dedup_decision';

export type DedupDecisionOutcome = 'linked' | 'queued' | 'new';

export interface DedupDecisionLog {
  event: typeof DEDUP_DECISION_LOG_EVENT;
  /** What ingestion did: `linked` (high, enriched the candidate), `queued` (mid, own event plus a
   * moderator suggestion), `new` (low, or no candidate: a plain new event). */
  outcome: DedupDecisionOutcome;
  /** The tier ingestion acted on; `none` when no candidate passed the SQL pre-filter. */
  tier: 'high' | 'mid' | 'low' | 'none';
  /** The tier the unchanged weights and thresholds gave, before the promotion rule. */
  scoredTier: 'high' | 'mid' | 'low' | 'none';
  score: number | null;
  /** True when `tier` is `high` only because a promotion rule lifted it (either rule). */
  promotedByRule: boolean;
  /** Which rule: `mid-to-high` (score-based) or `stub-repeat` (name + start date + venue between
   * two stubs); `null` when the score alone decided. */
  promotionRule: 'mid-to-high' | 'stub-repeat' | null;
  nameSimilarity: number | null;
  /** `null` when there is no usable date pair. */
  minDayDiff: number | null;
  organizerMatch: boolean | null;
  sharedLink: boolean | null;
  venueMatch: boolean | null;
  venueConflict: boolean | null;
  candidateEventId: string | null;
  /** The event row ingestion inserted; `null` for `linked` (no new row). */
  newEventId: string | null;
  postId: string;
}

/**
 * One structured line per ingestion match decision, so the auto-linked vs moderator-queued share
 * can be read from CloudWatch (the high path writes nothing else). Ids and numbers only: no event
 * name, caption, handle or account id.
 */
export function buildDedupDecisionLog(match: MatchResult | null, newEventId: string | null, postId: string): DedupDecisionLog {
  if (!match) {
    return {
      event: DEDUP_DECISION_LOG_EVENT,
      outcome: 'new',
      tier: 'none',
      scoredTier: 'none',
      score: null,
      promotedByRule: false,
      promotionRule: null,
      nameSimilarity: null,
      minDayDiff: null,
      organizerMatch: null,
      sharedLink: null,
      venueMatch: null,
      venueConflict: null,
      candidateEventId: null,
      newEventId,
      postId,
    };
  }

  const { tier, score, signals, candidate } = match;
  return {
    event: DEDUP_DECISION_LOG_EVENT,
    outcome: tier === 'high' ? 'linked' : tier === 'mid' ? 'queued' : 'new',
    tier,
    scoredTier: signals.scoredTier,
    score,
    promotedByRule: signals.promotedByRule,
    promotionRule: signals.promotionRule,
    nameSimilarity: signals.nameSimilarity,
    minDayDiff: Number.isFinite(signals.minDayDiff) ? signals.minDayDiff : null,
    organizerMatch: signals.organizerMatch,
    sharedLink: signals.sharedLink,
    venueMatch: signals.venueMatch,
    venueConflict: signals.venueConflict,
    candidateEventId: candidate.id,
    newEventId,
    postId,
  };
}
