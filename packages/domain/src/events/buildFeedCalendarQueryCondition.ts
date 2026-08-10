import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

export interface BuildFeedCalendarQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  weekStart: string;
  weekEnd: string;
  subscriptions?: string[];
}

export function buildFeedCalendarQueryCondition({
  search,
  types,
  categories,
  weekStart,
  weekEnd,
  subscriptions,
}: BuildFeedCalendarQueryConditionInput): QueryCondition {
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

  const filterCondition = buildEventsQueryCondition({ search, types, categories });

  let combinedCondition: QueryCondition;
  if (!filterCondition) {
    combinedCondition = {
      operator: 'and',
      conditions: baseConditions,
    };
  } else if (isGroupCondition(filterCondition)) {
    combinedCondition = {
      ...filterCondition,
      conditions: [...baseConditions, ...filterCondition.conditions],
    };
  } else {
    combinedCondition = {
      operator: 'and',
      conditions: [...baseConditions, filterCondition],
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
