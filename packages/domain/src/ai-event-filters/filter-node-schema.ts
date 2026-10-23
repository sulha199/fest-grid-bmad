import { z } from 'zod';
import { EventType, EventCategory } from '@festgrid/shared-types';
import {
  DateAnchor,
  DateOffsetUnit,
  DayOfWeek,
  TemporalFilter,
  DATE_OFFSET_AMOUNT_BOUNDS,
  MAX_WEEKDAY_DATE_TERMS,
  estimateWeekdayDateTerms,
} from '../events/buildEventsQueryCondition.js';
import { normalize } from './normalize-filter-node.js';
import {
  FILTER_LEAF_FIELDS,
  FILTER_NODE_MAX_DEPTH,
  FILTER_NODE_MAX_NODES,
  type FilterLeaf,
  type FilterNode,
} from './filter-node.js';

/**
 * AC1/Task 8: `spanAmount`/`spanUnit` are optional and bounds-validated against the shared
 * `DATE_OFFSET_AMOUNT_BOUNDS` table (imported from `buildEventsQueryCondition.ts`, never
 * re-declared here) -- keeping this schema a complete, accurate contract for `DateRangeFilter`'s
 * real shape (Story 9.1a AC4's "single definition of limits" rigor) rather than silently going
 * stale relative to it.
 */
const dateRangeFilterSchema = z
  .object({
    anchor: z.nativeEnum(DateAnchor),
    offsetAmount: z.number().int(),
    offsetUnit: z.nativeEnum(DateOffsetUnit),
    // `DateRangeFilter` types the span as `number | null` (GraphQL serializes an absent optional
    // as an explicit null), so null must be accepted here exactly like undefined (Epic 9 review P7).
    spanAmount: z.number().int().positive().nullish(),
    spanUnit: z.nativeEnum(DateOffsetUnit).nullish(),
  })
  .superRefine((val, ctx) => {
    if (Math.abs(val.offsetAmount) > DATE_OFFSET_AMOUNT_BOUNDS[val.offsetUnit]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offsetAmount'],
        message: `offsetAmount (${val.offsetAmount}) exceeds the allowed bound of ±${DATE_OFFSET_AMOUNT_BOUNDS[val.offsetUnit]} for offsetUnit "${val.offsetUnit}".`,
      });
    }
    const hasSpanAmount = val.spanAmount != null;
    const hasSpanUnit = val.spanUnit != null;
    if (hasSpanAmount !== hasSpanUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasSpanAmount ? ['spanUnit'] : ['spanAmount'],
        message: 'spanAmount and spanUnit must be provided together.',
      });
    } else if (hasSpanAmount && hasSpanUnit && val.spanAmount! > DATE_OFFSET_AMOUNT_BOUNDS[val.spanUnit!]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['spanAmount'],
        message: `spanAmount (${val.spanAmount}) exceeds the allowed bound of ${DATE_OFFSET_AMOUNT_BOUNDS[val.spanUnit!]} for spanUnit "${val.spanUnit}".`,
      });
    }
  });

/** Upper bound on free-text leaf values: far above any real keyword/place name, low enough that a
 * hostile payload cannot park a megabyte string in a persisted jsonb column (Epic 9 review P8). */
const MAX_LEAF_TEXT_LENGTH = 200;
/** Far above any radius the UI offers; keeps `radiusMeters` finite and sane. */
const MAX_RADIUS_METERS = 1_000_000;

const locationProximityValueSchema = z.object({
  coordinates: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  radiusMeters: z.number().positive().max(MAX_RADIUS_METERS).optional(),
});

/**
 * Mirrors the keyword leaf builder in the events query module: a keyword that trims to nothing, or to a bare `#`, compiles to
 * no condition at all, so accepting it would make `OR(x, keyword)` silently narrow and
 * `NOT(keyword)` silently match everything (Epic 9 review P8).
 */
export function isMeaningfulKeyword(keyword: string): boolean {
  const trimmed = keyword.trim();
  if (trimmed.startsWith('#')) {
    return trimmed.slice(1).trim().length > 0;
  }
  return trimmed.length > 0;
}

