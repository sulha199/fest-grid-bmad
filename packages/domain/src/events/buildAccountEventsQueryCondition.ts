import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

export interface BuildAccountEventsQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  profileId: string;
}

export function buildAccountEventsQueryCondition({
  search,
  types,
  categories,
  profileId,
}: BuildAccountEventsQueryConditionInput): QueryCondition {
  const baseConditions: QueryCondition[] = [
    {
      field: 'socialMediaAccountProfileId',
      operator: 'in',
      value: [profileId],
    },
  ];

  const filterCondition = buildEventsQueryCondition({ search, types, categories });

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
