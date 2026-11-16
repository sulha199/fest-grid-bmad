export type DSLOperator = "and" | "or" | "not";
export type TerminalOperator = "eq" | "ne" | "contains" | "in" | "notIn" | "overlaps" | "withinRadius" | "notEnded";

/**
 * BUG-096 -- optional extra on an `overlaps` condition's value: the lower bound is then not the
 * fixed `from` date but, per schedule row, "the date of `instant` in the schedule's own timezone,
 * minus `hidePastEventsAfterDays`" (the schedule_past_cutoff_date SQL function). `from` stays on the
 * condition as the UTC-date fallback for a descriptor that has no timezone columns.
 */
export interface PastCutoff {
  /** ISO-8601 instant the cutoff is taken at (the request's one captured `now`). */
  instant: string;
  hidePastEventsAfterDays: number;
}

export interface TerminalCondition {
  field: string;
  operator: TerminalOperator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

export interface GroupCondition {
  operator: DSLOperator;
  conditions: QueryCondition[];
}

export type QueryCondition = GroupCondition | TerminalCondition;

export function isGroupCondition(cond: QueryCondition): cond is GroupCondition {
  return "conditions" in cond;
}
