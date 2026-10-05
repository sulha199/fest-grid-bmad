import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { events, schedules, socialMediaAccountProfiles } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import type { EventInsertValues, ScheduleInsertValues } from '@festgrid/domain/events';
import {
  computeMatchScore,
  hasSharedEventLink,
  hasVenueMatch,
  minScheduleDayDifference,
  type MatchTier,
} from '@festgrid/domain/events';
import type { DbExecutor } from './set-event-primary-post.js';
import { buildEventAccountMatchCondition } from './event-account-match.js';

type EventRow = typeof events.$inferSelect;
type ScheduleRow = typeof schedules.$inferSelect;

// AC1 -- cap the candidate set so a busy trigram/date window never turns one ingestion job into
// an unbounded scan; ordered by name similarity descending (the SQL query's own ORDER BY) so a
// truncation drops only the weakest name matches.
const CANDIDATE_LIMIT = 20;
// AC1 -- do not rely on the mutable `pg_trgm.similarity_threshold` GUC; filter explicitly.
const NAME_SIMILARITY_FLOOR = 0.3;
// AC1 -- candidates are selected by schedule date-range overlap within +/-2 days of any of the
// new item's schedules.
const DATE_WINDOW_DAYS = 2;

export interface MatchSourcePost {
  /** The new item's own `postId` -- excluded from candidates below (see Dev Note). */
  postId: string;
  accountId: string;
  groupingReason: string | null;
}

export interface MatchResult {
  candidate: EventRow;
  score: number;
  tier: MatchTier;
}

/**
 * AC1's candidate query + scoring pass. Called by `processIngestionJob` (Task 4) between
 * `buildEventInsertValues()` and the insert, on a genuine idempotency-lookup miss. Returns the
 * single best-scoring candidate (by composite score, ties broken by the SQL query's own
 * name-similarity ordering), or `null` when no event passes the SQL pre-filter at all.
 *
 * `organizerHandle` must already be `undefined` when the Amendment's discount applies (roundup-
 * or curator-sourced new item) -- this function does not re-derive that decision, it only reads
 * whatever the caller passed (see this story's Dev Notes).
 */
