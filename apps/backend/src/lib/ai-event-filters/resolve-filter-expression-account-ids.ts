import {
  isFilterGroupNode,
  isFilterLeaf,
  isFilterNotNode,
  mapFilterLeaves,
  normalize,
  type FilterNode,
} from '@festgrid/domain/ai-event-filters';
import { resolveFilterAccountId } from './resolve-filter-account-id.js';

/** A profile id no row can have: the stand-in for an account that could not be resolved, where
 * dropping the leaf would be wrong (inside an OR / NOT). */
const NO_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

const IMPOSSIBLE: FilterNode = { field: 'accountId', value: NO_ACCOUNT_ID };

function isImpossible(node: FilterNode): boolean {
  return isFilterLeaf(node) && node.field === 'accountId' && node.value === NO_ACCOUNT_ID;
}

/** Folds the never-matching stand-in through AND / OR: `AND(x, impossible)` is impossible, and
 * `OR(x, impossible)` is just `x` (an OR of only impossible branches is impossible). `NOT` is left
 * for the query, which evaluates `NOT(impossible)` exactly. */
function simplifyImpossible(node: FilterNode): FilterNode {
  if (isFilterNotNode(node)) {
    return { op: 'NOT', child: simplifyImpossible(node.child) };
  }
  if (isFilterGroupNode(node)) {
    const children = node.children.map(simplifyImpossible);
    if (node.op === 'AND') {
      return children.some(isImpossible) ? IMPOSSIBLE : { op: 'AND', children };
    }
    const possible = children.filter((child) => !isImpossible(child));
    return possible.length > 0 ? { op: 'OR', children: possible } : IMPOSSIBLE;
  }
  return node;
}

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
  const addCaveat = (message: string): void => {
    if (!caveats.includes(message)) {
      caveats.push(message);
    }
  };
  const mapped = mapFilterLeaves(node, (leaf, context) => {
    if (leaf.field !== 'accountId') {
      return leaf;
    }
    const resolved = resolvedMap.get(leaf.value);
    if (resolved) {
      return { field: 'accountId', value: resolved };
    }
    if (context.insideOrOrNot) {
      // An account that does not exist matches no events. Inside an OR / NOT, merely dropping the
      // leaf would change what the operator means, so keep an impossible leaf instead (pruned out
      // of ORs below; evaluated exactly by the query everywhere else).
      addCaveat(`Could not find an account matching "${leaf.value}", so that part of your filter matches no events.`);
      return { field: 'accountId', value: NO_ACCOUNT_ID };
    }
    addCaveat(`Could not find an account matching "${leaf.value}", so events from all accounts are shown.`);
    return undefined;
  });

  const expression = normalize(mapped ? simplifyImpossible(mapped) : { op: 'AND', children: [] });
  return { expression, caveats };
}
