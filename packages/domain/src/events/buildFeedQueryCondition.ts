import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

export interface BuildFeedQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
}

export function buildFeedQueryCondition({
  search,
  types,
  categories,
}: BuildFeedQueryConditionInput): QueryCondition {
  const baseSubscribedCondition: QueryCondition = {
    field: 'isFromSubscribedAccount',
    operator: 'eq',
    value: true,
  };

  const filterCondition = buildEventsQueryCondition({ search, types, categories });

  if (!filterCondition) {
    return {
      operator: 'and',
      conditions: [baseSubscribedCondition],
    };
  }

  if (isGroupCondition(filterCondition)) {
    return {
      ...filterCondition,
      conditions: [baseSubscribedCondition, ...filterCondition.conditions],
    };
  }

  return {
    operator: 'and',
    conditions: [baseSubscribedCondition, filterCondition],
  };
}
