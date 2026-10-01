import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition, EventFilterInput, NearbyFilterInput } from './buildEventsQueryCondition.js';

export interface BuildFeedQueryConditionInput {
  search?: string;
  types?: string[];
  categories?: string[];
  subscriptions?: string[];
  nearby?: NearbyFilterInput;
  filter?: EventFilterInput;
}

export function buildFeedQueryCondition({
  search,
  types,
  categories,
  subscriptions,
  nearby,
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
    : buildEventsQueryCondition({ search, types, categories, nearby });

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
