import {
  FILTER_NODE_MAX_DEPTH,
  FILTER_NODE_MAX_NODES,
  isFilterGroupNode,
  isFilterLeaf,
  isFilterNotNode,
  type FilterGroupNode,
  type FilterNode,
} from './filter-node.js';
import { exceedsPreflightBounds, FilterLeafSchema, findOversizedWeekdayWindow, validateFilterNode } from './filter-node-schema.js';
import { normalize } from './normalize-filter-node.js';

/**
 * Epic 9 review (P2, P3, P7) -- the "degrade node by node" primitives shared by every producer of
 * a `FilterNode` that must NEVER throw or loop on bad input: the Gemini transform (untrusted model
 * output) and `resolveStoredFilter` (persisted rows that predate a stricter schema).
 *
 * Every function returns the repaired tree plus how many nodes it had to drop, so the caller can
 * attach one honest caveat instead of silently returning a wider filter (SPEC CAP-2).
 *
 * A dropped node inside a `NOT` voids the whole `NOT`: removing part of what is being negated
 * would change what is excluded (`NOT(a AND b)` is not `NOT(a)`), so the only safe repair is to
 * drop the negation as a unit.
 */
export interface SanitizeResult {
  node: FilterNode | undefined;
  dropped: number;
}

type Candidate = Record<string, unknown>;

