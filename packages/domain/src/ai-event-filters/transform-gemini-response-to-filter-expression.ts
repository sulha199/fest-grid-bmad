import { isFilterGroupNode, isFilterNotNode, type FilterGroupNode, type FilterNode } from './filter-node.js';
import { repairToValidTree, type RepairKind } from './sanitize-filter-node.js';
import { normalize } from './normalize-filter-node.js';
import { expressionFromFlatFilter } from './flat-filter-conversion.js';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';

export const EMPTY_EXPRESSION_CAVEAT =
  'We could not turn your prompt into any filter. Try rephrasing it, e.g. "kids events in Yogyakarta this weekend".';

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

const DOUBLE_NEGATION_CAVEAT = 'A double negation in your prompt was simplified; the surrounding condition was dropped.';
const TOO_COMPLEX_CAVEAT = 'Your prompt described more conditions than the filter supports, so some were dropped.';
const INVALID_FRAGMENT_CAVEAT =
  'Part of your prompt could not be turned into a valid filter condition, so it was ignored.';
const WEEKDAY_WINDOW_CAVEAT =
  'The weekdays in your prompt cover too long a period to apply, so they were ignored and the whole date range is shown.';
const UNKNOWN_OPERATOR_CAVEAT = 'An unrecognised operator in your prompt was ignored.';

function pushCaveat(caveats: string[], message: string): void {
  if (!caveats.includes(message)) {
    caveats.push(message);
  }
}

/**
 * Leaf conditions carried directly on a raw object, via the existing (already-tested,
 * already-defensive) flat transform -- zero new per-field parsing. `expressionFromFlatFilter`
 * always returns its documented `{ op: 'AND', children }` shape (never a bare leaf); its return
 * type is the broader `FilterNode` union only because that's the shared return type every function
 * in this module uses. Anything the flat transform has to discard is reported as a caveat.
 */
function leafChildrenOf(raw: Record<string, unknown>, caveats: string[]): FilterNode[] {
  const flat = transformGeminiResponseToEventFilter(raw, (message) => pushCaveat(caveats, message));
  return (expressionFromFlatFilter(flat) as FilterGroupNode).children;
}

/** The node's operator, case-insensitively; `undefined` for a leaf-shaped node. An operator string
 * that is not AND/OR/NOT is reported and the node is then read as leaf-shaped. */
function operatorOf(raw: Record<string, unknown>, caveats: string[]): 'AND' | 'OR' | 'NOT' | undefined {
  if (typeof raw.op !== 'string' || raw.op.trim() === '') {
    return undefined;
  }
  const op = raw.op.trim().toUpperCase();
  if (op === 'AND' || op === 'OR' || op === 'NOT') {
    return op;
  }
  pushCaveat(caveats, UNKNOWN_OPERATOR_CAVEAT);
  return undefined;
}

/**
 * Converts one raw JSON value from Gemini's tree-shaped response into zero, one, or several
 * sibling `FilterNode`s (Story 9.4 AC2). Never returns a nested wrapper for a leaf position -- a
 * leaf-shaped raw object with 2+ populated fields expands into multiple sibling leaves, which the
 * caller joins with its own operator: spliced into an `AND` (same meaning), but wrapped in an
 * `AND` under an `OR`, where the fields of one object must stay together ("workshops in Sleman OR
 * concerts in Bantul" is two ANDs, not four alternatives -- Epic 9 review P4).
 */
