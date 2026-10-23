import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';
import { buildEventsQueryCondition, NearbyFilterInput } from './buildEventsQueryCondition.js';

export interface BuildWeeklyCalendarQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  weekStart: string;
  weekEnd: string;
  nearby?: NearbyFilterInput;
}

export function buildWeeklyCalendarQueryCondition({
  search,
  types,
  categories,
  weekStart,
  weekEnd,
  nearby,
}: BuildWeeklyCalendarQueryConditionInput): QueryCondition {
  const baseCondition = buildEventsQueryCondition({ search, types, categories, nearby });

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

  /* c8 ignore start -- defensive: `buildEventsQueryCondition` (without `expression`) only ever
     returns an `and` group or `undefined`, so a bare terminal `baseCondition` cannot occur; this
     fallback exists to keep the `QueryCondition` union exhaustive. */
  return {
    operator: 'and',
    conditions: [baseCondition, overlapCondition],
  };
  /* c8 ignore stop */
}
