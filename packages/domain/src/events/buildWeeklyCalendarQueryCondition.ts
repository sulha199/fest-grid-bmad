import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

export interface BuildWeeklyCalendarQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  weekStart: string;
  weekEnd: string;
}

export function buildWeeklyCalendarQueryCondition({
  search,
  types,
  categories,
  weekStart,
  weekEnd,
}: BuildWeeklyCalendarQueryConditionInput): QueryCondition {
  const baseCondition = buildEventsQueryCondition({ search, types, categories });

  if (!weekStart || !weekEnd) {
    return baseCondition || {
      operator: 'and',
      conditions: [],
    };
  }

  const overlapCondition: QueryCondition = {
    field: 'scheduleDateRange',
    operator: 'overlaps',
    value: { from: weekStart, to: weekEnd },
  };

  if (!baseCondition) {
    return {
      operator: 'and',
      conditions: [overlapCondition],
    };
  }

  if (isGroupCondition(baseCondition)) {
    return {
      ...baseCondition,
      conditions: [...baseCondition.conditions, overlapCondition],
    };
  }

  return {
    operator: 'and',
    conditions: [baseCondition, overlapCondition],
  };
}
