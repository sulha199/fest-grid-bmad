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

/**
 * Drops every `NOT` node whose immediate child is itself a `NOT` node (a double-NOT), collapsing
 * any group/`NOT` left pointing at nothing as a result -- the same mechanism `convertRawNode`
 * already applies at construction time, reused here because `normalize()`'s single-child group
 * collapse can expose a double-NOT that was NOT immediately adjacent in the raw input (e.g. a
 * `NOT` wrapping a single-child `OR` wrapping a `NOT` -- the `OR` disappears on normalize,
 * leaving the two `NOT`s directly adjacent).
 */
function dropDoubleNots(node: FilterNode): FilterNode | undefined {
  if (isFilterNotNode(node)) {
    if (isFilterNotNode(node.child)) {
      return undefined;
    }
    const child = dropDoubleNots(node.child);
    return child === undefined ? undefined : { op: 'NOT', child };
  }
  if (isFilterGroupNode(node)) {
    const children = node.children.map(dropDoubleNots).filter((child): child is FilterNode => child !== undefined);
    if (children.length === 0) {
      return undefined;
    }
    return { op: node.op, children };
  }
  return node;
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
  let validation = validateFilterNode(current);

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
    let doubleNotCaveatPushed = false;
    while (!validation.valid) {
      const hasDoubleNotIssue = validation.issues.some((issue) => /double not/i.test(issue.reason));
      if (hasDoubleNotIssue) {
        // `normalize()`'s single-child group collapse can expose a double-NOT that was not
        // immediately adjacent in the raw input -- re-apply the same drop-and-caveat mechanism
        // `convertRawNode` uses at construction time, then re-normalize (which may itself expose
        // a further double-NOT, hence the surrounding `while`).
        current = normalize(dropDoubleNots(current) ?? { op: 'AND', children: [] });
        if (!doubleNotCaveatPushed) {
          pushedCaveats.push('A double negation in your prompt was simplified; the surrounding condition was dropped.');
          doubleNotCaveatPushed = true;
        }
        validation = validateFilterNode(current);
        continue;
      }

      const widest = findWidestGroupNode(current);
      if (!widest || widest.children.length === 0) {
        // Nothing left to trim -- stop rather than loop forever (should not normally happen,
        // since a single leaf is always within every limit).
        break;
      }
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
