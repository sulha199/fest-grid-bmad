import { isGroupCondition, type QueryCondition } from '../query/queryDsl.js';
import {
  buildAccountIdCondition,
  buildCategoriesCondition,
  buildDateRangeAndDayOfWeekCondition,
  buildIsFreeCondition,
  buildKeywordCondition,
  buildLocationCondition,
  buildTemporalCondition,
  buildTypesCondition,
  buildVenueTypeCondition,
  resolveZonedToday,
} from '../events/buildEventsQueryCondition.js';
import { isFilterGroupNode, isFilterLeaf, isFilterNotNode, type FilterLeaf, type FilterNode } from './filter-node.js';
import { normalize } from './normalize-filter-node.js';

/**
 * Story 9.2. Resolution context passed through the whole compile -- `currentDate` defaults to
 * `new Date()` and `timezone` resolves "today" the same way `buildEventsQueryCondition` does
 * (via `resolveZonedToday`, Task 1).
 */
export interface CompileFilterNodeContext {
  currentDate?: Date;
  timezone?: string | null;
}

/** Internal, fully-resolved context threaded through the recursive compile steps. */
interface ResolvedContext {
  now: Date;
  timezone?: string | null;
  zonedTodayISO: string;
  zonedCurrentDate: Date;
}

/**
 * Task 3 -- compiles a `FilterLeaf` to its `QueryCondition` form by dispatching to the Task 1
 * leaf builders extracted out of `buildEventsQueryCondition.ts`. This is the single shared
 * implementation AC2's parity requirement depends on -- never a second, independently-written
 * translation of a leaf's semantics.
 */
function compileLeaf(leaf: FilterLeaf, ctx: ResolvedContext): QueryCondition | undefined {
  switch (leaf.field) {
    case 'accountId':
      return buildAccountIdCondition(leaf.value);
    case 'type':
      return buildTypesCondition(leaf.value);
    case 'category':
      return buildCategoriesCondition(leaf.value);
    case 'keyword':
      return buildKeywordCondition(leaf.value);
    case 'dateRange':
      return buildDateRangeAndDayOfWeekCondition(leaf.value, undefined, ctx.zonedCurrentDate, ctx.zonedTodayISO);
    case 'dayOfWeek':
      return buildDateRangeAndDayOfWeekCondition(undefined, leaf.value, ctx.zonedCurrentDate, ctx.zonedTodayISO);
    case 'locationAdminArea':
      return buildLocationCondition({ adminArea: leaf.value });
    case 'locationProximity':
      return buildLocationCondition({ coordinates: leaf.value.coordinates, radiusMeters: leaf.value.radiusMeters });
    case 'venueType':
      return buildVenueTypeCondition(leaf.value);
    case 'isFree':
      return buildIsFreeCondition(leaf.value);
    case 'temporalFilter':
      return buildTemporalCondition(leaf.value, ctx.now, ctx.timezone);
  }
}

/**
 * Task 3 -- the one deliberate sibling-level special-case in the whole compiler (Dev Notes
 * decision 1): a direct `dateRange` leaf child and a direct `dayOfWeek` leaf child of the SAME
 * `AND` group must compile together via one `buildDateRangeAndDayOfWeekCondition` call (mirroring
 * the legacy flat path's coupling of the two fields), not as two independently-ANDed conditions.
 * Every other child compiles independently via `compileNode`, preserving array order.
 */
function compileAndChildren(children: FilterNode[], ctx: ResolvedContext): QueryCondition[] {
  const dateRangeIndex = children.findIndex((c) => isFilterLeaf(c) && c.field === 'dateRange');
  const dayOfWeekIndex = children.findIndex((c) => isFilterLeaf(c) && c.field === 'dayOfWeek');

  if (dateRangeIndex !== -1 && dayOfWeekIndex !== -1) {
    const dateRangeLeaf = children[dateRangeIndex] as FilterLeaf & { field: 'dateRange' };
    const dayOfWeekLeaf = children[dayOfWeekIndex] as FilterLeaf & { field: 'dayOfWeek' };
    const mergedCondition = buildDateRangeAndDayOfWeekCondition(
      dateRangeLeaf.value, dayOfWeekLeaf.value, ctx.zonedCurrentDate, ctx.zonedTodayISO
    );
    const skipIndex = Math.max(dateRangeIndex, dayOfWeekIndex);
    const insertIndex = Math.min(dateRangeIndex, dayOfWeekIndex);
    const compiled: QueryCondition[] = [];
    children.forEach((child, i) => {
      if (i === skipIndex) return;
      if (i === insertIndex) {
        if (mergedCondition) compiled.push(mergedCondition);
        return;
      }
      const result = compileNode(child, ctx);
      if (result) compiled.push(result);
    });
    return compiled;
  }

  const compiled: QueryCondition[] = [];
  for (const child of children) {
    const result = compileNode(child, ctx);
    if (result) compiled.push(result);
  }
  return compiled;
}

