import { inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { eventPosts, events, posts } from '@festgrid/database';
import {
  computeClaimCutoff,
  derivePostExtractionStatus,
  type PostExtractionStatus,
} from '@festgrid/domain/posts';

/**
 * PRD 3.10 (2026-10-16): the extraction status shown on the manual extract screen, and the filter over
 * it. `derivePostExtractionStatus` (packages/domain) is the rule; `postExtractionStatusCondition` below
 * is its SQL form and must stay in lockstep with it (post-extraction-status.test.ts checks every
 * status against both).
 */

/** The post produced at least one event: counted at extraction, or linked through either event table. */
function hasEventSql(): SQL {
  return sql`(
    coalesce(${posts.extractedEventCount}, 0) > 0
    or exists (select 1 from ${eventPosts} ep where ep.post_id = ${posts.id})
    or exists (select 1 from ${events} ev where ev.post_id = ${posts.id})
  )`;
}

function statusCondition(status: PostExtractionStatus, cutoffIso: string): SQL {
  const cutoff = sql`${cutoffIso}::timestamptz`;
  switch (status) {
    case 'PENDING':
      return sql`(not ${posts.isExtracted} and (${posts.queuedForExtractionAt} is null or ${posts.queuedForExtractionAt} < ${cutoff}))`;
    case 'QUEUED':
      return sql`(not ${posts.isExtracted} and ${posts.queuedForExtractionAt} >= ${cutoff}
        and (${posts.extractionStartedAt} is null or ${posts.extractionStartedAt} < ${posts.queuedForExtractionAt}))`;
    case 'EXTRACTING':
      return sql`(not ${posts.isExtracted} and ${posts.queuedForExtractionAt} >= ${cutoff}
        and ${posts.extractionStartedAt} >= ${posts.queuedForExtractionAt})`;
    case 'PROMOTED':
      return sql`(${posts.isExtracted} and ${hasEventSql()})`;
    case 'NOT_EVENT':
      return sql`(${posts.isExtracted} and not ${hasEventSql()})`;
  }
}

/** A `where` condition matching posts whose status is any of `statuses`. */
export function postExtractionStatusCondition(
  statuses: PostExtractionStatus[],
  claimTtlMinutes: number,
  now: Date = new Date()
): SQL {
  const cutoffIso = computeClaimCutoff(claimTtlMinutes, now).toISOString();
  return or(...statuses.map((status) => statusCondition(status, cutoffIso)))!;
}

type PostStatusRow = {
  id: string;
  isExtracted: boolean;
  queuedForExtractionAt: Date | null;
  extractionStartedAt: Date | null;
  extractedEventCount: number | null;
};

/** Of the given posts, the ids that produced at least one event. */
async function loadIdsWithEvents(rows: PostStatusRow[]): Promise<Set<string>> {
  const extracted = rows.filter((r) => r.isExtracted);
  const withEvents = new Set(extracted.filter((r) => (r.extractedEventCount ?? 0) > 0).map((r) => r.id));
  const unknown = extracted.filter((r) => !withEvents.has(r.id)).map((r) => r.id);
  if (unknown.length === 0) {
    return withEvents;
  }
  const linked = await db.select({ id: eventPosts.postId }).from(eventPosts).where(inArray(eventPosts.postId, unknown));
  const primary = await db.select({ id: events.postId }).from(events).where(inArray(events.postId, unknown));
  for (const { id } of [...linked, ...primary]) {
    if (id) withEvents.add(id);
  }
  return withEvents;
}

/** Adds `extractionStatus` to post rows with one batched query for the extracted ones. */
export async function withExtractionStatus<T extends PostStatusRow>(
  rows: T[],
  claimTtlMinutes: number,
  now: Date = new Date()
): Promise<(T & { extractionStatus: PostExtractionStatus })[]> {
  const idsWithEvents = await loadIdsWithEvents(rows);
  return rows.map((row) => ({
    ...row,
    extractionStatus: derivePostExtractionStatus(
      {
        isExtracted: row.isExtracted,
        queuedForExtractionAt: row.queuedForExtractionAt,
        extractionStartedAt: row.extractionStartedAt,
        hasEvent: idsWithEvents.has(row.id),
      },
      claimTtlMinutes,
      now
    ),
  }));
}
