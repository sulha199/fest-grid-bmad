import type { EventFilterInput } from '../events/buildEventsQueryCondition.js';
import { expressionFromFlatFilter, flatFilterFromExpression } from './flat-filter-conversion.js';
import { exceedsPreflightBounds, stripNullNodeKeys, validateFilterNode } from './filter-node-schema.js';
import type { FilterNode } from './filter-node.js';
import { dropInvalidNodes, repairToValidTree } from './sanitize-filter-node.js';

export interface ResolvedStoredFilter {
  expression: FilterNode;
  flatFilter: EventFilterInput | null;
  /** True when the stored value no longer passed validation and was repaired by dropping its
   * unusable parts (or replaced by "no filter"); callers may want to log it. */
  degraded?: boolean;
}

/**
 * Story 9.3 (AC2) -- normalizes a persisted `ai_event_filters.resolved_filter`/`widgets.filters`
 * jsonb value (either the legacy flat `EventFilterInput` shape, or the new versioned
 * `{version: 2, expression: FilterNode}` shape) into a validated `FilterNode` plus a best-effort
 * flat projection. This is the single shared read path both `AIEventFilter`/`Widget`'s
 * `resolvedFilter`/`filters`/`expression` field resolvers route through, replacing the previous
 * `parent.filters as any` cast with real, enforced validation (Dev Notes decision 4/5/6).
 *
 * Never throws (Epic 9 review P7): the stored value is already-persisted application data that may
 * predate a stricter schema (a `radiusMeters` of 0, a removed enum value, a null span), and one such
 * row must not fail the whole `myAIEventFilters`/`myWidgets` list. A value that no longer validates
 * is repaired by dropping its unusable parts -- or, if nothing usable is left, "no filter" -- and
 * flagged `degraded`.
 */
export function resolveStoredFilter(stored: unknown): ResolvedStoredFilter {
  const isV2 =
    typeof stored === 'object' && stored !== null && (stored as { version?: unknown }).version === 2;

  // A v2 row may have been saved from a null-padded GraphQL `FilterNode` response before
  // `validateFilterNode` began normalizing it, so tolerate (and clean) that stored shape too.
  let candidate: unknown;
  try {
    candidate = stripNullNodeKeys(
      isV2 ? (stored as { expression: unknown }).expression : expressionFromFlatFilter((stored as EventFilterInput) ?? {})
    );
  } catch {
    return { expression: { op: 'AND', children: [] }, flatFilter: {}, degraded: true };
  }

  // An empty top-level AND group (no leaves -- an absent/empty legacy value, or an explicitly
  // empty v2 expression) is a legitimate "no filter active" state, not a malformed tree --
  // `validateFilterNode`'s empty-group rule (Story 9.1a) exists to catch an authored/compiled
  // tree with a genuinely empty branch, not this degenerate root case, so it is special-cased
  // here rather than loosened upstream (out of this story's scope).
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate as { op?: unknown }).op === 'AND' &&
    Array.isArray((candidate as { children?: unknown }).children) &&
    (candidate as { children: unknown[] }).children.length === 0
  ) {
    return { expression: candidate as FilterNode, flatFilter: {} };
  }

  const validation = validateFilterNode(candidate);
  if (!validation.valid) {
    return degradeStoredFilter(candidate);
  }

  return { expression: validation.node, flatFilter: flatFilterOrNull(validation.node) };
}

function flatFilterOrNull(expression: FilterNode): EventFilterInput | null {
  try {
    return flatFilterFromExpression(expression);
  } catch {
    return null;
  }
}

function degradeStoredFilter(candidate: unknown): ResolvedStoredFilter {
  const empty: FilterNode = { op: 'AND', children: [] };
  const exceeded = exceedsPreflightBounds(candidate);
  const kept = exceeded ? { node: undefined } : dropInvalidNodes(candidate);
  const repaired = kept.node ? repairToValidTree(kept.node, () => undefined) : empty;
  const validation = validateFilterNode(repaired);
  const expression = validation.valid ? validation.node : empty;
  // A valid tree never has an empty group, so "empty" is exactly the fallback above.
  const isEmpty = expression === empty;
  return { expression, flatFilter: isEmpty ? {} : flatFilterOrNull(expression), degraded: true };
}
