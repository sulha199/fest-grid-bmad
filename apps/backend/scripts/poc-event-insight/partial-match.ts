/**
 * POC (pure, no I/O): an executable specification of "partial match" for the AI filter — what a score for an event that
 * satisfies SOME of a filter tree would mean, and which events may be shown as a close match at all.
 *
 * Nothing here touches SQL. The database computes the same booleans per leaf (the bench in perf-features.ts measures that) and this
 * module says how they combine, so the product can show "closest matches" with a number and with the exact conditions that failed.
 *
 *   leaf grade   g in [0, 1], or 'unknown' when the event has no data for it (a missing venue type, an area nobody ever wrote).
 *                1 = satisfied. Graded leaves (date, location, proximity) give partial credit for a near miss; binary leaves (category,
 *                type, free, venue type, weekday) give 0 or 1; HARD leaves (an account, a keyword) are never relaxed.
 *   AND          the weighted mean of its children — except a HARD child at 0, which removes the event outright.
 *   OR           the best child.
 *   NOT          strict: the event passes (1) only if the excluded thing does not match it; if it does, the event is OUT (hard 0). Unknown
 *                data passes — the same "keep unknown" semantics the strict NOT has today.
 *
 * A close match must also satisfy `maxMisses` (default 1): at most that many leaves below 1. Weights and tolerances are unvalidated defaults.
 */
import { isFilterGroupNode, isFilterLeaf, isFilterNotNode, type FilterLeaf, type FilterNode } from '@festgrid/domain/ai-event-filters';

export type LeafClass = 'hard' | 'graded' | 'binary';
export const LEAF_RULES: Record<FilterLeaf['field'], { cls: LeafClass; weight: number }> = {
  accountId: { cls: 'hard', weight: 3 },
  keyword: { cls: 'hard', weight: 3 },
  dateRange: { cls: 'graded', weight: 3 },
  temporalFilter: { cls: 'graded', weight: 3 },
  locationAdminArea: { cls: 'graded', weight: 3 },
  locationProximity: { cls: 'graded', weight: 3 },
  type: { cls: 'binary', weight: 2 },
  category: { cls: 'binary', weight: 2 },
  dayOfWeek: { cls: 'binary', weight: 2 },
  isFree: { cls: 'binary', weight: 1 },
  venueType: { cls: 'binary', weight: 1 },
};

export type Grade = number | 'unknown';
export type Grader = (leaf: FilterLeaf) => Grade;

export interface MatchResult {
  score: number;                 // 0..1; 1 = every leaf satisfied
  removed: boolean;              // a hard leaf failed or a NOT matched: never shown, not even as a close match
  unmet: FilterLeaf[];           // leaves with grade < 1 (outside any NOT)
  unknown: FilterLeaf[];         // leaves with no data for this event
}

const UNKNOWN_CREDIT = 0.5;

interface Walk { score: number; weight: number; removed: boolean; unmet: FilterLeaf[]; unknown: FilterLeaf[] }
const REMOVED: Walk = { score: 0, weight: 0, removed: true, unmet: [], unknown: [] };

function walk(node: FilterNode, grade: Grader): Walk {
  if (isFilterLeaf(node)) {
    const rule = LEAF_RULES[node.field];
    const g = grade(node);
    if (g === 'unknown') return { score: UNKNOWN_CREDIT, weight: rule.weight, removed: false, unmet: [node], unknown: [node] };
    const s = rule.cls === 'binary' || rule.cls === 'hard' ? (g >= 1 ? 1 : 0) : Math.max(0, Math.min(1, g));
    if (rule.cls === 'hard' && s < 1) return { ...REMOVED };
    return { score: s, weight: rule.weight, removed: false, unmet: s < 1 ? [node] : [], unknown: [] };
  }
  if (isFilterNotNode(node)) {
    const child = walk(node.child, (l) => grade(l));
    // strict: excluded only if the child is FULLY satisfied; unknown data passes
    const childSatisfied = !child.removed && child.score >= 1 && child.unknown.length === 0;
    return childSatisfied ? { ...REMOVED } : { score: 1, weight: 0, removed: false, unmet: [], unknown: [] };
  }
  if (isFilterGroupNode(node) && node.op === 'OR') {
    const kids = node.children.map((c) => walk(c, grade)).filter((k) => !k.removed);
    if (kids.length === 0) return { ...REMOVED };
    const best = kids.reduce((a, b) => (b.score > a.score ? b : a));
    return best.score >= 1 ? { ...best, unmet: [], unknown: [] } : best;
  }
  // AND
  const group = node as Extract<FilterNode, { op: 'AND' | 'OR' }>;
  const kids = group.children.map((c) => walk(c, grade));
  if (kids.some((k) => k.removed)) return { ...REMOVED };
  const weight = kids.reduce((n, k) => n + k.weight, 0);
  const score = weight === 0 ? 1 : kids.reduce((n, k) => n + k.score * k.weight, 0) / weight;
  return { score, weight, removed: false, unmet: kids.flatMap((k) => k.unmet), unknown: kids.flatMap((k) => k.unknown) };
}

export function matchScore(tree: FilterNode, grade: Grader): MatchResult {
  const w = walk(tree, grade);
  return { score: w.removed ? 0 : w.score, removed: w.removed, unmet: w.unmet, unknown: w.unknown };
}

export interface CloseMatchOptions { maxMisses?: number; minScore?: number }
/** Exact matches are not "close matches"; a close match is not removed, misses at most `maxMisses` leaves, and clears `minScore`. */
export function isCloseMatch(r: MatchResult, opts: CloseMatchOptions = {}): boolean {
  const { maxMisses = 1, minScore = 0.6 } = opts;
  return !r.removed && r.score < 1 && r.unmet.length <= maxMisses && r.score >= minScore;
}

// ---- graders for the graded leaves -----------------------------------------------------------
/** Days outside the requested range: 0 inside; linear to 0 at `toleranceDays` (default 3). */
export function dateGrade(daysOutside: number, toleranceDays = 3): number {
  if (daysOutside <= 0) return 1;
  return Math.max(0, 1 - daysOutside / toleranceDays);
}
/** Same area 1; the neighbouring area inside the same region 0.6; the same province 0.4; elsewhere 0. */
export function ladderGrade(relation: 'same' | 'sibling' | 'province' | 'other'): number {
  return { same: 1, sibling: 0.6, province: 0.4, other: 0 }[relation];
}
/** Inside the radius 1; linear to 0 at twice the radius. */
export function proximityGrade(distanceM: number, radiusM: number): number {
  if (distanceM <= radiusM) return 1;
  return Math.max(0, 1 - (distanceM - radiusM) / radiusM);
}
