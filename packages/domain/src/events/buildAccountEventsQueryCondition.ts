import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition, EventFilterInput } from './buildEventsQueryCondition.js';

export interface BuildAccountEventsQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  profileId: string;
  temporalFilter?: EventFilterInput['temporalFilter'];
}

export function buildAccountEventsQueryCondition({
  search,
  types,
  categories,
  profileId,
  temporalFilter,
}: BuildAccountEventsQueryConditionInput): QueryCondition {
  const baseConditions: QueryCondition[] = [
    {
      field: 'socialMediaAccountProfileId',
      operator: 'in',
      value: [profileId],
    },
  ];

  const filterCondition = buildEventsQueryCondition({ search, types, categories, temporalFilter });

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