function isCandidate(value: unknown): value is Candidate {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeCandidate(raw: unknown, counter: { dropped: number }): FilterNode | undefined {
  if (!isCandidate(raw)) {
    counter.dropped += 1;
    return undefined;
  }

  if (raw.op === 'AND' || raw.op === 'OR') {
    const rawChildren = Array.isArray(raw.children) ? raw.children : [];
    if (!Array.isArray(raw.children)) {
      counter.dropped += 1;
    }
    const children = rawChildren
      .map((child) => sanitizeCandidate(child, counter))
      .filter((child): child is FilterNode => child !== undefined);
    return children.length === 0 ? undefined : { op: raw.op, children };
  }

  if (raw.op === 'NOT') {
    const before = counter.dropped;
    const child = sanitizeCandidate(raw.child, counter);
    // Part of the negated operand was unusable: keep no negation at all. (A NOT directly over a NOT
    // is left for `dropDoubleNots`, which reports it with its own caveat.)
    return child !== undefined && counter.dropped === before ? { op: 'NOT', child } : undefined;
  }

  if ('op' in raw || !('field' in raw)) {
    counter.dropped += 1;
    return undefined;
  }

  const parsed = FilterLeafSchema.safeParse(raw);
  if (!parsed.success) {
    counter.dropped += 1;
    return undefined;
  }
  return parsed.data;
}

/**
 * Drops every node of `raw` (an untrusted / stored candidate, already null-stripped) that is not a
 * valid leaf, group or `NOT`, and every group left empty. A tree far beyond the size bounds is
 * rejected outright (nothing is salvaged from a hostile or corrupt payload).
 */
export function dropInvalidNodes(raw: unknown): SanitizeResult {
  if (exceedsPreflightBounds(raw)) {
    return { node: undefined, dropped: 1 };
  }
  const counter = { dropped: 0 };
  const node = sanitizeCandidate(raw, counter);
  return { node, dropped: counter.dropped };
}

/** Removes a `NOT` whose immediate child is another `NOT` (the validator forbids it; `normalize()`
 * can create one by collapsing a single-child group between two negations). */
export function dropDoubleNots(node: FilterNode): SanitizeResult {
  const counter = { dropped: 0 };
  function visit(current: FilterNode): FilterNode | undefined {
    if (isFilterNotNode(current)) {
      if (isFilterNotNode(current.child)) {
        counter.dropped += 1;
        return undefined;
      }
      const before = counter.dropped;
      const child = visit(current.child);
      if (child === undefined || counter.dropped !== before) {
        return undefined;
      }
      return { op: 'NOT', child };
    }
    if (isFilterGroupNode(current)) {
      const children = current.children.map(visit).filter((child): child is FilterNode => child !== undefined);
      return children.length === 0 ? undefined : { op: current.op, children };
    }
    return current;
  }
  return { node: visit(node), dropped: counter.dropped };
}

/**
 * Drops every subtree that would sit deeper than `FILTER_NODE_MAX_DEPTH` (the root is depth 1, a
 * leaf counts as a level). A group or `NOT` at the last allowed level has no room for children, so
 * it goes; partial pruning of a `NOT` voids the `NOT`.
 */
export function fitToMaxDepth(node: FilterNode, depth = 1): SanitizeResult {
  const counter = { dropped: 0 };
  function visit(current: FilterNode, level: number): FilterNode | undefined {
    if (level > FILTER_NODE_MAX_DEPTH) {
      counter.dropped += 1;
      return undefined;
    }
    if (isFilterNotNode(current)) {
      const before = counter.dropped;
      const child = visit(current.child, level + 1);
      return child !== undefined && counter.dropped === before ? { op: 'NOT', child } : undefined;
    }
    if (isFilterGroupNode(current)) {
      const children = current.children
        .map((child) => visit(child, level + 1))
        .filter((child): child is FilterNode => child !== undefined);
      return children.length === 0 ? undefined : { op: current.op, children };
    }
    return current;
  }
  return { node: visit(node, depth), dropped: counter.dropped };
}

/**
 * Drops the `dayOfWeek` leaf from every AND group whose date range x weekdays would expand past the
 * term limit (Epic 9 review P17). The date range is kept, so the result is a superset of what was
 * asked for -- reported through the caller's caveat rather than refused outright.
 *
 * Inside a `NOT` that "superset" is the wrong direction: `NOT(range AND weekdays)` becoming
 * `NOT(range)` would exclude the whole range. A window repaired anywhere under a `NOT` therefore
 * voids that `NOT` instead (counted in `voidedNots`, not `dropped`), like every other repair here.
 */
export function fitWeekdayWindows(node: FilterNode): SanitizeResult & { voidedNots: number } {
  let dropped = 0;
  let voidedNots = 0;
  function visit(current: FilterNode): FilterNode | undefined {
    if (isFilterNotNode(current)) {
      const before = dropped;
      const child = visit(current.child);
      if (child === undefined || dropped !== before) {
        dropped = before;
        voidedNots += 1;
        return undefined;
      }
      return { op: 'NOT', child };
    }
    if (isFilterGroupNode(current)) {
      let children = current.children.map(visit).filter((child): child is FilterNode => child !== undefined);
      if (current.op === 'AND' && findOversizedWeekdayWindow(children) !== undefined) {
        children = children.filter((child) => !(isFilterLeaf(child) && child.field === 'dayOfWeek'));
        dropped += 1;
      }
      return children.length === 0 ? undefined : { op: current.op, children };
    }
    return current;
  }
  return { node: visit(node), dropped, voidedNots };
}

function countNodes(node: FilterNode): number {
  if (isFilterGroupNode(node)) {
    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
  }
  if (isFilterNotNode(node)) {
    return 1 + countNodes(node.child);
  }
  return 1;
}

/** The widest group that may be trimmed: one under a `NOT` may not (trimming what is negated
 * changes what is excluded), so those are never candidates. */
function findWidestGroup(node: FilterNode): FilterGroupNode | undefined {
  let best: FilterGroupNode | undefined;
  function visit(current: FilterNode): void {
    if (isFilterGroupNode(current)) {
      if (!best || current.children.length > best.children.length) {
        best = current;
      }
      current.children.forEach(visit);
    }
    // A `NOT` is not descended into: nothing beneath it is a trim candidate.
  }
  visit(node);
  return best;
}

function dropLastChildOf(node: FilterNode, target: FilterGroupNode): FilterNode {
  if ((node as FilterNode) === (target as FilterNode)) {
    return { op: target.op, children: target.children.slice(0, -1) };
  }
  if (isFilterGroupNode(node)) {
    return { op: node.op, children: node.children.map((child) => dropLastChildOf(child, target)) };
  }
  return node;
}

/**
 * Trims a tree over `FILTER_NODE_MAX_NODES` by repeatedly removing the last child of its widest
 * group that is not under a `NOT` -- trimming inside a `NOT` would change what is excluded. A group
 * root is always such a candidate, so the only tree with nothing left to trim is a bare `NOT` root:
 * that is given up on as a unit (`node: undefined`). Always terminates: each pass strictly shrinks
 * the tree.
 */
export function fitToMaxNodes(node: FilterNode): SanitizeResult {
  let current = node;
  let dropped = 0;
  while (countNodes(current) > FILTER_NODE_MAX_NODES) {
    const widest = findWidestGroup(current);
    if (!widest || widest.children.length === 0) {
      return { node: undefined, dropped: dropped + 1 };
    }
    current = dropLastChildOf(current, widest);
    dropped += 1;
  }
  return { node: current, dropped };
}

export type RepairKind = 'invalid' | 'double-not' | 'too-complex' | 'weekday-window';

/**
 * Repairs `root` (a typed tree, e.g. built from model output or a legacy flat row) until it is a
 * tree `validateFilterNode` accepts, dropping what cannot be kept and calling `onRepair` once per
 * kind of repair made. Never throws and never loops: each step is a single bounded pass, and a tree
 * that is somehow still invalid at the end degrades to the empty expression rather than escaping.
 */
export function repairToValidTree(root: FilterNode, onRepair: (kind: RepairKind) => void): FilterNode {
  const empty: FilterNode = { op: 'AND', children: [] };
  if (isFilterGroupNode(root) && root.op === 'AND' && root.children.length === 0) {
    return root;
  }

  // 1. Leaves the schema rejects (a radius of 0, an out-of-range coordinate, ...).
  const valid = dropInvalidNodes(root);
  if (valid.dropped > 0) {
    onRepair('invalid');
  }
  if (!valid.node) {
    return empty;
  }
  let current = normalize(valid.node);

  // 2. `normalize` can bring two negations together (NOT over a single-child group over a NOT).
  const undoubled = dropDoubleNots(current);
  if (undoubled.dropped > 0) {
    onRepair('double-not');
  }
  if (!undoubled.node) {
    return empty;
  }
  current = normalize(undoubled.node);

  // 3. Depth: e.g. `NOT` over a multi-field leaf nested in a group becomes NOT(AND(...)), one level
  //    deeper than the response schema's own three levels allow.
  const shallow = fitToMaxDepth(current);
  if (shallow.dropped > 0) {
    onRepair('too-complex');
  }
  if (!shallow.node) {
    return empty;
  }
  current = normalize(shallow.node);

  // 3b. A date range x weekdays combination that would expand into too many query terms.
  const windowed = fitWeekdayWindows(current);
  if (windowed.dropped > 0) {
    onRepair('weekday-window');
  }
  if (windowed.voidedNots > 0) {
    onRepair('too-complex');
  }
  if (!windowed.node) {
    return empty;
  }
  current = normalize(windowed.node);

  // 4. Node count.
  const small = fitToMaxNodes(current);
  if (small.dropped > 0) {
    onRepair('too-complex');
  }
  if (!small.node) {
    return empty;
  }
  current = normalize(small.node);

  // Belt and braces: whatever slipped through every repair above is not worth throwing over.
  if (!validateFilterNode(current).valid) {
    onRepair('invalid');
    return empty;
  }
  return current;
}
