import type { EventType, EventCategory } from '@festgrid/shared-types';
import type { DateRangeFilter, DayOfWeek, TemporalFilter } from '../events/buildEventsQueryCondition.js';

/**
 * Locked leaf field vocabulary (Story 9.1a AC1, `filter-vocabulary.md` "Expression operators
 * (CAP-6)"). This is the single authoritative list of field names a `FilterLeaf` may carry --
 * `validateFilterNode` rejects anything outside it.
 */
export const FILTER_LEAF_FIELDS = [
  'accountId',
  'type',
  'category',
  'keyword',
  'dateRange',
  'dayOfWeek',
  'locationAdminArea',
  'locationProximity',
  'venueType',
  'isFree',
  'temporalFilter',
] as const;

export type FilterLeafField = (typeof FILTER_LEAF_FIELDS)[number];

/**
 * Mutually-exclusive with `locationAdminArea` at the leaf level (Dev Notes decision 5) --
 * constructing both a proximity and an adminArea value in one leaf is not representable by the
 * type system, unlike the flat `EventFilterInput.location` shape which allows both at once.
 */
export interface LocationProximityValue {
  coordinates: { lat: number; lng: number };
  radiusMeters?: number;
}

/**
 * A single locked-vocabulary leaf condition. `type`/`category`/`dayOfWeek` are array-valued
 * (within-field OR -- Dev Notes decisions 3-4 of Story 9.1a); `locationAdminArea` and
 * `locationProximity` are split into two mutually-exclusive leaf field variants (decision 5)
 * instead of one `location` field whose inner shape could represent both.
 */
export type FilterLeaf =
  | { field: 'accountId'; value: string }
  | { field: 'type'; value: EventType[] }
  | { field: 'category'; value: EventCategory[] }
  | { field: 'keyword'; value: string }
  | { field: 'dateRange'; value: DateRangeFilter }
  | { field: 'dayOfWeek'; value: DayOfWeek[] }
  | { field: 'locationAdminArea'; value: string }
  | { field: 'locationProximity'; value: LocationProximityValue }
  | { field: 'venueType'; value: string }
  | { field: 'isFree'; value: boolean }
  | { field: 'temporalFilter'; value: TemporalFilter };

/** An `AND`/`OR` group over 1+ child nodes. Leaves never carry an `op` key. */
export interface FilterGroupNode {
  op: 'AND' | 'OR';
  children: FilterNode[];
}

/** Negates a single child node (a leaf or a group -- never another bare `NOT`, see AC1). */
export interface FilterNotNode {
  op: 'NOT';
  child: FilterNode;
}

/**
 * `AND`/`OR`/`NOT` over the locked-vocabulary `FilterLeaf` leaves (Story 9.1a). Groups/`NOT`
 * nodes are discriminated from leaves by the presence of an `op` key -- leaves have no `op`.
 */
export type FilterNode = FilterGroupNode | FilterNotNode | FilterLeaf;

/**
 * `depth(leaf) = 1`; `depth(NOT x) = 1 + depth(x)`; `depth(AND/OR group) = 1 + max(depth(c) for c
 * in children)`. This is the sole definition of tree depth in the repo (AC4) -- a flat filter's
 * implicit top-level `AND` of leaves is depth 2, comfortably within this limit; the SPEC's worked
 * example ("jazz or blues in Sleman or Bantul this weekend, not workshops") comes out to depth 3
 * exactly, confirming the limit is sized for that example rather than an off-by-one trap.
 */
export const FILTER_NODE_MAX_DEPTH = 3;

/**
 * `nodeCount(leaf) = 1`; `nodeCount(NOT x) = 1 + nodeCount(x)`; `nodeCount(group) = 1 +
 * sum(nodeCount(c) for c in children)`. This is the sole definition of node count in the repo
 * (AC4).
 */
export const FILTER_NODE_MAX_NODES = 12;

/** `node` carries no `op` key -- it is a `FilterLeaf`. */
export function isFilterLeaf(node: FilterNode): node is FilterLeaf {
  return !('op' in node);
}

/** `node` is an `AND`/`OR` group (never a bare leaf or a `NOT`). */
export function isFilterGroupNode(node: FilterNode): node is FilterGroupNode {
  return 'op' in node && (node.op === 'AND' || node.op === 'OR');
}

/** `node` is a `NOT` wrapper. */
export function isFilterNotNode(node: FilterNode): node is FilterNotNode {
  return 'op' in node && node.op === 'NOT';
}
