import { QueryCondition } from '../query/queryDsl.js';
import { scopeFilterCondition } from './scope-filter-condition.js';
import { buildEventsQueryCondition, EventFilterInput, NearbyFilterInput } from './buildEventsQueryCondition.js';
import { compileFilterNodeToQueryCondition } from '../ai-event-filters/compile-filter-node.js';
import type { FilterNode } from '../ai-event-filters/filter-node.js';

export interface BuildFeedQueryConditionInput {
  search?: string;
  types?: string[];
  categories?: string[];
  subscriptions?: string[];
  nearby?: NearbyFilterInput;
  filter?: EventFilterInput;
  /**
   * Story 9.3 (AC3) -- an alternative, expression-shaped source for the same concern as `filter`.
   * Supplying both `filter` and `expression` in the same call is a caller error (matching AC1's
   * resolver-level mutual-exclusivity rule); this pure domain function documents that expectation
   * but does not itself re-validate -- it only reads whichever of the two the caller actually
   * set. The caller (the resolver) decides which to pass, having already validated upstream.
   */
  expression?: FilterNode;
  temporalFilter?: EventFilterInput['temporalFilter'];
}

export function buildFeedQueryCondition({
  search,
  types,
  categories,
  subscriptions,
  nearby,
  filter,
  expression,
  temporalFilter,
}: BuildFeedQueryConditionInput): QueryCondition {
  const baseConditions: QueryCondition[] = [
    {
      field: 'isFromSubscribedAccount',
      operator: 'eq',
      value: true,
    },
  ];

  if (subscriptions && subscriptions.length > 0) {
    baseConditions.push({
      field: 'socialMediaAccountProfileId',
      operator: 'in',
      value: subscriptions,
    });
  }

  const filterCondition = expression
    ? compileFilterNodeToQueryCondition(expression)
    : filter
      ? buildEventsQueryCondition({ filter: { ...filter, temporalFilter: temporalFilter ?? filter.temporalFilter } })
      : buildEventsQueryCondition({ search, types, categories, nearby, temporalFilter });

  return scopeFilterCondition(baseConditions, filterCondition);
}
