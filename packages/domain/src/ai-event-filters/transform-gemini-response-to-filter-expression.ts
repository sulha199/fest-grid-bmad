import { isFilterGroupNode, isFilterNotNode, type FilterGroupNode, type FilterNode } from './filter-node.js';
import { validateFilterNode } from './filter-node-schema.js';
import { normalize } from './normalize-filter-node.js';
import { expressionFromFlatFilter } from './flat-filter-conversion.js';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';

export interface GeminiFilterExtractionResult {
  expression: FilterNode;
  caveats: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The canonical "no filter at all" sentinel (`expressionFromFlatFilter`'s own documented
 * representation of an empty flat filter). `validateFilterNode` rejects ANY empty `AND`/`OR`
 * group as a malformed/empty sub-expression wherever it appears in a tree -- correct for a
 * nested empty group, but this exact shape is also this function's own degrade-to-nothing
 * result (garbage input, a fully-dropped double-NOT, ...), which must be treated as trivially
 * valid rather than fed back into a repair loop that has nothing left to remove.
 */
function isEmptyExpression(node: FilterNode): boolean {
  return isFilterGroupNode(node) && node.op === 'AND' && node.children.length === 0;
}

/**
 * Converts one raw JSON value from Gemini's tree-shaped response into zero, one, or several
 * sibling `FilterNode`s (Story 9.4 AC2). Never returns a nested wrapper for a leaf position -- a
 * leaf-shaped raw object with 2+ populated fields expands into multiple sibling leaves spliced
 * directly into the caller's own children list (Dev Notes decision 3), never an extra group level.
 */
function convertRawNode(raw: unknown, pushedCaveats: string[]): FilterNode[] {
  if (!isPlainObject(raw)) {
    return [];
  }

  if (raw.op === 'AND' || raw.op === 'OR') {
    const rawChildren = Array.isArray(raw.children) ? raw.children : [];
    const children = rawChildren.flatMap((child) => convertRawNode(child, pushedCaveats));
    if (children.length === 0) {
      return [];
    }
    return [{ op: raw.op, children }];
  }

  if (raw.op === 'NOT') {
    const results = convertRawNode(raw.child, pushedCaveats);
    if (results.length === 0) {
      return [];
    }
    const child: FilterNode = results.length === 1 ? results[0] : { op: 'AND', children: results };
    if (isFilterNotNode(child)) {
      // Structurally impossible from the schema's own shape (Task 4's bounded schema never emits
      // a `NOT` at a leaf position's immediate child) -- checked anyway since Gemini output is
      // untrusted (AC2).
      pushedCaveats.push('A double negation in your prompt was simplified; the surrounding condition was dropped.');
      return [];
    }
    return [{ op: 'NOT', child }];
  }

  // Leaf-shaped (no recognized `op`): reuse the existing, already-tested, already-defensive flat
  // transform + flat-to-expression conversion verbatim (Dev Notes decision 2) -- zero new
  // per-field parsing/validation logic.
  const flat = transformGeminiResponseToEventFilter(raw);
  const expression = expressionFromFlatFilter(flat);
  return expression.children;
}

/** Finds the `AND`/`OR` group node (anywhere in the tree, including nested) with the most
 * immediate children -- the trim target when the assembled tree exceeds `FILTER_NODE_MAX_NODES`. */
function findWidestGroupNode(node: FilterNode): FilterGroupNode | undefined {
  let best: FilterGroupNode | undefined;
  function visit(current: FilterNode): void {
    if (isFilterGroupNode(current)) {
      if (!best || current.children.length > best.children.length) {
        best = current;
      }
      current.children.forEach(visit);
    } else if (isFilterNotNode(current)) {
      visit(current.child);
    }
  }
  visit(node);
  return best;
}

/** Rebuilds `node`, replacing `target` (found by object identity) with a copy of itself minus its
 * last child. `target` is always a node actually present in `node`'s own tree (found via
 * `findWidestGroupNode` against this same tree), so identity comparison is safe here. */
function trimNodeByIdentity(node: FilterNode, target: FilterGroupNode): FilterNode {
  if ((node as FilterNode) === (target as FilterNode)) {
    return { op: target.op, children: target.children.slice(0, -1) };
  }
  if (isFilterGroupNode(node)) {
    return { op: node.op, children: node.children.map((child) => trimNodeByIdentity(child, target)) };
  }
  if (isFilterNotNode(node)) {
    return { op: 'NOT', child: trimNodeByIdentity(node.child, target) };
  }
  return node;
}

/**
 * Transforms Gemini's raw JSON response into a validated `FilterNode` expression plus a merged
 * caveat list (Story 9.4 AC2). Accepts either the new tree shape (`payload.expression`), the
 * legacy flat shape (`payload.resolvedFilter`), or neither -- never throws on untrusted input.
 */
export function transformGeminiResponseToFilterExpression(payload: unknown): GeminiFilterExtractionResult {
  const pushedCaveats: string[] = [];

  let root: FilterNode;
  if (isPlainObject(payload) && 'expression' in payload) {
    const siblings = convertRawNode(payload.expression, pushedCaveats);
    const assembled: FilterNode =
      siblings.length === 0
        ? { op: 'AND', children: [] }
        : siblings.length === 1
          ? siblings[0]
          : { op: 'AND', children: siblings };
    root = normalize(assembled);
  } else if (isPlainObject(payload) && 'resolvedFilter' in payload) {
    // Known-flat legacy shape (AC2's "v1 flat response still accepted") -- reuses the existing
    // flat pipeline directly, skipping `convertRawNode` entirely.
    root = normalize(expressionFromFlatFilter(transformGeminiResponseToEventFilter(payload.resolvedFilter)));
  } else {
    root = { op: 'AND', children: [] };
  }

  let current = root;
  let validation = isEmptyExpression(current) ? ({ valid: true, node: current } as const) : validateFilterNode(current);

  if (!validation.valid) {
    const hasDepthIssue = validation.issues.some((issue) => /depth/i.test(issue.reason));
    if (hasDepthIssue) {
      // Depth cannot be violated by construction (the schema/splicing design in convertRawNode
      // above) -- a depth issue here indicates a real bug in this function's own code, not
      // untrusted-input shape, and is deliberately left to propagate (AC2) rather than swallowed.
      throw new Error(
        `transformGeminiResponseToFilterExpression produced an invalid tree depth, which should be structurally impossible: ${validation.issues
          .map((issue) => issue.reason)
          .join('; ')}`
      );
    }

    let trimmedCaveatPushed = false;
    while (!validation.valid) {
      const hasDoubleNotIssue = validation.issues.some((issue) => /double not/i.test(issue.reason));
      if (hasDoubleNotIssue) {
        // `normalize()`'s single-child group collapse can expose a double-NOT that was not
        // immediately adjacent in the raw input (e.g. a `NOT` wrapping a single-child `OR`
        // wrapping a `NOT` -- the `OR` disappears on normalize, leaving the two `NOT`s directly
        // adjacent). This issue can only ever be reported at the tree's own root: `NOT(NOT(leaf))`
        // is already depth 3 (the maximum), so a double-NOT nested one level deeper inside an
        // enclosing group/`NOT` would push the whole tree to depth 4+ and trip the depth guard
        // above first. A root-level double-NOT's only child is itself the (now-dangling) `NOT`
        // being negated away, so dropping it -- the same "drop the whole outer NOT" mechanism
        // `convertRawNode` applies at construction time -- always empties the tree entirely,
        // which is always immediately valid (see `isEmptyExpression`), so this branch of the loop
        // never runs a second time -- no "already pushed" guard needed, unlike the node-count
        // trim below.
        current = { op: 'AND', children: [] };
        pushedCaveats.push('A double negation in your prompt was simplified; the surrounding condition was dropped.');
        validation = { valid: true, node: current };
        continue;
      }

      // Depth and double-NOT issues are both handled above (the depth guard throws; the
      // double-NOT guard `continue`s), so the only issue `validation` can still report here is a
      // node-count violation -- which, given `FILTER_NODE_MAX_NODES` (12) and a max depth of 3,
      // can only occur when some `AND`/`OR` group holds 2+ children (a leaf/`NOT`-only chain
      // tops out at node count 3). `findWidestGroupNode` is therefore guaranteed to find one.
      const widest = findWidestGroupNode(current) as FilterGroupNode;
      current = normalize(trimNodeByIdentity(current, widest));
      if (!trimmedCaveatPushed) {
        pushedCaveats.push('Your prompt described more conditions than the filter supports, so some were dropped.');
        trimmedCaveatPushed = true;
      }
      validation = validateFilterNode(current);
    }
  }

  const modelCaveats =
    isPlainObject(payload) && Array.isArray(payload.caveats)
      ? payload.caveats.filter((caveat): caveat is string => typeof caveat === 'string')
      : [];

  return {
    expression: current,
    caveats: [...modelCaveats, ...pushedCaveats],
  };
}