/** Structural + locked-vocabulary validation for a single `FilterLeaf` (AC1). */
export const FilterLeafSchema: z.ZodType<FilterLeaf> = z.discriminatedUnion('field', [
  z.object({ field: z.literal('accountId'), value: z.string().min(1).max(MAX_LEAF_TEXT_LENGTH) }),
  z.object({
    field: z.literal('type'),
    value: z.array(z.nativeEnum(EventType)).min(1).max(Object.values(EventType).length),
  }),
  z.object({
    field: z.literal('category'),
    value: z.array(z.nativeEnum(EventCategory)).min(1).max(Object.values(EventCategory).length),
  }),
  z.object({
    field: z.literal('keyword'),
    value: z
      .string()
      .max(MAX_LEAF_TEXT_LENGTH)
      .refine(isMeaningfulKeyword, { message: 'Keyword must contain text (a bare "#" or whitespace matches nothing).' }),
  }),
  z.object({ field: z.literal('dateRange'), value: dateRangeFilterSchema }),
  z.object({
    field: z.literal('dayOfWeek'),
    value: z.array(z.nativeEnum(DayOfWeek)).min(1).max(Object.values(DayOfWeek).length),
  }),
  z.object({ field: z.literal('locationAdminArea'), value: z.string().min(1).max(MAX_LEAF_TEXT_LENGTH) }),
  z.object({ field: z.literal('locationProximity'), value: locationProximityValueSchema }),
  z.object({ field: z.literal('venueType'), value: z.string().min(1).max(MAX_LEAF_TEXT_LENGTH) }),
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

/**
 * The five keys GraphQL's `FilterNode` object type declares on EVERY node. A GraphQL response
 * serializes all of them -- absent ones as an explicit `null` (e.g. a leaf arrives as
 * `{ op: null, field: "type", value: [...], children: null, child: null }`) -- whereas this
 * module's domain `FilterNode` union signals "not a group/NOT" by the ABSENCE of `op`/`children`/
 * `child`. Left as-is, a null-padded node passes structural validation (Zod strips the unknown
 * keys) yet later crashes `.map`/`for...of` consumers that expect an array.
 */
const FILTER_NODE_KEYS = ['op', 'field', 'value', 'children', 'child'] as const;

/** Beyond this depth `stripNullNodeKeys` stops recursing and hands the subtree back untouched;
 * `validateFilterNode`'s shape preflight then rejects the tree, so a hostile deeply-nested payload
 * can never overflow the stack here (Epic 9 review P14). Far above `FILTER_NODE_MAX_DEPTH`. */
const STRIP_MAX_DEPTH = 32;

/** Optional keys inside a leaf's `value` object that a GraphQL round-trip returns as explicit
 * `null` when absent; dropping them restores the domain shape (`spanAmount?: number`). */
const NULLABLE_LEAF_VALUE_KEYS: Record<string, readonly string[]> = {
  dateRange: ['spanAmount', 'spanUnit'],
  locationProximity: ['radiusMeters'],
};

/**
 * Returns a copy of `raw` with every `null`/`undefined` node key (see `FILTER_NODE_KEYS`) removed,
 * recursing through `children`/`child`, plus the null optional keys of a `dateRange` /
 * `locationProximity` leaf value (see `NULLABLE_LEAF_VALUE_KEYS`). Anything else in a leaf's
 * `value` payload is left untouched. Anything that is not a plain object is returned as-is so
 * `walkNode` can report it.
 */
export function stripNullNodeKeys(raw: unknown, depth = 0): unknown {
  if (!isPlainObject(raw) || depth > STRIP_MAX_DEPTH) {
    return raw;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if ((value === null || value === undefined) && (FILTER_NODE_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    cleaned[key] = value;
  }
  if (Array.isArray(cleaned.children)) {
    cleaned.children = cleaned.children.map((child) => stripNullNodeKeys(child, depth + 1));
  }
  if ('child' in cleaned) {
    cleaned.child = stripNullNodeKeys(cleaned.child, depth + 1);
  }
  // `field` is attacker-controlled: an inherited key such as "constructor" must not resolve to an
  // Object.prototype member (not iterable -> a TypeError that would escape as a 500).
  const nullableKeys =
    typeof cleaned.field === 'string' && Object.hasOwn(NULLABLE_LEAF_VALUE_KEYS, cleaned.field)
      ? NULLABLE_LEAF_VALUE_KEYS[cleaned.field]
      : undefined;
  if (nullableKeys && isPlainObject(cleaned.value)) {
    const value: Record<string, unknown> = { ...cleaned.value };
    for (const key of nullableKeys) {
      if (value[key] === null) {
        delete value[key];
      }
    }
    cleaned.value = value;
  }
  return cleaned;
}

/** `firstIssueMessage` is the first Zod issue of the failed `FilterLeafSchema.safeParse(raw)`. */
function describeLeafVocabularyOrShapeError(raw: Record<string, unknown>, firstIssueMessage: string): string {
  const fieldValue = raw.field;
  if (typeof fieldValue !== 'string' || !(FILTER_LEAF_FIELDS as readonly string[]).includes(fieldValue)) {
    return `Leaf field ${JSON.stringify(fieldValue)} is outside the locked vocabulary (expected one of: ${FILTER_LEAF_FIELDS.join(', ')}).`;
  }
  return `Leaf "${fieldValue}" has an invalid value: ${firstIssueMessage}`;
}

/**
 * Epic 9 review (P17): an AND that carries both a `dateRange` and a `dayOfWeek` leaf compiles to
 * one query term per matching date. Returns the estimated term count when it exceeds the limit.
 */
export function findOversizedWeekdayWindow(children: unknown[]): number | undefined {
  const parsed = children
    .filter((child): child is Record<string, unknown> => isPlainObject(child) && !('op' in child))
    .map((child) => FilterLeafSchema.safeParse(child))
    .filter((result) => result.success)
    .map((result) => (result as { data: FilterLeaf }).data);
  const dateRange = parsed.find((leaf) => leaf.field === 'dateRange');
  const dayOfWeek = parsed.find((leaf) => leaf.field === 'dayOfWeek');
  if (!dateRange || dateRange.field !== 'dateRange' || !dayOfWeek || dayOfWeek.field !== 'dayOfWeek') {
    return undefined;
  }
  const estimate = estimateWeekdayDateTerms(dateRange.value, dayOfWeek.value.length);
  return estimate > MAX_WEEKDAY_DATE_TERMS ? estimate : undefined;
}

interface WalkOutcome {
  depth: number;
  count: number;
}

/** A tree that is this broken has nothing more useful to say: cap the reported issues so a hostile
 * payload cannot make the validation message itself enormous (Epic 9 review P14). */
const MAX_REPORTED_ISSUES = 25;

/** `op` is attacker-controlled and only null-stripped: never echo it whole (a multi-megabyte string
 * would make the message itself huge) and never `JSON.stringify` it (a deeply nested value throws). */
function describeUnknownOp(op: unknown): string {
  if (typeof op === 'string') {
    return JSON.stringify(op.length > 20 ? `${op.slice(0, 20)}...` : op);
  }
  return `of type ${Array.isArray(op) ? 'array' : typeof op}`;
}

function pushIssue(issues: FilterValidationIssue[], issue: FilterValidationIssue): void {
  if (issues.length < MAX_REPORTED_ISSUES) {
    issues.push(issue);
  }
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
    pushIssue(issues, { path, reason: 'Expected a FilterNode object (an AND/OR/NOT group or a filter leaf).' });
    return { depth: 1, count: 1 };
  }

  if (raw.op === 'AND' || raw.op === 'OR') {
    const children = raw.children;
    if (!Array.isArray(children)) {
      pushIssue(issues, { path, reason: `"${raw.op}" group must have a "children" array.` });
      return { depth: 1, count: 1 };
    }
    if (children.length === 0) {
      pushIssue(issues, { path, reason: `"${raw.op}" group has zero children (empty group).` });
    }
    let maxChildDepth = 0;
    let totalCount = 1;
    children.forEach((child, index) => {
      const outcome = walkNode(child, [...path, 'children', index], issues);
      maxChildDepth = Math.max(maxChildDepth, outcome.depth);
      totalCount += outcome.count;
    });
    if (raw.op === 'AND') {
      const oversized = findOversizedWeekdayWindow(children);
      if (oversized !== undefined) {
        pushIssue(issues, {
          path,
          reason: `A date range combined with weekdays would match about ${oversized} dates (limit ${MAX_WEEKDAY_DATE_TERMS}); shorten the date range or choose fewer weekdays.`,
        });
      }
    }
    return { depth: 1 + maxChildDepth, count: totalCount };
  }

  if (raw.op === 'NOT') {
    if (!('child' in raw) || raw.child === undefined) {
      pushIssue(issues, { path, reason: '"NOT" node must have a "child".' });
      return { depth: 1, count: 1 };
    }
    if (isPlainObject(raw.child) && raw.child.op === 'NOT') {
      pushIssue(issues, {
        path,
        reason: 'A "NOT" node\'s immediate child must not itself be a "NOT" node (double NOT).',
      });
    }
    const outcome = walkNode(raw.child, [...path, 'child'], issues);
    return { depth: 1 + outcome.depth, count: 1 + outcome.count };
  }

  if ('op' in raw) {
    pushIssue(issues, {
      path,
      reason: `Unknown "op" value ${describeUnknownOp(raw.op)} (expected "AND", "OR" or "NOT").`,
    });
    return { depth: 1, count: 1 };
  }

  if ('field' in raw) {
    const result = FilterLeafSchema.safeParse(raw);
    if (!result.success) {
      pushIssue(issues, { path, reason: describeLeafVocabularyOrShapeError(raw, result.error.issues[0].message) });
    }
    return { depth: 1, count: 1 };
  }

  pushIssue(issues, {
    path,
    reason: 'Node is neither a recognized AND/OR/NOT group nor a filter leaf (missing "op"/"field").',
  });
  return { depth: 1, count: 1 };
}

/** A tree beyond these bounds is rejected without being walked in full (Epic 9 review P14): they
 * are an order of magnitude above the real limits (depth 3, 12 nodes), so every tree that is merely
 * over-limit still gets its precise depth/node-count message from the normal walk below. */
const PREFLIGHT_MAX_DEPTH = 32;
const PREFLIGHT_MAX_NODES = 200;
/** Largest legitimate leaf `value` array is a full enum (types/categories, a few dozen entries).
 * `value` is a free-form JSON scalar on the public query, and Zod would otherwise walk -- and build
 * an issue for -- every element of a million-entry array (about 20 s of CPU measured). */
const PREFLIGHT_MAX_LEAF_VALUES = 64;

/**
 * Iterative (explicit stack, no recursion) size/depth probe: lets `validateFilterNode` refuse a
 * hostile payload -- tens of thousands of nested nodes or a million-entry `children` array --
 * before any recursive walk can overflow the stack or build a megabyte-long issue list.
 */
export function exceedsPreflightBounds(root: unknown): boolean {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 1 }];
  let visited = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    visited += 1;
    if (visited > PREFLIGHT_MAX_NODES || depth > PREFLIGHT_MAX_DEPTH) {
      return true;
    }
    if (!isPlainObject(node)) {
      continue;
    }
    if (Array.isArray(node.value) && node.value.length > PREFLIGHT_MAX_LEAF_VALUES) {
      return true;
    }
    if (Array.isArray(node.children)) {
      if (node.children.length > PREFLIGHT_MAX_NODES) {
        return true;
      }
      for (const child of node.children) {
        stack.push({ node: child, depth: depth + 1 });
      }
    }
    if ('child' in node) {
      stack.push({ node: node.child, depth: depth + 1 });
    }
  }
  return false;
}

