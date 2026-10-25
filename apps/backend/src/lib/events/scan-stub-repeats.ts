import { asc, inArray, sql } from 'drizzle-orm';
import { events, schedules } from '@festgrid/database';
import { evaluateStubRepeat, type StubRepeatReason } from '@festgrid/domain/events';
import { EventMergeInvalidStateError, mergeEvents } from './merge-events.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AD-30 Rule 7 (amended 2026-10-25), stub repeat -- the scan mode of the backlog drain.
 *
 * Finds active stub events that are repeats of one another (`evaluateStubRepeat`, the same pure
 * predicate ingestion uses), clusters them, and merges every loser into the cluster's OLDEST event
 * through `mergeEvents()` (journaled in `event_merges`, undoable). It is the backlog tool for
 * duplicates created before the rule existed, and the backstop for two posts ingested in the same
 * few seconds (neither can see the other; Rule 7 designs no lock).
 *
 * It also reports the "near-misses": stub pairs with the same strict name and start date that were
 * deliberately NOT merged (a different venue, an unknown venue, different start times, a one-word
 * name), so a moderator can see the lookalikes the rule left apart.
 */

export interface StubScanEvent {
  id: string;
  slug: string;
  eventName: string;
  createdAt: Date;
}

export interface StubCluster {
  /** The oldest event of the cluster (by `created_at`, then id); it absorbs the rest. */
  winner: StubScanEvent;
  losers: StubScanEvent[];
}

export type StubNearMissReason = Exclude<StubRepeatReason, 'match' | 'not-stub' | 'name-differs' | 'no-same-date'>;

const NEAR_MISS_REASONS: ReadonlySet<StubRepeatReason> = new Set<StubNearMissReason>([
  'name-too-short',
  'times-differ',
  'venue-differs',
  'venue-unknown-one-side',
  'venue-unknown-both',
]);

export interface StubNearMiss {
  a: StubScanEvent;
  b: StubScanEvent;
  reason: StubNearMissReason;
}

export interface StubScanOptions {
  /** `users.id` recorded on every `event_merges` journal row. */
  moderatorId: string;
  /** false = evaluate only: no `mergeEvents()` call, so it also runs on a read-only role. */
  merge: boolean;
  /** Event ids a reviewer wants left out of every cluster. */
  excludeEventIds?: string[];
  /** Restricts the scan to these events (tests; the CLI always scans every active stub). */
  onlyEventIds?: string[];
}

export interface StubScanReport {
  /** Candidate pairs the SQL pre-filter returned (same start date, similar name, both active stubs). */
  candidatePairs: number;
  clusters: StubCluster[];
  nearMisses: StubNearMiss[];
  excluded: string[];
  /** Losers whose merge was refused because an event changed state mid-run. */
  stale: Array<{ eventId: string; reason: string }>;
  merged: number;
  /** `event_merges` journal ids of the merges above, for `undoEventMerge`. */
  mergeIds: string[];
}

// The SQL pre-filter only bounds the work to same-date buckets; the strict-name test is the
// predicate's. Loose on purpose: names that are strict-equal can still differ by a year or by
// punctuation, which lowers trigram similarity.
const PREFILTER_NAME_SIMILARITY = 0.5;

