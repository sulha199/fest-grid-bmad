import { isFilterGroupNode, isFilterLeaf, isFilterNotNode, type FilterNode } from './filter-node.js';

/**
 * Stable, order-sensitive canonical string for deep-equality comparison of plain JSON-like
 * values (object keys sorted recursively; array order preserved, since array order is
 * significant for a leaf's `value`, e.g. `type: [A, B]` is not the same leaf as `type: [B, A]`).
 */
function canonicalKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalKey).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalKey((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Normalizes a `FilterNode` bottom-up (Story 9.1a AC2):
 * - nested same-operator `AND`/`OR` groups are flattened (an `AND` nested inside an `OR`, or vice
 *   versa, is never flattened into its parent);
 * - an `AND`/`OR` group left with exactly one child after flattening/dedup collapses to that
 *   child directly;
 * - duplicate leaves within the same group (deep-equal `FilterLeaf` values) are deduplicated.
 *
 * Each step normalizes children first, so a single pass is already fixpoint-stable --
 * `normalize(normalize(x))` deep-equals `normalize(x)` for every case above, idempotence
 * included.
 */
export function normalize(node: FilterNode): FilterNode {
  if (isFilterLeaf(node)) {
    return node;
  }

  if (isFilterNotNode(node)) {
    return { op: 'NOT', child: normalize(node.child) };
  }

  // AND/OR group.
  const normalizedChildren = node.children.map(normalize);

  // Flatten: a normalized child that is itself a same-op group splices its (already-flat, by
  // induction) children directly into this level. A different-op group, a NOT, or a leaf passes
  // through untouched.
  const flattened: FilterNode[] = [];
  for (const child of normalizedChildren) {
    if (isFilterGroupNode(child) && child.op === node.op) {
      flattened.push(...child.children);
    } else {
      flattened.push(child);
    }
  }

  // Dedup: only duplicate *leaves* are collapsed (AC2) -- duplicate groups/NOT nodes, if any,
  // are left as-is.
  const seenLeafKeys = new Set<string>();
  const deduped: FilterNode[] = [];
  for (const child of flattened) {
    if (isFilterLeaf(child)) {
      const key = canonicalKey(child);
      if (seenLeafKeys.has(key)) continue;
      seenLeafKeys.add(key);
    }
    deduped.push(child);
  }

  if (deduped.length === 1) {
    return deduped[0];
  }

  return { op: node.op, children: deduped };
}
