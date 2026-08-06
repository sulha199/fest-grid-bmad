import { QueryCondition } from '../query/queryDsl.js';

export interface BuildMyCalendarQueryConditionInput {
  weekStart: string;
  weekEnd: string;
}

export function buildMyCalendarQueryCondition({
  weekStart,
  weekEnd,
}: BuildMyCalendarQueryConditionInput): QueryCondition {
  const personalizationCondition: QueryCondition = {
    operator: 'or',
    conditions: [
      { field: 'isFavorited', operator: 'eq', value: true },
      { field: 'isAddedToCalendar', operator: 'eq', value: true },
    ],
  };

  const overlapCondition: QueryCondition = {
    field: 'scheduleDateRange',
    operator: 'overlaps',
    value: { from: weekStart, to: weekEnd },
  };

  return {
    operator: 'and',
    conditions: [personalizationCondition, overlapCondition],
  };
}
