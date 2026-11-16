/**
 * POC (pure, no I/O): the reference definition of the Discovery sort once freshness and "already seen" are added to the
 * area-first order of relevance.ts — and the WINDOW RULE that lets a database serve it without ranking every event.
 *
 *   order    (areaTier, sortDays, id)
 *   sortDays daysUntil  -  freshBoost(ageDays)  +  seenPenalty
 *
 *   freshBoost   up to `freshMaxDays` for a post published within `freshWindowDays`, decaying linearly to 0. AGE IS THE POST'S
 *                OWN PUBLISH TIME, not the time we ingested it: a new subscription ingests a backlog of old posts in one go and
 *                that must not look fresh.
 *   seenPenalty  `seenPenaltyDays` for an event the user has already seen on screen — except an event that starts within
 *                `urgentDays`, which is never demoted (a user must not lose "tomorrow" because they glanced at it).
 *
 * Both terms are BOUNDED, so the order is a bounded perturbation of the date order: nothing is hidden, nothing moves more than
 * freshMaxDays earlier or seenPenaltyDays later. That bound is what makes the window rule below exact.
 */

export interface SortParams {
  freshMaxDays: number;
  freshWindowDays: number;
  seenPenaltyDays: number;
  urgentDays: number;
}
export const DEFAULT_SORT_PARAMS: SortParams = { freshMaxDays: 7, freshWindowDays: 3, seenPenaltyDays: 14, urgentDays: 3 };

export interface SortEvent {
  id: string;
  tier: number;            // from areaTier(): 0 local ladder, 1 anywhere, 2 other-local
  daysUntil: number;       // days from today to the event's sort date (the maintained key); may be negative (ongoing)
  publishedAgeDays: number; // days since the source post was published
  seen: boolean;           // in the user's seen-snapshot
}

export function freshBoost(publishedAgeDays: number, p: SortParams = DEFAULT_SORT_PARAMS): number {
  if (!(publishedAgeDays >= 0)) return 0;
  return p.freshMaxDays * Math.max(0, 1 - publishedAgeDays / p.freshWindowDays);
}

export function seenPenalty(e: Pick<SortEvent, 'seen' | 'daysUntil'>, p: SortParams = DEFAULT_SORT_PARAMS): number {
  return e.seen && e.daysUntil > p.urgentDays ? p.seenPenaltyDays : 0;
}

export function sortDays(e: SortEvent, p: SortParams = DEFAULT_SORT_PARAMS): number {
  return e.daysUntil - freshBoost(e.publishedAgeDays, p) + seenPenalty(e, p);
}

const cmp = (p: SortParams) => (a: SortEvent, b: SortEvent) => a.tier - b.tier || sortDays(a, p) - sortDays(b, p) || a.id.localeCompare(b.id);

/** The full, exact order. O(n log n) over every event: the specification, not the production path. */
export function rank(events: SortEvent[], p: SortParams = DEFAULT_SORT_PARAMS): SortEvent[] {
  return [...events].sort(cmp(p));
}

/** How far past the date cutoff a candidate can still belong in the page: the largest forward pull plus the largest push back. */
export function windowDays(p: SortParams = DEFAULT_SORT_PARAMS): number {
  return p.freshMaxDays + p.seenPenaltyDays;
}

/**
 * The page [offset, offset+limit) computed from a WINDOW per tier instead of from every event — what an index-ordered query does:
 *   for each tier, take c = the date key of that tier's (offset+limit)-th event in plain date order, keep the tier's events with
 *   daysUntil <= c + windowDays, rank those, keep the first offset+limit of the tier; then merge the tiers and slice.
 * Exact because every event of the true top (offset+limit) in a tier has sortDays <= c + seenPenalty (the first offset+limit by date
 * all have sortDays <= c + seenPenalty), hence daysUntil <= c + seenPenalty + freshMax.
 */
export function windowedPage(events: SortEvent[], offset: number, limit: number, p: SortParams = DEFAULT_SORT_PARAMS): SortEvent[] {
  const need = offset + limit;
  const merged: SortEvent[] = [];
  for (const tier of [...new Set(events.map((e) => e.tier))].sort((a, b) => a - b)) {
    const inTier = events.filter((e) => e.tier === tier);
    const byDate = [...inTier].sort((a, b) => a.daysUntil - b.daysUntil || a.id.localeCompare(b.id));
    const cutoff = byDate.length >= need ? byDate[need - 1].daysUntil : Infinity;
    const candidates = inTier.filter((e) => e.daysUntil <= cutoff + windowDays(p));
    merged.push(...rank(candidates, p).slice(0, need));
  }
  return rank(merged, p).slice(offset, offset + limit);
}
