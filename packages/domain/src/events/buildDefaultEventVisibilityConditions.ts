import { QueryCondition } from '../query/queryDsl.js';

export const DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS = 7;

export interface BuildDefaultEventVisibilityConditionsInput {
  hidePastEventsAfterDays: number;
  now?: Date;
}

export function buildDefaultEventVisibilityConditions({
  hidePastEventsAfterDays,
  now = new Date(),
}: BuildDefaultEventVisibilityConditionsInput): QueryCondition[] {
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();

  const utcMidnight = new Date(Date.UTC(utcYear, utcMonth, utcDate));
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - hidePastEventsAfterDays);

  const year = utcMidnight.getUTCFullYear();
  const month = String(utcMidnight.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcMidnight.getUTCDate()).padStart(2, '0');
  const threshold = `${year}-${month}-${day}`;

  return [
    {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: threshold, to: null },
    },
  ];
}
