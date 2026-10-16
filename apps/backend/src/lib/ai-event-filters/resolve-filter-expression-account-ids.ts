import {
  isFilterGroupNode,
  isFilterLeaf,
  isFilterNotNode,
  mapFilterLeaves,
  normalize,
  type FilterNode,
} from '@festgrid/domain/ai-event-filters';
import { resolveFilterAccountId } from './resolve-filter-account-id.js';

function collectAccountIdValues(node: FilterNode, values: Set<string>): void {
  if (isFilterLeaf(node)) {
    if (node.field === 'accountId') {
      values.add(node.value);
    }
    return;
  }
  if (isFilterNotNode(node)) {
    collectAccountIdValues(node.child, values);
    return;
  }
  if (isFilterGroupNode(node)) {
    node.children.forEach((child) => collectAccountIdValues(child, values));
  }
}

/**
 * Walks `node` for every `field: 'accountId'` leaf, resolving each distinct raw value via the
 * existing `resolveFilterAccountId` (unchanged, IDEA-065), replacing resolved leaves in place and
 * dropping unresolved ones with the existing caveat wording (Story 9.4 AC3). Skips the DB round
 * trip entirely when no `accountId` leaf is present.
 */
export async function resolveFilterExpressionAccountIds(
  node: FilterNode,
  userId: string
): Promise<{ expression: FilterNode; caveats: string[] }> {
  const rawValues = new Set<string>();
  collectAccountIdValues(node, rawValues);

  if (rawValues.size === 0) {
    return { expression: node, caveats: [] };
  }

  const resolvedEntries = await Promise.all(
    Array.from(rawValues).map(async (value) => [value, await resolveFilterAccountId(userId, value)] as const)
  );
  const resolvedMap = new Map<string, string | null>(resolvedEntries);

  const caveats: string[] = [];
  const mapped = mapFilterLeaves(node, (leaf) => {
    if (leaf.field !== 'accountId') {
      return leaf;
    }
    const resolved = resolvedMap.get(leaf.value);
    if (resolved) {
      return { field: 'accountId', value: resolved };
    }
    caveats.push(`Could not find an account matching "${leaf.value}", so events from all accounts are shown.`);
    return undefined;
  });

  const expression = normalize(mapped ?? { op: 'AND', children: [] });
  return { expression, caveats };
}
