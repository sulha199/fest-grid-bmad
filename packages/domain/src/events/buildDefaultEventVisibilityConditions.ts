import { QueryCondition } from '../query/queryDsl.js';
import { computePastEventThreshold } from './computePastEventThreshold.js';

export const DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS = 0;

export interface BuildDefaultEventVisibilityConditionsInput {
  hidePastEventsAfterDays: number;
  now?: Date;
  userId?: string | null;
}

export function buildDefaultEventVisibilityConditions({
  hidePastEventsAfterDays,
  now = new Date(),
  userId,
}: BuildDefaultEventVisibilityConditionsInput): QueryCondition[] {
  const threshold = computePastEventThreshold({ now, hidePastEventsAfterDays });

  const conditions: QueryCondition[] = [
    {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: threshold, to: null },
    },
  ];

  if (userId) {
    conditions.push({
      field: 'isReportedByCurrentUser',
      operator: 'eq',
      value: false,
    });
  }

  return conditions;
}
