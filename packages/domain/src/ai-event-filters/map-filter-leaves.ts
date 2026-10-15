import { isFilterGroupNode, isFilterLeaf, isFilterNotNode, type FilterLeaf, type FilterNode } from './filter-node.js';

/**
 * Shared, pure tree-editing primitive (Story 9.4 AC3): walks `node`, running every leaf through
 * `mapLeaf` (which may return the same leaf, a replaced leaf, or `undefined` to drop it), and
 * rebuilds the tree bottom-up, collapsing any group/`NOT` that would otherwise be left pointing at
 * nothing.
 *
 * - Leaf: return `mapLeaf(node)` directly.
 * - `NOT`: recurse into `child`; if the mapped child is `undefined`, drop the whole `NOT` (return
 *   `undefined`); otherwise return `{ op: 'NOT', child: mappedChild }`.
 * - `AND`/`OR`: recurse into every child, filter out `undefined` results; if zero children remain,
 *   return `undefined`; otherwise return `{ op: node.op, children: mappedChildren }`.
 *
 * Deliberately does NOT collapse a single remaining child into that child directly -- that is
 * `normalize()`'s job (called separately by every caller), matching `compile-filter-node.ts`'s
 * existing "normalize once, at the top, as an explicit separate call" convention.
 */
export function mapFilterLeaves(
  node: FilterNode,
  mapLeaf: (leaf: FilterLeaf) => FilterLeaf | undefined
): FilterNode | undefined {
  if (isFilterLeaf(node)) {
    return mapLeaf(node);
  }

  if (isFilterNotNode(node)) {
    const mappedChild = mapFilterLeaves(node.child, mapLeaf);
    if (mappedChild === undefined) {
      return undefined;
    }
    return { op: 'NOT', child: mappedChild };
  }

  if (isFilterGroupNode(node)) {
    const mappedChildren = node.children
      .map((child) => mapFilterLeaves(child, mapLeaf))
      .filter((child): child is FilterNode => child !== undefined);
    if (mappedChildren.length === 0) {
      return undefined;
    }
    return { op: node.op, children: mappedChildren };
  }

  return node;
}
