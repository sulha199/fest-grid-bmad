import { isFilterGroupNode, isFilterNotNode, type FilterLeaf, type FilterNode } from './filter-node.js';

/**
 * Where a leaf sits, for callers whose repair depends on polarity (Epic 9 review, D3): dropping a
 * conjunct of an `AND` just relaxes it, but inside an `OR` or a `NOT` the same drop changes what
 * the surrounding operator means.
 */
export interface MapFilterLeafContext {
  /** True once any ancestor of the leaf is an `OR` or a `NOT`. */
  insideOrOrNot: boolean;
}

/**
 * Shared, pure tree-editing primitive (Story 9.4 AC3): walks `node`, running every leaf through
 * `mapLeaf` (which may return the same leaf, a replaced leaf, or `undefined` to drop it), and
 * rebuilds the tree bottom-up, collapsing any group/`NOT` that would otherwise be left pointing at
 * nothing.
 *
 * - Leaf: return `mapLeaf(node, context)` directly.
 * - `NOT`: recurse into `child`; if the mapped child is `undefined`, OR anything at all was dropped
 *   beneath it, drop the whole `NOT` (return `undefined`) -- removing part of what is negated would
 *   change what is excluded (`NOT(a AND b)` is not `NOT(a)`). Otherwise `{ op: 'NOT', child }`.
 * - `AND`/`OR`: recurse into every child, filter out `undefined` results; if zero children remain,
 *   return `undefined`; otherwise return `{ op: node.op, children: mappedChildren }`.
 *
 * Deliberately does NOT collapse a single remaining child into that child directly -- that is
 * `normalize()`'s job (called separately by every caller), matching `compile-filter-node.ts`'s
 * existing "normalize once, at the top, as an explicit separate call" convention.
 */
export function mapFilterLeaves(
  node: FilterNode,
  mapLeaf: (leaf: FilterLeaf, context: MapFilterLeafContext) => FilterLeaf | undefined
): FilterNode | undefined {
  let dropped = 0;

  function visit(current: FilterNode, insideOrOrNot: boolean): FilterNode | undefined {
    if (isFilterGroupNode(current)) {
      const childContext = insideOrOrNot || current.op === 'OR';
      const mappedChildren = current.children
        .map((child) => visit(child, childContext))
        .filter((child): child is FilterNode => child !== undefined);
      if (mappedChildren.length === 0) {
        return undefined;
      }
      return { op: current.op, children: mappedChildren };
    }

    if (isFilterNotNode(current)) {
      const droppedBefore = dropped;
      const mappedChild = visit(current.child, true);
      if (mappedChild === undefined || dropped !== droppedBefore) {
        return undefined;
      }
      return { op: 'NOT', child: mappedChild };
    }

    // Neither a group nor a `NOT` -- by `FilterNode`'s own union, this is a `FilterLeaf`.
    const mapped = mapLeaf(current, { insideOrOrNot });
    if (mapped === undefined) {
      dropped += 1;
    }
    return mapped;
  }

  return visit(node, false);
}