/** Rebuilds a candidate that already passed `walkNode` into the domain `FilterNode` shape, via the
 * Zod leaf schema, so unknown keys (a stray `__typename`, junk on a group) never reach persistence
 * or the compiler (Epic 9 review P8). */
function toCleanNode(raw: Record<string, unknown>): FilterNode {
  if (raw.op === 'AND' || raw.op === 'OR') {
    return {
      op: raw.op,
      children: (raw.children as Array<Record<string, unknown>>).map(toCleanNode),
    };
  }
  if (raw.op === 'NOT') {
    return { op: 'NOT', child: toCleanNode(raw.child as Record<string, unknown>) };
  }
  return FilterLeafSchema.parse(raw);
}

/**
 * Validates `candidate` against the `FilterNode` shape, the locked leaf vocabulary, and the
 * depth/node-count/double-NOT/empty-group rules (Story 9.1a AC1). Collects every independent
 * violation it finds rather than stopping at the first -- each issue's `path` (an array of
 * `children`/`child` steps from the root) identifies the offending node; the two tree-wide limits
 * (depth, node count) are reported at the root path `[]` since they are properties of the whole
 * tree, not a single node. The returned `node` is rebuilt from the parsed leaves, so it carries no
 * keys outside the domain shape.
 */
export function validateFilterNode(rawCandidate: unknown): FilterValidationResult {
  // Normalize GraphQL's null-padded node shape first, so both the walk below and the `node` handed
  // back to callers (resolvers, the compiler, the web hook) see the domain's absent-key shape.
  const candidate = stripNullNodeKeys(rawCandidate);

  if (exceedsPreflightBounds(candidate)) {
    return {
      valid: false,
      issues: [
        {
          path: [],
          reason: `Filter tree is far over the limits (FILTER_NODE_MAX_DEPTH ${FILTER_NODE_MAX_DEPTH}, FILTER_NODE_MAX_NODES ${FILTER_NODE_MAX_NODES}, ${PREFLIGHT_MAX_LEAF_VALUES} values per leaf) -- not inspected further.`,
        },
      ],
    };
  }

  const issues: FilterValidationIssue[] = [];
  const { depth, count } = walkNode(candidate, [], issues);

  if (depth > FILTER_NODE_MAX_DEPTH) {
    pushIssue(issues, {
      path: [],
      reason: `Filter tree depth (${depth}) exceeds FILTER_NODE_MAX_DEPTH (${FILTER_NODE_MAX_DEPTH}).`,
    });
  }
  if (count > FILTER_NODE_MAX_NODES) {
    pushIssue(issues, {
      path: [],
      reason: `Filter tree node count (${count}) exceeds FILTER_NODE_MAX_NODES (${FILTER_NODE_MAX_NODES}).`,
    });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }
  const node = toCleanNode(candidate as Record<string, unknown>);
  // The per-AND check in `walkNode` only sees a leaf pair that are direct siblings, but the compiler
  // `normalize`s first: AND(dateRange, AND(dayOfWeek, ...)) flattens into one AND and would expand
  // past the term cap (and throw at query time). Check the shape the compiler will actually see.
  const oversized = findOversizedWeekdayWindowIn(normalize(node));
  if (oversized !== undefined) {
    return {
      valid: false,
      issues: [
        {
          path: [],
          reason: `A date range combined with weekdays would match about ${oversized} dates (limit ${MAX_WEEKDAY_DATE_TERMS}); shorten the date range or choose fewer weekdays.`,
        },
      ],
    };
  }
  return { valid: true, node };
}

/** `findOversizedWeekdayWindow` for the root of an already-normalized tree. Only the root can hide a
 * pair that `walkNode` could not see: the depth limit (3) leaves no room for an AND nested in an AND
 * anywhere below it, so a pair only appears by flattening at the root. */
function findOversizedWeekdayWindowIn(node: FilterNode): number | undefined {
  return 'op' in node && node.op === 'AND' ? findOversizedWeekdayWindow(node.children) : undefined;
}