export async function findMatchingEvent(
  tx: DbExecutor,
  newEvent: EventInsertValues,
  newSchedules: ScheduleInsertValues[],
  sourcePost: MatchSourcePost,
  organizerHandle: string | undefined
): Promise<MatchResult | null> {
  const usableNewDates = newSchedules
    .map((s) => s.eventStartDate)
    .filter((d): d is string => Boolean(d));

  if (usableNewDates.length === 0) {
    // AC1's candidate query is schedule-date-driven; with no usable date on the new item there
    // is no date window to search within, so there can be no candidate (matches today's
    // behavior of always falling through to a plain insert when nothing anchors a comparison).
    return null;
  }

  // Resolve the organizer-handle leg (AC1, Design Decision 4): `(platform, username)` against
  // `social_media_account_profiles`, case-insensitive, `@`-prefix stripped. `undefined` when the
  // caller already discounted it (roundup/curator-sourced) or no handle was extracted at all.
  let organizerHandleAccountId: string | null = null;
  if (organizerHandle) {
    const normalizedHandle = organizerHandle.trim().replace(/^@/, '').toLowerCase();
    if (normalizedHandle.length > 0) {
      const [handleAccount] = await tx
        .select({ id: socialMediaAccountProfiles.id })
        .from(socialMediaAccountProfiles)
        .where(sql`lower(${socialMediaAccountProfiles.username}) = ${normalizedHandle}`)
        .limit(1);
      organizerHandleAccountId = handleAccount?.id ?? null;
    }
  }

  // Candidate SELECT: events joined to schedules, soft-delete/merge-excluded, within the date
  // window, and trigram-similar on event_name. One row per (event, matching schedule) pair --
  // deduplicated into per-event aggregates below.
  const dateConditions = usableNewDates.map(
    (d) =>
      sql`${schedules.eventStartDate} BETWEEN (${d}::date - INTERVAL '${sql.raw(String(DATE_WINDOW_DAYS))} days') AND (${d}::date + INTERVAL '${sql.raw(String(DATE_WINDOW_DAYS))} days')`
  );

  const candidateRows = await tx
    .select({
      eventId: events.id,
      nameSim: sql<number>`similarity(${events.eventName}, ${newEvent.eventName})`,
    })
    .from(events)
    .innerJoin(schedules, eq(schedules.eventId, events.id))
    .where(
      and(
        activeOnly(events),
        isNull(events.mergedIntoEventId),
        sql`${events.eventName} % ${newEvent.eventName}`,
        sql`similarity(${events.eventName}, ${newEvent.eventName}) > ${NAME_SIMILARITY_FLOOR}`,
        or(...dateConditions),
        // Dev Note (discovered during this story's own weight/threshold validation against the
        // CC-024 reference posts) -- a multi-event post (Story 3.6s) extracts several genuinely
        // distinct events sharing the SAME postId at different extractionOrdinals. Without this
        // exclusion, processing a later ordinal could find an earlier ordinal's
        // already-inserted sibling event as a "candidate" and merge two deliberately-split
        // events back together -- undermining 3.6s's own grouping decision. AC1's idempotency
        // lookup only catches a redelivery of the EXACT same (postId, ordinal) pair; it does not
        // guard this sibling-ordinal case, so it is guarded here instead: never match against an
        // event already linked (via event_posts) to this same new item's postId.
        sql`NOT EXISTS (
          SELECT 1 FROM event_posts ep_self
          WHERE ep_self.event_id = ${events.id} AND ep_self.post_id = ${sourcePost.postId}
        )`
      )
    )
    .orderBy(desc(sql`similarity(${events.eventName}, ${newEvent.eventName})`))
    .limit(CANDIDATE_LIMIT);

  if (candidateRows.length === 0) {
    return null;
  }

  // Dedup by event id (a candidate may have matched on multiple schedules), keeping the
  // highest name_sim seen and the original (name_sim DESC) ordering for tie-breaking.
  const nameSimByEventId = new Map<string, number>();
  const orderedEventIds: string[] = [];
  for (const row of candidateRows) {
    if (!nameSimByEventId.has(row.eventId)) {
      orderedEventIds.push(row.eventId);
    }
    const existing = nameSimByEventId.get(row.eventId);
    if (existing === undefined || row.nameSim > existing) {
      nameSimByEventId.set(row.eventId, row.nameSim);
    }
  }

  let best: MatchResult | null = null;

  for (const candidateEventId of orderedEventIds) {
    const [candidateEvent] = await tx.select().from(events).where(eq(events.id, candidateEventId)).limit(1);
    if (!candidateEvent) continue; // defensive -- deleted between the two queries

    const candidateSchedules: ScheduleRow[] = await tx
      .select()
      .from(schedules)
      .where(eq(schedules.eventId, candidateEventId))
      .orderBy(asc(schedules.eventStartDate));

    const organizerMatch = await resolveOrganizerMatch(tx, candidateEventId, sourcePost.accountId, organizerHandleAccountId);
    const sharedLink = hasSharedEventLink(newEvent.links, candidateEvent.links);
    const venueMatch = hasVenueMatch(newSchedules, candidateSchedules);
    const minDayDiff = minScheduleDayDifference(newSchedules, candidateSchedules);
    const nameSimilarity = nameSimByEventId.get(candidateEventId) ?? 0;

    const { score, tier } = computeMatchScore({
      organizerMatch,
      sharedLink,
      nameSimilarity,
      minDayDiff,
      venueMatch,
    });

    if (!best || score > best.score) {
      best = { candidate: candidateEvent, score, tier };
    }
  }

  return best;
}

/**
 * AC1's organizer-match signal: true when the new item's source account matches the candidate
 * event via `buildEventAccountMatchCondition` (same account linked to the candidate via any of
 * its posts), OR the resolved `organizerHandle` account matches the same way. Either leg alone
 * is sufficient -- this mirrors the pure scorer's single `organizerMatch: boolean` input, with
 * the "discount" decision (passing `organizerHandleAccountId: null`) already made by the caller.
 */
async function resolveOrganizerMatch(
  tx: DbExecutor,
  candidateEventId: string,
  sourceAccountId: string,
  organizerHandleAccountId: string | null
): Promise<boolean> {
  const idsToCheck = Array.from(new Set([sourceAccountId, ...(organizerHandleAccountId ? [organizerHandleAccountId] : [])]));

  const [row] = await tx
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.id, candidateEventId),
        or(...idsToCheck.map((id) => buildEventAccountMatchCondition(id)))
      )
    )
    .limit(1);

  return Boolean(row);
}

