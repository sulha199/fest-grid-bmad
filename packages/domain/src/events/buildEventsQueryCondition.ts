import { QueryCondition } from '../query/queryDsl.js';

export type NearbyFilterInput =
  | { locationPreferenceId: string; radiusKm: number }
  | { latitude: number; longitude: number; radiusKm: number };

export interface BuildEventsQueryConditionInput {
  search: string;
  types: string[];
  categories: string[];
  nearby?: NearbyFilterInput;
}

export function buildEventsQueryCondition({
  search,
  types,
  categories,
  nearby,
}: BuildEventsQueryConditionInput): QueryCondition | undefined {
  const conditions: QueryCondition[] = [];

  if (search.trim()) {
    conditions.push({
      operator: 'or',
      conditions: [
        { field: 'eventName', operator: 'contains', value: search },
        { field: 'performers', operator: 'contains', value: search },
        { field: 'location', operator: 'contains', value: search },
      ],
    });
  }

  if (types.length > 0) {
    conditions.push({ field: 'types', operator: 'in', value: types });
  }

  if (categories.length > 0) {
    conditions.push({ field: 'categories', operator: 'in', value: categories });
  }

  if (nearby) {
    conditions.push({ field: 'scheduleCoordinates', operator: 'withinRadius', value: nearby });
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return {
    operator: 'and',
    conditions,
  };
}