function convertRawNode(raw: unknown, pushedCaveats: string[]): FilterNode[] {
  if (!isPlainObject(raw)) {
    return [];
  }

  const op = operatorOf(raw, pushedCaveats);

  if (op === 'AND' || op === 'OR') {
    const rawChildren = Array.isArray(raw.children) ? raw.children : [];
    // The response schema gives every level BOTH the group keys and all leaf fields, so Gemini
    // can emit leaf fields directly on a group node (e.g. `{ op: "AND", categories: [...],
    // location: {...} }` with no `children`). Those conditions are real -- keep them as extra
    // children of THAT group, joined by its own operator (literal reading: the model put them on
    // this node), instead of silently dropping them (SPEC CAP-2: surfaced, never dropped).
    const children = [
      ...rawChildren.flatMap((child) => {
        const converted = convertRawNode(child, pushedCaveats);
        return op === 'OR' && converted.length > 1 ? [{ op: 'AND' as const, children: converted }] : converted;
      }),
      ...leafChildrenOf(raw, pushedCaveats),
    ];
    if (children.length === 0) {
      return [];
    }
    return [{ op, children }];
  }

  if (op === 'NOT') {
    // The schema gives every level both `child` and `children`; accept a model that put its single
    // operand in `children` rather than silently dropping the negation.
    const operand =
      raw.child != null
        ? raw.child
        : Array.isArray(raw.children) && raw.children.length === 1
          ? raw.children[0]
          : undefined;
    if (operand === undefined && Array.isArray(raw.children) && raw.children.length > 1) {
      pushCaveat(pushedCaveats, INVALID_FRAGMENT_CAVEAT);
    }
    // Leaf fields written directly on the NOT node sit beside the negation, not inside it.
    const siblings = leafChildrenOf(raw, pushedCaveats);
    const results = convertRawNode(operand, pushedCaveats);
    if (results.length === 0) {
      // The negation itself is lost (no operand, or one that converts to nothing): say so, or the
      // user silently gets the positive, wider result.
      pushCaveat(pushedCaveats, INVALID_FRAGMENT_CAVEAT);
      return siblings;
    }
    const child: FilterNode = results.length === 1 ? results[0] : { op: 'AND', children: results };
    if (isFilterNotNode(child)) {
      // Structurally impossible from the schema's own shape (Task 4's bounded schema never emits
      // a `NOT` at a leaf position's immediate child) -- checked anyway since Gemini output is
      // untrusted (AC2).
      pushCaveat(pushedCaveats, DOUBLE_NEGATION_CAVEAT);
      return siblings;
    }
    return [{ op: 'NOT', child }, ...siblings];
  }

  // Leaf-shaped (no recognized `op`): reuse the existing, already-tested, already-defensive flat
  // transform + flat-to-expression conversion verbatim (Dev Notes decision 2) -- zero new
  // per-field parsing/validation logic.
  return leafChildrenOf(raw, pushedCaveats);
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
    root = normalize(
      expressionFromFlatFilter(
        transformGeminiResponseToEventFilter(payload.resolvedFilter, (message) => pushCaveat(pushedCaveats, message))
      )
    );
  } else if (isPlainObject(payload)) {
    // Neither `expression` nor `resolvedFilter`: the model answered with the flat v1 shape at the
    // top level (leaf fields + `caveats` side by side). Treat the payload itself as the node --
    // `caveats` is not a leaf field, so the flat transform ignores it.
    const siblings = convertRawNode(payload, pushedCaveats);
    root = normalize(
      siblings.length === 0 ? { op: 'AND', children: [] } : siblings.length === 1 ? siblings[0] : { op: 'AND', children: siblings }
    );
  } else {
    root = { op: 'AND', children: [] };
  }

  const repairCaveats: Record<RepairKind, string> = {
    invalid: INVALID_FRAGMENT_CAVEAT,
    'double-not': DOUBLE_NEGATION_CAVEAT,
    'too-complex': TOO_COMPLEX_CAVEAT,
    'weekday-window': WEEKDAY_WINDOW_CAVEAT,
  };
  const current = repairToValidTree(root, (kind) => pushCaveat(pushedCaveats, repairCaveats[kind]));

  const modelCaveats =
    isPlainObject(payload) && Array.isArray(payload.caveats)
      ? payload.caveats
          .filter((caveat): caveat is string => typeof caveat === 'string')
          .map((caveat) => caveat.trim())
          .filter((caveat) => caveat !== '')
      : [];

  // An empty filter that nobody explained is indistinguishable from "nothing happened" -- surface
  // it (SPEC CAP-2) instead of returning a silent no-filter result.
  if (isEmptyExpression(current) && modelCaveats.length === 0 && pushedCaveats.length === 0) {
    pushedCaveats.push(EMPTY_EXPRESSION_CAVEAT);
  }

  return {
    expression: current,
    caveats: [...modelCaveats, ...pushedCaveats],
  };
}
