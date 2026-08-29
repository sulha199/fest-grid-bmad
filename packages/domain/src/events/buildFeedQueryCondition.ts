import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition, EventFilterInput } from './buildEventsQueryCondition.js';

export interface BuildFeedQueryConditionInput {
  search?: string;
  types?: string[];
  categories?: string[];
  subscriptions?: string[];
  filter?: EventFilterInput;
}

export function buildFeedQueryCondition({
  search,
  types,
  categories,
  subscriptions,
  filter,
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

  const filterCondition = filter
    ? buildEventsQueryCondition({ filter })
    : buildEventsQueryCondition({ search, types, categories });

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
