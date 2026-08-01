export type DSLOperator = "and" | "or";
export type TerminalOperator = "eq" | "ne" | "contains" | "in" | "notIn";

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
