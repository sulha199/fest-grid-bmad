import { z } from 'zod';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { DateAnchor, DateOffsetUnit, DayOfWeek, TemporalFilter } from '../events/buildEventsQueryCondition.js';
import {
  FILTER_LEAF_FIELDS,
  FILTER_NODE_MAX_DEPTH,
  FILTER_NODE_MAX_NODES,
  type FilterLeaf,
  type FilterNode,
} from './filter-node.js';

const dateRangeFilterSchema = z.object({
  anchor: z.nativeEnum(DateAnchor),
  offsetAmount: z.number(),
  offsetUnit: z.nativeEnum(DateOffsetUnit),
});

const locationProximityValueSchema = z.object({
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  radiusMeters: z.number().positive().optional(),
});

/** Structural + locked-vocabulary validation for a single `FilterLeaf` (AC1). */
export const FilterLeafSchema: z.ZodType<FilterLeaf> = z.discriminatedUnion('field', [
  z.object({ field: z.literal('accountId'), value: z.string().min(1) }),
  z.object({ field: z.literal('type'), value: z.array(z.nativeEnum(EventType)).min(1) }),
  z.object({ field: z.literal('category'), value: z.array(z.nativeEnum(EventCategory)).min(1) }),
  z.object({ field: z.literal('keyword'), value: z.string().min(1) }),
  z.object({ field: z.literal('dateRange'), value: dateRangeFilterSchema }),
  z.object({ field: z.literal('dayOfWeek'), value: z.array(z.nativeEnum(DayOfWeek)).min(1) }),
  z.object({ field: z.literal('locationAdminArea'), value: z.string().min(1) }),
  z.object({ field: z.literal('locationProximity'), value: locationProximityValueSchema }),
  z.object({ field: z.literal('venueType'), value: z.string().min(1) }),
  z.object({ field: z.literal('isFree'), value: z.boolean() }),
  z.object({ field: z.literal('temporalFilter'), value: z.nativeEnum(TemporalFilter) }),
]);

/**
 * Recursive structural/field-level schema over the full `FilterNode` shape (AND/OR/NOT/leaf),
 * exported as the plain-Zod contract for `FilterNode` (Story 9.1a Task 3). `validateFilterNode`
 * below does not parse through this schema directly -- it walks the candidate itself (reusing
 * `FilterLeafSchema` for each leaf it finds) so it can collect every independent violation with a
 * precise path, rather than stopping at Zod's first union-branch mismatch.
 */
export const FilterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal('AND'), children: z.array(FilterNodeSchema) }),
    z.object({ op: z.literal('OR'), children: z.array(FilterNodeSchema) }),
    z.object({ op: z.literal('NOT'), child: FilterNodeSchema }),
    FilterLeafSchema,
  ])
);

export type FilterValidationPath = Array<string | number>;

export interface FilterValidationIssue {
  path: FilterValidationPath;
  reason: string;
}

export type FilterValidationResult =
  | { valid: true; node: FilterNode }
  | { valid: false; issues: FilterValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeLeafVocabularyOrShapeError(raw: Record<string, unknown>): string {
  const fieldValue = raw.field;
  if (typeof fieldValue !== 'string' || !(FILTER_LEAF_FIELDS as readonly string[]).includes(fieldValue)) {
    return `Leaf field ${JSON.stringify(fieldValue)} is outside the locked vocabulary (expected one of: ${FILTER_LEAF_FIELDS.join(', ')}).`;
  }
  const result = FilterLeafSchema.safeParse(raw);
  const firstIssue = result.success ? undefined : result.error.issues[0];
  return `Leaf "${fieldValue}" has an invalid value${firstIssue ? `: ${firstIssue.message}` : '.'}`;
}

interface WalkOutcome {
  depth: number;
  count: number;
}

/**
 * Recursively checks `raw` against the FilterNode shape, the locked leaf vocabulary (via
 * `FilterLeafSchema`), the no-double-NOT rule (immediate child only), and the no-empty-group
 * rule -- collecting every independent issue it finds (rather than stopping at the first) while
 * also computing this subtree's depth/node-count along the Dev Notes formulas, so the caller can
 * check the two tree-wide limits in one pass.
 */
function walkNode(raw: unknown, path: FilterValidationPath, issues: FilterValidationIssue[]): WalkOutcome {
  if (!isPlainObject(raw)) {
    issues.push({ path, reason: 'Expected a FilterNode object (an AND/OR/NOT group or a filter leaf).' });
    return { depth: 1, count: 1 };
  }

  if (raw.op === 'AND' || raw.op === 'OR') {
    const children = raw.children;
    if (!Array.isArray(children)) {
      issues.push({ path, reason: `"${raw.op}" group must have a "children" array.` });
      return { depth: 1, count: 1 };
    }
    if (children.length === 0) {
      issues.push({ path, reason: `"${raw.op}" group has zero children (empty group).` });
    }
    let maxChildDepth = 0;
    let totalCount = 1;
    children.forEach((child, index) => {
      const outcome = walkNode(child, [...path, 'children', index], issues);
      maxChildDepth = Math.max(maxChildDepth, outcome.depth);
      totalCount += outcome.count;
    });
    return { depth: 1 + maxChildDepth, count: totalCount };
  }

  if (raw.op === 'NOT') {
    if (!('child' in raw) || raw.child === undefined) {
      issues.push({ path, reason: '"NOT" node must have a "child".' });
      return { depth: 1, count: 1 };
    }
    if (isPlainObject(raw.child) && raw.child.op === 'NOT') {
      issues.push({
        path,
        reason: 'A "NOT" node\'s immediate child must not itself be a "NOT" node (double NOT).',
      });
    }
    const outcome = walkNode(raw.child, [...path, 'child'], issues);
    return { depth: 1 + outcome.depth, count: 1 + outcome.count };
  }

  if ('field' in raw) {
    const result = FilterLeafSchema.safeParse(raw);
    if (!result.success) {
      issues.push({ path, reason: describeLeafVocabularyOrShapeError(raw) });
    }
    return { depth: 1, count: 1 };
  }

  issues.push({
    path,
    reason: 'Node is neither a recognized AND/OR/NOT group nor a filter leaf (missing "op"/"field").',
  });
  return { depth: 1, count: 1 };
}

/**
 * Validates `candidate` against the `FilterNode` shape, the locked leaf vocabulary, and the
 * depth/node-count/double-NOT/empty-group rules (Story 9.1a AC1). Collects every independent
 * violation it finds rather than stopping at the first -- each issue's `path` (an array of
 * `children`/`child` steps from the root) identifies the offending node; the two tree-wide limits
 * (depth, node count) are reported at the root path `[]` since they are properties of the whole
 * tree, not a single node.
 */
export function validateFilterNode(candidate: unknown): FilterValidationResult {
  const issues: FilterValidationIssue[] = [];
  const { depth, count } = walkNode(candidate, [], issues);

  if (depth > FILTER_NODE_MAX_DEPTH) {
    issues.push({
      path: [],
      reason: `Filter tree depth (${depth}) exceeds FILTER_NODE_MAX_DEPTH (${FILTER_NODE_MAX_DEPTH}).`,
    });
  }
  if (count > FILTER_NODE_MAX_NODES) {
    issues.push({
      path: [],
      reason: `Filter tree node count (${count}) exceeds FILTER_NODE_MAX_NODES (${FILTER_NODE_MAX_NODES}).`,
    });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }
  return { valid: true, node: candidate as FilterNode };
}
