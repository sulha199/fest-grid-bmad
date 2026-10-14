import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition, EventFilterInput } from './buildEventsQueryCondition.js';
import { compileFilterNodeToQueryCondition } from '../ai-event-filters/compile-filter-node.js';
import type { FilterNode } from '../ai-event-filters/filter-node.js';

export interface BuildAccountEventsQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  profileId: string;
  /**
   * Story 9.3 (AC3) -- mirrors `buildFeedQueryCondition`'s `expression` addition: an alternative,
   * expression-shaped source for the same concern as a flat filter. This pure domain function
   * does not itself re-validate; the caller (the resolver) decides which source to pass, having
   * already validated upstream.
   */
  expression?: FilterNode;
  temporalFilter?: EventFilterInput['temporalFilter'];
}

export function buildAccountEventsQueryCondition({
  search,
  types,
  categories,
  profileId,
  expression,
  temporalFilter,
}: BuildAccountEventsQueryConditionInput): QueryCondition {
  const baseConditions: QueryCondition[] = [
    {
      field: 'socialMediaAccountProfileId',
      operator: 'in',
      value: [profileId],
    },
  ];

  const filterCondition = expression
    ? compileFilterNodeToQueryCondition(expression)
    : buildEventsQueryCondition({ search, types, categories, temporalFilter });

  if (!filterCondition) {
    return {
      operator: 'and',
      conditions: baseConditions,
    };
  }

  if (isGroupCondition(filterCondition)) {
    return {
      ...filterCondition,
      conditions: [...baseConditions, ...filterCondition.conditions],
    };
  }

  return {
    operator: 'and',
    conditions: [...baseConditions, filterCondition],
  };
}
