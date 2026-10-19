import type { EventInsertValues, ExtractedEventMessage, ScheduleInsertValues } from '@festgrid/domain/events';
import { buildEventInsertValues } from '@festgrid/domain/events';
import { findMatchingEvent, type MatchResult } from '../events/match-event-to-existing.js';
import type { DbExecutor } from '../events/set-event-primary-post.js';
import { isOrganizerAuthoredPost } from '../posts/is-organizer-authored-post.js';

export interface IngestionSourcePost {
  accountId: string;
  platform: string;
  platformPostId: string | null;
  platformPostType: string | null;
  postUrl: string;
  originalPostUrl: string | null;
  groupingReason: string | null;
}

export interface IngestionMatchEvaluation {
  event: EventInsertValues;
  scheduleValues: ScheduleInsertValues[];
  isStub: boolean;
  /** `null` when no source post row exists (nothing to anchor a match on) or no candidate passed. */
  match: MatchResult | null;
}

/**
 * The single source of truth for "what does ingestion decide about this extracted item": the
 * stub rule (AD-30 Rule 10), the roundup/curator organizer discount (BUG-058, IDEA-068) and the
 * candidate search + scoring (`findMatchingEvent`). `processIngestionJob` acts on the result;
 * the moderator re-extract preview (AD-36) reports it without acting. Performs no writes.
 *
 * Preview-only options (ingestion never sets either):
 * - `matchWithoutSourcePost`: evaluate a post that is not stored. There is no account and no
 *   authorship to look up, so the item is treated as organizer-authored (not a stub) and no
 *   account signal is counted; an explicitly tagged `organizerHandle` still is.
 * - `groupingReason`: the freshly extracted post grouping, used instead of the stored one. In real
 *   ingestion `posts.grouping_reason` has already been rewritten by the extraction that produced
 *   the message, so the stored value IS the fresh one; the preview has not written it.
 */
export async function evaluateIngestionMatch(
  tx: DbExecutor,
  message: ExtractedEventMessage,
  sourcePost: IngestionSourcePost | null,
  options: { matchWithoutSourcePost?: boolean; groupingReason?: string | null } = {}
): Promise<IngestionMatchEvaluation> {
  // Story 3.6t (AC3/AC5) -- an event is a stub (never notifies) when its primary post's
  // grouping_reason is 'roundup' OR its primary post is curator-sourced (AD-31 Rule 3, negated);
  // full/notify-eligible otherwise. isStub/shouldNotify are the exact complement of each other by
  // construction (AD-30 Rule 7 and Rule 10 share the same two boolean inputs) -- not computed
  // independently, so a future edit to one rule can't silently desync them.
  const groupingReason = options.groupingReason !== undefined ? options.groupingReason : (sourcePost?.groupingReason ?? null);
  const isRoundupSourced = groupingReason === 'roundup';
  const isCuratorSourced = sourcePost === null && options.matchWithoutSourcePost ? false : !(await isOrganizerAuthoredPost(message.postId, tx));
  const isStub = isRoundupSourced || isCuratorSourced;

  const { event, schedules: scheduleValues } = buildEventInsertValues(message, sourcePost ?? null, isStub ? 'stub' : undefined);

  // Story 3.6v (AC1, Amendment) -- organizerHandle used to default to the *posting* account for a
  // roundup/curator-sourced item (Story 3.6s's extraction prompt; IDEA-068 now asks for an
  // explicit organizer only, but messages queued before that change may still carry the default),
  // which would falsely inflate a match score against an unrelated event the curator/aggregator
  // also covered. Discount it to `undefined` in exactly that case -- reusing isRoundupSourced /
  // isCuratorSourced already computed above, never re-derived.
  const organizerHandleForMatching = isRoundupSourced || isCuratorSourced ? undefined : message.organizerHandle;

  const canMatch = sourcePost !== null || options.matchWithoutSourcePost === true;
  const match = canMatch
    ? await findMatchingEvent(
        tx,
        event,
        scheduleValues,
        {
          postId: message.postId,
          // BUG-058 -- the posting account is discounted exactly like organizerHandle: an
          // aggregator/curator account is not the organizer of what it lists.
          accountId: isRoundupSourced || isCuratorSourced ? undefined : sourcePost?.accountId,
          groupingReason,
        },
        organizerHandleForMatching
      )
    : null;

  return { event, scheduleValues, isStub, match };
}
