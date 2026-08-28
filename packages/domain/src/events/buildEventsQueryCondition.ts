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

  const trimmedSearch = search.trim();
  if (trimmedSearch.startsWith('#')) {
    // Hashtag mode: exact match against a post's hashtags, not a substring match against
    // event-name/performers/location (Sections 3.1, 3.7, added 2026-08-28). Lowercased to match
    // the case-insensitive normalization hashtags are stored with.
    const hashtag = trimmedSearch.slice(1).trim().toLowerCase();
    if (hashtag) {
      conditions.push({ field: 'hashtags', operator: 'in', value: [hashtag] });
    }
  } else if (trimmedSearch) {
    conditions.push({
      operator: 'or',
      conditions: [
        { field: 'eventName', operator: 'contains', value: trimmedSearch },
        { field: 'performers', operator: 'contains', value: trimmedSearch },
        { field: 'location', operator: 'contains', value: trimmedSearch },
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