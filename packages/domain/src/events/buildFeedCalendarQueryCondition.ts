import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

export interface BuildFeedCalendarQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  weekStart: string;
  weekEnd: string;
}

export function buildFeedCalendarQueryCondition({
  search,
  types,
  categories,
  weekStart,
  weekEnd,
}: BuildFeedCalendarQueryConditionInput): QueryCondition {
  const baseSubscribedCondition: QueryCondition = {
    field: 'isFromSubscribedAccount',
    operator: 'eq',
    value: true,
  };

  const filterCondition = buildEventsQueryCondition({ search, types, categories });

  let combinedCondition: QueryCondition;
  if (!filterCondition) {
    combinedCondition = {
      operator: 'and',
      conditions: [baseSubscribedCondition],
    };
  } else if (isGroupCondition(filterCondition)) {
    combinedCondition = {
      ...filterCondition,
      conditions: [baseSubscribedCondition, ...filterCondition.conditions],
    };
  } else {
    combinedCondition = {
      operator: 'and',
      conditions: [baseSubscribedCondition, filterCondition],
    };
  }

  if (!weekStart || !weekEnd) {
    return combinedCondition;
  }

  const overlapCondition: QueryCondition = {
    field: 'scheduleDateRange',
    operator: 'overlaps',
    value: { from: weekStart, to: weekEnd },
  };

  if (isGroupCondition(combinedCondition)) {
    return {
      ...combinedCondition,
      conditions: [...combinedCondition.conditions, overlapCondition],
    };
  }

  return {
    operator: 'and',
    conditions: [combinedCondition, overlapCondition],
  };
}