function compareOldestFirst(a: StubScanEvent, b: StubScanEvent): number {
  const byTime = a.createdAt.getTime() - b.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export async function scanStubRepeats(executor: DbExecutor, options: StubScanOptions): Promise<StubScanReport> {
  const excluded = new Set(options.excludeEventIds ?? []);
  const emptyReport: StubScanReport = { candidatePairs: 0, clusters: [], nearMisses: [], excluded: [], stale: [], merged: 0, mergeIds: [] };
  if (options.onlyEventIds && options.onlyEventIds.length === 0) return emptyReport;
  const onlyList = options.onlyEventIds ? sql.join(options.onlyEventIds.map((id) => sql`${id}::uuid`), sql`, `) : null;
  const onlyFilter = onlyList ? sql`AND ea.id IN (${onlyList}) AND eb.id IN (${onlyList})` : sql``;

  const pairRows = (await executor.execute(sql`
    SELECT DISTINCT ea.id AS a_id, eb.id AS b_id
    FROM schedules sa
    JOIN schedules sb ON sb.event_start_date = sa.event_start_date AND sb.event_id > sa.event_id
    JOIN events ea ON ea.id = sa.event_id
    JOIN events eb ON eb.id = sb.event_id
    WHERE ea.detail_level = 'stub' AND eb.detail_level = 'stub'
      AND ea.deleted_at IS NULL AND ea.merged_into_event_id IS NULL
      AND eb.deleted_at IS NULL AND eb.merged_into_event_id IS NULL
      AND similarity(ea.event_name, eb.event_name) > ${PREFILTER_NAME_SIMILARITY}
      ${onlyFilter}
  `)) as unknown as Array<{ a_id: string; b_id: string }>;

  const report: StubScanReport = { ...emptyReport, candidatePairs: pairRows.length };
  if (pairRows.length === 0) return report;

  const ids = Array.from(new Set(pairRows.flatMap((r) => [r.a_id, r.b_id])));
  const eventRows = await executor
    .select({ id: events.id, slug: events.slug, eventName: events.eventName, createdAt: events.createdAt })
    .from(events)
    .where(inArray(events.id, ids));
  const scheduleRows = await executor.select().from(schedules).where(inArray(schedules.eventId, ids)).orderBy(asc(schedules.eventStartDate));

  const eventById = new Map<string, StubScanEvent>(eventRows.map((e) => [e.id, e]));
  const schedulesByEvent = new Map<string, typeof scheduleRows>();
  for (const row of scheduleRows) {
    const list = schedulesByEvent.get(row.eventId) ?? [];
    list.push(row);
    schedulesByEvent.set(row.eventId, list);
  }

  // Union-find over matched pairs.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (x: string, y: string) => parent.set(find(x), find(y));

  const matchedIds = new Set<string>();
  const nearMissCandidates: StubNearMiss[] = [];
  const excludedSeen = new Set<string>();
  for (const { a_id, b_id } of pairRows) {
    const a = eventById.get(a_id);
    const b = eventById.get(b_id);
    if (!a || !b) continue;
    if (excluded.has(a.id) || excluded.has(b.id)) {
      if (excluded.has(a.id)) excludedSeen.add(a.id);
      if (excluded.has(b.id)) excludedSeen.add(b.id);
      continue;
    }
    const reason = evaluateStubRepeat({
      newIsStub: true,
      candidateIsStub: true,
      newEventName: a.eventName,
      candidateEventName: b.eventName,
      newSchedules: schedulesByEvent.get(a.id) ?? [],
      candidateSchedules: schedulesByEvent.get(b.id) ?? [],
    });
    if (reason === 'match') {
      matchedIds.add(a.id);
      matchedIds.add(b.id);
      union(a.id, b.id);
    } else if (NEAR_MISS_REASONS.has(reason)) nearMissCandidates.push({ a, b, reason: reason as StubNearMissReason });
  }
  report.excluded = Array.from(excludedSeen);

  const members = new Map<string, StubScanEvent[]>();
  for (const id of matchedIds) {
    const root = find(id);
    members.set(root, [...(members.get(root) ?? []), eventById.get(id)!]);
  }

  for (const list of members.values()) {
    const sorted = [...list].sort(compareOldestFirst);
    report.clusters.push({ winner: sorted[0], losers: sorted.slice(1) });
  }
  report.clusters.sort((x, y) => compareOldestFirst(x.winner, y.winner));

  // Near-misses between two events of one cluster are not lookalikes left apart: they were merged.
  const clusterOf = new Map<string, string>();
  for (const cluster of report.clusters) {
    for (const e of [cluster.winner, ...cluster.losers]) clusterOf.set(e.id, cluster.winner.id);
  }
  report.nearMisses = nearMissCandidates.filter((m) => !clusterOf.has(m.a.id) || clusterOf.get(m.a.id) !== clusterOf.get(m.b.id));
  report.nearMisses.sort((x, y) => compareOldestFirst(x.a, y.a) || compareOldestFirst(x.b, y.b));

  if (options.merge) {
    for (const cluster of report.clusters) {
      for (const loser of cluster.losers) {
        try {
          const { merge } = await mergeEvents(executor, cluster.winner.id, loser.id, options.moderatorId, null);
          report.merged++;
          report.mergeIds.push(merge.id);
        } catch (err) {
          // assertMergeable runs before any write, so this leaves the transaction untouched.
          if (!(err instanceof EventMergeInvalidStateError)) throw err;
          report.stale.push({ eventId: loser.id, reason: err.message });
        }
      }
    }
  }

  return report;
}
