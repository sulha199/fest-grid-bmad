// AD-40 (Apply) -- pairs the events a post already produced with the items a fresh extraction of the
// same post lists, so the moderator re-extract Apply can reuse the old events (id, slug, favorites,
// calendar entries survive) instead of creating duplicates. Pure: no DB. Pairs by name and date, never
// by extraction ordinal, because ordinals sort by earliest date then name (`assignExtractionOrdinals`),
// so a larger event set shifts every one of them.

/** An event the post already produced. `deleted` covers soft-deleted and merged-away events. */
export interface PairableExistingEvent {
  id: string;
  eventName: string;
  /** `YYYY-MM-DD` start dates of the event's schedules. */
  startDates: readonly string[];
  deleted: boolean;
}

export interface PairableItem {
  /** Position in the caller's own item list; echoed back in the result. */
  index: number;
  eventName: string;
  startDates: readonly string[];
}

export type ItemPairing =
  /** The item continues an existing, live event of the post. */
  | { index: number; kind: 'reuse'; eventId: string }
  /** The item matches an event a moderator deleted (or merged away): PRD 3.7 "No Duplicate Re-Extraction", never recreated. */
  | { index: number; kind: 'skip'; eventId: string }
  /** Nothing of the post matches: ingest it as a new event. */
  | { index: number; kind: 'new' };

export interface PostEventPairing {
  /** One entry per input item, in input order. */
  items: ItemPairing[];
  /** Live events of the post that no item matched: left untouched, reported to the moderator. */
  orphanEventIds: string[];
}

/** A pair needs at least this much: a same name alone clears it, a shared date plus a rough name does too. */
export const PAIRING_MIN_SCORE = 0.5;
const NAME_WEIGHT = 0.6;
const DATE_WEIGHT = 0.4;
const NEAR_DAYS = 2;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function bigrams(text: string): Map<string, number> {
  const padded = ` ${text} `;
  const counts = new Map<string, number>();
  for (let i = 0; i < padded.length - 1; i++) {
    const gram = padded.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** Sorensen-Dice similarity over character bigrams of the normalized names, 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (left === '' || right === '') return 0;
  if (left === right) return 1;
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let overlap = 0;
  let leftTotal = 0;
  let rightTotal = 0;
  for (const count of leftGrams.values()) leftTotal += count;
  for (const count of rightGrams.values()) rightTotal += count;
  for (const [gram, count] of leftGrams) {
    overlap += Math.min(count, rightGrams.get(gram) ?? 0);
  }
  return (2 * overlap) / (leftTotal + rightTotal);
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** 1 for a shared date, 0.5 within two days, else 0 (also 0 when either side has no date). */
function dateScore(a: readonly string[], b: readonly string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const x of a) {
    for (const y of b) {
      best = Math.min(best, Math.abs(dayNumber(x) - dayNumber(y)));
    }
  }
  if (best === 0) return 1;
  return best <= NEAR_DAYS ? 0.5 : 0;
}

export function scorePair(item: PairableItem, event: PairableExistingEvent): number {
  return NAME_WEIGHT * nameSimilarity(item.eventName, event.eventName) + DATE_WEIGHT * dateScore(item.startDates, event.startDates);
}

/**
 * Greedy best-first one-to-one pairing: every (item, event) pair scoring at least `PAIRING_MIN_SCORE`
 * is ranked (highest first; ties go to the lower item index, then the lower event id, so the result is
 * deterministic) and taken when neither side is used yet. Deleted events take part, so an item that
 * matches one is `skip`, never `new`.
 */
export function pairPostEventsToItems(existing: readonly PairableExistingEvent[], items: readonly PairableItem[]): PostEventPairing {
  const candidates: Array<{ item: PairableItem; event: PairableExistingEvent; score: number }> = [];
  for (const item of items) {
    for (const event of existing) {
      const score = scorePair(item, event);
      if (score >= PAIRING_MIN_SCORE) candidates.push({ item, event, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.item.index - b.item.index || a.event.id.localeCompare(b.event.id));

  const usedEvents = new Set<string>();
  const pairingByIndex = new Map<number, ItemPairing>();
  for (const { item, event } of candidates) {
    if (usedEvents.has(event.id) || pairingByIndex.has(item.index)) continue;
    usedEvents.add(event.id);
    pairingByIndex.set(item.index, event.deleted ? { index: item.index, kind: 'skip', eventId: event.id } : { index: item.index, kind: 'reuse', eventId: event.id });
  }

  return {
    items: items.map((item) => pairingByIndex.get(item.index) ?? { index: item.index, kind: 'new' }),
    orphanEventIds: existing.filter((event) => !event.deleted && !usedEvents.has(event.id)).map((event) => event.id),
  };
}

/**
 * The extraction ordinal a platform-prefixed event slug was built for (`ig_p_X` is 0, `ig_p_X~2` is
 * 2, AD-16 Rule 9), or `null` for a legacy hex slug, which no derived slug can collide with.
 */
export function slugImpliedOrdinal(slug: string): number | null {
  const first = slug.indexOf('_');
  if (first === -1 || slug.indexOf('_', first + 1) === -1) return null;
  const tilde = slug.lastIndexOf('~');
  if (tilde === -1) return 0;
  const suffix = slug.slice(tilde + 1);
  return /^\d+$/.test(suffix) ? Number.parseInt(suffix, 10) : 0;
}

/**
 * Final extraction ordinals for the items Apply keeps, given in their sorted order (the order
 * `assignExtractionOrdinals` produces). Each takes the lowest ordinal that is free:
 * - never one still held by an event that does not move (`fixedOrdinals`: orphans, and soft-deleted
 *   or merged events of the post), because `(post, extraction_ordinal)` is unique;
 * - for a NEW item, never one whose derived slug (`..._X`, `..._X~n`) is already held by a reused
 *   event (`reusedSlugOrdinals`), because a reused event keeps its slug when it moves, and `events.slug`
 *   is unique.
 * A reused item may take such an ordinal: it is the event that holds the slug.
 */
export function assignApplyOrdinals(
  keptItems: ReadonlyArray<{ reused: boolean }>,
  fixedOrdinals: Iterable<number | null>,
  reusedSlugOrdinals: Iterable<number | null> = []
): number[] {
  const taken = new Set<number>();
  for (const ordinal of fixedOrdinals) {
    if (ordinal !== null) taken.add(ordinal);
  }
  const slugHeld = new Set<number>();
  for (const ordinal of reusedSlugOrdinals) {
    if (ordinal !== null) slugHeld.add(ordinal);
  }
  const ordinals: number[] = [];
  for (const item of keptItems) {
    let candidate = 0;
    while (taken.has(candidate) || (!item.reused && slugHeld.has(candidate))) candidate++;
    taken.add(candidate);
    ordinals.push(candidate);
  }
  return ordinals;
}
