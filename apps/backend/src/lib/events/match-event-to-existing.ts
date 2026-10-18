import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { events, schedules, socialMediaAccountProfiles } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import type { EventInsertValues, ScheduleInsertValues } from '@festgrid/domain/events';
import {
  capTierWhenOutsideDateWindow,
  computeMatchScore,
  hasSharedEventLink,
  hasVenueMatch,
  minScheduleDayDifference,
  normalizeEventLinkUrl,
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
// BUG-063 -- a candidate sharing a normalized event link with the new item is also admitted when
// a schedule is within +/-90 days: a registration-deadline post and the race-day post of one
// event sit weeks apart (GembiRun Loka 2026: 21 Oct vs 8 Nov), far outside +/-2 days. 90 days
// covers a registration window; it stays well short of a yearly re-run of the same event. Such a
// candidate is capped at `mid` (see `capTierWhenOutsideDateWindow`) -- it is never auto-linked.
const SHARED_LINK_DATE_WINDOW_DAYS = 90;
const TIER_RANK: Record<MatchTier, number> = { low: 0, mid: 1, high: 2 };

export interface MatchSourcePost {
  /** The new item's own `postId` -- excluded from candidates below (see Dev Note). */
  postId: string;
  /**
   * The posting account, used as organizer-match evidence. `undefined` when the caller has
   * discounted it (roundup- or curator-sourced new item): an aggregator's own account is not the
   * organizer of the events it lists (BUG-058), so it must not earn the organizer weight, just
   * like `organizerHandle`.
   */
  accountId: string | undefined;
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
 * `organizerHandle` and `sourcePost.accountId` must already be `undefined` when the Amendment's
 * discount applies (roundup- or curator-sourced new item) -- this function does not re-derive
 * that decision, it only reads whatever the caller passed (see this story's Dev Notes, BUG-058).
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

  // BUG-063 -- second admission path: a stored link equal (after the same normalization
  // `hasSharedEventLink` applies) to one of the new item's links, with a schedule within
  // +/-SHARED_LINK_DATE_WINDOW_DAYS. `events.links` is read raw here, and the column is written
  // JSON-stringified through drizzle/postgres.js, so it is usually a jsonb *string* holding the
  // array -- unwrap it with `#>> '{}'` before `jsonb_path_query` (lax mode: tolerates a non-array).
  const newLinkUrls = Array.from(
    new Set((newEvent.links ?? []).map((link) => link.url).filter((url): url is string => Boolean(url)).map(normalizeEventLinkUrl))
  );
  const sharedLinkWindowDays = sql.raw(String(SHARED_LINK_DATE_WINDOW_DAYS));
  const sharedLinkCandidate =
    newLinkUrls.length === 0
      ? undefined
      : and(
          or(
            ...usableNewDates.map(
              (d) =>
                sql`${schedules.eventStartDate} BETWEEN (${d}::date - INTERVAL '${sharedLinkWindowDays} days') AND (${d}::date + INTERVAL '${sharedLinkWindowDays} days')`
            )
          ),
          sql`EXISTS (
            SELECT 1
            FROM jsonb_path_query(
              CASE
                WHEN jsonb_typeof(${events.links}) = 'array' THEN ${events.links}
                WHEN jsonb_typeof(${events.links}) = 'string' AND (${events.links} #>> '{}') LIKE '[%' THEN (${events.links} #>> '{}')::jsonb
                ELSE '[]'::jsonb
              END,
              '$[*].url'
            ) AS link_url(value)
            WHERE regexp_replace(split_part(lower(btrim(link_url.value #>> '{}', E' 	
')), '?', 1), '/$', '') IN (${sql.join(
              newLinkUrls.map((url) => sql`${url}`),
              sql`, `
            )})
          )`
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
        or(...dateConditions, sharedLinkCandidate),
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

    const { score, tier: scoredTier } = computeMatchScore({
      organizerMatch,
      sharedLink,
      nameSimilarity,
      minDayDiff,
      venueMatch,
    });
    const tier = capTierWhenOutsideDateWindow(scoredTier, minDayDiff, DATE_WINDOW_DAYS);

    // Rank by the (possibly capped) tier first, so a date-distant shared-link candidate whose raw
    // score is higher can never displace an in-window `high` candidate.
    if (!best || TIER_RANK[tier] > TIER_RANK[best.tier] || (tier === best.tier && score > best.score)) {
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
  sourceAccountId: string | undefined,
  organizerHandleAccountId: string | null
): Promise<boolean> {
  const idsToCheck = Array.from(
    new Set([...(sourceAccountId ? [sourceAccountId] : []), ...(organizerHandleAccountId ? [organizerHandleAccountId] : [])])
  );
  if (idsToCheck.length === 0) return false;

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

