import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { scopeFilterCondition } from './scope-filter-condition.js';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

export interface BuildAccountCalendarQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  weekStart: string;
  weekEnd: string;
  profileId: string;
}

export function buildAccountCalendarQueryCondition({
  search,
  types,
  categories,
  weekStart,
  weekEnd,
  profileId,
}: BuildAccountCalendarQueryConditionInput): QueryCondition {
  const baseConditions: QueryCondition[] = [
    {
      field: 'socialMediaAccountProfileId',
      operator: 'in',
      value: [profileId],
    },
  ];

  const filterCondition = buildEventsQueryCondition({ search, types, categories });

  const combinedCondition = scopeFilterCondition(baseConditions, filterCondition);

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

  /* c8 ignore start -- defensive: `combinedCondition` is always a group built above, so the
     `isGroupCondition` guard above always returns; kept for `QueryCondition` exhaustiveness. */
  return {
    operator: 'and',
    conditions: [combinedCondition, overlapCondition],
  };
  /* c8 ignore stop */
}