/**
 * Task 3 -- NOT-inversion is driven by the *compiled condition's own shape*, not by a hardcoded
 * per-leaf-field table (Dev Notes decision 2). A compiled form that is a single `TerminalCondition`
 * with `operator: 'eq'` inverts in place to `'ne'`; `operator: 'in'` inverts to `'notIn'`; every
 * other compiled shape (a `GroupCondition`, or a terminal using `contains`/`overlaps`/
 * `withinRadius`/`notEnded`) is wrapped in a new `'not'` DSL group.
 */
function compileNot(child: FilterNode, ctx: ResolvedContext): QueryCondition | undefined {
  const compiledChild = compileNode(child, ctx);
  if (compiledChild === undefined) return undefined;

  if (!isGroupCondition(compiledChild)) {
    if (compiledChild.operator === 'eq') {
      return { ...compiledChild, operator: 'ne' };
    }
    if (compiledChild.operator === 'in') {
      return { ...compiledChild, operator: 'notIn' };
    }
  }

  return { operator: 'not', conditions: [compiledChild] };
}

/**
 * Task 3 -- dispatches a `FilterNode` to the appropriate compile step. `AND`/`OR` groups never
 * collapse a single-element result to its bare child (Dev Notes decision 6) -- this mirrors the
 * legacy flat path's own `{ operator: 'and', conditions }` return shape, which is unconditional
 * regardless of `conditions.length`, and is required for AC2's parity test to hold.
 */
function compileNode(node: FilterNode, ctx: ResolvedContext): QueryCondition | undefined {
  if (isFilterLeaf(node)) {
    return compileLeaf(node, ctx);
  }
  if (isFilterNotNode(node)) {
    return compileNot(node.child, ctx);
  }

  // AND/OR group.
  const compiledChildren = node.op === 'AND'
    ? compileAndChildren(node.children, ctx)
    : node.children.map((child) => compileNode(child, ctx)).filter((c): c is QueryCondition => c !== undefined);

  if (compiledChildren.length === 0) return undefined;
  return { operator: node.op === 'AND' ? 'and' : 'or', conditions: compiledChildren };
}

/**
 * Story 9.2 -- compiles a `FilterNode` (Story 9.1a) to the existing `QueryCondition` query DSL,
 * with `not` supported end to end (AC1). Normalizes the tree exactly once, at the top (`normalize`
 * is already bottom-up/idempotent -- never re-normalized at each recursive step).
 */
export function compileFilterNodeToQueryCondition(
  node: FilterNode,
  ctx: CompileFilterNodeContext = {}
): QueryCondition | undefined {
  const now = ctx.currentDate ?? new Date();
  const { zonedTodayISO, zonedCurrentDate } = resolveZonedToday(now, ctx.timezone);
  const resolvedCtx: ResolvedContext = { now, timezone: ctx.timezone, zonedTodayISO, zonedCurrentDate };
  const normalized = normalize(node);
  const compiled = compileNode(normalized, resolvedCtx);
  if (compiled === undefined) return undefined;

  // Dev Notes decision 6's "never collapse a group to its bare child" invariant is enforced by
  // `compileNode`'s own AND/OR-group branch, but `normalize()` (called once, above) can ALSO
  // collapse a top-level AND/OR group down to its single remaining child before `compileNode`
  // ever gets a chance to see it as a group at all (e.g. `expressionFromFlatFilter`'s
  // single-populated-field output, always wrapped as `{ op: 'AND', children: [oneLeaf] }`,
  // normalizes straight to the bare leaf). Re-wrap in that case so a top-level AND/OR group
  // input still always compiles to a wrapped `{ operator, conditions: [...] }` shape -- matching
  // the legacy flat path's own unconditional `{ operator: 'and', conditions }` return, which is
  // required for AC2's byte-identical parity test to hold for every single-field fixture.
  if (isFilterGroupNode(node) && !isGroupCondition(compiled)) {
    return { operator: node.op === 'AND' ? 'and' : 'or', conditions: [compiled] };
  }

  return compiled;
}
